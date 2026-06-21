import React, { useState, useEffect } from 'react';
import { UserProfile, TimeEntry, Invoice, InvoiceItem, Customer } from '../types';
import { ShieldAlert, Users, Search, ChevronLeft, ArrowRight, Download, DollarSign, Clock, FileText, Plus, Trash2, MessageSquare, Building, Contact } from 'lucide-react';
import { generateInvoicePDF } from '../services/pdfService';
import Messaging from './Messaging';
import { chatService } from '../services/chatService';

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
    const [unreadChatCount, setUnreadChatCount] = useState(0);
    
    // Tabs
    const [activeTab, setActiveTab] = useState<'live' | 'employees' | 'customers' | 'invoices' | 'jobs' | 'chat' | 'company'>('live');

    // Company Info State
    const [companyInfo, setCompanyInfo] = useState({
        businessName: 'GEOTIME CONTRACTING',
        tagline: 'PREMIUM TRACKED TIME & FIELD SERVICES INVOICING',
        contactLine: 'Contact: smartcontracting@geotime.com | Tel: (555) 019-9238',
        address: ''
    });

    // Make Invoice state
    const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
    const [invoiceCustomer, setInvoiceCustomer] = useState('');
    const [invoiceMarkup, setInvoiceMarkup] = useState<number>(1.0); // Multiplier
    const [invoiceSelectedEntries, setInvoiceSelectedEntries] = useState<Set<string>>(new Set());
    const [invoiceManualItems, setInvoiceManualItems] = useState<InvoiceItem[]>([]);
    const [newManualItemDesc, setNewManualItemDesc] = useState('');
    const [newManualItemAmt, setNewManualItemAmt] = useState('');

    const [isAddingEmployee, setIsAddingEmployee] = useState(false);
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
        } else {
            setError('Invalid PIN code');
        }
    };

    const fetchAdminData = async () => {
        setIsLoading(true);
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
            setIsLoading(false);
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
        const inv: Invoice = {
            id: Math.random().toString(36).substring(2, 12),
            date: new Date().toISOString(),
            customerName: invoiceCustomer.trim(),
            timeEntryIds: Array.from(invoiceSelectedEntries),
            manualItems: invoiceManualItems,
            markupMultiplier: invoiceMarkup,
            total: total
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
            setInvoiceCustomer('');
            setInvoiceSelectedEntries(new Set());
            setInvoiceManualItems([]);
            setInvoiceMarkup(1.0);
            await fetchAdminData();
        } catch (err: any) {
            alert('Failed to save invoice: ' + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isAuthenticated) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[500px] p-5">
                <div className="w-full max-w-sm bg-white rounded-3xl shadow-sm p-8 border border-gray-100 flex flex-col items-center">
                    <div className="w-16 h-16 bg-blue-950 rounded-2xl flex items-center justify-center mb-6">
                        <ShieldAlert className="text-[#2563eb] w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Admin Access</h2>
                    <p className="text-sm font-semibold text-gray-500 mb-8 text-center">
                        Enter your master PIN to access company payroll records.
                    </p>
                    <form onSubmit={handleLogin} className="w-full flex flex-col gap-4">
                        <input 
                            type="password"
                            autoFocus
                            placeholder="PIN Code (Hint: 1234)"
                            value={pin}
                            onChange={(e) => setPin(e.target.value)}
                            className="w-full px-4 py-3 text-center tracking-[0.5em] text-2xl font-bold bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563eb]"
                        />
                        {error && <p className="text-sm font-bold text-red-500 text-center">{error}</p>}
                        <button type="submit" className="w-full bg-blue-950 text-white py-3.5 rounded-xl font-bold shadow-md hover:bg-gray-800 transition-colors mt-2">
                            Unlock Dashboard
                        </button>
                    </form>
                    <button onClick={onClose} className="mt-6 text-sm font-bold text-gray-400 hover:text-gray-600">
                        Cancel & Return
                    </button>
                </div>
            </div>
        );
    }

    const filteredEntries = adminData?.entries.filter(e => {
        const matchesUser = selectedUser ? e.profileId === selectedUser : true;
        const matchesJob = selectedJob ? (e.projectName || 'General') === selectedJob : true;
        return matchesUser && matchesJob;
    }) || [];
    
    // Totals calc
    let totalHours = 0;
    let totalPay = 0;
    filteredEntries.forEach(entry => {
        // Find user for wage
        const user = adminData?.users.find(u => u.id === entry.profileId);
        const wage = user ? parseFloat(user.hourlyWage) : 0;
        
        let inTime = new Date(entry.clockIn).getTime();
        let outTime = entry.clockOut ? new Date(entry.clockOut).getTime() : Date.now();
        const durationHr = (outTime - inTime) / (1000 * 60 * 60);
        
        totalHours += Math.max(0, durationHr);
        totalPay += Math.max(0, durationHr) * wage;
    });

    return (
        <div className="flex flex-col bg-gray-50 min-h-[100dvh] pb-20">
            <header className="bg-blue-950 text-white px-5 pt-12 pb-6 shrink-0 relative z-10 flex border-b-4 border-[#2563eb]">
                <button onClick={onClose} className="absolute top-12 left-5 w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors">
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="flex-1 text-center mt-1">
                    <h1 className="text-xl font-bold tracking-tight">Admin Console</h1>
                    <p className="text-xs font-bold text-[#2563eb] uppercase mt-0.5 tracking-widest">Master Overview</p>
                </div>
            </header>

            <div className="px-5 mt-4 mb-4 flex flex-wrap gap-2">
                <button 
                   className={`flex-1 min-w-[30%] py-2 text-sm font-bold rounded-xl transition-colors ${activeTab === 'live' ? 'bg-blue-950 text-white shadow-md' : 'bg-white text-gray-500 border border-gray-200'}`}
                   onClick={() => setActiveTab('live')}
                >
                   Live
                </button>
                <button 
                   className={`flex-1 min-w-[30%] py-2 text-sm font-bold rounded-xl transition-colors ${activeTab === 'employees' ? 'bg-blue-950 text-white shadow-md' : 'bg-white text-gray-500 border border-gray-200'}`}
                   onClick={() => setActiveTab('employees')}
                >
                   Overview
                </button>
                <button 
                   className={`flex-1 min-w-[30%] py-2 text-sm font-bold rounded-xl transition-colors ${activeTab === 'customers' ? 'bg-blue-950 text-white shadow-md' : 'bg-white text-gray-500 border border-gray-200'}`}
                   onClick={() => setActiveTab('customers')}
                >
                   Customers
                </button>
                <button 
                   className={`flex-1 min-w-[30%] py-2 text-sm font-bold rounded-xl transition-colors ${activeTab === 'jobs' ? 'bg-blue-950 text-white shadow-md' : 'bg-white text-gray-500 border border-gray-200'}`}
                   onClick={() => setActiveTab('jobs')}
                >
                   Jobs
                </button>
                <button 
                   className={`flex-1 min-w-[30%] py-2 text-sm font-bold rounded-xl transition-colors ${activeTab === 'invoices' ? 'bg-blue-950 text-white shadow-md' : 'bg-white text-gray-500 border border-gray-200'}`}
                   onClick={() => setActiveTab('invoices')}
                >
                   Invoices
                </button>
                <button 
                   className={`flex-1 min-w-[30%] py-2 text-sm font-bold rounded-xl transition-colors relative flex items-center justify-center gap-1.5 ${activeTab === 'chat' ? 'bg-blue-950 text-white shadow-md' : 'bg-white text-gray-500 border border-gray-200'}`}
                   onClick={() => setActiveTab('chat')}
                >
                   <MessageSquare className="w-4 h-4" />
                   Chat
                   {unreadChatCount > 0 && (
                       <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-[10px] font-black border-2 border-gray-50 shadow-sm">
                           {unreadChatCount}
                       </span>
                   )}
                </button>
                <button 
                   className={`flex-1 min-w-[30%] py-2 text-sm font-bold rounded-xl transition-colors relative flex items-center justify-center gap-1.5 ${activeTab === 'company' ? 'bg-blue-950 text-white shadow-md' : 'bg-white text-gray-500 border border-gray-200'}`}
                   onClick={() => setActiveTab('company')}
                >
                   <Building className="w-4 h-4" />
                   Company
                </button>
            </div>

            <div className="px-5 relative z-20">
                {activeTab === 'live' && (
                    <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5 flex flex-col gap-4">
                        <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                            <div className="flex items-center gap-2 text-gray-800">
                                <span className="relative flex h-3 w-3">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                                </span>
                                <span className="font-bold text-sm">Live Employees</span>
                            </div>
                        </div>
                        <div className="flex flex-col gap-3">
                            {adminData?.entries.filter(e => !e.clockOut).length === 0 ? (
                                <p className="text-gray-500 text-sm text-center py-4">No employees currently clocked in.</p>
                            ) : (
                                adminData?.entries.filter(e => !e.clockOut).map(e => {
                                    const user = adminData.users.find(u => u.id === e.profileId);
                                    return (
                                        <div key={e.id} className="p-3 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-between">
                                            <div>
                                                <p className="font-bold text-sm text-gray-800">{user?.name || 'Unknown'}</p>
                                                <p className="text-xs text-gray-500 mt-1">
                                                    Job: <span className="font-semibold text-gray-700">{e.projectName || 'General'}</span>
                                                </p>
                                                {e.clockInLocation && (
                                                    <p className="text-[10px] text-gray-400 mt-1">
                                                        Lat: {e.clockInLocation.latitude.toFixed(4)}, Lng: {e.clockInLocation.longitude.toFixed(4)}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded-md mb-1 inline-block">
                                                    Clocked in at {new Date(e.clockIn).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                </p>
                                                <a 
                                                    href={`https://www.google.com/maps/search/?api=1&query=${e.clockInLocation?.latitude},${e.clockInLocation?.longitude}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="block text-[10px] font-bold text-blue-500 hover:underline"
                                                >
                                                    View Map
                                                </a>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}
                {activeTab === 'employees' && (
                    <>
                        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5 flex flex-col gap-4">
                    <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                        <div className="flex items-center gap-2 text-gray-800">
                            <Users className="w-5 h-5 text-[#2563eb]" />
                            <span className="font-bold text-sm">Company Directory</span>
                        </div>
                        <div className="flex flex-wrap gap-2 justify-end">
                            <button 
                                onClick={() => setIsAddingEmployee(!isAddingEmployee)}
                                className="bg-blue-950 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-gray-800"
                            >
                                {isAddingEmployee ? 'Cancel' : '+ Employee'}
                            </button>
                            <select 
                                value={selectedUser || ''} 
                                onChange={(e) => setSelectedUser(e.target.value || null)}
                                className="bg-gray-50 border border-gray-200 text-xs font-bold rounded-lg px-2 py-1.5 focus:outline-none"
                            >
                                <option value="">All Employees</option>
                                {adminData?.users.map(u => (
                                    <option key={u.id} value={u.id}>{u.name} (${u.hourlyWage}/hr)</option>
                                ))}
                            </select>
                            <select 
                                value={selectedJob || ''} 
                                onChange={(e) => setSelectedJob(e.target.value || null)}
                                className="bg-gray-50 border border-gray-200 text-xs font-bold rounded-lg px-2 py-1.5 focus:outline-none"
                            >
                                <option value="">All Jobs</option>
                                {(adminData?.projects || []).map((proj, idx) => (
                                    <option key={idx} value={proj}>{proj}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {isAddingEmployee && (
                        <form onSubmit={handleAddEmployee} className="flex gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100 pb-3">
                            <input 
                                type="text"
                                placeholder="Employee Name"
                                value={newEmpName}
                                onChange={e => setNewEmpName(e.target.value)}
                                className="flex-1 px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
                            />
                            <input 
                                type="number"
                                placeholder="Wage ($)"
                                value={newEmpWage}
                                onChange={e => setNewEmpWage(e.target.value)}
                                step="0.01"
                                className="w-24 px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
                            />
                            <button type="submit" className="bg-[#2563eb] text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-blue-600">
                                Save
                            </button>
                        </form>
                    )}

                    <div className="flex gap-4">
                        <div className="flex-1 bg-gray-50 rounded-xl p-4 flex flex-col items-center justify-center border border-gray-100">
                            <Clock className="w-6 h-6 text-gray-400 mb-1" />
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-0.5">Total Hours</p>
                            <p className="text-2xl font-extrabold text-gray-800">{totalHours.toFixed(2)}<span className="text-sm font-bold text-gray-400 ml-1">hrs</span></p>
                        </div>
                        <div className="flex-1 bg-emerald-50 rounded-xl p-4 flex flex-col items-center justify-center border border-emerald-100">
                            <DollarSign className="w-6 h-6 text-emerald-400 mb-1" />
                            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-0.5">Total Payroll</p>
                            <p className="text-2xl font-extrabold text-[#10b981]">${totalPay.toFixed(2)}</p>
                        </div>
                    </div>
                </div>

                <div className="mt-6 flex justify-between items-end mb-4">
                    <h2 className="text-lg font-bold text-gray-800">Timesheet Logs</h2>
                    <button className="text-xs font-bold text-[#2563eb] flex items-center gap-1 bg-blue-50 px-3 py-1.5 rounded-full">
                        <Download className="w-3.5 h-3.5" />
                        Export
                    </button>
                </div>

                {isLoading ? (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 flex justify-center items-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#101726]"></div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredEntries.map((e, idx) => {
                            const user = adminData?.users.find(u => u.id === e.profileId);
                            const wage = user ? parseFloat(user.hourlyWage) : 0;
                            const inTime = new Date(e.clockIn).getTime();
                            const outTime = e.clockOut ? new Date(e.clockOut).getTime() : Date.now();
                            const dur = (outTime - inTime) / (1000 * 60 * 60);

                            return (
                                <div key={idx} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <p className="font-bold text-sm text-gray-800">{user ? user.name : 'Unknown User'}</p>
                                            <p className="text-xs font-semibold text-gray-400 mt-0.5">{new Date(e.clockIn).toDateString()}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-extrabold text-[#101726]">{Math.max(0, dur).toFixed(2)}h</p>
                                            <p className="text-xs font-bold text-[#10b981] mt-0.5">${(Math.max(0, dur) * wage).toFixed(2)}</p>
                                        </div>
                                    </div>
                                    <div className="bg-gray-50 rounded-lg p-2.5 flex items-center gap-3">
                                        <div className="flex-[1] text-left">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">IN</p>
                                            <p className="text-xs font-bold text-gray-600">{new Date(e.clockIn).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                                        </div>
                                        <ArrowRight className="w-4 h-4 text-gray-300" />
                                        <div className="flex-[1] text-right">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">OUT</p>
                                            <p className="text-xs font-bold text-gray-600">{e.clockOut ? new Date(e.clockOut).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Active'}</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {filteredEntries.length === 0 && (
                            <div className="bg-white p-8 rounded-2xl border border-gray-100 flex justify-center text-gray-400 font-bold text-sm">
                                No entries found.
                            </div>
                        )}
                    </div>
                )}
                    </>
                )}

                {activeTab === 'customers' && (
                    <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5 flex flex-col gap-4">
                        <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                            <div className="flex items-center gap-2 text-gray-800">
                                <Contact className="w-5 h-5 text-[#2563eb]" />
                                <span className="font-bold text-sm">Customer Directory</span>
                            </div>
                            <button 
                                onClick={() => setIsAddingCustomer(!isAddingCustomer)}
                                className="bg-blue-950 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-gray-800"
                            >
                                {isAddingCustomer ? 'Cancel' : '+ New Customer'}
                            </button>
                        </div>

                        {isAddingCustomer && (
                            <form onSubmit={handleAddCustomer} className="flex flex-col gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100 pb-4">
                                <input 
                                    type="text" required placeholder="Customer Name *"
                                    value={newCustomerName} onChange={e => setNewCustomerName(e.target.value)}
                                    className="px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none"
                                />
                                <input 
                                    type="email" placeholder="Email"
                                    value={newCustomerEmail} onChange={e => setNewCustomerEmail(e.target.value)}
                                    className="px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none"
                                />
                                <input 
                                    type="tel" placeholder="Phone"
                                    value={newCustomerPhone} onChange={e => setNewCustomerPhone(e.target.value)}
                                    className="px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none"
                                />
                                <input 
                                    type="text" placeholder="Address"
                                    value={newCustomerAddress} onChange={e => setNewCustomerAddress(e.target.value)}
                                    className="px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none"
                                />
                                <button type="submit" className="bg-[#2563eb] text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-blue-600 self-start">
                                    Save Customer
                                </button>
                            </form>
                        )}

                        <div className="space-y-3 mt-2">
                            {(adminData?.customers || []).length > 0 ? (
                                (adminData?.customers || []).map((customer, idx) => (
                                    <div key={idx} className="flex flex-col sm:flex-row justify-between sm:items-center p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-gray-200 transition-all gap-4">
                                        <div className="flex items-start gap-3">
                                            <div className="w-10 h-10 shrink-0 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 font-bold">
                                                {customer.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <span className="font-bold text-gray-800 text-sm block">{customer.name}</span>
                                                {customer.email && <span className="text-xs text-gray-500 block">{customer.email}</span>}
                                                {customer.phone && <span className="text-xs text-gray-500 block">{customer.phone}</span>}
                                                {customer.address && <span className="text-xs text-gray-500 block mt-1">{customer.address}</span>}
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => handleDeleteCustomer(customer.id, customer.name)}
                                            className="shrink-0 sm:self-center self-end w-10 h-10 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors flex items-center justify-center border border-gray-200 bg-white"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="py-8 text-center text-gray-400 text-sm font-bold">
                                    No Customers registered yet.
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'jobs' && (
                    <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5 flex flex-col gap-4">
                        <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                            <div className="flex items-center gap-2 text-gray-800">
                                <Users className="w-5 h-5 text-[#2563eb]" />
                                <span className="font-bold text-sm">Customer Jobs / Projects</span>
                            </div>
                            <button 
                                onClick={() => setIsAddingJob(!isAddingJob)}
                                className="bg-blue-950 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-gray-800"
                            >
                                {isAddingJob ? 'Cancel' : '+ New Job'}
                            </button>
                        </div>

                        {isAddingJob && (
                            <form onSubmit={handleAddJob} className="flex gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100 pb-3">
                                <input 
                                    type="text"
                                    placeholder="Customer / Job Name"
                                    value={newJobName}
                                    onChange={e => setNewJobName(e.target.value)}
                                    className="flex-1 px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none"
                                />
                                <button type="submit" className="bg-[#2563eb] text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-blue-600">
                                    Save Job
                                </button>
                            </form>
                        )}

                        <div className="space-y-2 mt-2">
                            {(adminData?.projects || []).length > 0 ? (
                                (adminData?.projects || []).map((proj, idx) => (
                                    <div key={idx} className="flex justify-between items-center p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-gray-200 transition-all">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                                                <Users className="w-4 h-4 text-[#2563eb]" />
                                            </div>
                                            <span className="font-semibold text-gray-700 text-sm">{proj}</span>
                                        </div>
                                        {proj !== 'General' && (
                                            <button 
                                                onClick={() => handleDeleteJob(proj)}
                                                className="w-10 h-10 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors flex items-center justify-center border border-gray-200 bg-white shadow-sm"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="py-8 text-center text-gray-400 text-sm font-bold">
                                    No Customer Jobs registered yet.
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'invoices' && (
                    <div className="space-y-6">
                        {!isCreatingInvoice ? (
                            <div className="flex flex-col gap-4">
                                <div className="flex justify-between items-center">
                                    <h2 className="text-lg font-bold text-gray-800">Past Invoices</h2>
                                    <button 
                                        onClick={() => setIsCreatingInvoice(true)}
                                        className="bg-blue-950 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-gray-800 flex items-center gap-1.5"
                                    >
                                        <Plus className="w-4 h-4" /> New Invoice
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    {adminData?.invoices && adminData.invoices.length > 0 ? (
                                        adminData.invoices.map((inv, idx) => (
                                            <div key={idx} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:border-gray-300 transition-all">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <p className="font-extrabold text-gray-800 text-sm">{inv.customerName}</p>
                                                        <p className="text-xs font-semibold text-gray-400 mt-0.5">{new Date(inv.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                                                        <span className="inline-block mt-2 text-[10px] bg-gray-100 text-gray-500 font-bold px-2 py-0.5 rounded uppercase">ID: {inv.id.substring(0, 8)}</span>
                                                    </div>
                                                    <div className="text-right flex flex-col items-end">
                                                        <p className="font-extrabold text-[#10b981] text-base">${inv.total.toFixed(2)}</p>
                                                        <p className="text-xs font-bold text-gray-500 mt-0.5">{inv.timeEntryIds.length} time entries</p>
                                                        
                                                        <button 
                                                            onClick={() => generateInvoicePDF(inv, adminData.users, adminData.entries)}
                                                            className="mt-3 flex items-center gap-1.5 text-xs font-extrabold text-[#2563eb] bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-100 transition-colors"
                                                        >
                                                            <Download className="w-3.5 h-3.5" />
                                                            Download PDF
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="bg-white p-8 rounded-2xl border border-gray-100 flex justify-center text-gray-400 font-bold text-sm">
                                            No invoices created yet.
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-lg font-bold text-gray-800">Create Invoice</h2>
                                    <button onClick={() => setIsCreatingInvoice(false)} className="text-xs font-bold text-gray-400">Cancel</button>
                                </div>
                                
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1 ml-1 uppercase">Customer Name</label>
                                        <div className="flex gap-2">
                                            <select 
                                                className="w-1/2 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:bg-white transition-all text-sm font-semibold"
                                                onChange={e => setInvoiceCustomer(e.target.value)}
                                                value={invoiceCustomer}
                                            >
                                                <option value="">-- Select Customer --</option>
                                                {adminData?.customers?.map(c => (
                                                    <option key={c.id} value={c.name}>{c.name}</option>
                                                ))}
                                            </select>
                                            <input
                                                type="text"
                                                value={invoiceCustomer}
                                                onChange={e => setInvoiceCustomer(e.target.value)}
                                                className="w-1/2 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:bg-white transition-all text-sm font-semibold"
                                                placeholder="Or type custom name..."
                                            />
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1 ml-1 uppercase">Select Time Entries</label>
                                        <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-xl bg-gray-50 p-2 space-y-1">
                                            {adminData?.entries.map(e => {
                                                const u = adminData?.users.find(u => u.id === e.profileId);
                                                const dur = (new Date(e.clockOut || Date.now()).getTime() - new Date(e.clockIn).getTime()) / 3600000;
                                                const cost = Math.max(0, dur) * (u ? parseFloat(u.hourlyWage) : 0);
                                                const selected = invoiceSelectedEntries.has(e.id);
                                                return (
                                                    <div 
                                                        key={e.id} 
                                                        onClick={() => {
                                                            const next = new Set(invoiceSelectedEntries);
                                                            if (selected) next.delete(e.id); else next.add(e.id);
                                                            setInvoiceSelectedEntries(next);
                                                        }}
                                                        className={`p-3 rounded-lg cursor-pointer flex justify-between border ${selected ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100 hover:border-gray-300'}`}
                                                    >
                                                        <div>
                                                            <p className="font-bold text-xs text-gray-800">{new Date(e.clockIn).toLocaleDateString()} - {u?.name}</p>
                                                            <p className="text-[10px] text-gray-500 mt-0.5">{e.projectName} &bull; {Math.max(0, dur).toFixed(2)}h</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="font-bold text-sm text-[#10b981]">${cost.toFixed(2)}</p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1 ml-1 uppercase">Markup Multiplier</label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                value={invoiceMarkup}
                                                onChange={e => setInvoiceMarkup(parseFloat(e.target.value) || 1)}
                                                step="0.1"
                                                min="1"
                                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563eb] text-sm font-semibold"
                                            />
                                            <span className="text-xs font-bold text-gray-400">e.g. 1.5x</span>
                                        </div>
                                    </div>
                                    
                                    <div className="pt-4 border-t border-gray-100">
                                        <label className="block text-xs font-bold text-gray-500 mb-2 ml-1 uppercase">Manual Line Items</label>
                                        {invoiceManualItems.map((mi, idx) => (
                                            <div key={idx} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg mb-2">
                                                <span className="text-sm font-bold text-gray-700">{mi.description}</span>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-sm font-extrabold text-[#10b981]">${mi.amount.toFixed(2)}</span>
                                                    <button onClick={() => setInvoiceManualItems(invoiceManualItems.filter(i => i.id !== mi.id))} className="text-red-400 hover:text-red-600">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                        <div className="flex gap-2">
                                            <input 
                                                type="text" placeholder="Description" 
                                                value={newManualItemDesc} onChange={e => setNewManualItemDesc(e.target.value)}
                                                className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                                            />
                                            <input 
                                                type="number" placeholder="$" step="0.01" 
                                                value={newManualItemAmt} onChange={e => setNewManualItemAmt(e.target.value)}
                                                className="w-24 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                                            />
                                            <button onClick={handleAddManualItem} type="button" className="bg-gray-200 px-3 py-2 rounded-lg font-bold hover:bg-gray-300 text-gray-600">Add</button>
                                        </div>
                                    </div>
                                    
                                    <div className="pt-6 mt-6 border-t border-gray-200">
                                        {(() => {
                                            // calc totals
                                            let entriesCost = 0;
                                            Array.from(invoiceSelectedEntries).forEach(id => {
                                                const e = adminData?.entries.find(x => x.id === id);
                                                if(e) {
                                                    const u = adminData?.users.find(u => u.id === e.profileId);
                                                    const dur = (new Date(e.clockOut || Date.now()).getTime() - new Date(e.clockIn).getTime()) / 3600000;
                                                    entriesCost += Math.max(0, dur) * (u ? parseFloat(u.hourlyWage) : 0);
                                                }
                                            });
                                            const subtotal = entriesCost * invoiceMarkup;
                                            const manualTotal = invoiceManualItems.reduce((acc, curr) => acc + curr.amount, 0);
                                            const finalTotal = subtotal + manualTotal;
                                            
                                            return (
                                                <div className="space-y-4">
                                                    <div className="flex justify-between items-center text-sm font-semibold text-gray-500">
                                                        <span>Time Entries Cost:</span>
                                                        <span>${entriesCost.toFixed(2)}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-sm font-semibold text-gray-500">
                                                        <span>Markup (x{invoiceMarkup}):</span>
                                                        <span>${subtotal.toFixed(2)}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-sm font-semibold text-gray-500">
                                                        <span>Manual Items:</span>
                                                        <span>${manualTotal.toFixed(2)}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-lg font-black text-gray-900 border-t border-gray-100 pt-3">
                                                        <span>Final Total:</span>
                                                        <span className="text-[#10b981]">${finalTotal.toFixed(2)}</span>
                                                    </div>
                                                    
                                                    <button 
                                                        onClick={() => handleSaveInvoice(finalTotal)}
                                                        disabled={isLoading}
                                                        className="w-full mt-4 bg-[#2563eb] text-white py-4 rounded-xl font-bold shadow-md hover:bg-blue-600 transition-colors disabled:opacity-50"
                                                    >
                                                        {isLoading ? 'Saving...' : 'Save & Generate Invoice'}
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

                {activeTab === 'chat' && (
                    <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden flex flex-col h-[calc(100vh-220px)]">
                        <Messaging profile={safeProfile as any} />
                    </div>
                )}

                {activeTab === 'company' && (
                    <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5 flex flex-col gap-5">
                        <div>
                            <h2 className="text-lg font-bold text-gray-800">Company Identity</h2>
                            <p className="text-xs text-gray-500 mt-1">This information appears on generated PDF timesheets and invoices.</p>
                        </div>
                        
                        <div className="flex flex-col gap-4">
                            <div>
                                <label className="text-xs font-bold text-gray-600 uppercase mb-1.5 block">Business Name</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-gray-50 border border-gray-200 text-sm font-semibold rounded-xl px-3 py-3"
                                    value={companyInfo.businessName}
                                    onChange={e => setCompanyInfo({...companyInfo, businessName: e.target.value})}
                                    placeholder="e.g. GEOTIME CONTRACTING"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-600 uppercase mb-1.5 block">Description / Tagline</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-gray-50 border border-gray-200 text-sm font-semibold rounded-xl px-3 py-3"
                                    value={companyInfo.tagline}
                                    onChange={e => setCompanyInfo({...companyInfo, tagline: e.target.value})}
                                    placeholder="e.g. PREMIUM TRACKED TIME INVOICING"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-600 uppercase mb-1.5 block">Contact Phone & Email</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-gray-50 border border-gray-200 text-sm font-semibold rounded-xl px-3 py-3"
                                    value={companyInfo.contactLine}
                                    onChange={e => setCompanyInfo({...companyInfo, contactLine: e.target.value})}
                                    placeholder="e.g. Contact: mail@co.com | Tel: 555-5555"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-600 uppercase mb-1.5 block">Business Address</label>
                                <textarea 
                                    className="w-full bg-gray-50 border border-gray-200 text-sm font-semibold rounded-xl px-3 py-3 h-24 resize-none"
                                    value={companyInfo.address}
                                    onChange={e => setCompanyInfo({...companyInfo, address: e.target.value})}
                                    placeholder="123 Main St&#10;City, State 12345"
                                />
                            </div>
                            
                            <button 
                                onClick={handleSaveCompanyInfo}
                                className="w-full mt-2 bg-blue-950 text-white py-3.5 rounded-xl font-bold shadow-md hover:bg-gray-800 transition-colors"
                            >
                                Save Settings
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
