'use client';

import * as React from 'react';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    CardFooter,
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
import { Separator } from '@/components/ui/separator';
import {
    useCollection,
    useFirestore,
    useMemoFirebase,
    useUser
} from '@/firebase';
import { collection, query, orderBy, where, doc, setDoc } from 'firebase/firestore';
import {
    Calendar,
    Users,
    Activity,
    CreditCard,
    DollarSign,
    Printer,
    FileText,
    TrendingUp,
    PieChart,
    Loader2,
    Receipt,
    ShieldAlert,
    CheckCircle2,
    Smartphone,
    HandCoins,
    Boxes
} from 'lucide-react';
import { format, isToday, startOfDay, endOfDay, isSameDay, isSameMonth, isSameYear, isWithinInterval } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { DatePickerWithRange } from '@/components/DatePickerWithRange';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatePicker } from "@/components/DatePicker";
import { safeDate, safeFormat } from '@/lib/safe-date';
import type { Supplier, PharmacyItem } from '@/lib/types';

interface BillItem {
    id: string;
    name: string;
    type: 'procedure' | 'pharmacy' | 'custom';
    price: number;
    qty: number;
}

interface BillingRecord {
    id: string;
    patientId: string;
    patientName: string;
    patientMobile: string;
    items: BillItem[];
    grandTotal: number;
    paymentMethod: string;
    timestamp: string; // ISO String
}

interface DailyClosing {
    id: string;
    date: string; // YYYY-MM-DD
    cashHandedOver: number;
    savedAt: string;
    savedBy: string;
}

