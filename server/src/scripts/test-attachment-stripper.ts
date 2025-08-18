#!/usr/bin/env npx tsx
import { EmailAttachmentStripper } from '../lib/email-attachment-stripper';

async function testAttachmentStripper() {
  console.log('🧪 Testing EmailAttachmentStripper...\n');

  // Test 1: Email with base64 attachment
  const emailWithAttachment = `From: sender@example.com
To: recipient@example.com
Subject: Test with PDF Attachment
MIME-Version: 1.0
Content-Type: multipart/mixed; boundary="boundary123"
Date: Mon, 18 Aug 2025 10:00:00 +0000

--boundary123
Content-Type: text/plain; charset=utf-8

This is the main email body text.
It contains important information.

--boundary123
Content-Type: application/pdf; name="report.pdf"
Content-Disposition: attachment; filename="report.pdf"
Content-Transfer-Encoding: base64

JVBERi0xLjQKJSDi48/TIAoxIDAgb2JqCjw8L1R5cGUgL0NhdGFsb2cgL1BhZ2VzIDIgMCBSPj4K
ZW5kb2JqCjIgMCBvYmoKPDwvVHlwZSAvUGFnZXMgL0tpZHMgWzMgMCBSXSAvQ291bnQgMT4+CmVu
ZG9iagozIDAgb2JqCjw8L1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvUmVzb3VyY2VzIDw8L0Zv
bnQgPDwvRjEgNCAwIFI+Pj4+IC9NZWRpYUJveCBbMCAwIDYxMiA3OTJdIC9Db250ZW50cyA1IDAg
Uj4+CmVuZG9iago0IDAgb2JqCjw8L1R5cGUgL0ZvbnQgL1N1YnR5cGUgL1R5cGUxIC9CYXNlRm9u
dCAvSGVsdmV0aWNhIC9FbmNvZGluZyAvV2luQW5zaUVuY29kaW5nPj4KZW5kb2JqCjUgMCBvYmoK
PDwvTGVuZ3RoIDQ0Pj4Kc3RyZWFtCkJUIC9GMSAxMiBUZiAxMDAgNzAwIFRkIChIZWxsbyBXb3Js
ZCkgVGogRVQKZW5kc3RyZWFtCmVuZG9iago=
--boundary123--`;

  // Test 2: Plain text email
  const plainEmail = `From: sender@example.com
To: recipient@example.com
Subject: Plain Text Email
Content-Type: text/plain; charset=utf-8
Date: Mon, 18 Aug 2025 10:00:00 +0000

This is just a plain text email with no attachments.
It should pass through unchanged.`;

  // Test hasAttachments
  console.log('📎 Test 1: Detecting attachments...');
  const hasAttachment1 = EmailAttachmentStripper.hasAttachments(emailWithAttachment);
  const hasAttachment2 = EmailAttachmentStripper.hasAttachments(plainEmail);
  console.log(`  Email with attachment: ${hasAttachment1 ? '✅ Detected' : '❌ Not detected'}`);
  console.log(`  Plain email: ${hasAttachment2 ? '❌ False positive' : '✅ Correctly no attachments'}`);
  console.log();

  // Test stripAttachments
  console.log('✂️ Test 2: Stripping attachments...');
  const originalSize = emailWithAttachment.length;
  console.log(`  Original email size: ${Math.round(originalSize / 1024)}KB`);
  
  const stripped = await EmailAttachmentStripper.stripAttachments(emailWithAttachment);
  const strippedSize = stripped.length;
  console.log(`  Stripped email size: ${Math.round(strippedSize / 1024)}KB`);
  
  const metrics = EmailAttachmentStripper.calculateSizeReduction(originalSize, strippedSize);
  console.log(`  Size reduction: ${metrics.reductionKB}KB (${metrics.reductionPercent}%)`);
  console.log();

  // Verify content preservation
  console.log('🔍 Test 3: Content verification...');
  console.log(`  Headers preserved: ${stripped.includes('From: sender@example.com') ? '✅' : '❌'}`);
  console.log(`  Subject preserved: ${stripped.includes('Subject: Test with PDF Attachment') ? '✅' : '❌'}`);
  console.log(`  Body text preserved: ${stripped.includes('This is the main email body text') ? '✅' : '❌'}`);
  console.log(`  Base64 removed: ${!stripped.includes('JVBERi0xLjQK') ? '✅' : '❌'}`);
  console.log(`  Attachment placeholder: ${stripped.includes('Attachment') && stripped.includes('removed') ? '✅' : '❌'}`);
  console.log();

  // Test plain email passes through
  console.log('📧 Test 4: Plain email handling...');
  const plainStripped = await EmailAttachmentStripper.stripAttachments(plainEmail);
  console.log(`  Content preserved: ${plainStripped.includes('This is just a plain text email') ? '✅' : '❌'}`);
  console.log(`  Size unchanged: ${plainEmail.length === plainStripped.length ? '✅' : '❌ ' + (plainStripped.length - plainEmail.length) + ' bytes difference'}`);
  console.log();

  // Show sample of stripped output
  console.log('📄 Sample of stripped email output:');
  console.log('─'.repeat(60));
  const lines = stripped.split('\n').slice(0, 20);
  console.log(lines.join('\n'));
  if (stripped.split('\n').length > 20) {
    console.log('... (truncated)');
  }
  console.log('─'.repeat(60));
  console.log();

  console.log('✅ All tests completed!');
}

// Run the test
testAttachmentStripper().catch(console.error);