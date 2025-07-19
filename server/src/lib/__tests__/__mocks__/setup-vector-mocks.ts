// Setup dynamic mocks for vector tests
export function setupVectorMocks() {
  // Store for mocked data
  const storedVectors = new Map<string, any>();
  
  // Create dynamic mock client
  const mockQdrantClient = {
    getCollections: jest.fn().mockResolvedValue({
      collections: []
    }),
    getCollection: jest.fn().mockResolvedValue({
      points_count: storedVectors.size,
      vectors_count: storedVectors.size,
      indexed_vectors_count: storedVectors.size,
      status: 'green',
      config: {
        params: {
          vectors: {
            size: 384,
            distance: 'Cosine'
          }
        }
      }
    }),
    createCollection: jest.fn().mockResolvedValue({}),
    upsert: jest.fn().mockImplementation(async (collectionName, points) => {
      // Store the points
      if (Array.isArray(points.points)) {
        points.points.forEach((point: any) => {
          storedVectors.set(point.id.toString(), {
            id: point.id,
            payload: point.payload,
            vector: point.vector
          });
        });
      }
      return {};
    }),
    search: jest.fn().mockImplementation(async (collectionName, params) => {
      // Simple mock search - return all vectors for the user
      const results: any[] = [];
      
      storedVectors.forEach((value, key) => {
        let matches = true;
        
        // Apply filters if present
        if (params.filter?.must) {
          for (const filter of params.filter.must) {
            if (filter.key === 'userId' && value.payload?.userId !== filter.match.value) {
              matches = false;
            }
            if (filter.key === 'relationship.type' && value.payload?.relationship?.type !== filter.match.value) {
              matches = false;
            }
            if (filter.key === 'emailId' && filter.match.except) {
              // Exclude IDs filter
              if (filter.match.except.includes(value.payload?.emailId)) {
                matches = false;
              }
            }
            if (filter.key === 'sentDate' && filter.range) {
              // Date range filter
              const sentDate = new Date(value.payload?.sentDate || '');
              const gte = filter.range.gte ? new Date(filter.range.gte) : null;
              const lte = filter.range.lte ? new Date(filter.range.lte) : null;
              
              if (gte && sentDate < gte) matches = false;
              if (lte && sentDate > lte) matches = false;
            }
          }
        }
        
        if (matches) {
          // Calculate a mock similarity score
          let score = 0.85;
          if (params.vector && value.vector) {
            // Simple similarity: if vectors are the same, high score
            const allSame = value.vector.every((v: number, i: number) => v === params.vector[i]);
            if (allSame) {
              score = 0.99; // Very high for identical vectors
            } else {
              // Use a deterministic score based on the first few values to ensure consistency
              // This ensures most won't pass a high threshold
              const diff = Math.abs(value.vector[0] - params.vector[0]);
              score = Math.max(0.3, 0.75 - diff * 0.5);
            }
          }
          
          results.push({
            id: value.id,
            payload: value.payload,
            score: score
          });
        }
      });
      
      // Sort by score and apply threshold
      results.sort((a, b) => b.score - a.score);
      const threshold = params.score_threshold || 0;
      const filtered = results.filter(r => r.score >= threshold);
      
      return filtered.slice(0, params.limit || 10);
    }),
    retrieve: jest.fn().mockImplementation(async (collectionName, ids) => {
      const results: any[] = [];
      const idList = Array.isArray(ids) ? ids : [ids];
      idList.forEach(id => {
        const stored = storedVectors.get(id.toString());
        if (stored) {
          results.push({
            id: stored.id,
            payload: stored.payload
          });
        }
      });
      return results;
    }),
    delete: jest.fn().mockImplementation(async (collectionName, params) => {
      if (params.filter?.must) {
        const userFilter = params.filter.must.find((f: any) => f.key === 'userId');
        if (userFilter) {
          const toDelete: string[] = [];
          storedVectors.forEach((value, key) => {
            if (value.payload?.userId === userFilter.match.value) {
              toDelete.push(key);
            }
          });
          toDelete.forEach(key => storedVectors.delete(key));
        }
      }
      return {};
    }),
    setPayload: jest.fn().mockResolvedValue({}),
    scroll: jest.fn().mockImplementation(async (collectionName, params) => {
      const results: any[] = [];
      storedVectors.forEach((value, key) => {
        let matches = true;
        
        if (params.filter?.must) {
          const userFilter = params.filter.must.find((f: any) => f.key === 'userId');
          const relationshipFilter = params.filter.must.find((f: any) => f.key === 'relationship.type');
          
          if (userFilter && value.payload?.userId !== userFilter.match.value) {
            matches = false;
          }
          if (relationshipFilter && value.payload?.relationship?.type !== relationshipFilter.match.value) {
            matches = false;
          }
        }
        
        if (matches) {
          results.push({
            id: value.id,
            payload: value.payload
          });
        }
      });
      
      return {
        points: results.slice(0, params.limit || 100),
        next_page_offset: null
      };
    })
  };
  
  return { mockQdrantClient, storedVectors };
}