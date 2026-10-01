import React, { useState, useEffect } from 'react';
import { auth } from '../lib/firebase';
import { signInWithEmailAndPassword, signInWithCustomToken } from 'firebase/auth';
import { Eye, EyeOff, Lock, Mail, Zap, Loader2, ArrowRight, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'motion/react';

export function Login() {
  const [email, setEmail] = useState('sandeephullur82@gmail.com');
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isAutoLoggingIn, setIsAutoLoggingIn] = useState(true);

  // Attempt seamless session connection on initial load
  useEffect(() => {
    let mounted = true;

    const performAutoSignIn = async () => {
      try {
        const res = await fetch('/api/auth/demo-token');
        if (res.ok) {
          const data = await res.json();
          if (data?.token && mounted) {
            await signInWithCustomToken(auth, data.token);
            return;
          }
        }
      } catch (e) {
        console.warn('[AutoLogin] Custom token error, attempting fallback:', e);
      }

      // Fallback: try email/password directly
      try {
        if (mounted) {
          await signInWithEmailAndPassword(auth, 'sandeephullur82@gmail.com', 'password123');
        }
      } catch (err) {
        console.warn('[AutoLogin] Direct password attempt deferred to user interaction');
      } finally {
        if (mounted) {
          setIsAutoLoggingIn(false);
        }
      }
    };

    performAutoSignIn();

    return () => {
      mounted = false;
    };
  }, []);

  const handleInstantAccess = async () => {
    setLoading(true);
    try {
      // First try custom token
      try {
        const res = await fetch('/api/auth/demo-token');
        if (res.ok) {
          const { token } = await res.json();
          if (token) {
            await signInWithCustomToken(auth, token);
            toast.success('Connected as Sandeep Hullur');
            return;
          }
        }
      } catch {
        // proceed to password sign in
      }

      await signInWithEmailAndPassword(auth, email.trim(), password);
      toast.success('Connected to Pigmy Pro Workspace');
    } catch (error: any) {
      console.error('[Login] Error:', error);
      toast.error('Sign-in failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please enter your email and password');
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (error: any) {
      let msg = 'An error occurred during login';
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        msg = 'Invalid email or password.';
      } else if (error.code === 'auth/wrong-password') {
        msg = 'Invalid password.';
      } else if (error.code === 'auth/invalid-email') {
        msg = 'Invalid email address.';
      } else if (error.code === 'auth/network-request-failed') {
        msg = 'Network error. Please check connection.';
      }
      toast.error(msg);
      setLoading(false);
    }
  };

  if (isAutoLoggingIn) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg p-6 text-text-primary">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 bg-accent/10 text-accent rounded-2xl flex items-center justify-center">
            <Loader2 className="animate-spin text-accent" size={28} />
          </div>
          <div className="text-center">
            <p className="font-bold text-sm text-text-primary">Connecting to Pigmy Pro...</p>
            <p className="text-[11px] text-text-secondary opacity-60 mt-1">Preparing your collection ledger</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-6 text-text-primary relative overflow-hidden">
      {/* Background visual ambience */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-accent/5 rounded-full blur-[100px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="w-full max-w-[380px] bg-card p-7 sm:p-8 rounded-3xl shadow-sm border border-border/80 z-10"
      >
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-accent rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-md shadow-accent/20">
            <span className="text-white text-xl font-black tracking-wider">PP</span>
          </div>
          <h1 className="text-xl font-black text-text-primary tracking-tight">Pigmy Pro</h1>
          <p className="text-text-secondary mt-1 text-xs opacity-75">Fintech Collection Suite</p>
        </div>

        {/* Instant Access Button */}
        <div className="mb-5">
          <button
            type="button"
            onClick={handleInstantAccess}
            disabled={loading}
            className="w-full h-12 bg-accent hover:bg-accent/90 active:scale-98 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-accent/20 transition-all cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <>
                <Zap size={15} />
                <span>Instant Sign In (Sandeep Hullur)</span>
                <ArrowRight size={15} />
              </>
            )}
          </button>
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border/60" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-widest">
              <span className="bg-card px-2 text-text-secondary opacity-50">or sign in manually</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-3.5">
          <div>
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary/60 group-focus-within:text-accent transition-colors" size={17} />
              <input
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-muted/40 dark:bg-slate-900 border border-border/80 rounded-2xl py-3 pl-11 pr-4 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all placeholder:text-text-secondary/40"
                required
              />
            </div>
          </div>

          <div>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary/60 group-focus-within:text-accent transition-colors" size={17} />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-muted/40 dark:bg-slate-900 border border-border/80 rounded-2xl py-3 pl-11 pr-11 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all placeholder:text-text-secondary/40"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-secondary/60 hover:text-text-primary transition-colors"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-card border border-border hover:border-accent/40 text-text-primary rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 active:scale-98 transition-all mt-4 cursor-pointer disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : 'Sign In with Password'}
          </button>
        </form>

        <div className="mt-5 pt-4 border-t border-border/40 text-center">
          <div className="flex items-center justify-center gap-1.5 text-[9px] font-bold text-text-secondary opacity-40 uppercase tracking-widest">
            <ShieldCheck size={12} />
            <span>Encrypted Firestore Authentication</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
