import { RelationshipDetectorResult } from '../pipeline/types';
import { personService } from './person-service';

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
    await personService.initialize();
  }

  async detectRelationship(params: DetectRelationshipParams): Promise<RelationshipDetectorResult> {
    const { userId, recipientEmail } = params;
    
    // First, check if we have this person in our database
    const person = await personService.findPersonByEmail(recipientEmail, userId);
    
    if (person && person.relationships.length > 0) {
      // Find the primary relationship or the one with highest confidence
      const primaryRel = person.relationships.find(r => r.is_primary) 
        || person.relationships.sort((a, b) => b.confidence - a.confidence)[0];
      
      return {
        relationship: primaryRel.relationship_type,
        confidence: primaryRel.confidence,
        method: primaryRel.user_set ? 'user-defined' : 'database'
      };
    }
    
    // If person not found, use domain-based heuristics for new contacts
    const email = recipientEmail.toLowerCase();
    let relationship = 'external';
    let confidence = 0.5;
    
    // Domain-based detection
    const domain = email.split('@')[1];
    if (domain) {
      // Check for personal email domains
      if (['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'].includes(domain)) {
        relationship = 'friends';  // Changed from 'friend' to 'friends'
        confidence = 0.6;
      } 
      // Check if domain matches user's company domain (would need user profile info)
      else if (domain.includes('.edu')) {
        relationship = 'colleague';
        confidence = 0.7;
      }
      // All other domains default to 'external' unless we have more context
      // Removed the assumption that .com/.org = colleague
    }
    
    // Use historical context if provided to refine the detection
    if (params.historicalContext) {
      const ctx = params.historicalContext;
      
      if (ctx.hasIntimacyMarkers && ctx.familiarityLevel === 'high') {
        relationship = 'spouse';
        confidence = Math.max(confidence, 0.8);
      } else if (ctx.hasProfessionalMarkers && ctx.formalityScore > 0.7) {
        relationship = 'colleague';  // Changed from 'professional' to 'colleague'
        confidence = Math.max(confidence, 0.75);
      } else if (ctx.familiarityLevel === 'high' && !ctx.hasProfessionalMarkers) {
        relationship = 'friends';  // Changed from 'friend' to 'friends'
        confidence = Math.max(confidence, 0.7);
      }
    }
    
    // Create person record for future use (only if we didn't find them)
    if (!person) {
      try {
        await personService.findOrCreatePerson({
          userId,
          name: email.split('@')[0], // Use email prefix as initial name
          emailAddress: recipientEmail,
          relationshipType: relationship,
          confidence
        });
      } catch (error) {
        // Log but don't fail - the detection still worked
        console.error('Failed to create person record:', error);
      }
    }
    
    return {
      relationship,
      confidence,
      method: 'heuristic'
    };
  }
}