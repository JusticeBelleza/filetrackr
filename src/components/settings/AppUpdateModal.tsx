import { useState, useEffect } from 'react';
import { X, DownloadCloud, AlertCircle, Terminal, ShieldAlert, Server, MonitorDown, Cpu, CheckCircle2, Loader2 } from 'lucide-react';

export default function AppUpdateModal({ currentVersion, onClose }: { currentVersion: string, onClose: () => void }) {
    const [isClosing, setIsClosing] = useState(false);
    const [status, setStatus] = useState<'checking' | 'up-to-date' | 'update-available' | 'error' | 'dev-mode'>('checking');
    const [errorMessage, setErrorMessage] = useState('');
    
    // Inline Update States
    const [installPhase, setInstallPhase] = useState<'idle' | 'initializing' | 'downloading' | 'installing' | 'complete'>('idle');
    const [progress, setProgress] = useState(0);

    const handleClose = () => {
        if (installPhase !== 'idle' && installPhase !== 'complete') return; // Prevent closing during install
        setIsClosing(true);
        setTimeout(onClose, 300);
    };

    // The Minimalist Inline Installation Flow
    const handleProceedToUpdate = () => {
        setInstallPhase('initializing');
        
        setTimeout(() => {
            setInstallPhase('downloading');
            
            const progressInterval = setInterval(() => {
                setProgress((prev) => {
                    const increment = Math.random() * 8 + 4; 
                    const nextProgress = prev + increment;
                    
                    if (nextProgress >= 100) {
                        clearInterval(progressInterval);
                        setInstallPhase('installing');
                        
                        // Activate new worker and reload
                        setTimeout(async () => {
                            try {
                                if ('serviceWorker' in navigator) {
                                    const registration = await navigator.serviceWorker.getRegistration();
                                    if (registration && registration.waiting) {
                                        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                                    }
                                }
                            } catch (e) {
                                console.warn("Direct worker activation skipped", e);
                            }

                            setInstallPhase('complete');
                            
                            // Guaranteed reload
                            setTimeout(() => {
                                window.location.reload();
                            }, 1000);
                            
                        }, 1500);
                        
                        return 100;
                    }
                    return nextProgress;
                });
            }, 150);
        }, 1200);
    };

    // Initial Background Check
    useEffect(() => {
        let isMounted = true;
        let timeoutId: ReturnType<typeof setTimeout>;

        const checkUpdate = async () => {
            try {
                if (import.meta.env.DEV) {
                    setTimeout(() => { if (isMounted) setStatus('dev-mode'); }, 1000);
                    return;
                }

                if (!('serviceWorker' in navigator)) {
                    if (isMounted) {
                        setStatus('error');
                        setErrorMessage('Updates are not supported in this browser.');
                    }
                    return;
                }

                const registration = await navigator.serviceWorker.ready;

                if (registration.waiting) {
                    if (isMounted) setStatus('update-available');
                    return;
                }

                let updateDetected = false;

                const onUpdateFound = () => {
                    const newWorker = registration.installing;
                    if (newWorker) {
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                updateDetected = true;
                                if (isMounted) setStatus('update-available');
                            }
                        });
                    }
                };

                registration.addEventListener('updatefound', onUpdateFound);
                await registration.update();

                if (registration.waiting) {
                    updateDetected = true;
                    if (isMounted) setStatus('update-available');
                    return;
                }

                timeoutId = setTimeout(() => {
                    registration.removeEventListener('updatefound', onUpdateFound);
                    if (isMounted && !updateDetected) {
                        if (registration.waiting) {
                            setStatus('update-available');
                        } else {
                            setStatus('up-to-date');
                        }
                    }
                }, 12000);

            } catch (err: unknown) {
                const errorObj = err instanceof Error ? err : new Error(String(err));
                if (isMounted) {
                    if (errorObj.message && errorObj.message.includes('MIME type')) setStatus('dev-mode');
                    else {
                        setStatus('error');
                        setErrorMessage('Failed to connect to the update server.');
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

    // Prevent accidental closure if user clicks outside while updating
    return (
        <div 
            className={`fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-sm ${isClosing ? 'animate-overlay-fade-out' : 'animate-overlay-fade'}`}
            onClick={(e) => {
                if (e.target === e.currentTarget && installPhase === 'idle') handleClose();
            }}
        >
            <div className={`bg-slate-50 w-full max-w-sm max-h-[90vh] rounded-t-[1.5rem] sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden ${isClosing ? 'animate-responsive-modal-close' : 'animate-responsive-modal'}`}>
                
                {/* Header */}
                <div className="bg-white px-5 sm:px-6 py-4 flex items-center justify-between border-b border-slate-100 shrink-0">
                    <h2 className="text-[15px] font-black text-slate-900 flex items-center gap-2">
                        <DownloadCloud size={18} className="text-blue-500" /> System Update
                    </h2>
                    {installPhase === 'idle' && (
                        <button onClick={handleClose} className="p-2 -mr-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors active:scale-95">
                            <X size={20} />
                        </button>
                    )}
                </div>

                {/* Content Area */}
                <div className="p-8 flex flex-col items-center justify-center text-center bg-white min-h-[260px]">
                    
                    {/* STANDARD STATES */}
                    {installPhase === 'idle' && (
                        <>
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
                                    <div className="w-16 h-16 bg-slate-50 border-2 border-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-400">
                                        <ShieldAlert size={28} />
                                    </div>
                                    <h3 className="font-bold text-slate-900 text-lg mb-1">System is Current</h3>
                                    <p className="text-sm text-slate-500 font-medium leading-relaxed mb-4">You are running the latest version of FileTrackr.</p>
                                    <span className="px-3 py-1 bg-slate-100 text-slate-500 text-xs font-bold font-mono rounded-lg border border-slate-200">
                                        v{currentVersion}
                                    </span>
                                </div>
                            )}

                            {status === 'update-available' && (
                                <div className="animate-in fade-in zoom-in duration-300 flex flex-col items-center">
                                    <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mb-4 text-white shadow-lg shadow-blue-500/30 animate-bounce">
                                        <DownloadCloud size={32} />
                                    </div>
                                    <h3 className="font-black text-slate-900 text-xl mb-1.5">Update Available!</h3>
                                    <p className="text-sm text-slate-500 font-medium leading-relaxed">
                                        A new version of FileTrackr has been downloaded and is ready to install.
                                    </p>
                                </div>
                            )}

                            {status === 'dev-mode' && (
                                <div className="animate-in fade-in zoom-in duration-300 flex flex-col items-center">
                                    <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center mb-4 text-purple-500">
                                        <Terminal size={32} />
                                    </div>
                                    <h3 className="font-bold text-slate-900 text-lg mb-1">Development Mode</h3>
                                    <p className="text-sm text-slate-500 font-medium leading-relaxed">Update checks are bypassed on local dev server.</p>
                                </div>
                            )}

                            {status === 'error' && (
                                <div className="animate-in fade-in zoom-in duration-300 flex flex-col items-center">
                                    <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mb-4 text-rose-500">
                                        <AlertCircle size={32} />
                                    </div>
                                    <h3 className="font-bold text-slate-900 text-lg mb-1">Check Failed</h3>
                                    <p className="text-sm text-slate-500 font-medium leading-relaxed">{errorMessage}</p>
                                </div>
                            )}
                        </>
                    )}

                    {/* MINIMALIST INLINE INSTALLATION FLOW */}
                    {installPhase !== 'idle' && (
                        <div className="w-full animate-in fade-in zoom-in-95 duration-500">
                            
                            <div className="flex justify-center mb-6 relative z-10">
                                <div className="relative">
                                    {installPhase === 'initializing' && (
                                        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center border border-slate-200">
                                            <Server size={28} className="text-slate-400 animate-pulse" />
                                        </div>
                                    )}
                                    {installPhase === 'downloading' && (
                                        <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center border border-blue-100">
                                            <MonitorDown size={28} className="text-blue-500 animate-bounce" />
                                        </div>
                                    )}
                                    {installPhase === 'installing' && (
                                        <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center border border-amber-100">
                                            <Cpu size={28} className="text-amber-500 animate-pulse" />
                                        </div>
                                    )}
                                    {installPhase === 'complete' && (
                                        <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center border border-emerald-100">
                                            <CheckCircle2 size={28} className="text-emerald-500" />
                                        </div>
                                    )}
                                    
                                    {installPhase !== 'complete' && (
                                        <div className="absolute -bottom-2 -right-2 bg-white rounded-full p-1 border border-slate-200 shadow-sm">
                                            <Loader2 size={12} className="text-blue-500 animate-spin" />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="text-center mb-6">
                                <h3 className="text-lg font-bold text-slate-900 mb-1">
                                    {installPhase === 'initializing' && 'Preparing...'}
                                    {installPhase === 'downloading' && 'Applying Update...'}
                                    {installPhase === 'installing' && 'Configuring Modules...'}
                                    {installPhase === 'complete' && 'Update Complete'}
                                </h3>
                                <p className="text-xs font-medium text-slate-500">
                                    {installPhase === 'initializing' && 'Verifying local cache'}
                                    {installPhase === 'downloading' && 'Extracting production build'}
                                    {installPhase === 'installing' && 'Purging stale background tasks'}
                                    {installPhase === 'complete' && 'Restarting FileTrackr'}
                                </p>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between text-[10px] font-bold font-mono">
                                    <span className={installPhase === 'complete' ? 'text-emerald-500' : 'text-blue-500'}>
                                        {Math.floor(progress)}%
                                    </span>
                                    <span className="text-slate-400">
                                        {(progress / 100 * 24.8).toFixed(1)} / 24.8 MB
                                    </span>
                                </div>
                                
                                <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                                    <div 
                                        className={`h-full rounded-full transition-all duration-300 ease-out ${
                                            installPhase === 'complete' ? 'bg-emerald-500' : 'bg-blue-500'
                                        }`}
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 flex gap-3 shrink-0">
                    {installPhase === 'idle' ? (
                        status === 'update-available' ? (
                            <>
                                <button 
                                    onClick={handleClose} 
                                    className="flex-1 py-3 bg-white border-2 border-slate-200 text-slate-600 font-bold rounded-xl transition-all active:scale-95 text-sm"
                                >
                                    Later
                                </button>
                                <button 
                                    onClick={handleProceedToUpdate} 
                                    className="flex-[1.5] py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all active:scale-95 shadow-md flex items-center justify-center gap-2 text-sm"
                                >
                                    Install Update
                                </button>
                            </>
                        ) : (
                            <button 
                                onClick={handleClose} 
                                className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-all active:scale-[0.98] shadow-md text-sm"
                            >
                                Close
                            </button>
                        )
                    ) : (
                        <div className="w-full py-3.5 text-center">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                {installPhase === 'complete' ? 'Reloading...' : 'Please do not close app'}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}