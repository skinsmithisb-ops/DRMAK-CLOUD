'use client';
import * as React from 'react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { DateRange } from 'react-day-picker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  isWithinInterval, 
  startOfDay, 
  endOfDay, 
  eachDayOfInterval,
  differenceInDays,
  add
} from 'date-fns';
import { cn } from '@/lib/utils';
import {
  File,
  Search,
  Download,
  Printer,
  User,
  PieChart as PieChartIcon,
  BarChart,
  FileText,
  Pencil,
  Eye,
  Boxes,
  ClipboardList,
  Stethoscope,
  Briefcase,
  Users2,
  CreditCard,
  Scissors,
  FileBarChart,
  HandCoins,
  Hourglass,
  ArrowRightLeft,
  Trash2,
  FileQuestion,
  BarChart3,
  Percent,
  TrendingUp,
  Receipt,
  MessageSquare,
  Sparkles,
  Lock,
  RotateCcw,
  Coins,
  History,
  Package,
} from 'lucide-react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  doc,
  setDoc
} from 'firebase/firestore';
import type { BillingRecord, Patient, Doctor, Supplier, SocialCost, SocialROAS, VendorTransaction } from '@/lib/types';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { DatePickerWithRange } from '@/components/DatePickerWithRange';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart as RechartsBarChart,
  Bar,
} from 'recharts';

