'use client';
import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  ChevronLeft,
  Loader2,
  Printer,
  Eye,
  Trash2,
  Edit,
} from 'lucide-react';
import {
  useCollection,
  useFirestore,
  useMemoFirebase,
  useDoc,
} from '@/firebase';
import type { Patient, Invoice } from '@/lib/types';
import { collection, doc, query, where } from 'firebase/firestore';
import { format } from 'date-fns';
import { DatePicker } from '@/components/DatePicker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { deleteDocumentNonBlocking } from '@/firebase';
import { isWithinInterval, startOfDay, endOfDay } from 'date-fns';

export default function InvoiceHistoryPage() {
  return (
    <React.Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}>
      <InvoiceHistoryContent />
    </React.Suspense>
  );
}

function InvoiceHistoryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const patientId = searchParams.get('id');
  const firestore = useFirestore();

  const patientDocRef = useMemoFirebase(
    () => (firestore && patientId ? doc(firestore, 'patients', patientId) : null),
    [firestore, patientId]
  );

  const invoicesQuery = useMemoFirebase(
    () => (firestore && patientId ? query(collection(firestore, 'invoices'), where('patientId', '==', patientId)) : null),
    [firestore, patientId]
  );

  const { data: patient, isLoading: patientLoading } = useDoc<Patient>(patientDocRef);
  const { data: invoices, isLoading: invoicesLoading, forceRerender } = useCollection<Invoice>(invoicesQuery);

  const { toast } = useToast();

  const [dateFrom, setDateFrom] = React.useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = React.useState<Date | undefined>(undefined);
  const [department, setDepartment] = React.useState<string>('all');
  const [searchQuery, setSearchQuery] = React.useState('');

  const filteredInvoices = React.useMemo(() => {
    if (!invoices) return [];
    return invoices.filter(invoice => {
      const invoiceDate = new Date(invoice.invoiceDate);

      const matchDate = (!dateFrom || invoiceDate >= startOfDay(dateFrom)) &&
        (!dateTo || invoiceDate <= endOfDay(dateTo));

      const matchQuery = !searchQuery ||
        invoice.items.some(item => item.procedure.toLowerCase().includes(searchQuery.toLowerCase())) ||
        invoice.id.toLowerCase().includes(searchQuery.toLowerCase());

      // Since department isn't clearly in the Invoice type from common snippets, we'll placeholder it for now
      // or filter by a specific field if it exists. For now, we'll just allow "all".
      const matchDept = department === 'all';

      return matchDate && matchQuery && matchDept;
    });
  }, [invoices, dateFrom, dateTo, searchQuery, department]);

  const handleDelete = async (invoiceId: string) => {
    if (!firestore || !window.confirm('Are you sure you want to delete this invoice?')) return;
    try {
      await deleteDocumentNonBlocking(doc(firestore, 'invoices', invoiceId));
      toast({ title: 'Invoice Deleted', description: 'The invoice has been successfully removed.' });
      forceRerender();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete invoice.' });
    }
  };

  const handlePrint = (invoice: Invoice) => {
    // In a real app, this might open a specialized print view
    window.print();
  };

  const isLoading = patientLoading || invoicesLoading;

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin" /></div>;
  }

  if (!patient) {
    return <div className="text-center p-8">Patient not found.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => router.back()}><ChevronLeft /></Button>
          <div>
            <h1 className="text-lg font-semibold">{patient.id.slice(0, 8)} - {patient.name}</h1>
            <p className="text-sm text-muted-foreground">
              {format(new Date(), 'dd/MM/yyyy hh:mm:ss a')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.push(`/invoices/history?id=${patient.id}`)}>View Invoice History</Button>
          <Button onClick={() => router.push(`/invoices/create?id=${patient.id}`)}>Create Invoice</Button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold px-1">From</span>
            <DatePicker date={dateFrom} onDateChange={setDateFrom} />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold px-1">To</span>
            <DatePicker date={dateTo} onDateChange={setDateTo} />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold px-1">Department</span>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Select Department" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                <SelectItem value="opd">OPD</SelectItem>
                <SelectItem value="pharmacy">Pharmacy</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold px-1">Search</span>
            <Input
              placeholder="Search By Description..."
              className="w-64"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SR #</TableHead>
              <TableHead>INVOICE#</TableHead>
              <TableHead>DESCRIPTION</TableHead>
              <TableHead>DEPARTMENT</TableHead>
              <TableHead>TOTAL</TableHead>
              <TableHead>DISCOUNT</TableHead>
              <TableHead>PAID</TableHead>
              <TableHead>DUES</TableHead>
              <TableHead>DEDUCTIONS AGAINST INSURANCE CLAIMS</TableHead>
              <TableHead>TAX DEDUCTIONS AGAINST INSURANCE CLAIMS</TableHead>
              <TableHead>INSURANCE CLAIMS</TableHead>
              <TableHead>ADVANCE</TableHead>
              <TableHead>PAYMENT DATE</TableHead>
              <TableHead>USER</TableHead>
              <TableHead>ACTION</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredInvoices && filteredInvoices.length > 0 ? (
              filteredInvoices.map((invoice, index) => (
                <TableRow key={invoice.id}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>{invoice.id.slice(0, 8)}</TableCell>
                  <TableCell>{invoice.items.map(i => i.procedure).join(', ')}</TableCell>
                  <TableCell>OPD</TableCell>
                  <TableCell>{invoice.grandTotal.toFixed(2)}</TableCell>
                  <TableCell>{invoice.totalDiscount.toFixed(2)}</TableCell>
                  <TableCell>{invoice.amountPaid.toFixed(2)}</TableCell>
                  <TableCell>{invoice.amountDue.toFixed(2)}</TableCell>
                  <TableCell>0.00</TableCell>
                  <TableCell>0.00</TableCell>
                  <TableCell>0.00</TableCell>
                  <TableCell>0.00</TableCell>
                  <TableCell>{format(new Date(invoice.invoiceDate), 'PPpp')}</TableCell>
                  <TableCell>Admin</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => router.push(`/invoices/view?id=${invoice.id}`)}><Eye className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handlePrint(invoice)}><Printer className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon"><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(invoice.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={15} className="h-48 text-center">
                  No invoices found for this patient.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
