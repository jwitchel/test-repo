import nlp from 'compromise';
import chalk from 'chalk';

function redactNames(text: string): string {
  let doc = nlp(text);
  
  // First, handle possessives separately to preserve them
  const possessivePattern = doc.match('#Person+').if('#Possessive');
  const possessiveNames: string[] = [];
  
  possessivePattern.forEach(match => {
    const original = match.text();
    possessiveNames.push(original);
  });
  
  // Now handle all people
  doc.people().forEach(person => {
    const personText = person.text();
    const names = personText.split(' ');
    
    // Check if this is a possessive we already found
    const isPossessive = possessiveNames.some(poss => poss.startsWith(personText));
    
    if (isPossessive) {
      // Handle possessive forms
      if (names.length === 1) {
        person.replaceWith("[firstname]'s");
      } else {
        person.replaceWith("[lastname]'s");
      }
    } else {
      // Regular name replacement
      if (names.length === 1) {
        person.replaceWith('[firstname]');
      } else if (names.length === 2) {
        person.replaceWith('[firstname] [lastname]');
      } else {
        // Handle titles and complex names
        if (names[0].match(/^(Mr|Mrs|Ms|Dr|Prof)\.?$/i)) {
          person.replaceWith('[title] [firstname] [lastname]');
        } else {
          person.replaceWith('[fullname]');
        }
      }
    }
  });
  
  return doc.text();
}

console.log(chalk.bold('Testing Name Redaction Function\n'));

const testCases = [
  {
    input: "Hi John, see you and Tina Smith tonight at the Mitchell's house",
    expected: "Hi [firstname], see you and [firstname] [lastname] tonight at the [lastname]'s house"
  },
  {
    input: "Jane Doe sent an email to Bob about Sarah's project",
    expected: "[firstname] [lastname] sent an email to [firstname] about [firstname]'s project"
  },
  {
    input: "Meeting with Dr. Sarah Williams and Mr. Anderson tomorrow",
    expected: "Meeting with [title] [firstname] [lastname] and [title] [firstname] [lastname] tomorrow"
  },
  {
    input: "Thanks for your help, Mike! -John",
    expected: "Thanks for your help, [firstname]! -[firstname]"
  },
  {
    input: "Please forward this to mary@example.com and Robert Smith",
    expected: "Please forward this to mary@example.com and [firstname] [lastname]"
  }
];

testCases.forEach((test, index) => {
  console.log(chalk.yellow(`Test ${index + 1}:`));
  console.log(chalk.gray(`Input:    "${test.input}"`));
  
  const result = redactNames(test.input);
  console.log(chalk.blue(`Output:   "${result}"`));
  console.log(chalk.green(`Expected: "${test.expected}"`));
  
  if (result === test.expected) {
    console.log(chalk.green('✓ PASS'));
  } else {
    console.log(chalk.red('✗ FAIL'));
  }
  console.log('');
});

// Test edge cases
console.log(chalk.bold('\nEdge Cases:\n'));

const edgeCases = [
  "The Smith family arrived", 
  "Contact John at john@example.com",
  "Bill's and Jane's proposals",
  "Meeting at Johnson & Johnson headquarters",
  "Alexander the Great was mentioned",
  "Mary-Jane Parker called"
];

edgeCases.forEach(text => {
  console.log(chalk.gray(`"${text}" → "${redactNames(text)}"`));
});