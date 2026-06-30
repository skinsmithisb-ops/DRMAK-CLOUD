'use client';
import * as React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
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
import { Input } from '@/components/ui/input';
import { 
    File, 
    Search, 
    Download, 
    Printer, 
    Boxes, 
    AlertTriangle, 
    PackageOpen, 
    Archive,
    History, 
    BarChart3, 
    Zap,
    ArrowUpRight,
    Loader2,
    TrendingUp
} from 'lucide-react';
import { DatePickerWithRange } from '@/components/DatePickerWithRange';
import { 
    Select, 
    SelectTrigger, 
    SelectValue, 
    SelectContent, 
    SelectItem 
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCollection, useFirestore, useMemoFirebase, updateDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase';
import { collection, doc, getDocs } from 'firebase/firestore';
import type { Supplier, PharmacyItem, SupplierProduct, StockEntry } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { DateRange } from 'react-day-picker';
import { startOfMonth } from 'date-fns';

export default function InventoryReportPage() {
    const { toast } = useToast();
    const firestore = useFirestore();
    const suppliersRef = useMemoFirebase(() => firestore ? collection(firestore, 'suppliers') : null, [firestore]);
    const { data: suppliers, isLoading: isSuppliersLoading } = useCollection<Supplier>(suppliersRef);

    const pharmacyRef = useMemoFirebase(() => firestore ? collection(firestore, 'pharmacyItems') : null, [firestore]);
    const { data: pharmacyItems, isLoading: isPharmacyLoading } = useCollection<PharmacyItem>(pharmacyRef);

    const isLoading = isSuppliersLoading || isPharmacyLoading;

    const [isSyncing, setIsSyncing] = React.useState(false);

    const handleSync = async () => {
        if (!firestore || !suppliers || !pharmacyItems) return;
        setIsSyncing(true);
        console.group('📦 INVENTORY DEEP-SYNC DIAGNOSTICS');
        console.log('Suppliers:', suppliers.length);
        console.log('Pharmacy Items:', pharmacyItems.length);
        
        toast({ title: 'Syncing...', description: 'Performing deep-audit including historical stock entries...' });

        try {
            const stockEntriesRef = collection(firestore, 'stockEntries');
            const entriesSnapshot = await getDocs(stockEntriesRef);
            const stockEntries = entriesSnapshot?.docs.map(d => ({ id: d.id, ...d.data() } as StockEntry)) || [];
            console.log('Stock Entries found:', stockEntries.length);

            const billingRecordsRef = collection(firestore, 'billingRecords');
            const billingSnapshot = await getDocs(billingRecordsRef);
            const billingRecords = billingSnapshot?.docs.map(d => ({ id: d.id, ...d.data() } as any)) || [];

            let syncCount = 0;
            let recoveryCount = 0;
            const supplierUpdates: Record<string, SupplierProduct[]> = {};
            const pharmacyUpdates: Array<{ id: string; data: any }> = [];
            const pharmacyCreates: Array<any> = [];

            const allProductNames = new Set<string>();
            pharmacyItems.forEach(pi => allProductNames.add((pi.productName || pi.name || '').trim().toLowerCase()));
            suppliers.forEach(s => s.products?.forEach(p => allProductNames.add(p.name.trim().toLowerCase())));
            stockEntries.forEach(entry => entry.items?.forEach(item => {
                if (item.itemName) allProductNames.add(item.itemName.trim().toLowerCase());
            }));

            console.log('Total unique products identified:', allProductNames.size);

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
                    const match = entry.items?.find(item => (item.itemName || '').trim().toLowerCase() === nameKey);
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

                // For currentMax, if we have multiple pi items with same name, we should SUM them to be safe, 
                // but the system usually expects 1:1. However, to fix "zero" issues, we'll take the MAX + any orphans.
                const sameNamePis = pharmacyItems.filter(i => (i.productName || i.name || '').trim().toLowerCase() === nameKey);
                const piQty = sameNamePis.reduce((sum, i) => sum + Number(i.quantity || 0), 0);
                
                const currentMax = Math.max(piQty, Number(foundSp?.quantity || 0));
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
                        // Update ALL items with this name to ensure parity
                        sameNamePis.forEach(item => {
                             pharmacyUpdates.push({ id: item.id, data: { quantity: finalQty, sellingPrice: finalSelling, rack: finalRack } });
                             syncCount++;
                        });
                    }
                } else if (pi && (!foundSp || !foundSup)) {
                    const supplier = suppliers.find(s => s.id === pi.supplierId || s.name === pi.supplier) || suppliers[0];
                    if (supplier) {
                        if (!supplierUpdates[supplier.id]) supplierUpdates[supplier.id] = [...(supplier.products || [])];
                        supplierUpdates[supplier.id].push({ id: pi.id, name: pi.productName || pi.name || '', sellingPrice: finalSelling, quantity: finalQty, rack: finalRack, minThreshold: 0 });
                        syncCount++;
                    }
                } else if (!pi && foundSp && foundSup) {
                    pharmacyCreates.push({
                        id: foundSp.id, productName: foundSp.name, sellingPrice: finalSelling, quantity: finalQty, rack: finalRack,
                        supplier: foundSup.name, supplierId: foundSup.id, active: true, category: foundSup.category || 'General'
                    });
                    syncCount++;
                } else if (!pi && !foundSp && historicalQty > 0) {
                    // Item ONLY exists in Logs - Recover it!
                    const recoveringSup = suppliers.find(s => s.type === 'Vendor') || suppliers[0]; 
                    if (recoveringSup) {
                        const newId = `recovered-${Date.now()}-${Math.floor(Math.random()*1000)}`;
                        if (!supplierUpdates[recoveringSup.id]) supplierUpdates[recoveringSup.id] = [...(recoveringSup.products || [])];
                        
                        const recoveredProduct = { 
                            id: newId, name: nameKey.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '), 
                            sellingPrice: finalSelling || 0, 
                            quantity: finalQty, rack: '', minThreshold: 0 
                        };
                        
                        supplierUpdates[recoveringSup.id].push(recoveredProduct);
                        pharmacyCreates.push({
                            ...recoveredProduct, productName: recoveredProduct.name,
                            supplier: recoveringSup.name, supplierId: recoveringSup.id, active: true, category: 'General'
                        });
                        recoveryCount++;
                        syncCount++;
                    }
                }
            });

            console.log(`Sync complete: ${syncCount} updates identified, ${recoveryCount} items recovered.`);

            const promises: any[] = [];
            Object.entries(supplierUpdates).forEach(([supId, products]) => promises.push(updateDocumentNonBlocking(doc(firestore, 'suppliers', supId), { products })));
            pharmacyUpdates.forEach(u => promises.push(updateDocumentNonBlocking(doc(firestore, 'pharmacyItems', u.id), u.data)));
            pharmacyCreates.forEach(c => promises.push(setDocumentNonBlocking(doc(firestore, 'pharmacyItems', c.id), c, { merge: true })));

            await Promise.all(promises);
            toast({ title: 'System Restored', description: `Successfully harvested and reconciled ${syncCount} details. ${recoveryCount} missing items recovered.` });
        } catch (error: any) {
            console.error('Sync Error:', error);
            toast({ variant: 'destructive', title: 'Sync Failed', description: error.message });
        } finally {
            console.groupEnd();
            setIsSyncing(false);
        }
    };

    const [selectedRange, setSelectedRange] = React.useState<DateRange | undefined>({
        from: new Date(),
        to: new Date(),
    });

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
                
                // Promote the maximum quantity and selling price
                const currentQty = Math.max(Number(p.quantity || 0), Number(piMatch?.quantity || 0));
                const currentSelling = Math.max(Number(p.sellingPrice || 0), Number(piMatch?.sellingPrice || 0));

                items.push({ 
                    ...p, 
                    quantity: currentQty,
                    sellingPrice: currentSelling,
                    supplierName: s.name, 
                    supplierId: s.id,
                    rack: p.rack || piMatch?.rack || '',
                    category: s.category || 'General'
                });
                processedNames.add(nameKey);
            });
        });

        // 2. Catch orphan items in Pharmacy POS that don't exist in Master Ledger
        pharmacyItems.forEach(pi => {
            const nameKey = (pi.productName || pi.name || '').trim().toLowerCase();
            if (nameKey && !processedNames.has(nameKey)) {
                items.push({
                    id: pi.id,
                    name: pi.productName || pi.name || 'Unnamed Product',
                    quantity: pi.quantity || 0,
                    sellingPrice: pi.sellingPrice || 0,
                    supplierName: pi.supplier || 'Unlinked',
                    supplierId: pi.supplierId || 'unlinked',
                    rack: pi.rack || '',
                    minThreshold: 0,
                    category: pi.category || 'General'
                });
                processedNames.add(nameKey);
            }
        });

        // Sort alphabetically by name (Case-Insensitive)
        return items.sort((a, b) => 
            (a.name || '').trim().localeCompare((b.name || '').trim(), undefined, { sensitivity: 'base' })
        );
    }, [suppliers, pharmacyItems]);

    const [searchTerm, setSearchTerm] = React.useState('');

    const filteredInventoryItems = React.useMemo(() => {
        if (!searchTerm.trim()) return inventoryItems;
        const term = searchTerm.toLowerCase().trim();
        return inventoryItems.filter(item =>
            (item.name || '').toLowerCase().includes(term) ||
            (item.supplierName || '').toLowerCase().includes(term) ||
            (item.rack || '').toLowerCase().includes(term)
        );
    }, [inventoryItems, searchTerm]);

    const lowStockItems = React.useMemo(() => {
        return inventoryItems.filter(item => {
            const isAtOrBelow = Number(item.quantity) <= (item.minThreshold || 0);
            const isInitialized = (item.minThreshold || 0) > 0 || Number(item.quantity) > 0;
            return isAtOrBelow && isInitialized;
        });
    }, [inventoryItems]);

    const stockMetrics = React.useMemo(() => {
        const totalValue = inventoryItems.reduce((acc, item) => acc + (Number(item.sellingPrice) * Number(item.quantity)), 0);
        const outOfStock = inventoryItems.filter(item => Number(item.quantity) <= 0).length;
        
        // Find high value items for data audit
        const topValueItems = [...inventoryItems]
            .map(item => ({ ...item, totalVal: Number(item.sellingPrice) * Number(item.quantity) }))
            .sort((a, b) => b.totalVal - a.totalVal)
            .slice(0, 5);

        return {
            totalItems: inventoryItems.length,
            totalValue,
            lowStockCount: lowStockItems.length,
            outOfStock,
            topValueItems
        };
    }, [inventoryItems, lowStockItems]);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-[400px] gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                <p className="text-slate-500 font-bold animate-pulse uppercase tracking-[0.2em] text-[10px]">Analyzing Stock Levels...</p>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-8 max-w-7xl mx-auto">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black tracking-tight text-slate-900 flex items-center gap-3">
                        Inventory <span className="text-emerald-600">&</span> Stocks
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">Real-time stock replenishment and retail availability tracking.</p>
                </div>
                <div className="flex gap-3 items-center flex-wrap">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search products, suppliers..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 w-64"
                        />
                    </div>
                    <DatePickerWithRange date={selectedRange} onDateChange={setSelectedRange} />
                    <Button variant="outline" className="rounded-xl border-slate-200 font-bold">Export CSV</Button>
                    <Button 
                        disabled={isSyncing} 
                        onClick={handleSync}
                        className="rounded-xl bg-emerald-600 hover:bg-emerald-700 font-bold shadow-lg shadow-emerald-500/20"
                    >
                        {isSyncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
                        {isSyncing ? 'Syncing...' : 'Sync Inventory'}
                    </Button>
                </div>
            </div>

            {/* Premium Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="relative overflow-hidden border-none bg-gradient-to-br from-indigo-600 to-violet-700 text-white shadow-xl shadow-indigo-500/20">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Boxes className="h-24 w-24" />
                    </div>
                    <CardHeader className="pb-2">
                        <CardDescription className="text-indigo-100 font-black uppercase tracking-widest text-[10px]">Potential Retail Revenue</CardDescription>
                        <CardTitle className="text-3xl font-black">Rs {stockMetrics.totalValue.toLocaleString()}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2 text-xs font-bold bg-white/10 w-fit px-3 py-1 rounded-full">
                            <TrendingUp className="h-3 w-3 text-emerald-400" /> Projected Market Inflow
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white/40 backdrop-blur-md border-slate-100 shadow-sm transition-all hover:shadow-md">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-slate-500 font-black uppercase tracking-widest text-[10px]">Active SKUs</CardDescription>
                        <CardTitle className="text-3xl font-black flex items-center gap-2">
                            {stockMetrics.totalItems} <span className="text-sm font-medium text-slate-400">Items</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 bg-emerald-50 w-fit px-3 py-1 rounded-full">
                            <BarChart3 className="h-3 w-3" /> Catalogue Strength
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white/40 backdrop-blur-md border-slate-100 shadow-sm transition-all hover:shadow-md">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-slate-500 font-black uppercase tracking-widest text-[10px]">Low Stock Alert</CardDescription>
                        <CardTitle className={cn(
                            "text-3xl font-black",
                            stockMetrics.lowStockCount > 0 ? "text-amber-600" : "text-emerald-600"
                        )}>
                            {stockMetrics.lowStockCount}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className={cn(
                            "flex items-center gap-2 text-xs font-bold w-fit px-3 py-1 rounded-full",
                            stockMetrics.lowStockCount > 0 ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"
                        )}>
                            <AlertTriangle className="h-3 w-3" /> Replenish Soon
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white/40 backdrop-blur-md border-slate-100 shadow-sm transition-all hover:shadow-md">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-slate-500 font-black uppercase tracking-widest text-[10px]">Out of Stock</CardDescription>
                        <CardTitle className={cn(
                            "text-3xl font-black",
                            stockMetrics.outOfStock > 0 ? "text-red-600" : "text-emerald-600"
                        )}>
                            {stockMetrics.outOfStock}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className={cn(
                            "flex items-center gap-2 text-xs font-bold w-fit px-3 py-1 rounded-full",
                            stockMetrics.outOfStock > 0 ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
                        )}>
                            <History className="h-3 w-3" /> Urgent Attention
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs for Reports */}
            <Tabs defaultValue="all-items" className="w-full">
                <TabsList className="bg-slate-100/50 p-1 rounded-2xl h-auto mb-8 border border-slate-200">
                    <TabsTrigger value="all-items" className="rounded-xl px-6 py-2.5 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">All Inventory</TabsTrigger>
                    <TabsTrigger value="low-stocks" className="rounded-xl px-6 py-2.5 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">Critical Stocks</TabsTrigger>
                    <TabsTrigger value="expiry" className="rounded-xl px-6 py-2.5 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">Expiry Tracker</TabsTrigger>
                </TabsList>

                {/* All Items Tab */}
                <TabsContent value="all-items" className="mt-0 outline-none">
                    <Card className="border-none bg-white shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden">
                        <CardHeader className="p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                        <CardTitle className="text-xl font-black text-slate-900">Complete Master Ledger</CardTitle>
                                <CardDescription>
                                    {searchTerm 
                                        ? `${filteredInventoryItems.length} result${filteredInventoryItems.length !== 1 ? 's' : ''} for "${searchTerm}"`
                                        : `All ${inventoryItems.length} items, sorted A–Z.`
                                    }
                                </CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader className="bg-slate-50/50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    <TableRow className="border-none hover:bg-transparent">
                                        <TableHead className="pl-8 py-4">Product Name</TableHead>
                                        <TableHead className="text-center py-4">Remaining Stock</TableHead>
                                        <TableHead className="text-center py-4">Min. Threshold</TableHead>
                                        <TableHead className="text-right py-4 pr-8">Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredInventoryItems.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-16">
                                                <div className="flex flex-col items-center gap-2 opacity-40">
                                                    <Search className="h-8 w-8" />
                                                    <p className="font-black uppercase tracking-widest text-xs">No products match "{searchTerm}"</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : filteredInventoryItems.map((item) => {
                                        const isLow = Number(item.quantity) <= (item.minThreshold || 0);
                                        const isOut = Number(item.quantity) <= 0;

                                        return (
                                            <TableRow key={`${item.supplierId}_${item.id}`} className={cn(
                                                "group hover:bg-slate-50/80 transition-colors border-slate-50",
                                                isLow && "bg-amber-50/30 hover:bg-amber-50/50"
                                            )}>
                                                <TableCell className="pl-8 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-slate-900">{item.name}</span>
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{item.supplierName}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Badge variant="outline" className={cn(
                                                        "rounded-lg font-black min-w-[50px] justify-center",
                                                        isOut ? "bg-red-50 text-red-600 border-red-100" : (isLow ? "bg-amber-50 text-amber-600 border-amber-100" : "bg-emerald-50 text-emerald-600 border-emerald-100")
                                                    )}>
                                                        {item.quantity}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-center font-bold text-slate-400 text-xs">
                                                    {item.minThreshold || 0}
                                                </TableCell>
                                                <TableCell className="text-right pr-8">
                                                    {isOut ? (
                                                        <span className="text-[10px] font-black text-red-600 uppercase tracking-widest bg-red-100 px-2 py-1 rounded">Out of Stock</span>
                                                    ) : isLow ? (
                                                        <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest bg-amber-100 px-2 py-1 rounded">Low Stock</span>
                                                    ) : (
                                                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-100 px-2 py-1 rounded">Healthy</span>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Critical Inventory Tab */}
                <TabsContent value="low-stocks" className="mt-0 outline-none">
                    <Card className="border-none bg-white shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden">
                        <CardHeader className="p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <CardTitle className="text-xl font-black text-slate-900">Replenishment Priority</CardTitle>
                                <CardDescription>Showing all items currently below or near their minimum threshold.</CardDescription>
                            </div>
                            <div className="flex gap-2">
                                <Button size="sm" variant="outline" className="rounded-xl font-bold"><Printer className="h-4 w-4 mr-2" /> Print List</Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            {lowStockItems.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                                    <div className="bg-emerald-50 p-6 rounded-full">
                                        <PackageOpen className="h-12 w-12 text-emerald-600" />
                                    </div>
                                    <div>
                                        <p className="text-lg font-black text-slate-900">Inventory Levels Healthy</p>
                                        <p className="text-sm text-slate-500">All SKUs are currently above their safety thresholds.</p>
                                    </div>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader className="bg-slate-50/50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        <TableRow className="border-none hover:bg-transparent">
                                            <TableHead className="pl-8 py-4">Item & Supplier</TableHead>
                                            <TableHead className="text-center py-4">Remaining Stock</TableHead>
                                            <TableHead className="text-center py-4">Min. Threshold</TableHead>
                                            <TableHead className="text-center py-4">Location</TableHead>
                                            <TableHead className="text-right py-4 pr-8">Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {lowStockItems.map((item) => (
                                            <TableRow key={`${item.supplierId}_${item.id}`} className="group hover:bg-slate-50/80 transition-colors border-slate-50">
                                                <TableCell className="pl-8 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-slate-900">{item.name}</span>
                                                        <span className="text-[10px] font-bold text-emerald-600/60 uppercase">{item.supplierName}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <span className={cn(
                                                        "text-lg font-black",
                                                        Number(item.quantity) <= 0 ? "text-red-600" : "text-amber-600"
                                                    )}>
                                                        {item.quantity}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <span className="text-sm font-bold text-slate-400">{item.minThreshold || 0}</span>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Badge variant="outline" className="rounded-lg text-[10px] font-black bg-slate-50 border-slate-200">RACK {item.rack || '?'}</Badge>
                                                </TableCell>
                                                <TableCell className="text-right pr-8">
                                                    <div className="flex justify-end">
                                                        <Badge className={cn(
                                                            "rounded-full px-3 py-0.5 text-[10px] font-black uppercase border-none",
                                                            Number(item.quantity) <= 0 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                                                        )}>
                                                            {Number(item.quantity) <= 0 ? "Out of Stock" : "Low Stock"}
                                                        </Badge>
                                                    </div>
                                                </TableCell>

                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Expiry Tracker Tab */}
                <TabsContent value="expiry" className="mt-0 outline-none">
                    <Card className="border-none bg-white shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden py-20">
                        <CardContent className="flex flex-col items-center justify-center text-center space-y-4">
                            <div className="bg-slate-50 p-6 rounded-full">
                                <Archive className="h-12 w-12 text-slate-300" />
                            </div>
                            <div>
                                <p className="text-lg font-black text-slate-900 uppercase tracking-widest">Compiling Expiry Data</p>
                                <p className="text-sm text-slate-400 max-w-xs mx-auto">Detailed historical reporting for expiry is currently being synchronized with the main ledger.</p>
                            </div>
                            <Button variant="outline" className="rounded-xl font-bold mt-4">Refresh Records</Button>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Bottom Footer Info */}
            <div className="flex items-center justify-center py-10 opacity-30">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] flex items-center gap-6">
                    <span className="h-px w-20 bg-slate-400"></span>
                    Master Stock Ledger v2.0
                    <span className="h-px w-20 bg-slate-400"></span>
                </p>
            </div>
        </div>
    );
}
