import React, { useState, useEffect, useRef } from 'react';
import { 
    Shield, Lock, Eye, EyeOff, Save, X, Check, AlertCircle, Mail, Briefcase, Phone, Settings as SettingsIcon, Building2, Edit3, ChevronDown, Hash, User, Fingerprint
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import { legalContents } from './legalDocs'; // <-- Dynamic text import
import packageJson from '../../package.json';

// --- Shared Modal Animation Styles ---
const modalAnimationStyles = `
    @keyframes customFadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes iosSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
    @keyframes desktopZoomIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    @keyframes customFadeOut { from { opacity: 1; } to { opacity: 0; } }
    @keyframes iosSlideDown { from { transform: translateY(0); } to { transform: translateY(100%); } }
    @keyframes desktopZoomOut { from { transform: scale(1); opacity: 1; } to { transform: scale(0.95); opacity: 0; } }
    
    .animate-overlay-fade { animation: customFadeIn 0.3s ease-out forwards; }
    .animate-overlay-fade-out { animation: customFadeOut 0.3s ease-in forwards; }
    .animate-responsive-modal { animation: iosSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    .animate-responsive-modal-close { animation: iosSlideDown 0.3s cubic-bezier(0.3, 0, 0.8, 0.15) forwards; }
    
    @media (min-width: 640px) {
        .animate-responsive-modal { animation: desktopZoomIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-responsive-modal-close { animation: desktopZoomOut 0.2s cubic-bezier(0.3, 0, 0.8, 0.15) forwards; }
    }
`;

// --- TypeScript Interfaces ---
interface SelectOption { label: string; value: string; }
type OptionType = SelectOption | string;

interface CustomSelectProps {
    options: OptionType[];
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
    disabled?: boolean;
}

interface UserProfile {
    id: string;
    full_name: string;
    emp_id: string;
    contact_number: string;
    designation: string;
    department: string;
    email: string;
}

interface Department { name: string; }

// --- Custom Dropdown Component for Departments (Clean Version) ---
function CustomSelect({ options, value, onChange, placeholder, disabled = false }: CustomSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null); 
  
    useEffect(() => {
      function handleClickOutside(event: MouseEvent) {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      }
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
      if (isOpen && menuRef.current) {
        setTimeout(() => {
          menuRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 50);
      }
    }, [isOpen]);
  
    return (
      <div className="relative w-full" ref={dropdownRef}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={`w-full px-3 py-3 border rounded-xl flex justify-between items-center transition-all text-sm sm:text-base outline-none ${
            disabled ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed' :
            isOpen
              ? 'border-blue-500 ring-4 ring-blue-500/10 bg-white'
              : 'bg-slate-50 border-slate-200 hover:bg-white hover:border-slate-300 active:scale-[0.99]'
          } ${!value && !disabled ? 'text-slate-500' : 'text-slate-900 font-bold'}`}
        >
          <span className="truncate">
            {options.find((opt: OptionType) => (typeof opt === 'string' ? opt : opt.value) === value)
              ? (typeof options.find((opt: OptionType) => (typeof opt === 'string' ? opt : opt.value) === value) === 'string' 
                  ? options.find((opt: OptionType) => (typeof opt === 'string' ? opt : opt.value) === value) as string
                  : (options.find((opt: OptionType) => (typeof opt === 'string' ? opt : opt.value) === value) as SelectOption).label)
              : value || placeholder}
          </span>
          {!disabled && (
              <ChevronDown 
                size={18} 
                className={`text-slate-400 transition-transform duration-300 ease-in-out sm:w-5 sm:h-5 ${isOpen ? 'rotate-180 text-slate-800' : ''}`} 
              />
          )}
        </button>
  
        {isOpen && !disabled && (
          <div ref={menuRef} className="absolute z-20 w-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="max-h-48 sm:max-h-60 overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
              {options.map((option: OptionType, idx: number) => {
                const optValue = typeof option === 'string' ? option : option.value;
                const optLabel = typeof option === 'string' ? option : option.label;
                const isSelected = optValue === value;
  
                return (
                  <div
                    key={idx}
                    onClick={() => {
                      onChange(optValue);
                      setIsOpen(false);
                    }}
                    className={`px-3 py-2.5 sm:px-4 sm:py-3 text-sm sm:text-base rounded-lg cursor-pointer transition-colors flex items-center active:scale-95 ${
                      isSelected
                        ? 'bg-blue-600 text-white font-bold'
                        : 'text-slate-700 hover:bg-slate-100 font-medium'
                    }`}
                  >
                    {optLabel}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
}

// --- LEGAL TITLES CONSTANT ---
const legalTitles = {
    privacy: "Privacy Policy",
    terms: "Terms and Conditions of Use",
    aup: "Information Security & Acceptable Use Policy"
};

export default function Settings() {
  const queryClient = useQueryClient();
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  
  // Passkey Registration State
  const [isRegisteringPasskey, setIsRegisteringPasskey] = useState(false);

  // Legal Modal State (No loading state needed anymore!)
  const [openLegalModal, setOpenLegalModal] = useState<"privacy" | "terms" | "aup" | null>(null);
  const [isClosingLegal, setIsClosingLegal] = useState(false);

  // Edit Profile Modal States
  const [isEditing, setIsEditing] = useState(false);
  const [isClosingEdit, setIsClosingEdit] = useState(false);
  const [formData, setFormData] = useState({
      full_name: '',
      emp_id: '',
      contact_number: '',
      designation: '',
      department: ''
  });

  // 🚀 REACT QUERY: FETCH PROFILE & DEPARTMENTS
  const { data, isLoading } = useQuery({
      queryKey: ['userSettingsData'],
      queryFn: async () => {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) throw new Error("No authenticated session");

          const [profileRes, deptRes] = await Promise.all([
              supabase.from('profiles').select('*').eq('id', session.user.id).single(),
              supabase.from('departments').select('name').order('name')
          ]);

          if (profileRes.error) throw profileRes.error;

          return {
              profile: { ...profileRes.data, email: session.user.email } as UserProfile,
              departments: (deptRes.data as Department[]) || []
          };
      }
  });

  // Sync React Query cache to local editable state
  useEffect(() => {
      if (data?.profile) {
          setFormData({
              full_name: data.profile.full_name || '',
              emp_id: data.profile.emp_id || '',
              contact_number: data.profile.contact_number || '',
              designation: data.profile.designation || '',
              department: data.profile.department || ''
          });
      }
  }, [data?.profile]);

  const profile = data?.profile;
  const departments = data?.departments || [];

  // 🚀 REACT QUERY: MUTATION TO SAVE PROFILE
  const updateProfileMutation = useMutation({
      mutationFn: async (updatedData: typeof formData) => {
          if (!profile) throw new Error("Profile not loaded");

          // 1. Update public profile
          const { error } = await supabase.from('profiles').update({
              full_name: updatedData.full_name.trim(),
              emp_id: updatedData.emp_id.trim(),
              contact_number: updatedData.contact_number.trim(),
              designation: updatedData.designation.trim(),
              department: updatedData.department.trim()
          }).eq('id', profile.id);

          if (error) throw error;

          // 2. Attempt to sync to public employee directory 
          try {
              await supabase.from('employees').update({
                  name: updatedData.full_name.trim(),
                  contact_number: updatedData.contact_number.trim(),
                  designation: updatedData.designation.trim(),
                  department: updatedData.department.trim()
              }).eq('emp_id', profile.emp_id);
          } catch(e) { console.warn("Failed to sync to employees directory", e); }
      },
      onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['userSettingsData'] });
          handleCloseEdit(); 
          toast.success("Profile updated successfully!");
      },
      onError: (err: unknown) => {
          console.error(err);
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
            designation: profile.designation || '',
            department: profile.department || ''
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
      if (!formData.full_name.trim() || !formData.emp_id.trim() || !formData.department.trim()) {
          toast.error("Please fill out all required fields.");
          return;
      }
      updateProfileMutation.mutate(formData);
  };

  const handleRegisterPasskey = async () => {
      setIsRegisteringPasskey(true);
      try {
          const { error } = await supabase.auth.registerPasskey();
          
          if (error) throw error;

          // Drop a flag so the browser knows to show the Biometric Login button
          localStorage.setItem('filetrackr_passkey_registered', 'true');

          toast.success("Device registered successfully!", { description: "You can now use Face ID / Touch ID to log in." });
      } catch (err: unknown) {
          console.error(err);
          const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred.";
          toast.error("Failed to register device", { description: errorMessage });
      } finally {
          setIsRegisteringPasskey(false);
      }
  };

  const handleCloseLegalModal = () => {
      setIsClosingLegal(true);
      setTimeout(() => {
          setOpenLegalModal(null);
          setIsClosingLegal(false);
      }, 300); 
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
            <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            <p className="mt-4 text-slate-500 font-bold">Loading Settings...</p>
        </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500 pb-12">
      <style>{modalAnimationStyles}</style>

      {/* Header */}
      <div className="mb-6 flex flex-col md:flex-row justify-between md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <SettingsIcon className="text-blue-600" size={32} /> Account Settings
          </h2>
          <p className="text-base text-slate-600 mt-1">Manage your personal profile and security preferences.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Right Column: Profile Information */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border-2 border-slate-200 shadow-sm p-6 sm:p-8 relative">
            
            {/* DISPLAY MODE */}
            <div className="block">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8">
                    <div className="flex items-center gap-5">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-xl sm:text-2xl font-black shrink-0 border-2 border-blue-100">
                            {getInitials(profile?.full_name)}
                        </div>
                        <div>
                            <span className="inline-block text-[10px] sm:text-xs font-bold font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 uppercase tracking-widest mb-1.5">
                                ID: {profile?.emp_id || 'N/A'}
                            </span>
                            <h3 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight mb-1">{profile?.full_name || 'Not provided'}</h3>
                            <p className="text-sm font-bold text-blue-600">{profile?.designation || 'No Designation'}</p>
                        </div>
                    </div>
                    <button 
                        onClick={handleEditClick} 
                        className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 border-2 border-blue-700 shadow-sm"
                    >
                        <Edit3 size={16} /> Edit Profile
                    </button>
                </div>

                {/* Details List */}
                <div className="space-y-5 pt-6 border-t-2 border-slate-100">
                    <div className="flex items-start gap-4">
                        <Building2 className="text-slate-400 shrink-0 mt-0.5" size={20} />
                        <div>
                            <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">Department</p>
                            <p className="text-sm sm:text-base font-bold text-slate-900">{profile?.department || 'No Department'}</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-4">
                        <Mail className="text-slate-400 shrink-0 mt-0.5" size={20} />
                        <div>
                            <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">Email Address</p>
                            <p className="text-sm sm:text-base font-bold text-slate-900">{profile?.email || 'N/A'}</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-4">
                        <Phone className="text-slate-400 shrink-0 mt-0.5" size={20} />
                        <div>
                            <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">Contact Number</p>
                            <p className="text-sm sm:text-base font-bold text-slate-900">{profile?.contact_number || 'Not Provided'}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* EDIT MODE (Clean & Flat Form) */}
            {isEditing && (
                <>
                    {/* Mobile Backdrop */}
                    <div className={`fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 md:hidden ${isClosingEdit ? 'animate-overlay-fade-out pointer-events-none' : 'animate-overlay-fade'}`} onClick={handleCloseEdit}></div>
                    
                    {/* Container */}
                    <div className={`fixed inset-x-0 bottom-0 z-50 w-full max-h-[90vh] bg-white rounded-t-[1.5rem] shadow-2xl flex flex-col overflow-hidden md:static md:w-auto md:max-h-none md:bg-transparent md:shadow-none md:rounded-none md:overflow-visible ${isClosingEdit ? 'animate-responsive-modal-close md:hidden' : 'animate-responsive-modal md:block md:animate-in md:slide-in-from-bottom-4 md:fade-in'}`}>
                        
                        {/* Colored Mobile Header */}
                        <div className="bg-slate-900 text-white p-5 sm:p-6 flex items-center justify-between shrink-0 relative md:hidden">
                            <div className="w-16 h-1.5 bg-white/20 rounded-full absolute top-2 left-1/2 -translate-x-1/2"></div>
                            <h3 className="text-xl font-black flex items-center gap-2 mt-2 sm:mt-0"><Edit3 size={22} className="text-blue-400"/> Edit Profile</h3>
                            <button onClick={handleCloseEdit} disabled={isSaving} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors active:scale-95 mt-2 sm:mt-0 disabled:opacity-50">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Flat Form Content */}
                        <div className="flex-1 space-y-5 overflow-y-auto p-5 md:p-0 md:overflow-visible custom-scrollbar pb-8">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider flex items-center gap-1.5"><Hash size={14}/> Employee ID *</label>
                                    <input type="text" value={formData.emp_id} onChange={(e) => setFormData({...formData, emp_id: e.target.value})} className="w-full p-3 text-sm sm:text-base bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none font-bold text-slate-900 font-mono transition-all" />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider flex items-center gap-1.5"><User size={14}/> Full Name *</label>
                                    <input type="text" value={formData.full_name} onChange={(e) => setFormData({...formData, full_name: e.target.value})} className="w-full p-3 text-sm sm:text-base bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none font-bold text-slate-900 transition-all" />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider flex items-center gap-1.5"><Briefcase size={14}/> Designation</label>
                                    <input type="text" value={formData.designation} onChange={(e) => setFormData({...formData, designation: e.target.value})} className="w-full p-3 text-sm sm:text-base bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none font-bold text-slate-900 transition-all" />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider flex items-center gap-1.5"><Building2 size={14}/> Department *</label>
                                    <CustomSelect 
                                        options={departments.map(d => ({ value: d.name, label: d.name }))} 
                                        value={formData.department} 
                                        onChange={(val: string) => setFormData({...formData, department: val})} 
                                        placeholder="Select Department..." 
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider flex items-center gap-1.5"><Mail size={14}/> Login Email</label>
                                    <input type="text" value={profile?.email || ''} disabled className="w-full p-3 text-sm sm:text-base bg-slate-100 border border-slate-200 rounded-xl text-slate-400 font-bold cursor-not-allowed" />
                                    <p className="text-[10px] font-bold text-slate-400 mt-1.5">Email cannot be changed directly.</p>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider flex items-center gap-1.5"><Phone size={14}/> Contact Number</label>
                                    <input type="tel" value={formData.contact_number} onChange={(e) => setFormData({...formData, contact_number: e.target.value})} className="w-full p-3 text-sm sm:text-base bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none font-bold text-slate-900 transition-all" />
                                </div>
                            </div>
                        </div>

                        {/* Flat Action Buttons */}
                        <div className="flex gap-3 pt-3 pb-5 border-t border-slate-100 bg-white shrink-0 md:mt-4 md:pb-0 px-5 md:px-0">
                            <button onClick={handleCloseEdit} disabled={isSaving} className="flex-1 py-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-xl active:scale-95 transition-all text-sm sm:text-base disabled:opacity-50">
                                Cancel
                            </button>
                            <button onClick={handleSaveProfile} disabled={isSaving} className="flex-[1.5] py-3 bg-blue-600 text-white font-bold rounded-xl border border-blue-600 hover:bg-blue-700 active:scale-95 transition-all text-sm sm:text-base flex justify-center items-center gap-2 disabled:opacity-50 shadow-sm">
                                {isSaving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : <><Save size={16} /> Save Changes</>}
                            </button>
                        </div>
                    </div>
                </>
            )}
          </div>
        </div>

        {/* Left Column: Security Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-3xl border-2 border-slate-300 shadow-sm overflow-hidden p-6 relative">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-slate-900"></div>
            <div className="flex items-center gap-3 mb-4 mt-2">
              <Shield size={24} className="text-slate-900" />
              <h3 className="text-xl font-black text-slate-900">Security</h3>
            </div>
            <p className="text-sm text-slate-600 font-medium mb-6">Keep your account secure and manage your login preferences.</p>
            
            <div className="space-y-3">
                <button 
                  onClick={() => setIsPasswordModalOpen(true)}
                  className="w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 text-base border-2 border-slate-900 shadow-md"
                >
                  <Lock size={18} /> Change Password
                </button>
                
                {/* BIOMETRICS BUTTON */}
                <button 
                  onClick={handleRegisterPasskey}
                  disabled={isRegisteringPasskey}
                  className="w-full py-3.5 px-4 bg-white hover:bg-slate-50 text-slate-900 font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 text-base border-2 border-slate-200 shadow-sm disabled:opacity-50"
                >
                  {isRegisteringPasskey ? (
                      <span className="w-5 h-5 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin"></span>
                  ) : (
                      <><Fingerprint size={18} className="text-blue-600" /> Register Biometrics</>
                  )}
                </button>
            </div>
          </div>
        </div>

      </div>

      {/* --- Footer Area (Legal & Version) --- */}
      <div className="pt-8 pb-4 text-center">
        
        {/* Legal Links Component */}
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 mb-3 text-sm text-slate-500">
            <button 
                onClick={() => setOpenLegalModal('privacy')} 
                className="hover:text-slate-800 hover:underline transition-colors"
            >
                Privacy Policy
            </button>
            <span className="text-slate-300">•</span>
            <button 
                onClick={() => setOpenLegalModal('terms')} 
                className="hover:text-slate-800 hover:underline transition-colors"
            >
                Terms of Use
            </button>
            <span className="text-slate-300">•</span>
            <button 
                onClick={() => setOpenLegalModal('aup')} 
                className="hover:text-slate-800 hover:underline transition-colors"
            >
                Acceptable Use
            </button>
        </div>

        {/* Dynamic Version Display */}
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            FileTrackr. • v{packageJson.version}
          </p>
      </div>

      {/* Password Change Modal */}
      {isPasswordModalOpen && (
        <ChangePasswordModal 
          userEmail={profile?.email} 
          onClose={() => setIsPasswordModalOpen(false)} 
        />
      )}

      {/* --- Legal Document Modal --- */}
      {openLegalModal && (
        <div className={`fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm ${isClosingLegal ? 'animate-overlay-fade-out' : 'animate-overlay-fade'}`}>
            <div className={`relative flex w-full max-w-3xl flex-col max-h-[90vh] sm:max-h-[85vh] overflow-hidden rounded-2xl sm:rounded-3xl bg-white shadow-2xl ${isClosingLegal ? 'animate-responsive-modal-close' : 'animate-responsive-modal'}`}>
                
                {/* Modal Header */}
                <div className="flex items-center justify-between border-b border-slate-100 px-5 sm:px-6 py-4 sm:py-5 bg-slate-900 text-white shrink-0">
                    <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
                        <Shield size={18} className="text-slate-400" />
                        {legalTitles[openLegalModal]}
                    </h2>
                    <button 
                        onClick={handleCloseLegalModal} 
                        className="rounded-full p-2 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Modal Content body (Markdown Parsed via Tailwind Typography) */}
                <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-6 sm:py-8 custom-scrollbar bg-slate-50/50">
                    <article className="prose prose-slate prose-sm sm:prose-base max-w-none prose-headings:text-slate-900 prose-a:text-blue-600 prose-p:text-slate-700">
                        <ReactMarkdown>
                            {legalContents[openLegalModal]}
                        </ReactMarkdown>
                    </article>
                </div>

                {/* Modal Footer / Acknowledge Button */}
                <div className="border-t border-slate-200 bg-white px-5 sm:px-6 py-4 text-right shrink-0">
                    <button 
                        onClick={handleCloseLegalModal} 
                        className="w-full sm:w-auto rounded-xl bg-slate-900 px-8 py-3 sm:py-2.5 text-sm font-bold text-white transition-all active:scale-95 hover:bg-slate-800 border-2 border-slate-900 shadow-sm"
                    >
                        I Understand
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}

// --- SECURE CHANGE PASSWORD MODAL COMPONENT --- //
function ChangePasswordModal({ userEmail, onClose }: { userEmail?: string, onClose: () => void }) {
  const [isClosing, setIsClosing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Visibility Toggles
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => onClose(), 400);
  };

  // --- Password Strength Logic ---
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
    return { score, text: 'Strong', color: 'bg-emerald-500' };
  };

  const strength = getStrength(newPassword);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userEmail) { toast.error("User email missing."); return; }
    if (!currentPassword) { toast.error("Please enter your current password."); return; }
    if (strength.score < 3) { toast.error("Please choose a stronger new password."); return; }
    if (newPassword !== confirmPassword) { toast.error("New passwords do not match."); return; }

    setIsSubmitting(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: currentPassword,
      });

      if (signInError) {
        toast.error("Current password is incorrect.", { description: "Verification failed." });
        setIsSubmitting(false);
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

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
        
        <div className="bg-slate-900 text-white p-5 sm:p-6 flex items-center justify-between shrink-0 relative">
          <div className="w-16 h-1.5 bg-white/20 rounded-full absolute top-2 left-1/2 -translate-x-1/2 sm:hidden"></div>
          <h3 className="font-black text-xl flex items-center gap-2 mt-2 sm:mt-0"><Lock size={22}/> Change Password</h3>
          <button onClick={handleClose} disabled={isSubmitting} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors active:scale-95 disabled:opacity-50">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto">
          
          {/* CURRENT PASSWORD */}
          <div>
            <label className="block text-sm font-bold text-slate-900 mb-1.5">Current Password</label>
            <div className="relative">
              <input 
                type={showCurrent ? "text" : "password"} 
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password" 
                className="w-full pl-4 pr-12 py-3.5 bg-white border-2 border-slate-300 focus:border-slate-900 rounded-xl outline-none font-bold text-slate-900 transition-colors" 
              />
              <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                {showCurrent ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <div className="h-px w-full bg-slate-200 my-2"></div>

          {/* NEW PASSWORD */}
          <div>
            <label className="block text-sm font-bold text-slate-900 mb-1.5">New Password</label>
            <div className="relative mb-3">
              <input 
                type={showNew ? "text" : "password"} 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Create new password" 
                className="w-full pl-4 pr-12 py-3.5 bg-white border-2 border-slate-300 focus:border-slate-900 rounded-xl outline-none font-bold text-slate-900 transition-colors" 
              />
              <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                {showNew ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            {/* STRENGTH METER */}
            <div className="space-y-2 mb-4">
              <div className="flex gap-1 h-1.5 w-full">
                {[1, 2, 3, 4, 5].map((level) => (
                  <div key={level} className={`flex-1 rounded-full transition-colors duration-300 ${strength.score >= level ? strength.color : 'bg-slate-200'}`}></div>
                ))}
              </div>
              <p className="text-xs font-bold text-right text-slate-500 uppercase tracking-wide">{strength.text}</p>
            </div>

            {/* REQUIREMENTS CHECKLIST */}
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

          {/* CONFIRM PASSWORD */}
          <div>
            <label className="block text-sm font-bold text-slate-900 mb-1.5">Confirm New Password</label>
            <div className="relative">
              <input 
                type={showConfirm ? "text" : "password"} 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password" 
                className={`w-full pl-4 pr-12 py-3.5 bg-white border-2 outline-none font-bold text-slate-900 transition-colors rounded-xl ${
                    confirmPassword && newPassword !== confirmPassword ? 'border-red-400 focus:border-red-600 bg-red-50/50' : 'border-slate-300 focus:border-slate-900'
                }`} 
              />
              <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                {showConfirm ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs font-bold text-red-600 mt-1.5 flex items-center gap-1"><AlertCircle size={12}/> Passwords do not match</p>
            )}
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
        <div className={`flex items-center gap-1.5 text-xs font-bold ${met ? 'text-emerald-600' : 'text-slate-400'}`}>
            <div className={`w-4 h-4 rounded-full flex items-center justify-center border ${met ? 'bg-emerald-100 border-emerald-300' : 'bg-slate-100 border-slate-300'}`}>
                {met && <Check size={10} strokeWidth={4} />}
            </div>
            {label}
        </div>
    );
}