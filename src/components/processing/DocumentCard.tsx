import { useState, useEffect } from 'react';
import { AlertCircle, MapPin, Eye, Clock, ChevronRight, User, MessageSquareWarning, CheckSquare, Square, ChevronDown, UserPlus, Ban, Check, X, Zap, Link as LinkIcon, FolderOpen, Handshake } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatPHDateTime } from '../../lib/utils';
import type { DocumentItem } from '../../types/processing';

interface DocumentCardProps {
    doc: DocumentItem & { has_children?: boolean };
    activeTab: 'processing' | 'returned';
    isSelected: boolean;
    isExpanded: boolean;
    showCheckbox: boolean;
    currentUserName: string;
    currentUserId: string;
    onToggleSelection: (doc: DocumentItem) => void;
    onToggleCollapse: (id: string) => void;
    onPreview: (url: string) => void;
    onTrack: (doc: DocumentItem) => void;
    onReassign: (doc: DocumentItem) => void;
    onCancel?: (doc: DocumentItem) => void;
    onRevise?: (doc: DocumentItem) => void;
    onAction?: (doc: DocumentItem) => void;
    onReceive?: (doc: DocumentItem) => void; 
    onDecline?: (doc: DocumentItem) => void; 
    onViewLinked?: (doc: DocumentItem) => void;
}

