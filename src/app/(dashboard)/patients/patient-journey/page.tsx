'use client';
import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  ChevronLeft,
  Loader2,
  ClipboardList
} from 'lucide-react';
import {
  useCollection,
  useFirestore,
  useMemoFirebase,
  useDoc,
} from '@/firebase';
import type { Patient, Doctor } from '@/lib/types';
import { collection, doc } from 'firebase/firestore';
import { DatePickerWithRange } from '@/components/DatePickerWithRange';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateRange } from 'react-day-picker';
import { startOfMonth } from 'date-fns';

export default function PatientJourneyPage() {
  return (
    <React.Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}>
      <PatientJourneyContent />
    </React.Suspense>
  );
}

function PatientJourneyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const patientId = searchParams.get('id');
  const firestore = useFirestore();
  const [selectedRange, setSelectedRange] = React.useState<DateRange | undefined>({
    from: new Date(),
    to: new Date(),
  });

  const patientDocRef = useMemoFirebase(
    () => (firestore && patientId ? doc(firestore, 'patients', patientId) : null),
    [firestore, patientId]
  );
  
  const doctorsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'doctors') : null, [firestore]);

  const { data: patient, isLoading: patientLoading } = useDoc<Patient>(patientDocRef);
  const { data: doctors, isLoading: doctorsLoading } = useCollection<Doctor>(doctorsQuery);

  const isLoading = patientLoading || doctorsLoading;

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
            <h1 className="text-lg font-semibold">{patient.id.slice(0, 8)} - {patient.name} - Patient Journey</h1>
          </div>
        </div>
      </div>
      
      <div className="flex items-center justify-between gap-4 p-4 border rounded-lg">
        <div className="flex items-center gap-2">
            <DatePickerWithRange date={selectedRange} onDateChange={setSelectedRange} />
            <Select>
                <SelectTrigger className="w-48"><SelectValue placeholder="Select Doctor"/></SelectTrigger>
                <SelectContent>
                    {doctors?.map(d => <SelectItem key={d.id} value={d.id}>{d.fullName}</SelectItem>)}
                </SelectContent>
            </Select>
            <Select>
                <SelectTrigger className="w-48"><SelectValue placeholder="Select Appointment Type"/></SelectTrigger>
                <SelectContent/>
            </Select>
        </div>
      </div>

      <div className="flex h-96 flex-col items-center justify-center text-center border-2 border-dashed rounded-lg">
        <ClipboardList className="h-16 w-16 text-muted-foreground" />
        <p className="mt-4 font-semibold text-muted-foreground">No record found.</p>
      </div>
    </div>
  );
}
