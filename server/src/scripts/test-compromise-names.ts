import nlp from 'compromise';
import chalk from 'chalk';

console.log(chalk.bold('Testing compromise.js name detection\n'));

const testCases = [
  "Hi Jane, how are you?",
  "Hi Jane Doe, how are you?",
  "John Smith called yesterday",
  "Meeting with Sarah at 3pm",
  "Email from Michael Johnson",
  "The package was delivered by Bob",
  "See you and Tina Smith tonight at the Mitchell's house",
  "Barack Obama visited yesterday", // Famous person
  "Mr. Anderson will join us",
  "Dr. Sarah Williams is available",
  "Contact mary@example.com about this",
  "Asked Robert about the project"
];

console.log(chalk.blue('Testing .people() method:\n'));

testCases.forEach((text, index) => {
  console.log(chalk.yellow(`Test ${index + 1}: "${text}"`));
  
  const doc = nlp(text);
  const people = doc.people();
  
  if (people.length > 0) {
    console.log(chalk.green('  Found people:'));
    people.forEach(person => {
      console.log(`    - "${person.text()}"`);
    });
  } else {
    console.log(chalk.red('  No people found'));
  }
  
  // Also check what tags compromise assigns
  const terms = doc.terms().out('tags');
  const personTags = terms.filter((term: any) => 
    term.tags && (term.tags.includes('Person') || term.tags.includes('FirstName') || term.tags.includes('LastName'))
  );
  
  if (personTags.length > 0) {
    console.log(chalk.gray('  Tagged as Person/Name:'));
    personTags.forEach((term: any) => {
      console.log(`    - "${term.text}" [${term.tags.join(', ')}]`);
    });
  }
  
  console.log('');
});

// Test with more context to see if it helps
console.log(chalk.blue('\nTesting with .match() patterns:\n'));

const patternTests = [
  "Hi Jane, how are you?",
  "Meeting with Sarah Thompson tomorrow",
  "Bob's presentation was great"
];

patternTests.forEach(text => {
  console.log(chalk.yellow(`Text: "${text}"`));
  const doc = nlp(text);
  
  // Try different patterns
  const patterns = [
    '#FirstName',
    '#LastName', 
    '#Person',
    '#ProperNoun',
    '#TitleCase'
  ];
  
  patterns.forEach(pattern => {
    const matches = doc.match(pattern);
    if (matches.length > 0) {
      console.log(`  ${pattern}: ${matches.out('array').join(', ')}`);
    }
  });
  
  console.log('');
});