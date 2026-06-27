import { ChatMessage } from '../types';

type MessageListener = (messages: ChatMessage[]) => void;
type UnreadCountListener = (count: number) => void;

class ChatService {
  private messages: ChatMessage[] = [];
  private messageListeners: Set<MessageListener> = new Set();
  private unreadCountListeners: Set<UnreadCountListener> = new Set();
  private isPollingActive = false;
  private pollIntervalId: any = null;
  private isChatOpen = false;
  private lastReadTimestamp = 0;
  
  // Local retry queue for failed messages
  private retryQueue: ChatMessage[] = [];
  private isProcessingQueue = false;

  constructor() {
    this.loadFromLocalStorage();
    
    // Periodically process the background queue (every 10 seconds)
    setInterval(() => {
      this.processRetryQueue();
    }, 10000);
  }

  // Load message cache from localStorage for instant loading
  private loadFromLocalStorage() {
    try {
      const cached = localStorage.getItem('geotime_chat_messages');
      if (cached) {
        this.messages = JSON.parse(cached);
      }
      const savedLastRead = localStorage.getItem('geotime_chat_last_read_ts');
      if (savedLastRead) {
        this.lastReadTimestamp = parseInt(savedLastRead, 10);
      }
    } catch (e) {
      console.error('Error loading chat cache from local storage', e);
    }
  }

  private saveToLocalStorage() {
    try {
      localStorage.setItem('geotime_chat_messages', JSON.stringify(this.messages));
      localStorage.setItem('geotime_chat_last_read_ts', this.lastReadTimestamp.toString());
    } catch (e) {
      console.error('Error saving chat cache to local storage', e);
    }
  }

  // Subscribe UI components to message updates
  public subscribeToMessages(listener: MessageListener) {
    this.messageListeners.add(listener);
    listener([...this.messages]); // Send initial state
    return () => {
      this.messageListeners.delete(listener);
    };
  }

  // Subscribe UI components to unread badge count updates
  public subscribeToUnreadCount(listener: UnreadCountListener) {
    this.unreadCountListeners.add(listener);
    listener(this.getUnreadCount());
    return () => {
      this.unreadCountListeners.delete(listener);
    };
  }

  private emitMessageChange() {
    const sorted = [...this.messages].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    this.messageListeners.forEach(listener => listener(sorted));
    this.emitUnreadChange();
  }

  private emitUnreadChange() {
    const unreadCount = this.getUnreadCount();
    this.unreadCountListeners.forEach(listener => listener(unreadCount));
  }

  public getUnreadCount(): number {
    if (this.isChatOpen) return 0;
    
    // Count messages after lastReadTimestamp, excluding my own
    const currentUserId = this.getCurrentUserId();
    return this.messages.filter(msg => {
      const isMe = msg.senderId === currentUserId;
      if (isMe) return false;
      if (msg.senderName === 'System') return false; // Ignore system warnings
      const msgTime = new Date(msg.timestamp).getTime();
      return msgTime > this.lastReadTimestamp;
    }).length;
  }

  private getCurrentUserId(): string {
    try {
      const saved = localStorage.getItem('currentUser');
      if (saved) {
        const profile = JSON.parse(saved);
        return profile.id || profile.name || '';
      }
    } catch {}
    return '';
  }

  public setChatOpen(open: boolean) {
    this.isChatOpen = open;
    if (open) {
      this.lastReadTimestamp = Date.now();
      this.saveToLocalStorage();
      this.emitUnreadChange();
    }
  }

  // OPTIMISTIC STATE ENGINE: Send a message
  public async sendMessage(text: string, senderId: string, senderName: string) {
    const messageText = text.trim();
    if (!messageText) return;

    const messageId = crypto.randomUUID();
    const optimisticMessage: ChatMessage = {
      messageId,
      senderId,
      senderName,
      messageText,
      timestamp: new Date().toISOString(),
      status: 'pending'
    };

    // 1. Immediately append to local UI state
    this.messages.push(optimisticMessage);
    this.saveToLocalStorage();
    this.emitMessageChange();

    // 2. Clear input is already handled in UI, now proceed to Network Sync
    this.syncMessageToBackend(optimisticMessage);
  }

