import { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';

// --- Interfaces ---
interface DocumentItem {
    id: string;
    reference_no?: string;
    title?: string;
    subject?: string;
    current_location?: string;
    assigned_clerk?: string;
}

// Removed currentUserId to satisfy strict ESLint rules
interface CancelModalProps {
    doc: DocumentItem;
    onClose: () => void;
    onSuccess: () => void;
}

export default function CancelModal({ doc, onClose, onSuccess }: CancelModalProps) {
    const [reason, setReason] = useState('');
    const [isCancelling, setIsCancelling] = useState(false);
    
    // --- Added isClosing State for Slide-Down Animation ---
    const [isClosing, setIsClosing] = useState(false);

    const handleClose = () => {
        if (isClosing) return;
        setIsClosing(true);
        setTimeout(() => {
            onClose();
        }, 200); // 200ms matches the Tailwind duration
    };

    const handleConfirm = async () => {
        if (!reason.trim()) {
            toast.error("Validation Error", { description: "Please provide a reason for cancellation." });
            return;
        }
        
        setIsCancelling(true);
        try {
            // 1. SECURE SERVER VERIFICATION
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            
            if (authError || !user) {
                toast.error("Authentication Error", { description: "Your session is invalid or expired. Please log in again." });
                return; 
            }

            // 2. ATOMIC RPC CALL: Using the verified user.id
            const { error: rpcError } = await supabase.rpc('process_document_action', {
                p_doc_id: doc.id,
                p_log_action: 'Cancelled',
                p_log_location: doc.current_location || 'Processing',
                
                // 🔒 THE UPGRADE: verified server ID
                p_log_created_by: user.id, 
                
                p_log_assigned_to: null,
                p_log_remarks: `Reason: ${reason.trim()}`,
                p_log_signature_url: null,
                p_log_attachment_url: null,
                p_new_status: 'cancelled',
                p_new_location: null,
                p_new_clerk: null,
                p_new_remarks: reason.trim(), 
                p_clear_remarks: false,
                p_completed_attachment_url: null
            });

            if (rpcError) throw rpcError;

            toast.success("Document Cancelled", { description: "The document has been marked as cancelled." });
            onSuccess();
            handleClose(); // Trigger slide-down animation
            
        } catch (err: unknown) {
            // Strict TypeScript fix: replacing `any` with `unknown`
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
            toast.error("Cancellation Failed", { description: errorMessage });
        } finally {
            setIsCancelling(false);
        }
    };

    return (
        <div className={`fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-sm transition-all ${isClosing ? 'animate-out fade-out duration-200 fill-mode-forwards' : 'animate-in fade-in duration-200'}`}>
            
            {/* CHANGED HERE: max-w-sm to sm:max-w-md */}
            <div className={`bg-white w-full sm:max-w-md max-h-[92vh] sm:max-h-[90vh] flex flex-col shadow-2xl rounded-t-[1.5rem] sm:rounded-3xl ${isClosing ? 'animate-out slide-out-to-bottom-[100%] sm:slide-out-to-bottom-0 sm:zoom-out-95 duration-200 fill-mode-forwards' : 'animate-in slide-in-from-bottom-[100%] sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200'}`}>
                
                {/* Red Header */}
                <div className="text-white relative flex flex-col shrink-0 transition-colors duration-300 bg-red-600 rounded-t-[1.5rem] sm:rounded-t-3xl">
                    <div className="w-16 h-1.5 bg-white/30 rounded-full mx-auto mt-3 sm:hidden shrink-0"></div>
                    <div className="p-5 pt-3 sm:pt-6 flex items-center justify-between">
                        <div className="w-10"></div>
                        <h3 className="font-black text-xl tracking-tight absolute left-1/2 -translate-x-1/2 whitespace-nowrap">Cancel Document</h3>
                        <button onClick={handleClose} disabled={isCancelling} className="p-2 -mr-2 bg-white/10 hover:bg-white/20 active:bg-white/30 rounded-full transition-all active:scale-90 disabled:opacity-50">
                            <X size={24} />
                        </button>
                    </div>
                </div>
                
                {/* Body Area */}
                <div className="p-5 sm:p-8 pt-6 sm:pt-8 bg-white">
                    <div className="bg-red-50 p-4 rounded-xl border border-red-100 mb-6 shadow-sm">
                        <p className="text-sm text-red-800 leading-relaxed">
                            You are about to cancel <strong className="text-red-900 font-bold">{doc.reference_no || 'this document'}</strong>. This action will permanently halt all processing.
                        </p>
                    </div>
                    
                    <div className="relative z-10">
                        <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Reason for Cancellation *</label>
                        <textarea 
                            value={reason} 
                            onChange={(e) => setReason(e.target.value)} 
                            placeholder="State why this document is being cancelled..." 
                            className="w-full p-4 bg-white border border-slate-200 focus:border-red-500 focus:ring-4 focus:ring-red-500/10 rounded-xl outline-none text-sm font-medium text-slate-700 transition-all min-h-[120px] resize-y"
                            disabled={isCancelling}
                        ></textarea>
                    </div>
                </div>
                
                {/* Dynamic Footer Area */}
                <div className="bg-white p-4 sm:p-5 flex shrink-0 border-t border-slate-50">
                    <button 
                        onClick={handleConfirm} 
                        disabled={isCancelling || !reason.trim()} 
                        className={`w-full text-white font-bold py-4 rounded-xl shadow-sm transition-all active:scale-[0.98] text-sm sm:text-base flex items-center justify-center gap-2 ${
                            reason.trim() 
                                ? 'bg-red-600 hover:bg-red-700' 
                                : 'bg-red-400 cursor-not-allowed opacity-80'
                        }`}
                    >
                        {isCancelling ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : <><AlertCircle size={18} strokeWidth={2.5} /> Confirm Cancel</>}
                    </button>
                </div>
            </div>
        </div>
    );
}