
import React, { useState, useMemo, useEffect } from 'react';
import { UserProfile, TimeEntry, Coordinates, Task } from './types';
import ProfileSetup from './components/ProfileSetup';
import TimeLog from './components/TimeLog';
import { getCurrentPosition } from './services/locationService';
import { generatePayReport } from './services/pdfService';
import { AdminDashboard } from './components/AdminDashboard';
import Messaging from './components/Messaging';
import BottomNav from './components/BottomNav';
import Sidebar from './components/Sidebar';
import { chatService } from './services/chatService';
import { Clock, FileText, DollarSign, LayoutGrid, User, CalendarDays, Square, Trash2, Plus, CheckCircle2, Wallet, LogOut, ShieldAlert, MessageSquare, Mic, MicOff, Sparkles, Loader2, Briefcase, Tag, AlertCircle, X, Check, StopCircle } from 'lucide-react';

const App: React.FC = () => {
    const [profile, setProfile] = useState<UserProfile | null>(() => {
        try {
            const saved = localStorage.getItem('currentUser');
            return saved ? JSON.parse(saved) : null;
        } catch {
            return null;
        }
    });

    const handleProfileSave = (p: UserProfile) => {
        localStorage.setItem('currentUser', JSON.stringify(p));
        setProfile(p);
    };

    const handleLogout = () => {
        localStorage.removeItem('currentUser');
        setProfile(null);
        setTimeEntries([]);
        chatService.clearCache();
    };

    const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
    const [projects, setProjects] = useState<string[]>(['General']);
    
    // Tasks & AI Generator States
    const [tasks, setTasks] = useState<Task[]>(() => {
        try {
            const saved = localStorage.getItem('geotime_tasks');
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });

    useEffect(() => {
        localStorage.setItem('geotime_tasks', JSON.stringify(tasks));
    }, [tasks]);

    // Bottom FAB slide-up state
    const [isSlideUpOpen, setIsSlideUpOpen] = useState(false);
    
    // Sidebar state
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // AI task generator recording states
    const [isAiRecorderOpen, setIsAiRecorderOpen] = useState(false);
    const [recordingError, setRecordingError] = useState<string | null>(null);
    const [manualInput, setManualInput] = useState('');
    const [timer, setTimer] = useState(0);
    const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'processing' | 'review'>('idle');
    const [aiResults, setAiResults] = useState<{ title: string; priority: 'high' | 'medium' | 'low'; category?: string }[]>([]);
    const [selectedReviewProject, setSelectedReviewProject] = useState('General');
    const [checkedReviewIndexes, setCheckedReviewIndexes] = useState<number[]>([]);

    // Quick Task state
    const [isNewTaskPopupOpen, setIsNewTaskPopupOpen] = useState(false);
    const [quickTaskTitle, setQuickTaskTitle] = useState('');
    const [quickTaskPriority, setQuickTaskPriority] = useState<'high' | 'medium' | 'low'>('medium');
    const [quickTaskCategory, setQuickTaskCategory] = useState('General');

    // Filter tasks state
    const [selectedTaskProjectFilter, setSelectedTaskProjectFilter] = useState('All');

    // MediaRecorder Refs
    const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
    const audioChunksRef = React.useRef<Blob[]>([]);
    const timerIntervalRef = React.useRef<any>(null);
    const recordingStateRef = React.useRef<any>('idle');

    // Keep recordingStateRef in sync so callbacks can access latest status reliably
    useEffect(() => {
        recordingStateRef.current = recordingState;
    }, [recordingState]);

    useEffect(() => {
        if (projects.length > 0) {
            setSelectedReviewProject(projects[0]);
        }
    }, [projects]);

    const startRecording = async () => {
        setRecordingError(null);
        setRecordingState('recording');
        setTimer(0);
        audioChunksRef.current = [];

        try {
            if (!navigator.mediaDevices || !window.MediaRecorder) {
                throw new Error("Voice recording is not fully supported on this web context. Please type into the typed notes column instead. AI will still organize it perfectly!");
            }

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            let recorder: MediaRecorder;
            try {
                recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            } catch (mimeErr) {
                recorder = new MediaRecorder(stream);
            }
            mediaRecorderRef.current = recorder;

            recorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    audioChunksRef.current.push(e.data);
                }
            };

            recorder.onstop = async () => {
                if (recordingStateRef.current === 'idle') return;

                const fallbackMimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
                const finalMimeType = recorder.mimeType || fallbackMimeType;
                const audioBlob = new Blob(audioChunksRef.current, { type: finalMimeType });
                
                const reader = new FileReader();
                reader.readAsDataURL(audioBlob);
                reader.onloadend = () => {
                    const base64Data = reader.result?.toString().split(',')[1];
                    if (base64Data) {
                        setRecordingState('processing');
                        fetch('/api/tasks/generate', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                                audio: base64Data, 
                                mimeType: finalMimeType.split(';')[0] 
                            })
                        })
                        .then(async res => {
                            if (!res.ok) {
                                let errorMsg = `Server error: ${res.status}`;
                                try {
                                    const errData = await res.json();
                                    errorMsg = errData.message || errorMsg;
                                } catch (e) {
                                    const text = await res.text();
                                    errorMsg = text.length > 100 ? text.substring(0, 100) + '...' : text;
                                }
                                throw new Error(errorMsg);
                            }
                            return res.json();
                        })
                        .then(resData => {
                            if (resData.success && Array.isArray(resData.tasks)) {
                                setAiResults(resData.tasks);
                                setCheckedReviewIndexes(resData.tasks.map((_: any, i: number) => i)); // select all by default
                                setRecordingState('review');
                            } else {
                                throw new Error("Could not parse logical tasks.");
                            }
                        })
                        .catch(err => {
                            console.error(err);
                            setRecordingError(err.message || "AI was unable to cleanly extract tasks from raw vocal pitch. Please retry or try typing notes!");
                            setRecordingState('idle');
                        });
                    }
                };
            };

            recorder.start();

            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = setInterval(() => {
                setTimer(prev => prev + 1);
            }, 1000);

        } catch (err: any) {
            console.error("Mic error:", err);
            setRecordingError(err.message || "Microphone initialization failed. Grant frame permissions or try typing your jobsite observations.");
            setRecordingState('idle');
        }
    };

    const stopRecordingAndProcess = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
            try {
                mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            } catch {}
        }
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
        }
    };

    const cancelRecording = () => {
        setRecordingState('idle');
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            try {
                mediaRecorderRef.current.stop();
                mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            } catch {}
        }
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
        }
        setTimer(0);
    };

    const processTypedNotes = () => {
        const text = manualInput.trim();
        if (!text) return;

        setRecordingError(null);
        setRecordingState('processing');

        fetch('/api/tasks/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        })
        .then(async res => {
            if (!res.ok) {
                let errorMsg = `Server error: ${res.status}`;
                try {
                    const errData = await res.json();
                    errorMsg = errData.message || errorMsg;
                } catch (e) {
                    const text = await res.text();
                    errorMsg = text.length > 100 ? text.substring(0, 100) + '...' : text;
                }
                throw new Error(errorMsg);
            }
            return res.json();
        })
        .then(resData => {
            if (resData.success && Array.isArray(resData.tasks)) {
                setAiResults(resData.tasks);
                setCheckedReviewIndexes(resData.tasks.map((_: any, i: number) => i)); // select all by default
                setRecordingState('review');
            } else {
                throw new Error("Could not parse logical tasks.");
            }
        })
        .catch(err => {
            console.error(err);
            setRecordingError(err.message || "AI was unable to cleanly extract tasks from raw observations. Please verify terms and retry.");
            setRecordingState('idle');
        });
    };

    const applyAiTasks = () => {
        const newTasks: Task[] = checkedReviewIndexes.map(idx => {
            const aiTask = aiResults[idx];
            return {
                id: 'task_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
                projectId: selectedReviewProject,
                title: aiTask.title,
                completed: false,
                priority: aiTask.priority as 'high' | 'medium' | 'low',
                category: aiTask.category || 'General',
                createdAt: new Date().toISOString()
            };
        });

        setTasks(prev => [...prev, ...newTasks]);
        setIsAiRecorderOpen(false);
        setRecordingState('idle');
        setManualInput('');
        setSelectedTaskProjectFilter(selectedReviewProject);
        setCurrentTab('tasks');
    };

    const handleCreateQuickTask = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = quickTaskTitle.trim();
        if (!trimmed) return;

        const newTask: Task = {
            id: 'task_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            projectId: selectedProject || 'General',
            title: trimmed,
            completed: false,
            priority: quickTaskPriority,
            category: quickTaskCategory || 'General',
            createdAt: new Date().toISOString()
        };

        setTasks(prev => [...prev, newTask]);
        setQuickTaskTitle('');
        setIsNewTaskPopupOpen(false);
        setSelectedTaskProjectFilter(selectedProject || 'General');
        setCurrentTab('tasks');
    };

    // Derived State
    const filteredTasks = useMemo(() => {
        if (selectedTaskProjectFilter === 'All') {
            return tasks;
        }
        return tasks.filter(t => t.projectId === selectedTaskProjectFilter);
    }, [tasks, selectedTaskProjectFilter]);
    
    // UI State
    const [isLoading, setIsLoading] = useState(false);
    const [showAdmin, setShowAdmin] = useState(false);
    const [now, setNow] = useState(new Date());
    const [currentTab, setCurrentTab] = useState<'tasks' | 'time' | 'profile' | 'paylog' | 'chat'>('time');
    const [unreadChatCount, setUnreadChatCount] = useState(0);
    const [newProjectName, setNewProjectName] = useState('');
    const [selectedProject, setSelectedProject] = useState<string>('General');

    // Subscribe to unread chat count
    useEffect(() => {
        const unsubscribe = chatService.subscribeToUnreadCount((count) => {
            setUnreadChatCount(count);
        });
        chatService.startPolling(5000); // Poll for new chat status in background
        return () => {
            unsubscribe();
            chatService.stopPolling();
        };
    }, []);

    useEffect(() => {
        if (projects.length > 0) {
            setSelectedProject(prev => projects.includes(prev) ? prev : projects[0]);
        }
    }, [projects]);

    const [paylogFilterProject, setPaylogFilterProject] = useState('All');
    const [paylogDateRange, setPaylogDateRange] = useState<'all' | 'this_week' | 'last_week' | 'this_month'>('this_week');

    const [isSyncing, setIsSyncing] = useState(false);

    // PWA Install prompt handling states
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isInstallable, setIsInstallable] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);
    const [showInstallBanner, setShowInstallBanner] = useState(true);

    useEffect(() => {
        const checkStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
        setIsStandalone(!!checkStandalone);

        const handleBeforeInstall = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setIsInstallable(true);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstall);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to installation prompt: ${outcome}`);
        setDeferredPrompt(null);
        setIsInstallable(false);
    };

    // Sync entries to GAS whenever they update
    useEffect(() => {
        if (profile && timeEntries.length > 0) {
            setIsSyncing(true);
            fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    payload: {
                        action: 'SYNC_ENTRIES',
                        payload: { profileId: profile.id, entries: timeEntries }
                    }
                })
            })
            .catch(err => console.error('Error syncing to database:', err))
            .finally(() => setIsSyncing(false));
        }
    }, [timeEntries, profile]);

    // Initial load: Profile save triggers GAS user creation and load projects
    useEffect(() => {
        if (profile) {
            // Setup / sync user profile
            fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    payload: {
                        action: 'SAVE_PROFILE',
                        payload: profile
                    }
                })
            }).catch(e => console.error('Profile sync error:', e));

            // Load projects and company info from GAS
            fetch('/api/data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            })
            .then(res => res.json())
            .then(data => {
               if (data && data.projects && Array.isArray(data.projects)) {
                   setProjects(Array.from(new Set([...projects, ...data.projects])));
               }
               if (data && data.companyInfo) {
                   localStorage.setItem('geotime_company_info', JSON.stringify(data.companyInfo));
               }
            })
            .catch(e => console.error('Error loading projects/company info:', e));

            // Load user time entries
            fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    payload: { action: 'FETCH_USER_DATA', payload: { profileId: profile.id } }
                })
            })
            .then(res => res.json())
            .then(data => {
                if (data && data.success && data.data && data.data.entries) {
                    setTimeEntries(data.data.entries);
                }
            })
            .catch(e => console.error('Error fetching time entries:', e));
        }
    }, [profile]);


    // Update 'now' every minute so active clock-in time increments
    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(interval);
    }, []);

    const isClockedIn = useMemo(() => {
        const lastEntry = timeEntries.length > 0 ? timeEntries[timeEntries.length - 1] : null;
        return !!lastEntry && !lastEntry.clockOut;
    }, [timeEntries]);

    // Paylog Filtering logic
    const filteredPaylogEntries = useMemo(() => {
        let filtered = [...timeEntries];
        
        // Project filter
        if (paylogFilterProject !== 'All') {
            filtered = filtered.filter(e => (e.projectName || 'General') === paylogFilterProject);
        }

        // Date filter
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        if (paylogDateRange === 'this_week') {
            const startOfWeek = new Date(today);
            startOfWeek.setDate(today.getDate() - today.getDay());
            filtered = filtered.filter(e => new Date(e.clockIn) >= startOfWeek);
        } else if (paylogDateRange === 'last_week') {
            const startOfLastWeek = new Date(today);
            startOfLastWeek.setDate(today.getDate() - today.getDay() - 7);
            const endOfLastWeek = new Date(startOfLastWeek);
            endOfLastWeek.setDate(startOfLastWeek.getDate() + 7);
            filtered = filtered.filter(e => {
                const d = new Date(e.clockIn);
                return d >= startOfLastWeek && d < endOfLastWeek;
            });
        } else if (paylogDateRange === 'this_month') {
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            filtered = filtered.filter(e => new Date(e.clockIn) >= startOfMonth);
        }
        
        return filtered;
    }, [timeEntries, paylogFilterProject, paylogDateRange, now]);

    const paylogTotals = useMemo(() => {
        let hours = 0;
        filteredPaylogEntries.forEach(entry => {
            const inTime = new Date(entry.clockIn).getTime();
            const outTime = entry.clockOut ? new Date(entry.clockOut).getTime() : now.getTime();
            hours += (outTime - inTime) / (1000 * 60 * 60);
        });
        return {
            hours,
            earnings: hours * (profile?.hourlyWage || 0)
        };
    }, [filteredPaylogEntries, profile, now]);

    // Compute weekly hours
    const { weeklyHours, weeklyEarnings } = useMemo(() => {
        const startOfWeek = new Date();
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
        startOfWeek.setHours(0,0,0,0);

        let hours = 0;
        timeEntries.forEach(entry => {
            const inTime = new Date(entry.clockIn);
            if (inTime >= startOfWeek) {
                if (entry.clockOut) {
                    hours += (new Date(entry.clockOut).getTime() - inTime.getTime()) / (1000*60*60);
                } else {
                    hours += (now.getTime() - inTime.getTime()) / (1000*60*60);
                }
            }
        });
        
        return {
            weeklyHours: hours,
            weeklyEarnings: hours * (profile?.hourlyWage || 0)
        };
    }, [timeEntries, now, profile]);

    const handleClockToggle = async () => {
        setIsLoading(true);
        try {
            const location: Coordinates = await getCurrentPosition();
            let updatedEntries: TimeEntry[] = [];

            if (isClockedIn) {
                // Clocking out
                const lastEntry = timeEntries[timeEntries.length - 1];
                const updatedEntry: TimeEntry = {
                    ...lastEntry,
                    clockOut: new Date().toISOString(),
                    clockOutLocation: location,
                };
                updatedEntries = [
                    ...timeEntries.slice(0, timeEntries.length - 1),
                    updatedEntry
                ];
                setTimeEntries(updatedEntries);
            } else {
                // Clocking in
                const newEntry: TimeEntry = {
                    id: new Date().toISOString(),
                    projectName: selectedProject || 'General',
                    clockIn: new Date().toISOString(),
                    clockInLocation: location,
                };
                updatedEntries = [...timeEntries, newEntry];
                setTimeEntries(updatedEntries);
            }
        } catch (err: any) {
            console.error('Location error:', err);
            // Fallback: Clock in without location if requested, or just show error. 
            // We'll proceed without location just to make it usable if location fails.
            if (isClockedIn) {
                const lastEntry = timeEntries[timeEntries.length - 1];
                setTimeEntries([
                    ...timeEntries.slice(0, timeEntries.length - 1),
                    { ...lastEntry, clockOut: new Date().toISOString() }
                ]);
            } else {
                setTimeEntries([
                    ...timeEntries,
                    { id: new Date().toISOString(), projectName: selectedProject || 'General', clockIn: new Date().toISOString() }
                ]);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddProject = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = newProjectName.trim();
        if (trimmed && !projects.includes(trimmed)) {
            setProjects([...projects, trimmed]);
            setNewProjectName('');
        }
    };

    const handleDeleteProject = (proj: string) => {
        if (window.confirm(`Delete project "${proj}"? Past time entries will keep this name.`)) {
            setProjects(projects.filter(p => p !== proj));
        }
    };

    if (showAdmin) {
        return <AdminDashboard onClose={() => setShowAdmin(false)} profile={profile} />;
    }

    if (!profile) {
        return <ProfileSetup onProfileSave={handleProfileSave} onAdminAccess={() => setShowAdmin(true)} />;
    }

    return (
        <div className="h-[100dvh] bg-gray-50 flex text-gray-800 font-sans">
            <Sidebar 
                isOpen={isSidebarOpen} 
                setIsOpen={setIsSidebarOpen} 
                currentTab={currentTab} 
                setCurrentTab={setCurrentTab} 
            />
            <div className="w-full max-w-md mx-auto relative flex flex-col h-full overflow-hidden">
                
                {/* Global Header */}
                <header className="bg-blue-950 text-white px-5 py-4 flex items-center justify-between shrink-0 z-20">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#2563eb] flex items-center justify-center font-bold text-sm text-white">
                            {profile.name ? profile.name.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <span className="font-semibold text-[15px]">{profile.name}</span>
                    </div>
                    <span className="text-gray-400 text-[11px] font-bold tracking-widest">USER</span>
                </header>

                {/* PWA Mobile App Download Assistance Banner */}
                {!isStandalone && showInstallBanner && (
                    <div className="bg-gradient-to-r from-amber-600 to-blue-600 text-white px-4 py-2.5 shrink-0 flex items-center justify-between z-20 text-[11px] font-bold shadow-md transition-all">
                        <div className="flex items-center gap-1.5 leading-tight">
                            <span className="text-sm">📱</span>
                            <span>
                                {isInstallable ? (
                                    "Save GeoTime to your home screen for quick offline access!"
                                ) : (
                                    /iPad|iPhone|iPod/.test(navigator.userAgent) ? (
                                        "iOS user? Tap the Share button & choose 'Add to Home Screen'!"
                                    ) : (
                                        "Click options -> 'Add to Home Screen' to launch full-screen!"
                                    )
                                )}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 ml-1.5">
                            {isInstallable && (
                                <button 
                                    onClick={handleInstallClick}
                                    className="bg-white text-blue-600 px-2 py-0.5 rounded-md font-extrabold text-[10px] hover:bg-gray-100 transition-colors"
                                >
                                    INSTALL
                                </button>
                            )}
                            <button 
                                onClick={() => setShowInstallBanner(false)}
                                className="text-white hover:text-blue-200 text-xs p-1 ml-0.5"
                            >
                                ✕
                            </button>
                        </div>
                    </div>
                )}

                {currentTab === 'chat' ? (
                    <div className="flex-1 flex flex-col min-h-0 pb-20 w-full">
                        <Messaging profile={profile} />
                    </div>
                ) : (
                    <div className="flex-1 w-full overflow-y-auto pb-24">
                    {currentTab === 'time' && (
                    <>
                    {/* Top Section - Big Button */}
                    <div className="bg-white rounded-b-[40px] shadow-sm pb-10 flex flex-col items-center relative">
                       <div className="w-full px-6 py-5 flex justify-between items-center">
                           <div className="flex-1 text-center mt-2">
                               <span className="text-gray-400/80 font-bold tracking-widest text-sm">
                                   {isClockedIn ? 'ON THE CLOCK' : 'READY TO WORK'}
                               </span>
                           </div>
                           <div className="absolute right-5 top-5">
                               <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${isSyncing ? 'bg-amber-50 text-amber-600' : 'bg-[#f1fcf5] text-[#10b981]'}`}>
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  {isSyncing ? 'Syncing...' : 'Synced'}
                               </span>
                           </div>
                       </div>
                       
                       {/* Centered large button area */}
                       <div className="mt-2 mb-6">
                           <button
                               onClick={handleClockToggle}
                               disabled={isLoading}
                               style={{
                                   background: isClockedIn ? '#ffeaea' : '#eafcef',
                                   boxShadow: isClockedIn 
                                    ? '0 0 0 15px rgba(255, 234, 234, 0.5), 0 0 0 30px rgba(255, 234, 234, 0.2)' 
                                    : '0 0 0 15px rgba(234, 252, 239, 0.5), 0 0 0 30px rgba(234, 252, 239, 0.2)'
                               }}
                               className={`relative flex flex-col items-center justify-center w-48 h-48 rounded-full transition-all duration-300 ${isLoading ? 'opacity-70 scale-95' : 'hover:scale-105 active:scale-95'}`}
                           >
                               <div className={`flex flex-col items-center ${isClockedIn ? 'text-red-600' : 'text-emerald-600'}`}>
                                   {isClockedIn ? (
                                       <Square className="w-10 h-10 mb-2 fill-current" />
                                   ) : (
                                       <Clock className="w-10 h-10 mb-2 stroke-[2.5]" />
                                   )}
                                   <span className="text-2xl font-bold tracking-wider">
                                       {isClockedIn ? 'STOP' : 'START'}
                                   </span>
                                   {isLoading && <span className="absolute bottom-6 text-xs font-semibold opacity-60">Wait...</span>}
                               </div>
                           </button>
                       </div>

                       {/* Job Selection Dropdown */}
                       {!isClockedIn && (
                           <div className="w-full max-w-[280px] mt-2 mb-4 px-6 text-center z-10">
                               <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                                   Select Job / Customer
                               </label>
                               <select
                                   value={selectedProject}
                                   onChange={(e) => setSelectedProject(e.target.value)}
                                   className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-center text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-[#2563eb] focus:bg-white transition-all cursor-pointer shadow-sm"
                                >
                                   {projects.map((proj, idx) => (
                                       <option key={idx} value={proj}>
                                           💼 {proj}
                                       </option>
                                   ))}
                               </select>
                           </div>
                       )}
                       {isClockedIn && (
                           <div className="text-center mt-2 mb-4 px-6 z-10">
                               <span className="text-xs font-semibold text-gray-400">Active Job:</span>
                               <div>
                                   <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-[#2563eb] font-bold text-xs rounded-full border border-blue-100 mt-1 uppercase">
                                       💼 {timeEntries[timeEntries.length - 1]?.projectName || 'General'}
                                   </span>
                               </div>
                           </div>
                       )}
                    </div>

                    {/* Dashboard Cards */}
                    <div className="px-5 mt-8 z-10 flex-1 flex flex-col gap-6">
                        
                        <div className="flex gap-4">
                            {/* This Week Card */}
                            <div className="flex-1 bg-blue-950 rounded-2xl p-5 shadow-lg relative overflow-hidden flex flex-col justify-between">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2 text-gray-300 text-xs font-bold tracking-wide">
                                        <Clock className="w-4 h-4" />
                                        <span>THIS WEEK</span>
                                    </div>
                                    <div className="bg-gray-700/50 p-2 rounded-xl text-gray-300">
                                       <FileText className="w-4 h-4" />
                                    </div>
                                </div>
                                <div className="flex items-baseline gap-1 mt-auto">
                                    <span className="text-4xl font-extrabold text-white tracking-tight">
                                        {weeklyHours.toFixed(2)}
                                    </span>
                                    <span className="text-gray-400 font-medium">hrs</span>
                                </div>
                            </div>

                            {/* Earnings Card */}
                            <div className="flex-1 bg-[#2563eb] rounded-2xl p-5 shadow-lg relative overflow-hidden flex flex-col justify-between">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2 text-blue-100 text-xs font-bold tracking-wide">
                                        <DollarSign className="w-4 h-4" />
                                        <span>EARNINGS</span>
                                    </div>
                                </div>
                                <div className="flex items-baseline mt-auto">
                                    <span className="text-4xl font-extrabold text-white tracking-tight">
                                        ${weeklyEarnings.toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Recent Activity */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] overflow-hidden">
                            <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
                                <h3 className="font-bold text-gray-800 text-[15px]">Recent Activity</h3>
                                <span className="text-gray-400 text-xs font-medium">Last 7 Days</span>
                            </div>
                            <div className="p-8 flex justify-center items-center">
                                {timeEntries.length > 0 ? (
                                    <ul className="w-full space-y-4">
                                        {timeEntries.slice(-3).reverse().map(entry => (
                                            <li key={entry.id} className="flex justify-between items-center border-b border-gray-50 pb-2 last:border-0 last:pb-0">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-semibold text-gray-700">{new Date(entry.clockIn).toLocaleDateString()}</span>
                                                    <span className="text-xs text-gray-400">
                                                        {new Date(entry.clockIn).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - 
                                                        {entry.clockOut ? new Date(entry.clockOut).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ' Now'}
                                                    </span>
                                                </div>
                                                <div className="text-sm font-bold text-gray-600">
                                                    {entry.clockOut 
                                                        ? (((new Date(entry.clockOut).getTime() - new Date(entry.clockIn).getTime()) / (1000*60*60)).toFixed(2) + 'h')
                                                        : '...'}
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-gray-400 italic text-sm text-center">No time entries recorded yet.</p>
                                )}
                            </div>
                        </div>
                    </div>
                    </>)}
                         {currentTab === 'tasks' && (
                    <div className="px-5 mt-8 flex flex-col gap-6">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="text-2xl font-bold text-gray-800">Job Checklists</h2>
                        </div>
                        
                        {/* Task Checklist Board Area */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col">
                            <div className="flex justify-between items-center mb-4">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                                    Filter tasks by project
                                </label>
                                <span className="text-[11px] font-extrabold text-[#2563eb] bg-blue-50 px-2.5 py-1 rounded-full">
                                    {tasks.filter(t => t.completed).length}/{tasks.length} Resolved
                                </span>
                            </div>
                            
                            <select
                                value={selectedTaskProjectFilter}
                                onChange={(e) => setSelectedTaskProjectFilter(e.target.value)}
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 mb-5 outline-none focus:ring-2 focus:ring-[#2563eb] transition-all"
                            >
                                <option value="All">All active jobsites</option>
                                {projects.map((p, idx) => (
                                    <option key={idx} value={p}>
                                        {p}
                                    </option>
                                ))}
                            </select>

                            {/* Task checklists */}
                            {filteredTasks.length > 0 ? (
                                <ul className="space-y-3">
                                    {filteredTasks.map((t) => (
                                        <li 
                                            key={t.id} 
                                            className={`flex items-center justify-between p-3 rounded-xl border transition-all ${t.completed ? 'bg-gray-50/70 border-gray-100' : 'bg-white border-gray-200 shadow-sm'}`}
                                        >
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <button 
                                                    onClick={() => {
                                                        setTasks(tasks.map(task => task.id === t.id ? { ...task, completed: !task.completed } : task));
                                                    }}
                                                    className="focus:outline-none shrink-0"
                                                >
                                                    {t.completed ? (
                                                        <CheckCircle2 className="w-5 h-5 text-emerald-600 fill-emerald-50" />
                                                    ) : (
                                                        <div className="w-5 h-5 rounded-full border-2 border-gray-300 hover:border-[#2563eb]" />
                                                    )}
                                                </button>
                                                <div className="min-w-0 flex-1">
                                                    <p className={`text-xs font-bold text-gray-700 leading-tight break-words ${t.completed ? 'line-through text-gray-400' : ''}`}>
                                                        {t.title}
                                                    </p>
                                                    <div className="flex gap-2 items-center mt-1 flex-wrap">
                                                        {t.category && (
                                                            <span className="text-[8px] font-black text-gray-400 uppercase tracking-wider bg-gray-100 px-1.5 py-0.5 rounded">
                                                                {t.category}
                                                            </span>
                                                        )}
                                                        <span className={`text-[8px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded ${
                                                            t.priority === 'high' 
                                                                ? 'bg-red-50 text-red-600' 
                                                                : t.priority === 'medium' 
                                                                ? 'bg-amber-50 text-amber-600' 
                                                                : 'bg-blue-50 text-blue-600'
                                                        }`}>
                                                            {t.priority}
                                                        </span>
                                                        <span className="text-[8px] text-gray-400 font-extrabold max-w-[80px] truncate">
                                                            @{t.projectId}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <button 
                                                onClick={() => setTasks(tasks.filter(task => task.id !== t.id))}
                                                className="text-gray-300 hover:text-red-500 p-1 rounded-full hover:bg-gray-50 transition-colors shrink-0"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="text-center py-8 px-4 border border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
                                    <Sparkles className="w-8 h-8 text-blue-500/80 mx-auto mb-2 animate-pulse" />
                                    <h4 className="font-extrabold text-gray-700 text-xs mb-1">No tasks for this filter</h4>
                                    <p className="text-[10px] text-gray-400 leading-relaxed max-w-[200px] mx-auto">
                                        Speak while walking your worksite! Press the bottom central blue <span className="text-blue-600 font-bold">+</span> button and choose <span className="text-blue-600">🎙️ AI Voice Task Generator</span> to draft checklists automatically.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Existing Projects section */}
                        <div>
                            <h3 className="text-sm font-extrabold text-gray-400 uppercase tracking-widest mb-3">
                                Job Sites & Projects
                            </h3>

                            <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
                                <form onSubmit={handleAddProject} className="flex gap-2">
                                    <input 
                                        type="text" 
                                        value={newProjectName}
                                        onChange={(e) => setNewProjectName(e.target.value)}
                                        placeholder="Add new jobsite / customer"
                                        className="flex-1 px-3 py-2 text-xs bg-gray-50 border-transparent rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:bg-white transition-all"
                                    />
                                    <button 
                                        type="submit"
                                        disabled={!newProjectName.trim()}
                                        className="bg-blue-950 text-white px-3 py-2 rounded-xl disabled:opacity-50 hover:bg-gray-800 transition-colors flex items-center justify-center text-xs font-bold"
                                    >
                                        <Plus className="w-4 h-4 mr-0.5" /> Add
                                    </button>
                                </form>
                            </div>

                            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                                <ul className="divide-y divide-gray-100">
                                    {projects.map((proj, idx) => (
                                        <li key={idx} className="p-4 flex justify-between items-center bg-white hover:bg-gray-50 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                                                    <LayoutGrid className="w-4 h-4 text-gray-500" />
                                                </div>
                                                <span className="text-xs font-bold text-gray-700">{proj}</span>
                                            </div>
                                            {projects.length > 1 && (
                                                <button 
                                                    onClick={() => handleDeleteProject(proj)}
                                                    className="w-8 h-8 rounded-full border border-gray-150 text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all flex items-center justify-center"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                )}

                {currentTab === 'paylog' && (
                    <div className="px-5 mt-6 flex flex-col gap-6">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="text-2xl font-bold text-gray-800">Pay Log</h2>
                            <button
                                onClick={() => generatePayReport(profile, filteredPaylogEntries)}
                                disabled={filteredPaylogEntries.length === 0}
                                className="bg-[#2563eb] text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                <FileText className="w-4 h-4" />
                                Export
                            </button>
                        </div>

                        {/* Totals Summary Card */}
                        <div className="bg-blue-950 rounded-2xl p-5 shadow-lg flex justify-between items-center text-white">
                            <div>
                                <p className="text-gray-400 text-xs font-bold tracking-wide mb-1">TOTAL HOURS</p>
                                <p className="text-3xl font-extrabold">{paylogTotals.hours.toFixed(2)}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-gray-400 text-xs font-bold tracking-wide mb-1">TOTAL EARNINGS</p>
                                <p className="text-3xl font-extrabold text-[#10b981]">${paylogTotals.earnings.toFixed(2)}</p>
                            </div>
                        </div>

                        {/* Filters */}
                        <div className="flex gap-3">
                            <div className="flex-1">
                                <label className="block text-xs font-bold text-gray-500 mb-1 ml-1 uppercase">Period</label>
                                <select 
                                    value={paylogDateRange}
                                    onChange={e => setPaylogDateRange(e.target.value as any)}
                                    className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-[#2563eb]"
                                >
                                    <option value="this_week">This Week</option>
                                    <option value="last_week">Last Week</option>
                                    <option value="this_month">This Month</option>
                                    <option value="all">All Time</option>
                                </select>
                            </div>
                            <div className="flex-1">
                                <label className="block text-xs font-bold text-gray-500 mb-1 ml-1 uppercase">Project</label>
                                <select 
                                    value={paylogFilterProject}
                                    onChange={e => setPaylogFilterProject(e.target.value)}
                                    className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-[#2563eb]"
                                >
                                    <option value="All">All Projects</option>
                                    {projects.map((p, idx) => <option key={idx} value={p}>{p}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-6">
                            <TimeLog timeEntries={filteredPaylogEntries} profile={profile} />
                        </div>
                    </div>
                )}

                {currentTab === 'profile' && (
                    <div className="px-5 mt-6 flex flex-col gap-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-2xl font-bold text-gray-800">Your Profile</h2>
                            <button
                                onClick={handleLogout}
                                className="bg-red-50 text-red-600 px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-red-100 flex items-center gap-2"
                            >
                                <LogOut className="w-4 h-4" />
                                Logout
                            </button>
                        </div>
                        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Full Name</label>
                                    <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 font-bold">
                                        {profile.name}
                                    </div>
                                </div>
                                <div className="pb-2">
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Hourly Wage ($)</label>
                                    <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 font-bold">
                                        ${profile.hourlyWage.toFixed(2)}
                                    </div>
                                    <p className="text-[10px] text-gray-400 font-bold mt-2 text-center uppercase tracking-wider">Contact administrator to change details</p>
                                </div>
                            </div>
                            
                            <div className="mt-8 pt-6 border-t border-gray-100 flex justify-center">
                                <button 
                                    onClick={() => setShowAdmin(true)}
                                    className="text-xs font-bold text-gray-400 hover:text-gray-600 flex items-center gap-1.5 transition-colors"
                                >
                                    <ShieldAlert className="w-4 h-4" />
                                    Admin Panel Login
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                    </div>
                )}

                {/* Bottom Navigation */}
                <BottomNav 
                    currentTab={currentTab} 
                    setCurrentTab={setCurrentTab} 
                    onFabClick={() => setIsSlideUpOpen(true)}
                    onMenuClick={() => setIsSidebarOpen(true)}
                />

                {/* BACKDROP FOR SLIDE-UP ACTIONS */}
                {isSlideUpOpen && (
                    <div 
                        onClick={() => setIsSlideUpOpen(false)} 
                        className="absolute inset-0 bg-gray-900/50 backdrop-blur-[1.5px] transition-opacity z-45"
                    />
                )}

                {/* SLIDE-UP DRAWER ACTIONS */}
                <div 
                    className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-[28px] shadow-[0_-12px_30px_rgba(0,0,0,0.12)] border-t border-gray-100 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] z-50 px-5 pt-4 pb-8 transform-gpu will-change-transform ${isSlideUpOpen ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'}`}
                >
                    <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-3.5" />
                    
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-sm font-black text-gray-800 tracking-tight">Jobsite Menu & Actions</h3>
                        <button 
                            onClick={() => setIsSlideUpOpen(false)}
                            className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 flex items-center justify-center text-xs font-black transition-all"
                        >
                            ✕
                        </button>
                    </div>

                    {/* Navigation Dashboard Section */}
                    <div className="mb-5 bg-gray-50 p-3 rounded-2xl border border-gray-100">
                        <h4 className="text-[9px] font-black tracking-widest text-gray-500 uppercase mb-2">My Jobsite Hub</h4>
                        <div className="grid grid-cols-3 gap-2">
                            <button 
                                onClick={() => {
                                    setCurrentTab('tasks');
                                    setIsSlideUpOpen(false);
                                }}
                                className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all text-center ${
                                    currentTab === 'tasks' 
                                        ? 'bg-blue-100 shadow-sm border-blue-200 text-[#2563eb] font-black' 
                                        : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-600 font-extrabold'
                                }`}
                            >
                                <LayoutGrid className="w-5 h-5 mb-1 text-inherit shrink-0" />
                                <span className="text-[10px] leading-tight">Tasks</span>
                            </button>

                            <button 
                                onClick={() => {
                                    setCurrentTab('paylog');
                                    setIsSlideUpOpen(false);
                                }}
                                className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all text-center ${
                                    currentTab === 'paylog' 
                                        ? 'bg-blue-100 shadow-sm border-blue-200 text-[#2563eb] font-black' 
                                        : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-600 font-extrabold'
                                }`}
                            >
                                <Wallet className="w-5 h-5 mb-1 text-inherit shrink-0" />
                                <span className="text-[10px] leading-tight">Pay Log</span>
                            </button>

                            <button 
                                onClick={() => {
                                    setCurrentTab('profile');
                                    setIsSlideUpOpen(false);
                                }}
                                className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all text-center ${
                                    currentTab === 'profile' 
                                        ? 'bg-blue-100 shadow-sm border-blue-200 text-[#2563eb] font-black' 
                                        : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-600 font-extrabold'
                                }`}
                            >
                                <User className="w-5 h-5 mb-1 text-inherit shrink-0" />
                                <span className="text-[10px] leading-tight">Profile</span>
                            </button>
                        </div>
                    </div>

                    {/* Creator Actions Section */}
                    <div className="space-y-2.5">
                        <button 
                            onClick={() => {
                                setIsSlideUpOpen(false);
                                setIsAiRecorderOpen(true);
                                setRecordingState('idle');
                                setRecordingError(null);
                            }}
                            className="w-full flex items-center gap-3.5 p-3 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-left transition-all active:scale-98 shadow-sm"
                        >
                            <div className="w-8.5 h-8.5 rounded-lg bg-white/20 text-white flex items-center justify-center shadow-inner shrink-0">
                                <AlertCircle className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h4 className="font-extrabold text-white text-xs leading-tight">🛡️ Incident Logger</h4>
                                <p className="text-[10px] text-blue-100 mt-0.5 leading-normal">
                                    Log structured incidents with AI assistance.
                                </p>
                            </div>
                        </button>

                        <button 
                            onClick={() => {
                                setIsSlideUpOpen(false);
                                setIsNewTaskPopupOpen(true);
                            }}
                            className="w-full flex items-center gap-3.5 p-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-left transition-all active:scale-98"
                        >
                            <div className="w-8.5 h-8.5 rounded-lg bg-gray-900 text-white flex items-center justify-center shrink-0">
                                <Plus className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h4 className="font-extrabold text-gray-800 text-xs leading-tight">✍️ Check-in Quick Task</h4>
                                <p className="text-[10px] text-gray-500 mt-0.5 leading-normal">
                                    Manually list a checklist/remediation item.
                                </p>
                            </div>
                        </button>

                        <button 
                            onClick={() => {
                                setIsSlideUpOpen(false);
                                const name = prompt("Enter new Job Site / Project Name:");
                                if (name && name.trim()) {
                                    const trimmed = name.trim();
                                    if (!projects.includes(trimmed)) {
                                        setProjects([...projects, trimmed]);
                                    } else {
                                        alert("That project already exists!");
                                    }
                                }
                            }}
                            className="w-full flex items-center gap-3.5 p-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-left transition-all active:scale-98"
                        >
                            <div className="w-8.5 h-8.5 rounded-lg bg-gray-200 text-gray-700 flex items-center justify-center shrink-0">
                                <Briefcase className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h4 className="font-extrabold text-gray-750 text-xs leading-tight">💼 Register Job / Project</h4>
                                <p className="text-[10px] text-gray-500 mt-0.5 leading-normal">
                                    Specify a new job address or residential address.
                                </p>
                            </div>
                        </button>
                    </div>
                </div>

                {/* INCIDENT LOGGER MODAL PORTAL */}
                {isAiRecorderOpen && (
                    <div className="absolute inset-x-0 bottom-0 w-full max-w-md mx-auto h-[580px] bg-white rounded-t-[30px] shadow-[0_-15px_40px_rgba(0,0,0,0.15)] border-t border-gray-200 z-50 flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
                        
                        <div className="px-5 pt-4 pb-3 border-b border-gray-200 flex justify-between items-center bg-white">
                            <div className="flex items-center gap-2">
                                <AlertCircle className="w-5 h-5 text-gray-800" />
                                <h3 className="text-base font-bold text-gray-900">Incident Logger</h3>
                            </div>
                            <button 
                                onClick={() => {
                                    cancelRecording();
                                    setIsAiRecorderOpen(false);
                                }}
                                className="w-7 h-7 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-900 flex items-center justify-center transition-all"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Mode Toggles */}
                        <div className="px-5 pt-4 pb-2">
                            <div className="bg-white border border-gray-200 p-1 rounded-lg flex items-center gap-1 mx-auto max-w-xs">
                                <button className="flex-1 bg-blue-100 text-blue-800 font-medium px-3 py-1.5 rounded-md text-sm transition-colors cursor-pointer">
                                    AI Interview
                                </button>
                                <button className="flex-1 text-gray-500 hover:text-gray-900 px-3 py-1.5 text-sm transition-colors cursor-pointer">
                                    Manual Form
                                </button>
                            </div>
                        </div>

                        {recordingState === 'idle' && (
                            <div className="flex-1 flex flex-col justify-between px-5 pb-5 overflow-y-auto">
                                <div className="text-center pt-2">
                                    <div className="w-16 h-16 rounded-full bg-blue-50 border-4 border-blue-100 flex items-center justify-center mx-auto mb-3.5 hover:scale-105 transition-transform shadow-sm">
                                        <Mic className="w-7 h-7 text-blue-600" />
                                    </div>
                                    <h4 className="font-extrabold text-gray-800 text-sm mb-1">Describe Incident Audio</h4>
                                    <p className="text-xs text-gray-500 leading-relaxed max-w-[280px] mx-auto">
                                        Speak clearly about the incident. E.g., "Water leak on 3rd floor causing safety hazard and wall damage."
                                    </p>
                                </div>

                                <div className="space-y-3 pt-4">
                                    {recordingError && (
                                        <div className="p-2.5 bg-red-50 text-red-800 rounded-xl border border-red-200 flex gap-2 items-start">
                                            <AlertCircle className="w-4 h-4 text-red-650 shrink-0 mt-0.5" />
                                            <p className="text-[10px] leading-normal font-bold">{recordingError}</p>
                                        </div>
                                    )}

                                    <button 
                                        onClick={startRecording}
                                        className="w-full bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-semibold text-sm py-3 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all animate-pulse"
                                    >
                                        <Mic className="w-4 h-4" /> Start AI Interview
                                    </button>

                                    {/* Typed Fallback section */}
                                    <div className="border-t border-gray-200 pt-3">
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                                            Or Type Incident Log
                                        </label>
                                        <textarea
                                            value={manualInput}
                                            onChange={(e) => setManualInput(e.target.value)}
                                            placeholder="Example: Broken pipe near the main entrance..."
                                            className="w-full h-20 p-3 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400 resize-none bg-gray-50"
                                        />
                                        <div className="flex gap-2 mt-2 w-full">
                                            <button 
                                                disabled={!manualInput.trim()}
                                                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold border border-gray-300 px-4 py-2.5 rounded-md disabled:opacity-40 text-sm"
                                            >
                                                Save Log
                                            </button>
                                            <button 
                                                onClick={processTypedNotes}
                                                disabled={!manualInput.trim()}
                                                className="flex-1 bg-blue-900 hover:bg-blue-800 text-white font-semibold px-4 py-2.5 rounded-md flex items-center justify-center gap-2 disabled:opacity-40 text-sm shadow-sm"
                                            >
                                                <Sparkles className="w-4 h-4 text-purple-300" /> Refine with AI
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {recordingState === 'recording' && (
                            <div className="flex-1 flex flex-col justify-between items-center p-5 bg-gray-50/50">
                                <div className="text-center pt-8 flex-1 flex flex-col justify-center">
                                    <div className="relative mb-5 mx-auto w-16 h-16">
                                        <div className="absolute inset-0 rounded-full bg-[#2563eb]/20 animate-ping" />
                                        <div className="w-16 h-16 rounded-full bg-[#2563eb] text-white flex items-center justify-center relative shadow-lg">
                                            <Mic className="w-7 h-7" />
                                        </div>
                                    </div>
                                    
                                    <h4 className="font-extrabold text-gray-800 text-xs animate-pulse">Recording Worksite Audio...</h4>
                                    
                                    {/* Virtual speech sound wave visuals */}
                                    <div className="flex gap-1 justify-center items-center h-6 mt-3">
                                        <span className="w-1 h-3 bg-blue-500 rounded-full animate-pulse" />
                                        <span className="w-1 h-5 bg-[#2563eb] rounded-full animate-pulse" />
                                        <span className="w-1 h-4 bg-blue-600 rounded-full animate-pulse" />
                                        <span className="w-1 h-6 bg-[#2563eb] rounded-full animate-pulse" />
                                        <span className="w-1 h-3 bg-blue-500 rounded-full animate-pulse" />
                                    </div>

                                    <p className="text-lg font-black text-gray-800 mt-4 font-mono">
                                        {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}
                                    </p>
                                    
                                    <p className="text-[9px] text-gray-400 mt-1 max-w-[180px] mx-auto italic">
                                        "Speak checklist details in loud, clear, descriptive sentences."
                                    </p>
                                </div>

                                <div className="w-full flex gap-3">
                                    <button 
                                        onClick={cancelRecording}
                                        className="flex-1 py-2.5 bg-gray-200 hover:bg-gray-300 rounded-lg text-xs font-extrabold text-gray-600 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        onClick={stopRecordingAndProcess}
                                        className="flex-[2] py-2.5 bg-red-650 hover:bg-red-700 rounded-lg text-xs font-bold text-white flex justify-center items-center gap-1 shadow-md active:scale-98 transition-all"
                                    >
                                        <StopCircle className="w-4 h-4 fill-white" /> Stop & Process Tasks
                                    </button>
                                </div>
                            </div>
                        )}

                        {recordingState === 'processing' && (
                            <div className="flex-1 flex flex-col justify-center items-center p-5 text-center">
                                <div className="mb-4 relative">
                                    <div className="absolute inset-0 rounded-full bg-blue-400/20 animate-ping" />
                                    <Loader2 className="w-12 h-12 text-[#2563eb] animate-spin" />
                                </div>
                                <h4 className="font-extrabold text-[#2563eb] text-xs animate-pulse mb-1">
                                    Gemini AI is analyzing worksite speech...
                                </h4>
                                <p className="text-[10px] text-gray-400 max-w-[220px] leading-relaxed">
                                    Resolving voice logs, sorting priority checklists, categorizing trades and drafting action items...
                                </p>
                            </div>
                        )}

                        {recordingState === 'review' && (
                            <div className="flex-1 flex flex-col justify-between p-5 overflow-hidden bg-gray-50/50">
                                <div className="overflow-y-auto pr-0.5 flex-1 mb-4">
                                    <div className="mb-3 bg-blue-50/50 p-2.5 rounded-xl border border-blue-100 flex gap-2 items-start">
                                        <Sparkles className="w-4 h-4 text-[#2563eb] shrink-0 mt-0.5" />
                                        <div>
                                            <h5 className="font-bold text-blue-950 text-[11px]">AI Extraction Complete</h5>
                                            <p className="text-[9px] text-blue-800 mt-0.5">
                                                Review checklist drafts, choose a jobsite and check items you want to apply.
                                            </p>
                                        </div>
                                    </div>

                                    {/* Project Select mapping */}
                                    <div className="mb-3">
                                        <label className="block text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">
                                            Assign newly generated tasks to active project:
                                        </label>
                                        <select
                                            value={selectedReviewProject}
                                            onChange={(e) => setSelectedReviewProject(e.target.value)}
                                            className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-700 outline-none"
                                        >
                                            {projects.map((p, idx) => (
                                                <option key={idx} value={p}>
                                                    💼 {p}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <label className="block text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">
                                        Extracted Tasks ({checkedReviewIndexes.length}/{aiResults.length})
                                    </label>

                                    {aiResults.length > 0 ? (
                                        <div className="space-y-2">
                                            {aiResults.map((item, idx) => {
                                                const isChecked = checkedReviewIndexes.includes(idx);
                                                return (
                                                    <div 
                                                        key={idx} 
                                                        className={`flex items-start gap-2.5 p-2.5 bg-white border rounded-xl transition-all ${isChecked ? 'border-blue-300' : 'border-gray-200 opacity-60'}`}
                                                    >
                                                        <button 
                                                            onClick={() => {
                                                                if (isChecked) {
                                                                    setCheckedReviewIndexes(checkedReviewIndexes.filter(i => i !== idx));
                                                                } else {
                                                                    setCheckedReviewIndexes([...checkedReviewIndexes, idx]);
                                                                }
                                                            }}
                                                            className="mt-0.5 shrink-0"
                                                        >
                                                            {isChecked ? (
                                                                <CheckCircle2 className="w-4.5 h-4.5 text-[#2563eb] fill-blue-50" />
                                                            ) : (
                                                                <div className="w-4.5 h-4.5 rounded-full border-2 border-gray-300" />
                                                            )}
                                                        </button>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-[11px] font-bold text-gray-700 leading-normal">{item.title}</p>
                                                            <div className="flex gap-1 items-center mt-1">
                                                                {item.category && (
                                                                    <span className="text-[8px] font-black text-gray-400 uppercase bg-gray-100 px-1 py-0.5 rounded">
                                                                        {item.category}
                                                                    </span>
                                                                )}
                                                                <span className={`text-[8px] font-bold uppercase px-1 py-0.5 rounded ${
                                                                    item.priority === 'high' 
                                                                        ? 'bg-red-50 text-red-655 font-black' 
                                                                        : item.priority === 'medium' 
                                                                        ? 'bg-amber-50 text-amber-653 font-black' 
                                                                        : 'bg-blue-50 text-blue-653'
                                                                }`}>
                                                                    {item.priority}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <p className="text-gray-400 italic text-xs">No tasks detected.</p>
                                    )}
                                </div>

                                <div className="flex gap-3 pt-2 border-t border-gray-100 bg-white shrink-0">
                                    <button 
                                        onClick={() => setRecordingState('idle')}
                                        className="flex-1 py-2 bg-gray-150 hover:bg-gray-200 rounded-lg text-xs font-bold text-gray-600 transition-colors"
                                    >
                                        Re-record
                                    </button>
                                    <button 
                                        onClick={applyAiTasks}
                                        disabled={checkedReviewIndexes.length === 0}
                                        className="flex-[2] py-2 bg-[#2563eb] hover:bg-blue-600 rounded-lg text-xs font-black text-white shadow-md transition-all active:scale-98 disabled:opacity-40"
                                    >
                                        Apply Selected ({checkedReviewIndexes.length})
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* MANUAL QUICK NEW TASK POPUP OVERLAY */}
                {isNewTaskPopupOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div 
                            onClick={() => setIsNewTaskPopupOpen(false)} 
                            className="absolute inset-0 bg-gray-900/40 backdrop-blur-[1px]" 
                        />
                        <div className="relative bg-white w-full max-w-sm rounded-2xl shadow-xl border border-gray-105 p-5 z-10 animate-in fade-in zoom-in-95 duration-200">
                            <div className="flex justify-between items-center mb-3.5">
                                <h3 className="font-extrabold text-gray-800 text-xs">Add Checklist Item</h3>
                                <button 
                                    onClick={() => setIsNewTaskPopupOpen(false)}
                                    className="w-5.5 h-5.5 rounded-full bg-gray-150 text-gray-400 flex items-center justify-center text-xs"
                                >
                                    ✕
                                </button>
                            </div>

                            <form onSubmit={handleCreateQuickTask} className="space-y-3">
                                <div>
                                    <label className="block text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">
                                        Checklist Title
                                    </label>
                                    <input 
                                        type="text"
                                        required
                                        value={quickTaskTitle}
                                        onChange={(e) => setQuickTaskTitle(e.target.value)}
                                        placeholder="E.g., Install secondary drywall panels..."
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 outline-none focus:bg-white focus:ring-2 focus:ring-[#2563eb] transition-all"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-2.5">
                                    <div>
                                        <label className="block text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">
                                            Worksite Project
                                        </label>
                                        <select
                                            value={selectedProject}
                                            onChange={(e) => setSelectedProject(e.target.value)}
                                            className="w-full px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-[10px] font-bold text-gray-700 outline-none"
                                        >
                                            {projects.map((p, idx) => (
                                                <option key={idx} value={p}>
                                                    {p}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">
                                            Priority
                                        </label>
                                        <select
                                            value={quickTaskPriority}
                                            onChange={(e) => setQuickTaskPriority(e.target.value as any)}
                                            className="w-full px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-[10px] font-bold text-gray-700 outline-none"
                                        >
                                            <option value="low">⚡ low</option>
                                            <option value="medium">⚡ medium</option>
                                            <option value="high">⚡ high</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">
                                        Classification Tag
                                    </label>
                                    <input 
                                        type="text"
                                        value={quickTaskCategory}
                                        onChange={(e) => setQuickTaskCategory(e.target.value)}
                                        placeholder="E.g., Plumbing, Electrical, Drywall"
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-205 rounded-lg text-xs font-bold text-gray-700 outline-none"
                                    />
                                </div>

                                <button 
                                    type="submit"
                                    className="w-full py-2.5 bg-[#2563eb] hover:bg-blue-600 text-white font-extrabold text-xs rounded-xl shadow-md transition-all active:scale-98"
                                >
                                    Add Task to Checklist
                                </button>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default App;

