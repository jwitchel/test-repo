import Imap from 'imap';
import { testEmailGenerator } from '../../lib/test-sent-emails';

interface MailServerConfig {
  user: string;
  password: string;
  host: string;
  port: number;
  tls: boolean;
}

export class TestEmailInjector {
  private config: MailServerConfig;

  constructor(config: MailServerConfig) {
    this.config = config;
  }

  /**
   * Inject test emails into the IMAP server's Sent folder
   */
  async injectTestEmails(limit?: number): Promise<void> {
    const generator = testEmailGenerator;
    const testEmails = generator.generateTestEmails();
    const emailsToInject = limit ? testEmails.slice(0, limit) : testEmails;

    console.log(`📧 Preparing to inject ${emailsToInject.length} test emails...`);

    const imap = new Imap(this.config);

    return new Promise((resolve, reject) => {
      imap.once('ready', async () => {
        try {
          // Open or create Sent folder
          await this.openSentFolder(imap);
          
          // Inject each email
          for (let i = 0; i < emailsToInject.length; i++) {
            const testEmail = emailsToInject[i];
            const rawEmail = generator.generateRawEmail(testEmail);
            
            await this.appendEmail(imap, rawEmail);
            
            process.stdout.write(`\rInjected: ${i + 1}/${emailsToInject.length}`);
          }
          
          console.log('\n✅ All test emails injected successfully!');
          
          imap.end();
          resolve();
        } catch (error) {
          imap.end();
          reject(error);
        }
      });

      imap.once('error', (err: Error) => {
        console.error('IMAP error:', err);
        reject(err);
      });

      imap.connect();
    });
  }

  /**
   * Open or create the Sent folder
   */
  private openSentFolder(imap: Imap): Promise<void> {
    return new Promise((resolve, reject) => {
      // Try common sent folder names
      const sentFolderNames = ['Sent', 'Sent Items', 'Sent Mail', 'INBOX.Sent'];
      
      imap.getBoxes((err, boxes) => {
        if (err) return reject(err);
        
        // Find existing sent folder
        let sentFolder: string | null = null;
        for (const name of sentFolderNames) {
          if (boxes[name] || boxes[`INBOX.${name}`]) {
            sentFolder = boxes[name] ? name : `INBOX.${name}`;
            break;
          }
        }
        
        if (!sentFolder) {
          // Create Sent folder
          sentFolder = 'Sent';
          imap.addBox(sentFolder, (err) => {
            if (err && !err.message.includes('already exists')) {
              return reject(err);
            }
            
            imap.openBox(sentFolder!, false, (err) => {
              if (err) return reject(err);
              resolve();
            });
          });
        } else {
          // Open existing folder
          imap.openBox(sentFolder, false, (err) => {
            if (err) return reject(err);
            resolve();
          });
        }
      });
    });
  }

  /**
   * Append an email to the current folder
   */
  private appendEmail(imap: Imap, rawEmail: string): Promise<void> {
    return new Promise((resolve, reject) => {
      imap.append(rawEmail, { flags: ['\\Seen'] }, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  /**
   * Clear all emails from the Sent folder (useful for testing)
   */
  async clearSentFolder(): Promise<void> {
    const imap = new Imap(this.config);

    return new Promise((resolve, reject) => {
      imap.once('ready', async () => {
        try {
          await this.openSentFolder(imap);
          
          // Search for all messages
          imap.search(['ALL'], (err, uids) => {
            if (err) {
              imap.end();
              return reject(err);
            }
            
            if (uids.length === 0) {
              console.log('📭 Sent folder is already empty');
              imap.end();
              return resolve();
            }
            
            // Mark all for deletion
            imap.addFlags(uids, '\\Deleted', (err) => {
              if (err) {
                imap.end();
                return reject(err);
              }
              
              // Expunge deleted messages
              imap.expunge((err) => {
                if (err) {
                  imap.end();
                  return reject(err);
                }
                
                console.log(`🗑️  Cleared ${uids.length} emails from Sent folder`);
                imap.end();
                resolve();
              });
            });
          });
        } catch (error) {
          imap.end();
          reject(error);
        }
      });

      imap.once('error', reject);
      imap.connect();
    });
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];
  
  // Default test mail server config
  const config: MailServerConfig = {
    user: process.env.TEST_EMAIL_USER || 'user1@testmail.local',
    password: process.env.TEST_EMAIL_PASSWORD || 'testpass123',
    host: process.env.TEST_EMAIL_HOST || 'localhost',
    port: parseInt(process.env.TEST_EMAIL_PORT || '1143'),
    tls: false
  };

  const injector = new TestEmailInjector(config);

  (async () => {
    try {
      if (command === 'clear') {
        console.log('🧹 Clearing Sent folder...');
        await injector.clearSentFolder();
      } else if (command === 'inject') {
        const limit = args[1] ? parseInt(args[1]) : undefined;
        await injector.injectTestEmails(limit);
      } else {
        console.log('Usage:');
        console.log('  npm run inject-test-emails inject [limit]  # Inject test emails');
        console.log('  npm run inject-test-emails clear           # Clear sent folder');
        console.log('\nEnvironment variables:');
        console.log('  TEST_EMAIL_USER     - IMAP username (default: user1@testmail.local)');
        console.log('  TEST_EMAIL_PASSWORD - IMAP password (default: testpass123)');
        console.log('  TEST_EMAIL_HOST     - IMAP host (default: localhost)');
        console.log('  TEST_EMAIL_PORT     - IMAP port (default: 1143)');
      }
    } catch (error) {
      console.error('❌ Error:', error);
      process.exit(1);
    }
  })();
}

export default TestEmailInjector;