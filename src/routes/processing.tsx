import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X, Activity, CornerUpLeft, RefreshCw, CheckCircle, MapPin, Layers, Ban, AlertCircle, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import type { ProcessingData, DocumentItem } from '../types/processing';

// Components & Modals
import HandoverScreen from '../components/system/HandoverScreen';
import DigitalTrailModal from '../components/system/DigitalTrailModal';
import FilePreviewModal from '../components/system/FilePreviewModal';
import BatchActionModal from '../components/processing/BatchActionModal';
import DocumentCard from '../components/processing/DocumentCard';
import ReassignModal from '../components/processing/ReassignModal';
import CancelModal from '../components/processing/CancelModal';
import ReRouteModal from '../components/processing/ReRouteModal';

// --- DATA FETCHING FUNCTION ---
const fetchProcessingData = async (): Promise<ProcessingData & { currentUserDept: string }> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("No authenticated session");

    const currentUserId = session.user.id;
    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', currentUserId).single();
    const currentUserName = profile?.full_name || '';

    let colleagues: string[] = [];
    let currentUserDept = '';
    
    if (currentUserName) {
        const { data: empData } = await supabase.from('employees').select('department').eq('name', currentUserName).single();
        if (empData?.department) {
            currentUserDept = empData.department;
            const { data: deptEmps } = await supabase.from('employees').select('name').eq('department', empData.department);
            if (deptEmps) colleagues = deptEmps.map(e => e.name);
        }
    }

    const [docsRes, deptRes, allEmpsRes] = await Promise.all([
        supabase.from('documents').select('*').neq('status', 'sealed').neq('status', 'cancelled'),
        supabase.from('departments').select('name').order('name'),
        supabase.from('employees').select('name').order('name')
    ]);

    let processing: DocumentItem[] = [];
    let returned: DocumentItem[] = [];
    const departments = deptRes.data ? deptRes.data.map(d => ({ label: d.name, value: d.name })) : [];
    const allEmployeesList = allEmpsRes.data ? allEmpsRes.data.map(e => ({ label: e.name, value: e.name })) : [];

    if (docsRes.data) {
        const myActiveDocs = (docsRes.data as DocumentItem[]).filter((d) => {
            if (d.status === 'cancelled') return false;
            return d.created_by === currentUserId || d.assigned_clerk === currentUserName;
        });

        const sortedDocs = myActiveDocs.sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime());
        returned = sortedDocs.filter((d) => d.status === 'pending' && d.remarks);
        processing = sortedDocs.filter((d) => d.status === 'routing' || d.status === 'pending_receipt' || (d.status === 'pending' && !d.remarks));
    }

    return { processing, returned, departments, currentUserName, currentUserId, currentUserDept, colleagues, allEmployeesList };
};

