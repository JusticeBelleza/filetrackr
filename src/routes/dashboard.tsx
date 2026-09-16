import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Activity, ArrowRight, CheckCircle2, Plus,
    Sparkles, Clock, AlertTriangle, X,
    Building2, Phone, Mail, ChevronDown, Search, MapPin, Users
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { useUiStore } from '../store/uiStore';
import { useQuery, useQueryClient } from '@tanstack/react-query';

// --- Shared Animation Styles ---
const modalAnimationStyles = `
    @keyframes customFadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes customFadeOut { from { opacity: 1; } to { opacity: 0; } }
    
    @keyframes slideInLeft { from { transform: translateX(-100vw); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes slideOutRight { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100vw); opacity: 0; } }
    
    @keyframes desktopZoomIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    @keyframes desktopZoomOut { from { transform: scale(1); opacity: 1; } to { transform: scale(0.95); opacity: 0; } }
    
    .animate-overlay-fade { animation: customFadeIn 0.15s ease-out forwards; }
    .animate-overlay-fade-out { animation: customFadeOut 0.15s ease-in forwards; }

    .animate-responsive-modal { animation: slideInLeft 0.25s cubic-bezier(0.25, 1, 0.3, 1) forwards; will-change: transform; }
    .animate-responsive-modal-close { animation: slideOutRight 0.25s cubic-bezier(0.3, 0, 0.8, 0.15) forwards; will-change: transform; }

    .scrollbar-hide::-webkit-scrollbar { display: none; }
    .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }

    .custom-scrollbar::-webkit-scrollbar { width: 6px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 20px; }

    @media (min-width: 640px) {
        .animate-responsive-modal { animation: desktopZoomIn 0.2s cubic-bezier(0.25, 1, 0.3, 1) forwards; }
        .animate-responsive-modal-close { animation: desktopZoomOut 0.15s cubic-bezier(0.3, 0, 0.8, 0.15) forwards; }
    }
`;

interface DocumentItem {
    id: string;
    reference_no?: string;
    title?: string;
    category?: string;
    status: string;
    current_location?: string;
    assigned_clerk?: string;
    is_urgent?: boolean;
    remarks?: string;
    created_at: string;
    updated_at: string;
}

interface ActivityLog {
    id: string;
    action: string;
    remarks?: string | null;
    created_at: string;
    documents?: {
        reference_no?: string;
        title?: string;
    } | {
        reference_no?: string;
        title?: string;
    }[];
}

function timeAgo(dateParam: string) {
    if (!dateParam) return '';
    const date = new Date(dateParam);
    const today = new Date();
    const seconds = Math.round((today.getTime() - date.getTime()) / 1000);
    const minutes = Math.round(seconds / 60);
    const hours = Math.round(minutes / 60);
    const days = Math.round(hours / 24);

    if (seconds < 60) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
}

function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
}

