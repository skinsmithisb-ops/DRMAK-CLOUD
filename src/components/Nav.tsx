'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
    SidebarHeader,
    SidebarContent,
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
    SidebarFooter,
    useSidebar,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarGroupContent,
} from '@/components/ui/sidebar';
import Icon from '@/components/Icon';
import {
    LayoutDashboard,
    Calendar,
    Users,
    Stethoscope,
    Boxes,
    CircleDollarSign,
    Activity,
    LineChart,
    Sparkles,
    LogOut,
    Settings,
    ChevronDown,
    MoreHorizontal,
    UserCog,
    FileBarChart,
    FileText,
    ListTodo,
    TrendingUp,
    HeartPulse,
    Share2,
    Video,
    CalendarCheck,
    GraduationCap,
    Hospital,
    Building2,
    Briefcase,
    Shield,
    Users2,
    Gamepad2,
    PieChart,
    BarChart3,
    Compass,
    Mail,
    Network,
    Truck,
    Receipt,
    Printer,
    Wallet,
    Palette
} from 'lucide-react';
import { useUser, useAuth } from '@/firebase';
import { useViewMode } from '@/context/ViewModeContext';
import { useNotifications } from '@/hooks/useNotifications';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { signOut } from 'firebase/auth';
import { Skeleton } from './ui/skeleton';


interface MenuItem {
    id: string;
    href: string;
    label: string;
    icon?: any;
    isMenu?: boolean;
    isMore?: boolean;
    subItems?: { id: string; href: string; label: string; }[];
}

