import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, ChatMessage } from '../types';
import { chatService } from '../services/chatService';
import { Send, AlertTriangle, Cpu, Sparkles, X, Check, Loader2, MessageSquare, RefreshCw } from 'lucide-react';

interface MessagingProps {
  profile: UserProfile;
}

export const Messaging: React.FC<MessagingProps> = ({ profile }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isAIActive, setIsAIActive] = useState(false);
  
  // AI summarizer state
  const [summary, setSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);

  // AI auto-reply state
  const [aiDraft, setAiDraft] = useState<string | null>(null);
  const [isDrafting, setIsDrafting] = useState(false);
  const lastProcessedMessageIdRef = useRef<string | null>(null);

  const listRef = useRef<HTMLDivElement | null>(null);

  // Subscribe to messages and polling setup
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

  // Scroll to bottom of chat list container when messages update or a draft is being auto-suggested
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, aiDraft, isDrafting]);

  // AI Auto-Reply trigger when messages modify or AI toggles
  useEffect(() => {
    if (!isAIActive) {
      setAiDraft(null);
      return;
    }

    if (messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    
    // Ignore if last message is from ourselves or a System notification
    if (lastMsg.senderId === profile.id || lastMsg.senderName === 'System') {
      return;
    }

    // Ignore if we already processed this message ID to avoid repeat requests
    if (lastProcessedMessageIdRef.current === lastMsg.messageId) {
      return;
    }

    const draftResponse = async () => {
      setIsDrafting(true);
      setAiDraft(null);
      try {
        const response = await fetch('/api/chat/reply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages })
        });
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.reply) {
            setAiDraft(data.reply);
            lastProcessedMessageIdRef.current = lastMsg.messageId;
          }
        }
      } catch (err) {
        console.error("AI Auto-reply draft generation error:", err);
      } finally {
        setIsDrafting(false);
      }
    };

    draftResponse();
  }, [messages, isAIActive, profile.id]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    const msg = inputText.trim();
    setInputText('');
    setAiDraft(null); // Clear suggestion since user manually typed
    await chatService.sendMessage(msg, profile.id || '', profile.name || 'User');
  };

  const handleSummarize = async () => {
    if (messages.length === 0) {
      alert("No messages to summarize yet.");
      return;
    }
    setIsSummarizing(true);
    setSummary(null);
    try {
      const response = await fetch('/api/chat/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.summary) {
          setSummary(data.summary);
        } else {
          alert("Unable to generate thread summary closely.");
        }
      } else {
        alert("Server responded with an error generating a summary.");
      }
    } catch (err) {
      console.error("Summary error:", err);
      alert("Connection timeout or server issue during summary generation.");
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleInsertDraft = () => {
    if (aiDraft) {
      setInputText(aiDraft);
      setAiDraft(null);
    }
  };

  const handleSendDraft = async () => {
    if (aiDraft) {
      const msg = aiDraft;
      setAiDraft(null);
      await chatService.sendMessage(msg, profile.id || '', profile.name || 'User');
    }
  };

  const handleRetryMessage = (msgId: string) => {
    chatService.retrySendMessage(msgId);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-hidden relative" id="chat_container">
      {/* Header */}
      <div className="px-4 py-3 bg-white border-b border-gray-200 shadow-sm z-20 shrink-0 flex flex-col gap-3" id="chat_header">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-gray-800 truncate" id="chat_title">Team Chat</h2>
            <p className="text-[11px] text-gray-500 font-medium">Auto-synced with company Google Sheet database</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-2 px-2 scrollbar-hide" id="chat_action_pill_bar">
          <button 
            onClick={handleSummarize}
            disabled={isSummarizing || messages.length === 0}
            className="flex shrink-0 items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100 disabled:opacity-50 transition-colors"
            id="chat_summarize_btn"
          >
            {isSummarizing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-700" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5" />
            )}
            Summarize Thread
          </button>
          
          <button 
            onClick={() => {
              setIsAIActive(!isAIActive);
              setAiDraft(null);
            }}
            className={`flex shrink-0 items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
              isAIActive 
                ? 'bg-purple-100 text-purple-800 border border-purple-300 ring-2 ring-purple-500/10' 
                : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
            }`}
            id="chat_ai_toggle_btn"
          >
            <Cpu className="w-3.5 h-3.5" />
            {isAIActive ? 'AI Auto-Reply: Active' : 'Enable AI Assistant'}
          </button>
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
        
        {/* Loading Indicators */}
        {isDrafting && (
          <div className="flex flex-col items-start mt-2" id="chat_ai_loading">
            <div className="px-3 py-2 bg-purple-50 border border-purple-100 rounded-2xl text-purple-600 flex items-center gap-2 shadow-sm">
              <div className="flex gap-1 shrink-0">
                <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
              <span className="text-xs font-semibold">AI is drafting suggestion...</span>
            </div>
          </div>
        )}
      </div>

      {/* AI Summary Overlay Dialog */}
      {summary && (
        <div className="absolute inset-0 bg-gray-900/60 flex items-center justify-center p-4 z-50" id="chat_summary_modal">
          <div className="bg-white rounded-3xl w-full max-w-sm flex flex-col shadow-2xl border border-gray-100 max-h-[80%] overflow-hidden">
            <div className="px-5 py-4 bg-gradient-to-r from-blue-900 to-indigo-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold tracking-tight">AI Thread Summary</h3>
              </div>
              <button 
                onClick={() => setSummary(null)}
                className="text-white hover:bg-white/10 p-1.5 rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 text-sm text-gray-700 leading-relaxed space-y-3 prose prose-sm scrollbar-hide">
              <div className="bg-blue-50/50 rounded-xl p-3 text-xs text-blue-800 font-semibold mb-2">
                This dynamic intelligence compiles decisions and physical events discussed in the team chat.
              </div>
              <div className="whitespace-pre-line text-xs font-medium bg-gray-50 border border-gray-100 rounded-2xl p-4">
                {summary}
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-2 shrink-0">
              <button 
                onClick={() => setSummary(null)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-sm transition-colors"
              >
                Got It, Thanks!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suggestion Card Deck */}
      {aiDraft && (
        <div className="mx-4 mb-2 p-3 bg-purple-50/90 border border-purple-200/80 rounded-2xl shadow-md backdrop-blur-sm z-30 flex items-start gap-2.5" id="chat_ai_suggestion">
          <div className="p-1 h-5 w-5 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-extrabold text-purple-700 uppercase tracking-wider block">AI Proposed Assistant Reply</span>
            <p className="text-xs text-purple-950 font-medium select-text mt-0.5 italic leading-relaxed">"{aiDraft}"</p>
            <div className="flex items-center gap-2.5 mt-2.5">
              <button 
                onClick={handleInsertDraft}
                className="text-[10px] font-extrabold text-purple-700 hover:bg-purple-100 border border-purple-300 rounded-lg px-2.5 py-1.5 transition-all bg-white"
                id="chat_insert_draft_btn"
              >
                Insert to edit
              </button>
              <button 
                onClick={handleSendDraft}
                className="text-[10px] font-extrabold text-white bg-purple-600 hover:bg-purple-700 rounded-lg px-2.5 py-1.5 transition-all shadow-sm flex items-center gap-1"
                id="chat_send_draft_btn"
              >
                <Check className="w-2.5 h-2.5" /> Send instantly
              </button>
              <button 
                onClick={() => setAiDraft(null)}
                className="text-[10px] font-bold text-gray-500 hover:text-gray-800 ml-auto transition-colors"
                id="chat_dismiss_draft_btn"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

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