function getSmartBriefing(userName: string, active: number, rush: number, returned: number) {
    const greeting = getGreeting();
    let mainText = "";
    let urgentText = null;
    let returnedText = null;

    if (active === 0 && returned === 0) {
        mainText = `${greeting}, ${userName}! Great news—your desk is completely clear right now. Grab a coffee or check on the team.`;
    } else if (active > 0 && rush === 0) {
        if (active <= 3) {
            mainText = `${greeting}, ${userName}. You've got a fairly light load today with just ${active} document${active > 1 ? 's' : ''} in your queue.`;
        } else {
            mainText = `${greeting}, ${userName}. It's looking like a steady day ahead. You have ${active} documents to process, but luckily none of them are rushing you.`;
        }
    } else if (rush > 0) {
         mainText = `${greeting}, ${userName}. You have ${active} document${active > 1 ? 's' : ''} on your desk, and `;
         urgentText = `${rush} of them ${rush > 1 ? 'need' : 'needs'} your immediate attention right now.`;
    }

    if (returned > 0) {
        returnedText = `⚠️ Heads up: ${returned} document${returned > 1 ? 's were' : ' was'} returned to you for corrections.`;
    }

    return { mainText, urgentText, returnedText };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const openCreateModal = useUiStore((state) => state.openCreateModal);
  
  const [activityPage, setActivityPage] = useState(1);
  const ACTIVITY_PER_PAGE = 5;

  // Directory States
  const [isDirOpen, setIsDirOpen] = useState(false);
  const [dirSearch, setDirSearch] = useState('');
  const [dirPage, setDirPage] = useState(1);
  const DIR_PER_PAGE = 4;

  // SLA Modal States
  const [selectedSla, setSelectedSla] = useState<'healthy' | 'warning' | 'critical' | null>(null);
  const [slaModalPage, setSlaModalPage] = useState(1);
  const [isClosingSla, setIsClosingSla] = useState(false);
  const SLA_MODAL_PER_PAGE = 5;

  const closeSlaModal = () => {
      setIsClosingSla(true);
      setTimeout(() => {
          setSelectedSla(null);
          setIsClosingSla(false);
          setSlaModalPage(1);
      }, 250);
  };

  // =========================================
  // 🚀 REACT QUERY: FETCH USER, BRIEFING & SLA
  // =========================================
  const { data: userData, isLoading } = useQuery({
    queryKey: ['dashboardUserData'],
    queryFn: async () => {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) throw new Error("Authentication required");
      const currentUserId = session.user.id;

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, has_accepted_legal')
        .eq('id', currentUserId)
        .single();

      if (profileError) throw profileError;

      if (profile?.has_accepted_legal === false) {
        await supabase.auth.signOut();
        toast.error("Access Denied", { description: "You must review policies before accessing." });
        navigate('/', { replace: true });
        throw new Error("Legal agreements not accepted");
      }

      const currentUserName = profile?.full_name || '';
      const firstName = currentUserName.split(' ')[0];

      let userDepartment = '';
      if (currentUserName) {
          const { data: empData } = await supabase.from('employees').select('department').eq('name', currentUserName).single();
          if (empData?.department) userDepartment = empData.department;
      }

      const { data: myDocs } = await supabase
          .from('documents')
          .select('id, reference_no, title, category, is_urgent, remarks, status, updated_at, created_at')
          .eq('assigned_clerk', currentUserName)
          .neq('status', 'sealed')
          .neq('status', 'cancelled');

      const safeDocs = myDocs || [];
      const activeCount = safeDocs.filter(d => !d.remarks).length;
      const rushCount = safeDocs.filter(d => d.is_urgent).length;
      const returnedCount = safeDocs.filter(d => !!d.remarks).length;

      const now = new Date();
      const slaDocs: { healthy: DocumentItem[], warning: DocumentItem[], critical: DocumentItem[] } = {
          healthy: [],
          warning: [],
          critical: []
      };

      safeDocs.forEach(doc => {
          const dateToUse = doc.updated_at ? new Date(doc.updated_at) : new Date(doc.created_at);
          const diffHours = (now.getTime() - dateToUse.getTime()) / (1000 * 60 * 60);
          
          if (diffHours >= 48) {
              slaDocs.critical.push(doc as DocumentItem);
          } else if (diffHours >= 24) {
              slaDocs.warning.push(doc as DocumentItem);
          } else {
              slaDocs.healthy.push(doc as DocumentItem);
          }
      });

      return {
          userName: firstName,
          currentUserName,
          currentUserId,
          userDepartment,
          briefing: { activeCount, rushCount, returnedCount },
          sla: {
              healthyCount: slaDocs.healthy.length,
              warningCount: slaDocs.warning.length,
              criticalCount: slaDocs.critical.length,
              docs: slaDocs
          }
      };
    }
  });

  // =========================================
  // 🚀 REACT QUERY: RECENT ACTIVITY
  // =========================================
  const currentUserId = userData?.currentUserId;
  const { data: recentActivity = [] } = useQuery({
      queryKey: ['recentActivity', currentUserId],
      queryFn: async () => {
          if (!currentUserId) return [];
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          
          const { data } = await supabase
              .from('document_logs')
              .select('id, action, remarks, created_at, documents(reference_no, title)')
              .gte('created_at', thirtyDaysAgo.toISOString())
              .order('created_at', { ascending: false })
              .limit(50); 
          return data || [];
      },
      enabled: !!currentUserId
  });

  // =========================================
  // 🚀 REACT QUERY: DEPARTMENTS DIRECTORY
  // =========================================
  const { data: departmentsData = [] } = useQuery({
      queryKey: ['dashboardDepartmentsDirectory'],
      queryFn: async () => {
          const { data } = await supabase.from('departments').select('*').order('name');
          return data || [];
      }
  });

  const filteredDepts = departmentsData.filter((dept: any) => 
      dept.name?.toLowerCase().includes(dirSearch.toLowerCase()) || 
      dept.office_address?.toLowerCase().includes(dirSearch.toLowerCase()) ||
      dept.department_head?.toLowerCase().includes(dirSearch.toLowerCase())
  );
  
  const totalDirPages = Math.ceil(filteredDepts.length / DIR_PER_PAGE);
  const paginatedDepts = filteredDepts.slice((dirPage - 1) * DIR_PER_PAGE, dirPage * DIR_PER_PAGE);

  const totalActivityPages = Math.ceil(recentActivity.length / ACTIVITY_PER_PAGE);
  const paginatedActivity = recentActivity.slice(
      (activityPage - 1) * ACTIVITY_PER_PAGE, 
      activityPage * ACTIVITY_PER_PAGE
  );

  const currentSlaDocs = (selectedSla && userData?.sla?.docs[selectedSla]) || [];
  const totalModalPages = Math.ceil(currentSlaDocs.length / SLA_MODAL_PER_PAGE);
  const paginatedModalDocs = currentSlaDocs.slice(
      (slaModalPage - 1) * SLA_MODAL_PER_PAGE,
      slaModalPage * SLA_MODAL_PER_PAGE
  );

  useEffect(() => {
      if (!userData?.currentUserName) return;
      const channel = supabase
          .channel('dashboard-document-updates')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, () => {
              queryClient.invalidateQueries({ queryKey: ['dashboardUserData'] });
              queryClient.invalidateQueries({ queryKey: ['recentActivity'] });
          }).subscribe();

      return () => { supabase.removeChannel(channel); };
  }, [userData?.currentUserName, queryClient]);

  if (isLoading) {
      return (
          <div className="flex flex-col items-center justify-center min-h-[50vh]">
              <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
      );
  }

  const smartBriefing = getSmartBriefing(
      userData?.userName || 'User',
      userData?.briefing?.activeCount || 0,
      userData?.briefing?.rushCount || 0,
      userData?.briefing?.returnedCount || 0
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-500 pb-12">
      <style>{modalAnimationStyles}</style>

      {/* --- HEADER --- */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4 mb-2 sm:mb-4">
          <div>
              <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
                  Welcome, {userData?.userName || 'User'}! 👋
              </h1>
          </div>
          <button 
              onClick={openCreateModal}
              className="hidden sm:flex w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-6 rounded-xl items-center justify-center gap-2 shadow-sm hover:shadow-md transition-all active:scale-95 border-2 border-blue-600"
          >
              <Plus size={20} strokeWidth={3} /> Route Document
          </button>
      </div>

      {/* --- 1. SMART DAILY OVERVIEW WIDGET --- */}
      <div className="bg-gradient-to-br from-blue-900 to-indigo-900 rounded-[1.5rem] p-6 sm:p-8 shadow-md relative overflow-hidden text-white">
          <div className="absolute -top-10 -right-10 opacity-10">
              <Sparkles size={200} />
          </div>
          <div className="relative z-10">
              <div className="flex items-center gap-2 text-blue-200 mb-3 font-bold uppercase tracking-wider text-xs">
                  <Sparkles size={14} className="text-amber-400" /> Daily Overview
              </div>
              <div className="text-base sm:text-lg text-blue-50 leading-relaxed max-w-3xl">
                  <p>
                      {smartBriefing.mainText}
                      {smartBriefing.urgentText && (
                          <span className="font-black text-white ml-1">{smartBriefing.urgentText}</span>
                      )}
                  </p>
                  {smartBriefing.returnedText && (
                      <div className="mt-3 inline-block bg-amber-900/40 border border-amber-500/30 text-amber-300 font-bold px-3 py-1.5 rounded-lg text-sm shadow-sm backdrop-blur-sm">
                          {smartBriefing.returnedText}
                      </div>
                  )}
              </div>
          </div>
      </div>

      {/* --- CONTENT GRID --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* --- 2. SLA COMPLIANCE MONITOR --- */}
          <div className="bg-white border border-slate-200 rounded-[1.5rem] shadow-sm flex flex-col overflow-hidden max-h-[350px]">
              <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
                  <h3 className="text-[15px] font-black text-slate-900 flex items-center gap-2">
                      <Clock size={18} className="text-blue-600" /> Turnaround Monitor
                  </h3>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Assigned SLA</span>
              </div>
              
              <div className="p-5 grid grid-cols-3 gap-3 sm:gap-4 flex-1 items-center">
                  <button 
                      onClick={() => { setSelectedSla('healthy'); setSlaModalPage(1); }}
                      className="bg-emerald-50/50 border-2 border-emerald-100 rounded-xl sm:rounded-2xl py-6 px-2 flex flex-col items-center justify-center text-center transition-all hover:bg-emerald-50 hover:border-emerald-300 active:scale-95 focus:outline-none focus:ring-4 focus:ring-emerald-500/20"
                  >
                      <div className="p-1.5 sm:p-2 bg-emerald-100 text-emerald-600 rounded-full mb-2 sm:mb-3 shadow-sm">
                          <CheckCircle2 size={16} className="sm:w-5 sm:h-5" strokeWidth={3} />
                      </div>
                      <h4 className="text-2xl sm:text-3xl font-black text-emerald-700 leading-none">{userData?.sla?.healthyCount || 0}</h4>
                      <p className="text-[9px] sm:text-[10px] font-bold text-emerald-600 uppercase tracking-widest mt-1.5 sm:mt-2">Healthy</p>
                      <p className="text-[9px] sm:text-[10px] font-medium text-emerald-600/70 mt-0.5 sm:mt-1">&lt; 24 hrs</p>
                  </button>

                  <button 
                      onClick={() => { setSelectedSla('warning'); setSlaModalPage(1); }}
                      className="bg-amber-50/50 border-2 border-amber-100 rounded-xl sm:rounded-2xl py-6 px-2 flex flex-col items-center justify-center text-center transition-all hover:bg-amber-50 hover:border-amber-300 active:scale-95 focus:outline-none focus:ring-4 focus:ring-amber-500/20"
                  >
                      <div className="p-1.5 sm:p-2 bg-amber-100 text-amber-600 rounded-full mb-2 sm:mb-3 shadow-sm">
                          <Clock size={16} className="sm:w-5 sm:h-5" strokeWidth={3} />
                      </div>
                      <h4 className="text-2xl sm:text-3xl font-black text-amber-700 leading-none">{userData?.sla?.warningCount || 0}</h4>
                      <p className="text-[9px] sm:text-[10px] font-bold text-amber-600 uppercase tracking-widest mt-1.5 sm:mt-2">Warning</p>
                      <p className="text-[9px] sm:text-[10px] font-medium text-amber-600/70 mt-0.5 sm:mt-1">24 - 48 hrs</p>
                  </button>

                  <button 
                      onClick={() => { setSelectedSla('critical'); setSlaModalPage(1); }}
                      className="bg-red-50/50 border-2 border-red-100 rounded-xl sm:rounded-2xl py-6 px-2 flex flex-col items-center justify-center text-center transition-all hover:bg-red-50 hover:border-red-300 active:scale-95 focus:outline-none focus:ring-4 focus:ring-red-500/20"
                  >
                      <div className="p-1.5 sm:p-2 bg-red-100 text-red-600 rounded-full mb-2 sm:mb-3 shadow-sm">
                          <AlertTriangle size={16} className="sm:w-5 sm:h-5" strokeWidth={3} />
                      </div>
                      <h4 className="text-2xl sm:text-3xl font-black text-red-700 leading-none">{userData?.sla?.criticalCount || 0}</h4>
                      <p className="text-[9px] sm:text-[10px] font-bold text-red-600 uppercase tracking-widest mt-1.5 sm:mt-2">Critical</p>
                      <p className="text-[9px] sm:text-[10px] font-medium text-red-600/70 mt-0.5 sm:mt-1">&gt; 48 hrs</p>
                  </button>
              </div>
          </div>

          {/* --- 3. RECENT ACTIVITY --- */}
          <div className="bg-white border border-slate-200 rounded-[1.5rem] shadow-sm overflow-hidden flex flex-col h-[350px]">
              <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
                  <h3 className="text-[15px] font-black text-slate-900 flex items-center gap-2">
                      <Activity size={18} className="text-emerald-500" /> Recent Activity
                  </h3>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1.5">
                      <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span></span>
                      Live
                  </span>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
                  {recentActivity.length === 0 ? (
                      <p className="text-center py-4 text-sm text-slate-500 font-medium">No recent activity detected.</p>
                  ) : (
                      paginatedActivity.map((log: ActivityLog) => {
                          const isReassign = log.action === 'REASSIGNED' || log.action === 'ROUTE';
                          const Icon = isReassign ? ArrowRight : CheckCircle2;
                          const colorClass = isReassign ? 'bg-purple-50 text-purple-600' : 'bg-slate-100 text-slate-600';
                          
                          const docRef = Array.isArray(log.documents) ? log.documents[0]?.reference_no : log.documents?.reference_no;
                          const docTitle = Array.isArray(log.documents) ? log.documents[0]?.title : log.documents?.title;
                          
                          return (
                              <div key={log.id} className="flex items-start gap-3">
                                  <div className={`mt-0.5 p-1.5 ${colorClass} rounded-lg shrink-0`}>
                                      <Icon size={14} strokeWidth={3} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                      <p className="text-[13px] leading-tight line-clamp-2 mb-0.5">
                                          <span className="font-bold text-blue-600 cursor-pointer hover:underline mr-1.5">{docRef || 'Unknown'}</span>
                                          {docTitle && <span className="font-bold text-slate-800">{docTitle}</span>}
                                      </p>
                                      <p className="text-[11px] text-slate-500 font-medium leading-snug line-clamp-1">
                                          {log.remarks || `${log.action} performed`}
                                      </p>
                                      <p className="text-[10px] font-bold text-slate-400 mt-0.5">{timeAgo(log.created_at)}</p>
                                  </div>
                              </div>
                          );
                      })
                  )}
              </div>

              {totalActivityPages > 1 && (
                  <div className="p-3 border-t border-slate-100 bg-white flex items-center justify-between shrink-0">
                      <button onClick={() => setActivityPage(p => Math.max(1, p - 1))} disabled={activityPage === 1} className="px-3 py-1 text-[11px] font-bold uppercase text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 disabled:opacity-50 transition-colors">Prev</button>
                      <span className="text-[10px] font-bold uppercase text-slate-400">Page {activityPage} of {totalActivityPages}</span>
                      <button onClick={() => setActivityPage(p => Math.min(totalActivityPages, p + 1))} disabled={activityPage === totalActivityPages} className="px-3 py-1 text-[11px] font-bold uppercase text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 disabled:opacity-50 transition-colors">Next</button>
                  </div>
              )}
          </div>
      </div>

      {/* --- 4. DEPARTMENT DIRECTORY (OFFICES WITH TEXT & ICON-ONLY ACTIONS) --- */}
      <div className="bg-white border border-slate-200 rounded-[1.5rem] shadow-sm overflow-hidden flex flex-col">
          <button 
              onClick={() => setIsDirOpen(!isDirOpen)}
              className="p-5 bg-slate-50 flex items-center justify-between transition-colors hover:bg-slate-100 active:bg-slate-200 w-full group focus:outline-none"
          >
              <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Building2 size={20} strokeWidth={2.5} />
                  </div>
                  <div className="text-left">
                      <h3 className="text-[15px] sm:text-base font-black text-slate-900 leading-tight">Department Directory</h3>
                      <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">{departmentsData.length} Offices Registered</p>
                  </div>
              </div>
              <div className={`p-2 rounded-full transition-colors ${isDirOpen ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-500'}`}>
                  <ChevronDown size={20} className={`transition-transform duration-300 ${isDirOpen ? 'rotate-180' : ''}`} />
              </div>
          </button>

          <div className={`transition-all duration-300 ease-in-out ${isDirOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
              <div className="p-4 sm:p-5 border-t border-slate-100 space-y-4">
                  
                  {/* Search Bar */}
                  <div className="relative">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <input 
                          type="text" 
                          value={dirSearch}
                          onChange={(e) => { setDirSearch(e.target.value); setDirPage(1); }}
                          placeholder="Search offices, address, or head..." 
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl border-2 border-slate-100 focus:border-indigo-500 outline-none text-sm font-bold text-slate-800 placeholder:text-slate-400 bg-slate-50 focus:bg-white transition-all shadow-sm"
                      />
                  </div>

                  {/* Departments List with Pagination */}
                  <div className="space-y-3">
                      {paginatedDepts.length === 0 ? (
                          <p className="text-center py-6 text-sm text-slate-400 font-bold italic border-2 border-dashed border-slate-100 rounded-xl">No offices found.</p>
                      ) : (
                          paginatedDepts.map((dept: any) => (
                              <div key={dept.id} className="border-2 border-slate-200 rounded-2xl p-4 bg-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                  
                                  {/* Department Text Details */}
                                  <div className="flex flex-col gap-1 flex-1 min-w-0">
                                      <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">{dept.office_id || 'OFC-LEGACY'}</span>
                                      <h4 className="font-black text-slate-900 text-base leading-tight break-words">{dept.name}</h4>
                                      
                                      <span className="text-xs font-medium text-slate-600 flex items-start gap-1.5 break-words mt-0.5">
                                          <MapPin size={13} className="text-slate-400 shrink-0 mt-0.5" />
                                          {dept.office_address || dept.address || 'No address provided'}
                                      </span>

                                      {dept.department_head && (
                                          <span className="text-xs font-medium text-slate-600 flex items-start gap-1.5 break-words">
                                              <Users size={13} className="text-slate-400 shrink-0 mt-0.5" />
                                              Head: {dept.department_head}
                                          </span>
                                      )}
                                  </div>

                                  {/* Icon-Only Action Buttons */}
                                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                      {dept.contact_number && (
                                          <a 
                                              href={`tel:${dept.contact_number}`} 
                                              className="w-[40px] h-[40px] flex items-center justify-center bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 active:scale-90 transition-all border border-emerald-200 shadow-sm"
                                              title={`Call: ${dept.contact_number}`}
                                          >
                                              <Phone size={18} strokeWidth={2.5} />
                                          </a>
                                      )}
                                      {dept.email_address && (
                                          <a 
                                              href={`mailto:${dept.email_address}`} 
                                              className="w-[40px] h-[40px] flex items-center justify-center bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 active:scale-90 transition-all border border-blue-200 shadow-sm"
                                              title={`Email: ${dept.email_address}`}
                                          >
                                              <Mail size={18} strokeWidth={2.5} />
                                          </a>
                                      )}
                                  </div>
                              </div>
                          ))
                      )}
                  </div>

                  {/* Pagination Controls */}
                  {totalDirPages > 1 && (
                      <div className="flex items-center justify-between pt-3 border-t border-slate-100 px-1">
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Page {dirPage} of {totalDirPages}</span>
                          <div className="flex gap-2">
                              <button 
                                  disabled={dirPage === 1}
                                  onClick={() => setDirPage(p => Math.max(1, p - 1))}
                                  className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold disabled:opacity-50 hover:bg-slate-200 active:scale-95 transition-all"
                              >
                                  Prev
                              </button>
                              <button 
                                  disabled={dirPage === totalDirPages}
                                  onClick={() => setDirPage(p => Math.min(totalDirPages, p + 1))}
                                  className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold disabled:opacity-50 hover:bg-slate-200 active:scale-95 transition-all"
                              >
                                  Next
                              </button>
                          </div>
                      </div>
                  )}

              </div>
          </div>
      </div>

      {/* --- SLA LIST MODAL --- */}
      {selectedSla && (
          <div className={`fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm ${isClosingSla ? 'animate-overlay-fade-out' : 'animate-overlay-fade'}`}>
              <div className={`bg-white w-full max-w-md flex flex-col shadow-2xl rounded-3xl overflow-hidden ${isClosingSla ? 'animate-responsive-modal-close' : 'animate-responsive-modal'}`}>
                  
                  <div className="bg-slate-900 p-5 flex justify-between items-center text-white shrink-0">
                      <h3 className="font-black text-lg flex items-center gap-2">
                          {selectedSla === 'healthy' && <CheckCircle2 size={20} className="text-emerald-400" />}
                          {selectedSla === 'warning' && <Clock size={20} className="text-amber-400" />}
                          {selectedSla === 'critical' && <AlertTriangle size={20} className="text-red-400" />}
                          <span className="capitalize">{selectedSla} Documents</span>
                      </h3>
                      <button onClick={closeSlaModal} className="p-1 hover:bg-white/20 rounded-full transition-colors focus:outline-none">
                          <X size={20} />
                      </button>
                  </div>
                  
                  <div className="p-5 max-h-[50vh] overflow-y-auto custom-scrollbar bg-slate-50 flex-1">
                      {currentSlaDocs.length === 0 ? (
                          <div className="text-center text-slate-500 font-medium py-8 px-4">
                              <CheckCircle2 size={32} className="mx-auto text-slate-300 mb-3" />
                              <p>All clear! You have no documents in this category right now.</p>
                          </div>
                      ) : (
                          <div className="space-y-3">
                              {paginatedModalDocs.map((doc) => (
                                  <div key={doc.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-blue-300 transition-colors">
                                      <div className="flex items-center justify-between gap-2 mb-1.5">
                                          {doc.category ? (
                                              <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded tracking-wide">
                                                  {doc.category}
                                              </span>
                                          ) : <span></span>}
                                          {doc.is_urgent && (
                                              <span className="text-[10px] font-black text-red-700 bg-red-50 px-1.5 py-0.5 rounded border border-red-200 uppercase tracking-wider">
                                                  Rush
                                              </span>
                                          )}
                                      </div>
                                      <div className="mb-1">
                                          <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded font-mono tracking-wide inline-block">
                                              {doc.reference_no || doc.id}
                                          </span>
                                      </div>
                                      <span className="text-[14px] font-bold text-slate-800 leading-tight block">
                                          {doc.title || 'Untitled Document'}
                                      </span>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>

                  {totalModalPages > 1 && (
                      <div className="p-3 bg-white border-t border-slate-100 flex items-center justify-between shrink-0">
                          <button onClick={() => setSlaModalPage(p => Math.max(1, p - 1))} disabled={slaModalPage === 1} className="px-3 py-1 text-[11px] font-bold uppercase text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 disabled:opacity-50">Prev</button>
                          <span className="text-[10px] font-bold uppercase text-slate-400">Page {slaModalPage} of {totalModalPages}</span>
                          <button onClick={() => setSlaModalPage(p => Math.min(totalModalPages, p + 1))} disabled={slaModalPage === totalModalPages} className="px-3 py-1 text-[11px] font-bold uppercase text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 disabled:opacity-50">Next</button>
                      </div>
                  )}

              </div>
          </div>
      )}

    </div>
  );
}