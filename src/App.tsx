/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
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
import { Settings } from './pages/Settings';
import { Notifications } from './pages/Notifications';
import { WhatsAppCallback } from './pages/WhatsAppCallback';
import { FeedbackProvider } from './context/FeedbackContext';
import { NotificationProvider } from './context/NotificationContext';
import { notificationService } from './services/notificationService';

function AppContent() {
  const {
    setEntryTab,
    setPaymentFilter,
    setDateFilter,
    resetEntryFilters,
    setSearchTerm,
    isModalOpen,
    setIsModalOpen,
    isCustomerDetailsOpen,
    setIsCustomerDetailsOpen,
  } = useUI();
  const navigate = useNavigate();
  const location = useLocation();

  // Register React Router navigation handler with notificationService for deep links
  React.useEffect(() => {
    notificationService.setNavigationHandler((targetUrl: string) => {
      navigate(targetUrl);
    });
  }, [navigate]);

  // If accidentally navigated to /login, redirect cleanly to /
  React.useEffect(() => {
    if (location.pathname === '/login') {
      navigate('/', { replace: true });
    }
  }, [location.pathname, navigate]);

  // Handle Capacitor Android hardware back button and deep link URLs
  React.useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const backListenerPromise = CapApp.addListener('backButton', ({ canGoBack }) => {
      // First dispatch a cancelable custom event so open overlays/modals in Layout can close
      const overlayEvent = new CustomEvent('pigmy-android-back', { cancelable: true });
      const notHandledByOverlay = window.dispatchEvent(overlayEvent);
      if (!notHandledByOverlay) {
        return;
      }

      if (isModalOpen) {
        setIsModalOpen(false);
        return;
      }
      if (isCustomerDetailsOpen) {
        setIsCustomerDetailsOpen(false);
        return;
      }

      if (location.pathname !== '/') {
        if (canGoBack) {
          navigate(-1);
        } else {
          navigate('/', { replace: true });
        }
      } else {
        CapApp.exitApp();
      }
    });

    const urlListenerPromise = CapApp.addListener('appUrlOpen', (event) => {
      try {
        const url = new URL(event.url);
        // Handle custom schemes (pigmy://path or com.pigmypro.smartcollection://path) and https URLs
        let targetPath = url.pathname || '/';
        if ((url.protocol === 'pigmy:' || url.protocol === 'com.pigmypro.smartcollection:') && url.host) {
          targetPath = `/${url.host}${url.pathname && url.pathname !== '/' ? url.pathname : ''}`;
        }
        const fullRoute = `${targetPath}${url.search || ''}`;
        navigate(fullRoute);
      } catch (err) {
        console.warn('[Capacitor DeepLink] Failed to parse URL:', event.url, err);
      }
    });

    return () => {
      backListenerPromise.then((h) => h.remove()).catch(() => {});
      urlListenerPromise.then((h) => h.remove()).catch(() => {});
    };
  }, [location.pathname, navigate, isModalOpen, setIsModalOpen, isCustomerDetailsOpen, setIsCustomerDetailsOpen]);

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
      const search = customerId ? `?customerId=${customerId}` : '';
      navigate(`/customers${search}`, { state: { filter: filter || 'all', from: 'dashboard' } });
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
