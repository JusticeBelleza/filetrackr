import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MapPin, PenTool, X, CheckCircle, Camera, Paperclip, AlertCircle, ArrowLeft, ChevronRight, Ban } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { convertImageToScannedPDF } from '../../lib/utils';
import SignaturePad, { type SignaturePadRef } from '../ui/SignaturePad';

// --- NEW COMPONENT IMPORTS ---
import DepartmentSelect from '../ui/DepartmentSelect';

// --- TypeScript Interfaces ---
interface SelectOption { label: string; value: string; }
type OptionType = SelectOption | string;

interface DocumentItem {
    id: string; reference_no?: string; title?: string; subject?: string;
    is_urgent?: boolean; current_location?: string; final_destination?: string; created_by?: string; 
}

interface HandoverScreenProps {
    doc: DocumentItem; 
    departments: OptionType[]; // Kept so the parent component doesn't break, even though DepartmentSelect handles itself
    onBack: () => void; 
    onSuccess: () => void;
}

export default function HandoverScreen({ doc, onBack, onSuccess }: HandoverScreenProps) {
    const signaturePadRef = useRef<SignaturePadRef>(null);

    const [isClosing, setIsClosing] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeAction, setActiveAction] = useState<'route' | 'reject' | 'complete' | null>(null);

    const [hasSignature, setHasSignature] = useState(false);
    const [destination, setDestination] = useState('');
    const [receivingClerk, setReceivingClerk] = useState('');
    const [rejectReason, setRejectReason] = useState('');

    const [isProcessingFile, setIsProcessingFile] = useState(false);
    const [attachment, setAttachment] = useState<File | Blob | null>(null);
    const [attachmentName, setAttachmentName] = useState<string>('');
    const [releasedBy, setReleasedBy] = useState('');
    const [completionRemarks, setCompletionRemarks] = useState('');
    const [retentionFate, setRetentionFate] = useState<'originator' | 'destination' | null>(null);

    const [originOffice, setOriginOffice] = useState('Originating Office');
    const [originCreator, setOriginCreator] = useState('Creator');
    const [isLoadingOrigin, setIsLoadingOrigin] = useState(false);

    const overlayAnimation = isClosing ? "animate-out fade-out duration-200 ease-in fill-mode-forwards" : "animate-in fade-in duration-200 ease-out fill-mode-forwards";
    const modalAnimation = isClosing ? "animate-out slide-out-to-bottom-[100%] sm:slide-out-to-bottom-0 sm:zoom-out-95 duration-200 ease-in fill-mode-forwards" : "animate-in slide-in-from-bottom-[100%] sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200 ease-out fill-mode-forwards";

    const handleClose = (e?: React.MouseEvent | React.TouchEvent) => {
        if (e && e.preventDefault) e.preventDefault(); 
        if (isClosing) return; 
        setIsClosing(true);
        setTimeout(() => { onBack(); }, 200);
    };

    const handleBackBtn = (e?: React.MouseEvent | React.TouchEvent) => {
        if (e && e.preventDefault) e.preventDefault();
        if (isSubmitting) return;
        setActiveAction(null);
        setHasSignature(false); 
    };

    useEffect(() => {
        if (activeAction === 'reject' && doc.created_by) {
            setIsLoadingOrigin(true);
            const fetchOriginData = async () => {
                try {
                    const { data: creatorData } = await supabase.from('profiles').select('full_name').eq('id', doc.created_by).single();
                    if (creatorData?.full_name) {
                        setOriginCreator(creatorData.full_name);
                        const { data: empData } = await supabase.from('employees').select('department').eq('name', creatorData.full_name).single();
                        if (empData?.department) setOriginOffice(empData.department);
                    }
                } catch { console.error("Failed to fetch origin office"); } 
                finally { setIsLoadingOrigin(false); }
            };
            fetchOriginData();
        }
    }, [activeAction, doc.created_by]);

    const clearSignature = () => { 
        signaturePadRef.current?.clear();
        setHasSignature(false);
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; if (!file) return;

        if (file.size > 25 * 1024 * 1024) {
            toast.error("File too large", { description: "Please select a document or image smaller than 25MB." });
            return;
        }

        setIsProcessingFile(true); setAttachmentName("Processing file...");
        try {
            if (file.type === 'application/pdf') { 
                setAttachment(file); 
                setAttachmentName(file.name); 
            } 
            else if (file.type.startsWith('image/')) {
                const pdfBlob = await convertImageToScannedPDF(file);
                setAttachment(pdfBlob); 
                setAttachmentName(`Final_Signed_${doc.reference_no}.pdf`);
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

    // --- SECURE RPC ROUTING ---
    const handleSaveRouting = async () => {
        if (!destination || !receivingClerk.trim()) { toast.error("Validation Error", { description: "Please provide a destination and receiving clerk." }); return; }
        if (!hasSignature) { toast.error("Signature Required", { description: "The receiving clerk must sign the pad to confirm receipt." }); return; }

        setIsSubmitting(true);
        try {
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError || !user) {
                toast.error("Authentication Error", { description: "Your session is invalid or expired. Please log in again." });
                return;
            }

            let signatureUrl = null;

            const blob = await signaturePadRef.current?.getBlob();
            if (blob) {
                const fileName = `signature-${doc.reference_no || doc.id}-${crypto.randomUUID()}.png`;
                const { error: uploadError } = await supabase.storage.from('attachments').upload(fileName, blob, { contentType: 'image/png' });
                if (uploadError) throw uploadError;
                signatureUrl = supabase.storage.from('attachments').getPublicUrl(fileName).data.publicUrl;
            }

            const { error: rpcError } = await supabase.rpc('process_document_action', {
                p_doc_id: doc.id,
                p_log_action: 'In transit',
                p_log_location: destination,
                p_log_created_by: user.id, 
                p_log_assigned_to: receivingClerk.trim(),
                p_log_remarks: null,
                p_log_signature_url: signatureUrl || null,
                p_log_attachment_url: null,
                p_new_status: 'routing',
                p_new_location: destination,
                p_new_clerk: null,
                p_new_remarks: null,
                p_clear_remarks: true,
                p_completed_attachment_url: null
            });

            if (rpcError) throw rpcError;

            toast.success("Document Routed Successfully!", { description: `Forwarded to ${destination}.`});
            onSuccess(); handleClose();
        } catch (err: unknown) { 
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
            toast.error("Failed to route document", { description: errorMessage }); 
        } 
        finally { setIsSubmitting(false); }
    };

    // --- SECURE RPC COMPLETION ---
    const confirmComplete = async () => {
        if (!releasedBy.trim()) { toast.error("Validation Error", { description: "Please specify who released the document." }); return; }
        if (!retentionFate) { toast.error("Validation Error", { description: "Please select where the document will be retained." }); return; }
        if (!hasSignature) { toast.error("Signature Required", { description: "The releasing official must sign to finalize this document." }); return; }

        setIsSubmitting(true);
        try {
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError || !user) {
                toast.error("Authentication Error", { description: "Your session is invalid or expired. Please log in again." });
                return;
            }

            let attachmentUrl = null;
            let signatureUrl = null;

            if (attachment) {
                const fileName = `completed-${doc.reference_no}-${crypto.randomUUID()}.pdf`;
                const { error: uploadError } = await supabase.storage.from('attachments').upload(fileName, attachment, { contentType: 'application/pdf' });
                if (uploadError) throw uploadError;
                attachmentUrl = supabase.storage.from('attachments').getPublicUrl(fileName).data.publicUrl;
            }

            const blob = await signaturePadRef.current?.getBlob();
            if (blob) {
                const fileName = `signature-complete-${doc.reference_no || doc.id}-${crypto.randomUUID()}.png`;
                const { error: uploadError } = await supabase.storage.from('attachments').upload(fileName, blob, { contentType: 'image/png' });
                if (uploadError) throw uploadError;
                signatureUrl = supabase.storage.from('attachments').getPublicUrl(fileName).data.publicUrl;
            }

            const fateString = retentionFate === 'originator' ? 'Returned to Originator' : 'Retained at Final Destination';
            const detailedRemarks = `Released By: ${releasedBy.trim()}\nDocument Retention: ${fateString}${completionRemarks ? `\nRemarks: ${completionRemarks.trim()}` : ''}`;

            const { error: rpcError } = await supabase.rpc('process_document_action', {
                p_doc_id: doc.id,
                p_log_action: 'Delivered',
                p_log_location: doc.final_destination || doc.current_location || 'Processing',
                p_log_created_by: user.id, 
                p_log_assigned_to: null,
                p_log_remarks: detailedRemarks || null,
                p_log_signature_url: signatureUrl || null,
                p_log_attachment_url: attachmentUrl || null,
                p_new_status: 'sealed',
                p_new_location: null,
                p_new_clerk: null,
                p_new_remarks: completionRemarks.trim() || null,
                p_clear_remarks: false,
                p_completed_attachment_url: attachmentUrl || null
            });

            if (rpcError) throw rpcError;

            toast.success("Document Completed!", { description: "It has been moved to history." });
            onSuccess(); handleClose();
        } catch { toast.error("Failed to complete document"); } 
        finally { setIsSubmitting(false); }
    };

    // --- SECURE RPC REJECTION ---
    const handleReject = async () => {
        setIsSubmitting(true);
        try {
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError || !user) {
                toast.error("Authentication Error", { description: "Your session is invalid or expired. Please log in again." });
                return;
            }

            const finalRemarks = rejectReason.trim() || 'Returned without remarks';

            const { error: rpcError } = await supabase.rpc('process_document_action', {
                p_doc_id: doc.id,
                p_log_action: 'Returned',
                p_log_location: originOffice,
                p_log_created_by: user.id, 
                p_log_assigned_to: originCreator,
                p_log_remarks: finalRemarks || null,
                p_log_signature_url: null,
                p_log_attachment_url: null,
                p_new_status: 'pending',
                p_new_location: originOffice,
                p_new_clerk: originCreator,
                p_new_remarks: finalRemarks || null,
                p_clear_remarks: false,
                p_completed_attachment_url: null
            });

            if (rpcError) throw rpcError;

            toast.success("Document Returned", { description: `Sent back to ${originCreator} at ${originOffice}` });
            onSuccess(); handleClose();
        } catch { toast.error("Failed to return document"); } 
        finally { setIsSubmitting(false); }
    };

    return createPortal(
        <div className={`fixed inset-0 z-[999] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/70 backdrop-blur-sm ${overlayAnimation}`}>
            <div className={`bg-white w-full max-w-xl max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden shadow-2xl rounded-t-[1.5rem] sm:rounded-3xl ${modalAnimation}`}>
                <div className={`text-white relative flex flex-col shrink-0 transition-colors duration-300 ${activeAction === 'reject' ? 'bg-red-700' : activeAction === 'complete' ? 'bg-emerald-700' : 'bg-slate-900'}`}>
                    <div className="w-16 h-1.5 bg-white/30 rounded-full mx-auto mt-3 sm:hidden shrink-0"></div>
                    <div className="p-5 pt-3 sm:pt-6 flex items-center justify-between">
                        {activeAction ? <button onClick={handleBackBtn} onTouchEnd={handleBackBtn} disabled={isSubmitting} className="p-2 -ml-2 bg-white/10 hover:bg-white/20 active:bg-white/30 rounded-full transition-all active:scale-90 disabled:opacity-50"><ArrowLeft size={24} /></button> : <div className="w-10"></div>}
                        <h3 className="font-black text-xl tracking-tight">{!activeAction ? 'Action Required' : activeAction === 'reject' ? 'Reject & Return' : activeAction === 'complete' ? 'Finalize Document' : 'Route Document'}</h3>
                        <button onClick={handleClose} onTouchEnd={handleClose} disabled={isSubmitting} className="p-2 -mr-2 bg-white/10 hover:bg-white/20 active:bg-white/30 rounded-full transition-all active:scale-90 disabled:opacity-50"><X size={24} /></button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-6 custom-scrollbar bg-white">
                    {!activeAction && (
                        <div className="bg-slate-50 border border-slate-200 p-4 sm:p-5 rounded-2xl flex flex-col items-start mb-2">
                            <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 font-mono">{doc.reference_no || `DOC-${doc.id.substring(0, 8)}`}</p>
                            <h4 className="text-lg sm:text-xl font-black text-slate-900 leading-tight flex items-start gap-2">{doc.is_urgent && <AlertCircle size={22} className="text-red-600 shrink-0 mt-0.5" />} {doc.title || doc.subject || 'Untitled Document'}</h4>
                        </div>
                    )}

                    {!activeAction ? (
                        <div className="flex flex-col gap-3">
                            <ActionCard title="Add Step" description="Route this document to its next destination." icon={<MapPin size={20} strokeWidth={2.5} />} colorTheme="blue" onClick={() => setActiveAction('route')} />
                            <ActionCard title="Complete Document" description="Finalize, log remarks, and secure the record." icon={<CheckCircle size={20} strokeWidth={2.5} />} colorTheme="emerald" onClick={() => setActiveAction('complete')} />
                            <ActionCard title="Return / Reject" description="Bounce this document back to the originating office." icon={<Ban size={20} strokeWidth={2.5} />} colorTheme="rose" onClick={() => setActiveAction('reject')} />
                        </div>
                    ) : null}

                    {activeAction === 'route' && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
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
                                    className="w-full p-3.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-xl outline-none font-bold text-slate-900 text-sm sm:text-base transition-all" 
                                />
                            </div>

                            <div>
                                <div className="flex justify-between items-end mb-1.5">
                                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><PenTool size={14}/> Signature *</label>
                                    <button onClick={clearSignature} type="button" className="text-[11px] text-slate-500 font-bold hover:text-slate-900 transition-colors bg-white px-2.5 py-1 rounded-md border border-slate-200 active:scale-95 shadow-sm">Clear Pad</button>
                                </div>
                                <SignaturePad ref={signaturePadRef} onBegin={() => setHasSignature(true)} containerClassName="border border-slate-200 rounded-2xl bg-slate-50 overflow-hidden touch-none relative shadow-inner" />
                                <p className="text-center text-[11px] text-slate-400 mt-2 font-bold uppercase tracking-widest">Sign clearly within the box above</p>
                            </div>
                        </div>
                    )}

                    {activeAction === 'complete' && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
                            <div><label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Scanned Signed Copy (Optional)</label><div className="flex items-center gap-3"><label className={`hidden sm:flex flex-1 items-center justify-center gap-2 p-3.5 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${attachment ? 'bg-emerald-50 border-emerald-400 text-emerald-700' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'}`}><input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileChange} disabled={isProcessingFile} />{isProcessingFile ? <span className="animate-pulse font-bold text-sm">Processing PDF...</span> : attachment ? <><CheckCircle size={18}/> <span className="font-bold text-sm truncate max-w-[200px]">{attachmentName}</span></> : <><Paperclip size={18}/> <span className="font-bold text-sm">Attach Final PDF</span></>}</label><label className={`flex sm:hidden flex-1 items-center justify-center gap-2 p-3.5 border-2 border-dashed rounded-xl cursor-pointer transition-colors active:scale-95 ${attachment ? 'bg-emerald-50 border-emerald-400 text-emerald-700' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'}`}><input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} disabled={isProcessingFile} />{isProcessingFile ? <span className="animate-pulse font-bold text-sm">Processing PDF...</span> : attachment ? <><CheckCircle size={18}/> <span className="font-bold text-sm truncate max-w-[150px]">{attachmentName}</span></> : <><Camera size={18}/> <span className="font-bold text-sm">Scan Signed Document</span></>}</label>{attachment && !isProcessingFile && (<button type="button" onClick={() => { setAttachment(null); setAttachmentName(''); }} className="p-3.5 bg-red-50 text-red-600 rounded-xl border border-red-200 hover:bg-red-100 active:scale-95 transition-all"><X size={18} strokeWidth={2.5} /></button>)}</div></div>
                            <div><label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Released By *</label><input type="text" value={releasedBy} onChange={(e) => setReleasedBy(e.target.value)} placeholder="Name of official releasing the document..." className="w-full p-3.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-xl outline-none font-bold text-slate-900 text-sm sm:text-base transition-all" /></div>
                            <div>
                                <div className="flex justify-between items-end mb-1.5"><label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><PenTool size={14}/> Signature *</label><button onClick={clearSignature} type="button" className="text-[11px] text-slate-500 font-bold hover:text-slate-900 transition-colors bg-white px-2.5 py-1 rounded-md border border-slate-200 active:scale-95 shadow-sm">Clear Pad</button></div>
                                <SignaturePad ref={signaturePadRef} onBegin={() => setHasSignature(true)} containerClassName="border border-slate-200 rounded-2xl bg-slate-50 overflow-hidden touch-none relative shadow-inner" />
                                <p className="text-center text-[11px] text-slate-400 mt-2 font-bold uppercase tracking-widest">Sign clearly within the box above</p>
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Document Retention *</label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><div onClick={() => setRetentionFate('originator')} className={`p-4 border rounded-xl cursor-pointer transition-all active:scale-[0.98] ${retentionFate === 'originator' ? 'bg-emerald-50 border-emerald-500 shadow-sm' : 'bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-white'}`}><div className="flex items-center gap-3"><div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${retentionFate === 'originator' ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300 bg-white'}`}>{retentionFate === 'originator' && <div className="w-2 h-2 bg-white rounded-full"></div>}</div><div><p className={`font-bold text-sm sm:text-base ${retentionFate === 'originator' ? 'text-emerald-900' : 'text-slate-600'}`}>Return to Originator</p></div></div></div><div onClick={() => setRetentionFate('destination')} className={`p-4 border rounded-xl cursor-pointer transition-all active:scale-[0.98] ${retentionFate === 'destination' ? 'bg-emerald-50 border-emerald-500 shadow-sm' : 'bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-white'}`}><div className="flex items-center gap-3"><div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${retentionFate === 'destination' ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300 bg-white'}`}>{retentionFate === 'destination' && <div className="w-2 h-2 bg-white rounded-full"></div>}</div><div><p className={`font-bold text-sm sm:text-base ${retentionFate === 'destination' ? 'text-emerald-900' : 'text-slate-600'}`}>Retain at Office</p></div></div></div></div>
                            </div>
                            <div><label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Completion Remarks (Optional)</label><textarea value={completionRemarks} onChange={(e) => setCompletionRemarks(e.target.value)} placeholder="Add final notes or context for the archive..." className="w-full p-3.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-xl outline-none font-bold text-slate-900 text-sm sm:text-base min-h-[100px] resize-y transition-all" ></textarea></div>
                        </div>
                    )}

                    {activeAction === 'reject' && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
                            <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl text-rose-700 text-sm font-bold flex items-start gap-3">
                                <Ban size={20} className="shrink-0 mt-0.5" />
                                <p>{isLoadingOrigin ? <span className="animate-pulse">Locating originating office...</span> : <>This document will be automatically returned to <strong>{originOffice}</strong> for <strong>{originCreator}</strong>.</>}</p>
                            </div>
                            <div className="relative z-10">
                                <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Reason for Rejection (Optional)</label>
                                <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="E.g., Missing signature, incorrect attachments..." className="w-full p-3.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-red-500 focus:ring-4 focus:ring-red-500/10 rounded-xl outline-none font-bold text-slate-900 text-sm sm:text-base min-h-[140px] resize-y transition-all" ></textarea>
                            </div>
                        </div>
                    )}
                </div>

                {activeAction && (
                    <div className="bg-white p-4 sm:p-5 border-t border-slate-100 flex shrink-0">
                        {activeAction === 'route' && <button onClick={handleSaveRouting} disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl shadow-sm transition-all active:scale-[0.98] text-sm sm:text-base flex justify-center items-center gap-2 border border-blue-600 disabled:opacity-50">{isSubmitting ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : <><MapPin size={20} strokeWidth={2.5} /> Confirm Add Step</>}</button>}
                        {activeAction === 'complete' && <button onClick={confirmComplete} disabled={isSubmitting || isProcessingFile} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl shadow-sm transition-all active:scale-[0.98] text-sm sm:text-base flex items-center justify-center gap-2 border border-emerald-600 disabled:opacity-50">{isSubmitting ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : <><CheckCircle size={20} strokeWidth={3} /> Finalize Document</>}</button>}
                        {activeAction === 'reject' && <button onClick={handleReject} disabled={isSubmitting || isLoadingOrigin} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-xl shadow-sm transition-all active:scale-[0.98] text-sm sm:text-base flex items-center justify-center gap-2 border border-red-600 disabled:opacity-50">{isSubmitting ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : <><Ban size={20} strokeWidth={2.5} /> Confirm Return</>}</button>}
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}

function ActionCard({ title, description, icon, colorTheme, onClick }: { title: string; description: string; icon: React.ReactNode; colorTheme: 'blue' | 'emerald' | 'rose'; onClick: () => void; }) {
    const themeStyles = { blue: "hover:border-blue-300 hover:bg-blue-50/50 hover:shadow-sm", emerald: "hover:border-emerald-300 hover:bg-emerald-50/50 hover:shadow-sm", rose: "hover:border-rose-300 hover:bg-rose-50/50 hover:shadow-sm" };
    const iconStyles = { blue: "bg-blue-50 text-blue-600 border-blue-100", emerald: "bg-emerald-50 text-emerald-600 border-emerald-100", rose: "bg-rose-50 text-rose-600 border-rose-100" };
    const chevronStyles = { blue: "group-hover:text-blue-500 group-hover:translate-x-1", emerald: "group-hover:text-emerald-500 group-hover:translate-x-1", rose: "group-hover:text-rose-500 group-hover:translate-x-1" };
    return (
        <button onClick={onClick} className={`w-full text-left group bg-white border border-slate-200 p-4 sm:p-5 rounded-[1.25rem] transition-all duration-200 flex items-center gap-4 active:scale-[0.99] ${themeStyles[colorTheme]}`}>
            <div className={`p-3 rounded-xl border ${iconStyles[colorTheme]} transition-transform duration-300 group-hover:scale-110 shrink-0 shadow-sm`}>{icon}</div>
            <div className="flex-1 min-w-0 pr-2"><h5 className="font-black text-slate-900 text-base sm:text-lg leading-tight mb-0.5 truncate">{title}</h5><p className="text-xs sm:text-sm font-medium text-slate-500 leading-snug">{description}</p></div>
            <ChevronRight className={`text-slate-300 transition-all duration-300 shrink-0 ${chevronStyles[colorTheme]}`} size={20} />
        </button>
    );
}