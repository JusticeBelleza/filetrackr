import { useState, useEffect } from 'react';
import { X, Fingerprint, Trash2, Smartphone, Loader2, ShieldCheck, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

// --- FIXED: Define an interface instead of using 'any' ---
interface PasskeyItem {
    id: string;
    friendly_name?: string;
    created_at: string;
    [key: string]: unknown;
}

export default function BiometricManagerModal({ onClose }: { onClose: () => void }) {
    const [isClosing, setIsClosing] = useState(false);
    // --- FIXED: Use the interface instead of 'any[]' ---
    const [passkeys, setPasskeys] = useState<PasskeyItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessingId, setIsProcessingId] = useState<string | null>(null);

    // New states for the confirmation modal
    const [passkeyToDelete, setPasskeyToDelete] = useState<string | null>(null);
    const [isClosingConfirm, setIsClosingConfirm] = useState(false);

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(onClose, 300);
    };

    useEffect(() => {
        const fetchBiometrics = async () => {
            try {
                const { data, error } = await supabase.auth.passkey.list();
                if (error) throw error;
                
                // --- FIXED: Safely cast the data to our interface ---
                setPasskeys((data as PasskeyItem[]) || []);
            } catch (err: unknown) {
                console.error("Failed to load biometrics", err);
                toast.error("Could not load registered devices.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchBiometrics();
    }, []);

    // 1. Trigger the custom confirmation modal instead of window.confirm
    const handleRemoveClick = (passkeyId: string) => {
        setPasskeyToDelete(passkeyId);
    };

    // 2. Handle closing the confirmation modal with animation
    const handleCancelConfirm = () => {
        setIsClosingConfirm(true);
        setTimeout(() => {
            setPasskeyToDelete(null);
            setIsClosingConfirm(false);
        }, 300);
    };

    // 3. Actually execute the deletion once confirmed
    const confirmRemoveDevice = async () => {
        if (!passkeyToDelete) return;
        
        setIsProcessingId(passkeyToDelete);
        try {
            const { error } = await supabase.auth.passkey.delete({ passkeyId: passkeyToDelete });
            if (error) throw error;
            
            setPasskeys(prev => prev.filter(p => p.id !== passkeyToDelete));
            toast.success("Device removed successfully.");
            setPasskeyToDelete(null); // Close confirmation modal immediately on success
        } catch (err: unknown) {
            console.error("Failed to remove device", err);
            toast.error("Failed to remove device.");
            handleCancelConfirm(); // Animate close if it fails
        } finally {
            setIsProcessingId(null);
        }
    };

    return (
        <>
            {/* --- MAIN BIOMETRIC MANAGER MODAL --- */}
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
                        ) : passkeys.length === 0 ? (
                            <div className="bg-white border border-slate-200 border-dashed rounded-2xl p-8 text-center">
                                <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <ShieldCheck size={24} />
                                </div>
                                <h3 className="font-bold text-slate-800 mb-1">No Devices Registered</h3>
                                <p className="text-xs text-slate-500">You haven't set up biometric login on any device yet.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {passkeys.map((passkey) => (
                                    <div key={passkey.id} className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between group transition-all hover:border-blue-200 hover:shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2.5 bg-slate-50 text-slate-600 rounded-xl group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                                                <Smartphone size={20} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-800">{passkey.friendly_name || "Authorized Device"}</p>
                                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                                                    Added: {new Date(passkey.created_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => handleRemoveClick(passkey.id)}
                                            disabled={isProcessingId === passkey.id || passkeyToDelete === passkey.id}
                                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                            title="Remove Device"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* --- CUSTOM CONFIRMATION MODAL --- */}
            {passkeyToDelete && (
                <div className={`fixed inset-0 z-[70] flex items-end justify-center sm:items-center bg-slate-900/60 backdrop-blur-sm ${isClosingConfirm ? 'animate-overlay-fade-out' : 'animate-overlay-fade'}`}>
                    <div className={`bg-white w-full sm:max-w-sm rounded-t-[1.5rem] sm:rounded-[2rem] shadow-2xl overflow-hidden flex flex-col ${isClosingConfirm ? 'animate-responsive-modal-close' : 'animate-responsive-modal'}`}>
                        <div className="bg-[#e11d48] text-white p-4 sm:p-5 flex items-center justify-between">
                            <h3 className="font-bold text-[17px] flex items-center gap-2">
                                <AlertCircle size={20} /> Remove Device
                            </h3>
                        </div>
                        <div className="p-5 sm:p-6 pb-8 sm:pb-6">
                            <p className="text-[14px] font-medium text-slate-700 mb-6 px-1">
                                Are you sure you want to remove this device's biometric access? You will need to log in with your password next time.
                            </p>
                            <div className="flex gap-3">
                                <button onClick={handleCancelConfirm} disabled={isProcessingId !== null} className="flex-1 py-3.5 bg-white border-2 border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl transition-colors active:scale-95 text-[14px] disabled:opacity-50">
                                    Cancel
                                </button>
                                <button onClick={confirmRemoveDevice} disabled={isProcessingId !== null} className="flex-1 py-3.5 bg-[#e11d48] hover:bg-red-700 text-white font-bold rounded-xl transition-colors active:scale-95 text-[14px] shadow-sm flex justify-center items-center gap-2 disabled:opacity-50">
                                    {isProcessingId ? <Loader2 size={18} className="animate-spin" /> : 'Yes, Remove'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}