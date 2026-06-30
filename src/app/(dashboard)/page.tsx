'use client';
import * as React from 'react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
    Activity,
    ArrowUpRight,
    CalendarCheck,
    Calendar as CalendarIcon,
    CircleDollarSign,
    Users,
    Loader2,
    Clock,
    Target,
    TrendingUp,
    BarChart,
    FileText,
    UserCheck,
    Instagram,
    Facebook,
    Twitter,
    ThumbsUp,
    Share2,
    Video,
    ListTodo,
    Link as LinkIcon,
    Sparkles,
    Building2,
    PlusCircle,
    Hospital,
    ArrowRight,
    ShieldAlert,
    Boxes,
    Download,
    Receipt,
    Users2,
    FileBarChart,
    Zap,
    Trash2,
    Edit3,
    UserPlus,
    MoreVertical,
    Settings2,
    Coins,
    Printer,
    CheckCircle2,
    RefreshCcw
} from 'lucide-react';
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DateRange } from 'react-day-picker';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "@/components/ui/chart"
import { BarChart as RechartsBarChart, XAxis, YAxis, Bar as RechartsBar, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid } from "recharts"

import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

import {
    collection,
    query,
    where,
    orderBy,
    limit,
    doc,
    setDoc,
    deleteDoc,
    getDocs
} from 'firebase/firestore';
import type { Appointment, Patient, Doctor, BillingRecord, Lead, User, DailyPosting, SocialReport, AdminTaskTemplate, SocialReach, SocialSettings, DesignerWork, PharmacyItem, Supplier, SupplierProduct, StockEntry, SocialCost, SocialROAS } from '@/lib/types';
import { useCollection, useFirestore, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, setDocumentNonBlocking, useUser, useDoc } from '@/firebase';
import { useSearch } from '@/context/SearchProvider';
import { add, format, startOfDay, endOfDay, isSameMonth, isSameYear, startOfMonth, startOfYear, isWithinInterval } from 'date-fns';
import { DatePicker } from '@/components/DatePicker';
import { DatePickerWithRange } from '@/components/DatePickerWithRange';
import { DailyTasksWidget } from '@/components/DailyTasksWidget';
import { useAnalyticsData } from '@/hooks/use-analytics-data';
import { useViewMode } from '@/context/ViewModeContext';
import { cn } from '@/lib/utils';
import { UserFormDialog } from '@/components/UserFormDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

type AppointmentStatus = 'Waiting' | 'In Consultation' | 'Completed' | 'Cancelled';

const statusStyles: Record<AppointmentStatus, string> = {
    Waiting: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
    'In Consultation': 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
    Completed: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
    Cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
};


