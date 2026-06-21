import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, ChatMessage } from '../types';
import { chatService } from '../services/chatService';
import { Send, AlertTriangle, Cpu } from 'lucide-react';

interface MessagingProps {
  profile: UserProfile;
}

export const Messaging: React.FC<MessagingProps> = ({ profile }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isAIActive, setIsAIActive] = useState(false);
  
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatService.setChatOpen(true);
    chatService.startPolling(5000);
    const unsubscribe = chatService.subscribeToMessages((msgs) => {
      setMessages(msgs);
    });
    return () => {
      chatService.setChatOpen(false);
      chatService.stopPolling();
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    const msg = inputText.trim();
    setInputText('');
    await chatService.sendMessage(profile.id, profile.name || 'User', msg);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-hidden relative">
      {/* Header */}
      <div className="px-4 py-3 bg-white border-b border-gray-200 shadow-sm z-20 shrink-0 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-gray-800 truncate">Team Dispatch & Support</h2>
          </div>
        </div>
        
        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-2 px-2 scrollbar-hide">
          <button className="flex shrink-0 items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200 hover:bg-blue-200 transition-colors">
            <AlertTriangle className="w-3.5 h-3.5" /> Summarize Thread
          </button>
          
          <button 
            onClick={() => setIsAIActive(!isAIActive)}
            className={`flex shrink-0 items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
              isAIActive 
                ? 'bg-purple-100 text-purple-800 border border-purple-300 ring-2 ring-purple-500/20' 
                : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" /> AI Auto-Reply
          </button>
        </div>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {messages.map((msg, i) => {
          const isMe = msg.userId === profile.id;
          return (
            <div key={msg.messageId || i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              <div 
                className={`max-w-[85%] px-4 py-2 text-sm leading-snug shadow-sm select-text ${
                  isMe 
                    ? 'bg-blue-600 text-white rounded-2xl rounded-br-none ml-auto' 
                    : 'bg-white text-gray-800 border border-gray-200 rounded-2xl rounded-bl-none mr-auto'
                }`}
              >
                {msg.messageText}
                <div className={`text-[10px] block mt-1 text-right ${isMe ? 'text-blue-200' : 'text-gray-400'}`}>
                  {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </div>
              </div>
            </div>
          );
        })}
        
        {isAIActive && (
          <div className="flex flex-col items-start mt-2">
            <div className="px-4 py-3 bg-purple-50 border border-purple-100 rounded-2xl text-purple-600 flex items-center gap-2">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
              <span className="text-xs font-medium">AI drafting response...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} className="h-1" />
      </div>

      {/* Input Deck */}
      <div className="p-4 bg-white border-t border-gray-200 shrink-0 relative z-30">
        <form onSubmit={handleSend} className="relative flex items-center">
          <input 
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type a message..."
            className="w-full pl-4 pr-12 py-3 bg-gray-100 border-0 rounded-full focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors text-sm text-gray-800"
          />
          <button 
            type="submit"
            disabled={!inputText.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

    </div>
  );
};

export default Messaging;
