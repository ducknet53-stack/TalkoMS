import { useState, useRef } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { X, Camera, Loader2 } from 'lucide-react';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { uploadImage } from '../lib/imgbb';
import toast from 'react-hot-toast';

interface ProfileModalProps {
  onClose: () => void;
}

export default function ProfileModal({ onClose }: ProfileModalProps) {
  const { currentUser, userProfile } = useAuth();
  
  const [username, setUsername] = useState(userProfile?.username || '');
  const [about, setAbout] = useState(userProfile?.about || '');
  const [photoURL, setPhotoURL] = useState(userProfile?.photoURL || '');
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Lütfen geçerli bir görsel seçin.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Görsel boyutu 5MB\'dan küçük olmalıdır.');
      return;
    }

    setUploadingImage(true);
    try {
      const url = await uploadImage(file);
      if (url) {
        setPhotoURL(url);
        toast.success('Görsel yüklendi!');
      }
    } catch (err: any) {
      toast.error('Görsel yüklenirken hata oluştu: ' + err.message);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    
    setLoading(true);

    try {
      // Check username uniqueness if changed
      if (username !== userProfile?.username) {
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
      }

      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        username,
        usernameLower: username.toLowerCase(),
        about,
        photoURL
      });

      toast.success('Profil güncellendi!');
      onClose();
    } catch (err: any) {
      toast.error('Güncelleme hatası: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden transition-colors">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Profili Düzenle</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Avatar Upload */}
          <div className="flex flex-col items-center">
            <div className="relative group">
              <div className="w-24 h-24 rounded-full bg-gray-100 dark:bg-gray-800 border-4 border-white dark:border-gray-900 shadow-sm overflow-hidden flex items-center justify-center">
                {photoURL ? (
                  <img src={photoURL} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-gray-400 dark:text-gray-500 text-3xl font-medium">
                    {username.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
              >
                {uploadingImage ? <Loader2 size={24} className="text-white animate-spin" /> : <Camera size={24} className="text-white" />}
              </button>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageChange}
              accept="image/*"
              className="hidden"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">JPG, PNG veya GIF. Maks 5MB.</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kullanıcı Adı</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:bg-white dark:focus:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all dark:text-white"
                required
                minLength={3}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hakkımda</label>
              <textarea
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:bg-white dark:focus:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none h-24 dark:text-white"
                maxLength={120}
              />
              <p className="text-xs text-right text-gray-400 mt-1">{about.length}/120</p>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || uploadingImage}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl transition-colors flex items-center justify-center disabled:opacity-50"
            >
              {loading ? <Loader2 size={20} className="animate-spin" /> : 'Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
