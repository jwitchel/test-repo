// Test script to verify draft upload functionality
const { ImapConnection } = require('../server/dist/lib/imap-connection');

async function testDraftUpload() {
  console.log('Testing draft upload functionality...\n');
  
  const config = {
    user: 'user1@testmail.local',
    password: 'testpass123',
    host: 'localhost',
    port: 1143,
    tls: false
  };
  
  const conn = new ImapConnection(config);
  
  try {
    // Connect to IMAP
    console.log('1. Connecting to IMAP server...');
    await conn.connect();
    console.log('✓ Connected successfully\n');
    
    // List folders
    console.log('2. Listing folders...');
    const folders = await conn.listFolders();
    console.log('Available folders:');
    folders.forEach(folder => {
      console.log(`  - ${folder.name} (${folder.flags.join(', ')})`);
    });
    
    // Check if Drafts folder exists
    const draftFolder = folders.find(f => 
      f.name.toLowerCase().includes('draft') || 
      f.name.toLowerCase() === 'drafts'
    );
    
    if (draftFolder) {
      console.log(`\n✓ Found draft folder: ${draftFolder.name}`);
    } else {
      console.log('\n✗ No draft folder found. Will use INBOX for testing.');
    }
    
    // Create a test email
    const testEmail = [
      'From: user1@testmail.local',
      'To: user2@testmail.local',
      'Subject: Test Draft from Inspector',
      'Date: ' + new Date().toUTCString(),
      'Message-ID: <test-' + Date.now() + '@testmail.local>',
      'Content-Type: text/plain; charset=utf-8',
      '',
      'This is a test draft email uploaded from the AI Email Assistant Inspector.',
      '',
      'This email was created to verify that the draft upload functionality works correctly.',
      '',
      'Best regards,',
      'Test User'
    ].join('\\r\\n');
    
    // Upload to draft folder or INBOX
    const targetFolder = draftFolder ? draftFolder.name : 'INBOX';
    console.log(`\\n3. Uploading test email to ${targetFolder}...`);
    
    await conn.append(testEmail, {
      mailbox: targetFolder,
      flags: ['\\Draft']
    });
    
    console.log('✓ Email uploaded successfully!\n');
    
    // Select the folder and check message count
    console.log('4. Verifying upload...');
    const boxInfo = await conn.selectFolder(targetFolder);
    console.log(`Folder ${targetFolder} contains ${boxInfo.messages.total} messages`);
    
    console.log('\n✅ Draft upload test completed successfully!');
    console.log('You can now test the feature in the Inspector UI.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await conn.disconnect();
  }
}

testDraftUpload();