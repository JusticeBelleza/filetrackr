// src/types/processing.ts
import React from 'react';

export interface DocumentLog {
    id: string;
    document_id: string;
    action: string;
    location?: string;
    assigned_to?: string;
    remarks?: string;
    created_at: string;
    created_by?: string;
    signature_url?: string;
    attachment_url?: string;
    profiles?: {
        full_name: string;
    }; 
}

export interface SignatureData {
    url: string;
    signedAt?: string;
    signedBy?: string;
}

export interface DocumentItem {
    id: string;
    reference_no?: string;
    title?: string;
    subject?: string;
    status: string;
    assigned_clerk?: string;
    created_by?: string;
    remarks?: string;
    is_urgent?: boolean;
    current_location?: string;
    final_destination?: string;
    attachment_url?: string;
    created_at: string;
    updated_at?: string;
    document_logs?: DocumentLog[];
    action_time?: string; 
    category?: string;
    creator_name?: string;
    parent_doc_ref?: string | null; // <--- NEW: For Mother Document Linking
}

// NEW: Added for the Admin Portal Category Manager
export interface Category {
    id: string;
    name: string;
    prefix?: string | null; // <--- NEW: For Dynamic Numbering
}

// NEW: Added for the Admin Portal Office Manager
export interface Department {
    id: string;
    name: string;
    address?: string; // Kept for legacy support
    office_address?: string; // Standardized naming
    department_head?: string | null; // <--- NEW: Rich Metadata
    email_address?: string | null; // <--- NEW: Rich Metadata
    contact_number?: string | null; // <--- NEW: Rich Metadata
}

export interface DepartmentOption {
    label: string;
    value: string;
}

export interface SelectOption {
    label: string;
    value: string;
}

export type OptionType = SelectOption | string;

export interface TabButtonProps {
    label: string;
    icon: React.ReactNode;
    count: number;
    isActive: boolean;
    onClick: () => void;
    colorClass: string;
    badgeClass: string;
    newCount?: number;
}

export interface ProcessingData {
    processing: DocumentItem[];
    returned: DocumentItem[];
    departments: OptionType[];
    currentUserName: string;
    currentUserId: string;
    colleagues: string[];
    allEmployeesList: OptionType[];
}