export default function Processing() {
  const [activeTab, setActiveTab] = useState<'processing' | 'returned'>('processing');
  const [searchQuery, setSearchQuery] = useState("");
  
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [selectedDocs, setSelectedDocs] = useState<DocumentItem[]>([]);
  
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isBatchMenuClosing, setIsBatchMenuClosing] = useState(false);
  
  // Modals
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);
  const [trailDoc, setTrailDoc] = useState<DocumentItem | null>(null);
  const [previewDocUrl, setPreviewDocUrl] = useState<string | null>(null);
  const [reassignDoc, setReassignDoc] = useState<DocumentItem | null>(null);
  const [cancelDoc, setCancelDoc] = useState<DocumentItem | null>(null);
  const [reRouteDoc, setReRouteDoc] = useState<DocumentItem | null>(null);
  
  // Handshake Modals
  const [declineDoc, setDeclineDoc] = useState<DocumentItem | null>(null);
  const [receiveDoc, setReceiveDoc] = useState<DocumentItem | null>(null);

  const [lastViewedProcessing, setLastViewedProcessing] = useState(() => localStorage.getItem('filetrackr_viewed_processing') || '0');
  const [lastViewedReturned, setLastViewedReturned] = useState(() => localStorage.getItem('filetrackr_viewed_returned') || '0');

  const { data, isLoading, isFetching, refetch } = useQuery<ProcessingData & { currentUserDept: string }>({
      queryKey: ['processingDocuments'],
      queryFn: fetchProcessingData,
      refetchInterval: 60000, 
      refetchOnMount: 'always',
      refetchOnWindowFocus: true,
  });

  useEffect(() => {
      const channel = supabase.channel('public:documents')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, () => {
              refetch(); 
          })
          .subscribe();
          
      return () => { supabase.removeChannel(channel); };
  }, [refetch]);

  const documents = useMemo(() => data ? { processing: data.processing, returned: data.returned } : { processing: [], returned: [] }, [data]);
  const departments = data?.departments || [];

  const filteredDocs = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    const sourceList = documents[activeTab];
    if (!query) return sourceList;
    return sourceList.filter((doc: DocumentItem) => 
        (doc.title || '').toLowerCase().includes(query) ||
        (doc.reference_no || '').toLowerCase().includes(query) ||
        (doc.current_location || '').toLowerCase().includes(query) ||
        (doc.assigned_clerk || '').toLowerCase().includes(query)
    );
  }, [searchQuery, documents, activeTab]);

  const nestedProcessingGroups = useMemo(() => {
      if (activeTab !== 'processing') return [];
      const hierarchy: Record<string, Record<string, DocumentItem[]>> = {};
      filteredDocs.forEach((doc: DocumentItem) => {
          const dest = doc.final_destination || 'Unspecified Destination';
          const clerk = doc.assigned_clerk || 'Unassigned';
          if (!hierarchy[dest]) hierarchy[dest] = {};
          if (!hierarchy[dest][clerk]) hierarchy[dest][clerk] = [];
          hierarchy[dest][clerk].push(doc);
      });
      return Object.entries(hierarchy).sort(([destA], [destB]) => destA.localeCompare(destB))
          .map(([destination, clerksMap]) => ({
              destination,
              clerks: Object.entries(clerksMap).sort(([clerkA], [clerkB]) => clerkA.localeCompare(clerkB))
          }));
  }, [filteredDocs, activeTab]);

  const clerkDocCounts = useMemo(() => {
      if (activeTab !== 'processing') return {};
      const counts: Record<string, number> = {};
      filteredDocs.forEach((doc: DocumentItem) => {
          const clerk = doc.assigned_clerk || 'Unassigned';
          counts[clerk] = (counts[clerk] || 0) + 1;
      });
      return counts;
  }, [filteredDocs, activeTab]);

  const availableColleagues = useMemo(() => {
      if (!data) return [];
      if (reassignDoc) return data.colleagues.filter((name: string) => name !== reassignDoc.assigned_clerk);
      return data.colleagues;
  }, [data, reassignDoc]);

  const handleToggleBatchMenu = () => {
      if (isBatchModalOpen) {
          setIsBatchMenuClosing(true);
          setTimeout(() => {
              setIsBatchMenuClosing(false);
              setIsBatchModalOpen(false);
          }, 200); 
      } else {
          setIsBatchModalOpen(true);
      }
  };

  useEffect(() => { 
      setSelectedDocs([]); 
      setIsBatchModalOpen(false); 
      setIsBatchMenuClosing(false);
  }, [activeTab, searchQuery]);

  const newProcessingCount = useMemo(() => documents.processing.filter((d: DocumentItem) => new Date(d.updated_at || d.created_at).getTime() > Number(lastViewedProcessing)).length, [documents.processing, lastViewedProcessing]);
  const newReturnedCount = useMemo(() => documents.returned.filter((d: DocumentItem) => new Date(d.updated_at || d.created_at).getTime() > Number(lastViewedReturned)).length, [documents.returned, lastViewedReturned]);

  useEffect(() => {
      if (activeTab === 'processing' && documents.processing.length > 0) {
          const newest = Math.max(...documents.processing.map((d: DocumentItem) => new Date(d.updated_at || d.created_at).getTime()));
          if (newest > Number(lastViewedProcessing)) { localStorage.setItem('filetrackr_viewed_processing', newest.toString()); setLastViewedProcessing(newest.toString()); }
      }
      if (activeTab === 'returned' && documents.returned.length > 0) {
          const newest = Math.max(...documents.returned.map((d: DocumentItem) => new Date(d.updated_at || d.created_at).getTime()));
          if (newest > Number(lastViewedReturned)) { localStorage.setItem('filetrackr_viewed_returned', newest.toString()); setLastViewedReturned(newest.toString()); }
      }
  }, [activeTab, documents.processing, documents.returned, lastViewedProcessing, lastViewedReturned]);

  if (isLoading) {
      return (
          <div className="flex flex-col items-center justify-center min-h-[50vh]">
              <div className="w-10 h-10 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin"></div>
              <p className="mt-4 text-slate-500 font-bold">Loading Your Documents...</p>
          </div>
      );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-500 pb-28 relative">
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 mb-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Active Processing</h2>
          <p className="text-base text-slate-600 mt-1">Manage documents currently assigned to you or created by you.</p>
        </div>
      </div>

      <div className="flex flex-col gap-4 mb-6">
          <div className="flex items-center gap-3 w-full">
              <div className="relative flex-1">
                  <Search className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 sm:w-5 sm:h-5" />
                  <input 
                    type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by Title, ID, Location, or Assigned Name..." 
                    className="w-full pl-10 sm:pl-11 pr-10 py-2.5 sm:py-3 rounded-xl border border-slate-300 focus:bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 outline-none font-semibold text-slate-800 placeholder:text-slate-400 transition-all text-sm sm:text-[15px] shadow-sm bg-white" 
                  />
                  {searchQuery && (
                      <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all active:scale-90"><X className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={3} /></button>
                  )}
              </div>
              <button 
                  onClick={() => refetch()} disabled={isFetching}
                  className="p-2.5 sm:py-3 sm:px-4 bg-white border border-slate-300 rounded-xl text-slate-600 hover:bg-slate-50 hover:text-teal-600 shadow-sm transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 shrink-0"
              >
                  <RefreshCw size={18} className={isFetching ? "animate-spin text-teal-600" : ""} />
                  <span className="hidden sm:inline font-bold text-sm">Refresh</span>
              </button>
          </div>

          <div className="flex flex-nowrap overflow-x-auto scrollbar-hide gap-2 sm:gap-3 w-full">
              <TabButton 
                label="Active Routing" icon={<Activity size={20} strokeWidth={activeTab === 'processing' ? 3 : 2} />} count={documents.processing.length} newCount={newProcessingCount}
                isActive={activeTab === 'processing'} onClick={() => { setActiveTab('processing'); setSearchQuery(''); }} 
                colorClass="bg-teal-600 text-white" badgeClass="bg-teal-500 text-white border-teal-400"
              />
              <TabButton 
                label="Action Needed" icon={<CornerUpLeft size={20} strokeWidth={activeTab === 'returned' ? 3 : 2} />} count={documents.returned.length} newCount={newReturnedCount}
                isActive={activeTab === 'returned'} onClick={() => { setActiveTab('returned'); setSearchQuery(''); }} 
                colorClass="bg-amber-600 text-white" badgeClass="bg-amber-500 text-white border-amber-400"
              />
          </div>
      </div>

      <div key={activeTab} className="animate-in fade-in zoom-in-[0.97] duration-300 ease-out fill-mode-both">
          
          {/* --- ICON LEGEND --- */}
          {activeTab === 'processing' && (
              <div className="flex items-center justify-center sm:justify-start gap-4 mb-5 px-2">
                  <div className="flex items-center gap-1.5">
                      <div className="w-[18px] h-[18px] flex items-center justify-center bg-amber-50 text-amber-600 border border-amber-200 rounded-[4px] shadow-sm">
                          <AlertCircle size={11} strokeWidth={2.5}/>
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Pending</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                      <div className="w-[18px] h-[18px] flex items-center justify-center bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-[4px] shadow-sm">
                          <CheckCircle size={11} strokeWidth={2.5}/>
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Received</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                      <div className="w-[18px] h-[18px] flex items-center justify-center bg-rose-50 text-rose-600 border border-rose-200 rounded-[4px] shadow-sm">
                          <Zap size={11} strokeWidth={2.5}/>
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Rush</span>
                  </div>
              </div>
          )}

          {filteredDocs.length === 0 && (
              <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-10 flex flex-col items-center justify-center text-center">
                  <div className="bg-white p-4 border-2 border-slate-100 rounded-xl mb-4 shadow-sm">
                    {activeTab === 'processing' ? <Search size={36} className="text-slate-400" /> : <CheckCircle size={36} className="text-emerald-500" />}
                  </div>
                  <h3 className="text-xl font-black text-slate-900 mb-2">{activeTab === 'processing' ? 'No documents found' : 'Inbox Zero!'}</h3>
                  <p className="text-base font-medium text-slate-500 max-w-md">{activeTab === 'processing' ? 'You currently have no active documents assigned to you.' : 'You have no returned documents requiring your attention. Great job!'}</p>
              </div>
          )}

          {filteredDocs.length > 0 && activeTab === 'processing' ? (
              <div className="space-y-12">
                  {nestedProcessingGroups.map(({ destination, clerks }) => (
                      <div key={destination} className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                          <div className="flex items-center gap-3 mb-4 mt-2">
                              <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 shadow-sm">
                                  <MapPin size={12} className="text-teal-600" />
                                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">{destination}</span>
                              </div>
                              <div className="h-px bg-slate-200 flex-1"></div>
                          </div>
                          
                          <div className="space-y-6 pl-1 sm:pl-2">
                              {clerks.map(([clerkName, clerkDocs]) => (
                                  <div key={clerkName} className="space-y-3">
                                      <div className="flex items-center gap-2 pl-1">
                                          <span className="text-[10px] font-bold text-slate-400">({clerkDocs.length}) managed by {clerkName}</span>
                                          <div className="h-px bg-slate-200/80 flex-1"></div>
                                      </div>

                                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                                          {clerkDocs.map(doc => (
                                              <DocumentCard 
                                                key={doc.id} doc={doc} activeTab={activeTab} isSelected={selectedDocs.some(d => d.id === doc.id)}
                                                isExpanded={!!expandedCards[doc.id]} showCheckbox={clerkDocCounts[doc.assigned_clerk || 'Unassigned'] > 1 && (!selectedDocs.length || selectedDocs[0].assigned_clerk === (doc.assigned_clerk || 'Unassigned'))}
                                                currentUserName={data?.currentUserName || ''} currentUserId={data?.currentUserId || ''}
                                                onToggleSelection={(d: DocumentItem) => setSelectedDocs((prev: DocumentItem[]) => prev.some((x: DocumentItem) => x.id === d.id) ? prev.filter((x: DocumentItem) => x.id !== d.id) : [...prev, d])}
                                                onToggleCollapse={(id: string) => setExpandedCards((prev: Record<string, boolean>) => ({...prev, [id]: !prev[id]}))}
                                                onPreview={(url: string) => setPreviewDocUrl(url)} onTrack={(d: DocumentItem) => setTrailDoc(d)}
                                                onReassign={(d: DocumentItem) => setReassignDoc(d)} 
                                                onAction={(d: DocumentItem) => setSelectedDoc(d)}
                                                onCancel={(d: DocumentItem) => setCancelDoc(d)}
                                                onRevise={(d: DocumentItem) => setReRouteDoc(d)}
                                                onReceive={(d: DocumentItem) => setReceiveDoc(d)}
                                                onDecline={(d: DocumentItem) => setDeclineDoc(d)}
                                              />
                                          ))}
                                      </div>
                                  </div>
                              ))}
                          </div>
                      </div>
                  ))}
              </div>
          ) : (
              filteredDocs.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                      {filteredDocs.map((doc: DocumentItem) => (
                          <DocumentCard 
                            key={doc.id} doc={doc} activeTab={activeTab} isSelected={selectedDocs.some(d => d.id === doc.id)}
                            isExpanded={!!expandedCards[doc.id]} showCheckbox={clerkDocCounts[doc.assigned_clerk || 'Unassigned'] > 1 && (!selectedDocs.length || selectedDocs[0].assigned_clerk === (doc.assigned_clerk || 'Unassigned'))}
                            currentUserName={data?.currentUserName || ''} currentUserId={data?.currentUserId || ''}
                            onToggleSelection={(d: DocumentItem) => setSelectedDocs((prev: DocumentItem[]) => prev.some((x: DocumentItem) => x.id === d.id) ? prev.filter((x: DocumentItem) => x.id !== d.id) : [...prev, d])}
                            onToggleCollapse={(id: string) => setExpandedCards((prev: Record<string, boolean>) => ({...prev, [id]: !prev[id]}))}
                            onPreview={(url: string) => setPreviewDocUrl(url)} onTrack={(d: DocumentItem) => setTrailDoc(d)}
                            onReassign={(d: DocumentItem) => setReassignDoc(d)} 
                            onCancel={(d: DocumentItem) => setCancelDoc(d)}
                            onRevise={(d: DocumentItem) => setReRouteDoc(d)}
                            onReceive={(d: DocumentItem) => setReceiveDoc(d)}
                            onDecline={(d: DocumentItem) => setDeclineDoc(d)}
                          />
                      ))}
                  </div>
              )
          )}
      </div>

      {activeTab === 'processing' && (
          <div className={`fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-[1000] flex flex-col items-end transition-all duration-500 ease-[cubic-bezier(0.175,0.885,0.32,1.275)] ${selectedDocs.length > 0 ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto' : 'opacity-0 scale-50 translate-y-12 pointer-events-none'}`}>
              <button 
                  onClick={handleToggleBatchMenu} 
                  className="relative flex items-center justify-center w-14 h-14 bg-teal-700 hover:bg-teal-800 text-white rounded-[1.25rem] shadow-lg shadow-teal-900/30 transition-all active:scale-95 z-10 group"
              >
                  <div className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${isBatchModalOpen ? 'opacity-0 -rotate-90 scale-50' : 'opacity-100 rotate-0 scale-100'}`}>
                      <Layers size={24} strokeWidth={2.5} className="group-hover:scale-110 transition-transform" />
                  </div>
                  <div className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${isBatchModalOpen && !isBatchMenuClosing ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 rotate-90 scale-50'}`}>
                      <X size={26} strokeWidth={2.5} />
                  </div>
                  <span className={`absolute -top-2 -right-2 bg-rose-500 text-white text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-full shadow-sm ring-2 ring-white transition-all duration-300 ${isBatchModalOpen ? 'opacity-0 scale-50' : 'opacity-100 scale-100'}`}>
                      {selectedDocs.length}
                  </span>
              </button>
          </div>
      )}

      {isBatchModalOpen && (
          <BatchActionModal 
            selectedDocs={selectedDocs} 
            currentUserName={data?.currentUserName || ''} 
            onClose={handleToggleBatchMenu} 
            onSuccess={() => { 
                handleToggleBatchMenu(); 
                setTimeout(() => { setSelectedDocs([]); refetch(); }, 200);
            }}
            onClearSelection={() => {
                handleToggleBatchMenu(); 
                setTimeout(() => setSelectedDocs([]), 200);        
            }}
            isClosingProp={isBatchMenuClosing}
          />
      )}

      {/* Modals */}
      {reassignDoc && <ReassignModal doc={reassignDoc} currentUserName={data?.currentUserName || ''} onClose={() => setReassignDoc(null)} onSuccess={() => refetch()} />}
      {cancelDoc && <CancelModal doc={cancelDoc} onClose={() => setCancelDoc(null)} onSuccess={() => refetch()} />}
      {reRouteDoc && <ReRouteModal doc={reRouteDoc} currentUserName={data?.currentUserName || ''} currentUserId={data?.currentUserId || ''} departments={departments} colleagues={availableColleagues} onClose={() => setReRouteDoc(null)} onSuccess={() => refetch()} />}
      
      {selectedDoc && <HandoverScreen doc={selectedDoc} onBack={() => setSelectedDoc(null)} onSuccess={() => refetch()} />}
      {trailDoc && <DigitalTrailModal doc={trailDoc} onBack={() => setTrailDoc(null)} />}
      {previewDocUrl && <FilePreviewModal url={previewDocUrl} onClose={() => setPreviewDocUrl(null)} />}
      
      {/* THE HANDSHAKE MODALS */}
      {declineDoc && <DeclineModal doc={declineDoc} currentUserName={data?.currentUserName || ''} onClose={() => setDeclineDoc(null)} onSuccess={() => refetch()} />}
      {receiveDoc && <ReceiveModal doc={receiveDoc} currentUserDept={data?.currentUserDept || ''} currentUserName={data?.currentUserName || ''} onClose={() => setReceiveDoc(null)} onSuccess={() => refetch()} />}
    </div>
  );
}

