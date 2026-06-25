import React, { useState } from 'react';
import { TimeEntry, UserProfile } from '../types';
import { Edit2, Trash2, Plus, X, Calendar, Clock, AlertCircle, Check } from 'lucide-react';

interface TimeLogProps {
  timeEntries: TimeEntry[];
  profile: UserProfile;
  projects: string[];
  onUpdateEntry: (entry: TimeEntry) => void;
  onDeleteEntry: (id: string) => void;
  onAddEntry: (entry: TimeEntry) => void;
}

const formatToDatetimeLocal = (isoString?: string): string => {
    if (!isoString) return '';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    
    // Adjust to local timezone
    const offset = d.getTimezoneOffset();
    const localDate = new Date(d.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().slice(0, 16);
};

const LocationMap: React.FC<{ type: 'In' | 'Out', time: string, location?: { latitude: number; longitude: number; } }> = ({ type, time, location }) => {
    return (
        <div className="flex flex-col mb-4">
            <span className="text-sm font-semibold text-gray-700">{type}: {time}</span>
            {location ? (
                <a
                    href={`https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#2563eb] hover:underline mt-0.5 font-medium flex items-center gap-1"
                >
                    View on Map
                </a>
            ) : (
                <span className="text-xs text-gray-400 mt-0.5">Location not recorded</span>
            )}
        </div>
    );
};

const TimeLog: React.FC<TimeLogProps> = ({ 
    timeEntries, 
    profile, 
    projects = ['General'], 
    onUpdateEntry, 
    onDeleteEntry, 
    onAddEntry 
}) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
    const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
    
    // Form fields
    const [selectedProjectName, setSelectedProjectName] = useState('General');
    const [clockInVal, setClockInVal] = useState('');
    const [clockOutVal, setClockOutVal] = useState('');
    const [isLive, setIsLive] = useState(false);
    const [formError, setFormError] = useState('');

    const calculateDuration = (clockIn: string, clockOut?: string): number => {
        if (!clockOut) return 0;
        const start = new Date(clockIn).getTime();
        const end = new Date(clockOut).getTime();
        return Math.max(0, (end - start) / (1000 * 60 * 60)); // duration in hours
    };

    const handleOpenEditModal = (entry: TimeEntry) => {
        setModalMode('edit');
        setEditingEntryId(entry.id);
        setSelectedProjectName(entry.projectName || 'General');
        setClockInVal(formatToDatetimeLocal(entry.clockIn));
        setClockOutVal(entry.clockOut ? formatToDatetimeLocal(entry.clockOut) : '');
        setIsLive(!entry.clockOut);
        setFormError('');
        setIsModalOpen(true);
    };

    const handleOpenAddModal = () => {
        setModalMode('add');
        setEditingEntryId(null);
        setSelectedProjectName(projects[0] || 'General');
        
        // Default clock in to current time minus 1 hour, clock out to current time
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        setClockInVal(formatToDatetimeLocal(oneHourAgo.toISOString()));
        setClockOutVal(formatToDatetimeLocal(now.toISOString()));
        setIsLive(false);
        setFormError('');
        setIsModalOpen(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setFormError('');
        
        if (!clockInVal) {
            setFormError('Clock-in time is required.');
            return;
        }
        
        const inDate = new Date(clockInVal);
        let outDate: Date | null = null;
        
        if (!isLive) {
            if (!clockOutVal) {
                setFormError('Clock-out time is required if not currently active.');
                return;
            }
            outDate = new Date(clockOutVal);
            if (outDate.getTime() <= inDate.getTime()) {
                setFormError('Clock-out time must be after clock-in time.');
                return;
            }
        }
        
        const entryData: TimeEntry = {
            id: modalMode === 'edit' && editingEntryId ? editingEntryId : `entry_${Date.now()}`,
            projectName: selectedProjectName,
            clockIn: inDate.toISOString(),
            clockOut: isLive ? undefined : (outDate ? outDate.toISOString() : undefined),
            // Maintain locations if editing and they exist
            ...(modalMode === 'edit' && editingEntryId ? {
                clockInLocation: timeEntries.find(e => e.id === editingEntryId)?.clockInLocation,
                clockOutLocation: timeEntries.find(e => e.id === editingEntryId)?.clockOutLocation,
            } : {})
        };
        
        if (modalMode === 'edit') {
            onUpdateEntry(entryData);
        } else {
            onAddEntry(entryData);
        }
        
        setIsModalOpen(false);
    };

    const handleDelete = (id: string) => {
        if (window.confirm('Are you sure you want to delete this time entry? This action cannot be undone.')) {
            onDeleteEntry(id);
            setIsModalOpen(false);
        }
    };

    const sortedEntries = [...timeEntries].sort((a, b) => new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime());

    return (
        <div className="w-full flex flex-col">
            {/* Header / Add Button Row */}
            <div className="flex justify-between items-center px-5 py-4 border-b border-gray-100 bg-white">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Recorded Logs
                </span>
                <button
                    onClick={handleOpenAddModal}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#2563eb] font-extrabold text-xs rounded-xl transition-all cursor-pointer shadow-sm"
                >
                    <Plus className="w-3.5 h-3.5" />
                    Add Manual Log
                </button>
            </div>

            <div className="p-5">
                {sortedEntries.length > 0 ? (
                    <div className="space-y-4">
                        {sortedEntries.map((entry) => {
                            const duration = calculateDuration(entry.clockIn, entry.clockOut);
                            const pay = duration * profile.hourlyWage;
                            return (
                                <div key={entry.id} className="p-5 border border-gray-100 bg-white rounded-2xl shadow-sm flex flex-col relative group hover:border-gray-200 transition-all">
                                    <div className="flex items-start justify-between mb-4 pb-3 border-b border-gray-100">
                                        <div className="flex flex-col gap-1">
                                            <p className="font-bold text-gray-800 text-sm">
                                                {new Date(entry.clockIn).toDateString()}
                                            </p>
                                            <div>
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide bg-gray-100 text-gray-600 uppercase">
                                                    {entry.projectName || 'General'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => handleOpenEditModal(entry)}
                                                className="p-2 rounded-xl text-gray-400 hover:text-[#2563eb] hover:bg-blue-50 transition-all cursor-pointer"
                                                title="Edit Entry"
                                            >
                                                <Edit2 className="w-3.5 h-3.5" />
                                            </button>
                                            <div className="text-right">
                                                <p className="font-extrabold text-[#101726] text-lg leading-none">
                                                    {entry.clockOut ? `${duration.toFixed(2)}h` : 'LIVE'}
                                                </p>
                                                <p className="text-xs font-bold text-[#10b981] mt-1">
                                                    {pay > 0 ? `$${pay.toFixed(2)}` : ''}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col sm:flex-row gap-4 w-full">
                                        <div className="flex-1">
                                            <LocationMap 
                                                type="In" 
                                                time={new Date(entry.clockIn).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} 
                                                location={entry.clockInLocation} 
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <LocationMap 
                                                type="Out" 
                                                time={entry.clockOut ? new Date(entry.clockOut).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Still working...'} 
                                                location={entry.clockOutLocation} 
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="py-10 text-center">
                        <p className="text-gray-400 font-medium">No time entries yet. Add a manual log or clock in to get started!</p>
                    </div>
                )}
            </div>

            {/* Edit / Add Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div 
                        onClick={() => setIsModalOpen(false)}
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px] transition-opacity animate-fade-in"
                    />
                    
                    {/* Modal content */}
                    <div className="relative bg-white w-full max-w-sm rounded-3xl shadow-2xl border border-gray-100 p-6 z-10 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center mb-4 shrink-0 pb-3 border-b border-gray-100">
                            <h3 className="font-extrabold text-gray-950 text-base">
                                {modalMode === 'edit' ? 'Edit Time Log' : 'Add Manual Log'}
                            </h3>
                            <button 
                                onClick={() => setIsModalOpen(false)}
                                className="w-8 h-8 rounded-full bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-gray-750 flex items-center justify-center transition-all cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto pr-1 py-1 flex-1">
                            {formError && (
                                <div className="p-3 bg-red-50 text-red-800 rounded-xl border border-red-100 flex gap-2.5 items-start">
                                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                                    <p className="text-xs leading-snug font-semibold">{formError}</p>
                                </div>
                            )}

                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                                    Job / Customer
                                </label>
                                <select
                                    value={selectedProjectName}
                                    onChange={(e) => setSelectedProjectName(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 outline-none focus:bg-white focus:ring-2 focus:ring-[#2563eb] transition-all cursor-pointer"
                                >
                                    {projects.map((proj, idx) => (
                                        <option key={idx} value={proj}>
                                            💼 {proj}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                                    Clock In Date & Time
                                </label>
                                <input 
                                    type="datetime-local"
                                    required
                                    value={clockInVal}
                                    onChange={(e) => setClockInVal(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 outline-none focus:bg-white focus:ring-2 focus:ring-[#2563eb] transition-all cursor-pointer"
                                />
                            </div>

                            <div className="flex items-center gap-2 py-1">
                                <input 
                                    type="checkbox"
                                    id="isLive"
                                    checked={isLive}
                                    onChange={(e) => setIsLive(e.target.checked)}
                                    className="w-4.5 h-4.5 text-[#2563eb] rounded border-gray-300 focus:ring-[#2563eb] cursor-pointer"
                                />
                                <label htmlFor="isLive" className="text-xs font-bold text-gray-700 cursor-pointer select-none">
                                    Active / Currently clocked-in (Live)
                                </label>
                            </div>

                            {!isLive && (
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                                        Clock Out Date & Time
                                    </label>
                                    <input 
                                        type="datetime-local"
                                        required={!isLive}
                                        value={clockOutVal}
                                        onChange={(e) => setClockOutVal(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 outline-none focus:bg-white focus:ring-2 focus:ring-[#2563eb] transition-all cursor-pointer"
                                    />
                                </div>
                            )}

                            <div className="pt-4 flex gap-3 shrink-0">
                                {modalMode === 'edit' && (
                                    <button 
                                        type="button"
                                        onClick={() => handleDelete(editingEntryId!)}
                                        className="px-4 py-2.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer shrink-0"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        Delete
                                    </button>
                                )}
                                <button 
                                    type="submit"
                                    className="flex-1 py-2.5 bg-[#2563eb] hover:bg-blue-600 text-white font-extrabold text-xs rounded-xl shadow-md transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-1"
                                >
                                    <Check className="w-4 h-4" />
                                    Save Entry
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TimeLog;
