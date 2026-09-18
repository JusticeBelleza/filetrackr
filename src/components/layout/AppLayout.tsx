import React, { useEffect, useState, useMemo } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
    FileText, Activity, History, Settings, Shield, Calendar, FilePlus 
} from 'lucide-react';
import { toast } from 'sonner';
import { useUiStore } from '../../store/uiStore';
import CreateDocumentModal from '../system/CreateDocumentModal';
import { supabase } from '../../lib/supabase';
import { useQuery, useQueryClient } from '@tanstack/react-query'; 

import InstallPrompt from '../InstallPrompt'; 
import AppUpdateModal from '../settings/AppUpdateModal';
import clearTrackLogo from '../../assets/clear_track_logo.png';

// --- Shared Modal Animation Styles ---
const modalAnimationStyles = `
    @keyframes customFadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes iosSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
    @keyframes desktopZoomIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    @keyframes customFadeOut { from { opacity: 1; } to { opacity: 0; } }
    @keyframes iosSlideDown { from { transform: translateY(0); } to { transform: translateY(100%); } }
    @keyframes desktopZoomOut { from { transform: scale(1); opacity: 1; } to { transform: scale(0.95); opacity: 0; } }
    
    .animate-overlay-fade { animation: customFadeIn 0.2s ease-out forwards; }
    .animate-overlay-fade-out { animation: customFadeOut 0.2s ease-in forwards; }
    .animate-responsive-modal { animation: iosSlideUp 0.3s cubic-bezier(0.25, 1, 0.3, 1) forwards; }
    .animate-responsive-modal-close { animation: iosSlideDown 0.25s cubic-bezier(0.3, 0, 0.8, 0.15) forwards; }

    @media (min-width: 640px) {
        .animate-responsive-modal { animation: desktopZoomIn 0.25s cubic-bezier(0.25, 1, 0.3, 1) forwards; }
        .animate-responsive-modal-close { animation: desktopZoomOut 0.2s ease-in forwards; }
    }

    .scrollbar-hide::-webkit-scrollbar { display: none; }
    .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
`;

