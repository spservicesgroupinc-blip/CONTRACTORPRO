import React from 'react';
import { Home, Clock, MessageSquare, Menu, Plus } from 'lucide-react';

interface BottomNavProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onFabClick: () => void;
  onMenuClick: () => void;
  unreadChatCount?: number;
}

const BottomNav: React.FC<BottomNavProps> = ({ currentTab, setCurrentTab, onFabClick, onMenuClick, unreadChatCount = 0 }) => {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 pointer-events-none pb-[env(safe-area-inset-bottom)] whitespace-nowrap will-change-transform">
      <div className="bg-white/95 backdrop-blur-lg border-t border-gray-200/80 shadow-[0_-8px_30px_-15px_rgba(0,0,0,0.12)] pointer-events-auto flex items-center justify-between h-16 max-w-md mx-auto px-4 transform-gpu">
        
        <button 
          onClick={() => setCurrentTab('time')} 
          className={`flex flex-col items-center justify-center min-w-[52px] h-12 rounded-xl transition-all active:scale-95 ${
            currentTab === 'time' ? 'text-blue-600 bg-blue-50/80 font-bold' : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <Clock className="w-5 h-5" />
          <span className="text-[11px] mt-0.5 tracking-tight">Clock</span>
        </button>
        
        <button 
          onClick={() => setCurrentTab('tasks')} 
          className={`flex flex-col items-center justify-center min-w-[52px] h-12 rounded-xl transition-all active:scale-95 ${
            currentTab === 'tasks' ? 'text-blue-600 bg-blue-50/80 font-bold' : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[11px] mt-0.5 tracking-tight">Tasks</span>
        </button>

        {/* Floating FAB */}
        <div className="relative flex justify-center w-14">
          <button 
            onClick={onFabClick}
            aria-label="Add Task"
            className="absolute -top-7 w-13 h-13 rounded-full bg-gradient-to-tr from-blue-600 to-blue-800 border-4 border-white shadow-xl shadow-blue-600/30 active:scale-90 transition-all will-change-transform transform-gpu text-white flex items-center justify-center ring-1 ring-black/5"
          >
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </button>
        </div>

        <button 
          onClick={() => setCurrentTab('chat')} 
          className={`flex flex-col items-center justify-center min-w-[52px] h-12 rounded-xl transition-all active:scale-95 ${
            currentTab === 'chat' ? 'text-blue-600 bg-blue-50/80 font-bold' : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <div className="relative">
            <MessageSquare className="w-5 h-5" />
            {unreadChatCount > 0 && (
              <span className="absolute -top-1 -right-1.5 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-red-500 text-[9px] font-extrabold text-white shadow-sm ring-2 ring-white">
                {unreadChatCount > 9 ? '9+' : unreadChatCount}
              </span>
            )}
          </div>
          <span className="text-[11px] mt-0.5 tracking-tight">Chat</span>
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

export default BottomNav;
