import { imapLogger, ImapLogger } from './imap-logger';
import { emailProcessor, ProcessingContext } from './email-processor';
import { testEmailGenerator } from './test-sent-emails';

interface MockImapOperation {
  name: string;
  duration: number;
  command: string;
  raw?: string;
  response?: string;
  error?: string;
  level?: 'debug' | 'info' | 'warn' | 'error';
}

const MOCK_OPERATIONS: MockImapOperation[] = [
  {
    name: 'Connect',
    duration: 250,
    command: 'CONNECT',
    raw: '* OK [CAPABILITY IMAP4rev1 LITERAL+ SASL-IR LOGIN-REFERRALS ID ENABLE IDLE STARTTLS AUTH=PLAIN] Dovecot ready.',
    response: 'Connected to testmail.local:1143',
    level: 'info'
  },
  {
    name: 'Login',
    duration: 150,
    command: 'LOGIN',
    raw: 'A001 LOGIN user1@testmail.local testpass123',
    response: 'A001 OK [CAPABILITY IMAP4rev1 LITERAL+ SASL-IR LOGIN-REFERRALS ID ENABLE IDLE SORT SORT=DISPLAY THREAD=REFERENCES THREAD=REFS THREAD=ORDEREDSUBJECT MULTIAPPEND UNSELECT CHILDREN NAMESPACE UIDPLUS LIST-EXTENDED I18NLEVEL=1 CONDSTORE QRESYNC ESEARCH ESORT SEARCHRES WITHIN CONTEXT=SEARCH LIST-STATUS SPECIAL-USE] Logged in',
    level: 'info'
  },
  {
    name: 'List Folders',
    duration: 100,
    command: 'LIST',
    raw: 'A002 LIST "" "*"',
    response: '* LIST (\\HasNoChildren) "." INBOX\n* LIST (\\HasNoChildren) "." Sent\n* LIST (\\HasNoChildren) "." Drafts\n* LIST (\\HasNoChildren) "." Trash\nA002 OK List completed.',
    level: 'debug'
  },
  {
    name: 'Select INBOX',
    duration: 120,
    command: 'SELECT',
    raw: 'A003 SELECT INBOX',
    response: '* FLAGS (\\Answered \\Flagged \\Deleted \\Seen \\Draft)\n* 47 EXISTS\n* 0 RECENT\n* OK [UIDVALIDITY 1234567890] UIDs valid\n* OK [UIDNEXT 48] Predicted next UID\nA003 OK [READ-WRITE] Select completed.',
    level: 'info'
  },
  {
    name: 'Fetch Recent Messages',
    duration: 300,
    command: 'FETCH',
    raw: 'A004 FETCH 40:47 (FLAGS INTERNALDATE RFC822.SIZE ENVELOPE)',
    response: '* 40 FETCH (FLAGS (\\Seen) INTERNALDATE "01-Jan-2025 10:00:00 +0000" RFC822.SIZE 2048 ENVELOPE ("Wed, 1 Jan 2025 10:00:00 +0000" "Meeting Reminder" (("John Doe" NIL "john" "example.com")) NIL NIL (("user1" NIL "user1" "testmail.local")) NIL NIL NIL "<msg40@example.com>"))\n[... 7 more messages ...]\nA004 OK Fetch completed.',
    level: 'debug'
  },
  {
    name: 'Search Unseen',
    duration: 80,
    command: 'SEARCH',
    raw: 'A005 SEARCH UNSEEN',
    response: '* SEARCH 42 45 47\nA005 OK Search completed (3 msgs).',
    level: 'info'
  },
  {
    name: 'Fetch Message Body',
    duration: 200,
    command: 'FETCH',
    raw: 'A006 FETCH 47 BODY[]',
    response: '* 47 FETCH (BODY[] {1523}\nFrom: sender@example.com\nTo: user1@testmail.local\nSubject: Project Update\nDate: Wed, 1 Jan 2025 15:30:00 +0000\n\n[MESSAGE CONTENT REDACTED]\n)\nA006 OK Fetch completed.',
    level: 'debug'
  },
  {
    name: 'Mark as Read',
    duration: 50,
    command: 'STORE',
    raw: 'A007 STORE 47 +FLAGS (\\Seen)',
    response: '* 47 FETCH (FLAGS (\\Seen))\nA007 OK Store completed.',
    level: 'info'
  },
  {
    name: 'Idle',
    duration: 5000,
    command: 'IDLE',
    raw: 'A008 IDLE',
    response: '+ idling\n* 48 EXISTS\n* 1 RECENT\nDONE\nA008 OK Idle completed.',
    level: 'debug'
  },
  {
    name: 'Connection Error',
    duration: 100,
    command: 'NOOP',
    raw: 'A009 NOOP',
    error: 'Connection reset by peer',
    level: 'error'
  },
  {
    name: 'Authentication Failed',
    duration: 150,
    command: 'LOGIN',
    raw: 'A010 LOGIN baduser@testmail.local wrongpassword',
    error: 'A010 NO [AUTHENTICATIONFAILED] Authentication failed.',
    level: 'error'
  },
  {
    name: 'Timeout',
    duration: 30000,
    command: 'FETCH',
    raw: 'A011 FETCH 1:* (FLAGS)',
    error: 'Operation timed out',
    level: 'warn'
  }
];

