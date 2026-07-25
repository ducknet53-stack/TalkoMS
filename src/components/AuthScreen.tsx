import { useState } from 'react';
import type { FormEvent } from 'react';
import { auth, db } from '../lib/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDocs, setDoc, query, collection, where, serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { MessageSquare } from 'lucide-react';
import { ensureSystemAccount, sendWelcomeMessageIfNeeded } from '../lib/systemAccount';

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        // Check username uniqueness
        if (username.length < 3) {
          toast.error("Kullanıcı adı en az 3 karakter olmalıdır.");
          setLoading(false);
          return;
        }

        const usernameLower = username.toLowerCase();
        
        // Reserved usernames check
        const reservedNames = [
          'talko', 'talko ai', 'talko updates', 'talko official', 
          'talko support', 'talko helpdesk', 'talko verified'
        ];
        
        if (reservedNames.some(name => usernameLower.includes(name))) {
          toast.error("Bu kullanıcı adı alınamaz. Lütfen başka bir ad seçin.");
          setLoading(false);
          return;
        }

        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('usernameLower', '==', usernameLower));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          toast.error("Bu kullanıcı adı zaten alınmış.");
          setLoading(false);
          return;
        }

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          username,
          usernameLower,
          email,
          photoURL: null,
          about: 'Merhaba, ben Talko kullanıyorum!',
          isOnline: true,
          online: true,
          lastSeen: serverTimestamp(),
          createdAt: Date.now(),
          isBanned: false,
          bannedAt: null
        });

        // Ensure system account exists and send welcome message
        await ensureSystemAccount();
        await sendWelcomeMessageIfNeeded(user.uid, username);
        
        toast.success("Hesap oluşturuldu!");
      }
    } catch (error: any) {
      const friendlyMessage = getFriendlyErrorMessage(error);
      toast.error(friendlyMessage, { duration: 6000 });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      toast.error("Lütfen e-posta adresinizi girin.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success("Şifre sıfırlama e-postası gönderildi.");
    } catch (error: any) {
      toast.error(getFriendlyErrorMessage(error));
    }
  };

  const getFriendlyErrorMessage = (error: any): string => {
    const code = error?.code || '';
    const message = error?.message || '';
    
    if (code === 'auth/operation-not-allowed' || message.includes('operation-not-allowed')) {
      return "E-posta/Şifre giriş yöntemi Firebase Console üzerinde henüz etkinleştirilmemiş! Lütfen Firebase Console > Authentication > Sign-in method sekmesinden 'Email/Password' sağlayıcısını aktif hale getirin.";
    }
    if (code === 'auth/email-already-in-use' || message.includes('email-already-in-use')) {
      return "Bu e-posta adresiyle zaten bir hesap oluşturulmuş.";
    }
    if (code === 'auth/invalid-email' || message.includes('invalid-email')) {
      return "Geçersiz e-posta adresi girdiniz.";
    }
    if (code === 'auth/weak-password' || message.includes('weak-password')) {
      return "Şifreniz çok zayıf. Lütfen en az 6 karakter uzunluğunda bir şifre girin.";
    }
    if (code === 'auth/user-not-found' || message.includes('user-not-found')) {
      return "Bu e-posta adresiyle kayıtlı bir kullanıcı bulunamadı.";
    }
    if (code === 'auth/wrong-password' || message.includes('wrong-password') || code === 'auth/invalid-credential' || message.includes('invalid-credential')) {
      return "E-posta adresiniz veya şifreniz hatalı.";
    }
    
    return message || "Bir hata oluştu, lütfen tekrar deneyin.";
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white p-4 transition-colors">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 transition-colors">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-4 text-white">
            <MessageSquare size={32} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">TALKO</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2 text-center">
            Profesyonel ve modern mesajlaşma platformu.
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kullanıcı Adı</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all dark:text-white"
                placeholder="benzersiz_ad"
                required={!isLogin}
              />
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">E-posta</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all dark:text-white"
              placeholder="ornek@email.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Şifre</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all dark:text-white"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition-colors disabled:opacity-50"
          >
            {loading ? "Bekleniyor..." : (isLogin ? "Giriş Yap" : "Kayıt Ol")}
          </button>
        </form>

        <div className="mt-6 flex flex-col space-y-3 text-center text-sm">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
            type="button"
          >
            {isLogin ? "Hesabın yok mu? Kayıt Ol" : "Zaten hesabın var mı? Giriş Yap"}
          </button>
          
          {isLogin && (
            <button
              onClick={handleResetPassword}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
              type="button"
            >
              Şifremi unuttum
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
