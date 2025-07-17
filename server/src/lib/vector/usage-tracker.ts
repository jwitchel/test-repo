import { VectorStore, UsageUpdate } from './qdrant-client';

export interface ExampleFeedback {
  draftId: string;
  exampleIds: string[];
  feedback: {
    edited: boolean;
    editDistance: number;
    accepted: boolean;
    userRating?: number;
  };
}

export interface UsageStats {
  vectorId: string;
  timesUsed: number;
  timesEdited: number;
  averageEditDistance: number;
  lastUsed: Date;
  effectiveness: number; // 0-1 score
}

export class UsageTracker {
  constructor(private vectorStore: VectorStore) {}

  async trackExampleUsage(
    draftId: string, 
    exampleIds: string[]
  ): Promise<void> {
    const updates: UsageUpdate[] = exampleIds.map(id => ({
      vectorId: id,
      wasUsed: true,
      wasEdited: false
    }));

    await this.vectorStore.updateUsageStats(updates);
    
    // Store draft-to-examples mapping for later feedback
    await this.storeDraftMapping(draftId, exampleIds);
  }

  async trackExampleFeedback(feedback: ExampleFeedback): Promise<void> {
    const updates: UsageUpdate[] = feedback.exampleIds.map(id => ({
      vectorId: id,
      wasUsed: true,
      wasEdited: feedback.feedback.edited,
      editDistance: feedback.feedback.edited ? feedback.feedback.editDistance : undefined,
      userRating: this.calculateRating(feedback.feedback)
    }));

    await this.vectorStore.updateUsageStats(updates);
  }

  private calculateRating(feedback: {
    edited: boolean;
    editDistance: number;
    accepted: boolean;
    userRating?: number;
  }): number {
    if (feedback.userRating !== undefined) {
      return feedback.userRating;
    }

    // Infer rating from behavior
    if (!feedback.accepted) return 0.2;
    if (!feedback.edited) return 1.0;
    
    // Scale based on edit distance
    // Small edits (< 10%) = good (0.8-1.0)
    // Medium edits (10-30%) = okay (0.5-0.8)
    // Large edits (> 30%) = poor (0.2-0.5)
    if (feedback.editDistance < 0.1) return 0.9;
    if (feedback.editDistance < 0.3) return 0.7;
    return 0.4;
  }

  private async storeDraftMapping(
    draftId: string, 
    exampleIds: string[]
  ): Promise<void> {
    // In production, this would store in Redis or database
    // For now, we'll store in memory with TTL
    const key = `draft:${draftId}`;
    // const ttl = 24 * 60 * 60 * 1000; // 24 hours - for future Redis implementation
    
    // This is a placeholder - implement proper storage
    console.log(`Stored draft mapping: ${key} -> ${exampleIds.length} examples`);
  }

  async getExampleEffectiveness(
    vectorIds: string[]
  ): Promise<Map<string, number>> {
    // This would query the vector store for usage stats
    // and calculate effectiveness scores
    const effectiveness = new Map<string, number>();
    
    // Placeholder implementation
    vectorIds.forEach(id => {
      effectiveness.set(id, 0.75); // Default effectiveness
    });
    
    return effectiveness;
  }

  async pruneIneffectiveExamples(
    userId: string,
    threshold: number = 0.3
  ): Promise<number> {
    // This would identify and remove examples with low effectiveness
    console.log(`Would prune examples for user ${userId} below ${threshold} effectiveness`);
    return 0; // Number of pruned examples
  }
}