
import React, { useState } from 'react';
import { UserProfile } from '../types';
import { Briefcase, Loader2, ShieldCheck, User } from 'lucide-react';

interface ProfileSetupProps {
  onProfileSave: (profile: UserProfile) => void;
  onAdminAccess?: () => void;
}

const ProfileSetup: React.FC<ProfileSetupProps> = ({ onProfileSave, onAdminAccess }) => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isTestLoading, setIsTestLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    
    setError('');
    setIsTestLoading(true);

    try {
        const response = await fetch('/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                payload: { action: 'LOGIN_USER', payload: { name: name.trim() } }
            })
        });
        const result = await response.json();
        if (result.success && result.user) {
            onProfileSave({
                id: result.user.id,
                name: result.user.name,
                hourlyWage: parseFloat(result.user.hourlyWage) || 0
            });
        } else {
            throw new Error(result.error || 'User not found in Company Master Sheet.');
        }
    } catch (err: any) {
      setError(err.message || 'Failed to finish setup.');
    } finally {
      setIsTestLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[100dvh] bg-gradient-to-b from-slate-900 via-blue-950 to-slate-900 text-gray-800 p-4">
      <div className="w-full max-w-md p-8 bg-white/95 backdrop-blur-xl rounded-[28px] shadow-2xl border border-white/20 flex flex-col gap-6">
        <div className="text-center">
          <div className="w-18 h-18 bg-gradient-to-tr from-slate-900 via-blue-950 to-slate-900 text-white rounded-2xl flex items-center justify-center mx-auto mb-4 font-black text-2xl shadow-xl shadow-slate-900/30 ring-4 ring-orange-100 border border-slate-700/60 relative overflow-hidden">
            <img src="/pwa-icon.svg" alt="TKO Logo" className="w-full h-full object-cover rounded-2xl" referrerPolicy="no-referrer" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center justify-center gap-1.5">
            <span>TKO</span>
            <span className="text-orange-600 font-extrabold">Field Operations</span>
          </h2>
          <p className="mt-1 text-xs font-bold text-slate-500 uppercase tracking-widest">
            Workforce Portal Login
          </p>
          <p className="mt-2 text-sm text-gray-500 font-medium">
            Enter your full name as registered in the company sheet.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5 ml-1 uppercase tracking-wider">Full Name</label>
            <div className="relative">
              <User className="absolute left-3.5 top-3.5 w-5 h-5 text-gray-400" />
              <input
                type="text"
                required
                className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all font-semibold text-gray-800 placeholder-gray-400"
                placeholder="e.g. John Smith"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-semibold text-center">
              {error}
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={isTestLoading}
              className="w-full bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-blue-700/25 transition-all disabled:opacity-70 flex justify-center items-center gap-2 cursor-pointer"
            >
              {isTestLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <span>Access Timesheet</span>
              )}
            </button>
          </div>
        </form>

        {onAdminAccess && (
          <div className="pt-2 border-t border-gray-100">
            <button 
              type="button" 
              onClick={onAdminAccess}
              className="w-full flex items-center justify-center gap-2 text-xs font-bold text-gray-500 hover:text-blue-700 bg-gray-50 hover:bg-blue-50/50 border border-gray-200 py-3 rounded-xl transition-all cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span>Owner & Admin Portal Login</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileSetup;
