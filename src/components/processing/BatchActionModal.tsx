import { useState, useEffect, useRef, useMemo } from 'react';
import { MapPin, CheckCircle, Ban, UserPlus, ArrowLeft, X, PenTool, Camera, Check, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { convertImageToScannedPDF } from '../../lib/utils';
import type { DocumentItem, OptionType } from '../../types/processing';
import SignaturePad, { type SignaturePadRef } from '../ui/SignaturePad';
import EmployeeSelect from '../ui/EmployeeSelect'; 
import DepartmentSelect from '../ui/DepartmentSelect'; 

// --- Interfaces ---
interface BatchModalProps {
    selectedDocs: DocumentItem[]; 
    currentUserName: string; 
    departments: OptionType[]; // Kept to prevent parent component from breaking
    onClose: () => void; 
    onSuccess: () => void;
    onClearSelection?: () => void;
    isClosingProp?: boolean;
}

export default function BatchActionModal({ selectedDocs, currentUserName, onClose, onSuccess, onClearSelection, isClosingProp = false }: BatchModalProps) {
    const signaturePadRef = useRef<SignaturePadRef>(null);

    const [isClosing, setIsClosing] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [activeAction, setActiveAction] = useState<'add_step' | 'complete' | 'reject' | 'reassign' | 'batch_receive' | 'batch_decline' | null>(null);
    
    const [hasSignature, setHasSignature] = useState(false);
    const [destination, setDestination] = useState('');
    const [receivingClerk, setReceivingClerk] = useState('');
    const [remarks, setRemarks] = useState('');
    const [selectedColleague, setSelectedColleague] = useState('');
    const [releasedBy, setReleasedBy] = useState('');
    const [retentionFate, setRetentionFate] = useState<'originator' | 'destination' | null>(null);
    const [isProcessingFile, setIsProcessingFile] = useState(false);
    const [attachment, setAttachment] = useState<File | Blob | null>(null);
    const [attachmentName, setAttachmentName] = useState<string>('');

    const [originData, setOriginData] = useState<Record<string, { office: string, creator: string }>>({});
    const [isLoadingOrigins, setIsLoadingOrigins] = useState(false);
    const [currentUserDept, setCurrentUserDept] = useState<string>(''); 

    // --- BATCH VALIDATION LOGIC ---
    const canProcessBatch = useMemo(() => selectedDocs.length > 0 && selectedDocs.every((doc) => doc.assigned_clerk === currentUserName && doc.status !== 'pending_receipt'), [selectedDocs, currentUserName]);
    
    const isPendingHandshakeBatch = useMemo(() => selectedDocs.length > 0 && selectedDocs.every((doc) => doc.status === 'pending_receipt'), [selectedDocs]);
    
    const isMixedBatch = useMemo(() => selectedDocs.some(doc => doc.status === 'pending_receipt') && selectedDocs.some(doc => doc.status !== 'pending_receipt'), [selectedDocs]);

    const handleClose = () => { setIsClosing(true); setTimeout(onClose, 200); };

    const handleBackBtn = () => {
        if (isSubmitting) return;
        setActiveAction(null); setHasSignature(false); setRemarks(''); setDestination(''); setReceivingClerk('');
        setSelectedColleague(''); setReleasedBy(''); setRetentionFate(null); setAttachment(null);
    };

    useEffect(() => {
        const fetchDept = async () => {
            if (currentUserName) {
                const { data } = await supabase.from('employees').select('department').eq('name', currentUserName).single();
                if (data?.department) {
                    setCurrentUserDept(data.department);
                }
            }
        };
        fetchDept();
    }, [currentUserName]);

    useEffect(() => {
        if ((activeAction === 'reject' || activeAction === 'batch_decline' || activeAction === 'reassign') && selectedDocs.length > 0) {
            setIsLoadingOrigins(true);
            const fetchOrigins = async () => {
                const newOriginData: Record<string, { office: string, creator: string }> = {};
                await Promise.all(selectedDocs.map(async (doc) => {
                    let originOffice = 'Originating Office'; let creatorName = 'Creator / Sender';
                    if (doc.created_by) {
                        try {
                            const { data: creatorData } = await supabase.from('profiles').select('full_name').eq('id', doc.created_by).single();
                            if (creatorData?.full_name) {
                                creatorName = creatorData.full_name;
                                const { data: empData } = await supabase.from('employees').select('department').eq('name', creatorName).single();
                                if (empData?.department) originOffice = empData.department;
                            }
                        } catch { 
                            console.error("Failed to fetch origin"); 
                        }
                    }
                    newOriginData[doc.id] = { office: originOffice, creator: creatorName };
                }));
                setOriginData(newOriginData); setIsLoadingOrigins(false);
            };
            fetchOrigins();
        }
    }, [activeAction, selectedDocs]);

    const clearSignature = () => { 
        signaturePadRef.current?.clear(); 
        setHasSignature(false); 
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; 
        if (!file) return;

        if (file.size > 25 * 1024 * 1024) {
            toast.error("File too large", { description: "Please select a document or image smaller than 25MB." });
            return;
        }

        setIsProcessingFile(true); 
        setAttachmentName("Processing file...");
        
        try {
            if (file.type === 'application/pdf') { 
                setAttachment(file); 
                setAttachmentName(file.name); 
            } 
            else if (file.type.startsWith('image/')) {
                const pdfBlob = await convertImageToScannedPDF(file);
                setAttachment(pdfBlob); 
                setAttachmentName('Batch_Completed.pdf');
            } else { 
                toast.error("Unsupported file type."); 
                setAttachmentName(""); 
            }
        } catch { 
            toast.error("Failed to process the document."); 
            setAttachmentName(""); 
        } finally { 
            setIsProcessingFile(false); 
        }
    };

    const handleBatchSubmit = async () => {
        if (activeAction === 'reject' || activeAction === 'batch_decline') {
            if (isLoadingOrigins) { toast.error("Please wait", { description: "Still locating the origin offices for your batch." }); return; }
        }
        if (activeAction === 'batch_decline') {
            if (!remarks.trim()) { toast.error("Validation Error", { description: "Please provide a reason for declining." }); return; }
        }
        if (activeAction === 'add_step') {
            if (!destination) { toast.error("Validation Error", { description: "Please provide a destination office." }); return; }
            if (!receivingClerk.trim()) { toast.error("Validation Error", { description: "Please provide a receiving clerk." }); return; }
            if (!hasSignature) { toast.error("Signature Required", { description: "You must sign the pad to confirm this batch action." }); return; }
        }
        if (activeAction === 'complete') {
            if (!releasedBy.trim()) { toast.error("Validation Error", { description: "Please specify who released the documents." }); return; }
            if (!retentionFate) { toast.error("Validation Error", { description: "Please select where the documents will be retained." }); return; }
            if (!hasSignature) { toast.error("Signature Required", { description: "You must sign the pad to complete this batch." }); return; }
        }
        if (activeAction === 'reassign') {
            if (!selectedColleague) { toast.error("Validation Error", { description: "Please select a colleague to re-assign to." }); return; }
            if (isLoadingOrigins) { toast.error("Please wait", { description: "Verifying document creators." }); return; }
        }

        setIsSubmitting(true);
        try {
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            
            if (authError || !user) {
                toast.error("Authentication Error", { description: "Your session is invalid or expired. Please log in again." });
                return; 
            }

            let sharedSignatureUrl = null; let sharedAttachmentUrl = null;

            const blob = await signaturePadRef.current?.getBlob();
            if (blob && (activeAction === 'add_step' || activeAction === 'complete')) {
                const fileName = `batch-signature-${crypto.randomUUID()}.png`;
                const { error: uploadError } = await supabase.storage.from('attachments').upload(fileName, blob, { contentType: 'image/png' });
                if (!uploadError) sharedSignatureUrl = supabase.storage.from('attachments').getPublicUrl(fileName).data.publicUrl;
            }

            if (attachment && activeAction === 'complete') {
                const fileName = `batch-completed-${crypto.randomUUID()}.pdf`;
                const { error: uploadError } = await supabase.storage.from('attachments').upload(fileName, attachment, { contentType: 'application/pdf' });
                if (!uploadError) sharedAttachmentUrl = supabase.storage.from('attachments').getPublicUrl(fileName).data.publicUrl;
            }

            let deptForReceive = 'Processing';
            if (activeAction === 'batch_receive' && currentUserDept) {
                deptForReceive = currentUserDept;
            }

            const promises = selectedDocs.map(async (doc: DocumentItem) => {
                
                if (activeAction === 'batch_receive') {
                    const newLocation = deptForReceive || doc.current_location;
                    const { error: rpcError } = await supabase.rpc('process_document_action', {
                        p_doc_id: doc.id,
                        p_log_action: 'Document Received',
                        p_log_location: newLocation,
                        p_log_created_by: user.id,
                        p_log_assigned_to: currentUserName,
                        p_log_remarks: 'Digital handshake completed. Custody accepted.',
                        p_new_status: 'routing',
                        p_new_location: newLocation
                    });
                    if (rpcError) throw rpcError;

                } else if (activeAction === 'batch_decline') {
                    const originInfo = originData[doc.id] || { office: 'Originating Office', creator: 'Creator / Sender' };
                    const { error: rpcError } = await supabase.rpc('process_document_action', {
                        p_doc_id: doc.id,
                        p_log_action: 'Returned',
                        p_log_location: originInfo.office,
                        p_log_created_by: user.id,
                        p_log_assigned_to: originInfo.creator,
                        p_log_remarks: `Declined by: ${currentUserName}\nReason: ${remarks}`,
                        p_new_status: 'routing',
                        p_new_location: originInfo.office, 
                        p_new_clerk: originInfo.creator, 
                        p_new_remarks: `Declined by: ${currentUserName}\nReason: ${remarks}`
                    });
                    if (rpcError) throw rpcError;

                } else if (activeAction === 'complete') {
                    const fateString = retentionFate === 'originator' ? 'Returned to Originator' : 'Retained at Final Destination';
                    const detailedRemarks = `Released By: ${releasedBy.trim()}\nDocument Retention: ${fateString}${remarks ? `\nRemarks: ${remarks.trim()}` : ''}`;
                    
                    const { error: rpcError } = await supabase.rpc('process_document_action', {
                        p_doc_id: doc.id, p_log_action: 'Delivered', p_log_location: doc.final_destination || doc.current_location,
                        p_log_created_by: user.id, p_log_assigned_to: currentUserName, p_log_remarks: detailedRemarks,
                        p_log_signature_url: sharedSignatureUrl, p_log_attachment_url: sharedAttachmentUrl, p_new_status: 'sealed',
                        p_completed_attachment_url: sharedAttachmentUrl
                    });
                    if (rpcError) throw rpcError;

                } else if (activeAction === 'reject') {
                    const originInfo = originData[doc.id] || { office: 'Originating Office', creator: 'Creator / Sender' };
                    const finalRemarks = remarks.trim() || 'Returned without remarks';
                    
                    const { error: rpcError } = await supabase.rpc('process_document_action', {
                        p_doc_id: doc.id, p_log_action: 'Returned', p_log_location: originInfo.office,
                        p_log_created_by: user.id, p_log_assigned_to: originInfo.creator, p_log_remarks: finalRemarks,
                        p_new_status: 'pending', p_new_location: originInfo.office, p_new_clerk: originInfo.creator, p_new_remarks: finalRemarks
                    });
                    if (rpcError) throw rpcError;

                } else if (activeAction === 'add_step') {
                    const { error: rpcError } = await supabase.rpc('process_document_action', {
                        p_doc_id: doc.id, p_log_action: 'In transit', p_log_location: destination,
                        p_log_created_by: user.id, p_log_assigned_to: receivingClerk.trim(), p_log_signature_url: sharedSignatureUrl,
                        p_new_status: 'routing', p_new_location: destination, p_clear_remarks: true
                    });
                    if (rpcError) throw rpcError;

                } else if (activeAction === 'reassign') {
                    const prevClerk = doc.assigned_clerk || 'Unassigned';
                    
                    const originInfo = originData[doc.id];
                    const isReturningToCreator = originInfo && selectedColleague === originInfo.creator;
                    
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
                        p_doc_id: doc.id, p_log_action: 'REASSIGNED', p_log_location: doc.current_location || 'Processing',
                        p_log_created_by: user.id, p_log_remarks: `Batch re-assigned from ${prevClerk} to ${selectedColleague} by ${currentUserName}`,
                        p_new_clerk: selectedColleague,
                        p_new_status: nextStatus 
                    });
                    if (rpcError) throw rpcError;
                }
            });

            const results = await Promise.allSettled(promises);
            const successful = results.filter(r => r.status === 'fulfilled').length;
            const failed = results.filter(r => r.status === 'rejected').length;

            if (successful > 0) {
                if (failed > 0) {
                    toast.warning("Partial Success", { description: `Processed ${successful} documents, but ${failed} failed.` });
                } else {
                    toast.success(`Successfully processed all ${successful} documents!`);
                }
                onSuccess();
            } else {
                toast.error("Batch Failed", { description: "Failed to process the selected documents. Please check your permissions." });
            }

        } catch { 
            toast.error("An error occurred during batch setup."); 
        } finally { 
            setIsSubmitting(false); 
        }
    };

    // --- RENDER MENU OPTIONS ---
    if (!activeAction) {
        return (
            <>
                <div 
                    className={`fixed inset-0 z-[998] bg-slate-900/30 backdrop-blur-sm transition-all ${isClosingProp ? 'animate-out fade-out duration-200' : 'animate-in fade-in duration-200'}`} 
                    onClick={onClose}
                ></div>
                
                <div className={`fixed bottom-[5.5rem] right-6 sm:bottom-[6.5rem] sm:right-8 z-[999] flex flex-col items-end origin-bottom-right ${isClosingProp ? 'animate-out zoom-out-95 fade-out duration-200' : 'animate-in zoom-in-95 fade-in duration-200'}`}>
                    <div className="bg-white p-2.5 rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.15)] flex flex-col min-w-[240px] border border-slate-100 gap-1">
                        
                        <div className="px-3 py-2 border-b border-slate-100 mb-0.5 flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Batch Options</span>
                            <span className="bg-[#eaf4f1] text-[#0f766e] text-[10px] font-black px-2 py-0.5 rounded-md">{selectedDocs.length} Docs</span>
                        </div>

                        {/* --- MIXED BATCH WARNING --- */}
                        {isMixedBatch && (
                            <div className="px-3 py-2.5 mx-1 mt-1 mb-1 bg-rose-50 border border-rose-100 rounded-xl">
                                <p className="text-xs text-rose-600 font-bold leading-snug flex items-start gap-2">
                                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                                    Mixed batch detected. Please select ONLY unreceived documents, or ONLY received documents.
                                </p>
                            </div>
                        )}

                        {!canProcessBatch && !isPendingHandshakeBatch && !isMixedBatch && (
                            <div className="px-3 py-2">
                                <p className="text-xs text-amber-600 font-bold leading-snug">Processing restricted. Only Re-assign allowed.</p>
                            </div>
                        )}
                        
                        {/* Only show buttons if it is NOT a mixed batch */}
                        {!isMixedBatch && (
                            isPendingHandshakeBatch ? (
                                <>
                                    <button onClick={() => setActiveAction('batch_receive')} className="flex items-center gap-3.5 w-full p-2 rounded-2xl transition-all hover:bg-emerald-50 active:scale-[0.98] group">
                                        <div className="w-[2.4rem] h-[2.4rem] rounded-[0.8rem] bg-emerald-100 text-emerald-600 flex items-center justify-center transition-colors group-hover:bg-emerald-200 shrink-0">
                                            <Check size={18} strokeWidth={3} />
                                        </div>
                                        <span className="font-bold text-[15px] text-slate-800">Receive Batch</span>
                                    </button>
                                    
                                    <button onClick={() => setActiveAction('batch_decline')} className="flex items-center gap-3.5 w-full p-2 rounded-2xl transition-all hover:bg-rose-50 active:scale-[0.98] group">
                                        <div className="w-[2.4rem] h-[2.4rem] rounded-[0.8rem] bg-rose-100 text-rose-600 flex items-center justify-center transition-colors group-hover:bg-rose-200 shrink-0">
                                            <Ban size={18} strokeWidth={2.5} />
                                        </div>
                                        <span className="font-bold text-[15px] text-slate-800">Decline Batch</span>
                                    </button>
                                </>
                            ) : (
                                <>
                                    {canProcessBatch && (
                                        <button onClick={() => setActiveAction('add_step')} className="flex items-center gap-3.5 w-full p-2 rounded-2xl transition-all hover:bg-slate-50 active:scale-[0.98] group">
                                            <div className="w-[2.4rem] h-[2.4rem] rounded-[0.8rem] bg-[#eaf4f1] text-[#0f766e] flex items-center justify-center transition-colors group-hover:bg-[#d5ebe5] shrink-0">
                                                <MapPin size={18} strokeWidth={2.5} />
                                            </div>
                                            <span className="font-bold text-[15px] text-slate-800">Add Step</span>
                                        </button>
                                    )}
                                    
                                    {canProcessBatch && (
                                        <button onClick={() => setActiveAction('complete')} className="flex items-center gap-3.5 w-full p-2 rounded-2xl transition-all hover:bg-slate-50 active:scale-[0.98] group">
                                            <div className="w-[2.4rem] h-[2.4rem] rounded-[0.8rem] bg-[#eaf4f1] text-[#0f766e] flex items-center justify-center transition-colors group-hover:bg-[#d5ebe5] shrink-0">
                                                <CheckCircle size={18} strokeWidth={2.5} />
                                            </div>
                                            <span className="font-bold text-[15px] text-slate-800">Complete Batch</span>
                                        </button>
                                    )}
                                    
                                    <button onClick={() => setActiveAction('reassign')} className="flex items-center gap-3.5 w-full p-2 rounded-2xl transition-all hover:bg-slate-50 active:scale-[0.98] group">
                                        <div className="w-[2.4rem] h-[2.4rem] rounded-[0.8rem] bg-[#eaf4f1] text-[#0f766e] flex items-center justify-center transition-colors group-hover:bg-[#d5ebe5] shrink-0">
                                            <UserPlus size={18} strokeWidth={2.5} />
                                        </div>
                                        <span className="font-bold text-[15px] text-slate-800">Re-assign</span>
                                    </button>
                                    
                                    {canProcessBatch && (
                                        <button onClick={() => setActiveAction('reject')} className="flex items-center gap-3.5 w-full p-2 rounded-2xl transition-all hover:bg-slate-50 active:scale-[0.98] group">
                                            <div className="w-[2.4rem] h-[2.4rem] rounded-[0.8rem] bg-rose-50 text-rose-600 flex items-center justify-center transition-colors group-hover:bg-rose-100 shrink-0">
                                                <Ban size={18} strokeWidth={2.5} />
                                            </div>
                                            <span className="font-bold text-[15px] text-slate-800">Return / Reject</span>
                                        </button>
                                    )}
                                </>
                            )
                        )}

                        <div className="h-[1px] bg-slate-100 my-1 mx-2"></div>

                        <button onClick={onClearSelection} className="flex items-center gap-3.5 w-full p-2 rounded-2xl transition-all hover:bg-slate-50 active:scale-[0.98] group">
                            <div className="w-[2.4rem] h-[2.4rem] rounded-[0.8rem] bg-slate-100 text-slate-500 flex items-center justify-center transition-colors group-hover:bg-slate-200 shrink-0">
                                <X size={18} strokeWidth={2.5} />
                            </div>
                            <span className="font-bold text-[15px] text-slate-600">Clear selection</span>
                        </button>
                    </div>
                </div>
            </>
        );
    }

    const headerColorClass = activeAction === 'add_step' ? 'bg-slate-900' : (activeAction === 'reject' || activeAction === 'batch_decline') ? 'bg-rose-600' : (activeAction === 'complete' || activeAction === 'batch_receive') ? 'bg-emerald-600' : activeAction === 'reassign' ? 'bg-[#0f766e]' : 'bg-slate-900';

    return (
        <div className={`fixed inset-0 z-[1050] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/70 backdrop-blur-sm ${isClosing ? 'animate-out fade-out duration-200 fill-mode-forwards' : 'animate-in fade-in duration-200'}`}>
            <div className={`bg-white w-full max-w-xl max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden shadow-2xl rounded-t-[1.5rem] sm:rounded-3xl transition-all duration-300 ease-in-out ${isClosing ? 'animate-out slide-out-to-bottom-[100%] sm:slide-out-to-bottom-0 sm:zoom-out-95 duration-200 fill-mode-forwards' : 'animate-in slide-in-from-bottom-[100%] sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300'}`}>
                
                <div className={`text-white relative flex flex-col shrink-0 transition-colors duration-300 ${headerColorClass}`}>
                    <div className="w-16 h-1.5 bg-white/30 rounded-full mx-auto mt-3 sm:hidden shrink-0"></div>
                    <div className="p-5 pt-3 sm:pt-6 flex items-center justify-between">
                        <button onClick={handleBackBtn} disabled={isSubmitting} className="p-2 -ml-2 bg-white/10 hover:bg-white/20 active:bg-white/30 rounded-full transition-all active:scale-90 disabled:opacity-50"><ArrowLeft size={24} /></button>
                        <h3 className="font-black text-xl tracking-tight absolute left-1/2 -translate-x-1/2 whitespace-nowrap">
                            {activeAction === 'reject' ? 'Reject & Return' : activeAction === 'complete' ? 'Finalize Batch' : activeAction === 'reassign' ? 'Batch Re-assign' : activeAction === 'batch_receive' ? 'Receive Documents' : activeAction === 'batch_decline' ? 'Decline Documents' : 'Route Document'}
                        </h3>
                        <button onClick={handleClose} disabled={isSubmitting} className="p-2 -mr-2 bg-white/10 hover:bg-white/20 active:bg-white/30 rounded-full transition-all active:scale-90 disabled:opacity-50"><X size={24} /></button>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-6 custom-scrollbar bg-white">
                    <div className="space-y-6">
                        
                        {activeAction === 'batch_receive' && (
                            <div className="text-center space-y-4 pt-4">
                                <div className="mx-auto w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-2">
                                    <CheckCircle size={32} className="text-emerald-600" />
                                </div>
                                <h4 className="text-lg font-bold text-slate-900 leading-tight">Confirm Batch Receipt</h4>
                                <p className="text-sm text-slate-600 font-medium pb-4 border-b border-slate-100">
                                    You are about to accept custody of <strong className="text-slate-800">{selectedDocs.length} documents</strong>. This will be officially logged in all of their digital trails.
                                </p>
                            </div>
                        )}

                        {activeAction === 'batch_decline' && (
                            <>
                                <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl text-rose-700 text-sm font-bold flex flex-col gap-3 shadow-sm">
                                    <div className="flex items-start gap-3">
                                        <Ban size={20} className="shrink-0 mt-0.5" />
                                        <div className="flex-1">
                                            <p className="mb-3 text-rose-800">You are about to decline custody of <strong className="text-rose-900">{selectedDocs.length} documents</strong>. They will be automatically returned to:</p>
                                            {isLoadingOrigins ? (
                                                <div className="flex items-center gap-2 text-rose-600"><span className="w-3 h-3 border-2 border-rose-300 border-t-rose-600 rounded-full animate-spin"></span><span className="text-xs uppercase tracking-wider font-bold">Locating offices...</span></div>
                                            ) : (
                                                <div className="max-h-32 overflow-y-auto custom-scrollbar pr-2 space-y-2">
                                                    {selectedDocs.map(doc => { 
                                                        const info = originData[doc.id]; 
                                                        return (
                                                            <div key={doc.id} className="bg-white/60 p-2 rounded-lg border border-rose-100/50 text-xs flex items-center justify-between shadow-sm">
                                                                <span className="font-mono text-[10px] text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded mr-2 shrink-0">{doc.reference_no || doc.id.substring(0,8)}</span>
                                                                <div className="text-right min-w-0 flex-1 truncate">
                                                                    <span className="text-rose-900 font-bold block truncate">{info?.office || 'Originating Office'}</span>
                                                                    <span className="text-rose-600/80 font-bold text-[10px] uppercase tracking-wider block truncate">For: {info?.creator || 'Creator'}</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="relative z-10">
                                    <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Reason for Declining *</label>
                                    <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Why are you rejecting this batch?" className="w-full p-4 bg-slate-50/50 border border-slate-200 focus:bg-white focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 rounded-xl outline-none font-bold text-slate-700 text-sm min-h-[140px] resize-y transition-all" autoFocus></textarea>
                                </div>
                            </>
                        )}

                        {activeAction === 'add_step' && (
                            <>
                                <div className="relative z-20">
                                    <DepartmentSelect 
                                        value={destination} 
                                        onChange={setDestination} 
                                        isRelative={true} 
                                    />
                                </div>
                                <div className="relative z-10">
                                    <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Receiving Clerk *</label>
                                    <input 
                                        type="text" 
                                        value={receivingClerk} 
                                        onChange={(e) => setReceivingClerk(e.target.value)} 
                                        placeholder="Enter name of receiving clerk..." 
                                        className="w-full px-4 py-3.5 bg-slate-50/50 border border-slate-200 focus:bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 rounded-xl outline-none font-bold text-slate-700 text-sm transition-all" 
                                    />
                                </div>
                                <div>
                                    <div className="flex justify-between items-center mb-1.5">
                                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><PenTool size={13}/> Signature *</label>
                                        <button onClick={clearSignature} type="button" className="text-[11px] text-slate-600 font-bold hover:text-slate-900 transition-colors bg-white px-3 py-1.5 rounded-lg border border-slate-200 active:scale-95 shadow-sm">Clear Pad</button>
                                    </div>
                                    <SignaturePad ref={signaturePadRef} onBegin={() => setHasSignature(true)} containerClassName="border border-slate-200 rounded-xl bg-slate-50/50 overflow-hidden touch-none relative shadow-sm" />
                                    <p className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Sign clearly within the box above</p>
                                </div>
                            </>
                        )}
                        {activeAction === 'complete' && (
                            <>
                                <div><label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Scanned Signed Copy (Optional)</label><label className={`w-full flex items-center justify-center gap-2 p-3.5 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${attachment ? 'bg-emerald-50 border-emerald-400 text-emerald-700' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'}`}><input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileChange} disabled={isProcessingFile} />{isProcessingFile ? <span className="animate-pulse font-bold text-sm">Processing...</span> : attachment ? <><CheckCircle size={18}/> <span className="font-bold text-sm truncate max-w-[200px]">{attachmentName}</span></> : <><Camera size={18}/> <span className="font-bold text-sm">Scan Signed Document</span></>}</label>{attachment && !isProcessingFile && (<div className="mt-2 text-right"><button type="button" onClick={() => { setAttachment(null); setAttachmentName(''); }} className="text-xs text-red-500 font-bold hover:underline">Remove Attachment</button></div>)}</div>
                                <div><label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Released By *</label><input type="text" value={releasedBy} onChange={(e) => setReleasedBy(e.target.value)} placeholder="Name of official releasing the documents..." className="w-full p-3.5 bg-slate-50/50 border border-slate-200 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-xl outline-none font-bold text-slate-700 text-sm transition-all" /></div>
                                <div>
                                    <div className="flex justify-between items-center mb-1.5"><label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><PenTool size={13}/> Signature *</label><button onClick={clearSignature} type="button" className="text-[11px] text-slate-600 font-bold hover:text-slate-900 transition-colors bg-white px-3 py-1.5 rounded-lg border border-slate-200 active:scale-95 shadow-sm">Clear Pad</button></div>
                                    <SignaturePad ref={signaturePadRef} onBegin={() => setHasSignature(true)} containerClassName="border border-slate-200 rounded-xl bg-slate-50/50 overflow-hidden touch-none relative shadow-sm" />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Document Retention *</label>
                                    <div className="flex flex-col gap-2"><div onClick={() => setRetentionFate('originator')} className={`p-4 border rounded-xl cursor-pointer transition-all active:scale-[0.98] flex items-center gap-3 ${retentionFate === 'originator' ? 'border-emerald-500 bg-emerald-50/30' : 'border-slate-200 bg-white hover:border-slate-300'}`}><div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${retentionFate === 'originator' ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300'}`}>{retentionFate === 'originator' && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}</div><p className="font-bold text-sm text-slate-700">Return to Originator</p></div><div onClick={() => setRetentionFate('destination')} className={`p-4 border rounded-xl cursor-pointer transition-all active:scale-[0.98] flex items-center gap-3 ${retentionFate === 'destination' ? 'border-emerald-500 bg-emerald-50/30' : 'border-slate-200 bg-white hover:border-slate-300'}`}><div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${retentionFate === 'destination' ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300'}`}>{retentionFate === 'destination' && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}</div><p className="font-bold text-sm text-slate-700">Retain at Office</p></div></div>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Unified Remarks (Optional)</label>
                                    <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Add final notes or context for the archive..." className="w-full p-3.5 bg-slate-50/50 border border-slate-200 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-xl outline-none font-bold text-slate-700 text-sm transition-all min-h-[100px] resize-y" ></textarea>
                                </div>
                            </>
                        )}
                        {activeAction === 'reject' && (
                            <>
                                <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl text-rose-700 text-sm font-bold flex flex-col gap-3 shadow-sm"><div className="flex items-start gap-3"><Ban size={20} className="shrink-0 mt-0.5" /><div className="flex-1"><p className="mb-3 text-rose-800">These documents will be automatically returned to:</p>{isLoadingOrigins ? <div className="flex items-center gap-2 text-rose-600"><span className="w-3 h-3 border-2 border-rose-300 border-t-rose-600 rounded-full animate-spin"></span><span className="text-xs uppercase tracking-wider font-bold">Locating offices...</span></div> : <div className="max-h-32 overflow-y-auto custom-scrollbar pr-2 space-y-2">{selectedDocs.map(doc => { const info = originData[doc.id]; return <div key={doc.id} className="bg-white/60 p-2 rounded-lg border border-rose-100/50 text-xs flex items-center justify-between shadow-sm"><span className="font-mono text-[10px] text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded mr-2 shrink-0">{doc.reference_no || doc.id.substring(0,8)}</span><div className="text-right min-w-0 flex-1 truncate"><span className="text-rose-900 font-bold block truncate">{info?.office || 'Originating Office'}</span><span className="text-rose-600/80 font-bold text-[10px] uppercase tracking-wider block truncate">For: {info?.creator || 'Creator'}</span></div></div>;})}</div>}</div></div></div>
                                <div className="relative z-10"><label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Reason for Rejection (Optional)</label><textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="E.g., Missing signature, incorrect attachments..." className="w-full p-3.5 bg-slate-50/50 border border-slate-200 focus:bg-white focus:border-red-500 focus:ring-4 focus:ring-red-500/10 rounded-xl outline-none font-bold text-slate-700 text-sm min-h-[140px] resize-y transition-all" ></textarea></div>
                            </>
                        )}
                        
                        {activeAction === 'reassign' && (
                            <div className="relative z-20">
                                <EmployeeSelect 
                                    value={selectedColleague} 
                                    onChange={setSelectedColleague}
                                    departmentFilter={currentUserDept} 
                                    isRelative={true} 
                                />
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-white p-4 sm:p-5 flex shrink-0 border-t border-slate-50">
                    {activeAction === 'batch_receive' && <button onClick={handleBatchSubmit} disabled={isSubmitting} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl shadow-sm transition-all active:scale-[0.98] text-sm flex justify-center items-center gap-2 disabled:opacity-50">{isSubmitting ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : <><CheckCircle size={18} strokeWidth={2.5} /> Yes, Receive Documents</>}</button>}
                    {activeAction === 'batch_decline' && <button onClick={handleBatchSubmit} disabled={isSubmitting || !remarks.trim() || isLoadingOrigins} className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-3.5 rounded-xl shadow-sm transition-all active:scale-[0.98] text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:bg-rose-400">{isSubmitting ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : <><Ban size={18} strokeWidth={2.5} /> Confirm Decline</>}</button>}
                    {activeAction === 'add_step' && <button onClick={handleBatchSubmit} disabled={isSubmitting || !destination || !receivingClerk.trim() || !hasSignature} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl shadow-sm transition-all active:scale-[0.98] text-sm flex justify-center items-center gap-2 disabled:opacity-50">{isSubmitting ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : <><MapPin size={18} strokeWidth={2.5} /> Confirm Add Step</>}</button>}
                    {activeAction === 'complete' && <button onClick={handleBatchSubmit} disabled={isSubmitting || !releasedBy.trim() || !retentionFate || !hasSignature || isProcessingFile} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl shadow-sm transition-all active:scale-[0.98] text-sm flex items-center justify-center gap-2 disabled:opacity-50">{isSubmitting ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : <><CheckCircle size={18} strokeWidth={2.5} /> Finalize Batch</>}</button>}
                    {activeAction === 'reject' && <button onClick={handleBatchSubmit} disabled={isSubmitting || isLoadingOrigins} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-xl shadow-sm transition-all active:scale-[0.98] text-sm flex items-center justify-center gap-2 disabled:opacity-50">{isSubmitting ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : <><Ban size={18} strokeWidth={2.5} /> Confirm Return</>}</button>}
                    
                    {activeAction === 'reassign' && (
                        <button 
                            onClick={handleBatchSubmit} 
                            disabled={isSubmitting || !selectedColleague} 
                            className={`w-full text-white font-bold py-4 rounded-xl shadow-sm transition-all active:scale-[0.98] text-sm flex items-center justify-center gap-2 ${
                                selectedColleague 
                                    ? 'bg-[#0f766e] hover:bg-[#0b5c55]'
                                    : 'bg-[#7bc1b5] cursor-not-allowed opacity-80'
                            }`}
                        >
                            {isSubmitting ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : <><UserPlus size={18} strokeWidth={2.5} /> Confirm Re-assign</>}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}