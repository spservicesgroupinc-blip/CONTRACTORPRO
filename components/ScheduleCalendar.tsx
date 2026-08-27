import React, { useState, useMemo } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  X, 
  CalendarDays, 
  PlayCircle,
  Briefcase,
  FileText,
  RotateCw
} from 'lucide-react';
import { ScheduleEvent, UserProfile } from '../types';

interface ScheduleCalendarProps {
  schedules: ScheduleEvent[];
  onSaveSchedule: (schedule: ScheduleEvent) => Promise<void> | void;
  onDeleteSchedule: (scheduleId: string) => Promise<void> | void;
  currentUser?: UserProfile | null;
  projects: string[];
  onClockInToJob?: (projectName: string) => void;
  isLoading?: boolean;
  onRefresh?: () => void;
}

type ViewMode = 'month' | 'week' | 'list';

export const ScheduleCalendar: React.FC<ScheduleCalendarProps> = ({
  schedules = [],
  onSaveSchedule,
  onDeleteSchedule,
  currentUser,
  projects = ['General'],
  onClockInToJob,
  isLoading = false,
  onRefresh
}) => {
  // Calendar navigation
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  
  // Filters
  const [selectedJobFilter, setSelectedJobFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // Form State (Simplified strictly to: Job, Start Date, Optional End Date, Optional Notes)
  const [isNewJobMode, setIsNewJobMode] = useState<boolean>(false);
  const [formSavedJob, setFormSavedJob] = useState<string>('');
  const [formNewJobName, setFormNewJobName] = useState<string>('');
  const [formStartDate, setFormStartDate] = useState<string>('');
  const [formEndDate, setFormEndDate] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Helper date conversions
  const toYMD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const todayYMD = toYMD(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  // Filtered schedules
  const filteredSchedules = useMemo(() => {
    return schedules.filter(ev => {
      const jobName = ev.projectName || ev.title || 'General';
      if (selectedJobFilter !== 'all' && jobName !== selectedJobFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = jobName.toLowerCase().includes(q);
        const matchNotes = (ev.notes || '').toLowerCase().includes(q);
        if (!matchName && !matchNotes) return false;
      }
      return true;
    });
  }, [schedules, selectedJobFilter, searchQuery]);

  // Navigate dates
  const handlePrev = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(year, month - 1, 1));
    } else if (viewMode === 'week') {
      const prev = new Date(currentDate);
      prev.setDate(prev.getDate() - 7);
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
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Open Create Modal
  const openCreateModal = (defaultDate?: string) => {
    const targetDate = defaultDate || toYMD(currentDate);
    setSelectedEventId(null);
    setIsNewJobMode(projects.length === 0);
    setFormSavedJob(projects[0] || 'General');
    setFormNewJobName('');
    setFormStartDate(targetDate);
    setFormEndDate('');
    setFormNotes('');
    setFormError(null);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (event: ScheduleEvent) => {
    setSelectedEventId(event.id);
    const jobName = event.projectName || event.title || 'General';
    const isExistingInList = projects.includes(jobName);
    
    if (isExistingInList) {
      setIsNewJobMode(false);
      setFormSavedJob(jobName);
      setFormNewJobName('');
    } else {
      setIsNewJobMode(true);
      setFormSavedJob(projects[0] || 'General');
      setFormNewJobName(jobName);
    }

    setFormStartDate(event.startDate || toYMD(new Date()));
    setFormEndDate(event.endDate && event.endDate !== event.startDate ? event.endDate : '');
    setFormNotes(event.notes || '');
    setFormError(null);
    setIsModalOpen(true);
  };

  // Handle Save
  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const finalJobName = isNewJobMode ? formNewJobName.trim() : formSavedJob.trim();
    if (!finalJobName) {
      setFormError('Please select or enter a job name.');
      return;
    }

    if (!formStartDate) {
      setFormError('Please choose a start date.');
      return;
    }

    if (formEndDate && formEndDate < formStartDate) {
      setFormError('End date cannot be earlier than the start date.');
      return;
    }

    const payload: ScheduleEvent = {
      id: selectedEventId || ('sched_' + Math.random().toString(36).substring(2, 10)),
      title: finalJobName,
      projectName: finalJobName,
      startDate: formStartDate,
      endDate: formEndDate ? formEndDate : formStartDate,
      notes: formNotes.trim() || undefined,
      assignedTo: ['all'],
      assignedNames: ['All Staff / Entire Crew'],
      status: 'scheduled',
      createdAt: new Date().toISOString(),
      createdBy: currentUser?.name || 'Staff Member'
    };

    setIsSaving(true);
    try {
      await onSaveSchedule(payload);
      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save schedule.');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Delete
  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this scheduled job?')) return;
    setIsSaving(true);
    try {
      await onDeleteSchedule(id);
      setIsModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to delete');
    } finally {
      setIsSaving(false);
    }
  };

  // Month view day cells calculation
  const monthDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay();
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

    // Current month
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

    // Next month padding
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

  // Week view calculation
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

  // Sorted list events
  const listEvents = useMemo(() => {
    return [...filteredSchedules].sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
  }, [filteredSchedules]);

  return (
    <div id="schedule-container" className="w-full flex flex-col gap-3 pb-28">
      {/* 1. Mobile-Optimized Compact Header Bar */}
      <div className="bg-slate-900 text-white rounded-2xl p-3 sm:p-4 shadow-md border border-slate-800 flex flex-col gap-3">
        {/* Row 1: Month/Title + Navigation Chevrons + Action Button */}
        <div className="flex items-center justify-between gap-2">
          {/* Month/Year Title & Navigation */}
          <div className="flex items-center gap-1.5 min-w-0">
            {viewMode !== 'list' ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={handlePrev}
                  className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-white bg-slate-800 active:bg-slate-700 rounded-xl transition-colors cursor-pointer shrink-0"
                  aria-label="Previous"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                
                <h2 className="text-base sm:text-lg font-black text-white px-1 tracking-tight truncate">
                  {viewMode === 'month' && formatMonthYear(currentDate)}
                  {viewMode === 'week' && `${weekDays[0]?.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekDays[6]?.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                </h2>

                <button
                  onClick={handleNext}
                  className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-white bg-slate-800 active:bg-slate-700 rounded-xl transition-colors cursor-pointer shrink-0"
                  aria-label="Next"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                <button
                  onClick={handleToday}
                  className="px-2 py-1 text-[11px] font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer hidden xs:inline-block ml-1"
                >
                  Today
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-blue-400 shrink-0" />
                <h2 className="text-base sm:text-lg font-black text-white">All Scheduled Jobs</h2>
              </div>
            )}
          </div>

          {/* Quick Actions (Refresh + Add Job) */}
          <div className="flex items-center gap-1.5 shrink-0">
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={isLoading}
                title="Sync from Google Sheets"
                className="w-9 h-9 flex items-center justify-center text-slate-300 hover:text-white bg-slate-800 active:bg-slate-700 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-400' : ''}`} />
              </button>
            )}

            <button
              id="btn-add-schedule"
              onClick={() => openCreateModal()}
              className="flex items-center justify-center gap-1 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs px-3.5 h-9 rounded-xl shadow-md transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span className="hidden xs:inline">Add Job</span>
              <span className="xs:hidden">Add</span>
            </button>
          </div>
        </div>

        {/* Row 2: View Switcher Tabs (Month | Week | List) */}
        <div className="flex items-center justify-between bg-slate-800/90 p-1 rounded-xl border border-slate-700/60">
          <button
            onClick={() => setViewMode('month')}
            className={`flex-1 py-1.5 text-center rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'month' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Month
          </button>
          <button
            onClick={() => setViewMode('week')}
            className={`flex-1 py-1.5 text-center rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'week' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Week
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`flex-1 py-1.5 text-center rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'list' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            List ({filteredSchedules.length})
          </button>
        </div>
      </div>

      {/* 2. Sleek Filter Toolbar (Search & Job dropdown) */}
      <div className="grid grid-cols-1 xs:grid-cols-12 gap-2 bg-white p-2.5 rounded-2xl border border-gray-200 shadow-2xs">
        {/* Search */}
        <div className="relative xs:col-span-7">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search job name or notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-7 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-800 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')} 
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Job Filter */}
        <div className="xs:col-span-5">
          <select
            value={selectedJobFilter}
            onChange={(e) => setSelectedJobFilter(e.target.value)}
            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer truncate"
          >
            <option value="all">💼 All Jobs</option>
            {projects.map((p, idx) => (
              <option key={idx} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 3. Main Views Container */}
      <div className="bg-white rounded-2xl p-2 sm:p-4 shadow-sm border border-gray-200">
        {/* A. MONTH VIEW (Mobile-Optimized Grid) */}
        {viewMode === 'month' && (
          <div>
            {/* Days Header */}
            <div className="grid grid-cols-7 mb-1.5 text-center text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-wider py-1 border-b border-gray-100">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <div key={i} className={i === 0 || i === 6 ? 'text-gray-300' : 'text-gray-500'}>
                  <span className="sm:hidden">{d}</span>
                  <span className="hidden sm:inline">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i]}</span>
                </div>
              ))}
            </div>

            {/* Calendar Cells Grid */}
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
              {monthDays.map((day, idx) => {
                const hasEvents = day.events.length > 0;
                return (
                  <div
                    key={idx}
                    onClick={() => {
                      if (hasEvents && day.events[0]) {
                        openEditModal(day.events[0]);
                      } else {
                        openCreateModal(day.ymd);
                      }
                    }}
                    className={`min-h-[56px] xs:min-h-[68px] sm:min-h-[96px] p-1 sm:p-1.5 rounded-xl border transition-all flex flex-col justify-between cursor-pointer active:scale-98 ${
                      day.isCurrentMonth 
                        ? hasEvents 
                          ? 'bg-blue-50/40 border-blue-200/80 hover:bg-blue-50' 
                          : 'bg-white hover:bg-gray-50 border-gray-150' 
                        : 'bg-gray-50/40 text-gray-300 border-gray-100'
                    } ${day.isToday ? 'ring-2 ring-blue-600 bg-blue-50/50 border-transparent shadow-xs' : ''}`}
                  >
                    {/* Date Header */}
                    <div className="flex items-center justify-between">
                      <span className={`text-[11px] sm:text-xs font-black w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center rounded-full ${
                        day.isToday 
                          ? 'bg-blue-600 text-white shadow-2xs' 
                          : day.isCurrentMonth ? 'text-gray-800' : 'text-gray-300'
                      }`}>
                        {day.dayNumber}
                      </span>

                      {/* Plus icon on hover for larger screens */}
                      <span className="hidden sm:inline text-blue-500 opacity-0 hover:opacity-100 p-0.5">
                        <Plus className="w-3 h-3" />
                      </span>
                    </div>

                    {/* Mobile & Tablet Event Indicators */}
                    <div className="flex flex-col gap-0.5 mt-0.5">
                      {/* On small mobile: compact colored dot / pill */}
                      {hasEvents && (
                        <div className="sm:hidden">
                          <div className="bg-blue-600 text-white text-[9px] font-black px-1 py-0.5 rounded-md truncate leading-tight text-center shadow-2xs">
                            {day.events.length === 1 ? day.events[0].projectName || day.events[0].title : `${day.events.length} Jobs`}
                          </div>
                        </div>
                      )}

                      {/* On desktop/tablet (sm+): full chip list */}
                      <div className="hidden sm:flex flex-col gap-1 overflow-hidden">
                        {day.events.slice(0, 2).map((ev) => (
                          <div
                            key={ev.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModal(ev);
                            }}
                            className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-blue-100/90 text-blue-900 truncate border border-blue-200"
                            title={ev.projectName || ev.title}
                          >
                            {ev.projectName || ev.title}
                          </div>
                        ))}
                        {day.events.length > 2 && (
                          <span className="text-[9px] font-black text-blue-600 pl-0.5">
                            +{day.events.length - 2} more
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* B. WEEK VIEW */}
        {viewMode === 'week' && (
          <div className="flex flex-col gap-2">
            {weekDays.map((day, idx) => (
              <div 
                key={idx} 
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border p-2.5 transition-all ${
                  day.isToday 
                    ? 'bg-blue-50/40 border-blue-300 ring-2 ring-blue-600/30 shadow-xs' 
                    : 'bg-white border-gray-200'
                }`}
              >
                {/* Day Header */}
                <div className="flex items-center justify-between sm:w-36 shrink-0">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg flex flex-col items-center justify-center font-bold ${
                      day.isToday ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
                    }`}>
                      <span className="text-[8px] uppercase leading-none">{day.date.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                      <span className="text-xs font-black leading-none mt-0.5">{day.dayNumber}</span>
                    </div>
                    <span className="text-xs font-bold text-gray-800">
                      {day.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>

                  <button
                    onClick={() => openCreateModal(day.ymd)}
                    className="sm:hidden p-1.5 text-blue-600 bg-blue-50 active:bg-blue-100 rounded-lg cursor-pointer"
                    title="Add Job"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Day Events */}
                <div className="flex-1 flex flex-wrap gap-1.5 items-center">
                  {day.events.length > 0 ? (
                    day.events.map(ev => {
                      const jobName = ev.projectName || ev.title || 'General';
                      return (
                        <div
                          key={ev.id}
                          onClick={() => openEditModal(ev)}
                          className="px-2.5 py-1.5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-950 text-xs font-bold cursor-pointer transition-all flex items-center gap-2 shadow-2xs"
                        >
                          <span>💼 {jobName}</span>
                          {ev.notes && <span className="text-[10px] text-blue-600 font-medium">({ev.notes})</span>}
                          <Edit3 className="w-3 h-3 text-blue-400 shrink-0" />
                        </div>
                      );
                    })
                  ) : (
                    <span className="text-xs text-gray-400 italic pl-1">No jobs scheduled</span>
                  )}
                </div>

                {/* Desktop Add Button */}
                <button
                  onClick={() => openCreateModal(day.ymd)}
                  className="hidden sm:flex items-center gap-1 text-xs font-bold text-blue-600 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
            ))}
          </div>
        )}

        {/* C. LIST VIEW (Highly Scannable Mobile Cards) */}
        {viewMode === 'list' && (
          <div className="flex flex-col gap-2.5">
            {listEvents.length > 0 ? (
              listEvents.map((ev) => {
                const jobName = ev.projectName || ev.title || 'General';
                const isMultiDay = ev.endDate && ev.endDate !== ev.startDate;
                return (
                  <div
                    key={ev.id}
                    onClick={() => openEditModal(ev)}
                    className="p-3 bg-white hover:bg-blue-50/20 active:bg-blue-50/40 rounded-2xl border border-gray-200 shadow-2xs transition-all flex flex-col gap-2 cursor-pointer"
                  >
                    {/* Top Row: Job Name + Dates */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 font-black flex items-center justify-center shrink-0 border border-blue-200 text-xs">
                          💼
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-black text-gray-900 truncate">{jobName}</h4>
                          <span className="text-[11px] font-extrabold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100 inline-block mt-0.5">
                            📅 {ev.startDate} {isMultiDay ? `→ ${ev.endDate}` : ''}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(ev);
                        }}
                        className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg cursor-pointer shrink-0"
                        title="Edit"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Notes (if any) */}
                    {ev.notes && (
                      <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded-xl border border-gray-100 italic">
                        {ev.notes}
                      </p>
                    )}

                    {/* Action Bar (Clock In) */}
                    {onClockInToJob && (
                      <div className="pt-1 border-t border-gray-100 flex justify-end">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onClockInToJob(jobName);
                          }}
                          className="w-full xs:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <PlayCircle className="w-3.5 h-3.5" /> Clock In to Job
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="py-10 text-center border border-dashed border-gray-200 rounded-2xl bg-gray-50/50 p-4">
                <CalendarDays className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <h4 className="text-xs font-bold text-gray-700 mb-1">No Scheduled Jobs Found</h4>
                <p className="text-[11px] text-gray-400 max-w-xs mx-auto mb-3">
                  Keep the whole crew on the same page with start and end dates.
                </p>
                <button
                  onClick={() => openCreateModal()}
                  className="inline-flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Job
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. MODAL: ROBUST & PROFESSIONAL SMARTPHONE-FIRST DIALOG */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          {/* Modal Card (Slides up on mobile like native iOS/Android sheet) */}
          <div 
            className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto"
            style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <CalendarDays className="w-4 h-4" />
                </div>
                <h3 className="text-base font-black text-gray-900">
                  {selectedEventId ? 'Edit Scheduled Job' : 'Add to Schedule'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveForm} className="mt-4 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold">
                  {formError}
                </div>
              )}

              {/* 1. Job / Project */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-extrabold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-blue-600" />
                    Job / Project *
                  </label>
                  
                  <button
                    type="button"
                    onClick={() => setIsNewJobMode(!isNewJobMode)}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                  >
                    {isNewJobMode ? '← Choose Saved' : '+ New Job'}
                  </button>
                </div>

                {!isNewJobMode ? (
                  <select
                    value={formSavedJob}
                    onChange={(e) => {
                      if (e.target.value === '__add_new__') {
                        setIsNewJobMode(true);
                      } else {
                        setFormSavedJob(e.target.value);
                      }
                    }}
                    className="w-full h-11 px-3.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all cursor-pointer"
                  >
                    {projects.map((p, idx) => (
                      <option key={idx} value={p}>
                        💼 {p}
                      </option>
                    ))}
                    <option value="__add_new__">+ Enter New Job Name...</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="Enter new job name (e.g. 104 Elm St Remodel)"
                    value={formNewJobName}
                    onChange={(e) => setFormNewJobName(e.target.value)}
                    className="w-full h-11 px-3.5 bg-blue-50/40 border border-blue-300 rounded-xl text-xs font-bold text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    autoFocus
                  />
                )}
              </div>

              {/* 2. Start Date & Optional End Date */}
              <div className="grid grid-cols-1 xs:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-1.5">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full h-11 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white cursor-pointer"
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-extrabold text-gray-700 uppercase tracking-wider">
                      End Date
                    </label>
                    <span className="text-[10px] text-gray-400 font-medium">Optional</span>
                  </div>
                  <input
                    type="date"
                    value={formEndDate}
                    min={formStartDate || undefined}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    placeholder="Same day if blank"
                    className="w-full h-11 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white cursor-pointer"
                  />
                </div>
              </div>

              {/* 3. Notes (Optional) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-extrabold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-gray-500" />
                    Notes / Instructions
                  </label>
                  <span className="text-[10px] text-gray-400 font-medium">Optional</span>
                </div>
                <textarea
                  rows={2}
                  placeholder="Gate codes, worksite address, materials needed, etc."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-800 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all resize-none"
                />
              </div>

              {/* Action Buttons (Touch target min 44px) */}
              <div className="pt-3 flex items-center justify-between gap-2 border-t border-gray-100">
                {selectedEventId ? (
                  <button
                    type="button"
                    onClick={() => handleDelete(selectedEventId)}
                    disabled={isSaving}
                    className="h-11 px-3.5 text-red-600 hover:bg-red-50 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                ) : <div />}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    disabled={isSaving}
                    className="h-11 px-4 text-gray-600 hover:bg-gray-100 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={isSaving}
                    className="h-11 px-5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-xl shadow-md disabled:opacity-50 transition-all cursor-pointer flex items-center justify-center min-w-[100px]"
                  >
                    {isSaving ? 'Saving...' : selectedEventId ? 'Update' : 'Save'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
