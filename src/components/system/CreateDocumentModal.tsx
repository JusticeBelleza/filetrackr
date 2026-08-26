import React, { useState, useEffect, useRef } from 'react';
import { X, FileText, AlertCircle, MapPin, Send, ChevronDown, Hash, Camera, CheckCircle, User, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useUiStore } from '../../store/uiStore';
import { supabase } from '../../lib/supabase';
// Ensure DocumentScanner is saved in the same directory, or adjust this import path
import DocumentScanner from './DocumentScanner';

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

// --- TypeScript Interfaces ---
interface SelectOption {
    label: string;
    value: string;
}

type OptionType = SelectOption | string;

interface CustomSelectProps {
    options: OptionType[];
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
    disabled?: boolean;
    emptyText?: string;
    isRelative?: boolean;
    itemType?: string;
}

interface Employee {
    name: string;
    department: string;
}

// --- UPGRADED SEARCHABLE CUSTOM SELECT ---
function CustomSelect({ options, value, onChange, placeholder, disabled = false, emptyText = "Loading options...", isRelative = false, itemType = "option" }: CustomSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const dropdownRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null); 
    const searchInputRef = useRef<HTMLInputElement>(null);
 
    useEffect(() => {
      function handleClickOutside(event: MouseEvent) {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsOpen(false);
      }
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
      if (isOpen) {
        setTimeout(() => {
          searchInputRef.current?.focus();
          menuRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 50);
      } else {
        setSearchTerm("");
      }
    }, [isOpen]);

    const filteredOptions = options.filter(opt => {
        const optLabel = typeof opt === 'string' ? opt : opt.label;
        return optLabel.toLowerCase().includes(searchTerm.toLowerCase());
    });

    const MAX_ITEMS_TO_SHOW = 4;
    const visibleOptions = filteredOptions.slice(0, MAX_ITEMS_TO_SHOW);
    const hiddenCount = filteredOptions.length - visibleOptions.length;

    const selectedOptionLabel = options.find(opt => (typeof opt === 'string' ? opt : opt.value) === value);
    const displayLabel = selectedOptionLabel 
        ? (typeof selectedOptionLabel === 'string' ? selectedOptionLabel : selectedOptionLabel.label)
        : placeholder;
 
    return (
      <div className="relative w-full" ref={dropdownRef}>
        <button 
            type="button" 
            disabled={disabled}
            onClick={() => !disabled && setIsOpen(!isOpen)} 
            className={`w-full px-4 py-3 border-2 rounded-xl flex justify-between items-center transition-all text-sm sm:text-base outline-none active:scale-[0.99] ${
                disabled ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed' :
                isOpen ? 'border-blue-500 bg-white ring-4 ring-blue-500/10' : 'bg-white border-slate-200 hover:border-slate-300'
            } ${!value && !disabled ? 'text-slate-500 font-medium' : 'text-slate-900 font-bold'}`}
        >
          <span className="truncate">
            {displayLabel}
          </span>
          {!disabled && (
              <ChevronDown size={20} className={`text-slate-400 transition-transform duration-300 ease-in-out sm:w-5 sm:h-5 ${isOpen ? 'rotate-180 text-slate-800' : ''}`} />
          )}
        </button>

        {isOpen && !disabled && (
          <div ref={menuRef} className={`${isRelative ? 'relative mt-2 mb-4' : 'absolute mt-1.5'} z-50 w-full bg-white border-2 border-slate-200 rounded-xl shadow-xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200`}>
            
            {/* Always show search bar if there are multiple options */}
            {options.length > 3 && (
                <div className="p-2 border-b-2 border-slate-100 bg-white shrink-0">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder="Type to search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full pl-9 pr-3 py-2.5 bg-white border-2 border-blue-100 rounded-lg text-sm focus:outline-none focus:border-blue-500 transition-all font-medium text-slate-800 placeholder:text-slate-400"
                        />
                    </div>
                </div>
            )}

            <div className="max-h-[240px] overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
              {filteredOptions.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-slate-500 text-center font-medium">
                      {searchTerm ? `No results for "${searchTerm}"` : emptyText}
                  </div>
              ) : (
                  visibleOptions.map((option: OptionType, idx: number) => {
                    const optValue = typeof option === 'string' ? option : option.value;
                    const optLabel = typeof option === 'string' ? option : option.label;
                    const isSelected = optValue === value;

                    return (
                      <div 
                        key={idx} 
                        onClick={() => { onChange(optValue); setIsOpen(false); }} 
                        className={`px-4 py-3 text-sm sm:text-base rounded-lg cursor-pointer transition-colors flex items-center active:scale-95 ${isSelected ? 'bg-blue-600 text-white font-bold shadow-sm' : 'text-slate-700 hover:bg-slate-100 font-medium'}`}
                      >
                        {optLabel}
                      </div>
                    );
                  })
              )}
            </div>

            {/* Notification Footer for hidden items matching the screenshot */}
            {hiddenCount > 0 && (
                <div className="p-3 bg-slate-50 border-t-2 border-slate-100 shrink-0 text-center">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        +{hiddenCount} more {hiddenCount === 1 ? itemType : `${itemType}s`}. Keep typing to search.
                    </p>
                </div>
            )}

          </div>
        )}
      </div>
    );
}

