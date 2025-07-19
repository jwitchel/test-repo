#!/usr/bin/env node

// Interactive NLP Feature Demo
const readline = require('readline');
const { extractEmailFeatures } = require('./dist/lib/nlp-feature-extractor');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log("🔍 Interactive NLP Feature Analyzer\n");
console.log("This tool analyzes email text using:");
console.log("- wink-sentiment for sentiment analysis");
console.log("- compromise.js for linguistic analysis");
console.log("- Custom algorithms for relationship detection\n");

function analyzeText(text, recipientEmail = 'recipient@example.com') {
  const features = extractEmailFeatures(text, { email: recipientEmail });
  
  console.log("\n" + "=".repeat(60));
  console.log("📊 ANALYSIS RESULTS");
  console.log("=".repeat(60));
  
  // Sentiment
  console.log("\n🎭 SENTIMENT");
  console.log(`Primary: ${features.sentiment.primary}`);
  console.log(`Score: ${features.sentiment.score.toFixed(3)} (-1 to 1)`);
  console.log(`Confidence: ${(features.sentiment.confidence * 100).toFixed(0)}%`);
  if (features.sentiment.emotions.length > 0) {
    console.log(`Emotions: ${features.sentiment.emotions.join(', ')}`);
  }
  
  // Relationship
  console.log("\n🤝 RELATIONSHIP");
  console.log(`Familiarity: ${features.relationshipHints.familiarityLevel}`);
  const markers = features.relationshipHints.linguisticMarkers;
  if (markers.informalLanguage.length > 0) {
    console.log(`Informal: ${markers.informalLanguage.slice(0, 5).join(', ')}`);
  }
  if (markers.professionalPhrases.length > 0) {
    console.log(`Professional: ${markers.professionalPhrases.join(', ')}`);
  }
  
  // Tone
  console.log("\n🎨 TONE");
  const tone = features.tonalQualities;
  const toneBar = (value) => {
    const width = 20;
    const filled = Math.round(value * width);
    return '█'.repeat(filled) + '░'.repeat(width - filled) + ` ${(value * 100).toFixed(0)}%`;
  };
  
  console.log(`Warmth:      ${toneBar(tone.warmth)}`);
  console.log(`Formality:   ${toneBar(tone.formality)}`);
  console.log(`Politeness:  ${toneBar(tone.politeness)}`);
  console.log(`Urgency:     ${toneBar(tone.urgency)}`);
  console.log(`Directness:  ${toneBar(tone.directness)}`);
  console.log(`Enthusiasm:  ${toneBar(tone.enthusiasm)}`);
  
  // Style
  console.log("\n✍️ STYLE");
  console.log(`Vocabulary: ${features.linguisticStyle.vocabularyComplexity}`);
  console.log(`Sentences: ${features.linguisticStyle.sentenceStructure}`);
  console.log(`Context: ${features.contextType}`);
  
  // Quick stats
  console.log("\n📈 STATS");
  console.log(`Words: ${features.stats.wordCount}, Sentences: ${features.stats.sentenceCount}`);
  console.log(`Avg words/sentence: ${features.stats.avgWordsPerSentence.toFixed(1)}`);
  
  console.log("\n" + "=".repeat(60) + "\n");
}

function showExamples() {
  console.log("\n📝 EXAMPLE TEXTS TO TRY:");
  console.log("\n1. Informal/Friendly:");
  console.log('   "Hey! That was awesome lol. Wanna grab lunch tomorrow?"');
  console.log("\n2. Professional:");
  console.log('   "Dear Mr. Johnson, Per our discussion, I am attaching the quarterly report for your review."');
  console.log("\n3. Urgent:");
  console.log('   "URGENT: Need this ASAP! The client is waiting!!!"');
  console.log("\n4. Apologetic:");
  console.log('   "I\'m so sorry about the delay. I feel terrible about missing the deadline."');
  console.log("\n5. Warm/Personal:");
  console.log('   "Hi honey! Hope you\'re having a great day. Love you!"');
  console.log("\n");
}

function prompt() {
  rl.question('Enter email text to analyze (or "examples", "help", "quit"): ', (input) => {
    if (input.toLowerCase() === 'quit' || input.toLowerCase() === 'exit') {
      console.log("\n👋 Thanks for using the NLP analyzer!");
      rl.close();
      return;
    }
    
    if (input.toLowerCase() === 'examples') {
      showExamples();
      prompt();
      return;
    }
    
    if (input.toLowerCase() === 'help') {
      console.log("\n📖 HELP:");
      console.log("- Type any email text to analyze it");
      console.log("- Type 'examples' to see example texts");
      console.log("- Type 'quit' to exit");
      console.log("\nThe analyzer will show:");
      console.log("- Sentiment (positive/negative/neutral)");
      console.log("- Emotions detected");
      console.log("- Relationship familiarity level");
      console.log("- Tone qualities (warmth, formality, etc.)");
      console.log("- Writing style analysis\n");
      prompt();
      return;
    }
    
    if (input.trim()) {
      try {
        analyzeText(input);
      } catch (error) {
        console.error("\n❌ Error analyzing text:", error.message);
      }
    }
    
    prompt();
  });
}

console.log("Type 'examples' to see example texts, 'help' for more info, or 'quit' to exit.\n");
prompt();