import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
    Search, MapPin, Clock, CheckCircle, AlertCircle, 
    Archive, FileText, X, Eye, Ban, ChevronDown, FolderTree, User, RefreshCw, Database, Link as LinkIcon 
} from 'lucide-react';
import { supabase } from '../lib/supabase';

import { formatPHDateTime } from '../lib/utils';
import DigitalTrailModal from '../components/system/DigitalTrailModal';
import FilePreviewModal from '../components/system/FilePreviewModal';
import LinkedDocumentsModal from '../components/processing/LinkedDocumentsModal';

const modalAnimationStyles = `
    @keyframes customFadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes iosSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
    @keyframes desktopZoomIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }

    .animate-overlay-fade { animation: customFadeIn 0.3s ease-out forwards; }
    .animate-responsive-modal { animation: iosSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

    .scrollbar-hide::-webkit-scrollbar { display: none; }
    .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }

    @media (min-width: 640px) {
        .animate-responsive-modal { animation: desktopZoomIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    }
`;

interface DocumentLog {
    action: string;
    created_at: string;
}

interface DocumentItem {
    id: string;
    reference_no?: string;
    title?: string;
    subject?: string;
    category?: string;
    status: string;
    assigned_clerk?: string;
    created_by?: string;
    creator_name?: string; 
    custodian_id?: string;
    final_destination?: string;
    current_location?: string;
    remarks?: string;
    attachment_url?: string;
    created_at: string;
    updated_at?: string;
    document_logs?: DocumentLog[];
    action_time?: string; 
    parent_doc_ref?: string | null; 
    has_children?: boolean; // <-- NEW
}

interface HistoryData {
    completed: DocumentItem[];
    cancelled: DocumentItem[];
    archived: DocumentItem[]; 
}

interface TabButtonProps {
    label: string;
    icon: React.ReactNode;
    count: number;
    isActive: boolean;
    onClick: () => void;
    colorClass: string;
    badgeClass: string;
    newCount?: number;
}

const fetchHistoryData = async (): Promise<HistoryData> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("No authenticated session");
    const currentUserId = session.user.id;

    // --- NEW: Added a query for parent_doc_ref to flag Mother Docs ---
    const [docsRes, profilesRes, archivedRes, parentRefsRes] = await Promise.all([
        supabase.from('documents')
            .select(`
                *,
                document_logs (
                    action,
                    created_at
                )
            `)
            .in('status', ['sealed', 'cancelled']),
        supabase.from('profiles').select('id, full_name'),
        supabase.from('archived_documents').select('*'),
        supabase.from('documents').select('parent_doc_ref').not('parent_doc_ref', 'is', null) 
    ]);

    if (docsRes.error) throw docsRes.error;
    if (archivedRes.error) console.error("Archive fetch error:", archivedRes.error); 

    const creatorMap: Record<string, string> = {};
    if (profilesRes.data) {
        profilesRes.data.forEach((p: { id: string; full_name: string }) => {
            creatorMap[p.id] = p.full_name;
        });
    }

    const parentRefSet = new Set(parentRefsRes.data?.map(d => d.parent_doc_ref) || []);

    const rawDocs = docsRes.data || [];
    const rawArchived = archivedRes.data || [];

    let completed: DocumentItem[] = [];
    let cancelled: DocumentItem[] = [];
    let archived: DocumentItem[] = [];

    if (rawDocs.length > 0) {
        const myRelevantDocs = (rawDocs as DocumentItem[]).filter((d) => 
            d.created_by === currentUserId
        );

        const processedDocs = myRelevantDocs.map((doc) => {
            const logs = doc.document_logs || [];
            doc.creator_name = creatorMap[doc.created_by || ''] || 'System User';
            doc.has_children = parentRefSet.has(doc.reference_no); // <-- Flags Mother Docs

            if (doc.status === 'sealed') {
                const deliveryLog = logs.filter((l) => l.action === 'Delivered')
                                        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
                doc.action_time = deliveryLog ? deliveryLog.created_at : doc.created_at;
            } else if (doc.status === 'cancelled') {
                const cancelLog = logs.filter((l) => l.action === 'Cancelled')
                                        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
                doc.action_time = cancelLog ? cancelLog.created_at : (doc.updated_at || doc.created_at);
            }
            return doc;
        });

        completed = processedDocs
          .filter((d) => d.status === 'sealed')
          .sort((a, b) => new Date(b.action_time || '').getTime() - new Date(a.action_time || '').getTime());

        cancelled = processedDocs
          .filter((d) => d.status === 'cancelled')
          .sort((a, b) => new Date(b.action_time || '').getTime() - new Date(a.action_time || '').getTime());
    }

    if (rawArchived.length > 0) {
        const myArchivedDocs = (rawArchived as DocumentItem[]).filter((d) => 
            d.created_by === currentUserId
        );

        archived = myArchivedDocs.map((doc) => {
            doc.creator_name = creatorMap[doc.created_by || ''] || 'System User';
            doc.action_time = doc.updated_at || doc.created_at; 
            doc.has_children = parentRefSet.has(doc.reference_no); // <-- Flags Mother Docs
            return doc;
        }).sort((a, b) => new Date(b.action_time || '').getTime() - new Date(a.action_time || '').getTime());
    }

    return { completed, cancelled, archived };
};

