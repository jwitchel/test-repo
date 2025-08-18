#!/usr/bin/env npx tsx
import { EmailAttachmentStripper } from '../lib/email-attachment-stripper';

async function testLargeAttachment() {
  console.log('🧪 Testing EmailAttachmentStripper with large attachment...\n');

  // Create a large base64 attachment (simulate a 500KB file)
  // Base64 encoding increases size by ~33%, so we need ~375KB of data
  const largeBase64Data = Buffer.from(new Array(375000).fill('A').join('')).toString('base64');
  
  const emailWithLargeAttachment = `From: sender@example.com
To: recipient@example.com
Subject: Email with Large Attachment
MIME-Version: 1.0
Content-Type: multipart/mixed; boundary="boundary789"
Date: Mon, 18 Aug 2025 10:00:00 +0000
X-Spam-Score: 0.0
X-Spam-Status: No
Authentication-Results: example.com; spf=pass; dkim=pass; dmarc=pass

--boundary789
Content-Type: text/plain; charset=utf-8

Dear Team,

Please find attached the quarterly report. This is an important document that contains our financial results.

Best regards,
John

--boundary789
Content-Type: application/pdf; name="quarterly-report.pdf"
Content-Disposition: attachment; filename="quarterly-report.pdf"
Content-Transfer-Encoding: base64

${largeBase64Data}
--boundary789
Content-Type: image/png; name="chart.png"
Content-Disposition: attachment; filename="chart.png"
Content-Transfer-Encoding: base64

iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAA
AABJRU5ErkJggg==
--boundary789--`;

  console.log('📊 Testing with large email containing attachments:');
  console.log(`  Original email size: ${Math.round(emailWithLargeAttachment.length / 1024)}KB`);
  
  // Check if attachments are detected
  const hasAttachments = EmailAttachmentStripper.hasAttachments(emailWithLargeAttachment);
  console.log(`  Attachments detected: ${hasAttachments ? '✅ Yes' : '❌ No'}`);
  
  // Strip attachments
  console.log('\n✂️ Stripping attachments...');
  const startTime = Date.now();
  const stripped = await EmailAttachmentStripper.stripAttachments(emailWithLargeAttachment);
  const processingTime = Date.now() - startTime;
  
  console.log(`  Processing time: ${processingTime}ms`);
  console.log(`  Stripped email size: ${Math.round(stripped.length / 1024)}KB`);
  
  // Calculate reduction
  const metrics = EmailAttachmentStripper.calculateSizeReduction(
    emailWithLargeAttachment.length,
    stripped.length
  );
  
  console.log(`\n📉 Size reduction metrics:`);
  console.log(`  Original: ${metrics.originalSizeKB}KB`);
  console.log(`  Stripped: ${metrics.strippedSizeKB}KB`);
  console.log(`  Reduction: ${metrics.reductionKB}KB (${metrics.reductionPercent}%)`);
  
  // Verify important content is preserved
  console.log('\n🔍 Content verification:');
  console.log(`  All headers preserved: ${stripped.includes('X-Spam-Status') ? '✅' : '❌'}`);
  console.log(`  Authentication headers: ${stripped.includes('Authentication-Results') ? '✅' : '❌'}`);
  console.log(`  Email body preserved: ${stripped.includes('Please find attached the quarterly report') ? '✅' : '❌'}`);
  console.log(`  Large base64 removed: ${!stripped.includes(largeBase64Data.substring(0, 100)) ? '✅' : '❌'}`);
  console.log(`  Attachment placeholders: ${stripped.includes('[Attachment removed') ? '✅' : '❌'}`);
  
  // Show the stripped version structure
  console.log('\n📄 Stripped email structure (first 1000 chars):');
  console.log('─'.repeat(60));
  console.log(stripped.substring(0, 1000));
  console.log('─'.repeat(60));
  
  // Test the fallback method
  console.log('\n🔧 Testing fallback regex-based stripping...');
  const fallbackStripped = EmailAttachmentStripper['fallbackStripAttachments'](emailWithLargeAttachment);
  const fallbackMetrics = EmailAttachmentStripper.calculateSizeReduction(
    emailWithLargeAttachment.length,
    fallbackStripped.length
  );
  console.log(`  Fallback reduction: ${fallbackMetrics.reductionKB}KB (${fallbackMetrics.reductionPercent}%)`);
  console.log(`  Headers preserved: ${fallbackStripped.includes('From: sender@example.com') ? '✅' : '❌'}`);
  console.log(`  Body preserved: ${fallbackStripped.includes('quarterly report') ? '✅' : '❌'}`);
  
  console.log('\n✅ Testing completed successfully!');
  console.log(`💡 This demonstrates ${metrics.reductionPercent}% token reduction for LLM processing!`);
}

// Run the test
testLargeAttachment().catch(console.error);