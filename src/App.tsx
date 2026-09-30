/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ThemeProvider } from './components/ThemeProvider';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SyncProvider } from './context/SyncContext';
import { UIProvider, useUI } from './context/UIContext';
import { DataProvider } from './hooks/useRealtimeData';
import { Layout } from './components/Layout';
import { IndianRupee } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { Customers } from './pages/Customers';
import { Entry } from './pages/Entry';
import { TransactionsList } from './pages/TransactionsList';
import { Notifications } from './pages/Notifications';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import { WhatsAppCallback } from './pages/WhatsAppCallback';
import { Login } from './pages/Login';
import { SecurityProvider, useSecurity } from './context/SecurityContext';
import { NotificationProvider } from './context/NotificationContext';
import { FeedbackProvider } from './context/FeedbackContext';
import { LockScreen } from './components/LockScreen';
import { PageContainer } from './components/PageContainer';

function AppContent() {
  const { user, loading } = useAuth();
  const { isLocked } = useSecurity();
  const { setEntryTab, setPaymentFilter, setDateFilter, resetEntryFilters, setSearchTerm } = useUI();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSplashDone, setIsSplashDone] = useState(false);

  // Derive currentTab from location (mapping callback paths gracefully to entry)
  const rawTab = location.pathname.split('/')[1] || 'dashboard';
  const currentTab = ['whatsapp', 'whatsapp-callback', 'callback', 'api'].includes(rawTab) ? 'entry' : rawTab;

  React.useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => setIsSplashDone(true), 1200);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  const handleTabChange = (tab: string) => {
    if (tab === 'entry') resetEntryFilters();
    if (tab === 'customers') setSearchTerm('');
    
    // Use navigate instead of setCurrentTab
    if (tab === 'dashboard') navigate('/');
    else if (tab === 'transactions') navigate('/transactions', { state: { fromTab: true } });
    else navigate(`/${tab}`);
  };

  const handleNavigate = (tab: string, filter?: any, customerId?: string, entryTabVal?: any, dateFilterVal?: any, urlFilter?: string) => {
    console.log(`[Navigation] to ${tab}${customerId ? ` for customer ${customerId}` : ''} with filters: ${filter}, ${entryTabVal}, ${urlFilter}`);
    
    // Set UI filters if provided
    if (tab === 'entry') {
      if (entryTabVal) setEntryTab(entryTabVal);
      if (filter) setPaymentFilter(filter);
      if (dateFilterVal) setDateFilter(dateFilterVal);
      
      const searchParamsObj = new URLSearchParams();
      if (customerId) searchParamsObj.set('focus', customerId);
      if (urlFilter) searchParamsObj.set('filter', urlFilter);
      
      const search = searchParamsObj.toString() ? `?${searchParamsObj.toString()}` : '';
      navigate(`/entry${search}`);
    }

    if (tab === 'transactions') {
      // Pass the filter in state as requested by the user
      navigate('/transactions', { state: { filter: filter || 'ALL' } });
    }

    if (tab === 'customers') {
      navigate('/customers');
    }

    if (tab === 'dashboard') {
      navigate('/');
    }
  };

  const goToEntry = (customerId: string) => {
    console.log(`[Add Entry] Triggered for: ${customerId}`);
    if (!customerId) return;
    handleNavigate('entry', undefined, customerId);
  };

  if (loading || !isSplashDone) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg relative overflow-hidden">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex flex-col items-center gap-8 z-10"
        >
          <div className="w-24 h-24 bg-accent rounded-3xl flex items-center justify-center shadow-2xl shadow-accent/20">
             <IndianRupee size={48} className="text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-4xl font-black tracking-tight text-text-primary">Pigmy Pro</h1>
            <p className="text-[11px] font-bold text-text-secondary opacity-40 uppercase tracking-[0.4em] mt-2">Fintech Collection Suite</p>
          </div>
          
          <div className="flex flex-col items-center gap-3">
             <div className="w-48 h-1 bg-border/20 rounded-full relative overflow-hidden">
                <motion.div 
                  initial={{ x: '-100%' }}
                  animate={{ x: '100%' }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 bg-accent"
                />
             </div>
             <p className="text-[10px] font-bold text-text-secondary animate-pulse uppercase tracking-[0.1em]">Securing Workspace...</p>
          </div>
        </motion.div>
        
        {/* Background Decorative */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent/5 rounded-full blur-[120px] pointer-events-none" />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (isLocked) {
    return <LockScreen />;
  }

  return (
    <SyncProvider>
      <DataProvider>
        <NotificationProvider>
          <Layout currentTab={currentTab} setCurrentTab={handleTabChange}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="h-full"
              >
                <Routes location={location}>
                  <Route path="/" element={<Dashboard onNavigate={handleNavigate} />} />
                  <Route path="/customers" element={<Customers onNavigate={handleNavigate} />} />
                  <Route path="/entry" element={<Entry />} />
                  <Route path="/transactions" element={<TransactionsList />} />
                  <Route path="/notifications" element={<Notifications />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/whatsapp/callback" element={<WhatsAppCallback onNavigate={handleNavigate} />} />
                  <Route path="/whatsapp-callback" element={<WhatsAppCallback onNavigate={handleNavigate} />} />
                  <Route path="/whatsapp" element={<WhatsAppCallback onNavigate={handleNavigate} />} />
                  <Route path="/callback" element={<WhatsAppCallback onNavigate={handleNavigate} />} />
                  <Route path="/api/whatsapp/callback" element={<WhatsAppCallback onNavigate={handleNavigate} />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </motion.div>
            </AnimatePresence>
          </Layout>
        </NotificationProvider>
      </DataProvider>
    </SyncProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <UIProvider>
        <SecurityProvider>
          <AuthProvider>
            <FeedbackProvider>
              <AppContent />
            </FeedbackProvider>
          </AuthProvider>
        </SecurityProvider>
      </UIProvider>
    </ThemeProvider>
  );
}