export default function History() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'completed' | 'cancelled' | 'archived'>('completed');
  const [searchQuery, setSearchQuery] = useState("");
  const [trailDoc, setTrailDoc] = useState<DocumentItem | null>(null);
  const [previewDocUrl, setPreviewDocUrl] = useState<string | null>(null);

  const [linkedTargetRef, setLinkedTargetRef] = useState<string | null>(null);
  const [isLinkedModalOpen, setIsLinkedModalOpen] = useState(false);

  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [categoryPages, setCategoryPages] = useState<Record<string, number>>({});
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  
  const [tabCategoryViewedTime, setTabCategoryViewedTime] = useState<Record<string, number>>(() => {
      const saved = localStorage.getItem('filetrackr_history_viewed');
      return saved ? JSON.parse(saved) : {};
  });

  const { data, isLoading, refetch, isFetching } = useQuery<HistoryData>({
      queryKey: ['historyDocuments'],
      queryFn: fetchHistoryData,
      refetchInterval: 60000,
      refetchOnMount: 'always',
      refetchOnWindowFocus: true,
  });

  useEffect(() => {
      const docsChannel = supabase
        .channel('history-document-updates')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'documents' },
          () => {
            refetch(); 
            queryClient.invalidateQueries({ queryKey: ['globalNavNotifications'] });
          }
        )
        .subscribe();
        
      const archiveChannel = supabase
        .channel('history-archive-updates')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'archived_documents' },
          () => {
            refetch(); 
          }
        )
        .subscribe();
        
      return () => {
        supabase.removeChannel(docsChannel);
        supabase.removeChannel(archiveChannel);
      };
  }, [refetch, queryClient]);

  const documents = useMemo<HistoryData>(() => {
      return { 
          completed: data?.completed || [], 
          cancelled: data?.cancelled || [],
          archived: data?.archived || []
      };
  }, [data]);

  const newCompletedCount = useMemo(() => {
      let count = 0;
      documents.completed.forEach(doc => {
          const cat = doc.category || 'Uncategorized';
          const key = `completed_${cat}`;
          const docTime = new Date(doc.action_time || doc.updated_at || doc.created_at).getTime();
          const lastViewed = tabCategoryViewedTime[key] || 0;
          if (docTime > lastViewed) count++;
      });
      return count;
  }, [documents.completed, tabCategoryViewedTime]);

  const newCancelledCount = useMemo(() => {
      let count = 0;
      documents.cancelled.forEach(doc => {
          const cat = doc.category || 'Uncategorized';
          const key = `cancelled_${cat}`;
          const docTime = new Date(doc.action_time || doc.updated_at || doc.created_at).getTime();
          const lastViewed = tabCategoryViewedTime[key] || 0;
          if (docTime > lastViewed) count++;
      });
      return count;
  }, [documents.cancelled, tabCategoryViewedTime]);

  const newArchivedCount = useMemo(() => {
      let count = 0;
      documents.archived.forEach(doc => {
          const cat = doc.category || 'Uncategorized';
          const key = `archived_${cat}`;
          const docTime = new Date(doc.action_time || doc.updated_at || doc.created_at).getTime();
          const lastViewed = tabCategoryViewedTime[key] || 0;
          if (docTime > lastViewed) count++;
      });
      return count;
  }, [documents.archived, tabCategoryViewedTime]);

  const filteredDocs = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    const sourceList = documents[activeTab] || []; 

    if (!query) return sourceList;

    return sourceList.filter((doc: DocumentItem) => 
        (doc.title || '').toLowerCase().includes(query) ||
        (doc.reference_no || '').toLowerCase().includes(query) ||
        (doc.final_destination || '').toLowerCase().includes(query) ||
        (doc.current_location || '').toLowerCase().includes(query) ||
        (doc.assigned_clerk || '').toLowerCase().includes(query) ||
        (doc.category || '').toLowerCase().includes(query)
    );
  }, [searchQuery, documents, activeTab]);

  const groupedDocs = useMemo(() => {
      const grouped: Record<string, { docs: DocumentItem[], newCount: number }> = {};

      filteredDocs.forEach(doc => {
          const category = doc.category || 'Uncategorized';
          const key = `${activeTab}_${category}`; 
          
          if (!grouped[category]) grouped[category] = { docs: [], newCount: 0 };
          
          grouped[category].docs.push(doc);
          
          const docTime = new Date(doc.action_time || doc.updated_at || doc.created_at).getTime();
          const lastViewed = tabCategoryViewedTime[key] || 0;
          
          if (docTime > lastViewed) {
              grouped[category].newCount++;
          }
      });

      return Object.entries(grouped)
          .map(([category, data]) => ({ category, docs: data.docs, newCount: data.newCount }))
          .sort((a, b) => a.category.localeCompare(b.category));
  }, [filteredDocs, activeTab, tabCategoryViewedTime]);

  const toggleCategoryAccordion = (categoryName: string) => {
      const key = `${activeTab}_${categoryName}`;
      
      const now = Date.now();
      setTabCategoryViewedTime(prev => {
          const next = { ...prev, [key]: now };
          localStorage.setItem('filetrackr_history_viewed', JSON.stringify(next));
          return next;
      });

      window.dispatchEvent(new Event('history_folder_viewed'));

      setExpandedCategories(prev => ({
          ...prev,
          [categoryName]: !prev[categoryName]
      }));
  };

  const toggleCardCollapse = (docId: string) => {
      setExpandedCards(prev => ({
          ...prev,
          [docId]: !prev[docId]
      }));
  };

  if (isLoading) {
      return (
          <div className="flex flex-col items-center justify-center min-h-[50vh]">
              <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
              <p className="mt-4 text-slate-500 font-bold">Loading Archives...</p>
          </div>
      );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-500 pb-12">
      <style>{modalAnimationStyles}</style>

      {/* Elegant Header */}
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 mb-2">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <Archive className="text-emerald-600" size={32} /> Document History
          </h2>
          <p className="text-base text-slate-500 font-medium mt-1">Review your completed and voided document archives.</p>
        </div>
      </div>

      {/* Enhanced Search & Compact Refresh Bar */}
      <div className="flex flex-col gap-4 mb-8">
          <div className="flex items-center gap-2 sm:gap-3 w-full">
              <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search archives by Title, ID, Category..." 
                    className="w-full pl-11 pr-11 py-3.5 rounded-2xl border border-slate-200 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none font-bold text-slate-800 placeholder:text-slate-400 transition-all text-sm sm:text-base shadow-sm bg-white hover:border-slate-300" 
                  />
                  {searchQuery && (
                      <button 
                        onClick={() => setSearchQuery("")} 
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-full transition-all duration-200 active:scale-90"
                      >
                          <X className="w-4 h-4" strokeWidth={3} />
                      </button>
                  )}
              </div>
              <button 
                  onClick={() => refetch()} 
                  disabled={isFetching}
                  className="w-[52px] h-[52px] shrink-0 bg-white border border-slate-200 text-slate-500 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-600 rounded-2xl shadow-sm transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center group"
                  title="Refresh History"
              >
                  <RefreshCw size={20} className={`${isFetching ? "animate-spin text-emerald-600" : "group-hover:rotate-180 transition-transform duration-500"}`} />
              </button>
          </div>

          <div className="flex flex-nowrap overflow-x-auto scrollbar-hide gap-2 sm:gap-3 w-full pb-2">
              <TabButton 
                label="Completed" 
                icon={<CheckCircle size={18} strokeWidth={activeTab === 'completed' ? 3 : 2} />}
                count={documents.completed.length} 
                newCount={newCompletedCount}
                isActive={activeTab === 'completed'} 
                onClick={() => { setActiveTab('completed'); setSearchQuery(''); }} 
                colorClass="bg-emerald-600 text-white"
                badgeClass="bg-emerald-500 text-white border-emerald-400"
              />
              <TabButton 
                label="Cancelled" 
                icon={<Ban size={18} strokeWidth={activeTab === 'cancelled' ? 3 : 2} />}
                count={documents.cancelled.length} 
                newCount={newCancelledCount}
                isActive={activeTab === 'cancelled'} 
                onClick={() => { setActiveTab('cancelled'); setSearchQuery(''); }} 
                colorClass="bg-rose-600 text-white"
                badgeClass="bg-rose-500 text-white border-rose-400"
              />
              <TabButton 
                label="Deep Archive" 
                icon={<Database size={18} strokeWidth={activeTab === 'archived' ? 3 : 2} />}
                count={documents.archived.length} 
                newCount={newArchivedCount}
                isActive={activeTab === 'archived'} 
                onClick={() => { setActiveTab('archived'); setSearchQuery(''); }} 
                colorClass="bg-slate-700 text-white"
                badgeClass="bg-slate-600 text-white border-slate-500"
              />
          </div>
      </div>

      <div key={activeTab} className="animate-in fade-in zoom-in-[0.98] duration-300 ease-out fill-mode-both">
          {filteredDocs.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-[2rem] p-10 sm:p-14 flex flex-col items-center justify-center text-center shadow-sm">
                  <div className="bg-slate-50 p-4 border border-slate-100 rounded-2xl mb-4 shadow-inner">
                    <FileText size={32} className="text-slate-400" strokeWidth={1.5} />
                  </div>
                  <h3 className="text-xl font-black text-slate-800 mb-1.5">No records found</h3>
                  <p className="text-sm sm:text-base font-medium text-slate-500 max-w-sm">
                      {searchQuery 
                        ? `We couldn't find any ${activeTab} documents matching "${searchQuery}".`
                        : `Your ${activeTab} document history is currently empty.`}
                  </p>
              </div>
          ) : (
              <div className="bg-transparent space-y-4">
                  {groupedDocs.map(({ category, docs, newCount }) => {
                      const isCategoryExpanded = expandedCategories[category];
                      const currentPage = categoryPages[category] || 1;
                      const itemsPerPage = 5;
                      const totalPages = Math.ceil(docs.length / itemsPerPage);
                      const paginatedDocs = docs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

                      let tabThemeColor = 'emerald';
                      let tabIconColor = 'text-emerald-500';
                      if (activeTab === 'cancelled') {
                          tabThemeColor = 'rose';
                          tabIconColor = 'text-rose-500';
                      } else if (activeTab === 'archived') {
                          tabThemeColor = 'slate';
                          tabIconColor = 'text-slate-500';
                      }

                      return (
                          <div key={category} className={`bg-white border rounded-[1.5rem] overflow-hidden transition-all duration-300 shadow-sm ${isCategoryExpanded ? 'border-slate-300 shadow-md ring-4 ring-slate-50/50' : 'border-slate-200 hover:border-slate-300'}`}>
                              <button 
                                  onClick={() => toggleCategoryAccordion(category)}
                                  className={`w-full py-4 px-5 flex items-center justify-between transition-colors duration-200 ease-in-out focus:outline-none group active:bg-slate-50 ${isCategoryExpanded ? 'bg-slate-50/80 border-b border-slate-100' : 'bg-transparent hover:bg-slate-50/50'}`}
                              >
                                  <div className="flex flex-col text-left flex-1 min-w-0 pr-4 gap-1">
                                      <div className="flex items-center gap-2.5">
                                          <FolderTree size={20} className={tabIconColor} strokeWidth={2.5} />
                                          <h4 className="font-bold text-slate-800 text-base sm:text-lg leading-snug break-words group-hover:text-slate-900 transition-colors">{category}</h4>
                                      </div>
                                      
                                      <div className="flex items-center gap-2 mt-1">
                                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md text-slate-500 bg-white border border-slate-200 shadow-sm">
                                              {docs.length} document{docs.length !== 1 ? 's' : ''}
                                          </span>
                                          {newCount > 0 && !isCategoryExpanded && (
                                              <span className="text-[9px] font-black text-white bg-red-500 px-1.5 py-0.5 rounded shadow-sm animate-pulse flex items-center tracking-wider">
                                                  {newCount} NEW
                                              </span>
                                          )}
                                      </div>
                                  </div>
                                  <div className={`p-2 rounded-full transition-colors ${isCategoryExpanded ? 'bg-slate-200 text-slate-800' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200 group-hover:text-slate-600'}`}>
                                    <ChevronDown 
                                        size={18} 
                                        strokeWidth={2.5}
                                        className={`shrink-0 transition-transform duration-300 ${isCategoryExpanded ? 'rotate-180' : ''}`} 
                                    />
                                  </div>
                              </button>

                              <div className={`grid transition-[grid-template-rows,opacity] duration-[400ms] ease-in-out ${isCategoryExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                                  <div className="overflow-hidden">
                                      <div className="bg-slate-50/50 p-4 sm:p-5">
                                          <div className="flex flex-col gap-3.5">
                                              {paginatedDocs.map((doc) => {
                                                  const isCardExpanded = !!expandedCards[doc.id];

                                                  return (
                                                      <div key={doc.id} className="group relative bg-white rounded-2xl border border-slate-200 hover:border-slate-300 transition-all overflow-hidden shadow-sm hover:shadow-md">
                                                          <div className={`absolute top-0 left-0 bottom-0 w-1.5 bg-${tabThemeColor}-500 transition-colors`}></div>

                                                          <div 
                                                              onClick={() => toggleCardCollapse(doc.id)}
                                                              className="p-4 pl-6 flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-slate-50/70 transition-colors"
                                                          >
                                                              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                                                  <div className="flex flex-col min-w-0 flex-1">
                                                                      <div className="flex items-center gap-2 mb-1.5">
                                                                          <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 shrink-0 shadow-sm">
                                                                              {doc.reference_no || doc.id.substring(0, 8)}
                                                                          </span>
                                                                          <span className={`flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded border uppercase tracking-wider shrink-0 text-${tabThemeColor}-700 bg-${tabThemeColor}-50 border-${tabThemeColor}-200 shadow-sm`}>
                                                                              {activeTab === 'completed' ? 'Completed' : activeTab === 'cancelled' ? 'Voided' : 'Archived'}
                                                                          </span>
                                                                      </div>
                                                                      
                                                                      <h4 className={`font-bold text-slate-900 text-sm sm:text-base leading-snug ${isCardExpanded ? '' : 'truncate'}`}>
                                                                          {doc.title || doc.subject}
                                                                      </h4>
                                                                      
                                                                      <div className="flex items-center gap-1.5 mt-1.5 shrink-0 text-slate-400">
                                                                          <Clock size={12} strokeWidth={2.5} />
                                                                          <span className="text-[10px] font-bold tracking-wide font-mono whitespace-nowrap">
                                                                              {formatPHDateTime(doc.action_time || doc.created_at)}
                                                                          </span>
                                                                      </div>
                                                                  </div>
                                                              </div>

                                                              {/* --- NEW: LINK BADGE BESIDE CHEVRON --- */}
                                                              <div className="flex items-center gap-2 shrink-0">
                                                                {(doc.parent_doc_ref || doc.has_children) && (
                                                                    <button 
                                                                        onClick={(e) => { 
                                                                            e.stopPropagation(); 
                                                                            setLinkedTargetRef((doc.parent_doc_ref || doc.reference_no) as string);
                                                                            setIsLinkedModalOpen(true);
                                                                        }} 
                                                                        className="w-[26px] h-[26px] flex items-center justify-center bg-blue-50 text-blue-600 border border-blue-200 rounded-md shadow-sm hover:bg-blue-100 transition-colors shrink-0" 
                                                                        title="View Document Family"
                                                                    >
                                                                        <LinkIcon size={14} strokeWidth={3} />
                                                                    </button>
                                                                )}
                                                                <ChevronDown 
                                                                    size={20} 
                                                                    className={`text-slate-400 shrink-0 transition-transform duration-200 ease-in-out ${isCardExpanded ? `rotate-180 text-${tabThemeColor}-600` : ''}`} 
                                                                />
                                                              </div>
                                                          </div>

                                                          <div 
                                                              className={`grid transition-[grid-template-rows,opacity] duration-[300ms] ease-in-out ${
                                                                  isCardExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                                                              }`}
                                                          >
                                                              <div className="overflow-hidden">
                                                                  <div className="p-4 pl-6 pt-2 border-t border-slate-100 bg-white space-y-4">

                                                                      <div className="flex items-center gap-2">
                                                                          <div className="p-1.5 bg-slate-100 rounded-lg border border-slate-200"><User size={14} className="text-slate-500" /></div>
                                                                          <p className="text-xs font-bold text-slate-500 tracking-wide">
                                                                              Created by <span className="text-slate-800">{doc.creator_name}</span>
                                                                          </p>
                                                                      </div>

                                                                      <div className={`p-4 rounded-xl border space-y-3 bg-${tabThemeColor}-50/50 border-${tabThemeColor}-100`}>
                                                                          {activeTab === 'completed' || activeTab === 'archived' ? (
                                                                              <div className="flex items-start gap-3">
                                                                                  <MapPin size={18} className={`text-${tabThemeColor}-500 shrink-0`} />
                                                                                  <div className="flex flex-col -mt-0.5">
                                                                                      <span className={`text-${tabThemeColor}-700/70 text-[10px] font-black uppercase tracking-wider mb-0.5`}>Final Destination</span>
                                                                                      <span className="text-sm text-slate-900 font-bold leading-snug">{doc.final_destination || 'Archived Location Unspecified'}</span>
                                                                                  </div>
                                                                              </div>
                                                                          ) : (
                                                                              <div className="flex items-start gap-3">
                                                                                  <AlertCircle size={18} className="text-rose-500 shrink-0" />
                                                                                  <div className="flex flex-col -mt-0.5">
                                                                                      <span className="text-rose-600/70 text-[10px] font-black uppercase tracking-wider mb-0.5">Reason for Cancellation</span>
                                                                                      <span className="text-sm text-slate-900 font-bold leading-snug">{doc.remarks || 'No reason provided'}</span>
                                                                                  </div>
                                                                              </div>
                                                                          )}
                                                                      </div>

                                                                      <div className="flex gap-2 pt-1 pb-1">
                                                                          {doc.attachment_url && (
                                                                              <button 
                                                                                  onClick={() => setPreviewDocUrl(doc.attachment_url as string)} 
                                                                                  className="shrink-0 py-2.5 px-4 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl flex items-center justify-center transition-all active:scale-95 border border-slate-200 shadow-sm"
                                                                                  title="View Attached File"
                                                                              >
                                                                                  <Eye size={18} />
                                                                              </button>
                                                                          )}
                                                                          {activeTab !== 'archived' ? (
                                                                              <button 
                                                                                  onClick={() => setTrailDoc(doc)}
                                                                                  className="flex-1 py-2.5 px-4 bg-white hover:bg-slate-50 text-slate-800 font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 text-xs sm:text-sm border border-slate-200 shadow-sm"
                                                                              >
                                                                                  <Clock size={16} /> View Digital Trail
                                                                              </button>
                                                                          ) : (
                                                                              <div className="flex-1 py-2.5 px-4 bg-slate-50 text-slate-400 font-bold rounded-xl flex items-center justify-center gap-2 text-xs sm:text-sm border border-slate-200">
                                                                                  <Database size={16} /> Trail stored in Cold Storage
                                                                              </div>
                                                                          )}
                                                                      </div>
                                                                  </div>
                                                              </div>
                                                          </div>
                                                      </div>
                                                  );
                                              })}
                                          </div>

                                          {totalPages > 1 && (
                                              <div className="p-3 sm:p-4 bg-white rounded-xl border border-slate-200 mt-4 flex items-center justify-between shadow-sm">
                                                  <span className="text-[10px] sm:text-xs font-bold text-slate-500">
                                                      Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, docs.length)} of {docs.length}
                                                  </span>
                                                  <div className="flex gap-2">
                                                      <button 
                                                          disabled={currentPage === 1}
                                                          onClick={() => setCategoryPages(prev => ({...prev, [category]: currentPage - 1}))}
                                                          className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-[11px] sm:text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 active:scale-95 transition-all shadow-sm"
                                                      >
                                                          Prev
                                                      </button>
                                                      <button 
                                                          disabled={currentPage === totalPages}
                                                          onClick={() => setCategoryPages(prev => ({...prev, [category]: currentPage + 1}))}
                                                          className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-[11px] sm:text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 active:scale-95 transition-all shadow-sm"
                                                      >
                                                          Next
                                                      </button>
                                                  </div>
                                              </div>
                                          )}
                                      </div>
                                  </div>
                              </div>
                          </div>
                      );
                  })}
              </div>
          )}
      </div>

      {trailDoc && <DigitalTrailModal doc={trailDoc} onBack={() => setTrailDoc(null)} />}
      {previewDocUrl && <FilePreviewModal url={previewDocUrl} onClose={() => setPreviewDocUrl(null)} />}
      
      {isLinkedModalOpen && linkedTargetRef && (
        <LinkedDocumentsModal
            isOpen={isLinkedModalOpen}
            targetRef={linkedTargetRef}
            onClose={() => setIsLinkedModalOpen(false)}
            onPreview={(url) => setPreviewDocUrl(url)}
        />
      )}
    </div>
  );
}

function TabButton({ label, icon, count, isActive, onClick, colorClass, badgeClass, newCount = 0 }: TabButtonProps) {
    return (
        <button 
            onClick={onClick}
            title={label}
            className={`relative flex-none shrink-0 flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-95 active:shadow-inner text-sm whitespace-nowrap overflow-hidden border ${
                isActive ? `${colorClass} border-transparent shadow-md` : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-700'
            }`}
        >
            {newCount > 0 && !isActive && (
                <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 border border-white"></span>
                </span>
            )}
            
            {icon}
            {isActive && <span className="animate-in fade-in slide-in-from-left-2 duration-200">{label}</span>}
            
            <div className="flex items-center gap-1.5">
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border shadow-sm ${isActive ? badgeClass : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                    {count}
                </span>
                {newCount > 0 && !isActive && (
                    <span className="text-[9px] font-black text-white bg-red-500 px-1.5 py-0.5 rounded shadow-sm animate-in zoom-in flex items-center">
                        {newCount} NEW
                    </span>
                )}
            </div>
        </button>
    )
}