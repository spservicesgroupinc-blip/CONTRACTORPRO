
import React from 'react';
import { TimeEntry, UserProfile } from '../types';

interface TimeLogProps {
  timeEntries: TimeEntry[];
  profile: UserProfile;
}

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

const TimeLog: React.FC<TimeLogProps> = ({ timeEntries, profile }) => {
    const calculateDuration = (clockIn: string, clockOut?: string): number => {
        if (!clockOut) return 0;
        const start = new Date(clockIn).getTime();
        const end = new Date(clockOut).getTime();
        return (end - start) / (1000 * 60 * 60); // duration in hours
    };

    const sortedEntries = [...timeEntries].sort((a, b) => new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime());

    return (
        <div className="w-full">
            {sortedEntries.length > 0 ? (
                <div className="space-y-4">
                    {sortedEntries.map((entry) => {
                        const duration = calculateDuration(entry.clockIn, entry.clockOut);
                        const pay = duration * profile.hourlyWage;
                        return (
                            <div key={entry.id} className="p-5 border border-gray-100 bg-white rounded-2xl shadow-sm flex flex-col">
                                <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                                    <div className="flex items-center gap-2">
                                        <p className="font-bold text-gray-800 text-sm">{new Date(entry.clockIn).toDateString()}</p>
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide bg-gray-100 text-gray-600 uppercase">
                                            {entry.projectName || 'General'}
                                        </span>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-extrabold text-[#101726] text-lg leading-none">{duration > 0 ? `${duration.toFixed(2)}h` : 'LIVE'}</p>
                                        <p className="text-xs font-bold text-[#10b981] mt-1">{pay > 0 ? `$${pay.toFixed(2)}` : ''}</p>
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
                    <p className="text-gray-400 font-medium">No time entries yet. Clock in to get started!</p>
                </div>
            )}
        </div>
    );
};

export default TimeLog;
