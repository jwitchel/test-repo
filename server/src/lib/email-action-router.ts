import { ImapOperations } from './imap-operations';
import { LLMMetadata } from './llm-client';
import { FolderPreferences } from '../types/settings';

export interface ActionRouteResult {
  folder: string;
  flags: string[];
  displayName: string;
}

export class EmailActionRouter {
  // Read defaults from environment variables or use fallback values
  private static readonly DEFAULT_ROOT_FOLDER = process.env.DEFAULT_ROOT_FOLDER || '';
  private static readonly DEFAULT_DRAFTS_FOLDER = process.env.DEFAULT_DRAFTS_FOLDER || 't2j-draft';
  private static readonly DEFAULT_NO_ACTION_FOLDER = process.env.DEFAULT_NO_ACTION_FOLDER || 't2j-no-action';
  private static readonly DEFAULT_SPAM_FOLDER = process.env.DEFAULT_SPAM_FOLDER || 't2j-spam';
  
  // Public method to get default folder configuration
  static getDefaultFolders(): FolderPreferences {
    return {
      rootFolder: EmailActionRouter.DEFAULT_ROOT_FOLDER,
      draftsFolder: EmailActionRouter.DEFAULT_DRAFTS_FOLDER,
      noActionFolder: EmailActionRouter.DEFAULT_NO_ACTION_FOLDER,
      spamFolder: EmailActionRouter.DEFAULT_SPAM_FOLDER
    };
  }

  private folderPrefs: FolderPreferences;

  constructor(preferences?: Partial<FolderPreferences>) {
    this.folderPrefs = {
      rootFolder: preferences?.rootFolder !== undefined ? preferences.rootFolder : EmailActionRouter.DEFAULT_ROOT_FOLDER,
      draftsFolder: preferences?.draftsFolder || EmailActionRouter.DEFAULT_DRAFTS_FOLDER,
      noActionFolder: preferences?.noActionFolder || EmailActionRouter.DEFAULT_NO_ACTION_FOLDER,
      spamFolder: preferences?.spamFolder || EmailActionRouter.DEFAULT_SPAM_FOLDER
    };
  }

  /**
   * Determine the destination folder and flags based on the recommended action
   */
  getActionRoute(recommendedAction: LLMMetadata['recommendedAction']): ActionRouteResult {
    const rootPath = this.folderPrefs.rootFolder ? `${this.folderPrefs.rootFolder}/` : '';

    switch (recommendedAction) {
      case 'reply':
      case 'reply-all':
      case 'forward':
      case 'forward-with-comment':
        return {
          folder: `${rootPath}${this.folderPrefs.draftsFolder}`,
          flags: ['\\Draft', '\\Seen'],
          displayName: this.folderPrefs.draftsFolder
        };

      case 'silent-fyi-only':
      case 'silent-large-list':
      case 'silent-unsubscribe':
        return {
          folder: `${rootPath}${this.folderPrefs.noActionFolder}`,
          flags: ['\\Seen'],
          displayName: this.folderPrefs.noActionFolder
        };

      case 'silent-spam':
        return {
          folder: `${rootPath}${this.folderPrefs.spamFolder}`,
          flags: ['\\Seen'],
          displayName: this.folderPrefs.spamFolder
        };

      default:
        // Default to drafts for unknown actions
        return {
          folder: `${rootPath}${this.folderPrefs.draftsFolder}`,
          flags: ['\\Draft', '\\Seen'],
          displayName: this.folderPrefs.draftsFolder
        };
    }
  }

  /**
   * Get all required folders based on current preferences
   */
  getRequiredFolders(): string[] {
    const folders: string[] = [];
    const rootPath = this.folderPrefs.rootFolder;

    if (rootPath) {
      // Add root folder
      folders.push(rootPath);
      
      // Add subfolders with root path
      folders.push(`${rootPath}/${this.folderPrefs.draftsFolder}`);
      folders.push(`${rootPath}/${this.folderPrefs.noActionFolder}`);
      folders.push(`${rootPath}/${this.folderPrefs.spamFolder}`);
    } else {
      // Add folders at root level
      folders.push(this.folderPrefs.draftsFolder);
      folders.push(this.folderPrefs.noActionFolder);
      folders.push(this.folderPrefs.spamFolder);
    }

    return folders;
  }

  /**
   * Check which required folders exist and which need to be created
   */
  async checkFolders(imapOps: ImapOperations): Promise<{
    existing: string[];
    missing: string[];
  }> {
    const requiredFolders = this.getRequiredFolders();
    const existingFolders = await imapOps.getFolders();
    const existingPaths = existingFolders.map(f => f.path);

    const existing: string[] = [];
    const missing: string[] = [];

    for (const folder of requiredFolders) {
      if (existingPaths.includes(folder)) {
        existing.push(folder);
      } else {
        missing.push(folder);
      }
    }

    return { existing, missing };
  }

  /**
   * Create missing folders
   */
  async createMissingFolders(imapOps: ImapOperations): Promise<{
    created: string[];
    failed: Array<{ folder: string; error: string }>;
  }> {
    const { missing } = await this.checkFolders(imapOps);
    const created: string[] = [];
    const failed: Array<{ folder: string; error: string }> = [];

    for (const folder of missing) {
      try {
        await imapOps.createFolder(folder);
        created.push(folder);
      } catch (error) {
        failed.push({
          folder,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return { created, failed };
  }

  /**
   * Get a human-readable description of the action
   */
  getActionDescription(recommendedAction: LLMMetadata['recommendedAction']): string {
    switch (recommendedAction) {
      case 'reply':
        return 'Reply to sender';
      case 'reply-all':
        return 'Reply to all recipients';
      case 'forward':
        return 'Forward to someone';
      case 'forward-with-comment':
        return 'Forward with your comments';
      case 'silent-fyi-only':
        return 'FYI only - no action needed';
      case 'silent-large-list':
        return 'Large distribution list - silent';
      case 'silent-unsubscribe':
        return 'Unsubscribe candidate';
      case 'silent-spam':
        return 'Spam - move to spam folder';
      default:
        return 'Unknown action';
    }
  }
}