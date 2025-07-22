import { Pool } from 'pg';
import { RelationshipProfile } from '../pipeline/types';
import { StylePreferences, DEFAULT_STYLE_PREFERENCES } from './style-preferences';
import { personService } from './person-service';
import { PersonServiceError } from './person-service';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://aiemailuser:aiemailpass@localhost:5434/aiemaildb',
});

export interface VectorSearchContext {
  relationship: string;
  stylePreferences: StylePreferences;
  personId: string;
  searchFilters: {
    relationship: string;
    formality_range: [number, number];
  };
}

export class RelationshipService {
  async initialize(): Promise<void> {
    await personService.initialize();
  }

  async getRelationshipProfile(userId: string, relationship: string): Promise<RelationshipProfile | null> {
    // Get style preferences from database
    const stylePrefs = await this.getStylePreferences(userId, relationship);
    
    if (!stylePrefs) {
      return null;
    }
    
    // Convert to RelationshipProfile format
    return {
      typicalFormality: this.getFormalityLevel(stylePrefs.formality),
      commonGreetings: stylePrefs.preferred_greetings,
      commonClosings: stylePrefs.preferred_closings,
      useEmojis: stylePrefs.common_emojis.length > 0,
      useHumor: stylePrefs.enthusiasm > 0.7
    };
  }
  
  async getStylePreferences(userId: string, relationshipType: string): Promise<StylePreferences | null> {
    // First check if user has custom preferences
    const result = await pool.query(
      `SELECT style_preferences 
       FROM relationship_tone_preferences 
       WHERE user_id = $1 AND relationship_type = $2`,
      [userId, relationshipType]
    );
    
    if (result.rows.length > 0 && result.rows[0].style_preferences) {
      // Merge custom preferences with defaults
      const customPrefs = result.rows[0].style_preferences;
      const defaultPrefs = DEFAULT_STYLE_PREFERENCES[relationshipType] || DEFAULT_STYLE_PREFERENCES.external;
      return { ...defaultPrefs, ...customPrefs };
    }
    
    // Return defaults if no custom preferences
    return DEFAULT_STYLE_PREFERENCES[relationshipType] || DEFAULT_STYLE_PREFERENCES.external;
  }
  
  async getVectorSearchContext(userId: string, recipientEmail: string): Promise<VectorSearchContext> {
    // Detect relationship
    const detection = await personService.findPersonByEmail(recipientEmail, userId);
    
    if (!detection) {
      throw new PersonServiceError('Person not found', 'NOT_FOUND');
    }
    
    const primaryRel = detection.relationships.find(r => r.is_primary) || detection.relationships[0];
    if (!primaryRel) {
      throw new PersonServiceError('No relationship found for person', 'NO_RELATIONSHIP');
    }
    
    const relationshipType = primaryRel.relationship_type;
    const stylePrefs = await this.getStylePreferences(userId, relationshipType);
    
    if (!stylePrefs) {
      throw new PersonServiceError('No style preferences found', 'NO_PREFERENCES');
    }
    
    // Calculate formality range for search
    const formalityBuffer = 0.2;
    const minFormality = Math.max(0, stylePrefs.formality - formalityBuffer);
    const maxFormality = Math.min(1, stylePrefs.formality + formalityBuffer);
    
    return {
      relationship: relationshipType,
      stylePreferences: stylePrefs,
      personId: detection.id,
      searchFilters: {
        relationship: relationshipType,
        formality_range: [minFormality, maxFormality]
      }
    };
  }
  
  formatStylePreferencesForPrompt(prefs: StylePreferences): string {
    const parts: string[] = [];
    
    // Formality
    if (prefs.formality < 0.3) {
      parts.push('Write in a very casual tone.');
    } else if (prefs.formality < 0.7) {
      parts.push('Write in a moderately formal tone.');
    } else {
      parts.push('Write in a formal tone.');
    }
    
    // Enthusiasm
    if (prefs.enthusiasm > 0.7) {
      parts.push('Be very enthusiastic.');
    } else if (prefs.enthusiasm > 0.4) {
      parts.push('Be moderately enthusiastic.');
    } else {
      parts.push('Keep a professional, measured tone.');
    }
    
    // Brevity
    if (prefs.brevity > 0.7) {
      parts.push('Keep responses very brief and to the point.');
    } else if (prefs.brevity > 0.4) {
      parts.push('Keep responses concise.');
    } else {
      parts.push('Provide thorough, detailed responses.');
    }
    
    // Greetings and closings
    if (prefs.preferred_greetings.length > 0) {
      parts.push(`Use greetings like: ${prefs.preferred_greetings.join(', ')}.`);
    }
    
    if (prefs.preferred_closings.length > 0) {
      parts.push(`Close with: ${prefs.preferred_closings.join(', ')}.`);
    }
    
    // Common phrases
    if (prefs.common_phrases.length > 0) {
      parts.push(`Feel free to use phrases like: ${prefs.common_phrases.join(', ')}.`);
    }
    
    if (prefs.avoid_phrases.length > 0) {
      parts.push(`Avoid phrases like: ${prefs.avoid_phrases.join(', ')}.`);
    }
    
    // Emojis
    if (prefs.common_emojis.length > 0) {
      parts.push(`Feel free to use emojis like: ${prefs.common_emojis.join(' ')}.`);
    }
    
    // Contractions
    if (prefs.common_contractions.length > 0) {
      parts.push(`Use contractions like: ${prefs.common_contractions.join(', ')}.`);
    }
    
    return parts.join(' ');
  }
  
  private getFormalityLevel(score: number): 'casual' | 'professional' | 'formal' {
    if (score < 0.3) return 'casual';
    if (score < 0.7) return 'professional';
    return 'formal';
  }
}

// Export singleton instance
export const relationshipService = new RelationshipService();