export default function CreateDocumentModal() {
    const closeCreateModal = useUiStore((state: { closeCreateModal: () => void }) => state.closeCreateModal);
    
    const [isClosing, setIsClosing] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Document Scanner State
    const [isScannerOpen, setIsScannerOpen] = useState(false);

    const [categories, setCategories] = useState<SelectOption[]>([]);
    const [departments, setDepartments] = useState<SelectOption[]>([]);
    
    const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
    const [currentUserDept, setCurrentUserDept] = useState<string>("");

    const [attachment, setAttachment] = useState<File | Blob | null>(null);
    const [attachmentName, setAttachmentName] = useState<string>('');

    const [formData, setFormData] = useState(() => ({
        trackingNumber: `DOC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
        title: '',
        category: '',
        destination: '',
        assignedClerk: '',
        isUrgent: false,
        remarks: ''
    }));

    const fetchDropdownOptions = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            
            const [catRes, deptRes, empRes] = await Promise.all([
                supabase.from('categories').select('name').order('name'),
                supabase.from('departments').select('name').order('name'),
                supabase.from('employees').select('name, department').order('name')
            ]);
            
            if (catRes.data) setCategories(catRes.data.map(c => ({ label: c.name, value: c.name })));
            if (deptRes.data) setDepartments(deptRes.data.map(d => ({ label: d.name, value: d.name })));
            if (empRes.data) setAllEmployees(empRes.data);

            if (session && empRes.data) {
                const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', session.user.id).single();
                if (profile?.full_name) {
                    const matchedEmployee = empRes.data.find((e: Employee) => e.name === profile.full_name);
                    if (matchedEmployee) {
                        setCurrentUserDept(matchedEmployee.department);
                    }
                }
            }
        } catch (error) {
            console.error("Error fetching options:", error);
        }
    };

    useEffect(() => {
        fetchDropdownOptions();
    }, []);

    // Filter available clerks strictly to the current user's department
    const availableClerks = allEmployees
        .filter(emp => currentUserDept ? emp.department === currentUserDept : true)
        .map(emp => ({ label: emp.name, value: emp.name }));

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => closeCreateModal(), 300); 
    };

    const handleScanComplete = (pdfBlob: Blob) => {
        setAttachment(pdfBlob);
        setAttachmentName(`Scanned_Doc_${formData.trackingNumber}.pdf`);
        setIsScannerOpen(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.title.trim() || !formData.category || !formData.destination) {
            toast.error('Please fill in all required fields.');
            return;
        }

        if (availableClerks.length > 0 && !formData.assignedClerk) {
            toast.error('Please select an internal clerk to assign this to.');
            return;
        }

        setIsSubmitting(true);

        try {
            // 🔒 SECURE SERVER VERIFICATION
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError || !user) {
                toast.error("Authentication Error", { description: "Your session is invalid or expired. Please log in again." });
                return;
            }

            let attachmentUrl = null;

            if (attachment) {
                // Use crypto.randomUUID() for mathematically guaranteed unique file names
                const fileName = `${formData.trackingNumber}-${crypto.randomUUID()}.pdf`;
                
                const { error: uploadError } = await supabase.storage
                    .from('attachments')
                    .upload(fileName, attachment, { contentType: 'application/pdf' });

                if (uploadError) throw uploadError;

                const { data } = supabase.storage.from('attachments').getPublicUrl(fileName);
                attachmentUrl = data.publicUrl;
            }

            // 1. Insert Document and get its returned ID (.select().single())
            const { data: newDoc, error } = await supabase.from('documents').insert([{
                reference_no: formData.trackingNumber,
                title: formData.title.trim(),
                category: formData.category,
                final_destination: formData.destination,
                assigned_clerk: formData.assignedClerk || null,
                is_urgent: formData.isUrgent,
                remarks: formData.remarks.trim(),
                created_by: user.id, // 🔒 THE UPGRADE
                attachment_url: attachmentUrl,
                status: 'routing' 
            }]).select().single();

            if (error) throw error;

            // 2. Automatically log the creation event!
            await supabase.from('document_logs').insert([{
                document_id: newDoc.id,
                action: 'Document Logged',
                location: currentUserDept || 'Originating Office',
                attachment_url: attachmentUrl,
                created_by: user.id // 🔒 THE UPGRADE
            }]);

            toast.success('Document Routed Successfully!', { description: `Tracking No: ${formData.trackingNumber}` });
            
            // Graceful close
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
        <div className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-sm ${isClosing ? 'animate-overlay-fade-out' : 'animate-overlay-fade'}`}>
            <style>{modalAnimationStyles}</style>
            <div className={`bg-white w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden shadow-2xl rounded-t-[1.5rem] sm:rounded-3xl ${isClosing ? 'animate-responsive-modal-close' : 'animate-responsive-modal'}`}>
                
                {/* Clean Flat Header */}
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

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-8 custom-scrollbar">
                    <div className="space-y-6">

                        {/* Flat Tracking Number Badge */}
                        <div className="bg-white border-2 border-slate-200 p-4 rounded-xl flex items-center justify-between shadow-sm">
                            <div>
                                <p className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider mb-0.5">Tracking Number</p>
                                <p className="font-mono text-lg sm:text-xl font-black text-slate-900 tracking-widest">{formData.trackingNumber}</p>
                            </div>
                            <Hash className="text-slate-300" size={28} />
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

                        {/* Integrated Document Scanner Section */}
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

                        <div>
                            <label className="block text-[11px] sm:text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Document Category *</label>
                            <CustomSelect 
                                options={categories} 
                                value={formData.category} 
                                onChange={(val: string) => setFormData({...formData, category: val})} 
                                placeholder="Select Category..." 
                                itemType="category"
                            />
                        </div>

                        {/* Flat Routing Grouping Box */}
                        <div className="p-5 rounded-[1.25rem] border-2 border-slate-100 bg-slate-50/50 space-y-5">
                            <div className="relative z-20">
                                <label className="block text-[11px] sm:text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5 uppercase tracking-wider">
                                    <MapPin size={14} className="text-blue-600" /> Final Destination *
                                </label>
                                <CustomSelect 
                                    options={departments} 
                                    value={formData.destination} 
                                    onChange={(val: string) => setFormData({...formData, destination: val})} 
                                    placeholder="Select Office..." 
                                    isRelative={true}
                                    itemType="office"
                                />
                            </div>

                            <div className="relative z-10">
                                <label className="block text-[11px] sm:text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5 uppercase tracking-wider">
                                    <User size={14} className="text-blue-600" /> Assign To (Internal Clerk) *
                                </label>
                                <CustomSelect 
                                    options={availableClerks} 
                                    value={formData.assignedClerk} 
                                    onChange={(val: string) => setFormData({...formData, assignedClerk: val})} 
                                    placeholder="Select employee..." 
                                    emptyText={currentUserDept ? `No staff registered under ${currentUserDept}` : "No staff found"}
                                    isRelative={true}
                                    itemType="employee"
                                />
                            </div>
                        </div>

                        {/* Flat Urgent Toggle */}
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

                {/* Flat Footer Buttons */}
                <div className="bg-slate-50 p-4 sm:p-5 border-t-2 border-slate-200 flex gap-3 shrink-0 pb-6 sm:pb-5">
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
            
            {/* Render the Scanner Modal on top when active */}
            {isScannerOpen && (
                <DocumentScanner
                    onScanComplete={handleScanComplete}
                    onClose={() => setIsScannerOpen(false)}
                />
            )}
        </div>
    );
}