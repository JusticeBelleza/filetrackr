import { useState, useEffect } from 'react';
import { Network, Eye, Loader2, Link as LinkIcon, Folder, FolderOpen, Clock, AlertCircle, Handshake, CheckCircle, Ban, Activity } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatPHDateTime } from '../../lib/utils';
import type { DocumentItem } from '../../types/processing';

interface LinkedDocumentsModalProps {
    isOpen: boolean;
    onClose: () => void;
    targetRef: string; 
    onPreview: (url: string) => void;
}

// Internal tree structure for N-level nesting
interface DocNode {
    doc: DocumentItem;
    children: DocNode[];
}

export default function LinkedDocumentsModal({ isOpen, onClose, targetRef, onPreview }: LinkedDocumentsModalProps) {
    const [isClosing, setIsClosing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [treeRoot, setTreeRoot] = useState<DocNode | null>(null);

    useEffect(() => {
        if (!isOpen || !targetRef) return;

        let isMounted = true;
        
        const fetchDocumentFamilyTree = async () => {
            setIsLoading(true);
            try {
                // STEP 1: Climb UP to find the absolute root (Mother Document)
                let currentRef = targetRef;
                let rootDocData: DocumentItem | null = null;
                let depthGuard = 0;
                
                while (currentRef && depthGuard < 15) {
                    depthGuard++;
                    const { data, error } = await supabase
                        .from('documents')
                        .select('*')
                        .eq('reference_no', currentRef)
                        .single();
                        
                    if (error && error.code !== 'PGRST116') throw error;
                    if (!data) break;
                    
                    rootDocData = data;
                    
                    // If it has a parent, keep climbing. If not, this is the root.
                    if (data.parent_doc_ref) {
                        currentRef = data.parent_doc_ref;
                    } else {
                        break; 
                    }
                }

                if (!rootDocData) {
                    if (isMounted) setIsLoading(false);
                    return;
                }

                // STEP 2: Breadth-First Search to fetch ALL descendants
                const allDocsMap = new Map<string, DocumentItem>();
                allDocsMap.set(rootDocData.reference_no as string, rootDocData);
                
                let parentRefsToSearch = [rootDocData.reference_no as string];
                depthGuard = 0;
                
                while (parentRefsToSearch.length > 0 && depthGuard < 15) {
                    depthGuard++;
                    const { data: childrenData, error: childrenError } = await supabase
                        .from('documents')
                        .select('*')
                        .in('parent_doc_ref', parentRefsToSearch)
                        .order('created_at', { ascending: true });
                        
                    if (childrenError) throw childrenError;
                    if (!childrenData || childrenData.length === 0) break;
                    
                    parentRefsToSearch = [];
                    for (const child of childrenData) {
                        if (child.reference_no && !allDocsMap.has(child.reference_no)) {
                            allDocsMap.set(child.reference_no, child);
                            parentRefsToSearch.push(child.reference_no);
                        }
                    }
                }

                // STEP 3: Recursively build the tree structure
                const buildTree = (doc: DocumentItem): DocNode => {
                    const childrenDocs = Array.from(allDocsMap.values()).filter(d => d.parent_doc_ref === doc.reference_no);
                    return {
                        doc,
                        children: childrenDocs.map(c => buildTree(c))
                    };
                };

                if (isMounted) {
                    setTreeRoot(buildTree(rootDocData));
                }
            } catch (error) {
                console.error("Error fetching linked documents:", error);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        fetchDocumentFamilyTree();

        return () => { isMounted = false; };
    }, [isOpen, targetRef]);

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => {
            setIsClosing(false);
            onClose();
        }, 300);
    };

    // Mathematical N-Level Rendering
    const renderNode = (node: DocNode, depth: number, isLast: boolean = true) => {
        const isRoot = depth === 0;
        const hasChildren = node.children.length > 0;
        const isCurrentTarget = node.doc.reference_no === targetRef;

        if (isRoot) {
            return (
                <div key={node.doc.id} className="relative">
                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-3">
                        <Folder size={14} /> Mother Document
                    </h4>
                    
                    <div className="relative z-10">
                        <DocListItem doc={node.doc} isCurrentTarget={isCurrentTarget} onPreview={onPreview} />
                    </div>

                    {hasChildren && (
                        <div className="relative mt-3">
                            {/* Spine covering the gap from Root to first child */}
                            <div className="absolute left-[23px] top-[-12px] h-[52px] w-[2px] bg-slate-300 z-0"></div>
                            
                            <div className="ml-[48px] mb-3 flex items-center gap-1.5 text-slate-400 relative z-10 bg-slate-50 py-0.5 w-max pr-2">
                                <LinkIcon size={14} />
                                <h4 className="text-[11px] font-black uppercase tracking-widest">
                                    Attached Transactions
                                </h4>
                            </div>
                            
                            <div className="flex flex-col">
                                {node.children.map((child, index) => renderNode(child, depth + 1, index === node.children.length - 1))}
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        // --- NON-ROOT NODES (Children) ---
        return (
            <div key={node.doc.id} className="relative mt-4 flex">
                
                {/* Connector Column (48px wide) */}
                <div className="relative w-[48px] shrink-0">
                    {/* The Elbow (Top Spine + Horizontal Link) */}
                    <div className="absolute left-[23px] top-[-16px] w-[25px] h-[32px] border-l-2 border-b-2 border-slate-300 rounded-bl-md z-0"></div>
                    
                    {/* The Continuation Spine (Drops down to next sibling) */}
                    {!isLast && (
                        <div className="absolute left-[23px] top-[14px] bottom-[-16px] w-[2px] bg-slate-300 z-0"></div>
                    )}
                </div>
                
                {/* Node Content (Card + Its Children) */}
                <div className="flex-1 min-w-0">
                    <div className="relative z-10">
                        <DocListItem doc={node.doc} isCurrentTarget={isCurrentTarget} onPreview={onPreview} />
                    </div>

                    {hasChildren && (
                        <div className="flex flex-col">
                            {node.children.map((child, index) => renderNode(child, depth + 1, index === node.children.length - 1))}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    if (!isOpen) return null;

    return (
        <div className={`fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-sm transition-all ${isClosing ? 'animate-overlay-fade-out' : 'animate-overlay-fade'}`}>
            <div className={`bg-slate-50 w-full max-w-2xl h-[65vh] sm:h-[60vh] flex flex-col overflow-hidden shadow-2xl rounded-t-[1.5rem] sm:rounded-3xl transition-all duration-300 ease-in-out ${isClosing ? 'animate-responsive-modal-close' : 'animate-responsive-modal'}`}>
                
                {/* Clean, Centered Header */}
                <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-center shrink-0">
                    <h3 className="font-black text-lg flex items-center gap-2.5 tracking-wide">
                        <Network size={20} className="text-blue-400" /> Document Family
                    </h3>
                </div>

                {/* Status Legend (Sticky below header) */}
                <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-center gap-3 sm:gap-5 shadow-sm shrink-0">
                    <div className="flex items-center gap-1 text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                        <AlertCircle size={13} className="text-amber-500" /> Pending
                    </div>
                    <div className="flex items-center gap-1 text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                        <Handshake size={13} className="text-emerald-600" /> Received
                    </div>
                    <div className="flex items-center gap-1 text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                        <Activity size={13} className="text-blue-500" /> Routing
                    </div>
                    <div className="flex items-center gap-1 text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                        <CheckCircle size={13} className="text-emerald-500" /> Sealed
                    </div>
                    <div className="flex items-center gap-1 text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                        <Ban size={13} className="text-rose-500" /> Voided
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-5 sm:p-7">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-12 h-full">
                            <Loader2 size={32} className="animate-spin text-blue-500 mb-4" />
                            <p className="text-slate-500 font-bold">Tracing document lineage...</p>
                        </div>
                    ) : treeRoot ? (
                        renderNode(treeRoot, 0)
                    ) : (
                        <div className="p-4 bg-white rounded-xl border border-slate-200 border-dashed text-center">
                            <p className="text-sm font-bold text-slate-400 italic">Document family not found.</p>
                        </div>
                    )}
                </div>
                
                {/* Footer */}
                <div className="bg-white p-4 sm:p-5 border-t border-slate-200 flex shrink-0">
                    <button onClick={handleClose} className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl active:scale-95 transition-all text-sm shadow-md">
                        Close View
                    </button>
                </div>
            </div>
        </div>
    );
}

// Flat, professional folder-style list item
function DocListItem({ doc, isCurrentTarget, onPreview }: { doc: DocumentItem, isCurrentTarget: boolean, onPreview: (url: string) => void }) {
    
    // Smart Category Length Formatter
    let displayCategory = doc.category || 'DOCUMENT';
    if (displayCategory.length > 22 && doc.reference_no) {
        const extractedPrefix = doc.reference_no.split('-')[0];
        if (extractedPrefix && extractedPrefix.length <= 10) {
            displayCategory = extractedPrefix;
        }
    }

    const theme = isCurrentTarget ? {
        bg: "bg-blue-50/50",
        border: "border-blue-300",
        tabText: "text-blue-800",
        title: "text-blue-900"
    } : {
        bg: "bg-white",
        border: "border-slate-200",
        tabText: "text-slate-600",
        title: "text-slate-800"
    };

    const getStatusIcon = (status: string) => {
        switch(status) {
            case 'pending': return <AlertCircle size={16} className="text-amber-500" />;
            case 'pending_receipt': return <Handshake size={16} className="text-emerald-600" />;
            case 'routing': return <Activity size={16} className="text-blue-500" />;
            case 'sealed': return <CheckCircle size={16} className="text-emerald-500" />;
            case 'cancelled': return <Ban size={16} className="text-rose-500" />;
            default: return <CheckCircle size={16} className="text-slate-400" />;
        }
    };

    return (
        <div className={`flex flex-col relative group transition-all duration-200 z-10 ${isCurrentTarget ? 'drop-shadow-sm scale-[1.01]' : ''}`}>
            
            {/* FOLDER TAB: Category | Doc Number */}
            <div className="flex items-end pl-0">
                <div className={`px-3 py-1 border-t-2 border-l-2 border-r-2 border-b-0 rounded-t-md z-10 relative -mb-[2px] flex items-center gap-2 ${theme.bg} ${theme.border} max-w-[95%]`}>
                    <div className="flex items-center gap-1.5 truncate">
                        <FolderOpen size={12} className={`shrink-0 ${theme.tabText}`} strokeWidth={2.5} />
                        <span className={`text-[10px] font-black uppercase tracking-wider truncate ${theme.tabText}`} title={doc.category}>
                            {displayCategory}
                        </span>
                    </div>
                    <span className={`text-[10px] font-bold border-l pl-2 ml-0.5 ${theme.tabText} border-${theme.tabText.split('-')[1]}-200/50`}>
                        {doc.reference_no}
                    </span>
                </div>
            </div>

            {/* FOLDER BODY */}
            <div className={`border-2 rounded-b-lg rounded-tr-lg rounded-tl-none relative z-0 flex flex-col p-3.5 sm:p-4 ${theme.bg} ${theme.border}`}>
                
                <div className="flex items-start justify-between gap-3 mb-1.5">
                    <h4 className={`font-bold text-sm sm:text-[15px] leading-snug w-full pr-2 line-clamp-2 ${theme.title}`} title={doc.title || doc.subject}>
                        {doc.title || doc.subject}
                    </h4>
                    
                    {/* Status Icon Wrapper (Tooltip applied here to satisfy TypeScript) */}
                    <div 
                        className="shrink-0 flex items-center justify-center p-1.5 bg-white rounded-lg shadow-sm border border-slate-100 cursor-help"
                        title={doc.status.replace('_', ' ').toUpperCase()}
                    >
                        {getStatusIcon(doc.status)}
                    </div>
                </div>
                
                <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] font-medium text-slate-500 flex items-center gap-1.5">
                        <Clock size={12} />
                        {formatPHDateTime(doc.created_at)}
                    </span>
                    
                    <div className="flex items-center gap-2">
                        {isCurrentTarget && (
                            <span className="text-[9px] font-black text-white bg-blue-500 px-1.5 py-[2px] rounded uppercase tracking-widest shadow-sm">
                                Current
                            </span>
                        )}
                        {doc.attachment_url && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); onPreview(doc.attachment_url as string); }} 
                                className={`shrink-0 p-1.5 rounded-lg transition-all active:scale-95 ${
                                    isCurrentTarget ? 'bg-blue-100 text-blue-600 hover:bg-blue-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                }`}
                                title="View Attached File"
                            >
                                <Eye size={14} strokeWidth={2.5} />
                            </button>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}