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
    diversityScore: number;
  };
}

export class ExampleSelector {
  private diversityWeight: number;
  
  constructor(
    private vectorStore: VectorStore,
    private embeddingService: EmbeddingService,
    private relationshipService: RelationshipService,
    private relationshipDetector: RelationshipDetector
  ) {
    this.diversityWeight = parseFloat(process.env.DIVERSITY_WEIGHT || '0.3');
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
    
    // Step 2: Get relationship profile (for future use)
    await this.relationshipService.getRelationshipProfile(
      params.userId,
      relationship.relationship
    );
    
    // Step 3: Embed incoming email with retry
    const { vector } = await withRetry(
      () => this.embeddingService.embedText(params.incomingEmail)
    );
    
    // Step 4: Search with relationship as PRIMARY filter (with retry)
    let examples = await withRetry(
      () => this.vectorStore.searchSimilar({
      userId: params.userId,
      queryVector: vector,
      relationship: relationship.relationship,
      limit: 100
    })
    );
    
    // Step 5: If not enough examples, expand search
    if (examples.length < 10) {
      console.log(`Only ${examples.length} examples for ${relationship.relationship}, expanding search`);
      
      const adjacentRelationships = this.getAdjacentRelationships(relationship.relationship);
      
      for (const adjacent of adjacentRelationships) {
        const moreExamples = await withRetry(
          () => this.vectorStore.searchSimilar({
          userId: params.userId,
          queryVector: vector,
          relationship: adjacent,
          limit: 50
        })
        );
        
        examples = [...examples, ...moreExamples];
        
        if (examples.length >= 10) break;
      }
    }
    
    // Step 6: Apply selection based on diversity weight
    const desiredCount = params.desiredCount || parseInt(process.env.EXAMPLE_COUNT || '25');
    const selected = this.diversityWeight > 0 
      ? this.selectDiverseExamples(examples, desiredCount)
      : this.selectBySimilarity(examples, desiredCount);
    
    return {
      relationship: relationship.relationship,
      examples: selected,
      stats: {
        totalCandidates: examples.length,
        relationshipMatch: selected.filter(e => 
          e.metadata.relationship.type === relationship.relationship
        ).length,
        diversityScore: this.calculateDiversityScore(selected)
      }
    };
  }
  
  private selectDiverseExamples(
    candidates: EmailVector[], 
    count: number
  ): SelectedExample[] {
    if (candidates.length <= count) {
      return candidates.map(c => ({
        id: c.id,
        text: c.metadata.userReply,
        metadata: c.metadata,
        score: c.score || 0
      }));
    }
    
    const selected: SelectedExample[] = [];
    const used = new Set<string>();
    
    // Group by different dimensions
    const byFormality = this.groupByFormality(candidates);
    const bySentiment = this.groupBySentiment(candidates);
    const byLength = this.groupByLength(candidates);
    const byUrgency = this.groupByUrgency(candidates);
    
    // Select from each group to ensure diversity
    const groups = [byFormality, bySentiment, byLength, byUrgency];
    let groupIndex = 0;
    
    while (selected.length < count) {
      const currentGroups = groups[groupIndex % groups.length];
      
      for (const group of Object.values(currentGroups)) {
        if (selected.length >= count) break;
        
        const unused = group.filter(e => !used.has(e.id));
        if (unused.length > 0) {
          const best = unused[0];
          selected.push({
            id: best.id,
            text: best.metadata.userReply,
            metadata: best.metadata,
            score: best.score || 0
          });
          used.add(best.id);
        }
      }
      
      groupIndex++;
      
      if (groupIndex > groups.length * 2) break;
    }
    
    return selected;
  }
  
  private selectBySimilarity(candidates: EmailVector[], count: number): SelectedExample[] {
    // Simple selection by similarity score when diversity weight is 0
    return candidates.slice(0, count).map(c => ({
      id: c.id,
      text: c.metadata.userReply,
      metadata: c.metadata,
      score: c.score || 0
    }));
  }
  
  private calculateDiversityScore(examples: SelectedExample[]): number {
    if (examples.length < 2) return 0;
    
    const dimensions = {
      formality: new Set(examples.map(e => 
        Math.round(e.metadata.features.stats.formalityScore * 10)
      )).size / 10,
      
      sentiment: new Set(examples.map(e => 
        e.metadata.features.sentiment.dominant
      )).size / 3,
      
      length: new Set(examples.map(e => 
        Math.floor(e.metadata.wordCount / 50)
      )).size / 5,
      
      urgency: new Set(examples.map(e => 
        e.metadata.features.urgency.level
      )).size / 3
    };
    
    return Object.values(dimensions).reduce((a, b) => a + b) / 4;
  }
  
  private getAdjacentRelationships(relationship: string): string[] {
    const adjacencyMap: Record<string, string[]> = {
      'spouse': ['friend', 'colleague'],
      'friend': ['spouse', 'colleague'],
      'colleague': ['friend', 'professional'],
      'professional': ['colleague', 'friend']
    };
    
    return adjacencyMap[relationship] || [];
  }

  private groupByFormality(candidates: EmailVector[]): Record<string, EmailVector[]> {
    const groups: Record<string, EmailVector[]> = {
      very_formal: [],
      formal: [],
      neutral: [],
      casual: [],
      very_casual: []
    };

    candidates.forEach(candidate => {
      const formalityScore = candidate.metadata.features?.stats?.formalityScore || 0.5;
      if (formalityScore >= 0.8) {
        groups.very_formal.push(candidate);
      } else if (formalityScore >= 0.6) {
        groups.formal.push(candidate);
      } else if (formalityScore >= 0.4) {
        groups.neutral.push(candidate);
      } else if (formalityScore >= 0.2) {
        groups.casual.push(candidate);
      } else {
        groups.very_casual.push(candidate);
      }
    });

    return groups;
  }

  private groupBySentiment(candidates: EmailVector[]): Record<string, EmailVector[]> {
    const groups: Record<string, EmailVector[]> = {
      positive: [],
      neutral: [],
      negative: []
    };

    candidates.forEach(candidate => {
      const sentiment = candidate.metadata.features?.sentiment?.dominant || 'neutral';
      groups[sentiment].push(candidate);
    });

    return groups;
  }

  private groupByLength(candidates: EmailVector[]): Record<string, EmailVector[]> {
    const groups: Record<string, EmailVector[]> = {
      very_short: [],
      short: [],
      medium: [],
      long: [],
      very_long: []
    };

    candidates.forEach(candidate => {
      const wordCount = candidate.metadata.wordCount || 0;
      if (wordCount < 25) {
        groups.very_short.push(candidate);
      } else if (wordCount < 50) {
        groups.short.push(candidate);
      } else if (wordCount < 150) {
        groups.medium.push(candidate);
      } else if (wordCount < 300) {
        groups.long.push(candidate);
      } else {
        groups.very_long.push(candidate);
      }
    });

    return groups;
  }

  private groupByUrgency(candidates: EmailVector[]): Record<string, EmailVector[]> {
    const groups: Record<string, EmailVector[]> = {
      high: [],
      medium: [],
      low: []
    };

    candidates.forEach(candidate => {
      const urgency = candidate.metadata.features?.urgency?.level || 'low';
      groups[urgency].push(candidate);
    });

    return groups;
  }
}