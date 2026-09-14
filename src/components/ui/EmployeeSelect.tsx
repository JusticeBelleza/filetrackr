import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, ChevronDown, Check, Loader2, User } from 'lucide-react';
import { supabase } from '../../lib/supabase'; 

interface Employee {
    id: string;
    name: string;
    designation: string;
    emp_id?: string; 
}

interface EmployeeSelectProps {
    value: string;
    onChange: (employeeName: string) => void;
    departmentFilter?: string; 
    isRelative?: boolean; 
}

export default function EmployeeSelect({ value, onChange, departmentFilter, isRelative = false }: EmployeeSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    
    const ITEMS_PER_PAGE = 10;
    const dropdownRef = useRef<HTMLDivElement>(null);
    const observer = useRef<IntersectionObserver | null>(null);

    // --- FIX: Wrapped fetchEmployees in useCallback ---
    const fetchEmployees = useCallback(async (currentPage: number, search: string, isNewSearch: boolean = false) => {
        try {
            setIsLoading(true);
            const from = currentPage * ITEMS_PER_PAGE;
            const to = from + ITEMS_PER_PAGE - 1;

            let query = supabase
                .from('employees')
                .select('id, name, designation, emp_id', { count: 'exact' }) 
                .order('name', { ascending: true })
                .range(from, to);

            if (search) {
                query = query.or(`name.ilike.%${search}%,emp_id.ilike.%${search}%`);
            }
            
            if (departmentFilter) query = query.eq('department', departmentFilter);

            const { data, count, error } = await query;
            if (error) throw error;

            if (data) {
                setEmployees(prev => {
                    if (isNewSearch) return data;
                    const existingIds = new Set(prev.map(emp => emp.id));
                    const uniqueNewData = data.filter(emp => !existingIds.has(emp.id));
                    return [...prev, ...uniqueNewData];
                });
                setHasMore(count !== null && (from + data.length) < count);
            }
        } catch (error) {
            console.error("Error fetching employees:", error);
        } finally {
            setIsLoading(false);
        }
    }, [departmentFilter]); // Added departmentFilter as dependency

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            setPage(0);
            setHasMore(true);
            fetchEmployees(0, searchTerm, true);
        }, 300); 

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm, departmentFilter, fetchEmployees]); // --- FIX: Added fetchEmployees to dependencies ---

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const lastEmployeeElementRef = useCallback((node: HTMLDivElement) => {
        if (isLoading) return;
        if (observer.current) observer.current.disconnect();
        
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                setPage(prevPage => {
                    const nextPage = prevPage + 1;
                    fetchEmployees(nextPage, searchTerm, false);
                    return nextPage;
                });
            }
        });
        
        if (node) observer.current.observe(node);
    }, [isLoading, hasMore, searchTerm, fetchEmployees]); // --- FIX: Added fetchEmployees to dependencies ---

    useEffect(() => {
        if (!isOpen) setSearchTerm('');
    }, [isOpen]);

    return (
        <div className="relative w-full" ref={dropdownRef}>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <User size={14} className="text-blue-500" /> 
                Assign To (Internal Clerk) <span className="text-red-500">*</span>
            </label>

            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full flex items-center justify-between p-3.5 bg-white border-2 rounded-xl text-left transition-all focus:outline-none focus:ring-4 focus:ring-blue-500/20 ${
                    isOpen ? 'border-blue-500 ring-4 ring-blue-500/20' : 'border-slate-200 hover:border-slate-300'
                }`}
            >
                <span className={value ? 'text-slate-900 font-bold' : 'text-slate-400 font-medium'}>
                    {value || 'Select employee...'}
                </span>
                <ChevronDown size={18} className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            <div 
                className={`w-full overflow-hidden transition-all duration-300 ease-in-out ${
                    isOpen ? 'max-h-[400px] opacity-100' : 'max-h-0 opacity-0'
                } ${isRelative ? (isOpen ? 'relative mt-2 mb-4' : 'relative mt-0 mb-0') : (isOpen ? 'absolute mt-2 z-50' : 'absolute mt-0 z-0')}`}
            >
                <div className="w-full bg-white border-2 border-slate-200 rounded-2xl shadow-xl overflow-hidden">
                    
                    <div className="p-3 border-b border-slate-100 bg-slate-50">
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Type name or ID..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                            />
                        </div>
                    </div>

                    <div className="max-h-[240px] overflow-y-auto custom-scrollbar p-1.5">
                        {employees.length === 0 && !isLoading ? (
                            <div className="p-4 text-center text-slate-500 text-sm">No employees found.</div>
                        ) : (
                            employees.map((emp, index) => {
                                const isSelected = value === emp.name;
                                const isLastElement = employees.length === index + 1;
                                
                                return (
                                    <div
                                        key={`${emp.id}-${index}`}
                                        ref={isLastElement ? lastEmployeeElementRef : null}
                                        onClick={() => {
                                            onChange(emp.name);
                                            setIsOpen(false);
                                            setSearchTerm('');
                                        }}
                                        className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${
                                            isSelected 
                                                ? 'bg-blue-50 border border-blue-100' 
                                                : 'hover:bg-slate-50 border border-transparent'
                                        }`}
                                    >
                                        <div className="flex flex-col">
                                            <span className={`text-sm ${isSelected ? 'font-black text-blue-700' : 'font-bold text-slate-700'}`}>
                                                {emp.name}
                                            </span>
                                            {(emp.emp_id || emp.designation) && (
                                                <span className={`text-[11px] mt-0.5 flex items-center gap-1.5 ${isSelected ? 'text-blue-600/80 font-medium' : 'text-slate-500'}`}>
                                                    {emp.emp_id && (
                                                        <span className={`font-mono ${isSelected ? 'text-blue-500/70' : 'text-slate-400'}`}>
                                                            {emp.emp_id}
                                                        </span>
                                                    )}
                                                    {emp.emp_id && emp.designation && <span className="opacity-50">•</span>}
                                                    {emp.designation && <span>{emp.designation}</span>}
                                                </span>
                                            )}
                                        </div>
                                        {isSelected && <Check size={18} className="text-blue-600 shrink-0 ml-2" strokeWidth={3} />}
                                    </div>
                                );
                            })
                        )}
                        
                        {isLoading && (
                            <div className="flex items-center justify-center p-4">
                                <Loader2 size={20} className="animate-spin text-blue-500" />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}