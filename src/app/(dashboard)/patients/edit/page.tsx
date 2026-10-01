'use client';
import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { DatePicker } from '@/components/DatePicker';
import { useDoc, useFirestore, useMemoFirebase, updateDocumentNonBlocking, useCollection } from '@/firebase';
import type { Patient, Doctor } from '@/lib/types';
import { doc, collection } from 'firebase/firestore';
import { Loader2, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { AvatarUpload } from '@/components/profile/AvatarUpload';

export default function PatientEditPage() {
  return (
    <React.Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}>
      <PatientEditContent />
    </React.Suspense>
  );
}

function PatientEditContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const patientId = searchParams.get('id');
  const { toast } = useToast();

  const firestore = useFirestore();

  const patientDocRef = useMemoFirebase(() => {
    if (!firestore || !patientId) return null;
    return doc(firestore, 'patients', patientId);
  }, [firestore, patientId]);

  const doctorsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'doctors') : null, [firestore]);

  const { data: patient, isLoading: patientLoading } = useDoc<Patient>(patientDocRef);
  const { data: doctors, isLoading: doctorsLoading } = useCollection<Doctor>(doctorsQuery);

  const [formData, setFormData] = React.useState<Partial<Patient>>({});
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (patient) {
      setFormData(patient);
    }
  }, [patient]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  }

  const handleSelectChange = (field: keyof Patient, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleRadioChange = (field: keyof Patient, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleDateChange = (field: keyof Patient, date: Date | undefined) => {
    if (date) {
      setFormData(prev => ({ ...prev, [field]: format(date, 'yyyy-MM-dd') }));
    }
  }

  const handleUpdate = async () => {
    if (!patientDocRef) return;
    setIsSaving(true);
    await updateDocumentNonBlocking(patientDocRef, formData);
    setIsSaving(false);
    toast({ title: 'Success', description: 'Patient profile updated.' });
  }

  if (patientLoading || doctorsLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="text-center">
        <h2 className="text-2xl font-bold">Patient not found</h2>
        <p className="text-muted-foreground">The requested patient could not be found.</p>
        <Button onClick={() => router.back()} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft /></Button>
        <h1 className="text-xl font-semibold">
          {patient.id.slice(0, 8)} - {patient.name} - {patient.gender} - {patient.mobileNumber} - Edit Profile
        </h1>
      </div>
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6">
            <div className="space-y-2">
              <Label htmlFor="mrn">MR#</Label>
              <Input id="mrn" value={patient.id.slice(0, 8)} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="salutation">Salutation</Label>
              <Input id="salutation" value={formData.salutation || ''} onChange={handleChange} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={formData.name || ''} onChange={handleChange} />
            </div>
            <div className="space-y-2">
              <Label>Father/Husband's Name</Label>
              <Input value={formData.guardianName || ''} onChange={(e) => setFormData(p => ({ ...p, guardianName: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Country Code</Label>
              <Select defaultValue="+92">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="+92">Pakistan +92</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <div className="flex items-center gap-2">
                <Input className="w-16 bg-muted" value="+92" readOnly />
                <Input value={formData.mobileNumber || ''} disabled />
                <Button variant="outline" size="icon">+</Button>
                <Select defaultValue="parent"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="parent">Parent</SelectItem></SelectContent></Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Gender</Label>
              <RadioGroup value={formData.gender} onValueChange={(val) => handleRadioChange('gender', val)} className="flex gap-4 pt-2">
                <div className="flex items-center space-x-2"><RadioGroupItem value="Male" id="male" /><Label htmlFor="male">Male</Label></div>
                <div className="flex items-center space-x-2"><RadioGroupItem value="Female" id="female" /><Label htmlFor="female">Female</Label></div>
                <div className="flex items-center space-x-2"><RadioGroupItem value="Other" id="other" /><Label htmlFor="other">Other</Label></div>
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label>Age</Label>
              <div className="flex items-center gap-2">
                <Input type="number" placeholder="Years" value={formData.age || ''} onChange={(e) => setFormData(p => ({ ...p, age: Number(e.target.value) }))} />
                <Input type="number" placeholder="Months" />
                <Input type="number" placeholder="Days" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Doctor</Label>
              <Select value={formData.assignedDoctorId} onValueChange={(val) => handleSelectChange('assignedDoctorId', val)}>
                <SelectTrigger><SelectValue placeholder="Select Doctor" /></SelectTrigger>
                <SelectContent>
                  {doctors?.map(d => <SelectItem key={d.id} value={d.id}>{d.fullName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reason For Visit</Label>
              <Input value={formData.reasonForVisit || ''} onChange={(e) => setFormData(p => ({ ...p, reasonForVisit: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Registration Date</Label>
              <DatePicker date={formData.registrationDate ? parseISO(formData.registrationDate) : undefined} onDateChange={(d) => handleDateChange('registrationDate', d)} />
            </div>
            <div className="space-y-2">
              <Label>Referred By</Label>
              <Input value={formData.referredBy || ''} onChange={(e) => setFormData(p => ({ ...p, referredBy: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Marital Status</Label>
              <RadioGroup value={formData.maritalStatus} onValueChange={(val) => handleRadioChange('maritalStatus', val)} className="flex gap-4 pt-2">
                <div className="flex items-center space-x-2"><RadioGroupItem value="Married" id="married" /><Label htmlFor="married">Married</Label></div>
                <div className="flex items-center space-x-2"><RadioGroupItem value="Unmarried" id="unmarried" /><Label htmlFor="unmarried">Unmarried</Label></div>
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(val) => handleSelectChange('status', val)}>
                <SelectTrigger><SelectValue placeholder="Select Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>SMS Preference</Label>
              <RadioGroup value={formData.smsPreference} onValueChange={(val) => handleRadioChange('smsPreference', val)} className="flex gap-4 pt-2">
                <div className="flex items-center space-x-2"><RadioGroupItem value="English" id="english" /><Label htmlFor="english">English</Label></div>
                <div className="flex items-center space-x-2"><RadioGroupItem value="Urdu" id="urdu" /><Label htmlFor="urdu">Urdu</Label></div>
              </RadioGroup>
            </div>
            <div className="flex items-center space-x-2 pt-6">
              <Label htmlFor="deceased">Deceased</Label>
            </div>
            <div className="space-y-4">
              <Label>Profile photo</Label>
              <AvatarUpload
                uid={patient.id}
                firestore={firestore}
                currentPhotoURL={formData.avatarUrl}
                onUploadSuccess={(url) => setFormData(prev => ({ ...prev, avatarUrl: url }))}
              />
            </div>
          </div>
          <div className="flex justify-end mt-8">
            <Button onClick={handleUpdate} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
