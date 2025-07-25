#!/usr/bin/env node

import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import Imap from 'imap';

interface JohnsEmail {
  id: number;
  date: string;
  recipient_type: string;
  subject: string;
  body: string;
  tone_profile: string;
  scenario_type: string;
  length: string;
}

interface JohnsEmailFile {
  metadata: {
    file: string;
    date_range: string;
    total_emails: number;
    character: string;
    narrative_context: string;
    distribution: Record<string, number>;
  };
  emails: JohnsEmail[];
}

interface MailServerConfig {
  user: string;
  password: string;
  host: string;
  port: number;
  tls: boolean;
}

export class JohnsEmailLoader {
  private config: MailServerConfig;
  private johnsEmailsDir: string;

  constructor(config: MailServerConfig) {
    this.config = config;
    // Go up from server/src/scripts/tools to find johns_emails directory
    this.johnsEmailsDir = path.join(__dirname, '../../../../johns_emails');
  }

  /**
   * Load all Johns emails JSON files
   */
  private loadJohnsEmails(): JohnsEmail[] {
    const allEmails: JohnsEmail[] = [];
    
    // Read all john_emails_part*.json files
    for (let i = 1; i <= 10; i++) {
      const filename = `john_emails_part${i}.json`;
      const filepath = path.join(this.johnsEmailsDir, filename);
      
      if (fs.existsSync(filepath)) {
        console.log(chalk.gray(`Loading ${filename}...`));
        const data = JSON.parse(fs.readFileSync(filepath, 'utf-8')) as JohnsEmailFile;
        allEmails.push(...data.emails);
      }
    }
    
    return allEmails;
  }

  /**
   * Convert Johns email to raw email format
   */
  private generateRawEmail(email: JohnsEmail, fromEmail: string): string {
    // Map recipient types to email addresses
    const recipientMap: Record<string, string> = {
      'wife': 'lisa@example.com',
      'coworker': 'sarah@company.com',
      'friend': 'mike@example.com',
      'investor': 'jim@venturecapital.com'
    };
    
    const toEmail = recipientMap[email.recipient_type] || 'unknown@example.com';
    const messageId = `<${email.id}.${Date.now()}@testmail.local>`;
    const dateObj = new Date(email.date + 'T10:00:00Z'); // Add time to date
    
    // Build raw email
    const rawEmail = [
      `Message-ID: ${messageId}`,
      `Date: ${dateObj.toUTCString()}`,
      `From: John Mitchell <${fromEmail}>`,
      `To: ${toEmail}`,
      `Subject: ${email.subject || '(no subject)'}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: 7bit',
      '',
      email.body,
      '',
      '-- ',
      'John Mitchell',
      'CTO, TechStartup Inc.'
    ].join('\r\n');
    
    return rawEmail;
  }

  /**
   * Inject Johns emails into the IMAP server's Sent folder
   */
  async injectJohnsEmails(limit?: number): Promise<void> {
    const johnsEmails = this.loadJohnsEmails();
    const emailsToInject = limit ? johnsEmails.slice(0, limit) : johnsEmails;
    
    console.log(chalk.blue(`📧 Loaded ${johnsEmails.length} Johns emails`));
    console.log(chalk.blue(`📤 Preparing to inject ${emailsToInject.length} emails into Sent folder...`));

    const imap = new Imap(this.config);

    return new Promise((resolve, reject) => {
      imap.once('ready', async () => {
        try {
          // Open or create Sent folder
          await this.openSentFolder(imap);
          
          // Get the user's email from config
          const fromEmail = this.config.user;
          
          // Inject each email
          console.log(chalk.gray('Injecting emails...'));
          for (let i = 0; i < emailsToInject.length; i++) {
            const email = emailsToInject[i];
            const rawEmail = this.generateRawEmail(email, fromEmail);
            
            await this.appendEmail(imap, rawEmail);
            
            // Show progress
            if ((i + 1) % 10 === 0) {
              process.stdout.write(`\rInjected: ${i + 1}/${emailsToInject.length}`);
            }
          }
          
          console.log(`\n${chalk.green('✅')} All Johns emails injected successfully!`);
          console.log(chalk.gray(`\nEmails are now in the Sent folder of ${fromEmail}`));
          
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
        
        console.log(chalk.gray('Available folders:', Object.keys(boxes).join(', ')));
        
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
          console.log(chalk.gray(`Opening existing Sent folder: ${sentFolder}`));
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
   * List all folders in the mailbox
   */
  async listFolders(): Promise<void> {
    const imap = new Imap(this.config);

    return new Promise((resolve, reject) => {
      imap.once('ready', () => {
        imap.getBoxes((err, boxes) => {
          if (err) {
            imap.end();
            return reject(err);
          }
          
          console.log(chalk.blue('\n📁 Available folders:'));
          this.printBoxes(boxes, '');
          
          imap.end();
          resolve();
        });
      });

      imap.once('error', reject);
      imap.connect();
    });
  }

  private printBoxes(boxes: any, prefix: string) {
    for (const [name, box] of Object.entries(boxes)) {
      console.log(chalk.gray(`${prefix}├── ${name}`));
      if ((box as any).children) {
        this.printBoxes((box as any).children, prefix + '│   ');
      }
    }
  }

  /**
   * Clear all emails from the Sent folder
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

  const loader = new JohnsEmailLoader(config);

  (async () => {
    try {
      if (command === 'clear') {
        console.log('🧹 Clearing Sent folder...');
        await loader.clearSentFolder();
      } else if (command === 'folders') {
        console.log('📁 Listing folders...');
        await loader.listFolders();
      } else if (command === 'load' || !command) {
        const limit = args[1] ? parseInt(args[1]) : undefined;
        
        // First clear the folder
        console.log(chalk.yellow('🧹 Clearing existing emails from Sent folder...'));
        await loader.clearSentFolder();
        
        // Then load Johns emails
        await loader.injectJohnsEmails(limit);
        
        console.log(chalk.green('\n✨ Johns emails are ready for testing!'));
        console.log(chalk.gray('\nYou can now use the Training Panel in the IMAP Logs Demo'));
        console.log(chalk.gray('to load these emails into the vector database.'));
      } else {
        console.log('Usage:');
        console.log('  npx tsx load-johns-emails.ts [load] [limit]  # Load Johns emails (default)');
        console.log('  npx tsx load-johns-emails.ts clear           # Clear sent folder');
        console.log('  npx tsx load-johns-emails.ts folders         # List available folders');
        console.log('\nExamples:');
        console.log('  npx tsx load-johns-emails.ts                 # Load all 1000 emails');
        console.log('  npx tsx load-johns-emails.ts load 100        # Load first 100 emails');
        console.log('\nEnvironment variables:');
        console.log('  TEST_EMAIL_USER     - IMAP username (default: user1@testmail.local)');
        console.log('  TEST_EMAIL_PASSWORD - IMAP password (default: testpass123)');
        console.log('  TEST_EMAIL_HOST     - IMAP host (default: localhost)');
        console.log('  TEST_EMAIL_PORT     - IMAP port (default: 1143)');
      }
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error);
      process.exit(1);
    }
  })();
}

export default JohnsEmailLoader;