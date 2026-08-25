
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { UserProfile, TimeEntry, Coordinates, Task, PayReport } from './types';
import ProfileSetup from './components/ProfileSetup';
import TimeLog from './components/TimeLog';
import { getCurrentPosition } from './services/locationService';
import { generatePayReport } from './services/pdfService';
import { AdminDashboard } from './components/AdminDashboard';
import Messaging from './components/Messaging';
import BottomNav from './components/BottomNav';
import Sidebar from './components/Sidebar';
import ShiftReminderBanner from './components/ShiftReminderBanner';
import { checkAndSendShiftReminders, check8HourWarningAndAutoClockOut } from './services/reminderService';
import { chatService } from './services/chatService';
import { Clock, FileText, DollarSign, LayoutGrid, User, CalendarDays, Square, Trash2, Plus, CheckCircle2, Wallet, LogOut, ShieldAlert, MessageSquare, Mic, MicOff, Sparkles, Loader2, Briefcase, Tag, AlertCircle, X, Check, StopCircle, ChevronRight, Camera, Search, Download, Edit3, Filter } from 'lucide-react';
import { getDirectImageUrl } from './photoUtils';

export const getEntryDuration = (entry: TimeEntry, fallbackTimeMs: number) => {
    const inTime = new Date(entry.clockIn).getTime();
    const outTime = entry.clockOut ? new Date(entry.clockOut).getTime() : fallbackTimeMs;
    let breakTimeMs = 0;
    if (entry.breaks) {
        entry.breaks.forEach(b => {
            const bStart = new Date(b.start).getTime();
            const bEnd = b.end ? new Date(b.end).getTime() : fallbackTimeMs;
            breakTimeMs += (bEnd - bStart);
        });
    }
    return Math.max(0, ((outTime - inTime) - breakTimeMs) / (1000 * 60 * 60));
};

