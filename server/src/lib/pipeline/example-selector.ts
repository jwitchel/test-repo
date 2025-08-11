import { VectorStore } from '../vector/qdrant-client';
import { EmbeddingService } from '../vector/embedding-service';
import { RelationshipService } from '../relationships/relationship-service';
import { RelationshipDetector } from '../relationships/relationship-detector';
import { withRetry } from './retry-utils';

export interface SelectedExample {
  id: string;
  text: string;
  metadata: any;
  score: number;
}

export interface EmailVector {
  id: string;
  score?: number;
  metadata: any;
}

export interface ExampleSelectionResult {
  relationship: string;
  examples: SelectedExample[];
  stats: {
    totalCandidates: number;
    relationshipMatch: number;
    directCorrespondence: number;  // Tracks emails to the specific recipient
  };
}

export class ExampleSelector {
  constructor(
    private vectorStore: VectorStore,
    private embeddingService: EmbeddingService,
    private relationshipService: RelationshipService,
    private relationshipDetector: RelationshipDetector
  ) {
    // Two-phase selection ensures good results without diversity weighting
  }
  
  async selectExamples(params: {
    userId: string;
    incomingEmail: string;
    recipientEmail: string;
    desiredCount?: number;
  }): Promise<ExampleSelectionResult> {
    // Step 1: Detect relationship for recipient
    const relationship = await this.relationshipDetector.detectRelationship({
      userId: params.userId,
      recipientEmail: params.recipientEmail
    });
    
    console.log(`[ExampleSelector] Detected relationship: ${relationship.relationship} (confidence: ${relationship.confidence})`);
    console.log(`[ExampleSelector] UserId: ${params.userId}`);
    
    // Debug: Check what's in the vector store for this user
    await this.vectorStore.debugUserEmails(params.userId, 5);
    
    // Step 2: Get relationship profile (for future use)
    await this.relationshipService.getRelationshipProfile(
      params.userId,
      relationship.relationship
    );
    
    // Step 3: Embed incoming email with retry
    const { vector } = await withRetry(
      () => this.embeddingService.embedText(params.incomingEmail)
    );
    
    console.log(`[ExampleSelector] Generated embedding:`, {
      hasVector: vector ? 'yes' : 'no',
      vectorLength: vector?.length,
      vectorSample: vector ? vector.slice(0, 5) : null
    });
    
    // Step 4: Two-phase selection
    const desiredCount = params.desiredCount || parseInt(process.env.EXAMPLE_COUNT || '25');
    const maxDirectPercentage = parseFloat(process.env.DIRECT_EMAIL_MAX_PERCENTAGE || '0.6');
    const maxDirectEmails = Math.floor(desiredCount * maxDirectPercentage);
    
    // Phase 1: Search for direct correspondence with this specific recipient
    // These emails show how the writer specifically communicates with this person
    console.log(`[ExampleSelector] Phase 1: Searching for direct emails to ${params.recipientEmail}`);
    const directEmails = await withRetry(
      () => this.vectorStore.searchSimilar({
        userId: params.userId,
        queryVector: vector,
        recipientEmail: params.recipientEmail,  // Filter to this specific recipient
        limit: 50,  // Get more than we need to allow for selection
        scoreThreshold: 0  // Get all results, sorted by similarity
      })
    );
    
    console.log(`[ExampleSelector] Found ${directEmails.length} direct emails with ${params.recipientEmail}`);
    
    // Calculate how many direct emails to use (up to the maximum percentage)
    const directEmailsToUse = Math.min(directEmails.length, maxDirectEmails);
    const remainingSlots = desiredCount - directEmailsToUse;
    
    console.log(`Using ${directEmailsToUse}/${directEmails.length} direct emails (max ${maxDirectEmails} allowed)`);
    console.log(`Need ${remainingSlots} more examples from ${relationship.relationship} category`);
    
    // Phase 2: Search for same relationship category to fill remaining slots
    // These show the writer's general pattern for this type of relationship
    let categoryEmails: EmailVector[] = [];
    if (remainingSlots > 0) {
      console.log(`[ExampleSelector] Phase 2: Searching for ${relationship.relationship} relationship emails`);
      categoryEmails = await withRetry(
        () => this.vectorStore.searchSimilar({
          userId: params.userId,
          queryVector: vector,
          relationship: relationship.relationship,  // Same relationship type
          limit: 100,  // Get plenty for selection
          scoreThreshold: 0  // Get all results, sorted by similarity
        })
      );
      
      console.log(`[ExampleSelector] Raw category search returned ${categoryEmails.length} emails`);
      
      // Filter out any emails we already have from direct correspondence
      const directEmailIds = new Set(directEmails.map(e => e.id));
      categoryEmails = categoryEmails.filter(e => !directEmailIds.has(e.id));
      
      console.log(`[ExampleSelector] After filtering duplicates: ${categoryEmails.length} additional ${relationship.relationship} emails`);
    }
    
    // Combine the two sets, preserving similarity order within each phase
    const examples = [
      ...directEmails.slice(0, directEmailsToUse),
      ...categoryEmails.slice(0, remainingSlots)
    ];
    
    // Step 5: Use similarity-based selection
    // The two-phase approach already ensures we get relevant examples
    const selected = this.selectBySimilarity(examples, desiredCount);
    
    console.log(`Final selection: ${selected.length} examples total`);
    
    // Debug relationship types
    if (selected.length > 0) {
      console.log(`[ExampleSelector] First selected example relationship:`, selected[0].metadata.relationship);
      const uniqueRelationships = [...new Set(selected.map(e => e.metadata.relationship?.type))];
      console.log(`[ExampleSelector] Unique relationship types in selection:`, uniqueRelationships);
    }
    
    return {
      relationship: relationship.relationship,
      examples: selected,
      stats: {
        totalCandidates: directEmails.length + categoryEmails.length,
        relationshipMatch: selected.filter(e => 
          e.metadata.relationship?.type === relationship.relationship
        ).length,
        directCorrespondence: selected.filter(e => 
          e.metadata.recipientEmail === params.recipientEmail
        ).length
      }
    };
  }
  
  private selectBySimilarity(candidates: EmailVector[], count: number): SelectedExample[] {
    // Simple selection by similarity score
    // The vector search already orders by semantic similarity
    return candidates.slice(0, count).map(c => ({
      id: c.id,
      text: c.metadata.userReply,
      metadata: c.metadata,
      score: c.score || 0
    }));
  }
}