// ==========================================
// INLINE HELPERS & MODALS
// ==========================================

function TabButton({ label, icon, count, isActive, onClick, colorClass, badgeClass, newCount = 0 }: { label: string, icon: React.ReactNode, count: number, isActive: boolean, onClick: () => void, colorClass: string, badgeClass: string, newCount?: number }) {
    return (
        <button onClick={onClick} title={label} className={`relative flex-none shrink-0 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-95 active:shadow-inner text-sm whitespace-nowrap overflow-hidden border-2 ${isActive ? `${colorClass} border-transparent shadow-sm` : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-700'}`}>
            {newCount > 0 && !isActive && <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 border border-white"></span></span>}
            {icon}{isActive && <span className="animate-in fade-in slide-in-from-left-2 duration-200">{label}</span>}
            <div className="flex items-center gap-1.5">
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] border ${isActive ? badgeClass : 'bg-slate-100 border-slate-200 text-slate-600'}`}>{count}</span>
                {newCount > 0 && !isActive && <span className="text-[9px] font-black text-white bg-red-500 px-1.5 py-0.5 rounded shadow-sm animate-in zoom-in flex items-center">{newCount} NEW</span>}
            </div>
        </button>
    );
}

// ==========================================
// RECEIVE CONFIRMATION MODAL (RPC IMPLEMENTATION)
// ==========================================
interface ReceiveModalProps {
    doc: DocumentItem;
    currentUserDept: string;
    currentUserName: string;
    onClose: () => void;
    onSuccess: () => void;
}

function ReceiveModal({ doc, currentUserDept, currentUserName, onClose, onSuccess }: ReceiveModalProps) {
    const [isReceiving, setIsReceiving] = useState(false);
    const [isClosing, setIsClosing] = useState(false);

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => onClose(), 200);
    };

    const handleConfirm = async () => {
        setIsReceiving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser(); 
            const newLocation = currentUserDept || doc.current_location;
            
            const { error: rpcError } = await supabase.rpc('process_document_action', {
                p_doc_id: doc.id,
                p_log_action: 'Document Received',
                p_log_location: newLocation,
                p_log_created_by: user?.id,
                p_log_assigned_to: currentUserName,
                p_log_remarks: 'Digital handshake completed. Custody accepted.',
                p_new_status: 'routing',
                p_new_location: newLocation
            });
            
            if (rpcError) throw rpcError;

            toast.success("Document Received", { description: "You have officially accepted custody." });
            onSuccess();
            handleClose();
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
            toast.error("Handshake Failed", { description: errorMessage });
        } finally {
            setIsReceiving(false);
        }
    };

    return (
        <div className={`fixed inset-0 z-[1050] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/70 backdrop-blur-sm transition-all ${isClosing ? 'animate-out fade-out duration-200 fill-mode-forwards' : 'animate-in fade-in duration-200'}`}>
            <div className={`bg-white w-full max-w-md flex flex-col overflow-hidden shadow-2xl rounded-t-[1.5rem] sm:rounded-3xl ${isClosing ? 'animate-out slide-out-to-bottom-[100%] sm:slide-out-to-bottom-0 sm:zoom-out-95 duration-200 fill-mode-forwards' : 'animate-in slide-in-from-bottom-[100%] sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300'}`}>
                
                <div className="text-emerald-600 bg-emerald-50 border-b border-emerald-100 relative flex flex-col shrink-0">
                    <div className="w-16 h-1.5 bg-emerald-200 rounded-full mx-auto mt-3 sm:hidden shrink-0"></div>
                    <div className="p-5 pt-3 sm:pt-6 flex items-center justify-between">
                        <div className="w-10"></div> 
                        <h3 className="font-black text-xl tracking-tight absolute left-1/2 -translate-x-1/2 whitespace-nowrap">Receive Document</h3>
                        <button onClick={handleClose} disabled={isReceiving} className="p-2 -mr-2 bg-emerald-100 hover:bg-emerald-200 rounded-full transition-all active:scale-90 disabled:opacity-50">
                            <X size={20} className="text-emerald-700" />
                        </button>
                    </div>
                </div>
                
                <div className="p-6 sm:p-8 space-y-4 bg-white text-center">
                    <div className="mx-auto w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-2">
                        <CheckCircle size={32} className="text-emerald-600" />
                    </div>
                    <h4 className="text-lg font-bold text-slate-900 leading-tight">Confirm Receipt</h4>
                    <p className="text-sm text-slate-600 font-medium">
                        By confirming, you formally accept custody of <strong className="text-slate-800">{doc.reference_no}</strong>. This will be logged in the digital trail.
                    </p>
                </div>
                
                <div className="bg-slate-50 p-4 sm:p-5 flex gap-3 shrink-0 border-t border-slate-200">
                    <button onClick={handleClose} disabled={isReceiving} className="flex-1 py-3.5 bg-white border-2 border-slate-300 text-slate-700 font-bold rounded-xl active:scale-95 transition-all text-sm">Cancel</button>
                    <button 
                        onClick={handleConfirm} 
                        disabled={isReceiving} 
                        className="flex-[1.5] py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl active:scale-95 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:bg-emerald-400 shadow-sm"
                    >
                        {isReceiving ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : 'Yes, Receive Document'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ==========================================
// DECLINE MODAL COMPONENT (RPC IMPLEMENTATION)
// ==========================================
interface DeclineModalProps {
    doc: DocumentItem;
    currentUserName: string;
    onClose: () => void;
    onSuccess: () => void;
}

function DeclineModal({ doc, currentUserName, onClose, onSuccess }: DeclineModalProps) {
    const [reason, setReason] = useState("");
    const [isDeclining, setIsDeclining] = useState(false);
    const [isClosing, setIsClosing] = useState(false);

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => onClose(), 200);
    };

    const handleConfirm = async () => {
        if (!reason.trim()) {
            toast.error("Reason Required", { description: "Please provide a reason for declining." });
            return;
        }

        setIsDeclining(true);
        try {
            const { data: { user } } = await supabase.auth.getUser(); 
            
            let creatorName = 'Creator / Sender';
            let originOffice = 'Originating Office';
            
            if (doc.created_by) {
                try {
                    const { data: creatorData } = await supabase.from('profiles').select('full_name').eq('id', doc.created_by).single();
                    if (creatorData?.full_name) {
                        creatorName = creatorData.full_name;
                        const { data: empData } = await supabase.from('employees').select('department').eq('name', creatorName).single();
                        if (empData?.department) originOffice = empData.department;
                    }
                } catch (e) {
                    console.warn("Could not fetch creator details", e);
                }
            }
            
            const { error: rpcError } = await supabase.rpc('process_document_action', {
                p_doc_id: doc.id,
                p_log_action: 'Returned',
                p_log_location: originOffice, 
                p_log_created_by: user?.id,
                p_log_assigned_to: creatorName,
                p_log_remarks: `Declined by: ${currentUserName}\nReason: ${reason}`,
                p_new_status: 'routing', 
                p_new_location: originOffice, 
                p_new_clerk: creatorName, 
                p_new_remarks: `Declined by: ${currentUserName}\nReason: ${reason}`
            });
            
            if (rpcError) throw rpcError;

            toast.success("Document Declined", { description: "It has been returned to the sender." });
            onSuccess();
            handleClose();
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
            toast.error("Failed to decline", { description: errorMessage });
        } finally {
            setIsDeclining(false);
        }
    };

    return (
        <div className={`fixed inset-0 z-[1050] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/70 backdrop-blur-sm transition-all ${isClosing ? 'animate-out fade-out duration-200 fill-mode-forwards' : 'animate-in fade-in duration-200'}`}>
            <div className={`bg-white w-full max-w-lg max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden shadow-2xl rounded-t-[1.5rem] sm:rounded-3xl ${isClosing ? 'animate-out slide-out-to-bottom-[100%] sm:slide-out-to-bottom-0 sm:zoom-out-95 duration-200 fill-mode-forwards' : 'animate-in slide-in-from-bottom-[100%] sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300'}`}>
                
                <div className="text-rose-600 bg-rose-50 border-b border-rose-100 relative flex flex-col shrink-0">
                    <div className="w-16 h-1.5 bg-rose-200 rounded-full mx-auto mt-3 sm:hidden shrink-0"></div>
                    <div className="p-5 pt-3 sm:pt-6 flex items-center justify-between">
                        <div className="w-10"></div> 
                        <h3 className="font-black text-xl tracking-tight absolute left-1/2 -translate-x-1/2 whitespace-nowrap">Decline Document</h3>
                        <button onClick={handleClose} disabled={isDeclining} className="p-2 -mr-2 bg-rose-100 hover:bg-rose-200 rounded-full transition-all active:scale-90 disabled:opacity-50">
                            <X size={20} className="text-rose-700" />
                        </button>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-6 custom-scrollbar bg-white">
                    <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Reason for Declining *</label>
                        <textarea 
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Why are you rejecting this document?" 
                            className="w-full p-4 bg-slate-50 border-2 border-slate-200 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 rounded-xl outline-none font-medium text-slate-900 text-sm transition-all min-h-[120px] resize-y"
                            autoFocus
                        />
                    </div>
                </div>
                
                <div className="bg-white p-4 sm:p-5 flex gap-3 shrink-0 border-t border-slate-50">
                    <button onClick={handleClose} disabled={isDeclining} className="flex-1 py-3.5 bg-white border-2 border-slate-200 text-slate-600 font-bold rounded-xl active:scale-95 transition-all text-sm">Cancel</button>
                    <button 
                        onClick={handleConfirm} 
                        disabled={isDeclining || !reason.trim()} 
                        className="flex-[1.5] py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl active:scale-95 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:bg-rose-400 shadow-sm"
                    >
                        {isDeclining ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : <><Ban size={18} strokeWidth={2.5} /> Confirm Decline</>}
                    </button>
                </div>
            </div>
        </div>
    );
}