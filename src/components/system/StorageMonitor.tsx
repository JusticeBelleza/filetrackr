import { useState, useEffect } from 'react';
import { Server, HardDrive, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function StorageMonitor() {
    const [usageGB, setUsageGB] = useState<number>(0);
    const [isLoading, setIsLoading] = useState(true);

    // Set this to your actual Supabase plan limit (e.g., 5GB for some tiers)
    const STORAGE_LIMIT_GB = 5.0; 
    
    // Define the exact name of your bucket here
    const BUCKET_NAME = 'documents'; 

    useEffect(() => {
        const fetchStorage = async () => {
            const { data, error } = await supabase.rpc('get_bucket_size_gb', {
                target_bucket: BUCKET_NAME 
            });

            if (!error && data !== null) {
                setUsageGB(Number(data));
            } else {
                console.error("Failed to fetch storage size:", error);
            }
            setIsLoading(false);
        };

        fetchStorage();
    }, []);

    const percentage = Math.min((usageGB / STORAGE_LIMIT_GB) * 100, 100);
    
    // Determine status colors based on enterprise thresholds
    let statusColor = "bg-emerald-500";
    let statusBg = "bg-emerald-50";
    let statusText = "text-emerald-700";
    let Icon = CheckCircle2;
    let message = "Storage is healthy and within limits.";

    if (percentage > 90) {
        statusColor = "bg-rose-500";
        statusBg = "bg-rose-50";
        statusText = "text-rose-700";
        Icon = AlertTriangle;
        message = "Critical: Nearing storage capacity limit.";
    } else if (percentage > 75) {
        statusColor = "bg-amber-500";
        statusBg = "bg-amber-50";
        statusText = "text-amber-700";
        Icon = AlertTriangle;
        message = "Warning: Consider requesting a storage expansion.";
    }

    return (
        <div className="bg-white p-6 rounded-2xl border-2 border-slate-200 shadow-sm flex flex-col w-full max-w-md">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <Server size={20} className="text-blue-600" />
                    <h3 className="font-bold text-lg text-slate-900 tracking-tight">Infrastructure</h3>
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-1 rounded-md">Cloud Storage</span>
            </div>

            {isLoading ? (
                // Skeleton Loader
                <div className="animate-pulse flex flex-col gap-4">
                    <div className="h-6 bg-slate-200 rounded w-1/3"></div>
                    <div className="h-3 bg-slate-100 rounded-full w-full mb-6"></div>
                    <div className="h-12 bg-slate-50 rounded-xl w-full"></div>
                </div>
            ) : (
                <>
                    {/* Metrics */}
                    <div className="flex justify-between items-end mb-2">
                        <div className="flex items-center gap-1.5 text-slate-600">
                            <HardDrive size={16} />
                            <span className="text-sm font-bold uppercase tracking-wider">{BUCKET_NAME} Bucket</span>
                        </div>
                        <div className="text-right">
                            <span className="text-2xl font-black text-slate-900">{usageGB.toFixed(2)} <span className="text-sm font-bold text-slate-500">GB</span></span>
                            <span className="text-sm font-medium text-slate-400"> / {STORAGE_LIMIT_GB} GB</span>
                        </div>
                    </div>

                    {/* Progress Bar Container */}
                    <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden mb-5 border border-slate-200 shadow-inner">
                        <div 
                            className={`h-full rounded-full transition-all duration-1000 ease-out ${statusColor}`} 
                            style={{ width: `${percentage}%` }}
                        ></div>
                    </div>

                    {/* Dynamic Status Alert */}
                    <div className={`flex items-start gap-2.5 p-3 rounded-xl mt-auto border ${statusBg} ${statusColor.replace('bg-', 'border-').replace('500', '200')}`}>
                        <Icon size={18} className={`mt-0.5 shrink-0 ${statusText}`} />
                        <div>
                            <p className={`text-sm font-bold leading-none mb-1 ${statusText}`}>{percentage.toFixed(1)}% Capacity</p>
                            <p className={`text-xs font-medium ${statusText} opacity-90`}>{message}</p>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}