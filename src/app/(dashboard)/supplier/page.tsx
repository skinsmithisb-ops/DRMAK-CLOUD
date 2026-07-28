'use client';

import * as React from 'react';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/ui/tabs';
import {
    Truck,
    Plus,
    Search,
    MoreHorizontal,
    Pencil,
    Trash2,
    Phone,
    Mail,
    MapPin,
    Building2,
    Users2,
    CheckCircle2,
    XCircle,
    Loader2,
    PlusCircle,
    DollarSign,
    Package,
    History,
    FileText,
    Receipt,
    Store,
    Factory,
    Activity,
} from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, setDocumentNonBlocking, deleteDocumentNonBlocking, useUser } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Supplier, SupplierProduct, SupplierType } from '@/lib/types';
import { uploadFile } from '@/firebase/storage';
import { cn } from '@/lib/utils';

const SUPPLIER_CATEGORIES = [
    'Pharmaceutical',
    'Medical Equipment',
    'Cosmetics & Skincare',
    'Lab Supplies',
    'Office Supplies',
    'Other',
];

const emptyForm = (): Omit<Supplier, 'id' | 'createdAt'> => ({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    category: 'Pharmaceutical',
    status: 'Active',
    notes: '',
    type: 'Vendor',
    products: [],
    openingBalance: 0,
    currentBalance: 0,
    creditLimit: 0,
});

