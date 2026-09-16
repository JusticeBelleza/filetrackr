import { useState, useEffect } from 'react';
import { Network, FileText, Eye, Loader2, Link as LinkIcon, Folder } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatPHDateTime } from '../../lib/utils';
import type { DocumentItem } from '../../types/processing';

interface LinkedDocumentsModalProps {
    isOpen: boolean;
    onClose: () => void;
    targetRef: string; 
    onPreview: (url: string) => void;
}

export default function LinkedDocumentsModal({ isOpen, onClose, targetRef, onPreview }: LinkedDocumentsModalProps) {
    const [isClosing, setIsClosing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [motherDoc, setMotherDoc] = useState<DocumentItem | null>(null);
    const [childDocs, setChildDocs] = useState<DocumentItem[]>([]);

    useEffect(() => {
        if (!isOpen || !targetRef) return;

        let isMounted = true;
        
        const fetchDocumentFamily = async () => {
            setIsLoading(true);
            try {
                const { data: parentData, error: parentError } = await supabase
                    .from('documents')
                    .select('*')
                    .eq('reference_no', targetRef)
                    .single();
                
                if (parentError && parentError.code !== 'PGRST116') throw parentError; 

                const { data: childData, error: childError } = await supabase
                    .from('documents')
                    .select('*')
                    .eq('parent_doc_ref', targetRef)
                    .order('created_at', { ascending: true });

                if (childError) throw childError;

                if (isMounted) {
                    setMotherDoc(parentData || null);
                    setChildDocs(childData || []);
                }
            } catch (error) {
                console.error("Error fetching linked documents:", error);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        fetchDocumentFamily();

        return () => { isMounted = false; };
    }, [isOpen, targetRef]);

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => {
            setIsClosing(false);
            onClose();
        }, 300);
    };

    if (!isOpen) return null;

    return (
        <div className={`fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-sm transition-all ${isClosing ? 'animate-overlay-fade-out' : 'animate-overlay-fade'}`}>
            <div className={`bg-slate-50 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl rounded-t-[1.5rem] sm:rounded-3xl transition-all duration-300 ease-in-out ${isClosing ? 'animate-responsive-modal-close' : 'animate-responsive-modal'}`}>
                
                {/* Clean, Centered Header */}
                <div className="bg-slate-900 text-white p-5 sm:p-6 flex items-center justify-center shrink-0">
                    <h3 className="font-black text-lg sm:text-xl flex items-center gap-2.5 tracking-wide">
                        <Network size={22} className="text-blue-400" /> Document Family
                    </h3>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 sm:p-8">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <Loader2 size={32} className="animate-spin text-blue-500 mb-4" />
                            <p className="text-slate-500 font-bold">Assembling document relationships...</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Mother Document Section */}
                            <div className="space-y-3 relative z-10">
                                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <Folder size={14} /> Mother Document
                                </h4>
                                {motherDoc ? (
                                    <DocListItem doc={motherDoc} isMother={true} onPreview={onPreview} />
                                ) : (
                                    <div className="p-4 bg-white rounded-xl border border-slate-200 border-dashed text-center">
                                        <p className="text-sm font-bold text-slate-400 italic">Originating document not found.</p>
                                    </div>
                                )}
                            </div>

                            {/* Child Documents Section */}
                            <div className="relative">
                                {/* Thin vertical connector line - Darkened to slate-300 */}
                                <div className="absolute left-6 -top-8 bottom-8 w-px bg-slate-300 z-0"></div>
                                
                                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 pl-[42px] relative z-10 mb-3 mt-4">
                                    <LinkIcon size={14} className="text-slate-300" /> Attached Transactions
                                </h4>
                                
                                <div className="space-y-3 pl-[42px] relative z-10">
                                    {childDocs.length > 0 ? (
                                        childDocs.map((child) => (
                                            <div key={child.id} className="relative">
                                                {/* Thin horizontal connector line - Darkened to slate-300 */}
                                                <div className="absolute -left-[18px] top-1/2 w-[18px] h-px bg-slate-300"></div>
                                                <DocListItem doc={child} isMother={false} onPreview={onPreview} />
                                            </div>
                                        ))
                                    ) : (
                                        <div className="p-4 bg-white rounded-xl border border-slate-200 border-dashed text-center">
                                            <p className="text-sm font-bold text-slate-400 italic">No attached documents found.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                
                {/* Footer - Upgraded to a solid, colored button */}
                <div className="bg-white p-5 border-t border-slate-200 flex shrink-0">
                    <button onClick={handleClose} className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl active:scale-95 transition-all text-sm sm:text-base shadow-md">
                        Close View
                    </button>
                </div>
            </div>
        </div>
    );
}

// Flat, professional list item
function DocListItem({ doc, isMother, onPreview }: { doc: DocumentItem, isMother: boolean, onPreview: (url: string) => void }) {
    return (
        <div className={`p-4 rounded-2xl border flex items-center gap-4 bg-white transition-all ${isMother ? 'border-blue-200' : 'border-slate-200'}`}>
            <div className={`w-11 h-11 rounded-xl shrink-0 flex items-center justify-center ${isMother ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-400'}`}>
                <FileText size={20} />
            </div>
            
            <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-slate-500 mb-0.5">{doc.reference_no}</p>
                <p className="font-bold text-slate-900 text-sm sm:text-base truncate">{doc.title || doc.subject}</p>
                <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[9px] font-bold text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded uppercase tracking-wider">
                        {doc.status.replace('_', ' ')}
                    </span>
                    <span className="text-[10px] font-medium text-slate-500">
                        {formatPHDateTime(doc.created_at)}
                    </span>
                </div>
            </div>

            {doc.attachment_url && (
                <button 
                    onClick={() => onPreview(doc.attachment_url as string)} 
                    className="shrink-0 p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 bg-white rounded-xl transition-all border border-transparent hover:border-blue-200 active:scale-95"
                    title="View Attached File"
                >
                    <Eye size={18} />
                </button>
            )}
        </div>
    );
}