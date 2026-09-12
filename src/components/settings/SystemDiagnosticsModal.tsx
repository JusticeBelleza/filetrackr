import { useState, useEffect } from 'react';
import { X, Activity, Wifi, WifiOff, Copy, CheckCircle2, Globe, Cpu, Fingerprint } from 'lucide-react';
import { toast } from 'sonner';

export default function SystemDiagnosticsModal({ onClose }: { onClose: () => void }) {
    const [isClosing, setIsClosing] = useState(false);
    const [copied, setCopied] = useState(false);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    
    // New state for Biometrics
    const [hasBiometrics, setHasBiometrics] = useState(false);

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(onClose, 300);
    };

    // Monitor network status live and check biometrics
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        
        // Check if the browser supports the Web Authentication API
        if (window.PublicKeyCredential !== undefined && typeof window.PublicKeyCredential === 'function') {
            setHasBiometrics(true);
        }

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Gather system specs
    const getSystemSpecs = () => {
        const ua = navigator.userAgent;
        
        let browser = "Unknown Browser";
        if (ua.includes("Edg/")) browser = "Edge";
        else if (ua.includes("SamsungBrowser/")) browser = "Samsung Internet";
        else if (ua.includes("Firefox/")) browser = "Firefox";
        else if (ua.includes("Chrome/")) browser = "Chrome";
        else if (ua.includes("Safari/") && !ua.includes("Chrome/")) browser = "Safari";

        let os = "Unknown OS";
        if (ua.includes("Windows") || ua.includes("Win")) os = "Windows";
        else if (ua.includes("Android")) os = "Android"; 
        else if (ua.includes("like Mac") || ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
        else if (ua.includes("Mac")) os = "macOS";
        else if (ua.includes("Linux")) os = "Linux";

        // Check if running as installed PWA or in browser tab
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && (navigator as any).standalone === true);

        return { browser, os, isStandalone };
    };

    const specs = getSystemSpecs();
    
    // Added Biometrics status to the copied text
    const diagnosticText = `FileTrackr Diagnostics
Version: ${typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.2.0'}
OS: ${specs.os}
Browser: ${specs.browser}
Mode: ${specs.isStandalone ? 'Installed App' : 'Web Tab'}
Network: ${isOnline ? 'Online' : 'Offline'}
Biometrics API: ${hasBiometrics ? 'Supported' : 'Not Supported'}`;

    const handleCopy = () => {
        navigator.clipboard.writeText(diagnosticText);
        setCopied(true);
        toast.success("Diagnostics copied to clipboard!");
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className={`fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-sm ${isClosing ? 'animate-overlay-fade-out' : 'animate-overlay-fade'}`}>
            <div className={`bg-slate-50 w-full max-w-md max-h-[90vh] rounded-t-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden ${isClosing ? 'animate-responsive-modal-close' : 'animate-responsive-modal'}`}>
                
                {/* Header */}
                <div className="bg-white px-5 sm:px-6 py-4 sm:py-5 flex items-center justify-between border-b border-slate-100">
                    <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                        <Activity size={20} className="text-blue-500" /> System Diagnostics
                    </h2>
                    <button onClick={handleClose} className="p-2 -mr-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-5 sm:p-6 space-y-4">
                    <div className="bg-white border border-slate-200 rounded-2xl p-4 grid gap-4">
                        
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${isOnline ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                                    {isOnline ? <Wifi size={18} /> : <WifiOff size={18} />}
                                </div>
                                <div>
                                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Network Status</p>
                                    <p className="text-sm font-bold text-slate-800">{isOnline ? 'Connected' : 'Offline Mode'}</p>
                                </div>
                            </div>
                        </div>

                        <div className="h-px w-full bg-slate-100"></div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                                    <Cpu size={18} />
                                </div>
                                <div>
                                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Operating System</p>
                                    <p className="text-sm font-bold text-slate-800">{specs.os}</p>
                                </div>
                            </div>
                        </div>

                        <div className="h-px w-full bg-slate-100"></div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
                                    <Globe size={18} />
                                </div>
                                <div>
                                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Environment</p>
                                    <p className="text-sm font-bold text-slate-800">{specs.browser} ({specs.isStandalone ? 'Installed PWA' : 'Browser Tab'})</p>
                                </div>
                            </div>
                        </div>

                        <div className="h-px w-full bg-slate-100"></div>

                        {/* Added Biometrics Row */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${hasBiometrics ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'}`}>
                                    <Fingerprint size={18} />
                                </div>
                                <div>
                                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Biometrics API</p>
                                    <p className="text-sm font-bold text-slate-800">{hasBiometrics ? 'Supported' : 'Not Supported'}</p>
                                </div>
                            </div>
                        </div>

                    </div>

                    <button 
                        onClick={handleCopy}
                        className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-md"
                    >
                        {copied ? <><CheckCircle2 size={18} /> Copied to Clipboard</> : <><Copy size={18} /> Copy Report for IT</>}
                    </button>
                </div>
            </div>
        </div>
    );
}