import { Pool } from 'pg';
import { RelationshipProfile } from '../pipeline/types';
import { StylePreferences, DEFAULT_STYLE_PREFERENCES } from './style-preferences';
import { personService } from './person-service';
import { PersonServiceError } from './person-service';
import { AggregatedStyle } from '../style/style-aggregation-service';
import { EnhancedRelationshipProfile } from '../pipeline/template-manager';

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
  
  async getEnhancedProfile(userId: string, recipientEmail: string): Promise<EnhancedRelationshipProfile | null> {
    // First get person and relationship info
    const person = await personService.findPersonByEmail(recipientEmail, userId);
    if (!person) {
      return null;
    }
    
    const primaryRel = person.relationships.find(r => r.is_primary) || person.relationships[0];
    if (!primaryRel) {
      return null;
    }
    
    const relationshipType = primaryRel.relationship_type;
    
    // Get basic profile
    const basicProfile = await this.getRelationshipProfile(userId, relationshipType);
    if (!basicProfile) {
      return null;
    }
    
    // Get aggregated style data
    const aggregatedStyle = await this.getAggregatedStyle(userId, relationshipType);
    
    // Build enhanced profile
    const enhancedProfile: EnhancedRelationshipProfile = {
      ...basicProfile,
      personName: person.name,
      relationshipType: relationshipType,
      aggregatedStyle: aggregatedStyle || undefined
    };
    
    return enhancedProfile;
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
      const storedData = result.rows[0].style_preferences;
      
      // Check if this is AggregatedStyle format (has emailCount property)
      if ('emailCount' in storedData) {
        // Convert AggregatedStyle to StylePreferences
        return this.convertAggregatedToPreferences(storedData as AggregatedStyle, relationshipType);
      } else {
        // Legacy format - merge with defaults
        const defaultPrefs = DEFAULT_STYLE_PREFERENCES[relationshipType] || DEFAULT_STYLE_PREFERENCES.external;
        return { ...defaultPrefs, ...storedData };
      }
    }
    
    // Return defaults if no custom preferences
    return DEFAULT_STYLE_PREFERENCES[relationshipType] || DEFAULT_STYLE_PREFERENCES.external;
  }
  
  async getAggregatedStyle(userId: string, relationshipType: string): Promise<AggregatedStyle | null> {
    const result = await pool.query(
      `SELECT style_preferences 
       FROM relationship_tone_preferences 
       WHERE user_id = $1 AND relationship_type = $2`,
      [userId, relationshipType]
    );
    
    if (result.rows.length > 0 && result.rows[0].style_preferences) {
      const storedData = result.rows[0].style_preferences;
      // Check if this is AggregatedStyle format
      if ('emailCount' in storedData) {
        return storedData as AggregatedStyle;
      }
    }
    
    return null;
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
  
  async formatAggregatedStyleForPrompt(userId: string, relationshipType: string): Promise<string> {
    const aggregated = await this.getAggregatedStyle(userId, relationshipType);
    if (!aggregated) {
      // Fall back to basic style preferences
      const prefs = await this.getStylePreferences(userId, relationshipType);
      return prefs ? this.formatStylePreferencesForPrompt(prefs) : '';
    }
    
    const parts: string[] = [];
    
    // Add confidence-based prefix
    if (aggregated.confidenceScore < 0.4) {
      parts.push(`Note: Style analysis is based on limited data (${aggregated.emailCount} emails).`);
    } else if (aggregated.confidenceScore > 0.8) {
      parts.push(`Style analysis is based on ${aggregated.emailCount} emails with high confidence.`);
    }
    
    // Primary tone
    parts.push(`Write in a ${aggregated.sentimentProfile.primaryTone} tone.`);
    
    // Formality level
    const formalityLevel = this.getFormalityLevel(aggregated.sentimentProfile.averageFormality);
    parts.push(`Maintain a ${formalityLevel} level of formality.`);
    
    // Email length guidance
    if (aggregated.structuralPatterns.averageEmailLength < 50) {
      parts.push('Keep emails very brief (typically under 50 words).');
    } else if (aggregated.structuralPatterns.averageEmailLength < 100) {
      parts.push('Keep emails concise (typically 50-100 words).');
    } else if (aggregated.structuralPatterns.averageEmailLength > 200) {
      parts.push('Write detailed emails (typically over 200 words).');
    }
    
    // Specific greetings if consistent
    const topGreetings = aggregated.greetings.filter(g => g.percentage > 30);
    if (topGreetings.length > 0) {
      parts.push(`Preferred greetings: ${topGreetings.map(g => g.text).join(', ')}.`);
    }
    
    // Specific closings if consistent
    const topClosings = aggregated.closings.filter(c => c.percentage > 30);
    if (topClosings.length > 0) {
      parts.push(`Preferred closings: ${topClosings.map(c => c.text).join(', ')}.`);
    }
    
    // Common phrases if frequent
    if (aggregated.vocabularyProfile.commonPhrases.length > 0) {
      const topPhrases = aggregated.vocabularyProfile.commonPhrases
        .slice(0, 5)
        .map(p => p.phrase);
      parts.push(`Common phrases to consider: ${topPhrases.join(', ')}.`);
    }
    
    // Emoji usage
    if (aggregated.emojis.length > 0) {
      const topEmojis = aggregated.emojis.slice(0, 5).map(e => e.emoji);
      parts.push(`Feel free to use emojis like: ${topEmojis.join(' ')}.`);
    } else {
      parts.push('Avoid using emojis.');
    }
    
    // Contractions
    if (aggregated.contractions.uses) {
      parts.push(`Use contractions naturally (examples: ${aggregated.contractions.examples.slice(0, 3).join(', ')}).`);
    } else {
      parts.push('Avoid contractions for a more formal tone.');
    }
    
    // Sentence complexity
    parts.push(`Average sentence length is ${Math.round(aggregated.structuralPatterns.averageSentenceLength)} words.`);
    
    return parts.join(' ');
  }
  
  private getFormalityLevel(score: number): 'casual' | 'professional' | 'formal' {
    if (score < 0.3) return 'casual';
    if (score < 0.7) return 'professional';
    return 'formal';
  }
  
  private convertAggregatedToPreferences(aggregated: AggregatedStyle, relationshipType: string): StylePreferences {
    // Start with defaults as base
    const defaults = DEFAULT_STYLE_PREFERENCES[relationshipType] || DEFAULT_STYLE_PREFERENCES.external;
    
    // Extract top greetings and closings
    const preferredGreetings = aggregated.greetings
      .filter(g => g.percentage > 20) // Used in at least 20% of emails
      .map(g => g.text)
      .slice(0, 5);
    
    const preferredClosings = aggregated.closings
      .filter(c => c.percentage > 20)
      .map(c => c.text)
      .slice(0, 5);
    
    // Extract common phrases (used frequently)
    const commonPhrases = aggregated.vocabularyProfile.commonPhrases
      .filter(p => p.frequency > 2)
      .map(p => p.phrase)
      .slice(0, 10);
    
    // Extract emojis if used frequently enough
    const commonEmojis = aggregated.emojis
      .filter(e => e.frequency > 2)
      .map(e => e.emoji)
      .slice(0, 10);
    
    // Calculate brevity based on average email length
    let brevity = 0.5; // default moderate
    if (aggregated.structuralPatterns.averageEmailLength < 50) {
      brevity = 0.9; // very brief
    } else if (aggregated.structuralPatterns.averageEmailLength < 100) {
      brevity = 0.7; // brief
    } else if (aggregated.structuralPatterns.averageEmailLength > 200) {
      brevity = 0.2; // verbose
    }
    
    // Use aggregated formality and warmth (warmth as proxy for enthusiasm)
    const formality = aggregated.sentimentProfile.averageFormality;
    const enthusiasm = aggregated.sentimentProfile.averageWarmth;
    
    // Build style preferences from aggregated data
    return {
      formality: formality,
      enthusiasm: enthusiasm,
      brevity: brevity,
      preferred_greetings: preferredGreetings.length > 0 ? preferredGreetings : defaults.preferred_greetings,
      preferred_closings: preferredClosings.length > 0 ? preferredClosings : defaults.preferred_closings,
      common_phrases: commonPhrases.length > 0 ? commonPhrases : defaults.common_phrases,
      avoid_phrases: defaults.avoid_phrases, // Keep defaults as we don't track these
      common_emojis: commonEmojis,
      common_contractions: aggregated.contractions.examples.slice(0, 10)
    };
  }
}

// Export singleton instance
export const relationshipService = new RelationshipService();