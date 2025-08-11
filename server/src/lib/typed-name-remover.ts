import { Pool } from 'pg';

export interface TypedNameRemovalResult {
  cleanedText: string;
  removedText: string | null;
  matchedPattern: string | null;
}

export class TypedNameRemover {
  constructor(private pool: Pool) {}

  /**
   * Remove typed name from user reply based on user preferences
   */
  async removeTypedName(text: string, userId: string): Promise<TypedNameRemovalResult> {
    try {
      // Get user's typed name removal preference
      const result = await this.pool.query(
        `SELECT profile_data->'typedNamePreferences' as preferences
         FROM tone_preferences
         WHERE user_id = $1 
           AND preference_type = 'user'
           AND target_identifier = 'global'`,
        [userId]
      );

      if (!result.rows.length || !result.rows[0].preferences) {
        // No preferences set, return text as-is
        return {
          cleanedText: text,
          removedText: null,
          matchedPattern: null
        };
      }

      const preferences = result.rows[0].preferences;
      const removalRegex = preferences.removalRegex;

      if (!removalRegex) {
        // No removal regex configured
        return {
          cleanedText: text,
          removedText: null,
          matchedPattern: null
        };
      }

      // Apply the removal regex
      try {
        const regex = new RegExp(removalRegex, 'gmi');
        const matches = text.match(regex);
        
        if (matches && matches.length > 0) {
          const cleanedText = text.replace(regex, '').trim();
          
          return {
            cleanedText,
            removedText: matches.join(', '),
            matchedPattern: removalRegex
          };
        }
      } catch (regexError) {
        console.error(`Invalid regex pattern for user ${userId}: ${removalRegex}`, regexError);
      }

      // No matches found or regex error
      return {
        cleanedText: text,
        removedText: null,
        matchedPattern: null
      };
    } catch (error) {
      console.error('Error removing typed name:', error);
      // On error, return text as-is
      return {
        cleanedText: text,
        removedText: null,
        matchedPattern: null
      };
    }
  }

  /**
   * Get typed name append string for a user
   */
  async getTypedNameAppend(userId: string): Promise<string | null> {
    try {
      const result = await this.pool.query(
        `SELECT profile_data->'typedNamePreferences'->'appendString' as append_string
         FROM tone_preferences
         WHERE user_id = $1 
           AND preference_type = 'user'
           AND target_identifier = 'global'`,
        [userId]
      );

      if (!result.rows.length || !result.rows[0].append_string) {
        return null;
      }

      // Remove quotes from JSON string value
      return result.rows[0].append_string.replace(/^"|"$/g, '');
    } catch (error) {
      console.error('Error getting typed name append:', error);
      return null;
    }
  }
}