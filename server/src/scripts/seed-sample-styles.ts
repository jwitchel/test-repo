import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { AggregatedStyle } from '../lib/style/types';

// Load environment variables from the root directory
dotenv.config({ path: path.join(__dirname, '../../../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const sampleStyles: Record<string, AggregatedStyle> = {
  colleague: {
    greetings: [
      { text: 'Hi', frequency: 45, percentage: 35 },
      { text: 'Hey', frequency: 32, percentage: 25 },
      { text: 'Good morning', frequency: 28, percentage: 22 },
      { text: 'Hello', frequency: 23, percentage: 18 }
    ],
    closings: [
      { text: 'Best', frequency: 42, percentage: 33 },
      { text: 'Thanks', frequency: 38, percentage: 30 },
      { text: 'Regards', frequency: 25, percentage: 20 },
      { text: 'Cheers', frequency: 22, percentage: 17 }
    ],
    emojis: [
      { emoji: '😊', frequency: 15, contexts: ['greeting', 'positive feedback'] },
      { emoji: '👍', frequency: 12, contexts: ['acknowledgment', 'approval'] },
      { emoji: '🙏', frequency: 8, contexts: ['thanks', 'request'] }
    ],
    contractions: {
      uses: true,
      frequency: 0.65,
      examples: ["I'll", "won't", "can't", "we're", "it's"]
    },
    sentimentProfile: {
      primaryTone: 'positive',
      averageWarmth: 0.72,
      averageFormality: 0.45
    },
    vocabularyProfile: {
      complexityLevel: 'moderate',
      technicalTerms: ['API', 'implementation', 'deployment', 'review'],
      commonPhrases: [
        { phrase: 'let me know', frequency: 25 },
        { phrase: 'sounds good', frequency: 18 },
        { phrase: 'thanks for', frequency: 15 },
        { phrase: 'looking forward', frequency: 12 }
      ]
    },
    structuralPatterns: {
      averageEmailLength: 125,
      averageSentenceLength: 15.3,
      paragraphingStyle: 'short'
    },
    emailCount: 128,
    confidenceScore: 0.85,
    lastUpdated: new Date().toISOString()
  },
  friend: {
    greetings: [
      { text: 'Hey', frequency: 65, percentage: 45 },
      { text: 'Hi', frequency: 42, percentage: 29 },
      { text: 'Yo', frequency: 25, percentage: 17 },
      { text: 'Hello', frequency: 13, percentage: 9 }
    ],
    closings: [
      { text: 'Later', frequency: 35, percentage: 28 },
      { text: 'Talk soon', frequency: 32, percentage: 26 },
      { text: 'Cheers', frequency: 30, percentage: 24 },
      { text: 'Take care', frequency: 28, percentage: 22 }
    ],
    emojis: [
      { emoji: '😂', frequency: 45, contexts: ['humor', 'reaction'] },
      { emoji: '🎉', frequency: 28, contexts: ['celebration', 'excitement'] },
      { emoji: '😊', frequency: 25, contexts: ['friendly', 'positive'] },
      { emoji: '🍻', frequency: 18, contexts: ['plans', 'celebration'] },
      { emoji: '😅', frequency: 15, contexts: ['awkward', 'humor'] }
    ],
    contractions: {
      uses: true,
      frequency: 0.82,
      examples: ["I'm", "you're", "it's", "we'll", "that's", "didn't"]
    },
    sentimentProfile: {
      primaryTone: 'enthusiastic',
      averageWarmth: 0.88,
      averageFormality: 0.15
    },
    vocabularyProfile: {
      complexityLevel: 'simple',
      technicalTerms: [],
      commonPhrases: [
        { phrase: 'haha', frequency: 42 },
        { phrase: 'no worries', frequency: 35 },
        { phrase: 'sounds fun', frequency: 28 },
        { phrase: 'catch up', frequency: 22 }
      ]
    },
    structuralPatterns: {
      averageEmailLength: 85,
      averageSentenceLength: 12.5,
      paragraphingStyle: 'casual'
    },
    emailCount: 245,
    confidenceScore: 0.92,
    lastUpdated: new Date().toISOString()
  },
  manager: {
    greetings: [
      { text: 'Good morning', frequency: 45, percentage: 38 },
      { text: 'Hi', frequency: 35, percentage: 30 },
      { text: 'Hello', frequency: 28, percentage: 24 },
      { text: 'Good afternoon', frequency: 10, percentage: 8 }
    ],
    closings: [
      { text: 'Best regards', frequency: 48, percentage: 40 },
      { text: 'Thanks', frequency: 35, percentage: 29 },
      { text: 'Thank you', frequency: 22, percentage: 18 },
      { text: 'Best', frequency: 15, percentage: 13 }
    ],
    emojis: [],
    contractions: {
      uses: false,
      frequency: 0.05,
      examples: []
    },
    sentimentProfile: {
      primaryTone: 'professional',
      averageWarmth: 0.45,
      averageFormality: 0.85
    },
    vocabularyProfile: {
      complexityLevel: 'sophisticated',
      technicalTerms: ['deliverables', 'KPIs', 'stakeholders', 'alignment'],
      commonPhrases: [
        { phrase: 'please let me know', frequency: 18 },
        { phrase: 'at your earliest convenience', frequency: 12 },
        { phrase: 'I appreciate', frequency: 15 },
        { phrase: 'moving forward', frequency: 10 }
      ]
    },
    structuralPatterns: {
      averageEmailLength: 185,
      averageSentenceLength: 18.2,
      paragraphingStyle: 'formal'
    },
    emailCount: 92,
    confidenceScore: 0.78,
    lastUpdated: new Date().toISOString()
  }
};

async function seedSampleStyles() {
  try {
    // Get the first test user
    const userResult = await pool.query('SELECT id FROM "user" LIMIT 1');
    if (userResult.rows.length === 0) {
      console.log('No users found. Please create test users first.');
      return;
    }
    
    const userId = userResult.rows[0].id;
    console.log(`Adding sample styles for user: ${userId}`);
    
    // First, ensure user_relationships exist
    const displayNames: Record<string, string> = {
      colleague: 'Colleagues',
      friend: 'Friends',
      manager: 'Manager'
    };
    
    for (const relationshipType of Object.keys(sampleStyles)) {
      await pool.query(
        `INSERT INTO user_relationships (user_id, relationship_type, display_name, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, true, NOW(), NOW())
         ON CONFLICT (user_id, relationship_type) DO NOTHING`,
        [userId, relationshipType, displayNames[relationshipType] || relationshipType]
      );
    }
    
    for (const [relationshipType, style] of Object.entries(sampleStyles)) {
      // Insert or update the style preferences
      await pool.query(
        `INSERT INTO relationship_tone_preferences 
         (user_id, relationship_type, style_preferences, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         ON CONFLICT (user_id, relationship_type)
         DO UPDATE SET 
           style_preferences = $3,
           updated_at = NOW()`,
        [userId, relationshipType, JSON.stringify(style)]
      );
      
      console.log(`✓ Added style for ${relationshipType} relationship (${style.emailCount} emails)`);
    }
    
    console.log('\nSample styles added successfully!');
  } catch (error) {
    console.error('Error seeding sample styles:', error);
  } finally {
    await pool.end();
  }
}

seedSampleStyles();