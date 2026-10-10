import React from 'react';
import { 
  User, Palette, LayoutDashboard, ShieldCheck, 
  ToggleLeft, ToggleRight, CheckCircle, Moon, Sun,
  Smartphone, Download
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
  const { isInstallable, promptInstall } = usePWAInstall();
  const platform = getPlatformDetails();



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
          <p className="text-[11px] font-black text-text-secondary opacity-50 uppercase tracking-[0.2em] mt-0.5">Authentication Disabled • Live Ledger Sync</p>
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





        {/* Application & Hybrid Platform Section */}
        <div>
          <h3 className="text-[10px] font-black text-text-secondary opacity-40 uppercase tracking-[0.2em] px-4 mb-3">Hybrid Platform & App Mode</h3>
          <div className="bg-card rounded-[24px] border border-border/50 shadow-sm overflow-hidden p-4 flex flex-col gap-3">
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                platform.isNative 
                  ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                  : platform.isPWA 
                    ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' 
                    : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
              }`}>
                <Smartphone size={20} />
              </div>
              <div className="text-left flex-1 min-w-0">
                <p className="font-bold text-sm text-text-primary tracking-tight">
                  {platform.label}
                </p>
                <p className="text-[10px] font-medium text-text-secondary opacity-70 uppercase tracking-widest leading-none mt-1">
                  {platform.isNative
                    ? 'Capacitor Android Native Container • Hardware Print & Share Active'
                    : platform.isPWA
                      ? 'Standalone Web App • Offline Collection Cache Active'
                      : 'Browser Preview • Installable as Progressive Web App'}
                </p>
              </div>
            </div>

            {/* Install PWA Button if running in browser */}
            {isInstallable && (
              <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-3">
                <div className="text-left min-w-0">
                  <p className="text-xs font-bold text-text-primary">Install to Home Screen</p>
                  <p className="text-[10px] text-text-secondary">Run full-screen without address bars</p>
                </div>
                <button
                  type="button"
                  onClick={promptInstall}
                  className="py-2 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-indigo-600/25 active:scale-95 transition-all cursor-pointer shrink-0"
                >
                  <Download size={13} strokeWidth={2.5} />
                  <span>Install PWA</span>
                </button>
              </div>
            )}

            {/* Direct Android APK Download Button */}
            <div className="pt-3 border-t border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-emerald-500/5 to-teal-500/5 -mx-4 -mb-4 p-4 mt-1">
              <div className="text-left min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-black text-text-primary uppercase tracking-tight">Android Application Package (APK)</p>
                  <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                    v1.0.0
                  </span>
                </div>
                <p className="text-[10px] text-text-secondary mt-0.5">
                  Download PigmyPro.apk for direct install on Android mobile phones or POS devices
                </p>
              </div>
              <a
                href="/api/download-apk"
                download="PigmyPro.apk"
                className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md shadow-emerald-600/25 active:scale-95 transition-all cursor-pointer shrink-0"
              >
                <Download size={14} strokeWidth={2.5} />
                <span>Download APK</span>
              </a>
            </div>
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
                <p className="text-[10px] font-medium text-text-secondary opacity-70 uppercase tracking-widest leading-none mt-1">Full dataset access without login credentials</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="text-center pb-8 opacity-20">
         <p className="text-[9px] font-black uppercase tracking-[0.5em] select-none cursor-default">Pigmy Pro Engine v1.2.0</p>
      </div>

    </div>
  );
}
