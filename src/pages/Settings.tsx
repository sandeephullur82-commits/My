import React, { useState } from 'react';
import { 
  User, Palette, LayoutDashboard, ShieldCheck, 
  ToggleLeft, ToggleRight, CheckCircle, Moon, Sun,
  Smartphone, Download, HelpCircle, ChevronDown, ChevronUp,
  Sparkles, Database, Trash2, Building, Coins, AlertCircle, Receipt, FileText, LogOut
} from 'lucide-react';
import { useTheme } from '../components/ThemeProvider';
import { useUI } from '../context/UIContext';
import { useAuth } from '../context/AuthContext';
import { useRealtimeData } from '../hooks/useRealtimeData';
import { getPlatformDetails } from '../utils/capacitorDeviceHelper';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { firestoreService } from '../services/firestoreService';

export function Settings() {
  const { theme, toggleTheme } = useTheme();
  const { isCompact, toggleCompact } = useUI();
  const { user, logout } = useAuth();
  const { customers, transactions, refreshData } = useRealtimeData();
  const { isInstallable, isStandalone, promptInstall } = usePWAInstall();
  const platform = getPlatformDetails();

  const [showPwaGuide, setShowPwaGuide] = useState(false);
  
  // Business Profile State
  const [profile, setProfile] = useState(() => {
    try {
      const saved = localStorage.getItem('pigmy_business_profile');
      return saved ? JSON.parse(saved) : {
        collectorName: 'Collector Agent',
        agencyName: 'Pigmy Collection Agency',
        currency: '₹'
      };
    } catch {
      return { collectorName: 'Collector Agent', agencyName: 'Pigmy Collection Agency', currency: '₹' };
    }
  });

  // Receipt Configuration State
  const [receiptSettings, setReceiptSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('pigmy_receipt_settings');
      return saved ? JSON.parse(saved) : { printLogo: true, includeFooterNotes: true, paperSize: 'standard' };
    } catch {
      return { printLogo: true, includeFooterNotes: true, paperSize: 'standard' };
    }
  });

  const toggleReceiptSetting = (key: 'printLogo' | 'includeFooterNotes') => {
    const updated = { ...receiptSettings, [key]: !receiptSettings[key] };
    setReceiptSettings(updated);
    localStorage.setItem('pigmy_receipt_settings', JSON.stringify(updated));
    setStatusMessage({ type: 'success', text: 'Receipt configuration updated successfully.' });
    setTimeout(() => setStatusMessage(null), 3000);
  };


  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [tempProfile, setTempProfile] = useState(profile);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setProfile(tempProfile);
    localStorage.setItem('pigmy_business_profile', JSON.stringify(tempProfile));
    setIsEditingProfile(false);
    setStatusMessage({ type: 'success', text: 'Business profile updated successfully.' });
    setTimeout(() => setStatusMessage(null), 3500);
  };

  const handleInstallPwaClick = async () => {
    if (isInstallable) {
      const accepted = await promptInstall();
      if (!accepted) {
        setShowPwaGuide(true);
      }
    } else {
      setShowPwaGuide((prev) => !prev);
    }
  };

  return (
    <div className="h-full overflow-y-auto px-4 sm:px-8 lg:px-12 py-8 flex flex-col gap-8 pb-32 animate-in fade-in duration-500 max-w-7xl mx-auto w-full">
      {/* Header & Status Banner */}
      {statusMessage && (
        <div className={`p-4 rounded-2xl border text-xs font-bold flex items-center gap-3 animate-in fade-in slide-in-from-top-2 ${
          statusMessage.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' 
            : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
        }`}>
          {statusMessage.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Account / Profile Card */}
      <div className="bg-card rounded-[28px] border border-border/60 shadow-lg p-6 sm:p-8 flex flex-col md:flex-row items-center gap-6">
        <div className="relative group shrink-0">
          <div className="w-24 h-24 bg-accent/10 border-4 border-card rounded-full flex items-center justify-center text-accent shadow-xl">
            <User size={44} strokeWidth={1.8} />
          </div>
          <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-1.5 rounded-full border-2 border-card shadow-md">
            <ShieldCheck size={16} />
          </div>
        </div>

        <div className="flex-1 text-center md:text-left min-w-0">
          <div className="flex items-center justify-center md:justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-text-primary tracking-tight">{profile.collectorName}</h2>
              <p className="text-xs font-bold text-text-secondary opacity-70 uppercase tracking-widest mt-0.5">
                {profile.agencyName} • Currency: <span className="text-accent font-black">{profile.currency}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setTempProfile(profile);
                  setIsEditingProfile(!isEditingProfile);
                }}
                className="py-2 px-4 rounded-xl bg-accent/10 hover:bg-accent/20 text-accent font-black text-xs uppercase tracking-wider transition-all cursor-pointer"
              >
                {isEditingProfile ? 'Cancel Edit' : 'Edit Profile'}
              </button>
              <button
                type="button"
                onClick={logout}
                className="py-2 px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <LogOut size={14} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-center md:justify-start gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <CheckCircle size={12} /> Firestore Sync Active
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-bold bg-accent/10 text-accent border border-accent/20">
              <Database size={12} /> {customers.length} Customers Managed
            </span>
          </div>
        </div>
      </div>

      {/* Edit Profile Form Modal / Box */}
      {isEditingProfile && (
        <form onSubmit={handleSaveProfile} className="bg-card rounded-[24px] border border-accent/30 shadow-xl p-6 space-y-4 animate-in fade-in">
          <h3 className="text-sm font-black text-text-primary uppercase tracking-wider flex items-center gap-2">
            <Building size={16} className="text-accent" /> Edit Business & Collector Details
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-black text-text-secondary uppercase tracking-wider mb-1.5">Collector Name</label>
              <input
                type="text"
                value={tempProfile.collectorName}
                onChange={(e) => setTempProfile({ ...tempProfile, collectorName: e.target.value })}
                required
                className="w-full px-4 py-2.5 rounded-xl bg-bg border border-border/70 text-text-primary text-sm font-bold focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-[11px] font-black text-text-secondary uppercase tracking-wider mb-1.5">Agency / Business Name</label>
              <input
                type="text"
                value={tempProfile.agencyName}
                onChange={(e) => setTempProfile({ ...tempProfile, agencyName: e.target.value })}
                required
                className="w-full px-4 py-2.5 rounded-xl bg-bg border border-border/70 text-text-primary text-sm font-bold focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-[11px] font-black text-text-secondary uppercase tracking-wider mb-1.5">Currency Symbol</label>
              <select
                value={tempProfile.currency}
                onChange={(e) => setTempProfile({ ...tempProfile, currency: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-bg border border-border/70 text-text-primary text-sm font-bold focus:outline-none focus:border-accent"
              >
                <option value="₹">₹ (INR - Indian Rupee)</option>
                <option value="$">$ (USD - US Dollar)</option>
                <option value="€">€ (EUR - Euro)</option>
                <option value="£">£ (GBP - British Pound)</option>
                <option value="₥">₥ (Pigmy Coin)</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsEditingProfile(false)}
              className="px-4 py-2 rounded-xl bg-border/40 hover:bg-border/60 text-text-primary text-xs font-bold uppercase tracking-wider cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-accent hover:bg-accent/90 text-white text-xs font-black uppercase tracking-wider shadow-md cursor-pointer"
            >
              Save Changes
            </button>
          </div>
        </form>
      )}

      {/* Main Settings Sections Grid (Preferences & Receipt Configuration) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Preferences Section */}
        <div className="space-y-3">
          <h3 className="text-[10px] font-black text-text-secondary opacity-50 uppercase tracking-[0.2em] px-2">Preferences</h3>
          <div className="bg-card rounded-[24px] border border-border/60 shadow-sm overflow-hidden p-2 space-y-1">
            <button
              type="button"
              onClick={toggleTheme}
              className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-bg transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
                  <Palette size={20} />
                </div>
                <div className="text-left">
                  <p className="font-bold text-sm text-text-primary tracking-tight">Appearance</p>
                  <p className="text-[10px] font-medium text-text-secondary opacity-70 uppercase tracking-widest leading-none mt-1">
                    {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                 {theme === 'dark' ? <Moon size={18} className="text-accent" /> : <Sun size={18} className="text-amber-500" />}
              </div>
            </button>

            <button
              type="button"
              onClick={toggleCompact}
              className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-bg transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
                  <LayoutDashboard size={20} />
                </div>
                <div className="text-left">
                  <p className="font-bold text-sm text-text-primary tracking-tight">Compact Mode</p>
                  <p className="text-[10px] font-medium text-text-secondary opacity-70 uppercase tracking-widest leading-none mt-1">
                    {isCompact ? 'High Density View' : 'Standard Spacing'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                 {isCompact ? <ToggleRight size={26} className="text-accent" /> : <ToggleLeft size={26} className="text-text-secondary opacity-40" />}
              </div>
            </button>
          </div>
        </div>

        {/* Receipt & Thermal Print Configuration Section */}
        <div className="space-y-3">
          <h3 className="text-[10px] font-black text-text-secondary opacity-50 uppercase tracking-[0.2em] px-2">Receipt & Thermal Print Configuration</h3>
          <div className="bg-card rounded-[24px] border border-border/60 shadow-sm overflow-hidden p-2 space-y-1">
            <button
              type="button"
              onClick={() => toggleReceiptSetting('printLogo')}
              className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-bg transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
                  <Receipt size={20} />
                </div>
                <div className="text-left">
                  <p className="font-bold text-sm text-text-primary tracking-tight">Print Logo on Receipts</p>
                  <p className="text-[10px] font-medium text-text-secondary opacity-70 uppercase tracking-widest leading-none mt-1">
                    {receiptSettings.printLogo ? 'Logo enabled at receipt top' : 'Logo hidden (text header only)'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                 {receiptSettings.printLogo ? <ToggleRight size={26} className="text-accent" /> : <ToggleLeft size={26} className="text-text-secondary opacity-40" />}
              </div>
            </button>

            <button
              type="button"
              onClick={() => toggleReceiptSetting('includeFooterNotes')}
              className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-bg transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                  <FileText size={20} />
                </div>
                <div className="text-left">
                  <p className="font-bold text-sm text-text-primary tracking-tight">Include Footer Notes</p>
                  <p className="text-[10px] font-medium text-text-secondary opacity-70 uppercase tracking-widest leading-none mt-1">
                    {receiptSettings.includeFooterNotes ? 'Showing verification notes & reference ID' : 'Footer notes omitted'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                 {receiptSettings.includeFooterNotes ? <ToggleRight size={26} className="text-accent" /> : <ToggleLeft size={26} className="text-text-secondary opacity-40" />}
              </div>
            </button>

          </div>
        </div>
      </div>

      {/* App Installation & PWA Section */}
      <div className="space-y-3">
        <h3 className="text-[10px] font-black text-text-secondary opacity-50 uppercase tracking-[0.2em] px-2">App Mode & Installation</h3>
        <div className="bg-card rounded-[24px] border border-border/60 shadow-sm overflow-hidden p-5 flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
              isStandalone 
                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                : 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20'
            }`}>
              <Smartphone size={24} />
            </div>
            <div className="text-left flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-bold text-sm sm:text-base text-text-primary tracking-tight">
                  {isStandalone ? 'Installed Web App (Standalone)' : 'Progressive Web App (PWA)'}
                </p>
                {isStandalone && (
                  <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                    Active
                  </span>
                )}
              </div>
              <p className="text-[11px] font-medium text-text-secondary opacity-80 uppercase tracking-widest mt-1">
                {isStandalone
                  ? 'Running full-screen • Offline IndexedDB cache & direct sync active'
                  : 'Installable to Home Screen • Instant offline collection support'}
              </p>
            </div>
          </div>

          {!isStandalone && (
            <div className="pt-4 border-t border-border/50 flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-indigo-500/5 to-purple-500/5 -mx-5 -mb-5 p-5 mt-0.5">
                <div className="text-left min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-xs font-black text-text-primary uppercase tracking-tight">Install Collection App on Device</p>
                    <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border border-indigo-500/25 flex items-center gap-1">
                      <Sparkles size={10} /> Native WebAPK
                    </span>
                  </div>
                  <p className="text-[11px] text-text-secondary mt-1">
                    Adds an app icon to your phone launcher with full-screen view and zero sideloading warnings
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleInstallPwaClick}
                  className="py-3 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md shadow-indigo-600/25 active:scale-95 transition-all cursor-pointer shrink-0"
                >
                  <Download size={16} strokeWidth={2.5} />
                  <span>Install App</span>
                </button>
              </div>

              <div className="pt-3">
                <button
                  type="button"
                  onClick={() => setShowPwaGuide(!showPwaGuide)}
                  className="text-xs font-bold text-text-secondary hover:text-text-primary flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <HelpCircle size={14} />
                  <span>How to install in your mobile browser</span>
                  {showPwaGuide ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {showPwaGuide && (
                  <div className="mt-3 p-4 rounded-2xl bg-bg border border-border/70 text-text-secondary text-xs space-y-3 animate-in fade-in">
                    <div>
                      <strong className="text-text-primary font-bold">🤖 Android (Google Chrome):</strong>
                      <ol className="list-decimal pl-4 space-y-1 text-[11px] mt-1 leading-relaxed">
                        <li>Tap Chrome&apos;s menu (<strong>⋮</strong> three dots in top-right corner).</li>
                        <li>Select <strong>&quot;Install app&quot;</strong> or <strong>&quot;Add to Home screen&quot;</strong>.</li>
                        <li>Tap <strong>Install</strong> when prompted. Chrome will create a real app icon on your home screen!</li>
                      </ol>
                    </div>

                    <div className="pt-2 border-t border-border/40">
                      <strong className="text-text-primary font-bold">🍏 iPhone / iPad (Safari):</strong>
                      <ol className="list-decimal pl-4 space-y-1 text-[11px] mt-1 leading-relaxed">
                        <li>Tap the <strong>Share</strong> button (square with arrow pointing up) at the bottom toolbar.</li>
                        <li>Scroll down and tap <strong>&quot;Add to Home Screen&quot;</strong>.</li>
                        <li>Tap <strong>Add</strong> at the top right to complete installation.</li>
                      </ol>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Database & Sync Status */}
      <div className="space-y-3">
        <h3 className="text-[10px] font-black text-text-secondary opacity-50 uppercase tracking-[0.2em] px-2">Database Status</h3>
        <div className="bg-card rounded-[24px] border border-border/60 shadow-sm overflow-hidden p-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
              <CheckCircle size={24} />
            </div>
            <div className="text-left flex-1 min-w-0">
              <p className="font-bold text-sm text-text-primary tracking-tight">Direct Firestore & IndexedDB Sync Active</p>
              <p className="text-[11px] font-medium text-text-secondary opacity-75 uppercase tracking-widest mt-1">
                Connected • Automatic background sync & offline resilience enabled
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="text-center pb-8 opacity-40">
         <p className="text-xs font-semibold text-text-secondary select-none">
           Collection Management System · Powered by Direct Sync
         </p>
      </div>
    </div>
  );
}
