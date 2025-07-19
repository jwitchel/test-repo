#!/usr/bin/env node

// Demo script for NLP Feature Extractor
const { extractEmailFeatures } = require('./dist/lib/nlp-feature-extractor');

// Sample emails to analyze
const sampleEmails = [
  {
    name: "Intimate/Personal",
    text: "Hey honey! Just wanted to let you know I'll be home late tonight. Love you! 💕",
    recipient: { email: "spouse@example.com", name: "Sarah" }
  },
  {
    name: "Very Familiar (Close Friend)",
    text: "Dude! That was insane lol. We gotta do that again soon haha! Hit me up!",
    recipient: { email: "friend@example.com", name: "Mike" }
  },
  {
    name: "Professional/Colleague",
    text: "Hi John, per our discussion, I've attached the quarterly report for your review. Please let me know if you need any clarification. Best regards, Sarah",
    recipient: { email: "john@company.com", name: "John Smith" }
  },
  {
    name: "Formal/External",
    text: "Dear Dr. Johnson, I hope this email finds you well. Pursuant to our conversation last week, I am writing to request an appointment at your earliest convenience. Sincerely, Robert Williams",
    recipient: { email: "doctor@clinic.com", name: "Dr. Johnson" }
  },
  {
    name: "Urgent Request",
    text: "URGENT: Need the presentation slides ASAP! The client meeting is in 30 minutes and I can't find the latest version. Please send immediately!!!",
    recipient: { email: "colleague@work.com", name: "Team" }
  },
  {
    name: "Apologetic",
    text: "Hi Sarah, I'm so sorry about missing our meeting yesterday. I completely forgot about it. Can we please reschedule? I feel terrible about this.",
    recipient: { email: "sarah@example.com", name: "Sarah" }
  }
];

console.log("🔍 NLP Feature Extractor Demo\n");
console.log("This demo showcases the enhanced NLP capabilities including:");
console.log("- Sentiment analysis with wink-sentiment");
console.log("- Relationship detection using Compromise.js tags");
console.log("- Emotion extraction");
console.log("- Formality and tone analysis");
console.log("- Linguistic style detection\n");
console.log("=" .repeat(80) + "\n");

sampleEmails.forEach((sample, index) => {
  console.log(`📧 Email ${index + 1}: ${sample.name}`);
  console.log("-".repeat(60));
  console.log(`Text: "${sample.text}"`);
  console.log(`To: ${sample.recipient.name} <${sample.recipient.email}>\n`);
  
  const features = extractEmailFeatures(sample.text, sample.recipient);
  
  // Display key features
  console.log("🎭 Sentiment Analysis:");
  console.log(`  Primary: ${features.sentiment.primary}`);
  console.log(`  Score: ${features.sentiment.score.toFixed(2)} (range: -1 to 1)`);
  console.log(`  Intensity: ${features.sentiment.intensity.toFixed(2)}`);
  console.log(`  Confidence: ${features.sentiment.confidence.toFixed(2)}`);
  if (features.sentiment.emotions.length > 0) {
    console.log(`  Emotions: ${features.sentiment.emotions.join(', ')}`);
  }
  if (features.sentiment.emojis) {
    console.log(`  Emojis: ${features.sentiment.emojis.join(' ')}`);
  }
  
  console.log("\n🤝 Relationship Analysis:");
  console.log(`  Familiarity: ${features.relationshipHints.familiarityLevel}`);
  console.log(`  Greeting Style: ${features.relationshipHints.linguisticMarkers.greetingStyle}`);
  console.log(`  Closing Style: ${features.relationshipHints.linguisticMarkers.closingStyle}`);
  if (features.relationshipHints.linguisticMarkers.endearments.length > 0) {
    console.log(`  Endearments: ${features.relationshipHints.linguisticMarkers.endearments.join(', ')}`);
  }
  if (features.relationshipHints.linguisticMarkers.professionalPhrases.length > 0) {
    console.log(`  Professional Phrases: ${features.relationshipHints.linguisticMarkers.professionalPhrases.join(', ')}`);
  }
  if (features.relationshipHints.linguisticMarkers.informalLanguage.length > 0) {
    console.log(`  Informal Language: ${features.relationshipHints.linguisticMarkers.informalLanguage.join(', ')}`);
  }
  
  console.log("\n📊 Tonal Qualities:");
  console.log(`  Warmth: ${(features.tonalQualities.warmth * 100).toFixed(0)}%`);
  console.log(`  Formality: ${(features.tonalQualities.formality * 100).toFixed(0)}%`);
  console.log(`  Urgency: ${(features.tonalQualities.urgency * 100).toFixed(0)}%`);
  console.log(`  Directness: ${(features.tonalQualities.directness * 100).toFixed(0)}%`);
  console.log(`  Enthusiasm: ${(features.tonalQualities.enthusiasm * 100).toFixed(0)}%`);
  console.log(`  Politeness: ${(features.tonalQualities.politeness * 100).toFixed(0)}%`);
  
  console.log("\n✍️ Linguistic Style:");
  console.log(`  Vocabulary: ${features.linguisticStyle.vocabularyComplexity}`);
  console.log(`  Sentences: ${features.linguisticStyle.sentenceStructure}`);
  if (features.linguisticStyle.conversationalMarkers.length > 0) {
    console.log(`  Conversational Markers: ${features.linguisticStyle.conversationalMarkers.join(', ')}`);
  }
  
  console.log("\n📈 Statistics:");
  console.log(`  Words: ${features.stats.wordCount}`);
  console.log(`  Sentences: ${features.stats.sentenceCount}`);
  console.log(`  Avg Words/Sentence: ${features.stats.avgWordsPerSentence.toFixed(1)}`);
  console.log(`  Formality Score: ${(features.stats.formalityScore * 100).toFixed(0)}%`);
  console.log(`  Contraction Density: ${features.stats.contractionDensity.toFixed(1)}%`);
  
  if (features.questions.length > 0) {
    console.log(`\n❓ Questions: ${features.questions.join('; ')}`);
  }
  
  if (features.actionItems.length > 0) {
    console.log("\n📋 Action Items:");
    features.actionItems.forEach(item => {
      console.log(`  - [${item.type}] ${item.text}`);
    });
  }
  
  console.log("\n" + "=".repeat(80) + "\n");
});