export default function FinancialReportPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [selectedRange, setSelectedRange] = React.useState<DateRange | undefined>({
    from: new Date(),
    to: new Date(),
  });

  // Operational Data Fetching
  const billingQuery = useMemoFirebase(() => firestore ? collection(firestore, 'billingRecords') : null, [firestore]);
  const patientsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'patients') : null, [firestore]);
  const expensesQuery = useMemoFirebase(() => firestore ? collection(firestore, 'expenses') : null, [firestore]);
  const suppliersQuery = useMemoFirebase(() => firestore ? collection(firestore, 'suppliers') : null, [firestore]);
  const doctorsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'doctors') : null, [firestore]);
  const salariesQuery = useMemoFirebase(() => firestore ? collection(firestore, 'salaries') : null, [firestore]);
  const socialCostsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'socialCosts') : null, [firestore]);
  const socialRoasQuery = useMemoFirebase(() => firestore ? collection(firestore, 'socialROAS') : null, [firestore]);
  const vendorTransactionsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'vendorTransactions') : null, [firestore]);

  const { data: billingRecords } = useCollection<BillingRecord>(billingQuery);
  const { data: patients } = useCollection<Patient>(patientsQuery);
  const { data: allExpenses } = useCollection<any>(expensesQuery);
  const { data: allSuppliers } = useCollection<Supplier>(suppliersQuery);
  const { data: allDoctors } = useCollection<Doctor>(doctorsQuery);
  const { data: allSalaries } = useCollection<any>(salariesQuery);
  const { data: allSocialCosts } = useCollection<SocialCost>(socialCostsQuery);
  const { data: allSocialROAS } = useCollection<SocialROAS>(socialRoasQuery);
  const { data: allVendorTransactions } = useCollection<VendorTransaction>(vendorTransactionsQuery);

  const [historyDialogOpen, setHistoryDialogOpen] = React.useState(false);
  const [selectedSupplier, setSelectedSupplier] = React.useState<Supplier | null>(null);
  const [historyRange, setHistoryRange] = React.useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  // Derived Financial State
  const filteredBilling = React.useMemo(() => {
    const fromDate = selectedRange?.from;
    const toDate = selectedRange?.to || selectedRange?.from; // Fallback to 'from' for single date selection

    if (!billingRecords || !fromDate) return billingRecords || [];
    
    return billingRecords.filter(b => {
        const dateStr = b.timestamp || b.billingDate;
        if (!dateStr) return false;
        
        // Robust date parsing
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

  const financialKPIs = React.useMemo(() => {
    let physicalCashRevenue = 0;
    let onlineCashRevenue = 0;
    filteredBilling.forEach(b => {
        const amount = (b.grandTotal ?? b.totalAmount ?? ((b.consultationCharges || 0) + (b.procedureCharges || 0) + (b.medicineCharges || 0)));
        const method = (b.paymentMethod || 'Cash').trim().toLowerCase();
        if (method.includes('cash')) {
            physicalCashRevenue += amount;
        } else {
            onlineCashRevenue += amount;
        }
    });

    let physicalCashExpenses = 0;
    let onlineCashExpenses = 0;
    filteredExpenses.forEach((e: any) => {
        const amount = Number(e.amount || 0);
        const method = (e.paymentMethod || 'Cash').trim().toLowerCase();
        if (method.includes('cash')) {
            physicalCashExpenses += amount;
        } else {
            onlineCashExpenses += amount;
        }
    });

    const revenue = physicalCashRevenue + onlineCashRevenue;
    const burn = physicalCashExpenses + onlineCashExpenses;
    const debt = allSuppliers?.reduce((sum, s) => sum + ((s.currentBalance ?? (s as any).balance ?? (s as any).totalBalance) || 0), 0) || 0;
    
    return {
        grossRevenue: revenue,
        operationalBurn: burn,
        pendingVendorDebt: debt,
        netPosition: revenue - burn,
        physicalCashRevenue,
        onlineCashRevenue,
        physicalCashExpenses,
        onlineCashExpenses,
        netPhysicalCash: physicalCashRevenue - physicalCashExpenses,
        netOnlineCash: onlineCashRevenue - onlineCashExpenses
    };
  }, [filteredBilling, filteredExpenses, allSuppliers]);

  const transactionData = React.useMemo(() => {
    if (!filteredBilling || !patients) return [];
    const patientsMap = new Map(patients.map(p => [p.mobileNumber, p]));

    return filteredBilling.map(record => {
      const patient = record.patientMobileNumber ? patientsMap.get(record.patientMobileNumber) : undefined;
      const total = record.grandTotal ?? record.totalAmount ?? ((record.consultationCharges ?? 0) + (record.procedureCharges ?? 0) + (record.medicineCharges ?? 0));
      const dateStr = record.timestamp || record.billingDate;
      
      return {
        invoice: record.id.slice(0, 6).toUpperCase(),
        mrn: patient?.id?.slice(0, 8) || 'N/A',
        patientName: patient?.name || record.patientName || 'Unknown',
        referredBy: '-',
        description: `Charges: Consult(${record.consultationCharges ?? 0}), Proc(${record.procedureCharges ?? 0}), Med(${record.medicineCharges ?? 0})`,
        total: total,
        paid: total, // Assuming fully paid if recorded
        discount: record.discountAmount || 0,
        dues: 0.0,
        deductionsInsurance: 0.0,
        taxDeductions: 0.0,
        insuranceClaims: 0.0,
        advance: 0.0,
        paymentMode: record.paymentMethod || 'Unknown',
        doctorRevenue: '-',
        departmentRevenue: 'OPD',
        paymentDate: dateStr && !isNaN(new Date(dateStr).getTime()) ? format(new Date(dateStr), 'dd/MM/yyyy - hh:mm a') : 'N/A'
      };
    });
  }, [filteredBilling, patients]);

  const stats = React.useMemo(() => {
    const total = transactionData.reduce((acc, t) => acc + t.total, 0);
    return { totalRevenue: total, totalCash: total }; // Simplified
  }, [transactionData]);

  const chartData = React.useMemo(() => {
    if (!selectedRange?.from || !selectedRange?.to) return [];
    
    const daysDiff = differenceInDays(selectedRange.to, selectedRange.from);
    
    if (daysDiff > 1) {
      // Group by Day
      const days = eachDayOfInterval({ start: selectedRange.from, end: selectedRange.to });
      return days.map(day => {
        const dayStart = startOfDay(day);
        const dayEnd = endOfDay(day);
        
        const rev = filteredBilling.filter(b => {
          const d = b.timestamp || b.billingDate;
          return d && !isNaN(new Date(d).getTime()) && isWithinInterval(new Date(d), { start: dayStart, end: dayEnd });
        }).reduce((sum, b) => sum + (b.grandTotal ?? b.totalAmount ?? ((b.consultationCharges || 0) + (b.procedureCharges || 0) + (b.medicineCharges || 0))), 0);
          
        const burn = filteredExpenses.filter((e: any) => {
          const d = e.timestamp || e.date || e.createdAt;
          return d && !isNaN(new Date(d).getTime()) && isWithinInterval(new Date(d), { start: dayStart, end: dayEnd });
        }).reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
          
        return {
          name: format(day, 'MMM dd'),
          revenue: rev,
          burn: burn
        };
      });
    } else {
      // Group by Hour for a single day
      const hours = Array.from({ length: 24 }, (_, i) => {
        const hour = i;
        const rev = filteredBilling.filter(b => {
          const d = b.timestamp || b.billingDate;
          return d && !isNaN(new Date(d).getTime()) && new Date(d).getHours() === hour;
        }).reduce((sum, b) => sum + (b.grandTotal ?? b.totalAmount ?? ((b.consultationCharges || 0) + (b.procedureCharges || 0) + (b.medicineCharges || 0))), 0);
          
        const burn = filteredExpenses.filter((e: any) => {
          const d = e.timestamp || e.date || e.createdAt;
          return d && !isNaN(new Date(d).getTime()) && new Date(d).getHours() === hour;
        }).reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
          
        return {
          name: `${hour.toString().padStart(2, '0')}:00`,
          revenue: rev,
          burn: burn
        };
      });
      return hours.filter(h => h.revenue > 0 || h.burn > 0);
    }
  }, [filteredBilling, filteredExpenses, selectedRange]);

  const pieData = React.useMemo(() => {
    const modes: Record<string, number> = {};
    transactionData.forEach(t => {
      modes[t.paymentMode] = (modes[t.paymentMode] || 0) + t.total;
    });
    return Object.entries(modes).map(([name, value]) => ({ name, value }));
  }, [transactionData]);

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];
  const strategicMetrics = React.useMemo(() => {
    if (!billingRecords || !selectedRange?.from) return null;
    const fromDate = startOfDay(selectedRange.from);
    const toDate = endOfDay(selectedRange?.to || selectedRange?.from);

    const patientsInPeriod = new Set(filteredBilling.map(b => b.patientMobileNumber).filter(Boolean));
    
    // Pre-calculate earliest billing date for every patient
    const firstVisitMap = new Map<string, number>();
    billingRecords.forEach(b => {
        if (!b.patientMobileNumber) return;
        const d = new Date(b.timestamp || b.billingDate).getTime();
        if (isNaN(d)) return;
        if (!firstVisitMap.has(b.patientMobileNumber) || d < firstVisitMap.get(b.patientMobileNumber)!) {
            firstVisitMap.set(b.patientMobileNumber, d);
        }
    });

    let newCount = 0;
    let repeatCount = 0;

    patientsInPeriod.forEach(mobile => {
        const firstVisit = firstVisitMap.get(mobile);
        if (firstVisit && firstVisit >= fromDate.getTime() && firstVisit <= toDate.getTime()) {
            newCount++;
        } else {
            repeatCount++;
        }
    });

    // Churn Analysis (Lapsed Customers)
    // Patients who visited in the 180 days BEFORE the period start, but NOT during the period
    const churnLookbackDays = 180;
    const lookbackStart = add(fromDate, { days: -churnLookbackDays });
    
    const patientsInLookback = new Set<string>();
    billingRecords.forEach(b => {
        if (!b.patientMobileNumber) return;
        const d = new Date(b.timestamp || b.billingDate);
        if (isWithinInterval(d, { start: lookbackStart, end: fromDate })) {
            patientsInLookback.add(b.patientMobileNumber);
        }
    });

    const churnedCount = Array.from(patientsInLookback).filter(mobile => !patientsInPeriod.has(mobile)).length;
    const churnRate = patientsInLookback.size > 0 ? Math.round((churnedCount / patientsInLookback.size) * 100) : 0;

    // Social Media Costing Integration
    const overlappingMonths = new Set<string>();
    const start = fromDate;
    const end = toDate;
    
    // Simple month-key generation for overlap
    let current = startOfMonth(start);
    while (current <= end) {
        overlappingMonths.add(`${format(current, 'MMMM')}_${current.getFullYear()}`);
        current = add(current, { months: 1 });
    }

    const socialSpend = allSocialCosts?.filter(c => overlappingMonths.has(`${c.month}_${c.year}`)) || [];
    const totalSocialSpend = socialSpend.reduce((sum, c) => sum + (c.totalSpent || 0), 0);
    const socialSpendDetail = socialSpend.reduce((acc, c) => {
        acc.adSpend += (c.adSpend || 0);
        acc.boostingSpend += (c.boostingSpend || 0);
        acc.prSpend += (c.prSpend || 0);
        acc.otherSpend += (c.otherSpend || 0);
        return acc;
    }, { adSpend: 0, boostingSpend: 0, prSpend: 0, otherSpend: 0 });

    const socialRoasRecords = allSocialROAS?.filter(r => overlappingMonths.has(`${r.month}_${r.year}`)) || [];
    const totalSocialRevenue = socialRoasRecords.reduce((sum, r) => sum + (r.revenueFromConversions || 0), 0);

    // Deep EBITDA Calculation
    const expenseBreakdown = filteredExpenses.reduce((acc: any, e: any) => {
        const cat = e.category || 'Miscellaneous';
        acc[cat] = (acc[cat] || 0) + (e.amount || 0);
        return acc;
    }, {});

    // Add Salaries to EBITDA if not already in expenses (assuming they are separate)
    const salaryTotal = allSalaries?.reduce((sum: number, s: any) => {
        const d = new Date(s.timestamp || s.date || s.createdAt);
        if (isWithinInterval(d, { start: fromDate, end: toDate })) {
            return sum + (s.netSalary || s.amount || 0);
        }
        return sum;
    }, 0) || 0;

    // Estimate doctor shares (assuming 40% as seen in Doctor Dividends tab)
    const estimatedDoctorPayout = filteredBilling.reduce((sum, b) => {
        const total = b.grandTotal ?? b.totalAmount ?? 0;
        return sum + (total * 0.4);
    }, 0);

    const totalOpEx = financialKPIs.operationalBurn + salaryTotal + totalSocialSpend;
    const ebitda = financialKPIs.grossRevenue - totalOpEx;
    const ebitdaMargin = financialKPIs.grossRevenue > 0 ? (ebitda / financialKPIs.grossRevenue) * 100 : 0;

    // ─── 6-Month Monthly EBITDA Trend ──────────────────────────────────────
    const monthlyTrend = [];
    for (let i = 5; i >= 0; i--) {
        const targetDate = add(new Date(), { months: -i });
        const mStart = startOfDay(startOfMonth(targetDate));
        const mEnd = endOfDay(endOfMonth(targetDate));
        const monthLabel = format(targetDate, 'MMM yy');

        const mRevenue = billingRecords?.filter(b => {
            const d = new Date(b.timestamp || b.billingDate);
            return !isNaN(d.getTime()) && isWithinInterval(d, { start: mStart, end: mEnd });
        }).reduce((sum, b) => sum + (b.grandTotal ?? b.totalAmount ?? ((b.consultationCharges || 0) + (b.procedureCharges || 0) + (b.medicineCharges || 0))), 0) || 0;

        const mBurn = allExpenses?.filter((e: any) => {
            const d = new Date(e.timestamp || e.date || e.createdAt);
            return !isNaN(d.getTime()) && isWithinInterval(d, { start: mStart, end: mEnd });
        }).reduce((sum: number, e: any) => sum + (e.amount || 0), 0) || 0;

        const mSalaries = allSalaries?.filter((s: any) => {
            const d = new Date(s.timestamp || s.date || s.createdAt);
            return !isNaN(d.getTime()) && isWithinInterval(d, { start: mStart, end: mEnd });
        }).reduce((sum: number, s: any) => sum + (s.netSalary || s.amount || 0), 0) || 0;

        const mSocialKey = `${format(targetDate, 'MMMM')}_${targetDate.getFullYear()}`;
        const mSocialSpend = allSocialCosts?.filter(c => `${c.month}_${c.year}` === mSocialKey).reduce((sum, c) => sum + (c.totalSpent || 0), 0) || 0;

        const mOpEx = mBurn + mSalaries + mSocialSpend;
        const mEbitda = mRevenue - mOpEx;
        
        monthlyTrend.push({
            name: monthLabel,
            Revenue: mRevenue,
            OpEx: mOpEx,
            EBITDA: mEbitda
        });
    }

    return {
        newCustomers: newCount,
        repeatCustomers: repeatCount,
        churnedCustomers: churnedCount,
        churnRate,
        totalActive: patientsInPeriod.size,
        retentionRate: patientsInPeriod.size > 0 ? Math.round((repeatCount / patientsInPeriod.size) * 100) : 0,
        doctorPayout: estimatedDoctorPayout,
        netProfit: financialKPIs.netPosition - estimatedDoctorPayout - totalSocialSpend,
        ebitda,
        ebitdaMargin,
        expenseBreakdown,
        salaryTotal,
        totalOpEx,
        totalSocialSpend,
        socialSpendDetail,
        totalSocialRevenue,
        monthlyTrend
    };
  }, [billingRecords, filteredBilling, selectedRange, financialKPIs, allSalaries, allSocialCosts, allSocialROAS, allExpenses]);

  const currentMarketingSpend = React.useMemo(() => {
    const month = format(new Date(), 'MMMM');
    const year = new Date().getFullYear();
    const current = allSocialCosts?.find(c => c.month === month && c.year === year);
    return current || null;
  }, [allSocialCosts]);

  const roasData = React.useMemo(() => {
    const now = new Date();
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const months: {
        label: string; shortLabel: string; month: number; year: number;
        spend: number; revenue: number; roas: number;
        leadsGenerated: number; leadsConverted: number;
        costPerLead: number; conversionRate: number;
    }[] = [];

    for (let i = 5; i >= 0; i--) {
        const target = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const mIdx = target.getMonth();
        const yr = target.getFullYear();
        const monthName = monthNames[mIdx];
        const shortLabel = format(target, 'MMM');

        const roasReport = (allSocialROAS || []).find(r => r.month === monthName && r.year === yr);

        months.push({
            label: monthName,
            shortLabel,
            month: mIdx,
            year: yr,
            spend: roasReport?.totalAdSpend || 0,
            revenue: roasReport?.revenueFromConversions || 0,
            roas: roasReport?.roas || 0,
            leadsGenerated: roasReport?.leadsGenerated || 0,
            leadsConverted: roasReport?.leadsConverted || 0,
            costPerLead: roasReport?.costPerLead || 0,
            conversionRate: roasReport?.conversionRate || 0,
        });
    }

    const totalSpend = months.reduce((s, m) => s + m.spend, 0);
    const totalRevenue = months.reduce((s, m) => s + m.revenue, 0);
    const totalLeads = months.reduce((s, m) => s + m.leadsGenerated, 0);
    const totalConverted = months.reduce((s, m) => s + m.leadsConverted, 0);

    return {
        months,
        totalSpend,
        totalRevenue,
        totalLeads,
        totalConverted,
        overallRoas: totalSpend > 0 ? totalRevenue / totalSpend : 0,
        overallCPL: totalLeads > 0 ? totalSpend / totalLeads : 0,
        overallConvRate: totalLeads > 0 ? (totalConverted / totalLeads) * 100 : 0
    };
  }, [allSocialROAS]);

  const handleExport = (type: 'excel' | 'pdf') => {
    if (type === 'excel') {
      const data = [
        ['Financial Report', format(selectedRange?.from || new Date(), 'dd MMM yyyy') + ' - ' + format(selectedRange?.to || new Date(), 'dd MMM yyyy')],
        [''],
        ['Summary Metrics'],
        ['Gross Revenue', financialKPIs.grossRevenue],
        ['Operational Burn', financialKPIs.operationalBurn],
        ['Net Position', financialKPIs.netPosition],
        ['Vendor Debt', financialKPIs.pendingVendorDebt],
        [''],
        ['Strategic P&L'],
        ['EBITDA', strategicMetrics?.ebitda || 0],
        ['EBITDA Margin', (strategicMetrics?.ebitdaMargin || 0).toFixed(1) + '%'],
        ['Net Profit', strategicMetrics?.netProfit || 0],
      ];

      const ws = XLSX.utils.aoa_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Financial Summary");
      XLSX.writeFile(wb, `Financial_Report_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
      
      toast({ title: "Export Successful", description: "Your Excel report has been generated." });
    } else {
      const doc = new jsPDF();
      doc.setFontSize(20);
      doc.text("Financial Hub - Executive Report", 14, 22);
      doc.setFontSize(10);
      doc.text(`Period: ${format(selectedRange?.from || new Date(), 'dd MMM yyyy')} - ${format(selectedRange?.to || new Date(), 'dd MMM yyyy')}`, 14, 30);

      autoTable(doc, {
        startY: 40,
        head: [['Metric', 'Value']],
        body: [
          ['Gross Revenue', `Rs ${financialKPIs.grossRevenue.toLocaleString()}`],
          ['Operational Burn', `Rs ${financialKPIs.operationalBurn.toLocaleString()}`],
          ['Net Position', `Rs ${financialKPIs.netPosition.toLocaleString()}`],
          ['Vendor Debt', `Rs ${financialKPIs.pendingVendorDebt.toLocaleString()}`],
          ['EBITDA', `Rs ${(strategicMetrics?.ebitda || 0).toLocaleString()}`],
          ['EBITDA Margin', `${(strategicMetrics?.ebitdaMargin || 0).toFixed(1)}%`],
          ['Net Profit', `Rs ${(strategicMetrics?.netProfit || 0).toLocaleString()}`],
        ],
      });

      doc.save(`Financial_Report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      toast({ title: "Export Successful", description: "Your PDF report has been generated." });
    }
  };

  const tabs = [
    { value: 'revenue', label: 'Revenue HUB', icon: TrendingUp },
    { value: 'expenses', label: 'Operational BURN', icon: Receipt },
    { value: 'vendors', label: 'Vendor Accounts', icon: Boxes },
    { value: 'shares', label: 'Doctor Dividends', icon: HandCoins },
    { value: 'analytics', label: 'Strategic P&L', icon: FileBarChart },
  ];

  return (
        <div className="p-6 space-y-8 max-w-[1600px] mx-auto animate-in fade-in duration-500">
            {/* Executive Finance Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-2">
                <div className="space-y-1">
                    <h1 className="text-5xl font-black tracking-tighter text-slate-900 flex items-center gap-4">
                        <span className="bg-indigo-600 text-white p-3 rounded-2xl shadow-xl shadow-indigo-100"><TrendingUp className="h-8 w-8" /></span>
                        Financial <span className="text-indigo-600">Hub</span>
                    </h1>
                    <p className="text-slate-500 font-bold ml-1 text-sm uppercase tracking-widest opacity-60">Unified Operational Intelligence</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <DatePickerWithRange date={selectedRange} onDateChange={setSelectedRange} />
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="rounded-2xl border-slate-200 h-14 px-8 font-black hover:bg-slate-50 shadow-sm transition-all active:scale-95">
                                <Download className="mr-2 h-5 w-5" /> Export
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleExport('excel')}>Excel Spreadsheet (.xlsx)</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleExport('pdf')}>PDF Document (.pdf)</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Button 
                        onClick={() => window.print()}
                        className="rounded-2xl bg-indigo-600 hover:bg-indigo-700 h-14 px-8 font-black shadow-2xl shadow-indigo-200 transition-all active:scale-95"
                    >
                        <Printer className="mr-2 h-5 w-5" /> Print Board
                    </Button>
                </div>
            </div>

            {/* KPI Cards Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="border-none bg-emerald-50/50 shadow-xl shadow-emerald-100/20 rounded-[2rem] overflow-hidden group hover:scale-[1.02] transition-all">
                    <CardContent className="p-8">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-lg shadow-emerald-200"><TrendingUp className="h-6 w-6" /></div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600/60 leading-none">Gross Revenue</span>
                        </div>
                        <div className="space-y-1">
                            <p className="text-4xl font-black text-emerald-900 tracking-tighter">Rs {financialKPIs.grossRevenue.toLocaleString()}</p>
                            <div className="flex items-center gap-2">
                                <p className="text-[10px] font-bold text-emerald-600/80 uppercase tracking-tighter">Total Inflow</p>
                                <div className="h-2 w-[1px] bg-emerald-200"></div>
                                <p className="text-[10px] font-medium text-slate-400">
                                    Cash: {financialKPIs.physicalCashRevenue.toLocaleString()} | Digital: {financialKPIs.onlineCashRevenue.toLocaleString()}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none bg-rose-50/50 shadow-xl shadow-rose-100/20 rounded-[2rem] overflow-hidden group hover:scale-[1.02] transition-all">
                    <CardContent className="p-8">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-rose-600 text-white rounded-2xl shadow-lg shadow-rose-200"><Receipt className="h-6 w-6" /></div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-rose-600/60 leading-none">Operational Burn</span>
                        </div>
                        <div className="space-y-1">
                            <p className="text-4xl font-black text-rose-900 tracking-tighter">Rs {financialKPIs.operationalBurn.toLocaleString()}</p>
                            <p className="text-xs font-bold text-rose-600/80">Direct Expenses • {filteredExpenses.length} Records</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none bg-indigo-600 shadow-[0_20px_50px_rgba(79,70,229,0.3)] rounded-[2rem] overflow-hidden group hover:scale-[1.02] transition-all">
                    <CardContent className="p-8 text-white">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl"><Sparkles className="h-6 w-6" /></div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-100/60 leading-none">Net Position</span>
                        </div>
                        <div className="space-y-1">
                            <p className="text-4xl font-black tracking-tighter">Rs {financialKPIs.netPosition.toLocaleString()}</p>
                            <p className="text-xs font-bold text-indigo-100/80">Actual Profitability</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none bg-slate-900 shadow-xl shadow-slate-200 rounded-[2rem] overflow-hidden group hover:scale-[1.02] transition-all">
                    <CardContent className="p-8 text-white">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-slate-800 rounded-2xl"><Boxes className="h-6 w-6" /></div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none">Vendor Debt</span>
                        </div>
                        <div className="space-y-1">
                            <p className="text-4xl font-black tracking-tighter">Rs {financialKPIs.pendingVendorDebt.toLocaleString()}</p>
                            <p className="text-xs font-bold text-slate-400">Locked Liabilities</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-none bg-white/40 backdrop-blur-3xl shadow-2xl shadow-slate-200/50 rounded-[3rem] overflow-hidden ring-1 ring-white/20">
                <CardContent className="p-10">
                    <Tabs defaultValue="revenue" className="w-full">
                        <div className="flex items-center justify-between mb-8">
                            <TabsList className="bg-slate-100/80 p-1.5 rounded-3xl h-auto border border-slate-200/80 shadow-inner">
                                {tabs.map((tab) => (
                                    <TabsTrigger 
                                        key={tab.value} 
                                        value={tab.value}
                                        className="rounded-2xl px-8 py-3.5 font-black text-sm data-[state=active]:bg-white data-[state=active]:shadow-xl data-[state=active]:text-indigo-600 transition-all tracking-tight uppercase"
                                    >
                                        <tab.icon className="mr-2.5 h-4 w-4" />
                                        {tab.label}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </div>

                        <TabsContent value="revenue" className="pt-2 animate-in slide-in-from-bottom-4 duration-500">
                            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
                                <div className="lg:col-span-3">
                                    <div className="relative">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                        <Input placeholder="Search Invoices, Patients, or Doctors..." className="pl-12 h-14 rounded-2xl bg-white border-slate-200 font-bold focus:ring-indigo-500" />
                                    </div>
                                </div>
                                <Select>
                                    <SelectTrigger className="h-14 rounded-2xl font-bold bg-white border-slate-200">
                                        <SelectValue placeholder="All Departments" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="opd">OPD</SelectItem>
                                        <SelectItem value="pharmacy">Pharmacy</SelectItem>
                                        <SelectItem value="lab">Laboratory</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="rounded-3xl border border-slate-100 overflow-hidden bg-white/50 shadow-sm max-h-[600px] overflow-y-auto">
                                <Table>
                                    <TableHeader className="bg-slate-50/50">
                                        <TableRow className="border-slate-100 font-bold">
                                            <TableHead className="font-black text-slate-900 uppercase text-[10px] tracking-widest h-14">Invoice#</TableHead>
                                            <TableHead className="font-black text-slate-900 uppercase text-[10px] tracking-widest h-14">Patient Identity</TableHead>
                                            <TableHead className="font-black text-slate-900 uppercase text-[10px] tracking-widest h-14">Clinical Context</TableHead>
                                            <TableHead className="font-black text-slate-900 uppercase text-[10px] tracking-widest h-14 text-right">Revenue</TableHead>
                                            <TableHead className="font-black text-slate-900 uppercase text-[10px] tracking-widest h-14">Status</TableHead>
                                            <TableHead className="font-black text-slate-900 uppercase text-[10px] tracking-widest h-14 text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {transactionData.map((t, i) => (
                                            <TableRow key={i} className="group border-slate-50 hover:bg-slate-50/80 transition-colors">
                                                <TableCell className="font-black text-indigo-600 h-16">{t.invoice}</TableCell>
                                                <TableCell>
                                                    <div className="space-y-0.5">
                                                        <p className="font-bold text-slate-900">{t.patientName}</p>
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">ID: {t.mrn}</p>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="space-y-0.5">
                                                        <p className="font-semibold text-slate-700 text-sm line-clamp-1">{t.description}</p>
                                                        <p className="text-[10px] font-black text-indigo-600/60 uppercase tracking-tighter">{t.paymentMode} • {t.departmentRevenue}</p>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right font-black text-slate-900">
                                                    Rs {t.total.toLocaleString()}
                                                </TableCell>
                                                <TableCell>
                                                    <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase">Collected</span>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-indigo-50 hover:text-indigo-600"><Eye className="h-4 w-4" /></Button>
                                                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-indigo-50 hover:text-indigo-600"><Printer className="h-4 w-4" /></Button>
                                                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-rose-50 hover:text-rose-600 text-slate-400"><Trash2 className="h-4 w-4" /></Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </TabsContent>

                        <TabsContent value="expenses" className="pt-2 animate-in slide-in-from-bottom-4 duration-500">
                            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
                                <div className="lg:col-span-3">
                                    <h3 className="text-xl font-black text-slate-900">Daily Burn Log</h3>
                                    <p className="text-sm text-slate-500 font-medium">Tracking operational outflows and clinic maintenance.</p>
                                </div>
                                <Button className="h-14 rounded-2xl font-black bg-rose-600 hover:bg-rose-700 shadow-xl shadow-rose-100">
                                    <Receipt className="mr-2 h-5 w-5" /> Log New Expense
                                </Button>
                            </div>
                            <div className="rounded-3xl border border-slate-100 overflow-hidden bg-white/50">
                                <Table>
                                    <TableHeader className="bg-slate-50/50 text-right">
                                        <TableRow className="border-slate-100 font-bold">
                                            <TableHead className="font-black text-slate-900 uppercase text-[10px] tracking-widest h-14">Category</TableHead>
                                            <TableHead className="font-black text-slate-900 uppercase text-[10px] tracking-widest h-14">Description</TableHead>
                                            <TableHead className="font-black text-slate-900 uppercase text-[10px] tracking-widest h-14 text-right">Amount</TableHead>
                                            <TableHead className="font-black text-slate-900 uppercase text-[10px] tracking-widest h-14 text-right">Log Date</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredExpenses.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="h-48 text-center">
                                                    <div className="flex flex-col items-center gap-2 opacity-20">
                                                        <Receipt className="h-12 w-12" />
                                                        <p className="font-black uppercase tracking-widest text-xs">No expenses logged in this range</p>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : filteredExpenses.map((exp: any, i: number) => (
                                            <TableRow key={i} className="border-slate-50 h-16">
                                                <TableCell>
                                                    <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-[10px] font-black uppercase">{exp.category || 'General'}</span>
                                                </TableCell>
                                                <TableCell className="font-bold text-slate-700">{exp.description}</TableCell>
                                                <TableCell className="text-right font-black text-rose-600">Rs {exp.amount.toLocaleString()}</TableCell>
                                                <TableCell className="text-right font-bold text-slate-400 text-xs">{format(new Date(exp.timestamp), 'dd MMM yyyy')}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </TabsContent>

                        <TabsContent value="vendors" className="pt-2 animate-in slide-in-from-bottom-4 duration-500">
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {allSuppliers?.map((supplier, i) => (
                                        <Card key={i} className="border-none bg-slate-50 shadow-sm rounded-3xl group hover:shadow-md transition-all">
                                            <CardContent className="p-6">
                                                <div className="flex items-start justify-between">
                                                    <div className="space-y-1">
                                                        <h4 className="text-lg font-black text-slate-900">{supplier.name}</h4>
                                                        <p className="text-xs font-bold text-slate-500 tracking-wider uppercase">{supplier.type || 'Distributor'}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Balance Due</p>
                                                        <p className="text-2xl font-black text-indigo-600">Rs {(supplier.currentBalance ?? (supplier as any).balance ?? (supplier as any).totalBalance ?? 0).toLocaleString()}</p>
                                                    </div>
                                                </div>
                                                <div className="mt-6 flex items-center gap-3">
                                                    <Button 
                                                        variant="outline" 
                                                        className="flex-1 h-12 rounded-xl font-black text-sm hover:bg-white border-slate-200"
                                                        onClick={() => {
                                                            setSelectedSupplier(supplier);
                                                            setHistoryDialogOpen(true);
                                                        }}
                                                    >
                                                        View History
                                                    </Button>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="shares" className="pt-2 animate-in slide-in-from-bottom-4 duration-500">
                             <div className="rounded-3xl border border-slate-100 overflow-hidden bg-white/50">
                                <Table>
                                    <TableHeader className="bg-slate-50/50">
                                        <TableRow className="border-slate-100 h-14">
                                            <TableHead className="font-black text-slate-900 uppercase text-[10px] tracking-widest">Clinical Authority</TableHead>
                                            <TableHead className="font-black text-slate-900 uppercase text-[10px] tracking-widest text-right">Total Revenue Generated</TableHead>
                                            <TableHead className="font-black text-slate-900 uppercase text-[10px] tracking-widest text-right">Computed Share</TableHead>
                                            <TableHead className="font-black text-slate-900 uppercase text-[10px] tracking-widest text-right">Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {allDoctors?.map((doctor, i) => {
                                            const docName = doctor.fullName || (doctor as any).name || '';
                                            const doctorRevenue = transactionData.filter(t => t.description.toLowerCase().includes(docName.toLowerCase())).reduce((sum, t) => sum + t.total, 0);
                                            return (
                                                <TableRow key={i} className="border-slate-50 h-16">
                                                    <TableCell className="font-black text-slate-900">{docName}</TableCell>
                                                    <TableCell className="text-right font-bold text-slate-600">Rs {doctorRevenue.toLocaleString()}</TableCell>
                                                    <TableCell className="text-right font-black text-indigo-600">Rs {(doctorRevenue * 0.4).toLocaleString()}</TableCell>
                                                    <TableCell className="text-right">
                                                        <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-500 text-[10px] font-black uppercase">Unsettled</span>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                             </div>
                        </TabsContent>

                        <TabsContent value="analytics" className="pt-2 animate-in slide-in-from-bottom-4 duration-500">
                             <div className="space-y-8">
                                {/* Social Marketing Performance Overview */}
                                <div className="grid gap-6 md:grid-cols-4">
                                    <Card className="border-none bg-slate-900 shadow-2xl shadow-slate-200 rounded-[2.5rem] overflow-hidden p-1 col-span-1 md:col-span-4">
                                        <div className="p-8 flex flex-col md:flex-row items-center justify-between gap-8">
                                            <div className="flex items-center gap-6">
                                                <div className="h-16 w-16 bg-amber-600 rounded-2xl flex items-center justify-center shadow-xl shadow-amber-900/20">
                                                    <Coins className="h-8 w-8 text-white" />
                                                </div>
                                                <div>
                                                    <h3 className="text-2xl font-black text-white tracking-tight">Marketing Budget <span className="text-amber-500">Audit</span></h3>
                                                    <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Active Social Spend for {currentMarketingSpend?.month || format(new Date(), 'MMMM')} {currentMarketingSpend?.year || new Date().getFullYear()}</p>
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-12">
                                                <div className="space-y-1">
                                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Ads Spend</p>
                                                    <p className="text-xl font-black text-white">Rs {(currentMarketingSpend?.adSpend || 0).toLocaleString()}</p>
                                                </div>
                                                <div className="space-y-1 border-l border-slate-800 pl-8">
                                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Boostings</p>
                                                    <p className="text-xl font-black text-white">Rs {(currentMarketingSpend?.boostingSpend || 0).toLocaleString()}</p>
                                                </div>
                                                <div className="space-y-1 border-l border-slate-800 pl-8">
                                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">PR / Influencer</p>
                                                    <p className="text-xl font-black text-white">Rs {(currentMarketingSpend?.prSpend || 0).toLocaleString()}</p>
                                                </div>
                                                <div className="bg-amber-600/10 border border-amber-600/20 rounded-2xl px-8 py-3">
                                                    <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Total Burn</p>
                                                    <p className="text-2xl font-black text-amber-500">Rs {(currentMarketingSpend?.totalSpent || 0).toLocaleString()}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </Card>
                                </div>

                                {/* ROAS Intelligence Section */}
                                <Card className="border-none bg-white shadow-2xl shadow-slate-200/50 rounded-[2.5rem] overflow-hidden">
                                    <CardHeader className="p-8 pb-0">
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                            <div>
                                                <CardTitle className="text-2xl font-black tracking-tighter text-slate-900 flex items-center gap-3">
                                                    <div className="p-3 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-2xl shadow-lg shadow-violet-200">
                                                        <TrendingUp className="h-6 w-6 text-white" />
                                                    </div>
                                                    ROAS <span className="text-violet-500">Intelligence</span>
                                                </CardTitle>
                                                <CardDescription className="font-bold text-slate-400 uppercase tracking-widest text-[10px] mt-2">
                                                    Return on Ad Spend · Last 6 Months · Social Marketing vs Clinic Revenue
                                                </CardDescription>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                                                    <div className="h-3 w-3 rounded-sm bg-violet-500" /> Spend
                                                    <div className="h-3 w-3 rounded-sm bg-emerald-500 ml-2" /> Revenue
                                                </div>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-8">
                                        {/* ROAS KPI Cards */}
                                        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
                                            {/* Overall ROAS */}
                                            <div className="bg-gradient-to-br from-violet-50 to-indigo-50 rounded-[2rem] p-6 border border-violet-100/50 relative overflow-hidden">
                                                <div className="absolute top-0 right-0 w-20 h-20 bg-violet-200/20 rounded-full -translate-x-4 -translate-y-4 blur-2xl" />
                                                <p className="text-[10px] font-black text-violet-500 uppercase tracking-widest mb-2 relative">ROAS Ratio</p>
                                                <p className="text-3xl font-black tracking-tighter text-slate-900 relative">
                                                    {roasData.overallRoas > 0 ? `${roasData.overallRoas.toFixed(1)}x` : '—'}
                                                </p>
                                                <p className="text-[9px] font-bold text-violet-400 uppercase tracking-wider mt-1 relative">
                                                    {roasData.overallRoas >= 3 ? '🔥 Excellent' : roasData.overallRoas >= 1 ? '✅ Profitable' : roasData.overallRoas > 0 ? '⚠️ Below Target' : 'No Data'}
                                                </p>
                                            </div>

                                            {/* Total Spend */}
                                            <div className="bg-gradient-to-br from-rose-50 to-pink-50 rounded-[2rem] p-6 border border-rose-100/50 relative overflow-hidden">
                                                <div className="absolute top-0 right-0 w-20 h-20 bg-rose-200/20 rounded-full -translate-x-4 -translate-y-4 blur-2xl" />
                                                <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-2 relative">Total Ad Spend</p>
                                                <p className="text-3xl font-black tracking-tighter text-slate-900 relative">
                                                    Rs {roasData.totalSpend > 0 ? (roasData.totalSpend / 1000).toFixed(0) + 'K' : '0'}
                                                </p>
                                                <p className="text-[9px] font-bold text-rose-400 uppercase tracking-wider mt-1 relative">6 Month Cumulative</p>
                                            </div>

                                            {/* Revenue Generated */}
                                            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-[2rem] p-6 border border-emerald-100/50 relative overflow-hidden">
                                                <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-200/20 rounded-full -translate-x-4 -translate-y-4 blur-2xl" />
                                                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2 relative">Total Revenue</p>
                                                <p className="text-3xl font-black tracking-tighter text-slate-900 relative">
                                                    Rs {roasData.totalRevenue > 0 ? (roasData.totalRevenue / 1000000).toFixed(1) + 'M' : '0'}
                                                </p>
                                                <p className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider mt-1 relative">Gross Collections</p>
                                            </div>

                                            {/* Total Leads */}
                                            <div className="bg-gradient-to-br from-blue-50 to-sky-50 rounded-[2rem] p-6 border border-blue-100/50 relative overflow-hidden">
                                                <div className="absolute top-0 right-0 w-20 h-20 bg-blue-200/20 rounded-full -translate-x-4 -translate-y-4 blur-2xl" />
                                                <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-2 relative">Total Leads</p>
                                                <p className="text-3xl font-black tracking-tighter text-slate-900 relative">
                                                    {roasData.totalLeads > 0 ? roasData.totalLeads.toLocaleString() : '0'}
                                                </p>
                                                <p className="text-[9px] font-bold text-blue-400 uppercase tracking-wider mt-1 relative">Generated via Social</p>
                                            </div>

                                            {/* Total Conversions */}
                                            <div className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-[2rem] p-6 border border-teal-100/50 relative overflow-hidden">
                                                <div className="absolute top-0 right-0 w-20 h-20 bg-teal-200/20 rounded-full -translate-x-4 -translate-y-4 blur-2xl" />
                                                <p className="text-[10px] font-black text-teal-600 uppercase tracking-widest mb-2 relative">Conversions</p>
                                                <p className="text-3xl font-black tracking-tighter text-slate-900 relative">
                                                    {roasData.totalConverted > 0 ? roasData.totalConverted.toLocaleString() : '0'}
                                                </p>
                                                <p className="text-[9px] font-bold text-teal-500 uppercase tracking-wider mt-1 relative">
                                                    {roasData.overallConvRate > 0 ? `${roasData.overallConvRate.toFixed(1)}% Conv. Rate` : 'Patient conversions'}
                                                </p>
                                            </div>

                                            {/* Cost Per Lead */}
                                            <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-[2rem] p-6 border border-amber-100/50 relative overflow-hidden">
                                                <div className="absolute top-0 right-0 w-20 h-20 bg-amber-200/20 rounded-full -translate-x-4 -translate-y-4 blur-2xl" />
                                                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-2 relative">Avg Cost/Lead</p>
                                                <p className="text-3xl font-black tracking-tighter text-slate-900 relative">
                                                    Rs {roasData.overallCPL > 0 ? Math.round(roasData.overallCPL).toLocaleString() : '0'}
                                                </p>
                                                <p className="text-[9px] font-bold text-amber-500 uppercase tracking-wider mt-1 relative">Acquisition Cost</p>
                                            </div>
                                        </div>

                                        {/* ROAS Bar Chart */}
                                        <div className="h-[350px] bg-slate-50/50 rounded-[2rem] p-6 border border-slate-100">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <RechartsBarChart data={roasData.months.map(m => ({
                                                    name: m.shortLabel,
                                                    'Ad Spend': m.spend,
                                                    'Revenue': m.revenue,
                                                    roas: m.roas
                                                }))} barGap={4}>
                                                    <CartesianGrid strokeDasharray="10 10" vertical={false} stroke="#e2e8f0" />
                                                    <XAxis
                                                        dataKey="name"
                                                        fontSize={11}
                                                        tickLine={false}
                                                        axisLine={false}
                                                        fontWeight="800"
                                                        tick={{ fill: '#64748b' }}
                                                    />
                                                    <YAxis
                                                        fontSize={10}
                                                        tickLine={false}
                                                        axisLine={false}
                                                        fontWeight="800"
                                                        tick={{ fill: '#94a3b8' }}
                                                        tickFormatter={(v) => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : `${v}`}
                                                    />
                                                    <RechartsTooltip
                                                        contentStyle={{
                                                            borderRadius: '20px',
                                                            border: 'none',
                                                            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.12)',
                                                            fontWeight: '700',
                                                            fontSize: '12px',
                                                            padding: '16px',
                                                        }}
                                                        formatter={(value: number) => `Rs ${value.toLocaleString()}`}
                                                    />
                                                    <Bar dataKey="Ad Spend" fill="#8b5cf6" radius={[8, 8, 0, 0]} barSize={28} />
                                                    <Bar dataKey="Revenue" fill="#10b981" radius={[8, 8, 0, 0]} barSize={28} />
                                                </RechartsBarChart>
                                            </ResponsiveContainer>
                                        </div>

                                        {/* Monthly ROAS Breakdown Table */}
                                        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                                            {roasData.months.map(m => (
                                                <div key={`roas-${m.label}-${m.year}`} className="bg-white border border-slate-100 rounded-2xl p-4 text-center hover:border-violet-200 hover:shadow-lg hover:shadow-violet-50 transition-all">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{m.shortLabel}</p>
                                                    <p className={cn(
                                                        "text-xl font-black tracking-tighter mt-1",
                                                        m.roas >= 3 ? "text-emerald-600" : m.roas >= 1 ? "text-slate-900" : m.roas > 0 ? "text-amber-600" : "text-slate-300"
                                                    )}>
                                                        {m.roas > 0 ? `${m.roas.toFixed(1)}x` : '—'}
                                                    </p>
                                                    <div className="mt-2 space-y-0.5">
                                                        <p className="text-[8px] font-bold text-rose-400">↓ Rs {m.spend.toLocaleString()}</p>
                                                        <p className="text-[8px] font-bold text-emerald-500">↑ Rs {m.revenue.toLocaleString()}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Strategic Customer Metrics */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <Card className="border-none bg-indigo-50/50 shadow-sm rounded-3xl p-8 flex items-center gap-6">
                                        <div className="h-16 w-16 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
                                            <Users2 className="h-8 w-8" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600/60 mb-1">New Customer Intake</p>
                                            <h4 className="text-3xl font-black text-slate-900">{strategicMetrics?.newCustomers || 0}</h4>
                                            <p className="text-xs font-bold text-slate-400">First-time visitors acquired</p>
                                        </div>
                                    </Card>

                                    <Card className="border-none bg-emerald-50/50 shadow-sm rounded-3xl p-8 flex items-center gap-6">
                                        <div className="h-16 w-16 bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-100">
                                            <RotateCcw className="h-8 w-8" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600/60 mb-1">Repeat Visit Volume</p>
                                            <h4 className="text-3xl font-black text-slate-900">{strategicMetrics?.repeatCustomers || 0}</h4>
                                            <p className="text-xs font-bold text-slate-400">Returning loyal patient base</p>
                                        </div>
                                    </Card>

                                    <Card className="border-none bg-rose-50/50 shadow-sm rounded-3xl p-8 flex items-center gap-6 relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                                            <TrendingUp className="h-20 w-20 text-rose-900 rotate-180" />
                                        </div>
                                        <div className="h-16 w-16 bg-rose-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-rose-100">
                                            <Hourglass className="h-8 w-8" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-rose-600/60 mb-1">Churned / Lapsed</p>
                                            <h4 className="text-3xl font-black text-slate-900">{strategicMetrics?.churnedCustomers || 0}</h4>
                                            <p className="text-xs font-bold text-slate-400">{strategicMetrics?.churnRate}% leakage rate (6mo)</p>
                                        </div>
                                    </Card>
                                </div>
                                {/* Financial Performance Audit */}
                                <Card className="border-none shadow-xl shadow-slate-100/50 rounded-[3rem] bg-slate-900 text-white overflow-hidden p-10 relative">
                                    <div className="absolute top-0 right-0 p-10 opacity-10">
                                        <FileBarChart className="h-48 w-48" />
                                    </div>
                                    <div className="relative z-10 space-y-10">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h3 className="text-3xl font-black tracking-tight">EBITDA Executive Audit</h3>
                                                <p className="text-slate-400 font-bold uppercase text-xs tracking-widest mt-1">Detailed Operating Performance</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-1">EBITDA Margin</p>
                                                <h4 className="text-4xl font-black text-indigo-400">{(strategicMetrics?.ebitdaMargin || 0).toFixed(1)}%</h4>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
                                            <div className="space-y-2">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Gross Revenue</p>
                                                <p className="text-3xl font-black text-white">Rs {financialKPIs.grossRevenue.toLocaleString()}</p>
                                            </div>
                                            <div className="space-y-2 border-l border-slate-800 pl-10">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Operating Expenses</p>
                                                <p className="text-3xl font-black text-rose-500">Rs {(strategicMetrics?.totalOpEx ?? 0).toLocaleString()}</p>
                                            </div>
                                            <div className="space-y-2 border-l border-slate-800 pl-10">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">EBITDA</p>
                                                <p className="text-3xl font-black text-emerald-400">Rs {(strategicMetrics?.ebitda ?? 0).toLocaleString()}</p>
                                            </div>
                                            <div className="space-y-2 border-l border-slate-800 pl-10">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Net Profit</p>
                                                <p className="text-3xl font-black text-indigo-400">Rs {(strategicMetrics?.netProfit ?? 0).toLocaleString()}</p>
                                            </div>
                                        </div>

                                        <div className="h-px bg-slate-800" />

                                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                                            <div className="space-y-4">
                                                <h4 className="text-sm font-black uppercase tracking-widest text-slate-500">Revenue Mix</h4>
                                                <div className="space-y-3">
                                                    <div className="flex justify-between items-center bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50">
                                                        <span className="font-bold text-slate-300">Consultations</span>
                                                        <span className="font-black">Rs {filteredBilling.reduce((sum, b) => sum + (b.consultationCharges || 0), 0).toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50">
                                                        <span className="font-bold text-slate-300">Procedures</span>
                                                        <span className="font-black">Rs {filteredBilling.reduce((sum, b) => sum + (b.procedureCharges || 0), 0).toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50">
                                                        <span className="font-bold text-slate-300">Pharmacy</span>
                                                        <span className="font-black">Rs {filteredBilling.reduce((sum, b) => sum + (b.medicineCharges || 0), 0).toLocaleString()}</span>
                                                    </div>
                                                    {(strategicMetrics?.totalSocialRevenue ?? 0) > 0 && (
                                                        <div className="flex justify-between items-center bg-indigo-900/40 p-4 rounded-2xl border border-indigo-500/50 mt-4 relative overflow-hidden">
                                                            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/20 blur-2xl rounded-full -translate-y-12 translate-x-4" />
                                                            <div className="relative z-10 flex flex-col">
                                                                <span className="font-black text-indigo-300 text-[10px] uppercase tracking-widest">Attributed to Social Team</span>
                                                                <span className="font-bold text-white">Social Conversions</span>
                                                            </div>
                                                            <span className="font-black text-indigo-400 text-lg relative z-10">Rs {(strategicMetrics?.totalSocialRevenue ?? 0).toLocaleString()}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <h4 className="text-sm font-black uppercase tracking-widest text-slate-500">Operating Cost Center</h4>
                                                <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                                                    <div className="bg-indigo-900/20 p-4 rounded-2xl border border-indigo-500/30 space-y-3">
                                                        <div className="flex justify-between items-center">
                                                            <span className="font-bold text-indigo-300">Social Marketing (Ads/PR)</span>
                                                            <span className="font-black text-indigo-400">Rs {(strategicMetrics?.totalSocialSpend ?? 0).toLocaleString()}</span>
                                                        </div>
                                                        {(strategicMetrics?.totalSocialSpend ?? 0) > 0 && (
                                                            <div className="grid grid-cols-2 gap-2 pl-2 border-l border-indigo-500/30">
                                                                <div className="flex flex-col">
                                                                    <span className="text-[9px] font-black uppercase text-indigo-400/60">Ads</span>
                                                                    <span className="text-[11px] font-bold text-indigo-200">Rs {(strategicMetrics?.socialSpendDetail?.adSpend ?? 0).toLocaleString()}</span>
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span className="text-[9px] font-black uppercase text-indigo-400/60">Boost</span>
                                                                    <span className="text-[11px] font-bold text-indigo-200">Rs {(strategicMetrics?.socialSpendDetail?.boostingSpend ?? 0).toLocaleString()}</span>
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span className="text-[9px] font-black uppercase text-indigo-400/60">PR</span>
                                                                    <span className="text-[11px] font-bold text-indigo-200">Rs {(strategicMetrics?.socialSpendDetail?.prSpend ?? 0).toLocaleString()}</span>
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span className="text-[9px] font-black uppercase text-indigo-400/60">Misc</span>
                                                                    <span className="text-[11px] font-bold text-indigo-200">Rs {(strategicMetrics?.socialSpendDetail?.otherSpend ?? 0).toLocaleString()}</span>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                    {Object.entries(strategicMetrics?.expenseBreakdown || {}).map(([cat, amount]: [string, any]) => (
                                                        <div key={cat} className="flex justify-between items-center bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50">
                                                            <span className="font-bold text-slate-300">{cat}</span>
                                                            <span className="font-black text-rose-400">Rs {amount.toLocaleString()}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <h4 className="text-sm font-black uppercase tracking-widest text-slate-500">EBITDA Momentum (Monthly)</h4>
                                                <Card className="border-none bg-slate-800/20 p-6 h-full min-h-[300px] flex flex-col justify-center">
                                                    <div className="h-[250px] w-full">
                                                        <ResponsiveContainer width="100%" height="100%">
                                                            <RechartsBarChart data={strategicMetrics?.monthlyTrend || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                                                                <XAxis 
                                                                    dataKey="name" 
                                                                    tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} 
                                                                    axisLine={false} 
                                                                    tickLine={false} 
                                                                />
                                                                <YAxis 
                                                                    tick={{ fill: '#94a3b8', fontSize: 10 }} 
                                                                    axisLine={false} 
                                                                    tickLine={false}
                                                                    tickFormatter={(v) => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : v}
                                                                />
                                                                <RechartsTooltip 
                                                                    cursor={{ fill: '#334155', opacity: 0.4 }}
                                                                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#f8fafc', fontWeight: 'bold' }}
                                                                    formatter={(value: number) => [`Rs ${value.toLocaleString()}`, undefined]}
                                                                />
                                                                <Bar dataKey="EBITDA" fill="#34d399" radius={[4, 4, 0, 0]} barSize={30} />
                                                            </RechartsBarChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                    <p className="text-[10px] text-slate-500 font-medium italic mt-4 text-center">
                                                        *Monthly EBITDA Trend over the last 6 months.
                                                    </p>
                                                </Card>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                             </div>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
      {/* Vendor History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
          <DialogContent className="sm:max-w-[1200px] p-0 overflow-hidden rounded-[2.5rem] border-none shadow-2xl">
              <div className="bg-slate-900 p-10 text-white relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 rounded-full -translate-y-32 translate-x-32 blur-3xl" />
                  <DialogHeader className="relative z-10">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                          <div className="space-y-2">
                              <DialogTitle className="text-4xl font-black tracking-tighter flex items-center gap-4">
                                  <div className="p-3 bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-900/40">
                                      <History className="h-8 w-8 text-white" />
                                  </div>
                                  {selectedSupplier?.name} <span className="text-indigo-400">Ledger History</span>
                              </DialogTitle>
                              <DialogDescription className="text-slate-400 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2">
                                  <Package className="h-3 w-3" /> {selectedSupplier?.type || 'Vendor'} • Complete Transaction Audit Trail
                              </DialogDescription>
                          </div>
                          
                          {selectedSupplier && (
                              <div className="flex gap-8 p-4 bg-white/5 rounded-3xl border border-white/10 backdrop-blur-sm">
                                  <div className="space-y-1">
                                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Contact Person</p>
                                      <p className="text-sm font-bold">{selectedSupplier.contactPerson}</p>
                                      <p className="text-[10px] text-slate-400">{selectedSupplier.phone}</p>
                                  </div>
                                  <div className="space-y-1 border-l border-white/10 pl-8">
                                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Location</p>
                                      <p className="text-sm font-bold">{selectedSupplier.city}</p>
                                      <p className="text-[10px] text-slate-400 truncate max-w-[200px]">{selectedSupplier.address}</p>
                                  </div>
                              </div>
                          )}
                      </div>
                  </DialogHeader>
              </div>

              <div className="p-8 max-h-[60vh] overflow-y-auto">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                      <div className="space-y-1">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Filter Audit Window</p>
                          <DatePickerWithRange 
                              date={historyRange} 
                              onDateChange={setHistoryRange} 
                              className="bg-white rounded-xl shadow-sm border-slate-100" 
                          />
                      </div>
                      <div className="text-right">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Transactions Found</p>
                          <p className="text-xl font-black text-slate-900">
                              {allVendorTransactions?.filter(t => {
                                  if (t.supplierId !== selectedSupplier?.id) return false;
                                  const txDate = startOfDay(new Date(t.date));
                                  return isWithinInterval(txDate, {
                                      start: startOfDay(historyRange?.from || new Date()),
                                      end: endOfDay(historyRange?.to || historyRange?.from || new Date())
                                  });
                              }).length || 0}
                          </p>
                      </div>
                  </div>

                  <div className="rounded-2xl border border-slate-100 overflow-hidden">
                      <Table>
                          <TableHeader className="bg-slate-50">
                              <TableRow className="border-slate-100 h-12">
                                  <TableHead className="font-black text-slate-900 uppercase text-[10px] tracking-widest">Date</TableHead>
                                  <TableHead className="font-black text-slate-900 uppercase text-[10px] tracking-widest">Type</TableHead>
                                  <TableHead className="font-black text-slate-900 uppercase text-[10px] tracking-widest">Reference</TableHead>
                                  <TableHead className="font-black text-slate-900 uppercase text-[10px] tracking-widest">Details / Notes</TableHead>
                                  <TableHead className="font-black text-slate-900 uppercase text-[10px] tracking-widest text-right">Amount</TableHead>
                                  <TableHead className="font-black text-slate-900 uppercase text-[10px] tracking-widest text-right">Logged By</TableHead>
                              </TableRow>
                          </TableHeader>
                          <TableBody>
                              {allVendorTransactions && allVendorTransactions.filter(t => {
                                  if (t.supplierId !== selectedSupplier?.id) return false;
                                  const txDate = startOfDay(new Date(t.date));
                                  return isWithinInterval(txDate, {
                                      start: startOfDay(historyRange?.from || new Date()),
                                      end: endOfDay(historyRange?.to || historyRange?.from || new Date())
                                  });
                              }).length > 0 ? (
                                  allVendorTransactions
                                      .filter(t => {
                                          if (t.supplierId !== selectedSupplier?.id) return false;
                                          const txDate = startOfDay(new Date(t.date));
                                          return isWithinInterval(txDate, {
                                              start: startOfDay(historyRange?.from || new Date()),
                                              end: endOfDay(historyRange?.to || historyRange?.from || new Date())
                                          });
                                      })
                                      .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                      .map((tx, i) => (
                                           <TableRow key={i} className="border-slate-50 h-14">
                                               <TableCell className="font-bold text-slate-600 text-xs">{tx.date}</TableCell>
                                               <TableCell>
                                                   <Badge variant="outline" className={cn(
                                                       "text-[10px] font-black uppercase px-2 py-0",
                                                       tx.type === 'Bill' ? "text-amber-600 border-amber-200 bg-amber-50" : "text-emerald-600 border-emerald-200 bg-emerald-50"
                                                   )}>
                                                       {tx.type === 'Bill' ? 'Stock Bill' : 'Cash Paid'}
                                                   </Badge>
                                               </TableCell>
                                               <TableCell className="text-xs text-muted-foreground font-medium">{tx.reference || '-'}</TableCell>
                                               <TableCell>
                                                   <div className="flex flex-col gap-2 py-2">
                                                       {tx.medicines && tx.medicines.length > 0 && (
                                                           <div className="flex flex-wrap gap-1.5">
                                                               {tx.medicines.map(m => (
                                                                   <Badge key={m} variant="secondary" className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-700 border-none font-black uppercase tracking-tight">
                                                                       {m}
                                                                   </Badge>
                                                               ))}
                                                           </div>
                                                       )}
                                                       <p className="text-xs font-medium text-slate-500 leading-relaxed max-w-[500px]">
                                                           {tx.notes || (tx.medicines?.length ? '' : '-')}
                                                       </p>
                                                   </div>
                                               </TableCell>
                                               <TableCell className={cn(
                                                   "text-right font-black",
                                                   tx.type === 'Bill' ? "text-amber-600" : "text-emerald-600"
                                               )}>
                                                   {tx.type === 'Bill' ? '+' : '-'} Rs {tx.amount.toLocaleString()}
                                               </TableCell>
                                               <TableCell className="text-right text-xs font-bold text-slate-500">{tx.addedBy || 'System'}</TableCell>
                                           </TableRow>
                                      ))
                              ) : (
                                  <TableRow>
                                      <TableCell colSpan={6} className="h-32 text-center text-slate-400 font-bold uppercase text-[10px] tracking-widest opacity-50">
                                          No transactions found for this vendor
                                      </TableCell>
                                  </TableRow>
                              )}
                          </TableBody>
                      </Table>
                  </div>
              </div>
              
              <div className="p-8 bg-slate-50 flex items-center justify-between border-t border-slate-100">
                  <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Current Ledger Balance</p>
                      <p className={cn(
                          "text-2xl font-black",
                          (selectedSupplier?.currentBalance || 0) > 0 ? "text-rose-600" : "text-emerald-600"
                      )}>
                          Rs {(selectedSupplier?.currentBalance || 0).toLocaleString()}
                      </p>
                  </div>
                  <Button onClick={() => setHistoryDialogOpen(false)} className="rounded-xl h-12 px-8 font-black bg-slate-900 hover:bg-black shadow-lg shadow-slate-200">
                      Close History
                  </Button>
              </div>
          </DialogContent>
      </Dialog>
        </div>
    );
}