interface NavItemProps {
    icon: React.ReactElement<{ size?: number | string; strokeWidth?: number | string }>;
    label?: string;
    to: string;
    isActive: boolean;
    notificationCount?: number; 
}

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const activeTab = location.pathname.replace('/', '') || 'dashboard';

  const isCreateModalOpen = useUiStore((state) => state.isCreateModalOpen);
  const openCreateModal = useUiStore((state) => state.openCreateModal);

  const [currentUserRole, setCurrentUserRole] = useState<'admin' | 'pho_staff' | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dateInfo, setDateInfo] = useState({ long: '', short: '', time: '' });
  
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  // --- BACKGROUND UPDATE CHECKER ---
  useEffect(() => {
      if (import.meta.env.DEV || !('serviceWorker' in navigator)) return;

      let isMounted = true;

      const triggerUpdateModal = () => {
          if (isMounted) setShowUpdateModal(true);
      };

      // 1. DEDICATED LISTENER: Sets up permanent eyes on the Service Worker lifecycle
      const setupServiceWorkerListener = async () => {
          try {
              const registration = await navigator.serviceWorker.ready;

              // State A: Update is already downloaded and waiting for user to restart
              if (registration.waiting) {
                  triggerUpdateModal();
              }

              // State B: Update is currently downloading right now (we caught it mid-flight)
              if (registration.installing) {
                  registration.installing.addEventListener('statechange', (e) => {
                      const target = e.target as ServiceWorker;
                      if (target.state === 'installed' && navigator.serviceWorker.controller) {
                          triggerUpdateModal();
                      }
                  });
              }

              // State C: Setup a permanent trap for any future updates discovered
              registration.addEventListener('updatefound', () => {
                  const newWorker = registration.installing;
                  if (newWorker) {
                      newWorker.addEventListener('statechange', () => {
                          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                              triggerUpdateModal();
                          }
                      });
                  }
              });
          } catch (err) {
              console.warn("SW listener registration failed:", err);
          }
      };

      setupServiceWorkerListener();

      // 2. DEDICATED PINGER: Only responsible for asking Cloudflare if hashes changed
      const pingServerForUpdates = async () => {
          try {
              const registration = await navigator.serviceWorker.getRegistration();
              if (registration) await registration.update(); // If an update exists, this triggers 'updatefound' automatically
          } catch (error) {
              console.warn("Silent ping failed:", error);
          }
      };

      // Desktop Timers
      const initialCheck = setTimeout(pingServerForUpdates, 1500);
      const intervalCheck = setInterval(pingServerForUpdates, 10 * 60 * 1000);

      // Mobile Resume Handlers (with 1-second delay for iOS/Android network wake-up)
      const handleAppResume = () => {
          setTimeout(pingServerForUpdates, 1000);
      };
      
      const handleVisibilityChange = () => {
          if (document.visibilityState === 'visible') handleAppResume();
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('focus', handleAppResume);

      return () => {
          isMounted = false;
          clearTimeout(initialCheck);
          clearInterval(intervalCheck);
          document.removeEventListener('visibilitychange', handleVisibilityChange);
          window.removeEventListener('focus', handleAppResume);
      };
  }, []);

  // Clock
  useEffect(() => {
      const updateDate = () => {
          const now = new Date();
          setDateInfo({
              long: now.toLocaleDateString('en-US', { timeZone: 'Asia/Manila', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
              short: now.toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' }),
              time: now.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: true })
          });
      };
      updateDate();
      const interval = setInterval(updateDate, 1000);
      return () => clearInterval(interval);
  }, []);

  // Auth & Settings
  useEffect(() => {
    const fetchUserAndSettings = async () => {
      try {
        const { data: { session }, error: authError } = await supabase.auth.getSession();
        if (authError || !session) return navigate('/login', { replace: true });

        const [profileRes, settingsRes] = await Promise.all([
            supabase.from('profiles').select('role').eq('id', session.user.id).single(),
            supabase.from('global_settings').select('maintenance_mode').eq('id', 1).single()
        ]);

        const role = profileRes.data?.role || 'pho_staff';
        if (settingsRes.data?.maintenance_mode && role !== 'admin') {
            await supabase.auth.signOut(); 
            toast.error('System Maintenance', { description: 'The system is currently undergoing maintenance.' });
            navigate('/login', { replace: true });
            return;
        }
        setCurrentUserRole(role as 'admin' | 'pho_staff');
      } catch (err) {
        console.error("Error fetching user role:", err);
        setCurrentUserRole('pho_staff'); 
      } finally {
        setIsLoading(false);
      }
    };
    fetchUserAndSettings();
  }, [navigate]);

  // --- ZERO-DELAY CACHED DATA FETCH ---
  const { data: navData } = useQuery({
      queryKey: ['globalNavData'],
      queryFn: async () => {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) return null;

          const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', session.user.id).single();
          const fullName = profile?.full_name || '';

          const { data: docs } = await supabase.from('documents')
              .select('updated_at, created_at, status, remarks, created_by, category')
              .or(`created_by.eq.${session.user.id},assigned_clerk.eq.${fullName}`);

          return { docs: docs || [], userId: session.user.id };
      },
      refetchInterval: 15000, 
      enabled: currentUserRole === 'pho_staff'
  });

  // --- INSTANT UI SYNC STATE ---
  const [localViewed, setLocalViewed] = useState(() => ({
      proc: 0, ret: 0, hist: {} as Record<string, number>
  }));

  useEffect(() => {
      const syncStorage = () => {
          setLocalViewed({
              proc: Number(localStorage.getItem('filetrackr_viewed_processing') || '0'),
              ret: Number(localStorage.getItem('filetrackr_viewed_returned') || '0'),
              hist: JSON.parse(localStorage.getItem('filetrackr_history_viewed') || '{}')
          });
      };
      
      syncStorage(); 
      
      window.addEventListener('history_folder_viewed', syncStorage);
      const interval = setInterval(syncStorage, 1000); 

      return () => {
          window.removeEventListener('history_folder_viewed', syncStorage);
          clearInterval(interval);
      };
  }, [activeTab]);

  // --- SUPABASE REALTIME FETCH ---
  useEffect(() => {
    const channel = supabase
      .channel('global-nav-document-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'documents' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['globalNavData'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // --- SYNCHRONOUS, INSTANT BADGE CALCULATION ---
  const { processingCount, historyCount } = useMemo(() => {
      let pCount = 0;
      let hCount = 0;
      
      if (!navData?.docs) return { processingCount: 0, historyCount: 0 };

      navData.docs.forEach(d => {
          const time = new Date(d.updated_at || d.created_at).getTime();
          
          if (d.status === 'sealed' || d.status === 'cancelled') {
              if (d.created_by === navData.userId) {
                  const tab = d.status === 'sealed' ? 'completed' : 'cancelled';
                  const cat = d.category || 'Uncategorized';
                  const key = `${tab}_${cat}`;
                  const lastViewed = localViewed.hist[key] || 0;
                  if (time > lastViewed) hCount++;
              }
          } else {
              const isReturned = d.status === 'pending' && !!d.remarks;
              if (isReturned && time > localViewed.ret) pCount++;
              else if (!isReturned && time > localViewed.proc) pCount++;
          }
      });

      return { processingCount: pCount, historyCount: hCount };
  }, [navData, localViewed]);

  const finalProcessingCount = activeTab === 'processing' ? 0 : processingCount;
  const finalHistoryCount = historyCount; 

  // Security Redirects
  useEffect(() => {
    if (!currentUserRole) return; 
    if (currentUserRole === 'admin') {
      if (['dashboard', 'processing', 'history'].includes(activeTab)) navigate('/admin', { replace: true });
    } else if (currentUserRole === 'pho_staff') {
      if (activeTab === 'admin') navigate('/dashboard', { replace: true });
    }
  }, [activeTab, currentUserRole, navigate]);

  const getActiveTranslateStaff = () => {
      switch(activeTab) {
          case 'dashboard': return 'left-[10%] opacity-100 scale-100';
          case 'processing': return 'left-[30%] opacity-100 scale-100';
          case 'history': return 'left-[70%] opacity-100 scale-100';
          case 'settings': return 'left-[90%] opacity-100 scale-100';
          default: return 'left-[50%] opacity-0 scale-50';
      }
  };

  const getActiveTranslateAdmin = () => {
      switch(activeTab) {
          case 'admin': return 'left-[25%] opacity-100 scale-100';
          case 'settings': return 'left-[75%] opacity-100 scale-100';
          default: return 'left-[50%] opacity-0 scale-50';
      }
  };

  if (isLoading || !currentUserRole) {
      return (
          <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
              <div className="w-10 h-10 border-4 border-[#213C51]/20 border-t-[#213C51] rounded-full animate-spin"></div>
              <p className="mt-4 text-slate-500 font-bold">Authenticating...</p>
          </div>
      );
  }

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800 selection:bg-blue-200">
      <style>{modalAnimationStyles}</style>

      {/* Sidebar Navigation (Desktop) */}
      <nav className="hidden md:flex flex-col w-64 bg-slate-900 text-slate-300 shadow-xl z-20">
        <div className="p-6 flex items-start gap-4 border-b border-slate-800 bg-gradient-to-b from-slate-800/50 to-slate-900 relative overflow-hidden">
          <div className="absolute top-0 left-0 -ml-8 -mt-8 w-32 h-32 bg-[#213C51] rounded-full mix-blend-screen filter blur-[40px] opacity-40 animate-pulse"></div>
          
          <div className="flex items-center justify-center w-12 h-12 shrink-0 bg-white rounded-xl p-1.5 border border-slate-200 shadow-[0_4px_12px_rgba(0,0,0,0.5)] relative z-10">
            <img src={clearTrackLogo} alt="filetrackr logo" className="w-full h-full object-contain" />
          </div>
          
          <div className="flex flex-col relative z-10">
            <h1 className="text-2xl font-black text-white tracking-tight leading-none mt-1">filetrackr<span className="text-[#4D6787]">.</span></h1>
            <p className="text-[10px] font-black text-[#4D6787] uppercase tracking-widest mt-1.5">
              {currentUserRole === 'admin' ? 'Admin Portal' : 'by Abra PHO'}
            </p>
            <p className="text-[9px] font-bold text-slate-500 tracking-wider mt-0.5">v{__APP_VERSION__}</p>
            
            <div className="flex flex-col mt-3 gap-1">
              <div className="flex items-center gap-1.5 text-slate-300 bg-slate-800/50 py-1.5 px-2.5 rounded-lg border border-slate-700/50 w-fit">
                <Calendar size={12} className="text-[#4D6787] shrink-0" />
                <span className="text-[10px] font-bold leading-none">{dateInfo.long}</span>
              </div>
              <span className="text-[10px] font-bold text-slate-500 pl-1">{dateInfo.time}</span>
            </div>
          </div>
        </div>
        
        <div className="flex-1 py-6 px-4 space-y-2">
          {currentUserRole === 'pho_staff' && (
            <>
              <DesktopNavItem icon={<Activity />} label="Dashboard" to="/dashboard" isActive={activeTab === 'dashboard'} />
              <DesktopNavItem 
                  icon={<FileText />} 
                  label="Processing" 
                  to="/processing" 
                  isActive={activeTab === 'processing'} 
                  notificationCount={finalProcessingCount} 
              />
              <DesktopNavItem 
                  icon={<History />} 
                  label="History" 
                  to="/history" 
                  isActive={activeTab === 'history'} 
                  notificationCount={finalHistoryCount}
              />
            </>
          )}
          {currentUserRole === 'admin' && (
            <DesktopNavItem icon={<Shield />} label="System Admin" to="/admin" isActive={activeTab === 'admin'} />
          )}
          <DesktopNavItem icon={<Settings />} label="Settings" to="/settings" isActive={activeTab === 'settings'} />
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="md:hidden flex items-center justify-between p-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white shadow-lg z-20 relative shrink-0 overflow-hidden border-b border-slate-800">
          <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-[#4D6787] rounded-full mix-blend-screen filter blur-3xl opacity-30 animate-pulse"></div>

          <div className="flex items-center gap-3 relative z-10">
            <div className="flex items-center justify-center w-12 h-12 shrink-0 bg-white rounded-xl p-1.5 border-2 border-slate-200 shadow-md">
              <img src={clearTrackLogo} alt="filetrackr logo" className="w-full h-full object-contain" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl font-black leading-none text-white tracking-tight">filetrackr<span className="text-[#4D6787]">.</span></h1>
              <span className="text-[10px] font-black text-[#4D6787] uppercase tracking-widest mt-1">
                {currentUserRole === 'admin' ? 'Admin Portal' : 'by Abra PHO'}
              </span>
              <span className="text-[9px] font-bold text-slate-400 tracking-wider mt-0.5">v{__APP_VERSION__}</span>
            </div>
          </div>

          <div className="relative z-10 flex flex-col items-end text-right">
             <div className="flex flex-col items-end">
                 <span className="text-[9px] font-black text-[#4D6787] uppercase tracking-widest flex items-center gap-1 mb-0.5">
                    <Calendar size={10} strokeWidth={3} /> PHT
                 </span>
                 <span className="text-[11px] font-bold text-slate-200">
                    {dateInfo.short}
                 </span>
                 <span className="text-[10px] font-bold text-slate-400 mt-0.5">
                    {dateInfo.time}
                 </span>
             </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-28 md:pb-8">
          <Outlet />
        </div>
      </main>

      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#213C51] border-t border-[#213C51] shadow-[0_-15px_40px_rgba(33,60,81,0.25)] rounded-t-[1.5rem] pb-[env(safe-area-inset-bottom)] overflow-visible">
          {currentUserRole === 'pho_staff' && (
             <nav className="relative grid grid-cols-5 items-center w-full px-0 h-[4.25rem]">
                <div 
                    className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-11 h-11 bg-white rounded-[1.15rem] transition-all duration-500 ease-[cubic-bezier(0.68,-0.55,0.26,1.55)] shadow-md z-0 ${getActiveTranslateStaff()}`}
                ></div>

                <div className="flex justify-center z-10">
                    <MobileIconNav icon={<Activity />} to="/dashboard" isActive={activeTab === 'dashboard'} />
                </div>
                <div className="flex justify-center z-10">
                    <MobileIconNav icon={<FileText />} to="/processing" isActive={activeTab === 'processing'} notificationCount={finalProcessingCount} />
                </div>
                
                <div className="flex justify-center relative -mt-6 z-20">
                    <div className="absolute inset-0 bg-[#213C51] rounded-full w-[3.5rem] h-[3.5rem] mx-auto scale-[1.18] shadow-[0_-8px_15px_rgba(33,60,81,0.15)] z-0"></div>
                    <button 
                        onClick={openCreateModal}
                        className="relative flex items-center justify-center w-[3.5rem] h-[3.5rem] bg-cyan-400 hover:bg-cyan-300 text-[#213C51] rounded-full border-[3px] border-white shadow-[0_0_25px_rgba(34,211,238,0.4)] hover:shadow-[0_0_30px_rgba(34,211,238,0.6)] transition-all duration-300 ease-[cubic-bezier(0.175,0.885,0.32,1.275)] active:scale-75 active:rotate-12 z-10"
                    >
                        <FilePlus size={26} strokeWidth={2} className="text-[#213C51] translate-x-[1px]" />
                    </button>
                </div>

                <div className="flex justify-center z-10">
                    <MobileIconNav 
                      icon={<History />} 
                      to="/history" 
                      isActive={activeTab === 'history'} 
                      notificationCount={finalHistoryCount} 
                    />
                </div>
                <div className="flex justify-center z-10">
                    <MobileIconNav icon={<Settings />} to="/settings" isActive={activeTab === 'settings'} />
                </div>
             </nav>
          )}

          {currentUserRole === 'admin' && (
             <nav className="relative grid grid-cols-2 items-center w-full px-0 h-[4.25rem]">
                <div 
                    className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-11 h-11 bg-white rounded-[1.15rem] transition-all duration-500 ease-[cubic-bezier(0.68,-0.55,0.26,1.55)] shadow-md z-0 ${getActiveTranslateAdmin()}`}
                ></div>

                <div className="flex justify-center z-10">
                    <MobileIconNav icon={<Shield />} to="/admin" isActive={activeTab === 'admin'} />
                </div>
                <div className="flex justify-center z-10">
                    <MobileIconNav icon={<Settings />} to="/settings" isActive={activeTab === 'settings'} />
                </div>
             </nav>
          )}
      </div>

      {isCreateModalOpen && <CreateDocumentModal />}
      <InstallPrompt />

      {/* --- RENDER THE UPDATE MODAL --- */}
      {showUpdateModal && (
          <AppUpdateModal 
              currentVersion={__APP_VERSION__} 
              onClose={() => setShowUpdateModal(false)} 
          />
      )}
    </div>
  );
}

// --- Helper Components --- //
function DesktopNavItem({ icon, label, to, isActive, notificationCount = 0 }: NavItemProps) {
  return (
    <Link to={to} className={`flex items-center gap-3 px-4 py-3 w-full text-left rounded-lg transition-all ${
        isActive ? 'bg-[#4D6787] text-white shadow-md' : 'hover:bg-slate-800 hover:text-white'
      }`}
    >
      <div className="relative flex items-center justify-center">
          {React.cloneElement(icon, { size: 20 })}
          {notificationCount > 0 && !isActive && (
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 border border-slate-900"></span>
              </span>
          )}
      </div>
      <span className="font-medium flex-1">{label}</span>
      
      {notificationCount > 0 && !isActive && (
          <span className="text-[10px] font-black text-white bg-red-500 px-2 py-0.5 rounded shadow-sm">
              {notificationCount} NEW
          </span>
      )}
    </Link>
  );
}

function MobileIconNav({ icon, to, isActive, notificationCount = 0 }: NavItemProps) {
    return (
      <Link 
        to={to} 
        className={`relative flex items-center justify-center w-12 h-12 rounded-2xl transition-colors duration-300 ${
          isActive 
            ? 'text-[#213C51]' 
            : 'text-white/60 hover:text-white hover:bg-white/10'
        }`}
      >
        <div className={`transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${isActive ? 'scale-110 -translate-y-0.5' : 'scale-100'}`}>
            {React.cloneElement(icon, { 
              size: 22, 
              strokeWidth: isActive ? 2 : 1.5 
            })}
        </div>
        
        {notificationCount > 0 && !isActive && (
            <span className="absolute top-2.5 right-2.5 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500 border-2 border-[#213C51]"></span>
            </span>
        )}
      </Link>
    );
}