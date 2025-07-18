// Temporary type definitions until the actual modules are implemented

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