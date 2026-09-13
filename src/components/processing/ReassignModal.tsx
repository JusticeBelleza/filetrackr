import { useState, useEffect } from 'react';
import { X, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import EmployeeSelect from '../ui/EmployeeSelect'; 

// --- Interfaces ---
interface DocumentItem {
    id: string;
    reference_no?: string;
    title?: string;
    current_location?: string;
    assigned_clerk?: string;
    created_by?: string; 
}

interface ReassignModalProps {
    doc: DocumentItem;
    currentUserName: string;
    onClose: () => void;
    onSuccess: () => void;
}

export default function ReassignModal({ doc, currentUserName, onClose, onSuccess }: ReassignModalProps) {
    const [selectedColleague, setSelectedColleague] = useState('');
    const [isReassigning, setIsReassigning] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [creatorName, setCreatorName] = useState<string>(''); 
    const [currentUserDept, setCurrentUserDept] = useState<string>(''); 
    const [isClosing, setIsClosing] = useState(false);

    const handleClose = () => {
        if (isClosing) return;
        setIsClosing(true);
        setTimeout(() => {
            onClose();
        }, 200); 
    };

    useEffect(() => {
        const fetchInitialData = async () => {
            setIsLoading(true);
            try {
                if (doc.created_by) {
                    const { data: creatorData } = await supabase.from('profiles').select('full_name').eq('id', doc.created_by).single();
                    if (creatorData) setCreatorName(creatorData.full_name);
                }

                const { data: userData } = await supabase.from('employees').select('department').eq('name', currentUserName).single();
                if (userData && userData.department) {
                    setCurrentUserDept(userData.department);
                }
            } catch (error) {
                console.error("Failed to fetch data", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchInitialData();
    }, [currentUserName, doc.created_by]);

    const handleConfirm = async () => {
        if (!selectedColleague) {
            toast.error("Validation Error", { description: "Please select a colleague to assign this to." });
            return;
        }
        
        setIsReassigning(true);
        try {
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError || !user) throw new Error("Your session is invalid or expired.");

            const prevClerk = doc.assigned_clerk || 'Unassigned';
            const isReturningToCreator = selectedColleague === creatorName;
            const nextStatus = isReturningToCreator ? 'routing' : 'pending_receipt';

            const { error: updateError } = await supabase
                .from('documents')
                .update({ 
                    status: nextStatus,
                    assigned_clerk: selectedColleague 
                })
                .eq('id', doc.id);
                
            if (updateError) throw updateError;

            const { error: rpcError } = await supabase.rpc('process_document_action', {
                p_doc_id: doc.id,
                p_log_action: 'REASSIGNED',
                p_log_location: doc.current_location || 'Processing',
                p_log_created_by: user.id,
                p_log_assigned_to: null,
                p_log_remarks: `Details: Reassigned from ${prevClerk} to ${selectedColleague} by ${currentUserName}`,
                p_log_signature_url: null,
                p_log_attachment_url: null,
                p_new_status: nextStatus, 
                p_new_location: null,
                p_new_clerk: selectedColleague,
                p_new_remarks: null,
                p_clear_remarks: false,
                p_completed_attachment_url: null
            });

            if (rpcError) console.warn("RPC Log Warning:", rpcError);

            toast.success("Reassigned", { 
                description: isReturningToCreator 
                    ? `Assigned back to creator (${selectedColleague}).`
                    : `Assigned to ${selectedColleague} for receiving.` 
            });
            
            onSuccess();
            handleClose(); 
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
            toast.error("Reassignment Failed", { description: errorMessage });
        } finally {
            setIsReassigning(false);
        }
    };

    return (
        <div className={`fixed inset-0 z-[1050] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/70 backdrop-blur-sm transition-all overflow-y-auto ${isClosing ? 'animate-out fade-out duration-200 fill-mode-forwards' : 'animate-in fade-in duration-200'}`}>
            
            <div className={`bg-white w-full max-w-xl max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden shadow-2xl rounded-t-[1.5rem] sm:rounded-3xl transition-all duration-300 ease-in-out ${isClosing ? 'animate-out slide-out-to-bottom-[100%] sm:slide-out-to-bottom-0 sm:zoom-out-95 duration-200 fill-mode-forwards' : 'animate-in slide-in-from-bottom-[100%] sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300'}`}>
                
                <div className="text-white relative flex flex-col shrink-0 transition-colors duration-300 bg-[#0f766e]">
                    <div className="w-16 h-1.5 bg-white/30 rounded-full mx-auto mt-3 sm:hidden shrink-0"></div>
                    <div className="p-5 pt-3 sm:pt-6 flex items-center justify-between">
                        <div className="w-10"></div> 
                        <h3 className="font-black text-xl tracking-tight absolute left-1/2 -translate-x-1/2 whitespace-nowrap">Re-assign</h3>
                        <button onClick={handleClose} disabled={isReassigning} className="p-2 -mr-2 bg-white/10 hover:bg-white/20 active:bg-white/30 rounded-full transition-all active:scale-90 disabled:opacity-50">
                            <X size={24} />
                        </button>
                    </div>
                </div>
                
                <div className="p-5 sm:p-8 bg-white">
                    <div className="relative z-20">
                        {!isLoading && (
                            <EmployeeSelect 
                                value={selectedColleague} 
                                onChange={setSelectedColleague}
                                departmentFilter={currentUserDept} 
                                isRelative={true} // Extends the modal when opened
                            />
                        )}
                        {isLoading && (
                            <div className="p-4 border-2 border-slate-100 rounded-xl text-center text-sm font-medium text-slate-500 animate-pulse">
                                Loading department data...
                            </div>
                        )}
                    </div>
                </div>
                
                <div className="bg-white p-4 sm:p-5 flex shrink-0 border-t border-slate-50">
                    <button 
                        onClick={handleConfirm} 
                        disabled={isReassigning || !selectedColleague} 
                        className={`w-full text-white font-bold py-3.5 rounded-xl shadow-sm transition-all active:scale-[0.98] text-sm flex items-center justify-center gap-2 ${
                            selectedColleague 
                                ? 'bg-[#0f766e] hover:bg-[#0b5c55]'
                                : 'bg-[#7bc1b5] cursor-not-allowed opacity-80'
                        }`}
                    >
                        {isReassigning ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : <><UserPlus size={18} strokeWidth={2.5} /> Confirm Re-assign</>}
                    </button>
                </div>
            </div>
        </div>
    );
}