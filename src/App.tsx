/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import AuthScreen from './components/AuthScreen';
import MainLayout from './components/MainLayout';
import AdminPanel from './components/AdminPanel';
import BannedScreen from './components/BannedScreen';

function AppContent() {
  const { currentUser, userProfile } = useAuth();
  const [isAdminHash, setIsAdminHash] = useState(window.location.hash.startsWith('#/admin'));

  useEffect(() => {
    const handleHashChange = () => {
      setIsAdminHash(window.location.hash.startsWith('#/admin'));
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  if (isAdminHash) {
    return <AdminPanel />;
  }

  if (!currentUser) {
    return <AuthScreen />;
  }

  if (userProfile?.isBanned) {
    return <BannedScreen />;
  }
  
  return <MainLayout />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Toaster position="top-center" />
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

