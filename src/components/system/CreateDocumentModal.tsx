import React, { useState, useEffect, useRef } from 'react';
import { X, FileText, AlertCircle, Send, Hash, Camera, CheckCircle, Search, Loader2, Link as LinkIcon, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useUiStore } from '../../store/uiStore';
import { supabase } from '../../lib/supabase';
import DocumentScanner from './DocumentScanner';
import EmployeeSelect from '../ui/EmployeeSelect'; 
import DepartmentSelect from '../ui/DepartmentSelect'; 
import CategorySelect from '../ui/CategorySelect'; 

// --- Shared Modal Animation Styles ---
const modalAnimationStyles = `
    @keyframes iosSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
    @keyframes desktopZoomIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    @keyframes iosSlideDown { from { transform: translateY(0); } to { transform: translateY(100%); } }
    @keyframes desktopZoomOut { from { transform: scale(1); opacity: 1; } to { transform: scale(0.95); opacity: 0; } }
    @keyframes customFadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes customFadeOut { from { opacity: 1; } to { opacity: 0; } }
    
    .animate-overlay-fade { animation: customFadeIn 0.3s ease-out forwards; }
    .animate-overlay-fade-out { animation: customFadeOut 0.2s ease-in forwards; }
    .animate-responsive-modal { animation: iosSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    .animate-responsive-modal-close { animation: iosSlideDown 0.3s cubic-bezier(0.3, 0, 0.8, 0.15) forwards; }

    .custom-scrollbar::-webkit-scrollbar { width: 6px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 20px; }

    @media (min-width: 640px) {
        .animate-responsive-modal { animation: desktopZoomIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-responsive-modal-close { animation: desktopZoomOut 0.2s cubic-bezier(0.3, 0, 0.8, 0.15) forwards; }
    }
`;