// Demo specific features
console.log("🔬 Advanced Feature Demos\n");

// Demo 1: Emotion Detection
console.log("1️⃣ Emotion Detection Examples:");
const emotionExamples = [
  "I'm so grateful for your help with this project! Really appreciate it.",
  "This is frustrating! Nothing seems to be working correctly.",
  "I'm excited about the new opportunities ahead!",
  "Worried about the deadline - not sure we'll make it in time."
];

emotionExamples.forEach(text => {
  const features = extractEmailFeatures(text);
  console.log(`\n"${text}"`);
  console.log(`→ Emotions: ${features.sentiment.emotions.join(', ') || 'none detected'}`);
  console.log(`→ Primary sentiment: ${features.sentiment.primary}`);
});

// Demo 2: Formality Detection
console.log("\n\n2️⃣ Formality Level Detection:");
const formalityExamples = [
  { text: "Yo! What's up?", expected: "very informal" },
  { text: "Hey, can you send me that file?", expected: "informal" },
  { text: "Hi John, Could you please send me the document?", expected: "moderate" },
  { text: "Dear Mr. Smith, I would be grateful if you could provide the requested documentation.", expected: "formal" }
];

formalityExamples.forEach(({ text, expected }) => {
  const features = extractEmailFeatures(text);
  console.log(`\n"${text}"`);
  console.log(`→ Formality: ${(features.tonalQualities.formality * 100).toFixed(0)}% (${expected})`);
  console.log(`→ Familiarity: ${features.relationshipHints.familiarityLevel}`);
});

// Demo 3: Common Phrases
console.log("\n\n3️⃣ Phrase Extraction:");
const phraseExample = "Thanks for your email. Thanks for the update. I'll review the document and get back to you. Please let me know if you need anything else. Please let me know your thoughts.";
const features = extractEmailFeatures(phraseExample);
console.log(`Text: "${phraseExample}"`);
console.log("\nFrequent phrases:");
features.phrases.slice(0, 5).forEach(phrase => {
  console.log(`  - "${phrase.text}" (${phrase.frequency}x, context: ${phrase.context})`);
});

console.log("\n✅ Demo complete!");
console.log("\nKey improvements implemented:");
console.log("- ✨ Using wink-sentiment for accurate sentiment analysis");
console.log("- 🏷️ Using Compromise.js tags instead of hard-coded word lists");
console.log("- 🎯 Better emotion detection through word-level sentiment scores");
console.log("- 📊 More nuanced familiarity level detection");
console.log("- 🔍 Improved informal language detection with fragments, contractions, etc.");