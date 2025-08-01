// Type definitions for the tone learning pipeline

export interface ProcessedEmail {
  uid: string;
  messageId: string;
  inReplyTo: string | null;
  date: Date;
  from: Array<{ address: string; name?: string }>;
  to: Array<{ address: string; name?: string }>;
  cc: Array<{ address: string; name?: string }>;
  bcc: Array<{ address: string; name?: string }>;
  subject: string;
  textContent: string | null;
  htmlContent: string | null;
  extractedText: string;
  relationship?: {
    type: string;
    confidence: number;
    detectionMethod: string;
  };
}

export interface GeneratedDraft {
  id: string;
  userId: string;
  incomingEmailId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  relationship: {
    type: string;
    confidence: number;
    detectionMethod: string;
  };
  examplesUsed: string[];
  metadata: {
    promptTemplate: string;
    exampleCount: number;
    diversityScore?: number;
    timestamp: string;
  };
  createdAt: Date;
}

export interface EmailFeatures {
  relationshipHints: {
    familiarityLevel: string;
    intimacyMarkers: string[];
    professionalMarkers: string[];
  };
  stats: {
    formalityScore: number;
    wordCount: number;
  };
  sentiment: {
    dominant: 'positive' | 'negative' | 'neutral';
  };
  urgency: {
    level: 'low' | 'medium' | 'high';
  };
}

export interface RelationshipDetectorResult {
  relationship: string;
  confidence: number;
  method: string;
}

export interface RelationshipProfile {
  typicalFormality: string;
  commonGreetings: string[];
  commonClosings: string[];
  useEmojis: boolean;
  useHumor: boolean;
}

// Temporary function until nlp-feature-extractor is implemented
export function extractEmailFeatures(text: string, _recipientInfo?: any): EmailFeatures {
  // Stub implementation
  return {
    relationshipHints: {
      familiarityLevel: 'professional',
      intimacyMarkers: [],
      professionalMarkers: []
    },
    stats: {
      formalityScore: 0.5,
      wordCount: text.split(/\s+/).length
    },
    sentiment: {
      dominant: 'neutral'
    },
    urgency: {
      level: 'low'
    }
  };
}