  private async syncMessageToBackend(message: ChatMessage) {
    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payload: {
            action: 'SEND_CHAT_MESSAGE',
            payload: {
              timestamp: message.timestamp,
              senderId: message.senderId,
              senderName: message.senderName,
              messageText: message.messageText,
              status: 'sent', // The sheet receives it as sent
              messageId: message.messageId
            }
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Rate limit or server error: ${response.status}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to parse response');
      }

      // On Success: Update local status to 'sent'
      this.updateMessageStatus(message.messageId, 'sent');
      
      // Remove from retry queue if it was in there
      this.retryQueue = this.retryQueue.filter(m => m.messageId !== message.messageId);
    } catch (err) {
      console.error('Chat synchronization failed:', err);
      // On Failure: Update state to 'failed'
      this.updateMessageStatus(message.messageId, 'failed');
      
      // Add to background retry queue if not already there
      if (!this.retryQueue.some(m => m.messageId === message.messageId)) {
        this.retryQueue.push({ ...message, status: 'failed' });
      }
    }
  }

  private updateMessageStatus(messageId: string, status: 'pending' | 'sent' | 'failed') {
    const idx = this.messages.findIndex(m => m.messageId === messageId);
    if (idx !== -1) {
      this.messages[idx] = {
        ...this.messages[idx],
        status
      };
      this.saveToLocalStorage();
      this.emitMessageChange();
    }
  }

  // Tap to retry sending
  public retrySendMessage(messageId: string) {
    const msg = this.messages.find(m => m.messageId === messageId);
    if (!msg || msg.status !== 'failed') return;

    // Transition back to 'pending'
    const updatedMsg = { ...msg, status: 'pending' as const };
    const idx = this.messages.findIndex(m => m.messageId === messageId);
    if (idx !== -1) {
      this.messages[idx] = updatedMsg;
      this.saveToLocalStorage();
      this.emitMessageChange();
    }

    this.syncMessageToBackend(updatedMsg);
  }

  // Background queue worker to handle sheets rate limiting or cellular dropouts
  private async processRetryQueue() {
    if (this.isProcessingQueue || this.retryQueue.length === 0) return;
    this.isProcessingQueue = true;

    const nextMsg = this.retryQueue[0];
    try {
      // Transition message temporarily to pending in UI during auto-retry
      this.updateMessageStatus(nextMsg.messageId, 'pending');
      
      await this.syncMessageToBackend(nextMsg);
    } catch (e) {
      // Revert back to failed on retry error
      this.updateMessageStatus(nextMsg.messageId, 'failed');
    } finally {
      this.isProcessingQueue = false;
    }
  }

  // POLING CONTROL: Start polling
  public startPolling(intervalMs = 5000) {
    if (this.isPollingActive) return;
    this.isPollingActive = true;

    // Immediate fetch first
    this.fetchNewMessages();

    this.pollIntervalId = setInterval(() => {
      this.fetchNewMessages();
    }, intervalMs);
  }

  public stopPolling() {
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }
    this.isPollingActive = false;
  }

  // Fetch from the Google Sheets API pipeline
  public async fetchNewMessages() {
    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payload: {
            action: 'FETCH_CHAT_MESSAGES',
            payload: {}
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const result = await response.json();
      if (result.success && result.data && Array.isArray(result.data.messages)) {
        this.mergeIncomingMessages(result.data.messages);
      }
    } catch (e) {
      console.warn('Unable to poll chat messages:', e);
    }
  }

  private triggerNotification(msg: ChatMessage) {
    if (!("Notification" in window)) return;
    
    // Only notify if chat is not open or doc is hidden
    if (this.isChatOpen && document.visibilityState === 'visible') return;

    if (Notification.permission === "granted") {
      try {
        const notification = new Notification(`New message from ${msg.senderName}`, {
          body: msg.messageText,
          icon: '/pwa-icon.svg',
          badge: '/pwa-icon.svg',
          tag: 'chat-message'
        });
        
        notification.onclick = function() {
          window.focus();
          this.close();
        };
      } catch (e) {
        console.error("Push notification failed", e);
      }
    }
  }

  public requestNotificationPermission() {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted" && Notification.permission !== "denied") {
      Notification.requestPermission();
    }
  }

  private mergeIncomingMessages(incoming: ChatMessage[]) {
    let hasChanges = false;
    const currentUserId = this.getCurrentUserId();

    // Sort incoming just in case
    incoming.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    incoming.forEach(incMsg => {
      const existingIdx = this.messages.findIndex(m => m.messageId === incMsg.messageId);
      
      if (existingIdx === -1) {
        // If it's a message from another user or an old system msg, insert it
        this.messages.push({
          ...incMsg,
          status: 'sent' // Any message retrieved from database is 'sent'
        });
        hasChanges = true;
        
        if (incMsg.senderId !== currentUserId) {
          // If the message is newer than what we had on startup, trigger notification
          // We can use lastReadTimestamp to gauge if we should notify
          const msgTime = new Date(incMsg.timestamp).getTime();
          if (msgTime > this.lastReadTimestamp) {
            this.triggerNotification(incMsg);
          }
        }
      } else {
        // If we found it, and our local state is 'pending' or 'failed',
        // but the DB already got it, mark as 'sent'.
        if (this.messages[existingIdx].status !== 'sent') {
          this.messages[existingIdx] = {
            ...this.messages[existingIdx],
            status: 'sent'
          };
          hasChanges = true;
        }
      }
    });

    if (hasChanges) {
      this.saveToLocalStorage();
      this.emitMessageChange();
    }
  }

  // Clear all chats locally (useful for logouts etc)
  public clearCache() {
    this.messages = [];
    this.retryQueue = [];
    this.lastReadTimestamp = 0;
    this.saveToLocalStorage();
    this.emitMessageChange();
  }
}

export const chatService = new ChatService();
