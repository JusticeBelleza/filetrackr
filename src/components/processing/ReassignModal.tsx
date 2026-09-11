import { useState, useEffect, useRef } from 'react';
import { X, UserPlus, Search, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';

// --- UPGRADED SEARCHABLE CUSTOM SELECT ---
interface SelectOption { label: string; value: string; }
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

function CustomSelect({ options, value, onChange, placeholder, disabled = false, emptyText = "Loading options...", isRelative = false, itemType = "employee" }: CustomSelectProps) {
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
                disabled ? 'bg-slate-50 border-slate-200 text-slate-500 cursor-not-allowed' :
                isOpen ? 'border-blue-500 bg-white ring-4 ring-blue-500/10' : 'bg-white border-slate-200 hover:border-slate-300'
            } ${!value && !disabled ? 'text-slate-500 font-medium' : 'text-slate-900 font-bold'}`}
        >
          <span className="truncate">{displayLabel}</span>
          {!disabled && (
              <ChevronDown size={20} className={`text-slate-400 transition-transform duration-300 ease-in-out sm:w-5 sm:h-5 ${isOpen ? 'rotate-180 text-slate-800' : ''}`} />
          )}
        </button>

        {isOpen && !disabled && (
          <div ref={menuRef} className={`${isRelative ? 'relative mt-2 mb-4' : 'absolute mt-1.5'} z-50 w-full bg-white border-2 border-slate-200 rounded-xl shadow-xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200`}>
            
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

// --- Interfaces ---
interface DocumentItem {
    id: string;
    reference_no?: string;
    title?: string;
    current_location?: string;
    assigned_clerk?: string;
    created_by?: string; // <-- ADDED to check the creator
}

interface ReassignModalProps {
    doc: DocumentItem;
    currentUserName: string;
    onClose: () => void;
    onSuccess: () => void;
}

export default function ReassignModal({ doc, currentUserName, onClose, onSuccess }: ReassignModalProps) {
    const [selectedColleague, setSelectedColleague] = useState('');
    const [isReassigning, setIsReassigning] = useState(false);
    const [colleagues, setColleagues] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [creatorName, setCreatorName] = useState<string>(''); // <-- NEW: Stores the creator's name
    const [isClosing, setIsClosing] = useState(false);

    const handleClose = () => {
        if (isClosing) return;
        setIsClosing(true);
        setTimeout(() => {
            onClose();
        }, 200); 
    };

    // 1. Fetch Colleagues and the Document's Creator
    useEffect(() => {
        const fetchInitialData = async () => {
            setIsLoading(true);
            try {
                // Fetch creator's name if we have the created_by ID
                if (doc.created_by) {
                    const { data: creatorData } = await supabase.from('profiles').select('full_name').eq('id', doc.created_by).single();
                    if (creatorData) setCreatorName(creatorData.full_name);
                }

                // Fetch colleagues
                const { data: userData } = await supabase.from('employees').select('department').eq('name', currentUserName).single();
                if (userData && userData.department) {
                    const { data: deptUsers } = await supabase.from('employees')
                        .select('name')
                        .eq('department', userData.department)
                        .order('name'); 
                        
                    if (deptUsers) {
                        setColleagues(deptUsers.map(u => u.name));
                    }
                }
            } catch (error) {
                console.error("Failed to fetch data", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchInitialData();
    }, [currentUserName, doc.created_by]);

    const handleConfirm = async () => {
        if (!selectedColleague) {
            toast.error("Validation Error", { description: "Please select a colleague to assign this to." });
            return;
        }
        
        setIsReassigning(true);
        try {
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError || !user) throw new Error("Your session is invalid or expired.");

            const prevClerk = doc.assigned_clerk || 'Unassigned';

            // --- THE UPGRADE: AUTOMATIC HANDSHAKE BYPASS ---
            // If the selected colleague is the person who originally created the document, skip the handshake!
            const isReturningToCreator = selectedColleague === creatorName;
            const nextStatus = isReturningToCreator ? 'routing' : 'pending_receipt';

            // Force the status update safely
            const { error: updateError } = await supabase
                .from('documents')
                .update({ 
                    status: nextStatus,
                    assigned_clerk: selectedColleague 
                })
                .eq('id', doc.id);
                
            if (updateError) throw updateError;

            // Log the action via RPC
            const { error: rpcError } = await supabase.rpc('process_document_action', {
                p_doc_id: doc.id,
                p_log_action: 'REASSIGNED',
                p_log_location: doc.current_location || 'Processing',
                p_log_created_by: user.id,
                p_log_assigned_to: null,
                p_log_remarks: `Details: Reassigned from ${prevClerk} to ${selectedColleague} by ${currentUserName}`,
                p_log_signature_url: null,
                p_log_attachment_url: null,
                p_new_status: nextStatus, // <-- Applies the dynamic status
                p_new_location: null,
                p_new_clerk: selectedColleague,
                p_new_remarks: null,
                p_clear_remarks: false,
                p_completed_attachment_url: null
            });

            if (rpcError) console.warn("RPC Log Warning:", rpcError);

            toast.success("Reassigned", { 
                description: isReturningToCreator 
                    ? `Assigned back to creator (${selectedColleague}).`
                    : `Assigned to ${selectedColleague} for receiving.` 
            });
            
            onSuccess();
            handleClose(); 
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
            toast.error("Reassignment Failed", { description: errorMessage });
        } finally {
            setIsReassigning(false);
        }
    };

    return (
        <div className={`fixed inset-0 z-[1050] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/70 backdrop-blur-sm transition-all ${isClosing ? 'animate-out fade-out duration-200 fill-mode-forwards' : 'animate-in fade-in duration-200'}`}>
            <div className={`bg-white w-full max-w-xl max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden shadow-2xl rounded-t-[1.5rem] sm:rounded-3xl ${isClosing ? 'animate-out slide-out-to-bottom-[100%] sm:slide-out-to-bottom-0 sm:zoom-out-95 duration-200 fill-mode-forwards' : 'animate-in slide-in-from-bottom-[100%] sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300'}`}>
                
                <div className="text-white relative flex flex-col shrink-0 transition-colors duration-300 bg-[#0f766e]">
                    <div className="w-16 h-1.5 bg-white/30 rounded-full mx-auto mt-3 sm:hidden shrink-0"></div>
                    <div className="p-5 pt-3 sm:pt-6 flex items-center justify-between">
                        <div className="w-10"></div> 
                        <h3 className="font-black text-xl tracking-tight absolute left-1/2 -translate-x-1/2 whitespace-nowrap">Re-assign</h3>
                        <button onClick={handleClose} disabled={isReassigning} className="p-2 -mr-2 bg-white/10 hover:bg-white/20 active:bg-white/30 rounded-full transition-all active:scale-90 disabled:opacity-50">
                            <X size={24} />
                        </button>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-6 custom-scrollbar bg-white">
                    <div className="space-y-6">
                        <div className="relative z-20">
                            <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Select Colleague *</label>
                            <CustomSelect 
                                options={colleagues} 
                                value={selectedColleague} 
                                onChange={(val: string) => setSelectedColleague(val)} 
                                placeholder="Choose an employee..." 
                                emptyText={isLoading ? "Loading colleagues..." : "No employee found"} 
                                isRelative={true} 
                                itemType="employee"
                            />
                        </div>
                    </div>
                </div>
                
                <div className="bg-white p-4 sm:p-5 flex shrink-0 border-t border-slate-50">
                    <button 
                        onClick={handleConfirm} 
                        disabled={isReassigning || !selectedColleague} 
                        className={`w-full text-white font-bold py-3.5 rounded-xl shadow-sm transition-all active:scale-[0.98] text-sm flex items-center justify-center gap-2 ${
                            selectedColleague 
                                ? 'bg-[#0f766e] hover:bg-[#0b5c55]'
                                : 'bg-[#7bc1b5] cursor-not-allowed opacity-80'
                        }`}
                    >
                        {isReassigning ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : <><UserPlus size={18} strokeWidth={2.5} /> Confirm Re-assign</>}
                    </button>
                </div>
            </div>
        </div>
    );
}