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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import {
    useCollection,
    useFirestore,
    useMemoFirebase,
    useUser
} from '@/firebase';
import { collection, query, orderBy, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import {
    Receipt,
    Plus,
    Calendar,
    DollarSign,
    TrendingUp,
    PieChart,
    Activity,
    Loader2,
    Trash2,
    Edit2
} from 'lucide-react';
import { 
    format, 
    isToday, 
    isThisMonth, 
    isSameDay, 
    startOfWeek, 
    endOfWeek, 
    startOfMonth, 
    endOfMonth, 
    isWithinInterval,
    eachDayOfInterval
} from 'date-fns';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DatePicker } from '@/components/DatePicker';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';
import {
    PieChart as RechartsPieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Tooltip as RechartsTooltip,
    Legend
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

interface Expense {
    id?: string;
    amount: number;
    category: string;
    description: string;
    paymentMethod: string;
    timestamp: string; 
    addedBy: string; 
}

const CATEGORIES = [
    "Supplies",
    "Utilities",
    "Maintenance",
    "Salary",
    "Marketing",
    "Refund",
    "Other"
];

const PAYMENT_METHODS = [
    "Cash",
    "Card",
    "Bank Transfer",
    "Online"
];

export default function DailyExpensesPage() {
    const firestore = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();
    
    // Dialog state
    const [isAddOpen, setIsAddOpen] = React.useState(false);
    const [isEditOpen, setIsEditOpen] = React.useState(false);
    const [editingId, setEditingId] = React.useState<string | null>(null);

    // Form state
    const [amount, setAmount] = React.useState<string>('');
    const [category, setCategory] = React.useState<string>('Supplies');
    const [description, setDescription] = React.useState<string>('');
    const [paymentMethod, setPaymentMethod] = React.useState<string>('Cash');
    const [selectedDate, setSelectedDate] = React.useState<Date>(new Date());
    const [viewMode, setViewMode] = React.useState<'day' | 'week' | 'month' | 'history'>('day');

    const expensesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'expenses'), orderBy('timestamp', 'desc'));
    }, [firestore]);

    const { data: allExpenses, isLoading } = useCollection<Expense>(expensesQuery);

    const dateRange = React.useMemo(() => {
        if (viewMode === 'day') return { start: selectedDate, end: selectedDate };
        if (viewMode === 'week') return { start: startOfWeek(selectedDate), end: endOfWeek(selectedDate) };
        if (viewMode === 'month') return { start: startOfMonth(selectedDate), end: endOfMonth(selectedDate) };
        if (viewMode === 'history') return { start: new Date(0), end: new Date() }; // Beginning of time to now
        return { start: selectedDate, end: selectedDate };
    }, [selectedDate, viewMode]);

    const selectedExpensesList = React.useMemo(() => {
        if (!allExpenses) return [];
        return allExpenses.filter(e => {
            const d = new Date(e.timestamp);
            if (viewMode === 'day') return isSameDay(d, selectedDate);
            return isWithinInterval(d, { start: dateRange.start, end: dateRange.end });
        });
    }, [allExpenses, selectedDate, viewMode, dateRange]);

    const groupedExpenses = React.useMemo(() => {
        if (!selectedExpensesList) return [];
        const groups: Record<string, { date: Date; total: number; categories: Record<string, number>; count: number; items: Expense[] }> = {};
        
        selectedExpensesList.forEach(exp => {
            const dateStr = format(new Date(exp.timestamp), 'yyyy-MM-dd');
            if (!groups[dateStr]) {
                groups[dateStr] = { 
                    date: new Date(exp.timestamp), 
                    total: 0, 
                    categories: {}, 
                    count: 0,
                    items: []
                };
            }
            groups[dateStr].total += exp.amount;
            groups[dateStr].count += 1;
            groups[dateStr].items.push(exp);
            groups[dateStr].categories[exp.category] = (groups[dateStr].categories[exp.category] || 0) + exp.amount;
        });

        return Object.values(groups).sort((a, b) => b.date.getTime() - a.date.getTime());
    }, [selectedExpensesList]);

    const olderExpensesList = React.useMemo(() => 
        allExpenses?.filter(e => {
            const d = new Date(e.timestamp);
            return !isWithinInterval(d, { start: dateRange.start, end: dateRange.end });
        }) || []
    , [allExpenses, dateRange]);



    const stats = React.useMemo(() => {
        if (!allExpenses) return { currentTotal: 0, monthTotal: 0, currentCount: 0, topCategory: 'N/A' };

        let currentTotal = 0;
        let monthTotal = 0;
        let currentCount = 0;
        const categoryMap: Record<string, number> = {};

        allExpenses.forEach(expense => {
            const expDate = new Date(expense.timestamp);
            const isInRange = viewMode === 'day' 
                ? isSameDay(expDate, selectedDate)
                : isWithinInterval(expDate, { start: dateRange.start, end: dateRange.end });

            if (isInRange) {
                currentTotal += expense.amount;
                currentCount++;
                categoryMap[expense.category] = (categoryMap[expense.category] || 0) + expense.amount;
            }
            if (isThisMonth(expDate)) {
                monthTotal += expense.amount;
            }
        });

        let topCategory = 'N/A';
        let maxAmt = 0;
        Object.entries(categoryMap).forEach(([cat, amt]) => {
            if (amt > maxAmt) {
                maxAmt = amt;
                topCategory = cat;
            }
        });

        return { currentTotal, monthTotal, currentCount, topCategory };
    }, [allExpenses, viewMode, dateRange, selectedDate]);

    const resetForm = () => {
        setAmount('');
        setCategory('Supplies');
        setDescription('');
        setPaymentMethod('Cash');
        setEditingId(null);
    };

    const handleAddExpense = async () => {
        if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
            toast({ title: 'Invalid Amount', description: 'Please enter a valid amount.', variant: 'destructive' });
            return;
        }
        if (!description.trim()) {
            toast({ title: 'Missing Details', description: 'Please enter a description.', variant: 'destructive' });
            return;
        }
        if (!firestore) return;

        try {
            await addDoc(collection(firestore, 'expenses'), {
                amount: Number(amount),
                category,
                description,
                paymentMethod,
                timestamp: new Date().toISOString(),
                addedBy: user?.email || 'Unknown'
            });
            toast({ title: 'Success', description: 'Expense recorded successfully.' });
            setIsAddOpen(false);
            resetForm();
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
    };

    const openEditForm = (expense: Expense) => {
        setAmount(expense.amount.toString());
        setCategory(expense.category);
        setDescription(expense.description);
        setPaymentMethod(expense.paymentMethod || 'Cash');
        setEditingId(expense.id!);
        setIsEditOpen(true);
    };

    const handleEditExpense = async () => {
        if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
            toast({ title: 'Invalid Amount', description: 'Please enter a valid amount.', variant: 'destructive' });
            return;
        }
        if (!description.trim()) {
            toast({ title: 'Missing Details', description: 'Please enter a description.', variant: 'destructive' });
            return;
        }
        if (!firestore || !editingId) return;

        try {
            const expenseRef = doc(firestore, 'expenses', editingId);
            await updateDoc(expenseRef, {
                amount: Number(amount),
                category,
                description,
                paymentMethod,
            });
            toast({ title: 'Success', description: 'Expense updated successfully.' });
            setIsEditOpen(false);
            resetForm();
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
    };

    const handleDeleteExpense = async (id: string) => {
        if (!firestore) return;
        try {
            await deleteDoc(doc(firestore, 'expenses', id));
            toast({ title: 'Deleted', description: 'Expense deleted successfully.' });
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-[400px] gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground animate-pulse">Loading expenses...</p>
            </div>
        );
    }

    const COLORS = ['#0d9488', '#0284c7', '#7c3aed', '#db2777', '#ea580c'];

    const chartConfig = {
        amount: {
            label: "Amount",
        },
        Cash: { label: "Cash", color: "hsl(var(--chart-1))" },
        Card: { label: "Card", color: "hsl(var(--chart-2))" },
        "Bank Transfer": { label: "Bank", color: "hsl(var(--chart-3))" },
        UPI: { label: "UPI", color: "hsl(var(--chart-4))" },
    };

    return (
        <div className="flex flex-col gap-6 p-4">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Receipt className="h-8 w-8 text-primary" />
                        Daily Expense Management
                    </h2>
                    <p className="text-muted-foreground">Track and manage outgoing clinic expenses.</p>
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="flex flex-col gap-1">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Range Mode</Label>
                        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)} className="w-[400px]">
                            <TabsList className="grid w-full grid-cols-4 h-9">
                                <TabsTrigger value="day" className="text-xs">Day</TabsTrigger>
                                <TabsTrigger value="week" className="text-xs">Week</TabsTrigger>
                                <TabsTrigger value="month" className="text-xs">Month</TabsTrigger>
                                <TabsTrigger value="history" className="text-xs">History</TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>
                    <div className="flex flex-col gap-1">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Select {viewMode === 'day' ? 'Date' : 'Anchor Date'}</Label>
                        <DatePicker date={selectedDate} onDateChange={(d) => d && setSelectedDate(d)} />
                    </div>
                    <Separator orientation="vertical" className="h-10 hidden md:block" />
                    <Dialog open={isAddOpen} onOpenChange={(open) => {
                    setIsAddOpen(open);
                    if (!open) resetForm();
                }}>
                    <DialogTrigger asChild>
                        <Button className="gap-2">
                            <Plus className="h-4 w-4" /> Add Expense
                        </Button>
                    </DialogTrigger>
                <DialogContent className="rounded-3xl border-none p-0 overflow-hidden shadow-2xl">
                    <div className="bg-gradient-to-r from-teal-600 to-emerald-600 p-6">
                        <DialogTitle className="text-white text-2xl font-black">Record New Outflow</DialogTitle>
                        <DialogDescription className="text-white/70">Enter the details of the clinic expense below.</DialogDescription>
                    </div>
                    <div className="grid gap-6 p-8">
                        <div className="grid gap-2">
                            <Label htmlFor="amount" className="text-xs font-black uppercase text-slate-500 ml-1">Amount (Rs)</Label>
                            <Input id="amount" type="number" placeholder="0.00" className="rounded-xl h-12 bg-slate-50 border-none focus-visible:ring-emerald-500 font-bold" value={amount} onChange={e => setAmount(e.target.value)} />
                        </div>
                        <div className="grid gap-2">
                            <Label className="text-xs font-black uppercase text-slate-500 ml-1">Category</Label>
                            <Select value={category} onValueChange={setCategory}>
                                <SelectTrigger className="rounded-xl h-12 bg-slate-50 border-none"><SelectValue placeholder="Select Category" /></SelectTrigger>
                                <SelectContent>
                                    {CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label className="text-xs font-black uppercase text-slate-500 ml-1">Paid Via</Label>
                            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                                <SelectTrigger className="rounded-xl h-12 bg-slate-50 border-none"><SelectValue placeholder="Select Payment Method" /></SelectTrigger>
                                <SelectContent>
                                    {PAYMENT_METHODS.map(method => <SelectItem key={method} value={method}>{method}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <p className="text-[11px] text-slate-400 ml-1">Only "Cash" is deducted from the physical drawer handover. Bank/Card/Online payments (e.g. utility bills) won't affect today's cash count.</p>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="description" className="text-xs font-black uppercase text-slate-500 ml-1">Reason / Description</Label>
                            <Textarea id="description" placeholder="E.g., Bought printer ink..." className="rounded-xl min-h-[100px] bg-slate-50 border-none focus-visible:ring-emerald-500" value={description} onChange={e => setDescription(e.target.value)} />
                        </div>
                    </div>
                    <DialogFooter className="p-8 bg-slate-50 flex items-center justify-between">
                        <Button variant="ghost" className="rounded-xl hover:bg-slate-200 px-6 font-bold" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                        <Button className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-8 font-bold shadow-lg shadow-emerald-500/20" onClick={handleAddExpense}>Log Expense</Button>
                    </DialogFooter>
                </DialogContent>
                </Dialog>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="relative overflow-hidden bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-500/20 backdrop-blur-md shadow-xl shadow-emerald-500/5">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <TrendingUp className="h-24 w-24 text-emerald-600" />
                    </div>
                    <CardHeader className="pb-2 relative z-10">
                        <CardDescription className="text-emerald-700 font-black uppercase tracking-[0.2em] text-[10px]">
                            {viewMode === 'day' 
                                ? (isToday(selectedDate) ? "Today's Outflow" : `${format(selectedDate, 'MMM dd')} Outflow`) 
                                : viewMode === 'history' ? "Total Outflow" : `Period Outflow`}
                        </CardDescription>
                        <CardTitle className="text-4xl font-black text-emerald-950 flex items-baseline gap-2">
                             {stats.currentTotal.toLocaleString()} <span className="text-sm font-medium text-emerald-700/60 uppercase">Rs</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="relative z-10">
                        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600/80 bg-emerald-500/10 w-fit px-3 py-1 rounded-full border border-emerald-500/10">
                            <Plus className="h-3 w-3" /> From {stats.currentCount} Transactions
                        </div>
                    </CardContent>
                </Card>

                <Card className="relative overflow-hidden bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-transparent border-indigo-500/20 backdrop-blur-md shadow-xl shadow-indigo-500/5">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <PieChart className="h-24 w-24 text-indigo-600" />
                    </div>
                    <CardHeader className="pb-2 relative z-10">
                        <CardDescription className="text-indigo-700 font-black uppercase tracking-[0.2em] text-[10px]">Peak Spending Area</CardDescription>
                        <CardTitle className="text-4xl font-black text-indigo-950 line-clamp-1">{stats.topCategory}</CardTitle>
                    </CardHeader>
                    <CardContent className="relative z-10">
                        <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600/80 bg-indigo-500/10 w-fit px-3 py-1 rounded-full border border-indigo-500/10">
                            <Receipt className="h-3 w-3" /> Main allocation
                        </div>
                    </CardContent>
                </Card>

                <Card className="relative overflow-hidden bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-transparent border-rose-500/20 backdrop-blur-md shadow-xl shadow-rose-500/5">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Calendar className="h-24 w-24 text-rose-600" />
                    </div>
                    <CardHeader className="pb-2 relative z-10">
                        <CardDescription className="text-rose-700 font-black uppercase tracking-[0.2em] text-[10px]">Monthly Burn Rate</CardDescription>
                        <CardTitle className="text-4xl font-black text-rose-950 flex items-baseline gap-2">
                            {stats.monthTotal.toLocaleString()} <span className="text-sm font-medium text-rose-700/60 uppercase">Rs</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="relative z-10">
                        <div className="flex items-center gap-2 text-xs font-semibold text-rose-600/80 bg-rose-500/10 w-fit px-3 py-1 rounded-full border border-rose-500/10">
                            <Activity className="h-3 w-3" /> Month to date
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Analysis Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">


                <Card className="relative overflow-hidden group bg-slate-900 border-none shadow-2xl">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))]" />
                    <div className="relative z-10 flex flex-col justify-center items-center p-8 text-center h-full">
                        <div className="rounded-2xl bg-white/10 p-4 mb-6 backdrop-blur-xl ring-1 ring-white/20 group-hover:scale-110 transition-transform duration-500">
                            <DollarSign className="h-10 w-10 text-emerald-400" />
                        </div>
                        <h3 className="text-2xl font-black text-white mb-3 tracking-tight">Spending Performance</h3>
                        <p className="text-slate-400 text-sm max-w-[280px] leading-relaxed">
                            Visualizing cash flow distribution and operational overhead for 
                            {viewMode === 'day' 
                                ? ` ${format(selectedDate, 'eeee, MMM dd')}`
                                : viewMode === 'history' ? " your entire records history" : ` the selected period`
                            }.
                        </p>
                        <div className="mt-8 pt-8 border-t border-white/5 w-full flex justify-around">
                            <div className="text-center">
                                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Efficiency</div>
                                <div className="text-emerald-400 font-black">94%</div>
                            </div>
                            <div className="text-center">
                                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Tracked</div>
                                <div className="text-indigo-400 font-black">{stats.currentCount}</div>
                            </div>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Edit Dialog (Hidden) */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="rounded-3xl border-none p-0 overflow-hidden shadow-2xl">
                    <div className="bg-gradient-to-r from-primary to-indigo-600 p-6">
                        <DialogTitle className="text-white text-2xl font-black">Refine Expense</DialogTitle>
                        <DialogDescription className="text-white/70">Updating documentation for this transaction.</DialogDescription>
                    </div>
                    <div className="grid gap-6 p-8">
                        <div className="grid gap-2">
                            <Label htmlFor="edit-amount" className="text-xs font-black uppercase text-slate-500 ml-1">Amount (Rs)</Label>
                            <Input id="edit-amount" type="number" className="rounded-xl h-12 bg-slate-50 border-none focus-visible:ring-indigo-500 font-bold" value={amount} onChange={e => setAmount(e.target.value)} />
                        </div>
                        <div className="grid gap-2">
                            <Label className="text-xs font-black uppercase text-slate-500 ml-1">Category</Label>
                            <Select value={category} onValueChange={setCategory}>
                                <SelectTrigger className="rounded-xl h-12 bg-slate-50 border-none"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label className="text-xs font-black uppercase text-slate-500 ml-1">Paid Via</Label>
                            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                                <SelectTrigger className="rounded-xl h-12 bg-slate-50 border-none"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {PAYMENT_METHODS.map(method => <SelectItem key={method} value={method}>{method}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="edit-description" className="text-xs font-black uppercase text-slate-500 ml-1">Description</Label>
                            <Textarea id="edit-description" className="rounded-xl min-h-[100px] bg-slate-50 border-none focus-visible:ring-indigo-500" value={description} onChange={e => setDescription(e.target.value)} />
                        </div>
                    </div>
                    <DialogFooter className="p-8 bg-slate-50 flex items-center justify-between">
                        <Button variant="ghost" className="rounded-xl hover:bg-slate-200 px-6 font-bold" onClick={() => setIsEditOpen(false)}>Discard</Button>
                        <Button className="rounded-xl bg-primary hover:bg-primary/90 px-8 font-bold shadow-lg shadow-primary/20" onClick={handleEditExpense}>Finalize Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Expenses List */}
            <Card className="border-none shadow-2xl bg-white/80 backdrop-blur-xl rounded-[2rem] overflow-hidden">
                <CardHeader className="p-8 pb-4">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <CardTitle className="text-2xl font-black tracking-tight flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-red-500/10">
                                    <DollarSign className="h-6 w-6 text-red-500" />
                                </div>
                                {viewMode === 'day' 
                                    ? `Daily Audit Log: ${format(selectedDate, 'PP')}`
                                    : viewMode === 'history' ? `Enterprise Expense Archive` : `Detailed Report: ${format(dateRange.start, 'MMM dd')} - ${format(dateRange.end, 'MMM dd')}`
                                }
                            </CardTitle>
                            <CardDescription className="font-medium text-slate-500 ml-11">
                                {viewMode === 'day' 
                                    ? "Real-time verification of all daily ledger entries." 
                                    : "Comprehensive day-wise rollup across the selected temporal range."
                                }
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                
                <CardContent className="p-8 pt-0">
                    {viewMode === 'day' ? (
                        selectedExpensesList.length === 0 ? (
                            <div className="flex flex-col items-center justify-center text-slate-300 py-16">
                                <Receipt className="h-20 w-20 opacity-20 mb-4 animate-pulse" />
                                <p className="font-bold tracking-widest uppercase text-sm">Clear Ledger: No Activity</p>
                            </div>
                        ) : (
                            <div className="border rounded-2xl overflow-hidden shadow-sm">
                                <Table>
                                    <TableHeader className="bg-slate-50/80">
                                        <TableRow className="hover:bg-transparent border-none">
                                            <TableHead className="font-black text-slate-500 text-[10px] uppercase tracking-widest pl-6">Time</TableHead>
                                            <TableHead className="font-black text-slate-500 text-[10px] uppercase tracking-widest">Classification</TableHead>
                                            <TableHead className="font-black text-slate-500 text-[10px] uppercase tracking-widest">Operational Detail</TableHead>
                                            <TableHead className="font-black text-slate-500 text-[10px] uppercase tracking-widest">Paid Via</TableHead>
                                            <TableHead className="text-right font-black text-slate-500 text-[10px] uppercase tracking-widest pr-6">Value (Rs)</TableHead>
                                            <TableHead className="w-[80px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {selectedExpensesList.map((expense) => (
                                            <TableRow key={expense.id} className="group transition-colors hover:bg-slate-50/50 border-slate-100">
                                                <TableCell className="pl-6 text-xs font-bold text-slate-400">
                                                    {format(new Date(expense.timestamp), 'p')}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-none font-bold text-[10px] rounded-lg px-2 shadow-none">
                                                        {expense.category}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="font-medium text-slate-700 max-w-[300px] truncate">
                                                    {expense.description}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className={`font-bold text-[10px] rounded-lg px-2 ${(expense.paymentMethod || 'Cash').toLowerCase().includes('cash') ? 'border-emerald-200 text-emerald-700 bg-emerald-50' : 'border-sky-200 text-sky-700 bg-sky-50'}`}>
                                                        {expense.paymentMethod || 'Cash'}
                                                    </Badge>
                                                </TableCell>

                                                <TableCell className="text-right pr-6">
                                                    <span className="font-black text-slate-900">{expense.amount.toLocaleString()}</span>
                                                </TableCell>
                                                <TableCell className="pr-4">
                                                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl hover:bg-indigo-50 hover:text-indigo-600" onClick={() => openEditForm(expense)}>
                                                            <Edit2 className="h-4 w-4" />
                                                        </Button>
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl hover:bg-red-50 hover:text-red-600">
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent className="rounded-3xl border-none">
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle className="text-2xl font-black">Remove entry?</AlertDialogTitle>
                                                                    <AlertDialogDescription className="font-medium">
                                                                        You are about to permanently delete this allocation of <span className="text-red-600 font-bold">Rs {expense.amount}</span>. This data cannot be recovered.
                                                                    </AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter className="p-4 bg-slate-50 rounded-b-3xl">
                                                                    <AlertDialogCancel className="rounded-xl font-bold">Abort</AlertDialogCancel>
                                                                    <AlertDialogAction className="rounded-xl bg-red-600 hover:bg-red-700 font-bold" onClick={() => handleDeleteExpense(expense.id!)}>Confirm Deletion</AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )
                    ) : (
                        groupedExpenses.length === 0 ? (
                            <div className="flex flex-col items-center justify-center text-slate-300 py-16">
                                <Calendar className="h-20 w-20 opacity-20 mb-4 animate-pulse" />
                                <p className="font-bold tracking-widest uppercase text-sm">Zero Activity Spotted</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <Accordion type="multiple" defaultValue={[format(groupedExpenses[0].date, 'yyyy-MM-dd')]} className="space-y-4">
                                    {groupedExpenses.map((group) => {
                                        const dateId = format(group.date, 'yyyy-MM-dd');
                                        const topCats = Object.entries(group.categories).sort((a, b) => b[1] - a[1]).slice(0, 2);
                                        
                                        return (
                                            <AccordionItem 
                                                key={dateId} 
                                                value={dateId}
                                                className="border-none bg-slate-50 shadow-sm rounded-3xl overflow-hidden transition-all duration-300 hover:shadow-md"
                                            >
                                                <AccordionTrigger className="px-8 py-6 hover:no-underline group/acc">
                                                    <div className="flex flex-wrap md:flex-nowrap justify-between items-center w-full pr-4 gap-4">
                                                        <div className="flex items-center gap-6">
                                                            <div className="text-left">
                                                                <h4 className="text-lg font-black text-slate-900 group-hover/acc:text-primary transition-colors">
                                                                    {format(group.date, 'eeee')}
                                                                </h4>
                                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter">
                                                                    {format(group.date, 'MMMM dd, yyyy')}
                                                                </p>
                                                            </div>
                                                            <Separator orientation="vertical" className="h-8 hidden md:block" />
                                                            <div className="hidden md:flex items-center gap-2">
                                                                <div className="flex flex-col items-start">
                                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Volume</span>
                                                                    <Badge className="bg-white text-slate-600 shadow-sm border-none font-black px-3">{group.count} Items</Badge>
                                                                </div>
                                                                <div className="flex flex-col items-start">
                                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Impact</span>
                                                                    <div className="flex gap-1">
                                                                        {topCats.map(([cat]) => (
                                                                            <Badge key={cat} variant="secondary" className="text-[9px] px-1.5 py-0 font-bold opacity-60">
                                                                                {cat}
                                                                            </Badge>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="text-right bg-white p-3 rounded-2xl shadow-sm border border-slate-100 min-w-[140px]">
                                                            <span className="text-[9px] uppercase font-black text-slate-400 block tracking-tighter mb-1">Aggregate Expense</span>
                                                            <span className="text-xl font-black text-red-600 tracking-tight">Rs {group.total.toLocaleString()}</span>
                                                        </div>
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent className="px-4 pb-4">
                                                    <div className="rounded-2xl overflow-hidden border border-slate-200/60 bg-white">
                                                        <Table>
                                                            <TableHeader className="bg-slate-50/50">
                                                                <TableRow className="border-none">
                                                                    <TableHead className="text-[10px] font-black uppercase text-slate-400 pl-6">Instant</TableHead>
                                                                    <TableHead className="text-[10px] font-black uppercase text-slate-400">Sphere</TableHead>
                                                                    <TableHead className="text-[10px] font-black uppercase text-slate-400">Allocation Narrative</TableHead>
                                                                    <TableHead className="text-right text-[10px] font-black uppercase text-slate-400 pr-6">Value (Rs)</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {group.items.map((item) => (
                                                                    <TableRow key={item.id} className="hover:bg-slate-50/30 border-slate-100 last:border-0">
                                                                        <TableCell className="text-[11px] font-bold text-slate-400 pl-6">
                                                                            {format(new Date(item.timestamp), 'p')}
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <Badge className="bg-slate-100 text-slate-600 shadow-none border-none text-[9px] font-black rounded-md px-1.5">
                                                                                {item.category}
                                                                            </Badge>
                                                                        </TableCell>
                                                                        <TableCell className="text-sm font-medium text-slate-700 py-3">
                                                                            {item.description}
                                                                        </TableCell>

                                                                        <TableCell className="text-right font-black text-slate-900 pr-6">
                                                                            {item.amount.toLocaleString()}
                                                                        </TableCell>
                                                                    </TableRow>
                                                                ))}
                                                            </TableBody>
                                                        </Table>
                                                        <div className="flex justify-between items-center p-4 bg-slate-50/30 border-t border-slate-100">
                                                            <div className="text-[10px] font-bold text-slate-400 uppercase italic">
                                                                Ledger finalized by {group.items[0].addedBy}
                                                            </div>
                                                            <Button 
                                                                variant="outline" 
                                                                size="sm" 
                                                                className="rounded-xl h-8 text-xs font-black shadow-none border-slate-200"
                                                                onClick={() => {
                                                                    setSelectedDate(group.date);
                                                                    setViewMode('day');
                                                                }}
                                                            >
                                                                Manage Transactions <Plus className="ml-1 h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                        );
                                    })}
                                </Accordion>

                                <Card className="relative overflow-hidden bg-slate-900 rounded-[2rem] border-none shadow-2xl mt-8">
                                    <div className="absolute inset-0 bg-gradient-to-r from-red-600/20 to-transparent" />
                                    <div className="flex justify-between items-center px-10 py-8 relative z-10">
                                        <div className="space-y-1">
                                            <span className="text-[10px] uppercase font-black text-red-500 tracking-[0.3em] block">Consolidated Outflow</span>
                                            <span className="text-slate-400 text-sm font-medium">
                                                Based on <span className="text-white font-black">{stats.currentCount}</span> validated transactions in the requested timeline
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[10px] uppercase font-black text-slate-500 tracking-widest mb-1">Grand Total</div>
                                            <div className="text-4xl font-black text-white tracking-tighter">
                                                <span className="text-sm text-red-500 mr-1">Rs</span>
                                                {stats.currentTotal.toLocaleString()}
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            </div>
                        )
                    )}
                </CardContent>
            </Card>

            {/* Previous Expenses Log (Optional visually separated section) */}
            {olderExpensesList.length > 0 && (
                <Card className="opacity-75">
                    <CardHeader>
                        <CardTitle className="text-lg">Previous Expenses</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead className="text-right">Amount (Rs)</TableHead>
                                    <TableHead className="w-[100px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {olderExpensesList.slice(0, 50).map((expense) => ( // show only last 50
                                    <TableRow key={expense.id}>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {format(new Date(expense.timestamp), 'PP')}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{expense.category}</Badge>
                                        </TableCell>
                                        <TableCell className="max-w-[200px] truncate" title={expense.description}>
                                            {expense.description}
                                        </TableCell>

                                        <TableCell className="text-right font-bold text-red-600">
                                            - {expense.amount.toLocaleString()}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center justify-end gap-2">
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500">
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Delete Older Expense?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                This action cannot be undone. This will permanently delete the record for Rs {expense.amount} from {format(new Date(expense.timestamp), 'PP')}.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={() => handleDeleteExpense(expense.id!)}>Delete</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

        </div>
    );
}
