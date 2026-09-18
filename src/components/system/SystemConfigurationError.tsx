import { AlertTriangle, Database, Server, Settings2 } from 'lucide-react';

export default function SystemConfigurationError() {
    return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 selection:bg-rose-500/30 font-sans">
            <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-3xl p-8 shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-500">
                
                {/* Background Glow */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-32 bg-rose-500/10 blur-[50px] rounded-full pointer-events-none"></div>

                <div className="flex justify-center mb-6 relative z-10">
                    <div className="w-20 h-20 bg-rose-500/10 rounded-2xl flex items-center justify-center border border-rose-500/30 shadow-[0_0_30px_rgba(244,63,94,0.15)]">
                        <Database size={32} className="text-rose-400" />
                    </div>
                </div>

                <div className="text-center mb-8 relative z-10">
                    <h2 className="text-xl font-black text-white mb-2 tracking-tight">Database Connection Failed</h2>
                    <p className="text-sm font-medium text-slate-400 leading-relaxed">
                        FileTrackr cannot initialize because the Supabase environment variables are missing.
                    </p>
                </div>

                <div className="space-y-3 relative z-10">
                    <div className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-4 flex gap-3">
                        <Server size={18} className="text-slate-500 shrink-0 mt-0.5" />
                        <div>
                            <h4 className="text-xs font-bold text-slate-300 mb-1">Local Development</h4>
                            <p className="text-[11px] text-slate-500 font-medium">Ensure you have a <code className="text-rose-400 bg-rose-400/10 px-1 py-0.5 rounded">.env</code> file in your project root containing your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.</p>
                        </div>
                    </div>

                    <div className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-4 flex gap-3">
                        <Settings2 size={18} className="text-slate-500 shrink-0 mt-0.5" />
                        <div>
                            <h4 className="text-xs font-bold text-slate-300 mb-1">Cloudflare Pages</h4>
                            <p className="text-[11px] text-slate-500 font-medium">Go to your Cloudflare Dashboard ➔ Settings ➔ Environment Variables, and add them for both Production and Preview environments.</p>
                        </div>
                    </div>
                </div>

                <div className="mt-8 flex justify-center relative z-10">
                    <button 
                        onClick={() => window.location.reload()} 
                        className="px-6 py-3 bg-white hover:bg-slate-100 text-slate-900 font-bold rounded-xl text-sm transition-all active:scale-95 shadow-md flex items-center gap-2"
                    >
                        <AlertTriangle size={16} /> Retry Connection
                    </button>
                </div>
            </div>
        </div>
    );
}