import { AsyncLocalStorage } from 'async_hooks';
import { imapPool } from './imap-pool';
import type { ImapConnection } from './imap-connection';

interface ImapContextStore {
  userId: string;
  accountId: string;
  connection?: ImapConnection;
  depth: number;
}

const storage = new AsyncLocalStorage<ImapContextStore>();

export function getActiveContext(): ImapContextStore | undefined {
  return storage.getStore();
}

export function hasActiveContextFor(userId: string, accountId: string): boolean {
  const store = storage.getStore();
  return !!store && store.userId === userId && store.accountId === accountId;
}

export function setContextConnection(conn: ImapConnection): void {
  const store = storage.getStore();
  if (store) {
    store.connection = conn;
  }
}

function releaseContextConnection(store: ImapContextStore): void {
  if (store.connection) {
    try {
      imapPool.releaseConnection(store.connection, store.userId, store.accountId);
    } catch {
      // ignore release errors
    } finally {
      store.connection = undefined;
    }
  }
}

/**
 * Runs fn within an IMAP context that guarantees a single connection per (userId, accountId)
 * - Idempotent: nested calls share the same context and connection
 * - Guaranteed release on outermost scope exit (success or error)
 */
export async function withImapContext<T>(accountId: string, userId: string, fn: () => Promise<T>): Promise<T> {
  const existing = storage.getStore();
  if (existing && existing.userId === userId && existing.accountId === accountId) {
    // Nested context for same account: increase depth
    existing.depth++;
    try {
      return await fn();
    } finally {
      existing.depth--;
      if (existing.depth === 0) {
        releaseContextConnection(existing);
      }
    }
  }

  // Start a new context for this (userId, accountId)
  const store: ImapContextStore = { userId, accountId, depth: 1 };
  return await storage.run(store, async () => {
    try {
      return await fn();
    } finally {
      const s = storage.getStore();
      if (s) {
        releaseContextConnection(s);
      }
    }
  });
}

