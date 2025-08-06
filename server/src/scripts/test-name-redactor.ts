import { nameRedactor } from '../lib/name-redactor';
import chalk from 'chalk';

console.log(chalk.bold('Testing NameRedactor Class\n'));

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
    expected: "Meeting with [title] [firstname] [lastname] and [title] [lastname] tomorrow"
  },
  {
    input: "Thanks for your help, Mike! -John",
    expected: "Thanks for your help, [firstname]! -[firstname]"
  },
  {
    input: "Please forward this to mary@example.com and Robert Smith",
    expected: "Please forward this to mary@example.com and [firstname] [lastname]"
  },
  {
    input: "Best regards,\nJohn Smith",
    expected: "Best regards,\n[firstname] [lastname]"
  },
  {
    input: "The Smiths and the Johnsons are coming",
    expected: "The Smiths and the Johnsons are coming"
  },
  {
    input: "Contact Sarah at sarah@example.com or call Bob",
    expected: "Contact [firstname] at sarah@example.com or call [firstname]"
  }
];

let passCount = 0;
let failCount = 0;

testCases.forEach((test, index) => {
  console.log(chalk.yellow(`Test ${index + 1}:`));
  console.log(chalk.gray(`Input:    "${test.input}"`));
  
  const result = nameRedactor.redactNames(test.input);
  console.log(chalk.blue(`Output:   "${result.text}"`));
  console.log(chalk.green(`Expected: "${test.expected}"`));
  
  if (result.text === test.expected) {
    console.log(chalk.green('✓ PASS'));
    passCount++;
  } else {
    console.log(chalk.red('✗ FAIL'));
    failCount++;
  }
  
  if (result.namesFound.length > 0) {
    console.log(chalk.gray(`Names found: ${result.namesFound.join(', ')}`));
  }
  console.log('');
});

console.log(chalk.bold(`\nResults: ${passCount} passed, ${failCount} failed\n`));

// Test edge cases
console.log(chalk.bold('Edge Cases:\n'));

const edgeCases = [
  "The Smith family arrived", 
  "Contact John at john@example.com",
  "Bill's and Jane's proposals",
  "Meeting at Johnson & Johnson headquarters",
  "Alexander the Great was mentioned",
  "Mary-Jane Parker called",
  "Hi there,\n\nThanks for reaching out.\n\nBest,\nMike",
  "See you at 3pm. -Sarah"
];

edgeCases.forEach(text => {
  const result = nameRedactor.redactNames(text);
  console.log(chalk.gray(`"${text}"`));
  console.log(chalk.blue(`→ "${result.text}"`));
  if (result.namesFound.length > 0) {
    console.log(chalk.gray(`  Names: ${result.namesFound.join(', ')}`));
  }
  console.log('');
});

// Test with custom names
console.log(chalk.bold('Testing Custom Names:\n'));

nameRedactor.addCustomNames(['Tina', 'Mitchell']);

const customTest = "Tina will meet us at Mitchell's office";
const customResult = nameRedactor.redactNames(customTest);
console.log(chalk.gray(`Input: "${customTest}"`));
console.log(chalk.blue(`Output: "${customResult.text}"`));
console.log(chalk.gray(`Names found: ${customResult.namesFound.join(', ')}`));