import React, { useState, useEffect } from 'react';
import { 
    Shield, Lock, Eye, EyeOff, Save, Check, AlertCircle, Mail, Briefcase, Phone, Building2, Edit3, Hash, User, Fingerprint, Sparkles, Star, ChevronRight, ChevronDown, FileText, Settings as SettingsIcon, LogOut
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import { legalContents } from './legalDocs'; 
import { CHANGELOG } from '../lib/changelog'; 

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
    .animate-responsive-modal { animation: iosSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    .animate-responsive-modal-close { animation: iosSlideDown 0.3s cubic-bezier(0.3, 0, 0.8, 0.15) forwards; }
    
    @media (min-width: 640px) {
        .animate-responsive-modal { animation: desktopZoomIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-responsive-modal-close { animation: desktopZoomOut 0.2s cubic-bezier(0.3, 0, 0.8, 0.15) forwards; }
    }
`;

interface UserProfile {
    id: string;
    full_name: string;
    emp_id: string;
    contact_number: string;
    designation: string;
    department: string;
    email: string;
}

const legalTitles = {
    privacy: "Privacy Policy",
    terms: "Terms and Conditions of Use",
    aup: "Acceptable Use"
};

export default function Settings() {
  const queryClient = useQueryClient();
  
  // Modals State
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isClosingLogout, setIsClosingLogout] = useState(false);

  const [openLegalModal, setOpenLegalModal] = useState<"privacy" | "terms" | "aup" | null>(null);
  const [isClosingLegal, setIsClosingLegal] = useState(false);

  const [isRegisteringPasskey, setIsRegisteringPasskey] = useState(false);

  // Edit Profile Modal States
  const [isEditing, setIsEditing] = useState(false);
  const [isClosingEdit, setIsClosingEdit] = useState(false);
  const [formData, setFormData] = useState({
      full_name: '',
      emp_id: '',
      contact_number: '',
      designation: ''
  });

  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [hasUnseenUpdate, setHasUnseenUpdate] = useState(false);
  const currentVersion = CHANGELOG[0].version;

  // 🚀 REACT QUERY: FETCH PROFILE 
  const { data: profile, isLoading } = useQuery({
      queryKey: ['userSettingsData'],
      queryFn: async () => {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) throw new Error("No authenticated session");

          const { data, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
          if (error) throw error;

          return { ...data, email: session.user.email } as UserProfile;
      }
  });

  useEffect(() => {
      if (profile) {
          setFormData({
              full_name: profile.full_name || '',
              emp_id: profile.emp_id || '',
              contact_number: profile.contact_number || '',
              designation: profile.designation || ''
          });
      }

      const seenVersion = localStorage.getItem('filetrackr_seen_version');
      if (seenVersion !== currentVersion) {
          setHasUnseenUpdate(true);
      }
  }, [profile, currentVersion]);

  // 🚀 REACT QUERY: MUTATION TO SAVE PROFILE
  const updateProfileMutation = useMutation({
      mutationFn: async (updatedData: typeof formData) => {
          if (!profile) throw new Error("Profile not loaded");

          const { error } = await supabase.from('profiles').update({
              full_name: updatedData.full_name.trim(),
              emp_id: updatedData.emp_id.trim(),
              contact_number: updatedData.contact_number.trim(),
              designation: updatedData.designation.trim()
          }).eq('id', profile.id);

          if (error) throw error;

          try {
              await supabase.from('employees').update({
                  name: updatedData.full_name.trim(),
                  contact_number: updatedData.contact_number.trim(),
                  designation: updatedData.designation.trim()
              }).eq('emp_id', profile.emp_id);
          } catch(e) { console.warn("Failed to sync to employees directory", e); }
      },
      onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['userSettingsData'] });
          handleCloseEdit(); 
          toast.success("Profile updated successfully!");
      },
      onError: (err: unknown) => {
          const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
          toast.error("Failed to update profile", { description: errorMessage });
      }
  });

  const handleEditClick = () => {
      if (profile) {
          setFormData({
            full_name: profile.full_name || '',
            emp_id: profile.emp_id || '',
            contact_number: profile.contact_number || '',
            designation: profile.designation || ''
          });
      }
      setIsEditing(true);
  };

  const handleCloseEdit = () => {
      setIsClosingEdit(true);
      setTimeout(() => {
          setIsEditing(false);
          setIsClosingEdit(false);
      }, 300); 
  };

  const handleSaveProfile = () => {
      if (!formData.full_name.trim() || !formData.emp_id.trim()) {
          toast.error("Please fill out required fields.");
          return;
      }
      updateProfileMutation.mutate(formData);
  };

  const handleRegisterPasskey = async () => {
      setIsRegisteringPasskey(true);
      try {
          const { error } = await supabase.auth.registerPasskey();
          if (error) throw error;
          localStorage.setItem('filetrackr_passkey_registered', 'true');
          toast.success("Device registered successfully!", { description: "You can now use Face ID / Touch ID to log in." });
      } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred.";
          toast.error("Failed to register device", { description: errorMessage });
      } finally {
          setIsRegisteringPasskey(false);
      }
  };

  const handleCloseLogoutModal = () => {
      setIsClosingLogout(true);
      setTimeout(() => {
          setIsLogoutModalOpen(false);
          setIsClosingLogout(false);
      }, 300);
  };

  const handleLogout = async () => {
      await supabase.auth.signOut();
      window.location.reload();
  };

  const handleCloseLegalModal = () => {
      setIsClosingLegal(true);
      setTimeout(() => {
          setOpenLegalModal(null);
          setIsClosingLegal(false);
      }, 300); 
  };

  const handleOpenWhatsNew = () => {
      setShowWhatsNew(true);
      setHasUnseenUpdate(false);
      localStorage.setItem('filetrackr_seen_version', currentVersion); 
  };

  const getInitials = (name?: string) => {
      if (!name) return "U";
      const parts = name.split(' ');
      if (parts.length > 1) {
          return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
      }
      return name[0].toUpperCase();
  };

  const isSaving = updateProfileMutation.isPending;

  if (isLoading) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
            <div className="w-10 h-10 border-4 border-[#16a34a] border-t-emerald-600 rounded-full animate-spin"></div>
            <p className="mt-4 text-slate-500 font-bold">Loading Settings...</p>
        </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto animate-in fade-in duration-500 bg-white sm:rounded-[2.5rem] sm:shadow-[0_8px_40px_rgba(0,0,0,0.08)] sm:border border-slate-100 overflow-hidden sm:mt-8 mb-8 relative">
      <style>{modalAnimationStyles}</style>

      {/* --- PROFESSIONAL PAGE HEADER --- */}
      <div className="px-6 py-6 pb-2 sm:px-10 sm:py-8 sm:pb-4 flex flex-col gap-1.5 border-b border-slate-50">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <SettingsIcon className="text-[#16a34a]" size={32} strokeWidth={2.5} /> Account Settings
          </h2>
          <p className="text-sm font-medium text-slate-500">Manage your personal profile and security preferences.</p>
      </div>

      <div className="px-5 sm:px-10 py-6 pb-12">
          
          {/* --- PROFILE ID CARD --- */}
          <div className="bg-white border border-slate-300 rounded-[2rem] p-6 sm:p-8 shadow-md relative mb-8">
              
              <div className="absolute top-5 right-5 sm:top-6 sm:right-6">
                   <button 
                       onClick={handleEditClick} 
                       className="px-4 py-2 bg-[#16a34a] hover:bg-[#15803d] text-white border border-[#16a34a] text-[11px] sm:text-xs font-bold uppercase tracking-wider rounded-full active:scale-95 transition-all flex items-center gap-1.5 shadow-sm"
                   >
                       <Edit3 size={14} strokeWidth={2.5} />
                       <span className="hidden sm:inline">Edit Profile</span>
                       <span className="sm:hidden">Edit</span>
                   </button>
              </div>

              <div className="flex flex-col items-center">
                  <div className="w-[90px] h-[90px] bg-[#111827] text-white rounded-full flex items-center justify-center text-[36px] font-black shadow-md ring-4 ring-slate-50 mt-2">
                      {getInitials(profile?.full_name)}
                  </div>
                  <h3 className="mt-4 text-[22px] font-black text-slate-900 tracking-tight text-center">{profile?.full_name || 'Not provided'}</h3>
                  
                  {/* Stacked Minimalist Profile Details */}
                  <div className="w-full space-y-2 mt-6 px-2 sm:px-0">
                      <ProfileField icon={<Building2 size={18}/>} value={profile?.department || 'N/A'} />
                      <ProfileField icon={<Hash size={18}/>} value={profile?.emp_id || 'N/A'} isMono />
                      <ProfileField icon={<Briefcase size={18}/>} value={profile?.designation || 'No Designation'} />
                      <ProfileField icon={<Mail size={18}/>} value={profile?.email || 'N/A'} />
                      <ProfileField icon={<Phone size={18}/>} value={profile?.contact_number || 'Not Provided'} />
                  </div>
              </div>
          </div>

          <div className="h-px bg-slate-100 my-6 mx-4"></div>

          {/* --- COLLAPSIBLE SETTINGS MENU --- */}
          <div className="space-y-1">
              
              <CollapsibleGroup title="Security" icon={<Shield size={20} />}>
                  <SettingsMenuRow icon={<Lock size={18} />} label="Change Password" onClick={() => setIsPasswordModalOpen(true)} />
                  <SettingsMenuRow icon={<Fingerprint size={18} />} label="Register Biometrics" onClick={handleRegisterPasskey} isLoading={isRegisteringPasskey} />
              </CollapsibleGroup>

              <CollapsibleGroup title="System" icon={<SettingsIcon size={20} />} hasUpdate={hasUnseenUpdate}>
                  <SettingsMenuRow icon={<Sparkles size={18} />} label="Release Notes" onClick={handleOpenWhatsNew} hasUpdate={hasUnseenUpdate} />
              </CollapsibleGroup>

              <CollapsibleGroup title="Legal Documents" icon={<FileText size={20} />}>
                  <SettingsMenuRow icon={<Shield size={18} />} label="Privacy Policy" onClick={() => setOpenLegalModal('privacy')} />
                  <SettingsMenuRow icon={<FileText size={18} />} label="Terms of Use" onClick={() => setOpenLegalModal('terms')} />
                  <SettingsMenuRow icon={<AlertCircle size={18} />} label="Acceptable Use" onClick={() => setOpenLegalModal('aup')} />
              </CollapsibleGroup>

              <div className="h-px bg-slate-100 my-4 mx-4"></div>

              {/* Log Out */}
              <SettingsMenuRow 
                  icon={<LogOut size={20} className="text-red-500" />} 
                  label="Log Out" 
                  onClick={() => setIsLogoutModalOpen(true)} 
                  isDestructive={true} 
              />
          </div>

          {/* --- FOOTER VERSION --- */}
          <div className="mt-10 text-center">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Filetrackr. v{currentVersion}</p>
          </div>
      </div>

      {/* --- MINIMALIST EDIT PROFILE MODAL --- */}
      {isEditing && (
          <>
              <div className={`fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-40 md:hidden ${isClosingEdit ? 'animate-overlay-fade-out pointer-events-none' : 'animate-overlay-fade'}`} onClick={handleCloseEdit}></div>
              
              <div className={`fixed inset-x-0 bottom-0 z-50 w-full max-h-[95vh] bg-white rounded-t-[1.5rem] shadow-2xl flex flex-col overflow-hidden md:fixed md:inset-0 md:m-auto md:w-full md:max-w-md md:h-fit md:max-h-[85vh] md:rounded-[2rem] ${isClosingEdit ? 'animate-responsive-modal-close md:hidden' : 'animate-responsive-modal md:block md:animate-in md:slide-in-from-bottom-4 md:fade-in'}`}>
                  
                  <div className="bg-slate-900 text-white p-5 sm:p-6 flex items-center justify-between shrink-0 relative md:hidden">
                      <div className="w-12 h-1.5 bg-white/20 rounded-full absolute top-2 left-1/2 -translate-x-1/2"></div>
                      <h3 className="text-lg font-black text-white mt-2 sm:mt-0 flex items-center gap-2"><Edit3 size={18} className="text-[#16a34a]"/> Edit Profile</h3>
                  </div>

                  <div className="flex-1 overflow-y-auto p-5 sm:p-6 custom-scrollbar bg-white">
                      
                      <div className="hidden md:flex items-center justify-between mb-6 mt-2">
                          <h3 className="text-xl font-black text-slate-900 flex items-center gap-2"><Edit3 size={20} className="text-[#16a34a]"/> Edit Profile</h3>
                      </div>

                      <div className="flex flex-col gap-4">
                          
                          {/* 1. Department (Locked) */}
                          <div>
                              <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Department</label>
                              <div className="relative">
                                  <Building2 size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                  <input type="text" value={profile?.department || 'N/A'} disabled placeholder="Department" className="w-full pl-11 pr-10 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 font-semibold cursor-not-allowed" />
                                  <Lock size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                              </div>
                              <p className="text-[10px] font-bold text-slate-400 mt-1.5 ml-1">Changes require admin approval.</p>
                          </div>

                          {/* 2. Employee ID */}
                          <div>
                              <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Employee ID # *</label>
                              <div className="relative">
                                  <Hash size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                  <input type="text" value={formData.emp_id} onChange={(e) => setFormData({...formData, emp_id: e.target.value})} placeholder="Employee ID" className="w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-xl focus:border-[#16a34a] focus:ring-4 focus:ring-green-600/10 outline-none font-semibold font-mono text-slate-900 transition-all placeholder:text-slate-400" />
                              </div>
                          </div>

                          {/* 3. Name */}
                          <div>
                              <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Name *</label>
                              <div className="relative">
                                  <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                  <input type="text" value={formData.full_name} onChange={(e) => setFormData({...formData, full_name: e.target.value})} placeholder="Full Name" className="w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-xl focus:border-[#16a34a] focus:ring-4 focus:ring-green-600/10 outline-none font-semibold text-slate-900 transition-all placeholder:text-slate-400" />
                              </div>
                          </div>

                          {/* 4. Designation */}
                          <div>
                              <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Designation</label>
                              <div className="relative">
                                  <Briefcase size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                  <input type="text" value={formData.designation} onChange={(e) => setFormData({...formData, designation: e.target.value})} placeholder="Designation (e.g. Nurse II)" className="w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-xl focus:border-[#16a34a] focus:ring-4 focus:ring-green-600/10 outline-none font-semibold text-slate-900 transition-all placeholder:text-slate-400" />
                              </div>
                          </div>

                          {/* 5. Email (Locked) */}
                          <div>
                              <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Email Address</label>
                              <div className="relative mt-2">
                                  <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                  <input type="text" value={profile?.email || 'N/A'} disabled placeholder="Email Address" className="w-full pl-11 pr-10 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 font-semibold cursor-not-allowed" />
                                  <Lock size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                              </div>
                              <p className="text-[10px] font-bold text-slate-400 mt-1.5 ml-1">Email cannot be changed directly.</p>
                          </div>

                          {/* 6. Contact Number */}
                          <div>
                              <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Contact #</label>
                              <div className="relative">
                                  <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                  <input type="tel" value={formData.contact_number} onChange={(e) => setFormData({...formData, contact_number: e.target.value})} placeholder="Contact Number" className="w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-xl focus:border-[#16a34a] focus:ring-4 focus:ring-green-600/10 outline-none font-semibold text-slate-900 transition-all placeholder:text-slate-400" />
                              </div>
                          </div>

                      </div>
                  </div>

                  <div className="flex gap-3 px-5 pt-4 pb-6 sm:pb-5 border-t border-slate-100 bg-white shrink-0">
                      <button onClick={handleCloseEdit} disabled={isSaving} className="flex-1 py-3.5 bg-white border-2 border-slate-200 hover:bg-slate-50 text-slate-600 font-bold rounded-xl active:scale-95 transition-all text-sm disabled:opacity-50">
                          Cancel
                      </button>
                      <button onClick={handleSaveProfile} disabled={isSaving} className="flex-[1.5] py-3.5 bg-[#16a34a] text-white font-bold rounded-xl active:scale-95 transition-all text-sm flex justify-center items-center gap-2 disabled:opacity-50 shadow-sm hover:bg-[#15803d]">
                          {isSaving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : 'Save Changes'}
                      </button>
                  </div>
              </div>
          </>
      )}

      {/* --- LOG OUT CONFIRMATION MODAL --- */}
      {isLogoutModalOpen && (
          <div className={`fixed inset-0 z-[100] flex items-end justify-center sm:items-center bg-slate-900/60 backdrop-blur-sm ${isClosingLogout ? 'animate-overlay-fade-out' : 'animate-overlay-fade'}`}>
              <div className={`bg-white w-full sm:max-w-sm rounded-t-[1.5rem] sm:rounded-[2rem] shadow-2xl overflow-hidden flex flex-col ${isClosingLogout ? 'animate-responsive-modal-close' : 'animate-responsive-modal'}`}>
                  <div className="bg-[#e11d48] text-white p-4 sm:p-5 flex items-center justify-between">
                      <h3 className="font-bold text-[17px] flex items-center gap-2">
                          <AlertCircle size={20} /> Confirm Logout
                      </h3>
                  </div>
                  <div className="p-5 sm:p-6 pb-8 sm:pb-6">
                      <p className="text-[14px] font-medium text-slate-700 mb-6 px-1">
                          Are you sure you want to securely log out of your account?
                      </p>
                      <div className="flex gap-3">
                          <button onClick={handleCloseLogoutModal} className="flex-1 py-3.5 bg-white border-2 border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl transition-colors active:scale-95 text-[14px]">
                              Cancel
                          </button>
                          <button onClick={handleLogout} className="flex-1 py-3.5 bg-[#e11d48] hover:bg-red-700 text-white font-bold rounded-xl transition-colors active:scale-95 text-[14px] shadow-sm">
                              Yes, Logout
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* --- SECURE CHANGE PASSWORD MODAL --- */}
      {isPasswordModalOpen && (
        <ChangePasswordModal 
          onClose={() => setIsPasswordModalOpen(false)} 
        />
      )}

      {/* --- LEGAL DOCUMENT MODAL --- */}
      {openLegalModal && (
        <div className={`fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm ${isClosingLegal ? 'animate-overlay-fade-out' : 'animate-overlay-fade'}`}>
            <div className={`relative flex w-full max-w-3xl flex-col max-h-[90vh] sm:max-h-[85vh] overflow-hidden rounded-2xl sm:rounded-3xl bg-white shadow-2xl ${isClosingLegal ? 'animate-responsive-modal-close' : 'animate-responsive-modal'}`}>
                
                <div className="flex items-center justify-between border-b border-slate-100 px-5 sm:px-6 py-4 sm:py-5 bg-slate-900 text-white shrink-0">
                    <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
                        <Shield size={18} className="text-slate-400" />
                        {legalTitles[openLegalModal]}
                    </h2>
                </div>

                <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-6 sm:py-8 custom-scrollbar bg-slate-50/50">
                    <article className="prose prose-slate prose-sm sm:prose-base max-w-none prose-headings:text-slate-900 prose-a:text-[#16a34a] prose-p:text-slate-700">
                        <ReactMarkdown>{legalContents[openLegalModal]}</ReactMarkdown>
                    </article>
                </div>

                <div className="border-t border-slate-200 bg-white px-5 sm:px-6 py-4 text-right shrink-0">
                    <button onClick={handleCloseLegalModal} className="w-full sm:w-auto rounded-xl bg-slate-900 px-8 py-3 sm:py-2.5 text-sm font-bold text-white transition-all active:scale-95 hover:bg-slate-800 border-2 border-slate-900 shadow-sm">
                        I Understand
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* --- WHATS NEW MODAL --- */}
      {showWhatsNew && <WhatsNewModal onClose={() => setShowWhatsNew(false)} />}
    </div>
  );
}

// --- HELPER COMPONENT FOR PROFILE DETAILS ---
function ProfileField({ icon, value, isMono }: any) {
    return (
        <div className="flex items-center gap-4 py-1.5">
            <div className="text-slate-400 flex justify-center shrink-0 w-5">
                {icon}
            </div>
            <div className={`text-[14px] font-medium text-slate-700 ${isMono ? 'font-mono tracking-wide text-[13px]' : ''}`}>
                {value}
            </div>
        </div>
    );
}

// --- COLLAPSIBLE MENU GROUP ---
function CollapsibleGroup({ title, icon, children, defaultOpen = false, hasUpdate = false }: any) {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    
    return (
        <div className="mb-2">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center justify-between w-full py-4 px-4 rounded-xl transition-all active:scale-[0.99] ${isOpen ? 'bg-slate-100/70 mb-2' : 'hover:bg-slate-50'}`}
            >
                <div className="flex items-center gap-4">
                    <div className="text-slate-500">{icon}</div>
                    <span className="text-[15px] font-bold text-slate-900 relative">
                        {title}
                        {hasUpdate && !isOpen && (
                            <span className="absolute -top-1 -right-3 flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500 shadow-[0_0_8px_rgba(37,99,235,0.6)]"></span>
                            </span>
                        )}
                    </span>
                </div>
                <ChevronDown size={18} className={`text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} strokeWidth={2.5} />
            </button>
            <div className={`grid transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                <div className="overflow-hidden">
                    <div className="pl-4 sm:pl-6 ml-4 sm:ml-6 border-l-2 border-slate-100 space-y-1 mb-2">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}

// --- MINIMALIST SETTINGS MENU ROW COMPONENT ---
function SettingsMenuRow({ 
    icon, 
    label, 
    onClick, 
    hasUpdate, 
    isLoading,
    isDestructive
}: { 
    icon: React.ReactNode, 
    label: string, 
    onClick?: () => void, 
    hasUpdate?: boolean, 
    isLoading?: boolean,
    isDestructive?: boolean
}) {
    return (
        <div 
            onClick={onClick}
            className={`flex items-center justify-between py-3.5 px-3 rounded-xl transition-colors ${onClick ? 'cursor-pointer hover:bg-slate-50 active:scale-[0.98]' : ''}`}
        >
            <div className="flex items-center gap-4">
                <div className={`${isDestructive ? 'text-red-500' : 'text-slate-400'}`}>
                    {icon}
                </div>
                <span className={`text-[14px] sm:text-[15px] font-medium relative ${isDestructive ? 'text-red-600' : 'text-slate-700'}`}>
                    {label}
                    {hasUpdate && (
                        <span className="absolute -top-1 -right-3 flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500 shadow-[0_0_8px_rgba(37,99,235,0.6)]"></span>
                        </span>
                    )}
                </span>
            </div>
            
            {isLoading ? (
                <span className="w-4 h-4 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin mr-1"></span>
            ) : onClick ? (
                <ChevronRight size={16} className={isDestructive ? "text-red-400" : "text-slate-300"} strokeWidth={2.5} />
            ) : null}
        </div>
    );
}

// --- SECURE CHANGE PASSWORD MODAL COMPONENT --- //
function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [isClosing, setIsClosing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => onClose(), 400);
  };

  const getStrength = (pass: string) => {
    let score = 0;
    if (!pass) return { score: 0, text: 'Empty', color: 'bg-slate-200' };
    if (pass.length >= 8) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[a-z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;
    if (score <= 2) return { score, text: 'Weak', color: 'bg-red-500' };
    if (score === 3 || score === 4) return { score, text: 'Good', color: 'bg-blue-500' };
    return { score, text: 'Strong', color: 'bg-[#16a34a]' };
  };

  const strength = getStrength(newPassword);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (strength.score < 3) { toast.error("Please choose a stronger new password."); return; }
    if (newPassword !== confirmPassword) { toast.error("New passwords do not match."); return; }

    setIsSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });

      if (updateError) {
        toast.error("Failed to update password", { description: updateError.message });
      } else {
        toast.success("Password changed successfully!", { description: "Your account is secure." });
        handleClose();
      }
    } catch (err: unknown) {
      console.error(err);
      toast.error("An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-sm ${isClosing ? 'animate-overlay-fade-out' : 'animate-overlay-fade'}`}>
      <div className={`bg-white w-full max-w-md rounded-t-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col ${isClosing ? 'animate-responsive-modal-close' : 'animate-responsive-modal'}`}>
        <div className="bg-slate-900 text-white p-5 sm:p-6 flex items-center shrink-0 relative">
          <div className="w-16 h-1.5 bg-white/20 rounded-full absolute top-2 left-1/2 -translate-x-1/2 sm:hidden"></div>
          <h3 className="font-black text-xl flex items-center gap-2 mt-2 sm:mt-0"><Lock size={22}/> Change Password</h3>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto">
          <div>
            <label className="block text-sm font-bold text-slate-900 mb-1.5">New Password</label>
            <div className="relative mb-3">
              <input type={showNew ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Create new password" className="w-full pl-4 pr-12 py-3.5 bg-white border-2 border-slate-200 focus:border-slate-900 rounded-xl outline-none font-bold text-slate-900 transition-colors" />
              <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                {showNew ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            <div className="space-y-2 mb-4">
              <div className="flex gap-1 h-1.5 w-full">
                {[1, 2, 3, 4, 5].map((level) => (<div key={level} className={`flex-1 rounded-full transition-colors duration-300 ${strength.score >= level ? strength.color : 'bg-slate-200'}`}></div>))}
              </div>
              <p className="text-xs font-bold text-right text-slate-500 uppercase tracking-wide">{strength.text}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Password Requirements</p>
                <div className="grid grid-cols-2 gap-2">
                    <RequirementItem met={newPassword.length >= 8} label="8+ Characters" />
                    <RequirementItem met={/[A-Z]/.test(newPassword)} label="1 Uppercase" />
                    <RequirementItem met={/[0-9]/.test(newPassword)} label="1 Number" />
                    <RequirementItem met={/[^A-Za-z0-9]/.test(newPassword)} label="1 Special Char" />
                </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-900 mb-1.5">Confirm New Password</label>
            <div className="relative">
              <input type={showConfirm ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter new password" className={`w-full pl-4 pr-12 py-3.5 bg-white border-2 outline-none font-bold text-slate-900 transition-colors rounded-xl ${confirmPassword && newPassword !== confirmPassword ? 'border-red-400 focus:border-red-600 bg-red-50/50' : 'border-slate-200 focus:border-slate-900'}`} />
              <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                {showConfirm ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {confirmPassword && newPassword !== confirmPassword && (<p className="text-xs font-bold text-red-600 mt-1.5 flex items-center gap-1"><AlertCircle size={12}/> Passwords do not match</p>)}
          </div>
          <div className="pt-4 flex gap-3 shrink-0 border-t-2 border-slate-100">
            <button type="button" disabled={isSubmitting} onClick={handleClose} className="flex-1 py-3.5 bg-white border-2 border-slate-300 text-slate-700 font-bold rounded-xl active:scale-95 transition-transform text-base disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="flex-[1.5] py-3.5 bg-slate-900 text-white font-bold rounded-xl border-2 border-slate-900 active:scale-95 transition-transform text-base flex justify-center items-center gap-2 disabled:opacity-50 disabled:bg-slate-700 shadow-md">
              {isSubmitting ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : <><Save size={18} /> Update</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RequirementItem({ met, label }: { met: boolean, label: string }) {
    return (
        <div className={`flex items-center gap-1.5 text-xs font-bold ${met ? 'text-[#16a34a]' : 'text-slate-400'}`}>
            <div className={`w-4 h-4 rounded-full flex items-center justify-center border ${met ? 'bg-green-100 border-green-300' : 'bg-slate-100 border-slate-300'}`}>
                {met && <Check size={10} strokeWidth={4} />}
            </div>
            {label}
        </div>
    );
}

// ==========================================
// WHATS NEW MODAL COMPONENT (Bouncy Style)
// ==========================================
function WhatsNewModal({ onClose }: { onClose: () => void }) {
    const [isClosing, setIsClosing] = useState(false);
    const latestRelease = CHANGELOG[0];

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(onClose, 300);
    };

    const overlayAnimation = isClosing 
        ? "animate-out fade-out duration-300 ease-in" 
        : "animate-in fade-in duration-300 ease-out";
        
    const bouncyModalAnimation = isClosing
        ? "animate-out zoom-out-[0.8] slide-out-to-bottom-10 fade-out duration-300 ease-in"
        : "animate-in zoom-in-[0.7] slide-in-from-bottom-12 fade-in duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]";

    return (
        <div className={`fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm ${overlayAnimation}`}>
            <div className={`bg-white w-full max-w-md flex flex-col shadow-[0_20px_60px_rgba(0,0,0,0.4)] rounded-[2rem] overflow-hidden relative ${bouncyModalAnimation}`}>
                
                <div className="bg-gradient-to-br from-blue-500 to-blue-700 p-7 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 opacity-20 transform translate-x-4 -translate-y-4 animate-[spin_10s_linear_infinite]">
                        <Sparkles size={140} strokeWidth={1} />
                    </div>
                    
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="bg-blue-900/50 text-blue-100 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border border-blue-400/30 backdrop-blur-md flex items-center gap-1.5 shadow-sm">
                                <Star size={10} className="text-amber-300 fill-amber-300" />
                                Release Notes
                            </span>
                        </div>
                        <h2 className="text-3xl font-black mb-1.5 tracking-tight">Version {latestRelease.version}</h2>
                        <p className="text-blue-100 font-medium text-sm leading-relaxed max-w-[90%]">{latestRelease.tagline}</p>
                    </div>
                </div>

                <div className="p-6 bg-slate-50 space-y-4 max-h-[55vh] overflow-y-auto custom-scrollbar">
                    {latestRelease.features.map((feat, idx) => (
                        <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex gap-4 hover:-translate-y-0.5 hover:shadow-md transition-all duration-300" style={{ animationFillMode: 'both', animationDelay: `${(idx + 1) * 100}ms` }}>
                            <div className="text-2xl mt-0.5 select-none drop-shadow-sm">{feat.icon}</div>
                            <div>
                                <h4 className="font-bold text-slate-800 text-[15px] mb-1 leading-tight">{feat.title}</h4>
                                <p className="text-xs text-slate-500 leading-relaxed font-medium">{feat.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-5 bg-white border-t border-slate-100 flex justify-center">
                    <button onClick={handleClose} className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-xl active:scale-[0.97] transition-all shadow-md shadow-slate-900/20">
                        Awesome, let's go! 🚀
                    </button>
                </div>
            </div>
        </div>
    );
}