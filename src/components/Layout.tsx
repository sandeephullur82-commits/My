import React, { useState, useEffect, useRef } from 'react';
import { Home, Users, PlusCircle, Settings, Activity, Bell, X, Plus, Zap, UserPlus, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useSync } from '../context/SyncContext';
import { useUI } from '../context/UIContext';
import { useFeedback } from '../context/FeedbackContext';
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
  { id: 'customers', icon: Users, label: 'Customers' },
  { id: 'entry', icon: PlusCircle, label: 'Entry' },
  { id: 'transactions', icon: Activity, label: 'History' },
];

export function Layout({ children, currentTab, setCurrentTab }: { children: React.ReactNode, currentTab: string, setCurrentTab: (t: string) => void }) {
  const { isCompact, isModalOpen } = useUI();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showLive, setShowLive] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { isSyncing } = useSync();
  const { setCenterOpen, history } = useFeedback();
  const contentRef = useRef<HTMLDivElement>(null);

  const { customers, transactions } = useRealtimeData();
  const [showFABMenu, setShowFABMenu] = useState(false);
  const [showGlobalAddCustomer, setShowGlobalAddCustomer] = useState(false);
  const [showGlobalCollection, setShowGlobalCollection] = useState(false);

  const handleGlobalAddCustomerSave = async (customer: any) => {
    try {
      if (navigator.vibrate) navigator.vibrate(10);
      await firestoreService.saveCustomer(customer);
      toast.success('Customer registered successfully');
      setShowGlobalAddCustomer(false);
    } catch (e) {
      toast.error('Failed to register customer');
    }
  };

  const unreadCount = history.filter(n => !n.isRead).length;

  // Scroll to top implementation for tab clicks
  const handleTabClick = (tabId: string) => {
    if (tabId === currentTab) {
      // Find the scroll container (PageContainer's div)
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
    if (isSyncing) {
      setShowLive(true);
    } else if (isOnline) {
      const timer = setTimeout(() => {
        setShowLive(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isSyncing, isOnline]);

  return (
    <div className="flex flex-col h-full w-full bg-bg text-text-primary overflow-hidden relative">
      
      {/* Top Bar - Shows only on Dashboard */}
      {currentTab === 'dashboard' && (
        <header 
          className="flex-shrink-0 sticky top-0 pt-[env(safe-area-inset-top)] bg-card shadow-sm z-[998] border-b border-border/10"
        >
          <div className="h-12 flex items-center justify-between px-4 relative">
            <div className="w-10">
              <button 
                onClick={() => setCurrentTab('dashboard')}
                className="p-1 text-accent font-black text-lg tracking-tighter outline-none active:scale-95 transition-transform"
              >
                PP
              </button>
            </div>
            <h1 className="text-[11px] font-black uppercase tracking-[0.2em] absolute left-1/2 -translate-x-1/2 opacity-60">
              {currentTab}
            </h1>
            
            <div className="flex items-center gap-3">
              <AnimatePresence mode="wait">
                {!isOnline && (
                  <motion.div
                    key="offline-indicator"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="bg-warning/20 text-warning px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest"
                  >
                    Offline
                  </motion.div>
                )}
                {isSyncing && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="bg-accent/20 text-accent px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest flex items-center gap-1"
                  >
                    <div className="w-2 h-2 border border-accent/30 border-t-accent rounded-full animate-spin" />
                  </motion.div>
                )}
              </AnimatePresence>
              
              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="w-8 h-8 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-accent hover:bg-accent/20 transition-all active:scale-95"
                title="Profile & Settings"
              >
                <Users size={16} />
              </button>
            </div>
          </div>
        </header>
      )}

      {/* Main Content */}
      <main 
        ref={contentRef}
        className="flex-1 relative min-h-0 overflow-hidden"
      >
        <AnimatePresence>
          {!isOnline && (
            <motion.div
              key="offline-banner"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-0 left-0 right-0 z-10 bg-warning/10 border-b border-warning/20 p-2 flex items-center justify-center gap-2 text-warning text-xs font-medium"
            >
              ⚠️ Offline – Changes will sync later
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
              className="absolute inset-0 bg-bg/80 backdrop-blur-md z-[1000] cursor-pointer"
            />
          )}
          {isSettingsOpen && (
            <motion.div
              key="settings-modal"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="absolute inset-x-0 bottom-0 top-[10%] bg-bg border-t border-border/50 rounded-t-[40px] z-[1001] shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="h-14 flex items-center justify-between px-8 border-b border-border/10 shrink-0">
                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-text-secondary opacity-60">System Settings</span>
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-text-secondary hover:text-text-primary active:scale-90"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <div className="max-w-2xl mx-auto">
                  <SettingsPage />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Global Floating Action Button (FAB) (Only on Dashboard and Customers where actions exist) */}
        {['dashboard', 'customers'].includes(currentTab) && !isSettingsOpen && !isModalOpen && (
          <>
            {/* Backdrop for FAB Menu */}
            {['dashboard', 'customers'].includes(currentTab) && showFABMenu && (
              <div 
                className="fixed inset-0 bg-bg/40 backdrop-blur-sm z-[980] transition-opacity animate-in fade-in duration-200"
                onClick={() => setShowFABMenu(false)}
              />
            )}

            {/* Menu options structure */}
            <div className="fixed right-5 bottom-[calc(76px+env(safe-area-inset-bottom))] z-[985] flex flex-col items-end gap-3.5 pointer-events-none">
              <AnimatePresence>
                {currentTab === 'dashboard' && showFABMenu && (
                  <motion.div
                    key="dashboard-new-customer"
                    initial={{ opacity: 0, y: 15, scale: 0.85 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 15, scale: 0.85 }}
                    transition={{ duration: 0.18, delay: 0.04 }}
                    className="flex items-center gap-2.5 pointer-events-auto cursor-pointer group"
                    onClick={() => {
                      setShowFABMenu(false);
                      setShowGlobalAddCustomer(true);
                    }}
                  >
                    <span className="bg-card dark:bg-muted/80 px-3 py-1.5 rounded-xl border border-border/50 text-[10px] font-black uppercase tracking-widest text-text-primary shadow-sm hover:border-success/40 transition-colors">
                      👤 New Customer
                    </span>
                    <div className="w-11 h-11 rounded-full bg-success text-white flex items-center justify-center shadow-lg shadow-success/20 active:scale-90 hover:brightness-110 transition-all">
                      <UserPlus size={18} strokeWidth={2.5} />
                    </div>
                  </motion.div>
                )}

                {currentTab === 'dashboard' && showFABMenu && (
                  <motion.div
                    key="dashboard-add-entry"
                    initial={{ opacity: 0, y: 15, scale: 0.85 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 15, scale: 0.85 }}
                    transition={{ duration: 0.18 }}
                    className="flex items-center gap-2.5 pointer-events-auto cursor-pointer group"
                    onClick={() => {
                      setShowFABMenu(false);
                      setCurrentTab('entry');
                    }}
                  >
                    <span className="bg-card dark:bg-muted/80 px-3 py-1.5 rounded-xl border border-border/50 text-[10px] font-black uppercase tracking-widest text-text-primary shadow-sm hover:border-accent/40 transition-colors">
                      📝 Add Entry
                    </span>
                    <div className="w-11 h-11 rounded-full bg-accent text-white flex items-center justify-center shadow-lg shadow-accent/20 active:scale-90 hover:brightness-110 transition-all">
                      <PlusCircle size={18} strokeWidth={2.5} />
                    </div>
                  </motion.div>
                )}

                {currentTab === 'customers' && showFABMenu && (
                  <motion.div
                    key="customers-new-customer"
                    initial={{ opacity: 0, y: 15, scale: 0.85 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 15, scale: 0.85 }}
                    transition={{ duration: 0.18, delay: 0.04 }}
                    className="flex items-center gap-2.5 pointer-events-auto cursor-pointer group"
                    onClick={() => {
                      setShowFABMenu(false);
                      setShowGlobalAddCustomer(true);
                    }}
                  >
                    <span className="bg-card dark:bg-muted/80 px-3 py-1.5 rounded-xl border border-border/50 text-[10px] font-black uppercase tracking-widest text-text-primary shadow-sm hover:border-success/40 transition-colors">
                      👤 New Customer
                    </span>
                    <div className="w-11 h-11 rounded-full bg-success text-white flex items-center justify-center shadow-lg shadow-success/20 active:scale-90 hover:brightness-110 transition-all">
                      <UserPlus size={18} strokeWidth={2.5} />
                    </div>
                  </motion.div>
                )}

                {currentTab === 'customers' && showFABMenu && (
                  <motion.div
                    key="customers-search"
                    initial={{ opacity: 0, y: 15, scale: 0.85 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 15, scale: 0.85 }}
                    transition={{ duration: 0.18 }}
                    className="flex items-center gap-2.5 pointer-events-auto cursor-pointer group"
                    onClick={() => {
                      setShowFABMenu(false);
                      const input = document.getElementById('customers-search-input');
                      if (input) {
                        input.focus();
                          input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                      }}
                    >
                      <span className="bg-card dark:bg-muted/80 px-3 py-1.5 rounded-xl border border-border/50 text-[10px] font-black uppercase tracking-widest text-text-primary shadow-sm hover:border-accent/40 transition-colors">
                        🔍 Search
                      </span>
                      <div className="w-11 h-11 rounded-full bg-accent text-white flex items-center justify-center shadow-lg shadow-accent/20 active:scale-90 hover:brightness-110 transition-all">
                        <Search size={18} strokeWidth={2.5} />
                      </div>
                    </motion.div>
                )}
              </AnimatePresence>

              {/* Central Trigger Button */}
               <motion.button
                 whileTap={{ scale: 0.93 }}
                 onClick={() => {
                   if (navigator.vibrate) navigator.vibrate(8);
                   if (currentTab === 'dashboard' || currentTab === 'customers') {
                     setShowFABMenu(!showFABMenu);
                   } else if (currentTab === 'entry') {
                     const input = document.getElementById('entry-search-input');
                     if (input) {
                       input.focus();
                       input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                     }
                   } else if (currentTab === 'transactions') {
                     setCurrentTab('entry');
                   }
                 }}
                 className="pointer-events-auto w-14 h-14 rounded-full bg-accent text-white flex items-center justify-center shadow-2xl transition-all duration-300 relative overflow-hidden group border border-accent/20"
                 style={{
                   boxShadow: '0 8px 30px rgba(59, 130, 246, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.2)'
                 }}
               >
                 {/* Active Rotation motion */}
                 <motion.div
                   animate={{ rotate: ((currentTab === 'dashboard' || currentTab === 'customers') && showFABMenu) ? 135 : 0 }}
                   transition={{ type: 'spring', stiffness: 220, damping: 18 }}
                 >
                   {(currentTab === 'dashboard' || currentTab === 'customers') && <Plus size={26} strokeWidth={3} />}
                   {currentTab === 'entry' && <Search size={22} strokeWidth={2.5} />}
                   {currentTab === 'transactions' && <PlusCircle size={22} strokeWidth={2.5} />}
                 </motion.div>
               </motion.button>
            </div>
          </>
        )}

        {/* Global New Customer Form BottomSheet Modal */}
        <BottomSheet
          isOpen={showGlobalAddCustomer}
          onClose={() => setShowGlobalAddCustomer(false)}
          title="New Customer"
          subtitle="Register a new borrower"
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

      {/* Bottom Navigation */}
      {!showGlobalCollection && !isModalOpen && (
        <nav 
          className="fixed bottom-0 left-0 right-0 z-[990] bg-card/95 backdrop-blur-md border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.04)] pb-[env(safe-area-inset-bottom)]"
        >
          <div className="max-w-xl mx-auto flex justify-around items-center h-16 px-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleTabClick(item.id)}
                  className="relative flex flex-col items-center justify-center flex-1 h-full text-text-secondary hover:text-text-primary transition-colors outline-none py-1 group"
                >
                  <div
                    className={cn(
                      "p-1.5 rounded-xl transition-all duration-200",
                      isActive ? "text-accent bg-accent/10 scale-110" : "opacity-50 group-hover:opacity-80"
                    )}
                  >
                    <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                  </div>
                  <span className={cn(
                    "text-[10px] items-center transition-colors uppercase tracking-[0.08em] font-bold mt-0.5",
                    isActive ? "text-accent opacity-100" : "opacity-40"
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
