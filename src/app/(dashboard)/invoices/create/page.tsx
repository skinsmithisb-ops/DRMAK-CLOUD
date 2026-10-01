'use client';
import * as React from 'react';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, Search, Trash2, Printer, Save, ChevronLeft } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase, useDoc, addDocumentNonBlocking } from '@/firebase';
import type { Patient, Doctor, Invoice, InvoiceItem } from '@/lib/types';
import { collection, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useSearchParams, useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { Loader2 } from 'lucide-react';

export default function CreateInvoicePage() {
    return (
        <React.Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}>
            <CreateInvoiceContent />
        </React.Suspense>
    );
}

function CreateInvoiceContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const patientId = searchParams.get('id');
    const firestore = useFirestore();
    const { toast } = useToast();

    const [items, setItems] = React.useState<Partial<InvoiceItem>[]>([{ id: uuidv4(), quantity: 1, discount: 0 }]);
    const [notes, setNotes] = React.useState('');
    const [isSaving, setIsSaving] = React.useState(false);

    const patientDocRef = useMemoFirebase(() => {
        if (!firestore || !patientId) return null;
        return doc(firestore, 'patients', patientId);
    }, [firestore, patientId]);

    const { data: patient, isLoading: patientLoading } = useDoc<Patient>(patientDocRef);
    const { data: doctors, isLoading: doctorsLoading } = useCollection<Doctor>(useMemoFirebase(() => firestore ? collection(firestore, 'doctors') : null, [firestore]));

    const handleAddItem = () => {
        setItems(prev => [...prev, { id: uuidv4(), quantity: 1, discount: 0 }]);
    };

    const handleRemoveItem = (id: string) => {
        setItems(prev => prev.filter(item => item.id !== id));
    };

    const handleItemChange = (id: string, field: keyof InvoiceItem, value: any) => {
        setItems(prev => prev.map(item => {
            if (item.id === id) {
                const updatedItem = { ...item, [field]: value };
                if (field === 'rate' || field === 'quantity') {
                    updatedItem.amount = (updatedItem.rate || 0) * (updatedItem.quantity || 0);
                }
                return updatedItem;
            }
            return item;
        }));
    };
    
    const summary = React.useMemo(() => {
        const subTotal = items.reduce((acc, item) => acc + (item?.amount || 0), 0);
        const totalDiscount = items.reduce((acc, item) => acc + (item?.discount || 0), 0);
        const payable = subTotal - totalDiscount;
        // Payment logic to be added
        const paid = 0;
        const dues = payable - paid;
        return { subTotal, totalDiscount, payable, paid, dues, advance: 0 };
    }, [items]);
    
    const handleSaveInvoice = async () => {
        if (!firestore || !patient) {
            toast({ variant: 'destructive', title: 'Error', description: 'Patient not loaded or connection issue.' });
            return;
        }

        setIsSaving(true);
        const invoiceData: Omit<Invoice, 'id'> = {
            patientId: patient.id,
            patientMobileNumber: patient.mobileNumber,
            invoiceDate: new Date().toISOString(),
            items: items.filter(i => i.procedure).map(i => i as InvoiceItem),
            subTotal: summary.subTotal,
            totalDiscount: summary.totalDiscount,
            grandTotal: summary.payable,
            amountPaid: summary.paid,
            amountDue: summary.dues,
            status: summary.dues > 0 ? 'Pending' : 'Paid',
            notes: notes,
        };

        try {
            await addDocumentNonBlocking(collection(firestore, 'invoices'), invoiceData);
            toast({ title: 'Invoice Created', description: 'The invoice has been saved successfully.' });
            router.push(`/patients/details?id=${patient.id}`);
        } catch(e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'Save Failed', description: 'Could not save the invoice.' });
        } finally {
            setIsSaving(false);
        }
    }
    
    if (patientLoading || doctorsLoading) {
        return <div className="flex items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin" /></div>
    }

    if (!patient) {
        return <div className="flex items-center justify-center h-screen"><p>Patient not found.</p></div>
    }

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}><ChevronLeft /></Button>
                    <div>
                        <h1 className="text-lg font-semibold text-gray-500">{patient.id.slice(0,8)} - {patient.name} - Create Invoice</h1>
                        <p className="text-xs text-muted-foreground">{patient.mobileNumber}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline"><Printer className="mr-2" /> Print</Button>
                    <Button onClick={handleSaveInvoice} disabled={isSaving}>
                        {isSaving ? <Loader2 className="mr-2 animate-spin" /> : <Save className="mr-2" />}
                        Save Invoice
                    </Button>
                </div>
            </div>

            <div className="space-y-4">
                {/* Items Section */}
                <Card>
                    <CardContent className="p-4">
                        <div className="grid grid-cols-12 gap-x-4 gap-y-2 items-center text-sm font-medium text-muted-foreground mb-2">
                            <div className="col-span-2">Procedure</div>
                            <div className="col-span-2">Description</div>
                            <div>Rate</div>
                            <div>Quantity</div>
                            <div>Amount</div>
                            <div>Discount</div>
                            <div>Deduct Discount</div>
                            <div className="col-span-2">Performed By</div>
                        </div>
                        {items.map(item => (
                             <div key={item.id} className="grid grid-cols-12 gap-x-4 gap-y-2 items-end mb-2">
                                <div className="col-span-2">
                                    <Select onValueChange={(val) => handleItemChange(item.id!, 'procedure', val)}>
                                        <SelectTrigger><SelectValue placeholder="Select Procedure" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="consultation">Consultation</SelectItem>
                                            <SelectItem value="laser">Laser Treatment</SelectItem>
                                            <SelectItem value="meso">Mesotherapy</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="col-span-2"><Input placeholder="Description" onChange={e => handleItemChange(item.id!, 'description', e.target.value)} /></div>
                                <div><Input type="number" placeholder="Rate" onChange={e => handleItemChange(item.id!, 'rate', +e.target.value)}/></div>
                                <div><Input type="number" value={item.quantity} onChange={e => handleItemChange(item.id!, 'quantity', +e.target.value)} /></div>
                                <div><Input type="number" value={item.amount || 0} readOnly className="bg-muted" /></div>
                                <div><Input type="number" value={item.discount} onChange={e => handleItemChange(item.id!, 'discount', +e.target.value)} /></div>
                                <div>
                                     <Select defaultValue="value">
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent><SelectItem value="value">Value</SelectItem></SelectContent>
                                    </Select>
                                </div>
                                <div className="col-span-2">
                                    <Select onValueChange={(val) => handleItemChange(item.id!, 'performedBy', val)}>
                                        <SelectTrigger><SelectValue placeholder="Select Performer" /></SelectTrigger>
                                        <SelectContent>
                                            {doctors?.map(d => <SelectItem key={d.id} value={d.id}>{d.fullName}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id!)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                                </div>
                            </div>
                        ))}
                        <Button variant="outline" onClick={handleAddItem}><PlusCircle className="mr-2" /> Add Item</Button>
                    </CardContent>
                </Card>

                <div className="grid grid-cols-3 gap-4">
                    {/* Notes Section */}
                    <div className="col-span-2">
                        <Card>
                             <CardContent className="p-4">
                                <Label htmlFor="notes">Invoice Note</Label>
                                <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={5}/>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Summary and Payment Section */}
                    <div>
                         <Card>
                            <CardContent className="p-4 space-y-2 text-sm">
                                <div className="flex justify-between"><span className="text-muted-foreground">Sub - Total:</span> <span className="font-semibold">Rs. {summary.subTotal.toFixed(2)}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Discount:</span> <span className="font-semibold">Rs. {summary.totalDiscount.toFixed(2)}</span></div>
                                <div className="flex justify-between font-bold text-base"><span >Payable:</span> <span>Rs. {summary.payable.toFixed(2)}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Paid:</span> <span className="font-semibold">Rs. {summary.paid.toFixed(2)}</span></div>
                                <div className="flex justify-between text-destructive"><span >Dues:</span> <span className="font-semibold">Rs. {summary.dues.toFixed(2)}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Advance:</span> <span className="font-semibold">Rs. {summary.advance.toFixed(2)}</span></div>

                                <div className="pt-4 space-y-2">
                                    <Label>Add Payment</Label>
                                    <div className="flex gap-2">
                                        <Input type="number" placeholder="Amount"/>
                                        <Select defaultValue="cash">
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="cash">Cash</SelectItem>
                                                <SelectItem value="card">Card</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <Button className="w-full">Add Payment</Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
