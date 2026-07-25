import { useState, useEffect, FormEvent } from 'react';
import { collection, doc, updateDoc, getDocs, onSnapshot, query, orderBy, deleteDoc, writeBatch, setDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { User, Chat, Message } from '../types';
import { Fingerprint, Users, MessageSquare, ArrowLeft, Ban, Search, BadgeCheck, KeyRound, Clock, Eye, Trash2, Megaphone, Bell } from 'lucide-react';
import { TALKO_LOGO_DATA_URL } from '../lib/assets';
import toast from 'react-hot-toast';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

export default function AdminPanel() {
  const { currentUser } = useAuth();
  const [password, setPassword] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(() => {
    return localStorage.getItem('talko_admin_auth') === 'true';
  });
  
  const [activeTab, setActiveTab] = useState<'users' | 'chats' | 'broadcast'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [selectedChatMessages, setSelectedChatMessages] = useState<Message[]>([]);
  const [searchUserQuery, setSearchUserQuery] = useState('');
  const [searchChatQuery, setSearchChatQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Announcement broadcast states
  const [announcementText, setAnnouncementText] = useState('');
  const [announcementImage, setAnnouncementImage] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastProgress, setBroadcastProgress] = useState(0);

  // Check and authorize
  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (password === '9999') {
      setIsAuthorized(true);
      localStorage.setItem('talko_admin_auth', 'true');
      toast.success('Admin girişi başarılı!');
      
      // Update the user profile in Firestore to have isAdmin: true so Firebase Rules approve queries
      if (currentUser) {
        try {
          await updateDoc(doc(db, 'users', currentUser.uid), {
            isAdmin: true
          });
        } catch (err) {
          console.error("Could not set isAdmin field in Firestore. Make sure rules are updated:", err);
        }
      }
    } else {
      toast.error('Hatalı şifre! Lütfen tekrar deneyin.');
    }
  };

  const handleLogout = () => {
    setIsAuthorized(false);
    localStorage.removeItem('talko_admin_auth');
    toast.success('Admin oturumu kapatıldı.');
  };

  // Auto-ensure admin role in Firestore if authorized
  useEffect(() => {
    if (isAuthorized && currentUser) {
      updateDoc(doc(db, 'users', currentUser.uid), {
        isAdmin: true
      }).catch(err => {
        console.error("Auto-ensuring admin role failed on mount:", err);
      });
    }
  }, [isAuthorized, currentUser]);

  // 1. Fetch all users for Admin
  useEffect(() => {
    if (!isAuthorized) return;

    const usersRef = collection(db, 'users');
    const unsubscribe = onSnapshot(usersRef, (snapshot) => {
      const fetchedUsers = snapshot.docs.map(doc => doc.data() as User);
      // Sort: Banned first, then online, then name
      fetchedUsers.sort((a, b) => {
        if (a.isBanned && !b.isBanned) return -1;
        if (!a.isBanned && b.isBanned) return 1;
        const aOnline = a.isOnline || (a as any).online || false;
        const bOnline = b.isOnline || (b as any).online || false;
        if (aOnline && !bOnline) return -1;
        if (!aOnline && bOnline) return 1;
        return a.username.localeCompare(b.username, 'tr');
      });
      setUsers(fetchedUsers);
    }, (error) => {
      console.error("Error fetching users for admin:", error);
    });

    return () => unsubscribe();
  }, [isAuthorized]);

  // 2. Fetch all chats for Admin
  useEffect(() => {
    if (!isAuthorized) return;

    const chatsRef = collection(db, 'chats');
    const unsubscribe = onSnapshot(chatsRef, (snapshot) => {
      const fetchedChats = snapshot.docs.map(doc => doc.data() as Chat);
      fetchedChats.sort((a, b) => b.updatedAt - a.updatedAt);
      setChats(fetchedChats);
    }, (error) => {
      console.error("Error fetching chats for admin:", error);
    });

    return () => unsubscribe();
  }, [isAuthorized]);

  // 3. Fetch messages of selected chat
  useEffect(() => {
    if (!isAuthorized || !selectedChat) {
      setSelectedChatMessages([]);
      return;
    }

    const messagesRef = collection(db, `chats/${selectedChat.id}/messages`);
    const q = query(messagesRef, orderBy('timestamp', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMsgs = snapshot.docs.map(doc => doc.data() as Message);
      setSelectedChatMessages(fetchedMsgs);
    }, (error) => {
      console.error("Error fetching messages for admin logs:", error);
    });

    return () => unsubscribe();
  }, [isAuthorized, selectedChat]);

  // Ban/Unban user action
  const handleToggleBan = async (user: User) => {
    const userRef = doc(db, 'users', user.uid);
    const willBan = !user.isBanned;
    
    try {
      await updateDoc(userRef, {
        isBanned: willBan,
        bannedAt: willBan ? Date.now() : null,
        isOnline: false,
        online: false
      });
      
      toast.success(willBan ? `${user.username} başarıyla engellendi.` : `${user.username} engeli kaldırıldı.`);
    } catch (err: any) {
      console.error("Error toggling ban status:", err);
      toast.error("İşlem başarısız oldu. Yetkilerinizi kontrol edin.");
    }
  };

  // Broadcast announcement action
  const handleSendBroadcast = async (e: FormEvent) => {
    e.preventDefault();
    if (!announcementText.trim()) {
      toast.error("Duyuru metni boş olamaz!");
      return;
    }

    const SYSTEM_USER_ID = 'system_talko_destek';
    const targetUsers = users.filter(u => u.uid !== SYSTEM_USER_ID && !u.isBanned);

    if (targetUsers.length === 0) {
      toast.error("Duyuru gönderilecek aktif kullanıcı bulunamadı!");
      return;
    }

    const confirmSend = window.confirm(`Bu duyuruyu tüm ${targetUsers.length} kayıtlı kullanıcıya "Talko Destek" ismiyle göndermek istediğinizden emin misiniz?`);
    if (!confirmSend) return;

    setIsBroadcasting(true);
    setBroadcastProgress(0);

    let successCount = 0;

    try {
      for (let i = 0; i < targetUsers.length; i++) {
        const user = targetUsers[i];
        const chatId = [SYSTEM_USER_ID, user.uid].sort().join('_');
        const chatRef = doc(db, 'chats', chatId);

        // Ensure the chat exists and is updated
        await setDoc(chatRef, {
          id: chatId,
          participants: [SYSTEM_USER_ID, user.uid],
          participantDetails: {
            [SYSTEM_USER_ID]: { username: 'Talko Destek', photoURL: TALKO_LOGO_DATA_URL },
            [user.uid]: { username: user.username, photoURL: user.photoURL || null }
          },
          lastMessage: announcementText,
          lastMessageTimestamp: Date.now(),
          updatedAt: Date.now()
        }, { merge: true });

        // Add message
        const messageId = Date.now().toString() + '_' + Math.random().toString(36).substring(2, 9);
        const messageRef = doc(db, `chats/${chatId}/messages`, messageId);
        await setDoc(messageRef, {
          id: messageId,
          senderId: SYSTEM_USER_ID,
          text: announcementText,
          imageUrl: announcementImage.trim() || null,
          timestamp: Date.now()
        });

        successCount++;
        setBroadcastProgress(Math.round((successCount / targetUsers.length) * 100));
        
        // Minor delay to keep Firestore writes paced and update UI smoothly
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      toast.success(`Duyuru başarıyla ${successCount} kullanıcıya gönderildi!`);
      setAnnouncementText('');
      setAnnouncementImage('');
    } catch (err: any) {
      console.error("Error broadcasting announcement:", err);
      toast.error(`Duyuru gönderilirken hata oluştu: ${err.message || err}`);
    } finally {
      setIsBroadcasting(false);
      setBroadcastProgress(0);
    }
  };

  // Filter users lists
  const filteredUsers = users.filter(u => 
    u.username?.toLowerCase().includes(searchUserQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchUserQuery.toLowerCase())
  );

  const filteredChats = chats.filter(chat => {
    const participantsNames = chat.participants.map(pId => {
      if (pId === 'system_talko_destek') return 'Talko Destek';
      const userObj = users.find(u => u.uid === pId);
      return userObj ? userObj.username : pId;
    }).join(' ');
    
    return participantsNames.toLowerCase().includes(searchChatQuery.toLowerCase()) || 
           (chat.lastMessage && chat.lastMessage.toLowerCase().includes(searchChatQuery.toLowerCase()));
  });

  if (!isAuthorized) {
    return (
      <div className="fixed inset-0 overflow-y-auto bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans z-50">
        <div className="max-w-md w-full bg-slate-850/60 backdrop-blur-md rounded-3xl border border-slate-700/50 p-8 shadow-2xl relative overflow-hidden my-auto">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 to-cyan-500" />
          <div className="text-center mb-8">
            <div className="w-20 h-20 mx-auto mb-5 relative group flex items-center justify-center">
              <div className="absolute inset-0 bg-blue-500/20 rounded-2xl blur-md group-hover:blur-lg transition-all duration-300 animate-pulse" />
              <img src={TALKO_LOGO_DATA_URL} alt="Talko Logo" className="w-20 h-20 rounded-2xl border border-blue-500/30 shadow-lg shadow-blue-500/10 relative z-10 hover:scale-105 transition-transform duration-300 select-none pointer-events-none" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white mb-2">Talko Yönetim Paneli</h1>
            <p className="text-sm text-slate-400">Güvenlik ve denetim paneline erişmek için şifreyi girin</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Giriş Şifresi</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                  <KeyRound size={18} />
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••"
                  className="w-full pl-10 pr-4 py-3 bg-slate-900/50 border border-slate-700/60 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-center tracking-widest font-bold placeholder-slate-600 text-lg text-white"
                  autoFocus
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold rounded-xl shadow-lg shadow-blue-600/20 active:scale-98 transition-all flex items-center justify-center gap-2"
            >
              <KeyRound size={18} />
              Giriş Yap
            </button>
          </form>

          <button
            onClick={() => { window.location.hash = ''; }}
            className="w-full mt-4 py-2.5 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700/30 rounded-xl font-medium transition-all flex items-center justify-center gap-2 text-sm"
          >
            <ArrowLeft size={16} />
            Sohbete Dön
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-slate-950 text-slate-100 flex flex-col font-sans overflow-y-auto overflow-x-hidden relative">
      {/* Header */}
      <header className="bg-slate-900/80 border-b border-slate-800 backdrop-blur-md sticky top-0 z-30 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={TALKO_LOGO_DATA_URL} alt="Talko Logo" className="w-10 h-10 rounded-xl border border-blue-500/20 shadow-md shadow-blue-500/5 select-none pointer-events-none" />
          <div>
            <h1 className="font-bold text-lg text-white flex items-center gap-2">
              Talko Yönetim Paneli
              <span className="text-[10px] bg-red-500/15 text-red-400 border border-red-500/30 font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider">
                Yetkili
              </span>
            </h1>
            <p className="text-xs text-slate-400">Sistem denetimi, hesap engelleme ve güvenlik günlükleri</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => { window.location.hash = ''; }}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700/80 text-slate-300 hover:text-white rounded-xl text-sm font-semibold transition-all flex items-center gap-2"
          >
            <ArrowLeft size={16} />
            Sohbete Dön
          </button>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-950/40 hover:bg-red-950/60 border border-red-900/30 text-red-400 hover:text-red-300 rounded-xl text-sm font-semibold transition-all"
          >
            Güvenli Çıkış
          </button>
        </div>
      </header>

      {/* Stats Cards */}
      <section className="p-6 grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-500/10 text-indigo-400 rounded-xl flex items-center justify-center">
            <Users size={24} />
          </div>
          <div>
            <span className="text-xs text-slate-400 uppercase font-semibold">Toplam Kayıtlı Kullanıcı</span>
            <h3 className="text-2xl font-bold text-white mt-1">{users.length}</h3>
          </div>
        </div>

        <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-red-500/10 text-red-400 rounded-xl flex items-center justify-center">
            <Ban size={24} />
          </div>
          <div>
            <span className="text-xs text-slate-400 uppercase font-semibold">Engellenen Hesaplar</span>
            <h3 className="text-2xl font-bold text-red-400 mt-1">
              {users.filter(u => u.isBanned).length}
            </h3>
          </div>
        </div>

        <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 rounded-xl flex items-center justify-center">
            <MessageSquare size={24} />
          </div>
          <div>
            <span className="text-xs text-slate-400 uppercase font-semibold">Aktif Sohbet Odası</span>
            <h3 className="text-2xl font-bold text-emerald-400 mt-1">{chats.length}</h3>
          </div>
        </div>
      </section>

      {/* Main Container */}
      <main className="flex-1 px-6 pb-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Action and Listings Block */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl overflow-hidden lg:col-span-6 xl:col-span-5 flex flex-col h-[600px]">
          {/* Tab buttons */}
          <div className="flex border-b border-slate-800 bg-slate-900/60">
            <button
              onClick={() => setActiveTab('users')}
              className={cn(
                "flex-1 py-4 px-5 text-sm font-bold border-b-2 transition-all flex items-center justify-center gap-2",
                activeTab === 'users' 
                  ? "border-blue-500 text-blue-400 bg-slate-950/20" 
                  : "border-transparent text-slate-400 hover:text-white"
              )}
            >
              <Users size={16} />
              Kullanıcı Listesi
            </button>
            <button
              onClick={() => setActiveTab('chats')}
              className={cn(
                "flex-1 py-4 px-5 text-sm font-bold border-b-2 transition-all flex items-center justify-center gap-2",
                activeTab === 'chats' 
                  ? "border-blue-500 text-blue-400 bg-slate-950/20" 
                  : "border-transparent text-slate-400 hover:text-white"
              )}
            >
              <MessageSquare size={16} />
              Sohbet Günlükleri
            </button>
            <button
              onClick={() => setActiveTab('broadcast')}
              className={cn(
                "flex-1 py-4 px-5 text-sm font-bold border-b-2 transition-all flex items-center justify-center gap-2",
                activeTab === 'broadcast' 
                  ? "border-blue-500 text-blue-400 bg-slate-950/20" 
                  : "border-transparent text-slate-400 hover:text-white"
              )}
            >
              <Megaphone size={16} />
              Duyuru Gönder
            </button>
          </div>

          {/* Search Inputs */}
          {activeTab !== 'broadcast' && (
            <div className="p-4 border-b border-slate-800/80 bg-slate-950/20">
              {activeTab === 'users' ? (
                <div className="relative">
                  <Search size={16} className="absolute inset-y-0 left-3 my-auto text-slate-500" />
                  <input
                    type="text"
                    placeholder="Kullanıcı adı veya e-posta ile ara..."
                    value={searchUserQuery}
                    onChange={(e) => setSearchUserQuery(e.target.value)}
                    className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:border-blue-500 focus:ring-0 transition-all text-slate-200"
                  />
                </div>
              ) : (
                <div className="relative">
                  <Search size={16} className="absolute inset-y-0 left-3 my-auto text-slate-500" />
                  <input
                    type="text"
                    placeholder="Katılımcı isimlerine göre sohbet ara..."
                    value={searchChatQuery}
                    onChange={(e) => setSearchChatQuery(e.target.value)}
                    className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:border-blue-500 focus:ring-0 transition-all text-slate-200"
                  />
                </div>
              )}
            </div>
          )}

          {/* Scrollable List / Dynamic Content Area */}
          <div className={cn("flex-1 overflow-y-auto", activeTab !== 'broadcast' && "divide-y divide-slate-900")}>
            {activeTab === 'users' ? (
              filteredUsers.length > 0 ? (
                filteredUsers.map(user => {
                  const isOnline = user.isOnline || (user as any).online || false;
                  return (
                    <div key={user.uid} className="p-4 flex items-center justify-between hover:bg-slate-900/20 transition-all">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative w-10 h-10 flex-shrink-0">
                          <div className="w-full h-full rounded-full overflow-hidden bg-slate-800 border border-slate-700/60">
                            {user.photoURL ? (
                              <img src={user.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-400 bg-slate-800">
                                <Users size={16} />
                              </div>
                            )}
                          </div>
                          {isOnline && (
                            <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-slate-950 rounded-full" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-100 truncate text-[14px]">
                            {user.username}
                          </p>
                          <p className="text-xs text-slate-400 truncate">{user.email || 'E-posta yok'}</p>
                          {user.isBanned && (
                            <span className="inline-block mt-1 px-1.5 py-0.5 text-[9px] font-extrabold bg-red-950/80 text-red-400 border border-red-900/50 rounded uppercase tracking-wider">
                              Yasaklı
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleBan(user)}
                          className={cn(
                            "p-2 rounded-lg border transition-all text-xs font-semibold flex items-center gap-1.5",
                            user.isBanned 
                              ? "bg-emerald-950/30 border-emerald-900/40 text-emerald-400 hover:bg-emerald-950/60" 
                              : "bg-red-950/30 border-red-900/40 text-red-400 hover:bg-red-950/60"
                          )}
                          title={user.isBanned ? "Engeli Kaldır" : "Engelle"}
                        >
                          <Ban size={14} />
                          {user.isBanned ? 'Aç' : 'Banla'}
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-slate-500 text-sm">Kullanıcı bulunamadı.</div>
              )
            ) : activeTab === 'chats' ? (
              filteredChats.length > 0 ? (
                filteredChats.map(chat => {
                  const pNames = chat.participants.map(pId => {
                    if (pId === 'system_talko_destek') return 'Talko Destek';
                    const userObj = users.find(u => u.uid === pId);
                    return userObj ? userObj.username : pId;
                  }).join(' ↔ ');

                  const isSelected = selectedChat?.id === chat.id;

                  return (
                    <button
                      key={chat.id}
                      onClick={() => setSelectedChat(chat)}
                      className={cn(
                        "w-full p-4 text-left flex items-center justify-between hover:bg-slate-900/20 transition-all border-l-2",
                        isSelected ? "border-blue-500 bg-blue-950/15" : "border-transparent"
                      )}
                    >
                      <div className="min-w-0 flex-1 pr-3">
                        <p className="font-semibold text-slate-200 text-sm truncate">{pNames}</p>
                        <p className="text-xs text-slate-500 truncate mt-1">
                          {chat.lastMessage || 'Mesaj yok'}
                        </p>
                        <span className="inline-block mt-2 text-[10px] text-slate-500 flex items-center gap-1">
                          <Clock size={10} />
                          Güncelleme: {format(chat.updatedAt, 'dd MMM HH:mm', { locale: tr })}
                        </span>
                      </div>
                      <Eye size={16} className={cn("text-slate-500 flex-shrink-0", isSelected && "text-blue-400")} />
                    </button>
                  );
                })
              ) : (
                <div className="p-8 text-center text-slate-500 text-sm">Sohbet bulunamadı.</div>
              )
            ) : (
              /* Broadcast Info & Preview */
              <div className="p-5 flex flex-col h-full justify-between gap-5 select-none">
                <div>
                  <h3 className="font-bold text-white text-sm flex items-center gap-2 mb-2">
                    <Megaphone className="text-blue-400" size={16} />
                    Duyuru Sistemi Nasıl Çalışır?
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed mb-4">
                    Göndereceğiniz duyurular, tüm aktif Talko üyelerine <strong className="text-slate-200 font-bold">Talko Destek</strong> resmi hesabı üzerinden anlık olarak iletilecektir.
                  </p>

                  {/* Mobil Önizleme */}
                  <div className="border border-slate-800/80 rounded-2xl p-4 bg-slate-950/40 flex flex-col max-w-sm mx-auto shadow-inner">
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2 text-center border-b border-slate-800 pb-1.5">
                      Sohbet Balonu Önizlemesi
                    </div>
                    {/* Chat Area Simulation */}
                    <div className="bg-slate-900 border border-slate-800/60 rounded-xl p-3 flex flex-col gap-2 min-h-[190px]">
                      {/* Header Simulation */}
                      <div className="flex items-center gap-2 pb-1.5 border-b border-slate-800/40 mb-1">
                        <img src={TALKO_LOGO_DATA_URL} alt="" className="w-5 h-5 rounded-full" />
                        <div>
                          <div className="text-[10px] font-bold text-white">Talko Destek</div>
                          <div className="text-[7px] text-emerald-400">Duyuru Hesabı</div>
                        </div>
                      </div>
                      {/* Message Bubble Simulation */}
                      <div className="flex justify-start">
                        <div className="bg-slate-800 border border-slate-700/50 rounded-xl rounded-bl-none p-2.5 max-w-[90%] text-left">
                          {announcementImage.trim() && (
                            <img src={announcementImage.trim()} alt="Duyuru Görseli" className="max-h-20 rounded-lg mb-2 object-cover w-full border border-slate-700" />
                          )}
                          <p className="text-[10px] text-slate-200 whitespace-pre-wrap break-words leading-relaxed">
                            {announcementText.trim() || 'Sağ tarafa yazacağınız duyuru metni kullanıcıların sohbetinde bu şekilde görünecektir...'}
                          </p>
                          <span className="block text-[7px] text-slate-500 text-right mt-1 font-mono">
                            {format(Date.now(), 'HH:mm')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 bg-slate-950/15 p-3 border border-slate-800/30 rounded-lg">
                  <strong>💡 İpucu:</strong> Duyurularınıza görsellik katmak için resim URL adresi ekleyebilirsiniz. (Örn: doğrudan bir .png veya .jpg linki)
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Log Display / Message Inspection Box / Broadcast Form */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl overflow-hidden lg:col-span-6 xl:col-span-7 flex flex-col h-[600px]">
          {activeTab === 'broadcast' ? (
            /* Broadcast Composer Form */
            <form onSubmit={handleSendBroadcast} className="flex flex-col h-full justify-between p-6">
              <div className="space-y-6">
                <div className="border-b border-slate-800 pb-4">
                  <h3 className="font-bold text-white text-base flex items-center gap-2">
                    <Bell className="text-blue-400 animate-pulse" size={18} />
                    Yeni Duyuru Oluştur
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Toplam <span className="text-blue-400 font-bold">{users.filter(u => u.uid !== 'system_talko_destek' && !u.isBanned).length}</span> kayıtlı kullanıcıya Talko Destek adıyla yayınlanacaktır.
                  </p>
                </div>

                {/* Duyuru Metni */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Duyuru İçeriği (Zorunlu)
                  </label>
                  <textarea
                    required
                    value={announcementText}
                    onChange={(e) => setAnnouncementText(e.target.value)}
                    placeholder="Tüm kullanıcılara duyurmak istediğiniz mesajı buraya yazın..."
                    className="w-full h-44 px-4 py-3 bg-slate-950/40 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl text-sm text-white placeholder-slate-600 resize-none transition-all outline-none leading-relaxed font-sans"
                    disabled={isBroadcasting}
                  />
                </div>

                {/* Görsel URL */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Kapak Görseli URL adresi (İsteğe Bağlı)
                  </label>
                  <input
                    type="url"
                    value={announcementImage}
                    onChange={(e) => setAnnouncementImage(e.target.value)}
                    placeholder="https://resim-adresi.com/gorsel.jpg"
                    className="w-full px-4 py-3 bg-slate-950/40 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl text-sm text-white placeholder-slate-600 transition-all outline-none font-sans"
                    disabled={isBroadcasting}
                  />
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-800">
                {isBroadcasting && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-semibold text-slate-400">
                      <span>Duyuru Gönderiliyor...</span>
                      <span>%{broadcastProgress}</span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-blue-500 h-full transition-all duration-300"
                        style={{ width: `${broadcastProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isBroadcasting || !announcementText.trim()}
                  className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:pointer-events-none"
                >
                  {isBroadcasting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Yayınlanıyor...
                    </>
                  ) : (
                    <>
                      <Megaphone size={16} />
                      Yayınla ve Tüm Kullanıcılara Gönder
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : selectedChat ? (
            <>
              {/* Inspection Header */}
              <div className="px-5 py-4 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white text-sm">
                    {selectedChat.participants.map(pId => {
                      if (pId === 'system_talko_destek') return 'Talko Destek';
                      const userObj = users.find(u => u.uid === pId);
                      return userObj ? userObj.username : pId;
                    }).join(' ↔ ')}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Sohbet Odası Logları (Gözlem Modu)</p>
                </div>
                <div className="text-xs bg-slate-800 px-2.5 py-1 rounded-full text-slate-400 border border-slate-700/60 font-mono">
                  ID: {selectedChat.id.substring(0, 12)}...
                </div>
              </div>

              {/* Inspection Message History */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-950/20">
                {selectedChatMessages.length > 0 ? (
                  selectedChatMessages.map((msg) => {
                    const sender = users.find(u => u.uid === msg.senderId);
                    const senderName = msg.senderId === 'system_talko_destek' ? 'Talko Destek' : (sender ? sender.username : 'Bilinmeyen Kullanıcı');
                    const isSystem = msg.senderId === 'system_talko_destek';

                    return (
                      <div key={msg.id} className="p-3 bg-slate-900/60 border border-slate-800/60 rounded-xl max-w-full flex gap-3">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-800 flex-shrink-0">
                          {isSystem ? (
                            <img src={TALKO_LOGO_DATA_URL} alt="" className="w-full h-full object-cover" />
                          ) : sender?.photoURL ? (
                            <img src={sender.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs font-bold">
                              {senderName.substring(0, 2).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className={cn("font-bold text-xs text-slate-200", isSystem && "text-blue-400")}>
                              {senderName}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {format(msg.timestamp, 'dd/MM/yyyy HH:mm:ss')}
                            </span>
                          </div>
                          {msg.imageUrl && (
                            <img src={msg.imageUrl} alt="Shared" className="max-h-40 rounded-lg mb-2 object-cover border border-slate-800" />
                          )}
                          {msg.text && (
                            <p className="text-sm text-slate-300 whitespace-pre-wrap break-words leading-relaxed">
                              {msg.text}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                    Bu sohbette henüz mesaj bulunmuyor.
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
              <div className="w-16 h-16 bg-slate-900 border border-slate-800 text-slate-600 rounded-2xl flex items-center justify-center mb-4">
                <MessageSquare size={28} />
              </div>
              <h3 className="font-semibold text-slate-400 mb-1">Sohbet Seçilmedi</h3>
              <p className="text-xs max-w-xs leading-relaxed text-slate-500">
                Sol listeden gözlemlemek istediğiniz sohbet odasını seçerek tüm mesaj geçmişini inceleyebilirsiniz.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
