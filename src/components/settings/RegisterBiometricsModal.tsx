import { useState } from 'react';
import { X, Fingerprint, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

export default function RegisterBiometricsModal({ onClose }: { onClose: () => void }) {
    const [isClosing, setIsClosing] = useState(false);
    const [step, setStep] = useState<'intro' | 'scanning' | 'success' | 'error'>('intro');
    const [errorMessage, setErrorMessage] = useState('');

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(onClose, 300);
    };

    const handleStartRegistration = async () => {
        // Step 1: Show the pulsing scanning UI right before triggering the native OS prompt
        setStep('scanning');
        
        try {
            // Note: WebAuthn requires a direct user gesture, so we call this immediately in the click handler
            const { error } = await supabase.auth.registerPasskey();
            
            if (error) throw error;
            
            // Step 2: On success, update local storage and show the success UI
            localStorage.setItem('filetrackr_passkey_registered', 'true');
            setStep('success');
            
            // Auto-close after a moment of showing the success screen
            setTimeout(() => {
                handleClose();
                toast.success("Device registered successfully!");
            }, 2000);
            
        } catch (err: any) {
            console.error("Biometric registration failed:", err);
            setStep('error');
            setErrorMessage(err.message || 'Registration was cancelled or failed.');
        }
    };

    return (
        <div className={`fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-sm ${isClosing ? 'animate-overlay-fade-out' : 'animate-overlay-fade'}`}>
            <div className={`bg-slate-50 w-full max-w-sm max-h-[90vh] rounded-t-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden ${isClosing ? 'animate-responsive-modal-close' : 'animate-responsive-modal'}`}>
                
                {/* Header */}
                <div className="bg-white px-5 sm:px-6 py-4 flex items-center justify-between border-b border-slate-100">
                    <h2 className="text-[16px] font-black text-slate-900 flex items-center gap-2">
                        <ShieldCheck size={18} className="text-[#16a34a]" /> Security Setup
                    </h2>
                    {step !== 'scanning' && (
                        <button onClick={handleClose} className="p-2 -mr-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                            <X size={20} />
                        </button>
                    )}
                </div>

                {/* Content Area */}
                <div className="p-8 flex flex-col items-center justify-center text-center bg-white min-h-[280px]">
                    
                    {step === 'intro' && (
                        <div className="animate-in fade-in zoom-in duration-300 flex flex-col items-center">
                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-5 text-slate-700 shadow-sm border border-slate-100">
                                <Fingerprint size={40} strokeWidth={1.5} />
                            </div>
                            <h3 className="font-black text-slate-900 text-xl mb-2">Enable Biometrics</h3>
                            <p className="text-[13px] text-slate-500 font-medium leading-relaxed mb-6 px-2">
                                Secure your FileTrackr account using your device's native Face ID or Fingerprint scanner. We never store your actual biometric data.
                            </p>
                            <button 
                                onClick={handleStartRegistration}
                                className="w-full py-3.5 bg-[#16a34a] hover:bg-[#15803d] text-white font-bold rounded-xl transition-all active:scale-[0.98] shadow-md"
                            >
                                Start Device Setup
                            </button>
                        </div>
                    )}

                    {step === 'scanning' && (
                        <div className="animate-in fade-in zoom-in duration-300 flex flex-col items-center">
                            <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mb-6 relative">
                                {/* Pulsing rings for scanning effect */}
                                <div className="absolute inset-0 bg-blue-400 rounded-full animate-ping opacity-20"></div>
                                <div className="absolute -inset-4 border border-blue-200 rounded-full animate-pulse"></div>
                                <Fingerprint size={48} className="text-blue-500 relative z-10 animate-pulse" />
                            </div>
                            <h3 className="font-bold text-slate-900 text-lg mb-1">Waiting for Device...</h3>
                            <p className="text-sm text-slate-500 font-medium">Please follow your device's native system prompt.</p>
                        </div>
                    )}

                    {step === 'success' && (
                        <div className="animate-in fade-in zoom-in duration-300 flex flex-col items-center">
                            <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-5 text-green-500">
                                <CheckCircle2 size={40} />
                            </div>
                            <h3 className="font-black text-slate-900 text-xl mb-2">All Set!</h3>
                            <p className="text-sm text-slate-500 font-medium">Your device is now securely registered.</p>
                        </div>
                    )}

                    {step === 'error' && (
                        <div className="animate-in fade-in zoom-in duration-300 flex flex-col items-center">
                            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-5 text-red-500">
                                <AlertCircle size={40} />
                            </div>
                            <h3 className="font-black text-slate-900 text-xl mb-2">Registration Failed</h3>
                            <p className="text-[13px] text-slate-500 font-medium leading-relaxed mb-6">
                                {errorMessage}
                            </p>
                            <button 
                                onClick={() => setStep('intro')}
                                className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-all active:scale-[0.98] shadow-md flex items-center justify-center gap-2"
                            >
                                Try Again
                            </button>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}