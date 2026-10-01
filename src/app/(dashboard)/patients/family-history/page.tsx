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
} from 'lucide-react';
import {
  useCollection,
  useFirestore,
  useMemoFirebase,
  addDocumentNonBlocking,
  updateDocumentNonBlocking,
  deleteDocumentNonBlocking,
  useDoc
} from '@/firebase';
import type { Patient, FamilyHistory } from '@/lib/types';
import { collection, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';


const FamilyHistoryFormDialog = ({ open, onOpenChange, patientId, familyMember }: { open: boolean, onOpenChange: (open: boolean) => void, patientId: string, familyMember?: FamilyHistory }) => {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [formData, setFormData] = React.useState<Partial<FamilyHistory>>({});

  React.useEffect(() => {
    if (open) {
      if (familyMember) {
        setFormData(familyMember);
      } else {
        setFormData({ patientId });
      }
    }
  }, [familyMember, patientId, open]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleSelectChange = (field: keyof FamilyHistory, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }

  const handleSubmit = async () => {
    if (!firestore || !formData.relativeName || !formData.relationship) {
      toast({ variant: 'destructive', title: 'Missing Information', description: 'Name and Relationship are required.' });
      return;
    }

    const collectionPath = `patients/${patientId}/familyHistory`;
    const historyCollection = collection(firestore, collectionPath);

    if (familyMember?.id) {
      await updateDocumentNonBlocking(doc(historyCollection, familyMember.id), formData);
      toast({ title: 'Record Updated', description: 'Family history has been updated.' });
    } else {
      await addDocumentNonBlocking(historyCollection, formData);
      toast({ title: 'Record Added', description: 'New family history record created.' });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{familyMember ? 'Edit' : 'Add'} Family History</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="relativeName">Name</Label>
            <Input id="relativeName" value={formData.relativeName || ''} onChange={handleChange} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gender">Gender</Label>
            <Select onValueChange={(val) => handleSelectChange('gender', val)} value={formData.gender}>
              <SelectTrigger><SelectValue placeholder="Select Gender" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Male">Male</SelectItem>
                <SelectItem value="Female">Female</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="relationship">Relationship</Label>
            <Input id="relationship" value={formData.relationship || ''} onChange={handleChange} placeholder="e.g., Father, Mother, Sibling" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bloodGroup">Blood Group</Label>
            <Input id="bloodGroup" value={formData.bloodGroup || ''} onChange={handleChange} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="remarks">Remarks</Label>
            <Textarea id="remarks" value={formData.remarks || ''} onChange={handleChange} placeholder="Any relevant medical conditions or notes..." />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit}>{familyMember ? 'Save Changes' : 'Add Record'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};


export default function FamilyHistoryPage() {
  return (
    <React.Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}>
      <FamilyHistoryContent />
    </React.Suspense>
  );
}

function FamilyHistoryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const patientId = searchParams.get('id');
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [selectedMember, setSelectedMember] = React.useState<FamilyHistory | undefined>(undefined);
  const [memberToDelete, setMemberToDelete] = React.useState<FamilyHistory | null>(null);

  const patientDocRef = useMemoFirebase(() => patientId ? doc(firestore, 'patients', patientId) : null, [firestore, patientId]);
  const familyHistoryQuery = useMemoFirebase(() => patientId ? collection(firestore, 'patients', patientId, 'familyHistory') : null, [firestore, patientId]);

  const { data: patient, isLoading: patientLoading } = useDoc<Patient>(patientDocRef);
  const { data: familyHistory, isLoading: historyLoading } = useCollection<FamilyHistory>(familyHistoryQuery);

  const isLoading = patientLoading || historyLoading;

  const handleAdd = () => {
    setSelectedMember(undefined);
    setIsFormOpen(true);
  }

  const handleEdit = (member: FamilyHistory) => {
    setSelectedMember(member);
    setIsFormOpen(true);
  }

  const handleDelete = () => {
    if (!firestore || !patientId || !memberToDelete) return;
    const docRef = doc(firestore, `patients/${patientId}/familyHistory`, memberToDelete.id);
    deleteDocumentNonBlocking(docRef);
    toast({
      variant: 'destructive',
      title: 'Record Deleted',
      description: "The family history record has been removed."
    });
    setMemberToDelete(null);
  }

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
              <p className="text-sm text-muted-foreground">ZENITH-1 / Patient Record / {patient.name} / Family History</p>
              <h1 className="text-lg font-semibold">{patient.id.slice(0, 8)} - {patient.name}</h1>
            </div>
          </div>
          <Button onClick={handleAdd}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add Family History
          </Button>
        </div>
        <Card>
          <CardContent className="pt-6">
            {familyHistory && familyHistory.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>MRN (C)</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Gender</TableHead>
                    <TableHead>Relationship</TableHead>
                    <TableHead>Blood Group</TableHead>
                    <TableHead>Remarks</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {familyHistory.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell>{patientId?.slice(0, 8) || 'N/A'}</TableCell>
                      <TableCell>{member.relativeName}</TableCell>
                      <TableCell>{member.gender}</TableCell>
                      <TableCell>{member.relationship}</TableCell>
                      <TableCell>{member.bloodGroup}</TableCell>
                      <TableCell>{member.remarks}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button aria-haspopup="true" size="icon" variant="ghost">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Toggle menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(member)}>Edit</DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setMemberToDelete(member)}
                              className="text-red-600"
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex h-64 flex-col items-center justify-center text-center">
                <ClipboardList className="h-16 w-16 text-muted-foreground" />
                <p className="mt-4 font-semibold">There is no record to show.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      {patientId && <FamilyHistoryFormDialog open={isFormOpen} onOpenChange={setIsFormOpen} patientId={patientId} familyMember={selectedMember} />}

      <AlertDialog open={!!memberToDelete} onOpenChange={(open) => !open && setMemberToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
