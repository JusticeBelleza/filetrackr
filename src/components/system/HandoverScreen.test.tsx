// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import HandoverScreen from './HandoverScreen';

describe('HandoverScreen Component', () => {
  const mockDoc = { 
    id: '123', 
    reference_no: 'DOC-2026-XYZ', 
    title: 'Urgent Health Advisory',
    is_urgent: true 
  };

  it('renders the action selection screen with the correct document details', () => {
    render(
      <HandoverScreen 
        doc={mockDoc} 
        onBack={() => {}} 
        onSuccess={() => {}} 
      />
    );
    
    // Verifies the Document info is displayed
    expect(screen.getByText('DOC-2026-XYZ')).toBeDefined();
    expect(screen.getByText('Urgent Health Advisory')).toBeDefined();
    
    // Verifies the initial actions are available
    expect(screen.getByText('Action Required')).toBeDefined();
    expect(screen.getByText('Add Step')).toBeDefined();
    expect(screen.getByText('Complete Document')).toBeDefined();
  });
});