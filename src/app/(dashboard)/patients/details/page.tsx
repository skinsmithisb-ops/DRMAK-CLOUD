'use client';
import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
    Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    ChevronLeft, Edit, Calendar as CalendarIcon, Users, HeartPulse, MessageSquare,
    Paperclip, ClipboardList, Receipt, BellPlus, Trash2, Download,
    History, Bell, CheckCircle2, Clock, Loader2, PlusCircle, Phone, FilePlus2, Route
} from 'lucide-react';
import { useDoc, useFirestore, useMemoFirebase, useCollection, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking, useUser } from '@/firebase';
import type { Patient, Doctor, Appointment, MedicalHistory, Communication, PatientComment } from '@/lib/types';
import { doc, collection, query, where, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { DatePicker } from '@/components/DatePicker';
import { Calendar } from '@/components/ui/calendar';
import { format, formatDistanceToNow, isPast, isToday, isTomorrow, differenceInDays, addDays } from 'date-fns';
import { safeDate, safeFormat } from '@/lib/safe-date';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BillingRecord {
    id: string;
    patientMobile: string;
    patientName: string;
    items: { id: string; name: string; type: string; price: number; qty: number }[];
    subTotal: number;
    discount: number;
    grandTotal: number;
    timestamp: string;
    status: string;
}

interface FollowUp {
    id: string;
    patientId: string;
    patientName: string;
    patientMobile: string;
    followUpDate: string;
    reason: string;
    notes: string;
    status: 'Pending' | 'Completed' | 'Cancelled';
    createdAt: string;
    callOutcome?: string;
    calledBy?: string;
    calledByRole?: string;
    remarks?: string;
}

// ─── Follow-up Dialog ─────────────────────────────────────────────────────────

const AddFollowUpDialog = ({ open, onOpenChange, patient }: { open: boolean; onOpenChange: (v: boolean) => void; patient: Patient }) => {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [date, setDate] = React.useState<Date | undefined>(undefined);
    const [reason, setReason] = React.useState('');
    const [notes, setNotes] = React.useState('');
    const [saving, setSaving] = React.useState(false);

    const handleSave = async () => {
        if (!firestore || !date) {
            toast({ variant: 'destructive', title: 'Missing Date', description: 'Please select a follow-up date.' });
            return;
        }
        setSaving(true);
        const followUp: Omit<FollowUp, 'id'> = {
            patientId: patient.id,
            patientName: patient.name,
            patientMobile: patient.mobileNumber,
            followUpDate: date.toISOString(),
            reason,
            notes,
            status: 'Pending',
            createdAt: new Date().toISOString(),
        };
        await addDocumentNonBlocking(collection(firestore, 'followUps'), followUp);
        toast({ title: 'Follow-up Scheduled', description: `Follow-up for ${patient.name} set for ${format(date, 'PPP')}.` });
        setSaving(false);
        setDate(undefined);
        setReason('');
        setNotes('');
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2"><Bell className="h-5 w-5 text-primary" /> Schedule Follow-up</DialogTitle>
                    <DialogDescription>Set a follow-up reminder for <strong>{patient.name}</strong>. Admin will be notified on the follow-up date.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label>Follow-up Date <span className="text-red-500">*</span></Label>
                        <div className="text-sm font-bold text-indigo-600 bg-indigo-50 px-3 py-2 rounded-xl">
                            {date ? format(date, 'PPP') : 'No date selected'}
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            <Button type="button" variant="outline" size="sm" className="rounded-lg text-xs h-7"
                                onClick={() => setDate(new Date())}>Today</Button>
                            <Button type="button" variant="outline" size="sm" className="rounded-lg text-xs h-7"
                                onClick={() => setDate(addDays(new Date(), 1))}>Tomorrow</Button>
                            <Button type="button" variant="outline" size="sm" className="rounded-lg text-xs h-7"
                                onClick={() => setDate(addDays(new Date(), 7))}>+1 Week</Button>
                            <Button type="button" variant="outline" size="sm" className="rounded-lg text-xs h-7"
                                onClick={() => setDate(addDays(new Date(), 30))}>+1 Month</Button>
                        </div>
                        <Calendar
                            mode="single"
                            selected={date}
                            onSelect={(d) => { if (d) setDate(d); }}
                            className="rounded-xl border shadow-sm"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Reason / Purpose</Label>
                        <Input placeholder="e.g., Laser follow-up, Post-treatment check" value={reason} onChange={e => setReason(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Notes (Optional)</Label>
                        <Textarea placeholder="Any additional notes..." value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Schedule Follow-up
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

// ─── Complete Follow-up Dialog ────────────────────────────────────────────────

const CompleteFollowUpDialog = ({ open, onOpenChange, followUp, onComplete, currentUser }: { 
    open: boolean; 
    onOpenChange: (v: boolean) => void; 
    followUp: FollowUp | null;
    onComplete: (id: string, outcome: string, caller: string, remarks: string) => Promise<void>;
    currentUser: any;
}) => {
    const [outcome, setOutcome] = React.useState('');
    const [callerName, setCallerName] = React.useState('');
    const [remarks, setRemarks] = React.useState('');
    const [saving, setSaving] = React.useState(false);

    React.useEffect(() => {
        if (open) {
            setOutcome('');
            setRemarks('');
            setCallerName(currentUser?.name || '');
        }
    }, [open, currentUser]);

    if (!followUp) return null;

    const handleSave = async () => {
        setSaving(true);
        await onComplete(followUp.id, outcome, callerName, remarks);
        setSaving(false);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-green-600" /> Complete Follow-up</DialogTitle>
                    <DialogDescription>Details of the follow-up call for <strong>{followUp.patientName}</strong>.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label>Who Called?</Label>
                            <Input value={callerName} onChange={e => setCallerName(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Role</Label>
                            <Input value={currentUser?.role || ''} disabled className="bg-muted" />
                        </div>
                    </div>
                    
                    <div className="space-y-1.5">
                        <Label>Call Outcome / Patient's Reply <span className="text-red-500">*</span></Label>
                        <Textarea 
                            placeholder="Enter what the patient said..." 
                            value={outcome} 
                            onChange={e => setOutcome(e.target.value)} 
                            rows={3} 
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label>Internal Remarks (Optional)</Label>
                        <Textarea 
                            placeholder="Add any internal notes about this call..." 
                            value={remarks} 
                            onChange={e => setRemarks(e.target.value)} 
                            rows={2} 
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSave} disabled={saving || !outcome.trim() || !callerName.trim()} className="bg-green-600 hover:bg-green-700 text-white">
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Mark as Completed
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

// ─── Add Appointment Dialog ───────────────────────────────────────────────────

const AddAppointmentDialog = ({ open, onOpenChange, patient }: { open: boolean; onOpenChange: (v: boolean) => void; patient: Patient }) => {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { data: doctors } = useCollection<Doctor>(useMemoFirebase(() => firestore ? collection(firestore, 'doctors') : null, [firestore]));
    const [date, setDate] = React.useState<Date | undefined>(new Date());
    const [startTime, setStartTime] = React.useState('10:00');
    const [doctorId, setDoctorId] = React.useState('');
    const [procedure, setProcedure] = React.useState('');
    const [comments, setComments] = React.useState('');

    const handleSubmit = async () => {
        if (!firestore || !date || !doctorId) {
            toast({ variant: 'destructive', title: 'Missing Information', description: 'Please select a date and doctor.' });
            return;
        }
        const [h, m] = startTime.split(':').map(Number);
        const dt = new Date(date);
        dt.setHours(h, m);
        await addDocumentNonBlocking(collection(firestore, `patients/${patient.id}/appointments`), {
            patientMobileNumber: patient.mobileNumber, doctorId,
            appointmentDateTime: dt.toISOString(), status: 'Waiting', procedure, comments,
        });
        toast({ title: 'Appointment Scheduled' });
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader><DialogTitle>Add Appointment</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5"><Label>Date</Label><DatePicker date={date} onDateChange={setDate} /></div>
                        <div className="space-y-1.5"><Label>Start Time</Label><Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} /></div>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Doctor</Label>
                        <Select onValueChange={setDoctorId} value={doctorId}>
                            <SelectTrigger><SelectValue placeholder="Select a doctor" /></SelectTrigger>
                            <SelectContent>{doctors?.map(d => <SelectItem key={d.id} value={d.id}>{d.fullName}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5"><Label>Procedure</Label><Input value={procedure} onChange={e => setProcedure(e.target.value)} placeholder="e.g., Laser, Consultation" /></div>
                    <div className="space-y-1.5"><Label>Comments</Label><Textarea value={comments} onChange={e => setComments(e.target.value)} /></div>
                </div>
                <DialogFooter><Button onClick={handleSubmit}>Book Appointment</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

// ─── Follow-up Status Badge ───────────────────────────────────────────────────

function FollowUpBadge({ dateStr }: { dateStr: string }) {
    const date = safeDate(dateStr);
    if (!date) return <Badge variant="outline">Invalid Date</Badge>;
    const overdue = isPast(date) && !isToday(date);
    const today = isToday(date);
    const tomorrow = isTomorrow(date);
    if (overdue) return <Badge variant="destructive">Overdue</Badge>;
    if (today) return <Badge className="bg-orange-500 text-white">Today</Badge>;
    if (tomorrow) return <Badge className="bg-yellow-500 text-white">Tomorrow</Badge>;
    return <Badge variant="secondary">{safeFormat(date, 'dd MMM yyyy')}</Badge>;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PatientDetailsPage() {
  return (
    <React.Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}>
      <PatientDetailsContent />
    </React.Suspense>
  );
}

function PatientDetailsContent() {
    const router = useRouter();
    const { toast } = useToast();
    const searchParams = useSearchParams();
    const patientId = searchParams.get('id');
    const firestore = useFirestore();
    const { user } = useUser();

    const [isAppointmentDialogOpen, setIsAppointmentDialogOpen] = React.useState(false);
    const [isFollowUpDialogOpen, setIsFollowUpDialogOpen] = React.useState(false);
    const [isCompleteFollowUpOpen, setIsCompleteFollowUpOpen] = React.useState(false);
    const [selectedFollowUp, setSelectedFollowUp] = React.useState<FollowUp | null>(null);
    const [newComment, setNewComment] = React.useState('');
    const [isAddingComment, setIsAddingComment] = React.useState(false);

    // Patient
    const patientDocRef = useMemoFirebase(() => firestore && patientId ? doc(firestore, 'patients', patientId) : null, [firestore, patientId]);
    const { data: patient, isLoading: patientLoading } = useDoc<Patient>(patientDocRef);

    // Billing History for this patient
    const billingQuery = useMemoFirebase(() => {
        if (!firestore || !patient) return null;
        return query(collection(firestore, 'billingRecords'), where('patientMobile', '==', patient.mobileNumber), orderBy('timestamp', 'desc'));
    }, [firestore, patient]);
    const { data: billingHistory, isLoading: billingLoading } = useCollection<BillingRecord>(billingQuery);

    // Follow-ups for this patient
    const followUpsQuery = useMemoFirebase(() => {
        if (!firestore || !patientId) return null;
        return query(collection(firestore, 'followUps'), where('patientId', '==', patientId), orderBy('followUpDate', 'asc'));
    }, [firestore, patientId]);
    const { data: followUps, isLoading: followUpsLoading } = useCollection<FollowUp>(followUpsQuery);

    // Communications
    const communicationsQuery = useMemoFirebase(() => {
        if (!firestore || !patientId) return null;
        return query(collection(firestore, `patients/${patientId}/communications`), orderBy('sentAt', 'desc'));
    }, [firestore, patientId]);
    const { data: communications } = useCollection<Communication>(communicationsQuery);

    // Patient Comments
    const commentsQuery = useMemoFirebase(() => {
        if (!firestore || !patientId) return null;
        return query(collection(firestore, `patients/${patientId}/comments`), orderBy('createdAt', 'desc'));
    }, [firestore, patientId]);
    const { data: patientComments, isLoading: commentsLoading } = useCollection<PatientComment>(commentsQuery);

    const stats = React.useMemo(() => {
        const total = billingHistory?.reduce((s, b) => s + b.grandTotal, 0) ?? 0;
        const visits = billingHistory?.length ?? 0;
        const last = billingHistory?.[0];
        const pendingFollowUps = followUps?.filter(f => f.status === 'Pending').length ?? 0;
        const totalComments = patientComments?.length ?? 0;
        return { total, visits, last, pendingFollowUps, totalComments };
    }, [billingHistory, followUps, patientComments]);

    const handleAddComment = async () => {
        if (!firestore || !patientId || !newComment.trim() || !user) return;
        setIsAddingComment(true);
        try {
            const commentObj: Omit<PatientComment, 'id'> = {
                patientId,
                comment: newComment.trim(),
                addedBy: user.name || 'Unknown',
                addedByRole: user.role || 'Guest',
                createdAt: new Date().toISOString(),
            };

            // 1. Add to sub-collection
            await addDocumentNonBlocking(collection(firestore, `patients/${patientId}/comments`), commentObj);

            // 2. Update patient document for list view
            await updateDocumentNonBlocking(doc(firestore, 'patients', patientId), {
                lastComment: newComment.trim(),
                lastCommentDate: new Date().toISOString(),
            });

            setNewComment('');
            toast({ title: 'Comment added successfully' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error adding comment', description: 'Please try again later.' });
        } finally {
            setIsAddingComment(false);
        }
    };

    const handleMarkFollowUpDone = async (id: string, outcome: string, callerName: string, remarks: string) => {
        if (!firestore || !user) return;
        await updateDocumentNonBlocking(doc(firestore, 'followUps', id), { 
            status: 'Completed',
            callOutcome: outcome,
            calledBy: callerName,
            calledByRole: user.role,
            remarks: remarks,
            completedAt: new Date().toISOString(),
        });
        toast({ title: 'Follow-up Completed', description: 'The call outcome has been saved.' });
    };

    const handleDeleteFollowUp = async (id: string) => {
        if (!firestore) return;
        await deleteDocumentNonBlocking(doc(firestore, 'followUps', id));
        toast({ title: 'Follow-up Removed', variant: 'destructive' });
    };

    if (patientLoading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    }
    if (!patient) {
        return (
            <div className="text-center py-12">
                <h2 className="text-2xl font-bold">Patient not found</h2>
                <Button onClick={() => router.back()} className="mt-4"><ChevronLeft className="mr-2 h-4 w-4" /> Go Back</Button>
            </div>
        );
    }

    return (
        <>
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <Button variant="outline" size="icon" onClick={() => router.back()}><ChevronLeft className="h-4 w-4" /></Button>
                <div>
                    <h1 className="text-2xl font-bold">{patient.name}</h1>
                    <p className="text-sm text-muted-foreground">{patient.mobileNumber} · {patient.gender} · Age {patient.age}</p>
                </div>
                <div className="ml-auto flex gap-2">
                    <Button variant="outline" onClick={() => router.push(`/patients/edit?id=${patient.id}`)}><Edit className="mr-2 h-4 w-4" /> Edit</Button>
                    <Button onClick={() => setIsFollowUpDialogOpen(true)}><Bell className="mr-2 h-4 w-4" /> Schedule Follow-up</Button>
                </div>
            </div>

            {/* Stats Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <Card>
                    <CardContent className="pt-4">
                        <p className="text-xs text-muted-foreground">Total Spent</p>
                        <p className="text-2xl font-bold">Rs {stats.total.toLocaleString()}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <p className="text-xs text-muted-foreground">Total Visits</p>
                        <p className="text-2xl font-bold">{stats.visits}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <p className="text-xs text-muted-foreground">Last Visit</p>
                        <p className="text-lg font-bold">{stats.last ? safeFormat(stats.last.timestamp, 'dd MMM yyyy') : '—'}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <p className="text-xs text-muted-foreground">Pending Follow-ups</p>
                        <p className="text-2xl font-bold text-orange-500">{stats.pendingFollowUps}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Main Tabs */}
            <Tabs defaultValue="history" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="history" className="gap-2"><History className="h-4 w-4" /> Visit History</TabsTrigger>
                    <TabsTrigger value="followups" className="gap-2">
                        <Bell className="h-4 w-4" /> Follow-ups
                        {stats.pendingFollowUps > 0 && (
                            <span className="ml-1 bg-orange-500 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">{stats.pendingFollowUps}</span>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="info" className="gap-2"><HeartPulse className="h-4 w-4" /> Patient Info</TabsTrigger>
                    <TabsTrigger value="comms" className="gap-2"><MessageSquare className="h-4 w-4" /> Communications</TabsTrigger>
                    <TabsTrigger value="comments" className="gap-2">
                        <MessageSquare className="h-4 w-4" /> Comments
                        {stats.totalComments > 0 && (
                            <span className="ml-1 bg-primary text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">{stats.totalComments}</span>
                        )}
                    </TabsTrigger>
                </TabsList>

                {/* ── Visit History ─────────────────────────────────────────── */}
                <TabsContent value="history">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><History className="h-5 w-5" /> Billing & Visit History</CardTitle>
                            <CardDescription>All services and treatments received by {patient.name}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {billingLoading ? (
                                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                            ) : !billingHistory || billingHistory.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <Receipt className="h-10 w-10 mx-auto mb-3 opacity-30" />
                                    <p className="font-medium">No visit history yet</p>
                                    <p className="text-xs mt-1">Bills created for this patient will appear here.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {billingHistory.map((bill, idx) => (
                                        <div key={bill.id} className={`rounded-lg border p-4 ${idx === 0 ? 'border-primary/30 bg-primary/5' : ''}`}>
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                                        <Receipt className="h-4 w-4 text-primary" />
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-sm">
                                                            {safeFormat(bill.timestamp, 'EEEE, dd MMMM yyyy')}
                                                            {idx === 0 && <Badge variant="secondary" className="ml-2 text-[10px]">Latest</Badge>}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">{safeFormat(bill.timestamp, 'hh:mm a')} · Invoice #{bill.id.slice(0, 6).toUpperCase()}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-bold">Rs {bill.grandTotal.toLocaleString()}</p>
                                                    {bill.discount > 0 && <p className="text-xs text-green-600">Discount: Rs {bill.discount.toLocaleString()}</p>}
                                                </div>
                                            </div>
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Item</TableHead>
                                                        <TableHead className="text-center">Qty</TableHead>
                                                        <TableHead>Type</TableHead>
                                                        <TableHead className="text-right">Price</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {bill.items.map((item, i) => (
                                                        <TableRow key={i}>
                                                            <TableCell className="font-medium">{item.name}</TableCell>
                                                            <TableCell className="text-center">{item.qty}</TableCell>
                                                            <TableCell><Badge variant="outline" className="text-[10px] capitalize">{item.type}</Badge></TableCell>
                                                            <TableCell className="text-right">Rs {(item.price * item.qty).toLocaleString()}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ── Follow-ups ────────────────────────────────────────────── */}
                <TabsContent value="followups">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" /> Follow-up Schedule</CardTitle>
                                    <CardDescription>Scheduled follow-up reminders for {patient.name}</CardDescription>
                                </div>
                                <Button onClick={() => setIsFollowUpDialogOpen(true)} size="sm">
                                    <PlusCircle className="mr-2 h-4 w-4" /> Add Follow-up
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {followUpsLoading ? (
                                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                            ) : !followUps || followUps.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <Bell className="h-10 w-10 mx-auto mb-3 opacity-30" />
                                    <p className="font-medium">No follow-ups scheduled</p>
                                    <p className="text-xs mt-1">Click "Add Follow-up" to schedule a reminder.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {followUps.map(fu => {
                                        const fuDate = safeDate(fu.followUpDate);
                                        const isFuPast = fuDate ? isPast(fuDate) && !isToday(fuDate) : false;
                                        return (
                                        <div key={fu.id} className={`flex items-start justify-between p-4 rounded-lg border ${fu.status === 'Completed' ? 'opacity-60 bg-muted/40' : isFuPast ? 'border-red-300 bg-red-50 dark:bg-red-950/20' : 'border-orange-200 bg-orange-50 dark:bg-orange-950/20'}`}>
                                            <div className="flex items-start gap-3">
                                                <div className={`h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 ${fu.status === 'Completed' ? 'bg-green-100' : 'bg-orange-100'}`}>
                                                    {fu.status === 'Completed' ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Clock className="h-4 w-4 text-orange-600" />}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        {fu.status === 'Pending' ? <FollowUpBadge dateStr={fu.followUpDate} /> : <Badge variant="outline" className="text-green-600 border-green-300">Completed</Badge>}
                                                        {fu.reason && <span className="text-sm font-medium">{fu.reason}</span>}
                                                    </div>
                                                    {fu.notes && <p className="text-xs text-muted-foreground mt-1"><span className="font-semibold">Notes:</span> {fu.notes}</p>}
                                                    {fu.callOutcome && (
                                                        <div className="mt-2 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-100 dark:border-green-900 shadow-sm">
                                                            <div className="flex items-center justify-between mb-1.5">
                                                                <p className="text-[10px] font-bold text-green-700 dark:text-green-400 uppercase tracking-wider">Call Outcome</p>
                                                                {fu.calledBy && (
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="text-[10px] font-medium text-green-800 dark:text-green-300">{fu.calledBy}</span>
                                                                        <Badge variant="outline" className="text-[9px] h-3.5 px-1 bg-green-100/50 border-green-200 text-green-700">{fu.calledByRole}</Badge>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <p className="text-sm italic text-green-900 dark:text-green-200 leading-relaxed">"{fu.callOutcome}"</p>
                                                            {fu.remarks && (
                                                                <div className="mt-2 pt-2 border-t border-green-200/50">
                                                                    <p className="text-[10px] font-bold text-green-600/70 uppercase mb-0.5">Remarks</p>
                                                                    <p className="text-xs text-green-800/80">{fu.remarks}</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                    <p className="text-xs text-muted-foreground mt-1">Scheduled: {safeFormat(fu.createdAt, 'dd MMM yyyy')}</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-1 flex-shrink-0">
                                                {fu.status === 'Pending' && (user?.role === 'Operations Manager' || user?.role === 'Admin') && (
                                                    <Button size="sm" variant="outline" className="h-8 text-green-600 border-green-300 hover:bg-green-50" onClick={() => {
                                                        setSelectedFollowUp(fu);
                                                        setIsCompleteFollowUpOpen(true);
                                                    }}>
                                                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Done
                                                    </Button>
                                                )}
                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-red-500" onClick={() => handleDeleteFollowUp(fu.id)}>
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                    )})}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ── Patient Info ──────────────────────────────────────────── */}
                <TabsContent value="info">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader><CardTitle className="text-base">Personal Information</CardTitle></CardHeader>
                            <CardContent className="space-y-3 text-sm">
                                <div className="flex justify-between"><span className="text-muted-foreground">Full Name</span><span className="font-medium">{patient.name}</span></div>
                                <Separator />
                                <div className="flex justify-between"><span className="text-muted-foreground">Age</span><span className="font-medium">{patient.age}</span></div>
                                <Separator />
                                <div className="flex justify-between"><span className="text-muted-foreground">Gender</span><span className="font-medium">{patient.gender}</span></div>
                                <Separator />
                                <div className="flex justify-between"><span className="text-muted-foreground">Mobile</span><span className="font-medium">{patient.mobileNumber}</span></div>
                                {(patient as any).email && <><Separator /><div className="flex justify-between"><span className="text-muted-foreground">Email</span><span className="font-medium">{(patient as any).email}</span></div></>}
                                {(patient as any).address && <><Separator /><div className="flex justify-between"><span className="text-muted-foreground">Address</span><span className="font-medium">{(patient as any).address}</span></div></>}
                            </CardContent>
                            <CardFooter>
                                <Button variant="outline" size="sm" onClick={() => router.push(`/patients/edit?id=${patient.id}`)}>
                                    <Edit className="mr-2 h-3.5 w-3.5" /> Edit Profile
                                </Button>
                            </CardFooter>
                        </Card>
                        <Card>
                            <CardHeader><CardTitle className="text-base">Quick Actions</CardTitle></CardHeader>
                            <CardContent className="space-y-2">
                                <Button variant="outline" className="w-full justify-start" onClick={() => setIsAppointmentDialogOpen(true)}>
                                    <Calendar className="mr-2 h-4 w-4 text-blue-500" /> Book Appointment
                                </Button>
                                <Button variant="outline" className="w-full justify-start" onClick={() => setIsFollowUpDialogOpen(true)}>
                                    <Bell className="mr-2 h-4 w-4 text-orange-500" /> Schedule Follow-up
                                </Button>
                                <Button variant="outline" className="w-full justify-start" onClick={() => router.push(`/patients/family-history?id=${patient.id}`)}>
                                    <Users className="mr-2 h-4 w-4 text-purple-500" /> Family History
                                </Button>
                                <Button variant="outline" className="w-full justify-start" onClick={() => router.push(`/health-records?id=${patient.id}`)}>
                                    <HeartPulse className="mr-2 h-4 w-4 text-red-500" /> Health Records
                                </Button>
                                <Button variant="outline" className="w-full justify-start" onClick={() => {
                                    const data = JSON.stringify(patient, null, 2);
                                    const blob = new Blob([data], { type: 'application/json' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url; a.download = `patient_${patient.id}.json`; a.click();
                                    URL.revokeObjectURL(url);
                                    toast({ title: 'Download Started' });
                                }}>
                                    <Download className="mr-2 h-4 w-4" /> Export Patient Data
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* ── Communications ────────────────────────────────────────── */}
                <TabsContent value="comms">
                    <Card>
                        <CardHeader><CardTitle className="text-base flex items-center gap-2"><MessageSquare className="h-5 w-5" /> Communication Log</CardTitle></CardHeader>
                        <CardContent className="space-y-3">
                            {!communications || communications.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-8">No communications recorded yet.</p>
                            ) : (
                                communications.map(c => (
                                    <div key={c.id} className="text-sm border rounded-lg p-3">
                                        <div className="flex justify-between items-center mb-1">
                                            <Badge variant="secondary" className="capitalize">{c.service}</Badge>
                                            <span className="text-xs text-muted-foreground">{safeDate(c.sentAt) ? formatDistanceToNow(safeDate(c.sentAt)!, { addSuffix: true }) : 'N/A'}</span>
                                        </div>
                                        <p className="text-sm bg-muted rounded-md p-2 mt-1">{c.message}</p>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ── Comments ──────────────────────────────────────────────── */}
                <TabsContent value="comments">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2"><MessageSquare className="h-5 w-5" /> Patient Comments History</CardTitle>
                            <CardDescription>Internal notes and comments by managers and admins.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {(user?.role === 'Operations Manager' || user?.isAdmin) && (
                                <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                                    <Label className="text-sm font-semibold">Add New Comment</Label>
                                    <Textarea 
                                        placeholder="Add a comment or note about this patient..." 
                                        value={newComment}
                                        onChange={(e) => setNewComment(e.target.value)}
                                        rows={3}
                                    />
                                    <div className="flex justify-end">
                                        <Button 
                                            size="sm" 
                                            onClick={handleAddComment} 
                                            disabled={isAddingComment || !newComment.trim()}
                                        >
                                            {isAddingComment && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            Post Comment
                                        </Button>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-4">
                                {commentsLoading ? (
                                    <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                                ) : !patientComments || patientComments.length === 0 ? (
                                    <div className="text-center py-12 text-muted-foreground border-t pt-12">
                                        <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-30" />
                                        <p className="font-medium">No comments yet</p>
                                        <p className="text-xs mt-1">Important notes about the patient will appear here.</p>
                                    </div>
                                ) : (
                                    patientComments.map((c) => (
                                        <div key={c.id} className="flex gap-4 p-4 border rounded-lg bg-white dark:bg-zinc-950">
                                            <Avatar className="h-10 w-10 border-2 border-primary/10">
                                                <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">
                                                    {c.addedBy?.charAt(0) || 'U'}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 space-y-1">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <span className="font-bold text-sm">{c.addedBy}</span>
                                                        <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0 h-4">{c.addedByRole}</Badge>
                                                    </div>
                                                    <span className="text-[10px] text-muted-foreground">
                                                        {safeDate(c.createdAt) ? format(safeDate(c.createdAt)!, 'dd MMM yyyy, hh:mm a') : 'N/A'}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
                                                    {c.comment}
                                                </p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <AddAppointmentDialog open={isAppointmentDialogOpen} onOpenChange={setIsAppointmentDialogOpen} patient={patient} />
            <AddFollowUpDialog open={isFollowUpDialogOpen} onOpenChange={setIsFollowUpDialogOpen} patient={patient} />
            <CompleteFollowUpDialog 
                open={isCompleteFollowUpOpen} 
                onOpenChange={setIsCompleteFollowUpOpen} 
                followUp={selectedFollowUp} 
                onComplete={handleMarkFollowUpDone} 
                currentUser={user}
            />
        </>
    );
}