const BreakTimer: React.FC<{ startTime: string }> = ({ startTime }) => {
    const [elapsed, setElapsed] = useState('00:00:00');

    useEffect(() => {
        const interval = setInterval(() => {
            const start = new Date(startTime).getTime();
            const diffMs = Date.now() - start;
            if (diffMs < 0) return;
            
            const hours = Math.floor(diffMs / (1000 * 60 * 60));
            const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
            
            setElapsed([
                hours.toString().padStart(2, '0'),
                minutes.toString().padStart(2, '0'),
                seconds.toString().padStart(2, '0')
            ].join(':'));
        }, 1000);
        return () => clearInterval(interval);
    }, [startTime]);

    return <span>{elapsed}</span>;
};

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
        if (profile) {
            localStorage.removeItem(`geotime_entries_${profile.id}`);
        }
        localStorage.removeItem('currentUser');
        setProfile(null);
        setTimeEntries([]);
        chatService.clearCache();
    };

    const [timeEntries, setTimeEntries] = useState<TimeEntry[]>(() => {
        try {
            const savedUser = localStorage.getItem('currentUser');
            if (savedUser) {
                const u = JSON.parse(savedUser);
                if (u && u.id) {
                    const savedEntries = localStorage.getItem(`geotime_entries_${u.id}`);
                    return savedEntries ? JSON.parse(savedEntries) : [];
                }
            }
        } catch {}
        return [];
    });

    useEffect(() => {
        if (profile) {
            localStorage.setItem(`geotime_entries_${profile.id}`, JSON.stringify(timeEntries));
        }
    }, [timeEntries, profile]);

    const [projects, setProjects] = useState<string[]>(['General']);

    // Pay Reports persistent state
    const [payReports, setPayReports] = useState<PayReport[]>(() => {
        try {
            const savedUser = localStorage.getItem('currentUser');
            if (savedUser) {
                const u = JSON.parse(savedUser);
                if (u && u.id) {
                    const savedReports = localStorage.getItem(`geotime_pay_reports_${u.id}`);
                    return savedReports ? JSON.parse(savedReports) : [];
                }
            }
        } catch {}
        return [];
    });

    useEffect(() => {
        if (profile) {
            localStorage.setItem(`geotime_pay_reports_${profile.id}`, JSON.stringify(payReports));
        }
    }, [payReports, profile]);

    // Pay Log UI sub-tab & modal states
    const [paylogSubTab, setPaylogSubTab] = useState<'entries' | 'reports'>('entries');
    const [selectedReportForEdit, setSelectedReportForEdit] = useState<PayReport | null>(null);
    const [payReportNotification, setPayReportNotification] = useState<string | null>(null);
    const [payReportFilterStatus, setPayReportFilterStatus] = useState<string>('all');
    const [payReportSearchQuery, setPayReportSearchQuery] = useState<string>('');
    
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
    
    // Break states
    const [breakStartTime, setBreakStartTime] = useState<string | null>(() => localStorage.getItem('geotime_break_start'));
    const [breakProject, setBreakProject] = useState<string | null>(() => localStorage.getItem('geotime_break_proj'));

    useEffect(() => {
        if (breakStartTime) {
            localStorage.setItem('geotime_break_start', breakStartTime);
        } else {
            localStorage.removeItem('geotime_break_start');
        }
    }, [breakStartTime]);

    useEffect(() => {
        if (breakProject) {
            localStorage.setItem('geotime_break_proj', breakProject);
        } else {
            localStorage.removeItem('geotime_break_proj');
        }
    }, [breakProject]);
    
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
    const [autoEditEntryId, setAutoEditEntryId] = useState<string | null>(null);
    const [isNewTaskPopupOpen, setIsNewTaskPopupOpen] = useState(false);
    const [quickTaskTitle, setQuickTaskTitle] = useState('');
    const [quickTaskPriority, setQuickTaskPriority] = useState<'high' | 'medium' | 'low'>('medium');
    const [quickTaskCategory, setQuickTaskCategory] = useState('General');
    const [quickTaskPhotos, setQuickTaskPhotos] = useState<string[]>([]);
    const [isUploadingTaskPhoto, setIsUploadingTaskPhoto] = useState(false);
    const taskFileInputRef = useRef<HTMLInputElement>(null);

    const handleUploadTaskPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploadingTaskPhoto(true);
        try {
            const { compressAndEncodeBase64 } = await import('./photoUtils');
            const base64 = await compressAndEncodeBase64(file, 800);
            const res = await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    payload: {
                        action: 'UPLOAD_PHOTO',
                        payload: { base64, mimeType: file.type, filename: file.name }
                    }
                })
            });
            const data = await res.json();
            if (data.success && data.data?.url) {
                setQuickTaskPhotos(prev => [...prev, data.data.url]);
            }
        } catch (err: any) {
            console.error('Task photo upload failed:', err);
        } finally {
            setIsUploadingTaskPhoto(false);
            if (taskFileInputRef.current) taskFileInputRef.current.value = '';
        }
    };

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

    const handleSaveManualTask = () => {
        const text = manualInput.trim();
        if (!text) return;

        const newTask: Task = {
            id: 'task_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            projectId: selectedReviewProject || 'General',
            title: text,
            completed: false,
            priority: 'medium',
            category: 'General',
            createdAt: new Date().toISOString()
        };

        setTasks(prev => [...prev, newTask]);
        setManualInput('');
        setIsAiRecorderOpen(false);
        setSelectedTaskProjectFilter(selectedReviewProject || 'General');
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
            createdAt: new Date().toISOString(),
            photos: quickTaskPhotos
        };

        setTasks(prev => [...prev, newTask]);
        setQuickTaskTitle('');
        setQuickTaskPhotos([]);
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
    const [paylogDateRange, setPaylogDateRange] = useState<'all' | 'this_week' | 'last_week' | 'this_month' | 'custom'>('this_week');
    const [paylogCustomStartDate, setPaylogCustomStartDate] = useState<string>('');
    const [paylogCustomEndDate, setPaylogCustomEndDate] = useState<string>('');

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

            // Load user time entries & pay reports
            fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    payload: { action: 'FETCH_USER_DATA', payload: { profileId: profile.id } }
                })
            })
            .then(res => res.json())
            .then(data => {
                if (data && data.success && data.data) {
                    if (Array.isArray(data.data.entries)) {
                        const remoteEntries: TimeEntry[] = data.data.entries;
                        const nowMs = Date.now();

                        setTimeEntries(prev => {
                            const map = new Map<string, TimeEntry>();
                            // Populate from remote (server is authoritative for closed shifts)
                            remoteEntries.forEach(e => {
                                // Auto clock-out any dangling open shifts older than 9 hours
                                if (!e.clockOut && !e.isExpense && e.clockIn) {
                                    const shiftDurationHours = (nowMs - new Date(e.clockIn).getTime()) / (1000 * 60 * 60);
                                    if (shiftDurationHours >= 9) {
                                        const autoOutTime = new Date(new Date(e.clockIn).getTime() + 9 * 3600 * 1000).toISOString();
                                        const autoNote = (e.notes ? e.notes + '\n' : '') + '[Auto Clock-Out: 9h limit reached]';
                                        e = { ...e, clockOut: autoOutTime, notes: autoNote };
                                    }
                                }
                                map.set(e.id, e);
                            });

                            // Preserve any brand new local unsynced entries that haven't hit server yet
                            prev.forEach(e => {
                                const existing = map.get(e.id);
                                if (!existing) {
                                    // Check if stale active local entry exceeds 9 hours
                                    if (!e.clockOut && !e.isExpense && e.clockIn) {
                                        const shiftDurationHours = (nowMs - new Date(e.clockIn).getTime()) / (1000 * 60 * 60);
                                        if (shiftDurationHours >= 9) {
                                            const autoOutTime = new Date(new Date(e.clockIn).getTime() + 9 * 3600 * 1000).toISOString();
                                            const autoNote = (e.notes ? e.notes + '\n' : '') + '[Auto Clock-Out: 9h limit reached]';
                                            e = { ...e, clockOut: autoOutTime, notes: autoNote };
                                        }
                                    }
                                    map.set(e.id, e);
                                }
                            });

                            return Array.from(map.values()).sort((a, b) => 
                                new Date(a.clockIn).getTime() - new Date(b.clockIn).getTime()
                            );
                        });
                    }
                    if (Array.isArray(data.data.payReports)) {
                        setPayReports(data.data.payReports);
                    }
                }
            })
            .catch(e => console.error('Error fetching user data:', e));
        }
    }, [profile]);

    const handleSavePayReport = async (report: PayReport) => {
        setPayReports(prev => {
            const idx = prev.findIndex(r => r.id === report.id);
            if (idx >= 0) {
                const updated = [...prev];
                updated[idx] = report;
                return updated;
            }
            return [report, ...prev];
        });

        try {
            await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    payload: {
                        action: 'SAVE_PAY_REPORT',
                        payload: { report }
                    }
                })
            });
        } catch (err) {
            console.error('Error saving pay report to Google Apps Script:', err);
        }
    };

    const handleDeletePayReport = async (reportId: string) => {
        if (!confirm('Are you sure you want to delete this saved pay report?')) return;
        setPayReports(prev => prev.filter(r => r.id !== reportId));
        if (selectedReportForEdit?.id === reportId) {
            setSelectedReportForEdit(null);
        }

        try {
            await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    payload: {
                        action: 'DELETE_PAY_REPORT',
                        payload: { reportId }
                    }
                })
            });
        } catch (err) {
            console.error('Error deleting pay report from Google Apps Script:', err);
        }
    };

    const handleExportAndSavePayReport = async () => {
        if (filteredPaylogEntries.length === 0 || !profile) return;

        const reportId = `REP-${Date.now().toString(36).toUpperCase()}`;
        const newReport: PayReport = {
            id: reportId,
            profileId: profile.id || '',
            employeeName: profile.name,
            hourlyWage: profile.hourlyWage,
            periodLabel: paylogPeriodLabel,
            generatedAt: new Date().toISOString(),
            startDate: paylogCustomStartDate || undefined,
            endDate: paylogCustomEndDate || undefined,
            projectFilter: paylogFilterProject,
            totalHours: paylogTotals.hours,
            totalGrossPay: paylogTotals.earnings,
            status: 'approved',
            notes: `Pay report exported for ${paylogPeriodLabel} (${filteredPaylogEntries.length} entries)`,
            timeEntries: filteredPaylogEntries
        };

        // 1. Trigger client PDF download
        generatePayReport(profile, filteredPaylogEntries, paylogPeriodLabel, newReport);

        // 2. Persist in Google Apps Script database & state
        await handleSavePayReport(newReport);

        // 3. User feedback
        setPayReportNotification('Pay report generated & securely saved to Google Apps Script!');
        setTimeout(() => setPayReportNotification(null), 4500);
    };


    // Update 'now' every minute so active clock-in time increments
    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(interval);
    }, []);

    const activeEntry = useMemo(() => {
        return timeEntries.find(e => !e.isExpense && !e.clockOut);
    }, [timeEntries]);

    const isClockedIn = !!activeEntry;

    // Automatic Clock-Out Handler at 9-Hour Limit
    const handleAutoClockOut = (active: TimeEntry) => {
        if (!active || active.clockOut) return;

        const inTime = new Date(active.clockIn).getTime();
        const autoOutTime = new Date(inTime + 9 * 3600 * 1000).toISOString();
        const autoNote = (active.notes ? active.notes + '\n' : '') + '[Auto Clock-Out: 9h limit reached]';

        const updatedEntry: TimeEntry = {
            ...active,
            clockOut: autoOutTime,
            notes: autoNote
        };

        // Update local state immediately
        setTimeEntries(prev => prev.map(e => e.id === active.id ? updatedEntry : e));

        // Immediately notify backend via atomic clock-out endpoint
        if (profile) {
            fetch('/api/clock-out', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: active.id,
                    entryId: active.id,
                    profileId: profile.id,
                    clockOut: autoOutTime,
                    autoClockOut: true,
                    notes: autoNote
                })
            }).catch(e => console.error('Auto clock-out API error:', e));
        }
    };

    // Automated 8:30 AM (Clock In) / 5:00 PM (Clock Out) Reminders, 8-Hour Warning & 9-Hour Auto Clock-Out
    useEffect(() => {
        // Initial evaluation
        checkAndSendShiftReminders(isClockedIn);
        if (activeEntry) {
            check8HourWarningAndAutoClockOut(activeEntry, handleAutoClockOut);
        }

        // Check every 30 seconds
        const reminderInterval = setInterval(() => {
            checkAndSendShiftReminders(isClockedIn);
            if (activeEntry) {
                check8HourWarningAndAutoClockOut(activeEntry, handleAutoClockOut);
            }
        }, 30000);

        // Also check on tab visibility change (e.g. unlocking phone or switching back to app)
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                checkAndSendShiftReminders(isClockedIn);
                if (activeEntry) {
                    check8HourWarningAndAutoClockOut(activeEntry, handleAutoClockOut);
                }
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearInterval(reminderInterval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [isClockedIn, activeEntry, profile]);

    const isOnBreak = !!breakStartTime;

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
        } else if (paylogDateRange === 'custom') {
            if (paylogCustomStartDate) {
                const start = new Date(paylogCustomStartDate + 'T00:00:00');
                filtered = filtered.filter(e => new Date(e.clockIn) >= start);
            }
            if (paylogCustomEndDate) {
                const end = new Date(paylogCustomEndDate + 'T23:59:59.999');
                filtered = filtered.filter(e => new Date(e.clockIn) <= end);
            }
        }
        
        return filtered;
    }, [timeEntries, paylogFilterProject, paylogDateRange, paylogCustomStartDate, paylogCustomEndDate, now]);

    const paylogTotals = useMemo(() => {
        let hours = 0;
        let expenses = 0;
        filteredPaylogEntries.forEach(entry => {
            if (entry.isExpense) {
                expenses += (entry.expenseAmount || 0);
            } else {
                hours += getEntryDuration(entry, now.getTime());
            }
        });
        return {
            hours,
            expenses,
            earnings: (hours * (profile?.hourlyWage || 0)) + expenses
        };
    }, [filteredPaylogEntries, profile, now]);

    const paylogPeriodLabel = useMemo(() => {
        if (paylogDateRange === 'this_week') return 'This Week';
        if (paylogDateRange === 'last_week') return 'Last Week';
        if (paylogDateRange === 'this_month') return 'This Month';
        if (paylogDateRange === 'all') return 'All Time';
        if (paylogDateRange === 'custom') {
            const startStr = paylogCustomStartDate ? new Date(paylogCustomStartDate + 'T00:00:00').toLocaleDateString() : 'Beginning';
            const endStr = paylogCustomEndDate ? new Date(paylogCustomEndDate + 'T00:00:00').toLocaleDateString() : 'Present';
            return `${startStr} - ${endStr}`;
        }
        return 'Active Logs';
    }, [paylogDateRange, paylogCustomStartDate, paylogCustomEndDate]);

    // Compute weekly hours
    const { weeklyHours, weeklyEarnings } = useMemo(() => {
        const startOfWeek = new Date();
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
        startOfWeek.setHours(0,0,0,0);
        let hours = 0;
        let expenses = 0;
        timeEntries.forEach(entry => {
            const inTime = new Date(entry.clockIn);
            if (inTime >= startOfWeek) {
                if (entry.isExpense) {
                    expenses += (entry.expenseAmount || 0);
                } else {
                    hours += getEntryDuration(entry, now.getTime());
                }
            }
        });
        
        return {
            weeklyHours: hours,
            weeklyEarnings: (hours * (profile?.hourlyWage || 0)) + expenses
        };
    }, [timeEntries, now, profile]);

    const handleBreakToggle = async () => {
        if (!isClockedIn && !isOnBreak) return;
        setIsLoading(true);
        try {
            let location: Coordinates | undefined = undefined;
            try {
                location = await getCurrentPosition();
            } catch (locErr) {
                console.error('Location error during break toggle', locErr);
            }
            
            if (isOnBreak) {
                // End break (acts as clock in)
                const proj = breakProject || 'General';
                setBreakStartTime(null);
                setBreakProject(null);
                
                const newEntry: TimeEntry = {
                    id: new Date().toISOString(),
                    projectName: proj,
                    clockIn: new Date().toISOString(),
                    clockInLocation: location,
                };
                setTimeEntries([...timeEntries, newEntry]);
            } else {
                // Take break (acts as clock out)
                const active = timeEntries.find(e => !e.isExpense && !e.clockOut) || timeEntries[timeEntries.length - 1];
                if (active) {
                    setBreakStartTime(new Date().toISOString());
                    setBreakProject(active.projectName || 'General');

                    const updatedEntry: TimeEntry = {
                        ...active,
                        clockOut: new Date().toISOString(),
                        clockOutLocation: location,
                    };
                    setTimeEntries(prev => prev.map(e => e.id === active.id ? updatedEntry : e));
                }
            }
        } catch(err) {
            console.error('Break toggle error', err);
        } finally {
            setIsLoading(false);
        }
    };

    const [clockNote, setClockNote] = useState('');

    const handleClockToggle = async () => {
        setIsLoading(true);
        try {
            let location: Coordinates | undefined;
            try {
                location = await getCurrentPosition();
            } catch (locErr) {
                console.error('Location error during clock toggle:', locErr);
            }

            const active = timeEntries.find(e => !e.isExpense && !e.clockOut);

            if (active) {
                // Clocking out
                const noteText = clockNote.trim();
                const combinedNotes = noteText 
                    ? (active.notes ? `${active.notes}\n${noteText}` : noteText) 
                    : active.notes;
                const clockOutTime = new Date().toISOString();
                const updatedEntry: TimeEntry = {
                    ...active,
                    clockOut: clockOutTime,
                    clockOutLocation: location || active.clockOutLocation,
                    notes: combinedNotes
                };

                // Update local state first for instant responsiveness
                setTimeEntries(prev => prev.map(e => e.id === active.id ? updatedEntry : e));
                setClockNote('');

                // Trigger direct atomic clock-out call
                if (profile) {
                    fetch('/api/clock-out', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            id: active.id,
                            entryId: active.id,
                            profileId: profile.id,
                            clockOut: clockOutTime,
                            clockOutLocation: location || active.clockOutLocation,
                            notes: combinedNotes
                        })
                    }).catch(err => console.error('Atomic clock-out API error:', err));
                }
            } else {
                // Clocking in
                if (isOnBreak) {
                    setBreakStartTime(null);
                    setBreakProject(null);
                }
                const clockInTime = new Date().toISOString();
                const newEntryId = new Date().toISOString();
                const newEntry: TimeEntry = {
                    id: newEntryId,
                    projectName: selectedProject || 'General',
                    clockIn: clockInTime,
                    clockInLocation: location,
                    notes: clockNote.trim() || undefined
                };

                // Update local state first for instant responsiveness
                setTimeEntries(prev => [...prev, newEntry]);
                setClockNote('');

                // Trigger direct atomic clock-in call
                if (profile) {
                    fetch('/api/clock-in', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            id: newEntryId,
                            entryId: newEntryId,
                            profileId: profile.id,
                            projectName: selectedProject || 'General',
                            clockIn: clockInTime,
                            clockInLocation: location,
                            notes: clockNote.trim() || undefined
                        })
                    }).catch(err => console.error('Atomic clock-in API error:', err));
                }
            }
        } catch (err: any) {
            console.error('Clock toggle error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdateTimeEntry = (updated: TimeEntry) => {
        setTimeEntries(prev => prev.map(e => e.id === updated.id ? updated : e));
    };

    const handleDeleteTimeEntry = (id: string) => {
        setTimeEntries(prev => prev.filter(e => e.id !== id));
    };

    const handleAddTimeEntry = (newEntry: TimeEntry) => {
        setTimeEntries(prev => [...prev, newEntry]);
    };

    const handleAddProject = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = newProjectName.trim();
        if (!trimmed) return;
        if (projects.includes(trimmed)) {
            alert('Project / Job Site already exists.');
            return;
        }

        setIsLoading(true);
        try {
            const res = await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    payload: {
                        action: 'ADD_PROJECT',
                        payload: { name: trimmed }
                    }
                })
            });
            const data = await res.json();
            if (data && data.success) {
                setProjects([...projects, trimmed]);
                setNewProjectName('');
            } else {
                alert(data?.error || 'Failed to sync project to Google Sheets.');
            }
        } catch (err: any) {
            console.error('Error adding project:', err);
            alert('Network error when syncing project to Google Sheets.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteProject = async (proj: string) => {
        if (proj === 'General') {
            alert('The "General" project cannot be deleted.');
            return;
        }

        if (window.confirm(`Delete project "${proj}"? Past time entries will keep this name.`)) {
            setIsLoading(true);
            try {
                const res = await fetch('/api/sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        payload: {
                            action: 'DELETE_PROJECT',
                            payload: { name: proj }
                        }
                    })
                });
                const data = await res.json();
                if (data && data.success) {
                    setProjects(projects.filter(p => p !== proj));
                } else {
                    alert('Failed to delete project from Google Sheets.');
                }
            } catch (err: any) {
                console.error('Error deleting project:', err);
                alert('Network error when deleting project from Google Sheets.');
            } finally {
                setIsLoading(false);
            }
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
                onLogout={handleLogout}
                unreadChatCount={unreadChatCount}
            />
            <div className="w-full md:ml-64 max-w-5xl lg:max-w-7xl mx-auto relative flex flex-col h-full overflow-hidden">
                
                {/* Global Header */}
                <header className="bg-blue-950 text-white px-5 py-3 flex items-center justify-between shrink-0 z-20 shadow-sm border-b border-blue-900/60">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-700/80 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                            <img src="/pwa-icon.svg" alt="KS Enterprise" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                        <div>
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs font-black text-orange-400">KS</span>
                                <span className="font-bold text-[14px] text-white">{profile.name}</span>
                            </div>
                            <span className="text-slate-400 text-[10px] font-semibold tracking-wider block">KS Enterprise Group</span>
                        </div>
                    </div>
                    <span className="text-blue-300/80 bg-blue-900/60 border border-blue-800/80 px-2 py-0.5 rounded text-[10px] font-extrabold tracking-wider uppercase">ACTIVE</span>
                </header>

                {/* PWA Mobile App Download Assistance Banner */}
                {!isStandalone && showInstallBanner && (
                    <div className="bg-gradient-to-r from-orange-600 via-amber-600 to-blue-700 text-white px-4 py-2.5 shrink-0 flex items-center justify-between z-20 text-[11px] font-bold shadow-md transition-all">
                        <div className="flex items-center gap-1.5 leading-tight">
                            <span className="text-sm">📱</span>
                            <span>
                                {isInstallable ? (
                                    "Save KS Enterprise Group to your home screen for quick offline access!"
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
                               <span className={`font-bold tracking-widest text-sm ${isOnBreak ? 'text-amber-500' : 'text-gray-400/80'}`}>
                                   {isOnBreak ? 'ON BREAK' : (isClockedIn ? 'ON THE CLOCK' : 'READY TO WORK')}
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
                       <div className="mt-2 mb-6 flex flex-col items-center">
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

                           { (isClockedIn || isOnBreak) && (
                               <button 
                                  onClick={handleBreakToggle}
                                  disabled={isLoading}
                                  className={`mt-8 px-8 py-3 rounded-2xl font-extrabold text-sm transition-all shadow-sm flex items-center gap-2 ${
                                     isOnBreak 
                                     ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 ring-2 ring-amber-500/20' 
                                     : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                                  }`}
                               >
                                   {isOnBreak ? (
                                       <>
                                           <Clock className="w-4 h-4 animate-pulse" /> End Break (<BreakTimer startTime={breakStartTime!} />)
                                       </>
                                   ) : (
                                       <>
                                           ☕ Take Break
                                       </>
                                   )}
                               </button>
                           )}
                       </div>

                       {/* Shift Notes Input */}
                       <div className="w-full max-w-[280px] mt-2 mb-2 px-6 text-center z-10">
                           <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 flex justify-center items-center gap-1">
                               <FileText className="w-3 h-3 text-blue-500" /> Shift Note / Memo
                           </label>
                           <input 
                               type="text"
                               placeholder={isClockedIn ? "Add note when clocking out..." : "Optional note for shift start..."}
                               value={clockNote}
                               onChange={(e) => setClockNote(e.target.value)}
                               className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 outline-none focus:ring-2 focus:ring-[#2563eb] focus:bg-white transition-all shadow-sm"
                           />
                       </div>

                       {/* Job Selection Dropdown */}
                       {!isClockedIn && !isOnBreak && (
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
                       { (isClockedIn || isOnBreak) && (
                           <div className="text-center mt-2 mb-4 px-6 z-10">
                               <span className="text-xs font-semibold text-gray-400">Active Job:</span>
                               <div className="mt-1">
                                   <button 
                                       onClick={() => {
                                           const activeProj = timeEntries[timeEntries.length - 1]?.projectName || 'General';
                                           setSelectedTaskProjectFilter(activeProj);
                                           setCurrentTab('tasks');
                                       }}
                                       className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 hover:bg-blue-100 text-[#2563eb] font-bold text-xs rounded-full border border-blue-100 uppercase transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb]"
                                   >
                                       💼 {timeEntries[timeEntries.length - 1]?.projectName || 'General'}
                                       <ChevronRight className="w-3.5 h-3.5 text-[#2563eb]" />
                                   </button>
                               </div>
                           </div>
                       )}
                    </div>

                    {/* Dashboard Cards */}
                    <div className="px-5 mt-8 z-10 flex-1 flex flex-col gap-6">
                        
                        <div className="flex gap-4">
                            {/* This Week Card - Clickable Link */}
                            <button 
                                onClick={() => setCurrentTab('paylog')}
                                className="flex-1 text-left bg-blue-950 rounded-2xl p-5 shadow-lg relative overflow-hidden flex flex-col justify-between cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all group border border-blue-900 focus:outline-none focus:ring-2 focus:ring-[#2563eb]"
                            >
                                <div className="flex items-center justify-between mb-4 w-full">
                                    <div className="flex items-center gap-2 text-gray-300 text-xs font-bold tracking-wide group-hover:text-white transition-colors">
                                        <Clock className="w-4 h-4" />
                                        <span>THIS WEEK</span>
                                    </div>
                                    <div className="bg-gray-700/50 p-2 rounded-xl text-gray-300 group-hover:bg-gray-600/50 group-hover:text-white transition-all">
                                       <FileText className="w-4 h-4" />
                                    </div>
                                </div>
                                <div className="flex items-baseline gap-1 mt-auto">
                                    <span className="text-4xl font-extrabold text-white tracking-tight flex items-center gap-1">
                                        {weeklyHours.toFixed(2)}
                                        <ChevronRight className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity translate-x-[-4px] group-hover:translate-x-0 transition-all duration-250" />
                                    </span>
                                    <span className="text-gray-400 font-medium">hrs</span>
                                </div>
                            </button>

                            {/* Earnings Card - Clickable Link */}
                            <button 
                                onClick={() => setCurrentTab('paylog')}
                                className="flex-1 text-left bg-[#2563eb] rounded-2xl p-5 shadow-lg relative overflow-hidden flex flex-col justify-between cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all group border border-blue-500 focus:outline-none focus:ring-2 focus:ring-[#2563eb]"
                            >
                                <div className="flex items-center justify-between mb-4 w-full">
                                    <div className="flex items-center gap-2 text-blue-100 text-xs font-bold tracking-wide group-hover:text-white transition-colors">
                                        <DollarSign className="w-4 h-4" />
                                        <span>EARNINGS</span>
                                    </div>
                                    <div className="bg-blue-400/30 p-2 rounded-xl text-blue-100 group-hover:bg-blue-400/50 group-hover:text-white transition-all">
                                       <Wallet className="w-4 h-4" />
                                    </div>
                                </div>
                                <div className="flex items-baseline mt-auto">
                                    <span className="text-4xl font-extrabold text-white tracking-tight flex items-center gap-1">
                                        ${weeklyEarnings.toFixed(2)}
                                        <ChevronRight className="w-4 h-4 text-blue-200 opacity-0 group-hover:opacity-100 transition-opacity translate-x-[-4px] group-hover:translate-x-0 transition-all duration-250" />
                                    </span>
                                </div>
                            </button>
                        </div>

                        {/* Shift Reminder PWA Banner */}
                        <ShiftReminderBanner />

                        {/* Recent Activity */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] overflow-hidden">
                            <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
                                <h3 className="font-bold text-gray-800 text-[15px]">Recent Activity</h3>
                                <span className="text-gray-400 text-xs font-medium">Last 7 Days</span>
                            </div>
                            <div className="p-4 flex flex-col justify-center items-center">
                                {timeEntries.length > 0 ? (
                                    <ul className="w-full space-y-1">
                                        {timeEntries.slice(-3).reverse().map((entry, idx) => (
                                            <li 
                                                key={`${entry.id || 'recent'}_${idx}`} 
                                                onClick={() => {
                                                    setCurrentTab('paylog');
                                                    setAutoEditEntryId(entry.id);
                                                }}
                                                className="flex justify-between items-center border-b border-gray-50/50 pb-2.5 pt-2.5 px-3.5 rounded-xl cursor-pointer hover:bg-slate-50 transition-all active:scale-[0.99] group last:border-0"
                                            >
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-sm font-semibold text-gray-700 flex items-center gap-1 group-hover:text-[#2563eb] transition-colors">
                                                        {new Date(entry.clockIn).toLocaleDateString()}
                                                        <ChevronRight className="w-3.5 h-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-[-3px] group-hover:translate-x-0" />
                                                    </span>
                                                    <span className="text-xs text-gray-400 mt-0.5">
                                                        {new Date(entry.clockIn).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - 
                                                        {entry.clockOut ? new Date(entry.clockOut).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ' Now'}
                                                    </span>
                                                    <span className="text-[9px] text-gray-400 font-bold mt-1 uppercase tracking-wide flex items-center gap-1">
                                                        💼 {entry.projectName || 'General'}
                                                    </span>
                                                </div>
                                                <div className="text-right flex flex-col items-end shrink-0 pl-3">
                                                    <span className="text-sm font-extrabold text-gray-800">
                                                        {entry.clockOut 
                                                            ? (getEntryDuration(entry, now.getTime()).toFixed(2) + 'h')
                                                            : <span className="inline-flex items-center text-[8px] font-black bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded uppercase animate-pulse border border-emerald-100">Live</span>}
                                                    </span>
                                                    {entry.clockOut && (
                                                        <span className="text-xs font-bold text-emerald-600 mt-0.5">
                                                            ${(getEntryDuration(entry, now.getTime()) * (profile?.hourlyWage || 0)).toFixed(2)}
                                                        </span>
                                                    )}
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="p-4 text-center">
                                        <p className="text-gray-400 italic text-sm">No time entries recorded yet.</p>
                                    </div>
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
                                                    {t.photos && t.photos.length > 0 && (
                                                        <div className="flex gap-1.5 mt-2 overflow-x-auto pb-1">
                                                            {t.photos.map((url, i) => (
                                                                <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                                                                    <img src={getDirectImageUrl(url)} alt="Task photo" className="w-8 h-8 rounded object-cover border border-gray-200" />
                                                                </a>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            <div className="flex flex-col gap-1 items-center justify-center shrink-0">
                                                <label className="text-gray-300 hover:text-[#2563eb] p-1 rounded-full hover:bg-blue-50 transition-colors cursor-pointer title='Add Photo'">
                                                    <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                                                        const file = e.target.files?.[0];
                                                        if (!file) return;
                                                        try {
                                                            const { compressAndEncodeBase64 } = await import('./photoUtils');
                                                            const base64 = await compressAndEncodeBase64(file, 800);
                                                            const res = await fetch('/api/sync', {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({
                                                                    payload: { action: 'UPLOAD_PHOTO', payload: { base64, mimeType: file.type, filename: file.name } }
                                                                })
                                                            });
                                                            const data = await res.json();
                                                            if (data.success && data.data?.url) {
                                                                setTasks(tasks.map(task => task.id === t.id ? { ...task, photos: [...(task.photos || []), data.data.url] } : task));
                                                            }
                                                        } catch (err) {
                                                            console.error('Task photo upload failed:', err);
                                                        }
                                                    }} />
                                                    <Camera className="w-4 h-4" />
                                                </label>
                                                <button 
                                                    onClick={() => setTasks(tasks.filter(task => task.id !== t.id))}
                                                    className="text-gray-300 hover:text-red-500 p-1 rounded-full hover:bg-red-50 transition-colors shrink-0"
                                                    title="Delete Task"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
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
                        {/* Success Notification Banner */}
                        {payReportNotification && (
                            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl flex items-center justify-between shadow-sm animate-in fade-in duration-300">
                                <div className="flex items-center gap-2.5">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                                    <span className="text-xs font-bold">{payReportNotification}</span>
                                </div>
                                <button onClick={() => setPayReportNotification(null)} className="text-emerald-500 hover:text-emerald-700">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        )}

                        {/* Top Header & Export Action */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-800">Pay Log</h2>
                                <p className="text-xs text-gray-500 mt-0.5">Track live hours & access generated pay reports stored in Google Sheets</p>
                            </div>
                            <button
                                onClick={handleExportAndSavePayReport}
                                disabled={filteredPaylogEntries.length === 0}
                                className="bg-[#2563eb] text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all cursor-pointer"
                            >
                                <Download className="w-4 h-4" />
                                Export & Save Report
                            </button>
                        </div>

                        {/* Sub-navigation Switcher */}
                        <div className="flex bg-gray-100 p-1.5 rounded-2xl border border-gray-200/80">
                            <button
                                onClick={() => setPaylogSubTab('entries')}
                                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                                    paylogSubTab === 'entries'
                                        ? 'bg-white text-gray-900 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                <Clock className="w-3.5 h-3.5" />
                                Active Time Entries ({filteredPaylogEntries.length})
                            </button>
                            <button
                                onClick={() => setPaylogSubTab('reports')}
                                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                                    paylogSubTab === 'reports'
                                        ? 'bg-white text-gray-900 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                <FileText className="w-3.5 h-3.5" />
                                Saved Pay Reports ({payReports.length})
                            </button>
                        </div>

                        {/* MODE 1: ACTIVE TIME ENTRIES */}
                        {paylogSubTab === 'entries' && (
                            <div className="flex flex-col gap-6">
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
                                <div className="flex flex-col gap-3">
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
                                                <option value="custom">Custom Range</option>
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

                                    {paylogDateRange === 'custom' && (
                                        <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3.5 rounded-2xl border border-gray-150 shadow-inner">
                                            <div>
                                                <label className="block text-[10px] font-extrabold text-gray-400 mb-1 ml-1 uppercase tracking-wider">Start Date</label>
                                                <input 
                                                    type="date"
                                                    value={paylogCustomStartDate}
                                                    onChange={e => setPaylogCustomStartDate(e.target.value)}
                                                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-[#2563eb]"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-extrabold text-gray-400 mb-1 ml-1 uppercase tracking-wider">End Date</label>
                                                <input 
                                                    type="date"
                                                    value={paylogCustomEndDate}
                                                    onChange={e => setPaylogCustomEndDate(e.target.value)}
                                                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-[#2563eb]"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-6">
                                    <TimeLog 
                                        timeEntries={filteredPaylogEntries} 
                                        profile={profile} 
                                        projects={projects}
                                        onUpdateEntry={handleUpdateTimeEntry}
                                        onDeleteEntry={handleDeleteTimeEntry}
                                        onAddEntry={handleAddTimeEntry}
                                        autoEditEntryId={autoEditEntryId}
                                        onClearAutoEdit={() => setAutoEditEntryId(null)}
                                    />
                                </div>
                            </div>
                        )}

                        {/* MODE 2: SAVED PAY REPORTS */}
                        {paylogSubTab === 'reports' && (
                            <div className="flex flex-col gap-5 mb-8">
                                {/* Search & Status Filter Bar */}
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <div className="relative flex-1">
                                        <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                                        <input
                                            type="text"
                                            placeholder="Search by report ID, period, or notes..."
                                            value={payReportSearchQuery}
                                            onChange={e => setPayReportSearchQuery(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-blue-600"
                                        />
                                    </div>
                                    <div className="flex gap-1.5 bg-gray-100 p-1 rounded-xl border border-gray-200 shrink-0 overflow-x-auto">
                                        {['all', 'approved', 'paid', 'draft'].map((st) => (
                                            <button
                                                key={st}
                                                onClick={() => setPayReportFilterStatus(st)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer ${
                                                    payReportFilterStatus === st
                                                        ? 'bg-white text-gray-900 shadow-xs'
                                                        : 'text-gray-500 hover:text-gray-700'
                                                }`}
                                            >
                                                {st}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Reports Grid */}
                                {(() => {
                                    const filteredReports = payReports.filter(r => {
                                        const matchesStatus = payReportFilterStatus === 'all' || r.status === payReportFilterStatus;
                                        const query = payReportSearchQuery.toLowerCase();
                                        const matchesSearch = !query || 
                                            r.id.toLowerCase().includes(query) || 
                                            r.periodLabel.toLowerCase().includes(query) || 
                                            (r.notes && r.notes.toLowerCase().includes(query));
                                        return matchesStatus && matchesSearch;
                                    });

                                    if (filteredReports.length === 0) {
                                        return (
                                            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center shadow-xs">
                                                <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                                                <h3 className="text-sm font-bold text-gray-700">No Saved Pay Reports Found</h3>
                                                <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                                                    When you export a pay report, it will be permanently stored in Google Apps Script and accessible here anytime, anywhere.
                                                </p>
                                                <button
                                                    onClick={() => setPaylogSubTab('entries')}
                                                    className="mt-4 bg-blue-950 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-gray-800 transition-colors inline-flex items-center gap-2 cursor-pointer"
                                                >
                                                    <Clock className="w-3.5 h-3.5" /> View Active Entries
                                                </button>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {filteredReports.map(report => (
                                                <div key={report.id} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs hover:border-blue-300 transition-all flex flex-col justify-between">
                                                    <div>
                                                        <div className="flex items-center justify-between mb-3">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-mono text-xs font-extrabold text-blue-900 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">
                                                                    #{report.id}
                                                                </span>
                                                                <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                                                                    report.status === 'paid' 
                                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                                                        : report.status === 'approved'
                                                                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                                        : 'bg-amber-50 text-amber-700 border-amber-200'
                                                                }`}>
                                                                    {report.status}
                                                                </span>
                                                            </div>
                                                            <span className="text-[11px] font-semibold text-gray-400">
                                                                {new Date(report.generatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                            </span>
                                                        </div>

                                                        <h3 className="font-bold text-sm text-gray-800">{report.periodLabel}</h3>
                                                        <p className="text-xs text-gray-500 mt-1">Employee: <span className="font-semibold text-gray-700">{report.employeeName}</span> (${report.hourlyWage}/hr)</p>

                                                        {report.notes && (
                                                            <p className="text-xs text-gray-600 bg-gray-50 p-2.5 rounded-xl border border-gray-100 mt-3 font-medium line-clamp-2">
                                                                "{report.notes}"
                                                            </p>
                                                        )}

                                                        <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-gray-100 text-xs">
                                                            <div>
                                                                <span className="text-[10px] font-bold text-gray-400 uppercase">Total Hours</span>
                                                                <p className="font-extrabold text-gray-800 text-base">{report.totalHours.toFixed(2)} hrs</p>
                                                            </div>
                                                            <div className="text-right">
                                                                <span className="text-[10px] font-bold text-gray-400 uppercase">Gross Pay</span>
                                                                <p className="font-extrabold text-emerald-600 text-base">${report.totalGrossPay.toFixed(2)}</p>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2 mt-5 pt-3 border-t border-gray-100">
                                                        <button
                                                            onClick={() => setSelectedReportForEdit(report)}
                                                            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                                        >
                                                            <Edit3 className="w-3.5 h-3.5 text-gray-500" /> View & Edit
                                                        </button>
                                                        <button
                                                            onClick={() => generatePayReport(profile!, report.timeEntries || [], report.periodLabel, report)}
                                                            className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold p-2 rounded-xl transition-all cursor-pointer"
                                                            title="Re-download PDF"
                                                        >
                                                            <Download className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeletePayReport(report.id)}
                                                            className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-bold p-2 rounded-xl transition-all cursor-pointer"
                                                            title="Delete Report"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}
                            </div>
                        )}

                        {/* EDIT / INSPECT PAY REPORT MODAL */}
                        {selectedReportForEdit && (
                            <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                                <div className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-gray-100 flex flex-col gap-5">
                                    <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-lg font-bold text-gray-900">Edit Pay Report</h3>
                                                <span className="font-mono text-xs bg-blue-50 text-blue-800 px-2 py-0.5 rounded-lg border border-blue-100 font-bold">
                                                    #{selectedReportForEdit.id}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-0.5">Generated {new Date(selectedReportForEdit.generatedAt).toLocaleString()}</p>
                                        </div>
                                        <button
                                            onClick={() => setSelectedReportForEdit(null)}
                                            className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 flex items-center justify-center transition-all cursor-pointer"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>

                                    <form
                                        onSubmit={async (e) => {
                                            e.preventDefault();
                                            await handleSavePayReport(selectedReportForEdit);
                                            setSelectedReportForEdit(null);
                                            setPayReportNotification('Pay report changes saved successfully to Google Apps Script!');
                                            setTimeout(() => setPayReportNotification(null), 4000);
                                        }}
                                        className="flex flex-col gap-4"
                                    >
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-[10px] font-extrabold text-gray-400 mb-1 uppercase tracking-wider">Employee Name</label>
                                                <input
                                                    type="text"
                                                    value={selectedReportForEdit.employeeName}
                                                    onChange={e => setSelectedReportForEdit({ ...selectedReportForEdit, employeeName: e.target.value })}
                                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 outline-none focus:ring-2 focus:ring-blue-600"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-extrabold text-gray-400 mb-1 uppercase tracking-wider">Hourly Wage ($/hr)</label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={selectedReportForEdit.hourlyWage}
                                                    onChange={e => {
                                                        const newWage = parseFloat(e.target.value) || 0;
                                                        const newGross = selectedReportForEdit.totalHours * newWage;
                                                        setSelectedReportForEdit({
                                                            ...selectedReportForEdit,
                                                            hourlyWage: newWage,
                                                            totalGrossPay: newGross
                                                        });
                                                    }}
                                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 outline-none focus:ring-2 focus:ring-blue-600"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-[10px] font-extrabold text-gray-400 mb-1 uppercase tracking-wider">Period Label</label>
                                                <input
                                                    type="text"
                                                    value={selectedReportForEdit.periodLabel}
                                                    onChange={e => setSelectedReportForEdit({ ...selectedReportForEdit, periodLabel: e.target.value })}
                                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 outline-none focus:ring-2 focus:ring-blue-600"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-extrabold text-gray-400 mb-1 uppercase tracking-wider">Status</label>
                                                <select
                                                    value={selectedReportForEdit.status}
                                                    onChange={e => setSelectedReportForEdit({ ...selectedReportForEdit, status: e.target.value as any })}
                                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 outline-none focus:ring-2 focus:ring-blue-600"
                                                >
                                                    <option value="draft">Draft</option>
                                                    <option value="approved">Approved</option>
                                                    <option value="paid">Paid</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-extrabold text-gray-400 mb-1 uppercase tracking-wider">Report Notes / Memo</label>
                                            <textarea
                                                rows={2}
                                                value={selectedReportForEdit.notes || ''}
                                                onChange={e => setSelectedReportForEdit({ ...selectedReportForEdit, notes: e.target.value })}
                                                placeholder="Add invoice memo or approval remarks..."
                                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-blue-600"
                                            />
                                        </div>

                                        {/* Entries Summary Table inside Modal */}
                                        <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-200">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-xs font-bold text-gray-700">Included Time Logs ({selectedReportForEdit.timeEntries?.length || 0})</span>
                                                <span className="text-xs font-extrabold text-emerald-600">${selectedReportForEdit.totalGrossPay.toFixed(2)}</span>
                                            </div>
                                            <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                                                {(selectedReportForEdit.timeEntries || []).map((ent, i) => (
                                                    <div key={i} className="text-[11px] bg-white p-2 rounded-xl border border-gray-150 flex justify-between items-center">
                                                        <div>
                                                            <span className="font-bold text-gray-800">{new Date(ent.clockIn).toLocaleDateString()}</span> - <span className="text-gray-600 font-medium">{ent.projectName || 'General'}</span>
                                                        </div>
                                                        <span className="font-extrabold text-gray-700">
                                                            {ent.isExpense ? `$${(ent.expenseAmount || 0).toFixed(2)}` : `${getEntryDuration(ent, new Date().getTime()).toFixed(2)} hrs`}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                                            <button
                                                type="submit"
                                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2.5 rounded-xl shadow-sm transition-all cursor-pointer"
                                            >
                                                Save Changes
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => generatePayReport(profile!, selectedReportForEdit.timeEntries || [], selectedReportForEdit.periodLabel, selectedReportForEdit)}
                                                className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold py-2.5 px-3 rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                                            >
                                                <Download className="w-3.5 h-3.5" /> Download PDF
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )}
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
                    unreadChatCount={unreadChatCount}
                />

                {/* BACKDROP FOR SLIDE-UP ACTIONS */}
                {isSlideUpOpen && (
                    <div 
                        onClick={() => setIsSlideUpOpen(false)} 
                        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px] transition-opacity z-45"
                    />
                )}

                {/* SLIDE-UP DRAWER ACTIONS */}
                <div 
                    className={`absolute bottom-0 left-0 right-0 bg-white border-t border-slate-100 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] z-50 px-6 pt-4 pb-8 transform-gpu ${isSlideUpOpen ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'}`}
                    style={{ borderRadius: '24px 24px 0 0' }}
                >
                    <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-5" />
                    
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-base font-bold text-slate-900 tracking-tight">Jobsite Menu & Actions</h3>
                            <p className="text-xs text-slate-500 mt-0.5">Quick access to logs, tasks, and project sites</p>
                        </div>
                        <button 
                            onClick={() => setIsSlideUpOpen(false)}
                            className="w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-all cursor-pointer"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Quick Section Tabs */}
                    <div className="grid grid-cols-3 gap-3 mb-6">
                        {[
                            { id: 'tasks', name: 'Checklists', icon: LayoutGrid },
                            { id: 'paylog', name: 'Time Card', icon: Wallet },
                            { id: 'profile', name: 'My Profile', icon: User }
                        ].map((tabObj) => {
                            const TabIcon = tabObj.icon;
                            const isActive = currentTab === tabObj.id;
                            return (
                                <button
                                    key={tabObj.id}
                                    onClick={() => {
                                        setCurrentTab(tabObj.id as any);
                                        setIsSlideUpOpen(false);
                                    }}
                                    className={`flex flex-col items-center justify-center py-3.5 px-3 rounded-xl border text-center transition-all cursor-pointer ${
                                        isActive 
                                            ? 'bg-blue-50/50 border-blue-200 text-blue-600 font-semibold shadow-sm' 
                                            : 'bg-slate-50/50 hover:bg-slate-50 border-slate-100 text-slate-600 font-medium'
                                    }`}
                                >
                                    <TabIcon className={`w-5 h-5 mb-1.5 ${isActive ? 'text-blue-600' : 'text-slate-500'}`} />
                                    <span className="text-xs leading-none">{tabObj.name}</span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="border-t border-slate-100 pt-5 space-y-2">
                        {/* 1. Voice Checklist dictation (The smart voice task button) */}
                        <button 
                            onClick={() => {
                                setIsSlideUpOpen(false);
                                setIsAiRecorderOpen(true);
                                setRecordingState('idle');
                                setRecordingError(null);
                            }}
                            className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 border border-transparent hover:border-slate-100 rounded-xl text-left transition-all cursor-pointer group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-100/80 transition-colors">
                                    <Mic className="w-5 h-5 shrink-0" />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-slate-800 text-sm group-hover:text-blue-600 transition-colors">✨ Voice Task Generator</h4>
                                    <p className="text-xs text-slate-500 mt-0.5">Dictate tasks/observations and let Gemini draft checklists.</p>
                                </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-650 group-hover:translate-x-0.5 transition-all shrink-0" />
                        </button>

                        {/* 2. Add manual task */}
                        <button 
                            onClick={() => {
                                setIsSlideUpOpen(false);
                                setIsNewTaskPopupOpen(true);
                            }}
                            className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 border border-transparent hover:border-slate-100 rounded-xl text-left transition-all cursor-pointer group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center shrink-0 group-hover:bg-slate-100/80 transition-colors">
                                    <Plus className="w-5 h-5 shrink-0" />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-slate-800 text-sm group-hover:text-amber-600 transition-colors">Add Standalone Task</h4>
                                    <p className="text-xs text-slate-500 mt-0.5">Manually add a task or general checklist item.</p>
                                </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all shrink-0" />
                        </button>

                        {/* 3. Register current site */}
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
                            className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 border border-transparent hover:border-slate-100 rounded-xl text-left transition-all cursor-pointer group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center shrink-0 group-hover:bg-slate-100/80 transition-colors">
                                    <Briefcase className="w-5 h-5 shrink-0" />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-slate-800 text-sm group-hover:text-emerald-600 transition-colors">Register New Project Site</h4>
                                    <p className="text-xs text-slate-500 mt-0.5">Define a new residential address, building, or specific scope.</p>
                                </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all shrink-0" />
                        </button>
                    </div>
                </div>

                {/* AI VOICE TASK GENERATOR MODAL PORTAL */}
                {isAiRecorderOpen && (
                    <div className="absolute inset-x-0 bottom-0 w-full max-w-md mx-auto h-[580px] bg-white rounded-t-[30px] shadow-[0_-15px_40px_rgba(0,0,0,0.18)] border-t border-gray-200 z-50 flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
                        
                        <div className="px-5 py-4 border-b border-gray-200 flex justify-between items-center bg-white shrink-0">
                            <div className="flex items-center gap-2.5">
                                <Sparkles className="w-5 h-5 text-blue-600" />
                                <h3 className="text-base font-bold text-gray-900 tracking-tight">AI Voice Task Generator</h3>
                            </div>
                            <button 
                                onClick={() => {
                                    cancelRecording();
                                    setIsAiRecorderOpen(false);
                                }}
                                className="w-7 h-7 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-900 flex items-center justify-center transition-all text-xs font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        {recordingState === 'idle' && (
                            <div className="flex-1 flex flex-col justify-between p-5 overflow-y-auto">
                                <div className="text-center pt-3">
                                    <div className="w-16 h-16 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto mb-4 hover:scale-105 transition-transform shadow-sm">
                                        <Mic className="w-7 h-7 text-blue-600 animate-pulse" />
                                    </div>
                                    <h4 className="font-bold text-gray-800 text-sm mb-1.5">Voice Log Dictation</h4>
                                    <p className="text-xs text-gray-500 leading-relaxed max-w-[280px] mx-auto">
                                        Speak checklist detail or active tasks: E.g., "Need punch list on kitchen floor tiles, also clean the paint splatters on window trim."
                                    </p>
                                </div>

                                <div className="space-y-4 pt-4">
                                    {recordingError && (
                                        <div className="p-3 bg-red-50 text-red-800 rounded-xl border border-red-200 flex gap-2.5 items-start">
                                            <AlertCircle className="w-4 h-4 text-red-650 shrink-0 mt-0.5" />
                                            <p className="text-[11px] leading-snug font-semibold">{recordingError}</p>
                                        </div>
                                    )}

                                    <button 
                                        onClick={startRecording}
                                        className="w-full bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-bold text-sm py-3 rounded-lg flex items-center justify-center gap-2 shadow-sm transition-all animate-pulse"
                                    >
                                        <Mic className="w-4 h-4 fill-white animate-bounce" /> Start Voice Recording
                                    </button>

                                    {/* Typed Fallback section */}
                                    <div className="border-t border-gray-150 pt-3">
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                                            or paste handwritten tasks / typed list
                                        </label>
                                        <textarea
                                            value={manualInput}
                                            onChange={(e) => setManualInput(e.target.value)}
                                            placeholder="Example: Fix the leaking copper joint, repair drywalls in master hall, clean dust off countertops..."
                                            className="w-full h-24 p-2.5 border border-gray-250 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-400 resize-none bg-gray-50"
                                        />
                                        <div className="flex gap-2 mt-2 w-full animate-in fade-in duration-300">
                                            <button 
                                                onClick={handleSaveManualTask}
                                                disabled={!manualInput.trim()}
                                                className="flex-1 bg-white hover:bg-gray-50 text-gray-700 font-bold border border-gray-300 px-3 py-2.5 rounded-lg disabled:opacity-40 text-xs transition-colors"
                                            >
                                                Save Directly
                                            </button>
                                            <button 
                                                onClick={processTypedNotes}
                                                disabled={!manualInput.trim()}
                                                className="flex-1 bg-slate-900 hover:bg-slate-950 text-white font-bold px-3 py-2.5 rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-45 text-xs shadow-sm transition-colors"
                                            >
                                                <Sparkles className="w-3.5 h-3.5 text-amber-300" /> Auto-Extract with AI
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

                                <div>
                                    <label className="block text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">
                                        Photos & Attachments
                                    </label>
                                    <div className="flex gap-2 items-start flex-wrap bg-gray-50 p-2 rounded-xl border border-gray-200">
                                        {quickTaskPhotos.map((url, i) => (
                                            <div key={i} className="relative group">
                                                <img src={getDirectImageUrl(url)} alt="Attachment" className="w-12 h-12 object-cover rounded-lg border border-gray-300" />
                                                <button
                                                    type="button"
                                                    onClick={() => setQuickTaskPhotos(quickTaskPhotos.filter((_, idx) => idx !== i))}
                                                    className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center shadow hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                        <label className={`w-12 h-12 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400 hover:border-[#2563eb] hover:text-[#2563eb] transition-colors cursor-pointer ${isUploadingTaskPhoto ? 'opacity-50 pointer-events-none' : ''}`}>
                                            <input type="file" accept="image/*" className="hidden" ref={taskFileInputRef} onChange={handleUploadTaskPhoto} />
                                            {isUploadingTaskPhoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                                        </label>
                                    </div>
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

