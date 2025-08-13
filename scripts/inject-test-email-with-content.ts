import { createConnection } from 'net';

const testEmail = `Date: ${new Date().toUTCString()}
From: "Jane Smith" <jane@example.com>
To: "Test User" <user1@testmail.local>
Subject: Meeting Follow-up
Message-ID: <${Date.now()}@example.com>
MIME-Version: 1.0
Content-Type: text/plain; charset=UTF-8
Content-Transfer-Encoding: 7bit

Hi there,

Thanks for the productive meeting today. I wanted to follow up on a few key points we discussed:

1. The Q4 budget projections look promising. Can we schedule a follow-up to dive deeper into the marketing allocation?

2. I'll send over the product roadmap document by EOD tomorrow.

3. Let's aim to have the partnership agreement draft ready by next Friday.

Looking forward to our next steps!

Best regards,
Jane

--
Jane Smith
Director of Business Development
Example Corp
jane@example.com
(555) 123-4567
`;

const client = createConnection({ port: 1143, host: 'localhost' });

client.on('connect', () => {
  console.log('Connected to test mail server');
  
  // Read initial greeting
  client.once('data', () => {
    // Login
    client.write('a001 LOGIN user1@testmail.local testpass123\r\n');
    
    client.once('data', (data) => {
      if (data.toString().includes('a001 OK')) {
        console.log('Login successful');
        
        // Select INBOX
        client.write('a002 SELECT INBOX\r\n');
        
        client.once('data', (data) => {
          if (data.toString().includes('a002 OK')) {
            console.log('INBOX selected');
            
            // Append the message
            const emailSize = Buffer.byteLength(testEmail);
            client.write(`a003 APPEND INBOX {${emailSize}}\r\n`);
            
            client.once('data', (data) => {
              if (data.toString().includes('+')) {
                console.log('Server ready for message');
                client.write(testEmail + '\r\n');
                
                client.once('data', (data) => {
                  if (data.toString().includes('a003 OK')) {
                    console.log('Email injected successfully!');
                    
                    // Logout
                    client.write('a004 LOGOUT\r\n');
                    
                    client.once('data', () => {
                      console.log('Logged out');
                      client.end();
                    });
                  } else {
                    console.error('Failed to append message:', data.toString());
                    client.end();
                  }
                });
              }
            });
          }
        });
      } else {
        console.error('Login failed:', data.toString());
        client.end();
      }
    });
  });
});

client.on('error', (err) => {
  console.error('Connection error:', err);
});

client.on('end', () => {
  console.log('Connection closed');
});