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
      <div className="bg-white/95 backdrop-blur-md border-t border-gray-200/60 shadow-[0_-8px_30px_-15px_rgba(0,0,0,0.1)] pointer-events-auto flex items-center justify-between h-16 max-w-md mx-auto px-4 transform-gpu">
        
        <button 
          onClick={() => setCurrentTab('time')} 
          className={`flex flex-col items-center justify-center gap-1 w-12 transition-colors active:scale-95 ${currentTab === 'time' ? 'text-blue-600 font-semibold' : 'text-gray-400'}`}
        >
          <Clock className="w-6 h-6" />
          <span className="text-[10px]">Clock</span>
        </button>
        
        <button 
          onClick={() => setCurrentTab('tasks')} 
          className={`flex flex-col items-center justify-center gap-1 w-12 transition-colors active:scale-95 ${currentTab === 'tasks' ? 'text-blue-600 font-semibold' : 'text-gray-400'}`}
        >
          <Home className="w-6 h-6" />
          <span className="text-[10px]">Tasks</span>
        </button>

        {/* Floating FAB */}
        <div className="relative flex justify-center w-16">
          <button 
            onClick={onFabClick}
            className="absolute -top-10 w-14 h-14 rounded-full bg-gradient-to-tr from-blue-600 to-blue-800 border-4 border-white shadow-lg shadow-blue-600/30 active:scale-95 transition-transform will-change-transform transform-gpu text-white flex items-center justify-center"
          >
            <Plus className="w-7 h-7 stroke-2" />
          </button>
        </div>

        <button 
          onClick={() => setCurrentTab('chat')} 
          className={`flex flex-col items-center justify-center gap-1 w-12 transition-colors active:scale-95 ${currentTab === 'chat' ? 'text-blue-600 font-semibold' : 'text-gray-400'}`}
        >
          <div className="relative">
            <MessageSquare className="w-6 h-6" />
            {unreadChatCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow-sm ring-1 ring-white">
                {unreadChatCount > 9 ? '9+' : unreadChatCount}
              </span>
            )}
          </div>
          <span className="text-[10px]">Chat</span>
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

export default BottomNav;
