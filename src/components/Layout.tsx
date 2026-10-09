import React, { useState, useEffect, useRef } from 'react';
import { Home, Users, PlusCircle, Settings as SettingsIcon, Activity, X, Plus, UserPlus, Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useSync } from '../context/SyncContext';
import { useUI } from '../context/UIContext';
import { useFeedback } from '../context/FeedbackContext';
import { useTheme } from './ThemeProvider';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { Settings as SettingsPage } from '../pages/Settings';
import { useRealtimeData } from '../hooks/useRealtimeData';
import { CollectionMode } from '../pages/CollectionMode';
import { CustomerForm } from './CustomerForm';
import { BottomSheet } from './BottomSheet';
import { firestoreService } from '../services/firestoreService';

const navItems = [
  { id: 'dashboard', icon: Home, label: 'Dashboard' },
  { id: 'customers', icon: Users, label: 'Borrowers' },
  { id: 'entry', icon: PlusCircle, label: 'Collection' },
  { id: 'transactions', icon: Activity, label: 'Ledger' },
];

export function Layout({ children, currentTab, setCurrentTab }: { children: React.ReactNode, currentTab: string, setCurrentTab: (t: string) => void }) {
  const { isCompact, isModalOpen, isCustomerDetailsOpen } = useUI();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { isSyncing } = useSync();
  const { setCenterOpen, history } = useFeedback();
  const { theme, toggleTheme } = useTheme();
  const contentRef = useRef<HTMLDivElement>(null);

  const { customers, transactions } = useRealtimeData();
  const [showGlobalAddCustomer, setShowGlobalAddCustomer] = useState(false);
  const [showGlobalCollection, setShowGlobalCollection] = useState(false);

  const handleGlobalAddCustomerSave = async (customer: any) => {
    try {
      if (navigator.vibrate) navigator.vibrate(10);
      await firestoreService.saveCustomer(customer);
      toast.success('Borrower registered successfully');
      setShowGlobalAddCustomer(false);
    } catch (e) {
      toast.error('Failed to register borrower');
    }
  };

  // Scroll to top implementation for tab clicks
  const handleTabClick = (tabId: string) => {
    if (tabId === currentTab) {
      const scrollContainer = contentRef.current?.querySelector('[data-scroll-container="true"]');
      if (scrollContainer) {
        scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } else {
      if (navigator.vibrate) navigator.vibrate(5);
      setCurrentTab(tabId);
    }
  };

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const handleAndroidBack = (e: Event) => {
      if (isSettingsOpen) {
        e.preventDefault();
        setIsSettingsOpen(false);
      } else if (showGlobalAddCustomer) {
        e.preventDefault();
        setShowGlobalAddCustomer(false);
      } else if (showGlobalCollection) {
        e.preventDefault();
        setShowGlobalCollection(false);
      }
    };
    window.addEventListener('pigmy-android-back', handleAndroidBack);
    return () => window.removeEventListener('pigmy-android-back', handleAndroidBack);
  }, [isSettingsOpen, showGlobalAddCustomer, showGlobalCollection]);

  const getPageTitle = (tab: string) => {
    switch (tab) {
      case 'dashboard': return 'Financial Overview';
      case 'customers': return 'Borrowers Directory';
      case 'entry': return 'Daily Collection';
      case 'transactions': return 'Audit Ledger';
      case 'notifications': return 'Alerts & Reminders';
      case 'settings': return 'System Settings';
      default: return 'Pigmy Pro';
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-bg text-text-primary overflow-hidden relative selection:bg-accent/20">
      {/* Skip to Main Content Link for Keyboard and Screen Reader Accessibility (WCAG 2.4.1) */}
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[99999] focus:bg-accent focus:text-white focus:px-4 focus:py-2.5 focus:rounded-xl focus:shadow-xl focus:font-black focus:text-xs focus:uppercase focus:tracking-wider focus:outline-none focus:ring-4 focus:ring-accent/40"
      >
        Skip to main content
      </a>
      
      {/* Top Universal App Header across all screens */}
      <header className="flex-shrink-0 sticky top-0 pt-[env(safe-area-inset-top)] bg-card/95 backdrop-blur-md border-b border-border/80 z-[990] transition-colors" role="banner">
        <div className="h-14 max-w-4xl mx-auto flex items-center justify-between px-4 sm:px-6">
          
          {/* Brand & Context */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => handleTabClick('dashboard')}
              className="flex items-center gap-2.5 text-left group transition-transform active:scale-95"
              title="Go to Dashboard"
              aria-label={`Pigmy Pro Dashboard - Current page: ${getPageTitle(currentTab)}`}
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent to-blue-700 text-white flex items-center justify-center font-black text-sm tracking-tight shadow-md shadow-accent/20 group-hover:brightness-105 transition-all" aria-hidden="true">
                PP
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-sm tracking-tight text-text-primary leading-none">
                    Pigmy Pro
                  </span>
                  {/* Real-time sync dot */}
                  <span 
                    className={cn(
                      "w-2 h-2 rounded-full inline-block transition-colors",
                      !isOnline ? "bg-danger" : isSyncing ? "bg-amber-500 animate-pulse" : "bg-success"
                    )}
                    role="status"
                    aria-label={!isOnline ? "Offline mode" : isSyncing ? "Synchronizing changes" : "Online and synchronized"}
                  />
                </div>
                <span className="text-[10px] font-semibold text-text-secondary truncate leading-tight mt-0.5">
                  {getPageTitle(currentTab)}
                </span>
              </div>
            </button>
          </div>

          {/* Top Quick Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            
            {/* Quick New Customer Button */}
            <button
              type="button"
              onClick={() => {
                if (navigator.vibrate) navigator.vibrate(8);
                setShowGlobalAddCustomer(true);
              }}
              className="h-9 px-3 rounded-xl bg-accent hover:brightness-110 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm shadow-accent/25 transition-all cursor-pointer min-w-[36px]"
              title="Add New Borrower"
              aria-label="Register new borrower"
            >
              <Plus size={15} strokeWidth={2.5} aria-hidden="true" />
              <span className="hidden sm:inline">Add Customer</span>
            </button>

            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              className="w-9 h-9 rounded-xl bg-card hover:bg-muted border border-border/80 text-text-secondary hover:text-text-primary flex items-center justify-center active:scale-95 transition-all cursor-pointer"
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
              aria-label={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
            >
              {theme === 'dark' ? <Sun size={17} className="text-amber-400" aria-hidden="true" /> : <Moon size={17} className="text-indigo-600" aria-hidden="true" />}
            </button>

            {/* Settings Trigger */}
            <button 
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="w-9 h-9 rounded-xl bg-card hover:bg-muted border border-border/80 text-text-secondary hover:text-text-primary flex items-center justify-center active:scale-95 transition-all cursor-pointer"
              title="System Settings"
              aria-label="Open System Settings"
            >
              <SettingsIcon size={17} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main 
        id="main-content"
        tabIndex={-1}
        ref={contentRef}
        className="flex-1 relative min-h-0 overflow-hidden outline-none"
        role="main"
      >
        <AnimatePresence>
          {!isOnline && (
            <motion.div
              key="offline-banner"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              role="alert"
              aria-live="polite"
              className="sticky top-0 z-40 bg-warning/15 border-b border-warning/30 px-4 py-2 flex items-center justify-center gap-2 text-warning text-xs font-semibold backdrop-blur-md"
            >
              <span>⚠️ Offline mode active — Collections and updates are cached and will sync automatically upon reconnection.</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="h-full">
          {children}
        </div>

        {/* Settings Modal Overlay */}
        <AnimatePresence>
          {isSettingsOpen && (
            <motion.div 
              key="settings-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsOpen(false)}
              aria-hidden="true"
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99990] cursor-pointer"
            />
          )}
          {isSettingsOpen && (
            <motion.div
              key="settings-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="settings-modal-title"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 top-[8%] bg-card border-t border-border rounded-t-[32px] z-[99995] shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="h-14 flex items-center justify-between px-6 border-b border-border/80 shrink-0 bg-card">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center font-bold" aria-hidden="true">
                    <SettingsIcon size={16} />
                  </div>
                  <h2 id="settings-modal-title" className="text-sm font-bold text-text-primary">System Settings</h2>
                </div>
                <button 
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="min-w-[44px] min-h-[44px] rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center text-text-secondary hover:text-text-primary active:scale-90 transition-all cursor-pointer"
                  title="Close Settings"
                  aria-label="Close Settings"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <div className="max-w-3xl mx-auto p-4 sm:p-6">
                  <SettingsPage />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Global New Customer Form BottomSheet Modal */}
        <BottomSheet
          isOpen={showGlobalAddCustomer}
          onClose={() => setShowGlobalAddCustomer(false)}
          title="Register New Borrower"
          subtitle="Add loan amount, daily installment terms and contact"
        >
          <CustomerForm 
            onSave={handleGlobalAddCustomerSave} 
            onCancel={() => setShowGlobalAddCustomer(false)} 
          />
        </BottomSheet>

        {/* Global Full-Screen CollectionMode overlay */}
        <AnimatePresence>
          {showGlobalCollection && (
            <motion.div
              key="global-collection"
              role="dialog"
              aria-modal="true"
              aria-label="Collection Mode"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 260 }}
              className="fixed inset-0 z-[1200] overflow-hidden"
            >
              <CollectionMode
                customers={customers}
                transactions={transactions}
                onClose={() => setShowGlobalCollection(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Navigation Bar */}
      {!showGlobalCollection && !isModalOpen && !isCustomerDetailsOpen && (
        <nav 
          aria-label="Main Navigation"
          className="flex-shrink-0 sticky bottom-0 left-0 right-0 z-[980] bg-card/95 backdrop-blur-lg border-t border-border shadow-[0_-4px_24px_rgba(0,0,0,0.06)] pb-[env(safe-area-inset-bottom)]"
        >
          <div className="max-w-xl mx-auto flex justify-around items-center h-16 px-3" role="tablist" aria-label="Application tabs">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              const isEntry = item.id === 'entry';

              return (
                <button
                  key={item.id}
                  role="tab"
                  aria-selected={isActive}
                  aria-current={isActive ? "page" : undefined}
                  aria-label={`${item.label} tab`}
                  onClick={() => handleTabClick(item.id)}
                  className={cn(
                    "relative flex flex-col items-center justify-center flex-1 h-full py-1 transition-all outline-none group cursor-pointer min-h-[44px]",
                    isActive ? "text-accent" : "text-text-secondary hover:text-text-primary"
                  )}
                >
                  <div
                    className={cn(
                      "p-1.5 rounded-xl transition-all duration-200 flex items-center justify-center",
                      isEntry && !isActive ? "bg-accent/10 text-accent font-black" : "",
                      isActive 
                        ? isEntry 
                          ? "bg-accent text-white shadow-md shadow-accent/30 scale-105" 
                          : "text-accent bg-accent/15 scale-105" 
                        : "opacity-60 group-hover:opacity-100"
                    )}
                    aria-hidden="true"
                  >
                    <Icon size={isEntry ? 22 : 19} strokeWidth={isActive ? 2.5 : 2} />
                  </div>
                  <span className={cn(
                    "text-[11px] font-bold tracking-tight transition-colors mt-0.5",
                    isActive ? "text-accent font-black" : "opacity-70 group-hover:opacity-100"
                  )}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
