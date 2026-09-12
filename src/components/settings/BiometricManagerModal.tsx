import { useState, useEffect } from 'react';
import { X, Fingerprint, Trash2, Smartphone, Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

export default function BiometricManagerModal({ onClose }: { onClose: () => void }) {
    const [isClosing, setIsClosing] = useState(false);
    const [factors, setFactors] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessingId, setIsProcessingId] = useState<string | null>(null);

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(onClose, 300);
    };

    useEffect(() => {
        const fetchBiometrics = async () => {
            try {
                const { data, error } = await supabase.auth.mfa.listFactors();
                if (error) throw error;
                
                // FIXED: Changed to factor_type and 'webauthn' to match Supabase types
                const webAuthnFactors = data?.all?.filter(f => f.factor_type === 'webauthn') || [];
                setFactors(webAuthnFactors);
            } catch (err) {
                console.error("Failed to load biometrics", err);
                toast.error("Could not load registered devices.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchBiometrics();
    }, []);

    const handleRemoveDevice = async (factorId: string) => {
        if (!window.confirm("Are you sure you want to remove this device's biometric access? You will need to log in with your password next time.")) return;
        
        setIsProcessingId(factorId);
        try {
            const { error } = await supabase.auth.mfa.unenroll({ factorId });
            if (error) throw error;
            
            setFactors(prev => prev.filter(f => f.id !== factorId));
            toast.success("Device removed successfully.");
        } catch (err) {
            console.error("Failed to remove device", err);
            toast.error("Failed to remove device.");
        } finally {
            setIsProcessingId(null);
        }
    };

    return (
        <div className={`fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-sm ${isClosing ? 'animate-overlay-fade-out' : 'animate-overlay-fade'}`}>
            <div className={`bg-slate-50 w-full max-w-md max-h-[90vh] rounded-t-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden ${isClosing ? 'animate-responsive-modal-close' : 'animate-responsive-modal'}`}>
                
                {/* Header */}
                <div className="bg-white px-5 sm:px-6 py-4 sm:py-5 flex items-center justify-between border-b border-slate-100">
                    <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                        <Fingerprint size={20} className="text-[#16a34a]" /> Biometric Access
                    </h2>
                    <button onClick={handleClose} className="p-2 -mr-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar">
                    <p className="text-sm text-slate-500 font-medium leading-relaxed mb-6">
                        Manage the devices authorized to log into your FileTrackr account using Face ID or Fingerprint.
                    </p>

                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-10">
                            <Loader2 size={32} className="animate-spin text-blue-500 mb-4" />
                            <p className="text-sm font-bold text-slate-400">Loading devices...</p>
                        </div>
                    ) : factors.length === 0 ? (
                        <div className="bg-white border border-slate-200 border-dashed rounded-2xl p-8 text-center">
                            <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-3">
                                <ShieldCheck size={24} />
                            </div>
                            <h3 className="font-bold text-slate-800 mb-1">No Devices Registered</h3>
                            <p className="text-xs text-slate-500">You haven't set up biometric login on any device yet.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {factors.map((factor) => (
                                <div key={factor.id} className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between group transition-all hover:border-blue-200 hover:shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 bg-slate-50 text-slate-600 rounded-xl group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                                            <Smartphone size={20} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-800">{factor.friendly_name || "Authorized Device"}</p>
                                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                                                Added: {new Date(factor.createdAt || factor.created_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => handleRemoveDevice(factor.id)}
                                        disabled={isProcessingId === factor.id}
                                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                        title="Remove Device"
                                    >
                                        {isProcessingId === factor.id ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}