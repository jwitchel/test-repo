import { RegexSignatureDetector } from '../lib/regex-signature-detector';
import { pool } from '../server';

// Test email with John's signature
const testEmail = `Hi there,

Thanks for reaching out. I'll get back to you soon about the project.

Best,
John

—————
Cell: 970-759-1403
Calendar: https://john-witchel.ycbm.com/`;

// Test user ID (you can replace with actual user ID)
const testUserId = 'test-user';

const regexSignatureDetector = new RegexSignatureDetector(pool);

async function testRegexSignatureDetection() {
  console.log('=== Testing Regex-based Signature Detection ===\n');
  
  console.log('Test email:');
  console.log('---START---');
  console.log(testEmail);
  console.log('---END---\n');
  
  // Test 1: Use default patterns
  console.log('1. Testing with default patterns:');
  const defaultResult = await regexSignatureDetector.removeSignature(testEmail, testUserId);
  console.log('Matched pattern:', defaultResult.matchedPattern);
  console.log('Cleaned text:');
  console.log('---START---');
  console.log(defaultResult.cleanedText);
  console.log('---END---');
  console.log('Detected signature:');
  console.log('---START---');
  console.log(defaultResult.signature);
  console.log('---END---\n');
  
  // Test 2: Set custom patterns that match John's signature exactly
  console.log('2. Testing with custom patterns:');
  const customPatterns = [
    '^—+\\s*$',  // Matches the em-dash line
    '^Cell:\\s*970-759-1403$',  // Matches John's exact phone
    '^Calendar:\\s*https://john-witchel\\.ycbm\\.com/$'  // Matches John's calendar
  ];
  
  await regexSignatureDetector.saveUserPatterns(testUserId, customPatterns);
  
  const customResult = await regexSignatureDetector.removeSignature(testEmail, testUserId);
  console.log('Matched pattern:', customResult.matchedPattern);
  console.log('Cleaned text:');
  console.log('---START---');
  console.log(customResult.cleanedText);
  console.log('---END---');
  console.log('Detected signature:');
  console.log('---START---');
  console.log(customResult.signature);
  console.log('---END---\n');
  
  
  // Clean up test user patterns
  await regexSignatureDetector.saveUserPatterns(testUserId, []);
}

// Run the test
testRegexSignatureDetection().catch(console.error);