import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, ChatMessage } from '../types';
import { chatService } from '../services/chatService';
import { Send, Loader2, MessageSquare, RefreshCw } from 'lucide-react';

interface MessagingProps {
  profile: UserProfile;
}

export const Messaging: React.FC<MessagingProps> = ({ profile }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const listRef = useRef<HTMLDivElement | null>(null);

  // Subscribe to messages and polling setup
  useEffect(() => {
    chatService.setChatOpen(true);
    chatService.startPolling(5000);
    chatService.requestNotificationPermission();
    const unsubscribe = chatService.subscribeToMessages((msgs) => {
      setMessages(msgs);
    });
    return () => {
      chatService.setChatOpen(false);
      chatService.stopPolling();
      unsubscribe();
    };
  }, []);

  // Scroll to bottom of chat list container when messages update
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    const msg = inputText.trim();
    setInputText('');
    chatService.requestNotificationPermission(); // Request on user gesture
    await chatService.sendMessage(msg, profile.id || '', profile.name || 'User');
  };

  const handleRetryMessage = (msgId: string) => {
    chatService.retrySendMessage(msgId);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-hidden relative" id="chat_container">
      {/* Header */}
      <div className="px-4 py-3 bg-white border-b border-gray-200 shadow-sm z-20 shrink-0 flex items-center justify-between" id="chat_header">
        <div>
          <h2 className="text-base font-semibold text-gray-800 truncate" id="chat_title">Team Chat</h2>
          <p className="text-[11px] text-gray-500 font-medium">Auto-synced with company Google Sheet database</p>
        </div>
      </div>

      {/* Message List */}
      <div ref={listRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-gray-50" id="chat_message_list">
        {messages.length === 0 ? (
          <div className="my-auto text-center py-10 px-4" id="chat_empty_view">
            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-3">
              <MessageSquare className="w-6 h-6 text-blue-500" />
            </div>
            <h3 className="text-sm font-semibold text-gray-800">No messages yet</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-[240px] mx-auto">Discuss worksite events or chat with the team.</p>
          </div>
        ) : (
          messages.map((msg, i) => {
            const isMe = msg.senderId === profile.id;
            return (
              <div key={msg.messageId || i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`} id={`chat_msg_${msg.messageId || i}`}>
                {!isMe && (
                  <span className="text-[11px] font-semibold text-gray-500 mb-1 ml-1">
                    {msg.senderName}
                  </span>
                )}
                <div 
                  className={`max-w-[85%] px-4 py-2 text-sm leading-snug shadow-sm select-text relative ${
                    isMe 
                      ? 'bg-blue-600 text-white rounded-2xl rounded-br-none ml-auto' 
                      : 'bg-white text-gray-800 border border-gray-200 rounded-2xl rounded-bl-none mr-auto'
                  }`}
                >
                  <p className="whitespace-pre-line">{msg.messageText}</p>
                  
                  <div className="flex items-center justify-end gap-1.5 mt-1 text-[10px]">
                    <span className={isMe ? 'text-blue-200/90' : 'text-gray-400'}>
                      {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                    {isMe && (
                      <span className="text-[10px] font-bold">
                        {msg.status === 'pending' && (
                          <span className="text-blue-200 animate-pulse flex items-center gap-0.5">
                            <Loader2 className="w-2.5 h-2.5 animate-spin" /> sending...
                          </span>
                        )}
                        {msg.status === 'sent' && (
                          <span className="text-emerald-300">✓</span>
                        )}
                        {msg.status === 'failed' && (
                          <button 
                            onClick={() => handleRetryMessage(msg.messageId)}
                            className="bg-red-500 text-white px-1 py-0.5 rounded text-[8px] flex items-center gap-0.5 uppercase tracking-wider font-extrabold shadow-sm"
                            title="Tap to retry sending"
                          >
                            <RefreshCw className="w-2.5 h-2.5" /> Failed / Retry
                          </button>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input Deck */}
      <div className="p-4 bg-white border-t border-gray-200 shrink-0 relative z-30" id="chat_input_deck">
        <form onSubmit={handleSend} className="relative flex items-center" id="chat_form">
          <input 
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type a message to the team..."
            className="w-full pl-4 pr-12 py-3 bg-gray-100 border-0 rounded-full focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors text-sm text-gray-800"
            id="chat_input_field"
          />
          <button 
            type="submit"
            disabled={!inputText.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
            id="chat_send_btn"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

    </div>
  );
};

export default Messaging;
