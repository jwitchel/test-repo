#!/usr/bin/env node

import Imap from 'imap';
import chalk from 'chalk';

const config = {
  user: 'user1@testmail.local',
  password: 'testpass123',
  host: 'localhost',
  port: 1143,
  tls: false,
  authTimeout: 3000
};

async function testImapDirectly() {
  console.log(chalk.blue('🔍 Testing IMAP directly...\n'));
  
  const imap = new Imap(config);
  
  return new Promise((resolve, reject) => {
    imap.once('ready', () => {
      console.log(chalk.green('✓ Connected to IMAP server'));
      
      imap.openBox('Sent', true, (err, box) => {
        if (err) {
          console.error(chalk.red('✗ Error opening Sent folder:'), err);
          imap.end();
          return reject(err);
        }
        
        console.log(chalk.gray(`Sent folder has ${box.messages.total} messages`));
        
        // Search ALL messages
        imap.search(['ALL'], (err, uids) => {
          if (err) {
            console.error(chalk.red('✗ Error searching ALL:'), err);
            imap.end();
            return reject(err);
          }
          
          console.log(chalk.green(`✓ Search ALL returned ${uids.length} UIDs`));
          if (uids.length > 0) {
            console.log(chalk.gray(`  First 5 UIDs: ${uids.slice(0, 5).join(', ')}`));
            console.log(chalk.gray(`  Last 5 UIDs: ${uids.slice(-5).join(', ')}`));
          }
          
          // Now search with BEFORE criteria
          const beforeDate = new Date('2025-07-26');
          console.log(chalk.yellow(`\nSearching BEFORE ${beforeDate.toISOString()}`));
          
          imap.search([['BEFORE', beforeDate]], (err, uids) => {
            if (err) {
              console.error(chalk.red('✗ Error searching BEFORE:'), err);
              imap.end();
              return reject(err);
            }
            
            console.log(chalk.green(`✓ Search BEFORE returned ${uids.length} UIDs`));
            if (uids.length > 0) {
              console.log(chalk.gray(`  First 5 UIDs: ${uids.slice(0, 5).join(', ')}`));
            }
            
            // Fetch a sample message
            if (uids.length > 0) {
              const fetch = imap.fetch(uids[0], {
                bodies: 'HEADER.FIELDS (FROM TO SUBJECT DATE)',
                struct: true
              });
              
              fetch.on('message', (msg) => {
                msg.on('body', (stream, _info) => {
                  let buffer = '';
                  stream.on('data', (chunk) => {
                    buffer += chunk.toString('utf8');
                  });
                  stream.once('end', () => {
                    console.log(chalk.yellow('\nSample message header:'));
                    console.log(chalk.gray(buffer));
                  });
                });
              });
              
              fetch.once('end', () => {
                imap.end();
                console.log(chalk.blue('\n✅ Test completed'));
                resolve(undefined);
              });
            } else {
              imap.end();
              resolve(undefined);
            }
          });
        });
      });
    });
    
    imap.once('error', (err: any) => {
      console.error(chalk.red('IMAP connection error:'), err);
      reject(err);
    });
    
    imap.connect();
  });
}

// Run if executed directly
if (require.main === module) {
  testImapDirectly().catch(console.error);
}