export class MockImapClient {
  private userId: string;
  private emailAccountId: string;
  private operationIndex = 0;
  private isRunning = false;
  private operationTimer?: NodeJS.Timeout;
  private logger: ImapLogger;
  private currentIntervalResolve?: () => void;

  constructor(userId: string, emailAccountId: string, logger?: ImapLogger) {
    this.userId = userId;
    this.emailAccountId = emailAccountId;
    this.logger = logger || imapLogger;
  }

  async runOperation(operation: MockImapOperation): Promise<void> {
    const startTime = Date.now();

    // Log the command
    this.logger.log(this.userId, {
      userId: this.userId,
      emailAccountId: this.emailAccountId,
      level: operation.level || 'debug',
      command: operation.command,
      data: {
        raw: operation.raw,
        parsed: {
          operation: operation.name,
          command: operation.command
        }
      }
    });

    // Simulate operation duration
    await new Promise(resolve => setTimeout(resolve, operation.duration));

    // Log the response or error
    if (operation.error) {
      this.logger.log(this.userId, {
        userId: this.userId,
        emailAccountId: this.emailAccountId,
        level: 'error',
        command: operation.command,
        data: {
          error: operation.error,
          duration: Date.now() - startTime
        }
      });
    } else if (operation.response) {
      this.logger.log(this.userId, {
        userId: this.userId,
        emailAccountId: this.emailAccountId,
        level: operation.level || 'debug',
        command: operation.command,
        data: {
          response: operation.response,
          duration: Date.now() - startTime
        }
      });
    }
  }

