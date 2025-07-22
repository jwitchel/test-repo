import { StylePreferences, DEFAULT_STYLE_PREFERENCES } from '../relationships/style-preferences';
import { relationshipService } from '../relationships/relationship-service';

describe('Style Preferences', () => {
  describe('DEFAULT_STYLE_PREFERENCES', () => {
    it('should have all required relationship types', () => {
      const expectedTypes = ['spouse', 'family', 'close_friends', 'friends', 'colleagues', 'manager', 'clients', 'external'];
      
      expectedTypes.forEach(type => {
        expect(DEFAULT_STYLE_PREFERENCES[type]).toBeDefined();
      });
    });
    
    it('should have valid formality scales', () => {
      Object.entries(DEFAULT_STYLE_PREFERENCES).forEach(([type, prefs]) => {
        expect(prefs.formality).toBeGreaterThanOrEqual(0);
        expect(prefs.formality).toBeLessThanOrEqual(1);
        expect(prefs.enthusiasm).toBeGreaterThanOrEqual(0);
        expect(prefs.enthusiasm).toBeLessThanOrEqual(1);
        expect(prefs.brevity).toBeGreaterThanOrEqual(0);
        expect(prefs.brevity).toBeLessThanOrEqual(1);
      });
    });
    
    it('should have appropriate formality levels', () => {
      expect(DEFAULT_STYLE_PREFERENCES.spouse.formality).toBeLessThan(DEFAULT_STYLE_PREFERENCES.colleagues.formality);
      expect(DEFAULT_STYLE_PREFERENCES.colleagues.formality).toBeLessThan(DEFAULT_STYLE_PREFERENCES.manager.formality);
      expect(DEFAULT_STYLE_PREFERENCES.manager.formality).toBeLessThan(DEFAULT_STYLE_PREFERENCES.clients.formality);
    });
    
    it('should have appropriate emoji usage', () => {
      expect(DEFAULT_STYLE_PREFERENCES.spouse.common_emojis.length).toBeGreaterThan(0);
      expect(DEFAULT_STYLE_PREFERENCES.close_friends.common_emojis.length).toBeGreaterThan(0);
      expect(DEFAULT_STYLE_PREFERENCES.manager.common_emojis.length).toBe(0);
      expect(DEFAULT_STYLE_PREFERENCES.clients.common_emojis.length).toBe(0);
    });
    
    it('should have appropriate contractions', () => {
      expect(DEFAULT_STYLE_PREFERENCES.close_friends.common_contractions).toContain('gonna');
      expect(DEFAULT_STYLE_PREFERENCES.close_friends.common_contractions).toContain('wanna');
      expect(DEFAULT_STYLE_PREFERENCES.manager.common_contractions.length).toBe(0);
      expect(DEFAULT_STYLE_PREFERENCES.clients.common_contractions.length).toBe(0);
    });
  });
  
  describe('formatStylePreferencesForPrompt', () => {
    it('should format casual style correctly', () => {
      const prompt = relationshipService.formatStylePreferencesForPrompt(DEFAULT_STYLE_PREFERENCES.spouse);
      
      expect(prompt).toContain('Write in a very casual tone');
      expect(prompt).toContain('Be very enthusiastic');
      expect(prompt).toContain('Keep responses very brief');
      expect(prompt).toContain('Use greetings like: hey, hi, morning');
      expect(prompt).toContain('Close with: love, xoxo');
      expect(prompt).toContain('Feel free to use emojis like: ❤️ 😘 🥰 💕');
    });
    
    it('should format professional style correctly', () => {
      const prompt = relationshipService.formatStylePreferencesForPrompt(DEFAULT_STYLE_PREFERENCES.colleagues);
      
      expect(prompt).toContain('Write in a moderately formal tone');
      expect(prompt).toContain('Be moderately enthusiastic');
      expect(prompt).toContain('Keep responses concise');
      expect(prompt).toContain('Use greetings like: hi, hello');
      expect(prompt).toContain('Close with: best, thanks, regards');
      expect(prompt).not.toContain('emojis');
    });
    
    it('should format formal style correctly', () => {
      const prompt = relationshipService.formatStylePreferencesForPrompt(DEFAULT_STYLE_PREFERENCES.clients);
      
      expect(prompt).toContain('Write in a formal tone');
      expect(prompt).toContain('Be moderately enthusiastic');
      expect(prompt).toContain('Provide thorough, detailed responses');
      expect(prompt).toContain('Use greetings like: dear, hello');
      expect(prompt).toContain('Close with: sincerely, best regards, regards');
      expect(prompt).toContain('Avoid phrases like: sorry for the delay, apologies');
      expect(prompt).not.toContain('contractions');
    });
    
    it('should handle empty arrays gracefully', () => {
      const minimalPrefs: StylePreferences = {
        formality: 0.5,
        enthusiasm: 0.5,
        brevity: 0.5,
        preferred_greetings: [],
        preferred_closings: [],
        common_phrases: [],
        avoid_phrases: [],
        common_emojis: [],
        common_contractions: []
      };
      
      const prompt = relationshipService.formatStylePreferencesForPrompt(minimalPrefs);
      
      expect(prompt).toContain('Write in a moderately formal tone');
      expect(prompt).not.toContain('greetings like:');
      expect(prompt).not.toContain('Close with:');
      expect(prompt).not.toContain('emojis');
      expect(prompt).not.toContain('contractions');
    });
  });
});