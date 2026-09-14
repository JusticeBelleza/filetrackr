import { useState, useEffect } from 'react';
import { X, DownloadCloud, CheckCircle2, AlertCircle, Terminal } from 'lucide-react';

export default function AppUpdateModal({ currentVersion, onClose }: { currentVersion: string, onClose: () => void }) {
    const [isClosing, setIsClosing] = useState(false);
    const [status, setStatus] = useState<'checking' | 'up-to-date' | 'updating' | 'error' | 'dev-mode'>('checking');
    const [errorMessage, setErrorMessage] = useState('');

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(onClose, 300);
    };

    useEffect(() => {
        let isMounted = true;
        // FIXED: Using ReturnType to automatically use the correct browser type instead of NodeJS
        let timeoutId: ReturnType<typeof setTimeout>;

        const checkUpdate = async () => {
            try {
                // 1. Instantly catch if we are in Local Development to prevent the MIME type error
                if (import.meta.env.DEV) {
                    setTimeout(() => {
                        if (isMounted) setStatus('dev-mode');
                    }, 1200);
                    return;
                }

                // 2. Production Service Worker Check
                if ('serviceWorker' in navigator) {
                    const registration = await navigator.serviceWorker.getRegistration();
                    
                    if (registration) {
                        let updateFound = false;

                        const handleControllerChange = () => {
                            updateFound = true;
                            if (isMounted) setStatus('updating');
                            // Smoothly reload the app after showing the updating state
                            setTimeout(() => window.location.reload(), 1500);
                        };

                        navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange, { once: true });

                        // Ping the server for byte-changes
                        await registration.update();

                        // If no change is detected after 2.5 seconds, assume latest version
                        timeoutId = setTimeout(() => {
                            if (!updateFound && isMounted) {
                                navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
                                setStatus('up-to-date');
                            }
                        }, 2500);
                    } else {
                        if (isMounted) {
                            setStatus('error');
                            setErrorMessage('Update engine not found. Are you running in a standard tab?');
                        }
                    }
                } else {
                    if (isMounted) {
                        setStatus('error');
                        setErrorMessage('Updates are not supported in this browser.');
                    }
                }
            } catch (err: unknown) {
                // --- FIXED: Replaced "any" with "unknown" and safely extracted error ---
                const errorObj = err instanceof Error ? err : new Error(String(err));
                console.error("Update check failed:", errorObj);
                
                if (isMounted) {
                    // Fallback catch for the MIME type error just in case
                    if (errorObj.message && errorObj.message.includes('MIME type')) {
                        setStatus('dev-mode');
                    } else {
                        setStatus('error');
                        setErrorMessage('Failed to connect to the update server. Please check your internet connection.');
                    }
                }
            }
        };

        checkUpdate();

        return () => {
            isMounted = false;
            clearTimeout(timeoutId);
        };
    }, []);

    return (
        <div className={`fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-sm ${isClosing ? 'animate-overlay-fade-out' : 'animate-overlay-fade'}`}>
            <div className={`bg-slate-50 w-full max-w-sm max-h-[90vh] rounded-t-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden ${isClosing ? 'animate-responsive-modal-close' : 'animate-responsive-modal'}`}>
                
                {/* Header */}
                <div className="bg-white px-5 sm:px-6 py-4 flex items-center justify-between border-b border-slate-100">
                    <h2 className="text-[16px] font-black text-slate-900 flex items-center gap-2">
                        <DownloadCloud size={18} className="text-blue-500" /> System Update
                    </h2>
                    {status !== 'updating' && (
                        <button onClick={handleClose} className="p-2 -mr-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                            <X size={20} />
                        </button>
                    )}
                </div>

                {/* Content Area */}
                <div className="p-8 flex flex-col items-center justify-center text-center bg-white min-h-[240px]">
                    
                    {status === 'checking' && (
                        <div className="animate-in fade-in zoom-in duration-300 flex flex-col items-center">
                            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4 relative">
                                <div className="absolute inset-0 border-4 border-blue-100 rounded-full"></div>
                                <div className="absolute inset-0 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                <DownloadCloud size={24} className="text-blue-500 relative z-10 animate-pulse" />
                            </div>
                            <h3 className="font-bold text-slate-900 text-lg mb-1">Checking for updates...</h3>
                            <p className="text-sm text-slate-500 font-medium">Communicating with the server</p>
                        </div>
                    )}

                    {status === 'up-to-date' && (
                        <div className="animate-in fade-in zoom-in duration-300 flex flex-col items-center">
                            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4 text-green-500">
                                <CheckCircle2 size={32} />
                            </div>
                            <h3 className="font-bold text-slate-900 text-lg mb-1">You're up to date!</h3>
                            <p className="text-sm text-slate-500 font-medium">FileTrackr is running the latest version.</p>
                            <div className="mt-4 px-3 py-1 bg-slate-100 rounded-lg border border-slate-200">
                                <p className="text-xs font-bold text-slate-600 font-mono">v{currentVersion}</p>
                            </div>
                        </div>
                    )}

                    {status === 'updating' && (
                        <div className="animate-in fade-in zoom-in duration-300 flex flex-col items-center">
                            <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mb-4 text-white shadow-lg shadow-blue-500/30 animate-bounce">
                                <DownloadCloud size={32} />
                            </div>
                            <h3 className="font-bold text-slate-900 text-lg mb-1">Update Found!</h3>
                            <p className="text-sm text-slate-500 font-medium">Downloading new files and restarting...</p>
                        </div>
                    )}

                    {status === 'dev-mode' && (
                        <div className="animate-in fade-in zoom-in duration-300 flex flex-col items-center">
                            <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center mb-4 text-purple-500">
                                <Terminal size={32} />
                            </div>
                            <h3 className="font-bold text-slate-900 text-lg mb-1">Development Mode</h3>
                            <p className="text-sm text-slate-500 font-medium leading-relaxed">Update checks are bypassed while running on your local development server.</p>
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="animate-in fade-in zoom-in duration-300 flex flex-col items-center">
                            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4 text-red-500">
                                <AlertCircle size={32} />
                            </div>
                            <h3 className="font-bold text-slate-900 text-lg mb-1">Check Failed</h3>
                            <p className="text-sm text-slate-500 font-medium leading-relaxed">{errorMessage}</p>
                        </div>
                    )}

                </div>

                {/* Footer Action */}
                {status !== 'updating' && status !== 'checking' && (
                    <div className="p-4 bg-slate-50 border-t border-slate-100">
                        <button 
                            onClick={handleClose} 
                            className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-all active:scale-[0.98] shadow-md"
                        >
                            Close
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}