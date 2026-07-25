import { useState, useEffect, useRef } from 'react';
import type { ChangeEvent } from 'react';
import { collection, query, orderBy, onSnapshot, doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { ArrowLeft, Send, Image as ImageIcon, Smile, User as UserIcon, Loader2 } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Chat, Message } from '../types';
import { format, isToday, isYesterday, isThisYear } from 'date-fns';
import { tr } from 'date-fns/locale';
import { SYSTEM_USER_ID, TALKO_AI_USER_ID } from '../lib/systemAccount';
import { TALKO_LOGO_DATA_URL, TALKO_AI_LOGO_DATA_URL } from '../lib/assets';
import { cn } from '../lib/utils';
import { uploadImage } from '../lib/imgbb';
import toast from 'react-hot-toast';
import { VerifiedBadge } from './VerifiedBadge';

interface ChatAreaProps {
  key?: string;
  chat: Chat;
  onBack: () => void;
}

function formatLastSeen(timestamp: number): string {
  const date = new Date(timestamp);
  if (isToday(date)) {
    return `Son görülme: bugün ${format(date, 'HH:mm', { locale: tr })}`;
  }
  if (isYesterday(date)) {
    return `Son görülme: dün ${format(date, 'HH:mm', { locale: tr })}`;
  }
  if (isThisYear(date)) {
    return `Son görülme: ${format(date, 'd MMMM HH:mm', { locale: tr })}`;
  }
  return `Son görülme: ${format(date, 'd MMMM yyyy HH:mm', { locale: tr })}`;
}

