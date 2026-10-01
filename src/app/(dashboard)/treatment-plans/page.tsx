
'use client';
import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
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
import {
  PlusCircle,
  ClipboardList,
  ChevronLeft,
  MoreHorizontal,
  Loader2,
  Printer,
} from 'lucide-react';
import {
  useCollection,
  useFirestore,
  useMemoFirebase,
  addDocumentNonBlocking,
  updateDocumentNonBlocking,
  deleteDocumentNonBlocking,
  useDoc,
  useUser
} from '@/firebase';
import type { Patient, TreatmentPlan } from '@/lib/types';
import { collection, doc, query, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export default function TreatmentPlanPage() {
  return (
    <React.Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}>
      <TreatmentPlanContent />
    </React.Suspense>
  );
}

function TreatmentPlanContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const patientId = searchParams.get('id');
  const firestore = useFirestore();
  const { user } = useUser();

  const patientDocRef = useMemoFirebase(() => patientId ? doc(firestore, 'patients', patientId) : null, [firestore, patientId]);
  const treatmentPlansQuery = useMemoFirebase(() => patientId ? query(collection(firestore, `patients/${patientId}/treatmentPlans`), orderBy('createdDate', 'desc')) : null, [firestore, patientId]);

  const { data: patient, isLoading: patientLoading } = useDoc<Patient>(patientDocRef);
  const { data: treatmentPlans, isLoading: plansLoading } = useCollection<TreatmentPlan>(treatmentPlansQuery);
  
  const isLoading = patientLoading || plansLoading;

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin" /></div>;
  }
  
  if (!patient) {
     return <div className="text-center p-8">Patient not found.</div>;
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                 <Button variant="ghost" size="icon" onClick={() => router.back()}><ChevronLeft /></Button>
                 <div>
                    <p className="text-sm text-muted-foreground">{patient.id.slice(0, 8)} / {patient.name} / {patient.mobileNumber}</p>
                    <h1 className="text-lg font-semibold">Treatment Plan</h1>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <Button>Create Treatment Plan</Button>
                <Button variant="outline"><Printer className="mr-2 h-4 w-4" /> Print</Button>
            </div>
        </div>
        <Card>
          <CardContent className="pt-6">
            {treatmentPlans && treatmentPlans.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SR #</TableHead>
                    <TableHead>PROCEDURE</TableHead>
                    <TableHead>TOTAL</TableHead>
                    <TableHead>SCHEDULE DATE</TableHead>
                    <TableHead>ADDED BY</TableHead>
                    <TableHead>CREATED DATE</TableHead>
                    <TableHead>MODIFIED DATE</TableHead>
                    <TableHead className="text-right">ACTION</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {treatmentPlans.map((plan, index) => (
                    <TableRow key={plan.id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>{plan.procedure}</TableCell>
                      <TableCell>{plan.total}</TableCell>
                      <TableCell>{format(new Date(plan.scheduleDate), 'PP')}</TableCell>
                      <TableCell>{plan.addedBy}</TableCell>
                      <TableCell>{format(new Date(plan.createdDate), 'PP')}</TableCell>
                      <TableCell>{format(new Date(plan.modifiedDate), 'PP')}</TableCell>
                      <TableCell className="text-right">
                         <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex h-64 flex-col items-center justify-center text-center">
                <ClipboardList className="h-16 w-16 text-muted-foreground" />
                <p className="mt-4 font-semibold">No Record Found.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
