import Imap from 'imap';
import { EventEmitter } from 'events';
import { promisify } from 'util';
import { imapLogger } from './imap-logger';

export interface ImapConfig {
  user: string;
  password: string;
  host: string;
  port: number;
  tls?: boolean;
  tlsOptions?: {
    rejectUnauthorized?: boolean;
  };
  authTimeout?: number;
  connTimeout?: number;
  keepalive?: {
    interval?: number;
    idleInterval?: number;
    forceNoop?: boolean;
  };
}

export interface ImapMessage {
  uid: number;
  flags: string[];
  date: Date;
  headers: {
    from?: string[];
    to?: string[];
    subject?: string[];
    date?: string[];
    messageId?: string[];
  };
  body?: string;
  size?: number;
}

export interface ImapFolder {
  name: string;
  delimiter: string;
  flags: string[];
  children?: ImapFolder[];
}

export class ImapConnectionError extends Error {
  constructor(
    message: string,
    public code?: string,
    public source?: string
  ) {
    super(message);
    this.name = 'ImapConnectionError';
  }
}

export class ImapConnection extends EventEmitter {
  private imap: Imap;
  private config: ImapConfig;
  private connected = false;
  private userId: string;
  private emailAccountId: string;
  private currentBox: string | null = null;

  constructor(
    config: ImapConfig,
    userId: string,
    emailAccountId: string
  ) {
    super();
    this.config = config;
    this.userId = userId;
    this.emailAccountId = emailAccountId;

    // Configure IMAP connection
    this.imap = new Imap({
      user: config.user,
      password: config.password,
      host: config.host,
      port: config.port,
      tls: config.tls ?? (config.port === 993),
      tlsOptions: config.tlsOptions || { rejectUnauthorized: false },
      authTimeout: config.authTimeout || 10000,
      connTimeout: config.connTimeout || 10000,
      keepalive: config.keepalive || {
        interval: 10000,
        idleInterval: 300000,
        forceNoop: true
      }
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.imap.on('ready', () => {
      this.connected = true;
      this.logOperation('CONNECT', {
        response: 'Connection established',
        parsed: { host: this.config.host, port: this.config.port }
      });
      this.emit('ready');
    });

    this.imap.on('error', (err: Error) => {
      this.logOperation('ERROR', {
        error: err.message,
        parsed: { code: (err as any).code, source: (err as any).source }
      }, 'error');
      this.emit('error', err);
    });

    this.imap.on('end', () => {
      this.connected = false;
      this.currentBox = null;
      this.logOperation('DISCONNECT', {
        response: 'Connection ended'
      });
      this.emit('end');
    });

    this.imap.on('close', (hadError: boolean) => {
      this.connected = false;
      this.currentBox = null;
      this.logOperation('CLOSE', {
        response: hadError ? 'Connection closed with error' : 'Connection closed',
        parsed: { hadError }
      });
      this.emit('close', hadError);
    });
  }

  private logOperation(
    command: string,
    data: Partial<{
      raw?: string;
      parsed?: any;
      response?: string;
      error?: string;
      duration?: number;
    }>,
    level: 'debug' | 'info' | 'warn' | 'error' = 'info'
  ): void {
    imapLogger.log(this.userId, {
      userId: this.userId,
      emailAccountId: this.emailAccountId,
      level,
      command,
      data
    });
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      this.logOperation('CONNECT', {
        raw: `Connecting to ${this.config.host}:${this.config.port}`,
        parsed: {
          host: this.config.host,
          port: this.config.port,
          tls: this.config.tls
        }
      });

      const timeout = setTimeout(() => {
        this.imap.end();
        reject(new ImapConnectionError('Connection timeout', 'ETIMEDOUT'));
      }, this.config.connTimeout || 10000);

      this.imap.once('ready', () => {
        clearTimeout(timeout);
        this.logOperation('LOGIN', {
          raw: `LOGIN ${this.config.user} ****`,
          response: 'Authentication successful',
          duration: Date.now() - startTime
        });
        resolve();
      });

      this.imap.once('error', (err: Error) => {
        clearTimeout(timeout);
        reject(new ImapConnectionError(
          err.message,
          (err as any).code,
          (err as any).source
        ));
      });

      this.imap.connect();
    });
  }

  async disconnect(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.connected) {
        resolve();
        return;
      }

      this.imap.once('close', () => {
        resolve();
      });

