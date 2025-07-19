declare module 'wink-sentiment' {
  interface SentimentResult {
    score: number;
    normalizedScore: number;
    tokenizedPhrase: Array<{
      value: string;
      tag: string;
      score?: number;
    }>;
    sentiment: number;
    votingData: {
      positive: number;
      negative: number;
      total: number;
    };
  }

  function sentiment(text: string): SentimentResult;
  
  export = sentiment;
}