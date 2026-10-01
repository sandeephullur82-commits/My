import React, { useState } from 'react';
import { auth } from '../lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'motion/react';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Success is handled by AuthContext listener
    } catch (error: any) {
      let msg = 'An error occurred during login';
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        msg = 'Access denied. Contact admin.';
      } else if (error.code === 'auth/wrong-password') {
        msg = 'Invalid credentials.';
      } else if (error.code === 'auth/invalid-email') {
        msg = 'Invalid email format.';
      } else if (error.code === 'auth/network-request-failed') {
        msg = 'Network error. Please check your connection.';
      }
      toast.error(msg);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-6 text-text-primary relative overflow-hidden">
      {/* Premium ambient light effect */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-accent/5 rounded-full blur-[100px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="w-full max-w-[360px] bg-card p-8 rounded-3xl shadow-sm border border-border z-10"
      >
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-tr from-accent to-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-md shadow-accent/10">
            <span className="text-white text-xl font-bold tracking-wider">PP</span>
          </div>
          <h1 className="text-xl font-bold text-text-primary tracking-tight">Welcome to Pigmy Pro</h1>
          <p className="text-text-secondary mt-1.5 text-xs opacity-80">Sign in to access your collection dashboard</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary/60 group-focus-within:text-accent transition-colors" size={18} />
              <input
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-muted/40 dark:bg-slate-900 border border-border/80 rounded-2xl py-3.5 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-accent/45 focus:border-accent transition-all placeholder:text-text-secondary/40 font-medium"
                required
              />
            </div>
          </div>

          <div>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary/60 group-focus-within:text-accent transition-colors" size={18} />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-muted/40 dark:bg-slate-900 border border-border/80 rounded-2xl py-3.5 pl-12 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-accent/45 focus:border-accent transition-all placeholder:text-text-secondary/40 font-medium"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary/60 hover:text-text-primary transition-colors duration-150"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <motion.button
            whileTap={{ scale: 0.97 }}
            type="submit"
            disabled={loading}
            onClick={() => console.log("Login Submit clicked")}
            className="w-full bg-accent hover:bg-accent/95 text-white py-3.5 rounded-2xl font-bold text-sm tracking-wide shadow-sm flex items-center justify-center gap-2 disabled:opacity-70 transition-all mt-6"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              'Sign In'
            )}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
}
