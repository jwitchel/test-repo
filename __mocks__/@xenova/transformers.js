// Mock implementation of @xenova/transformers for testing

exports.pipeline = jest.fn().mockImplementation(async (task, model) => {
  // Return a mock pipeline function
  return async (text, options) => {
    // Add small delay to simulate processing
    await new Promise(resolve => setImmediate(resolve));
    
    // Generate a deterministic mock embedding based on text
    const mockVector = new Array(384).fill(0).map((_, i) => {
      // Create a value that varies based on text content
      let hash = 0;
      for (let j = 0; j < text.length; j++) {
        hash = ((hash << 5) - hash) + text.charCodeAt(j);
        hash = hash & hash; // Convert to 32-bit integer
      }
      
      // Create vector values that are somewhat related for similar texts
      const seed = (hash + i) * 0.0001;
      return Math.sin(seed) * 0.5 + Math.cos(seed * 2) * 0.3 + Math.sin(seed * 3) * 0.2;
    });
    
    // Normalize the vector
    const magnitude = Math.sqrt(mockVector.reduce((sum, val) => sum + val * val, 0));
    const normalizedVector = magnitude > 0 
      ? mockVector.map(val => val / magnitude)
      : mockVector.map(() => 1 / Math.sqrt(384)); // Unit vector if all zeros
    
    return {
      data: normalizedVector
    };
  };
});