import React from 'react';
import { Home, Users, MapPin, Menu, Plus } from 'lucide-react';

interface AdminBottomNavProps {
  currentTab: string;
  setCurrentTab: (tab: any) => void;
  onMenuClick: () => void;
}

const AdminBottomNav: React.FC<AdminBottomNavProps> = ({ currentTab, setCurrentTab, onMenuClick }) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none pb-[env(safe-area-inset-bottom)] whitespace-nowrap will-change-transform">
      <div className="bg-white/95 backdrop-blur-md border-t border-gray-200/60 shadow-[0_-8px_30px_-15px_rgba(0,0,0,0.1)] pointer-events-auto flex items-center justify-between h-16 max-w-md mx-auto px-4 transform-gpu">
        
        <button 
          onClick={() => setCurrentTab('hub')} 
          className={`flex flex-col items-center justify-center gap-1 w-12 transition-colors active:scale-95 ${currentTab === 'hub' ? 'text-blue-600 font-semibold' : 'text-gray-400'}`}
        >
          <Home className="w-6 h-6" />
          <span className="text-[10px]">Hub</span>
        </button>
        
        <button 
          onClick={() => setCurrentTab('live')} 
          className={`flex flex-col items-center justify-center gap-1 w-12 transition-colors active:scale-95 ${currentTab === 'live' ? 'text-blue-600 font-semibold' : 'text-gray-400'}`}
        >
          <MapPin className="w-6 h-6" />
          <span className="text-[10px]">Live</span>
        </button>

        {/* Floating FAB */}
        <div className="relative flex justify-center w-16">
          <button 
            onClick={() => setCurrentTab('employees')}
            className="absolute -top-10 w-14 h-14 rounded-full bg-gradient-to-tr from-emerald-500 to-emerald-700 border-4 border-white shadow-lg shadow-emerald-600/30 active:scale-95 transition-transform will-change-transform transform-gpu text-white flex items-center justify-center"
          >
            <Users className="w-7 h-7 stroke-2" />
          </button>
        </div>

        <button 
          onClick={() => setCurrentTab('invoices')} 
          className={`flex flex-col items-center justify-center gap-1 w-12 transition-colors active:scale-95 ${currentTab === 'invoices' ? 'text-blue-600 font-semibold' : 'text-gray-400'}`}
        >
          <span className="text-xl leading-none pt-1">📄</span>
          <span className="text-[10px] mt-1">Billing</span>
        </button>

        <button 
          onClick={onMenuClick} 
          className="flex flex-col items-center justify-center gap-1 w-12 text-gray-400 transition-colors active:scale-95"
        >
          <Menu className="w-6 h-6" />
          <span className="text-[10px]">Menu</span>
        </button>

      </div>
    </div>
  );
};

export default AdminBottomNav;