export default function ChatArea({ chat, onBack }: ChatAreaProps) {
  const { currentUser, userProfile } = useAuth();
  const { theme } = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [otherUserOnline, setOtherUserOnline] = useState(false);
  const [otherUserLastSeen, setOtherUserLastSeen] = useState<number | null>(null);
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
  const [liveOtherUser, setLiveOtherUser] = useState<any>(null);
  
  // AI State
  const [aiState, setAiState] = useState({ isGenerating: false, isThinking: false, streamText: '' });

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingTimeRef = useRef<number>(0);
  const lastMyTypingWriteRef = useRef<number>(0);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevMessagesLengthRef = useRef(0);

  const otherUserId = chat?.participants?.find(id => id !== currentUser?.uid) || currentUser?.uid;
  const isSystemChat = otherUserId === SYSTEM_USER_ID;
  const isAiChat = otherUserId === TALKO_AI_USER_ID;
  const isVerified = isSystemChat || isAiChat;

  const otherUserDetails = isSystemChat 
    ? { username: 'Talko Updates', photoURL: TALKO_LOGO_DATA_URL }
    : isAiChat
    ? { username: 'Talko AI', photoURL: TALKO_AI_LOGO_DATA_URL }
    : (otherUserId === currentUser?.uid 
        ? userProfile 
        : (liveOtherUser || chat?.participantDetails?.[otherUserId || ''] || {}));

  useEffect(() => {
    if (!currentUser) return;

    const messagesRef = collection(db, `chats/${chat.id}/messages`);
    const q = query(messagesRef, orderBy('timestamp', 'asc'));

    const unsubscribeMessages = onSnapshot(q, (snapshot) => {
      const fetchedMessages = snapshot.docs.map(doc => doc.data() as Message);
      
      let uniqueMessages = fetchedMessages;
      if (isSystemChat) {
        const seenTexts = new Set<string>();
        uniqueMessages = fetchedMessages.filter(msg => {
          if (!msg.text) return true;
          const normalized = msg.text.trim();
          if (normalized.startsWith("Merhaba") && normalized.includes("Talko'ya hoş geldin")) {
            if (seenTexts.has(normalized)) {
              return false;
            }
            seenTexts.add(normalized);
          }
          return true;
        });
      }

      setMessages(uniqueMessages);
    });

    return () => unsubscribeMessages();
  }, [chat.id, currentUser]);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior
      });
    }
  };

  const forceScrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    scrollToBottom(behavior);
    setTimeout(() => scrollToBottom(behavior), 30);
    setTimeout(() => scrollToBottom(behavior), 100);
    setTimeout(() => scrollToBottom(behavior), 250);
  };

  useEffect(() => {
    if (messages.length === 0) return;

    const container = scrollContainerRef.current;
    if (!container) return;

    const isInitialLoad = prevMessagesLengthRef.current === 0;
    const isNewMessage = messages.length > prevMessagesLengthRef.current;

    if (isInitialLoad) {
      // Unconditional instant scroll to bottom on initial load
      setTimeout(() => scrollToBottom('auto'), 50);
      setTimeout(() => scrollToBottom('auto'), 150);
    } else if (isNewMessage) {
      const lastMessage = messages[messages.length - 1];
      const isMyMessage = lastMessage.senderId === currentUser?.uid;

      if (isMyMessage) {
        forceScrollToBottom('smooth');
      } else {
        // Only scroll if already near bottom (threshold 200px)
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 200;
        if (isNearBottom) {
          forceScrollToBottom('smooth');
        }
      }
    }

    prevMessagesLengthRef.current = messages.length;
  }, [messages, currentUser]);

  useEffect(() => {
    if (isOtherUserTyping) {
      const container = scrollContainerRef.current;
      if (container) {
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 200;
        if (isNearBottom) {
          scrollToBottom('smooth');
        }
      }
    }
  }, [isOtherUserTyping]);

  // Reset our typing status on unmount or chat change
  useEffect(() => {
    return () => {
      if (currentUser && chat.id && !isSystemChat) {
        const typingRef = doc(db, `chats/${chat.id}/typing`, currentUser.uid);
        setDoc(typingRef, { isTyping: false, timestamp: Date.now() }).catch(err => {
          console.error("Error clearing typing on unmount:", err);
        });
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [chat.id, currentUser, isSystemChat]);

  // Auto scroll to bottom when keyboard resizes the viewport
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;

    const handleResize = () => {
      window.scrollTo(0, 0);
      const container = scrollContainerRef.current;
      if (container) {
        forceScrollToBottom('smooth');
      }
    };

    window.visualViewport.addEventListener('resize', handleResize);
    window.visualViewport.addEventListener('scroll', handleResize);
    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('scroll', handleResize);
    };
  }, []);

  // Dynamic textarea height adjustment to match native WhatsApp/Telegram input behavior
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const calculatedHeight = Math.min(Math.max(textarea.scrollHeight, 48), 128);
      textarea.style.height = `${calculatedHeight}px`;
    }
  }, [inputText]);

  useEffect(() => {
    if (isSystemChat || !otherUserId || !currentUser) return;

    // Listen to other user's online status
    const userRef = doc(db, 'users', otherUserId);
    const unsubscribeUser = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setLiveOtherUser(data);
        if (data.isBanned) {
          setOtherUserOnline(false);
          setOtherUserLastSeen(null);
        } else {
          setOtherUserOnline(data.isOnline || data.online || false);
          
          let lastSeenMs: number | null = null;
          if (data.lastSeen) {
            if (typeof data.lastSeen === 'object' && 'toMillis' in data.lastSeen) {
              lastSeenMs = data.lastSeen.toMillis();
            } else if (typeof data.lastSeen === 'number') {
              lastSeenMs = data.lastSeen;
            } else if (data.lastSeen instanceof Date) {
              lastSeenMs = data.lastSeen.getTime();
            }
          }
          setOtherUserLastSeen(lastSeenMs);
        }
      }
    });

    // Listen to other user's typing status
    const typingRef = doc(db, `chats/${chat.id}/typing`, otherUserId);
    const unsubscribeTyping = onSnapshot(typingRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const isTyping = data.isTyping || false;
        const timestamp = data.timestamp || 0;
        lastTypingTimeRef.current = timestamp;

        if (isTyping) {
          if (Date.now() - timestamp < 5000) {
            setIsOtherUserTyping(true);
          } else {
            setIsOtherUserTyping(false);
          }
        } else {
          setIsOtherUserTyping(false);
        }
      } else {
        setIsOtherUserTyping(false);
      }
    });

    // Periodically decay/expire typing indicator if sender's connection drops
    const interval = setInterval(() => {
      if (lastTypingTimeRef.current && Date.now() - lastTypingTimeRef.current >= 5000) {
        setIsOtherUserTyping(false);
      }
    }, 1000);

    return () => {
      unsubscribeUser();
      unsubscribeTyping();
      clearInterval(interval);
    };
  }, [otherUserId, isSystemChat, chat.id, currentUser]);

  // Handle visibility changes or closing tabs to immediately clear typing
  useEffect(() => {
    const handleVisibilityOrUnload = () => {
      if (document.visibilityState === 'hidden' && currentUser && chat.id && !isSystemChat) {
        const typingRef = doc(db, `chats/${chat.id}/typing`, currentUser.uid);
        setDoc(typingRef, { isTyping: false, timestamp: Date.now() }).catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityOrUnload);
    window.addEventListener('beforeunload', handleVisibilityOrUnload);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityOrUnload);
      window.removeEventListener('beforeunload', handleVisibilityOrUnload);
    };
  }, [chat.id, currentUser, isSystemChat]);

  const handleTyping = (textValue?: string) => {
    if (!currentUser || isSystemChat) return;
    
    const typingRef = doc(db, `chats/${chat.id}/typing`, currentUser.uid);
    const currentVal = textValue !== undefined ? textValue : inputText;

    if (!currentVal.trim()) {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      setDoc(typingRef, { isTyping: false, timestamp: Date.now() }).catch(() => {});
      lastMyTypingWriteRef.current = 0;
      return;
    }

    const now = Date.now();
    // Throttle the Firestore isTyping: true writes to once every 3.5 seconds to prevent rate-limiting or out-of-order execution
    if (now - lastMyTypingWriteRef.current > 3500) {
      setDoc(typingRef, { isTyping: true, timestamp: now }).catch(() => {});
      lastMyTypingWriteRef.current = now;
    }
    
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    
    typingTimeoutRef.current = setTimeout(() => {
      setDoc(typingRef, { isTyping: false, timestamp: Date.now() }).catch(() => {});
      lastMyTypingWriteRef.current = 0;
    }, 2500);
  };

  const handleSendMessage = async (text: string, imageUrl: string | null = null) => {
    const messageText = text.trim();
    if ((!messageText && !imageUrl) || !currentUser) return;
    
    if (isSystemChat) {
      toast.error("Talko Destek hesabına yanıt gönderilemez.");
      return;
    }

    // Immediately clear input and reset emoji picker for a fast native-like response
    if (!imageUrl) {
      setInputText('');
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    }
    setShowEmojiPicker(false);

    // Immediately clear local and firestore typing status
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    lastMyTypingWriteRef.current = 0;
    const typingRef = doc(db, `chats/${chat.id}/typing`, currentUser.uid);
    setDoc(typingRef, { isTyping: false, timestamp: Date.now() }).catch(err => {
      console.error("Error clearing typing status on send:", err);
    });

    const now = Date.now();
    const messageId = now.toString() + Math.random().toString(36).substring(2, 5);
    
    try {
      const messageRef = doc(db, `chats/${chat.id}/messages`, messageId);
      await setDoc(messageRef, {
        id: messageId,
        senderId: currentUser.uid,
        text: messageText || null,
        imageUrl,
        timestamp: now
      });

      const chatRef = doc(db, 'chats', chat.id);
      await updateDoc(chatRef, {
        lastMessage: messageText || (imageUrl ? '📷 Görsel' : ''),
        lastMessageTimestamp: now,
        updatedAt: now
      });
      
      if (isAiChat) {
        setAiState({ isGenerating: true, isThinking: true, streamText: '' });
        try {
          const history = messages.map(m => ({
            role: m.senderId === TALKO_AI_USER_ID ? 'model' : 'user',
            text: m.text || ''
          }));
          
          const response = await fetch('/api/ai/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: messageText, history })
          });
          
          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `AI API Error: ${response.status}`);
          }
          
          setAiState(prev => ({ ...prev, isThinking: false }));
          
          const reader = response.body?.getReader();
          const decoder = new TextDecoder();
          let aiFullText = '';
          let buffer = '';
          
          if (reader) {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              
              buffer += decoder.decode(value, { stream: true });
              
              let newlineIndex;
              while ((newlineIndex = buffer.indexOf('\n\n')) >= 0) {
                const sseMessage = buffer.slice(0, newlineIndex).trim();
                buffer = buffer.slice(newlineIndex + 2);
                
                const lines = sseMessage.split('\n');
                for (const line of lines) {
                  if (line.startsWith('data: ')) {
                    const dataStr = line.slice(6);
                    if (dataStr.trim() === '[DONE]') break;
                    try {
                      const parsed = JSON.parse(dataStr);
                      if (parsed.text) {
                        aiFullText += parsed.text;
                        setAiState(prev => ({ ...prev, streamText: aiFullText }));
                      }
                    } catch (e) {
                      console.error("Parse error:", e, dataStr);
                    }
                  }
                }
              }
            }
          }
          
          setAiState({ isGenerating: false, isThinking: false, streamText: '' });
          
          if (aiFullText.trim()) {
            const aiNow = Date.now();
            const aiMsgId = aiNow.toString() + Math.random().toString(36).substring(2, 5);
            await setDoc(doc(db, `chats/${chat.id}/messages`, aiMsgId), {
               id: aiMsgId,
               senderId: TALKO_AI_USER_ID,
               text: aiFullText,
               imageUrl: null,
               timestamp: aiNow
            });
            await updateDoc(chatRef, {
               lastMessage: aiFullText,
               lastMessageTimestamp: aiNow,
               updatedAt: aiNow
            });
          } else {
            throw new Error("AI returned empty response");
          }
        } catch (err: any) {
          console.error("AI chat error:", err);
          toast.error(err.message || "Talko AI yanıt veremedi.");
          setAiState({ isGenerating: false, isThinking: false, streamText: '' });
        }
      }

    } catch (err) {
      console.error(err);
      toast.error("Mesaj gönderilemedi.");
      // Restore input text if send failed so user doesn't lose it
      if (!imageUrl) {
        setInputText(messageText);
      }
    }
  };

  const onEmojiClick = (emojiObject: any) => {
    const newVal = inputText + emojiObject.emoji;
    setInputText(newVal);
    handleTyping(newVal);
  };

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Lütfen geçerli bir görsel seçin.');
      return;
    }

    setIsUploading(true);
    try {
      const url = await uploadImage(file);
      if (url) {
        await handleSendMessage('', url);
      }
    } catch (err: any) {
      toast.error('Görsel yüklenirken hata: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-gray-900 relative transition-colors">
      <div className="px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between shadow-sm z-10 min-w-0">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button 
            onClick={onBack}
            className="md:hidden p-2 -ml-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors flex-shrink-0"
          >
            <ArrowLeft size={20} />
          </button>
          
          <div className="relative w-10 h-10 flex-shrink-0">
            <div className="w-full h-full rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800">
              {isSystemChat ? (
                <img src={TALKO_LOGO_DATA_URL} alt="Talko Updates" className="w-full h-full object-cover" />
              ) : isAiChat ? (
                <img src={TALKO_AI_LOGO_DATA_URL} alt="Talko AI" className="w-full h-full object-cover" />
              ) : otherUserDetails?.photoURL ? (
                <img src={otherUserDetails.photoURL} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30">
                  <UserIcon size={20} />
                </div>
              )}
            </div>
            {otherUserOnline && !isVerified && (
              <span className="absolute bottom-0 right-0 block w-3 h-3 rounded-full bg-green-500 border-2 border-white dark:border-gray-900 shadow-sm z-10" />
            )}
          </div>
          
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <h2 className="font-semibold text-gray-900 dark:text-white leading-tight truncate">
                {otherUserDetails?.username}
              </h2>
              {isVerified && <VerifiedBadge className="w-4 h-4 flex-shrink-0" />}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {isSystemChat ? 'Talko Resmi Hesabı' : 
               isAiChat ? (aiState.isGenerating ? <span className="text-blue-500 dark:text-blue-400 italic">Düşünüyor...</span> : 'Resmî Yapay Zekâ Asistanı') :
               otherUserDetails?.isBanned ? 'Çevrimdışı' :
               isOtherUserTyping ? <span className="text-blue-500 dark:text-blue-400 italic">yazıyor...</span> :
               otherUserOnline ? <span className="text-blue-600 dark:text-blue-400 font-medium">Çevrimiçi</span> : 
               otherUserLastSeen ? formatLastSeen(otherUserLastSeen) : 'Çevrimdışı'}
            </p>
          </div>
        </div>
      </div>

      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-6"
      >
        {messages.map((msg, idx) => {
          const isMine = msg.senderId === currentUser?.uid;
          const showAvatar = !isMine && (idx === 0 || messages[idx - 1].senderId !== msg.senderId);
          
          return (
            <div 
              key={msg.id} 
              className={cn(
                "flex w-full min-w-0 px-0.5", 
                isMine ? "justify-end" : "justify-start", 
                !showAvatar && !isMine && "pl-10"
              )}
            >
              {!isMine && showAvatar && (
                <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 mr-2 mt-auto bg-gray-100 dark:bg-gray-800">
                   {isSystemChat ? (
                     <img src={TALKO_LOGO_DATA_URL} alt="Talko Updates" className="w-full h-full object-cover" />
                   ) : msg.senderId === TALKO_AI_USER_ID ? (
                     <img src={TALKO_AI_LOGO_DATA_URL} alt="Talko AI" className="w-full h-full object-cover" />
                   ) : otherUserDetails?.photoURL ? (
                     <img src={otherUserDetails.photoURL} alt="" className="w-full h-full object-cover" />
                   ) : (
                     <div className="w-full h-full flex items-center justify-center text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 text-xs">
                       <UserIcon size={14} />
                     </div>
                   )}
                </div>
              )}
              
              <div 
                style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                className={cn(
                  "max-w-[75%] md:max-w-[65%] min-w-0 rounded-2xl px-4 py-2.5 shadow-sm relative group break-words",
                  isMine ? "bg-blue-600 text-white rounded-br-sm" : "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-100 dark:border-gray-700 rounded-bl-sm"
                )}
              >
                {msg.imageUrl && (
                  <img 
                    src={msg.imageUrl} 
                    alt="Shared" 
                    onLoad={() => {
                      const container = scrollContainerRef.current;
                      if (container) {
                        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 250;
                        if (isNearBottom) {
                          scrollToBottom('smooth');
                        }
                      }
                    }}
                    className="max-w-full rounded-xl mb-2 object-cover max-h-64 cursor-pointer hover:opacity-95 transition-opacity" 
                  />
                )}
                {msg.text && (
                  <p 
                    style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                    className="whitespace-pre-wrap break-words text-[15px] leading-relaxed"
                  >
                    {msg.text}
                  </p>
                )}
                
                <span className={cn(
                  "text-[10px] mt-1 block",
                  isMine ? "text-blue-200 text-right" : "text-gray-400 dark:text-gray-500 text-right"
                )}>
                  {format(msg.timestamp, 'HH:mm')}
                </span>
              </div>
            </div>
          );
        })}
        
        {isOtherUserTyping && !isAiChat && (
          <div className="flex justify-start pl-10 w-full">
            <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce"></span>
              <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
              <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
            </div>
          </div>
        )}

        {isAiChat && aiState.isGenerating && (
          <div className="flex w-full min-w-0 px-0.5 justify-start">
            <div className={cn("w-8 h-8 rounded-full overflow-hidden flex-shrink-0 mr-2 mt-auto bg-gray-100 dark:bg-gray-800 transition-transform duration-1000", aiState.isThinking && "animate-breathe")}>
              <img src={TALKO_AI_LOGO_DATA_URL} alt="Talko AI" className="w-full h-full object-cover" />
            </div>
            <div className="max-w-[75%] md:max-w-[65%] min-w-0 rounded-2xl px-4 py-2.5 shadow-sm relative group break-words bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-100 dark:border-gray-700 rounded-bl-sm">
              {aiState.isThinking ? (
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                  <Loader2 size={16} className="animate-spin" />
                  <span className="text-sm font-medium">Düşünüyor...</span>
                </div>
              ) : (
                <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
                  <span className="animate-shimmer-text">
                    {aiState.streamText}
                  </span>
                </p>
              )}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {isSystemChat ? (
        <div className="p-4 pb-[calc(16px+env(safe-area-inset-bottom,0px))] bg-gray-50 dark:bg-gray-900/60 border-t border-gray-100 dark:border-gray-800 flex items-center justify-center">
          <div className="max-w-md w-full bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-2xl p-4 flex gap-3 shadow-sm">
            <span className="text-xl select-none" role="img" aria-label="lock">🔒</span>
            <div className="text-left">
              <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-0.5">
                Talko Updates
              </h4>
              <p className="text-xs text-blue-800/85 dark:text-blue-400/85 leading-relaxed">
                Bu doğrulanmış Talko Updates hesabıdır. Bu sohbet yalnızca resmî duyurular ve sistem bilgilendirmeleri için kullanılır. Bu hesaba mesaj gönderilemez.
              </p>
            </div>
          </div>
        </div>
      ) : otherUserDetails?.isBanned ? (
        <div className="p-4 pb-[calc(16px+env(safe-area-inset-bottom,0px))] bg-gray-50 dark:bg-gray-900/60 border-t border-gray-100 dark:border-gray-800 flex items-center justify-center">
          <div className="max-w-md w-full bg-red-50/50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-2xl p-4 flex gap-3 shadow-sm">
            <span className="text-xl select-none" role="img" aria-label="banned">🚫</span>
            <div className="text-left">
              <h4 className="text-sm font-semibold text-red-900 dark:text-red-300 mb-0.5">
                Kullanıcı Askıya Alındı
              </h4>
              <p className="text-xs text-red-800/85 dark:text-red-400/85 leading-relaxed">
                Bu kullanıcı hesabı, topluluk kurallarını ihlal ettiği gerekçesiyle askıya alınmıştır. Bu hesaba mesaj gönderilemez.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))] bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSendMessage(inputText); }}
            className="flex items-end gap-2 relative w-full min-w-0"
          >
            {showEmojiPicker && (
              <div className="absolute bottom-full left-0 mb-2 z-50 shadow-2xl rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800 max-w-full">
                <EmojiPicker onEmojiClick={onEmojiClick} autoFocusSearch={false} theme={theme} />
              </div>
            )}
            
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-2 sm:p-3 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors flex-shrink-0"
            >
              <Smile size={20} className="sm:w-6 sm:h-6" />
            </button>
            
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/*"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="p-2 sm:p-3 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors flex-shrink-0 disabled:opacity-50"
            >
              {isUploading ? <Loader2 size={20} className="animate-spin sm:w-6 sm:h-6" /> : <ImageIcon size={20} className="sm:w-6 sm:h-6" />}
            </button>
            
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => {
                const val = e.target.value;
                setInputText(val);
                handleTyping(val);
              }}
              onFocus={() => {
                if (typeof window !== 'undefined') {
                  window.scrollTo(0, 0);
                }
                setTimeout(() => {
                  if (typeof window !== 'undefined') {
                    window.scrollTo(0, 0);
                  }
                  forceScrollToBottom('smooth');
                }, 150);
              }}
              placeholder="Mesajınızı yazın..."
              className="flex-1 max-h-32 min-h-[48px] bg-gray-100 dark:bg-gray-800 border-transparent rounded-2xl px-4 py-3 focus:bg-white dark:focus:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none overflow-y-auto dark:text-white min-w-0"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(inputText);
                }
              }}
            />
            
            <button
              type="submit"
              disabled={!inputText.trim() || isUploading}
              className="p-2 sm:p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors flex-shrink-0 disabled:opacity-50 disabled:bg-gray-300 dark:disabled:bg-gray-700"
            >
              <Send size={16} className="sm:w-5 sm:h-5 ml-0.5 sm:ml-1" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
