/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ThemeProvider } from './components/ThemeProvider';
import { AuthProvider } from './context/AuthContext';
import { SyncProvider } from './context/SyncContext';
import { UIProvider, useUI } from './context/UIContext';
import { DataProvider } from './hooks/useRealtimeData';
import { Layout } from './components/Layout';
import { motion, AnimatePresence } from 'motion/react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { Customers } from './pages/Customers';
import { Entry } from './pages/Entry';
import { TransactionsList } from './pages/TransactionsList';
import { Notifications } from './pages/Notifications';
import { Settings } from './pages/Settings';
import { WhatsAppCallback } from './pages/WhatsAppCallback';
import { NotificationProvider } from './context/NotificationContext';
import { FeedbackProvider } from './context/FeedbackContext';

function AppContent() {
  const { setEntryTab, setPaymentFilter, setDateFilter, resetEntryFilters, setSearchTerm } = useUI();
  const navigate = useNavigate();
  const location = useLocation();

  // If accidentally navigated to /login, redirect cleanly to /
  React.useEffect(() => {
    if (location.pathname === '/login') {
      navigate('/', { replace: true });
    }
  }, [location.pathname, navigate]);

  // Derive currentTab from location (mapping callback paths gracefully to entry)
  const rawTab = location.pathname.split('/')[1] || 'dashboard';
  const currentTab = ['whatsapp', 'whatsapp-callback', 'callback', 'api'].includes(rawTab) ? 'entry' : rawTab;

  const handleTabChange = (tab: string) => {
    if (tab === 'entry') resetEntryFilters();
    if (tab === 'customers') setSearchTerm('');
    
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
      navigate('/transactions', { state: { filter: filter || 'ALL' } });
    }

    if (tab === 'customers') {
      navigate('/customers', { state: { filter: filter || 'all' } });
    }

    if (tab === 'dashboard') {
      navigate('/');
    }
  };

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
        <AuthProvider>
          <FeedbackProvider>
            <AppContent />
          </FeedbackProvider>
        </AuthProvider>
      </UIProvider>
    </ThemeProvider>
  );
}
