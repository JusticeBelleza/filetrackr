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
        version: __APP_VERSION__,
        date: "September 16, 2026",
        tagline: "Document Family Hierarchies & Department Directory",
        features: [
            { 
                icon: "🔗", 
                title: "Linked Document Families", 
                desc: "Added Mother-Child relationship visualization, allowing you to link related transactions and view complete document dependencies." 
            },
            { 
                icon: "🏢", 
                title: "Dashboard Department Directory", 
                desc: "Integrated a collapsible, paginated office directory directly onto the dashboard with icon-only quick-dial and email triggers." 
            },
            { 
                icon: "📋", 
                title: "Optimized Ref. No. Formatting", 
                desc: "Streamlined tracking reference displays with compact styling and one-click copy-to-clipboard functionality." 
            },
            { 
                icon: "🎨", 
                title: "Minimalist Document Cards", 
                desc: "Redesigned the document card layout by moving the aging clock above the document number and replacing bulky text with clean, icon-only status badges." 
            },
            { 
                icon: "📖", 
                title: "Status Icon Legend", 
                desc: "Added a quick-reference visual legend above the Active Routing list to help users instantly identify Pending, Received, Rush, and Linked documents." 
            },
            { 
                icon: "🛡️", 
                title: "Strict Type Safety Audit", 
                desc: "Performed a system-wide codebase audit to enforce strict TypeScript typing, completely eliminating generic 'any' types across settings and dashboard modules." 
            },
            { 
                icon: "⚙️", 
                title: "React Hook Optimization", 
                desc: "Resolved exhaustive dependency warnings and safely memoized the lazy-loading queries for internal dropdowns to prevent unnecessary memory leaks." 
            },
            { 
                icon: "⚡", 
                title: "Optimized Custom Selects", 
                desc: "Replaced rigid HTML dropdowns across routing modals with smooth, infinitely scrolling custom select components for Categories, Offices, and Employees." 
            },
            { 
                icon: "🆔", 
                title: "Employee ID Search Support", 
                desc: "Upgraded the internal clerk search engine to dynamically filter by both employee name and exact ID numbers simultaneously." 
            },
            { 
                icon: "📐", 
                title: "Refined Relative Expansion", 
                desc: "Configured modal dropdowns with clean relative expansion sizing (~5 items max with integrated scrollbars) to prevent overflow clipping." 
            },
            { 
                icon: "🎨", 
                title: "Consistent Visual Borders", 
                desc: "Standardized distinct high-contrast borders and clean search headers across all selector elements for a uniform professional look." 
            },
            { 
                icon: "⚠️", 
                title: "Mixed Batch Validation", 
                desc: "Added intelligent validation to the batch processing modal that automatically detects and blocks users from mixing 'Pending' and 'Received' documents." 
            },
            { 
                icon: "🔠", 
                title: "Auto-Formatting Employee IDs", 
                desc: "The admin registration portal now automatically forces uppercase formatting on Employee IDs to ensure clean database indexing." 
            },
            { 
                icon: "🔎", 
                title: "Client-Side Audit Search", 
                desc: "Activated the search bar in the Admin Audit Logs, allowing instant filtering by User, Action, Log ID, or IP Address with a custom empty state." 
            },
            { 
                icon: "✨", 
                title: "Smart Daily Overview", 
                desc: "Added a conversational assistant greeting widget that analyzes your active queue, rush items, and returned documents right when you log in." 
            },
            { 
                icon: "⏱️", 
                title: "Turnaround Monitor", 
                desc: "Integrated a 3-column SLA tracker categorizing assigned documents into Healthy (<24h), Warning (24-48h), and Critical (>48h) metrics." 
            },
            { 
                icon: "🔍", 
                title: "Interactive SLA Modals", 
                desc: "Clicking any Turnaround Monitor card opens a responsive, paginated modal displaying document numbers, titles, categories, and rush badges." 
            },
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