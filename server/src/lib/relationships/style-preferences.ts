export interface StylePreferences {
  formality: number;      // 0-1 scale
  enthusiasm: number;     // 0-1 scale  
  brevity: number;        // 0-1 scale
  
  // Simple arrays instead of complex objects
  preferred_greetings: string[];
  preferred_closings: string[];
  common_phrases: string[];
  avoid_phrases: string[];
  
  // Arrays of commonly used emojis and contractions
  common_emojis: string[];
  common_contractions: string[];
}

export const DEFAULT_STYLE_PREFERENCES: Record<string, StylePreferences> = {
  spouse: {
    formality: 0.1,
    enthusiasm: 0.8,
    brevity: 0.8,
    preferred_greetings: ['hey', 'hi', 'morning'],
    preferred_closings: ['love', 'xoxo'],
    common_phrases: [],
    avoid_phrases: [],
    common_emojis: ['❤️', '😘', '🥰', '💕'],
    common_contractions: ["I'm", "you're", "it's", "we're", "can't", "won't"]
  },
  family: {
    formality: 0.2,
    enthusiasm: 0.7,
    brevity: 0.6,
    preferred_greetings: ['hi', 'hey'],
    preferred_closings: ['love', 'hugs'],
    common_phrases: [],
    avoid_phrases: [],
    common_emojis: ['😊', '🤗', '❤️'],
    common_contractions: ["I'm", "you're", "it's", "we're", "can't"]
  },
  close_friends: {
    formality: 0.1,
    enthusiasm: 0.9,
    brevity: 0.8,
    preferred_greetings: ['hey', 'yo', 'sup'],
    preferred_closings: ['later', 'cheers'],
    common_phrases: ['lol', 'omg', 'btw'],
    avoid_phrases: [],
    common_emojis: ['😂', '🤣', '😎', '✌️', '🔥'],
    common_contractions: ["I'm", "you're", "it's", "we're", "can't", "won't", "gonna", "wanna"]
  },
  friends: {
    formality: 0.2,
    enthusiasm: 0.7,
    brevity: 0.7,
    preferred_greetings: ['hey', 'hi'],
    preferred_closings: ['talk soon', 'later'],
    common_phrases: ['haha', 'btw'],
    avoid_phrases: [],
    common_emojis: ['😊', '👍', '😄'],
    common_contractions: ["I'm", "you're", "it's", "we're", "can't", "won't"]
  },
  colleagues: {
    formality: 0.6,
    enthusiasm: 0.5,
    brevity: 0.5,
    preferred_greetings: ['hi', 'hello'],
    preferred_closings: ['best', 'thanks', 'regards'],
    common_phrases: [],
    avoid_phrases: [],
    common_emojis: [],
    common_contractions: ["I'm", "you're", "it's", "we're"]
  },
  manager: {
    formality: 0.8,
    enthusiasm: 0.4,
    brevity: 0.3,
    preferred_greetings: ['hello', 'good morning'],
    preferred_closings: ['regards', 'best regards', 'thank you'],
    common_phrases: [],
    avoid_phrases: [],
    common_emojis: [],
    common_contractions: []
  },
  clients: {
    formality: 0.9,
    enthusiasm: 0.6,
    brevity: 0.3,
    preferred_greetings: ['dear', 'hello'],
    preferred_closings: ['sincerely', 'best regards', 'regards'],
    common_phrases: [],
    avoid_phrases: ['sorry for the delay', 'apologies'],
    common_emojis: [],
    common_contractions: []
  },
  external: {
    formality: 0.7,
    enthusiasm: 0.4,
    brevity: 0.5,
    preferred_greetings: ['hello'],
    preferred_closings: ['regards', 'best'],
    common_phrases: [],
    avoid_phrases: [],
    common_emojis: [],
    common_contractions: []
  }
};