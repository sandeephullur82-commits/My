import React, { useState, useEffect, useRef } from 'react';
import { Home, Users, PlusCircle, Settings as SettingsIcon, Activity, X, Plus, UserPlus, Sun, Moon, Smartphone, Keyboard } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useSync } from '../context/SyncContext';
import { useUI } from '../context/UIContext';
import { useFeedback } from '../context/FeedbackContext';
import { useTheme } from './ThemeProvider';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

import { useRealtimeData } from '../hooks/useRealtimeData';
import { CustomerForm } from './CustomerForm';
import { firestoreService } from '../services/firestoreService';
import { PWAInstallPrompt } from './PWAInstallPrompt';
import { usePWAInstall } from '../hooks/usePWAInstall';

const navItems = [
  { id: 'dashboard', icon: Home, label: 'Dashboard', shortcut: '1' },
  { id: 'customers', icon: Users, label: 'Customer', shortcut: '2' },
  { id: 'entry', icon: PlusCircle, label: 'Collection', shortcut: '3' },
  { id: 'transactions', icon: Activity, label: 'Ledger', shortcut: '4' },
];

export function Layout({ children, currentTab, setCurrentTab }: { children: React.ReactNode, currentTab: string, setCurrentTab: (t: string) => void }) {
  const { isCompact, isModalOpen, setIsModalOpen, isCustomerDetailsOpen } = useUI();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const { isSyncing } = useSync();
  const { setCenterOpen, history } = useFeedback();
  const { theme, toggleTheme } = useTheme();
  const { isInstallable, promptInstall } = usePWAInstall();
  const contentRef = useRef<HTMLDivElement>(null);

  const { customers, transactions } = useRealtimeData();
  const [showGlobalAddCustomer, setShowGlobalAddCustomer] = useState(false);

  const handleGlobalAddCustomerSave = async (customer: any) => {
    try {
      if (navigator.vibrate) navigator.vibrate(10);
      await firestoreService.saveCustomer(customer);
      toast.success('Customer registered successfully');
      setShowGlobalAddCustomer(false);
      setIsModalOpen(false);
    } catch (e) {
      toast.error('Failed to register customer');
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

  // removed add customer android back listener

  // Desktop Keyboard Shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target?.tagName === 'INPUT' || 
        target?.tagName === 'TEXTAREA' || 
        target?.tagName === 'SELECT' || 
        target?.isContentEditable
      ) {
        return;
      }

      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case '1':
        case 'd':
        case 'D':
          handleTabClick('dashboard');
          break;
        case '2':
        case 'c':
        case 'C':
          handleTabClick('customers');
          break;
        case '3':
        case 'e':
        case 'E':
          handleTabClick('entry');
          break;
        case '4':
        case 'l':
        case 'L':
          handleTabClick('transactions');
          break;
        // 'n' shortcut removed
        case '?':
          e.preventDefault();
          setShowShortcutsHelp(prev => !prev);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [currentTab]);

  const getPageTitle = (tab: string) => {
    switch (tab) {
      case 'dashboard': return 'Financial Overview';
      case 'customers': return 'Customer Directory';
      case 'entry': return 'Daily Collection';
      case 'transactions': return 'Audit Ledger';
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
      {!isModalOpen && !isCustomerDetailsOpen && (
        <header className="flex-shrink-0 sticky top-0 pt-[env(safe-area-inset-top)] bg-card/95 backdrop-blur-md border-b border-border/80 z-[990] transition-colors" role="banner">
        <div className="h-14 max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 md:px-8">
          
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

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-1.5 mx-2 lg:mx-4" aria-label="Desktop Navigation" role="tablist">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              const isEntry = item.id === 'entry';

              return (
                <button
                  key={item.id}
                  role="tab"
                  aria-selected={isActive}
                  aria-label={`${item.label} tab`}
                  onClick={() => handleTabClick(item.id)}
                  className={cn(
                    "h-9 px-3 lg:px-3.5 rounded-xl font-bold text-xs flex items-center gap-1.5 lg:gap-2 transition-all cursor-pointer active:scale-95 relative",
                    isActive
                      ? isEntry
                        ? "bg-accent text-white shadow-sm shadow-accent/25 font-black"
                        : "bg-accent/15 text-accent font-black"
                      : "text-text-secondary hover:text-text-primary hover:bg-muted/70"
                  )}
                >
                  <Icon size={15} strokeWidth={isActive ? 2.5 : 2} aria-hidden="true" />
                  <span>{item.label}</span>
                  <span className="hidden xl:inline text-[9px] opacity-40 font-mono font-bold">
                    {item.shortcut}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Top Quick Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            
            {/* Quick Add Customer Trigger removed */}

            {/* Keyboard Shortcuts Trigger on Desktop */}
            <button
              type="button"
              onClick={() => setShowShortcutsHelp(true)}
              className="hidden md:flex w-9 h-9 rounded-xl bg-card hover:bg-muted border border-border/80 text-text-secondary hover:text-text-primary items-center justify-center active:scale-95 transition-all cursor-pointer"
              title="Keyboard Shortcuts (Press ?)"
              aria-label="View Keyboard Shortcuts"
            >
              <Keyboard size={16} aria-hidden="true" />
            </button>

            {/* Install App Button when available in browser */}
            {isInstallable && (
              <button
                type="button"
                onClick={promptInstall}
                className="h-9 px-2.5 rounded-xl bg-indigo-600/15 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/30 font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-xs"
                title="Install Progressive Web App"
                aria-label="Install Pigmy Pro PWA"
              >
                <Smartphone size={14} strokeWidth={2.3} />
                <span className="hidden md:inline">Install</span>
              </button>
            )}

            {/* Quick Add Customer Trigger using New Loan Form */}
            <button
              type="button"
              onClick={() => {
                if (navigator.vibrate) navigator.vibrate(8);
                setShowGlobalAddCustomer(true);
                setIsModalOpen(true);
              }}
              className="hidden sm:flex h-9 px-3 rounded-xl bg-accent hover:brightness-110 text-white font-bold text-xs items-center gap-1.5 shadow-sm shadow-accent/25 transition-all active:scale-95 cursor-pointer"
              title="Register New Customer with Loan Form"
            >
              <UserPlus size={14} strokeWidth={2.5} />
              <span>Add Customer</span>
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
              onClick={() => handleTabClick('settings')}
              className="w-9 h-9 rounded-xl bg-card hover:bg-muted border border-border/80 text-text-secondary hover:text-text-primary flex items-center justify-center active:scale-95 transition-all cursor-pointer"
              title="System Settings"
              aria-label="Open System Settings"
            >
              <SettingsIcon size={17} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>
      )}

      {/* Non-intrusive PWA Install Prompt (detects uninstalled state & triggers beforeinstallprompt) */}
      <PWAInstallPrompt />

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



        {/* Global New Customer Form removed */}

        {/* Global New Customer Registration via New Loan Form */}
        <AnimatePresence>
          {showGlobalAddCustomer && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-50 bg-bg overflow-y-auto flex flex-col min-h-[100dvh]"
            >
              <div className="sticky top-0 z-20 bg-card/90 backdrop-blur-xl border-b border-border/40 px-4 md:px-8 py-4 flex items-center justify-between">
                <div>
                  <h2 className="text-sm md:text-base font-black text-text-primary uppercase tracking-wider">NEW LOAN CUSTOMER REGISTRATION</h2>
                  <p className="text-[10px] font-bold text-text-secondary opacity-60 uppercase tracking-widest mt-0.5">REGISTER BORROWER WITH LOAN, INTEREST, AND INSTALLMENT TERMS</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowGlobalAddCustomer(false);
                    setIsModalOpen(false);
                  }}
                  className="w-8 h-8 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center text-text-secondary cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="flex-1 max-w-2xl lg:max-w-3xl w-full mx-auto p-4 md:p-8 pb-32">
                <CustomerForm 
                  mode="new_loan"
                  onSave={handleGlobalAddCustomerSave} 
                  onCancel={() => {
                    setShowGlobalAddCustomer(false);
                    setIsModalOpen(false);
                  }} 
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Keyboard Shortcuts Help Dialog (Desktop & Tablets) */}
        <AnimatePresence>
          {showShortcutsHelp && (
            <motion.div
              key="shortcuts-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowShortcutsHelp(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99990] flex items-center justify-center p-4 cursor-pointer"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-card border border-border/80 rounded-3xl shadow-2xl max-w-md w-full p-6 text-left cursor-default overflow-hidden"
              >
                <div className="flex items-center justify-between pb-4 border-b border-border/80 mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-accent/15 text-accent flex items-center justify-center">
                      <Keyboard size={16} />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-text-primary uppercase tracking-wider">Keyboard Shortcuts</h3>
                      <p className="text-[10px] text-text-secondary">Fast desktop and tablet navigation</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowShortcutsHelp(false)}
                    className="w-8 h-8 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center text-text-secondary cursor-pointer"
                  >
                    <X size={15} />
                  </button>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between py-1.5 border-b border-border/30">
                    <span className="text-text-secondary">Dashboard</span>
                    <kbd className="px-2 py-0.5 rounded bg-muted font-mono font-bold text-text-primary text-[11px] border border-border/60">1 or D</kbd>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-border/30">
                    <span className="text-text-secondary">Customer Directory</span>
                    <kbd className="px-2 py-0.5 rounded bg-muted font-mono font-bold text-text-primary text-[11px] border border-border/60">2 or C</kbd>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-border/30">
                    <span className="text-text-secondary">Daily Collection Entry</span>
                    <kbd className="px-2 py-0.5 rounded bg-muted font-mono font-bold text-text-primary text-[11px] border border-border/60">3 or E</kbd>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-border/30">
                    <span className="text-text-secondary">Audit Ledger</span>
                    <kbd className="px-2 py-0.5 rounded bg-muted font-mono font-bold text-text-primary text-[11px] border border-border/60">4 or L</kbd>
                  </div>

                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-text-secondary">Toggle Shortcuts Help</span>
                    <kbd className="px-2 py-0.5 rounded bg-muted font-mono font-bold text-text-primary text-[11px] border border-border/60">?</kbd>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Navigation Bar (Mobile Viewports Only) */}
      {!isModalOpen && !isCustomerDetailsOpen && (
        <nav 
          aria-label="Main Navigation"
          className="md:hidden flex-shrink-0 sticky bottom-0 left-0 right-0 z-[980] bg-card/95 backdrop-blur-lg border-t border-border shadow-[0_-4px_24px_rgba(0,0,0,0.06)] pb-[env(safe-area-inset-bottom)]"
        >
          <div className="max-w-xl mx-auto flex items-center justify-around h-16 px-1.5" role="tablist" aria-label="Application tabs">
            {/* Tab 1: Dashboard */}
            <button
              role="tab"
              aria-selected={currentTab === 'dashboard'}
              aria-current={currentTab === 'dashboard' ? "page" : undefined}
              aria-label="Dashboard tab"
              onClick={() => handleTabClick('dashboard')}
              className={cn(
                "relative flex flex-col items-center justify-center flex-1 h-full py-1 transition-all outline-none group cursor-pointer min-h-[44px]",
                currentTab === 'dashboard' ? "text-accent" : "text-text-secondary hover:text-text-primary"
              )}
            >
              <div
                className={cn(
                  "p-1.5 rounded-xl transition-all duration-200 flex items-center justify-center",
                  currentTab === 'dashboard' ? "text-accent bg-accent/15 scale-105" : "opacity-60 group-hover:opacity-100"
                )}
                aria-hidden="true"
              >
                <Home size={19} strokeWidth={currentTab === 'dashboard' ? 2.5 : 2} />
              </div>
              <span className={cn(
                "text-[10px] font-bold tracking-tight transition-colors mt-0.5",
                currentTab === 'dashboard' ? "text-accent font-black" : "opacity-70 group-hover:opacity-100"
              )}>
                Dashboard
              </span>
            </button>

            {/* Tab 2: Customer */}
            <button
              role="tab"
              aria-selected={currentTab === 'customers'}
              aria-current={currentTab === 'customers' ? "page" : undefined}
              aria-label="Customer tab"
              onClick={() => handleTabClick('customers')}
              className={cn(
                "relative flex flex-col items-center justify-center flex-1 h-full py-1 transition-all outline-none group cursor-pointer min-h-[44px]",
                currentTab === 'customers' ? "text-accent" : "text-text-secondary hover:text-text-primary"
              )}
            >
              <div
                className={cn(
                  "p-1.5 rounded-xl transition-all duration-200 flex items-center justify-center",
                  currentTab === 'customers' ? "text-accent bg-accent/15 scale-105" : "opacity-60 group-hover:opacity-100"
                )}
                aria-hidden="true"
              >
                <Users size={19} strokeWidth={currentTab === 'customers' ? 2.5 : 2} />
              </div>
              <span className={cn(
                "text-[10px] font-bold tracking-tight transition-colors mt-0.5",
                currentTab === 'customers' ? "text-accent font-black" : "opacity-70 group-hover:opacity-100"
              )}>
                Customer
              </span>
            </button>

            {/* Center Action: Add Customer Button */}
            <button
              type="button"
              onClick={() => {
                if (navigator.vibrate) navigator.vibrate(8);
                setShowGlobalAddCustomer(true);
                setIsModalOpen(true);
              }}
              className="relative flex flex-col items-center justify-center flex-1 h-full py-0.5 transition-all outline-none group cursor-pointer min-h-[44px]"
              title="Add Customer"
              aria-label="Add Customer"
            >
              <div 
                className="w-10 h-10 -mt-2 rounded-2xl bg-accent hover:brightness-110 text-white shadow-md shadow-accent/35 flex items-center justify-center active:scale-90 transition-transform cursor-pointer"
                aria-hidden="true"
              >
                <UserPlus size={19} strokeWidth={2.5} />
              </div>
              <span className="text-[10px] font-black tracking-tight text-accent mt-0.5 whitespace-nowrap">
                Add Customer
              </span>
            </button>

            {/* Tab 3: Collection */}
            <button
              role="tab"
              aria-selected={currentTab === 'entry'}
              aria-current={currentTab === 'entry' ? "page" : undefined}
              aria-label="Collection tab"
              onClick={() => handleTabClick('entry')}
              className={cn(
                "relative flex flex-col items-center justify-center flex-1 h-full py-1 transition-all outline-none group cursor-pointer min-h-[44px]",
                currentTab === 'entry' ? "text-accent" : "text-text-secondary hover:text-text-primary"
              )}
            >
              <div
                className={cn(
                  "p-1.5 rounded-xl transition-all duration-200 flex items-center justify-center",
                  currentTab === 'entry' 
                    ? "bg-accent text-white shadow-md shadow-accent/30 scale-105" 
                    : "bg-accent/10 text-accent font-black opacity-60 group-hover:opacity-100"
                )}
                aria-hidden="true"
              >
                <PlusCircle size={20} strokeWidth={currentTab === 'entry' ? 2.5 : 2} />
              </div>
              <span className={cn(
                "text-[10px] font-bold tracking-tight transition-colors mt-0.5",
                currentTab === 'entry' ? "text-accent font-black" : "opacity-70 group-hover:opacity-100"
              )}>
                Collection
              </span>
            </button>

            {/* Tab 4: Ledger */}
            <button
              role="tab"
              aria-selected={currentTab === 'transactions'}
              aria-current={currentTab === 'transactions' ? "page" : undefined}
              aria-label="Ledger tab"
              onClick={() => handleTabClick('transactions')}
              className={cn(
                "relative flex flex-col items-center justify-center flex-1 h-full py-1 transition-all outline-none group cursor-pointer min-h-[44px]",
                currentTab === 'transactions' ? "text-accent" : "text-text-secondary hover:text-text-primary"
              )}
            >
              <div
                className={cn(
                  "p-1.5 rounded-xl transition-all duration-200 flex items-center justify-center",
                  currentTab === 'transactions' ? "text-accent bg-accent/15 scale-105" : "opacity-60 group-hover:opacity-100"
                )}
                aria-hidden="true"
              >
                <Activity size={19} strokeWidth={currentTab === 'transactions' ? 2.5 : 2} />
              </div>
              <span className={cn(
                "text-[10px] font-bold tracking-tight transition-colors mt-0.5",
                currentTab === 'transactions' ? "text-accent font-black" : "opacity-70 group-hover:opacity-100"
              )}>
                Ledger
              </span>
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