  async runSequence(operations?: MockImapOperation[]): Promise<void> {
    const ops = operations || MOCK_OPERATIONS;
    
    for (const operation of ops) {
      await this.runOperation(operation);
      
      // Add small delay between operations
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  async runContinuously(intervalMs = 2000): Promise<void> {
    this.isRunning = true;
    
    while (this.isRunning) {
      const operation = MOCK_OPERATIONS[this.operationIndex % MOCK_OPERATIONS.length];
      await this.runOperation(operation);
      
      this.operationIndex++;
      
      // Wait before next operation, but break if stopped
      if (!this.isRunning) break;
      
      await new Promise<void>((resolve) => {
        this.currentIntervalResolve = resolve;
        this.operationTimer = setTimeout(() => {
          this.currentIntervalResolve = undefined;
          resolve();
        }, intervalMs);
      });
    }
  }

  stop(): void {
    this.isRunning = false;
    if (this.operationTimer) {
      clearTimeout(this.operationTimer);
      this.operationTimer = undefined;
    }
    if (this.currentIntervalResolve) {
      this.currentIntervalResolve();
      this.currentIntervalResolve = undefined;
    }
  }

  // Simulate specific scenarios
  async simulateNewEmailNotification(): Promise<void> {
    await this.runOperation({
      name: 'New Email Notification',
      duration: 50,
      command: 'IDLE',
      raw: '* 49 EXISTS\n* 1 RECENT',
      response: 'New email received',
      level: 'info'
    });
  }

  async simulateConnectionLoss(): Promise<void> {
    await this.runOperation({
      name: 'Connection Lost',
      duration: 0,
      command: 'NOOP',
      error: 'Connection reset by peer',
      level: 'error'
    });
  }

  async simulateSyncFolder(folderName: string, messageCount: number): Promise<void> {
    await this.runOperation({
      name: `Select ${folderName}`,
      duration: 100,
      command: 'SELECT',
      raw: `A020 SELECT ${folderName}`,
      response: `* ${messageCount} EXISTS\n* 0 RECENT\nA020 OK [READ-WRITE] Select completed.`,
      level: 'info'
    });

    await this.runOperation({
      name: `Sync ${folderName}`,
      duration: 300,
      command: 'FETCH',
      raw: `A021 FETCH 1:${messageCount} (FLAGS UID)`,
      response: `[Synced ${messageCount} messages]\nA021 OK Fetch completed.`,
      level: 'info'
    });
  }

  // Simulate processing a sent email
  async simulateEmailProcessing(): Promise<void> {
    // Get a random test email
    const testEmails = testEmailGenerator.generateTestEmails();
    const randomEmail = testEmails[Math.floor(Math.random() * testEmails.length)];
    
    // Simulate fetching the email
    await this.runOperation({
      name: 'Fetch Sent Email',
      duration: 200,
      command: 'FETCH',
      raw: `A030 FETCH ${Math.floor(Math.random() * 100) + 1} BODY[]`,
      response: `* FETCH (BODY[] {${randomEmail.textContent.length}}\n[EMAIL CONTENT]\n)\nA030 OK Fetch completed.`,
      level: 'info'
    });
    
    // Process the email
    const context: ProcessingContext = {
      userId: this.userId,
      emailAccountId: this.emailAccountId
    };
    
    const parsedMail = testEmailGenerator.convertToParsedMail(randomEmail);
    const processed = emailProcessor.processEmail(parsedMail as any, context);
    
    // Log the processing result
    imapLogger.log(this.userId, {
      userId: this.userId,
      emailAccountId: this.emailAccountId,
      level: 'info',
      command: 'EMAIL_PROCESS_DEMO',
      data: {
        parsed: {
          emailId: randomEmail.id,
          category: randomEmail.category,
          subject: randomEmail.subject,
          originalLength: processed.originalPlainLength,
          extractedLength: processed.userTextPlain.length,
          extractedText: processed.userTextPlain,
          expectedText: randomEmail.expectedExtraction,
          reductionPercentage: processed.originalPlainLength > 0
            ? Math.round((1 - processed.userTextPlain.length / processed.originalPlainLength) * 100)
            : 0,
          isCorrect: processed.userTextPlain === randomEmail.expectedExtraction
        }
      }
    });
  }
}

// Export some pre-configured sequences for testing
export const TEST_SEQUENCES = {
  basic: [
    MOCK_OPERATIONS[0], // Connect
    MOCK_OPERATIONS[1], // Login
    MOCK_OPERATIONS[3], // Select INBOX
    MOCK_OPERATIONS[5], // Search Unseen
  ],
  
  fullSync: [
    MOCK_OPERATIONS[0], // Connect
    MOCK_OPERATIONS[1], // Login
    MOCK_OPERATIONS[2], // List Folders
    MOCK_OPERATIONS[3], // Select INBOX
    MOCK_OPERATIONS[4], // Fetch Recent
    MOCK_OPERATIONS[5], // Search Unseen
    MOCK_OPERATIONS[6], // Fetch Message Body
    MOCK_OPERATIONS[7], // Mark as Read
  ],
  
  errors: [
    MOCK_OPERATIONS[10], // Auth Failed
    MOCK_OPERATIONS[0],  // Connect
    MOCK_OPERATIONS[1],  // Login
    MOCK_OPERATIONS[9],  // Connection Error
  ],
  
  monitoring: [
    MOCK_OPERATIONS[0], // Connect
    MOCK_OPERATIONS[1], // Login
    MOCK_OPERATIONS[3], // Select INBOX
    MOCK_OPERATIONS[8], // Idle
  ]
};