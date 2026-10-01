'use client';

import * as React from 'react';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MoreHorizontal, PlusCircle, Loader2, Search, Edit, Trash2, Printer, FileDown } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { differenceInDays, parseISO, format } from 'date-fns';
import { useCollection, useFirestore, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import type { PharmacyItem } from '@/lib/types';
import { collection, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Supplier } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { useSearch } from '@/context/SearchProvider';
import { DatePicker } from '@/components/DatePicker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const PharmacyFormDialog = ({ open, onOpenChange, item, mode, suppliers }: { open: boolean, onOpenChange: (open: boolean) => void, item?: PharmacyItem, mode: 'add' | 'edit' | 'stock', suppliers?: Supplier[] | null }) => {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [formData, setFormData] = React.useState<Partial<PharmacyItem>>({});
    const [stockChange, setStockChange] = React.useState(0);

    const isStockMode = mode === 'stock';

    React.useEffect(() => {
        if (open) {
            if (item) {
                setFormData(item);
                setStockChange(0);
            } else {
                setFormData({ expiryDate: format(new Date(), 'yyyy-MM-dd'), active: true });
            }
        }
    }, [item, open, mode]);


    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value, type } = e.target;
        setFormData(prev => ({ ...prev, [id]: type === 'number' ? Number(value) : value }));
    };

    const handleSubmit = async () => {
        if (!firestore) return;
        const collectionRef = collection(firestore, 'pharmacyItems');

        try {
            if (isStockMode && item?.id) {
                const supplier = suppliers?.find(s => s.id === item.supplierId);
                if (supplier && (supplier.currentBalance || 0) > 0) {
                    toast({ variant: 'destructive', title: 'Action Blocked', description: 'Cannot update stock for a supplier with outstanding liability.' });
                    return;
                }
                const newQuantity = (item.quantity || 0) + stockChange;
                
                // Update pharmacyItems
                await updateDocumentNonBlocking(doc(collectionRef, item.id), { quantity: newQuantity });
                
                // SYNC: Update Suppliers collection
                if (item.supplierId) {
                    const supRef = doc(firestore, 'suppliers', item.supplierId);
                    const sup = suppliers?.find(s => s.id === item.supplierId);
                    if (sup && sup.products) {
                        const updatedProducts = sup.products.map(p => 
                            p.id === item.id ? { ...p, quantity: newQuantity } : p
                        );
                        await updateDocumentNonBlocking(supRef, { products: updatedProducts });
                    }
                }
                
                toast({ title: 'Stock Updated', description: `Stock for ${item.productName} is now ${newQuantity}.` });
            } else if (item?.id && mode === 'edit') {
                await updateDocumentNonBlocking(doc(collectionRef, item.id), formData);
                
                // SYNC: Update Suppliers collection
                if (formData.supplierId) {
                    const supRef = doc(firestore, 'suppliers', formData.supplierId);
                    const sup = suppliers?.find(s => s.id === formData.supplierId);
                    if (sup && sup.products) {
                        const updatedProducts = sup.products.map(p => 
                            p.id === item.id ? { 
                                ...p, 
                                name: formData.productName || p.name,
                                sellingPrice: formData.sellingPrice || p.sellingPrice,
                                purchasePrice: formData.purchasePrice || p.purchasePrice,
                                quantity: formData.quantity !== undefined ? formData.quantity : p.quantity,
                                minThreshold: formData.minThreshold || p.minThreshold,
                                rack: formData.rack || p.rack
                            } : p
                        );
                        await updateDocumentNonBlocking(supRef, { products: updatedProducts });
                    }
                }

                toast({ title: 'Product Updated', description: 'The product details have been saved.' });
            } else { // Add mode
                const newDocRef = await addDocumentNonBlocking(collectionRef, formData);
                
                // SYNC: Add to Suppliers collection if one is selected
                if (formData.supplierId) {
                    const supRef = doc(firestore, 'suppliers', formData.supplierId);
                    const sup = suppliers?.find(s => s.id === formData.supplierId);
                    if (sup) {
                        const newProduct = {
                            id: (newDocRef && typeof newDocRef === 'object' && 'id' in newDocRef) ? (newDocRef as any).id : Math.random().toString(36).substring(7),
                            name: formData.productName || '',
                            price: formData.purchasePrice || 0,
                            sellingPrice: formData.sellingPrice || 0,
                            quantity: formData.quantity || 0,
                            minThreshold: formData.minThreshold || 0,
                            rack: formData.rack || ''
                        };
                        const updatedProducts = [...(sup.products || []), newProduct];
                        await updateDocumentNonBlocking(supRef, { products: updatedProducts });
                    }
                }
                
                toast({ title: 'Product Added', description: 'New product added to the pharmacy.' });
            }
            onOpenChange(false);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Sync Error', description: 'Failed to synchronize with Supplier records. ' + error.message });
        }
    };

    const getTitle = () => {
        if (isStockMode) return 'Update Stock';
        if (mode === 'edit') return 'Edit Product';
        return 'Add New Product';
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>{getTitle()}</DialogTitle>
                    <DialogDescription>
                        {isStockMode ? `Current quantity: ${item?.quantity}` : 'Fill in the product details below.'}
                    </DialogDescription>
                </DialogHeader>

                {isStockMode && suppliers?.find(s => s.id === item?.supplierId)?.currentBalance! > 0 && (
                     <div className="px-6 py-2">
                        <Alert variant="destructive" className="rounded-2xl border-none bg-red-50 dark:bg-red-950/20">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle className="font-black text-xs uppercase">Vendor/Distributor Blocking Alert</AlertTitle>
                            <AlertDescription className="text-xs font-semibold">
                                This partner has uncleared dues. New stock updates are restricted until the balance is cleared.
                            </AlertDescription>
                        </Alert>
                    </div>
                )}

                {isStockMode ? (
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="stockChange" className="text-right">Change Quantity</Label>
                            <Input id="stockChange" type="number" value={stockChange} onChange={(e) => setStockChange(Number(e.target.value))} className="col-span-3" placeholder="e.g., 10 or -5" />
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="productName">Product Name</Label>
                            <Input id="productName" value={formData.productName || ''} onChange={handleChange} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="genericName">Generic Name</Label>
                            <Input id="genericName" value={formData.genericName || ''} onChange={handleChange} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="barcode">Barcode</Label>
                            <Input id="barcode" value={formData.barcode || ''} onChange={handleChange} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="category">Category</Label>
                            <Input id="category" value={formData.category || ''} onChange={handleChange} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="manufacturer">Manufacturer</Label>
                            <Input id="manufacturer" value={formData.manufacturer || ''} onChange={handleChange} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="supplierId">Supplier</Label>
                            <Select 
                                onValueChange={(value) => {
                                    const selected = mode === 'add' || mode === 'edit' ? suppliers?.find(s => s.id === value) : null;
                                    setFormData(prev => ({ 
                                        ...prev, 
                                        supplierId: value,
                                        supplier: selected?.name || prev.supplier 
                                    }));
                                }} 
                                value={formData.supplierId || ''}
                            >
                                <SelectTrigger id="supplierId">
                                    <SelectValue placeholder="Select Supplier" />
                                </SelectTrigger>
                                <SelectContent>
                                    {suppliers?.map(s => (
                                        <SelectItem key={s.id} value={s.id}>{s.name} ({s.type})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="purchasePrice">Purchase Price (Rs)</Label>
                            <Input id="purchasePrice" type="number" value={formData.purchasePrice || ''} onChange={handleChange} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="sellingPrice">Selling Price (Rs)</Label>
                            <Input id="sellingPrice" type="number" value={formData.sellingPrice || ''} onChange={handleChange} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="quantity">Quantity</Label>
                            <Input id="quantity" type="number" value={formData.quantity || ''} onChange={handleChange} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="minThreshold">Min. Stock Level (Alert)</Label>
                            <Input id="minThreshold" type="number" value={formData.minThreshold || ''} onChange={handleChange} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="stockingUnit">Stocking Unit</Label>
                            <Input id="stockingUnit" type="number" value={formData.stockingUnit || ''} onChange={handleChange} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="conversionUnit">Conversion Unit</Label>
                            <Input id="conversionUnit" type="number" value={formData.conversionUnit || ''} onChange={handleChange} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="expiryDate">Expiry Date</Label>
                            <Input id="expiryDate" type="date" value={formData.expiryDate || ''} onChange={handleChange} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="rack">Rack</Label>
                            <Select onValueChange={(value: any) => setFormData(prev => ({ ...prev, rack: value }))} value={formData.rack || ''}>
                                <SelectTrigger id="rack">
                                    <SelectValue placeholder="Select Rack" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="A">Rack A</SelectItem>
                                    <SelectItem value="B">Rack B</SelectItem>
                                    <SelectItem value="C">Rack C</SelectItem>
                                    <SelectItem value="D">Rack D</SelectItem>
                                    <SelectItem value="E">Rack E</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                )}
                <DialogFooter>
                    <Button onClick={handleSubmit}>
                        {isStockMode ? 'Update Quantity' : (mode === 'edit' ? 'Save Changes' : 'Add Product')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default function PharmacyItemsPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { searchTerm, setSearchTerm } = useSearch();
    const pharmacyQuery = useMemoFirebase(() => firestore ? collection(firestore, 'pharmacyItems') : null, [firestore]);
    const { data: pharmacyItems, isLoading } = useCollection<PharmacyItem>(pharmacyQuery);
    
    const suppliersRef = useMemoFirebase(() => firestore ? collection(firestore, 'suppliers') : null, [firestore]);
    const { data: allSuppliers } = useCollection<Supplier>(suppliersRef);

    const [isFormOpen, setIsFormOpen] = React.useState(false);
    const [isBulkOpen, setIsBulkOpen] = React.useState(false);
    const [selectedItem, setSelectedItem] = React.useState<PharmacyItem | undefined>(undefined);
    const [formMode, setFormMode] = React.useState<'add' | 'edit' | 'stock'>('add');

    // Filter states
    const [selectedSupplier, setSelectedSupplier] = React.useState<string>('all');
    const [selectedManufacturer, setSelectedManufacturer] = React.useState<string>('all');
    const [selectedCategory, setSelectedCategory] = React.useState<string>('all');
    const [selectedRack, setSelectedRack] = React.useState<string>('all');

    const suppliers = React.useMemo(() => Array.from(new Set(pharmacyItems?.map(i => i.supplier).filter((s): s is string => !!s))), [pharmacyItems]);
    const manufacturers = React.useMemo(() => Array.from(new Set(pharmacyItems?.map(i => i.manufacturer).filter((m): m is string => !!m))), [pharmacyItems]);
    const categories = React.useMemo(() => Array.from(new Set(pharmacyItems?.map(i => i.category).filter((c): c is string => !!c))), [pharmacyItems]);

    const handleExcelExport = () => {
        if (!filteredItems.length) return;
        const headers = ['Name', 'Generic', 'Barcode', 'Category', 'Manufacturer', 'Supplier', 'Rack', 'Quantity', 'Selling Price'];
        const csvContent = [
            headers.join(','),
            ...filteredItems.map(item => [
                `"${item.productName}"`,
                `"${item.genericName || ''}"`,
                `"${item.barcode || ''}"`,
                `"${item.category}"`,
                `"${item.manufacturer || ''}"`,
                `"${item.supplier}"`,
                `"${item.rack || '—'}"`,
                item.quantity,
                item.sellingPrice
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `pharmacy_items_${format(new Date(), 'yyyy-MM-dd')}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePrint = () => {
        window.print();
    };

    const filteredItems = React.useMemo(() => {
        if (!pharmacyItems) return [];
        const term = searchTerm.toLowerCase();
        return pharmacyItems
            .filter(item => {
                const matchesSearch = !term ||
                    (item.productName || '').toLowerCase().includes(term) ||
                    (item.genericName && (item.genericName || '').toLowerCase().includes(term)) ||
                    (item.barcode && (item.barcode || '').toLowerCase().includes(term)) ||
                    (item.category || '').toLowerCase().includes(term) ||
                    (item.supplier || '').toLowerCase().includes(term);

                const matchesSupplier = selectedSupplier === 'all' || item.supplier === selectedSupplier;
                const matchesManufacturer = selectedManufacturer === 'all' || item.manufacturer === selectedManufacturer;
                const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
                const matchesRack = selectedRack === 'all' || item.rack === selectedRack;

                return matchesSearch && matchesSupplier && matchesManufacturer && matchesCategory && matchesRack;
            })
            .sort((a, b) => (a.productName || '').trim().localeCompare((b.productName || '').trim(), undefined, { sensitivity: 'base' }));
    }, [pharmacyItems, searchTerm, selectedSupplier, selectedManufacturer, selectedCategory, selectedRack]);

    const handleOpenForm = (mode: 'add' | 'edit' | 'stock', item?: PharmacyItem) => {
        setFormMode(mode);
        setSelectedItem(item);
        setIsFormOpen(true);
    }

    const handleDelete = (itemId: string) => {
        if (!firestore) return;
        const docRef = doc(firestore, 'pharmacyItems', itemId);
        deleteDocumentNonBlocking(docRef);
        toast({
            variant: 'destructive',
            title: 'Product Deleted',
            description: "The product has been removed from the pharmacy."
        })
    }

    const handleStatusChange = (item: PharmacyItem, newStatus: boolean) => {
        if (!firestore) return;
        const docRef = doc(firestore, 'pharmacyItems', item.id);
        updateDocumentNonBlocking(docRef, { active: newStatus });
        toast({ title: 'Status Updated', description: `${item.productName} is now ${newStatus ? 'Active' : 'Inactive'}.` });
    }

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>Pharmacy Items</CardTitle>
                    <div className="flex flex-wrap items-center justify-between gap-4 pt-4">
                        <div className="flex flex-wrap gap-2">
                            <DatePicker date={undefined} onDateChange={() => { }} />
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input placeholder="Search by Name..." className="pl-8 w-48" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                            </div>
                            <Select value={selectedSupplier} onValueChange={setSelectedSupplier}><SelectTrigger className="w-40"><SelectValue placeholder="Select Supplier" /></SelectTrigger><SelectContent><SelectItem value="all">All Suppliers</SelectItem>{suppliers.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
                            <Select value={selectedManufacturer} onValueChange={setSelectedManufacturer}><SelectTrigger className="w-40"><SelectValue placeholder="Select Manufacturer" /></SelectTrigger><SelectContent><SelectItem value="all">All Manufacturers</SelectItem>{manufacturers.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select>
                            <Select value={selectedCategory} onValueChange={setSelectedCategory}><SelectTrigger className="w-40"><SelectValue placeholder="Select Category" /></SelectTrigger><SelectContent><SelectItem value="all">All Categories</SelectItem>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" onClick={handleExcelExport}><FileDown className="mr-2 h-4 w-4" /> Excel</Button>
                            <Button variant="outline" onClick={handlePrint}><Printer className="mr-2 h-4 w-4" /> Print</Button>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-4 pt-4">
                        <div className="flex flex-wrap gap-2">
                            <Select><SelectTrigger className="w-40"><SelectValue placeholder="Select Stock(All Item)" /></SelectTrigger><SelectContent></SelectContent></Select>
                            <Select><SelectTrigger className="w-40"><SelectValue placeholder="Select Stock Level" /></SelectTrigger><SelectContent></SelectContent></Select>
                            <Select><SelectTrigger className="w-40"><SelectValue placeholder="Select Active/Inactive" /></SelectTrigger><SelectContent></SelectContent></Select>
                            <Select value={selectedRack} onValueChange={setSelectedRack}>
                                <SelectTrigger className="w-40">
                                    <SelectValue placeholder="Select Rack" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Racks</SelectItem>
                                    <SelectItem value="A">Rack A</SelectItem>
                                    <SelectItem value="B">Rack B</SelectItem>
                                    <SelectItem value="C">Rack C</SelectItem>
                                    <SelectItem value="D">Rack D</SelectItem>
                                    <SelectItem value="E">Rack E</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button size="sm" onClick={() => setIsBulkOpen(true)}><PlusCircle className="mr-2 h-4 w-4" /> Add Multiple Items</Button>
                            <Button size="sm" onClick={() => handleOpenForm('add')}><PlusCircle className="mr-2 h-4 w-4" /> Add New Item</Button>
                            <Button size="sm" onClick={() => {
                                if (selectedItem) handleOpenForm('stock', selectedItem)
                                else toast({ variant: "destructive", title: "No Item Selected", description: "Please click on a row to select an item first." })
                            }}><PlusCircle className="mr-2 h-4 w-4" /> Add Stock</Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center items-center h-64">
                            <Loader2 className="h-8 w-8 animate-spin" />
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Generic Name</TableHead>
                                    <TableHead>Barcode</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Manufacturer</TableHead>
                                    <TableHead>Supplier(s)</TableHead>
                                    <TableHead>Rack</TableHead>
                                    <TableHead>Stock Level</TableHead>
                                    <TableHead>Qty</TableHead>
                                    <TableHead className="text-right">Purchase Price</TableHead>
                                    <TableHead className="text-right">Sale Price</TableHead>
                                    <TableHead><span className="sr-only">Actions</span></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredItems?.map((item) => (
                                    <TableRow
                                        key={item.id}
                                        className={`group cursor-pointer ${selectedItem?.id === item.id ? 'bg-muted/50' : ''}`}
                                        onClick={() => setSelectedItem(item)}
                                    >
                                        <TableCell onClick={(e) => e.stopPropagation()}>
                                            <Switch
                                                checked={item.active}
                                                onCheckedChange={(newStatus) => handleStatusChange(item, newStatus)}
                                            />
                                        </TableCell>
                                        <TableCell className="font-medium">{item.productName}</TableCell>
                                        <TableCell>{item.genericName}</TableCell>
                                        <TableCell>{item.barcode}</TableCell>
                                        <TableCell>{item.category}</TableCell>
                                        <TableCell>{item.manufacturer}</TableCell>
                                        <TableCell>{item.supplier}</TableCell>
                                        <TableCell>
                                            <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-medium bg-secondary text-secondary-foreground border">
                                                {item.rack || '—'}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            {item.quantity === 0 ? (
                                                <Badge variant="destructive" className="text-[10px] font-black uppercase tracking-tighter bg-red-600">Out of Stock</Badge>
                                            ) : item.minThreshold && item.quantity <= item.minThreshold ? (
                                                <Badge variant="outline" className="text-[10px] font-black uppercase tracking-tighter border-amber-500 text-amber-600 bg-amber-50">Low Stock</Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-[10px] font-black uppercase tracking-tighter border-emerald-500 text-emerald-600 bg-emerald-50">Healthy</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="font-bold">{item.quantity}</TableCell>
                                        <TableCell className="text-right font-medium text-slate-500">Rs {item.purchasePrice?.toLocaleString() || 0}</TableCell>
                                        <TableCell className="text-right font-black text-teal-600 underline decoration-teal-100 decoration-4 underline-offset-4">Rs {item.sellingPrice?.toLocaleString() || 0}</TableCell>
                                        <TableCell onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center justify-end gap-1">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:bg-blue-50" onClick={() => handleOpenForm('edit', item)}>
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:bg-rose-50" onClick={() => handleDelete(item.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
            <PharmacyFormDialog open={isFormOpen} onOpenChange={setIsFormOpen} item={selectedItem} mode={formMode} suppliers={allSuppliers} />
            <BulkAddDialog open={isBulkOpen} onOpenChange={setIsBulkOpen} />
        </>
    );
}

const BulkAddDialog = ({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) => {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [text, setText] = React.useState('');

    const handleBulkAdd = () => {
        if (!firestore || !text.trim()) return;
        const lines = text.split('\n').filter(l => l.trim());
        const collectionRef = collection(firestore, 'pharmacyItems');

        lines.forEach(line => {
            const newItem: Partial<PharmacyItem> = {
                productName: line.trim(),
                category: 'General',
                supplier: 'General',
                quantity: 0,
                sellingPrice: 0,
                purchasePrice: 0,
                expiryDate: format(new Date(), 'yyyy-MM-dd'),
                active: true
            };
            addDocumentNonBlocking(collectionRef, newItem);
        });

        toast({ title: 'Items Added', description: `Successfully scheduled ${lines.length} items for addition.` });
        setText('');
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add Multiple Items</DialogTitle>
                    <DialogDescription>Paste a list of product names (one per line) to add them quickly.</DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Textarea
                        placeholder="Paracetamol 500mg&#10;Amoxicillin 250mg&#10;..."
                        className="min-h-[200px]"
                        value={text}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value)}
                    />
                </div>
                <DialogFooter>
                    <Button onClick={handleBulkAdd}>Add Items</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
