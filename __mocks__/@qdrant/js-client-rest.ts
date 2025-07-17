// Mock implementation of Qdrant client for testing

interface MockPoint {
  id: number | string;
  vector: number[];
  payload: any;
}

export class QdrantClient {
  private collections: Map<string, MockPoint[]> = new Map();
  
  constructor(config?: any) {
    // Mock constructor
  }
  
  async getCollections() {
    return {
      collections: Array.from(this.collections.keys()).map(name => ({ name }))
    };
  }
  
  async createCollection(name: string, config: any) {
    this.collections.set(name, []);
    return { status: 'ok' };
  }
  
  async getCollection(name: string) {
    const points = this.collections.get(name) || [];
    return {
      points_count: points.length,
      indexed_vectors_count: points.length,
      status: 'green',
      config: {
        params: {
          vectors: {
            size: 384,
            distance: 'Cosine'
          }
        }
      }
    };
  }
  
  async upsert(collectionName: string, { points }: { points: MockPoint[] }) {
    const collection = this.collections.get(collectionName) || [];
    
    for (const point of points) {
      // Remove existing point with same ID
      const existingIndex = collection.findIndex(p => p.id === point.id);
      if (existingIndex !== -1) {
        collection.splice(existingIndex, 1);
      }
      collection.push(point);
    }
    
    this.collections.set(collectionName, collection);
    return { status: 'ok' };
  }
  
  async search(collectionName: string, params: any) {
    const collection = this.collections.get(collectionName) || [];
    const results: any[] = [];
    
    // Simple mock search - filter by payload conditions and return all matching
    for (const point of collection) {
      let matches = true;
      
      // Check filter conditions
      if (params.filter?.must) {
        for (const condition of params.filter.must) {
          if (condition.key === 'userId' && point.payload.userId !== condition.match.value) {
            matches = false;
            break;
          }
          if (condition.key === 'relationship.type' && point.payload.relationship?.type !== condition.match.value) {
            matches = false;
            break;
          }
          if (condition.key === 'emailId' && condition.match.except) {
            if (condition.match.except.includes(point.payload.originalId || point.payload.emailId)) {
              matches = false;
              break;
            }
          }
          if (condition.key === 'sentDate' && condition.range) {
            const sentDate = new Date(point.payload.sentDate);
            const gte = condition.range.gte ? new Date(condition.range.gte) : null;
            const lte = condition.range.lte ? new Date(condition.range.lte) : null;
            
            if (gte && sentDate < gte) {
              matches = false;
              break;
            }
            if (lte && sentDate > lte) {
              matches = false;
              break;
            }
          }
        }
      }
      
      if (matches) {
        // Calculate mock similarity score based on query vector if provided
        let score = 0.5;
        
        if (params.vector && point.vector) {
          // Simple cosine similarity calculation
          let dotProduct = 0;
          let norm1 = 0;
          let norm2 = 0;
          
          for (let i = 0; i < Math.min(params.vector.length, point.vector.length); i++) {
            dotProduct += params.vector[i] * point.vector[i];
            norm1 += params.vector[i] * params.vector[i];
            norm2 += point.vector[i] * point.vector[i];
          }
          
          if (norm1 > 0 && norm2 > 0) {
            score = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
          }
        } else {
          // Random score if no vectors to compare
          score = 0.5 + Math.random() * 0.5;
        }
        
        if (score >= (params.score_threshold || 0)) {
          results.push({
            id: point.id,
            score,
            payload: point.payload
          });
        }
      }
    }
    
    // Sort by score and limit
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, params.limit || 10);
  }
  
  async scroll(collectionName: string, params: any) {
    const collection = this.collections.get(collectionName) || [];
    const points: any[] = [];
    
    for (const point of collection) {
      let matches = true;
      
      if (params.filter?.must) {
        for (const condition of params.filter.must) {
          if (condition.key === 'userId' && point.payload.userId !== condition.match.value) {
            matches = false;
            break;
          }
          if (condition.key === 'relationship.type' && point.payload.relationship?.type !== condition.match.value) {
            matches = false;
            break;
          }
        }
      }
      
      if (matches) {
        points.push({
          id: point.id,
          payload: point.payload
        });
      }
    }
    
    return {
      points: points.slice(0, params.limit || 100)
    };
  }
  
  async retrieve(collectionName: string, { ids }: { ids: (string | number)[] }) {
    const collection = this.collections.get(collectionName) || [];
    return collection.filter(point => ids.includes(point.id));
  }
  
  async setPayload(collectionName: string, { points, payload }: any) {
    const collection = this.collections.get(collectionName) || [];
    
    for (const pointId of points) {
      const point = collection.find(p => p.id === pointId);
      if (point) {
        Object.assign(point.payload, payload);
      }
    }
    
    return { status: 'ok' };
  }
  
  async delete(collectionName: string, params: any) {
    const collection = this.collections.get(collectionName) || [];
    const filtered = collection.filter(point => {
      if (params.filter?.must) {
        for (const condition of params.filter.must) {
          if (condition.key === 'userId' && point.payload.userId === condition.match.value) {
            return false; // Delete this point
          }
        }
      }
      return true; // Keep this point
    });
    
    this.collections.set(collectionName, filtered);
    return { status: 'ok' };
  }
}