export default function SupplierPage() {
    const { user } = useUser();
    const { toast } = useToast();
    const firestore = useFirestore();

    const suppliersRef = useMemoFirebase(
        () => (firestore ? collection(firestore, 'suppliers') : null),
        [firestore]
    );

    const { data: suppliers, isLoading } = useCollection<Supplier>(suppliersRef);

    // Search & Filter
    const [search, setSearch] = React.useState('');
    const [filterCategory, setFilterCategory] = React.useState('all');
    const [filterStatus, setFilterStatus] = React.useState('all');
    const [filterType, setFilterType] = React.useState('all');

    // Dialog State
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [editingSupplier, setEditingSupplier] = React.useState<Supplier | null>(null);
    const [formData, setFormData] = React.useState(emptyForm());
    const [isSaving, setIsSaving] = React.useState(false);

    // Vendor Payments State
    const [txDialogOpen, setTxDialogOpen] = React.useState(false);
    const [invoiceFile, setInvoiceFile] = React.useState<File | null>(null);
    const [invoicePreview, setInvoicePreview] = React.useState<string | null>(null);
    const [editingTransaction, setEditingTransaction] = React.useState<VendorTransaction | null>(null);
    const [txFormData, setTxFormData] = React.useState<Omit<VendorTransaction, 'id' | 'createdAt'>>({
        supplierId: '',
        supplierName: '',
        type: 'Bill',
        amount: 0,
        date: new Date().toISOString().split('T')[0],
        reference: '',
        notes: '',
        medicines: [],
        invoiceImageUrl: '',
        addedBy: '',
    });
    const transactionsRef = useMemoFirebase(
        () => (firestore ? collection(firestore, 'vendorTransactions') : null),
        [firestore]
    );
    const { data: transactions } = useCollection<VendorTransaction>(transactionsRef);

    // Delete confirmation
    const [deleteTarget, setDeleteTarget] = React.useState<Supplier | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);

    const filteredSuppliers = React.useMemo(() => {
        if (!suppliers) return [];
        return suppliers.filter(s => {
            const matchesSearch =
                !search ||
                (s.name || '').toLowerCase().includes(search.toLowerCase()) ||
                (s.contactPerson || '').toLowerCase().includes(search.toLowerCase()) ||
                (s.phone || '').includes(search) ||
                (s.city || '').toLowerCase().includes(search.toLowerCase());
            const matchesCategory = filterCategory === 'all' || s.category === filterCategory;
            const matchesStatus = filterStatus === 'all' || s.status === filterStatus;
            const matchesType = filterType === 'all' || s.type === filterType;
            return matchesSearch && matchesCategory && matchesStatus && matchesType;
        });
    }, [suppliers, search, filterCategory, filterStatus, filterType]);

    const stats = React.useMemo(() => {
        const total = suppliers?.length || 0;
        const active = suppliers?.filter(s => s.status === 'Active').length || 0;
        const categories = new Set(suppliers?.map(s => s.category).filter(Boolean)).size;
        return { total, active, inactive: total - active, categories };
    }, [suppliers]);

    // Total business given to each supplier = sum of all "Bill" (stock/medicine purchase) transactions
    const totalBusinessBySupplier = React.useMemo(() => {
        const map: Record<string, number> = {};
        transactions?.forEach(tx => {
            if (tx.type === 'Bill') {
                map[tx.supplierId] = (map[tx.supplierId] || 0) + Number(tx.amount || 0);
            }
        });
        return map;
    }, [transactions]);

    const openAddDialog = () => {
        setEditingSupplier(null);
        setFormData(emptyForm());
        setDialogOpen(true);
    };

    const openEditDialog = (supplier: Supplier) => {
        setEditingSupplier(supplier);
        setFormData({
            name: supplier.name,
            contactPerson: supplier.contactPerson || '',
            phone: supplier.phone || '',
            email: supplier.email || '',
            address: supplier.address || '',
            city: supplier.city || '',
            category: supplier.category || '',
            status: supplier.status || 'Active',
            notes: supplier.notes || '',
            type: supplier.type || 'Vendor',
            products: supplier.products || [],
            openingBalance: supplier.openingBalance || 0,
            currentBalance: supplier.currentBalance || 0,
            creditLimit: supplier.creditLimit || 0,
        });
        setDialogOpen(true);
    };

    const handleSave = async () => {
        if (!firestore || !suppliersRef) return;
        if (!formData.name.trim()) {
            toast({ variant: 'destructive', title: 'Validation Error', description: 'Supplier name is required.' });
            return;
        }
        setIsSaving(true);

        // Validation: Ensure valid selling price
        if (formData.products && formData.products.length > 0) {
            for (const p of formData.products) {
                if ((p.sellingPrice || 0) <= 0) {
                    toast({
                        variant: 'destructive',
                        title: 'Pricing Error',
                        description: `Please set a valid sale price for "${p.name || 'this item'}".`
                    });
                    setIsSaving(false);
                    return;
                }
            }
        }

        try {
            let supplierId = editingSupplier?.id;
            if (editingSupplier) {
                await updateDocumentNonBlocking(doc(firestore, 'suppliers', editingSupplier.id), formData);
                toast({ title: 'Supplier Updated', description: `${formData.name} has been updated.` });
            } else {
                const res = await addDocumentNonBlocking(suppliersRef, {
                    ...formData,
                    createdAt: new Date().toISOString(),
                });
                supplierId = (res as any)?.id;
                toast({ title: 'Supplier Added', description: `${formData.name} has been added to Suppliers.` });
            }

            // Sync products to pharmacyItems collection for POS visibility
            if (formData.products && formData.products.length > 0) {
                for (const p of formData.products) {
                    const pDocRef = doc(firestore, 'pharmacyItems', p.id);
                    const sellingPrice = p.sellingPrice !== undefined ? Number(p.sellingPrice) : 0;
                    const quantity = p.quantity !== undefined ? Number(p.quantity) : 0;

                    await setDocumentNonBlocking(pDocRef, {
                        id: p.id,
                        productName: p.name,
                        sellingPrice: isNaN(sellingPrice) ? 0 : sellingPrice,
                        quantity: isNaN(quantity) ? 0 : quantity,
                        supplier: formData.name,
                        supplierId: supplierId || editingSupplier?.id,
                        category: formData.category,
                        rack: p.rack || '',
                        minThreshold: p.minThreshold !== undefined ? Number(p.minThreshold) : 0,
                        expiryDate: p.expiryDate || '',
                        active: true
                    }, { merge: true });
                }
            }

            // Cleanup deleted products from pharmacyItems
            if (editingSupplier && editingSupplier.products) {
                const newProductIds = new Set(formData.products?.map(p => p.id) || []);
                const removedProducts = editingSupplier.products.filter(p => !newProductIds.has(p.id));
                for (const p of removedProducts) {
                    await deleteDocumentNonBlocking(doc(firestore, 'pharmacyItems', p.id));
                }
            }

            setDialogOpen(false);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!firestore || !deleteTarget) return;
        const targetId = deleteTarget.id;
        const targetName = deleteTarget.name;

        // 1. Close dialog immediately to restore UI interactivity
        setDeleteDialogOpen(false);

        // 2. Perform deletion
        try {
            await deleteDocumentNonBlocking(doc(firestore, 'suppliers', targetId));
            toast({ title: 'Supplier Deleted', description: `${targetName} has been removed.` });
        } catch (error) {
            console.error("Deletion error:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete supplier.' });
        } finally {
            // 3. Clear target state after animation buffer
            setTimeout(() => setDeleteTarget(null), 100);
        }
    };

    const handleChange = (field: string, value: string | number) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleLogTransaction = async () => {
        if (!firestore || !transactionsRef) return;
        if (!txFormData.supplierId || txFormData.amount <= 0) {
            toast({ variant: 'destructive', title: 'Validation Error', description: 'Select a supplier and enter a valid amount.' });
            return;
        }
        setIsSaving(true);
        try {
            // Upload invoice image first if one was selected
            let invoiceImageUrl = txFormData.invoiceImageUrl || '';
            if (invoiceFile) {
                const path = `vendor-invoices/${txFormData.supplierId}/${Date.now()}-${invoiceFile.name}`;
                const uploaded = await uploadFile(invoiceFile, path);
                if (uploaded) invoiceImageUrl = uploaded;
            }
            const dataToSave = { ...txFormData, invoiceImageUrl, amount: Number(txFormData.amount) };

            if (editingTransaction) {
                // Revert old balance
                const supplierRef = doc(firestore, 'suppliers', editingTransaction.supplierId);
                const supplier = suppliers?.find(s => s.id === editingTransaction.supplierId);
                if (supplier) {
                    const oldAdjustment = editingTransaction.type === 'Bill' ? Number(editingTransaction.amount) : -Number(editingTransaction.amount);
                    await updateDocumentNonBlocking(supplierRef, {
                        currentBalance: (supplier.currentBalance || 0) - oldAdjustment
                    });
                }
                await updateDocumentNonBlocking(doc(firestore, 'vendorTransactions', editingTransaction.id), dataToSave);
            } else {
                await addDocumentNonBlocking(transactionsRef, {
                    ...dataToSave,
                    createdAt: new Date().toISOString(),
                });
            }

            // Apply new balance
            const targetSupplierRef = doc(firestore, 'suppliers', txFormData.supplierId);
            const supplier = suppliers?.find(s => s.id === txFormData.supplierId);
            if (supplier) {
                const baseBalance = editingTransaction
                    ? (supplier.currentBalance || 0) - (editingTransaction.type === 'Bill' ? editingTransaction.amount : -editingTransaction.amount)
                    : (supplier.currentBalance || 0);
                const newAdjustment = txFormData.type === 'Bill' ? Number(txFormData.amount) : -Number(txFormData.amount);
                await updateDocumentNonBlocking(targetSupplierRef, { currentBalance: baseBalance + newAdjustment });
            }

            toast({ title: editingTransaction ? 'Transaction Updated' : 'Transaction Recorded', description: `PKR ${txFormData.amount.toLocaleString()} ${txFormData.type} processed.` });
            setInvoiceFile(null);
            setInvoicePreview(null);
            setTxDialogOpen(false);
            setEditingTransaction(null);
        } catch (error) {
            console.error("Log Transaction Error:", error);
            toast({ variant: 'destructive', title: 'Operation Failed' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteTransaction = async (tx: VendorTransaction) => {
        if (!firestore) return;
        try {
            // 1. Revert Balance
            const supplierRef = doc(firestore, 'suppliers', tx.supplierId);
            const supplier = suppliers?.find(s => s.id === tx.supplierId);
            if (supplier) {
                const currentBalance = (supplier.currentBalance || 0);
                const adjustment = tx.type === 'Bill' ? Number(tx.amount) : -Number(tx.amount);
                await updateDocumentNonBlocking(supplierRef, {
                    currentBalance: currentBalance - adjustment
                });
            }

            // 2. Delete record
            await deleteDocumentNonBlocking(doc(firestore, 'vendorTransactions', tx.id));
            toast({ title: 'Transaction Deleted', description: 'The ledger has been adjusted accordingly.' });
        } catch (error) {
            console.error("Delete Transaction Error:", error);
            toast({ variant: 'destructive', title: 'Deletion Failed' });
        }
    };

    const addProduct = () => {
        setFormData(prev => ({
            ...prev,
            products: [
                ...(prev.products || []),
                { 
                    id: Math.random().toString(36).substr(2, 9), 
                    name: '', 
                    sellingPrice: 0, 
                    quantity: 0, 
                    minThreshold: 0,
                    rack: '',
                    expiryDate: ''
                }
            ]
        }));
    };

    const removeProduct = (idx: number) => {
        setFormData(prev => ({
            ...prev,
            products: prev.products?.filter((_, i) => i !== idx)
        }));
    };

    const updateProduct = (idx: number, field: keyof SupplierProduct, value: string | number) => {
        setFormData(prev => ({
            ...prev,
            products: prev.products?.map((p, i) => {
                if (i !== idx) return p;
                if (field === 'sellingPrice' || field === 'quantity' || field === 'minThreshold') {
                    if (value === '') return { ...p, [field]: undefined };
                    const numVal = parseFloat(value);
                    return { ...p, [field]: isNaN(numVal) ? 0 : numVal };
                }
                return { ...p, [field]: value };
            })
        }));
    };

    const renderSupplierTable = (data: Supplier[]) => (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Contact Info</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Clearing Logic</TableHead>
                    <TableHead>Total Business</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {data.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                            <div className="flex flex-col items-center gap-2">
                                <Truck className="h-8 w-8 opacity-30" />
                                <p className="font-medium">No suppliers found</p>
                                <p className="text-xs">Add your first supplier to get started.</p>
                            </div>
                        </TableCell>
                    </TableRow>
                ) : (
                    data.map(supplier => (
                        <TableRow key={supplier.id} className="group hover:bg-muted/50 transition-colors">
                            <TableCell>
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm transition-transform group-hover:scale-105",
                                        supplier.type === 'Vendor' ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-950/30" : "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/30"
                                    )}>
                                        {supplier.type === 'Vendor' ? <Store className="h-5 w-5" /> : <Truck className="h-5 w-5" />}
                                    </div>
                                    <div>
                                        <p className="font-bold text-base leading-none mb-1">{supplier.name}</p>
                                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Users2 className="h-3 w-3" /> {supplier.contactPerson || 'No contact person'}
                                        </p>
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell>
                                <Badge variant="secondary" className={cn(
                                    "font-semibold",
                                    supplier.type === 'Vendor' ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20"
                                )}>
                                    {supplier.type}
                                </Badge>
                            </TableCell>
                            <TableCell>
                                <div className="space-y-1">
                                    {supplier.phone && (
                                        <div className="flex items-center gap-1.5 text-xs font-medium">
                                            <Phone className="h-3 w-3 text-primary" />
                                            {supplier.phone}
                                        </div>
                                    )}
                                    {supplier.email && (
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                            <Mail className="h-3 w-3" />
                                            {supplier.email}
                                        </div>
                                    )}
                                </div>
                            </TableCell>
                            <TableCell>
                                <Badge variant="outline" className="text-[10px] uppercase tracking-wider font-bold">
                                    {supplier.category}
                                </Badge>
                            </TableCell>
                            <TableCell>
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                        <History className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span className="text-xs font-semibold">
                                            {supplier.type === 'Vendor' ? 'Product-to-Product' : 'Bill-to-Bill'}
                                        </span>
                                    </div>
                                    {(supplier.currentBalance !== undefined || (supplier as any).balance !== undefined) && (
                                        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                                            <DollarSign className="h-2.5 w-2.5" />
                                            Balance: <span className={cn((supplier.currentBalance || 0) > 0 ? "text-red-500 font-bold" : "text-green-600 font-bold")}>
                                                PKR {(supplier.currentBalance || 0).toLocaleString()}
                                            </span>
                                        </div>
                                    )}
                                    {supplier.type === 'Vendor' && supplier.products && (
                                        <div className="text-[10px] text-muted-foreground">
                                            {supplier.products.length} products listed
                                        </div>
                                    )}
                                </div>
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center gap-1.5">
                                    <Receipt className="h-3.5 w-3.5 text-teal-600" />
                                    <span className="text-sm font-black text-teal-700">
                                        PKR {(totalBusinessBySupplier[supplier.id] || 0).toLocaleString()}
                                    </span>
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-0.5">Total medicines purchased</p>
                            </TableCell>
                            <TableCell>
                                <Badge
                                    variant={supplier.status === 'Active' ? 'default' : 'outline'}
                                    className={cn(
                                        "rounded-full px-3",
                                        supplier.status === 'Active' ? 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100 shadow-sm' : 'text-muted-foreground'
                                    )}
                                >
                                    {supplier.status}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48 shadow-xl">
                                        <DropdownMenuItem onClick={() => openEditDialog(supplier)} className="cursor-pointer">
                                            <Pencil className="mr-2 h-4 w-4 text-primary" />
                                            Edit Details
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            className="text-red-600 focus:text-red-600 cursor-pointer"
                                            onClick={() => { setDeleteTarget(supplier); setDeleteDialogOpen(true); }}
                                        >
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Remove Supplier
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    ))
                )}
            </TableBody>
        </Table>
    );

    if (isLoading) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <p className="text-sm font-medium animate-pulse">Loading Suppliers...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 p-4 md:p-8 bg-muted/10 min-h-screen">
            {/* Header Redesign */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b">
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-primary/10 rounded-2xl">
                            <Truck className="h-8 w-8 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-4xl font-extrabold tracking-tight">Supplier Ecosystem</h1>
                            <p className="text-muted-foreground text-lg">
                                Orchestrate your Vendors and Distributors with precision.
                            </p>
                        </div>
                    </div>
                </div>
                <Button onClick={openAddDialog} className="h-14 px-8 gap-2 rounded-2xl shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all text-lg font-bold">
                    <PlusCircle className="h-6 w-6" />
                    Board New Partner
                </Button>
            </div>

            {/* Premium Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Total Partners', val: stats.total, icon: Users2, color: 'text-blue-500', bg: 'bg-blue-50', sub: 'Active directory' },
                    { label: 'Active Status', val: stats.active, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50', sub: 'Operating ready' },
                    { label: 'Inactive/Paused', val: stats.inactive, icon: XCircle, color: 'text-red-500', bg: 'bg-red-50', sub: 'Need review' },
                    { label: 'Total Categories', val: stats.categories, icon: Building2, color: 'text-amber-500', bg: 'bg-amber-50', sub: 'Supply diversity' },
                ].map((stat, i) => (
                    <Card key={i} className="border-none shadow-md bg-gradient-to-br from-card to-muted/30 overflow-hidden relative group hover:scale-[1.02] transition-transform">
                        <div className={cn("absolute top-0 right-0 p-8 opacity-5 transition-opacity group-hover:opacity-10", stat.bg)}>
                            <stat.icon size={120} />
                        </div>
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{stat.label}</p>
                                <div className={cn("p-2 rounded-lg", stat.bg)}>
                                    <stat.icon className={cn("h-5 w-5", stat.color)} />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-black">{stat.val}</div>
                            <p className="text-xs text-muted-foreground mt-1 font-medium">{stat.sub}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Main Content with Tabs */}
            <Card className="border-none shadow-xl bg-card/60 backdrop-blur-xl">
                <CardHeader className="border-b bg-muted/10">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                        <div>
                            <CardTitle className="text-2xl font-black">Supplier Directory</CardTitle>
                            <CardDescription className="text-base">
                                Filter and manage your supply chain partners.
                            </CardDescription>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                <Input
                                    placeholder="Search ecosystem..."
                                    className="pl-10 w-full sm:w-80 h-12 rounded-xl bg-background shadow-inner"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                />
                            </div>
                            <Select value={filterCategory} onValueChange={setFilterCategory}>
                                <SelectTrigger className="w-[180px] h-12 rounded-xl bg-background">
                                    <SelectValue placeholder="All Categories" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Categories</SelectItem>
                                    {SUPPLIER_CATEGORIES.map(c => (
                                        <SelectItem key={c} value={c}>{c}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={filterStatus} onValueChange={setFilterStatus}>
                                <SelectTrigger className="w-[140px] h-12 rounded-xl bg-background">
                                    <SelectValue placeholder="All Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Status</SelectItem>
                                    <SelectItem value="Active">Active</SelectItem>
                                    <SelectItem value="Inactive">Inactive</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={filterType} onValueChange={setFilterType}>
                                <SelectTrigger className="w-[160px] h-12 rounded-xl bg-background border-primary/20">
                                    <SelectValue placeholder="Partner Type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Every Type</SelectItem>
                                    <SelectItem value="Vendor">Vendors Only</SelectItem>
                                    <SelectItem value="Distributor">Distributors Only</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Tabs defaultValue="all" className="w-full">
                        <div className="px-6 py-4 border-b bg-muted/5">
                            <TabsList className="bg-muted/20 h-12 p-1.5 rounded-xl gap-2">
                                <TabsTrigger value="all" className="rounded-lg px-6 font-bold flex items-center gap-2">
                                    <Building2 className="h-4 w-4" /> All
                                </TabsTrigger>
                                <TabsTrigger value="Vendor" className="rounded-lg px-6 font-bold flex items-center gap-2 data-[state=active]:bg-indigo-600 data-[state=active]:text-white transition-colors">
                                    <Store className="h-4 w-4" /> Vendors (Procedural)
                                </TabsTrigger>
                                <TabsTrigger value="Distributor" className="rounded-lg px-6 font-bold flex items-center gap-2 data-[state=active]:bg-emerald-600 data-[state=active]:text-white transition-colors">
                                    <Truck className="h-4 w-4" /> Distributors (Pharmacy)
                                </TabsTrigger>
                                <TabsTrigger value="Payments" className="rounded-lg px-6 font-bold flex items-center gap-2 data-[state=active]:bg-amber-600 data-[state=active]:text-white transition-colors">
                                    <DollarSign className="h-4 w-4" /> Vendor Payments
                                </TabsTrigger>
                            </TabsList>
                        </div>
                        <TabsContent value="all" className="m-0 focus-visible:outline-none">
                            {renderSupplierTable(filteredSuppliers)}
                        </TabsContent>
                        <TabsContent value="Vendor" className="m-0 focus-visible:outline-none">
                            {renderSupplierTable(filteredSuppliers.filter(s => s.type === 'Vendor'))}
                        </TabsContent>
                        <TabsContent value="Distributor" className="m-0 focus-visible:outline-none">
                            {renderSupplierTable(filteredSuppliers.filter(s => s.type === 'Distributor'))}
                        </TabsContent>
                        <TabsContent value="Payments" className="m-0 focus-visible:outline-none">
                            <div className="p-6 space-y-6">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-lg font-bold">Recent Transactions</h3>
                                    <Button onClick={() => {
                                        setTxFormData({
                                            supplierId: '',
                                            supplierName: '',
                                            type: 'Bill',
                                            amount: 0,
                                            date: new Date().toISOString().split('T')[0],
                                            reference: '',
                                            notes: '',
                                            medicines: [],
                                            addedBy: user?.name || 'Operations Manager',
                                        });
                                        setTxDialogOpen(true);
                                    }} className="bg-amber-600 hover:bg-amber-700 rounded-xl">
                                        <PlusCircle className="mr-2 h-4 w-4" /> Log Transaction
                                    </Button>
                                </div>
                                <div className="border rounded-2xl overflow-hidden">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-muted/50">
                                                <TableHead>Date</TableHead>
                                                <TableHead>Supplier</TableHead>
                                                <TableHead>Type</TableHead>
                                                <TableHead>Reference</TableHead>
                                                <TableHead>Notes</TableHead>
                                                <TableHead className="text-right">Amount</TableHead>
                                                <TableHead>Logged By</TableHead>
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {transactions && transactions.length > 0 ? (
                                                transactions.slice().sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(tx => (
                                                    <TableRow key={tx.id} className="group hover:bg-muted/30 transition-colors">
                                                        <TableCell className="font-medium text-xs">{tx.date}</TableCell>
                                                        <TableCell className="font-bold">{tx.supplierName}</TableCell>
                                                        <TableCell>
                                                            <Badge variant="outline" className={tx.type === 'Bill' ? "text-amber-600 border-amber-200 bg-amber-50" : "text-emerald-600 border-emerald-200 bg-emerald-50"}>
                                                                {tx.type === 'Bill' ? 'Stock Bill' : 'Cash Paid'}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-xs text-muted-foreground">{tx.reference || '-'}</TableCell>
                                                         <TableCell>
                                                             <div className="flex flex-col gap-2 py-1">
                                                                 {tx.medicines && tx.medicines.length > 0 && (
                                                                     <div className="flex flex-wrap gap-1">
                                                                         {tx.medicines.map(m => (
                                                                             <Badge key={m} variant="secondary" className="text-[10px] px-2 py-0.5 bg-indigo-50 text-indigo-700 border-none font-black uppercase tracking-tight">
                                                                                 {m}
                                                                             </Badge>
                                                                         ))}
                                                                     </div>
                                                                 )}
                                                                 <p className="text-xs font-medium text-slate-500 leading-relaxed max-w-[400px]">
                                                                     {tx.notes || (tx.medicines?.length ? '' : '-')}
                                                                 </p>
                                                             </div>
                                                         </TableCell>
                                                        <TableCell className={cn("text-right font-black", tx.type === 'Bill' ? "text-amber-600" : "text-emerald-600")}>
                                                            {tx.type === 'Bill' ? '+' : '-'} PKR {tx.amount.toLocaleString()}
                                                        </TableCell>
                                                        <TableCell className="text-[10px] text-muted-foreground font-medium uppercase">{tx.addedBy}</TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="icon" 
                                                                    className="h-8 w-8 rounded-lg hover:bg-amber-100 hover:text-amber-600"
                                                                    onClick={() => {
                                                                        setEditingTransaction(tx);
                                                                        setTxFormData({
                                                                            supplierId: tx.supplierId,
                                                                            supplierName: tx.supplierName,
                                                                            type: tx.type,
                                                                            amount: tx.amount,
                                                                            date: tx.date,
                                                                            reference: tx.reference || '',
                                                                            notes: tx.notes || '',
                                                                            medicines: tx.medicines || [],
                                                                            addedBy: tx.addedBy,
                                                                        });
                                                                        setTxDialogOpen(true);
                                                                    }}
                                                                >
                                                                    <Pencil className="h-3.5 w-3.5" />
                                                                </Button>
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="icon" 
                                                                    className="h-8 w-8 rounded-lg hover:bg-rose-100 hover:text-rose-600"
                                                                    onClick={() => handleDeleteTransaction(tx)}
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            ) : (
                                                <TableRow>
                                                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">No transactions logged yet.</TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            {/* Redesigned Add / Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-[800px] p-0 overflow-hidden rounded-3xl border-none shadow-2xl">
                    <div className="bg-gradient-to-r from-primary/10 to-transparent p-8 border-b">
                        <DialogHeader>
                            <DialogTitle className="text-3xl font-black flex items-center gap-3">
                                {editingSupplier ? <Pencil className="h-8 w-8 text-primary" /> : <PlusCircle className="h-8 w-8 text-primary" />}
                                {editingSupplier ? 'Redesign Partner' : 'Onboard New Partner'}
                            </DialogTitle>
                            <DialogDescription className="text-base font-medium">
                                {editingSupplier
                                    ? `Update organizational details for ${editingSupplier.name}.`
                                    : 'Establish a new relationship within your supply ecosystem.'}
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    <div className="p-8 max-h-[70vh] overflow-y-auto space-y-8">
                        {/* Type Selection */}
                        <div className="space-y-4">
                            <Label className="text-sm font-bold uppercase tracking-widest text-muted-foreground px-1">Relationship Type</Label>
                            <div className="grid grid-cols-2 gap-4">
                                <div
                                    className={cn(
                                        "relative p-6 rounded-2xl border-2 cursor-pointer transition-all flex flex-col items-center gap-3 text-center group",
                                        formData.type === 'Vendor' ? "border-indigo-500 bg-indigo-50/50 shadow-md" : "border-muted-foreground/10 hover:border-indigo-200"
                                    )}
                                    onClick={() => handleChange('type', 'Vendor')}
                                >
                                    <div className={cn("p-4 rounded-xl transition-all group-hover:scale-110", formData.type === 'Vendor' ? "bg-indigo-500 text-white" : "bg-muted text-muted-foreground")}>
                                        <Store size={32} />
                                    </div>
                                    <div>
                                        <p className="font-black text-lg">Vendor</p>
                                        <p className="text-xs text-muted-foreground mt-1 text-balance">Direct procedural products. Product-to-Product logic.</p>
                                    </div>
                                    {formData.type === 'Vendor' && <CheckCircle2 className="absolute top-4 right-4 text-indigo-500 h-6 w-6" />}
                                </div>
                                <div
                                    className={cn(
                                        "relative p-6 rounded-2xl border-2 cursor-pointer transition-all flex flex-col items-center gap-3 text-center group",
                                        formData.type === 'Distributor' ? "border-emerald-500 bg-emerald-50/50 shadow-md" : "border-muted-foreground/10 hover:border-indigo-200"
                                    )}
                                    onClick={() => handleChange('type', 'Distributor')}
                                >
                                    <div className={cn("p-4 rounded-xl transition-all group-hover:scale-110", formData.type === 'Distributor' ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground")}>
                                        <Truck size={32} />
                                    </div>
                                    <div>
                                        <p className="font-black text-lg">Distributor</p>
                                        <p className="text-xs text-muted-foreground mt-1 text-balance">Wholesale pharmacy supply. Bill-to-Bill logic.</p>
                                    </div>
                                    {formData.type === 'Distributor' && <CheckCircle2 className="absolute top-4 right-4 text-emerald-500 h-6 w-6" />}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <Label className="text-sm font-bold uppercase tracking-widest text-muted-foreground px-1">Foundation Details</Label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="md:col-span-2 space-y-2">
                                    <Label htmlFor="sup-name" className="px-1 text-sm font-bold">Organization Name</Label>
                                    <Input
                                        id="sup-name"
                                        placeholder="Enter company or partner name"
                                        className="h-12 rounded-xl bg-muted/20 border-none shadow-inner text-lg font-medium focus-visible:ring-primary"
                                        value={formData.name}
                                        onChange={e => handleChange('name', e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="sup-contact" className="px-1 text-sm font-bold">Lead Contact Person</Label>
                                    <Input
                                        id="sup-contact"
                                        placeholder="Full name of representative"
                                        className="h-12 rounded-xl bg-muted/20 border-none shadow-inner"
                                        value={formData.contactPerson}
                                        onChange={e => handleChange('contactPerson', e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="sup-phone" className="px-1 text-sm font-bold">Contact Sequence (Phone)</Label>
                                    <Input
                                        id="sup-phone"
                                        placeholder="WhatsApp or Direct Line"
                                        className="h-12 rounded-xl bg-muted/20 border-none shadow-inner"
                                        value={formData.phone}
                                        onChange={e => handleChange('phone', e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Shared Pricing & Catalog Section */}
                        <div className={cn(
                            "space-y-6 p-6 rounded-3xl border-2 transition-colors",
                            formData.type === 'Vendor' ? "bg-indigo-50/50 border-indigo-100" : "bg-emerald-50/50 border-emerald-100"
                        )}>
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className={cn(
                                        "text-xl font-black flex items-center gap-2",
                                        formData.type === 'Vendor' ? "text-indigo-900" : "text-emerald-900"
                                    )}>
                                        <Store className="h-6 w-6" /> Pricing & Catalog <span className="text-xs font-medium opacity-60 ml-2 italic">(Optional)</span>
                                    </h3>
                                    <p className={cn(
                                        "text-sm font-medium",
                                        formData.type === 'Vendor' ? "text-indigo-700/70" : "text-emerald-700/70"
                                    )}>Define core supply products and their default base pricing.</p>
                                </div>
                                <Button 
                                    type="button" 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={addProduct} 
                                    className={cn(
                                        "bg-white transition-colors gap-2 rounded-xl h-10 px-4 font-bold border-2",
                                        formData.type === 'Vendor' ? "hover:bg-indigo-600 hover:text-white border-indigo-200" : "hover:bg-emerald-600 hover:text-white border-emerald-200"
                                    )}
                                >
                                    <Plus className="h-4 w-4" /> Add Line Item
                                </Button>
                            </div>

                            <div className="space-y-4">
                                {formData.products?.length === 0 ? (
                                    <div className={cn(
                                        "py-8 text-center border-2 border-dashed rounded-2xl bg-white/50",
                                        formData.type === 'Vendor' ? "border-indigo-200 text-indigo-400" : "border-emerald-200 text-emerald-400"
                                    )}>
                                        <p className="text-sm font-bold">No items listed. You can skip this and add them later.</p>
                                    </div>
                                ) : (
                                    <div className="grid gap-3">
                                        {formData.products?.map((p, i) => (
                                            <div key={p.id} className={cn(
                                                "grid grid-cols-1 md:grid-cols-12 gap-6 bg-white p-6 rounded-3xl shadow-sm border animate-in fade-in slide-in-from-top-2",
                                                formData.type === 'Vendor' ? "border-indigo-100" : "border-emerald-100"
                                            )}>
                                                <div className="md:col-span-5 space-y-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className={cn(
                                                            "h-8 w-8 rounded-xl flex items-center justify-center text-xs font-black",
                                                            formData.type === 'Vendor' ? "bg-indigo-100 text-indigo-600" : "bg-emerald-100 text-emerald-600"
                                                        )}>{i + 1}</div>
                                                        <div className="flex-1 space-y-1">
                                                            <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Product Identity</Label>
                                                            <Input
                                                                placeholder="Enter product name..."
                                                                className="h-11 rounded-xl border-none bg-muted/20 font-bold focus-visible:ring-indigo-500"
                                                                value={p.name}
                                                                onChange={e => updateProduct(i, 'name', e.target.value)}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-4 pl-11">
                                                        <div className="space-y-1">
                                                            <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Rack Location</Label>
                                                            <Select value={p.rack} onValueChange={val => updateProduct(i, 'rack', val)}>
                                                                <SelectTrigger className="h-11 rounded-xl bg-muted/20 border-none font-bold">
                                                                    <SelectValue placeholder="Select Rack" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'].map(r => (
                                                                        <SelectItem key={r} value={r} className="font-bold">Rack {r}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Expiry Date</Label>
                                                            <Input
                                                                type="date"
                                                                className="h-11 rounded-xl bg-muted/20 border-none font-bold"
                                                                value={p.expiryDate || ''}
                                                                onChange={e => updateProduct(i, 'expiryDate', e.target.value)}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="md:col-span-7 grid grid-cols-1 gap-4 bg-muted/5 p-5 rounded-3xl border border-muted-200 relative">
                                                    <div className="space-y-1.5">
                                                        <Label className="text-[10px] font-black uppercase text-teal-600 ml-1">Sale Price (Rs)</Label>
                                                        <Input
                                                            type="number"
                                                            placeholder="0"
                                                            className="h-12 rounded-xl font-black text-teal-700 border-teal-200 bg-white focus-visible:ring-teal-500 text-lg px-4"
                                                            value={p.sellingPrice === undefined ? '' : p.sellingPrice}
                                                            onChange={e => updateProduct(i, 'sellingPrice', e.target.value)}
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <Label className="text-[10px] font-black uppercase text-slate-500 ml-1">Inventory Quantity</Label>
                                                        <Input
                                                            type="number"
                                                            placeholder="0"
                                                            className="h-12 rounded-xl font-black text-slate-700 border-slate-200 bg-white focus-visible:ring-slate-500 text-lg px-4"
                                                            value={p.quantity === undefined ? '' : p.quantity}
                                                            onChange={e => updateProduct(i, 'quantity', e.target.value)}
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <Label className="text-[10px] font-black uppercase text-amber-600 ml-1">Min. Alert Threshold</Label>
                                                        <Input
                                                            type="number"
                                                            placeholder="0"
                                                            className="h-12 rounded-xl font-black text-amber-700 border-amber-200 bg-white focus-visible:ring-amber-500 text-lg px-4"
                                                            value={p.minThreshold === undefined ? '' : p.minThreshold}
                                                            onChange={e => updateProduct(i, 'minThreshold', e.target.value)}
                                                        />
                                                    </div>
                                                    
                                                    <button 
                                                        onClick={() => removeProduct(i)}
                                                        className="absolute -top-3 -right-3 h-8 w-8 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-lg hover:bg-rose-600 transition-all hover:scale-110 active:scale-95"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {formData.type === 'Distributor' && (
                            <div className="space-y-6 p-6 rounded-3xl bg-emerald-50/50 border-2 border-emerald-100">
                                <div>
                                    <h3 className="text-xl font-black text-emerald-900 flex items-center gap-2">
                                        <Receipt className="h-6 w-6" /> Financial Matrix
                                    </h3>
                                    <p className="text-sm text-emerald-700/70 font-medium">Configure bill-to-bill credit parameters.</p>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                    <div className="space-y-2">
                                        <Label className="px-1 text-sm font-bold text-emerald-800">Opening Balance</Label>
                                        <div className="relative">
                                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />
                                            <Input
                                                type="number"
                                                className="pl-9 h-12 rounded-xl border-none bg-white shadow-sm focus-visible:ring-emerald-500 font-bold"
                                                value={formData.openingBalance || ''}
                                                onChange={e => handleChange('openingBalance', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="px-1 text-sm font-bold text-emerald-800">Current Liability</Label>
                                        <div className="relative">
                                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />
                                            <Input
                                                type="number"
                                                className="pl-9 h-12 rounded-xl border-none bg-white shadow-sm focus-visible:ring-emerald-500 font-bold"
                                                value={formData.currentBalance || ''}
                                                onChange={e => handleChange('currentBalance', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="px-1 text-sm font-bold text-emerald-800">Credit Threshold</Label>
                                        <div className="relative">
                                            <CheckCircle2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />
                                            <Input
                                                type="number"
                                                className="pl-9 h-12 rounded-xl border-none bg-white shadow-sm focus-visible:ring-emerald-500 font-bold"
                                                value={formData.creditLimit || ''}
                                                onChange={e => handleChange('creditLimit', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Meta & Location */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <Label className="text-sm font-bold uppercase tracking-widest text-muted-foreground px-1">Location Data</Label>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="sup-city" className="px-1 text-xs font-bold uppercase">City</Label>
                                        <Input
                                            id="sup-city"
                                            placeholder="Current HQ city"
                                            className="h-12 rounded-xl bg-muted/20 border-none shadow-inner"
                                            value={formData.city}
                                            onChange={e => handleChange('city', e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="sup-address" className="px-1 text-xs font-bold uppercase">Physical Address</Label>
                                        <Textarea
                                            id="sup-address"
                                            placeholder="Precise warehouse or office location"
                                            className="rounded-xl bg-muted/20 border-none shadow-inner resize-none h-24 p-4"
                                            value={formData.address}
                                            onChange={e => handleChange('address', e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <Label className="text-sm font-bold uppercase tracking-widest text-muted-foreground px-1">Governance & Logistics</Label>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label className="px-1 text-xs font-bold uppercase">Classification Category</Label>
                                        <Select value={formData.category} onValueChange={v => handleChange('category', v)}>
                                            <SelectTrigger className="h-12 rounded-xl bg-muted/20 border-none shadow-inner">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {SUPPLIER_CATEGORIES.map(c => (
                                                    <SelectItem key={c} value={c}>{c}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="px-1 text-xs font-bold uppercase">Operational Status</Label>
                                        <Select value={formData.status} onValueChange={v => handleChange('status', v)}>
                                            <SelectTrigger className="h-12 rounded-xl bg-muted/20 border-none shadow-inner">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Active">Active & Transacting</SelectItem>
                                                <SelectItem value="Inactive">Paused / Archived</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>

                            <div className="md:col-span-2 space-y-2">
                                <Label htmlFor="sup-notes" className="px-1 text-sm font-bold uppercase tracking-widest text-muted-foreground">Internal Partner Intelligence (Notes)</Label>
                                <Textarea
                                    id="sup-notes"
                                    placeholder="Key insights, delivery patterns, or legacy performance notes..."
                                    className="rounded-2xl bg-muted/20 border-none shadow-inner resize-none h-32 p-4 text-base"
                                    value={formData.notes}
                                    onChange={e => handleChange('notes', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="bg-muted/10 p-8 flex justify-end gap-3 border-t">
                        <Button variant="ghost" onClick={() => setDialogOpen(false)} className="h-14 px-8 rounded-2xl font-bold">
                            Abort
                        </Button>
                        <Button onClick={handleSave} disabled={isSaving} className="h-14 px-12 gap-2 rounded-2xl shadow-xl shadow-primary/20 hover:shadow-primary/40 transition-all text-lg font-black">
                            {isSaving ? <Loader2 className="h-6 w-6 animate-spin" /> : null}
                            {editingSupplier ? 'Secure Changes' : 'Finalize Onboarding'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog Redesign */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent className="sm:max-w-[500px] p-8 rounded-3xl border-none shadow-2xl overflow-hidden">
                    <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                        <Trash2 size={180} className="text-red-500" />
                    </div>
                    <DialogHeader className="relative">
                        <div className="h-16 w-16 rounded-2xl bg-red-100 flex items-center justify-center mb-6">
                            <Trash2 className="h-8 w-8 text-red-600" />
                        </div>
                        <DialogTitle className="text-3xl font-black text-red-900 leading-tight">
                            Dissolve Partnership?
                        </DialogTitle>
                        <DialogDescription className="text-lg font-medium text-red-700/70 pt-2 leading-relaxed">
                            You are about to permanently remove <span className="text-red-900 font-bold underline underline-offset-4 decoration-2">{deleteTarget?.name}</span> from your ecosystem. All associated metadata will be liquidated.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-10 gap-3 relative">
                        <Button variant="ghost" onClick={() => setDeleteDialogOpen(false)} className="h-14 flex-1 rounded-2xl font-bold">
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleDelete} className="h-14 flex-1 gap-2 rounded-2xl shadow-xl shadow-red-500/20 hover:shadow-red-500/40 transition-all text-lg font-black">
                            Liquidate Partner
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {/* Vendor Transaction Dialog */}
            <Dialog open={txDialogOpen} onOpenChange={(open) => { setTxDialogOpen(open); if (!open) { setInvoiceFile(null); setInvoicePreview(null); setEditingTransaction(null); } }}>
                <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-3xl border-none shadow-2xl">
                    <div className="bg-amber-600 p-8 text-white">
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-black flex items-center gap-2">
                                <DollarSign className="h-6 w-6" /> {editingTransaction ? 'Edit Transaction' : 'Log Vendor Payment / Bill'}
                            </DialogTitle>
                            <DialogDescription className="text-amber-100 font-medium">
                                {editingTransaction ? `Modify transaction details for ${editingTransaction.supplierName}.` : 'Record financial transactions for ledger maintenance.'}
                            </DialogDescription>
                        </DialogHeader>
                    </div>
                    
                    <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Select Supplier</Label>
                            <Select 
                                value={txFormData.supplierId} 
                                onValueChange={(val) => {
                                    const s = suppliers?.find(sup => sup.id === val);
                                    setTxFormData(prev => ({ ...prev, supplierId: val, supplierName: s?.name || '' }));
                                }}
                            >
                                <SelectTrigger className="h-12 rounded-xl bg-muted/20 border-none font-bold">
                                    <SelectValue placeholder="Choose a partner..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {suppliers?.filter(s => s.status === 'Active').map(s => (
                                        <SelectItem key={s.id} value={s.id} className="font-bold">{s.name} ({s.type})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Type</Label>
                                <Select 
                                    value={txFormData.type} 
                                    onValueChange={(val: any) => setTxFormData(prev => ({ ...prev, type: val }))}
                                >
                                    <SelectTrigger className="h-12 rounded-xl bg-muted/20 border-none font-bold">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Bill" className="font-bold text-amber-600">Stock Bill (+ Debt)</SelectItem>
                                        <SelectItem value="Payment" className="font-bold text-emerald-600">Cash Paid (- Debt)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Date</Label>
                                <Input 
                                    type="date"
                                    className="h-12 rounded-xl bg-muted/20 border-none font-bold"
                                    value={txFormData.date}
                                    onChange={e => setTxFormData(prev => ({ ...prev, date: e.target.value }))}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Amount (PKR)</Label>
                            <Input 
                                type="number"
                                placeholder="0"
                                className="h-14 rounded-2xl border-2 border-amber-100 bg-amber-50/30 text-xl font-black text-amber-700 focus-visible:ring-amber-500"
                                value={txFormData.amount || ''}
                                onChange={e => setTxFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Reference / Bill #</Label>
                            <Input 
                                placeholder="Optional reference info..."
                                className="h-12 rounded-xl bg-muted/20 border-none font-bold"
                                value={txFormData.reference}
                                onChange={e => setTxFormData(prev => ({ ...prev, reference: e.target.value }))}
                            />
                        </div>

                        {/* Invoice Image Upload */}
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Invoice Image (Optional)</Label>
                            {invoicePreview ? (
                                <div className="relative rounded-xl overflow-hidden border border-amber-100 bg-amber-50/30">
                                    <img src={invoicePreview} alt="Invoice preview" className="w-full max-h-48 object-contain" />
                                    <button
                                        type="button"
                                        onClick={() => { setInvoiceFile(null); setInvoicePreview(null); setTxFormData(prev => ({ ...prev, invoiceImageUrl: '' })); }}
                                        className="absolute top-2 right-2 bg-white rounded-full p-1 shadow text-red-500 hover:text-red-700"
                                        title="Remove image"
                                    >
                                        <XCircle className="h-4 w-4" />
                                    </button>
                                </div>
                            ) : (
                                <label className="flex flex-col items-center justify-center h-24 rounded-xl border-2 border-dashed border-amber-200 bg-amber-50/30 cursor-pointer hover:bg-amber-50 transition-colors">
                                    <Receipt className="h-6 w-6 text-amber-400 mb-1" />
                                    <span className="text-xs font-bold text-amber-600">Click to upload invoice</span>
                                    <span className="text-[10px] text-muted-foreground">PNG, JPG, PDF up to 10MB</span>
                                    <input
                                        type="file"
                                        accept="image/*,application/pdf"
                                        className="hidden"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;
                                            setInvoiceFile(file);
                                            if (file.type.startsWith('image/')) {
                                                const reader = new FileReader();
                                                reader.onload = (ev) => setInvoicePreview(ev.target?.result as string);
                                                reader.readAsDataURL(file);
                                            } else {
                                                setInvoicePreview(null);
                                            }
                                        }}
                                    />
                                </label>
                            )}
                            {invoiceFile && !invoicePreview && (
                                <p className="text-xs text-amber-700 font-bold flex items-center gap-1 ml-1">
                                    <Receipt className="h-3 w-3" /> {invoiceFile.name}
                                </p>
                            )}
                        </div>

                        {/* Medicine Selector */}
                        <div className="space-y-3 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                            <Label className="text-[10px] font-black uppercase text-slate-500 ml-1 flex items-center gap-2">
                                <Package className="h-3 w-3" /> Linked Medicines
                            </Label>
                            
                            {txFormData.supplierId ? (
                                <div className="space-y-3">
                                    <div className="flex flex-wrap gap-1.5 min-h-[40px] p-2 bg-white rounded-xl border border-dashed border-slate-200">
                                        {txFormData.medicines?.length === 0 ? (
                                            <p className="text-[10px] text-slate-400 italic m-auto">No medicines selected</p>
                                        ) : (
                                            txFormData.medicines?.map(med => (
                                                <Badge key={med} className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-100 gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all">
                                                    {med}
                                                    <button 
                                                        onClick={() => setTxFormData(prev => ({ 
                                                            ...prev, 
                                                            medicines: prev.medicines?.filter(m => m !== med) 
                                                        }))}
                                                        className="hover:text-indigo-900 ml-1"
                                                    >
                                                        <XCircle className="h-3 w-3" />
                                                    </button>
                                                </Badge>
                                            ))
                                        )}
                                    </div>
                                    
                                    <div className="grid grid-cols-1 gap-1 max-h-[120px] overflow-y-auto pr-1 custom-scrollbar">
                                        {suppliers?.find(s => s.id === txFormData.supplierId)?.products?.map(p => {
                                            const isSelected = txFormData.medicines?.includes(p.name);
                                            return (
                                                <div 
                                                    key={p.id}
                                                    onClick={() => {
                                                        if (isSelected) {
                                                            setTxFormData(prev => ({ ...prev, medicines: prev.medicines?.filter(m => m !== p.name) }));
                                                        } else {
                                                            setTxFormData(prev => ({ ...prev, medicines: [...(prev.medicines || []), p.name] }));
                                                        }
                                                    }}
                                                    className={cn(
                                                        "flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all text-xs font-bold",
                                                        isSelected ? "bg-indigo-600 text-white shadow-md shadow-indigo-200" : "hover:bg-indigo-50 text-slate-600"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <Plus className={cn("h-3 w-3", isSelected ? "rotate-45" : "")} />
                                                        {p.name}
                                                    </div>
                                                    {isSelected && <CheckCircle2 className="h-3 w-3" />}
                                                </div>
                                            );
                                        })}
                                        {(suppliers?.find(s => s.id === txFormData.supplierId)?.products?.length || 0) === 0 && (
                                            <p className="text-[10px] text-center text-muted-foreground py-2">This supplier has no products listed.</p>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <p className="text-[10px] text-center text-muted-foreground py-2 bg-white rounded-xl border border-dashed italic">Please select a supplier first to link medicines.</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Notes</Label>
                            <Textarea 
                                placeholder="Add any internal details..."
                                className="rounded-xl bg-muted/20 border-none resize-none h-20"
                                value={txFormData.notes}
                                onChange={e => setTxFormData(prev => ({ ...prev, notes: e.target.value }))}
                            />
                        </div>
                    </div>

                    <DialogFooter className="p-8 bg-muted/10 border-t flex flex-row gap-3 sm:justify-end">
                        <Button variant="ghost" onClick={() => { setTxDialogOpen(false); setEditingTransaction(null); }} className="rounded-xl font-bold">Cancel</Button>
                        <Button 
                            onClick={handleLogTransaction} 
                            disabled={isSaving}
                            className="rounded-xl font-bold bg-amber-600 hover:bg-amber-700 h-12 px-8 shadow-lg shadow-amber-600/20"
                        >
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                            {editingTransaction ? 'Update Transaction' : 'Log Transaction'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
