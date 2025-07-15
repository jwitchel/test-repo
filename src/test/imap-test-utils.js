const Imap = require('imap');

class TestMailServer {
  constructor() {
    this.defaultConfig = {
      host: 'localhost',
      port: 1143,
      tls: false,
      authTimeout: 3000
    };
  }
  
  async createTestConnection(email, password) {
    return new Imap({
      ...this.defaultConfig,
      user: email,
      password: password
    });
  }
  
  async sendTestEmail(from, to, subject, body) {
    // Implementation for sending test emails via SMTP
  }
  
  async waitForEmail(imapConnection, criteria, timeout = 5000) {
    // Helper to wait for emails matching criteria
  }
  
  async createDraft(imapConnection, draftData) {
    return new Promise((resolve, reject) => {
      // Connect if not already connected
      if (imapConnection.state !== 'authenticated') {
        imapConnection.once('ready', () => {
          this._createDraftAfterConnect(imapConnection, draftData)
            .then(resolve)
            .catch(reject);
        });
        imapConnection.once('error', reject);
        imapConnection.connect();
      } else {
        this._createDraftAfterConnect(imapConnection, draftData)
          .then(resolve)
          .catch(reject);
      }
    });
  }

  async _createDraftAfterConnect(imapConnection, draftData) {
    return new Promise((resolve, reject) => {
      const { to, subject, body } = draftData;
      const messageData = 
        `To: ${to}\r\n` +
        `Subject: ${subject}\r\n` +
        `Date: ${new Date().toUTCString()}\r\n` +
        `\r\n` +
        `${body}`;

      imapConnection.append(
        messageData,
        { 
          mailbox: 'INBOX.AI-Ready',
          flags: ['\\Draft']
        },
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve({ success: true, message: 'Draft created successfully' });
          }
        }
      );
    });
  }
}

module.exports = { TestMailServer };