export default function DocumentCard({
    doc, activeTab, isSelected, isExpanded, showCheckbox, currentUserName, currentUserId,
    onToggleSelection, onToggleCollapse, onPreview, onTrack, onReassign, onCancel, onRevise, onAction, onReceive, onDecline, onViewLinked
}: DocumentCardProps) {
    
    const [localDoc, setLocalDoc] = useState(doc);
    useEffect(() => {
        setLocalDoc(doc);
    }, [doc]);

    const isManager = localDoc.assigned_clerk === currentUserName;
    const isCreator = localDoc.created_by === currentUserId;
    const canReassign = isManager || isCreator;
    const canRevise = isManager || isCreator;
    
    // --- Determine if the document was self-assigned ---
    const isSelfAssigned = isCreator && isManager;

    // --- Smart Category Length Formatter ---
    let displayCategory = localDoc.category || 'DOCUMENT';
    if (displayCategory.length > 22 && localDoc.reference_no) {
        const extractedPrefix = localDoc.reference_no.split('-')[0];
        if (extractedPrefix && extractedPrefix.length <= 10) {
            displayCategory = extractedPrefix;
        }
    }

    // --- Aging & Time Calculation ---
    const start = new Date(localDoc.updated_at || localDoc.created_at);
    const end = new Date();
    let totalWorkingMs = 0;
    
    if (end > start) {
        let current = new Date(start);
        while (current < end) {
            const dayOfWeek = current.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const nextMidnight = new Date(current);
            nextMidnight.setHours(24, 0, 0, 0);
            const nextStep = nextMidnight < end ? nextMidnight : end;
            const timeDiff = nextStep.getTime() - current.getTime();

            if (!isWeekend) {
                totalWorkingMs += timeDiff;
            }
            current = nextStep;
        }
    }

    const diffHours = totalWorkingMs / (1000 * 60 * 60); 
    const days = Math.floor(diffHours / 24); 
    const remainingHrs = Math.floor(diffHours % 24);
    const displayTime = `${days.toString().padStart(2, '0')}d:${remainingHrs.toString().padStart(2, '0')}h`;
    
    let agingColorTheme = "bg-white text-slate-600 border-slate-200"; 
    if (diffHours >= 72) { agingColorTheme = "bg-rose-100 text-rose-700 border-rose-300 animate-pulse"; } 
    else if (diffHours >= 48) { agingColorTheme = "bg-amber-100 text-amber-700 border-amber-300"; }

    // --- Dynamic Folder Themes ---
    let folderTheme = {
        bg: "bg-[#fef9c3]", 
        border: "border-yellow-300",
        tabText: "text-yellow-800",
        hover: "hover:border-yellow-400"
    };

    if (activeTab === 'returned') {
        folderTheme = {
            bg: "bg-orange-50",
            border: "border-orange-300",
            tabText: "text-orange-800",
            hover: "hover:border-orange-400"
        };
    } else if (localDoc.is_urgent) {
        folderTheme = {
            bg: "bg-rose-50",
            border: "border-rose-300",
            tabText: "text-rose-800",
            hover: "hover:border-rose-400"
        };
    } else if (isSelected) {
         folderTheme = {
            bg: "bg-blue-50",
            border: "border-blue-300",
            tabText: "text-blue-800",
            hover: "hover:border-blue-400"
        };
    }

    return (
        <div className={`flex flex-col mt-4 group drop-shadow-sm transition-all duration-200 ${isSelected ? 'scale-[1.01]' : ''}`}>
            
            {/* --- FOLDER TAB (CATEGORY & TIME) --- */}
            <div className="flex items-end pl-0">
                 <div className={`px-3 py-1.5 border-t-2 border-l-2 border-r-2 border-b-0 rounded-t-lg z-10 relative -mb-[2px] flex items-center gap-2.5 ${folderTheme.bg} ${folderTheme.border} transition-colors max-w-[95%]`}>
                     <div className="flex items-center gap-1.5 truncate">
                         <FolderOpen size={12} className={`shrink-0 ${folderTheme.tabText}`} strokeWidth={2.5} />
                         <span 
                            className={`text-[10px] font-black uppercase tracking-wider truncate ${folderTheme.tabText}`}
                            title={localDoc.category} 
                         >
                             {displayCategory}
                         </span>
                     </div>
                     <div className={`px-1.5 py-[2px] rounded border flex items-center gap-1 shadow-sm shrink-0 ${agingColorTheme}`}>
                         <Clock size={10} strokeWidth={2.5} />
                         <span className="text-[9px] font-black tracking-widest font-mono">{displayTime}</span>
                     </div>
                 </div>
            </div>

            {/* --- FOLDER BODY --- */}
            <div className={`flex-1 border-2 rounded-b-xl rounded-tr-xl rounded-tl-none relative z-0 transition-colors flex flex-col ${folderTheme.bg} ${folderTheme.border} ${folderTheme.hover}`}>
                
                {/* 
                  ========================================
                  TAB CONTENT: RETURNED
                  ========================================
                */}
                {activeTab === 'returned' ? (
                    <div className="p-5 flex-1 flex flex-col">
                        {/* ROW 1: Doc # | Action Icons */}
                        <div className="flex justify-between items-start mb-2 gap-2">
                            <span className="text-[11px] font-bold text-slate-600 bg-white/70 px-2 py-0.5 rounded font-mono border border-white/50 shrink-0 uppercase tracking-wider shadow-sm">
                                {localDoc.reference_no || localDoc.id.substring(0, 8)}
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                                <span className="flex items-center gap-1 text-[10px] font-black text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full border border-amber-200 uppercase tracking-wider shadow-sm">
                                    <AlertCircle size={12} strokeWidth={3}/> Needs Revision
                                </span>
                                {(localDoc.parent_doc_ref || localDoc.has_children) && (
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onViewLinked?.(localDoc); }} 
                                        className="w-[22px] h-[22px] flex items-center justify-center bg-blue-100 text-blue-700 border border-blue-200 rounded-md shadow-sm hover:bg-blue-200 transition-colors shrink-0" 
                                        title="View Document Family"
                                    >
                                        <LinkIcon size={12} strokeWidth={3} />
                                    </button>
                                )}
                            </div>
                        </div>
                        
                        {/* ROW 2: Title */}
                        <h4 className="font-black text-lg text-slate-900 mb-1.5 leading-tight group-hover:text-orange-700 transition-colors">
                            {localDoc.title || localDoc.subject}
                        </h4>
                        
                        <div className="flex items-center gap-1.5 mb-4">
                            <User size={14} className="text-orange-900/50" />
                            <p className="text-[11px] font-bold text-orange-900/60 uppercase tracking-wider">
                                Managed by: <span className="text-orange-950">{localDoc.assigned_clerk || 'Unassigned'}</span>
                            </p>
                        </div>
                        
                        <div className="bg-white/60 rounded-xl p-4 border border-orange-200/50 mb-5 relative shadow-sm">
                            <div className="flex items-center gap-1.5 mb-1.5 text-orange-800">
                                <MessageSquareWarning size={14} />
                                <p className="text-[10px] font-black uppercase tracking-wider">Reason for Return</p>
                            </div>
                            <p className="text-sm text-orange-950 font-medium leading-relaxed">{localDoc.remarks}</p>
                        </div>

                        <div className="flex items-center gap-1.5 mb-5 mt-auto">
                            <Clock size={14} className="text-orange-900/50" />
                            <p className="text-[10px] font-bold text-orange-900/60 uppercase tracking-wider">
                                Returned {formatPHDateTime(localDoc.updated_at || localDoc.created_at)}
                            </p>
                        </div>
                        
                        <div className="flex flex-col gap-2 mt-auto">
                            <div className="flex gap-2">
                                {localDoc.attachment_url && (
                                    <button onClick={() => onPreview(localDoc.attachment_url as string)} className="shrink-0 py-2.5 px-3 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl flex items-center justify-center transition-all active:scale-95 border border-slate-200 shadow-sm" title="View Attached File">
                                        <Eye size={18} />
                                    </button>
                                )}
                                <button onClick={() => onTrack(localDoc)} className="flex-1 py-2.5 px-2 bg-white hover:bg-slate-50 text-slate-800 font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 text-sm border border-slate-200 shadow-sm">
                                    <Clock size={16} /> History
                                </button>
                            </div>
                            
                            {canRevise ? (
                                <div className="flex gap-2 w-full mt-1">
                                    {onCancel && (
                                        <button onClick={() => onCancel(localDoc)} className="flex-[1] py-2.5 px-2 bg-rose-100 hover:bg-rose-200 text-rose-800 font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 text-sm border border-rose-300 shadow-sm">
                                            <Ban size={16}/> Cancel
                                        </button>
                                    )}
                                    {onRevise && (
                                    <button onClick={() => onRevise(localDoc)} className="flex-[2.5] py-2.5 px-2 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 text-sm border border-orange-700 shadow-sm">
                                        Revise & Resubmit
                                    </button>
                                    )}
                                </div>
                            ) : (
                                <div className="w-full py-2.5 px-3 bg-orange-100/50 border border-orange-200 rounded-xl text-center mt-1">
                                    <p className="text-[11px] font-bold text-orange-800 uppercase tracking-wider">Pending revision by {localDoc.assigned_clerk}</p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (

                /* 
                  ========================================
                  TAB CONTENT: PROCESSING
                  ========================================
                */
                    <>
                        <div onClick={() => onToggleCollapse(localDoc.id)} className="p-4 flex items-start gap-3 cursor-pointer select-none hover:bg-white/30 transition-colors flex-1">
                            
                            {showCheckbox && (
                                <button type="button" onClick={(e) => { e.stopPropagation(); onToggleSelection(localDoc); }} className={`mt-0.5 p-1 rounded-lg transition-all border-2 shrink-0 ${isSelected ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white/80 text-slate-400 border-slate-300 hover:text-slate-600 hover:bg-white'}`}>
                                    {isSelected ? <CheckSquare size={16} strokeWidth={2.5} /> : <Square size={16} strokeWidth={2.5} />}
                                </button>
                            )}
                            
                            <div className="flex flex-col min-w-0 flex-1">
                                {/* ROW 1: Doc # | Icons */}
                                <div className="flex items-start justify-between gap-2 mb-1.5">
                                    <span className="text-[11px] font-bold text-slate-700 bg-white/60 px-2 py-0.5 rounded border border-white shrink-0 uppercase tracking-wider shadow-sm">
                                        {localDoc.reference_no || localDoc.id.substring(0, 8)}
                                    </span>
                                    
                                    {/* --- ICONS CLUSTER (TOP RIGHT) --- */}
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        {!isSelfAssigned && (
                                            localDoc.status === 'pending_receipt' ? (
                                                <div className="w-[22px] h-[22px] flex items-center justify-center bg-amber-100 text-amber-700 border border-amber-200 rounded-md shadow-sm" title="Pending Receipt">
                                                    <AlertCircle size={14} strokeWidth={2.5}/>
                                                </div>
                                            ) : (
                                                <div className="w-[22px] h-[22px] flex items-center justify-center bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-md shadow-sm" title="Custody Accepted">
                                                    <Handshake size={14} strokeWidth={2.5}/>
                                                </div>
                                            )
                                        )}

                                        {localDoc.is_urgent && (
                                            <div className="w-[22px] h-[22px] flex items-center justify-center bg-rose-100 text-rose-700 border border-rose-300 rounded-md shadow-sm animate-pulse" title="Rush Document">
                                                <Zap size={14} strokeWidth={2.5}/>
                                            </div>
                                        )}

                                        {(localDoc.parent_doc_ref || localDoc.has_children) && (
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); onViewLinked?.(localDoc); }} 
                                                className="w-[22px] h-[22px] flex items-center justify-center bg-blue-100 text-blue-700 border border-blue-200 rounded-md shadow-sm hover:bg-blue-200 transition-colors shrink-0" 
                                                title="View Document Family"
                                            >
                                                <LinkIcon size={12} strokeWidth={3} />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* ROW 2: Title */}
                                <h4 className={`font-black text-slate-900 text-sm sm:text-base leading-snug w-full mt-1 ${isExpanded ? '' : 'truncate'}`}>
                                    {localDoc.title || localDoc.subject}
                                </h4>
                            </div>

                            <ChevronDown size={18} className={`text-slate-500 shrink-0 mt-1 transition-transform duration-200 ease-in-out ${isExpanded ? 'rotate-180 text-blue-600' : ''}`} />
                        </div>
                        
                        {/* --- EXPANDED "PAPER" AREA --- */}
                        <div className={`grid transition-[grid-template-rows,opacity] duration-[400ms] ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                            <div className="overflow-hidden">
                                <div className="mx-3 mb-3 p-4 bg-white rounded-xl shadow-sm border border-slate-200 space-y-4">
                                    
                                    {isExpanded && <MiniRouteTracker documentId={localDoc.id} documentStatus={localDoc.status} />}
                                    
                                    <div className="flex items-center gap-1.5 pt-1">
                                        <User size={13} className="text-slate-400 shrink-0" />
                                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                            Managed by: <span className="text-slate-800">{localDoc.assigned_clerk || 'Unassigned'}</span>
                                        </p>
                                    </div>
                                    
                                    <div className="p-3.5 rounded-xl border border-slate-100 space-y-2.5 bg-slate-50/50">
                                        <div className="flex items-start gap-2">
                                            <MapPin size={15} className="text-slate-400 mt-0.5 shrink-0" />
                                            <p className="text-xs sm:text-sm text-slate-900 font-bold leading-snug">
                                                <span className="text-slate-500 text-[10px] block font-bold uppercase tracking-wider mb-0.5">Current Location</span>
                                                {localDoc.current_location || 'Processing'}
                                            </p>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <Clock size={15} className="text-slate-400 mt-0.5 shrink-0" />
                                            <p className="text-xs sm:text-sm text-slate-900 font-bold leading-snug">
                                                <span className="text-slate-500 text-[10px] block font-bold uppercase tracking-wider mb-0.5">Last Update</span>
                                                {formatPHDateTime(localDoc.updated_at || localDoc.created_at)}
                                            </p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex flex-col gap-2 pt-1">
                                        {(localDoc.attachment_url || localDoc.status !== 'pending_receipt') && (
                                            <div className="flex gap-2">
                                                {localDoc.attachment_url && (
                                                    <button onClick={() => onPreview(localDoc.attachment_url as string)} className="shrink-0 py-2 px-3 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl flex items-center justify-center transition-all active:scale-95 border-2 border-slate-200 shadow-sm" title="View Attached File">
                                                        <Eye size={16} />
                                                    </button>
                                                )}
                                                
                                                {localDoc.status !== 'pending_receipt' && (
                                                    <>
                                                        <button onClick={() => onTrack(localDoc)} className="flex-1 py-2 px-2 bg-white hover:bg-slate-50 text-slate-800 font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 text-xs sm:text-sm border-2 border-slate-200 shadow-sm">
                                                            <Clock size={14} /> Track
                                                        </button>
                                                        {canReassign && (
                                                            <button onClick={() => onReassign(localDoc)} className="flex-1 py-2 px-2 bg-white hover:bg-slate-50 text-slate-800 font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 text-xs sm:text-sm border-2 border-slate-200 shadow-sm">
                                                                <UserPlus size={14} /> Re-assign
                                                            </button>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        )}
                                        
                                        {isManager && localDoc.status === 'pending_receipt' ? (
                                            <div className="flex gap-2 w-full mt-1">
                                                {onReceive && (
                                                    <button onClick={() => onReceive(localDoc)} className="flex-[2] py-2.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 text-xs sm:text-sm border-2 border-emerald-700 shadow-sm">
                                                        <Handshake size={16} strokeWidth={2.5} /> Receive
                                                    </button>
                                                )}
                                                {onDecline && (
                                                    <button onClick={(e) => { e.stopPropagation(); onDecline(localDoc); }} className="flex-[1] py-2.5 px-2 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 text-xs sm:text-sm border border-rose-200 shadow-sm">
                                                        <Ban size={16} strokeWidth={2.5} /> Decline
                                                    </button>
                                                )}
                                            </div>
                                        ) : isManager ? (
                                            <div className="flex gap-2 w-full mt-1">
                                                {onAction && (
                                                    <button onClick={() => onAction(localDoc)} className="flex-1 py-2.5 px-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 text-xs sm:text-sm border-2 border-blue-700 shadow-sm">
                                                        Action <ChevronRight size={15} />
                                                    </button>
                                                )}

                                                {onCancel && (
                                                    <button onClick={(e) => { e.stopPropagation(); onCancel(localDoc); }} title="Cancel Document" className="w-[42px] shrink-0 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center border border-rose-200 transition-all active:scale-95 shadow-sm">
                                                        <Ban size={18} strokeWidth={2.5} />
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-center mt-1">
                                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                                    {localDoc.status === 'pending_receipt' 
                                                        ? `Pending receipt by ${localDoc.assigned_clerk}` 
                                                        : `Pending action by ${localDoc.assigned_clerk}`}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

// ... Keep existing MiniRouteTracker ...
function MiniRouteTracker({ documentId, documentStatus }: { documentId: string, documentStatus?: string }) {
    const [nodes, setNodes] = useState<{location: string, isRejected: boolean}[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        
        const fetchRoute = async () => {
            const { data } = await supabase
                .from('document_logs')
                .select('location, action, created_at')
                .eq('document_id', documentId)
                .order('created_at', { ascending: true });

            if (isMounted && data) {
                const processedNodes: {location: string, isRejected: boolean}[] = [];

                data.forEach((log) => {
                    const actionLower = log.action?.toLowerCase() || '';
                    if (actionLower.includes('return') || actionLower.includes('cancel')) {
                        if (processedNodes.length > 0) {
                            processedNodes[processedNodes.length - 1].isRejected = true;
                        }
                    } else {
                        if (processedNodes.length === 0 || processedNodes[processedNodes.length - 1].location !== log.location) {
                            processedNodes.push({ location: log.location, isRejected: false });
                        } else {
                            processedNodes[processedNodes.length - 1].isRejected = false;
                        }
                    }
                });
                
                setNodes(processedNodes);
                setLoading(false);
            }
        };

        fetchRoute();

        const subscription = supabase
            .channel(`public:document_logs:${documentId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'document_logs', filter: `document_id=eq.${documentId}` }, () => {
                if (isMounted) fetchRoute();
            })
            .subscribe();

        return () => { 
            isMounted = false; 
            supabase.removeChannel(subscription);
        };
    }, [documentId]);

    if (loading) {
        return (
            <div className="w-full h-[70px] bg-slate-50/50 rounded-xl border border-slate-100 animate-pulse flex items-center justify-center">
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-slate-200"></div>
                    <div className="w-8 h-1 bg-slate-200 rounded-full"></div>
                    <div className="w-5 h-5 rounded-full bg-slate-200"></div>
                </div>
            </div>
        );
    }

    if (nodes.length <= 1) return null;

    return (
        <div 
            className="w-full bg-slate-50/50 pt-4 pb-3 px-2 sm:px-4 rounded-xl border border-slate-100 overflow-x-auto custom-scrollbar"
            style={{ WebkitOverflowScrolling: 'touch' }} 
        >
            <div className="flex items-start min-w-max">
                {nodes.map((node, index) => {
                    const isLastNode = index === nodes.length - 1;
                    const isRejected = node.isRejected || (isLastNode && (documentStatus?.toLowerCase() === 'returned' || documentStatus?.toLowerCase() === 'cancelled'));

                    return (
                        <div key={index} className="relative flex flex-col items-center w-24 sm:w-28 shrink-0">
                            
                            {index !== nodes.length - 1 && (
                                <div 
                                    className={`absolute top-[9px] left-[calc(50%+14px)] w-[calc(100%-28px)] h-[2px] rounded-full transition-colors z-0
                                        ${isRejected ? 'bg-rose-300' : 'bg-emerald-400'}
                                    `}
                                ></div>
                            )}
                            
                            <div 
                                className={`relative z-10 w-5 h-5 rounded-full flex items-center justify-center border-2 transition-all duration-300
                                    ${isRejected 
                                        ? 'bg-rose-500 border-rose-500 text-white shadow-sm ring-[3px] ring-rose-100' 
                                        : isLastNode 
                                            ? 'bg-blue-600 border-blue-600 text-white shadow-sm ring-[3px] ring-blue-100' 
                                            : 'bg-white border-emerald-400 text-emerald-500' 
                                    }
                                `}
                            >
                                {isRejected ? (
                                    <X size={12} strokeWidth={4} />
                                ) : isLastNode ? (
                                    <span className="text-[9px] font-black">{index + 1}</span>
                                ) : (
                                    <Check size={10} strokeWidth={4} />
                                )}
                            </div>
                            
                            <span 
                                title={node.location}
                                className={`mt-2.5 text-[10px] text-center w-full line-clamp-2 leading-[1.3] px-1 transition-colors
                                ${isRejected ? 'text-rose-700 font-bold' : isLastNode ? 'text-blue-700 font-black' : 'text-slate-500 font-medium'}
                            `}>
                                {node.location}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}