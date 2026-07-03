import React, { useState, useEffect } from 'react';
import { UserProfile, TimeEntry, Invoice, InvoiceItem, Customer } from '../types';
import { 
    ShieldAlert, 
    Users, 
    Search, 
    ChevronLeft, 
    ArrowRight, 
    Download, 
    DollarSign, 
    Clock, 
    FileText, 
    Plus, 
    Trash2, 
    MessageSquare, 
    Building, 
    Contact, 
    MapPin, 
    Sliders, 
    Calendar, 
    ChevronRight, 
    Briefcase,
    Settings,
    X,
    UserCheck,
    Coins,
    UserX,
    Edit
} from 'lucide-react';
import { generateInvoicePDF } from '../services/pdfService';
import Messaging from './Messaging';
import AdminBottomNav from './AdminBottomNav';
import { chatService } from '../services/chatService';
import { getDirectImageUrl } from '../photoUtils';

interface AdminDashboardProps {
    onClose: () => void;
    profile: UserProfile;
}

interface AdminData {
    users: any[];
    entries: any[];
    invoices: Invoice[];
    projects: string[];
    customers: Customer[];
    companyInfo?: any;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onClose, profile }) => {
    // If Admin accesses before setting a profile, create a default admin profile
    const safeProfile = profile || { id: 'admin', name: 'Administrator', hourlyWage: 0 };
    const [pin, setPin] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [adminData, setAdminData] = useState<AdminData | null>(null);
    const [selectedUser, setSelectedUser] = useState<string | null>(null);
    const [selectedJob, setSelectedJob] = useState<string | null>(null);
    const [selectedWeek, setSelectedWeek] = useState<string>('all');
    
    // Edit time entry state
    const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
    const [editClockIn, setEditClockIn] = useState('');
    const [editClockOut, setEditClockOut] = useState('');
    const [editProject, setEditProject] = useState('');
    
    const [unreadChatCount, setUnreadChatCount] = useState(0);
    
    // Hub State ('hub' is the main dashboard launcher, replacing a big clutter of buttons)
    const [activeTab, setActiveTabState] = useState<'hub' | 'live' | 'employees' | 'customers' | 'invoices' | 'jobs' | 'chat' | 'company'>('hub');

    const setActiveTab = async (tab: 'hub' | 'live' | 'employees' | 'customers' | 'invoices' | 'jobs' | 'chat' | 'company') => {
        setActiveTabState(tab);
        if (tab !== 'hub') {
            await fetchAdminData();
        }
    };

    // Company Info State
    const [companyInfo, setCompanyInfo] = useState({
        businessName: 'PROCONTRACTOR',
        tagline: 'PREMIUM TRACKED TIME & FIELD SERVICES INVOICING',
        contactLine: 'Contact: billing@procontractor.com | Tel: (555) 019-9238',
        address: ''
    });

    // Make Invoice state
    const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
    const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
    const [invoiceCustomer, setInvoiceCustomer] = useState('');
    const [invoiceMarkup, setInvoiceMarkup] = useState<number>(1.0); // Multiplier
    const [invoiceSelectedEntries, setInvoiceSelectedEntries] = useState<Set<string>>(new Set());
    const [invoiceManualItems, setInvoiceManualItems] = useState<InvoiceItem[]>([]);
    const [invoiceShowCostBreakdown, setInvoiceShowCostBreakdown] = useState<boolean>(true);
    const [invoiceSelectedColumns, setInvoiceSelectedColumns] = useState<string[]>([
        "Descriptive Log / Additions",
        "Category",
        "Qty / Hours",
        "Base Rate",
        "Markup",
        "Amount"
    ]);
    const [invoiceWeekFilter, setInvoiceWeekFilter] = useState<string>('all');
    const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<string>('unbilled'); // unbilled, billed, all
    const [newManualItemDesc, setNewManualItemDesc] = useState('');
    const [newManualItemAmt, setNewManualItemAmt] = useState('');

    const [isAddingEmployee, setIsAddingEmployee] = useState(false);
    const [isManagingStaff, setIsManagingStaff] = useState(false);
    const [editEmployeeId, setEditEmployeeId] = useState<string | null>(null);
    const [editEmpName, setEditEmpName] = useState('');
    const [editEmpWage, setEditEmpWage] = useState('');
    const [newEmpName, setNewEmpName] = useState('');
    const [newEmpWage, setNewEmpWage] = useState('');

    // Jobs management state
    const [isAddingJob, setIsAddingJob] = useState(false);
    const [newJobName, setNewJobName] = useState('');

    // Customers management state
    const [isAddingCustomer, setIsAddingCustomer] = useState(false);
    const [newCustomerName, setNewCustomerName] = useState('');
    const [newCustomerEmail, setNewCustomerEmail] = useState('');
    const [newCustomerPhone, setNewCustomerPhone] = useState('');
    const [newCustomerAddress, setNewCustomerAddress] = useState('');
    const [autoCreateProject, setAutoCreateProject] = useState(true);

    const ADMIN_PIN = '1234';

    // Subscribe to unread chat count
    useEffect(() => {
        if (!isAuthenticated) return;
        const unsubscribe = chatService.subscribeToUnreadCount((count) => {
            setUnreadChatCount(count);
        });
        chatService.startPolling(5000);

        return () => {
            unsubscribe();
            chatService.stopPolling();
        };
    }, [isAuthenticated]);

    // Auto-poll if on live tracking tab
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (activeTab === 'live' && isAuthenticated) {
            interval = setInterval(() => {
                fetchAdminData(true);
            }, 10000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [activeTab, isAuthenticated]);

    const handleSaveCompanyInfo = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    payload: { action: 'SAVE_COMPANY_INFO', payload: companyInfo }
                })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Failed to sync company info');
            localStorage.setItem('geotime_company_info', JSON.stringify(companyInfo));
            alert('Company info saved successfully to master database.');
        } catch (err: any) {
            alert('Failed to save company info to database: ' + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (pin === ADMIN_PIN) {
            setIsAuthenticated(true);
            fetchAdminData();
            setActiveTab('hub');
        } else {
            setError('Invalid PIN code');
        }
    };

    const fetchAdminData = async (isBackgroundPoll: boolean = false) => {
        if (!isBackgroundPoll) setIsLoading(true);
        setError('');
        try {
            const response = await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    payload: { action: 'FETCH_ADMIN_DATA' }
                })
            });
            const result = await response.json();
            if (result.success && result.data) {
                setAdminData(result.data);
                if (result.data.companyInfo) {
                     setCompanyInfo(result.data.companyInfo);
                     localStorage.setItem('geotime_company_info', JSON.stringify(result.data.companyInfo));
                }
            } else {
                throw new Error("Failed to load admin data");
            }
        } catch (err: any) {
            setError("Error syncing from master sheet.");
        } finally {
            if (!isBackgroundPoll) setIsLoading(false);
        }
    };

    const handleAddJob = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = newJobName.trim();
        if (!trimmed) {
            alert('Job Name is required');
            return;
        }
        setIsLoading(true);
        try {
            const res = await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    payload: { 
                        action: 'ADD_JOB', 
                        payload: { name: trimmed }
                    }
                })
            });
            const data = await res.json();
            if (!data.success) {
                throw new Error(data.error || 'Failed to add job');
            }
            setNewJobName('');
            setIsAddingJob(false);
            await fetchAdminData();
        } catch (err: any) {
            alert('Failed to add job: ' + (err.message || 'Unknown error'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteJob = async (name: string) => {
        if (!window.confirm(`Are you sure you want to delete job "${name}"?`)) return;
        setIsLoading(true);
        try {
            const res = await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    payload: { 
                        action: 'DELETE_JOB', 
                        payload: { name }
                    }
                })
            });
            const data = await res.json();
            if (!data.success) {
                throw new Error(data.error || 'Failed to delete job');
            }
            await fetchAdminData();
        } catch (err: any) {
            alert('Failed to delete job: ' + (err.message || 'Unknown error'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddCustomer = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = newCustomerName.trim();
        if (!trimmed) {
            alert('Customer Name is required');
            return;
        }
        setIsLoading(true);
        const newId = Math.random().toString(36).substring(2, 10);
        try {
            const res = await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    payload: { 
                        action: 'ADD_CUSTOMER', 
                        payload: { 
                            id: newId, 
                            name: trimmed, 
                            email: newCustomerEmail.trim(), 
                            phone: newCustomerPhone.trim(), 
                            address: newCustomerAddress.trim() 
                        }
                    }
                })
            });
            const data = await res.json();
            if (!data.success) {
                throw new Error(data.error || 'Failed to add customer');
            }

            // Also create corresponding project if selected
            if (autoCreateProject) {
                try {
                    await fetch('/api/sync', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            payload: {
                                action: 'ADD_PROJECT',
                                payload: { name: trimmed }
                            }
                        })
                    });
                } catch (projErr) {
                    console.error('Error auto-creating matching project:', projErr);
                }
            }

            setNewCustomerName('');
            setNewCustomerEmail('');
            setNewCustomerPhone('');
            setNewCustomerAddress('');
            setIsAddingCustomer(false);
            await fetchAdminData();
        } catch (err: any) {
            alert('Failed to add customer: ' + (err.message || 'Unknown error'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteCustomer = async (id: string, name: string) => {
        if (!window.confirm(`Are you sure you want to delete customer "${name}"?`)) return;
        setIsLoading(true);
        try {
            const res = await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    payload: { 
                        action: 'DELETE_CUSTOMER', 
                        payload: { id }
                    }
                })
            });
            const data = await res.json();
            if (!data.success) {
                throw new Error(data.error || 'Failed to delete customer');
            }
            await fetchAdminData();
        } catch (err: any) {
            alert('Failed to delete customer: ' + (err.message || 'Unknown error'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddEmployee = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newEmpName.trim() || isNaN(parseFloat(newEmpWage))) {
            alert('Valid Name and Wage required');
            return;
        }
        setIsLoading(true);
        const newId = Math.random().toString(36).substring(2, 10);
        try {
            const res = await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    payload: { 
                        action: 'ADD_EMPLOYEE', 
                        payload: { id: newId, name: newEmpName.trim(), hourlyWage: parseFloat(newEmpWage) }
                    }
                })
            });
            const data = await res.json();
            if (!data.success) {
                throw new Error(data.error || 'Failed to add employee');
            }
            setNewEmpName('');
            setNewEmpWage('');
            setIsAddingEmployee(false);
            await fetchAdminData();
        } catch (err: any) {
            alert('Failed to add employee: ' + (err.message || 'Unknown error'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleEditEmployee = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editEmpName.trim() || isNaN(parseFloat(editEmpWage)) || !editEmployeeId) {
            alert('Valid Name and Wage required');
            return;
        }
        setIsLoading(true);
        try {
            const res = await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    payload: { 
                        action: 'EDIT_EMPLOYEE', 
                        payload: { id: editEmployeeId, name: editEmpName.trim(), hourlyWage: parseFloat(editEmpWage) }
                    }
                })
            });
            const data = await res.json();
            if (!data.success) {
                throw new Error(data.error || 'Failed to edit employee');
            }
            setEditEmployeeId(null);
            setEditEmpName('');
            setEditEmpWage('');
            await fetchAdminData();
        } catch (err: any) {
            alert('Failed to edit employee: ' + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteEmployee = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this employee?')) return;
        setIsLoading(true);
        try {
            const res = await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    payload: { 
                        action: 'DELETE_EMPLOYEE', 
                        payload: { id }
                    }
                })
            });
            const data = await res.json();
            if (!data.success) {
                throw new Error(data.error || 'Failed to delete employee');
            }
            await fetchAdminData();
        } catch (err: any) {
            alert('Failed to delete employee: ' + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddManualItem = () => {
        if (!newManualItemDesc.trim() || isNaN(parseFloat(newManualItemAmt))) return;
        setInvoiceManualItems([...invoiceManualItems, {
            id: Math.random().toString(36).substring(2, 8),
            description: newManualItemDesc.trim(),
            amount: parseFloat(newManualItemAmt)
        }]);
        setNewManualItemDesc('');
        setNewManualItemAmt('');
    };

    const handleSaveInvoice = async (total: number) => {
        if (!invoiceCustomer.trim()) {
            alert('Customer name required');
            return;
        }
        setIsLoading(true);
        const existingInv = adminData?.invoices?.find(i => i.id === editingInvoiceId);
        const inv: Invoice = {
            id: editingInvoiceId || Math.random().toString(36).substring(2, 12),
            date: existingInv ? existingInv.date : new Date().toISOString(),
            customerName: invoiceCustomer.trim(),
            timeEntryIds: Array.from(invoiceSelectedEntries),
            manualItems: invoiceManualItems,
            markupMultiplier: invoiceMarkup,
            total: total,
            showCostBreakdown: invoiceShowCostBreakdown,
            selectedColumns: invoiceSelectedColumns
        };

        try {
            const res = await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    payload: { action: 'SAVE_INVOICE', payload: inv }
                })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Failed to save');
            
            // Generate and trigger immediate download of the invoice PDF
            if (adminData) {
                generateInvoicePDF(inv, adminData.users, adminData.entries);
            }
            
            setIsCreatingInvoice(false);
            setEditingInvoiceId(null);
            setInvoiceCustomer('');
            setInvoiceSelectedEntries(new Set());
            setInvoiceManualItems([]);
            setInvoiceMarkup(1.0);
            setInvoiceShowCostBreakdown(true);
            setInvoiceSelectedColumns([
                "Descriptive Log / Additions",
                "Category",
                "Qty / Hours",
                "Base Rate",
                "Markup",
                "Amount"
            ]);
            await fetchAdminData();
        } catch (err: any) {
            alert('Failed to save invoice: ' + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSetBilledStatus = async (entryIds: string[], isBilled: boolean) => {
        if (entryIds.length === 0) return;
        setIsLoading(true);
        try {
            const res = await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    payload: { 
                        action: 'SET_ENTRIES_BILLED_STATUS', 
                        payload: { entryIds, isBilled } 
                    }
                })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Failed to update billed status');
            await fetchAdminData();
        } catch (err: any) {
            alert('Failed to update billed status: ' + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveTimeEntry = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingEntry) return;
        setIsLoading(true);
        try {
            const updatedEntry = {
                ...editingEntry,
                clockIn: new Date(editClockIn).toISOString(),
                clockOut: editClockOut ? new Date(editClockOut).toISOString() : undefined,
                projectName: editProject
            };
            const res = await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    payload: { action: 'EDIT_TIME_ENTRY', payload: { entry: updatedEntry } }
                })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Failed to edit time entry');
            setEditingEntry(null);
            await fetchAdminData();
        } catch (err: any) {
            alert('Failed to edit time entry: ' + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteTimeEntry = async (entryId: string) => {
        if (!window.confirm('Are you sure you want to delete this time entry?')) return;
        setIsLoading(true);
        try {
            const res = await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    payload: { action: 'DELETE_TIME_ENTRY', payload: { entryId } }
                })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Failed to delete time entry');
            await fetchAdminData();
        } catch (err: any) {
            alert('Failed to delete time entry: ' + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isAuthenticated) {
        return (
            <div className="w-full max-w-md mx-auto min-h-[100dvh] bg-slate-50 flex flex-col justify-between p-6 shadow-xl relative pb-12">
                <div className="flex-1 flex flex-col items-center justify-center pt-8">
                    <div className="w-16 h-16 bg-blue-950 rounded-2xl flex items-center justify-center mb-6 shadow-md border border-white/10">
                        <ShieldAlert className="text-blue-500 w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-1.5 tracking-tight">Admin Console</h2>
                    <p className="text-xs font-semibold text-slate-500 mb-8 text-center max-w-[260px] leading-relaxed">
                        Security verification required to unlock executive workforce directory and financials.
                    </p>
                    
                    <form onSubmit={handleLogin} className="w-full flex flex-col gap-4 max-w-xs">
                        <div className="relative">
                            <input 
                                type="password"
                                autoFocus
                                placeholder="••••"
                                value={pin}
                                onChange={(e) => setPin(e.target.value)}
                                className="w-full px-4 py-3.5 text-center tracking-[0.6em] text-3xl font-extrabold bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all shadow-inner placeholder-slate-350"
                            />
                        </div>
                        {error && <p className="text-xs font-semibold text-red-650 text-center animate-pulse">{error}</p>}
                        
                        <button type="submit" className="w-full bg-blue-950 text-white py-3.5 rounded-2xl font-bold shadow-md hover:bg-slate-900 active:scale-98 transition-all mt-2 cursor-pointer text-sm">
                            Unlock Controls
                        </button>
                    </form>
                </div>
                
                <div className="text-center pt-6 shrink-0">
                    <button onClick={onClose} className="text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer transition-colors px-4 py-2 rounded-lg hover:bg-slate-100">
                        Cancel & Return
                    </button>
                </div>
            </div>
        );
    }

    const filteredEntries = adminData?.entries.filter(e => {
        const matchesUser = selectedUser ? String(e.profileId).trim() === String(selectedUser).trim() : true;
        const matchesJob = selectedJob ? (e.projectName || 'General') === selectedJob : true;
        
        let matchesWeek = true;
        if (selectedWeek !== 'all') {
            const entryDate = new Date(e.clockIn);
            const today = new Date();
            if (selectedWeek === 'this_week') {
                const startOfWeek = new Date(today);
                startOfWeek.setDate(today.getDate() - today.getDay());
                startOfWeek.setHours(0,0,0,0);
                matchesWeek = entryDate >= startOfWeek;
            } else if (selectedWeek === 'last_week') {
                const startOfLastWeek = new Date(today);
                startOfLastWeek.setDate(today.getDate() - today.getDay() - 7);
                startOfLastWeek.setHours(0,0,0,0);
                const endOfLastWeek = new Date(startOfLastWeek);
                endOfLastWeek.setDate(startOfLastWeek.getDate() + 7);
                matchesWeek = entryDate >= startOfLastWeek && entryDate < endOfLastWeek;
            } else if (selectedWeek === 'this_month') {
                const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
                matchesWeek = entryDate >= startOfMonth;
            }
        }
        
        return matchesUser && matchesJob && matchesWeek;
    }) || [];
    
    // Totals calc
    let totalHours = 0;
    let totalPay = 0;
    filteredEntries.forEach(entry => {
        // Find user for wage
        const user = adminData?.users.find(u => String(u.id).trim() === String(entry.profileId).trim());
        const wage = user ? parseFloat(user.hourlyWage) : 0;
        
        let inTime = new Date(entry.clockIn).getTime();
        let outTime = entry.clockOut ? new Date(entry.clockOut).getTime() : Date.now();
        const durationHr = (outTime - inTime) / (1000 * 60 * 60);
        
        totalHours += Math.max(0, durationHr);
        totalPay += Math.max(0, durationHr) * wage;
    });

    const activeWorkersCount = adminData?.entries.filter(e => !e.clockOut).length || 0;

    return (
        <div className="w-full max-w-md mx-auto min-h-[100dvh] bg-slate-50 flex flex-col relative shadow-xl overflow-y-auto pb-20">
            {/* 1. Global Admin Header (Clean, consistent layout like normal app) */}
            <header className="bg-blue-950 text-white px-5 py-4 shrink-0 relative flex items-center justify-between shadow-sm z-30">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-bold text-sm text-white border border-white/15">
                        A
                    </div>
                    <div>
                        <h1 className="text-sm font-bold tracking-tight">Admin Portal</h1>
                        <p className="text-[10px] font-bold text-blue-300 uppercase tracking-wider">ProContractor Executive</p>
                    </div>
                </div>
                <button 
                    onClick={onClose}
                    className="px-3 py-1.5 bg-white/10 hover:bg-white/20 active:scale-95 text-xs font-bold text-white rounded-lg transition-all cursor-pointer"
                >
                    Exit Console
                </button>
            </header>

            {/* MAIN PORTAL BODY VIEWPORTS */}
            <div className="flex-1 w-full p-5 flex flex-col pb-24">
                
                {/* A. HOME HUB VIEWPORT (Replaces the "bunch of buttons" layout with a gorgeous mobile dashboard launcher) */}
                {activeTab === 'hub' && (
                    <div className="flex-1 flex flex-col animate-in fade-in transition-all duration-300">
                        
                        {/* At-A-Glance Bento Stats Grid */}
                        <div className="grid grid-cols-3 gap-3 mb-6">
                            {/* Live Workers Stat */}
                            <div className="bg-white rounded-2xl border border-slate-100 p-3.5 shadow-sm flex flex-col justify-between min-h-[96px]">
                                <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Live Now</span>
                                    <span className="relative flex h-2.5 w-2.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                                    </span>
                                </div>
                                <div className="mt-2.5">
                                    <p className="text-2xl font-extrabold text-slate-800 leading-none">{activeWorkersCount}</p>
                                    <p className="text-[10px] text-slate-500 font-medium mt-1">Clocked In</p>
                                </div>
                            </div>

                            {/* Total Hours Stat */}
                            <div className="bg-white rounded-2xl border border-slate-100 p-3.5 shadow-sm flex flex-col justify-between min-h-[96px]">
                                <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Hours</span>
                                    <Clock className="w-4 h-4 text-blue-500 shrink-0" />
                                </div>
                                <div className="mt-2.5">
                                    <p className="text-2xl font-extrabold text-slate-800 leading-none">{totalHours.toFixed(1)}h</p>
                                    <p className="text-[10px] text-slate-500 font-medium mt-1">Total Time</p>
                                </div>
                            </div>

                            {/* Estimated Payroll Stat */}
                            <div className="bg-white rounded-2xl border border-slate-100 p-3.5 shadow-sm flex flex-col justify-between min-h-[96px]">
                                <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Payroll</span>
                                    <DollarSign className="w-4 h-4 text-emerald-550 shrink-0" />
                                </div>
                                <div className="mt-2.5">
                                    <p className="text-2xl font-extrabold text-slate-850 leading-none">
                                        ${totalPay.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </p>
                                    <p className="text-[10px] text-slate-500 font-medium mt-1">Gross Cost</p>
                                </div>
                            </div>
                        </div>

                        {/* Navigation Section Header */}
                        <div className="mb-3 pl-1">
                            <h3 className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">Management Directories</h3>
                        </div>

                        {/* Executive Tool Grid (Elegant action hubs with custom icons, titles, and subtext) */}
                        <div className="space-y-3">
                            {/* 1. Live Field Tracker */}
                            <button 
                                onClick={() => setActiveTab('live')}
                                className="w-full bg-white hover:bg-slate-50 border border-slate-100 rounded-2xl p-4 text-left transition-all active:scale-98 shadow-sm flex items-center justify-between group cursor-pointer"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors">
                                        <MapPin className="w-5.5 h-5.5" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-800 text-sm group-hover:text-blue-650 transition-colors">Live Field Tracker</h4>
                                        <p className="text-xs text-slate-500 mt-0.5">Track maps and positions of currently active workers.</p>
                                    </div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-650 group-hover:translate-x-0.5 transition-all shrink-0" />
                            </button>

                            {/* 2. Timesheets & Directory */}
                            <button 
                                onClick={() => setActiveTab('employees')}
                                className="w-full bg-white hover:bg-slate-50 border border-slate-100 rounded-2xl p-4 text-left transition-all active:scale-98 shadow-sm flex items-center justify-between group cursor-pointer"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 group-hover:bg-emerald-100 transition-colors">
                                        <Users className="w-5.5 h-5.5" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-800 text-sm group-hover:text-emerald-650 transition-colors">Workforce & Timesheets</h4>
                                        <p className="text-xs text-slate-500 mt-0.5">Manage directory, change wages, view logs, and payrolls</p>
                                    </div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-650 group-hover:translate-x-0.5 transition-all shrink-0" />
                            </button>

                            {/* 3. Clients / Customers */}
                            <button 
                                onClick={() => setActiveTab('customers')}
                                className="w-full bg-white hover:bg-slate-50 border border-slate-100 rounded-2xl p-4 text-left transition-all active:scale-98 shadow-sm flex items-center justify-between group cursor-pointer"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 group-hover:bg-purple-100 transition-colors">
                                        <Contact className="w-5.5 h-5.5" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-800 text-sm group-hover:text-purple-650 transition-colors">Client Directory</h4>
                                        <p className="text-xs text-slate-500 mt-0.5">Manage details and coordinates of registered buyers.</p>
                                    </div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-purple-650 group-hover:translate-x-0.5 transition-all shrink-0" />
                            </button>

                            {/* 4. Project Sites */}
                            <button 
                                onClick={() => setActiveTab('jobs')}
                                className="w-full bg-white hover:bg-slate-50 border border-slate-100 rounded-xl p-4 text-left transition-all active:scale-98 shadow-sm flex items-center justify-between group cursor-pointer"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 group-hover:bg-amber-100 transition-colors">
                                        <Briefcase className="w-5.5 h-5.5" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-800 text-sm group-hover:text-amber-650 transition-colors">Residential Projects</h4>
                                        <p className="text-xs text-slate-500 mt-0.5">Setup active buildings, target codes, and field scopes.</p>
                                    </div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-amber-650 group-hover:translate-x-0.5 transition-all shrink-0" />
                            </button>

                            {/* 5. Invoicing & Invoices */}
                            <button 
                                onClick={() => setActiveTab('invoices')}
                                className="w-full bg-white hover:bg-slate-50 border border-slate-100 rounded-2xl p-4 text-left transition-all active:scale-98 shadow-sm flex items-center justify-between group cursor-pointer"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-11 h-11 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0 group-hover:bg-cyan-100 transition-colors">
                                        <FileText className="w-5.5 h-5.5" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-800 text-sm group-hover:text-cyan-650 transition-colors">Billing & Invoices</h4>
                                        <p className="text-xs text-slate-500 mt-0.5">Draft client PDF timesheets and view invoice archives.</p>
                                    </div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-cyan-650 group-hover:translate-x-0.5 transition-all shrink-0" />
                            </button>

                            {/* 6. Direct Messenger */}
                            <button 
                                onClick={() => setActiveTab('chat')}
                                className="w-full bg-white hover:bg-slate-50 border border-slate-100 rounded-2xl p-4 text-left transition-all active:scale-98 shadow-sm flex items-center justify-between group cursor-pointer"
                            >
                                <div className="flex items-center gap-4 font-semibold">
                                    <div className="w-11 h-11 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0 group-hover:bg-sky-100 transition-colors relative">
                                        <MessageSquare className="w-5.5 h-5.5" />
                                        {unreadChatCount > 0 && (
                                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-550 border-2 border-white text-white font-extrabold text-[10px] rounded-full flex items-center justify-center">
                                                {unreadChatCount}
                                            </span>
                                        )}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-1.5">
                                            <h4 className="font-bold text-slate-800 text-sm group-hover:text-sky-650 transition-colors">Staff Communications</h4>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-0.5">Send direct announcements or request log confirmations.</p>
                                    </div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-sky-650 group-hover:translate-x-0.5 transition-all shrink-0" />
                            </button>

                            {/* 7. Company settings */}
                            <button 
                                onClick={() => setActiveTab('company')}
                                className="w-full bg-white hover:bg-slate-50 border border-slate-100 rounded-2xl p-4 text-left transition-all active:scale-98 shadow-sm flex items-center justify-between group cursor-pointer"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-650 flex items-center justify-center shrink-0 group-hover:bg-slate-200 transition-colors">
                                        <Settings className="w-5.5 h-5.5 animate-spin-slow" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-800 text-sm group-hover:text-slate-900 transition-colors">Company Identity</h4>
                                        <p className="text-xs text-slate-500 mt-0.5">Adjust physical contacts, phone indices, and invoices.</p>
                                    </div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-900 group-hover:translate-x-0.5 transition-all shrink-0" />
                            </button>
                        </div>
                    </div>
                )}

                {/* B. LIVE employee TRACES VIEWPORT */}
                {activeTab === 'live' && (
                    <div className="flex-1 flex flex-col animate-in slide-in-from-right duration-200">
                        {/* Navigation Sub-Header */}
                        <div className="flex items-center gap-3 mb-5 pl-1">
                            <button onClick={() => setActiveTab('hub')} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-all cursor-pointer">
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <div>
                                <h2 className="text-base font-bold text-slate-800 leading-none">Live Employee Tracker</h2>
                                <p className="text-xs text-slate-500 mt-1">Real-time coordinates of currently active field builders</p>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
                            {isLoading ? (
                                <div className="py-8 text-center flex justify-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-900 border-t-transparent"></div>
                                </div>
                            ) : adminData?.entries.filter(e => !e.clockOut).length === 0 ? (
                                <div className="py-8 text-center">
                                    <UserX className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                                    <p className="text-slate-400 text-sm font-semibold">No employees currently clocked in.</p>
                                </div>
                            ) : (
                                adminData?.entries.filter(e => !e.clockOut).map((e, idx) => {
                                    const user = adminData.users.find(u => String(u.id).trim() === String(e.profileId).trim());
                                    return (
                                        <div key={`${e.id || 'active'}_${idx}`} className="p-4 bg-slate-50 border border-slate-150 rounded-xl flex items-center justify-between hover:border-blue-250 transition-all">
                                            <div>
                                                <p className="font-bold text-[14px] text-slate-800">{user?.name || 'Unknown User'}</p>
                                                <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1">
                                                    <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                                                    Job Site: <span className="font-bold text-slate-700">{e.projectName || 'General'}</span>
                                                </p>
                                                {e.clockInLocation && (
                                                    <p className="text-[10px] text-slate-400 mt-1.5 font-mono">
                                                        Lat: {e.clockInLocation.latitude.toFixed(4)}, Lng: {e.clockInLocation.longitude.toFixed(4)}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="text-right flex flex-col items-end">
                                                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-lg mb-2">
                                                    In: {new Date(e.clockIn).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                </span>
                                                {e.clockInLocation && (
                                                    <a 
                                                        href={`https://www.google.com/maps/search/?api=1&query=${e.clockInLocation?.latitude},${e.clockInLocation?.longitude}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline border border-blue-100 bg-blue-50 px-2.5 py-1 rounded-lg hover:bg-blue-100 transition-colors"
                                                    >
                                                        <MapPin className="w-3 h-3" /> Pin Map
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}

                {/* C. WORKFORCE / TIMESHEETS VIEWPORT */}
                {activeTab === 'employees' && (
                    <div className="flex-1 flex flex-col animate-in slide-in-from-right duration-200">
                        {/* Navigation Header */}
                        <div className="flex items-center gap-3 mb-5 pl-1 justify-between">
                            <div className="flex items-center gap-3">
                                <button onClick={() => setActiveTab('hub')} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-all cursor-pointer">
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <div>
                                    <h2 className="text-base font-bold text-slate-800 leading-none">Workforce Management</h2>
                                    <p className="text-xs text-slate-500 mt-1">Rates, timesheets, and payroll reporting logs</p>
                                </div>
                            </div>
                        </div>

                        {/* Directory Action controls */}
                        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm mb-5">
                            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-4">
                                <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">Directory Controls</span>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => { setIsManagingStaff(!isManagingStaff); setIsAddingEmployee(false); }}
                                        className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 cursor-pointer ${isManagingStaff ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                                    >
                                        <Users className="w-3.5 h-3.5" /> {isManagingStaff ? 'Done' : 'Manage'}
                                    </button>
                                    <button 
                                        onClick={() => { setIsAddingEmployee(!isAddingEmployee); setIsManagingStaff(false); }}
                                        className="bg-blue-950 text-white text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-slate-900 transition-all flex items-center gap-1 cursor-pointer"
                                    >
                                        {isAddingEmployee ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />} New
                                    </button>
                                </div>
                            </div>

                            {/* Staff Management List */}
                            {isManagingStaff && (
                                <div className="p-4 bg-slate-50 border border-slate-150 rounded-2xl flex flex-col gap-3 mb-4 animate-in slide-in-from-top duration-300">
                                    <h4 className="text-xs font-bold text-slate-700 leading-none">Manage Staff</h4>
                                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                        {adminData?.users.map(u => (
                                            <div key={u.id} className="flex flex-col p-3 bg-white border border-slate-200 rounded-xl">
                                                {editEmployeeId === u.id ? (
                                                    <form onSubmit={handleEditEmployee} className="flex flex-col gap-2">
                                                        <div className="flex gap-2">
                                                            <input 
                                                                type="text" required placeholder="Name"
                                                                value={editEmpName} onChange={e => setEditEmpName(e.target.value)}
                                                                className="flex-1 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none"
                                                            />
                                                            <input 
                                                                type="number" required placeholder="Wage"
                                                                value={editEmpWage} onChange={e => setEditEmpWage(e.target.value)}
                                                                step="0.01" className="w-20 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none"
                                                            />
                                                        </div>
                                                        <div className="flex justify-end gap-2 mt-1">
                                                            <button type="button" onClick={() => setEditEmployeeId(null)} className="text-xs font-bold text-slate-500 px-3 py-1.5">Cancel</button>
                                                            <button type="submit" disabled={isLoading} className="text-xs font-bold text-white bg-blue-600 px-4 py-1.5 rounded-lg hover:bg-blue-700">Save</button>
                                                        </div>
                                                    </form>
                                                ) : (
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <div className="text-sm font-bold text-slate-800">{u.name}</div>
                                                            <div className="text-[10px] font-semibold text-slate-500">${u.hourlyWage}/hr</div>
                                                        </div>
                                                        <div className="flex gap-1.5">
                                                            <button 
                                                                onClick={() => {
                                                                    setEditEmployeeId(u.id);
                                                                    setEditEmpName(u.name);
                                                                    setEditEmpWage(u.hourlyWage);
                                                                }}
                                                                className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-bold hover:bg-slate-200"
                                                            >
                                                                Edit
                                                            </button>
                                                            <button 
                                                                onClick={() => handleDeleteEmployee(u.id)}
                                                                className="px-2 py-1 bg-red-50 text-red-600 rounded text-xs font-bold hover:bg-red-100"
                                                            >
                                                                Delete
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Inline Adds employee fields if clicked */}
                            {isAddingEmployee && (
                                <form onSubmit={handleAddEmployee} className="p-4 bg-slate-50 border border-slate-150 rounded-2xl gap-3 flex flex-col mb-4 animate-in slide-in-from-top duration-300">
                                    <h4 className="text-xs font-bold text-slate-700 leading-none mb-1">Add Staff Member</h4>
                                    <div className="gap-2.5 flex">
                                        <input 
                                            type="text" required placeholder="Full Name *"
                                            value={newEmpName} onChange={e => setNewEmpName(e.target.value)}
                                            className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                        <input 
                                            type="number" required placeholder="Wage/h ($)"
                                            value={newEmpWage} onChange={e => setNewEmpWage(e.target.value)}
                                            step="0.01" className="w-24 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                    </div>
                                    <button type="submit" className="bg-blue-600 text-white text-xs font-bold py-2 px-4 rounded-lg hover:bg-blue-700 self-end shadow-sm">
                                        Enroll Employee
                                    </button>
                                </form>
                            )}

                            {/* Dropdown Filters */}
                            <div className="grid grid-cols-1 gap-2 mb-2">
                                <div className="flex flex-col">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 ml-1">Time Period</label>
                                    <select 
                                        value={selectedWeek} 
                                        onChange={(e) => setSelectedWeek(e.target.value)}
                                        className="bg-slate-50 border border-slate-200 text-xs font-bold rounded-xl px-3 py-2.5 text-slate-700 focus:outline-none cursor-pointer"
                                    >
                                        <option value="all">All Time</option>
                                        <option value="this_week">This Week</option>
                                        <option value="last_week">Last Week</option>
                                        <option value="this_month">This Month</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="flex flex-col">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 ml-1">Staff Member</label>
                                    <select 
                                        value={selectedUser || ''} 
                                        onChange={(e) => setSelectedUser(e.target.value || null)}
                                        className="bg-slate-50 border border-slate-200 text-xs font-bold rounded-xl px-3 py-2.5 text-slate-700 focus:outline-none cursor-pointer"
                                    >
                                        <option value="">All Staff</option>
                                        {adminData?.users.map(u => (
                                            <option key={u.id} value={u.id}>{u.name} (${u.hourlyWage}/h)</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex flex-col">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 ml-1">Project Code</label>
                                    <select 
                                        value={selectedJob || ''} 
                                        onChange={(e) => setSelectedJob(e.target.value || null)}
                                        className="bg-slate-50 border border-slate-200 text-xs font-bold rounded-xl px-3 py-2.5 text-slate-700 focus:outline-none cursor-pointer"
                                    >
                                        <option value="">All Projects</option>
                                        {(adminData?.projects || []).map((proj, idx) => (
                                            <option key={idx} value={proj}>{proj}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Calculated Pay Metrics Box */}
                        <div className="grid grid-cols-2 gap-4 mb-5">
                            <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm text-center">
                                <Clock className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Duration Accum</p>
                                <p className="text-lg font-extrabold text-slate-800 mt-1">{totalHours.toFixed(1)} <span className="text-xs text-slate-400 font-bold">hrs</span></p>
                            </div>
                            <div className="bg-emerald-50/50 border border-emerald-100/60 p-4 rounded-2xl shadow-sm text-center">
                                <Coins className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
                                <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest mt-1">Estimated Cost</p>
                                <p className="text-lg font-extrabold text-[#10b981] mt-1">${totalPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            </div>
                        </div>

                        {/* Logs Title block */}
                        <div className="flex justify-between items-center mb-3 px-1 pl-2">
                            <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">Timesheet Log Entries ({filteredEntries.length})</span>
                            <button className="text-[11px] font-bold text-blue-650 flex items-center gap-1.5 bg-blue-50 border border-blue-100 hover:bg-blue-100 px-3 py-1.5 rounded-full transition-colors cursor-pointer">
                                <Download className="w-3.5 h-3.5" /> Exports CSV
                            </button>
                        </div>

                        {/* Timesheet List scroll */}
                        {isLoading ? (
                            <div className="bg-white rounded-2xl border border-slate-100 p-10 flex justify-center items-center">
                                <div className="animate-spin rounded-full h-7 w-7 border-2 border-blue-900 border-t-transparent"></div>
                            </div>
                        ) : (
                            <div className="space-y-2.5">
                                {filteredEntries.map((e, idx) => {
                                    const user = adminData?.users.find(u => String(u.id).trim() === String(e.profileId).trim());
                                    const wage = user ? parseFloat(user.hourlyWage) : 0;
                                    const inTime = new Date(e.clockIn).getTime();
                                    const outTime = e.clockOut ? new Date(e.clockOut).getTime() : Date.now();
                                    const dur = (outTime - inTime) / (1000 * 60 * 60);

                                    return (
                                        <div key={idx} className="bg-white rounded-2xl border border-slate-100 p-4 hover:border-slate-200 shadow-sm transition-all">
                                            <div className="flex justify-between items-start mb-2.5 pb-2.5 border-b border-slate-50">
                                                <div>
                                                    <p className="font-bold text-sm text-slate-800">{user ? user.name : 'Unknown Builder'}</p>
                                                    <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">
                                                        {new Date(e.clockIn).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-extrabold text-slate-800 text-sm leading-tight">{Math.max(0, dur).toFixed(2)}h</p>
                                                    <p className="text-[11px] font-bold text-emerald-600 mt-1 leading-tight">${(Math.max(0, dur) * wage).toFixed(2)}</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between gap-3 text-center">
                                                <div className="flex-1 bg-slate-50 rounded-xl p-2 text-left">
                                                    <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest">In Date/Time</span>
                                                    <span className="text-xs font-bold text-slate-700 leading-none mt-1 inline-block">
                                                        {new Date(e.clockIn).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                    </span>
                                                </div>
                                                <ArrowRight className="w-4 h-4 text-slate-300" />
                                                <div className="flex-1 bg-slate-50 rounded-xl p-2 text-right">
                                                    <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest">Out Date/Time</span>
                                                    <span className="text-xs font-bold text-slate-700 leading-none mt-1 inline-block">
                                                        {e.clockOut ? new Date(e.clockOut).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Active'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="text-[10px] font-bold text-slate-500 bg-slate-50/50 mt-2 px-2 py-1.5 rounded-lg flex justify-between items-center border border-slate-100">
                                                <span>Address Scope Code:</span>
                                                <span className="text-slate-800 font-extrabold">{e.projectName || 'General'}</span>
                                            </div>
                                            {e.photos && e.photos.length > 0 && (
                                                <div className="mt-2 pt-2 border-t border-slate-50 flex gap-2 overflow-x-auto">
                                                    {e.photos.map((url, i) => (
                                                        <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                                                            <img src={getDirectImageUrl(url)} alt="Attachment" className="w-10 h-10 rounded-md object-cover border border-slate-200" />
                                                        </a>
                                                    ))}
                                                </div>
                                            )}
                                            <div className="mt-2 flex justify-end gap-2">
                                                <button 
                                                    onClick={() => handleDeleteTimeEntry(e.id)}
                                                    className="text-xs font-bold text-red-600 bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors"
                                                >
                                                    Delete
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        setEditingEntry(e);
                                                        setEditProject(e.projectName || 'General');
                                                        setEditClockIn(new Date(new Date(e.clockIn).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16));
                                                        setEditClockOut(e.clockOut ? new Date(new Date(e.clockOut).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');
                                                    }}
                                                    className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors"
                                                >
                                                    Edit Entry
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                                {filteredEntries.length === 0 && (
                                    <div className="bg-white p-8 rounded-2xl border border-slate-100 text-center shadow-sm">
                                        <p className="text-slate-400 text-sm font-semibold">No payroll entries logged matching details.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* D. CUSTOMER DIRECTORY VIEWPORT */}
                {activeTab === 'customers' && (
                    <div className="flex-1 flex flex-col animate-in slide-in-from-right duration-200">
                        {/* Navigation Sub-Header */}
                        <div className="flex items-center gap-3 mb-5 pl-1 justify-between">
                            <div className="flex items-center gap-3">
                                <button onClick={() => setActiveTab('hub')} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-all cursor-pointer">
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <div>
                                    <h2 className="text-base font-bold text-slate-800 leading-none">Client Contacts</h2>
                                    <p className="text-xs text-slate-500 mt-1">Manage core customer names, phone, and addresses</p>
                                </div>
                            </div>
                        </div>

                        {/* Customer Control panel */}
                        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm mb-4">
                            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3.5">
                                <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">Identity Registrations</span>
                                <button 
                                    onClick={() => {
                                        setIsAddingCustomer(!isAddingCustomer);
                                        setNewCustomerName('');setNewCustomerEmail('');setNewCustomerPhone('');setNewCustomerAddress('');
                                    }}
                                    className="bg-blue-950 text-white text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-slate-900 transition-all flex items-center gap-1 cursor-pointer"
                                >
                                    {isAddingCustomer ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />} {isAddingCustomer ? 'Cancel' : 'New Customer'}
                                </button>
                            </div>

                            {/* Create customer Form */}
                            {isAddingCustomer && (
                                <form onSubmit={handleAddCustomer} className="p-4 bg-slate-50 border border-slate-150 rounded-2xl flex flex-col gap-3 animate-in slide-in-from-top duration-300">
                                    <h4 className="text-xs font-bold text-slate-700 leading-none mb-1">Enroll New Customer Account</h4>
                                    <div>
                                        <label className="block text-[8px] font-bold text-slate-450 uppercase mb-1 ml-1">Customer Account Name *</label>
                                        <input 
                                            type="text" required placeholder="E.g., Sp Services Group Inc"
                                            value={newCustomerName} onChange={e => setNewCustomerName(e.target.value)}
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[8px] font-bold text-slate-450 uppercase mb-1 ml-1">Electronic Mail Address Code</label>
                                        <input 
                                            type="email" placeholder="example@billing.com"
                                            value={newCustomerEmail} onChange={e => setNewCustomerEmail(e.target.value)}
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-[8px] font-bold text-slate-450 uppercase mb-1 ml-1">Contact Telephone</label>
                                            <input 
                                                type="tel" placeholder="555-019-2182"
                                                value={newCustomerPhone} onChange={e => setNewCustomerPhone(e.target.value)}
                                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[8px] font-bold text-slate-450 uppercase mb-1 ml-1">Properties Target Site</label>
                                            <input 
                                                type="text" placeholder="104 Maple Ave"
                                                value={newCustomerAddress} onChange={e => setNewCustomerAddress(e.target.value)}
                                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1 px-1">
                                        <input 
                                            type="checkbox" 
                                            id="autoCreateProject" 
                                            checked={autoCreateProject} 
                                            onChange={e => setAutoCreateProject(e.target.checked)}
                                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                                        />
                                        <label htmlFor="autoCreateProject" className="text-[11px] font-semibold text-slate-600 cursor-pointer">
                                            Auto-register corresponding Job Site & project
                                        </label>
                                    </div>
                                    <button type="submit" className="bg-blue-600 text-white text-xs font-bold py-2 px-4 rounded-lg hover:bg-blue-700 self-end shadow-sm cursor-pointer mt-1">
                                        Register Client Account
                                    </button>
                                </form>
                            )}
                        </div>

                        {/* Customer List cards */}
                        <div className="space-y-3">
                            {(adminData?.customers || []).length > 0 ? (
                                (adminData?.customers || []).map((customer, idx) => (
                                    <div key={idx} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm flex justify-between items-start gap-4">
                                        <div className="flex gap-3">
                                            <div className="w-10 h-10 shrink-0 rounded-xl bg-purple-50 text-purple-650 flex items-center justify-center font-bold text-sm border border-purple-100">
                                                {customer.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="font-bold text-sm text-slate-800 leading-tight truncate">{customer.name}</h3>
                                                {customer.email && <p className="text-xs text-slate-500 mt-1.5 font-medium flex items-center gap-1 leading-none">{customer.email}</p>}
                                                {customer.phone && <p className="text-xs text-slate-500 mt-1 font-medium flex items-center gap-1 leading-none">{customer.phone}</p>}
                                                {customer.address && <p className="text-[11px] font-bold text-slate-600 mt-2 bg-slate-50 px-2 py-1 rounded border border-slate-100 leading-normal inline-block">{customer.address}</p>}
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => handleDeleteCustomer(customer.id, customer.name)}
                                            className="w-9 h-9 shrink-0 rounded-xl bg-slate-50 border border-slate-150 hover:bg-red-50 hover:border-red-150 text-slate-400 hover:text-red-650 transition-all flex items-center justify-center cursor-pointer"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center shadow-sm">
                                    <p className="text-slate-400 text-sm font-semibold">No customer accounts saved in master registries.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* E. RESIDENTIAL PROJECTS / JOBS SITE VIEWPORT */}
                {activeTab === 'jobs' && (
                    <div className="flex-1 flex flex-col animate-in slide-in-from-right duration-200">
                        {/* Navigation Header */}
                        <div className="flex items-center gap-3 mb-5 pl-1 justify-between">
                            <div className="flex items-center gap-3">
                                <button onClick={() => setActiveTab('hub')} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-all cursor-pointer">
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <div>
                                    <h2 className="text-base font-bold text-slate-800 leading-none">Jobsite Sites Directory</h2>
                                    <p className="text-xs text-slate-500 mt-1">Specify building codes, residential slots, and active projects</p>
                                </div>
                            </div>
                        </div>

                        {/* Control actions */}
                        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm mb-4">
                            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                                <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">Site Registers</span>
                                <button 
                                    onClick={() => {
                                        setIsAddingJob(!isAddingJob);
                                        setNewJobName('');
                                    }}
                                    className="bg-blue-950 text-white text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-slate-900 transition-all flex items-center gap-1 cursor-pointer"
                                >
                                    {isAddingJob ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />} {isAddingJob ? 'Cancel' : 'New Project'}
                                </button>
                            </div>

                            {/* Inline Adds Job elements */}
                            {isAddingJob && (
                                <form onSubmit={handleAddJob} className="p-4 bg-slate-50 border border-slate-150 rounded-2xl flex flex-col gap-3.5 animate-in slide-in-from-top duration-300">
                                    <h4 className="text-xs font-bold text-slate-700 leading-none">Register New Site</h4>
                                    <div>
                                        <label className="block text-[8px] font-bold text-slate-400 uppercase mb-1 ml-1">Building name / address code *</label>
                                        <input 
                                            type="text" required placeholder="E.g., 104 Maple Ave (Plumbing)"
                                            value={newJobName} onChange={e => setNewJobName(e.target.value)}
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                    </div>
                                    <button type="submit" className="bg-blue-600 text-white text-xs font-bold py-2 px-4 rounded-lg hover:bg-blue-700 shadow-sm self-end cursor-pointer">
                                        Activate Site Code
                                    </button>
                                </form>
                            )}

                            {/* Site List Scroll block */}
                            <div className="space-y-2">
                                {(adminData?.projects || []).length > 0 ? (
                                    (adminData?.projects || []).map((proj, idx) => (
                                        <div key={idx} className="flex justify-between items-center p-3.5 bg-slate-50/50 border border-slate-150/60 rounded-xl hover:border-slate-350 hover:bg-slate-50 transition-all">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-650 flex items-center justify-center font-semibold">
                                                    <Briefcase className="w-4 h-4 stroke-[2]" />
                                                </div>
                                                <span className="font-bold text-slate-700 text-sm leading-tight">{proj}</span>
                                            </div>
                                            {proj !== 'General' && (
                                                <button 
                                                    onClick={() => handleDeleteJob(proj)}
                                                    className="w-8 h-8 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors flex items-center justify-center border border-slate-200 bg-white shadow-sm cursor-pointer"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    <div className="py-8 text-center text-slate-400 text-sm font-semibold">
                                        No active building sites registered.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* F. INVOICING & INVOICES PAST ARCHIVE VIEWPORT */}
                {activeTab === 'invoices' && (
                    <div className="flex-1 flex flex-col animate-in slide-in-from-right duration-200">
                        {/* Navigation Sub-Header */}
                        <div className="flex items-center gap-3 mb-5 pl-1 justify-between">
                            <div className="flex items-center gap-3">
                                <button onClick={() => { setActiveTab('hub'); setIsCreatingInvoice(false); setEditingInvoiceId(null); }} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-all cursor-pointer">
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <div>
                                    <h2 className="text-base font-bold text-slate-800 leading-none">
                                        {isCreatingInvoice 
                                            ? (editingInvoiceId ? 'Edit Invoice Draft' : 'Draft Invoice Bill') 
                                            : 'Invoice Billing Console'}
                                    </h2>
                                    <p className="text-xs text-slate-500 mt-1">{isCreatingInvoice ? 'Extract clocked hours and custom extra line services' : 'Review historical PDFs and draft fresh balances client invoices'}</p>
                                </div>
                            </div>
                        </div>

                        {/* Invoice List screen */}
                        {!isCreatingInvoice ? (
                            <div className="space-y-4">
                                <div className="flex justify-between items-center mb-1 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                                    <span className="text-[11px] font-bold text-slate-450 uppercase tracking-wider">PDF BALANCES DIRECTORY</span>
                                    <button 
                                        onClick={() => {
                                            setIsCreatingInvoice(true);
                                            setEditingInvoiceId(null);
                                            setInvoiceCustomer('');
                                            setInvoiceMarkup(1.0);
                                            setInvoiceSelectedEntries(new Set());
                                            setInvoiceManualItems([]);
                                            setInvoiceShowCostBreakdown(true);
                                            setInvoiceSelectedColumns([
                                                "Descriptive Log / Additions",
                                                "Category",
                                                "Qty / Hours",
                                                "Base Rate",
                                                "Markup",
                                                "Amount"
                                            ]);
                                        }}
                                        className="bg-blue-950 hover:bg-slate-900 border border-transparent shadow shadow-blue-950/20 text-white font-bold text-xs py-2 px-3.5 rounded-xl flex items-center gap-1 cursor-pointer transition-transform"
                                    >
                                        <Plus className="w-3.5 h-3.5" /> Fresh Invoice
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {adminData?.invoices && adminData.invoices.length > 0 ? (
                                        adminData.invoices.map((inv, idx) => (
                                            <div key={idx} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:border-slate-300 transition-all">
                                                <div className="flex justify-between items-start gap-4">
                                                    <div>
                                                        <h3 className="font-extrabold text-slate-800 text-sm leading-snug">{inv.customerName}</h3>
                                                        <p className="text-xs font-semibold text-slate-400 mt-1 flex items-center gap-1.5">
                                                            <Calendar className="w-3.5 h-3.5" />
                                                            {new Date(inv.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                                                        </p>
                                                        <div className="flex flex-wrap gap-1.5 mt-2.5">
                                                            <span className="text-[9px] bg-slate-50 border border-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded uppercase tracking-wider">ID: {inv.id.substring(0, 8)}</span>
                                                            {inv.showCostBreakdown === false ? (
                                                                <span className="text-[9px] bg-amber-50 border border-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded uppercase tracking-wider">Costs Hidden</span>
                                                            ) : (
                                                                <span className="text-[9px] bg-blue-50 border border-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded uppercase tracking-wider font-semibold">Breakdown Visible</span>
                                                            )}
                                                            {inv.selectedColumns && inv.selectedColumns.length > 0 && (
                                                                <span className="text-[9px] bg-slate-100 border border-slate-200 text-slate-600 font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                                                                    {inv.selectedColumns.filter(c => inv.showCostBreakdown !== false || (c !== "Base Rate" && c !== "Markup")).length} Columns
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="text-right flex flex-col items-end">
                                                        <p className="font-black text-emerald-600 text-[18px] leading-none">${inv.total.toFixed(2)}</p>
                                                        <p className="text-[10px] font-bold text-slate-400 mt-1.5">{inv.timeEntryIds.length} hours-tracked entries</p>
                                                        
                                                        <div className="flex flex-wrap gap-2 mt-3 justify-end">
                                                            <button 
                                                                onClick={() => {
                                                                    setEditingInvoiceId(inv.id);
                                                                    setInvoiceCustomer(inv.customerName);
                                                                    setInvoiceMarkup(inv.markupMultiplier || 1.0);
                                                                    setInvoiceSelectedEntries(new Set(inv.timeEntryIds || []));
                                                                    setInvoiceManualItems(inv.manualItems || []);
                                                                    setInvoiceShowCostBreakdown(inv.showCostBreakdown !== false);
                                                                    setInvoiceSelectedColumns(inv.selectedColumns || [
                                                                        "Descriptive Log / Additions",
                                                                        "Category",
                                                                        "Qty / Hours",
                                                                        "Base Rate",
                                                                        "Markup",
                                                                        "Amount"
                                                                    ]);
                                                                    setIsCreatingInvoice(true);
                                                                }}
                                                                className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-800 bg-slate-50 border border-slate-200/60 hover:bg-slate-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer shadow-sm"
                                                            >
                                                                <Edit className="w-3.5 h-3.5" /> Return to Sheet &amp; Edit
                                                            </button>
                                                            <button 
                                                                onClick={() => generateInvoicePDF(inv, adminData.users, adminData.entries)}
                                                                className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-650 bg-blue-50 border border-blue-100 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer shadow-sm"
                                                            >
                                                                <Download className="w-3.5 h-3.5" /> PDF Download
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="bg-white p-8 rounded-2xl border border-slate-100 text-center shadow-sm">
                                            <p className="text-slate-400 text-sm font-semibold">No past client invoices saved in master sheets.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            /* Create Invoice visual step-board Form */
                            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-5 animate-in fade-in duration-300">
                                <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                        {editingInvoiceId ? 'Modify Statement Draft Elements' : 'Creation Elements'}
                                    </h3>
                                    <button 
                                        onClick={() => {
                                            setIsCreatingInvoice(false);
                                            setEditingInvoiceId(null);
                                        }} 
                                        className="text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                                    >
                                        Back to List
                                    </button>
                                </div>
                                
                                <div className="space-y-4">
                                    {/* Select Client customer */}
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Properties Client Accounts *</label>
                                        <div className="flex flex-col gap-2">
                                            <select 
                                                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs font-bold text-slate-700 cursor-pointer"
                                                onChange={e => setInvoiceCustomer(e.target.value)}
                                                value={invoiceCustomer}
                                            >
                                                <option value="">-- Associate Customer Profile --</option>
                                                {adminData?.customers?.map(c => (
                                                    <option key={c.id} value={c.name}>{c.name}</option>
                                                ))}
                                            </select>
                                            <input
                                                type="text"
                                                value={invoiceCustomer}
                                                onChange={e => setInvoiceCustomer(e.target.value)}
                                                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs font-semibold placeholder-slate-400"
                                                placeholder="Or manually overrule specific client name..."
                                            />
                                        </div>
                                    </div>
                                    
                                    {/* Selectable Hours Entries Checklist container */}
                                    <div>
                                        {(() => {
                                            const completedEntries = adminData?.entries.filter(e => e.clockOut) || [];
                                            
                                            const getMondayDateString = (isoStr: string) => {
                                                try {
                                                    const d = new Date(isoStr);
                                                    const day = d.getDay();
                                                    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
                                                    const mon = new Date(d.setDate(diff));
                                                    return mon.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                                                } catch (err) {
                                                    return "Unknown Week";
                                                }
                                            };

                                            const uniqueWeeks = Array.from(new Set(completedEntries.map(e => getMondayDateString(e.clockIn)))).sort((a, b) => {
                                                return new Date(b).getTime() - new Date(a).getTime();
                                            });

                                            const filteredCheckedEntries = completedEntries.filter(e => {
                                                // 1. Week Filter
                                                if (invoiceWeekFilter !== 'all') {
                                                    if (getMondayDateString(e.clockIn) !== invoiceWeekFilter) return false;
                                                }
                                                // 2. Status Filter
                                                if (invoiceStatusFilter === 'unbilled') {
                                                    if (e.isBilled) return false;
                                                } else if (invoiceStatusFilter === 'billed') {
                                                    if (!e.isBilled) return false;
                                                }
                                                return true;
                                            });

                                            return (
                                                <div className="space-y-2.5">
                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2 ml-1">
                                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Clocked Hours checklist</label>
                                                        
                                                        {/* Filters selection */}
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            {/* Week filter */}
                                                            <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200/60 rounded-xl px-2.5 py-1 text-[11px] font-bold text-slate-600">
                                                                <span className="text-slate-400 font-extrabold text-[9px] uppercase tracking-wide">Week:</span>
                                                                <select 
                                                                    value={invoiceWeekFilter} 
                                                                    onChange={(e) => setInvoiceWeekFilter(e.target.value)}
                                                                    className="bg-transparent focus:outline-none cursor-pointer text-slate-700 max-w-[130px] sm:max-w-none text-ellipsis"
                                                                >
                                                                    <option value="all">All Weeks</option>
                                                                    {uniqueWeeks.map(wk => (
                                                                        <option key={wk} value={wk}>Week of {wk}</option>
                                                                    ))}
                                                                </select>
                                                            </div>

                                                            {/* Status filter */}
                                                            <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200/60 rounded-xl px-2.5 py-1 text-[11px] font-bold text-slate-600">
                                                                <span className="text-slate-400 font-extrabold text-[9px] uppercase tracking-wide">Status:</span>
                                                                <select 
                                                                    value={invoiceStatusFilter} 
                                                                    onChange={(e) => setInvoiceStatusFilter(e.target.value)}
                                                                    className="bg-transparent focus:outline-none cursor-pointer text-slate-700"
                                                                >
                                                                    <option value="unbilled">Unbilled Only</option>
                                                                    <option value="billed">Billed Only</option>
                                                                    <option value="all">All Logs</option>
                                                                </select>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Bulk actions */}
                                                    {invoiceSelectedEntries.size > 0 && (
                                                        <div className="flex items-center justify-between gap-2 p-2 bg-blue-50/50 border border-blue-100 rounded-xl mb-2 animate-in fade-in slide-in-from-top-1">
                                                            <span className="text-[11px] font-extrabold text-blue-800 ml-1.5">{invoiceSelectedEntries.size} Selected</span>
                                                            <div className="flex gap-1.5">
                                                                <button 
                                                                    type="button"
                                                                    onClick={() => {
                                                                        handleSetBilledStatus(Array.from(invoiceSelectedEntries), true);
                                                                        setInvoiceSelectedEntries(new Set());
                                                                    }}
                                                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-2 py-1 rounded-lg cursor-pointer shadow-sm active:scale-95 transition-all"
                                                                >
                                                                    Mark as Billed
                                                                </button>
                                                                <button 
                                                                    type="button"
                                                                    onClick={() => {
                                                                        handleSetBilledStatus(Array.from(invoiceSelectedEntries), false);
                                                                        setInvoiceSelectedEntries(new Set());
                                                                    }}
                                                                    className="bg-slate-600 hover:bg-slate-700 text-white font-bold text-[10px] px-2 py-1 rounded-lg cursor-pointer shadow-sm active:scale-95 transition-all"
                                                                >
                                                                    Mark as Unbilled
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="max-h-56 overflow-y-auto border border-slate-150 rounded-xl bg-slate-50/50 p-2.5 space-y-1.5 shadow-inner">
                                                        {filteredCheckedEntries.length === 0 ? (
                                                            <p className="text-[11px] text-slate-450 font-semibold text-center py-4">No hours logs match selected filters.</p>
                                                        ) : (
                                                            filteredCheckedEntries.map((e, idx) => {
                                                                const u = adminData?.users.find(u => String(u.id).trim() === String(e.profileId).trim());
                                                                const dur = (new Date(e.clockOut || Date.now()).getTime() - new Date(e.clockIn).getTime()) / 3600000;
                                                                const cost = Math.max(0, dur) * (u ? parseFloat(u.hourlyWage) : 0);
                                                                const selected = invoiceSelectedEntries.has(e.id);
                                                                return (
                                                                    <div 
                                                                        key={`${e.id || 'completed'}_${idx}`} 
                                                                        onClick={() => {
                                                                            const next = new Set(invoiceSelectedEntries);
                                                                            if (selected) next.delete(e.id); else next.add(e.id);
                                                                            setInvoiceSelectedEntries(next);
                                                                        }}
                                                                        className={`p-3 rounded-xl cursor-pointer flex justify-between items-center border transition-all ${selected ? 'bg-blue-50 border-blue-300 text-blue-750' : 'bg-white border-slate-150 hover:border-slate-350 text-slate-700'}`}
                                                                    >
                                                                        <div className="flex items-center gap-2.5 min-w-0 pr-2 pb-0.5">
                                                                            <input 
                                                                                type="checkbox"
                                                                                checked={selected}
                                                                                onChange={() => {}}
                                                                                onClick={(evt) => {
                                                                                    evt.stopPropagation();
                                                                                    const next = new Set(invoiceSelectedEntries);
                                                                                    if (selected) next.delete(e.id); else next.add(e.id);
                                                                                    setInvoiceSelectedEntries(next);
                                                                                }}
                                                                                className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                                                                            />
                                                                            <div className="min-w-0">
                                                                                <p className="font-bold text-xs leading-normal truncate">{new Date(e.clockIn).toLocaleDateString()} &mdash; {u?.name}</p>
                                                                                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                                                                    <span className="text-[10px] text-slate-450 font-bold">{e.projectName} &bull; {Math.max(0, dur).toFixed(2)}h</span>
                                                                                    {e.isBilled ? (
                                                                                        <span className="inline-flex items-center text-[8px] font-black bg-emerald-50 border border-emerald-100 text-emerald-700 px-1 py-0.5 rounded leading-none uppercase">Billed</span>
                                                                                    ) : (
                                                                                        <span className="inline-flex items-center text-[8px] font-black bg-slate-100 border border-slate-200 text-slate-500 px-1 py-0.5 rounded leading-none uppercase">Unbilled</span>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                                                                            <span className="font-extrabold text-xs text-emerald-600">${cost.toFixed(2)}</span>
                                                                            <button 
                                                                                type="button"
                                                                                onClick={(evt) => {
                                                                                    evt.stopPropagation();
                                                                                    handleSetBilledStatus([e.id], !e.isBilled);
                                                                                }}
                                                                                className="text-[9px] font-extrabold text-blue-600 hover:text-blue-800 cursor-pointer underline hover:no-underline"
                                                                            >
                                                                                {e.isBilled ? "Mark Unbilled" : "Mark Billed"}
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    {/* Markup selector multiplier */}
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Fee multi markup</label>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="number"
                                                value={invoiceMarkup}
                                                onChange={e => setInvoiceMarkup(parseFloat(e.target.value) || 1)}
                                                step="0.1"
                                                min="1"
                                                className="w-24 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs font-semibold"
                                            />
                                            <span className="text-[11px] font-bold text-slate-400">Default is 1.0 (No premium markup) &bull; 1.5 equates to 50% extra fee</span>
                                        </div>
                                    </div>

                                    {/* Invoice PDF Output Customization Panel */}
                                    <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4.5 space-y-4">
                                        <div>
                                            <span className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">Invoice PDF Column Customization</span>
                                            <p className="text-[11px] text-slate-450 font-medium mb-3">Select which columns should be rendered on the invoice document table.</p>
                                            
                                            <div className="grid grid-cols-2 gap-2.5">
                                                {["Descriptive Log / Additions", "Category", "Qty / Hours", "Base Rate", "Markup", "Amount"].map((col) => {
                                                    const isChecked = invoiceSelectedColumns.includes(col);
                                                    const isDisabled = !invoiceShowCostBreakdown && (col === "Base Rate" || col === "Markup");
                                                    
                                                    return (
                                                        <label 
                                                            key={col} 
                                                            className={`flex items-start gap-2 p-2.5 rounded-lg border text-xs font-semibold cursor-pointer select-none transition-all ${
                                                                isDisabled 
                                                                    ? 'bg-slate-100 border-slate-200 text-slate-450 cursor-not-allowed opacity-60' 
                                                                    : isChecked 
                                                                        ? 'bg-blue-50/50 border-blue-200 text-blue-800' 
                                                                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                                                            }`}
                                                        >
                                                            <input 
                                                                type="checkbox" 
                                                                checked={isChecked && !isDisabled}
                                                                disabled={isDisabled}
                                                                onChange={() => {
                                                                    if (invoiceSelectedColumns.includes(col)) {
                                                                        setInvoiceSelectedColumns(invoiceSelectedColumns.filter(c => c !== col));
                                                                    } else {
                                                                        setInvoiceSelectedColumns([...invoiceSelectedColumns, col]);
                                                                    }
                                                                }}
                                                                className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                            />
                                                            <span className="leading-tight">
                                                                {col}
                                                                {isDisabled && <span className="block text-[9px] font-bold text-amber-600">(Hidden by cost toggle)</span>}
                                                            </span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        <div className="border-t border-slate-200/60 pt-3 flex items-start gap-3">
                                            <div className="flex items-center h-5">
                                                <input
                                                    id="show-cost-breakdown-checkbox"
                                                    type="checkbox"
                                                    checked={invoiceShowCostBreakdown}
                                                    onChange={(e) => setInvoiceShowCostBreakdown(e.target.checked)}
                                                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                />
                                            </div>
                                            <div className="text-xs">
                                                <label htmlFor="show-cost-breakdown-checkbox" className="font-extrabold text-slate-700 cursor-pointer block select-none">
                                                    Display Internal Cost Breakdown
                                                </label>
                                                <p className="text-[11px] text-slate-450 font-medium mt-0.5 leading-normal">
                                                    When disabled, employee base wages and markups are hidden. Only fully-marked-up amounts are rendered, and the summary section consolidates labor costs to respect company financial privacy.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Manual Extra services line additions */}
                                    <div className="pt-4 border-t border-slate-100">
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">Custom extra manual fee additions</label>
                                        
                                        {invoiceManualItems.map((mi, idx) => (
                                            <div key={idx} className="flex justify-between items-center bg-slate-50 py-2 px-3 border border-slate-150 rounded-xl mb-2">
                                                <span className="text-xs font-bold text-slate-700 leading-normal">{mi.description}</span>
                                                <div className="flex items-center gap-2.5">
                                                    <span className="text-xs font-black text-emerald-600">${mi.amount.toFixed(2)}</span>
                                                    <button onClick={() => setInvoiceManualItems(invoiceManualItems.filter(i => i.id !== mi.id))} className="text-slate-400 hover:text-red-500">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}

                                        <div className="flex gap-2">
                                            <input 
                                                type="text" placeholder="Description: e.g., Concrete supply" 
                                                value={newManualItemDesc} onChange={e => setNewManualItemDesc(e.target.value)}
                                                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            />
                                            <input 
                                                type="number" placeholder="Cost ($)" step="0.01" 
                                                value={newManualItemAmt} onChange={e => setNewManualItemAmt(e.target.value)}
                                                className="w-20 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            />
                                            <button onClick={handleAddManualItem} type="button" className="bg-slate-150 hover:bg-slate-250 shrink-0 px-3 py-2 rounded-lg font-bold text-xs text-slate-700 transition-colors cursor-pointer">Append</button>
                                        </div>
                                    </div>
                                    
                                    {/* Total Calculator board */}
                                    <div className="pt-5 mt-5 border-t border-slate-150">
                                        {(() => {
                                            // calc totals
                                            let entriesCost = 0;
                                            Array.from(invoiceSelectedEntries).forEach(id => {
                                                const e = adminData?.entries.find(x => x.id === id);
                                                if(e) {
                                                    const u = adminData?.users.find(u => String(u.id).trim() === String(e.profileId).trim());
                                                    const dur = (new Date(e.clockOut || Date.now()).getTime() - new Date(e.clockIn).getTime()) / 3600000;
                                                    entriesCost += Math.max(0, dur) * (u ? parseFloat(u.hourlyWage) : 0);
                                                }
                                            });
                                            const subtotal = entriesCost * invoiceMarkup;
                                            const manualTotal = invoiceManualItems.reduce((acc, curr) => acc + curr.amount, 0);
                                            const finalTotal = subtotal + manualTotal;
                                            
                                            return (
                                                <div className="space-y-3.5">
                                                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-2.5">
                                                        <div className="flex justify-between items-center text-xs font-bold text-slate-500">
                                                            <span>Timesheets Base Value:</span>
                                                            <span className="text-slate-800">${entriesCost.toFixed(2)}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center text-xs font-bold text-slate-500">
                                                            <span>Marked Value (Multi x{invoiceMarkup}):</span>
                                                            <span className="text-slate-850 font-extrabold">${subtotal.toFixed(2)}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center text-xs font-bold text-slate-500">
                                                            <span>Extra Services added:</span>
                                                            <span className="text-slate-800">${manualTotal.toFixed(2)}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center text-sm font-black text-slate-900 border-t border-slate-150 pt-2.5 mt-1">
                                                            <span>Sum of Invoice Balance:</span>
                                                            <span className="text-emerald-600 text-lg">${finalTotal.toFixed(2)}</span>
                                                        </div>
                                                    </div>
                                                    
                                                    <button 
                                                        onClick={() => handleSaveInvoice(finalTotal)}
                                                        disabled={isLoading || !invoiceCustomer.trim()}
                                                        className="w-full mt-2 bg-blue-950 text-white hover:bg-slate-900 py-4 rounded-xl font-bold text-xs shadow-md transition-all active:scale-98 disabled:opacity-40 cursor-pointer"
                                                    >
                                                        {isLoading ? 'Processing Save...' : 'Finalize & Generate PDF timesheet'}
                                                    </button>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* G. FIELD MESSAGES VIEWPORT */}
                {activeTab === 'chat' && (
                    <div className="flex-1 flex flex-col h-[calc(100vh-180px)] overflow-hidden animate-in slide-in-from-right duration-200">
                        {/* Sub-Header */}
                        <div className="flex items-center gap-3 mb-4 pl-1 shrink-0">
                            <button onClick={() => setActiveTab('hub')} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-all cursor-pointer">
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <div>
                                <h1 className="text-base font-bold text-slate-800 leading-none">Global Broadcast</h1>
                                <p className="text-xs text-slate-500 mt-1">Read and reply directly with field staff logs</p>
                            </div>
                        </div>

                        {/* Messaging wrapper box */}
                        <div className="flex-1 bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm flex flex-col">
                            <Messaging profile={safeProfile as any} />
                        </div>
                    </div>
                )}

                {/* H. COMPANY CONFIG VALUES VIEWPORT */}
                {activeTab === 'company' && (
                    <div className="flex-1 flex flex-col animate-in slide-in-from-right duration-200">
                        {/* Sub-Header */}
                        <div className="flex items-center gap-3 mb-5 pl-1 shrink-0">
                            <button onClick={() => setActiveTab('hub')} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-all cursor-pointer">
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <div>
                                <h1 className="text-base font-bold text-slate-800 leading-none">Business Profile</h1>
                                <p className="text-xs text-slate-500 mt-0.5">Adjust physical contacts, addresses and phone indices</p>
                            </div>
                        </div>

                        {/* Config cards */}
                        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Trade Business Name</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 rounded-xl px-3 py-3 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    value={companyInfo.businessName}
                                    onChange={e => setCompanyInfo({...companyInfo, businessName: e.target.value})}
                                    placeholder="e.g. SP SERVICES GROUP INC"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Footer Legal Slogans</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 rounded-xl px-3 py-3 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    value={companyInfo.tagline}
                                    onChange={e => setCompanyInfo({...companyInfo, tagline: e.target.value})}
                                    placeholder="e.g. PREMIUM INVOICED SERVICES & WORK LOGS"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Support contact phone / mail</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 rounded-xl px-3 py-3 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    value={companyInfo.contactLine}
                                    onChange={e => setCompanyInfo({...companyInfo, contactLine: e.target.value})}
                                    placeholder="e.g. billing@sp.com | Tel: 555-5555"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Physical Trading Address</label>
                                <textarea 
                                    className="w-full bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 rounded-xl px-3.5 py-3 h-24 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 leading-normal"
                                    value={companyInfo.address}
                                    onChange={e => setCompanyInfo({...companyInfo, address: e.target.value})}
                                    placeholder="123 Builder way&#10;City, State 12345"
                                />
                            </div>

                            <button 
                                onClick={handleSaveCompanyInfo}
                                disabled={isLoading}
                                className="w-full mt-1 bg-blue-950 text-white hover:bg-slate-900 py-3.5 rounded-xl font-bold text-xs tracking-wider uppercase shadow-md transition-all active:scale-98 cursor-pointer disabled:opacity-40"
                            >
                                {isLoading ? 'Saving...' : 'Sync Master Company Settings'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
            
            {/* EDIT TIME ENTRY MODAL */}
            {editingEntry && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div 
                        onClick={() => setEditingEntry(null)} 
                        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]" 
                    />
                    <div className="relative bg-white w-full max-w-sm rounded-2xl shadow-xl border border-slate-105 p-5 z-10 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-extrabold text-slate-800 text-sm">Edit Time Entry</h3>
                            <button 
                                onClick={() => setEditingEntry(null)}
                                className="w-6 h-6 rounded-full bg-slate-150 text-slate-500 flex items-center justify-center text-xs hover:bg-slate-200 transition-colors cursor-pointer"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        <form onSubmit={handleSaveTimeEntry} className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Project / Job Site</label>
                                <input 
                                    type="text" 
                                    value={editProject} 
                                    onChange={(e) => setEditProject(e.target.value)}
                                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Clock In (Local Time)</label>
                                <input 
                                    type="datetime-local" 
                                    value={editClockIn} 
                                    onChange={(e) => setEditClockIn(e.target.value)}
                                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Clock Out (Local Time)</label>
                                <input 
                                    type="datetime-local" 
                                    value={editClockOut} 
                                    onChange={(e) => setEditClockOut(e.target.value)}
                                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                                />
                                <p className="text-[9px] text-slate-400 mt-1 ml-1 font-semibold">Leave empty if still clocked in.</p>
                            </div>
                            <button 
                                type="submit"
                                disabled={isLoading}
                                className="w-full mt-2 py-3 bg-[#2563eb] hover:bg-blue-600 text-white font-extrabold text-xs rounded-xl shadow-md transition-all active:scale-98 disabled:opacity-50 cursor-pointer"
                            >
                                {isLoading ? 'Saving...' : 'Update Entry'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
            
            <AdminBottomNav 
                currentTab={activeTab} 
                setCurrentTab={setActiveTab} 
                onMenuClick={() => setActiveTab('company')}
            />
        </div>
    );
};
