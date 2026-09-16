import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Building2, FolderTree, Users, Shield, Plus, 
  Trash2, X, Activity, AlertTriangle, 
  ClipboardList, Settings, Clock, Search,
  Save, ChevronDown, Phone, Zap, MapPin, Hash, AlertCircle, Mail, KeyRound, Eye, EyeOff, Copy, Check, Edit
} from 'lucide-react';
import { toast } from 'sonner';

// --- Import React Query Hooks & Components ---
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import StorageMonitor from '../components/system/StorageMonitor'; 
import DepartmentSelect from '../components/ui/DepartmentSelect';

// --- Shared Modal Animation Styles ---
const modalAnimationStyles = `
    @keyframes customFadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes iosSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
    @keyframes desktopZoomIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    @keyframes customFadeOut { from { opacity: 1; } to { opacity: 0; } }
    @keyframes iosSlideDown { from { transform: translateY(0); } to { transform: translateY(100%); } }
    @keyframes desktopZoomOut { from { transform: scale(1); opacity: 1; } to { transform: scale(0.95); opacity: 0; } }
    
    .animate-overlay-fade { animation: customFadeIn 0.5s ease-out forwards; }
    .animate-overlay-fade-out { animation: customFadeOut 0.4s ease-in forwards; }
    .animate-responsive-modal { animation: iosSlideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    .animate-responsive-modal-close { animation: iosSlideDown 0.4s cubic-bezier(0.3, 0, 0.8, 0.15) forwards; }
    
    .scrollbar-hide::-webkit-scrollbar { display: none; }
    .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }

    @media (min-width: 640px) {
        .animate-responsive-modal { animation: desktopZoomIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-responsive-modal-close { animation: desktopZoomOut 0.3s cubic-bezier(0.3, 0, 0.8, 0.15) forwards; }
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
}

interface NavButtonProps {
    label: string;
    icon?: React.ReactNode;
    isActive?: boolean;
    onClick?: () => void;
}

interface StatCardProps {
    title: string;
    value: string | number;
    icon?: React.ReactNode;
    color?: string;
}

interface EmployeeData {
    id: string;
    name: string;
    email: string;
    emp_id?: string;
    department?: string;
    designation?: string;
}

interface DepartmentItem {
    id: string;
    name: string;
    office_id?: string;
    office_address?: string;
    department_head?: string;
    email_address?: string;
    contact_number?: string;
}

interface CategoryItem {
    id: string;
    name: string;
    category_id?: string;
    prefix?: string;
}

interface AuditLogItem {
    id: number;
    user_name: string;
    action: string;
    ip_address?: string;
    created_at: string;
}

export default function SystemAdmin() {
  const queryClient = useQueryClient();
  const [mainTab, setMainTab] = useState<'dashboard' | 'directory' | 'audit' | 'settings'>('dashboard');
  const [dirTab, setDirTab] = useState<'departments' | 'categories' | 'employees'>('departments');

  // --- LOCAL FORM STATES ---
  const [globalSettings, setGlobalSettings] = useState({ maintenanceMode: false, sessionTimeout: '30' });
  
  // UPDATED: Office State with Rich Metadata
  const [newOffice, setNewOffice] = useState({ 
      id: '', 
      office_id: '', 
      office_name: '', 
      office_address: '',
      department_head: '',
      email_address: '',
      contact_number: ''
  });
  const [isEditingOffice, setIsEditingOffice] = useState(false);
  
  // UPDATED: Category State with Prefix
  const [newCat, setNewCat] = useState({ category_id: '', name: '', prefix: '' });
  
  const [newEmp, setNewEmp] = useState({ 
      emp_id: '', name: '', email: '', designation: '', 
      department: '', contactNumber: '', password: '', confirmPassword: '' 
  });
  
  // Password Visibility Toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // --- Accordion & Pagination State ---
  const [expandedDepts, setExpandedDepts] = useState<Record<string, boolean>>({});
  const [folderPages, setFolderPages] = useState<Record<string, number>>({});
  
  // NEW: Office Pagination
  const [deptPage, setDeptPage] = useState(1);
  const deptsPerPage = 6;

  // --- Audit Log Search State ---
  const [auditSearch, setAuditSearch] = useState('');

  // --- Modal Open/Close States ---
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [isClosingDept, setIsClosingDept] = useState(false);
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [isClosingCat, setIsClosingCat] = useState(false);
  const [isEmpModalOpen, setIsEmpModalOpen] = useState(false);
  const [isClosingEmp, setIsClosingEmp] = useState(false);

  // Deletion States
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [isClosingDelete, setIsClosingDelete] = useState(false);
  const [deleteCatConfirm, setDeleteCatConfirm] = useState<{ id: string; name: string } | null>(null);
  const [isClosingCatDelete, setIsClosingCatDelete] = useState(false);
  const [deleteEmpConfirm, setDeleteEmpConfirm] = useState<{ id: string; name: string; emp_id: string } | null>(null);
  const [isClosingEmpDelete, setIsClosingEmpDelete] = useState(false);

  // Reset Password States
  const [resetTargetEmployee, setResetTargetEmployee] = useState<{ id: string; name: string; email: string; generatedPassword?: string } | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [isClosingResetModal, setIsClosingResetModal] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);

  // Duplicate Notification Modal State
  const [duplicateError, setDuplicateError] = useState<{ title: string; message: string } | null>(null);
  const [isClosingDuplicateError, setIsClosingDuplicateError] = useState(false);

  const closeDeptModal = () => { setIsClosingDept(true); setTimeout(() => { setIsDeptModalOpen(false); setIsClosingDept(false); }, 400); };
  const closeCatModal = () => { setIsClosingCat(true); setTimeout(() => { setIsCatModalOpen(false); setIsClosingCat(false); }, 400); };
  const closeEmpModal = () => { setIsClosingEmp(true); setTimeout(() => { setIsEmpModalOpen(false); setIsClosingEmp(false); }, 400); };
  
  const closeDeleteModal = () => { setIsClosingDelete(true); setTimeout(() => { setDeleteConfirm(null); setIsClosingDelete(false); }, 400); };
  const closeCatDeleteModal = () => { setIsClosingCatDelete(true); setTimeout(() => { setDeleteCatConfirm(null); setIsClosingCatDelete(false); }, 400); };
  const closeEmpDeleteModal = () => { setIsClosingEmpDelete(true); setTimeout(() => { setDeleteEmpConfirm(null); setIsClosingEmpDelete(false); }, 400); };
  
  const closeResetModal = () => { 
      setIsClosingResetModal(true); 
      setTimeout(() => { 
          setResetTargetEmployee(null); 
          setIsClosingResetModal(false); 
          setHasCopied(false);
      }, 400); 
  };

  const closeDuplicateError = () => {
      setIsClosingDuplicateError(true);
      setTimeout(() => {
          setDuplicateError(null);
          setIsClosingDuplicateError(false);
      }, 400);
  };

  // =========================================
  // 🚀 REACT QUERY: FETCH ALL ADMIN DATA
  // =========================================
  const { data: adminData, isLoading } = useQuery({
    queryKey: ['adminData'],
    queryFn: async () => {
      const [deptRes, catRes, empRes, logRes, settingsRes] = await Promise.all([
        supabase.from('departments').select('*').order('name'),
        supabase.from('categories').select('*').order('name'),
        supabase.from('employees').select('*').order('created_at', { ascending: false }),
        supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('global_settings').select('*').eq('id', 1).single()
      ]);

      return {
        departments: (deptRes.data || []) as DepartmentItem[],
        categories: (catRes.data || []) as CategoryItem[],
        employees: (empRes.data || []) as EmployeeData[],
        auditLogs: (logRes.data || []) as AuditLogItem[],
        settings: settingsRes.data
      };
    }
  });

  // Sync settings when fetched
  useEffect(() => {
    if (adminData?.settings) {
      setGlobalSettings({
        maintenanceMode: adminData.settings.maintenance_mode,
        sessionTimeout: adminData.settings.session_timeout
      });
    }
  }, [adminData?.settings]);

  // Safe fallback arrays
  const departments = useMemo(() => adminData?.departments || [], [adminData?.departments]);
  const categories = useMemo(() => adminData?.categories || [], [adminData?.categories]);
  const employees = useMemo(() => adminData?.employees || [], [adminData?.employees]);
  const auditLogs = useMemo(() => adminData?.auditLogs || [], [adminData?.auditLogs]);

  // --- Department Pagination Logic ---
  const totalDeptPages = Math.ceil(departments.length / deptsPerPage);
  const paginatedDepts = departments.slice((deptPage - 1) * deptsPerPage, deptPage * deptsPerPage);

  // --- Filtered Audit Logs Logic ---
  const filteredAuditLogs = useMemo(() => {
      if (!auditSearch.trim()) return auditLogs;
      const term = auditSearch.toLowerCase();
      return auditLogs.filter(log => 
          log.user_name?.toLowerCase().includes(term) || 
          log.action?.toLowerCase().includes(term) || 
          log.id.toString().includes(term) ||
          log.ip_address?.toLowerCase().includes(term)
      );
  }, [auditLogs, auditSearch]);

  // --- Group Employees by Department ---
  const employeesByDepartment = useMemo(() => {
      const grouped: Record<string, EmployeeData[]> = {};
      departments.forEach(dept => { grouped[dept.name] = []; });

      employees.forEach(emp => {
          const deptName = emp.department || 'Unassigned';
          if (!grouped[deptName]) grouped[deptName] = []; 
          grouped[deptName].push(emp);
      });

      return Object.entries(grouped)
          .map(([department, emps]) => ({ department, emps }))
          .sort((a, b) => a.department.localeCompare(b.department));
  }, [employees, departments]);

  const toggleDeptAccordion = (deptName: string) => {
      setExpandedDepts(prev => ({
          ...prev,
          [deptName]: !prev[deptName]
      }));
  };

  // --- Action Handlers ---
  const openOfficeModal = () => {
      const randomArray = new Uint32Array(1);
      window.crypto.getRandomValues(randomArray);
      const randomNum = 1000 + (randomArray[0] % 9000);
      
      setIsEditingOffice(false);
      setNewOffice({ 
          id: '', 
          office_id: `OFC-${randomNum}`, 
          office_name: '', 
          office_address: '',
          department_head: '',
          email_address: '',
          contact_number: ''
      });
      setIsDeptModalOpen(true);
  };

  const openEditOfficeModal = (dept: DepartmentItem) => {
      setIsEditingOffice(true);
      setNewOffice({
          id: dept.id,
          office_id: dept.office_id || 'OFC-LEGACY',
          office_name: dept.name,
          office_address: dept.office_address || '',
          department_head: dept.department_head || '',
          email_address: dept.email_address || '',
          contact_number: dept.contact_number || ''
      });
      setIsDeptModalOpen(true);
  };

  const openCatModal = () => {
      const randomArray = new Uint32Array(1);
      window.crypto.getRandomValues(randomArray);
      const randomNum = 1000 + (randomArray[0] % 9000);
      
      setNewCat({ category_id: `CAT-${randomNum}`, name: '', prefix: '' });
      setIsCatModalOpen(true);
  };

  const openEmployeeModal = () => {
      setNewEmp({ 
          emp_id: '', name: '', email: '', designation: '', 
          department: '', contactNumber: '', 
          password: '', confirmPassword: '' 
      });
      setShowPassword(false);
      setShowConfirmPassword(false);
      setIsEmpModalOpen(true);
  }

  const handleGeneratePassword = () => {
      const array = new Uint32Array(1);
      window.crypto.getRandomValues(array);
      const pass = 'User@' + (1000 + (array[0] % 9000));
      
      setNewEmp({...newEmp, password: pass, confirmPassword: pass});
      setShowPassword(true);
      setShowConfirmPassword(true);
  };

  const logAuditAction = async (action: string) => {
      await supabase.from('audit_logs').insert([{ user_name: 'System Admin', action: action, ip_address: 'Internal' }]);
      queryClient.invalidateQueries({ queryKey: ['adminData'] }); 
  };

  // Departments Handlers (Supports Add and Edit)
  const handleAddDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOffice.office_name.trim() || !newOffice.office_address.trim()) {
        toast.error('Please fill in all required office fields.');
        return;
    }
    
    const payload = {
        name: newOffice.office_name.trim(),
        office_id: newOffice.office_id,
        office_address: newOffice.office_address.trim(),
        department_head: newOffice.department_head.trim() || null,
        email_address: newOffice.email_address.trim() || null,
        contact_number: newOffice.contact_number.trim() || null
    };

    let error;
    if (isEditingOffice) {
        const res = await supabase.from('departments').update(payload).eq('id', newOffice.id);
        error = res.error;
    } else {
        const res = await supabase.from('departments').insert([payload]);
        error = res.error;
    }

    if (error) { toast.error(`Failed to ${isEditingOffice ? 'update' : 'add'} office`); return; }
    
    queryClient.invalidateQueries({ queryKey: ['adminData'] }); 
    closeDeptModal(); 
    toast.success(`Office ${isEditingOffice ? 'updated' : 'added'} successfully`);
    logAuditAction(`${isEditingOffice ? 'Updated' : 'Added new'} office: ${newOffice.office_name.trim()}`);
  };

  const confirmDeleteDepartment = async () => {
      if (!deleteConfirm) return;
      const { id, name } = deleteConfirm;
      const { error } = await supabase.from('departments').delete().eq('id', id);
      
      if (error) { toast.error('Failed to delete office'); } 
      else {
          queryClient.invalidateQueries({ queryKey: ['adminData'] });
          toast.success('Office removed successfully');
          logAuditAction(`Deleted office: ${name}`);
      }
      closeDeleteModal();
  };

  // Categories Handlers (With Smart Duplicate Prefix Validation)
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCat.name.trim()) { toast.error('Please provide a category name.'); return; }
    
    const trimmedPrefix = newCat.prefix ? newCat.prefix.trim().toUpperCase() : null;

    // --- SMART DUPLICATE PREFIX CHECK ---
    if (trimmedPrefix) {
        const isDuplicate = categories.some(
            cat => cat.prefix && cat.prefix.toUpperCase() === trimmedPrefix
        );

        if (isDuplicate) {
            const conflictingCat = categories.find(
                cat => cat.prefix && cat.prefix.toUpperCase() === trimmedPrefix
            );
            toast.error('Duplicate Prefix Detected!', {
                description: `The prefix "${trimmedPrefix}" is already in use by "${conflictingCat?.name}". Please choose a unique acronym.`
            });
            return; 
        }
    }
    
    const payload = {
        name: newCat.name.trim(),
        category_id: newCat.category_id,
        prefix: trimmedPrefix
    };

    const { error } = await supabase.from('categories').insert([payload]);

    if (error) { toast.error('Failed to add category'); return; }
    
    queryClient.invalidateQueries({ queryKey: ['adminData'] });
    closeCatModal(); 
    toast.success('Category added successfully');
    logAuditAction(`Added new category: ${newCat.name.trim()} (${trimmedPrefix || 'No Prefix'})`);
  };

  const confirmDeleteCategory = async () => {
      if (!deleteCatConfirm) return;
      const { id, name } = deleteCatConfirm;
      const { error } = await supabase.from('categories').delete().eq('id', id);
      
      if (error) { toast.error('Failed to delete category'); } 
      else {
          queryClient.invalidateQueries({ queryKey: ['adminData'] });
          toast.success('Category removed successfully');
          logAuditAction(`Deleted category: ${name}`);
      }
      closeCatDeleteModal();
  };

  // Employee Handlers
  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmp.emp_id || !newEmp.name || !newEmp.email || !newEmp.designation || !newEmp.contactNumber || !newEmp.password || !newEmp.department) { 
        toast.error('Please fill all required fields.'); return; 
    }
    if (newEmp.password !== newEmp.confirmPassword) {
        toast.error('Passwords do not match.'); return;
    }

    const { data, error } = await supabase.functions.invoke('create-employee', {
      body: {
        email: newEmp.email.trim(), password: newEmp.password, name: newEmp.name,
        emp_id: newEmp.emp_id, department: newEmp.department,
        designation: newEmp.designation, contactNumber: newEmp.contactNumber
      }
    });

    if (error || data?.error) {
        let displayMessage = error?.message || data?.error || 'Registration Failed';
        try {
            const errObj = error as { context?: { json?: () => Promise<{ error?: string }> } };
            if (errObj?.context?.json) {
                const bodyJson = await errObj.context.json();
                if (bodyJson?.error) displayMessage = bodyJson.error;
            }
        } catch {
            // Ignored safely
        }

        if (displayMessage.includes('Email has already been registered')) {
            setDuplicateError({
                title: 'Duplicate Email',
                message: 'An account with this email address already exists in the system. Please use a different email.'
            });
        } else if (displayMessage.includes('Employee ID has already been registered')) {
            setDuplicateError({
                title: 'Duplicate ID',
                message: 'This Employee ID is already actively assigned to someone else. Please verify the ID.'
            });
        } else {
            toast.error('Registration Failed', { description: displayMessage });
        }
        return;
    }

    setExpandedDepts(prev => ({ ...prev, [newEmp.department]: true }));
    queryClient.invalidateQueries({ queryKey: ['adminData'] });
    closeEmpModal(); 
    toast.success('Employee registered successfully');
    logAuditAction(`Registered new employee: ${newEmp.emp_id}`);
  };

  const confirmDeleteEmployee = async () => {
      if (!deleteEmpConfirm) return;
      const { id, name, emp_id } = deleteEmpConfirm;
      const { error } = await supabase.from('employees').delete().eq('id', id);
      
      if (error) { toast.error('Failed to delete employee'); } 
      else {
          queryClient.invalidateQueries({ queryKey: ['adminData'] });
          toast.success('Employee deleted');
          logAuditAction(`Deleted employee: ${emp_id} (${name})`);
      }
      closeEmpDeleteModal();
  };

  // Reset Password Handlers
  const openResetPasswordModal = (emp: EmployeeData) => {
      const array = new Uint32Array(1);
      window.crypto.getRandomValues(array);
      const generatedPass = '@User' + (1000 + (array[0] % 9000));
      
      setResetTargetEmployee({ 
          id: emp.id, 
          name: emp.name, 
          email: emp.email,
          generatedPassword: generatedPass
      });
  };

  const copyToClipboard = () => {
      if (resetTargetEmployee?.generatedPassword) {
          navigator.clipboard.writeText(resetTargetEmployee.generatedPassword);
          setHasCopied(true);
          setTimeout(() => setHasCopied(false), 2000);
          toast.success("Password copied to clipboard!");
      }
  };

  const handleResetPasswordConfirm = async () => {
    if (!resetTargetEmployee?.generatedPassword) return;
    setIsResetting(true);
    try {
        const { data, error } = await supabase.functions.invoke('reset-password', {
            body: { 
                userId: resetTargetEmployee.id, 
                newPassword: resetTargetEmployee.generatedPassword 
            }
        });
        
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        
        toast.success("Password Reset Successful", { description: `The new password for ${resetTargetEmployee.name} is now active.` });
        logAuditAction(`Force reset password for user: ${resetTargetEmployee.email}`);
        closeResetModal();
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
        toast.error("Failed to reset password", { description: errorMessage });
    } finally {
        setIsResetting(false);
    }
  };

  const saveGlobalSettings = async () => {
    const { error } = await supabase.from('global_settings').update({
        maintenance_mode: globalSettings.maintenanceMode,
        session_timeout: globalSettings.sessionTimeout
    }).eq('id', 1);

    if (error) toast.error('Failed to update settings');
    else {
        toast.success('System Settings Updated');
        logAuditAction(`Updated global settings (Maintenance: ${globalSettings.maintenanceMode})`);
    }
  };

  const sessionOptions = [
    { value: '30', label: '30 Minutes' },
    { value: '60', label: '1 Hour' },
    { value: '480', label: '8 Hours' },
    { value: '1440', label: '24 Hours' },
    { value: 'never', label: 'Never' }
  ];

  if (isLoading) {
      return (
          <div className="flex flex-col items-center justify-center min-h-[50vh]">
              <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
              <p className="mt-4 text-slate-500 font-bold">Loading System Data...</p>
          </div>
      );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500 pb-12">
      <style>{modalAnimationStyles}</style>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 mb-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Shield className="text-blue-600" size={32} /> Admin Portal
          </h2>
          <p className="text-base text-slate-600 mt-1">Global system overview, security, and directory management.</p>
        </div>
      </div>

      {/* Main Admin Navigation */}
      <div className="flex flex-nowrap overflow-x-auto scrollbar-hide gap-2 sm:gap-3 bg-slate-900 p-2 rounded-2xl shadow-lg w-full sm:inline-flex sm:w-auto mb-6">
        <MainNavButton label="Overview" icon={<Activity size={18} />} isActive={mainTab === 'dashboard'} onClick={() => setMainTab('dashboard')} />
        <MainNavButton label="Directory" icon={<Users size={18} />} isActive={mainTab === 'directory'} onClick={() => setMainTab('directory')} />
        <MainNavButton label="Audit Logs" icon={<ClipboardList size={18} />} isActive={mainTab === 'audit'} onClick={() => setMainTab('audit')} />
        <MainNavButton label="System Config" icon={<Settings size={18} />} isActive={mainTab === 'settings'} onClick={() => setMainTab('settings')} />
      </div>

      {/* =========================================
          VIEW 1: SYSTEM DASHBOARD (OVERVIEW)
      ========================================= */}
      {mainTab === 'dashboard' && (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-5">
            <StatCard title="Registered Offices" value={departments.length} icon={<Building2 className="text-emerald-600" />} color="bg-emerald-50 border-emerald-200" />
            <StatCard title="Active Employees" value={employees.length} icon={<Users className="text-blue-600" />} color="bg-blue-50 border-blue-200" />
            <StatCard title="Doc Categories" value={categories.length} icon={<FolderTree className="text-indigo-600" />} color="bg-indigo-50 border-indigo-200" />
            <StatCard title="Audit Logs" value={auditLogs.length} icon={<ClipboardList className="text-orange-600" />} color="bg-orange-50 border-orange-200" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
            <div className="lg:col-span-1">
              <StorageMonitor />
            </div>
            <div className="lg:col-span-2"></div>
          </div>
        </div>
      )}

      {/* =========================================
          VIEW 2: DIRECTORY MANAGEMENT
      ========================================= */}
      {mainTab === 'directory' && (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <div className="flex flex-nowrap overflow-x-auto scrollbar-hide gap-2 sm:gap-3 bg-white p-2 rounded-2xl border-2 border-slate-300 shadow-sm w-full sm:inline-flex sm:w-auto">
                <SubTabButton label="Departments" icon={<Building2 size={16} />} isActive={dirTab === 'departments'} onClick={() => setDirTab('departments')} />
                <SubTabButton label="Categories" icon={<FolderTree size={16} />} isActive={dirTab === 'categories'} onClick={() => setDirTab('categories')} />
                <SubTabButton label="Employees" icon={<Users size={16} />} isActive={dirTab === 'employees'} onClick={() => setDirTab('employees')} />
            </div>

            {/* DEPARTMENTS / OFFICES */}
            {dirTab === 'departments' && (
                <div className="bg-white rounded-3xl border-2 border-slate-300 shadow-sm overflow-hidden animate-in fade-in">
                    <div className="bg-slate-50 px-6 py-4 border-b-2 border-slate-200 flex justify-between items-center">
                        <h3 className="text-lg font-black text-slate-900">Registered Offices</h3>
                        <button onClick={openOfficeModal} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm flex items-center gap-1.5 transition-all active:scale-95 shadow-md">
                            <Plus size={16} strokeWidth={3} /> Add Office
                        </button>
                    </div>
                    <div className="p-4 sm:p-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {paginatedDepts.map((dept) => (
                                <div key={dept.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 sm:p-5 bg-white rounded-xl border-2 border-slate-200 shadow-sm hover:border-slate-300 transition-colors gap-4">
                                    <div className="flex flex-col gap-1 flex-1 min-w-0">
                                        <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">{dept.office_id || 'OFC-LEGACY'}</span>
                                        <h4 className="font-black text-slate-900 text-sm sm:text-base leading-tight break-words">{dept.name}</h4>
                                        <span className="text-[11px] sm:text-xs font-medium text-slate-500 flex items-start gap-1.5 break-words mt-0.5">
                                            <MapPin size={12} className="text-slate-400 shrink-0 mt-0.5" />
                                            {dept.office_address || 'No address provided'}
                                        </span>
                                        {dept.department_head && (
                                            <span className="text-[11px] sm:text-xs font-medium text-slate-500 flex items-start gap-1.5 break-words mt-0.5">
                                                <Users size={12} className="text-slate-400 shrink-0 mt-0.5" />
                                                Head: {dept.department_head}
                                            </span>
                                        )}
                                        {dept.contact_number && (
                                            <span className="text-[11px] sm:text-xs font-medium text-slate-500 flex items-start gap-1.5 break-words mt-0.5">
                                                <Phone size={12} className="text-slate-400 shrink-0 mt-0.5" />
                                                {dept.contact_number}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-2 sm:mt-0">
                                        <button 
                                            onClick={() => openEditOfficeModal(dept)} 
                                            className="p-2 sm:p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 bg-white rounded-xl transition-all shrink-0 border-2 border-slate-200 hover:border-blue-200 active:scale-95 shadow-sm"
                                            title="Edit Office"
                                        >
                                            <Edit size={18} className="w-4 h-4 sm:w-5 sm:h-5" />
                                        </button>
                                        <button 
                                            onClick={() => setDeleteConfirm({ id: dept.id, name: dept.name })} 
                                            className="p-2 sm:p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 bg-white rounded-xl transition-all shrink-0 border-2 border-slate-200 hover:border-red-200 active:scale-95 shadow-sm"
                                            title="Remove Office"
                                        >
                                            <Trash2 size={18} className="w-4 h-4 sm:w-5 sm:h-5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {/* Office Pagination */}
                        {totalDeptPages > 1 && (
                            <div className="mt-6 flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <span className="text-[11px] sm:text-xs font-bold text-slate-500">
                                    Showing {((deptPage - 1) * deptsPerPage) + 1} to {Math.min(deptPage * deptsPerPage, departments.length)} of {departments.length}
                                </span>
                                <div className="flex gap-2">
                                    <button 
                                        disabled={deptPage === 1}
                                        onClick={() => setDeptPage(p => Math.max(1, p - 1))}
                                        className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg text-[11px] sm:text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 active:scale-95 transition-all shadow-sm"
                                    >Prev</button>
                                    <button 
                                        disabled={deptPage === totalDeptPages}
                                        onClick={() => setDeptPage(p => Math.min(totalDeptPages, p + 1))}
                                        className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg text-[11px] sm:text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 active:scale-95 transition-all shadow-sm"
                                    >Next</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* CATEGORIES */}
            {dirTab === 'categories' && (
                <div className="bg-white rounded-3xl border-2 border-slate-300 shadow-sm overflow-hidden animate-in fade-in">
                    <div className="bg-slate-50 px-6 py-4 border-b-2 border-slate-200 flex justify-between items-center">
                        <h3 className="text-lg font-black text-slate-900">Document Categories</h3>
                        <button onClick={openCatModal} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm flex items-center gap-1.5 transition-all active:scale-95 shadow-md">
                            <Plus size={16} strokeWidth={3} /> Add Category
                        </button>
                    </div>
                    <div className="p-4 sm:p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {categories.map((cat) => (
                                <div key={cat.id} className="flex flex-row items-start sm:items-center justify-between p-4 sm:p-5 bg-white rounded-xl border-2 border-slate-200 shadow-sm hover:border-slate-300 transition-colors gap-4">
                                    <div className="flex flex-col gap-1 flex-1 min-w-0">
                                        <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">{cat.category_id || 'CAT-LEGACY'}</span>
                                        <h4 className="font-black text-slate-900 text-sm sm:text-base leading-tight break-words">{cat.name}</h4>
                                        {cat.prefix && (
                                            <span className="text-[11px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded w-fit mt-1">
                                                Prefix: {cat.prefix}
                                            </span>
                                        )}
                                    </div>
                                    <button 
                                        onClick={() => setDeleteCatConfirm({ id: cat.id, name: cat.name })} 
                                        className="p-2 sm:p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 bg-white rounded-xl transition-all shrink-0 border-2 border-slate-200 hover:border-red-200 active:scale-95 shadow-sm mt-1 sm:mt-0"
                                        title="Remove Category"
                                    >
                                        <Trash2 size={18} className="w-4 h-4 sm:w-5 sm:h-5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* EMPLOYEES DIRECTORY */}
            {dirTab === 'employees' && (
                <div className="bg-white rounded-3xl border-2 border-slate-300 shadow-sm overflow-hidden animate-in fade-in">
                    <div className="bg-slate-50 px-6 py-4 border-b-2 border-slate-200 flex justify-between items-center">
                        <h3 className="text-lg font-black text-slate-900">Employee Directory</h3>
                        <button onClick={openEmployeeModal} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm flex items-center gap-1.5 transition-all active:scale-95 shadow-md">
                            <Plus size={16} strokeWidth={3} /> Register
                        </button>
                    </div>
                    
                    <div className="p-4 sm:p-6">
                        {employeesByDepartment.map(({ department, emps }) => {
                            const isExpanded = expandedDepts[department];
                            const currentPage = folderPages[department] || 1;
                            const itemsPerPage = 5;
                            const totalPages = Math.ceil(emps.length / itemsPerPage);
                            const paginatedEmps = emps.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

                            return (
                                <div key={department} className="mb-4 last:mb-0 bg-white border-2 border-slate-200 rounded-xl overflow-hidden hover:border-slate-300 transition-colors shadow-sm">
                                    <button 
                                        onClick={() => toggleDeptAccordion(department)}
                                        className={`w-full py-4 px-4 flex items-start sm:items-center justify-between transition-colors focus:outline-none group ${isExpanded ? 'bg-slate-50' : 'bg-transparent'}`}
                                    >
                                        <div className="flex flex-col text-left flex-1 min-w-0 pr-4 gap-1">
                                            <h4 className="font-bold text-slate-800 text-xs sm:text-sm leading-snug break-words">{department}</h4>
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded text-slate-500 bg-slate-200 w-fit">
                                                {emps.length} registered
                                            </span>
                                        </div>
                                        <ChevronDown 
                                            size={18} 
                                            className={`shrink-0 text-slate-400 transition-transform duration-200 mt-1 sm:mt-0 ${isExpanded ? 'rotate-180 text-blue-600' : 'group-hover:text-slate-600'}`} 
                                        />
                                    </button>

                                    {isExpanded && (
                                        <div className="animate-in fade-in slide-in-from-top-1 duration-200 bg-white border-t-2 border-slate-100 flex flex-col">
                                            {emps.length === 0 ? (
                                                <div className="py-6 text-center text-sm text-slate-400 italic">
                                                    No personnel registered in this office.
                                                </div>
                                            ) : (
                                                <div className="divide-y divide-slate-100">
                                                    {paginatedEmps.map((emp) => (
                                                        <div key={emp.id} className="flex flex-row items-start sm:items-center justify-between p-4 sm:p-5 gap-4 group hover:bg-slate-50/50 transition-colors border-b border-slate-200 last:border-b-0">
                                                            <div className="flex flex-col gap-1 flex-1 min-w-0">
                                                                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">{emp.emp_id}</span>
                                                                <h4 className="font-black text-slate-900 text-sm sm:text-base leading-tight break-words">{emp.name}</h4>
                                                                <span className="text-xs sm:text-sm font-bold text-slate-600 break-words">{emp.designation}</span>
                                                                {emp.email && (
                                                                    <span className="text-[11px] sm:text-xs font-medium text-slate-500 flex items-start gap-1.5 break-all mt-0.5">
                                                                        <Mail size={12} className="text-slate-400 shrink-0 mt-0.5"/> 
                                                                        {emp.email}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <button 
                                                                    onClick={() => openResetPasswordModal(emp)}
                                                                    className="p-2 sm:p-2.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 bg-white rounded-xl transition-all shrink-0 border-2 border-slate-200 hover:border-amber-200 active:scale-95 shadow-sm mt-1 sm:mt-0"
                                                                    title="Reset Password"
                                                                >
                                                                    <KeyRound size={18} className="w-4 h-4 sm:w-5 sm:h-5" />
                                                                </button>
                                                                <button 
                                                                    onClick={() => setDeleteEmpConfirm({ id: emp.id, name: emp.name, emp_id: emp.emp_id || 'Unknown' })} 
                                                                    className="p-2 sm:p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 bg-white rounded-xl transition-all shrink-0 border-2 border-slate-200 hover:border-red-200 active:scale-95 shadow-sm mt-1 sm:mt-0"
                                                                    title="Remove Employee"
                                                                >
                                                                    <Trash2 size={18} className="w-4 h-4 sm:w-5 sm:h-5" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            {totalPages > 1 && (
                                                <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                                                    <span className="text-[10px] sm:text-xs font-bold text-slate-500">
                                                        Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, emps.length)} of {emps.length}
                                                    </span>
                                                    <div className="flex gap-2">
                                                        <button 
                                                            disabled={currentPage === 1}
                                                            onClick={() => setFolderPages(prev => ({...prev, [department]: currentPage - 1}))}
                                                            className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg text-[11px] sm:text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 active:scale-95 transition-all shadow-sm"
                                                        >Prev</button>
                                                        <button 
                                                            disabled={currentPage === totalPages}
                                                            onClick={() => setFolderPages(prev => ({...prev, [department]: currentPage + 1}))}
                                                            className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg text-[11px] sm:text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 active:scale-95 transition-all shadow-sm"
                                                        >Next</button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
      )}

      {/* =========================================
          VIEW 3: AUDIT LOGS
      ========================================= */}
      {mainTab === 'audit' && (
        <div className="bg-white rounded-3xl border-2 border-slate-300 shadow-sm overflow-hidden animate-in fade-in zoom-in-95 duration-300">
            <div className="bg-slate-900 px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-white">
                <div className="flex items-center gap-3">
                    <ClipboardList className="text-blue-400" size={24} />
                    <h3 className="text-xl font-black tracking-wide">System Security Audit Logs</h3>
                </div>
                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                        type="text" 
                        value={auditSearch}
                        onChange={(e) => setAuditSearch(e.target.value)}
                        placeholder="Search logs..." 
                        className="w-full pl-9 pr-4 py-2 bg-slate-800 border-2 border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-400 focus:border-blue-500 outline-none transition-colors" 
                    />
                </div>
            </div>
            
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b-2 border-slate-200">
                            <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Log ID</th>
                            <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Timestamp</th>
                            <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">User</th>
                            <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Action Performed</th>
                            <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">IP Address</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredAuditLogs.map((log) => (
                            <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                                <td className="p-4 text-sm font-mono text-slate-500">#{log.id}</td>
                                <td className="p-4 text-sm font-bold text-slate-700 whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</td>
                                <td className="p-4 text-sm font-bold text-slate-900 whitespace-nowrap">{log.user_name}</td>
                                <td className="p-4 text-sm font-medium text-slate-700">{log.action}</td>
                                <td className="p-4 text-sm font-mono text-slate-500">{log.ip_address || 'Internal'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filteredAuditLogs.length === 0 && (
                    <div className="p-8 text-center flex flex-col items-center justify-center gap-2">
                        <Search size={32} className="text-slate-300" />
                        <p className="text-slate-500 font-bold">
                            {auditSearch ? `No logs found matching "${auditSearch}"` : 'No audit logs available.'}
                        </p>
                    </div>
                )}
            </div>
            <div className="bg-slate-50 p-4 border-t-2 border-slate-200 text-center">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Showing latest 50 logs. Logs are immutable.</p>
            </div>
        </div>
      )}

      {/* =========================================
          VIEW 4: GLOBAL SYSTEM SETTINGS
      ========================================= */}
      {mainTab === 'settings' && (
        <div className="bg-white rounded-3xl border-2 border-slate-300 shadow-sm animate-in fade-in zoom-in-95 duration-300">
            <div className="bg-slate-900 px-6 py-5 flex items-center gap-3 text-white rounded-t-[22px]">
                <Settings className="text-blue-400" size={24} />
                <h3 className="text-xl font-black tracking-wide">Global System Configuration</h3>
            </div>
            <div className="p-6 sm:p-8 space-y-8 relative z-10">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-red-50 border-2 border-red-200 rounded-2xl">
                    <div>
                        <h4 className="font-black text-red-900 text-lg flex items-center gap-2">
                            <AlertTriangle size={20} className="text-red-600"/> Maintenance Mode
                        </h4>
                        <p className="text-sm text-red-800 font-medium mt-1">Prevents non-admin users from logging in during system updates.</p>
                    </div>
                    <button 
                        onClick={() => setGlobalSettings({...globalSettings, maintenanceMode: !globalSettings.maintenanceMode})}
                        className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200 ease-in-out focus:outline-none ${globalSettings.maintenanceMode ? 'bg-red-600 border-red-700' : 'bg-slate-300 border-slate-400'}`}
                    >
                        <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out mt-0.5 ml-0.5 ${globalSettings.maintenanceMode ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="max-w-md">
                        <label className="block text-base font-bold text-slate-900 mb-2 flex items-center gap-2">
                            <Clock size={18} className="text-slate-500"/> Auto-Logout Session Timeout
                        </label>
                        <CustomSelect 
                            options={sessionOptions}
                            value={globalSettings.sessionTimeout}
                            onChange={(val: string) => setGlobalSettings({...globalSettings, sessionTimeout: val})}
                            placeholder="Select Timeout..."
                        />
                        <p className="text-xs font-bold text-slate-500 mt-2">Logs users out after inactivity.</p>
                    </div>
                </div>
            </div>
            <div className="bg-slate-50 p-6 border-t-2 border-slate-200 flex justify-end rounded-b-[22px]">
                <button onClick={saveGlobalSettings} className="w-full sm:w-auto px-8 py-4 bg-slate-900 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 text-base border-2 border-slate-900 hover:border-blue-700 shadow-md">
                    <Save size={20} /> Apply Global Settings
                </button>
            </div>
        </div>
      )}

      {/* =========================================
          MODALS WITH ANIMATIONS
      ========================================= */}
      
      {/* MODAL 1: ADD / EDIT DEPARTMENT OFFICE */}
      {isDeptModalOpen && (
        <div className={`fixed inset-0 z-[999] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/50 backdrop-blur-sm ${isClosingDept ? 'animate-overlay-fade-out' : 'animate-overlay-fade'}`}>
          <div className={`bg-white w-full max-w-lg rounded-t-[1.5rem] sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${isClosingDept ? 'animate-responsive-modal-close' : 'animate-responsive-modal'}`}>
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between shrink-0">
              <h3 className="font-black text-xl">{isEditingOffice ? 'Edit Office' : 'Add New Office'}</h3>
              <button onClick={closeDeptModal} className="p-2 bg-white/10 hover:bg-white/20 rounded-full"><X size={20} /></button>
            </div>
            <form onSubmit={handleAddDepartment} className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
              
              <div className="bg-blue-50 border-2 border-blue-200 p-4 rounded-xl flex items-center justify-between">
                 <div>
                    <p className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-0.5">Office ID</p>
                    <p className="font-mono text-lg font-black text-slate-900 tracking-widest">{newOffice.office_id}</p>
                 </div>
                 <Hash className="text-blue-500" size={24} />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-900 mb-1.5">Office Name *</label>
                <input 
                  type="text" 
                  value={newOffice.office_name} 
                  onChange={(e) => setNewOffice({...newOffice, office_name: e.target.value})} 
                  placeholder="e.g. Provincial Engineering Office" 
                  className="w-full p-3.5 bg-slate-50 border-2 border-slate-400 rounded-xl focus:border-slate-900 outline-none font-bold text-slate-900 text-base" 
                  autoFocus 
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-900 mb-1.5 flex items-center gap-1.5"><MapPin size={16} /> Office Address *</label>
                <textarea 
                  value={newOffice.office_address} 
                  onChange={(e) => setNewOffice({...newOffice, office_address: e.target.value})} 
                  placeholder="e.g. 2nd Floor, Capitol Building, Bangued, Abra" 
                  className="w-full p-3.5 bg-slate-50 border-2 border-slate-400 rounded-xl focus:border-slate-900 outline-none font-bold text-slate-900 text-base min-h-[80px] resize-y" 
                ></textarea>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-900 mb-1.5 flex items-center gap-1.5"><Users size={16} /> Department Head (Optional)</label>
                <input 
                  type="text" 
                  value={newOffice.department_head} 
                  onChange={(e) => setNewOffice({...newOffice, department_head: e.target.value})} 
                  placeholder="e.g. Dr. Juan Dela Cruz" 
                  className="w-full p-3.5 bg-slate-50 border-2 border-slate-200 focus:border-slate-900 rounded-xl outline-none font-bold text-slate-900 text-base transition-colors" 
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-900 mb-1.5 flex items-center gap-1.5"><Mail size={16} /> Email (Optional)</label>
                    <input 
                      type="email" 
                      value={newOffice.email_address} 
                      onChange={(e) => setNewOffice({...newOffice, email_address: e.target.value})} 
                      placeholder="office@abrapho.gov" 
                      className="w-full p-3.5 bg-slate-50 border-2 border-slate-200 focus:border-slate-900 rounded-xl outline-none font-bold text-slate-900 text-base transition-colors" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-900 mb-1.5 flex items-center gap-1.5"><Phone size={16} /> Contact (Optional)</label>
                    <input 
                      type="tel" 
                      value={newOffice.contact_number} 
                      onChange={(e) => setNewOffice({...newOffice, contact_number: e.target.value})} 
                      placeholder="0917-000-0000" 
                      className="w-full p-3.5 bg-slate-50 border-2 border-slate-200 focus:border-slate-900 rounded-xl outline-none font-bold text-slate-900 text-base transition-colors" 
                    />
                  </div>
              </div>

              <div className="pt-4 flex gap-3 shrink-0">
                <button type="button" onClick={closeDeptModal} className="flex-1 py-3.5 bg-white border-2 border-slate-300 text-slate-700 font-bold rounded-xl active:scale-95 transition-transform text-base">Cancel</button>
                <button type="submit" className="flex-[1.5] py-3.5 bg-slate-900 text-white font-bold rounded-xl border-2 border-slate-900 active:scale-95 transition-transform text-base">
                    {isEditingOffice ? 'Save Changes' : 'Register Office'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL - OFFICES */}
      {deleteConfirm && (
        <div className={`fixed inset-0 z-[999] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/50 backdrop-blur-sm ${isClosingDelete ? 'animate-overlay-fade-out' : 'animate-overlay-fade'}`}>
          <div className={`bg-white w-full max-w-md rounded-t-[1.5rem] sm:rounded-[2rem] shadow-2xl overflow-hidden ${isClosingDelete ? 'animate-responsive-modal-close' : 'animate-responsive-modal'}`}>
            <div className="bg-red-600 text-white p-5 sm:px-6 flex items-center justify-between">
              <h3 className="font-black text-xl flex items-center gap-2"><AlertCircle size={22} strokeWidth={2.5} /> Confirm Deletion</h3>
              <button onClick={closeDeleteModal} className="p-2 bg-black/10 hover:bg-black/20 rounded-full transition-colors active:scale-95 -mr-1"><X size={20} /></button>
            </div>
            <div className="p-6 sm:p-7 space-y-6">
              <p className="text-sm sm:text-base text-slate-600 font-medium leading-relaxed">
                Are you sure you want to permanently delete <strong className="text-slate-900">{deleteConfirm.name}</strong>? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button type="button" onClick={closeDeleteModal} className="flex-1 py-3.5 bg-white border border-slate-300 text-slate-700 font-bold rounded-xl active:scale-95 hover:bg-slate-50 transition-all text-sm sm:text-base">Cancel</button>
                <button type="button" onClick={confirmDeleteDepartment} className="flex-1 py-3.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl active:scale-95 transition-all text-sm sm:text-base shadow-sm border border-red-600">Yes, Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD CATEGORY */}
      {isCatModalOpen && (
        <div className={`fixed inset-0 z-[999] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/50 backdrop-blur-sm ${isClosingCat ? 'animate-overlay-fade-out' : 'animate-overlay-fade'}`}>
          <div className={`bg-white w-full max-w-lg rounded-t-[1.5rem] sm:rounded-2xl shadow-2xl overflow-hidden ${isClosingCat ? 'animate-responsive-modal-close' : 'animate-responsive-modal'}`}>
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <h3 className="font-black text-xl">Add Document Category</h3>
              <button onClick={closeCatModal} className="p-2 bg-white/10 hover:bg-white/20 rounded-full"><X size={20} /></button>
            </div>
            <form onSubmit={handleAddCategory} className="p-6 space-y-5">
              
              <div className="bg-blue-50 border-2 border-blue-200 p-4 rounded-xl flex items-center justify-between">
                 <div>
                    <p className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-0.5">Category ID</p>
                    <p className="font-mono text-lg font-black text-slate-900 tracking-widest">{newCat.category_id}</p>
                 </div>
                 <FolderTree className="text-blue-500" size={24} />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-900 mb-1.5">Category Name *</label>
                <input 
                  type="text" 
                  value={newCat.name} 
                  onChange={(e) => setNewCat({...newCat, name: e.target.value})} 
                  placeholder="e.g. Purchase Request" 
                  className="w-full p-3.5 bg-slate-50 border-2 border-slate-400 rounded-xl focus:border-slate-900 outline-none font-bold text-slate-900 text-base" 
                  autoFocus 
                />
              </div>

              {/* NEW CATEGORY PREFIX INPUT */}
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-1.5">Category Acronym / Prefix (Optional)</label>
                <input 
                  type="text" 
                  value={newCat.prefix} 
                  onChange={(e) => setNewCat({...newCat, prefix: e.target.value.toUpperCase()})} 
                  placeholder="e.g. PR" 
                  className="w-full p-3.5 bg-slate-50 border-2 border-slate-200 focus:border-slate-900 rounded-xl outline-none font-bold text-slate-900 text-base transition-colors" 
                />
                <p className="text-xs text-slate-500 font-bold mt-2">This is used to automatically generate tracking numbers (e.g. PR-2026-1234).</p>
              </div>

              <div className="pt-4 flex gap-3 shrink-0">
                <button type="button" onClick={closeCatModal} className="flex-1 py-3.5 bg-white border-2 border-slate-300 text-slate-700 font-bold rounded-xl active:scale-95 transition-transform text-base">Cancel</button>
                <button type="submit" className="flex-[1.5] py-3.5 bg-slate-900 text-white font-bold rounded-xl border-2 border-slate-900 active:scale-95 transition-transform text-base">Save Category</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL - CATEGORIES */}
      {deleteCatConfirm && (
        <div className={`fixed inset-0 z-[999] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/50 backdrop-blur-sm ${isClosingCatDelete ? 'animate-overlay-fade-out' : 'animate-overlay-fade'}`}>
          <div className={`bg-white w-full max-w-md rounded-t-[1.5rem] sm:rounded-[2rem] shadow-2xl overflow-hidden ${isClosingCatDelete ? 'animate-responsive-modal-close' : 'animate-responsive-modal'}`}>
            <div className="bg-red-600 text-white p-5 sm:px-6 flex items-center justify-between">
              <h3 className="font-black text-xl flex items-center gap-2"><AlertCircle size={22} strokeWidth={2.5} /> Confirm Deletion</h3>
              <button onClick={closeCatDeleteModal} className="p-2 bg-black/10 hover:bg-black/20 rounded-full transition-colors active:scale-95 -mr-1"><X size={20} /></button>
            </div>
            <div className="p-6 sm:p-7 space-y-6">
              <p className="text-sm sm:text-base text-slate-600 font-medium leading-relaxed">
                Are you sure you want to permanently delete <strong className="text-slate-900">{deleteCatConfirm.name}</strong>? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button type="button" onClick={closeCatDeleteModal} className="flex-1 py-3.5 bg-white border border-slate-300 text-slate-700 font-bold rounded-xl active:scale-95 hover:bg-slate-50 transition-all text-sm sm:text-base">Cancel</button>
                <button type="button" onClick={confirmDeleteCategory} className="flex-1 py-3.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl active:scale-95 transition-all text-sm sm:text-base shadow-sm border border-red-600">Yes, Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL - EMPLOYEES */}
      {deleteEmpConfirm && (
        <div className={`fixed inset-0 z-[999] flex items-end sm:items-center justify-center p-4 sm:p-0 bg-slate-900/60 backdrop-blur-sm ${isClosingEmpDelete ? 'animate-overlay-fade-out' : 'animate-overlay-fade'}`}>
          <div className={`bg-white w-full max-w-md rounded-t-[1.5rem] sm:rounded-[2rem] shadow-2xl overflow-hidden ${isClosingEmpDelete ? 'animate-responsive-modal-close' : 'animate-responsive-modal'}`}>
            <div className="bg-red-600 text-white p-5 sm:px-6 flex items-center justify-between">
              <h3 className="font-black text-xl flex items-center gap-2"><AlertCircle size={22} strokeWidth={2.5} /> Confirm Deletion</h3>
              <button onClick={closeEmpDeleteModal} className="p-2 bg-black/10 hover:bg-black/20 rounded-full transition-colors active:scale-95 -mr-1"><X size={20} /></button>
            </div>
            <div className="p-6 sm:p-7 space-y-6">
              <p className="text-sm sm:text-base text-slate-600 font-medium leading-relaxed">
                Are you sure you want to permanently delete <strong className="text-slate-900">{deleteEmpConfirm.name}</strong>? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button type="button" onClick={closeEmpDeleteModal} className="flex-1 py-3.5 bg-white border border-slate-300 text-slate-700 font-bold rounded-xl active:scale-95 hover:bg-slate-50 transition-all text-sm sm:text-base">Cancel</button>
                <button type="button" onClick={confirmDeleteEmployee} className="flex-1 py-3.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl active:scale-95 transition-all text-sm sm:text-base shadow-sm border border-red-600">Yes, Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RESET PASSWORD CONFIRMATION MODAL */}
      {resetTargetEmployee && (
          <div className={`fixed inset-0 z-[999] flex items-end sm:items-center justify-center p-4 sm:p-0 bg-slate-900/60 backdrop-blur-sm ${isClosingResetModal ? 'animate-overlay-fade-out' : 'animate-overlay-fade'}`}>
              <div className={`bg-white w-full max-w-sm rounded-t-[1.5rem] sm:rounded-[2rem] shadow-2xl overflow-hidden ${isClosingResetModal ? 'animate-responsive-modal-close' : 'animate-responsive-modal'}`}>
                  <div className="bg-red-600 text-white p-5 sm:px-6 flex items-center justify-between">
                      <h3 className="font-black text-xl flex items-center gap-2"><KeyRound size={22} strokeWidth={2.5} /> Force Reset</h3>
                      <button onClick={closeResetModal} className="p-2 bg-black/10 hover:bg-black/20 rounded-full transition-colors active:scale-95 -mr-1"><X size={20} /></button>
                  </div>
                  
                  <div className="p-6 sm:p-7 space-y-6">
                      <p className="text-sm sm:text-base text-slate-600 font-medium leading-relaxed">
                          This instantly changes the password for <strong className="text-slate-900">{resetTargetEmployee.name}</strong>. Copy the temporary password below.
                      </p>
                      
                      <div className="p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl flex items-center justify-between group transition-colors hover:border-slate-300">
                          <div className="min-w-0 pr-4">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Generated Password</p>
                              <p className="text-xl sm:text-2xl font-mono font-black text-slate-900 tracking-tight truncate">{resetTargetEmployee.generatedPassword}</p>
                          </div>
                          <button 
                              onClick={copyToClipboard}
                              className={`p-3.5 rounded-xl transition-all border active:scale-95 shrink-0 ${hasCopied ? 'bg-emerald-50 border-emerald-200 text-emerald-600 shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-200 shadow-sm'}`}
                              title="Copy to clipboard"
                          >
                              {hasCopied ? <Check size={20} strokeWidth={3} /> : <Copy size={20} strokeWidth={2.5} />}
                          </button>
                      </div>

                      <div className="flex gap-3">
                          <button 
                              onClick={closeResetModal}
                              disabled={isResetting}
                              className="flex-1 py-3.5 bg-white border border-slate-300 text-slate-700 font-bold rounded-xl active:scale-95 hover:bg-slate-50 transition-all text-sm sm:text-base"
                          >
                              Cancel
                          </button>
                          <button 
                              onClick={handleResetPasswordConfirm}
                              disabled={isResetting}
                              className="flex-1 py-3.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl active:scale-95 transition-all text-sm sm:text-base shadow-sm border border-red-600 disabled:opacity-50 flex justify-center items-center gap-2"
                          >
                              {isResetting ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : 'Confirm & Change'}
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* DUPLICATE ERROR NOTIFICATION MODAL */}
      {duplicateError && (
          <div className={`fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-4 sm:p-0 bg-slate-900/60 backdrop-blur-sm ${isClosingDuplicateError ? 'animate-overlay-fade-out' : 'animate-overlay-fade'}`}>
            <div className={`bg-white w-full max-w-md rounded-t-[1.5rem] sm:rounded-[2rem] shadow-2xl overflow-hidden ${isClosingDuplicateError ? 'animate-responsive-modal-close' : 'animate-responsive-modal'}`}>
              <div className="bg-red-600 text-white p-5 sm:px-6 flex items-center justify-between">
                <h3 className="font-black text-xl flex items-center gap-2">
                  <AlertCircle size={22} strokeWidth={2.5} /> 
                  {duplicateError.title}
                </h3>
                <button onClick={closeDuplicateError} className="p-2 bg-black/10 hover:bg-black/20 rounded-full transition-colors active:scale-95 -mr-1"><X size={20} /></button>
              </div>
              <div className="p-6 sm:p-7 space-y-6">
                <p className="text-sm sm:text-base text-slate-600 font-medium leading-relaxed">
                  {duplicateError.message}
                </p>
                <div className="flex">
                  <button type="button" onClick={closeDuplicateError} className="w-full py-3.5 bg-white border border-slate-300 text-slate-700 font-bold rounded-xl active:scale-95 hover:bg-slate-50 transition-all text-sm sm:text-base shadow-sm">Okay, got it</button>
                </div>
              </div>
            </div>
          </div>
      )}

      {/* MODAL 3: REGISTER EMPLOYEE */}
      {isEmpModalOpen && (
        <div className={`fixed inset-0 z-[999] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/50 backdrop-blur-sm ${isClosingEmp ? 'animate-overlay-fade-out' : 'animate-overlay-fade'}`}>
          <div className={`bg-white w-full max-w-lg rounded-t-[1.5rem] sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] ${isClosingEmp ? 'animate-responsive-modal-close' : 'animate-responsive-modal'}`}>
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between shrink-0">
              <h3 className="font-black text-xl">Register New Employee</h3>
              <button onClick={closeEmpModal} className="p-2 bg-white/10 hover:bg-white/20 rounded-full"><X size={20} /></button>
            </div>
            <form onSubmit={handleAddEmployee} className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1 relative">
              
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-1.5">Employee ID *</label>
                <input 
                    type="text" 
                    value={newEmp.emp_id} 
                    onChange={(e) => setNewEmp({...newEmp, emp_id: e.target.value.toUpperCase()})} 
                    placeholder="EMP-2026-105" 
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 rounded-xl outline-none font-bold text-slate-900 font-mono text-base transition-colors" 
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-900 mb-1.5">Full Name *</label>
                <input type="text" value={newEmp.name} onChange={(e) => setNewEmp({...newEmp, name: e.target.value})} placeholder="Juan Dela Cruz" className="w-full p-3.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 rounded-xl outline-none font-bold text-slate-900 text-base transition-colors" />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-900 mb-1.5 flex items-center gap-1.5"><Mail size={16} /> Email Address *</label>
                <input type="email" value={newEmp.email} onChange={(e) => setNewEmp({...newEmp, email: e.target.value})} placeholder="employee@abrapho.gov.ph" className="w-full p-3.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 rounded-xl outline-none font-bold text-slate-900 text-base transition-colors" />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-900 mb-1.5">Designation *</label>
                <input type="text" value={newEmp.designation} onChange={(e) => setNewEmp({...newEmp, designation: e.target.value})} placeholder="Administrative Officer II" className="w-full p-3.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 rounded-xl outline-none font-bold text-slate-900 text-base transition-colors" />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-900 mb-1.5 flex items-center gap-1.5"><Phone size={16} /> Contact Number *</label>
                <input type="tel" value={newEmp.contactNumber} onChange={(e) => setNewEmp({...newEmp, contactNumber: e.target.value})} placeholder="0917 123 4567" className="w-full p-3.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 rounded-xl outline-none font-bold text-slate-900 text-base transition-colors" />
              </div>

              <div className="relative z-50">
                <label className="block text-sm font-bold text-slate-900 mb-1.5">Department / Agency *</label>
                <DepartmentSelect 
                    value={newEmp.department} 
                    onChange={(val: string) => setNewEmp({...newEmp, department: val})} 
                    isRelative={true}
                />
              </div>

              <div className="pt-2 border-t-2 border-slate-100 relative z-10">
                  <div className="flex justify-between items-end mb-1.5">
                    <label className="block text-sm font-bold text-slate-900">Password *</label>
                    <button type="button" onClick={handleGeneratePassword} className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-md border border-blue-200 active:scale-95">
                        <Zap size={14} /> Auto-Generate
                    </button>
                  </div>
                  <div className="relative">
                      <input 
                          type={showPassword ? "text" : "password"} 
                          value={newEmp.password} 
                          onChange={(e) => setNewEmp({...newEmp, password: e.target.value})} 
                          placeholder="Enter temporary password" 
                          className="w-full p-3.5 pr-12 bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 rounded-xl outline-none font-bold text-slate-900 text-base transition-colors" 
                      />
                      <button 
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700 transition-colors bg-white rounded-md border border-slate-200 active:scale-95 shadow-sm"
                      >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                  </div>
              </div>

              <div className="relative z-10">
                  <label className="block text-sm font-bold text-slate-900 mb-1.5">Confirm Password *</label>
                  <div className="relative">
                      <input 
                          type={showConfirmPassword ? "text" : "password"} 
                          value={newEmp.confirmPassword} 
                          onChange={(e) => setNewEmp({...newEmp, confirmPassword: e.target.value})} 
                          placeholder="Re-enter temporary password" 
                          className="w-full p-3.5 pr-12 bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 rounded-xl outline-none font-bold text-slate-900 text-base transition-colors" 
                      />
                      <button 
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700 transition-colors bg-white rounded-md border border-slate-200 active:scale-95 shadow-sm"
                      >
                          {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                  </div>
              </div>

              <div className="pt-4 flex gap-3 shrink-0 relative z-10">
                <button type="button" onClick={closeEmpModal} className="flex-1 py-3.5 bg-white border-2 border-slate-300 text-slate-700 font-bold rounded-xl active:scale-95 transition-transform text-base">Cancel</button>
                <button type="submit" className="flex-[1.5] py-3.5 bg-slate-900 text-white font-bold rounded-xl border-2 border-slate-900 active:scale-95 transition-transform text-base">Register Account</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

// --- Helper Components --- //

function CustomSelect({ options, value, onChange, placeholder }: CustomSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
      function handleClickOutside(event: MouseEvent) {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsOpen(false);
      }
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);
    
    return (
      <div className="relative w-full" ref={dropdownRef}>
        <button type="button" onClick={() => setIsOpen(!isOpen)} className={`w-full px-4 py-3.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 rounded-xl flex justify-between items-center transition-all text-base outline-none active:scale-[0.99] ${isOpen ? 'border-blue-500 bg-white ring-4 ring-blue-500/10' : 'hover:bg-white hover:border-slate-300'} ${!value ? 'text-slate-500 font-medium' : 'text-slate-900 font-bold'}`}>
          <span className="truncate">
            {options.find((opt: OptionType) => (typeof opt === 'string' ? opt : opt.value) === value)
              ? (typeof options.find((opt: OptionType) => (typeof opt === 'string' ? opt : opt.value) === value) === 'string' 
                  ? options.find((opt: OptionType) => (typeof opt === 'string' ? opt : opt.value) === value) as string
                  : (options.find((opt: OptionType) => (typeof opt === 'string' ? opt : opt.value) === value) as SelectOption).label)
              : value || placeholder}
          </span>
          <ChevronDown size={20} className={`text-slate-400 transition-transform duration-300 ease-in-out ${isOpen ? 'rotate-180 text-slate-800' : ''}`} />
        </button>
        {isOpen && (
          <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="max-h-60 overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
              {options.map((option: OptionType, idx: number) => {
                const optValue = typeof option === 'string' ? option : option.value;
                const optLabel = typeof option === 'string' ? option : option.label;
                return (
                  <div key={idx} onClick={() => { onChange(optValue); setIsOpen(false); }} className={`px-4 py-3 text-base rounded-lg cursor-pointer transition-colors flex items-center active:scale-95 ${optValue === value ? 'bg-blue-600 text-white font-bold shadow-sm' : 'text-slate-700 hover:bg-slate-100 font-medium'}`}>
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

function MainNavButton({ label, icon, isActive, onClick }: NavButtonProps) {
    return (
      <button 
        onClick={onClick}
        title={label}
        className={`flex-none shrink-0 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-black transition-all active:scale-95 text-sm whitespace-nowrap overflow-hidden border-2 ${
          isActive 
          ? 'bg-blue-600 text-white shadow-md border-blue-500' 
          : 'bg-transparent text-slate-400 hover:bg-slate-800 hover:text-white border-transparent'
        }`}
      >
        {icon}
        {isActive && <span className="animate-in fade-in slide-in-from-left-2 duration-200">{label}</span>}
      </button>
    );
}

function SubTabButton({ label, icon, isActive, onClick }: NavButtonProps) {
  return (
    <button 
      onClick={onClick}
      title={label}
      className={`flex-none shrink-0 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold transition-all active:scale-95 text-sm whitespace-nowrap overflow-hidden border-2 ${
        isActive 
        ? 'bg-slate-900 text-white shadow-md border-slate-800' 
        : 'bg-transparent text-slate-500 border-transparent hover:border-slate-200 hover:bg-slate-50'
      }`}
    >
      {icon}
      {isActive && <span className="animate-in fade-in slide-in-from-left-2 duration-200">{label}</span>}
    </button>
  );
}

function StatCard({ title, value, icon, color }: StatCardProps) {
    return (
        <div className={`p-4 sm:p-5 rounded-2xl border-2 flex flex-col justify-between ${color} transition-transform hover:scale-[1.02]`}>
            <div className="flex justify-between items-start mb-2">
                <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-100">{icon}</div>
            </div>
            <div>
                <h4 className="text-2xl sm:text-3xl font-black text-slate-900 leading-none mb-1">{value}</h4>
                <p className="text-xs sm:text-sm font-bold text-slate-600 uppercase tracking-wide">{title}</p>
            </div>
        </div>
    );
}