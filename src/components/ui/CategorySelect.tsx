import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, ChevronDown, Check, Loader2, FolderOpen } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Category {
    id: string;
    name: string;
    prefix?: string | null; // <-- NEW: Added Prefix
}

interface CategorySelectProps {
    value: string;
    onChange: (categoryName: string, prefix?: string | null) => void; // <-- NEW: Now passes prefix back up
    isRelative?: boolean;
}

export default function CategorySelect({ value, onChange, isRelative = false }: CategorySelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    
    const [categories, setCategories] = useState<Category[]>([]);
    const [, setPage] = useState(0); 
    const [hasMore, setHasMore] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    
    const ITEMS_PER_PAGE = 10;
    const dropdownRef = useRef<HTMLDivElement>(null);
    const observer = useRef<IntersectionObserver | null>(null);

    const fetchCategories = async (currentPage: number, search: string, isNewSearch: boolean = false) => {
        try {
            setIsLoading(true);
            const from = currentPage * ITEMS_PER_PAGE;
            const to = from + ITEMS_PER_PAGE - 1;

            // NEW: Added 'prefix' to the select query
            let query = supabase
                .from('categories')
                .select('id, name, prefix', { count: 'exact' })
                .order('name', { ascending: true })
                .range(from, to);

            if (search) query = query.ilike('name', `%${search}%`);

            const { data, count, error } = await query;
            if (error) throw error;

            if (data) {
                setCategories(prev => {
                    if (isNewSearch) return data;
                    const existingIds = new Set(prev.map(c => c.id));
                    const uniqueNewData = data.filter(c => !existingIds.has(c.id));
                    return [...prev, ...uniqueNewData];
                });
                setHasMore(count !== null && (from + data.length) < count);
            }
        } catch (error) {
            console.error("Error fetching categories:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            setPage(0);
            setHasMore(true);
            fetchCategories(0, searchTerm, true);
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const lastCategoryElementRef = useCallback((node: HTMLDivElement) => {
        if (isLoading) return;
        if (observer.current) observer.current.disconnect();
        
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                setPage(prevPage => {
                    const nextPage = prevPage + 1;
                    fetchCategories(nextPage, searchTerm, false);
                    return nextPage;
                });
            }
        });
        
        if (node) observer.current.observe(node);
    }, [isLoading, hasMore, searchTerm]);

    useEffect(() => {
        if (!isOpen) setSearchTerm('');
    }, [isOpen]);

    return (
        <div className="relative w-full" ref={dropdownRef}>
            <label className="block text-[11px] sm:text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5 uppercase tracking-wider">
                <FolderOpen size={14} className="text-orange-500" /> Document Category <span className="text-red-500">*</span>
            </label>

            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full flex items-center justify-between p-3.5 bg-white border-2 rounded-xl text-left transition-all focus:outline-none focus:ring-4 focus:ring-orange-500/20 ${
                    isOpen ? 'border-orange-500 ring-4 ring-orange-500/20' : 'border-slate-200 hover:border-slate-300'
                }`}
            >
                <span className={value ? 'text-slate-900 font-bold' : 'text-slate-400 font-medium'}>
                    {value || 'Select Category...'}
                </span>
                <ChevronDown size={18} className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            <div 
                className={`w-full overflow-hidden transition-all duration-300 ease-in-out ${
                    isOpen ? 'max-h-[400px] opacity-100' : 'max-h-0 opacity-0'
                } ${isRelative ? (isOpen ? 'relative mt-2 mb-4' : 'relative mt-0 mb-0') : (isOpen ? 'absolute mt-2 z-50' : 'absolute mt-0 z-0')}`}
            >
                <div className="w-full bg-white border-2 border-slate-200 rounded-2xl shadow-xl overflow-hidden">
                    
                    <div className="p-3 border-b-2 border-slate-100 bg-slate-50">
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Type to search..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2.5 bg-white border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
                            />
                        </div>
                    </div>

                    <div className="max-h-[230px] overflow-y-auto custom-scrollbar p-1.5">
                        {categories.length === 0 && !isLoading ? (
                            <div className="p-4 text-center text-slate-500 text-sm font-medium">No categories found.</div>
                        ) : (
                            categories.map((cat, index) => {
                                const isSelected = value === cat.name;
                                const isLastElement = categories.length === index + 1;
                                
                                return (
                                    <div
                                        key={`${cat.id}-${index}`}
                                        ref={isLastElement ? lastCategoryElementRef : null}
                                        onClick={() => {
                                            // NEW: We now pass BOTH the name and the prefix up!
                                            onChange(cat.name, cat.prefix);
                                            setIsOpen(false);
                                            setSearchTerm('');
                                        }}
                                        className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${
                                            isSelected 
                                                ? 'bg-orange-50 border border-orange-100' 
                                                : 'hover:bg-slate-50 border border-transparent'
                                        }`}
                                    >
                                        <span className={`text-sm ${isSelected ? 'font-black text-orange-700' : 'font-bold text-slate-700'}`}>
                                            {cat.name}
                                        </span>
                                        {isSelected && <Check size={18} className="text-orange-600 shrink-0 ml-2" strokeWidth={3} />}
                                    </div>
                                );
                            })
                        )}
                        
                        {isLoading && (
                            <div className="flex items-center justify-center p-4">
                                <Loader2 size={20} className="animate-spin text-orange-500" />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}