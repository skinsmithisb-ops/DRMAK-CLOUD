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
import { MoreHorizontal, PlusCircle, Search, Loader2, Upload, FileUp, FileText, Printer, Edit, Pencil, Eye } from 'lucide-react';
import { DatePicker } from '@/components/DatePicker';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useCollection, useFirestore, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import type { StockEntry, Supplier, PharmacyItem } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, History } from 'lucide-react';

const StockEntryDialog = ({ open, onOpenChange, suppliers }: { open: boolean, onOpenChange: (open: boolean) => void, suppliers?: Supplier[] | null }) => {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [selectedDistributorId, setSelectedDistributorId] = React.useState('');
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [invoiceNo, setInvoiceNo] = React.useState('');
    const [docNo, setDocNo] = React.useState(`DOC-${Math.floor(Math.random() * 10000)}`);
    
    // Mock items for the dialog - in real app, these would be added dynamically
    const [items, setItems] = React.useState<any[]>([
        { sr: 1, itemName: '', manufacturer: '', totalQty: 0, unitCost: 0, totalCost: 0 }
    ]);

    const distributors = React.useMemo(() => suppliers?.filter(s => s.type === 'Distributor') || [], [suppliers]);
    const selectedDistributor = React.useMemo(() => distributors.find(d => d.id === selectedDistributorId), [distributors, selectedDistributorId]);

    const isBlocked = React.useMemo(() => {
        if (!selectedDistributor) return false;
        return (selectedDistributor.currentBalance || 0) > 0;
    }, [selectedDistributor]);

    const totalBill = React.useMemo(() => items.reduce((acc, item) => acc + (item.totalCost || 0), 0), [items]);

    const handleSave = async () => {
        if (!selectedDistributorId || isBlocked) return;
        setIsSubmitting(true);
        try {
            const entry: Partial<StockEntry> = {
                supplier: selectedDistributor?.name || '',
                supplierId: selectedDistributorId,
                document: docNo,
                supplierInvoice: invoiceNo,
                supplierInvoiceDate: new Date().toLocaleDateString(),
                createdAt: new Date().toISOString(),
                items: items.map(i => ({ ...i, netUnitCost: i.unitCost, totalCost: i.totalQty * i.unitCost })),
                sku: items.length
            };
            
            if (firestore) {
                // 1. Save the stock entry log
                await addDocumentNonBlocking(collection(firestore, 'stockEntries'), entry);
                
                // 2. Update Distributor liability
                const newBalance = (selectedDistributor?.currentBalance || 0) + totalBill;
                await updateDocumentNonBlocking(doc(firestore, 'suppliers', selectedDistributorId), {
                    currentBalance: newBalance
                });

                // 3. Update Inventory Records (Atomic-like)
                const currentProducts = [...(selectedDistributor?.products || [])];
                
                for (const item of items) {
                    if (!item.itemName || item.totalQty <= 0) continue;

                    const normalizedName = item.itemName.trim().toLowerCase();
                    const existingProductIndex = currentProducts.findIndex(p => p.name.trim().toLowerCase() === normalizedName);
                    
                    let targetProduct;
                    const inventoryQty = Number(item.totalQty);
                    const inventoryPrice = Number(item.unitCost);

                    if (existingProductIndex >= 0) {
                        // Update Existing
                        currentProducts[existingProductIndex] = {
                            ...currentProducts[existingProductIndex],
                            quantity: (Number(currentProducts[existingProductIndex].quantity) || 0) + inventoryQty,
                            price: inventoryPrice || currentProducts[existingProductIndex].price
                        };
                        targetProduct = currentProducts[existingProductIndex];
                    } else {
                        // Create New in Supplier Catalog
                        targetProduct = {
                            id: `prod-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                            name: item.itemName.trim(),
                            quantity: inventoryQty,
                            price: inventoryPrice,
                            category: 'Medicine',
                            minThreshold: 5,
                            sellingPrice: inventoryPrice * 1.2, // Default markup
                            rack: ''
                        };
                        currentProducts.push(targetProduct);
                    }

                    // Register/Update in Pharmacy POS (pharmacyItems)
                    const pDocRef = doc(firestore, 'pharmacyItems', targetProduct.id);
                    await setDocumentNonBlocking(pDocRef, {
                        id: targetProduct.id,
                        productName: targetProduct.name,
                        quantity: targetProduct.quantity,
                        purchasePrice: targetProduct.price || 0,
                        sellingPrice: targetProduct.sellingPrice || ((targetProduct.price || 0) * 1.2),
                        supplier: selectedDistributor?.name || '',
                        supplierId: selectedDistributor?.id || '',
                        active: true,
                        category: targetProduct.category || 'Medicine',
                        rack: targetProduct.rack || ''
                    }, { merge: true });
                }

                // Finalize Supplier Product List Update
                await updateDocumentNonBlocking(doc(firestore, 'suppliers', selectedDistributorId), {
                    products: currentProducts
                });

                toast({ title: 'Stock Received', description: `Inventory updated. Successfully added stock and updated ${selectedDistributor?.name}'s liability.` });
                onOpenChange(false);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px] rounded-3xl border-none shadow-2xl p-0 overflow-hidden">
                <div className="bg-gradient-to-br from-primary/10 via-background to-background p-6">
                    <DialogHeader className="mb-6">
                        <DialogTitle className="text-2xl font-black tracking-tight">Inbound Stock Entry</DialogTitle>
                        <DialogDescription className="font-medium">Process incoming inventory from authorized distributors.</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase text-muted-foreground ml-1">Distributor</Label>
                                <Select value={selectedDistributorId} onValueChange={setSelectedDistributorId}>
                                    <SelectTrigger className="h-12 rounded-xl bg-muted/20 border-none">
                                        <SelectValue placeholder="Select Source" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {distributors.map(d => (
                                            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase text-muted-foreground ml-1">Invoice Number</Label>
                                <Input value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} placeholder="INV-XXXXX" className="h-12 rounded-xl bg-muted/20 border-none" />
                            </div>
                        </div>

                        {isBlocked && (
                            <Alert variant="destructive" className="rounded-2xl border-none bg-red-50 dark:bg-red-950/20 animate-in zoom-in-95">
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle className="font-black">BLOCKING: UNCLEARED BALANCE</AlertTitle>
                                <AlertDescription className="font-medium">
                                    {selectedDistributor?.name} has an outstanding liability of <span className="font-black">PKR {selectedDistributor?.currentBalance?.toLocaleString()}</span>. 
                                    Per policy, all previous bills must be fully settled in the <span className="font-black">Accounts</span> module before receiving new stock.
                                </AlertDescription>
                            </Alert>
                        )}

                        <div className="rounded-2xl border border-muted/20 bg-muted/5 p-4">
                            <h4 className="text-sm font-black mb-3 text-muted-foreground uppercase">Inventory Items</h4>
                            <div className="space-y-3">
                                {items.map((item, idx) => (
                                    <div key={idx} className="grid grid-cols-4 gap-3 bg-background p-3 rounded-xl shadow-sm">
                                        <div className="col-span-2">
                                            <Input placeholder="Item Name" value={item.itemName} onChange={e => {
                                                const newItems = [...items];
                                                newItems[idx].itemName = e.target.value;
                                                setItems(newItems);
                                            }} className="border-none bg-muted/10 h-10 rounded-lg text-sm" />
                                        </div>
                                        <Input type="number" placeholder="Qty" value={item.totalQty || ''} onChange={e => {
                                            const newItems = [...items];
                                            const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                            newItems[idx].totalQty = isNaN(val) ? 0 : val;
                                            newItems[idx].totalCost = (newItems[idx].totalQty || 0) * (newItems[idx].unitCost || 0);
                                            setItems(newItems);
                                        }} className="border-none bg-muted/10 h-10 rounded-lg text-sm" />
                                        <Input type="number" placeholder="Cost" value={item.unitCost || ''} onChange={e => {
                                            const newItems = [...items];
                                            const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                            newItems[idx].unitCost = isNaN(val) ? 0 : val;
                                            newItems[idx].totalCost = (newItems[idx].totalQty || 0) * (newItems[idx].unitCost || 0);
                                            setItems(newItems);
                                        }} className="border-none bg-muted/10 h-10 rounded-lg text-sm" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="bg-muted/10 p-4 border-t border-muted/20 flex items-center justify-between">
                    <div className="text-left">
                        <div className="text-[10px] font-black uppercase text-muted-foreground mb-0.5">Total Payload Value</div>
                        <div className="text-xl font-black text-primary">PKR {totalBill.toLocaleString()}</div>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl font-bold">Discard</Button>
                        <Button 
                            onClick={handleSave} 
                            disabled={!selectedDistributorId || isBlocked || isSubmitting || totalBill <= 0}
                            className="rounded-xl font-black px-8 bg-black hover:bg-black/90 text-white shadow-xl shadow-black/20"
                        >
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Finalize Batch'}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default function ManageStockPage() {
    const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
    const firestore = useFirestore();
    const stockEntriesRef = useMemoFirebase(() => firestore ? collection(firestore, 'stockEntries') : null, [firestore]);
    const { data: stockData, isLoading: isStockLoading } = useCollection<StockEntry>(stockEntriesRef);

    const suppliersRef = useMemoFirebase(() => firestore ? collection(firestore, 'suppliers') : null, [firestore]);
    const { data: suppliers } = useCollection<Supplier>(suppliersRef);

    const totalInboundPrice = React.useMemo(() => {
        if (!stockData) return 0;
        return stockData.reduce((acc, stock) => {
            return acc + (stock.items?.reduce((iAcc, item) => iAcc + (item.totalCost || 0), 0) || 0);
        }, 0);
    }, [stockData]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Pharmacy Stocks</CardTitle>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline"><FileUp className="mr-2 h-4 w-4" /> PO To GRN Report</Button>
                <Button variant="outline"><FileText className="mr-2 h-4 w-4" /> Excel</Button>
                <Button variant="outline"><Printer className="mr-2 h-4 w-4" /> Print</Button>
                <Button onClick={() => setIsAddDialogOpen(true)} className="rounded-xl font-black shadow-lg shadow-primary/20"><PlusCircle className="mr-2 h-4 w-4" /> Add New Stock</Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 pt-4">
              <div className="flex flex-wrap gap-2">
                  <DatePicker date={new Date()} onDateChange={() => {}} />
                  <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Search by Item Name" className="pl-8 w-48" />
                  </div>
                   <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Search by Document No..." className="pl-8 w-48" />
                  </div>
                  <Select><SelectTrigger className="w-48"><SelectValue placeholder="Select Manufacturer" /></SelectTrigger><SelectContent></SelectContent></Select>
                  <Select>
                      <SelectTrigger className="w-48">
                          <SelectValue placeholder="Select Supplier" />
                      </SelectTrigger>
                      <SelectContent>
                          {suppliers?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                  </Select>
              </div>
          </div>
        </CardHeader>
        <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-2 mb-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">Total Inbounded Price</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black font-mono text-primary">Rs {totalInboundPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">Net Purchase</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black font-mono text-emerald-600">Rs {totalInboundPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    </CardContent>
                </Card>
            </div>

            {isStockLoading ? (
                <div className="flex justify-center items-center h-48">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : (!stockData || stockData.length === 0) ? (
                <div className="text-center p-12 border-dashed border-2 rounded-3xl bg-muted/5 shadow-inner">
                    <p className="font-bold text-muted-foreground">No stock entries found in the system.</p>
                </div>
            ) : stockData.map((stock, index) => (
                <Card key={stock.id} className="mb-6 overflow-hidden border-none shadow-xl bg-card/50 backdrop-blur-sm group hover:ring-2 hover:ring-primary/20 transition-all duration-500">
                    <CardHeader className="bg-muted/30 p-4 border-b border-muted/20">
                        <div className="flex flex-wrap justify-between items-center gap-4">
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                <div className="space-y-0.5">
                                    <div className="text-[10px] opacity-60">Supplier</div>
                                    <div className="text-foreground font-black text-sm">{stock.supplier}</div>
                                </div>
                                <div className="space-y-0.5 border-l pl-4 border-muted/50">
                                    <div className="text-[10px] opacity-60">Document #</div>
                                    <div className="text-foreground font-black text-sm">#{stock.document}</div>
                                </div>
                                <div className="space-y-0.5 border-l pl-4 border-muted/50">
                                    <div className="text-[10px] opacity-60">SKUs</div>
                                    <div className="text-foreground font-black text-sm">{stock.items?.length || 0} Items</div>
                                </div>
                                <div className="space-y-0.5 border-l pl-4 border-muted/50">
                                    <div className="text-[10px] opacity-60">Created At</div>
                                    <div className="text-foreground font-bold">{new Date(stock.createdAt).toLocaleDateString()}</div>
                                </div>
                                <div className="space-y-0.5 border-l pl-4 border-muted/50">
                                    <div className="text-[10px] opacity-60">Invoice Date</div>
                                    <div className="text-foreground font-bold">{stock.supplierInvoiceDate}</div>
                                </div>
                                <div className="space-y-0.5 border-l pl-4 border-muted/50">
                                    <div className="text-[10px] opacity-60">Invoice #</div>
                                    <div className="text-primary font-black text-sm">{stock.supplierInvoice}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button size="sm" variant="outline" className="h-8 rounded-lg font-bold"><Printer className="h-3 w-3 mr-1" /> Print</Button>
                                <Button size="sm" variant="outline" className="h-8 rounded-lg font-bold text-primary"><Edit className="h-3 w-3 mr-1" /> Edit</Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                         <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-muted/10">
                                    <TableRow className="hover:bg-transparent border-none">
                                        <TableHead className="font-black text-[10px] uppercase">SR #</TableHead>
                                        <TableHead className="font-black text-[10px] uppercase">Item Name</TableHead>
                                        <TableHead className="font-black text-[10px] uppercase">Manufacturer</TableHead>
                                        <TableHead className="font-black text-[10px] uppercase">Total Qty</TableHead>
                                        <TableHead className="font-black text-[10px] uppercase text-right">Unit Cost</TableHead>
                                        <TableHead className="font-black text-[10px] uppercase text-right">Net Cost</TableHead>
                                        <TableHead className="font-black text-[10px] uppercase text-right">Total Price</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {stock.items?.map((item: any, idx: number) => (
                                        <TableRow key={idx} className="border-muted/10 hover:bg-muted/5 transition-colors">
                                            <TableCell className="font-mono text-muted-foreground">{idx + 1}</TableCell>
                                            <TableCell className="font-black text-foreground">{item.itemName}</TableCell>
                                            <TableCell className="text-muted-foreground font-medium">{item.manufacturer}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="font-black text-primary border-primary/20 bg-primary/5">
                                                    {item.totalQty} Units
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right font-mono font-bold">Rs {item.unitCost?.toLocaleString()}</TableCell>
                                            <TableCell className="text-right font-mono font-bold text-emerald-600">Rs {item.netUnitCost?.toLocaleString()}</TableCell>
                                            <TableCell className="text-right font-mono font-black text-primary">Rs {item.totalCost?.toLocaleString()}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                         </div>
                    </CardContent>
                </Card>
            ))}
        </CardContent>
      </Card>
       <StockEntryDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} suppliers={suppliers} />
       <div className="fixed bottom-8 right-8 flex flex-col gap-2">
            <Button size="icon" className="rounded-full h-12 w-12"><FileText className="h-6 w-6" /></Button>
            <Button size="icon" className="rounded-full h-12 w-12"><Pencil className="h-6 w-6" /></Button>
            <Button size="icon" className="rounded-full h-12 w-12"><Eye className="h-6 w-6" /></Button>
        </div>
    </div>
  );
}