const BookAppointmentDialog = ({ open, onOpenChange, selectedTime, onAppointmentBooked }: { open: boolean, onOpenChange: (open: boolean) => void, selectedTime: Date | null, onAppointmentBooked: () => void }) => {
    const { toast } = useToast();
    const router = useRouter();
    const [step, setStep] = React.useState<'search' | 'add-patient' | 'book'>('search');
    const [mobileNumber, setMobileNumber] = React.useState('');
    const [newName, setNewName] = React.useState('');
    const [existingPatient, setExistingPatient] = React.useState<Patient | null>(null);
    const [doctor, setDoctor] = React.useState<string>('');

    const firestore = useFirestore();

    const patientsRef = useMemoFirebase(() => firestore ? collection(firestore, 'patients') : null, [firestore]);
    const doctorsRef = useMemoFirebase(() => firestore ? collection(firestore, 'doctors') : null, [firestore]);
    const appointmentsRef = useMemoFirebase(() => firestore ? collection(firestore, 'appointments') : null, [firestore]);

    const { data: patients } = useCollection<Patient>(patientsRef);
    const { data: doctors } = useCollection<Doctor>(doctorsRef);

    React.useEffect(() => {
        if (open) {
            setStep('search');
            setMobileNumber('');
            setNewName('');
            setExistingPatient(null);
            setDoctor('');
        }
    }, [open]);

    const handleSearch = () => {
        if (!mobileNumber) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please enter a mobile number.' });
            return;
        }

        // Sanitize search input (keep digits only)
        const sanitizedSearch = mobileNumber.replace(/\D/g, '');

        // Find patient by matching sanitized mobile numbers
        const patient = patients?.find(p => {
            const sanitizedPatientMobile = (p.mobileNumber || '').replace(/\D/g, '');
            return sanitizedPatientMobile === sanitizedSearch;
        });

        if (patient) {
            setExistingPatient(patient);
            setStep('book');
        } else {
            setStep('add-patient');
        }
    };

    const handleSubmit = async () => {
        if (!selectedTime || !doctor) {
            toast({
                variant: 'destructive',
                title: 'Missing Information',
                description: 'Please select a doctor.',
            });
            return;
        }

        let patientMobile = mobileNumber;

        if (step === 'add-patient') {
            if (!newName) {
                toast({ variant: 'destructive', title: 'Error', description: 'Please enter the patient name.' });
                return;
            }
            // Create new patient
            const newPatient: Omit<Patient, 'id'> = {
                name: newName,
                mobileNumber: mobileNumber,
                age: 0,
                gender: 'Other',
                avatarUrl: '',
                registrationDate: new Date().toISOString(),
                status: 'Active'
            };
            if (patientsRef) {
                await addDocumentNonBlocking(patientsRef, newPatient);
            }
        } else if (existingPatient) {
            patientMobile = existingPatient.mobileNumber;
        }

        const newAppointment: Omit<Appointment, 'id'> = {
            patientMobileNumber: patientMobile,
            doctorId: doctor,
            appointmentDateTime: selectedTime.toISOString(),
            status: 'Waiting',
        };

        if (appointmentsRef) {
            addDocumentNonBlocking(appointmentsRef, newAppointment);
        }

        toast({
            title: 'Appointment Booked',
            description: `Appointment successfully scheduled for ${format(selectedTime, 'PPp')}.`,
        });
        onAppointmentBooked();
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>
                        {step === 'search' && "Search Patient"}
                        {step === 'add-patient' && "New Patient Details"}
                        {step === 'book' && "Confirm Appointment"}
                    </DialogTitle>
                    <DialogDescription>
                        {selectedTime ? format(selectedTime, 'MMMM d, h:mm a') : ''}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    {step === 'search' && (
                        <div className="grid gap-2">
                            <Label htmlFor="mobile">Mobile Number</Label>
                            <div className="flex gap-2">
                                <Input
                                    id="mobile"
                                    placeholder="Enter mobile number"
                                    value={mobileNumber}
                                    onChange={(e) => setMobileNumber(e.target.value)}
                                    type="tel"
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                />
                                <Button onClick={handleSearch}>Search</Button>
                            </div>
                        </div>
                    )}

                    {step === 'add-patient' && (
                        <div className="grid gap-2">
                            <div className="text-sm border-l-4 border-amber-500 bg-amber-50 p-3 text-amber-800 mb-2">
                                No patient found with number <strong>{mobileNumber}</strong>. Please enter details.
                            </div>
                            <p className="text-sm text-muted-foreground pb-2">
                                You need to register this patient with their full details before booking an appointment.
                            </p>
                            <div className="flex justify-end gap-2 mt-2">
                                <Button variant="ghost" onClick={() => setStep('search')}>Back</Button>
                                <Button onClick={() => router.push(`/patients?add=${mobileNumber}`)}>Go to Add Patient</Button>
                            </div>
                        </div>
                    )}

                    {step === 'book' && (
                        <div className="grid gap-4">
                            <div className="bg-muted p-3 rounded-md space-y-1">
                                <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Patient Information</p>
                                <p className="font-semibold">{existingPatient?.name || newName}</p>
                                <p className="text-sm text-muted-foreground">{mobileNumber}</p>
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="doctor">Select Doctor</Label>
                                <Select onValueChange={setDoctor} value={doctor}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Chose a doctor" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {doctors?.map(d => (
                                            <SelectItem key={d.id} value={d.id}>{d.fullName}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}
                </div>

                {step === 'book' && (
                    <DialogFooter className="flex gap-2 sm:justify-between">
                        <Button variant="ghost" onClick={() => existingPatient ? setStep('search') : setStep('add-patient')}>Back</Button>
                        <Button onClick={handleSubmit}>Book Appointment</Button>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
};


const DailySchedule = ({ appointments, date, onDateChange }: { appointments: (Appointment & { patient?: Patient, doctor?: Doctor })[], date: Date, onDateChange: (date: Date | undefined) => void }) => {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isBooking, setIsBooking] = React.useState(false);
    const [selectedTime, setSelectedTime] = React.useState<Date | null>(null);
    const [startHour, setStartHour] = React.useState(9);
    const [endHour, setEndHour] = React.useState(17);

    React.useEffect(() => {
        const savedStart = localStorage.getItem('scheduleStartHour');
        const savedEnd = localStorage.getItem('scheduleEndHour');
        if (savedStart) setStartHour(parseInt(savedStart));
        if (savedEnd) setEndHour(parseInt(savedEnd));
    }, []);

    const handleStartHourChange = (val: string) => {
        const hour = parseInt(val);
        setStartHour(hour);
        localStorage.setItem('scheduleStartHour', val);
    };

    const handleEndHourChange = (val: string) => {
        const hour = parseInt(val);
        setEndHour(hour);
        localStorage.setItem('scheduleEndHour', val);
    };

    const timeSlots = React.useMemo(() => {
        const slots = [];
        const start = new Date(date);
        start.setHours(startHour, 0, 0, 0);
        const end = new Date(date);
        end.setHours(endHour, 0, 0, 0);

        let currentTime = start;
        while (currentTime < end) {
            slots.push(new Date(currentTime));
            currentTime = add(currentTime, { minutes: 30 });
        }
        return slots;
    }, [date, startHour, endHour]);

    const appointmentsByTime = React.useMemo(() => {
        const map = new Map<string, (Appointment & { patient?: Patient, doctor?: Doctor })[]>();
        appointments.forEach(apt => {
            const timeKey = format(new Date(apt.appointmentDateTime), 'HH:mm');
            if (!map.has(timeKey)) {
                map.set(timeKey, []);
            }
            map.get(timeKey)?.push(apt);
        })
        return map;
    }, [appointments]);

    const handleSlotClick = (slot: Date) => {
        setSelectedTime(slot);
        setIsBooking(true);
    }

    const handleStatusChange = (appointmentId: string, newStatus: AppointmentStatus) => {
        if (!firestore) return;
        updateDocumentNonBlocking(doc(firestore, 'appointments', appointmentId), { status: newStatus });
        toast({
            title: 'Status Updated',
            description: `Appointment status changed to ${newStatus}.`,
        });
    }

    const forceRerender = () => {
        // Dummy state change to force re-render and re-fetch from useCollection
    }

    return (
        <>
            <Card className="xl:col-span-2">
                <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="grid gap-1">
                        <CardTitle>Daily Schedule</CardTitle>
                        <CardDescription>
                            An overview of appointments. Click a slot to book.
                        </CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground whitespace-nowrap">Start:</span>
                            <Select value={startHour.toString()} onValueChange={handleStartHourChange}>
                                <SelectTrigger className="h-8 w-[80px] text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {Array.from({ length: 24 }).map((_, i) => (
                                        <SelectItem key={i} value={i.toString()}>
                                            {format(new Date().setHours(i, 0), 'h aa')}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground whitespace-nowrap">End:</span>
                            <Select value={endHour.toString()} onValueChange={handleEndHourChange}>
                                <SelectTrigger className="h-8 w-[80px] text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {Array.from({ length: 24 }).map((_, i) => (
                                        <SelectItem key={i} value={i.toString()}>
                                            {format(new Date().setHours(i, 0), 'h aa')}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <DatePicker date={date} onDateChange={onDateChange} />
                    </div>
                </CardHeader>
                <CardContent className="h-[400px] overflow-y-auto px-2 sm:px-4">
                    <div className="relative border-l-2 border-muted ml-6 sm:ml-12 pl-4 pb-4 mt-4">
                        {timeSlots.map(slot => {
                            const timeKey = format(slot, 'HH:mm');
                            const slotAppointments = appointmentsByTime.get(timeKey);

                            return (
                                <div key={timeKey} className="relative group min-h-[48px] py-1">
                                    {/* Time Label - Positioned absolutely to the left of the border */}
                                    <div className="absolute -left-[4.5rem] sm:-left-[5.5rem] top-2 font-medium text-xs text-muted-foreground w-12 sm:w-16 text-right">
                                        {format(slot, 'h:mm')}
                                    </div>
                                    <div className="absolute -left-[5.5rem] sm:-left-[6.5rem] top-5 font-bold text-[0.6rem] text-muted-foreground/60 w-12 sm:w-16 text-right uppercase">
                                        {format(slot, 'a')}
                                    </div>

                                    {/* The Timeline Node Dot */}
                                    <div className={`absolute -left-[21px] top-3 h-2 w-2 rounded-full border-2 border-background ring-2 ${slotAppointments ? 'bg-primary ring-primary/30' : 'bg-muted ring-transparent'}`} />

                                    {/* Content Area */}
                                    <div className="pl-4 sm:pl-6 w-full max-w-2xl">
                                        {slotAppointments ? (
                                            <div className="flex flex-col gap-2">
                                                {slotAppointments.map(apt => (
                                                    <div
                                                        key={apt.id}
                                                        className="relative bg-card text-card-foreground border rounded-lg shadow-sm p-3 hover:shadow-md transition-shadow cursor-default overflow-hidden group/card"
                                                    >
                                                        {/* Status Color Strip */}
                                                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${(statusStyles[apt.status as AppointmentStatus] || 'bg-gray-400').split(' ')[0]}`} />

                                                        <div className="pl-2 flex items-start justify-between">
                                                            <div>
                                                                <p className="font-semibold text-sm">{apt.patient?.name}</p>
                                                                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                                                    <UserCheck className="h-3 w-3" /> Dr. {apt.doctor?.fullName}
                                                                </p>
                                                            </div>
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Badge className={`font-semibold text-[0.65rem] uppercase tracking-wider cursor-pointer hover:opacity-80 transition-opacity ${statusStyles[apt.status as AppointmentStatus] || 'bg-gray-100 text-gray-800'}`}>
                                                                        {apt.status}
                                                                    </Badge>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end">
                                                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleStatusChange(apt.id, 'Waiting'); }}>Waiting</DropdownMenuItem>
                                                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleStatusChange(apt.id, 'In Consultation'); }}>In Consultation</DropdownMenuItem>
                                                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleStatusChange(apt.id, 'Completed'); }}>Completed</DropdownMenuItem>
                                                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleStatusChange(apt.id, 'Cancelled'); }} className="text-red-500">Cancelled</DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            /* Empty State / Hover to Book */
                                            <div
                                                onClick={() => handleSlotClick(slot)}
                                                className="h-10 mt-1 border border-dashed border-transparent rounded-lg flex items-center px-4 transition-all opacity-0 group-hover:opacity-100 group-hover:bg-muted/50 group-hover:border-border cursor-pointer"
                                            >
                                                <span className="text-xs text-muted-foreground font-medium flex items-center gap-2">
                                                    <PlusCircle className="h-3 w-3" /> Click slot to book appointment
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </CardContent>
            </Card>
            <BookAppointmentDialog open={isBooking} onOpenChange={setIsBooking} selectedTime={selectedTime} onAppointmentBooked={forceRerender} />
        </>
    );
};


// ─── Shared Admin View Switcher ──────────────────────────────────────────────

const AdminViewSwitcher = () => {
    const { viewMode, setViewMode } = useViewMode();
    const { user } = useUser();
    
    // Only super users get access to the actual organization or reporting tabs
    const isSuperUser = user?.role === 'Admin' || user?.email === 'admin1@skinsmith.com';

    return (
        <div className="flex items-center gap-1 p-1 bg-white rounded-2xl border border-slate-200 shadow-sm w-fit">
            <Button
                variant={viewMode === 'clinic' ? 'default' : 'ghost'}
                size="sm"
                className={`rounded-xl text-xs font-bold h-9 px-4 transition-all ${viewMode === 'clinic' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-slate-500 hover:text-slate-700'}`}
                onClick={() => setViewMode('clinic')}
            >
                <Hospital className="h-3.5 w-3.5 mr-1.5" />
                Manage SkinSmith
            </Button>
            {isSuperUser && (
                <>
                    <Button
                        variant={viewMode === 'organization' ? 'default' : 'ghost'}
                        size="sm"
                        className={`rounded-xl text-xs font-bold h-9 px-4 transition-all ${viewMode === 'organization' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-slate-500 hover:text-slate-700'}`}
                        onClick={() => setViewMode('organization')}
                    >
                        <Building2 className="h-3.5 w-3.5 mr-1.5" />
                        Organization
                    </Button>
                    <Button
                        variant={viewMode === 'reports' ? 'default' : 'ghost'}
                        size="sm"
                        className={`rounded-xl text-xs font-bold h-9 px-4 transition-all ${viewMode === 'reports' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-slate-500 hover:text-slate-700'}`}
                        onClick={() => setViewMode('reports')}
                    >
                        <FileBarChart className="h-3.5 w-3.5 mr-1.5" />
                        Reports & Analytics
                    </Button>
                </>
            )}
        </div>
    );
};

const OrganizationDashboard = () => {
    const { searchTerm } = useSearch();
    const firestore = useFirestore();
    const { summaryMetrics, isLoading: analyticsLoading } = useAnalyticsData();

    // Fetch aggregated data for Organization
    const usersRef = useMemoFirebase(() => firestore ? collection(firestore, 'users') : null, [firestore]);
    const leadsRef = useMemoFirebase(() => firestore ? collection(firestore, 'leads') : null, [firestore]);
    const tasksRef = useMemoFirebase(() => firestore ? collection(firestore, 'adminTaskTemplates') : null, [firestore]);
    const billingRef = useMemoFirebase(() => firestore ? collection(firestore, 'billingRecords') : null, [firestore]);
    const expensesRef = useMemoFirebase(() => firestore ? collection(firestore, 'expenses') : null, [firestore]);
    const appointmentsRef = useMemoFirebase(() => firestore ? collection(firestore, 'appointments') : null, [firestore]);
    const socialCostsRef = useMemoFirebase(() => firestore ? collection(firestore, 'socialCosts') : null, [firestore]);

    const { data: users, isLoading: usersLoading } = useCollection<User>(usersRef);
    const { data: leads, isLoading: leadsLoading } = useCollection<Lead>(leadsRef);
    const { data: tasks, isLoading: tasksLoading } = useCollection<AdminTaskTemplate>(tasksRef);
    const { data: billingRecords } = useCollection<BillingRecord>(billingRef);
    const { data: allExpenses } = useCollection<any>(expensesRef);
    const { data: appointments } = useCollection<Appointment>(appointmentsRef);
    const { data: allSocialCosts } = useCollection<SocialCost>(socialCostsRef);
    const socialRoasRef = useMemoFirebase(() => firestore ? collection(firestore, 'socialROAS') : null, [firestore]);
    const { data: allSocialROAS } = useCollection<SocialROAS>(socialRoasRef);

    const isLoading = analyticsLoading || usersLoading || leadsLoading || tasksLoading;

    const stats = React.useMemo(() => {
        const today = startOfDay(new Date()).getTime();
        
        let revenue = 0;
        let physicalCashRevenue = 0;
        let onlineCashRevenue = 0;
        
        (billingRecords || []).forEach(r => {
            const dateStr = r.timestamp || r.billingDate;
            if (!dateStr) return;
            const date = new Date(dateStr);
            if (isNaN(date.getTime()) || startOfDay(date).getTime() !== today) return;
            
            const amount = Number(r.grandTotal ?? r.totalAmount ?? ((r.consultationCharges || 0) + (r.procedureCharges || 0) + (r.medicineCharges || 0)));
            revenue += amount;
            
            const method = (r.paymentMethod || 'Cash').trim().toLowerCase();
            if (method.includes('cash')) {
                physicalCashRevenue += amount;
            } else {
                onlineCashRevenue += amount;
            }
        });

        let expenses = 0;
        let physicalCashExpenses = 0;
        let onlineCashExpenses = 0;

        (allExpenses || []).forEach((e: any) => {
            const dateStr = e.timestamp || e.date || e.createdAt;
            if (!dateStr) return;
            const date = new Date(dateStr);
            if (isNaN(date.getTime()) || startOfDay(date).getTime() !== today) return;
            
            const amount = Number(e.amount || 0);
            expenses += amount;
            
            const method = (e.paymentMethod || 'Cash').trim().toLowerCase();
            if (method.includes('cash')) {
                physicalCashExpenses += amount;
            } else {
                onlineCashExpenses += amount;
            }
        });
            
        const dailyAppointments = (appointments || []).filter(a => {
            if (!a.appointmentDateTime) return false;
            const date = new Date(a.appointmentDateTime);
            if (isNaN(date.getTime())) return false;
            return startOfDay(date).getTime() === today;
        });
        const completed = dailyAppointments.filter(a => a.status === 'Completed').length;

        return { 
            revenue, 
            expenses, 
            profit: revenue - expenses, 
            totalAppointments: dailyAppointments.length, 
            completed,
            physicalCash: physicalCashRevenue - physicalCashExpenses,
            onlineCash: onlineCashRevenue - onlineCashExpenses,
            physicalCashRevenue,
            onlineCashRevenue
        };
    }, [billingRecords, allExpenses, appointments]);


    const leadStats = React.useMemo(() => {
        if (!leads) return { total: 0, new: 0, converted: 0, inProgress: 0 };
        return {
            total: leads.length,
            new: leads.filter(l => l.status === 'New Lead').length,
            converted: leads.filter(l => l.status === 'Converted').length,
            inProgress: leads.filter(l => l.status === 'In Progress').length,
        };
    }, [leads]);

    const usersByRole = React.useMemo(() => {
        if (!users) return [];
        const activeStaff = users.filter(u => {
            const status = (u.status || '').trim().toLowerCase();
            return u.email !== 'admin1@skinsmith.com' && 
                (u.name || u.email) &&
                status !== 'deleted' &&
                u.isDeleted !== true &&
                u.active !== false;
        });
        const counts: Record<string, number> = {};
        activeStaff.forEach(u => {
            counts[u.role] = (counts[u.role] || 0) + 1;
        });
        return Object.entries(counts).map(([name, count]) => ({ name, count }));
    }, [users]);

    if (isLoading) {
        return (
            <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="grid flex-1 items-start gap-8 auto-rows-max animate-in fade-in duration-500">
            {/* View Mode Switcher */}
            <AdminViewSwitcher />

            {/* Financial Multi-Pillar Executive Summary */}
            <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-3 lg:grid-cols-5">
                <Card className="border-none bg-emerald-50/50 shadow-xl shadow-emerald-100/20 rounded-[2.5rem] overflow-hidden border border-emerald-100/30">
                    <CardContent className="p-8">
                        <div className="flex items-center justify-between mb-6">
                            <div className="p-4 bg-emerald-600 text-white rounded-2xl shadow-lg shadow-emerald-200"><TrendingUp className="h-6 w-6" /></div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600/60 leading-none">Management Inflow</span>
                        </div>
                        <div className="space-y-1">
                            <div className="text-4xl font-black tracking-tighter text-slate-900 leading-none">
                                Rs {stats.revenue.toLocaleString()}
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                                <p className="text-[10px] font-bold text-emerald-600/80 uppercase tracking-tighter">Gross Collections</p>
                                <div className="h-3 w-[1px] bg-emerald-200"></div>
                                <p className="text-[10px] font-medium text-slate-400">
                                    Cash: {stats.physicalCashRevenue.toLocaleString()} | Online: {stats.onlineCashRevenue.toLocaleString()}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none bg-rose-50/50 shadow-xl shadow-rose-100/20 rounded-[2.5rem] overflow-hidden border border-rose-100/30">
                    <CardContent className="p-8">
                        <div className="flex items-center justify-between mb-6">
                            <div className="p-4 bg-rose-600 text-white rounded-2xl shadow-lg shadow-rose-200"><Receipt className="h-6 w-6" /></div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-rose-600/60 leading-none">Operational Burn</span>
                        </div>
                        <div className="space-y-1">
                            <div className="text-4xl font-black tracking-tighter text-slate-900 leading-none">
                                Rs {stats.expenses.toLocaleString()}
                            </div>
                            <p className="text-xs font-bold text-rose-600/80 uppercase tracking-tighter">Tracked Expenses (Today)</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-none bg-emerald-50/30 shadow-xl shadow-emerald-100/20 rounded-[2.5rem] overflow-hidden border border-emerald-100/30">
                    <CardContent className="p-8">
                        <div className="flex items-center justify-between mb-6">
                            <div className="p-4 bg-emerald-500 text-white rounded-2xl shadow-lg shadow-emerald-200"><Coins className="h-6 w-6" /></div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600/60 leading-none">Physical Cash</span>
                        </div>
                        <div className="space-y-1">
                            <div className="text-4xl font-black tracking-tighter text-slate-900 leading-none">
                                Rs {stats.physicalCash.toLocaleString()}
                            </div>
                            <p className="text-xs font-bold text-emerald-600/80 uppercase tracking-tighter">In-Hand / Safe</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none bg-blue-50/30 shadow-xl shadow-blue-100/20 rounded-[2.5rem] overflow-hidden border border-blue-100/30">
                    <CardContent className="p-8">
                        <div className="flex items-center justify-between mb-6">
                            <div className="p-4 bg-blue-500 text-white rounded-2xl shadow-lg shadow-blue-200"><Activity className="h-6 w-6" /></div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-blue-600/60 leading-none">Online Cash</span>
                        </div>
                        <div className="space-y-1">
                            <div className="text-4xl font-black tracking-tighter text-slate-900 leading-none">
                                Rs {stats.onlineCash.toLocaleString()}
                            </div>
                            <p className="text-xs font-bold text-blue-600/80 uppercase tracking-tighter">Digital Ledger</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none bg-indigo-50/30 shadow-xl shadow-indigo-100/20 rounded-[2.5rem] overflow-hidden border border-indigo-100/30">
                    <CardContent className="p-8">
                        <div className="flex items-center justify-between mb-6">
                            <div className="p-4 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-200"><CircleDollarSign className="h-6 w-6" /></div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600/60 leading-none">Net Position</span>
                        </div>
                        <div className="space-y-1">
                            <div className={`text-4xl font-black tracking-tighter leading-none ${stats.profit >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
                                Rs {stats.profit.toLocaleString()}
                            </div>
                            <p className="text-xs font-bold text-indigo-600/80 uppercase tracking-tighter">Bottom Line</p>
                        </div>
                    </CardContent>
                </Card>
            </div>



            {/* Existing Contextual Metrics */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-gradient-to-br from-white to-slate-50 border-primary/20 rounded-2xl">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400">Total Team</CardTitle>
                        <Users className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black">{users?.length || 0}</div>
                        <p className="text-[10px] text-muted-foreground font-bold">Active Employees</p>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-white to-blue-50 border-blue-200 rounded-2xl">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400">Sales Pipeline</CardTitle>
                        <Target className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black">{leadStats.total}</div>
                        <p className="text-[10px] text-blue-600/80 font-bold">{leadStats.converted} Converted</p>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-white to-indigo-50 border-indigo-200 rounded-2xl">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400">Social Reach</CardTitle>
                        <Share2 className="h-4 w-4 text-indigo-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black">{summaryMetrics.totalReach.toLocaleString()}</div>
                        <p className="text-[10px] text-green-600 font-bold">+{summaryMetrics.reachChange}% MoM</p>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-white to-orange-50 border-orange-200 rounded-2xl">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400">Throughput</CardTitle>
                        <Zap className="h-4 w-4 text-orange-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black">{stats.completed}/{stats.totalAppointments}</div>
                        <p className="text-[10px] text-orange-600/80 font-bold">Appointments Finished</p>
                    </CardContent>
                </Card>
            </div>

            {/* Detailed Analytics */}
            <div className="grid gap-4 md:gap-8 lg:grid-cols-2 xl:grid-cols-3">
                {/* Sales Funnel Chart */}
                <Card className="xl:col-span-2">
                    <CardHeader>
                        <CardTitle>Organization Sales Funnel</CardTitle>
                        <CardDescription>Visualizing lead conversion status across the team.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ChartContainer config={{
                            count: { label: "Leads", color: "hsl(var(--primary))" }
                        }} className="h-full w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <RechartsBarChart data={[
                                    { name: 'New Leads', count: leadStats.new },
                                    { name: 'In Progress', count: leadStats.inProgress },
                                    { name: 'Converted', count: leadStats.converted },
                                ]}>
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <RechartsTooltip content={<ChartTooltipContent />} />
                                    <RechartsBar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                                </RechartsBarChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                    </CardContent>
                </Card>

                {/* Team Composition */}
                <Card>
                    <CardHeader>
                        <CardTitle>Team Composition</CardTitle>
                        <CardDescription>Breakdown by Department</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {usersByRole.map((role) => (
                                <div key={`role-${role.name}`} className="flex items-center gap-4">
                                    <div className="flex-1 space-y-1">
                                        <div className="flex items-center justify-between text-sm font-medium leading-none">
                                            <span>{role.name}</span>
                                            <span>{role.count}</span>
                                        </div>
                                        <Progress value={(role.count / (users?.length || 1)) * 100} className="h-2" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Recent Leads Activity */}
                <Card className="xl:col-span-2">
                    <CardHeader>
                        <CardTitle>Top Leads Activity</CardTitle>
                        <CardDescription>Critical leads needing attention.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Channel</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {leads?.slice(0, 5).map((lead) => (
                                    <TableRow key={lead.id}>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium">{lead.name}</span>
                                                <span className="text-xs text-muted-foreground">{lead.source}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={lead.status === 'Converted' ? 'default' : 'secondary'}>
                                                {lead.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" asChild>
                                                <Link href="/leads">View Details</Link>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {(!leads || leads.length === 0) && (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center py-4 text-muted-foreground">
                                            No recent leads activity.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Social Highlights */}
                <Card>
                    <CardHeader>
                        <CardTitle>Social Reach Trends</CardTitle>
                        <CardDescription>Monthly Growth</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[250px] flex items-center justify-center">
                        <div className="text-center space-y-4">
                            <div className="p-4 bg-primary/10 rounded-full w-fit mx-auto">
                                <TrendingUp className="h-8 w-8 text-primary" />
                            </div>
                            <div className="text-3xl font-bold text-primary">
                                +{summaryMetrics.reachChange}%
                            </div>
                            <p className="text-sm text-muted-foreground px-4">
                                Our social reach has grown significantly this month compared to the previous period.
                            </p>
                            <Button variant="outline" size="sm" asChild>
                                <Link href="/analytics">Full Social Report</Link>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

// ─── Admin Daily Intelligence Boxes ──────────────────────────────────────────

const AdminDailyIntelligence = ({
    billingRecords,
    allExpenses,
    appointments,
    patients,
    prescriptions,
    selectedDate,
    periodMode,
    dateRange,
}: {
    billingRecords: (BillingRecord & { id: string })[];
    allExpenses: any[];
    appointments: (Appointment & { id: string })[];
    patients: (Patient & { id: string })[];
    prescriptions: any[];
    selectedDate?: Date;
    periodMode?: 'day' | 'month' | 'year';
    dateRange?: DateRange;
}) => {
    const [showPatients, setShowPatients] = React.useState(false);
    const [showPurchases, setShowPurchases] = React.useState(false);
    const [showExpenses, setShowExpenses] = React.useState(false);
    const [showPrescriptions, setShowPrescriptions] = React.useState(false);

    const patientsMap = React.useMemo(() => new Map(patients.map(p => [p.mobileNumber, p])), [patients]);

    const dateFilter = React.useCallback((dateStr: string | undefined) => {
        if (!dateStr) return false;
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return false;
        
        if (dateRange?.from && dateRange?.to) {
            return isWithinInterval(d, { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to) });
        }
        
        if (!selectedDate || !periodMode) return true; // Fallback if no filter provided

        if (periodMode === 'day') return startOfDay(d).getTime() === startOfDay(selectedDate).getTime();
        if (periodMode === 'month') return isSameMonth(d, selectedDate) && isSameYear(d, selectedDate);
        if (periodMode === 'year') return isSameYear(d, selectedDate);
        return false;
    }, [selectedDate, periodMode, dateRange]);

    // Today's patients from appointments
    const todayPatients = React.useMemo(() => {
        const filtered = appointments.filter(a => dateFilter(a.appointmentDateTime));
        const uniqueMap = new Map<string, { name: string; mobile: string; status: string; time: string }>();
        filtered.forEach(a => {
            const patient = patientsMap.get(a.patientMobileNumber);
            if (!uniqueMap.has(a.patientMobileNumber)) {
                uniqueMap.set(a.patientMobileNumber, {
                    name: patient?.name || 'Unknown',
                    mobile: a.patientMobileNumber,
                    status: a.status,
                    time: format(new Date(a.appointmentDateTime), 'h:mm a'),
                });
            }
        });
        return Array.from(uniqueMap.values());
    }, [appointments, dateFilter, patientsMap]);

    // Today's billing/purchases
    const todayPurchases = React.useMemo(() => {
        return billingRecords.filter(r => dateFilter(r.timestamp || r.billingDate)).map(r => ({
            id: r.id,
            patientName: r.patientName || 'Walk-in',
            total: Number(r.grandTotal ?? r.totalAmount ?? ((r.consultationCharges || 0) + (r.procedureCharges || 0) + (r.medicineCharges || 0))),
            consultation: r.consultationCharges || 0,
            procedure: r.procedureCharges || 0,
            medicine: r.medicineCharges || 0,
            items: r.items || [],
            time: r.timestamp || r.billingDate ? format(new Date(r.timestamp || r.billingDate || ''), 'h:mm a') : '',
        }));
    }, [billingRecords, dateFilter]);

    const totalPurchases = todayPurchases.reduce((acc, p) => acc + p.total, 0);

    // Today's expenses
    const todayExpenses = React.useMemo(() => {
        return allExpenses.filter((e: any) => dateFilter(e.timestamp || e.date || e.createdAt)).map((e: any) => ({
            id: e.id,
            description: e.description || e.category || 'Misc Expense',
            category: e.category || 'General',
            amount: Number(e.amount || 0),
            time: (e.timestamp || e.date || e.createdAt) ? format(new Date(e.timestamp || e.date || e.createdAt), 'h:mm a') : '',
        }));
    }, [allExpenses, dateFilter]);

    const totalExpenses = todayExpenses.reduce((acc, e) => acc + Number(e.amount || 0), 0);

    // Pending Prescriptions
    const pendingPrescriptions = React.useMemo(() => {
        return (prescriptions || []).filter(p => p.printStatus === 'Pending').map(p => ({
            ...p,
            time: p.createdAt ? format(new Date(p.createdAt), 'h:mm a') : 'N/A'
        }));
    }, [prescriptions]);

    const { physicalCash, onlineCash } = React.useMemo(() => {
        let pRevenue = 0;
        let oRevenue = 0;
        billingRecords.filter(r => dateFilter(r.timestamp || r.billingDate)).forEach(r => {
            const amount = Number(r.grandTotal ?? r.totalAmount ?? ((r.consultationCharges || 0) + (r.procedureCharges || 0) + (r.medicineCharges || 0)));
            const method = (r.paymentMethod || 'Cash').trim().toLowerCase();
            if (method.includes('cash')) pRevenue += amount;
            else oRevenue += amount;
        });

        let pExpenses = 0;
        let oExpenses = 0;
        allExpenses.filter((e: any) => dateFilter(e.timestamp || e.date || e.createdAt)).forEach((e: any) => {
            const amount = Number(e.amount || 0);
            const method = (e.paymentMethod || 'Cash').trim().toLowerCase();
            if (method.includes('cash')) pExpenses += amount;
            else oExpenses += amount;
        });

        return { physicalCash: pRevenue - pExpenses, onlineCash: oRevenue - oExpenses };
    }, [billingRecords, allExpenses, dateFilter]);

    return (
        <>
            <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-3">
                {/* Patients Today */}
                <Card
                    className="border-none bg-gradient-to-br from-sky-50 to-cyan-50/50 shadow-xl shadow-sky-100/20 rounded-[2rem] overflow-hidden group hover:scale-[1.02] transition-all border border-sky-100/30 cursor-pointer"
                    onClick={() => setShowPatients(true)}
                >
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-sky-600 text-white rounded-xl shadow-lg shadow-sky-200"><Users className="h-5 w-5" /></div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-sky-600/60 leading-none">Patient Traffic</span>
                        </div>
                        <div className="space-y-1">
                            <div className="text-3xl font-black tracking-tighter text-slate-900 leading-none">
                                {todayPatients.length}
                            </div>
                            <p className="text-[10px] font-bold text-sky-600/80 uppercase tracking-tighter">
                                Patients Visited Today
                            </p>
                        </div>
                        <div className="mt-3 flex items-center gap-1 text-[10px] font-bold text-sky-500 group-hover:text-sky-700 transition-colors">
                            <span>Click to view details</span>
                            <ArrowRight className="h-3 w-3" />
                        </div>
                    </CardContent>
                </Card>

                {/* Purchases Today */}
                <Card
                    className="border-none bg-gradient-to-br from-amber-50 to-yellow-50/50 shadow-xl shadow-amber-100/20 rounded-[2rem] overflow-hidden group hover:scale-[1.02] transition-all border border-amber-100/30 cursor-pointer"
                    onClick={() => setShowPurchases(true)}
                >
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-amber-600 text-white rounded-xl shadow-lg shadow-amber-200"><Receipt className="h-5 w-5" /></div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-amber-600/60 leading-none">Billing Activity</span>
                        </div>
                        <div className="space-y-1">
                            <div className="text-3xl font-black tracking-tighter text-slate-900 leading-none">
                                Rs {totalPurchases.toLocaleString()}
                            </div>
                            <p className="text-[10px] font-bold text-amber-600/80 uppercase tracking-tighter">
                                {todayPurchases.length} Bills Generated
                            </p>
                        </div>
                        <div className="mt-3 flex items-center gap-1 text-[10px] font-bold text-amber-500 group-hover:text-amber-700 transition-colors">
                            <span>Click to view breakdown</span>
                            <ArrowRight className="h-3 w-3" />
                        </div>
                    </CardContent>
                </Card>

                {/* Expenses Today */}
                <Card
                    className="border-none bg-gradient-to-br from-rose-50 to-pink-50/50 shadow-xl shadow-rose-100/20 rounded-[2rem] overflow-hidden group hover:scale-[1.02] transition-all border border-rose-100/30 cursor-pointer"
                    onClick={() => setShowExpenses(true)}
                >
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-rose-600 text-white rounded-xl shadow-lg shadow-rose-200"><CircleDollarSign className="h-5 w-5" /></div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-rose-600/60 leading-none">Net Position</span>
                        </div>
                        <div className="space-y-1">
                            <div className="text-3xl font-black tracking-tighter text-slate-900 leading-none">
                                Rs {(totalPurchases - totalExpenses).toLocaleString()}
                            </div>
                            <p className="text-[10px] font-bold text-rose-600/80 uppercase tracking-tighter">
                                Cash Handover Required
                            </p>
                        </div>
                        <div className="mt-3 flex items-center gap-1 text-[10px] font-bold text-rose-500 group-hover:text-rose-700 transition-colors">
                            <span>Click to verify daily summary</span>
                            <ArrowRight className="h-3 w-3" />
                        </div>
                    </CardContent>
                </Card>

                {/* Pending Prescriptions */}
                <Card
                    className="border-none bg-gradient-to-br from-indigo-50 to-purple-50/50 shadow-xl shadow-indigo-100/20 rounded-[2rem] overflow-hidden group hover:scale-[1.02] transition-all border border-indigo-100/30 cursor-pointer"
                    onClick={() => setShowPrescriptions(true)}
                >
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-200"><Printer className="h-5 w-5" /></div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600/60 leading-none">Print Queue</span>
                        </div>
                        <div className="space-y-1">
                            <div className="text-3xl font-black tracking-tighter text-slate-900 leading-none">
                                {pendingPrescriptions.length}
                            </div>
                            <p className="text-[10px] font-bold text-indigo-600/80 uppercase tracking-tighter">
                                Pending Prescriptions
                            </p>
                        </div>
                        <div className="mt-3 flex items-center gap-1 text-[10px] font-bold text-indigo-500 group-hover:text-indigo-700 transition-colors">
                            <span>Click to show prescriptions</span>
                            <ArrowRight className="h-3 w-3" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ── Patients Detail Dialog ── */}
            <Dialog open={showPatients} onOpenChange={setShowPatients}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5 text-sky-600" />
                            Today's Patient Traffic
                        </DialogTitle>
                        <DialogDescription>
                            {todayPatients.length} unique patients visited for {dateRange?.from && dateRange?.to ? `${format(dateRange.from, 'PPP')} - ${format(dateRange.to, 'PPP')}` : format(selectedDate || new Date(), 'PPP')}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="mt-4">
                        {todayPatients.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <Users className="h-10 w-10 mx-auto mb-3 opacity-20" />
                                <p className="text-sm">No patients recorded for this period.</p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="font-black text-xs uppercase">#</TableHead>
                                        <TableHead className="font-black text-xs uppercase">Patient</TableHead>
                                        <TableHead className="font-black text-xs uppercase">Mobile</TableHead>
                                        <TableHead className="font-black text-xs uppercase">Time</TableHead>
                                        <TableHead className="font-black text-xs uppercase">Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {todayPatients.map((p, i) => (
                                        <TableRow key={p.mobile}>
                                            <TableCell className="font-bold text-slate-400">{i + 1}</TableCell>
                                            <TableCell className="font-semibold">{p.name}</TableCell>
                                            <TableCell className="text-muted-foreground text-xs">{p.mobile}</TableCell>
                                            <TableCell className="text-xs">{p.time}</TableCell>
                                            <TableCell>
                                                <Badge variant={p.status === 'Completed' ? 'default' : 'secondary'} className="text-[10px]">
                                                    {p.status}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── Purchases Detail Dialog ── */}
            <Dialog open={showPurchases} onOpenChange={setShowPurchases}>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Receipt className="h-5 w-5 text-amber-600" />
                            Today's Billing & Purchases
                        </DialogTitle>
                        <DialogDescription>
                            {todayPurchases.length} bills totalling Rs {totalPurchases.toLocaleString()} for {dateRange?.from && dateRange?.to ? `${format(dateRange.from, 'PPP')} - ${format(dateRange.to, 'PPP')}` : format(selectedDate || new Date(), 'PPP')}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="mt-4">
                        {todayPurchases.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <Receipt className="h-10 w-10 mx-auto mb-3 opacity-20" />
                                <p className="text-sm">No billing records for this period.</p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="font-black text-xs uppercase">#</TableHead>
                                        <TableHead className="font-black text-xs uppercase">Patient</TableHead>
                                        <TableHead className="font-black text-xs uppercase text-right">Consultation</TableHead>
                                        <TableHead className="font-black text-xs uppercase text-right">Procedure</TableHead>
                                        <TableHead className="font-black text-xs uppercase text-right">Medicine</TableHead>
                                        <TableHead className="font-black text-xs uppercase text-right">Total</TableHead>
                                        <TableHead className="font-black text-xs uppercase">Time</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {todayPurchases.map((p, i) => (
                                        <React.Fragment key={p.id}>
                                            <TableRow className="hover:bg-slate-50 transition-colors">
                                                <TableCell className="font-bold text-slate-400">{i + 1}</TableCell>
                                                <TableCell className="font-semibold">{p.patientName}</TableCell>
                                                <TableCell className="text-right text-xs text-slate-500">Rs {p.consultation.toLocaleString()}</TableCell>
                                                <TableCell className="text-right text-xs text-slate-500">Rs {p.procedure.toLocaleString()}</TableCell>
                                                <TableCell className="text-right text-xs text-slate-500">Rs {p.medicine.toLocaleString()}</TableCell>
                                                <TableCell className="text-right font-black text-emerald-600">Rs {p.total.toLocaleString()}</TableCell>
                                                <TableCell className="text-xs text-muted-foreground">{p.time}</TableCell>
                                            </TableRow>
                                            {p.items && p.items.length > 0 && (
                                                <TableRow className="bg-slate-50/50 border-t-0">
                                                    <TableCell colSpan={2} />
                                                    <TableCell colSpan={5} className="py-2">
                                                        <div className="flex flex-wrap gap-2">
                                                            {[...(p.items || [])]
                                                                .sort((a: any, b: any) => (a.name || '').trim().localeCompare((b.name || '').trim(), undefined, { sensitivity: 'base' }))
                                                                .map((item: any, idx: number) => (
                                                                    <Badge key={idx} variant="outline" className="bg-white text-[9px] font-bold border-slate-200">
                                                                        {item.name} {item.qty > 1 ? `(x${item.qty})` : ''}
                                                                    </Badge>
                                                                ))}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </TableBody>
                                <tfoot>
                                    <TableRow className="bg-slate-50 font-black">
                                        <TableCell colSpan={5} className="text-right text-xs uppercase tracking-wider">Grand Total</TableCell>
                                        <TableCell className="text-right text-emerald-700 font-black">Rs {totalPurchases.toLocaleString()}</TableCell>
                                        <TableCell />
                                    </TableRow>
                                </tfoot>
                            </Table>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── Expenses Detail Dialog ── */}
            <Dialog open={showExpenses} onOpenChange={setShowExpenses}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <CircleDollarSign className="h-5 w-5 text-rose-600" />
                            Today's Expenses
                        </DialogTitle>
                        <DialogDescription>
                            {todayExpenses.length} entries totalling Rs {totalExpenses.toLocaleString()} for {dateRange?.from && dateRange?.to ? `${format(dateRange.from, 'PPP')} - ${format(dateRange.to, 'PPP')}` : format(selectedDate || new Date(), 'PPP')}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="mt-4">
                        {todayExpenses.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <CircleDollarSign className="h-10 w-10 mx-auto mb-3 opacity-20" />
                                <p className="text-sm">No expenses recorded for this period.</p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="font-black text-xs uppercase">#</TableHead>
                                        <TableHead className="font-black text-xs uppercase">Description</TableHead>
                                        <TableHead className="font-black text-xs uppercase">Category</TableHead>
                                        <TableHead className="font-black text-xs uppercase text-right">Amount</TableHead>
                                        <TableHead className="font-black text-xs uppercase">Time</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {todayExpenses.map((e, i) => (
                                        <TableRow key={e.id}>
                                            <TableCell className="font-bold text-slate-400">{i + 1}</TableCell>
                                            <TableCell className="font-semibold">{e.description}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="text-[10px]">{e.category}</Badge>
                                            </TableCell>
                                            <TableCell className="text-right font-bold text-rose-600">Rs {e.amount.toLocaleString()}</TableCell>
                                            <TableCell className="text-xs text-muted-foreground">{e.time}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                                <tfoot>
                                    <TableRow className="bg-slate-50 font-black">
                                        <TableCell colSpan={3} className="text-right text-xs uppercase tracking-wider">Total Expenses</TableCell>
                                        <TableCell className="text-right text-rose-700 font-black">Rs {totalExpenses.toLocaleString()}</TableCell>
                                        <TableCell />
                                    </TableRow>
                                </tfoot>
                            </Table>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── Prescriptions Detail Dialog ── */}
            <Dialog open={showPrescriptions} onOpenChange={setShowPrescriptions}>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Printer className="h-5 w-5 text-indigo-600" />
                            Pending Print Queue
                        </DialogTitle>
                        <DialogDescription>
                            {pendingPrescriptions.length} prescriptions waiting to be printed.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="mt-4">
                        {pendingPrescriptions.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <Printer className="h-10 w-10 mx-auto mb-3 opacity-20" />
                                <p className="text-sm">Queue is empty. Great job!</p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="font-black text-xs uppercase">#</TableHead>
                                        <TableHead className="font-black text-xs uppercase">Patient</TableHead>
                                        <TableHead className="font-black text-xs uppercase">Doctor</TableHead>
                                        <TableHead className="font-black text-xs uppercase">Time</TableHead>
                                        <TableHead className="font-black text-xs uppercase text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {pendingPrescriptions.map((p, i) => (
                                        <TableRow key={p.id} className="hover:bg-slate-50 transition-colors">
                                            <TableCell className="font-bold text-slate-400">{i + 1}</TableCell>
                                            <TableCell>
                                                <div className="font-semibold">{p.patientName}</div>
                                                <div className="text-[10px] text-muted-foreground">{p.patientMobile}</div>
                                            </TableCell>
                                            <TableCell className="text-xs font-medium">{p.doctorName}</TableCell>
                                            <TableCell className="text-xs text-muted-foreground">{p.time}</TableCell>
                                            <TableCell className="text-right">
                                                <Button 
                                                    size="sm" 
                                                    className="bg-indigo-600 hover:bg-indigo-700 h-8 px-3 text-xs"
                                                    onClick={() => {
                                                        setShowPrescriptions(false);
                                                        router.push('/print-prescription');
                                                    }}
                                                >
                                                    Show Prescription
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};

const AdminDashboard = () => {
    const { searchTerm } = useSearch();
    const firestore = useFirestore();
    const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(() => new Date());
    const [periodMode, setPeriodMode] = React.useState<'day' | 'month' | 'year' | 'range'>('day');
    const [selectedRange, setSelectedRange] = React.useState<DateRange | undefined>(() => ({
        from: startOfMonth(new Date()),
        to: new Date(),
    }));

    const appointmentsRef = useMemoFirebase(() => firestore ? collection(firestore, 'appointments') : null, [firestore]);
    const doctorsRef = useMemoFirebase(() => firestore ? collection(firestore, 'doctors') : null, [firestore]);
    const patientsRef = useMemoFirebase(() => firestore ? collection(firestore, 'patients') : null, [firestore]);
    const billingRecordsRef = useMemoFirebase(() => firestore ? collection(firestore, 'billingRecords') : null, [firestore]);
    const expensesRef = useMemoFirebase(() => firestore ? collection(firestore, 'expenses') : null, [firestore]);
    const prescriptionsRef = useMemoFirebase(() => firestore ? collection(firestore, 'prescriptions') : null, [firestore]);

    const { data: appointments, isLoading: appointmentsLoading } = useCollection<Appointment>(appointmentsRef);
    const { data: doctors, isLoading: doctorsLoading } = useCollection<Doctor>(doctorsRef);
    const { data: patients, isLoading: patientsLoading } = useCollection<Patient>(patientsRef);
    const { data: billingRecords, isLoading: billingLoading } = useCollection<BillingRecord>(billingRecordsRef);
    const { data: allExpenses, isLoading: expensesLoading } = useCollection<any>(expensesRef);
    const { data: prescriptions, isLoading: prescriptionsLoading } = useCollection<any>(prescriptionsRef);

    const isLoading = appointmentsLoading || doctorsLoading || patientsLoading || billingLoading || expensesLoading || prescriptionsLoading;

    const [isSyncing, setIsSyncing] = React.useState(false);
    const { toast } = useToast();

    const handleDeepSync = async () => {
        if (!firestore) return;
        setIsSyncing(true);
        toast({ title: 'Syncing...', description: 'Performing deep-audit and reconciling all inventory & financial data...' });

        try {
            // 1. Fetch all suppliers
            const suppliersRef = collection(firestore, 'suppliers');
            const suppliersSnapshot = await getDocs(suppliersRef);
            const suppliersList = suppliersSnapshot?.docs.map(d => ({ id: d.id, ...d.data() } as Supplier)) || [];

            // 2. Fetch all pharmacyItems
            const pharmacyRef = collection(firestore, 'pharmacyItems');
            const pharmacySnapshot = await getDocs(pharmacyRef);
            const pharmacyItemsList = pharmacySnapshot?.docs.map(d => ({ id: d.id, ...d.data() } as PharmacyItem)) || [];

            // 3. Fetch all stockEntries
            const stockEntriesRef = collection(firestore, 'stockEntries');
            const entriesSnapshot = await getDocs(stockEntriesRef);
            const stockEntries = entriesSnapshot?.docs.map(d => ({ id: d.id, ...d.data() } as StockEntry)) || [];

            // 4. Fetch all billingRecords
            const billingRecordsRef = collection(firestore, 'billingRecords');
            const billingSnapshot = await getDocs(billingRecordsRef);
            const billingRecordsList = billingSnapshot?.docs.map(d => ({ id: d.id, ...d.data() } as any)) || [];

            let syncCount = 0;
            const supplierUpdates: Record<string, SupplierProduct[]> = {};
            const pharmacyUpdates: Array<{ id: string; data: any }> = [];
            const pharmacyCreates: Array<any> = [];

            const allProductNames = new Set<string>();
            pharmacyItemsList.forEach(pi => allProductNames.add((pi.productName || pi.name || '').trim().toLowerCase()));
            suppliersList.forEach(s => s.products?.forEach(p => allProductNames.add(p.name.trim().toLowerCase())));
            stockEntries.forEach(entry => entry.items?.forEach(item => {
                if (item.itemName) allProductNames.add(item.itemName.trim().toLowerCase());
            }));

            allProductNames.forEach(nameKey => {
                const pi = pharmacyItemsList.find(i => (i.productName || i.name || '').trim().toLowerCase() === nameKey);
                
                let foundSp: SupplierProduct | null = null;
                let foundSup: Supplier | null = null;
                suppliersList.forEach(s => {
                    const p = s.products?.find(product => product.name.trim().toLowerCase() === nameKey);
                    if (p) {
                        foundSp = p;
                        foundSup = s;
                    }
                });

                // Calculate total quantity from stock entries
                const historicalQty = stockEntries.reduce((acc, entry) => {
                    const match = entry.items?.find(item => (item.itemName || '').trim().toLowerCase() === nameKey);
                    return acc + (Number(match?.totalQty) || 0);
                }, 0);

                // Calculate total quantity sold
                const soldQty = billingRecordsList.reduce((acc, record) => {
                    const matches = record.items?.filter((item: any) => 
                        item.type === 'pharmacy' && 
                        (item.name || '').trim().toLowerCase() === nameKey
                    ) || [];
                    const recordSold = matches.reduce((sum: number, item: any) => sum + (Number(item.qty) || 0), 0);
                    return acc + recordSold;
                }, 0);

                const sameNamePis = pharmacyItemsList.filter(i => (i.productName || i.name || '').trim().toLowerCase() === nameKey);
                const piQty = sameNamePis.reduce((sum, i) => sum + Number(i.quantity || 0), 0);
                const currentMax = Math.max(piQty, Number(foundSp?.quantity || 0));

                // Reconcile: if there are stock entries, trust historicalQty - soldQty.
                // Otherwise fallback to currentMax.
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
                        sameNamePis.forEach(item => {
                            pharmacyUpdates.push({ id: item.id, data: { quantity: finalQty, sellingPrice: finalSelling, rack: finalRack } });
                            syncCount++;
                        });
                    }
                } else if (pi && (!foundSp || !foundSup)) {
                    const supplier = suppliersList.find(s => s.id === pi.supplierId || s.name === pi.supplier) || suppliersList[0];
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
                }
            });

            const promises: any[] = [];
            Object.entries(supplierUpdates).forEach(([supId, products]) => promises.push(updateDocumentNonBlocking(doc(firestore, 'suppliers', supId), { products })));
            pharmacyUpdates.forEach(u => promises.push(updateDocumentNonBlocking(doc(firestore, 'pharmacyItems', u.id), u.data)));
            pharmacyCreates.forEach(c => promises.push(setDocumentNonBlocking(doc(firestore, 'pharmacyItems', c.id), c, { merge: true })));

            await Promise.all(promises);
            toast({ title: 'Reconciliation Complete', description: `Successfully reconciled ${syncCount} items with sales and purchase records.` });
        } catch (error: any) {
            console.error('Deep Sync Error:', error);
            toast({ variant: 'destructive', title: 'Sync Failed', description: error.message });
        } finally {
            setIsSyncing(false);
        }
    };

    const enrichedAppointments = React.useMemo(() => {
        if (!appointments || !doctors || !patients) return [];

        const doctorsMap = new Map(doctors.map(d => [d.id, d]));
        const patientsMap = new Map(patients.map(p => [p.mobileNumber, p]));

        let apts = appointments.map(apt => ({
            ...apt,
            doctor: doctorsMap.get(apt.doctorId),
            patient: patientsMap.get(apt.patientMobileNumber),
        }));

        const term = (searchTerm || '').toLowerCase();
        if (term) {
            apts = apts.filter(apt =>
                (apt.patient?.name || '').toLowerCase().includes(term) ||
                (apt.doctor?.fullName || '').toLowerCase().includes(term) ||
                (apt.patient?.mobileNumber || '').toLowerCase().includes(term)
            );
        }
        return apts;

    }, [appointments, doctors, patients, searchTerm]);

    const appointmentsForSelectedDate = React.useMemo(() => {
        if (!selectedDate) return [];
        const selectedDayStart = startOfDay(selectedDate);
        return enrichedAppointments.filter(apt => {
            const aptDate = startOfDay(new Date(apt.appointmentDateTime));
            return aptDate.getTime() === selectedDayStart.getTime();
        });
    }, [enrichedAppointments, selectedDate]);

    const financialMetrics = React.useMemo(() => {
        if (!selectedDate && periodMode !== 'range') return { revenue: 0, expenses: 0, profit: 0, physicalCash: 0, onlineCash: 0 };
        
        const filter = (itemDate: Date) => {
            if (isNaN(itemDate.getTime())) return false;
            if (periodMode === 'day') return startOfDay(itemDate).getTime() === startOfDay(selectedDate!).getTime();
            if (periodMode === 'month') return isSameMonth(itemDate, selectedDate!) && isSameYear(itemDate, selectedDate!);
            if (periodMode === 'year') return isSameYear(itemDate, selectedDate!);
            if (periodMode === 'range' && selectedRange?.from && selectedRange?.to) {
                return isWithinInterval(itemDate, { start: startOfDay(selectedRange.from), end: endOfDay(selectedRange.to) });
            }
            return false;
        };

        let revenue = 0;
        let physicalCashRevenue = 0;
        let onlineCashRevenue = 0;

        (billingRecords || []).forEach(r => {
            const dateStr = r.timestamp || r.billingDate;
            if (!dateStr) return;
            const date = new Date(dateStr);
            if (!filter(date)) return;
            
            const amount = Number(r.grandTotal ?? r.totalAmount ?? ((r.consultationCharges || 0) + (r.procedureCharges || 0) + (r.medicineCharges || 0)));
            revenue += amount;
            
            const method = (r.paymentMethod || 'Cash').trim().toLowerCase();
            if (method.includes('cash')) {
                physicalCashRevenue += amount;
            } else {
                onlineCashRevenue += amount;
            }
        });

        let expenses = 0;
        let physicalCashExpenses = 0;
        let onlineCashExpenses = 0;

        (allExpenses || []).forEach((e: any) => {
            const dateStr = e.timestamp || e.date || e.createdAt;
            if (!dateStr) return;
            const date = new Date(dateStr);
            if (!filter(date)) return;
            
            const amount = Number(e.amount || 0);
            expenses += amount;
            
            const method = (e.paymentMethod || 'Cash').trim().toLowerCase();
            if (method.includes('cash')) {
                physicalCashExpenses += amount;
            } else {
                onlineCashExpenses += amount;
            }
        });

        return { 
            revenue, 
            expenses, 
            profit: revenue - expenses,
            physicalCash: physicalCashRevenue - physicalCashExpenses,
            onlineCash: onlineCashRevenue - onlineCashExpenses
        };
    }, [billingRecords, allExpenses, selectedDate, periodMode]);


    const { todaysPatients, appointmentStats } = React.useMemo(() => {
        if (!appointments || (!selectedDate && periodMode !== 'range')) {
            return { todaysPatients: 0, appointmentStats: { completed: 0, total: 0 } };
        }

        const filteredAppointments = appointments.filter(apt => {
            const aptDate = new Date(apt.appointmentDateTime);
            if (periodMode === 'day') return startOfDay(aptDate).getTime() === startOfDay(selectedDate!).getTime();
            if (periodMode === 'month') return isSameMonth(aptDate, selectedDate!) && isSameYear(aptDate, selectedDate!);
            if (periodMode === 'year') return isSameYear(aptDate, selectedDate!);
            if (periodMode === 'range' && selectedRange?.from && selectedRange?.to) {
                return isWithinInterval(aptDate, { start: startOfDay(selectedRange.from), end: endOfDay(selectedRange.to) });
            }
            return false;
        });

        const total = filteredAppointments.length;
        const completed = filteredAppointments.filter(apt => apt.status === 'Completed').length;
        const uniquePatients = new Set(filteredAppointments.map(a => a.patientMobileNumber)).size;

        return {
            todaysPatients: uniquePatients,
            appointmentStats: { completed, total }
        };
    }, [appointments, selectedDate, periodMode]);

    const activeConsultations = React.useMemo(() => {
        if (!appointments || !selectedDate) return 0;
        return appointments.filter(apt => {
            const aptDate = new Date(apt.appointmentDateTime);
            let isInPeriod = false;
            if (periodMode === 'day') isInPeriod = startOfDay(aptDate).getTime() === startOfDay(selectedDate!).getTime();
            else if (periodMode === 'month') isInPeriod = isSameMonth(aptDate, selectedDate!) && isSameYear(aptDate, selectedDate!);
            else if (periodMode === 'year') isInPeriod = isSameYear(aptDate, selectedDate!);
            else if (periodMode === 'range' && selectedRange?.from && selectedRange?.to) {
                isInPeriod = isWithinInterval(aptDate, { start: startOfDay(selectedRange.from), end: endOfDay(selectedRange.to) });
            }
            return isInPeriod && apt.status === 'In Consultation';
        }).length;
    }, [appointments, selectedDate]);

    const { summaryMetrics, isLoading: analyticsLoading } = useAnalyticsData();

    if (isLoading || analyticsLoading) {
        return (
            <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    const handleDateChange = (date: Date | undefined) => {
        setSelectedDate(date);
    }

    return (
        <div className="grid flex-1 items-start gap-4 md:gap-8 auto-rows-max">
            {/* View Mode Switcher */}
            <AdminViewSwitcher />

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-muted/30 p-4 rounded-xl border border-border/50">
                <div className="space-y-1">
                    <h2 className="text-2xl font-bold tracking-tight">Today's Summary</h2>
                    <p className="text-sm text-muted-foreground">Detailed metrics for your selected period</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button 
                        disabled={isSyncing} 
                        onClick={handleDeepSync}
                        variant="secondary"
                        className="rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold shadow-sm h-10 shrink-0"
                    >
                        {isSyncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCcw className="h-4 w-4 mr-2" />}
                        {isSyncing ? 'Syncing...' : 'Sync Inventory'}
                    </Button>
                    <Tabs value={periodMode} onValueChange={(v: any) => setPeriodMode(v)} className="w-[400px]">
                        <TabsList className="grid w-full grid-cols-4">
                            <TabsTrigger value="day">Day</TabsTrigger>
                            <TabsTrigger value="month">Month</TabsTrigger>
                            <TabsTrigger value="year">Year</TabsTrigger>
                            <TabsTrigger value="range">Range</TabsTrigger>
                        </TabsList>
                    </Tabs>
                    {periodMode === 'day' && <DatePicker date={selectedDate} onDateChange={setSelectedDate} />}
                    {periodMode === 'month' && (
                        <div className="flex gap-2">
                            <Select value={selectedDate?.getMonth().toString()} onValueChange={(v) => {
                                const newDate = new Date(selectedDate || new Date());
                                newDate.setMonth(parseInt(v));
                                setSelectedDate(newDate);
                            }}>
                                <SelectTrigger className="w-[120px]">
                                    <SelectValue placeholder="Month" />
                                </SelectTrigger>
                                <SelectContent>
                                    {Array.from({ length: 12 }).map((_, i) => (
                                        <SelectItem key={i} value={i.toString()}>
                                            {format(new Date(2024, i, 1), 'MMMM')}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={selectedDate?.getFullYear().toString()} onValueChange={(v) => {
                                const newDate = new Date(selectedDate || new Date());
                                newDate.setFullYear(parseInt(v));
                                setSelectedDate(newDate);
                            }}>
                                <SelectTrigger className="w-[100px]">
                                    <SelectValue placeholder="Year" />
                                </SelectTrigger>
                                <SelectContent>
                                    {Array.from({ length: 5 }).map((_, i) => {
                                        const year = new Date().getFullYear() - 2 + i;
                                        return <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                                    })}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    {periodMode === 'year' && (
                        <Select value={selectedDate?.getFullYear().toString()} onValueChange={(v) => {
                            const newDate = new Date(selectedDate || new Date());
                            newDate.setFullYear(parseInt(v));
                            setSelectedDate(newDate);
                        }}>
                            <SelectTrigger className="w-[120px]">
                                <SelectValue placeholder="Year" />
                            </SelectTrigger>
                            <SelectContent>
                                {Array.from({ length: 5 }).map((_, i) => {
                                    const year = new Date().getFullYear() - 2 + i;
                                    return <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                                })}
                            </SelectContent>
                        </Select>
                    )}
                    {periodMode === 'range' && <DatePickerWithRange date={selectedRange} onDateChange={setSelectedRange} />}
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <Card className="border-none bg-emerald-50/50 shadow-sm rounded-2xl overflow-hidden group hover:scale-[1.02] transition-all border border-emerald-100/30">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                            <div className="p-2 bg-emerald-600 text-white rounded-lg"><TrendingUp className="h-4 w-4" /></div>
                            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600/60 leading-none">Gross Revenue</span>
                        </div>
                        <div className="space-y-0.5">
                            <div className="text-2xl font-black tracking-tighter text-slate-900 leading-none">
                                Rs {financialMetrics.revenue.toLocaleString()}
                            </div>
                            <p className="text-[9px] font-bold text-emerald-600/80 uppercase tracking-tighter">
                                Inflow • {periodMode}
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none bg-rose-50/50 shadow-sm rounded-2xl overflow-hidden group hover:scale-[1.02] transition-all border border-rose-100/30">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                            <div className="p-2 bg-rose-600 text-white rounded-lg"><Receipt className="h-4 w-4" /></div>
                            <span className="text-[9px] font-black uppercase tracking-widest text-rose-600/60 leading-none">Total Burn</span>
                        </div>
                        <div className="space-y-0.5">
                            <div className="text-2xl font-black tracking-tighter text-slate-900 leading-none">
                                Rs {financialMetrics.expenses.toLocaleString()}
                            </div>
                            <p className="text-[9px] font-bold text-rose-600/80 uppercase tracking-tighter">
                                Expenses • {periodMode}
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none bg-emerald-50/50 shadow-sm rounded-2xl overflow-hidden group hover:scale-[1.02] transition-all border border-emerald-100/30">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                            <div className="p-2 bg-emerald-500 text-white rounded-lg"><Coins className="h-4 w-4" /></div>
                            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600/60 leading-none">In-Hand Cash</span>
                        </div>
                        <div className="space-y-0.5">
                            <div className="text-2xl font-black tracking-tighter text-slate-900 leading-none">
                                Rs {financialMetrics.physicalCash.toLocaleString()}
                            </div>
                            <p className="text-[9px] font-bold text-emerald-600/80 uppercase tracking-tighter">
                                Physical Balance
                            </p>
                        </div>
                    </CardContent>
                </Card>



                <Card className="border-none bg-indigo-50/50 shadow-sm rounded-2xl overflow-hidden group hover:scale-[1.02] transition-all border border-indigo-100/50">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                            <div className="p-2 bg-indigo-600 text-white rounded-lg"><CircleDollarSign className="h-4 w-4" /></div>
                            <span className="text-[9px] font-black uppercase tracking-widest text-indigo-600/60 leading-none">Net Position</span>
                        </div>
                        <div className="space-y-0.5">
                            <div className={`text-2xl font-black tracking-tighter leading-none ${financialMetrics.profit >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
                                Rs {financialMetrics.profit.toLocaleString()}
                            </div>
                            <p className="text-[9px] font-bold text-indigo-600/80 uppercase tracking-tighter">
                                Final Position
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none bg-slate-50 shadow-sm rounded-2xl overflow-hidden group hover:scale-[1.02] transition-all border border-slate-200/50">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                            <div className="p-2 bg-slate-900 text-white rounded-lg"><Users2 className="h-4 w-4" /></div>
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 leading-none">Performance</span>
                        </div>
                        <div className="space-y-0.5">
                            <div className="text-2xl font-black tracking-tighter text-slate-900 leading-none">
                                {appointmentStats.completed}/{appointmentStats.total}
                            </div>
                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">
                                Appts Finished
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ─── Admin Daily Intelligence Boxes ──────────────────────────── */}
            <AdminDailyIntelligence
                billingRecords={billingRecords || []}
                allExpenses={allExpenses || []}
                appointments={appointments || []}
                patients={patients || []}
                prescriptions={prescriptions || []}
                selectedDate={selectedDate || new Date()}
                periodMode={periodMode === 'range' ? undefined : periodMode}
                dateRange={periodMode === 'range' ? selectedRange : undefined}
            />

            <div className="grid gap-4 md:gap-8 lg:grid-cols-2 xl:grid-cols-3">
                <DailySchedule appointments={appointmentsForSelectedDate} date={selectedDate || new Date()} onDateChange={handleDateChange} />
                <Card>
                    <CardHeader>
                        <CardTitle>Recent Patient Activity</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        {enrichedAppointments.slice(0, 5).map((apt, i) => (
                            <div key={apt.id || i} className="flex items-center gap-4">
                                <Avatar className="h-9 w-9">
                                    <AvatarImage src={apt.patient?.avatarUrl || ""} alt="Avatar" />
                                    <AvatarFallback>{apt.patient?.name?.charAt(0) || "P"}</AvatarFallback>
                                </Avatar>
                                <div className="grid gap-1">
                                    <p className="text-sm font-medium leading-none">
                                        {apt.patient?.name || "Anonymous Patient"}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {apt.status} - {apt.doctor?.fullName || "No Doctor"}
                                    </p>
                                </div>
                                <div className="ml-auto font-medium text-xs">
                                    {format(new Date(apt.appointmentDateTime), 'h:mm a')}
                                </div>
                            </div>
                        ))}
                        {enrichedAppointments.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-4">No recent activity.</p>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0">
                        <CardTitle>Recent Prescriptions</CardTitle>
                        <Button variant="ghost" size="sm" asChild>
                            <Link href="/print-prescription" className="text-xs text-indigo-600 font-bold">View Queue</Link>
                        </Button>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        {prescriptions?.slice(0, 5).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((p: any, i: number) => (
                            <div key={p.id || i} className="flex items-center gap-4">
                                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                                    <FileText className="h-4 w-4" />
                                </div>
                                <div className="grid gap-1">
                                    <p className="text-sm font-medium leading-none">
                                        {p.patientName}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {p.doctorName} - {p.printStatus}
                                    </p>
                                </div>
                                <div className="ml-auto font-medium text-[10px] text-muted-foreground">
                                    {p.createdAt ? format(new Date(p.createdAt), 'h:mm a') : 'N/A'}
                                </div>
                            </div>
                        ))}
                        {(!prescriptions || prescriptions.length === 0) && (
                            <p className="text-sm text-muted-foreground text-center py-4">No prescriptions found.</p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

const SalesDashboard = () => {
    const firestore = useFirestore();
    const { user } = useUser();
    const userId = user?.id;
    const leadsQuery = useMemoFirebase(() => {
        if (!firestore || !userId) return null;
        return query(collection(firestore, 'leads'), where('assignedTo', '==', userId));
    }, [firestore, userId]);

    const { data: leads, isLoading } = useCollection<Lead>(leadsQuery);
    const { summaryMetrics, isLoading: analyticsLoading } = useAnalyticsData();

    const stats = React.useMemo(() => {
        if (!leads) return { total: 0, new: 0, converted: 0, rate: '0.0' };
        const total = leads.length;
        const newLeads = leads.filter(l => l.status === 'New Lead').length;
        const converted = leads.filter(l => l.status === 'Converted').length;
        const rate = total > 0 ? ((converted / total) * 100).toFixed(1) : '0.0';
        return { total, new: newLeads, converted, rate };
    }, [leads]);

    const leadsBySource = React.useMemo(() => {
        if (!leads) return [];
        const sources: Record<string, number> = {};
        leads.forEach(l => {
            sources[l.source] = (sources[l.source] || 0) + 1;
        });
        return Object.entries(sources)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);
    }, [leads]);

    const chartConfig = {
        count: {
            label: "Leads",
            color: "hsl(var(--chart-1))",
        },
    } satisfies React.ComponentProps<typeof ChartContainer>["config"]

    if (isLoading || analyticsLoading) {
        return (
            <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="grid flex-1 items-start gap-4 md:gap-8 auto-rows-max">
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-5">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.total}</div>
                        <p className="text-xs text-muted-foreground">Total records</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">New Leads</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">+{stats.new}</div>
                        <p className="text-xs text-muted-foreground">New leads this period</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Converted Leads</CardTitle>
                        <Target className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.converted}</div>
                        <p className="text-xs text-muted-foreground">Successfully closed</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Social Reach</CardTitle>
                        <Share2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{summaryMetrics.totalReach.toLocaleString()}</div>
                        <p className={`text-xs ${summaryMetrics.reachChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {summaryMetrics.reachChange >= 0 ? '+' : ''}{summaryMetrics.reachChange}% from last month
                        </p>
                    </CardContent>
                </Card>
            </div>
            <div className="grid gap-4 md:gap-8 lg:grid-cols-2 xl:grid-cols-3">
                <Card className="xl:col-span-2">
                    <CardHeader>
                        <CardTitle>Recent Leads</CardTitle>
                        <CardDescription>A list of your most recent sales leads.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Lead</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Source</TableHead>
                                    <TableHead className="text-right">Date</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {leads?.slice(0, 5).map((lead) => (
                                    <TableRow key={lead.id}>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium">{lead.name}</span>
                                                <span className="text-xs text-muted-foreground">{lead.email || lead.phone}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={lead.status === 'Converted' ? 'default' : 'secondary'}>
                                                {lead.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{lead.source}</TableCell>
                                        <TableCell className="text-right text-xs">
                                            {lead.createdAt ? format(new Date(lead.createdAt), 'MMM dd') : 'N/A'}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {(!leads || leads.length === 0) && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center">No leads to show.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Leads by Source</CardTitle>
                        <CardDescription>A breakdown of where your leads are coming from.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
                            <RechartsBarChart accessibilityLayer data={leadsBySource} layout="vertical" margin={{ left: 10, right: 30 }}>
                                <XAxis type="number" dataKey="count" hide />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    tickLine={false}
                                    tickMargin={10}
                                    axisLine={false}
                                    tickFormatter={(value) => value.slice(0, 15)}
                                />
                                <RechartsTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
                                <RechartsBar dataKey="count" layout="vertical" fill="var(--color-count)" radius={4} />
                            </RechartsBarChart>
                        </ChartContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

const DoctorDashboard = () => {
    const firestore = useFirestore();
    const { user } = useUser();
    const router = useRouter();

    const [todayStr, setTodayStr] = React.useState('');

    React.useEffect(() => {
        setTodayStr(format(new Date(), 'yyyy-MM-dd'));
    }, []);

    const doctorsRef = useMemoFirebase(() => firestore ? collection(firestore, 'doctors') : null, [firestore]);
    const { data: doctors } = useCollection<Doctor>(doctorsRef);

    const userDoctorId = user?.doctorId;
    const userIdForDoctor = user?.id;
    const userNameForDoctor = user?.name;
    const appointmentsQuery = useMemoFirebase(() => {
        if (!firestore || !userIdForDoctor) return null;

        let targetDoctorId = userDoctorId || userIdForDoctor;

        // Auto-resolve if user.doctorId is missing but we can match by name
        if (!userDoctorId && doctors && userNameForDoctor) {
            const normalizedUserName = userNameForDoctor.toLowerCase().replace(/^dr\.?\s+/g, '').trim();
            const matchedDoctor = doctors.find(d => {
                if (!d.fullName) return false;
                const normalizedDocName = d.fullName.toLowerCase().replace(/^dr\.?\s+/g, '').trim();
                return normalizedDocName === normalizedUserName ||
                       normalizedDocName.includes(normalizedUserName) ||
                       normalizedUserName.includes(normalizedDocName);
            });

            if (matchedDoctor) {
                targetDoctorId = matchedDoctor.id;
            }
        }

        // Return a query that fetches TODAY'S appointments for this doctor
        // We'll fetch all and filter in memory to avoid complex index requirements for now
        // but ensure we are targeting the right doctor.
        return query(
            collection(firestore, 'appointments'),
            where('doctorId', '==', targetDoctorId)
        );
    }, [firestore, userIdForDoctor, userDoctorId, userNameForDoctor, doctors]);

    const { data: rawAppointments, isLoading: appointmentsLoading } = useCollection<Appointment>(appointmentsQuery);

    const patientsRef = useMemoFirebase(() => firestore ? collection(firestore, 'patients') : null, [firestore]);
    const { data: patients, isLoading: patientsLoading } = useCollection<Patient>(patientsRef);

    const enrichedAppointments = React.useMemo(() => {
        if (!rawAppointments || !patients) return [];
        const today = startOfDay(new Date());

        return rawAppointments
            .filter(apt => {
                const aptDate = startOfDay(new Date(apt.appointmentDateTime));
                return aptDate.getTime() === today.getTime();
            })
            .map(apt => ({
                ...apt,
                patient: patients.find(p => p.mobileNumber === apt.patientMobileNumber)
            }))
            .sort((a, b) => new Date(a.appointmentDateTime).getTime() - new Date(b.appointmentDateTime).getTime());
    }, [rawAppointments, patients]);

    const stats = React.useMemo(() => {
        const total = enrichedAppointments.length;
        const completed = enrichedAppointments.filter(apt => apt.status === 'Completed').length;
        const waiting = enrichedAppointments.filter(apt => apt.status === 'Waiting').length;
        return { totalAppointments: total, completed, waiting };
    }, [enrichedAppointments]);

    const patientQueue = React.useMemo(() =>
        enrichedAppointments.filter(a => a.status === 'Waiting' || a.status === 'Checked In'),
        [enrichedAppointments]);

    if (appointmentsLoading || patientsLoading) {
        return (
            <div className="flex min-h-[400px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="grid flex-1 items-start gap-4 md:gap-8 auto-rows-max">
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Appointments</CardTitle>
                        <CalendarCheck className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalAppointments}</div>
                        <p className="text-xs text-muted-foreground">Scheduled for today</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Consultations Completed</CardTitle>
                        <UserCheck className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.completed}</div>
                        <p className="text-xs text-muted-foreground">of {stats.totalAppointments} appointments</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Patients Waiting</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.waiting}</div>
                        <p className="text-xs text-muted-foreground">In the queue right now</p>
                    </CardContent>
                </Card>
            </div>
            <div className="grid gap-4 md:gap-8 lg:grid-cols-2 xl:grid-cols-3">
                <Card className="xl:col-span-2">
                    <CardHeader>
                        <CardTitle>Today's Appointments</CardTitle>
                        <CardDescription>A list of your appointments for {format(new Date(), 'MMMM dd, yyyy')}.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Time</TableHead>
                                    <TableHead>Patient</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {enrichedAppointments.map((apt) => (
                                    <TableRow key={apt.id}>
                                        <TableCell className="font-medium">
                                            {format(new Date(apt.appointmentDateTime), 'hh:mm a')}
                                        </TableCell>
                                        <TableCell>
                                            <div>
                                                <p className="font-semibold">{apt.patient?.name || 'Unknown Patient'}</p>
                                                <p className="text-xs text-muted-foreground">{apt.patientMobileNumber}</p>
                                            </div>
                                        </TableCell>
                                        <TableCell><Badge variant={apt.status === 'Completed' ? 'secondary' : 'default'}>{apt.status}</Badge></TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    onClick={() => router.push(apt.patient?.id ? `/patients/details?id=${apt.patient.id}` : `/patients`)}
                                                >
                                                    History
                                                </Button>
                                                {apt.status !== 'Completed' && (
                                                    <Button 
                                                        variant="default" 
                                                        size="sm" 
                                                        className="bg-primary hover:bg-primary/90"
                                                        onClick={() => router.push(`/e-prescription?patientId=${apt.patient?.id || ''}&mobile=${apt.patientMobileNumber}`)}
                                                    >
                                                        Start Consultation
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {enrichedAppointments.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center">No appointments for today.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Patient Queue</CardTitle>
                        <CardDescription>Patients checked in and waiting.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        {patientQueue.length > 0 ? patientQueue.map(apt => (
                            <div key={apt.id} className="flex items-center justify-between p-3 bg-muted rounded-lg border border-transparent hover:border-primary/20 transition-all">
                                <div>
                                    <p className="font-semibold text-sm">{apt.patient?.name || 'Unknown'}</p>
                                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                                        Waiting since {format(new Date(apt.appointmentDateTime), 'hh:mm a')}
                                    </p>
                                </div>
                                <Button 
                                    size="sm" 
                                    className="h-8 text-xs bg-primary hover:bg-primary/90"
                                    onClick={() => router.push(`/e-prescription?patientId=${apt.patient?.id || ''}&mobile=${apt.patientMobileNumber}`)}
                                >
                                    Start Consultation
                                </Button>
                            </div>
                        )) : (
                            <p className="text-sm text-muted-foreground text-center py-8">No patients are currently in the queue.</p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};



const ReportsDashboard = () => {
    const firestore = useFirestore();
    const { summaryMetrics } = useAnalyticsData();
    const [selectedRange, setSelectedRange] = React.useState<DateRange | undefined>({
        from: new Date(),
        to: new Date(),
    });

    const billingRef = useMemoFirebase(() => firestore ? collection(firestore, 'billingRecords') : null, [firestore]);
    const usersRef = useMemoFirebase(() => firestore ? collection(firestore, 'users') : null, [firestore]);
    const appointmentsRef = useMemoFirebase(() => firestore ? collection(firestore, 'appointments') : null, [firestore]);
    const expensesRef = useMemoFirebase(() => firestore ? collection(firestore, 'expenses') : null, [firestore]);
    const patientsRef = useMemoFirebase(() => firestore ? collection(firestore, 'patients') : null, [firestore]);
    const closingsRef = useMemoFirebase(() => firestore ? collection(firestore, 'dailyClosings') : null, [firestore]);
    const dailyReportsRef = useMemoFirebase(() => firestore ? collection(firestore, 'dailyReports') : null, [firestore]);
    const dailyTasksRef = useMemoFirebase(() => firestore ? collection(firestore, 'dailyTasks') : null, [firestore]);
    const designerWorkRef = useMemoFirebase(() => firestore ? collection(firestore, 'designerWork') : null, [firestore]);
    const socialReportsRef = useMemoFirebase(() => firestore ? collection(firestore, 'socialReports') : null, [firestore]);
    const leadsRef = useMemoFirebase(() => firestore ? collection(firestore, 'leads') : null, [firestore]);
    const taskCompletionsRef = useMemoFirebase(() => firestore ? collection(firestore, 'dailyTaskCompletions') : null, [firestore]);
    const taskTemplatesRef = useMemoFirebase(() => firestore ? collection(firestore, 'adminTaskTemplates') : null, [firestore]);

    const { data: billingRecords } = useCollection<BillingRecord>(billingRef);
    const { data: users } = useCollection<User>(usersRef);
    const { data: appointments } = useCollection<Appointment>(appointmentsRef);
    const { data: allExpenses } = useCollection<any>(expensesRef);
    const { data: patients } = useCollection<Patient>(patientsRef);
    const { data: allClosings } = useCollection<any>(closingsRef);
    const { data: allDailyReports } = useCollection<any>(dailyReportsRef);
    const { data: allDailyTasks } = useCollection<any>(dailyTasksRef);
    const { data: allDesignerWork } = useCollection<any>(designerWorkRef);
    const { data: allSocialReports } = useCollection<any>(socialReportsRef);
    const { data: allLeads } = useCollection<any>(leadsRef);
    const { data: allTaskCompletions } = useCollection<any>(taskCompletionsRef);
    const { data: allTaskTemplates } = useCollection<any>(taskTemplatesRef);
    const { toast } = useToast();

    const [viewingEmployeeId, setViewingEmployeeId] = React.useState<string | null>(null);
    const [editingUser, setEditingUser] = React.useState<User | undefined>(undefined);
    const [isFormOpen, setIsFormOpen] = React.useState(false);
    const [userToDelete, setUserToDelete] = React.useState<User | null>(null);
    const [taskToEdit, setTaskToEdit] = React.useState<any>(null);
    const [taskToDelete, setTaskToDelete] = React.useState<any>(null);
    const { user: currentUser } = useUser();
    const [newTaskTitle, setNewTaskTitle] = React.useState('');
    const [isAssigningTask, setIsAssigningTask] = React.useState(false);

    const handleAssignTask = async (employeeId: string) => {
        if (!newTaskTitle.trim() || !firestore || !currentUser) return;
        setIsAssigningTask(true);
        try {
            const newTask = {
                userId: employeeId,
                task: newTaskTitle.trim(),
                title: newTaskTitle.trim(),
                status: 'Pending',
                createdAt: Date.now(),
                assignedBy: currentUser.id,
                assignedByName: currentUser.name || currentUser.email,
                type: 'Admin Assigned',
                dueDate: format(new Date(), 'yyyy-MM-dd')
            };
            await addDocumentNonBlocking(collection(firestore, 'dailyTasks'), newTask);
            toast({
                title: 'Task Assigned',
                description: 'New task has been assigned to the employee.'
            });
            setNewTaskTitle('');
        } catch (e) {
            console.error('Error assigning task:', e);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Failed to assign task.'
            });
        } finally {
            setIsAssigningTask(false);
        }
    };

    const handleUpdateTask = async () => {
        if (!taskToEdit || !firestore) return;
        try {
            await updateDocumentNonBlocking(doc(firestore, 'dailyTasks', taskToEdit.id), {
                task: taskToEdit.title || taskToEdit.task,
                title: taskToEdit.title || taskToEdit.task,
                status: taskToEdit.status
            });
            toast({ title: 'Task Updated', description: 'The task has been successfully modified.' });
            setTaskToEdit(null);
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to update task.' });
        }
    };

    const handleDeleteTaskAction = async () => {
        if (!taskToDelete || !firestore) return;
        try {
            await deleteDoc(doc(firestore, 'dailyTasks', taskToDelete.id));
            toast({ title: 'Task Removed', description: 'The task has been permanently deleted.' });
            setTaskToDelete(null);
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete task.' });
        }
    };

    const handleAddStaff = () => {
        setEditingUser(undefined);
        setIsFormOpen(true);
    };

    const handleEditStaff = (user: any) => {
        // Find the actual user object from the collection
        const actualUser = users?.find(u => u.id === user.id);
        if (actualUser) {
            setEditingUser(actualUser);
            setIsFormOpen(true);
        }
    };

    const handleDeleteStaff = async () => {
        if (!firestore || !userToDelete) return;
        try {
            // Soft delete by setting isDeleted: true
            await updateDocumentNonBlocking(doc(firestore, 'users', userToDelete.id), { 
                isDeleted: true,
                status: 'deleted',
                active: false
            });
            toast({
                title: 'Staff Removed',
                description: `${userToDelete.name || 'User'} has been removed from the system.`
            });
        } catch (e) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Failed to remove staff member.'
            });
        } finally {
            setUserToDelete(null);
        }
    };

    const filteredBilling = React.useMemo(() => {
        const fromDate = selectedRange?.from;
        const toDate = selectedRange?.to || selectedRange?.from;

        if (!billingRecords || !fromDate) return billingRecords || [];
        return billingRecords.filter(b => {
            const dateStr = b.timestamp || b.billingDate;
            if (!dateStr) return false;
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return false;
            return isWithinInterval(date, { 
                start: startOfDay(fromDate), 
                end: endOfDay(toDate!) 
            });
        });
    }, [billingRecords, selectedRange]);

    const filteredExpenses = React.useMemo(() => {
        const fromDate = selectedRange?.from;
        const toDate = selectedRange?.to || selectedRange?.from;

        if (!allExpenses || !fromDate) return allExpenses || [];
        return allExpenses.filter((e: any) => {
            const dateStr = e.timestamp || e.date || e.createdAt;
            if (!dateStr) return false;
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return false;
            return isWithinInterval(date, { 
                start: startOfDay(fromDate), 
                end: endOfDay(toDate!) 
            });
        });
    }, [allExpenses, selectedRange]);

    const filteredAppointments = React.useMemo(() => {
        const fromDate = selectedRange?.from;
        const toDate = selectedRange?.to || selectedRange?.from;

        if (!appointments || !fromDate) return appointments || [];
        return appointments.filter(a => {
            if (!a.appointmentDateTime) return false;
            const date = new Date(a.appointmentDateTime);
            if (isNaN(date.getTime())) return false;
            return isWithinInterval(date, { 
                start: startOfDay(fromDate), 
                end: endOfDay(toDate!) 
            });
        });
    }, [appointments, selectedRange]);

    const filteredClosings = React.useMemo(() => {
        const fromDate = selectedRange?.from;
        const toDate = selectedRange?.to || selectedRange?.from;

        if (!allClosings || !fromDate) return allClosings || [];
        return allClosings.filter((c: any) => {
            if (!c.date) return false;
            const date = new Date(c.date);
            if (isNaN(date.getTime())) return false;
            return isWithinInterval(date, { 
                start: startOfDay(fromDate), 
                end: endOfDay(toDate!) 
            });
        });
    }, [allClosings, selectedRange]);

    const financialStats = React.useMemo(() => {
        const revenue = filteredBilling.reduce((acc, curr) => acc + (curr.grandTotal || curr.totalAmount || ((curr.consultationCharges || 0) + (curr.procedureCharges || 0) + (curr.medicineCharges || 0))), 0);
        const expense = filteredExpenses.reduce((acc: number, curr: any) => acc + (curr.amount || 0), 0);
        const physicalCash = filteredClosings.reduce((acc: number, curr: any) => acc + (curr.cashHandedOver || 0), 0);
        
        return {
            totalRevenue: revenue,
            totalExpense: expense,
            netProfit: revenue - expense,
            physicalCash,
            cashDifference: physicalCash - (revenue - expense),
            consultation: filteredBilling.reduce((acc, curr) => acc + (curr.consultationCharges || 0), 0),
            procedures: filteredBilling.reduce((acc, curr) => acc + (curr.procedureCharges || 0), 0),
            medicines: filteredBilling.reduce((acc, curr) => acc + (curr.medicineCharges || 0), 0),
        };
    }, [filteredBilling, filteredExpenses, filteredClosings]);

    const targetDay = React.useMemo(() => {
        if (selectedRange?.from) return format(selectedRange.from, 'yyyy-MM-dd');
        return format(new Date(), 'yyyy-MM-dd');
    }, [selectedRange]);

    const employeePerformance = React.useMemo(() => {
        if (!users) return [];
        // Filter out system admins and ghost/deleted accounts
        const activeStaff = users.filter(u => {
            const status = (u.status || '').trim().toLowerCase();
            return u.email !== 'admin1@skinsmith.com' && 
                (u.name || u.email) &&
                status !== 'deleted' &&
                u.isDeleted !== true &&
                u.active !== false;
        });

        return activeStaff.map(u => {
            // Clinic: appointment efficiency
            const userAppointments = filteredAppointments?.filter(a => a.doctorId === u.id) || [];
            const completedAppts = userAppointments.filter(a => a.status === 'Completed').length;
            const apptScore = userAppointments.length > 0 ? Math.round((completedAppts / userAppointments.length) * 100) : null;

            // Daily end-of-day reports
            const userReports = (allDailyReports || []).filter((r: any) => r.userId === u.id);
            const socialReports = (allSocialReports || []).filter((r: any) => r.userId === u.id);
            
            const targetReport = userReports.find((r: any) => {
                const d = r.reportDate?.split('T')[0];
                return d === targetDay;
            }) || socialReports.find((r: any) => {
                const d = r.reportDate?.split('T')[0];
                return d === targetDay;
            });

            // Tasks: completion %
            const userTasks = (allDailyTasks || []).filter((t: any) => t.userId === u.id);
            const completedTasks = userTasks.filter((t: any) => t.status === 'Completed').length;
            const taskScore = userTasks.length > 0 ? Math.round((completedTasks / userTasks.length) * 100) : null;

            // Designer: consider work as a "report" too for the status badge
            const designerOutputTarget = (allDesignerWork || []).filter((w: any) => w.userId === u.id && w.date === targetDay).length;
            const hasReportOnTarget = !!targetReport || (u.role === 'Designer' && designerOutputTarget > 0);
            const designerOutputTotal = (allDesignerWork || []).filter((w: any) => w.userId === u.id).length;

            // Usage Analytics (for Ops/Sales/Admin who don't have medical appts)
            const userEmail = (u.email || '').trim().toLowerCase();
            const userId = (u.id || '').trim().toLowerCase();

            // 1. Billing Records handled by the user
            const userBillingToday = (filteredBilling || []).filter((b: any) => {
                const addedBy = (b.addedBy || '').trim().toLowerCase();
                return addedBy === userEmail || addedBy === userId;
            }).length;

            // 2. Expenses logged by the user
            const userExpensesToday = (filteredExpenses || []).filter((e: any) => {
                const addedBy = (e.addedBy || '').trim().toLowerCase();
                return addedBy === userEmail || addedBy === userId;
            }).length;
            // 3. Leads assigned to or handled by the user
            const userLeadsActive = (allLeads || []).filter((l: any) => {
                const isAssigned = l.assignedTo === u.id;
                const createdAt = typeof l.createdAt === 'string' ? l.createdAt : '';
                const isCreatedToday = createdAt.startsWith(targetDay);
                return isAssigned || isCreatedToday;
            }).length;

            // Frequency Score: 0-100 based on dashboard activity (max 10 actions for full bar if no appts)
            const totalActionsToday = userBillingToday + userExpensesToday + userLeadsActive;
            const usageScore = totalActionsToday > 0 ? Math.min(totalActionsToday * 10, 100) : null;

            // Overall productivity score (average of available metrics)
            const scores: number[] = [];
            if (apptScore !== null) scores.push(apptScore);
            if (taskScore !== null) scores.push(taskScore);
            if (usageScore !== null) scores.push(usageScore);
            if (hasReportOnTarget) scores.push(100);
            if (designerOutputTarget > 0) scores.push(Math.min(designerOutputTarget * 33, 100));

            const productivity = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

            return {
                id: u.id,
                name: u.name || u.email?.split('@')[0] || 'Unknown',
                email: u.email || 'N/A',
                role: u.role || 'Staff',
                // Appointments
                appointments: userAppointments.length,
                completedAppts,
                apptScore,
                // Reports
                totalReports: userReports.length,
                hasReportToday: hasReportOnTarget,
                reportSummary: targetReport?.summary || '',
                // Tasks
                totalTasks: userTasks.length,
                completedTasks,
                taskScore,
                // Usage
                totalActionsToday,
                usageScore,
                // Designer
                designerOutputToday: designerOutputTarget,
                designerOutputTotal,
                // Overall
                productivity,
            };
        }).sort((a, b) => b.productivity - a.productivity);
    }, [users, filteredAppointments, allDailyReports, allDailyTasks, allDesignerWork, allSocialReports, allLeads, filteredBilling, filteredExpenses, targetDay]);

    const handleExportXLSX = () => {
        const rows: any[][] = [];
        
        // Header & Summary
        rows.push(['SkinSmith Clinic - Executive Financial Report']);
        rows.push([`Generated On: ${format(new Date(), 'PPPP p')}`]);
        rows.push([`Reporting Period: ${selectedRange?.from ? format(selectedRange.from, 'MMM dd, yyyy') : ''} to ${selectedRange?.to ? format(selectedRange.to, 'MMM dd, yyyy') : ''}`]);
        rows.push([]);
        
        rows.push(['OVERVIEW METRICS']);
        rows.push(['Metric', 'Value', 'Unit']);
        rows.push(['Gross Revenue', financialStats.totalRevenue, 'Rs']);
        rows.push(['Consultation Fees', financialStats.consultation, 'Rs']);
        rows.push(['Procedure Charges', financialStats.procedures, 'Rs']);
        rows.push(['Medicine Sales', financialStats.medicines, 'Rs']);
        rows.push(['Total Operational Burn', financialStats.totalExpense, 'Rs']);
        rows.push(['Net Financial Position (System)', financialStats.netProfit, 'Rs']);
        rows.push(['Physical Cash Handed Over', financialStats.physicalCash, 'Rs']);
        rows.push(['Cash Discrepancy', financialStats.cashDifference, 'Rs']);
        rows.push([]);

        // Billing Table
        rows.push(['DETAILED BILLING RECORDS']);
        rows.push(['Bill ID', 'Patient Name', 'Consultation', 'Procedure', 'Medicine', 'Grand Total', 'Timestamp']);
        filteredBilling.forEach(b => {
            const total = b.grandTotal ?? b.totalAmount ?? ((b.consultationCharges || 0) + (b.procedureCharges || 0) + (b.medicineCharges || 0));
            rows.push([
                b.id || 'N/A',
                b.patientName || 'Walk-in',
                b.consultationCharges || 0,
                b.procedureCharges || 0,
                b.medicineCharges || 0,
                total,
                b.timestamp || b.billingDate ? format(new Date(b.timestamp || b.billingDate || ''), 'MM/dd/yyyy HH:mm') : ''
            ]);
        });
        rows.push([]);

        // Expenses Table
        rows.push(['EXPENSE LOGS']);
        rows.push(['Log ID', 'Description', 'Category', 'Amount', 'Date']);
        filteredExpenses.forEach((e: any) => {
            rows.push([
                e.id || 'N/A',
                e.description || e.category || 'Misc',
                e.category || 'General',
                e.amount || 0,
                e.timestamp || e.date || e.createdAt ? format(new Date(e.timestamp || e.date || e.createdAt), 'MM/dd/yyyy') : ''
            ]);
        });
        rows.push([]);

        // Staff Table
        rows.push(['STAFF PERFORMANCE']);
        rows.push(['Employee', 'Role', 'Appointments Completed', 'Total Targeted', 'Efficiency %']);
        employeePerformance.forEach(emp => {
            rows.push([emp.name, emp.role, emp.completedAppts, emp.appointments, emp.productivity]);
        });

        const ws = XLSX.utils.aoa_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Financial Data");
        
        // Auto-sizing columns roughly
        const wscols = [{wch:15}, {wch:25}, {wch:15}, {wch:15}, {wch:15}, {wch:15}, {wch:20}];
        ws['!cols'] = wscols;

        XLSX.writeFile(wb, `SkinSmith_Report_${format(selectedRange?.from || new Date(), 'yyyyMMdd')}.xlsx`);
    };

    const handleExportPDF = () => {
        const doc = new jsPDF() as any;
        const pageTitle = "SkinSmith Clinic - Executive Report";
        const dateStr = `Period: ${selectedRange?.from ? format(selectedRange.from, 'MMM dd, yyyy') : ''} - ${selectedRange?.to ? format(selectedRange.to, 'MMM dd, yyyy') : ''}`;

        // Header Design
        doc.setFontSize(22);
        doc.setTextColor(79, 70, 229); // Indigo 600
        doc.text(pageTitle, 14, 22);
        
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(dateStr, 14, 30);
        doc.text(`Exported on: ${format(new Date(), 'PPPP p')}`, 14, 35);

        // Summary Boxes representation
        doc.setFillColor(248, 250, 252); // Slate 50
        doc.rect(14, 45, 182, 40, 'F');
        
        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.text("Financial Summary", 20, 55);
        
        doc.setFontSize(10);
        doc.text(`Gross Revenue: Rs ${financialStats.totalRevenue.toLocaleString()}`, 20, 65);
        doc.text(`Total Expenses: Rs ${financialStats.totalExpense.toLocaleString()}`, 20, 75);
        doc.text(`Physical Cash: Rs ${financialStats.physicalCash.toLocaleString()}`, 20, 85);

        doc.setFont("helvetica", "bold");
        doc.text(`Net Position (System): Rs ${financialStats.netProfit.toLocaleString()}`, 120, 70);
        doc.setTextColor(financialStats.cashDifference >= 0 ? 0 : 200, 0, 0);
        doc.text(`Discrepancy: Rs ${financialStats.cashDifference.toLocaleString()}`, 120, 80);
        doc.setTextColor(0);
        doc.setFont("helvetica", "normal");

        // Billing Table
        autoTable(doc, {
            startY: 95,
            head: [['#', 'Patient', 'Consultation', 'Procedure', 'Medicine', 'Total (Rs)']],
            body: filteredBilling.map((b, i) => [
                i + 1,
                b.patientName || 'Walk-in',
                b.consultationCharges || 0,
                b.procedureCharges || 0,
                b.medicineCharges || 0,
                (b.grandTotal ?? b.totalAmount ?? ((b.consultationCharges || 0) + (b.procedureCharges || 0) + (b.medicineCharges || 0))).toLocaleString()
            ]),
            theme: 'grid',
            headStyles: { fillColor: [79, 70, 229], fontSize: 10 },
            styles: { fontSize: 8 },
            margin: { top: 10 }
        });

        doc.addPage();
        doc.text("Expense Details & Staff Productivity", 14, 20);

        // Expenses Table
        autoTable(doc, {
            startY: 30,
            head: [['#', 'Description', 'Category', 'Amount (Rs)', 'Date']],
            body: filteredExpenses.map((e: any, i: number) => [
                i + 1,
                e.description || e.category || 'Misc',
                e.category || 'General',
                e.amount?.toLocaleString() || '0',
                e.timestamp || e.date || e.createdAt ? format(new Date(e.timestamp || e.date || e.createdAt), 'MMM dd, yyyy') : ''
            ]),
            theme: 'striped',
            headStyles: { fillColor: [225, 29, 72] }, // Rose 600
            styles: { fontSize: 8 }
        });

        // Staff Productivity
        autoTable(doc, {
            startY: ((doc as any).lastAutoTable?.cursor?.y || 150) + 20,
            head: [['Employee', 'Role', 'Appointments', 'Efficiency']],
            body: employeePerformance.map(emp => [
                emp.name,
                emp.role,
                `${emp.completedAppts} / ${emp.appointments}`,
                `${emp.productivity}%`
            ]),
            headStyles: { fillColor: [15, 23, 42] }, // Slate 900
            styles: { fontSize: 9 }
        });

        doc.save(`SkinSmith_Full_Report_${format(new Date(), 'yyyyMMdd')}.pdf`);
    };

    const handleExport = () => {
        // Fallback or trigger CSV/XLSX
        handleExportXLSX();
    };

    return (
        <div className="grid flex-1 items-start gap-8 auto-rows-max animate-in fade-in duration-700">
            {/* View Mode Switcher */}
            <AdminViewSwitcher />

            {/* Executive Summary Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-slate-50 p-6 rounded-[2rem] border border-slate-200/60 shadow-sm">
                <div className="space-y-1">
                    <h2 className="text-4xl font-black tracking-tighter text-slate-900">Reports & <span className="text-indigo-600">Analytics</span></h2>
                    <p className="text-slate-500 font-bold text-sm uppercase tracking-widest opacity-70">Unified Financial Audit Center</p>
                </div>
                <div className="flex items-center gap-3">
                    <DatePickerWithRange date={selectedRange} onDateChange={setSelectedRange} />
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button className="relative h-12 px-6 rounded-2xl bg-indigo-600 text-white font-black shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95 border-none">
                                <Download className="mr-2 h-4 w-4" /> Export Report
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 rounded-xl border-slate-200 shadow-xl">
                            <DropdownMenuItem onClick={handleExportXLSX} className="py-3 font-bold cursor-pointer hover:bg-emerald-50 text-emerald-700">
                                <FileText className="mr-2 h-4 w-4" /> Download as Excel (.xlsx)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handleExportPDF} className="py-3 font-bold cursor-pointer hover:bg-rose-50 text-rose-700">
                                <FileBarChart className="mr-2 h-4 w-4" /> Download as PDF (.pdf)
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Main Financial Pillars */}
            <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-3">
                <Card className="border-none bg-emerald-50/50 shadow-xl shadow-emerald-100/20 rounded-[2.5rem] overflow-hidden group hover:scale-[1.02] transition-all">
                    <CardContent className="p-8">
                        <div className="flex items-center justify-between mb-6">
                            <div className="p-4 bg-emerald-600 text-white rounded-2xl shadow-lg shadow-emerald-200"><TrendingUp className="h-6 w-6" /></div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600/60 leading-none">Total Revenue</span>
                        </div>
                        <div className="space-y-1">
                            <div className="text-4xl font-black tracking-tighter text-slate-900 leading-none">
                                Rs {financialStats.totalRevenue.toLocaleString()}
                            </div>
                            <p className="text-xs font-bold text-emerald-600/80 uppercase tracking-tighter">Gross Inflow Audited</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none bg-rose-50/50 shadow-xl shadow-rose-100/20 rounded-[2.5rem] overflow-hidden group hover:scale-[1.02] transition-all">
                    <CardContent className="p-8">
                        <div className="flex items-center justify-between mb-6">
                            <div className="p-4 bg-rose-600 text-white rounded-2xl shadow-lg shadow-rose-200"><Receipt className="h-6 w-6" /></div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-rose-600/60 leading-none">Total Expenses</span>
                        </div>
                        <div className="space-y-1">
                            <div className="text-4xl font-black tracking-tighter text-slate-900 leading-none">
                                Rs {financialStats.totalExpense.toLocaleString()}
                            </div>
                            <p className="text-xs font-bold text-rose-600/80 uppercase tracking-tighter">Operational Burn Tracked</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none bg-indigo-50/50 shadow-xl shadow-indigo-100/20 rounded-[2.5rem] overflow-hidden group hover:scale-[1.02] transition-all border-2 border-indigo-100/50">
                    <CardContent className="p-8">
                        <div className="flex items-center justify-between mb-6">
                            <div className="p-4 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-200"><CircleDollarSign className="h-6 w-6" /></div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600/60 leading-none">Net Profit/Loss</span>
                        </div>
                        <div className="space-y-1">
                            <div className={`text-4xl font-black tracking-tighter leading-none ${financialStats.netProfit >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
                                Rs {financialStats.netProfit.toLocaleString()}
                            </div>
                            <p className="text-xs font-bold text-indigo-600/80 uppercase tracking-tighter">Final Bottom Line</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Admin Daily Intelligence (Summary Boxes) */}
            <AdminDailyIntelligence
                billingRecords={billingRecords || []}
                allExpenses={allExpenses || []}
                appointments={appointments || []}
                patients={patients || []}
                dateRange={selectedRange}
            />


            {/* Employee Performance - Clean Redesign */}
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-2xl font-black text-slate-900 tracking-tight">Employee Performance</h3>
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-0.5">Real-time Activity & Task Progress</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-400 bg-slate-100 px-4 py-2 rounded-full">
                        <Users2 className="h-4 w-4" />
                        {employeePerformance.length} Active Staff
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 max-h-[700px] overflow-y-auto pr-2 custom-scrollbar">
                    {/* Add New Staff Card */}
                    <Card 
                        className="border-2 border-dashed border-slate-200 shadow-none rounded-3xl overflow-hidden group hover:border-indigo-400 hover:bg-indigo-50/30 transition-all duration-300 cursor-pointer flex flex-col items-center justify-center p-4 min-h-[220px]"
                        onClick={handleAddStaff}
                    >
                        <div className="p-3 bg-slate-100 rounded-full group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors mb-2">
                            <UserPlus className="h-6 w-6 text-slate-400 group-hover:text-indigo-600" />
                        </div>
                        <h4 className="font-black text-slate-900 uppercase tracking-widest text-[9px]">Add New Staff</h4>
                    </Card>

                    {employeePerformance.map((emp) => (
                        <Card key={emp.id} className="border-none shadow-sm rounded-3xl overflow-hidden group hover:shadow-md transition-all duration-300 bg-white border border-slate-100">
                            <CardContent className="p-4 space-y-4">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="relative">
                                            <Avatar className="h-10 w-10 border-2 border-white shadow-sm shrink-0">
                                                <AvatarFallback className="bg-indigo-600 text-white font-black text-sm uppercase">
                                                    {emp.name?.slice(0, 2)}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className={cn(
                                                "absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border border-white",
                                                emp.hasReportToday ? "bg-emerald-500" : "bg-amber-500"
                                            )} />
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="font-black text-slate-900 truncate leading-tight text-sm tracking-tight">{emp.name}</h4>
                                            <Badge className="bg-slate-100 text-slate-500 border-none font-black text-[7px] px-1 h-3.5 uppercase tracking-tighter">
                                                {emp.role}
                                            </Badge>
                                        </div>
                                    </div>

                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full">
                                                <MoreVertical className="h-3 w-3 text-slate-400" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="rounded-xl">
                                            <DropdownMenuItem onClick={() => handleEditStaff(emp)} className="text-xs font-bold">Edit Profile</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => setViewingEmployeeId(emp.id)} className="text-xs font-bold">Performance</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[9px] font-black uppercase text-slate-400">Efficiency</span>
                                        <span className="text-sm font-black text-slate-900">{emp.productivity}%</span>
                                    </div>
                                    <Progress value={emp.productivity} className="h-1.5 bg-slate-50" />
                                    
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="bg-slate-50/50 p-2 rounded-xl border border-slate-100/50">
                                            <p className="text-[7px] font-black text-slate-400 uppercase mb-0.5">Actions</p>
                                            <p className="text-[10px] font-black text-slate-900">{emp.totalActionsToday || 0}</p>
                                        </div>
                                        <div className="bg-slate-50/50 p-2 rounded-xl border border-slate-100/50">
                                            <p className="text-[7px] font-black text-slate-400 uppercase mb-0.5">Audit</p>
                                            <p className={cn(
                                                "text-[8px] font-black uppercase",
                                                emp.hasReportToday ? "text-emerald-600" : "text-amber-600"
                                            )}>{emp.hasReportToday ? 'Pass' : 'Pending'}</p>
                                        </div>
                                    </div>
                                </div>

                                <Button 
                                    className="w-full h-8 rounded-xl bg-slate-900 text-white font-black text-[8px] uppercase tracking-widest hover:bg-black transition-all"
                                    onClick={() => setViewingEmployeeId(emp.id)}
                                >
                                    Review Evaluation
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* CRUD Dialogs */}
                <UserFormDialog 
                    open={isFormOpen} 
                    onOpenChange={setIsFormOpen} 
                    user={editingUser} 
                />

                <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
                    <AlertDialogContent className="rounded-[2rem] border-none shadow-2xl">
                        <AlertDialogHeader>
                            <AlertDialogTitle className="text-2xl font-black tracking-tight">Decommission Staff Member?</AlertDialogTitle>
                            <AlertDialogDescription className="font-bold text-slate-500">
                                Are you sure you want to remove <span className="text-slate-900">{userToDelete?.name}</span>? This will hide them from all active dashboards and evaluation reports.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="gap-2">
                            <AlertDialogCancel className="rounded-xl font-black uppercase tracking-widest text-[10px] border-slate-200">Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                                onClick={handleDeleteStaff}
                                className="rounded-xl font-black uppercase tracking-widest text-[10px] bg-rose-600 text-white hover:bg-rose-700 shadow-lg shadow-rose-100"
                            >
                                Confirm Removal
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                {/* Member Progress Dialog */}
                <Dialog open={!!viewingEmployeeId} onOpenChange={(open) => !open && setViewingEmployeeId(null)}>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-[2.5rem] p-0 border-none shadow-2xl">
                        <DialogHeader className="sr-only">
                            <DialogTitle>Member Progress: {viewingEmployeeId}</DialogTitle>
                            <DialogDescription>Detailed view of employee tasks, reports, and productivity metrics.</DialogDescription>
                        </DialogHeader>
                        {(() => {
                            const emp = employeePerformance.find(e => e.id === viewingEmployeeId);
                            if (!emp) return null;
                            
                            const userReports = (allDailyReports || []).filter((r: any) => r.userId === emp.id).sort((a:any, b:any) => new Date(b.reportDate).getTime() - new Date(a.reportDate).getTime());
                            const userSocialReports = (allSocialReports || []).filter((r: any) => r.userId === emp.id).sort((a:any, b:any) => new Date(b.reportDate).getTime() - new Date(a.reportDate).getTime());
                            const userTasks = (allDailyTasks || []).filter((t: any) => t.userId === emp.id).sort((a:any, b:any) => (b.createdAt || 0) - (a.createdAt || 0));
                            const userWork = (allDesignerWork || []).filter((w: any) => w.userId === emp.id).sort((a:any, b:any) => b.updatedAt - a.updatedAt);

                            return (
                                <div className="flex flex-col">
                                    {/* Header Section */}
                                    <div className="bg-slate-900 p-8 text-white">
                                        <div className="flex items-center gap-6">
                                            <Avatar className="h-20 w-20 border-4 border-white/10 shadow-xl">
                                                <AvatarFallback className="bg-indigo-600 text-white font-black text-2xl uppercase">{emp.name?.slice(0, 2)}</AvatarFallback>
                                            </Avatar>
                                            <div className="space-y-1">
                                                <Badge className="bg-indigo-600 text-white border-none px-3 font-black text-[10px] uppercase tracking-widest">{emp.role}</Badge>
                                                <h2 className="text-3xl font-black tracking-tighter">{emp.name}</h2>
                                                <p className="text-sm font-bold text-slate-400">{emp.email}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-8">
                                        <Tabs defaultValue="tasks" className="w-full">
                                            <TabsList className="bg-slate-100 p-1.5 rounded-2xl mb-8 w-fit">
                                                <TabsTrigger value="tasks" className="rounded-xl px-6 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-indigo-600 shadow-none">Submitted Tasks</TabsTrigger>
                                                <TabsTrigger value="reports" className="rounded-xl px-6 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-indigo-600 shadow-none">Daily Reports</TabsTrigger>
                                                {userSocialReports.length > 0 && <TabsTrigger value="social" className="rounded-xl px-6 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-indigo-600 shadow-none">Social Reports</TabsTrigger>}
                                            </TabsList>

                                            <TabsContent value="tasks" className="space-y-4">
                                                {(() => {
                                                    // Get manual tasks
                                                    const manualTasks = (allDailyTasks || [])
                                                        .filter((t: any) => t.userId === emp.id)
                                                        .map((t: any) => ({ ...t, title: t.title || t.task, type: t.type || 'Manual' }));
                                                    
                                                    // Get recurring task completions
                                                    const recurringCompletions: any[] = [];
                                                    (allTaskCompletions || [])
                                                        .filter((c: any) => c.userId === emp.id)
                                                        .forEach((comp: any) => {
                                                            (comp.completedTemplateIds || []).forEach((tid: string) => {
                                                                const template = (allTaskTemplates || []).find((tpl: any) => tpl.id === tid);
                                                                if (template) {
                                                                    recurringCompletions.push({
                                                                        id: `${comp.id}_${tid}`,
                                                                        title: template.content,
                                                                        status: 'Completed',
                                                                        dueDate: comp.date,
                                                                        remarks: comp.remarksMap?.[tid],
                                                                        type: 'Recurring',
                                                                        createdAt: comp.updatedAt || new Date(comp.date).getTime()
                                                                    });
                                                                }
                                                            });
                                                        });

                                                    const combinedTasks = [...manualTasks, ...recurringCompletions]
                                                        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

                                                    return (
                                                        <div className="grid gap-4">
                                                            {/* Admin Task Assignment Section */}
                                                            <div className="bg-slate-50 p-6 rounded-3xl border border-dashed border-slate-200 mb-2">
                                                                <h4 className="font-black text-[10px] uppercase tracking-widest text-indigo-600 mb-4 flex items-center gap-2">
                                                                    <PlusCircle className="h-4 w-4" /> Assign New Task
                                                                </h4>
                                                                <div className="flex gap-3">
                                                                    <Input 
                                                                        placeholder="Describe the task for this employee..." 
                                                                        className="flex-1 bg-white rounded-xl border-slate-200 font-bold text-sm h-11"
                                                                        value={newTaskTitle}
                                                                        onChange={(e) => setNewTaskTitle(e.target.value)}
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter') {
                                                                                e.preventDefault();
                                                                                handleAssignTask(emp.id);
                                                                            }
                                                                        }}
                                                                    />
                                                                    <Button 
                                                                        disabled={isAssigningTask || !newTaskTitle.trim()}
                                                                        onClick={() => handleAssignTask(emp.id)}
                                                                        className="rounded-xl px-6 bg-indigo-600 hover:bg-indigo-700 font-black text-[10px] uppercase tracking-widest h-11 shadow-lg shadow-indigo-100"
                                                                    >
                                                                        {isAssigningTask ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Assign Task'}
                                                                    </Button>
                                                                </div>
                                                            </div>

                                                            {combinedTasks.length === 0 ? (
                                                                <div className="text-center py-16 bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
                                                                    <ListTodo className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                                                                    <p className="font-bold text-slate-400 uppercase tracking-widest text-[10px]">No task history found</p>
                                                                </div>
                                                            ) : (
                                                                <div className="grid gap-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                                                                    {combinedTasks.map((task: any) => (
                                                                <div key={task.id} className={cn(
                                                                    "p-6 rounded-3xl transition-all duration-300 border space-y-4",
                                                                    task.status === 'Completed' 
                                                                        ? "bg-emerald-50/30 border-emerald-100 shadow-sm" 
                                                                        : "bg-white border-slate-100 shadow-sm hover:border-indigo-100"
                                                                )}>
                                                                    <div className="flex items-center justify-between">
                                                                        <div className="flex items-center gap-4">
                                                                            <div className={cn(
                                                                                "p-3 rounded-2xl",
                                                                                task.status === 'Completed' ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"
                                                                            )}>
                                                                                {task.status === 'Completed' ? <UserCheck className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                                                                            </div>
                                                                            <div>
                                                                                <div className="flex items-center gap-2 mb-0.5">
                                                                                    <p className={cn(
                                                                                        "font-black text-base tracking-tight",
                                                                                        task.status === 'Completed' ? "text-emerald-900" : "text-slate-900"
                                                                                    )}>{task.title}</p>
                                                                                    <Badge variant="outline" className={cn(
                                                                                        "text-[8px] font-black uppercase tracking-tighter px-1.5 py-0 h-4",
                                                                                        task.type === 'Admin Assigned' ? "bg-indigo-600 text-white border-none" : "border-slate-200 text-slate-400"
                                                                                    )}>{task.type}</Badge>
                                                                                </div>
                                                                                <div className="flex items-center gap-3">
                                                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                                                                                        {task.type === 'Recurring' ? `Logged on: ${task.dueDate}` : `Assigned: ${task.createdAt ? format(new Date(task.createdAt), 'MMM dd, HH:mm') : 'N/A'}`}
                                                                                    </p>
                                                                                    {task.status === 'Completed' && task.completedAt && (
                                                                                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-tight flex items-center gap-1">
                                                                                            <CheckCircle2 className="h-3 w-3" /> Done at {format(new Date(task.completedAt), 'HH:mm')}
                                                                                        </p>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center gap-3">
                                                                            <Badge variant={task.status === 'Completed' ? 'default' : 'secondary'} className={cn(
                                                                                "rounded-xl font-black text-[9px] uppercase tracking-widest px-4 py-1.5",
                                                                                task.status === 'Completed' ? "bg-emerald-500 text-white border-none shadow-lg shadow-emerald-100" : ""
                                                                            )}>
                                                                                {task.status}
                                                                            </Badge>
                                                                            
                                                                            {task.type !== 'Recurring' && (
                                                                                <div className="flex items-center gap-1">
                                                                                    <Button 
                                                                                        variant="ghost" 
                                                                                        size="icon" 
                                                                                        className="h-8 w-8 rounded-full hover:bg-indigo-50 hover:text-indigo-600"
                                                                                        onClick={() => setTaskToEdit(task)}
                                                                                    >
                                                                                        <Edit3 className="h-3.5 w-3.5" />
                                                                                    </Button>
                                                                                    <Button 
                                                                                        variant="ghost" 
                                                                                        size="icon" 
                                                                                        className="h-8 w-8 rounded-full hover:bg-rose-50 hover:text-rose-600"
                                                                                        onClick={() => setTaskToDelete(task)}
                                                                                    >
                                                                                        <Trash2 className="h-3.5 w-3.5" />
                                                                                    </Button>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    
                                                                    {(task.remarks || task.assignedByName || (task.status === 'Completed' && task.completedAt)) && (
                                                                        <div className="ml-14 grid gap-3">
                                                                            {task.assignedByName && (
                                                                                <div className="flex items-center gap-2">
                                                                                    <Badge variant="secondary" className="bg-indigo-50 text-indigo-600 border-none font-black text-[8px] uppercase tracking-tighter h-4">
                                                                                        Assigned by: {task.assignedByName}
                                                                                    </Badge>
                                                                                    {task.status === 'Completed' && (
                                                                                        <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-none font-black text-[8px] uppercase tracking-tighter h-4">
                                                                                            Result: Successful Completion
                                                                                        </Badge>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                            {task.remarks && (
                                                                                <div className={cn(
                                                                                    "p-4 rounded-2xl border relative",
                                                                                    task.status === 'Completed' ? "bg-white border-emerald-100" : "bg-slate-50 border-slate-100"
                                                                                )}>
                                                                                    <div className="absolute -top-2 left-4 px-2 bg-inherit text-[8px] font-black uppercase tracking-widest text-slate-400">Staff Remarks</div>
                                                                                    <p className={cn(
                                                                                        "text-sm font-bold leading-relaxed italic",
                                                                                        task.status === 'Completed' ? "text-emerald-700" : "text-slate-600"
                                                                                    )}>
                                                                                        "{task.remarks}"
                                                                                    </p>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                            </TabsContent>

                                            {/* Edit Task Dialog */}
                                            <Dialog open={!!taskToEdit} onOpenChange={(open) => !open && setTaskToEdit(null)}>
                                                <DialogContent className="rounded-[2.5rem] border-none shadow-2xl p-8 max-w-md">
                                                    <DialogHeader>
                                                        <DialogTitle className="text-2xl font-black tracking-tight">Edit Task</DialogTitle>
                                                        <DialogDescription className="font-bold text-slate-400 uppercase tracking-widest text-[10px]">Update task details and status</DialogDescription>
                                                    </DialogHeader>
                                                    <div className="space-y-6 mt-4">
                                                        <div className="space-y-2">
                                                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Task Title</Label>
                                                            <Input 
                                                                value={taskToEdit?.title || taskToEdit?.task || ''} 
                                                                onChange={(e) => setTaskToEdit({ ...taskToEdit, title: e.target.value })}
                                                                className="rounded-2xl h-12 font-bold text-sm"
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Current Status</Label>
                                                            <Select 
                                                                value={taskToEdit?.status} 
                                                                onValueChange={(v) => setTaskToEdit({ ...taskToEdit, status: v })}
                                                            >
                                                                <SelectTrigger className="rounded-2xl h-12 font-bold">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent className="rounded-xl border-none shadow-xl">
                                                                    <SelectItem value="Pending" className="font-bold">Pending</SelectItem>
                                                                    <SelectItem value="Completed" className="font-bold">Completed</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <Button 
                                                            onClick={handleUpdateTask}
                                                            className="w-full h-12 rounded-2xl bg-indigo-600 text-white font-black uppercase tracking-widest shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
                                                        >
                                                            Update Changes
                                                        </Button>
                                                    </div>
                                                </DialogContent>
                                            </Dialog>

                                            {/* Delete Task Alert */}
                                            <AlertDialog open={!!taskToDelete} onOpenChange={(open) => !open && setTaskToDelete(null)}>
                                                <AlertDialogContent className="rounded-[2rem] border-none shadow-2xl">
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle className="text-2xl font-black tracking-tight">Remove this task?</AlertDialogTitle>
                                                        <AlertDialogDescription className="font-bold text-slate-500">
                                                            This will permanently delete the task: <span className="text-slate-900 font-black">"{taskToDelete?.title || taskToDelete?.task}"</span>. This action cannot be undone.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter className="gap-2">
                                                        <AlertDialogCancel className="rounded-xl font-black uppercase tracking-widest text-[10px] border-slate-200">Cancel</AlertDialogCancel>
                                                        <AlertDialogAction 
                                                            onClick={handleDeleteTaskAction}
                                                            className="rounded-xl font-black uppercase tracking-widest text-[10px] bg-rose-600 text-white hover:bg-rose-700 shadow-lg shadow-rose-100"
                                                        >
                                                            Confirm Deletion
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>

                                            <TabsContent value="reports" className="space-y-6">
                                                {userReports.length === 0 ? (
                                                    <div className="text-center py-16 bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
                                                        <FileText className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                                                        <p className="font-bold text-slate-400 uppercase tracking-widest text-[10px]">No daily reports submitted</p>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-6">
                                                        {userReports.map((report: any) => (
                                                            <div key={report.id} className="border-l-4 border-indigo-600 pl-6 space-y-4">
                                                                <div className="flex items-center justify-between">
                                                                    <p className="font-black text-indigo-600 uppercase tracking-widest text-[10px]">{format(new Date(report.reportDate), 'EEEE, MMMM dd, yyyy')}</p>
                                                                </div>
                                                                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                                                                    <div className="space-y-4">
                                                                        <div>
                                                                            <h4 className="font-black text-[9px] uppercase tracking-[0.2em] text-slate-400 mb-2">Performance Summary</h4>
                                                                            <p className="text-slate-700 leading-relaxed font-bold text-sm">{report.summary}</p>
                                                                        </div>
                                                                        {report.plans && (
                                                                            <div>
                                                                                <h4 className="font-black text-[9px] uppercase tracking-[0.2em] text-slate-400 mb-2">Next Steps</h4>
                                                                                <p className="text-slate-500 text-xs font-medium">{report.plans}</p>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </TabsContent>

                                            <TabsContent value="social" className="space-y-6">
                                                <div className="space-y-6">
                                                    {userSocialReports.map((report: any) => (
                                                        <div key={report.id} className="border-l-4 border-sky-500 pl-6 space-y-4">
                                                            <div className="flex items-center justify-between">
                                                                <p className="font-black text-sky-600 uppercase tracking-widest text-[10px]">
                                                                    {(() => {
                                                                        try {
                                                                            return report.reportDate ? format(new Date(report.reportDate), 'EEEE, MMMM dd, yyyy') : 'No Date';
                                                                        } catch (e) {
                                                                            return 'Invalid Date';
                                                                        }
                                                                    })()}
                                                                </p>
                                                            </div>
                                                            <div className="bg-sky-50/30 rounded-2xl p-6 border border-sky-100">
                                                                <div className="space-y-4">
                                                                    <div>
                                                                        <h4 className="font-black text-[9px] uppercase tracking-[0.2em] text-slate-400 mb-2">Activity Summary</h4>
                                                                        <p className="text-slate-700 leading-relaxed font-bold text-sm">{report.summary}</p>
                                                                    </div>
                                                                    <div>
                                                                        <h4 className="font-black text-[9px] uppercase tracking-[0.2em] text-slate-400 mb-2">Metrics & Highlights</h4>
                                                                        <p className="text-slate-600 text-xs font-medium italic">{report.metrics}</p>
                                                                    </div>
                                                                    {report.plans && (
                                                                        <div>
                                                                            <h4 className="font-black text-[9px] uppercase tracking-[0.2em] text-slate-400 mb-2">Next Steps</h4>
                                                                            <p className="text-slate-500 text-xs font-medium">{report.plans}</p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </TabsContent>
                                        </Tabs>
                                    </div>
                                </div>
                            );
                        })()}
                    </DialogContent>
                </Dialog>
            </div>


            <Card className="border-none shadow-xl shadow-slate-100/50 rounded-[2.5rem] bg-white overflow-hidden border border-slate-100/50">
                <CardHeader className="p-8 pb-0">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-2xl font-black text-slate-900 tracking-tight">Revenue Stream</CardTitle>
                            <CardDescription className="text-sm font-bold text-slate-500 uppercase tracking-widest opacity-60 mt-1">Service Breakdown</CardDescription>
                        </div>
                        <FileBarChart className="h-6 w-6 text-slate-300" />
                    </div>
                </CardHeader>
                <CardContent className="p-8 h-[400px]">
                    <ChartContainer config={{
                        value: { label: "Revenue", color: "hsl(var(--primary))" }
                    }} className="h-full w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <RechartsBarChart data={[
                                { name: 'Consults', value: financialStats.consultation },
                                { name: 'Procedures', value: financialStats.procedures },
                                { name: 'Medicines', value: financialStats.medicines },
                            ]}>
                                <CartesianGrid strokeDasharray="10 10" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} fontWeight="black" tick={{ fill: '#64748b' }} />
                                <YAxis fontSize={10} tickLine={false} axisLine={false} fontWeight="black" tick={{ fill: '#64748b' }} tickFormatter={(v) => `Rs${v / 1000}k`} />
                                <RechartsTooltip cursor={{ fill: '#f8fafc' }} content={<ChartTooltipContent />} />
                                <RechartsBar dataKey="value" fill="#4f46e5" radius={[12, 12, 0, 0]} barSize={40} />
                            </RechartsBarChart>
                        </ResponsiveContainer>
                    </ChartContainer>
                </CardContent>
            </Card>
        </div>
    );
};


const ReceptionistDashboard = () => {
    // For now, the receptionist dashboard can be the same as the admin dashboard
    // as it focuses on appointments and high-level stats.
    return <AdminDashboard />;
}


const ViewModeSelection = ({ user, onSelect }: { user: any, onSelect: (mode: 'clinic' | 'organization' | 'reports') => void }) => {
    // Only true super users get automatic access to all boxes.
    const isSuperUser = user?.email === 'admin1@skinsmith.com' || user?.role === 'Admin';

    // Strict checks: Either superuser OR explicit feature flag.
    const hasOrgAccess = isSuperUser || !!user?.featureAccess?.['mgmt_organization'];
    const hasClinicAccess = isSuperUser || !!user?.featureAccess?.['mgmt_clinic'];
    const hasReportsAccess = isSuperUser || !!user?.featureAccess?.['mgmt_reports'];

    return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] space-y-8 animate-in fade-in duration-500">
            <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Welcome, {user?.name || 'Administrator'}</h2>
                <p className="text-muted-foreground text-lg">Please select a workstation to continue</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-6xl px-4">
                {/* Organization Selection */}
                {hasOrgAccess && (
                    <Card
                        className="group relative overflow-hidden border-2 transition-all hover:border-primary cursor-pointer hover:shadow-xl bg-card/50 backdrop-blur-md"
                        onClick={() => onSelect('organization')}
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Building2 className="h-32 w-32" />
                        </div>
                        <CardHeader className="space-y-4">
                            <div className="p-3 bg-primary/10 rounded-2xl w-fit group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                <Building2 className="h-8 w-8" />
                            </div>
                            <div>
                                <CardTitle className="text-2xl">Organization</CardTitle>
                                <CardDescription className="text-base mt-2">
                                    Manage employees, reports, revenues, and overall organizational growth.
                                </CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-2 text-sm text-muted-foreground">
                                <li className="flex items-center gap-2"><ArrowRight className="h-3 w-3" /> Employee Progress Reports</li>
                                <li className="flex items-center gap-2"><ArrowRight className="h-3 w-3" /> Sales & Lead Dashboards</li>
                                <li className="flex items-center gap-2"><ArrowRight className="h-3 w-3" /> Task & Training Management</li>
                            </ul>
                        </CardContent>
                        <div className="absolute bottom-4 right-6 flex items-center gap-2 font-semibold text-primary group-hover:translate-x-1 transition-transform">
                            Enter Workspace <ArrowRight className="h-4 w-4" />
                        </div>
                    </Card>
                )}

                {/* Reports Selection - SWAPPED TO SECOND SLOT */}
                {hasReportsAccess && (
                    <Card
                        className="group relative overflow-hidden border-2 transition-all hover:border-amber-500 cursor-pointer hover:shadow-xl bg-card/50 backdrop-blur-md"
                        onClick={() => onSelect('reports')}
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <BarChart className="h-32 w-32" />
                        </div>
                        <CardHeader className="space-y-4">
                            <div className="p-3 bg-amber-500/10 rounded-2xl w-fit group-hover:bg-amber-500 group-hover:text-white transition-colors">
                                <BarChart className="h-8 w-8" />
                            </div>
                            <div>
                                <CardTitle className="text-2xl">Reports & Analytics</CardTitle>
                                <CardDescription className="text-base mt-2">
                                    Access detailed financial statements and evaluate employee performance metrics.
                                </CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-2 text-sm text-muted-foreground">
                                <li className="flex items-center gap-2"><ArrowRight className="h-3 w-3" /> Financial Reports & Revenue</li>
                                <li className="flex items-center gap-2"><ArrowRight className="h-3 w-3" /> Employee Efficiency Metrics</li>
                                <li className="flex items-center gap-2"><ArrowRight className="h-3 w-3" /> Performance Analytics</li>
                            </ul>
                        </CardContent>
                        <div className="absolute bottom-4 right-6 flex items-center gap-2 font-semibold text-amber-600 group-hover:translate-x-1 transition-transform">
                            View Reports <ArrowRight className="h-4 w-4" />
                        </div>
                    </Card>
                )}

                {/* Clinic Selection - SWAPPED TO THIRD SLOT */}
                {hasClinicAccess && (
                    <Card
                        className="group relative overflow-hidden border-2 transition-all hover:border-indigo-500 cursor-pointer hover:shadow-xl bg-card/50 backdrop-blur-md"
                        onClick={() => onSelect('clinic')}
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Hospital className="h-32 w-32" />
                        </div>
                        <CardHeader className="space-y-4">
                            <div className="p-3 bg-indigo-500/10 rounded-2xl w-fit group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                                <Hospital className="h-8 w-8" />
                            </div>
                            <div>
                                <CardTitle className="text-2xl">Manage Skin Smith</CardTitle>
                                <CardDescription className="text-base mt-2">
                                    Oversee daily clinic operations, appointments, patients, and medical records.
                                </CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-2 text-sm text-muted-foreground">
                                <li className="flex items-center gap-2"><ArrowRight className="h-3 w-3" /> Core Clinic Operations</li>
                                <li className="flex items-center gap-2"><ArrowRight className="h-3 w-3" /> Patient & Doctor Schedules</li>
                                <li className="flex items-center gap-2"><ArrowRight className="h-3 w-3" /> Pharmacy & Records</li>
                            </ul>
                        </CardContent>
                        <div className="absolute bottom-4 right-6 flex items-center gap-2 font-semibold text-indigo-600 group-hover:translate-x-1 transition-transform">
                            Enter Clinic <ArrowRight className="h-4 w-4" />
                        </div>
                    </Card>
                )}
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full border">
                <ShieldAlert className="h-3.5 w-3.5" />
                <span>You are currently in Administrative Entry Mode</span>
            </div>
        </div>
    );
};


export default function Dashboard() {
    const { user, isUserLoading } = useUser();
    const { viewMode, setViewMode } = useViewMode();
    const router = useRouter();

    const userRole = user?.role;
    const userEmail = user?.email;
    const hasOrgAccess = !!user?.featureAccess?.['mgmt_organization'];
    const hasClinicAccess = !!user?.featureAccess?.['mgmt_clinic'];
    const hasReportsAccess = !!user?.featureAccess?.['mgmt_reports'];

    // For the main Dashboard rendering logic, isMainAdmin means they have access to the ViewModeSelection screen
    // (either because they are a super user, OR because they have at least one mgmt_* flag)
    const isMainAdmin = React.useMemo(() =>
        userEmail === 'admin1@skinsmith.com' ||
        userRole === 'Admin' ||
        userRole === 'Operations Manager' ||
        hasClinicAccess ||
        hasOrgAccess ||
        hasReportsAccess,
        [userEmail, userRole, hasClinicAccess, hasOrgAccess, hasReportsAccess]);

    // Auto-routing logic for users with exactly ONE workstation feature granted
    const isSuperUser = React.useMemo(() =>
        userEmail === 'admin1@skinsmith.com' || userRole === 'Admin',
        [userEmail, userRole]);

    React.useEffect(() => {
        if (!isUserLoading && userRole && viewMode === 'none') {
            // Operations Manager always goes straight to the organization dashboard
            if (userRole === 'Operations Manager') {
                setViewMode('clinic');
                return;
            }

            if (!isSuperUser) {
                if (hasClinicAccess && !hasOrgAccess && !hasReportsAccess) {
                    setViewMode('clinic');
                } else if (hasOrgAccess && !hasClinicAccess && !hasReportsAccess) {
                    setViewMode('organization');
                } else if (hasReportsAccess && !hasOrgAccess && !hasClinicAccess) {
                    setViewMode('reports');
                }
            }
        }
    }, [isUserLoading, userRole, hasOrgAccess, hasClinicAccess, hasReportsAccess, isSuperUser, viewMode, setViewMode]);

    React.useEffect(() => {
        if (isUserLoading || !userRole) return;
        if (userRole === 'Sales') {
            router.replace('/sales-dashboard');
        } else if (userRole === 'Social Media Manager') {
            router.replace('/social-dashboard');
        } else if (userRole === 'Designer') {
            router.replace('/designer-dashboard');
        }
    }, [userRole, isUserLoading, router]);

    if (isUserLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        )
    }

    // Role-based redirection for non-admins remains the same
    if (user?.role === 'Sales') return <SalesDashboard />;
    if (user?.role === 'Doctor') return <DoctorDashboard />;
    if (user?.role === 'Receptionist') return <ReceptionistDashboard />;

    // For roles that redirect to their own page, return null to avoid flash
    if (user?.role === 'Social Media Manager') {
        return null;
    }

    if (user?.role === 'Designer') {
        return null;
    }

    if (user?.role === 'Operations Manager') return <AdminDashboard />;

    // Main Admin Logic — skip welcome screen, go directly to selected view
    if (isMainAdmin) {
        if (viewMode === 'organization') {
            return <OrganizationDashboard />;
        }

        if (viewMode === 'clinic') {
            return <AdminDashboard />;
        }

        // Default: reports (also handles 'none' and 'reports')
        return <ReportsDashboard />;
    }

    // Default Fallback for regular accounts with no role or unhandled role
    return (
        <div className="p-12 text-center flex flex-col items-center gap-4">
            <ShieldAlert className="h-12 w-12 text-amber-500" />
            <h2 className="text-2xl font-bold">Access Denied or Role Not Configured</h2>
            <p className="text-muted-foreground max-w-md">
                Your account ({user?.email || 'Unauthorized User'}) does not have a dashboard assigned to the role "{user?.role || 'Guest'}".
                Please contact the administrator to set up your profile.
            </p>
            <Button onClick={() => router.push('/settings')} variant="outline">Go to Settings</Button>
        </div>
    );
}

