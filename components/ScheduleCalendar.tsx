import React, { useState, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Clock, 
  MapPin, 
  Users, 
  Briefcase, 
  Filter, 
  Search, 
  Edit3, 
  Trash2, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  Download, 
  Sparkles,
  CalendarDays,
  ListFilter,
  Check,
  Phone,
  FileText,
  AlertTriangle,
  PlayCircle
} from 'lucide-react';
import { ScheduleEvent, UserProfile } from '../types';

interface ScheduleCalendarProps {
  schedules: ScheduleEvent[];
  onSaveSchedule: (schedule: ScheduleEvent) => Promise<void> | void;
  onDeleteSchedule: (scheduleId: string) => Promise<void> | void;
  currentUser?: UserProfile | null;
  allUsers?: Array<{ id: string; name: string; role?: string; hourlyWage?: number }>;
  projects: string[];
  onClockInToJob?: (projectName: string) => void;
  isAdmin?: boolean;
}

type ViewMode = 'month' | 'week' | 'day' | 'agenda';

const COLOR_PRESETS = [
  { name: 'Blue', hex: '#2563eb', bg: 'bg-blue-500', lightBg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  { name: 'Emerald', hex: '#059669', bg: 'bg-emerald-500', lightBg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  { name: 'Amber', hex: '#d97706', bg: 'bg-amber-500', lightBg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  { name: 'Purple', hex: '#7c3aed', bg: 'bg-purple-500', lightBg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  { name: 'Rose', hex: '#e11d48', bg: 'bg-rose-500', lightBg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  { name: 'Cyan', hex: '#0891b2', bg: 'bg-cyan-500', lightBg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
  { name: 'Indigo', hex: '#4f46e5', bg: 'bg-indigo-500', lightBg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  { name: 'Slate', hex: '#475569', bg: 'bg-slate-500', lightBg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300' },
];

export const ScheduleCalendar: React.FC<ScheduleCalendarProps> = ({
  schedules,
  onSaveSchedule,
  onDeleteSchedule,
  currentUser,
  allUsers = [],
  projects = ['General'],
  onClockInToJob,
  isAdmin = false
}) => {
  // Calendar navigation state
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  
  // Filtering states
  const [filterUser, setFilterUser] = useState<string>('all'); // 'all', 'mine', or user ID
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detailEvent, setDetailEvent] = useState<ScheduleEvent | null>(null);

  // Form states for Create/Edit Modal
  const [formId, setFormId] = useState<string>('');
  const [formTitle, setFormTitle] = useState<string>('');
  const [formProject, setFormProject] = useState<string>('General');
  const [formStartDate, setFormStartDate] = useState<string>('');
  const [formEndDate, setFormEndDate] = useState<string>('');
  const [formStartTime, setFormStartTime] = useState<string>('07:30');
  const [formEndTime, setFormEndTime] = useState<string>('16:00');
  const [formAssignedTo, setFormAssignedTo] = useState<string[]>([]);
  const [formLocation, setFormLocation] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');
  const [formStatus, setFormStatus] = useState<ScheduleEvent['status']>('scheduled');
  const [formPriority, setFormPriority] = useState<ScheduleEvent['priority']>('medium');
  const [formColor, setFormColor] = useState<string>('#2563eb');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Available users list (merge allUsers + currentUser)
  const availableUsers = useMemo(() => {
    const map = new Map<string, { id: string; name: string; role?: string }>();
    if (currentUser?.id) {
      map.set(String(currentUser.id), { id: String(currentUser.id), name: currentUser.name, role: 'Current User' });
    }
    allUsers.forEach(u => {
      if (u.id) map.set(String(u.id), { id: String(u.id), name: u.name, role: u.role || 'Employee' });
    });
    return Array.from(map.values());
  }, [allUsers, currentUser]);

  // Current year & month for calculation
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Helper formatters
  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const toYMD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const todayYMD = toYMD(new Date());

  // Filtered schedules list
  const filteredSchedules = useMemo(() => {
    return schedules.filter(event => {
      // User filter
      if (filterUser === 'mine' && currentUser?.id) {
        const isAssigned = event.assignedTo?.some(id => String(id) === String(currentUser.id)) ||
                           event.assignedNames?.some(name => name.toLowerCase() === currentUser.name.toLowerCase());
        if (!isAssigned) return false;
      } else if (filterUser !== 'all' && filterUser !== 'mine') {
        const isAssigned = event.assignedTo?.some(id => String(id) === filterUser);
        if (!isAssigned) return false;
      }

      // Project filter
      if (filterProject !== 'all' && event.projectName !== filterProject) {
        return false;
      }

      // Status filter
      if (filterStatus !== 'all' && event.status !== filterStatus) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = (event.title || '').toLowerCase().includes(q);
        const matchProject = (event.projectName || '').toLowerCase().includes(q);
        const matchLocation = (event.location || '').toLowerCase().includes(q);
        const matchNotes = (event.notes || '').toLowerCase().includes(q);
        const matchAssignee = (event.assignedNames || []).some(n => n.toLowerCase().includes(q));
        if (!matchTitle && !matchProject && !matchLocation && !matchNotes && !matchAssignee) {
          return false;
        }
      }

      return true;
    });
  }, [schedules, filterUser, filterProject, filterStatus, searchQuery, currentUser]);

  // Navigate dates
  const handlePrev = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(year, month - 1, 1));
    } else if (viewMode === 'week') {
      const prev = new Date(currentDate);
      prev.setDate(prev.getDate() - 7);
      setCurrentDate(prev);
    } else if (viewMode === 'day') {
      const prev = new Date(currentDate);
      prev.setDate(prev.getDate() - 1);
      setCurrentDate(prev);
    }
  };

  const handleNext = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(year, month + 1, 1));
    } else if (viewMode === 'week') {
      const next = new Date(currentDate);
      next.setDate(next.getDate() + 7);
      setCurrentDate(next);
    } else if (viewMode === 'day') {
      const next = new Date(currentDate);
      next.setDate(next.getDate() + 1);
      setCurrentDate(next);
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Open Create Modal
  const openCreateModal = (defaultDate?: string) => {
    const targetDate = defaultDate || toYMD(currentDate);
    setFormId('sched_' + Math.random().toString(36).substring(2, 10));
    setFormTitle('');
    setFormProject(projects[0] || 'General');
    setFormStartDate(targetDate);
    setFormEndDate(targetDate);
    setFormStartTime('07:30');
    setFormEndTime('16:00');
    setFormAssignedTo(currentUser?.id ? [String(currentUser.id)] : (availableUsers[0] ? [availableUsers[0].id] : []));
    setFormLocation('');
    setFormNotes('');
    setFormStatus('scheduled');
    setFormPriority('medium');
    setFormColor('#2563eb');
    setFormError(null);
    setSelectedEvent(null);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (event: ScheduleEvent) => {
    setFormId(event.id);
    setFormTitle(event.title || '');
    setFormProject(event.projectName || 'General');
    setFormStartDate(event.startDate || toYMD(new Date()));
    setFormEndDate(event.endDate || event.startDate || toYMD(new Date()));
    setFormStartTime(event.startTime || '07:30');
    setFormEndTime(event.endTime || '16:00');
    setFormAssignedTo(event.assignedTo || []);
    setFormLocation(event.location || '');
    setFormNotes(event.notes || '');
    setFormStatus(event.status || 'scheduled');
    setFormPriority(event.priority || 'medium');
    setFormColor(event.color || '#2563eb');
    setFormError(null);
    setSelectedEvent(event);
    setIsDetailModalOpen(false);
    setIsModalOpen(true);
  };

  // Open Details Modal
  const openDetails = (event: ScheduleEvent) => {
    setDetailEvent(event);
    setIsDetailModalOpen(true);
  };

  // Handle Save
  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormError('Please enter a job or shift title.');
      return;
    }
    if (!formStartDate) {
      setFormError('Please select a start date.');
      return;
    }

    // Resolve assigned names
    const assignedNames = formAssignedTo.map(id => {
      const u = availableUsers.find(user => String(user.id) === String(id));
      return u ? u.name : 'Worker';
    });

    const eventPayload: ScheduleEvent = {
      id: formId || ('sched_' + Math.random().toString(36).substring(2, 10)),
      title: formTitle.trim(),
      projectName: formProject || 'General',
      startDate: formStartDate,
      endDate: formEndDate || formStartDate,
      startTime: formStartTime || '07:30',
      endTime: formEndTime || '16:00',
      assignedTo: formAssignedTo,
      assignedNames: assignedNames,
      location: formLocation.trim() || undefined,
      notes: formNotes.trim() || undefined,
      status: formStatus,
      priority: formPriority,
      color: formColor,
      createdBy: currentUser?.name || 'Admin',
      createdAt: selectedEvent?.createdAt || new Date().toISOString()
    };

    setIsSaving(true);
    try {
      await onSaveSchedule(eventPayload);
      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save schedule.');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Delete
  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to remove this scheduled job?')) return;
    setIsSaving(true);
    try {
      await onDeleteSchedule(id);
      setIsDetailModalOpen(false);
      setIsModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to delete schedule');
    } finally {
      setIsSaving(false);
    }
  };

  // Export iCal (.ics) file
  const handleExportICS = () => {
    if (filteredSchedules.length === 0) {
      alert('No schedules available to export.');
      return;
    }

    let icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//KS Enterprise Group//Field Operations Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH'
    ];

    filteredSchedules.forEach(ev => {
      const cleanDate = ev.startDate.replace(/-/g, '');
      const sTime = (ev.startTime || '07:30').replace(/:/g, '') + '00';
      const eTime = (ev.endTime || '16:00').replace(/:/g, '') + '00';
      const dtStart = `${cleanDate}T${sTime}`;
      const dtEnd = `${(ev.endDate || ev.startDate).replace(/-/g, '')}T${eTime}`;

      icsContent.push('BEGIN:VEVENT');
      icsContent.push(`UID:${ev.id}@ksenterprisegroup.com`);
      icsContent.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`);
      icsContent.push(`DTSTART:${dtStart}`);
      icsContent.push(`DTEND:${dtEnd}`);
      icsContent.push(`SUMMARY:${ev.projectName}: ${ev.title}`);
      if (ev.location) icsContent.push(`LOCATION:${ev.location.replace(/,/g, '\\,')}`);
      if (ev.notes) icsContent.push(`DESCRIPTION:${ev.notes.replace(/\n/g, '\\n')}\\nCrew: ${(ev.assignedNames || []).join(', ')}`);
      icsContent.push('STATUS:CONFIRMED');
      icsContent.push('END:VEVENT');
    });

    icsContent.push('END:VCALENDAR');

    const blob = new Blob([icsContent.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', `KS_Enterprise_Schedule_${todayYMD}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Days calculation for Month View
  const monthDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days: Array<{
      date: Date;
      ymd: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      events: ScheduleEvent[];
    }> = [];

    // Previous month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, daysInPrevMonth - i);
      const ymd = toYMD(d);
      days.push({
        date: d,
        ymd,
        dayNumber: daysInPrevMonth - i,
        isCurrentMonth: false,
        isToday: ymd === todayYMD,
        events: filteredSchedules.filter(s => s.startDate <= ymd && (s.endDate ? s.endDate >= ymd : s.startDate === ymd))
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      const ymd = toYMD(d);
      days.push({
        date: d,
        ymd,
        dayNumber: i,
        isCurrentMonth: true,
        isToday: ymd === todayYMD,
        events: filteredSchedules.filter(s => s.startDate <= ymd && (s.endDate ? s.endDate >= ymd : s.startDate === ymd))
      });
    }

    // Next month padding to complete 35 or 42 grid cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      const ymd = toYMD(d);
      days.push({
        date: d,
        ymd,
        dayNumber: i,
        isCurrentMonth: false,
        isToday: ymd === todayYMD,
        events: filteredSchedules.filter(s => s.startDate <= ymd && (s.endDate ? s.endDate >= ymd : s.startDate === ymd))
      });
    }

    return days;
  }, [year, month, filteredSchedules, todayYMD]);

  // Week days calculation for Week View
  const weekDays = useMemo(() => {
    const curr = new Date(currentDate);
    const first = curr.getDate() - curr.getDay();
    const days: Array<{ date: Date; ymd: string; dayNumber: number; isToday: boolean; events: ScheduleEvent[] }> = [];

    for (let i = 0; i < 7; i++) {
      const next = new Date(curr.getFullYear(), curr.getMonth(), first + i);
      const ymd = toYMD(next);
      days.push({
        date: next,
        ymd,
        dayNumber: next.getDate(),
        isToday: ymd === todayYMD,
        events: filteredSchedules.filter(s => s.startDate <= ymd && (s.endDate ? s.endDate >= ymd : s.startDate === ymd))
      });
    }
    return days;
  }, [currentDate, filteredSchedules, todayYMD]);

  // Day View events
  const dayYMD = toYMD(currentDate);
  const dayEvents = useMemo(() => {
    return filteredSchedules.filter(s => s.startDate <= dayYMD && (s.endDate ? s.endDate >= dayYMD : s.startDate === dayYMD))
      .sort((a, b) => (a.startTime || '00:00').localeCompare(b.startTime || '00:00'));
  }, [filteredSchedules, dayYMD]);

  // Agenda List events (sorted chronologically)
  const agendaEvents = useMemo(() => {
    return [...filteredSchedules].sort((a, b) => {
      const dateCmp = (a.startDate || '').localeCompare(b.startDate || '');
      if (dateCmp !== 0) return dateCmp;
      return (a.startTime || '00:00').localeCompare(b.startTime || '00:00');
    });
  }, [filteredSchedules]);

  // Overlap conflict detection for selected day / events
  const hasConflict = (events: ScheduleEvent[]) => {
    if (events.length <= 1) return false;
    const workerMap: Record<string, number> = {};
    events.forEach(ev => {
      (ev.assignedTo || []).forEach(uid => {
        workerMap[uid] = (workerMap[uid] || 0) + 1;
      });
    });
    return Object.values(workerMap).some(count => count > 1);
  };

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-5 px-3 sm:px-6 py-4">
      {/* Calendar Header Card */}
      <div className="bg-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Title and Date Navigator */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-orange-500/20 text-orange-400 border border-orange-500/30 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                Field Dispatch
              </span>
              <span className="text-slate-400 text-xs font-semibold">
                {filteredSchedules.length} Total Scheduled Jobs
              </span>
            </div>
            
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {viewMode === 'month' && formatMonthYear(currentDate)}
                {viewMode === 'week' && `Week of ${weekDays[0]?.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekDays[6]?.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                {viewMode === 'day' && currentDate.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}
                {viewMode === 'agenda' && 'All Upcoming Job Assignments'}
              </h1>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            {/* View Mode Toggle Switcher */}
            <div className="bg-slate-800/90 p-1 rounded-2xl border border-slate-700/80 flex items-center shadow-inner">
              <button
                onClick={() => setViewMode('month')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  viewMode === 'month' 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                Month
              </button>
              <button
                onClick={() => setViewMode('week')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  viewMode === 'week' 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                Week
              </button>
              <button
                onClick={() => setViewMode('day')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  viewMode === 'day' 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                Day
              </button>
              <button
                onClick={() => setViewMode('agenda')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  viewMode === 'agenda' 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                Agenda
              </button>
            </div>

            {/* Date Nav Controls */}
            {viewMode !== 'agenda' && (
              <div className="flex items-center gap-1 bg-slate-800/90 p-1 rounded-2xl border border-slate-700/80">
                <button
                  onClick={handlePrev}
                  className="p-1.5 hover:bg-slate-700 rounded-xl text-slate-300 hover:text-white transition-colors"
                  title="Previous"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={handleToday}
                  className="px-2.5 py-1 text-xs font-bold text-slate-200 hover:bg-slate-700 rounded-xl transition-colors"
                >
                  Today
                </button>
                <button
                  onClick={handleNext}
                  className="p-1.5 hover:bg-slate-700 rounded-xl text-slate-300 hover:text-white transition-colors"
                  title="Next"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Schedule New Job Button */}
            <button
              onClick={() => openCreateModal()}
              className="flex items-center gap-1.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-extrabold text-xs sm:text-sm px-4 py-2.5 rounded-2xl shadow-lg shadow-orange-500/20 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Schedule Job</span>
            </button>

            {/* iCal Export Button */}
            <button
              onClick={handleExportICS}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-2xl transition-all"
              title="Export to Apple / Google Calendar (.ics)"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* Quick Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search jobs, sites, crew..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-800/70 border border-slate-700/80 rounded-xl text-xs font-medium text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-slate-800 transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Assigned Worker Filter */}
          <div className="relative">
            <select
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-800/70 border border-slate-700/80 rounded-xl text-xs font-semibold text-white outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer transition-all"
            >
              <option value="all">👥 All Team Members</option>
              {currentUser?.id && <option value="mine">⭐ My Assigned Shifts Only</option>}
              {availableUsers.map(u => (
                <option key={u.id} value={u.id}>
                  👤 {u.name}
                </option>
              ))}
            </select>
          </div>

          {/* Project Filter */}
          <div className="relative">
            <select
              value={filterProject}
              onChange={(e) => setFilterProject(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-800/70 border border-slate-700/80 rounded-xl text-xs font-semibold text-white outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer transition-all"
            >
              <option value="all">💼 All Jobsites & Projects</option>
              {projects.map((p, idx) => (
                <option key={idx} value={p}>
                  📍 {p}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="relative">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-800/70 border border-slate-700/80 rounded-xl text-xs font-semibold text-white outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer transition-all"
            >
              <option value="all">🏷️ All Shift Statuses</option>
              <option value="scheduled">⏳ Scheduled</option>
              <option value="in-progress">⚡ In Progress</option>
              <option value="completed">✅ Completed</option>
              <option value="cancelled">🚫 Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main View Area */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 shadow-sm border border-gray-200">
        {/* 1. MONTH VIEW */}
        {viewMode === 'month' && (
          <div>
            {/* Days of week header */}
            <div className="grid grid-cols-7 mb-2 text-center text-xs font-extrabold text-gray-400 uppercase tracking-wider py-1 border-b border-gray-100">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
                <div key={i} className={i === 0 || i === 6 ? 'text-gray-300' : ''}>{d}</div>
              ))}
            </div>

            {/* Grid */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2 auto-rows-fr">
              {monthDays.map((day, idx) => {
                const dayHasConflict = hasConflict(day.events);
                return (
                  <div
                    key={idx}
                    onClick={() => openCreateModal(day.ymd)}
                    className={`min-h-[90px] sm:min-h-[115px] p-1.5 sm:p-2 rounded-2xl border transition-all flex flex-col group cursor-pointer ${
                      day.isCurrentMonth 
                        ? 'bg-white hover:bg-blue-50/40 hover:border-blue-300 border-gray-150' 
                        : 'bg-gray-50/60 text-gray-300 border-gray-100'
                    } ${day.isToday ? 'ring-2 ring-blue-600 bg-blue-50/20 border-transparent shadow-sm' : ''}`}
                  >
                    {/* Date Number + Plus Quick Add */}
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs sm:text-sm font-black w-6 h-6 flex items-center justify-center rounded-full ${
                        day.isToday 
                          ? 'bg-blue-600 text-white shadow-sm' 
                          : day.isCurrentMonth ? 'text-gray-800' : 'text-gray-400'
                      }`}>
                        {day.dayNumber}
                      </span>
                      
                      <div className="flex items-center gap-1">
                        {dayHasConflict && (
                          <span title="Overlapping shift assignments detected for a worker" className="text-amber-500">
                            <AlertTriangle className="w-3.5 h-3.5" />
                          </span>
                        )}
                        <span className="opacity-0 group-hover:opacity-100 text-blue-600 transition-opacity p-0.5 rounded hover:bg-blue-100">
                          <Plus className="w-3 h-3" />
                        </span>
                      </div>
                    </div>

                    {/* Events List in Day Cell */}
                    <div className="flex-1 flex flex-col gap-1 overflow-y-auto max-h-[100px] no-scrollbar">
                      {day.events.slice(0, 3).map((ev) => (
                        <div
                          key={ev.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            openDetails(ev);
                          }}
                          style={{
                            borderLeftColor: ev.color || '#2563eb'
                          }}
                          className="px-1.5 py-1 rounded-lg text-[10px] font-bold border-l-[3px] bg-gray-50 hover:bg-blue-100 text-gray-800 truncate shadow-2xs hover:shadow-xs transition-all flex items-center justify-between gap-1 group/ev"
                        >
                          <div className="truncate flex items-center gap-1">
                            <span className="truncate">{ev.title || ev.projectName}</span>
                          </div>
                          <span className="text-[9px] text-gray-400 font-semibold shrink-0 group-hover/ev:text-blue-700">
                            {ev.startTime || 'Shift'}
                          </span>
                        </div>
                      ))}

                      {day.events.length > 3 && (
                        <span className="text-[9px] font-extrabold text-blue-600 pl-1">
                          +{day.events.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 2. WEEK VIEW */}
        {viewMode === 'week' && (
          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
            {weekDays.map((day, idx) => (
              <div 
                key={idx} 
                className={`flex flex-col rounded-2xl border p-3 min-h-[300px] ${
                  day.isToday 
                    ? 'bg-blue-50/30 border-blue-300 ring-2 ring-blue-600/30 shadow-sm' 
                    : 'bg-white border-gray-200'
                }`}
              >
                {/* Day Header */}
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100">
                  <div>
                    <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest block">
                      {day.date.toLocaleDateString('en-US', { weekday: 'short' })}
                    </span>
                    <span className={`text-base font-black ${day.isToday ? 'text-blue-600' : 'text-gray-800'}`}>
                      {day.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <button
                    onClick={() => openCreateModal(day.ymd)}
                    className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Add Shift"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* Events list */}
                <div className="flex-1 flex flex-col gap-2 overflow-y-auto">
                  {day.events.length > 0 ? (
                    day.events.map(ev => (
                      <div
                        key={ev.id}
                        onClick={() => openDetails(ev)}
                        style={{ borderLeftColor: ev.color || '#2563eb' }}
                        className="p-2.5 rounded-xl border border-gray-150 border-l-4 bg-white hover:bg-blue-50/50 shadow-2xs hover:shadow-sm cursor-pointer transition-all flex flex-col gap-1"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[9px] font-black uppercase tracking-wider text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded max-w-[100px] truncate">
                            {ev.projectName}
                          </span>
                          <span className="text-[9px] font-bold text-blue-600">
                            {ev.startTime}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-gray-800 leading-tight">
                          {ev.title}
                        </h4>
                        
                        {/* Crew count */}
                        {ev.assignedNames && ev.assignedNames.length > 0 && (
                          <div className="flex items-center gap-1 text-[10px] text-gray-500 mt-1">
                            <Users className="w-3 h-3 text-gray-400 shrink-0" />
                            <span className="truncate">{ev.assignedNames.join(', ')}</span>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div 
                      onClick={() => openCreateModal(day.ymd)}
                      className="flex-1 flex flex-col items-center justify-center p-4 border border-dashed border-gray-200 rounded-xl text-center text-gray-300 hover:text-blue-500 hover:border-blue-300 hover:bg-blue-50/20 cursor-pointer transition-all"
                    >
                      <Plus className="w-4 h-4 mb-1" />
                      <span className="text-[10px] font-bold">No jobs scheduled</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 3. DAY VIEW (DAILY DISPATCH) */}
        {viewMode === 'day' && (
          <div className="flex flex-col gap-4">
            {/* Day Header Banner */}
            <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-blue-300">
                  Daily Worksite Dispatch
                </span>
                <h3 className="text-xl sm:text-2xl font-black">
                  {currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-white/10 px-3 py-1.5 rounded-xl text-xs font-extrabold backdrop-blur-sm border border-white/10">
                  {dayEvents.length} Assigned {dayEvents.length === 1 ? 'Job' : 'Jobs'}
                </span>
                <button
                  onClick={() => openCreateModal(dayYMD)}
                  className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-extrabold px-3 py-1.5 rounded-xl shadow transition-all flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[3]" /> Add to Today
                </button>
              </div>
            </div>

            {/* List of day events */}
            {dayEvents.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dayEvents.map(ev => (
                  <div
                    key={ev.id}
                    className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span 
                          style={{ backgroundColor: `${ev.color || '#2563eb'}15`, color: ev.color || '#2563eb', borderColor: `${ev.color || '#2563eb'}30` }}
                          className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider border"
                        >
                          💼 {ev.projectName}
                        </span>
                        
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                            ev.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                            ev.status === 'in-progress' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                            ev.status === 'cancelled' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                            'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}>
                            {ev.status}
                          </span>
                        </div>
                      </div>

                      {/* Title */}
                      <h3 className="text-lg font-black text-gray-900 mb-1">
                        {ev.title}
                      </h3>

                      {/* Time & Location */}
                      <div className="flex flex-col gap-1.5 my-3 text-xs text-gray-600">
                        <div className="flex items-center gap-2 font-bold text-gray-700">
                          <Clock className="w-4 h-4 text-blue-600 shrink-0" />
                          <span>{ev.startTime || '07:30'} - {ev.endTime || '16:00'}</span>
                        </div>

                        {ev.location && (
                          <div className="flex items-start gap-2">
                            <MapPin className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                            <a 
                              href={`https://maps.google.com/?q=${encodeURIComponent(ev.location)}`}
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline font-medium break-words flex items-center gap-1"
                            >
                              {ev.location}
                              <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Assigned Workers Chips */}
                      {ev.assignedNames && ev.assignedNames.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest block mb-1.5">
                            Assigned Crew ({ev.assignedNames.length})
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {ev.assignedNames.map((name, i) => (
                              <span key={i} className="inline-flex items-center gap-1 bg-gray-100 text-gray-800 text-xs font-bold px-2.5 py-1 rounded-lg">
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                {name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Instructions */}
                      {ev.notes && (
                        <div className="mt-3 p-2.5 bg-gray-50 rounded-xl text-xs text-gray-600 border border-gray-100">
                          <span className="font-bold text-gray-700 block mb-0.5">📋 Site Instructions:</span>
                          <p className="whitespace-pre-wrap">{ev.notes}</p>
                        </div>
                      )}
                    </div>

                    {/* Actions bar */}
                    <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => openEditModal(ev)}
                          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button
                          onClick={() => handleDelete(ev.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Quick Clock In action for this job */}
                      {onClockInToJob && (
                        <button
                          onClick={() => onClockInToJob(ev.projectName)}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl shadow-sm hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5"
                        >
                          <PlayCircle className="w-4 h-4 stroke-[2.5]" />
                          <span>Clock In to Job</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center border-2 border-dashed border-gray-200 rounded-3xl bg-gray-50/50">
                <CalendarDays className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h4 className="text-base font-extrabold text-gray-700 mb-1">No Jobs Scheduled for Today</h4>
                <p className="text-xs text-gray-400 max-w-sm mx-auto mb-4">
                  Schedule crew members, jobsites, and daily working hours to keep the whole team synchronized.
                </p>
                <button
                  onClick={() => openCreateModal(dayYMD)}
                  className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow transition-all"
                >
                  <Plus className="w-4 h-4" /> Add Schedule Assignment
                </button>
              </div>
            )}
          </div>
        )}

        {/* 4. AGENDA / LIST VIEW */}
        {viewMode === 'agenda' && (
          <div className="flex flex-col gap-3">
            {agendaEvents.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {agendaEvents.map((ev) => (
                  <div
                    key={ev.id}
                    onClick={() => openDetails(ev)}
                    className="py-3.5 px-3 rounded-2xl hover:bg-blue-50/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer group"
                  >
                    <div className="flex items-start gap-3">
                      {/* Color Tag Bar */}
                      <div 
                        style={{ backgroundColor: ev.color || '#2563eb' }}
                        className="w-2.5 self-stretch rounded-full shrink-0 min-h-[40px]"
                      />

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                            {ev.startDate}
                          </span>
                          <span className="text-xs font-bold text-gray-400">
                            {ev.startTime} - {ev.endTime}
                          </span>
                          <span className="text-[10px] font-black text-gray-600 uppercase bg-gray-100 px-2 py-0.5 rounded">
                            💼 {ev.projectName}
                          </span>
                          <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                            ev.status === 'completed' ? 'bg-emerald-50 text-emerald-700' :
                            ev.status === 'in-progress' ? 'bg-amber-50 text-amber-700' :
                            ev.status === 'cancelled' ? 'bg-rose-50 text-rose-700' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {ev.status}
                          </span>
                        </div>

                        <h4 className="text-sm font-black text-gray-800 group-hover:text-blue-600 transition-colors">
                          {ev.title}
                        </h4>

                        {/* Location & Crew snippet */}
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                          {ev.location && (
                            <span className="flex items-center gap-1 truncate max-w-xs">
                              <MapPin className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                              {ev.location}
                            </span>
                          )}
                          {ev.assignedNames && ev.assignedNames.length > 0 && (
                            <span className="flex items-center gap-1 font-semibold text-gray-600">
                              <Users className="w-3.5 h-3.5 text-slate-400" />
                              {ev.assignedNames.join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 sm:self-center">
                      {onClockInToJob && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onClockInToJob(ev.projectName);
                          }}
                          className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-xl border border-emerald-200 transition-colors flex items-center gap-1"
                        >
                          <PlayCircle className="w-3.5 h-3.5" /> Clock In
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(ev);
                        }}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-gray-100 rounded-xl transition-colors"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <CalendarIcon className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="font-bold text-sm">No assignments match your search or filter</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* CREATE / EDIT SCHEDULE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-gray-100 my-8 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center font-black">
                  <CalendarIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-900">
                    {selectedEvent ? 'Edit Scheduled Job' : 'Schedule New Job Assignment'}
                  </h3>
                  <p className="text-xs text-gray-400">Visible to all team members & dispatchers</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Form Content */}
            <form onSubmit={handleSaveForm} className="space-y-4">
              {/* Job / Project & Color */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-extrabold text-gray-600 uppercase tracking-wider mb-1.5">
                    Jobsite / Customer Project *
                  </label>
                  <select
                    value={formProject}
                    onChange={(e) => setFormProject(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-800 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  >
                    {projects.map((p, i) => (
                      <option key={i} value={p}>
                        💼 {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-gray-600 uppercase tracking-wider mb-1.5">
                    Color Tag
                  </label>
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    {COLOR_PRESETS.map((col, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setFormColor(col.hex)}
                        style={{ backgroundColor: col.hex }}
                        className={`w-6 h-6 rounded-full transition-transform cursor-pointer ${
                          formColor === col.hex ? 'ring-2 ring-offset-2 ring-slate-900 scale-110 shadow-sm' : 'opacity-80 hover:opacity-100'
                        }`}
                        title={col.name}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Title / Scope */}
              <div>
                <label className="block text-xs font-extrabold text-gray-600 uppercase tracking-wider mb-1.5">
                  Shift Title / Work Scope *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Drywall & Framing, Site Rough-in, Floor Inspection"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  required
                />
              </div>

              {/* Date Pickers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-extrabold text-gray-600 uppercase tracking-wider mb-1.5">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={formStartDate}
                    onChange={(e) => {
                      setFormStartDate(e.target.value);
                      if (!formEndDate || formEndDate < e.target.value) {
                        setFormEndDate(e.target.value);
                      }
                    }}
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-gray-600 uppercase tracking-wider mb-1.5">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* Shift Hours & Presets */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-extrabold text-gray-600 uppercase tracking-wider">
                    Working Hours
                  </label>
                  {/* Quick Shift Presets */}
                  <div className="flex items-center gap-1 text-[10px]">
                    <span className="text-gray-400 font-bold">Presets:</span>
                    <button
                      type="button"
                      onClick={() => { setFormStartTime('07:00'); setFormEndTime('15:30'); }}
                      className="px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 rounded font-bold text-gray-700"
                    >
                      7a-3:30p
                    </button>
                    <button
                      type="button"
                      onClick={() => { setFormStartTime('08:00'); setFormEndTime('16:30'); }}
                      className="px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 rounded font-bold text-gray-700"
                    >
                      8a-4:30p
                    </button>
                    <button
                      type="button"
                      onClick={() => { setFormStartTime('06:00'); setFormEndTime('14:30'); }}
                      className="px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 rounded font-bold text-gray-700"
                    >
                      6a-2:30p
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <input
                      type="time"
                      value={formStartTime}
                      onChange={(e) => setFormStartTime(e.target.value)}
                      className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    />
                  </div>
                  <div>
                    <input
                      type="time"
                      value={formEndTime}
                      onChange={(e) => setFormEndTime(e.target.value)}
                      className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Assign Personnel (Checklist / Chips) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-extrabold text-gray-600 uppercase tracking-wider">
                    Assign Crew Members ({formAssignedTo.length})
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (formAssignedTo.length === availableUsers.length) {
                        setFormAssignedTo([]);
                      } else {
                        setFormAssignedTo(availableUsers.map(u => String(u.id)));
                      }
                    }}
                    className="text-[10px] font-bold text-blue-600 hover:underline"
                  >
                    {formAssignedTo.length === availableUsers.length ? 'Clear All' : 'Select All'}
                  </button>
                </div>

                <div className="max-h-32 overflow-y-auto p-2 bg-gray-50 border border-gray-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {availableUsers.map((user) => {
                    const isSelected = formAssignedTo.includes(String(user.id));
                    return (
                      <label
                        key={user.id}
                        className={`flex items-center gap-2 p-1.5 rounded-lg border text-xs font-bold cursor-pointer transition-all ${
                          isSelected ? 'bg-blue-600 text-white border-blue-600 shadow-2xs' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormAssignedTo([...formAssignedTo, String(user.id)]);
                            } else {
                              setFormAssignedTo(formAssignedTo.filter(id => id !== String(user.id)));
                            }
                          }}
                          className="hidden"
                        />
                        <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border text-[9px] ${
                          isSelected ? 'bg-white text-blue-600 border-white font-black' : 'border-gray-300'
                        }`}>
                          {isSelected && '✓'}
                        </span>
                        <span className="truncate">{user.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Jobsite Address / Location */}
              <div>
                <label className="block text-xs font-extrabold text-gray-600 uppercase tracking-wider mb-1.5">
                  Worksite Address / Location
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="e.g. 742 Evergreen Terrace, Springfield or Bay 4"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* Special Instructions & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-extrabold text-gray-600 uppercase tracking-wider mb-1.5">
                    Shift Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="scheduled">⏳ Scheduled</option>
                    <option value="in-progress">⚡ In Progress</option>
                    <option value="completed">✅ Completed</option>
                    <option value="cancelled">🚫 Cancelled</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-gray-600 uppercase tracking-wider mb-1.5">
                    Priority
                  </label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as any)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="low">Normal</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High / Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-gray-600 uppercase tracking-wider mb-1.5">
                  Notes & Gate Instructions
                </label>
                <textarea
                  rows={2}
                  placeholder="Gate code #4920, PPE required, report to site foreman Dave upon arrival..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-800 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              {/* Modal Footer Buttons */}
              <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-3">
                {selectedEvent ? (
                  <button
                    type="button"
                    onClick={() => handleDelete(selectedEvent.id)}
                    className="px-4 py-2.5 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-extrabold transition-colors"
                  >
                    Delete Shift
                  </button>
                ) : (
                  <div></div>
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2.5 text-gray-500 hover:bg-gray-100 rounded-xl text-xs font-bold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black shadow-md hover:shadow-lg disabled:opacity-50 transition-all cursor-pointer"
                  >
                    {isSaving ? 'Saving...' : (selectedEvent ? 'Update Shift' : 'Schedule Job')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EVENT DETAILS POPUP MODAL */}
      {isDetailModalOpen && detailEvent && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <span 
                  style={{ backgroundColor: `${detailEvent.color || '#2563eb'}15`, color: detailEvent.color || '#2563eb', borderColor: `${detailEvent.color || '#2563eb'}30` }}
                  className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider border"
                >
                  💼 {detailEvent.projectName}
                </span>
                <h3 className="text-xl font-black text-gray-900 mt-2">
                  {detailEvent.title}
                </h3>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Details Content */}
            <div className="space-y-3.5 my-4 text-xs text-gray-700">
              {/* Date & Time */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl">
                <CalendarIcon className="w-5 h-5 text-blue-600 shrink-0" />
                <div>
                  <span className="font-extrabold text-gray-900 block text-sm">
                    {detailEvent.startDate} {detailEvent.endDate && detailEvent.endDate !== detailEvent.startDate ? `to ${detailEvent.endDate}` : ''}
                  </span>
                  <span className="text-gray-500 font-semibold">
                    {detailEvent.startTime || '07:30'} - {detailEvent.endTime || '16:00'}
                  </span>
                </div>
              </div>

              {/* Location */}
              {detailEvent.location && (
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-2xl">
                  <MapPin className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-gray-900 block">Worksite Location</span>
                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent(detailEvent.location)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline font-medium break-words inline-flex items-center gap-1 mt-0.5"
                    >
                      {detailEvent.location}
                      <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                    </a>
                  </div>
                </div>
              )}

              {/* Crew */}
              {detailEvent.assignedNames && detailEvent.assignedNames.length > 0 && (
                <div className="p-3 bg-gray-50 rounded-2xl">
                  <div className="flex items-center gap-2 mb-2 text-gray-900 font-extrabold">
                    <Users className="w-4 h-4 text-slate-500" />
                    <span>Assigned Team Members ({detailEvent.assignedNames.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {detailEvent.assignedNames.map((name, i) => (
                      <span key={i} className="inline-flex items-center gap-1 bg-white border border-gray-200 px-2.5 py-1 rounded-lg text-xs font-bold text-gray-800 shadow-2xs">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {detailEvent.notes && (
                <div className="p-3 bg-amber-50/60 border border-amber-200/60 rounded-2xl text-amber-950">
                  <span className="font-extrabold block mb-1 text-xs text-amber-900">📋 Special Notes / Gate Code:</span>
                  <p className="whitespace-pre-wrap leading-relaxed">{detailEvent.notes}</p>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="pt-4 border-t border-gray-100 flex items-center justify-between gap-2">
              <button
                onClick={() => openEditModal(detailEvent)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-black rounded-xl transition-colors flex items-center gap-1.5"
              >
                <Edit3 className="w-4 h-4" /> Edit Shift
              </button>

              {onClockInToJob && (
                <button
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    onClockInToJob(detailEvent.projectName);
                  }}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-md hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <PlayCircle className="w-4 h-4 stroke-[2.5]" />
                  <span>Clock In to Job</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
