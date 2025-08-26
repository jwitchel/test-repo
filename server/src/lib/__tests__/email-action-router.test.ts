import { EmailActionRouter } from '../email-action-router';

describe('EmailActionRouter', () => {
  describe('default configuration', () => {
    it('should use getDefaultFolders to retrieve configuration', () => {
      // The static fields are initialized when the module loads,
      // so we can't test env var changes at runtime.
      // Instead, we test that the method returns the expected structure
      const defaults = EmailActionRouter.getDefaultFolders();

      expect(defaults).toHaveProperty('rootFolder');
      expect(defaults).toHaveProperty('noActionFolder');
      expect(defaults).toHaveProperty('spamFolder');
      
      // Check that values are strings (either from env or defaults)
      expect(typeof defaults.rootFolder).toBe('string');
      expect(typeof defaults.noActionFolder).toBe('string');
      expect(typeof defaults.spamFolder).toBe('string');
    });

    it('should have sensible default values', () => {
      const defaults = EmailActionRouter.getDefaultFolders();

      // These will be either from env vars or fallback values
      // We just check they exist and make sense
      expect(defaults.noActionFolder).toBeTruthy();
      expect(defaults.spamFolder).toBeTruthy();
      // Root folder can be empty (meaning root level)
      expect(defaults.rootFolder).toBeDefined();
    });

    it('should handle empty root folder correctly', () => {
      const router = new EmailActionRouter({
        rootFolder: '',
        noActionFolder: 'AI-No-Action',
        spamFolder: 'AI-Spam'
      });

      const requiredFolders = router.getRequiredFolders();
      
      // With empty root, folders should be at root level (drafts excluded - system managed)
      expect(requiredFolders).toEqual([
        'AI-No-Action',
        'AI-Spam'
      ]);
    });

    it('should handle root folder correctly', () => {
      const router = new EmailActionRouter({
        rootFolder: 'Prescreen',
        noActionFolder: 'AI-No-Action',
        spamFolder: 'AI-Spam'
      });

      const requiredFolders = router.getRequiredFolders();
      
      // With root folder, should include root and subfolders (drafts excluded - system managed)
      expect(requiredFolders).toEqual([
        'Prescreen',
        'Prescreen/AI-No-Action',
        'Prescreen/AI-Spam'
      ]);
    });
  });

  describe('action routing', () => {
    let router: EmailActionRouter;
    const testDraftsPath = 'INBOX.Drafts';

    beforeEach(() => {
      router = new EmailActionRouter({
        rootFolder: '',
        noActionFolder: 'AI-No-Action',
        spamFolder: 'AI-Spam'
      }, testDraftsPath);
    });

    it('should route reply actions to system drafts folder', () => {
      const replyRoute = router.getActionRoute('reply');
      expect(replyRoute.folder).toBe(testDraftsPath);
      expect(replyRoute.displayName).toBe(testDraftsPath);
      expect(replyRoute.flags).toContain('\\Draft');
      expect(replyRoute.flags).not.toContain('\\Seen');  // Drafts should not be marked as Seen
    });

    it('should route reply-all actions to system drafts folder', () => {
      const replyAllRoute = router.getActionRoute('reply-all');
      expect(replyAllRoute.folder).toBe(testDraftsPath);
      expect(replyAllRoute.displayName).toBe(testDraftsPath);
    });

    it('should route forward actions to system drafts folder', () => {
      const forwardRoute = router.getActionRoute('forward');
      expect(forwardRoute.folder).toBe(testDraftsPath);
      expect(forwardRoute.displayName).toBe(testDraftsPath);
    });

    it('should throw error for draft actions when drafts path not configured', () => {
      const routerNoDrafts = new EmailActionRouter({
        rootFolder: '',
        noActionFolder: 'AI-No-Action',
        spamFolder: 'AI-Spam'
      }); // No drafts path provided

      expect(() => routerNoDrafts.getActionRoute('reply')).toThrow('Draft folder path not configured');
      expect(() => routerNoDrafts.getActionRoute('reply-all')).toThrow('Draft folder path not configured');
      expect(() => routerNoDrafts.getActionRoute('forward')).toThrow('Draft folder path not configured');
    });

    it('should route silent-fyi-only to no-action folder', () => {
      const silentRoute = router.getActionRoute('silent-fyi-only');
      expect(silentRoute.folder).toBe('AI-No-Action');
      expect(silentRoute.displayName).toBe('AI-No-Action');
      expect(silentRoute.flags).not.toContain('\\Seen');  // No-action items should not be marked as Seen
      expect(silentRoute.flags).not.toContain('\\Draft');
    });

    it('should route silent-spam to spam folder', () => {
      const spamRoute = router.getActionRoute('silent-spam');
      expect(spamRoute.folder).toBe('AI-Spam');
      expect(spamRoute.displayName).toBe('AI-Spam');
      expect(spamRoute.flags).toContain('\\Seen');
    });

    it('should throw error for unknown actions', () => {
      expect(() => router.getActionRoute('unknown-action' as any)).toThrow('Unknown action: unknown-action');
    });
  });

  describe('folder creation', () => {
    it('should check for missing folders', async () => {
      const router = new EmailActionRouter({
        rootFolder: '',
        noActionFolder: 'AI-No-Action',
        spamFolder: 'AI-Spam'
      });

      // Mock IMAP operations
      const mockImapOps = {
        getFolders: jest.fn().mockResolvedValue([
          { path: 'AI-No-Action' }
          // AI-Spam is missing
        ])
      };

      const result = await router.checkFolders(mockImapOps as any);
      
      expect(result.existing).toContain('AI-No-Action');
      expect(result.missing).toContain('AI-Spam');
    });

    it('should create missing folders', async () => {
      const router = new EmailActionRouter({
        rootFolder: '',
        noActionFolder: 'AI-No-Action',
        spamFolder: 'AI-Spam'
      });

      // Mock IMAP operations
      const mockImapOps = {
        getFolders: jest.fn().mockResolvedValue([
          { path: 'AI-No-Action' }
        ]),
        createFolder: jest.fn().mockResolvedValue(undefined)
      };

      const result = await router.createMissingFolders(mockImapOps as any);
      
      expect(result.created).toContain('AI-Spam');
      expect(mockImapOps.createFolder).toHaveBeenCalledWith('AI-Spam');
    });

    it('should handle folder creation errors', async () => {
      const router = new EmailActionRouter({
        rootFolder: '',
        noActionFolder: 'AI-No-Action',
        spamFolder: 'AI-Spam'
      });

      // Mock IMAP operations
      const mockImapOps = {
        getFolders: jest.fn().mockResolvedValue([]),
        createFolder: jest.fn()
          .mockResolvedValueOnce(undefined) // First folder succeeds
          .mockRejectedValueOnce(new Error('Permission denied')) // Second fails
      };

      const result = await router.createMissingFolders(mockImapOps as any);
      
      expect(result.created).toContain('AI-No-Action');
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0]).toEqual({
        folder: 'AI-Spam',
        error: 'Permission denied'
      });
    });
  });
});