function LinkedDocumentSelect({ value, onChange }: { value: string, onChange: (val: string) => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [docs, setDocs] = useState<{ reference_no: string; title: string }[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const searchDocs = async (term: string) => {
        if (!term.trim()) {
            setDocs([]);
            return;
        }
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('documents')
                .select('reference_no, title')
                .or(`reference_no.ilike.%${term}%,title.ilike.%${term}%`)
                .order('created_at', { ascending: false })
                .limit(10);
            
            if (error) throw error;
            setDocs(data || []);
        } catch (error) {
            console.error("Error searching documents:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            searchDocs(searchTerm);
        }, 300);
        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="relative w-full" ref={dropdownRef}>
            <label className="block text-xs sm:text-sm font-bold text-slate-900 mb-1.5 flex items-center gap-1.5">
                <LinkIcon size={16} className="text-blue-500" /> Linked Ref. No. (Optional)
            </label>
            <div className="relative">
                <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                    type="text"
                    value={isOpen ? searchTerm : value}
                    onChange={(e) => {
                        setSearchTerm(e.target.value);
                        onChange(e.target.value); 
                        if (!isOpen) setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    placeholder="Search Ref. No. or title to link..."
                    className="w-full pl-10 p-3 sm:p-3.5 bg-white border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-xl outline-none font-bold text-slate-900 text-sm sm:text-base transition-all"
                />
            </div>
            
            {isOpen && searchTerm.trim().length > 0 && (
                <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                    <div className="max-h-48 overflow-y-auto custom-scrollbar p-1.5">
                        {isLoading ? (
                            <div className="flex items-center justify-center p-4">
                                <Loader2 size={18} className="animate-spin text-blue-500" />
                            </div>
                        ) : docs.length === 0 ? (
                            <div className="p-3 text-sm text-slate-500 text-center font-medium">No matching documents found.</div>
                        ) : (
                            docs.map((doc) => (
                                <div 
                                    key={doc.reference_no}
                                    onClick={() => {
                                        onChange(doc.reference_no);
                                        setSearchTerm('');
                                        setIsOpen(false);
                                    }}
                                    className="p-3 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors border-b border-slate-100 last:border-0"
                                >
                                    <p className="text-xs font-mono font-bold text-slate-500">{doc.reference_no}</p>
                                    <p className="text-sm font-bold text-slate-900 truncate">{doc.title}</p>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function CreateDocumentModal() {
    const closeCreateModal = useUiStore((state: { closeCreateModal: () => void }) => state.closeCreateModal);
    
    const [isClosing, setIsClosing] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    
    const [currentUserName, setCurrentUserName] = useState<string>("");
    const [currentUserDept, setCurrentUserDept] = useState<string>("");

    const [attachment, setAttachment] = useState<File | Blob | null>(null);
    const [attachmentName, setAttachmentName] = useState<string>('');

    const [hasCopied, setHasCopied] = useState(false);

    const [formData, setFormData] = useState({
        trackingNumber: '', 
        title: '',
        category: '',
        parentDocRef: '', 
        destination: '',
        assignedClerk: '',
        isUrgent: false,
        remarks: ''
    });

    const fetchInitialData = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', session.user.id).single();
                if (profile?.full_name) {
                    setCurrentUserName(profile.full_name);
                    
                    const { data: empData } = await supabase.from('employees').select('department').eq('name', profile.full_name).single();
                    if (empData) {
                        setCurrentUserDept(empData.department);
                    }
                }
            }
        } catch (error) {
            console.error("Error fetching initial data:", error);
        }
    };

    useEffect(() => {
        fetchInitialData();
    }, []);

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => closeCreateModal(), 300); 
    };

    const handleScanComplete = (pdfBlob: Blob) => {
        setAttachment(pdfBlob);
        setAttachmentName(`Scanned_Doc_${formData.trackingNumber || 'New'}.pdf`);
        setIsScannerOpen(false);
    };

    const handleCategoryChange = (categoryName: string, prefix?: string | null) => {
        const year = new Date().getFullYear();
        const randomId = Math.floor(1000 + Math.random() * 9000);
        const finalPrefix = prefix || 'DOC'; 
        
        setFormData({
            ...formData,
            category: categoryName,
            trackingNumber: `${finalPrefix}-${year}-${randomId}`
        });
        setHasCopied(false);
    };

    const handleCopyRef = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (formData.trackingNumber) {
            navigator.clipboard.writeText(formData.trackingNumber);
            setHasCopied(true);
            toast.success("Ref. No. copied to clipboard!");
            setTimeout(() => setHasCopied(false), 2000);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.title.trim() || !formData.category || !formData.destination || !formData.trackingNumber) {
            toast.error('Please select a category, destination, and enter a title.');
            return;
        }

        if (!formData.assignedClerk && currentUserDept) { 
             toast.error('Please select an internal clerk to assign this to.');
             return;
        }

        setIsSubmitting(true);

        try {
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError || !user) {
                toast.error("Authentication Error", { description: "Your session is invalid or expired. Please log in again." });
                return;
            }

            let attachmentUrl = null;

            if (attachment) {
                const fileName = `${formData.trackingNumber}-${crypto.randomUUID()}.pdf`;
                
                const { error: uploadError } = await supabase.storage
                    .from('attachments')
                    .upload(fileName, attachment, { contentType: 'application/pdf' });

                if (uploadError) throw uploadError;

                const { data } = supabase.storage.from('attachments').getPublicUrl(fileName);
                attachmentUrl = data.publicUrl;
            }

            let initialStatus = 'routing';
            if (formData.assignedClerk && formData.assignedClerk !== currentUserName) {
                initialStatus = 'pending_receipt';
            }

            const { data: newDoc, error } = await supabase.from('documents').insert([{
                reference_no: formData.trackingNumber,
                title: formData.title.trim(),
                category: formData.category,
                parent_doc_ref: formData.parentDocRef.trim() || null, 
                final_destination: formData.destination,
                assigned_clerk: formData.assignedClerk || null,
                is_urgent: formData.isUrgent,
                remarks: formData.remarks.trim(),
                created_by: user.id, 
                attachment_url: attachmentUrl,
                status: initialStatus
            }]).select().single();

            if (error) throw error;

            await supabase.from('document_logs').insert([{
                document_id: newDoc.id,
                action: 'Document Logged',
                location: currentUserDept || 'Originating Office',
                assigned_to: formData.assignedClerk || null, 
                attachment_url: attachmentUrl,
                created_by: user.id 
            }]);

            toast.success('Document Routed Successfully!', { description: `Ref. No: ${formData.trackingNumber}` });
            
            handleClose();

        } catch (error: unknown) {
            console.error("Submit Error:", error);
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
            toast.error('Failed to route document', { description: errorMessage });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-sm transition-all ${isClosing ? 'animate-overlay-fade-out' : 'animate-overlay-fade'}`}>
            <style>{modalAnimationStyles}</style>
            
            <div className={`bg-white w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden shadow-2xl rounded-t-[1.5rem] sm:rounded-3xl transition-all duration-300 ease-in-out ${isClosing ? 'animate-responsive-modal-close' : 'animate-responsive-modal'}`}>
                
                <div className="bg-slate-900 text-white relative flex flex-col shrink-0">
                    <div className="w-16 h-1.5 bg-white/30 rounded-full mx-auto mt-3 sm:hidden shrink-0"></div>
                    <div className="p-5 pt-3 sm:p-6 flex items-center justify-between">
                        <h3 className="font-black text-xl flex items-center gap-2 mt-2 sm:mt-0">
                            <FileText size={22} className="text-blue-400" /> Route Document
                        </h3>
                        <button type="button" onClick={handleClose} disabled={isSubmitting} className="p-2 -mr-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors active:scale-95 disabled:opacity-50">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar p-5 sm:p-8 bg-white">
                    <div className="space-y-6">

                        <div className="relative z-50">
                            <CategorySelect 
                                value={formData.category}
                                onChange={handleCategoryChange}
                                isRelative={true}
                            />
                        </div>

                        <div className={`border-2 p-3 sm:p-4 rounded-xl flex items-center justify-between shadow-sm transition-all ${formData.trackingNumber ? 'bg-orange-50 border-orange-200' : 'bg-slate-50 border-slate-200 border-dashed'}`}>
                            <div>
                                <p className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider mb-0.5 ${formData.trackingNumber ? 'text-orange-700' : 'text-slate-400'}`}>Ref. No.</p>
                                {formData.trackingNumber ? (
                                    <p className="font-mono text-base sm:text-lg font-black text-slate-900 tracking-widest animate-in fade-in">{formData.trackingNumber}</p>
                                ) : (
                                    <p className="font-mono text-xs sm:text-sm font-bold text-slate-400 italic">Select a category to generate...</p>
                                )}
                            </div>
                            
                            {formData.trackingNumber ? (
                                <button 
                                    type="button"
                                    onClick={handleCopyRef}
                                    className={`p-2.5 rounded-xl transition-all border active:scale-95 shrink-0 ${hasCopied ? 'bg-emerald-50 border-emerald-200 text-emerald-600 shadow-sm' : 'bg-white border-orange-200 text-orange-500 hover:text-orange-600 hover:bg-orange-100 shadow-sm'}`}
                                    title="Copy to clipboard"
                                >
                                    {hasCopied ? <Check size={18} strokeWidth={3} /> : <Copy size={18} strokeWidth={2.5} />}
                                </button>
                            ) : (
                                <Hash className="text-slate-300" size={24} />
                            )}
                        </div>

                        <div>
                            <label className="block text-xs sm:text-sm font-bold text-slate-900 mb-1.5">Document Subject / Title *</label>
                            <input 
                                type="text" 
                                value={formData.title}
                                onChange={(e) => setFormData({...formData, title: e.target.value})}
                                placeholder="e.g. Budget Request for Q3" 
                                className="w-full p-3 sm:p-3.5 bg-white border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-xl outline-none font-bold text-slate-900 text-sm sm:text-base transition-all" 
                            />
                        </div>

                        <div className="relative z-40">
                            <LinkedDocumentSelect 
                                value={formData.parentDocRef}
                                onChange={(val: string) => setFormData({...formData, parentDocRef: val})}
                            />
                        </div>

                        <div>
                            <label className="block text-xs sm:text-sm font-bold text-slate-900 mb-1.5">Scanned Attachment (Optional)</label>
                            {attachment ? (
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-emerald-50 border-2 border-emerald-300 rounded-xl gap-3">
                                    <div className="flex items-center gap-3">
                                        <CheckCircle className="text-emerald-600 shrink-0" size={24} />
                                        <div>
                                            <p className="text-sm font-bold text-slate-900 truncate max-w-[220px]">{attachmentName}</p>
                                            <p className="text-xs text-slate-500 font-mono">{(attachment.size / 1024).toFixed(1)} KB PDF</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3 sm:gap-2 justify-end mt-2 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-0 border-emerald-200/50">
                                        <button 
                                            type="button" 
                                            onClick={() => setIsScannerOpen(true)} 
                                            className="text-xs font-bold text-blue-600 hover:underline px-2 py-1"
                                        >
                                            Re-scan
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={() => { setAttachment(null); setAttachmentName(''); }} 
                                            className="text-xs font-bold text-red-600 hover:underline px-2 py-1"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setIsScannerOpen(true)}
                                    className="w-full py-5 border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl flex flex-col items-center justify-center text-slate-600 hover:text-blue-600 hover:bg-blue-50/40 transition-all cursor-pointer active:scale-[0.99]"
                                >
                                    <Camera size={26} className="mb-2" />
                                    <span className="text-sm font-bold">Open Document Scanner</span>
                                    <span className="text-xs text-slate-400 font-medium">Scan single or multi-page documents</span>
                                </button>
                            )}
                        </div>

                        <div className="p-5 rounded-[1.25rem] border-2 border-slate-100 bg-slate-50/50 space-y-5">
                            <div className="relative z-20">
                                <DepartmentSelect 
                                    value={formData.destination} 
                                    onChange={(val: string) => setFormData({...formData, destination: val})} 
                                    isRelative={true} 
                                    label="Final Destination" 
                                />
                            </div>
                            <div className="relative z-10">
                                <EmployeeSelect
                                    value={formData.assignedClerk}
                                    onChange={(val: string) => setFormData({...formData, assignedClerk: val})}
                                    departmentFilter={currentUserDept} 
                                    isRelative={true}
                                />
                            </div>
                        </div>

                        <div className={`p-4 border-2 rounded-xl flex items-center justify-between transition-colors cursor-pointer active:scale-[0.99] ${formData.isUrgent ? 'bg-red-50 border-red-300 shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300'}`} onClick={() => setFormData({...formData, isUrgent: !formData.isUrgent})}>
                            <div>
                                <h4 className={`font-black text-sm sm:text-base flex items-center gap-2 ${formData.isUrgent ? 'text-red-700' : 'text-slate-800'}`}>
                                    <AlertCircle size={16} strokeWidth={2.5} /> Mark as Priority / RUSH
                                </h4>
                                <p className={`text-[11px] sm:text-xs font-medium mt-0.5 ${formData.isUrgent ? 'text-red-600' : 'text-slate-500'}`}>Flags this document in red for all receiving offices.</p>
                            </div>
                            <div className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200 ease-in-out focus:outline-none ${formData.isUrgent ? 'bg-red-600 border-red-700' : 'bg-slate-300 border-slate-400'}`}>
                                <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out mt-[2px] ml-[2px] ${formData.isUrgent ? 'translate-x-5' : 'translate-x-0'}`} />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs sm:text-sm font-bold text-slate-900 mb-1.5">Initial Remarks / Notes (Optional)</label>
                            <textarea 
                                value={formData.remarks}
                                onChange={(e) => setFormData({...formData, remarks: e.target.value})}
                                placeholder="Add any instructions for the receiving office..." 
                                className="w-full p-3 sm:p-3.5 bg-white border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-xl outline-none font-bold text-slate-900 text-sm sm:text-base min-h-[100px] resize-y transition-all" 
                            ></textarea>
                        </div>
                    </div>
                </form>

                <div className="bg-slate-50 p-4 sm:p-5 border-t-2 border-slate-200 flex gap-3 shrink-0">
                    <button type="button" disabled={isSubmitting} onClick={handleClose} className="flex-1 py-3.5 bg-white border-2 border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-xl active:scale-95 transition-all text-sm sm:text-base disabled:opacity-50 shadow-sm">
                        Cancel
                    </button>
                    <button type="submit" disabled={isSubmitting} onClick={handleSubmit} className="flex-[1.5] py-3.5 bg-blue-600 border-2 border-blue-700 text-white font-bold rounded-xl active:scale-95 transition-all text-sm sm:text-base flex justify-center items-center gap-2 disabled:opacity-50 shadow-sm hover:bg-blue-700">
                        {isSubmitting ? (
                            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        ) : (
                            <><Send size={18} strokeWidth={2.5} /> Route Document</>
                        )}
                    </button>
                </div>
            </div>
            
            {isScannerOpen && (
                <DocumentScanner
                    onScanComplete={handleScanComplete}
                    onClose={() => setIsScannerOpen(false)}
                />
            )}
        </div>
    );
}