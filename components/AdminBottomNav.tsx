import React from 'react';
import { Home, Users, MapPin, Menu, FileText } from 'lucide-react';

interface AdminBottomNavProps {
  currentTab: string;
  setCurrentTab: (tab: any) => void;
  onMenuClick: () => void;
}

const AdminBottomNav: React.FC<AdminBottomNavProps> = ({ currentTab, setCurrentTab, onMenuClick }) => {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 pointer-events-none pb-[env(safe-area-inset-bottom)] whitespace-nowrap will-change-transform">
      <div className="bg-white/95 backdrop-blur-lg border-t md:border border-gray-200/80 shadow-[0_-8px_30px_-15px_rgba(0,0,0,0.12)] md:shadow-xl pointer-events-auto flex items-center justify-between h-16 max-w-md md:max-w-xl mx-auto px-4 md:rounded-2xl md:mb-3 transform-gpu">
        
        <button 
          onClick={() => setCurrentTab('hub')} 
          className={`flex flex-col items-center justify-center min-w-[52px] h-12 rounded-xl transition-all active:scale-95 ${
            currentTab === 'hub' ? 'text-blue-600 bg-blue-50/80 font-bold' : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[11px] mt-0.5 tracking-tight">Hub</span>
        </button>
        
        <button 
          onClick={() => setCurrentTab('live')} 
          className={`flex flex-col items-center justify-center min-w-[52px] h-12 rounded-xl transition-all active:scale-95 ${
            currentTab === 'live' ? 'text-blue-600 bg-blue-50/80 font-bold' : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <MapPin className="w-5 h-5" />
          <span className="text-[11px] mt-0.5 tracking-tight">Live</span>
        </button>

        {/* Floating FAB */}
        <div className="relative flex justify-center w-14">
          <button 
            onClick={() => setCurrentTab('employees')}
            aria-label="Employees"
            className="absolute -top-7 w-13 h-13 rounded-full bg-gradient-to-tr from-emerald-600 to-emerald-800 border-4 border-white shadow-xl shadow-emerald-600/30 active:scale-90 transition-all will-change-transform transform-gpu text-white flex items-center justify-center ring-1 ring-black/5"
          >
            <Users className="w-6 h-6 stroke-[2.5]" />
          </button>
        </div>

        <button 
          onClick={() => setCurrentTab('invoices')} 
          className={`flex flex-col items-center justify-center min-w-[52px] h-12 rounded-xl transition-all active:scale-95 ${
            currentTab === 'invoices' ? 'text-blue-600 bg-blue-50/80 font-bold' : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <FileText className="w-5 h-5" />
          <span className="text-[11px] mt-0.5 tracking-tight">Billing</span>
        </button>

        <button 
          onClick={onMenuClick} 
          className="flex flex-col items-center justify-center min-w-[52px] h-12 rounded-xl text-gray-500 hover:text-gray-800 transition-all active:scale-95"
        >
          <Menu className="w-5 h-5" />
          <span className="text-[11px] mt-0.5 tracking-tight">Menu</span>
        </button>

      </div>
    </div>
  );
};

export default AdminBottomNav;
