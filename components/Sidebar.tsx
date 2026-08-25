import React from 'react';
import { Clock, LayoutGrid, MessageSquare, Wallet, User, Lock, LogOut, Briefcase } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onLogout: () => void;
  unreadChatCount?: number;
}

const NavItem = ({ icon: Icon, label, isActive, disabled, onClick, badge }: any) => {
  if (disabled) {
    return (
      <div className="flex items-center gap-3 px-3.5 py-3 rounded-xl text-slate-500/60 cursor-not-allowed">
        <Icon className="w-5 h-5 shrink-0" />
        <span className="font-semibold text-sm flex-1">{label}</span>
        <Lock className="w-4 h-4 text-amber-500/80" />
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl transition-all cursor-pointer ${
        isActive 
          ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30' 
          : 'text-slate-300 hover:bg-slate-800/80 hover:text-white font-medium'
      }`}
    >
      <div className="flex items-center gap-3">
        <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
        <span className="text-sm tracking-tight">{label}</span>
      </div>
      {badge > 0 && (
        <span className="flex h-5 min-w-5 px-1.5 items-center justify-center rounded-full bg-red-500 text-[10px] font-extrabold text-white shadow-sm ring-2 ring-slate-900">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  );
};

const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen, currentTab, setCurrentTab, onLogout, unreadChatCount = 0 }) => {
  return (
    <>
      {/* Backdrop for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40 md:hidden transition-opacity" 
          onClick={() => setIsOpen(false)}
        />
      )}
      
      <div 
        className={`fixed inset-y-0 left-0 w-64 bg-slate-900 z-50 transform transition-transform duration-300 ease-in-out border-r border-slate-800/80 flex flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="p-6 pb-5 flex items-center gap-3 border-b border-slate-800/60">
          <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700/80 flex items-center justify-center text-white shadow-lg shadow-orange-600/10 overflow-hidden shrink-0">
            <img src="/pwa-icon.svg" alt="KS Enterprise" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          </div>
          <div>
            <h2 className="text-lg font-black text-white tracking-tight leading-none flex items-center gap-1">
              <span className="text-orange-500 font-black">KS</span>
              <span className="text-white">Enterprise</span>
            </h2>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 block">
              Building Dreams
            </span>
          </div>
        </div>

        <nav className="flex-1 px-3.5 py-4 space-y-1.5 overflow-y-auto">
          <NavItem 
            icon={Clock} 
            label="Time Tracker" 
            isActive={currentTab === 'time'} 
            onClick={() => { setCurrentTab('time'); setIsOpen(false); }} 
          />
          <NavItem 
            icon={LayoutGrid} 
            label="Job Checklists" 
            isActive={currentTab === 'tasks'} 
            onClick={() => { setCurrentTab('tasks'); setIsOpen(false); }} 
          />
          <NavItem 
            icon={Wallet} 
            label="Pay Log" 
            isActive={currentTab === 'paylog'} 
            onClick={() => { setCurrentTab('paylog'); setIsOpen(false); }} 
          />
          <NavItem 
            icon={MessageSquare} 
            label="Team Chat" 
            isActive={currentTab === 'chat'} 
            onClick={() => { setCurrentTab('chat'); setIsOpen(false); }}
            badge={unreadChatCount}
          />
          <NavItem 
            icon={User} 
            label="My Profile" 
            isActive={currentTab === 'profile'} 
            onClick={() => { setCurrentTab('profile'); setIsOpen(false); }} 
          />
        </nav>

        <div className="p-4 border-t border-slate-800/80 bg-slate-950/40">
          <button 
            onClick={onLogout} 
            className="w-full flex items-center justify-center gap-2 text-rose-400 hover:text-white hover:bg-rose-950/40 border border-rose-900/30 font-semibold py-2.5 rounded-xl transition-all cursor-pointer text-sm"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
          <div className="mt-4 text-center">
            <p className="text-slate-400 text-[11px] font-medium">Synced with Master Google Sheet</p>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
