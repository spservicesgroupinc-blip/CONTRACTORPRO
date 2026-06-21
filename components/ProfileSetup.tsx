
import React, { useState } from 'react';
import { UserProfile } from '../types';

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
    <div className="flex items-center justify-center min-h-[100dvh] bg-gray-50 text-gray-800 p-4">
      <div className="w-full max-w-md p-8 bg-white rounded-[24px] shadow-sm flex flex-col gap-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-950 text-white rounded-2xl flex items-center justify-center mx-auto mb-4 font-bold text-2xl shadow-lg">
             GT
          </div>
          <h2 className="text-2xl font-bold text-gray-900">
            Employee Login
          </h2>
          <p className="mt-2 text-sm text-gray-500 font-medium">
            Enter your name to access your timesheet.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1 ml-1 uppercase">Full Name</label>
            <input
              type="text"
              required
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:bg-white transition-all font-semibold text-gray-700"
              placeholder="Your Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {error && <p className="text-sm font-semibold text-red-500 text-center">{error}</p>}

          <div className="pt-2">
            <button
              type="submit"
              disabled={isTestLoading}
              className="w-full bg-blue-950 text-white py-3.5 rounded-xl font-bold shadow-md hover:bg-gray-800 transition-colors disabled:opacity-70 flex justify-center items-center gap-2"
            >
              {isTestLoading ? 'Connecting...' : 'Login'}
            </button>
          </div>
        </form>
        {onAdminAccess && (
          <button 
            type="button" 
            onClick={onAdminAccess}
            className="w-full mt-4 text-sm font-bold text-gray-400 hover:text-gray-600 border border-gray-200 py-3 rounded-xl transition-colors"
          >
            Owner/Admin Panel Login
          </button>
        )}
      </div>
    </div>
  );
};

export default ProfileSetup;
