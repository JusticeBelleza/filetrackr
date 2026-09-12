import { useState } from 'react';
import { toast } from 'sonner';

export function useAppUpdate(currentVersion: string) {
    const [isChecking, setIsChecking] = useState(false);

    const checkForUpdates = async () => {
        setIsChecking(true);
        const toastId = toast.loading("Checking for updates...");
        
        try {
            if ('serviceWorker' in navigator) {
                const registration = await navigator.serviceWorker.getRegistration();
                
                if (registration) {
                    let updateFound = false;
                    
                    // Listen for the new service worker taking over
                    const handleControllerChange = () => {
                        updateFound = true;
                        toast.success("Update found! Applying...", { id: toastId });
                        setTimeout(() => window.location.reload(), 1500);
                    };
                    
                    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange, { once: true });
                    
                    // Force the browser to bypass local cache and check the server
                    await registration.update();
                    
                    // If no controller change happens after 2.5 seconds, assume we are on the latest version
                    setTimeout(() => {
                        if (!updateFound) {
                            navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
                            toast.success("App is up to date!", { 
                                id: toastId,
                                description: `Version ${currentVersion} is the latest release.` 
                            });
                            setIsChecking(false);
                        }
                    }, 2500);
                } else {
                    toast.error("Update engine not found.", { 
                        id: toastId,
                        description: "Are you running the app in a standard browser tab?"
                    });
                    setIsChecking(false);
                }
            } else {
                toast.error("Updates are not supported in this browser.", { id: toastId });
                setIsChecking(false);
            }
        } catch (error) {
            console.error("Update check failed", error);
            toast.error("Failed to connect to the update server.", { id: toastId });
            setIsChecking(false);
        }
    };

    return { isChecking, checkForUpdates };
}