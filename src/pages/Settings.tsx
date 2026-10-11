import React, { useState } from 'react';
import { 
  User, Palette, LayoutDashboard, ShieldCheck, 
  ToggleLeft, ToggleRight, CheckCircle, Moon, Sun,
  Smartphone, Download, HelpCircle, ChevronDown, ChevronUp,
  Sparkles
} from 'lucide-react';
import { useTheme } from '../components/ThemeProvider';
import { useUI } from '../context/UIContext';
import { useAuth } from '../context/AuthContext';
import { getPlatformDetails } from '../utils/capacitorDeviceHelper';
import { usePWAInstall } from '../hooks/usePWAInstall';

export function Settings() {
  const { theme, toggleTheme } = useTheme();
  const { isCompact, toggleCompact } = useUI();
  const { user } = useAuth();
  const { isInstallable, isStandalone, promptInstall } = usePWAInstall();
  const platform = getPlatformDetails();

  const [showPwaGuide, setShowPwaGuide] = useState(false);

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
    <div className="h-full overflow-y-auto px-6 py-8 flex flex-col gap-8 pb-32 animate-in fade-in duration-500">
      {/* Account Section */}
      <div className="flex flex-col items-center gap-4 py-4 px-2">
        <div className="relative group">
          <div className="w-24 h-24 bg-accent/10 border-4 border-card rounded-full flex items-center justify-center text-accent shadow-xl">
            <User size={48} strokeWidth={1.5} />
          </div>
          <div className="absolute -bottom-1 -right-1 bg-success text-white p-1.5 rounded-full border-2 border-card">
            <ShieldCheck size={14} />
          </div>
        </div>
        <div className="text-center">
          <h2 className="text-xl font-black text-text-primary tracking-tighter">Direct Firestore Access</h2>
          <p className="text-[11px] font-black text-text-secondary opacity-50 uppercase tracking-[0.2em] mt-0.5">
            Authentication Disabled • Live Ledger Sync
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Preference Section */}
        <div>
          <h3 className="text-[10px] font-black text-text-secondary opacity-40 uppercase tracking-[0.2em] px-4 mb-3">Preferences</h3>
          <div className="bg-card rounded-[24px] border border-border/50 shadow-sm overflow-hidden p-2 space-y-1">
            <button
              onClick={toggleTheme}
              className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-bg transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
                  <Palette size={20} />
                </div>
                <div className="text-left">
                  <p className="font-bold text-sm text-text-primary tracking-tight">Appearance</p>
                  <p className="text-[10px] font-medium text-text-secondary opacity-60 uppercase tracking-widest leading-none mt-1">
                    {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                 {theme === 'dark' ? <Moon size={18} className="text-accent" /> : <Sun size={18} className="text-warning" />}
              </div>
            </button>

            <button
              onClick={toggleCompact}
              className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-bg transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
                  <LayoutDashboard size={20} />
                </div>
                <div className="text-left">
                  <p className="font-bold text-sm text-text-primary tracking-tight">Compact Mode</p>
                  <p className="text-[10px] font-medium text-text-secondary opacity-60 uppercase tracking-widest leading-none mt-1">
                    {isCompact ? 'High Density' : 'Standard View'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                 {isCompact ? <ToggleRight size={24} className="text-accent" /> : <ToggleLeft size={24} className="text-text-secondary opacity-30" />}
              </div>
            </button>
          </div>
        </div>

        {/* Application Mode & PWA Installation Section */}
        <div>
          <h3 className="text-[10px] font-black text-text-secondary opacity-40 uppercase tracking-[0.2em] px-4 mb-3">App Mode & Installation</h3>
          <div className="bg-card rounded-[24px] border border-border/50 shadow-sm overflow-hidden p-4 flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                isStandalone 
                  ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                  : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
              }`}>
                <Smartphone size={20} />
              </div>
              <div className="text-left flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-sm text-text-primary tracking-tight">
                    {isStandalone ? 'Installed Web App (Standalone)' : 'Progressive Web App (PWA)'}
                  </p>
                  {isStandalone && (
                    <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/25">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-[10px] font-medium text-text-secondary opacity-70 uppercase tracking-widest leading-none mt-1">
                  {isStandalone
                    ? 'Running full-screen • Offline IndexedDB cache & direct sync active'
                    : 'Installable to Home Screen • Instant offline collection support'}
                </p>
              </div>
            </div>

            {/* Install PWA Button & Guided Setup */}
            {!isStandalone && (
              <div className="pt-3 border-t border-border/40 flex flex-col gap-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-indigo-500/5 to-purple-500/5 -mx-4 -mb-4 p-4 mt-0.5">
                  <div className="text-left min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-xs font-black text-text-primary uppercase tracking-tight">Install PigmyPro on Device</p>
                      <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.2 rounded-full bg-indigo-500/15 text-indigo-500 dark:text-indigo-300 border border-indigo-500/25 flex items-center gap-0.5">
                        <Sparkles size={8} /> Native WebAPK
                      </span>
                    </div>
                    <p className="text-[10px] text-text-secondary mt-0.5">
                      Adds an app icon to your phone launcher with full-screen view and zero sideloading warnings
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleInstallPwaClick}
                    className="py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md shadow-indigo-600/25 active:scale-95 transition-all cursor-pointer shrink-0"
                  >
                    <Download size={14} strokeWidth={2.5} />
                    <span>Install App</span>
                  </button>
                </div>

                {/* Step-by-step installation instructions for mobile browsers */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPwaGuide(!showPwaGuide)}
                    className="text-[10px] font-bold text-text-secondary hover:text-text-primary flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <HelpCircle size={12} />
                    <span>How to install in your mobile browser</span>
                    {showPwaGuide ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>

                  {showPwaGuide && (
                    <div className="mt-2 p-3.5 rounded-xl bg-card border border-border/70 text-text-secondary text-[11px] space-y-2.5 animate-in fade-in">
                      <div>
                        <strong className="text-text-primary font-bold text-xs">🤖 Android (Google Chrome):</strong>
                        <ol className="list-decimal pl-4 space-y-1 text-[10px] mt-1 leading-relaxed">
                          <li>Tap Chrome&apos;s menu (<strong>⋮</strong> three dots in top-right corner).</li>
                          <li>Select <strong>&quot;Install app&quot;</strong> or <strong>&quot;Add to Home screen&quot;</strong>.</li>
                          <li>Tap <strong>Install</strong> when prompted. Chrome will create a real app icon on your home screen!</li>
                        </ol>
                      </div>

                      <div className="pt-2 border-t border-border/40">
                        <strong className="text-text-primary font-bold text-xs">🍏 iPhone / iPad (Safari):</strong>
                        <ol className="list-decimal pl-4 space-y-1 text-[10px] mt-1 leading-relaxed">
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

        {/* Database Section */}
        <div>
          <h3 className="text-[10px] font-black text-text-secondary opacity-40 uppercase tracking-[0.2em] px-4 mb-3">Database Mode</h3>
          <div className="bg-card rounded-[24px] border border-border/50 shadow-sm overflow-hidden p-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-success/10 text-success flex items-center justify-center">
                <CheckCircle size={20} />
              </div>
              <div className="text-left flex-1 min-w-0">
                <p className="font-bold text-sm text-text-primary tracking-tight">Direct Access Active</p>
                <p className="text-[10px] font-medium text-text-secondary opacity-70 uppercase tracking-widest leading-none mt-1">
                  Full dataset access with automatic offline IndexedDB caching and cloud sync
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="text-center pb-8 opacity-20">
         <p className="text-[9px] font-black uppercase tracking-[0.5em] select-none cursor-default">
           Pigmy Pro PWA Engine v1.2.0
         </p>
      </div>
    </div>
  );
}
