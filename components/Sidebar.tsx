import React from 'react';
import { Clock, LayoutGrid, MessageSquare, Wallet, User, Lock, LogOut } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onLogout: () => void;
}

const NavItem = ({ icon: Icon, label, isActive, disabled, onClick }: any) => {
  if (disabled) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-lg text-blue-600/50 cursor-not-allowed">
        <Icon className="w-5 h-5" />
        <span className="font-medium flex-1">{label}</span>
        <Lock className="w-4 h-4 text-yellow-500" />
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
        isActive 
          ? 'bg-blue-800 text-white font-semibold' 
          : 'text-gray-300 hover:bg-blue-900 hover:text-white'
      }`}
    >
      <Icon className="w-5 h-5" />
      <span className="font-medium">{label}</span>
    </button>
  );
};

const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen, currentTab, setCurrentTab, onLogout }) => {
  return (
    <>
      {/* Backdrop for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden" 
          onClick={() => setIsOpen(false)}
        />
      )}
      
      <div 
        className={`fixed inset-y-0 left-0 w-64 bg-blue-950 z-50 transform transition-transform duration-300 ease-in-out border-r border-blue-800 flex flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="p-6">
          <h2 className="text-xl font-bold text-white tracking-tight">Pro<span className="text-blue-400">Contractor</span></h2>
        </div>

        <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
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
          />
          <NavItem 
            icon={User} 
            label="My Profile" 
            isActive={currentTab === 'profile'} 
            onClick={() => { setCurrentTab('profile'); setIsOpen(false); }} 
          />
        </nav>

        <div className="p-4 border-t border-blue-800">
          <button onClick={onLogout} className="w-full flex items-center justify-center gap-2 text-red-350 hover:text-white hover:bg-red-900/30 font-semibold py-2.5 rounded-xl transition-all cursor-pointer">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
          <div className="mt-4 text-center">
            <p className="text-white font-bold tracking-tight">ProContractor</p>
            <p className="text-gray-400 text-xs mt-0.5">Workforce Management</p>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
