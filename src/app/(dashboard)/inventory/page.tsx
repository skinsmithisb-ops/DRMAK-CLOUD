'use client';

import * as React from 'react';
import { useCollection, useFirestore, useMemoFirebase, updateDocumentNonBlocking, setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc, getDocs } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Boxes, Search, Zap, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useSearch } from '@/context/SearchProvider';
import { Supplier, SupplierProduct } from '@/lib/types';
import Link from 'next/link';

export interface PharmacyItem {
    id: string;
    productName: string;
    name?: string; // Fallback for older records
    purchasePrice: number;
    sellingPrice: number;
    quantity: number;
    supplier?: string;
    supplierId?: string;
    rack?: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I';
}

export default function InventoryPage() {
    const { toast } = useToast();
    const firestore = useFirestore();
    const { searchTerm, setSearchTerm } = useSearch();
    const [rackFilter, setRackFilter] = React.useState<string>('all');
    
    const suppliersRef = useMemoFirebase(() => firestore ? collection(firestore, 'suppliers') : null, [firestore]);
    const { data: suppliers, isLoading: isSuppliersLoading } = useCollection<Supplier>(suppliersRef);

    const pharmacyRef = useMemoFirebase(() => firestore ? collection(firestore, 'pharmacyItems') : null, [firestore]);
    const { data: pharmacyItems, isLoading: isPharmacyLoading } = useCollection<PharmacyItem>(pharmacyRef);

    const isLoading = isSuppliersLoading || isPharmacyLoading;

    const [isSyncing, setIsSyncing] = React.useState(false);

    const handleSync = async () => {
        if (!firestore || !suppliers || !pharmacyItems) return;
        setIsSyncing(true);
        toast({ title: 'Syncing...', description: 'Performing deep-audit including historical stock entries...' });

        try {
            const stockEntriesRef = collection(firestore, 'stockEntries');
            const entriesSnapshot = await getDocs(stockEntriesRef);
            const stockEntries = entriesSnapshot?.docs.map(d => ({ id: d.id, ...d.data() } as StockEntry)) || [];

            const billingRecordsRef = collection(firestore, 'billingRecords');
            const billingSnapshot = await getDocs(billingRecordsRef);
            const billingRecords = billingSnapshot?.docs.map(d => ({ id: d.id, ...d.data() } as any)) || [];

            let syncCount = 0;
            const supplierUpdates: Record<string, SupplierProduct[]> = {};
            const pharmacyUpdates: Array<{ id: string; data: any }> = [];
            const pharmacyCreates: Array<any> = [];

            const allProductNames = new Set<string>();
            pharmacyItems.forEach(pi => allProductNames.add(pi.productName.trim().toLowerCase()));
            suppliers.forEach(s => s.products?.forEach(p => allProductNames.add(p.name.trim().toLowerCase())));
            stockEntries.forEach(entry => entry.items?.forEach(item => allProductNames.add(item.itemName.trim().toLowerCase())));

            allProductNames.forEach(nameKey => {
                const pi = pharmacyItems.find(i => (i.productName || i.name || '').trim().toLowerCase() === nameKey);
                
                let foundSp: SupplierProduct | null = null;
                let foundSup: Supplier | null = null;
                suppliers.forEach(s => {
                    const p = s.products?.find(product => product.name.trim().toLowerCase() === nameKey);
                    if (p) {
                        foundSp = p;
                        foundSup = s;
                    }
                });

                const historicalQty = stockEntries.reduce((acc, entry) => {
                    const match = entry.items?.find(item => item.itemName.trim().toLowerCase() === nameKey);
                    return acc + (Number(match?.totalQty) || 0);
                }, 0);

                const soldQty = billingRecords.reduce((acc, record) => {
                    const matches = record.items?.filter((item: any) => 
                        item.type === 'pharmacy' && 
                        (item.name || '').trim().toLowerCase() === nameKey
                    ) || [];
                    const recordSold = matches.reduce((sum: number, item: any) => sum + (Number(item.qty) || 0), 0);
                    return acc + recordSold;
                }, 0);

                const currentMax = Math.max(Number(pi?.quantity || 0), Number(foundSp?.quantity || 0));
                const finalQty = historicalQty > 0 ? Math.max(0, historicalQty - soldQty) : currentMax; 
                const finalSelling = Math.max(Number(pi?.sellingPrice || 0), Number(foundSp?.sellingPrice || 0));
                const finalRack = pi?.rack || foundSp?.rack || '';

                if (pi && foundSp && foundSup) {
                    const needsSupUpdate = foundSp.quantity !== finalQty;
                    const needsPiUpdate = pi.quantity !== finalQty;

                    if (needsSupUpdate) {
                        if (!supplierUpdates[foundSup.id]) supplierUpdates[foundSup.id] = [...(foundSup.products || [])];
                        const idx = supplierUpdates[foundSup.id].findIndex(p => p.name.trim().toLowerCase() === nameKey);
                        if (idx > -1) {
                            supplierUpdates[foundSup.id][idx] = { ...supplierUpdates[foundSup.id][idx], quantity: finalQty, sellingPrice: finalSelling, rack: finalRack };
                            syncCount++;
                        }
                    }
                    if (needsPiUpdate) {
                        pharmacyUpdates.push({ id: pi.id, data: { quantity: finalQty, sellingPrice: finalSelling, rack: finalRack } });
                        syncCount++;
                    }
                } else if (pi && (!foundSp || !foundSup)) {
                    const supplier = suppliers.find(s => s.id === pi.supplierId || s.name === pi.supplier) || suppliers[0];
                    if (supplier) {
                        if (!supplierUpdates[supplier.id]) supplierUpdates[supplier.id] = [...(supplier.products || [])];
                        supplierUpdates[supplier.id].push({ id: pi.id, name: pi.productName, sellingPrice: finalSelling, quantity: finalQty, rack: finalRack, minThreshold: 0 });
                        syncCount++;
                    }
                } else if (!pi && foundSp && foundSup) {
                    pharmacyCreates.push({
                        id: foundSp.id, productName: foundSp.name, sellingPrice: finalSelling, quantity: finalQty, rack: finalRack,
                        supplier: foundSup.name, supplierId: foundSup.id, active: true, category: foundSup.category || 'General'
                    });
                    syncCount++;
                }
            });

            const promises: any[] = [];
            Object.entries(supplierUpdates).forEach(([supId, products]) => promises.push(updateDocumentNonBlocking(doc(firestore, 'suppliers', supId), { products })));
            pharmacyUpdates.forEach(u => promises.push(updateDocumentNonBlocking(doc(firestore, 'pharmacyItems', u.id), u.data)));
            pharmacyCreates.forEach(c => promises.push(setDocumentNonBlocking(doc(firestore, 'pharmacyItems', c.id), c, { merge: true })));

            await Promise.all(promises);
            toast({ title: 'System Restored', description: `Successfully harvested and reconciled ${syncCount} details from historical logs.` });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Sync Failed', description: error.message });
        } finally {
            setIsSyncing(false);
        }
    };

    const inventoryItems = React.useMemo(() => {
        if (!suppliers || !pharmacyItems) return [];
        const items: any[] = [];
        const processedNames = new Set<string>();

        // 1. Process Master Ledger (Suppliers)
        suppliers.forEach(s => {
            s.products?.forEach(p => {
                const nameKey = p.name.trim().toLowerCase();
                // Find matching item in Pharmacy POS
                const piMatch = pharmacyItems.find(pi => pi.productName.trim().toLowerCase() === nameKey);
                
                // SYSTEM PARITY: Promote the maximum quantity and non-zero pricing
                const currentQty = Math.max(Number(p.quantity || 0), Number(piMatch?.quantity || 0));
                const currentSelling = Math.max(Number(p.sellingPrice || 0), Number(piMatch?.sellingPrice || 0));

                items.push({ 
                    ...p, 
                    quantity: currentQty,
                    sellingPrice: currentSelling,
                    supplierName: s.name, 
                    supplierId: s.id,
                    rack: p.rack || piMatch?.rack || ''
                });
                processedNames.add(nameKey);
            });
        });

        // 2. Catch orphan items in Pharmacy POS that don't exist in Master Ledger
        pharmacyItems.forEach(pi => {
            const nameKey = (pi.productName || pi.name || '').trim().toLowerCase();
            if (!processedNames.has(nameKey)) {
                items.push({
                    id: pi.id,
                    name: pi.productName || pi.name || 'Unnamed Product',
                    quantity: pi.quantity,
                    sellingPrice: pi.sellingPrice || 0,
                    supplierName: pi.supplier || 'Unlinked',
                    supplierId: pi.supplierId || 'unlinked',
                    rack: pi.rack || '',
                    minThreshold: 0
                });
                processedNames.add(nameKey);
            }
        });

        // Sort alphabetically by name (Case-Insensitive)
        return items.sort((a, b) => 
            (a.name || '').trim().localeCompare((b.name || '').trim(), undefined, { sensitivity: 'base' })
        );
    }, [suppliers, pharmacyItems]);

    const filteredItems = React.useMemo(() => {
        if (!inventoryItems) return [];
        const term = searchTerm.toLowerCase().trim();
        return inventoryItems.filter(item => {
            const itemName = (item.name || '').toLowerCase();
            const itemRack = (item.rack || '').toLowerCase();
            const sName = (item.supplierName || '').toLowerCase();
            
            const matchesSearch = !term ||
                itemName.includes(term) ||
                itemRack.includes(term) ||
                sName.includes(term);
            const matchesRack = rackFilter === 'all' || item.rack === rackFilter;
            return matchesSearch && matchesRack;
        });
    }, [inventoryItems, searchTerm, rackFilter]);

    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingItem, setEditingItem] = React.useState<(SupplierProduct & { supplierId: string; supplierName: string }) | null>(null);

    // Form State (Simplified for quick updates)
    const [sellingPrice, setSellingPrice] = React.useState<number | string>('');
    const [quantity, setQuantity] = React.useState<number | string>('');
    const [rack, setRack] = React.useState<string>('');
    const [alternatives, setAlternatives] = React.useState<string[]>([]);
    const [altSearch, setAltSearch] = React.useState('');

    const handleOpenDialog = (item: SupplierProduct & { supplierId: string; supplierName: string }) => {
        setEditingItem(item);
        setSellingPrice(item.sellingPrice || 0);
        setQuantity(item.quantity);
        setRack(item.rack || '');
        setAlternatives(item.alternatives || []);
        setIsDialogOpen(true);
    };

    const handleSave = async () => {
        if (sellingPrice === '' || isNaN(Number(sellingPrice)) || 
            quantity === '' || isNaN(Number(quantity))) {
            toast({ variant: 'destructive', title: 'Invalid Input', description: 'Please provide valid numeric values for price and quantity fields.' });
            return;
        }

        if (!firestore || !editingItem) return;

        try {
            const numSellingPrice = Number(sellingPrice);
            const numQty = Number(quantity);

            const supplier = suppliers?.find(s => s.id === editingItem.supplierId);
            if (supplier && supplier.products) {
                const newProducts = supplier.products.map(p => {
                    if (p.id === editingItem.id) {
                        return { ...p, sellingPrice: numSellingPrice, quantity: numQty, rack, alternatives };
                    }
                    return p;
                });
                updateDocumentNonBlocking(doc(firestore, 'suppliers', supplier.id), { products: newProducts });
                
                // Find matching item in Pharmacy POS by name to get its correct document ID
                const nameKey = editingItem.name.trim().toLowerCase();
                const piMatch = pharmacyItems?.find(pi => (pi.productName || pi.name || '').trim().toLowerCase() === nameKey);
                const targetPharmacyId = piMatch ? piMatch.id : editingItem.id;

                // Sync to pharmacyItems for POS
                const pDocRef = doc(firestore, 'pharmacyItems', targetPharmacyId);
                setDocumentNonBlocking(pDocRef, {
                    productName: editingItem.name,
                    sellingPrice: numSellingPrice,
                    quantity: numQty,
                    rack: rack,
                    supplier: supplier.name,
                    supplierId: supplier.id,
                    active: true
                }, { merge: true });

                toast({ title: 'Inventory Updated', description: 'Changes synced to supplier and POS records.' });
            }
            setIsDialogOpen(false);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        }
    };

    const handleDelete = (id: string) => {
        if (!firestore) return;
        if (confirm('Are you sure you want to delete this item? This action cannot be undone.')) {
            deleteDocumentNonBlocking(doc(firestore, 'pharmacyItems', id));
            toast({ title: 'Item Deleted', description: 'The item has been removed from inventory.' });
        }
    };

    return (
        <div className="flex flex-col gap-6 p-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Boxes className="h-6 w-6 text-primary" />
                        Inventory Management
                    </h2>
                    <p className="text-muted-foreground">Manage physical stock, pharmacy items, and material pricing.</p>
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
                    <div className="relative w-full md:w-60">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Search by name..."
                            className="pl-8 w-full"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Select value={rackFilter} onValueChange={setRackFilter}>
                        <SelectTrigger className="w-36 shrink-0">
                            <SelectValue placeholder="All Racks" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Racks</SelectItem>
                            <SelectItem value="A">Rack A</SelectItem>
                            <SelectItem value="B">Rack B</SelectItem>
                            <SelectItem value="C">Rack C</SelectItem>
                            <SelectItem value="D">Rack D</SelectItem>
                            <SelectItem value="E">Rack E</SelectItem>
                            <SelectItem value="F">Rack F</SelectItem>
                            <SelectItem value="G">Rack G</SelectItem>
                            <SelectItem value="H">Rack H</SelectItem>
                            <SelectItem value="I">Rack I</SelectItem>
                        </SelectContent>
                    </Select>
                    <Link href="/supplier">
                        <Button className="shrink-0">
                            <Plus className="h-4 w-4 mr-2" /> Manage Suppliers
                        </Button>
                    </Link>
                    <Button 
                        disabled={isSyncing} 
                        onClick={handleSync}
                        variant="secondary"
                        className="rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold shadow-sm"
                    >
                        {isSyncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
                        {isSyncing ? 'Syncing...' : 'Sync Inventory'}
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Current Stock</CardTitle>
                    <CardDescription>A list of all pharmacy and physical items available for billing.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-md overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead>Item Name</TableHead>
                                    <TableHead>Supplier</TableHead>
                                    <TableHead>Rack</TableHead>
                                    <TableHead className="text-right">Sale Price (Rs)</TableHead>
                                    <TableHead className="text-right">Quantity</TableHead>
                                    <TableHead className="w-[100px] text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading inventory...</TableCell>
                                    </TableRow>
                                ) : !filteredItems || filteredItems.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground italic">
                                            {searchTerm ? 'No items match your search.' : 'No items found. Add products in the Suppliers section.'}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredItems.map((item) => (
                                        <TableRow key={`${item.supplierId}_${item.id}`}>
                                            <TableCell className="font-medium">
                                                <div>
                                                    <div className="font-bold">{item.name}</div>
                                                    <div className="text-[10px] text-muted-foreground uppercase">{item.id}</div>
                                                    {item.alternatives && item.alternatives.length > 0 && (
                                                        <div className="mt-1 flex flex-wrap gap-1">
                                                            {item.alternatives.map(altId => {
                                                                const alt = inventoryItems.find(i => i.id === altId);
                                                                return alt ? (
                                                                    <span key={altId} className="px-1.5 py-0.5 bg-yellow-100 text-yellow-800 text-[8px] rounded font-bold uppercase">
                                                                        Alt: {alt.name}
                                                                    </span>
                                                                ) : null;
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-xs font-semibold text-primary">{item.supplierName}</div>
                                            </TableCell>
                                            <TableCell>
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-muted border uppercase tracking-wider">
                                                    {item.rack || '—'}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex flex-col items-end">
                                                    <span className="text-[10px] font-black text-teal-600 bg-teal-50 px-2 py-0.5 rounded-lg border border-teal-100">
                                                        {item.sellingPrice?.toLocaleString() || 0} Rs
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {Number(item.quantity) <= 0 ? (
                                                    <span className="inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-[10px] font-black bg-red-600 text-white animate-pulse">
                                                        OUT OF STOCK
                                                    </span>
                                                ) : Number(item.quantity) <= (item.minThreshold || 0) ? (
                                                    <span className="inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-black bg-amber-100 text-amber-800 border border-amber-200">
                                                        {item.quantity} Low Stock
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-100">
                                                        {item.quantity} Available
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right space-x-2">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => handleOpenDialog(item)}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingItem ? 'Edit Inventory Item' : 'Add New Item'}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label>Item Name</Label>
                            <div className="p-2 bg-muted rounded font-bold text-sm text-muted-foreground">
                                {editingItem?.name} ({editingItem?.supplierName})
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="sellingPrice">Selling Price (Rs)</Label>
                                <Input
                                    id="sellingPrice"
                                    type="number"
                                    value={sellingPrice}
                                    onChange={(e) => setSellingPrice(e.target.value)}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="quantity">Stock Quantity</Label>
                                <Input
                                    id="quantity"
                                    type="number"
                                    value={quantity}
                                    onChange={(e) => setQuantity(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="rack">Rack Location</Label>
                            <Select value={rack} onValueChange={setRack}>
                                <SelectTrigger id="rack">
                                    <SelectValue placeholder="Select Rack" />
                                </SelectTrigger>
                                <SelectContent>
                                    {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'].map(r => (
                                        <SelectItem key={r} value={r}>Rack {r}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Alternatives Section */}
                        <div className="space-y-3 pt-4 border-t">
                            <Label className="text-sm font-bold flex items-center gap-2">
                                <Plus className="h-4 w-4" /> Product Alternatives
                            </Label>
                            
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Find alternative product..."
                                        className="pl-8 h-9 text-xs"
                                        value={altSearch}
                                        onChange={(e) => setAltSearch(e.target.value)}
                                    />
                                </div>
                            </div>

                            {altSearch && (
                                <div className="max-h-32 overflow-y-auto border rounded-md bg-muted/20 p-1 space-y-1">
                                    {inventoryItems
                                        .filter(i => 
                                            i.id !== editingItem?.id && 
                                            i.name.toLowerCase().includes(altSearch.toLowerCase()) &&
                                            !alternatives.includes(i.id)
                                        )
                                        .map(item => (
                                            <button
                                                key={item.id}
                                                className="w-full text-left px-2 py-1.5 text-xs hover:bg-background rounded flex items-center justify-between group"
                                                onClick={() => {
                                                    setAlternatives(prev => [...prev, item.id]);
                                                    setAltSearch('');
                                                }}
                                            >
                                                <span>{item.name} <span className="text-[10px] opacity-50">({item.supplierName})</span></span>
                                                <Plus className="h-3 w-3 opacity-0 group-hover:opacity-100" />
                                            </button>
                                        ))}
                                </div>
                            )}

                            <div className="flex flex-wrap gap-2">
                                {alternatives.map(altId => {
                                    const alt = inventoryItems.find(i => i.id === altId);
                                    return alt ? (
                                        <div key={altId} className="flex items-center gap-2 bg-primary/10 text-primary px-2 py-1 rounded-md text-xs font-bold ring-1 ring-primary/20">
                                            {alt.name}
                                            <button 
                                                onClick={() => setAlternatives(prev => prev.filter(id => id !== altId))}
                                                className="hover:text-destructive transition-colors"
                                                title="Remove alternative"
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </button>
                                        </div>
                                    ) : null;
                                })}
                                {alternatives.length === 0 && !altSearch && (
                                    <p className="text-xs text-muted-foreground italic">No alternatives set.</p>
                                )}
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave}>Save Item</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