const allMenuItems: MenuItem[] = [
    // General
    { id: 'dashboard', href: '/', label: 'Dashboard', icon: LayoutDashboard },

    // Designer Specific
    { id: 'designerWork', href: '/designer-dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'creativeBriefs', href: '/daily-tasks', label: 'Creative Briefs', icon: ListTodo },
    { id: 'designerPlanner', href: '/designer-planner', label: 'My Planner', icon: CalendarCheck },
    { id: 'creativeRequestHistory', href: '/creative-request-history', label: 'Requested Creatives', icon: Palette },
    { id: 'adminTasks', href: '/admin-tasks', label: 'Tasks by Admin', icon: Shield },

    { id: 'printPrescription', href: '/print-prescription', label: 'Print Prescription', icon: Printer },
    { id: 'appointments', href: '/appointments', label: 'Appointments', icon: Calendar },
    { id: 'followUpCalendar', href: '/appointments/follow-ups', label: 'Follow-up Calendar', icon: CalendarCheck },
    { id: 'followUpHistory', href: '/appointments/follow-up-history', label: 'Follow-up History', icon: Activity },
    { id: 'patients', href: '/patients', label: 'Patients', icon: Users },
    { id: 'doctors', href: '/doctors', label: 'Doctors', icon: Stethoscope },
    { id: 'procedures', href: '/procedures', label: 'Procedures', icon: Activity },
    { id: 'inventory', href: '/inventory', label: 'Inventory', icon: Boxes },
    { id: 'supplier', href: '/supplier', label: 'Suppliers', icon: Truck },
    { id: 'billing', href: '/billing', label: 'Billing', icon: CircleDollarSign },
    { id: 'todaySummary', href: '/today-summary', label: 'Today Summary', icon: TrendingUp },
    { id: 'dailyExpenses', href: '/daily-expenses', label: 'Daily Expenses', icon: Receipt },

    // Pharmacy Sub-menu
    {
        id: 'pharmacy.full', href: '/pharmacy', label: 'Pharmacy', icon: Boxes, isMenu: true,
        subItems: [
            { id: 'pharmacy.full', href: '/pharmacy/items', label: 'Items' }, // Assuming pharmacy.full grants access to all sub-items
            { id: 'pharmacy.full', href: '/pharmacy/item-categories', label: 'Item Categories' },
            { id: 'pharmacy.full', href: '/pharmacy/manufacturers', label: 'Manufacturers' },
            { id: 'pharmacy.full', href: '/pharmacy/manage-stock', label: 'Manage Stock' },
            { id: 'pharmacy.full', href: '/pharmacy/consume-stocks', label: 'Consume Stocks' },
            { id: 'pharmacy.full', href: '/pharmacy/racks', label: 'Racks' },
            { id: 'pharmacy.full', href: '/pharmacy/store-closing', label: 'Store Closing' },
            { id: 'pharmacy.full', href: '/pharmacy/stock-adjustment', label: 'Stock Adjustment' },
            { id: 'pharmacy.full', href: '/pharmacy/stock-suppliers', label: 'Stock Suppliers' },
            { id: 'pharmacy.pos', href: '/pharmacy/pos', label: 'POS' },
            { id: 'pharmacy.full', href: '/pharmacy/open-sale-return', label: 'Open Sale Return' },
            { id: 'pharmacy.full', href: '/pharmacy/invoice-return', label: 'Invoice Return' },
            { id: 'pharmacy.full', href: '/pharmacy/item-data-update', label: 'Item data Update' },
            { id: 'pharmacy.full', href: '/pharmacy/accounts', label: 'Accounts' },
            { id: 'pharmacy.full', href: '/pharmacy/donations', label: 'Donations' },
        ]
    },

    // Core Reports (Top-level)
    { id: 'rep_finance', href: '/reports/financial', label: 'Finance', icon: LineChart },
    { id: 'rep_inventory', href: '/reports/inventory', label: 'Inventory Management', icon: Boxes },
    { id: 'rep_performance', href: '/employee-reports', label: 'Team performance', icon: TrendingUp },
    { id: 'rep_expenses', href: '/daily-expenses', label: 'Expenses', icon: Receipt },
    { id: 'rep_salaries', href: '/reports/salaries', label: 'Employee Salary', icon: Wallet },

    // Administrative / Organization
    { id: 'userManagement', href: '/user-creation', label: 'User Management', icon: UserCog },
    { id: 'featureControl', href: '/settings', label: 'Feature Control', icon: Shield },
    { id: 'employeeReports', href: '/employee-reports', label: 'Employee Reports', icon: Users2 },

    { id: 'taskManagement', href: '/admin/manage-tasks', label: 'Manage Tasks', icon: ListTodo },
    { id: 'admin_trainings', href: '/admin/trainings', label: 'Manage Trainings', icon: GraduationCap },

    // Sales Specific
    { id: 'salesDashboard', href: '/sales-dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'leads', href: '/leads', label: 'Leads', icon: FileBarChart },
    { id: 'leadAssignment', href: '/leads/assignment', label: 'Lead Assignment', icon: Users },
    { id: 'dailyReporting', href: '/daily-reporting', label: 'Daily Reporting', icon: FileText },
    { id: 'dailyPosting', href: '/daily-posting', label: 'Log Posting', icon: Video },
    { id: 'dailyTasks', href: '/daily-tasks', label: 'Daily Tasks', icon: ListTodo },
    { id: 'dailyProgress', href: '/daily-progress', label: 'Daily Progress', icon: TrendingUp },
    { id: 'trainings_hub', href: '/trainings', label: 'Trainings', icon: GraduationCap },


    // Doctor Specific (already included in 'more')
    { id: 'ePrescription', href: '/e-prescription', label: 'E-Prescription', icon: FileText },


    // Social Media Specific
    { id: 'socialReporting', href: '/social-reporting', label: 'Reports', icon: FileText },
    { id: 'contentPlanner', href: '/content-planner', label: 'Planner', icon: CalendarCheck },
    { id: 'socialInbox', href: '/social-inbox', label: 'Inbox', icon: Share2 },
    { id: 'reachTracker', href: '/analytics/reach', label: 'Reach Tracker', icon: TrendingUp },

    // AI Tools at the very bottom
    { id: 'aiTools', href: '/recommendations', label: 'SkinSmith AI', icon: Sparkles },
];

const clinicGroups = [
    {
        label: "Main",
        ids: ["dashboard"]
    },
    {
        label: "Core Operations",
        ids: ["printPrescription", "appointments", "followUpCalendar", "followUpHistory", "patients", "doctors", "procedures", "inventory", "supplier", "billing", "todaySummary", "dailyExpenses"]
    },
    {
        label: "Medical & Pharmacy",
        ids: ["pharmacy.full", "healthRecords", "ePrescription"]
    },
    {
        label: "Team & Growth",
        ids: ["employeeReports", "trainings_hub"]
    },
    {
        label: "Intelligence & Reports",
        ids: ["reports.full"]
    },
    {
        label: "SkinSmith AI",
        ids: ["aiTools"]
    }
];

const reportsGroups = [
    {
        label: "Main",
        ids: ["dashboard"]
    },
    {
        label: "Reports and Analytics",
        ids: ["rep_finance", "rep_inventory", "rep_performance", "rep_expenses", "rep_salaries"]
    },
    {
        label: "SkinSmith AI",
        ids: ["aiTools"]
    }
];

const organizationGroups = [
    {
        label: "Main",
        ids: ["dashboard"]
    },
    {
        label: "Administrative",
        ids: ["userManagement", "featureControl"]
    },
    {
        label: "Team Management",
        ids: ["employeeReports", "taskManagement", "admin_trainings", "designerWork", "creativeBriefs", "creativeRequestHistory"]
    },
    {
        label: "Sales & Leads",
        ids: ["salesDashboard", "leads", "leadAssignment", "followUpHistory", "dailyReporting"]
    },
    {
        label: "Social & Growth",
        ids: ["dailyPosting", "dailyTasks", "dailyProgress", "trainings_hub", "socialReporting", "contentPlanner", "socialInbox", "reachTracker", "creativeRequestHistory"]
    },
    {
        label: "SkinSmith AI",
        ids: ["aiTools"]
    }
];

const SidebarMenuSkeleton = ({ showIcon }: { showIcon?: boolean }) => {
    const [width, setWidth] = React.useState("70%");

    React.useEffect(() => {
        setWidth(`${Math.floor(Math.random() * 40) + 50}%`);
    }, []);

    return (
        <div
            data-sidebar="menu-skeleton"
            className={cn("rounded-md h-8 flex gap-2 px-2 items-center")}
        >
            {showIcon && (
                <Skeleton
                    className="size-4 rounded-md"
                    data-sidebar="menu-skeleton-icon"
                />
            )}
            <Skeleton
                className="h-4 flex-1 max-w-[--skeleton-width]"
                data-sidebar="menu-skeleton-text"
                style={
                    {
                        "--skeleton-width": width,
                    } as React.CSSProperties
                }
            />
        </div>
    )
}


const NotificationBadge = ({ count }: { count: number }) => {
    if (count <= 0) return null;
    return (
        <span className="absolute -top-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white shadow-lg ring-2 ring-white dark:ring-slate-900 animate-pulse min-w-[18px] px-1">
            {count > 99 ? '99+' : count}
        </span>
    );
};


const NavContent = () => {
    const pathname = usePathname();
    const { state } = useSidebar();
    const { user: userProfile, isUserLoading } = useUser();
    const { viewMode, setViewMode } = useViewMode();
    const notificationCounts = useNotifications();

    const getCountForId = React.useCallback((id: string) => {
        if (id === 'printPrescription') return notificationCounts.printPrescription;
        if (id === 'leads') return notificationCounts.leads;
        if (id === 'socialInbox') return notificationCounts.socialInbox;
        return 0;
    }, [notificationCounts]);

    // For sidebar rendering, we determine if we should show the "grouped" view Modes.
    // We show this if the user is a true admin OR if they explicitly have a management flag.
    const isMainAdmin = React.useMemo(() => {
        const isTrueAdmin = userProfile?.email === 'admin1@skinsmith.com' || userProfile?.role === 'Admin' || userProfile?.role === 'Operations Manager';
        const hasAnyManagementFlag = userProfile?.featureAccess?.['mgmt_clinic'] || userProfile?.featureAccess?.['mgmt_organization'] || userProfile?.featureAccess?.['mgmt_reports'];
        return isTrueAdmin || !!hasAnyManagementFlag;
    }, [userProfile]);

    const filteredNavItems = React.useMemo(() => {
        if (isUserLoading) return [];

        if (isMainAdmin && userProfile?.role === 'Admin') {
            // Main admin sees everything, but we filter out redundant role-specific dashboards
            // because they use the unified root dashboard with switcher.
            return allMenuItems.filter(item => item.id !== 'salesDashboard' && item.id !== 'designerWork');
        }

        // 1. Determine base role access
        let baseAccessIds: string[] = [];
        if (userProfile?.role === 'Admin') {
            baseAccessIds = allMenuItems.filter(item => item.id !== 'userManagement' && item.id !== 'featureControl').map(i => i.id);
        } else if (userProfile?.role === 'Social Media Manager') {
            baseAccessIds = ['dashboard', 'socialReporting', 'contentPlanner', 'socialInbox', 'reachTracker', 'leadAssignment', 'dailyPosting', 'aiTools', 'creativeRequestHistory', 'adminTasks'];
        } else if (userProfile?.role === 'Designer') {
            // Designers and SMM now share the exact same unified platform planner.
            // Removed the private 'My Planner' to prevent data discrepancy.
            baseAccessIds = ['designerWork', 'creativeBriefs', 'contentPlanner', 'socialInbox', 'dailyReporting', 'aiTools', 'creativeRequestHistory', 'adminTasks'];
        } else if (userProfile?.role === 'Sales') {
            baseAccessIds = ['salesDashboard', 'leads', 'leadAssignment', 'dailyReporting', 'dailyPosting', 'dailyTasks', 'dailyProgress', 'trainings_hub', 'aiTools'];
        } else if (userProfile?.role === 'Operations Manager') {
            // Full Operational Visibility
            baseAccessIds = [
                'dashboard', 
                'printPrescription', 'appointments', 'followUpCalendar', 'followUpHistory', 'patients', 'doctors', 'procedures', 'inventory', 'supplier', 'billing', 'todaySummary', 'dailyExpenses',
                'leads', 'leadAssignment', 'socialReporting', 'aiTools'
            ];
        } else if (userProfile?.role === 'Doctor') {
            // Doctor gets core clinical tools but NOT Health Records (admin-managed)
            baseAccessIds = ['dashboard', 'patients', 'doctors', 'procedures', 'ePrescription', 'aiTools'];
        } else if (userProfile) {
            baseAccessIds = ['dashboard', 'settings']; // Default
        }

        // 2. Filter items based on base access OR explicit feature grants
        return allMenuItems.filter(item => {
            // Block SMM-specific items for Designer role to prevent mixing
            if (userProfile?.role === 'Designer') {
                const smmOnlyItems = ['socialReporting', 'reachTracker'];
                if (smmOnlyItems.includes(item.id)) return false;
            }

            // Check if it's in their base role
            if (baseAccessIds.includes(item.id)) return true;

            // Check if it was explicitly granted via featureAccess
            if (userProfile?.featureAccess) {
                if (userProfile.featureAccess[item.id]) return true;

                // Special handling for trainings which might have sub-features or distinct roles
                if (userProfile.featureAccess['trainings_hub'] || userProfile.featureAccess['admin_trainings']) {
                    if (item.id === 'admin_trainings' && userProfile.role === 'Admin') return true;
                    if (item.id === 'trainings_hub' && userProfile.role !== 'Admin') return true;
                }

                // Handling parent items if a subitem is granted
                if (item.subItems) {
                    return item.subItems.some(sub => userProfile.featureAccess?.[sub.id]);
                }
            }

            return false;
        });

        return [];
    }, [userProfile, isUserLoading, isMainAdmin]);

    const activeHref = React.useMemo(() => {
        let bestMatch = '';
        allMenuItems.forEach(item => {
            if (pathname === item.href || pathname.startsWith(item.href + '/')) {
                if (item.href.length > bestMatch.length) {
                    bestMatch = item.href;
                }
            }
        });
        return bestMatch;
    }, [pathname]);

    if (isUserLoading) {
        return (
            <div className="p-2 space-y-2">
                {[...Array(8)].map((_, i) => <SidebarMenuSkeleton key={i} showIcon />)}
            </div>
        )
    }
    // Role-specific roles always use their own dedicated nav layout, even if they
    // also hold management feature flags that would otherwise make isMainAdmin true.
    const ROLE_SPECIFIC_ROLES = ['Sales', 'Social Media Manager', 'Designer', 'Doctor', 'Receptionist'];
    const hasRoleSpecificNav = ROLE_SPECIFIC_ROLES.includes(userProfile?.role || '');
    const showAdminGroupedNav = isMainAdmin && !hasRoleSpecificNav;

    // Operations Manager only ever operates the clinic workstation — always show
    // the full operational nav regardless of whatever viewMode was last stored.
    const isOperationsManager = userProfile?.role === 'Operations Manager';

    // Hide sidebar completely for Main Admin if no viewMode is selected
    if (showAdminGroupedNav && viewMode === 'none' && !isOperationsManager) {
        return null;
    }

    // Main Admin View Logic
    if (showAdminGroupedNav) {
        const activeGroups = isOperationsManager ? clinicGroups : (viewMode === 'clinic' ? clinicGroups : (viewMode === 'reports' ? reportsGroups : organizationGroups));

        return (
            <div className="space-y-6">
                {activeGroups.map((group) => {
                    const groupItems = filteredNavItems.filter(item => group.ids.includes(item.id));
                    if (groupItems.length === 0) return null;

                    return (
                        <SidebarGroup key={group.label} className="px-2">
                            <SidebarGroupLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 px-4 mb-2">
                                {group.label}
                            </SidebarGroupLabel>
                            <SidebarGroupContent>
                                <SidebarMenu className="gap-1">
                                    {groupItems.map((item) => {
                                        const isActive = item.href === activeHref;
                                        return item.isMenu ? (
                                            <DropdownMenu key={item.id}>
                                                <SidebarMenuItem>
                                                    <Link prefetch={false} href={item.href}>
                                                        <DropdownMenuTrigger asChild>
                                                            <SidebarMenuButton
                                                                isActive={isActive}
                                                                tooltip={item.label}
                                                                className={cn(
                                                                    "w-full justify-between transition-all duration-300 rounded-xl px-4 h-11",
                                                                    isActive 
                                                                        ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none font-bold" 
                                                                        : "hover:bg-indigo-50/50 hover:text-indigo-600 dark:hover:bg-indigo-950/30 text-slate-600"
                                                                )}
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <div className="relative">
                                                                        {item.icon && <item.icon className={cn("w-4 h-4", isActive ? "text-white" : "text-slate-400 group-hover:text-indigo-600")} />}
                                                                        <NotificationBadge count={getCountForId(item.id)} />
                                                                    </div>
                                                                    <span className="text-sm tracking-tight">{item.label}</span>
                                                                </div>
                                                                {state === 'expanded' && <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-300", isActive ? "text-white/70" : "text-slate-400")} />}
                                                            </SidebarMenuButton>
                                                        </DropdownMenuTrigger>
                                                    </Link>
                                                </SidebarMenuItem>
                                                <DropdownMenuContent side="right" align="start" className="min-w-[200px] border-none bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-2xl rounded-2xl p-2 ml-4 animate-in fade-in zoom-in-95 duration-200">
                                                    {item.subItems?.map(subItem => (
                                                        <DropdownMenuItem key={subItem.href} asChild className="rounded-lg mb-1 focus:bg-indigo-50 focus:text-indigo-600 dark:focus:bg-indigo-950">
                                                            <Link prefetch={false} href={subItem.href} className={cn("px-3 py-2 text-sm transition-colors", pathname === subItem.href && 'bg-indigo-50 font-bold text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300')}>{subItem.label}</Link>
                                                        </DropdownMenuItem>
                                                    ))}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        ) : (
                                            <SidebarMenuItem key={item.id}>
                                                <Link prefetch={false} href={item.href}>
                                                    <SidebarMenuButton
                                                        isActive={isActive}
                                                        tooltip={item.label}
                                                        className={cn(
                                                            "w-full transition-all duration-300 rounded-xl px-4 h-11 group/btn",
                                                            isActive 
                                                                ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none font-bold scale-[1.02]" 
                                                                : "hover:bg-indigo-50/50 hover:text-indigo-600 dark:hover:bg-indigo-950/30 text-slate-600"
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="relative">
                                                                {item.icon && <item.icon className={cn("w-4 h-4 transition-transform group-hover/btn:scale-110", isActive ? "text-white" : "text-slate-400 group-hover:text-indigo-600")} />}
                                                                <NotificationBadge count={getCountForId(item.id)} />
                                                            </div>
                                                            <span className="text-sm tracking-tight">{item.label}</span>
                                                        </div>
                                                        {isActive && <div className="absolute right-2 w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                                                    </SidebarMenuButton>
                                                </Link>
                                            </SidebarMenuItem>
                                        );
                                    })}
                                </SidebarMenu>
                            </SidebarGroupContent>
                        </SidebarGroup>
                    );
                })}
            </div>
        );
    }

    // Role-based rendering for non-admins (preserving Social Media Manager custom layout if any)
    const moreMenuItems = filteredNavItems.filter(item => item.isMore);
    const mainMenuItems = filteredNavItems.filter(item => !item.isMore);

    if (userProfile?.role === 'Social Media Manager' || userProfile?.role === 'Designer') {
        const overviewIds = userProfile?.role === 'Designer' ? ['designerWork'] : ['dashboard'];
        const toolIds = ['contentPlanner', 'dailyPosting', 'socialInbox', 'creativeRequestHistory', 'creativeBriefs', 'adminTasks'];
        const insightIds = ['socialReporting', 'reachTracker', 'leadAssignment', 'dailyReporting'];

        const overviewItems = allMenuItems.filter(item => overviewIds.includes(item.id));
        const toolItems = allMenuItems.filter(item => toolIds.includes(item.id));
        const insightItems = allMenuItems.filter(item => insightIds.includes(item.id));

        return (
            <div className="space-y-6">
                <SidebarGroup className="px-2">
                    <SidebarGroupLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 px-4 mb-2">Main</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu className="gap-1">
                            {overviewItems.map((item) => (
                                <SidebarMenuItem key={item.id}>
                                    <Link prefetch={false} href={item.href}>
                                        <SidebarMenuButton isActive={pathname === item.href} tooltip={item.label} className={cn(
                                            "w-full transition-all duration-300 rounded-xl px-4 h-11 group/btn",
                                            pathname === item.href 
                                                ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none font-bold scale-[1.02]" 
                                                : "hover:bg-indigo-50/50 hover:text-indigo-600 dark:hover:bg-indigo-950/30 text-slate-600"
                                        )}>
                                            <div className="flex items-center gap-3">
                                                <div className="relative">
                                                    {item.icon && <item.icon className={cn("w-4 h-4 transition-transform group-hover/btn:scale-110", pathname === item.href ? "text-white" : "text-slate-400 group-hover:text-indigo-600")} />}
                                                    <NotificationBadge count={getCountForId(item.id)} />
                                                </div>
                                                <span className="text-sm tracking-tight">{item.label}</span>
                                            </div>
                                        </SidebarMenuButton>
                                    </Link>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>

                <SidebarGroup className="px-2">
                    <SidebarGroupLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500/60 px-4 mb-2">Quick Tools</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu className="gap-1">
                            {toolItems.map((item) => (
                                <SidebarMenuItem key={item.id}>
                                    <Link prefetch={false} href={item.href}>
                                        <SidebarMenuButton isActive={pathname === item.href} tooltip={item.label} className={cn(
                                            "w-full transition-all duration-300 rounded-xl px-4 h-11 group/btn",
                                            pathname === item.href 
                                                ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none font-bold scale-[1.02]" 
                                                : "hover:bg-indigo-50/50 hover:text-indigo-600 dark:hover:bg-indigo-950/30 text-slate-600"
                                        )}>
                                            <div className="flex items-center gap-3">
                                                <div className="relative">
                                                    {item.icon && <item.icon className={cn("w-4 h-4 transition-transform group-hover/btn:scale-110", pathname === item.href ? "text-white" : "text-indigo-600")} />}
                                                    <NotificationBadge count={getCountForId(item.id)} />
                                                </div>
                                                <span className="text-sm tracking-tight">{item.label}</span>
                                            </div>
                                        </SidebarMenuButton>
                                    </Link>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>

                <SidebarGroup className="px-2">
                    <SidebarGroupLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 px-4 mb-2">Insights & Assignment</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu className="gap-1">
                            {insightItems.map((item) => (
                                <SidebarMenuItem key={item.id}>
                                    <Link prefetch={false} href={item.href}>
                                        <SidebarMenuButton isActive={pathname === item.href} tooltip={item.label} className={cn(
                                            "w-full transition-all duration-300 rounded-xl px-4 h-11 group/btn",
                                            pathname === item.href 
                                                ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none font-bold scale-[1.02]" 
                                                : "hover:bg-indigo-50/50 hover:text-indigo-600 dark:hover:bg-indigo-950/30 text-slate-600"
                                        )}>
                                            <div className="flex items-center gap-3">
                                                <div className="relative">
                                                    {item.icon && <item.icon className={cn("w-4 h-4 transition-transform group-hover/btn:scale-110", pathname === item.href ? "text-white" : "text-slate-400 group-hover:text-indigo-600")} />}
                                                    <NotificationBadge count={getCountForId(item.id)} />
                                                </div>
                                                <span className="text-sm tracking-tight">{item.label}</span>
                                            </div>
                                        </SidebarMenuButton>
                                    </Link>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </div>
        );
    }

    return (
        <SidebarMenu className="gap-1 px-1">
            {mainMenuItems.map((item) => {
                const isActive = item.href === activeHref;
                return item.isMenu ? (
                    <DropdownMenu key={item.id}>
                        <SidebarMenuItem>
                            <Link prefetch={false} href={item.href}>
                                <DropdownMenuTrigger asChild>
                                    <SidebarMenuButton
                                        isActive={isActive}
                                        tooltip={item.label}
                                        className={cn(
                                            "w-full justify-between transition-all duration-300 rounded-xl px-4 h-11",
                                            isActive 
                                                ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none font-bold" 
                                                : "hover:bg-indigo-50/50 hover:text-indigo-600 dark:hover:bg-indigo-950/30 text-slate-600"
                                        )}
                                    >
                                        <div className="flex items-center gap-3">
                                            {item.icon && <item.icon className={cn("w-4 h-4", isActive ? "text-white" : "text-slate-400 group-hover:text-indigo-600")} />}
                                            <span className="text-sm tracking-tight">{item.label}</span>
                                        </div>
                                        {state === 'expanded' && <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-300", isActive ? "text-white/70" : "text-slate-400")} />}
                                    </SidebarMenuButton>
                                </DropdownMenuTrigger>
                            </Link>
                        </SidebarMenuItem>
                        <DropdownMenuContent side="right" align="start" className="min-w-[200px] border-none bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-2xl rounded-2xl p-2 ml-4 animate-in fade-in zoom-in-95 duration-200">
                            {item.subItems?.map(subItem => (
                                <DropdownMenuItem key={subItem.href} asChild className="rounded-lg mb-1 focus:bg-indigo-50 focus:text-indigo-600 dark:focus:bg-indigo-950">
                                    <Link prefetch={false} href={subItem.href} className={cn("px-3 py-2 text-sm transition-colors", pathname === subItem.href && 'bg-indigo-50 font-bold text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300')}>{subItem.label}</Link>
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                ) : (
                    <SidebarMenuItem key={item.id}>
                        <Link prefetch={false} href={item.href}>
                            <SidebarMenuButton
                                isActive={isActive}
                                tooltip={item.label}
                                className={cn(
                                    "w-full transition-all duration-300 rounded-xl px-4 h-11 group/btn",
                                    isActive 
                                        ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none font-bold scale-[1.02]" 
                                        : "hover:bg-indigo-50/50 hover:text-indigo-600 dark:hover:bg-indigo-950/30 text-slate-600"
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        {item.icon && <item.icon className={cn("w-4 h-4 transition-transform group-hover/btn:scale-110", isActive ? "text-white" : "text-slate-400 group-hover:text-indigo-600")} />}
                                        <NotificationBadge count={getCountForId(item.id)} />
                                    </div>
                                    <span className="text-sm tracking-tight">{item.label}</span>
                                </div>
                                {isActive && <div className="absolute right-2 w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                            </SidebarMenuButton>
                        </Link>
                    </SidebarMenuItem>
                );
            })}

            {moreMenuItems.length > 0 && (
                <DropdownMenu>
                    <SidebarMenuItem>
                        <DropdownMenuTrigger asChild>
                            <SidebarMenuButton
                                isActive={pathname.startsWith('/more')}
                                tooltip="More"
                                className="w-full justify-between transition-all duration-300 rounded-xl px-4 h-11 hover:bg-indigo-50/50 text-slate-600"
                            >
                                <div className="flex items-center gap-3">
                                    <MoreHorizontal className="w-4 h-4 text-slate-400" />
                                    <span className="text-sm tracking-tight">More</span>
                                </div>
                                {state === 'expanded' && <ChevronDown className="h-3.5 w-3.5 text-slate-400" />}
                            </SidebarMenuButton>
                        </DropdownMenuTrigger>
                    </SidebarMenuItem>
                    <DropdownMenuContent side="right" align="start" className="min-w-[200px] border-none bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-2xl rounded-2xl p-2 ml-4 animate-in fade-in zoom-in-95 duration-200">
                        {moreMenuItems.map(item => (
                            <DropdownMenuItem key={item.href} asChild className="rounded-lg mb-1 focus:bg-indigo-50 focus:text-indigo-600 dark:focus:bg-indigo-950">
                                <Link prefetch={false} href={item.href} className={cn("px-3 py-2 text-sm transition-colors", pathname === item.href && 'bg-indigo-50 font-bold text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300')}>{item.label}</Link>
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
        </SidebarMenu>
    );
}

export default function Nav() {
    const { state } = useSidebar();
    const auth = useAuth();

    const handleLogout = () => {
        signOut(auth);
    };

    return (
        <div className="flex flex-col h-full bg-white/40 dark:bg-slate-950/40 backdrop-blur-xl border-r border-indigo-100/50 dark:border-slate-800/50">
            <SidebarHeader className="border-b border-indigo-50/50 dark:border-slate-800/50">
                <div className="flex items-center gap-3 p-4">
                    <div className="bg-gradient-to-tr from-indigo-600 to-violet-600 p-2 rounded-2xl shadow-indigo-200 shadow-lg dark:shadow-none">
                        <Icon className="w-6 h-6 text-white" />
                    </div>
                    {state === 'expanded' && (
                        <div className="flex flex-col overflow-hidden animate-in fade-in slide-in-from-left-2 duration-500">
                            <h1 className="font-black text-xl font-headline tracking-tighter text-slate-800 dark:text-white">SkinSmith</h1>
                            <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-500/70 -mt-1 leading-none">Clinic Manager</span>
                        </div>
                    )}
                </div>
            </SidebarHeader>

            <SidebarContent className="p-3 scrollbar-hide">
                <NavContent />
            </SidebarContent>

            <SidebarFooter className="p-3 border-t border-indigo-50/50 dark:border-slate-800/50 bg-indigo-50/20 dark:bg-slate-900/20">
                <SidebarMenu className="gap-1">
                    <SidebarMenuItem>
                        <Link prefetch={false} href="/settings">
                            <SidebarMenuButton className="h-10 rounded-xl hover:bg-white dark:hover:bg-slate-800 transition-all duration-300 group" tooltip="Settings">
                                <Settings className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
                                <span className="text-sm font-medium text-slate-600 group-hover:text-slate-900 dark:group-hover:text-slate-200">Settings</span>
                            </SidebarMenuButton>
                        </Link>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton 
                            className="h-10 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/30 transition-all duration-300 group" 
                            tooltip="Logout" 
                            onClick={handleLogout}
                        >
                            <LogOut className="w-4 h-4 text-slate-400 group-hover:text-red-600" />
                            <span className="text-sm font-medium text-slate-600 group-hover:text-red-600 dark:group-hover:text-red-400">Logout</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
        </div>
    );
}
