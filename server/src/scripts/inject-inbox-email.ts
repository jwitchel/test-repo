import Imap from 'imap';

// Simple script to inject a test email into user1's INBOX
const config = {
  user: 'user1@testmail.local',
  password: 'testpass123',
  host: 'localhost',
  port: 1143,
  tls: false
};

// Create a test email
const testEmail = `From: sender@example.com
To: user1@testmail.local
Subject: Test Email with Attachments
Date: ${new Date().toUTCString()}
Message-ID: <test-${Date.now()}@example.com>
MIME-Version: 1.0
Content-Type: multipart/mixed; boundary="boundary123"

--boundary123
Content-Type: text/plain; charset=UTF-8

Hello User1!

This is a test email to verify the inbox functionality.

Here's some content:
- This email was injected for testing
- It contains multiple parts
- Including an attachment

Best regards,
Test Sender

--boundary123
Content-Type: text/html; charset=UTF-8

<html>
<body>
<h2>Hello User1!</h2>
<p>This is a test email to verify the inbox functionality.</p>
<p>Here's some content:</p>
<ul>
  <li>This email was injected for testing</li>
  <li>It contains multiple parts</li>
  <li>Including an attachment</li>
</ul>
<p>Best regards,<br>Test Sender</p>
</body>
</html>

--boundary123
Content-Type: application/pdf; name="test-document.pdf"
Content-Disposition: attachment; filename="test-document.pdf"
Content-Transfer-Encoding: base64

JVBERi0xLjQKJeLjz9MKNCAwIG9iago8PC9MZW5ndGggNSAwIFIvRmlsdGVyIC9GbGF0ZURlY29kZT4+
CnN0cmVhbQp4nK1W227bRhC9F5B/mEcDNXZmd2Z3SQEFbMVuEzdOYDtFHwqCFCXRli2aki1W227b
RhC9F5B/mEcDNXZmd2Z3SQEFbMVuEzdOYDtFHwqCFCXRli2aki1W227bRhC9F5B/mEcDNXZmd2Z3
CmVuZHN0cmVhbQplbmRvYmoKNSAwIG9iago5NgplbmRvYmoKMiAwIG9iago8PC9UeXBlIC9QYWdlL1Bh
cmVudCAzIDAgUi9SZXNvdXJjZXMgNiAwIFIvQ29udGVudHMgNCAwIFI+PgplbmRvYmoKNiAwIG9i
ago8PC9Gb250IDw8L0YxIDw8L1R5cGUgL0ZvbnQvU3VidHlwZSAvVHlwZTEvQmFzZUZvbnQgL0hl
bHZldGljYT4+Pj4+CmVuZG9iagozIDAgb2JqCjw8L1R5cGUgL1BhZ2VzL0NvdW50IDEvS2lkcyBb
MiAwIFJdPj4KZW5kb2JqCjEgMCBvYmoKPDwvVHlwZSAvQ2F0YWxvZy9QYWdlcyAzIDAgUj4+CmVu
ZG9iagp4cmVmCjAgNwowMDAwMDAwMDAwIDY1NTM1IGYKMDAwMDAwMDM4MCAwMDAwMCBuCjAwMDAw
MDAxNzcgMDAwMDAgbgowMDAwMDAwMzIzIDAwMDAwIG4KMDAwMDAwMDAxNSAwMDAwMCBuCjAwMDAw
MDAxNTggMDAwMDAgbgowMDAwMDAwMjQ1IDAwMDAwIG4KdHJhaWxlcgo8PC9TaXplIDcvUm9vdCAx
IDAgUj4+CnN0YXJ0eHJlZgo0MjcKJSVFT0YK

--boundary123--
`;

async function injectEmail() {
  const imap = new Imap(config);

  return new Promise((resolve, reject) => {
    imap.once('ready', () => {
      console.log('Connected to IMAP server');
      
      // Open INBOX
      imap.openBox('INBOX', false, (err) => {
        if (err) {
          console.error('Failed to open INBOX:', err);
          imap.end();
          return reject(err);
        }
        
        console.log('INBOX opened successfully');
        
        // Append the email to INBOX
        imap.append(testEmail, { flags: [] }, (err) => {
          if (err) {
            console.error('Failed to append email:', err);
            imap.end();
            return reject(err);
          }
          
          console.log('✅ Test email successfully injected into user1@testmail.local INBOX!');
          imap.end();
          resolve(true);
        });
      });
    });

    imap.once('error', (err: Error) => {
      console.error('IMAP connection error:', err);
      reject(err);
    });

    imap.connect();
  });
}

// Run the injection
injectEmail()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });