import { LogOut, ShieldAlert } from 'lucide-react';
import { auth } from '../lib/firebase';
import toast from 'react-hot-toast';

export default function BannedScreen() {
  const handleLogout = async () => {
    try {
      await auth.signOut();
      toast.success('Oturum kapatıldı.');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-slate-900 border border-red-950/40 rounded-3xl p-8 shadow-2xl relative overflow-hidden text-center">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-red-600" />
        
        <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
          <ShieldAlert size={36} className="animate-bounce" />
        </div>

        <h1 className="text-2xl font-black text-white tracking-tight mb-3">
          Hesabınız Askıya Alındı
        </h1>
        
        <p className="text-slate-400 text-sm leading-relaxed mb-6">
          Talko topluluk kurallarına aykırı davranışlar tespit edildiği veya güvenlik ihlali gerekçesiyle bu hesaba erişim kalıcı olarak askıya alınmıştır. 
          <span className="block mt-3 font-semibold text-slate-300">
            Eğer bir hata olduğunu düşünüyorsanız, lütfen yönetimle iletişime geçin.
          </span>
        </p>

        <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-4 mb-8 text-xs text-slate-400 flex flex-col items-center justify-center gap-1">
          <span className="text-slate-300 font-medium">📧 İtiraz için:</span>
          <a href="mailto:talko.helpdesk@outlook.com" className="text-red-400 hover:text-red-300 transition-colors font-semibold select-all">
            talko.helpdesk@outlook.com
          </a>
        </div>

        <button
          onClick={handleLogout}
          className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl shadow-lg shadow-red-600/20 active:scale-98 transition-all flex items-center justify-center gap-2"
        >
          <LogOut size={18} />
          Başka Bir Hesapla Giriş Yap
        </button>
      </div>
    </div>
  );
}