      this.imap.end();
    });
  }

  async listFolders(): Promise<ImapFolder[]> {
    if (!this.connected) {
      throw new ImapConnectionError('Not connected', 'NOT_CONNECTED');
    }

    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      this.logOperation('LIST', {
        raw: 'LIST "" "*"'
      }, 'debug');

      this.imap.getBoxes((err: Error | null, boxes: any) => {
        if (err) {
          this.logOperation('LIST', {
            error: err.message,
            duration: Date.now() - startTime
          }, 'error');
          reject(new ImapConnectionError('Failed to list folders', 'LIST_FAILED'));
          return;
        }

        const folders = this.parseBoxes(boxes);
        
        this.logOperation('LIST', {
          response: `Found ${folders.length} folders`,
          parsed: folders.map(f => f.name),
          duration: Date.now() - startTime
        }, 'debug');

        resolve(folders);
      });
    });
  }

  private parseBoxes(boxes: any, parent?: string): ImapFolder[] {
    const folders: ImapFolder[] = [];

    for (const [name, box] of Object.entries(boxes)) {
      if (typeof box !== 'object' || !box) continue;

      const boxObj = box as any;
      const folder: ImapFolder = {
        name: parent ? `${parent}${boxObj.delimiter}${name}` : name,
        delimiter: boxObj.delimiter || '.',
        flags: boxObj.attribs || []
      };

      if (boxObj.children) {
        folder.children = this.parseBoxes(boxObj.children, folder.name);
      }

      folders.push(folder);
    }

    return folders;
  }

  async selectFolder(folderName: string): Promise<any> {
    if (!this.connected) {
      throw new ImapConnectionError('Not connected', 'NOT_CONNECTED');
    }

    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      this.logOperation('SELECT', {
        raw: `SELECT ${folderName}`
      });

      this.imap.openBox(folderName, false, (err: Error | null, box: any) => {
        if (err) {
          this.logOperation('SELECT', {
            error: err.message,
            duration: Date.now() - startTime
          }, 'error');
          reject(new ImapConnectionError(`Failed to select folder: ${err.message}`, 'SELECT_FAILED'));
          return;
        }

        this.currentBox = folderName;

        this.logOperation('SELECT', {
          response: `Selected ${folderName}`,
          parsed: {
            messages: box.messages.total,
            recent: box.messages.new,
            uidvalidity: box.uidvalidity,
            uidnext: box.uidnext
          },
          duration: Date.now() - startTime
        });

        resolve(box);
      });
    });
  }

  async search(criteria: any[]): Promise<number[]> {
    if (!this.connected || !this.currentBox) {
      throw new ImapConnectionError('Not connected or no folder selected', 'INVALID_STATE');
    }

    const searchAsync = promisify(this.imap.search.bind(this.imap));
    const startTime = Date.now();

    this.logOperation('SEARCH', {
      raw: `SEARCH ${criteria.join(' ')}`,
      parsed: { criteria }
    }, 'debug');

    try {
      const uids = await searchAsync(criteria);

      this.logOperation('SEARCH', {
        response: `Found ${uids.length} messages`,
        parsed: { count: uids.length, uids: uids.slice(0, 10) }, // Log first 10 UIDs
        duration: Date.now() - startTime
      });

      return uids;
    } catch (err: any) {
      this.logOperation('SEARCH', {
        error: err.message,
        duration: Date.now() - startTime
      }, 'error');
      throw new ImapConnectionError(`Search failed: ${err.message}`, 'SEARCH_FAILED');
    }
  }

  async fetch(uids: number | string, options: any): Promise<ImapMessage[]> {
    if (!this.connected || !this.currentBox) {
      throw new ImapConnectionError('Not connected or no folder selected', 'INVALID_STATE');
    }

    return new Promise((resolve, reject) => {
      const messages: ImapMessage[] = [];
      const startTime = Date.now();

      this.logOperation('FETCH', {
        raw: `FETCH ${uids} (${Object.keys(options).join(' ')})`,
        parsed: { uids, options }
      }, 'debug');

      const fetch = this.imap.fetch(uids, options);

      fetch.on('message', (msg: any, _seqno: number) => {
        const message: Partial<ImapMessage> = {};

        msg.on('body', (stream: any, info: any) => {
          let buffer = '';
          stream.on('data', (chunk: any) => {
            buffer += chunk.toString('utf8');
          });
          stream.on('end', () => {
            if (info.which === 'HEADER.FIELDS (FROM TO SUBJECT DATE MESSAGE-ID)') {
              const headers = Imap.parseHeader(buffer);
              message.headers = {
                from: headers.from,
                to: headers.to,
                subject: headers.subject,
                date: headers.date,
                messageId: headers['message-id']
              };
            } else {
              message.body = buffer;
            }
          });
        });

        msg.on('attributes', (attrs: any) => {
          message.uid = attrs.uid;
          message.flags = attrs.flags;
          message.date = attrs.date;
          message.size = attrs.size;
        });

        msg.on('end', () => {
          messages.push(message as ImapMessage);
        });
      });

      fetch.on('error', (err: Error) => {
        this.logOperation('FETCH', {
          error: err.message,
          duration: Date.now() - startTime
        }, 'error');
        reject(new ImapConnectionError(`Fetch failed: ${err.message}`, 'FETCH_FAILED'));
      });

      fetch.on('end', () => {
        this.logOperation('FETCH', {
          response: `Fetched ${messages.length} messages`,
          parsed: { count: messages.length },
          duration: Date.now() - startTime
        }, 'debug');
        resolve(messages);
      });
    });
  }

  async idle(): Promise<void> {
    if (!this.connected || !this.currentBox) {
      throw new ImapConnectionError('Not connected or no folder selected', 'INVALID_STATE');
    }

    this.logOperation('IDLE', {
      raw: 'IDLE',
      parsed: { folder: this.currentBox }
    }, 'debug');

    // IDLE is not in the types but is available
    (this.imap as any).idle();
  }

  stopIdle(): void {
    if (this.connected) {
      this.logOperation('IDLE', {
        response: 'DONE',
        parsed: { action: 'stopped' }
      }, 'debug');
      // IDLE stop is not in the types but is available
      (this.imap as any).idle?.stop?.();
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  getCurrentFolder(): string | null {
    return this.currentBox;
  }
}