export interface ReleaseFeature {
    icon: string;
    title: string;
    desc: string;
}

export interface ReleaseNote {
    version: string;
    date: string;
    tagline: string;
    features: ReleaseFeature[];
}

export const CHANGELOG: ReleaseNote[] = [
    {
        version: "1.2.0",
        date: "September 11, 2026",
        tagline: "Secure Document Custody & System Controls",
        features: [
            { 
                icon: "🤝", 
                title: "Digital Handshake", 
                desc: "Documents now require you to explicitly Receive or Decline them to ensure secure custody transfers." 
            },
            { 
                icon: "📦", 
                title: "Batch Processing", 
                desc: "You can now select multiple pending documents and Receive or Decline them all at once." 
            },
            { 
                icon: "🎨", 
                title: "Settings Redesign", 
                desc: "Completely overhauled the Account Settings with a sleek, native-style Profile ID Card and clean collapsible menus." 
            },
            { 
                icon: "🛡️", 
                title: "Branded Biometric Setup", 
                desc: "Added a custom, branded registration flow for configuring your device's Face ID and Fingerprint passkeys." 
            },
            { 
                icon: "📱", 
                title: "Biometric Device Manager", 
                desc: "Added the ability to securely review and unenroll your registered Face ID or Fingerprint devices directly from the app." 
            },
            { 
                icon: "🛠️", 
                title: "System Diagnostics", 
                desc: "New IT troubleshooting tool that displays network status, OS, browser environment, and allows one-click copying for quick support." 
            },
            { 
                icon: "☁️", 
                title: "Force App Update", 
                desc: "Added a dedicated check for updates button to instantly download and apply the latest FileTrackr release." 
            },
            { 
                icon: "🔒", 
                title: "Secure Logout", 
                desc: "Added a full-width, bottom-sheet confirmation modal to prevent accidental logouts and protect your session." 
            },
            { 
                icon: "🔄", 
                title: "Smart Creator Bypass", 
                desc: "Re-assigning a document back to the person who created it automatically skips the handshake phase." 
            },
            { 
                icon: "⏱️", 
                title: "Active Turnaround Time", 
                desc: "The digital trail now calculates and displays exactly how long a document sat idle at each step." 
            }
        ]
    },
    {
        version: "1.1.8",
        date: "September 2026",
        tagline: "UI Enhancements & Audit Trails",
        features: [
            { 
                icon: "✨", 
                title: "Collapsible Cards", 
                desc: "Added the ability to expand and collapse document details on the processing dashboard to save space." 
            },
            { 
                icon: "📜", 
                title: "Clean Audit Logs", 
                desc: "The Digital Trail now beautifully formats returned documents and multi-line remarks without duplicate labels." 
            }
        ]
    }
];