export default function TodaySummaryPage() {
    const firestore = useFirestore();
    const { user } = useUser();
    const [selectedDate, setSelectedDate] = React.useState<Date>(new Date());
    const [periodMode, setPeriodMode] = React.useState<'Day' | 'Month' | 'Year' | 'Range'>('Day');

    const billingQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        // Fetch all recent records and filter in JS for simplicity with dates if needed, 
        // or use a query if Firestore indexes allow.
        return query(collection(firestore, 'billingRecords'), orderBy('timestamp', 'desc'));
    }, [firestore]);

    const { data: allRecords, isLoading: billingLoading } = useCollection<BillingRecord>(billingQuery);

    // Fetch Daily Closing for the selected date
    const selectedDateKey = format(selectedDate, 'yyyy-MM-dd');
    const closingQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'dailyClosings'), where('date', '==', selectedDateKey));
    }, [firestore, selectedDateKey]);

    const { data: closings, isLoading: closingsLoading } = useCollection<DailyClosing>(closingQuery);
    const existingClosing = closings?.[0];

    const allClosingsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'dailyClosings'));
    }, [firestore]);

    const { data: allClosings, isLoading: allClosingsLoading } = useCollection<DailyClosing>(allClosingsQuery);

    const suppliersRef = useMemoFirebase(() => firestore ? collection(firestore, 'suppliers') : null, [firestore]);
    const { data: suppliers, isLoading: isSuppliersLoading } = useCollection<Supplier>(suppliersRef);

    const pharmacyRef = useMemoFirebase(() => firestore ? collection(firestore, 'pharmacyItems') : null, [firestore]);
    const { data: pharmacyItems, isLoading: isPharmacyLoading } = useCollection<PharmacyItem>(pharmacyRef);

    const inventoryItems = React.useMemo(() => {
        if (!suppliers || !pharmacyItems) return [];
        const items: any[] = [];
        const processedNames = new Set<string>();

        // 1. Process Master Ledger (Suppliers)
        suppliers.forEach(s => {
            s.products?.forEach(p => {
                const nameKey = p.name.trim().toLowerCase();
                // Find matching item in Pharmacy POS
                const piMatch = pharmacyItems.find(pi => (pi.productName || pi.name || '').trim().toLowerCase() === nameKey);
                
                // Promote the maximum quantity, selling price, and purchase price
                const currentQty = Math.max(Number(p.quantity || 0), Number(piMatch?.quantity || 0));
                const currentSelling = Math.max(Number(p.sellingPrice || 0), Number(piMatch?.sellingPrice || 0));
                const currentPurchase = Math.max(Number(p.price || 0), Number(piMatch?.purchasePrice || 0));

                items.push({ 
                    ...p, 
                    quantity: currentQty,
                    sellingPrice: currentSelling,
                    purchasePrice: currentPurchase,
                    supplierName: s.name, 
                    supplierId: s.id,
                    rack: p.rack || piMatch?.rack || '',
                    category: s.category || 'General'
                });
                processedNames.add(nameKey);
            });
        });

        // 2. Catch orphan items in Pharmacy POS that don't exist in Master Ledger
        pharmacyItems.forEach(pi => {
            const nameKey = (pi.productName || pi.name || '').trim().toLowerCase();
            if (nameKey && !processedNames.has(nameKey)) {
                items.push({
                    id: pi.id,
                    name: pi.productName || pi.name || 'Unnamed Product',
                    quantity: pi.quantity || 0,
                    sellingPrice: pi.sellingPrice || 0,
                    purchasePrice: pi.purchasePrice || 0,
                    supplierName: pi.supplier || 'Unlinked',
                    supplierId: pi.supplierId || 'unlinked',
                    rack: pi.rack || '',
                    minThreshold: 0,
                    category: pi.category || 'General'
                });
                processedNames.add(nameKey);
            }
        });

        return items;
    }, [suppliers, pharmacyItems]);

    const totalInventoryValueSelling = React.useMemo(() => {
        return inventoryItems.reduce((acc, item) => acc + (Number(item.sellingPrice || 0) * Number(item.quantity || 0)), 0);
    }, [inventoryItems]);

    const totalInventoryValuePurchase = React.useMemo(() => {
        return inventoryItems.reduce((acc, item) => acc + (Number(item.purchasePrice || 0) * Number(item.quantity || 0)), 0);
    }, [inventoryItems]);

    const [sessionUnlocked, setSessionUnlocked] = React.useState(false);

    // Require blind verification: Do NOT pre-fill or auto-unlock based on existingClosing.
    React.useEffect(() => {
        setCashHandedOver('');
        setSessionUnlocked(false);
    }, [selectedDateKey]);

    const isReportUnlocked = (sessionUnlocked || periodMode !== 'Day');

    // Filter State
    const [cashHandedOver, setCashHandedOver] = React.useState<string>('');
    const [isSavingCash, setIsSavingCash] = React.useState(false);
    const [selectedMonth, setSelectedMonth] = React.useState<string>(format(new Date(), 'MM'));
    const [selectedYear, setSelectedYear] = React.useState<string>(format(new Date(), 'yyyy'));
    const [selectedRange, setSelectedRange] = React.useState<DateRange | undefined>({
        from: startOfDay(new Date()),
        to: endOfDay(new Date()),
    });

    const expensesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'expenses'), orderBy('timestamp', 'desc'));
    }, [firestore]);

    const { data: allExpenses, isLoading: expensesLoading } = useCollection<any>(expensesQuery);

    const filteredRecords = React.useMemo(() => {
        if (!allRecords) return [];
        return allRecords.filter(record => {
            const date = safeDate(record.timestamp);
            if (!date) return false;
            if (periodMode === 'Day') {
                return isSameDay(date, selectedDate);
            } else if (periodMode === 'Month') {
                const targetMonth = new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1);
                return isSameMonth(date, targetMonth) && isSameYear(date, targetMonth);
            } else if (periodMode === 'Year') {
                return isSameYear(date, new Date(parseInt(selectedYear), 0));
            } else if (periodMode === 'Range' && selectedRange?.from && selectedRange?.to) {
                return isWithinInterval(date, { start: startOfDay(selectedRange.from), end: endOfDay(selectedRange.to) });
            }
            return false;
        });
    }, [allRecords, periodMode, selectedDate, selectedMonth, selectedYear, selectedRange]);

    const filteredClosings = React.useMemo(() => {
        if (!allClosings) return [];
        return allClosings.filter(c => {
            const date = safeDate(c.date);
            if (!date) return false;
            
            if (periodMode === 'Day') {
                return isSameDay(date, selectedDate);
            } else if (periodMode === 'Month') {
                const targetMonth = new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1);
                return isSameMonth(date, targetMonth) && isSameYear(date, targetMonth);
            } else if (periodMode === 'Year') {
                return isSameYear(date, new Date(parseInt(selectedYear), 0));
            } else if (periodMode === 'Range' && selectedRange?.from && selectedRange?.to) {
                return isWithinInterval(date, { start: startOfDay(selectedRange.from), end: endOfDay(selectedRange.to) });
            }
            return false;
        });
    }, [allClosings, periodMode, selectedDate, selectedMonth, selectedYear, selectedRange]);

    const filteredExpenses = React.useMemo(() => {
        if (!allExpenses) return [];
        return allExpenses.filter((e: any) => {
            const dateStr = e.timestamp || e.date || e.createdAt;
            const date = safeDate(dateStr);
            if (!date) return false;
            if (periodMode === 'Day') {
                return isSameDay(date, selectedDate);
            } else if (periodMode === 'Month') {
                const targetMonth = new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1);
                return isSameMonth(date, targetMonth) && isSameYear(date, targetMonth);
            } else if (periodMode === 'Year') {
                return isSameYear(date, new Date(parseInt(selectedYear), 0));
            } else if (periodMode === 'Range' && selectedRange?.from && selectedRange?.to) {
                return isWithinInterval(date, { start: startOfDay(selectedRange.from), end: endOfDay(selectedRange.to) });
            }
            return false;
        });
    }, [allExpenses, periodMode, selectedDate, selectedMonth, selectedYear, selectedRange]);

    const periodLabel = React.useMemo(() => {
        if (periodMode === 'Day') return format(selectedDate, 'PPPP');
        if (periodMode === 'Month') return format(new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1), 'MMMM yyyy');
        if (periodMode === 'Year') return selectedYear;
        if (periodMode === 'Range' && selectedRange?.from && selectedRange?.to) {
            return `${format(selectedRange.from, 'PPP')} - ${format(selectedRange.to, 'PPP')}`;
        }
        return 'Selected Period';
    }, [periodMode, selectedDate, selectedMonth, selectedYear, selectedRange]);

    const stats = React.useMemo(() => {
        const totalRevenue = filteredRecords.reduce((sum, r) => sum + Number(r.grandTotal || 0), 0);
        const totalTax = filteredRecords.reduce((sum, r) => sum + Number(r.taxAmount || 0), 0);
        const totalExpenses = filteredExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
        const uniquePatients = new Set(filteredRecords.map(r => r.patientId)).size;

        // Group procedures
        const proceduresMap: { [key: string]: { count: number, revenue: number } } = {};
        const paymentsMap: { [key: string]: { count: number, amount: number } } = {};
        const expenseCategoriesMap: { [key: string]: number } = {};

        let physicalCashRevenue = 0;
        let onlineCashRevenue = 0;
        let physicalCashExpenses = 0;
        let digitalExpenses = 0;
        
        filteredRecords.forEach(record => {
            // Count procedures
            record.items?.forEach(item => {
                if (item.type === 'procedure') {
                    if (!proceduresMap[item.name]) {
                        proceduresMap[item.name] = { count: 0, revenue: 0 };
                    }
                    proceduresMap[item.name].count += item.qty;
                    proceduresMap[item.name].revenue += item.price * item.qty;
                }
            });

            // Count payments
            const method = (record.paymentMethod || 'Unknown').trim().toLowerCase();
            const amount = Number(record.grandTotal || 0);
            
            // Binary classification: Physical (Cash) vs Digital (Everything else)
            if (method.includes('cash')) {
                physicalCashRevenue += amount;
            } else {
                // Includes Online, Card, Nill (Online), etc.
                onlineCashRevenue += amount;
            }
            
            const originalMethod = record.paymentMethod || 'Unknown';
            if (!paymentsMap[originalMethod]) {
                paymentsMap[originalMethod] = { count: 0, amount: 0 };
            }
            paymentsMap[originalMethod].count += 1;
            paymentsMap[originalMethod].amount += amount;
        });

        filteredExpenses.forEach(e => {
            const cat = e.category || 'General';
            expenseCategoriesMap[cat] = (expenseCategoriesMap[cat] || 0) + Number(e.amount || 0);
            
            const method = (e.paymentMethod || 'Cash').trim().toLowerCase();
            const amt = Number(e.amount || 0);
            if (method.includes('cash')) {
                physicalCashExpenses += amt;
            } else {
                digitalExpenses += amt;
            }
        });

        // Final Channel Reconciliation
        // Handover = Physical Cash Revenue minus ONLY physical cash expenses (actual cash in drawer)
        const netPhysicalCash = physicalCashRevenue - physicalCashExpenses;
        // Digital ledger tracks card/online revenue vs card/digital expenses
        const netOnlineCash = onlineCashRevenue - digitalExpenses;

        const totalPhysicalCashHandover = filteredClosings.reduce((sum, c) => sum + (c.cashHandedOver || 0), 0);

        return {
            totalRevenue,
            totalExpenses,
            netProfit: totalRevenue - totalExpenses,
            uniquePatients,
            procedures: Object.entries(proceduresMap).map(([name, data]) => ({ name, ...data })),
            payments: Object.entries(paymentsMap).map(([method, data]) => ({ 
                method: method === 'Nill' ? 'Complementary (Nill)' : method, 
                ...data 
            })),
            expenseCategories: Object.entries(expenseCategoriesMap).map(([name, amount]) => ({ name, amount })),
            totalTransactions: filteredRecords.length,
            // Actual physical cash in drawer
            expectedCash: netPhysicalCash, 
            physicalCashRevenue,
            physicalCashExpenses,
            // Online/Digital Ledger
            onlineCashRevenue,
            digitalExpenses,
            netOnlineCash,
            // Handover History
            totalPhysicalCash: totalPhysicalCashHandover,
            totalTax,
            // Total Pharmacy/Inventory Sales
            totalSoldInventory: filteredRecords.reduce((sum, record) => {
                const pharmacyItemsSum = record.items?.filter(item => item.type === 'pharmacy')
                    .reduce((pSum, item) => pSum + (Number(item.price || 0) * Number(item.qty || 0)), 0) || 0;
                return sum + pharmacyItemsSum;
            }, 0),
        };
    }, [filteredRecords, filteredExpenses, filteredClosings]);

    const handleSaveCash = async () => {
        if (!firestore || !user || !cashHandedOver) return;
        setIsSavingCash(true);
        try {
            const amount = parseFloat(cashHandedOver);
            if (isNaN(amount)) throw new Error("Invalid amount");

            const closingRef = doc(collection(firestore, 'dailyClosings'), selectedDateKey);
            await setDoc(closingRef, {
                date: selectedDateKey,
                cashHandedOver: amount,
                savedAt: new Date().toISOString(),
                savedBy: user.name || user.email,
            });
            setSessionUnlocked(true);
        } catch (error) {
            console.error("Error saving cash:", error);
        } finally {
            setIsSavingCash(false);
        }
    };

    const handleVerifySession = () => {
        setSessionUnlocked(true);
    };

    const handlePrint = () => {
        if (!isReportUnlocked) return;
        window.print();
    };

    if (billingLoading || closingsLoading || expensesLoading || allClosingsLoading || isSuppliersLoading || isPharmacyLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-[400px] gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground animate-pulse">Calculating today's clinical performance...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 p-4">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
                <div className="flex-1">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-200 text-white">
                            <Activity className="h-6 w-6" />
                        </div>
                        <div>
                            <h2 className="text-4xl font-black tracking-tight text-slate-900 leading-none">
                                Clinical Performance Summary
                            </h2>
                            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-2 opacity-60">
                                Viewing reports for <span className="text-indigo-600">{periodLabel}</span>
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 bg-white/50 backdrop-blur-md p-2 rounded-2xl border border-slate-200 shadow-sm">
                    <Tabs value={periodMode} onValueChange={(v: any) => setPeriodMode(v)} className="w-[320px]">
                        <TabsList className="grid w-full grid-cols-4 h-9 bg-slate-100 rounded-xl">
                            <TabsTrigger value="Day" className="text-xs font-bold rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Day</TabsTrigger>
                            <TabsTrigger value="Month" className="text-xs font-bold rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Month</TabsTrigger>
                            <TabsTrigger value="Year" className="text-xs font-bold rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Year</TabsTrigger>
                            <TabsTrigger value="Range" className="text-xs font-bold rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Range</TabsTrigger>
                        </TabsList>
                    </Tabs>

                    {periodMode === 'Range' && (
                        <DatePickerWithRange date={selectedRange} onDateChange={setSelectedRange} />
                    )}
                    
                    {periodMode === 'Day' && (
                        <DatePicker date={selectedDate} onDateChange={setSelectedDate as any} />
                    )}

                    <Button 
                        onClick={handlePrint} 
                        disabled={!isReportUnlocked}
                        variant="default" 
                        className="gap-2 h-9 rounded-xl bg-slate-900 hover:bg-slate-800 text-white shadow-lg"
                    >
                        <Printer className="h-4 w-4" /> {!isReportUnlocked ? 'Unlock to Print' : 'Print Report'}
                    </Button>
                </div>
            </div>

            {/* Cash Handed Over Section (Mandatory for Day view) */}
            {periodMode === 'Day' && (
                <div className="print:hidden">
                    <Card className={`border-none ${existingClosing ? 'bg-emerald-50' : 'bg-amber-50'} shadow-xl transition-all duration-500 rounded-[2.5rem] overflow-hidden`}>
                        <CardContent className="p-8">
                            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                                <div className="space-y-2">
                                    <h3 className={`text-xl font-black ${existingClosing ? 'text-emerald-900' : 'text-amber-900'} tracking-tight`}>
                                        {existingClosing ? 'Cash Verification Confirmed' : 'Physical Cash Verification Required'}
                                    </h3>
                                    <p className="text-sm font-bold text-slate-500 opacity-60">Enter the exact physical cash amount handed over at session close.</p>
                                </div>
                                    <div className="flex flex-col gap-1 w-full md:w-auto">
                                        <div className="flex items-center justify-between px-2 gap-4">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Physical Cash Input</span>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">
                                                Gross Cash: {stats.physicalCashRevenue.toLocaleString()} | Exp: -{stats.physicalCashExpenses.toLocaleString()} | Net: Rs {stats.expectedCash.toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="relative flex-1 md:w-64">
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">Rs</div>
                                            <input
                                                type="number"
                                                value={cashHandedOver}
                                                onChange={(e) => setCashHandedOver(e.target.value)}
                                                placeholder="Enter amount..."
                                                className="w-full pl-12 pr-4 py-4 bg-white border-2 border-slate-200 rounded-[1.5rem] font-black text-xl shadow-inner focus:outline-none focus:border-indigo-500 transition-all"
                                                disabled={sessionUnlocked}
                                            />
                                        </div>
                                    </div>
                                    {!sessionUnlocked ? (
                                        <Button
                                            onClick={handleSaveCash}
                                            disabled={isSavingCash || !cashHandedOver}
                                            className={`h-[3.75rem] px-8 ${existingClosing && cashHandedOver !== existingClosing.cashHandedOver.toString() ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600 hover:bg-indigo-700'} text-white font-black rounded-[1.5rem] shadow-lg shadow-indigo-200`}
                                        >
                                            {isSavingCash ? <Loader2 className="animate-spin" /> : (existingClosing && cashHandedOver !== existingClosing.cashHandedOver.toString() ? 'UPDATE CASH & UNLOCK' : 'SAVE & UNLOCK')}
                                        </Button>
                                    ) : (
                                        <div className="flex gap-2">
                                            <div className="p-4 bg-emerald-600 text-white rounded-[1.5rem] shadow-lg shadow-emerald-200 flex items-center gap-2">
                                                <div className="p-2 bg-white/20 rounded-lg"><CheckCircle2 className="h-4 w-4" /></div>
                                                <div>
                                                    <div className="text-[10px] font-black uppercase tracking-widest opacity-80 leading-none mb-1">Status</div>
                                                    <div className="text-sm font-bold tracking-tight">Access Granted</div>
                                                </div>
                                            </div>
                                            <Button 
                                                variant="outline" 
                                                onClick={() => {
                                                    setSessionUnlocked(false);
                                                    setCashHandedOver('');
                                                }}
                                                className="h-[3.75rem] px-6 rounded-[1.5rem] border-2 border-slate-200 text-slate-600 font-bold hover:bg-slate-50"
                                            >
                                                Edit Amount
                                            </Button>
                                        </div>
                                    )}
                                </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Dashboard Content */}
            <div className="animate-in fade-in duration-1000">
                {/* Print Only Cash Info */}
                <div className="hidden print:block mb-10 p-8 border-4 border-black rounded-[2.5rem] bg-slate-50 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-5">
                            <CheckCircle2 className="h-32 w-32" />
                        </div>
                        <div className="flex justify-between items-center relative z-10">
                            <div className="space-y-2">
                                <div className="inline-flex items-center gap-2 px-3 py-1 bg-black text-white text-[10px] font-black uppercase tracking-widest rounded-full">
                                    <CheckCircle2 className="h-3 w-3" /> Mandatory Verification
                                </div>
                                <h1 className="text-4xl font-black uppercase tracking-tight">Verification Report</h1>
                                <p className="text-sm font-bold text-slate-500 font-mono">Date Reference: {selectedDateKey}</p>
                            </div>
                            <div className="text-right flex items-center gap-8">
                                <div className="space-y-1">
                                    <p className="text-xs font-black uppercase text-slate-400 mb-1">Gross Cash Inflow</p>
                                    <p className="text-2xl font-black text-slate-400 tracking-tighter">Rs {stats.physicalCashRevenue.toLocaleString()}</p>
                                </div>
                                <div className="space-y-1 ml-8">
                                    <p className="text-xs font-black uppercase text-rose-400 mb-1">Cash Expenses</p>
                                    <p className="text-2xl font-black text-rose-400 tracking-tighter">- {stats.physicalCashExpenses.toLocaleString()}</p>
                                </div>
                                <div className="space-y-1 ml-8">
                                    <p className="text-xs font-black uppercase text-indigo-600 mb-1">Net Physical Handover</p>
                                    <p className="text-6xl font-black text-black tracking-tighter">Rs {(periodMode === 'Day' ? parseFloat(cashHandedOver || '0') : stats.totalPhysicalCash).toLocaleString()}</p>
                                </div>
                            </div>
                        </div>
                    </div>


            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-emerald-50/50 border-none shadow-xl shadow-emerald-100/20 rounded-[2rem] overflow-hidden group hover:scale-[1.02] transition-all">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-emerald-700 font-bold uppercase tracking-widest text-[9px]">Gross Inflow</CardDescription>
                        <CardTitle className="text-4xl font-black text-emerald-900 tracking-tighter">{stats.totalRevenue.toLocaleString()} <span className="text-xs font-bold opacity-40">PKR</span></CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-black uppercase tracking-tight">
                                <TrendingUp className="h-3 w-3" /> {stats.totalTransactions} Orders Completed
                            </div>
                            {stats.totalTax > 0 && (
                                <div className="text-[10px] font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100">
                                    {stats.totalTax.toLocaleString()} GST
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-rose-50/50 border-none shadow-xl shadow-rose-100/20 rounded-[2rem] overflow-hidden group hover:scale-[1.02] transition-all">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-rose-700 font-bold uppercase tracking-widest text-[9px]">Total Expenses</CardDescription>
                        <CardTitle className="text-4xl font-black text-rose-900 tracking-tighter">{stats.totalExpenses.toLocaleString()} <span className="text-xs font-bold opacity-40">PKR</span></CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-1 text-[10px] text-rose-600 font-black uppercase tracking-tight">
                            <Receipt className="h-3 w-3" /> {filteredExpenses.length} Line Items
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-indigo-600 border-none shadow-xl shadow-indigo-200 rounded-[2rem] overflow-hidden group hover:scale-[1.02] transition-all">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-indigo-100 font-bold uppercase tracking-widest text-[9px]">Overall Net Profit</CardDescription>
                        <CardTitle className="text-4xl font-black text-white tracking-tighter">
                            {stats.netProfit.toLocaleString()} <span className="text-xs font-bold opacity-40">PKR</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-1 text-[10px] text-indigo-100 font-black uppercase tracking-tight">
                            <CreditCard className="h-3 w-3" /> Total Inflow - Total Outflow
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-slate-900 border-none shadow-xl shadow-slate-200 rounded-[2rem] overflow-hidden group hover:scale-[1.02] transition-all">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-slate-400 font-bold uppercase tracking-widest text-[9px]">Physical Cash (Net)</CardDescription>
                        <CardTitle className="text-4xl font-black text-white tracking-tighter">{stats.expectedCash.toLocaleString()} <span className="text-xs font-bold opacity-40">PKR</span></CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 font-black uppercase tracking-tight">
                            <HandCoins className="h-3 w-3" /> Cash Rev - Cash Exp
                        </div>
                    </CardContent>
                </Card>



                {/* Cash vs Expected Handover */}
                {periodMode === 'Day' && Math.abs(parseFloat(cashHandedOver || '0') - stats.expectedCash) > 1 && (
                    <Card className="bg-rose-600 border-none shadow-xl shadow-rose-200 rounded-[2rem] overflow-hidden col-span-1 md:col-span-3 lg:col-span-5 animate-pulse">
                        <CardContent className="p-6 flex items-center justify-between text-white">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-white/20 rounded-2xl">
                                    <ShieldAlert className="h-8 w-8" />
                                </div>
                                <div>
                                    <h4 className="text-xl font-black tracking-tight">Handover Discrepancy Alert!</h4>
                                    <p className="font-bold opacity-90 text-sm">
                                        The physical cash entered does not match the system record. After deducting physical cash expenses (Rs {stats.physicalCashExpenses.toLocaleString()}), the counter should have exactly <span className="underline decoration-white/50">Rs {stats.expectedCash.toLocaleString()}</span> for handover.
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Handover Requirement</span>
                                <div className="text-2xl font-black">{stats.expectedCash.toLocaleString()} PKR</div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Inventory & Stock Summary */}
                <Card className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-none shadow-xl shadow-indigo-100/10 rounded-[2rem] overflow-hidden col-span-1 md:col-span-3 lg:col-span-5">
                    <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between text-white gap-6">
                        <div className="flex items-center gap-4 flex-1">
                            <div className="p-3 bg-white/10 rounded-2xl">
                                <Boxes className="h-8 w-8 text-indigo-400" />
                            </div>
                            <div className="space-y-1">
                                <h4 className="text-lg font-black tracking-tight text-white">Inventory & Stock Summary</h4>
                                <p className="text-xs font-bold text-slate-400 tracking-tight">
                                    Real-time tracking of pharmacy sales and remaining active inventory value.
                                </p>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-8 md:gap-12 w-full md:w-auto justify-between md:justify-end">
                            <div className="space-y-1">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    {periodMode === 'Day' ? 'Sold Today (Pharmacy)' : 'Sold in Period'}
                                </span>
                                <div className="text-2xl font-black text-emerald-400 tracking-tight">
                                    {stats.totalSoldInventory.toLocaleString()} <span className="text-xs font-bold opacity-60">PKR</span>
                                </div>
                            </div>
                            <div className="h-10 w-px bg-white/10 hidden md:block" />
                            <div className="space-y-1">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Remaining Stock Value</span>
                                <div className="text-2xl font-black text-indigo-300 tracking-tight">
                                    {totalInventoryValueSelling.toLocaleString()} <span className="text-xs font-bold opacity-60">PKR</span>
                                </div>
                                <div className="text-[9px] text-slate-500 font-bold">Cost Value: {totalInventoryValuePurchase.toLocaleString()} PKR</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-xl shadow-slate-100/50 rounded-[2rem] overflow-hidden group hover:scale-[1.02] transition-all bg-white border border-slate-100/50">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-slate-400 font-bold uppercase tracking-widest text-[9px]">Patient Flow</CardDescription>
                        <CardTitle className="text-4xl font-black text-slate-900 tracking-tighter">{stats.uniquePatients}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-1 text-[10px] text-slate-500 font-black uppercase tracking-tight">
                            <Users className="h-3 w-3" /> Unique Visitors
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-xl shadow-slate-100/50 rounded-[2rem] overflow-hidden group hover:scale-[1.02] transition-all bg-white border border-slate-100/50">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-slate-400 font-bold uppercase tracking-widest text-[9px]">Service Output</CardDescription>
                        <CardTitle className="text-4xl font-black text-slate-900 tracking-tighter">{stats.procedures.reduce((acc, curr) => acc + curr.count, 0)}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-1 text-[10px] text-slate-500 font-black uppercase tracking-tight">
                            <Activity className="h-3 w-3" /> Procedures Done
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                {/* Procedures Breakdown */}
                <Card className="border-none shadow-xl shadow-slate-100/50 rounded-[2.5rem] bg-white overflow-hidden border border-slate-100/30">
                    <CardHeader className="p-8">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="inline-flex items-center gap-2 text-xl font-black tracking-tight">
                                    <Activity className="h-5 w-5 text-indigo-500" />
                                    Medical Output
                                </CardTitle>
                                <CardDescription className="text-[10px] font-black uppercase tracking-widest opacity-60 mt-1">Services Provided</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <Separator />
                    <CardContent className="p-8 pt-6">
                        {stats.procedures.length === 0 ? (
                            <div className="h-48 flex flex-col items-center justify-center text-slate-300">
                                <Activity className="h-12 w-12 opacity-10 mb-2" />
                                <p className="text-xs font-bold uppercase tracking-widest">No service records</p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent border-slate-100">
                                        <TableHead className="font-black text-slate-900 uppercase text-[10px] tracking-widest">Procedure</TableHead>
                                        <TableHead className="font-black text-slate-900 uppercase text-[10px] tracking-widest text-center">Qty</TableHead>
                                        <TableHead className="font-black text-slate-900 uppercase text-[10px] tracking-widest text-right">Revenue</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {stats.procedures.map((proc, i) => (
                                        <TableRow key={i} className="border-slate-50 hover:bg-slate-50 transition-colors">
                                            <TableCell className="font-bold text-slate-700">{proc.name}</TableCell>
                                            <TableCell className="text-center">
                                                <Badge className="bg-indigo-50 text-indigo-600 border-none font-black">{proc.count}</Badge>
                                            </TableCell>
                                            <TableCell className="text-right font-black text-slate-900">{proc.revenue.toLocaleString()}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>

                {/* Revenue Breakdown */}
                <Card className="border-none shadow-xl shadow-slate-100/50 rounded-[2.5rem] bg-white overflow-hidden border border-slate-100/30">
                    <CardHeader className="p-8">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="inline-flex items-center gap-2 text-xl font-black tracking-tight">
                                    <PieChart className="h-5 w-5 text-emerald-500" />
                                    Payment Mix
                                </CardTitle>
                                <CardDescription className="text-[10px] font-black uppercase tracking-widest opacity-60 mt-1">Channel Contribution</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <Separator />
                    <CardContent className="p-8 pt-6">
                        {stats.payments.length === 0 ? (
                            <div className="h-48 flex flex-col items-center justify-center text-slate-300">
                                <CreditCard className="h-12 w-12 opacity-10 mb-2" />
                                <p className="text-xs font-bold uppercase tracking-widest">No payment records</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {stats.payments.map((pay, i) => (
                                    <div key={i} className="flex flex-col gap-2">
                                        <div className="flex justify-between items-end">
                                            <div className="flex flex-col">
                                                <span className="font-black text-slate-900 text-sm tracking-tight">{pay.method}</span>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">{pay.count} bills issued</span>
                                            </div>
                                            <span className="font-black text-emerald-600">{pay.amount.toLocaleString()} <span className="text-[10px] opacity-40">PKR</span></span>
                                        </div>
                                        <div className="w-full bg-slate-50 rounded-full h-3 overflow-hidden border border-slate-100 shadow-inner">
                                            <div
                                                className="bg-gradient-to-r from-emerald-500 to-emerald-600 h-full rounded-full transition-all duration-1000"
                                                style={{ width: `${(pay.amount / (stats.totalRevenue || 1)) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Expense Breakdown */}
                <Card className="border-none shadow-xl shadow-slate-100/50 rounded-[2.5rem] bg-white overflow-hidden border border-slate-100/30">
                    <CardHeader className="p-8">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="inline-flex items-center gap-2 text-xl font-black tracking-tight">
                                    <Receipt className="h-5 w-5 text-rose-500" />
                                    Audit Outflow
                                </CardTitle>
                                <CardDescription className="text-[10px] font-black uppercase tracking-widest opacity-60 mt-1">Operational Burn</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <Separator />
                    <CardContent className="p-8 pt-6">
                        {stats.expenseCategories.length === 0 ? (
                            <div className="h-48 flex flex-col items-center justify-center text-slate-300">
                                <Receipt className="h-12 w-12 opacity-10 mb-2" />
                                <p className="text-xs font-bold uppercase tracking-widest">No expense records</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {stats.expenseCategories.map((cat, i) => (
                                    <div key={i} className="flex flex-col gap-2">
                                        <div className="flex justify-between items-end">
                                            <div className="flex flex-col">
                                                <span className="font-black text-slate-900 text-sm tracking-tight capitalize">{cat.name}</span>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">Operational Cost</span>
                                            </div>
                                            <span className="font-black text-rose-600">{cat.amount.toLocaleString()} <span className="text-[10px] opacity-40">PKR</span></span>
                                        </div>
                                        <div className="w-full bg-slate-50 rounded-full h-3 overflow-hidden border border-slate-100 shadow-inner">
                                            <div
                                                className="bg-gradient-to-r from-rose-500 to-rose-600 h-full rounded-full transition-all duration-1000"
                                                style={{ width: `${(cat.amount / (stats.totalExpenses || 1)) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                                <Separator className="my-4" />
                                <div className="p-3 bg-rose-50 rounded-2xl border border-rose-100">
                                    <div className="text-[9px] font-black uppercase text-rose-600 tracking-widest mb-1">Total Operational Burn</div>
                                    <div className="text-sm font-black text-rose-900">Rs {stats.totalExpenses.toLocaleString()}</div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Detailed Visit Log */}
            <Card>
                <CardHeader>
                                <CardTitle className="inline-flex items-center gap-2 text-xl font-black tracking-tight text-indigo-600">
                                    <Users className="h-5 w-5" />
                                    Detailed Patient Flow Audit
                                </CardTitle>
                                <CardDescription className="text-[10px] font-black uppercase tracking-widest opacity-60 mt-1">Session Transaction Logs</CardDescription>
                </CardHeader>
                <Separator />
                <CardContent className="pt-4">
                    {filteredRecords.length === 0 ? (
                        <div className="flex flex-col items-center justify-center text-muted-foreground py-12">
                            <Users className="h-12 w-12 opacity-10 mb-2" />
                            <p className="italic">No patient visits recorded for this period.</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent border-slate-100">
                                    <TableHead className="font-black text-slate-900 uppercase text-[10px] tracking-widest">Time</TableHead>
                                    <TableHead className="font-black text-slate-900 uppercase text-[10px] tracking-widest text-center">Reference</TableHead>
                                    <TableHead className="font-black text-slate-900 uppercase text-[10px] tracking-widest">Patient / Client</TableHead>
                                    <TableHead className="font-black text-slate-900 uppercase text-[10px] tracking-widest text-center">Tax</TableHead>
                                    <TableHead className="font-black text-slate-900 uppercase text-[10px] tracking-widest text-right">Inflow (PKR)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredRecords.map((record) => (
                                    <TableRow key={record.id} className="border-slate-50 hover:bg-slate-50 transition-colors h-16">
                                        <TableCell className="text-xs font-black text-slate-400">
                                            {safeFormat(record.timestamp, 'p')}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="outline" className="text-[9px] font-black uppercase text-slate-300 border-slate-100">#{record.id?.slice(-4)}</Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-black text-slate-900 tracking-tight">{record.patientName}</div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{record.patientMobile}</div>
                                        </TableCell>

                                        <TableCell className="text-center font-bold text-rose-600 bg-rose-50/50 rounded-lg">
                                            {(record.taxAmount || 0).toLocaleString()}
                                        </TableCell>
                                        <TableCell className="text-right font-black text-slate-900">
                                            {record.grandTotal.toLocaleString()}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Detailed Expense Log */}
            <Card className="border-none shadow-xl shadow-slate-100/50 rounded-[2.5rem] bg-white overflow-hidden border border-slate-100/30">
                <CardHeader className="p-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="inline-flex items-center gap-2 text-xl font-black tracking-tight text-rose-600">
                                <Receipt className="h-5 w-5" />
                                Detailed Expense Audit
                            </CardTitle>
                            <CardDescription className="text-[10px] font-black uppercase tracking-widest opacity-60 mt-1">Operational Outflow Logs</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <Separator />
                <CardContent className="p-8 pt-6">
                    {filteredExpenses.length === 0 ? (
                        <div className="flex flex-col items-center justify-center text-slate-300 py-12">
                            <Receipt className="h-12 w-12 opacity-10 mb-2" />
                            <p className="text-xs font-bold uppercase tracking-widest">No expense records for this period.</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent border-slate-100">
                                    <TableHead className="font-black text-slate-900 uppercase text-[10px] tracking-widest">Time</TableHead>
                                    <TableHead className="font-black text-slate-900 uppercase text-[10px] tracking-widest">Category</TableHead>
                                    <TableHead className="font-black text-slate-900 uppercase text-[10px] tracking-widest">Description</TableHead>
                                    <TableHead className="font-black text-slate-900 uppercase text-[10px] tracking-widest text-right">Outflow (PKR)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredExpenses.map((expense: any) => (
                                    <TableRow key={expense.id} className="border-slate-50 hover:bg-slate-50 transition-colors h-16">
                                        <TableCell className="text-xs font-black text-slate-400">
                                            {safeFormat(expense.timestamp || expense.createdAt || expense.date, 'p')}
                                        </TableCell>
                                        <TableCell>
                                            <Badge className="bg-rose-100 text-rose-700 font-black text-[10px] uppercase rounded-lg border-none px-2 py-0.5">
                                                {expense.category || 'General'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-black text-slate-900 tracking-tight capitalize">{expense.description || 'No description'}</div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Rec: {expense.recordedBy || 'System'}</div>
                                        </TableCell>

                                        <TableCell className="text-right font-black text-rose-600">
                                            {expense.amount?.toLocaleString()}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
            </div>

            {/* Print Only Section */}
            <div className="hidden print:block mt-8">
                <Separator className="my-8 border-black border-2" />
                <div className="flex justify-between items-start">
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <p className="text-[10px] font-black uppercase text-slate-400">Operations Sign-off</p>
                            <div className="w-48 h-12 border-b-2 border-black"></div>
                        </div>
                        <p className="text-xs font-bold text-slate-900 capitalize">Manager: {existingClosing?.savedBy || 'Not Verified'}</p>
                    </div>
                    <div className="text-right space-y-1">
                        <p className="font-black text-black uppercase tracking-widest text-xs">SkinSmith Clinic Intelligence</p>
                        <p className="text-[10px] font-bold text-slate-500">Verified Cycle Closing Report</p>
                        <p className="text-[10px] font-mono">Stamp: {new Date().toISOString()}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
