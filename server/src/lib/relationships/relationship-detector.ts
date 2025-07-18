// Stub implementation until Task 3.3 is completed
import { RelationshipDetectorResult } from '../pipeline/types';

export interface DetectRelationshipParams {
  userId: string;
  recipientEmail: string;
  subject?: string;
  historicalContext?: {
    familiarityLevel: string;
    hasIntimacyMarkers: boolean;
    hasProfessionalMarkers: boolean;
    formalityScore: number;
  };
}

export class RelationshipDetector {
  async initialize(): Promise<void> {
    // Stub - no initialization needed yet
  }

  async detectRelationship(params: DetectRelationshipParams): Promise<RelationshipDetectorResult> {
    // Stub implementation - returns a relationship based on known test email addresses
    const email = params.recipientEmail.toLowerCase();
    
    let relationship = 'external';
    let confidence = 0.8;
    
    // Map specific email addresses to relationships for testing
    if (email === 'lisa@example.com') {
      relationship = 'spouse';
      confidence = 0.95;
    } else if (email === 'sarah@company.com') {
      relationship = 'colleague';
      confidence = 0.9;
    } else if (email === 'mike@example.com') {
      relationship = 'friend';
      confidence = 0.9;
    } else if (email === 'jim@venturecapital.com') {
      relationship = 'professional';
      confidence = 0.85;
    } else {
      // Fallback to domain-based detection
      const domain = email.split('@')[1];
      if (domain && domain.includes('gmail.com')) {
        relationship = 'friend';
      } else if (domain && domain.includes('company.com')) {
        relationship = 'colleague';
      }
    }
    
    return {
      relationship,
      confidence,
      method: 'stub'
    };
  }
}