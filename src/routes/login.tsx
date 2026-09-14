import React, { useState, useEffect, useRef } from 'react';
import Onboarding from '../components/Onboarding';
import LegalAgreement from '../components/LegalAgreement';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, ArrowRight, Loader2, Eye, EyeOff, Fingerprint, Info } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { Turnstile } from '@marsidev/react-turnstile';
import type { TurnstileInstance } from '@marsidev/react-turnstile';
import { env } from '../lib/env';

// Logos
import clearTrackLogo from '../assets/clear_track_logo.png';
import phoLogo from '../assets/pho_logo.png';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isBiometricLoading, setIsBiometricLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  
  const [showBiometricNotice, setShowBiometricNotice] = useState(false);
  const turnstileRef = useRef<TurnstileInstance>(null);

  // --- Animation & Flow States ---
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isLoginRevealed, setIsLoginRevealed] = useState(false);
  const [isCheckingOnboarding, setIsCheckingOnboarding] = useState(true);
  
  // --- POST-LOGIN LEGAL GATING ---
  const [showPostLoginLegal, setShowPostLoginLegal] = useState(false);
  const [pendingUser, setPendingUser] = useState<{ id: string, role: string, emp_id: string } | null>(null);
  const [isSavingLegal, setIsSavingLegal] = useState(false);

  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem('filetrackr_onboarding_complete');
    
    // --- Persistent Session Interceptor ---
    const checkPersistentSession = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
            // A session exists from a previous visit! 
            // We must check if they actually accepted the legal terms.
            const { data: profile } = await supabase
                .from('profiles')
                .select('role, emp_id, has_accepted_legal')
                .eq('id', session.user.id)
                .single();

            if (profile?.has_accepted_legal === true) {
                // They are fully compliant, send them straight in!
                if (profile.role === 'admin') {
                  navigate('/admin', { replace: true });
                } else {
                  navigate('/dashboard', { replace: true });
                }
            } else {
                // GOTCHA! They closed the app on the agreement screen last time.
                // Re-open the legal modal immediately!
                setPendingUser({ id: session.user.id, role: profile?.role || 'user', emp_id: profile?.emp_id || '' });
                setShowPostLoginLegal(true);
            }
            return; // Stop running onboarding logic if they are already logged in
        }

        // If no session exists, proceed with normal onboarding/login flow
        if (!hasSeenOnboarding) {
            setShowOnboarding(true);
            setIsLoginRevealed(false); 
        } else {
            setIsLoginRevealed(true); 
        }
        setIsCheckingOnboarding(false);
    };

    checkPersistentSession();
  }, [navigate]);

  const handleOnboardingComplete = () => {
    localStorage.setItem('filetrackr_onboarding_complete', 'true');
    setShowOnboarding(false);
    setIsLoginRevealed(true);
  };

  // --- MODIFIED: Intercept Navigation ---
  const checkLegalAndNavigate = async (userId: string) => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, emp_id, has_accepted_legal')
        .eq('id', userId)
        .single();

      if (profile?.has_accepted_legal === true) {
        // Clear to enter!
        toast.success("Welcome Back!");
        if (profile.role === 'admin') {
          navigate('/admin', { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
      } else {
        // Stop navigation, open mandatory legal modal
        setPendingUser({ id: userId, role: profile?.role || 'user', emp_id: profile?.emp_id || '' });
        setShowPostLoginLegal(true);
      }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error("Validation Error", { description: "Please enter both email and password." });
      return;
    }
    if (!turnstileToken) {
      toast.error("Security Check Required", { description: "Please complete the Cloudflare security verification." });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
        options: { captchaToken: turnstileToken }
      });

      if (error) throw error;
      
      // Send to interceptor instead of navigating directly
      await checkLegalAndNavigate(data.user.id);
      
    } catch (err: unknown) {
      console.error("Supabase Auth Error:", err);
      const errorMessage = err instanceof Error ? err.message : "Invalid credentials.";
      toast.error("Login Failed", { description: errorMessage });
      setTurnstileToken(null);
      turnstileRef.current?.reset();
    } finally {
      setIsLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    if (!turnstileToken) {
      toast.error("Security Check Required", { description: "Please complete the Cloudflare security verification." });
      return;
    }

    setIsBiometricLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPasskey({
        options: { captchaToken: turnstileToken }
      });
      
      if (error) throw error;
      
      if (data?.user?.id) {
          // Send to interceptor instead of navigating directly
          await checkLegalAndNavigate(data.user.id);
      }
    } catch (err: unknown) {
      // --- FIXED: Replaced any with unknown and safely cast ---
      const errorObj = err instanceof Error ? err : new Error(String(err));
      console.error("Biometric Login Error:", errorObj);
      
      // Always reset the Cloudflare token so the next attempt works
      setTurnstileToken(null);
      turnstileRef.current?.reset();

      const errorMsg = errorObj.message || "An unknown error occurred.";
      
      // 1. Check if the error is just a stale Cloudflare security token
      if (errorMsg.toLowerCase().includes("captcha") || errorMsg.toLowerCase().includes("token")) {
          toast.error("Security Token Refreshed", { description: "Please tap the fingerprint icon one more time." });
      } 
      // 2. Check if the passkey is ACTUALLY missing, or if the user hit 'cancel'
      else if (errorMsg.includes("NotAllowedError") || errorMsg.includes("cancelled") || errorMsg.includes("No credentials")) {
          setShowBiometricNotice(true);
      } 
      // 3. Catch any other random network errors
      else {
          toast.error("Biometric Error", { description: errorMsg });
      }
    } finally {
      setIsBiometricLoading(false);
    }
  };

  // --- Handle Post-Login Acceptance ---
  const handleLegalAccept = async () => {
    if (!pendingUser) return;
    setIsSavingLegal(true);
    
    try {
      const { error } = await supabase.from('profiles')
        .update({ has_accepted_legal: true })
        .eq('id', pendingUser.id);
        
      if (error) throw error;

      toast.success("Agreements Accepted", { description: "Welcome to FileTrackr!" });
      setShowPostLoginLegal(false);
      
      // Proceed to routing
      if (pendingUser.role === 'admin') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err: unknown) {
      console.error(err);
      toast.error("Failed to save your acknowledgement. Please try again.");
    } finally {
      setIsSavingLegal(false);
    }
  };

  // --- Handle Post-Login Decline ---
  const handleLegalDecline = async () => {
    setIsSavingLegal(true);
    // Sever the auth session immediately
    await supabase.auth.signOut();
    setShowPostLoginLegal(false);
    setPendingUser(null);
    setIsSavingLegal(false);
    toast.info("Logged Out", { description: "You must accept the official policies to use this system." });
  };

  const handleForgotPassword = () => {
    toast.info("Password Reset", { description: "Please contact your System Administrator to reset your password." });
  };

  if (isCheckingOnboarding) return null;

  return (
    <>
      {showOnboarding && (
        <Onboarding 
          onComplete={handleOnboardingComplete} 
          onClosing={() => setIsLoginRevealed(true)} 
        />
      )}

      {/* --- The Gated Legal Modal --- */}
      {showPostLoginLegal && (
        <LegalAgreement 
          onAccept={handleLegalAccept}
          onDecline={handleLegalDecline}
          isSaving={isSavingLegal}
        />
      )}
      
      <div className="min-h-[100dvh] bg-slate-900 flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[35rem] h-[35rem] bg-blue-500/20 rounded-full blur-[120px] pointer-events-none"></div>

        <div 
          className={`w-full max-w-md bg-white rounded-3xl shadow-2xl shadow-black/50 p-8 sm:p-10 relative z-10 transition-all duration-[800ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
            isLoginRevealed 
              ? 'opacity-100 scale-100 translate-y-0 blur-0' 
              : 'opacity-0 scale-90 translate-y-12 blur-sm pointer-events-none'
          }`}
        >
          
          <div className="flex items-center justify-center gap-6 mb-8">
            <img src={clearTrackLogo} alt="ClearTrack Logo" className="w-14 h-14 object-contain" />
            <img src={phoLogo} alt="Abra PHO Logo" className="w-14 h-14 object-contain" />
          </div>

          <div className="text-center mb-8">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-1">
              filetrackr<span className="text-blue-600">.</span>
            </h2>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
              Abra Provincial Health Office
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Email Address</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-blue-600 transition-colors duration-200" />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@abra.gov.ph"
                  required
                  autoComplete="email"
                  disabled={isLoading || isBiometricLoading || showPostLoginLegal}
                  className="w-full pl-11 pr-4 py-3 bg-white border border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-xl outline-none font-medium text-slate-900 transition-all text-base placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-500 shadow-sm"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-end mb-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Password</label>
                <button 
                  type="button" 
                  onClick={handleForgotPassword}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors hover:underline active:scale-95"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-blue-600 transition-colors duration-200" />
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  disabled={isLoading || isBiometricLoading || showPostLoginLegal}
                  className="w-full pl-11 pr-12 py-3 bg-white border border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-xl outline-none font-medium text-slate-900 transition-all text-base placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-500 shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700 active:scale-90 transition-all rounded-md hover:bg-slate-100"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex justify-center pt-2">
              <div className="w-full flex justify-center overflow-hidden [&_iframe]:!border-none [&_iframe]:!outline-none [&>div]:!border-none">
                <Turnstile
                  ref={turnstileRef}
                  siteKey={env.VITE_TURNSTILE_SITE_KEY}
                  options={{ theme: 'light' }}
                  onSuccess={(token) => setTurnstileToken(token)}
                  onError={() => {
                    setTurnstileToken(null);
                    toast.error("Security check failed. Please try again.");
                  }}
                  onExpire={() => setTurnstileToken(null)}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                type="submit" 
                disabled={isLoading || isBiometricLoading || !turnstileToken || showPostLoginLegal}
                className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md shadow-blue-600/20 hover:shadow-lg hover:shadow-blue-600/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-base disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:shadow-none"
              >
                {isLoading ? (
                  <><Loader2 className="animate-spin h-5 w-5" /> Authenticating...</>
                ) : (
                  <>Sign In <ArrowRight size={18} strokeWidth={2.5} /></>
                )}
              </button>

              <button 
                  type="button"
                  onClick={handleBiometricLogin}
                  disabled={isLoading || isBiometricLoading || showPostLoginLegal}
                  title="Sign in with Passkey or Face ID"
                  className="w-[56px] shrink-0 bg-white hover:bg-slate-50 text-blue-600 font-bold rounded-xl transition-all active:scale-[0.95] flex items-center justify-center border border-slate-300 hover:border-blue-300 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
              >
                  {isBiometricLoading ? (
                      <Loader2 className="animate-spin h-5 w-5" />
                  ) : (
                      <Fingerprint size={24} strokeWidth={2} />
                  )}
              </button>
            </div>
          </form>

          <div className="mt-8 text-center pt-6">
            <p className="text-xs text-slate-500 font-medium mb-3">
              Authorized personnel only. All access attempts are monitored and logged.
            </p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              v{__APP_VERSION__}
            </p>
          </div>

        </div>

        {showBiometricNotice && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white max-w-sm w-full rounded-3xl shadow-2xl p-6 text-center animate-in zoom-in-95 duration-200 border border-slate-100">
                  <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-blue-100">
                      <Info size={32} />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 mb-2">Biometrics Not Setup</h3>
                  <p className="text-sm text-slate-500 font-medium mb-6 leading-relaxed">
                      We couldn't verify your Face ID or Fingerprint. If you haven't set this up yet, please <strong>sign in with your password first</strong>, then go to Account Settings to register your device.
                  </p>
                  <button 
                      onClick={() => setShowBiometricNotice(false)}
                      className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-all active:scale-95"
                  >
                      Got it, thanks!
                  </button>
              </div>
          </div>
        )}

      </div>
    </>
  );
}