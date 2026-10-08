import React from 'react';
import { 
  User, Palette, LayoutDashboard, ShieldCheck, 
  ToggleLeft, ToggleRight, CheckCircle, Moon, Sun
} from 'lucide-react';
import { useTheme } from '../components/ThemeProvider';
import { useUI } from '../context/UIContext';
import { useAuth } from '../context/AuthContext';

export function Settings() {
  const { theme, toggleTheme } = useTheme();
  const { isCompact, toggleCompact } = useUI();
  const { user } = useAuth();



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





        {/* Account Section */}
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
