import { EmailActionRouter } from '../email-action-router';

describe('EmailActionRouter', () => {
  describe('default configuration', () => {
    it('should use getDefaultFolders to retrieve configuration', () => {
      // The static fields are initialized when the module loads,
      // so we can't test env var changes at runtime.
      // Instead, we test that the method returns the expected structure
      const defaults = EmailActionRouter.getDefaultFolders();

      expect(defaults).toHaveProperty('rootFolder');
      expect(defaults).toHaveProperty('draftsFolder');
      expect(defaults).toHaveProperty('noActionFolder');
      expect(defaults).toHaveProperty('spamFolder');
      
      // Check that values are strings (either from env or defaults)
      expect(typeof defaults.rootFolder).toBe('string');
      expect(typeof defaults.draftsFolder).toBe('string');
      expect(typeof defaults.noActionFolder).toBe('string');
      expect(typeof defaults.spamFolder).toBe('string');
    });

    it('should have sensible default values', () => {
      const defaults = EmailActionRouter.getDefaultFolders();

      // These will be either from env vars or fallback values
      // We just check they exist and make sense
      expect(defaults.draftsFolder).toBeTruthy();
      expect(defaults.noActionFolder).toBeTruthy();
      expect(defaults.spamFolder).toBeTruthy();
      // Root folder can be empty (meaning root level)
      expect(defaults.rootFolder).toBeDefined();
    });

    it('should handle empty root folder correctly', () => {
      const router = new EmailActionRouter({
        rootFolder: '',
        draftsFolder: 't2j-draft',
        noActionFolder: 't2j-no-action',
        spamFolder: 't2j-spam'
      });

      const requiredFolders = router.getRequiredFolders();
      
      // With empty root, folders should be at root level
      expect(requiredFolders).toEqual([
        't2j-draft',
        't2j-no-action',
        't2j-spam'
      ]);
    });

    it('should handle root folder correctly', () => {
      const router = new EmailActionRouter({
        rootFolder: 'Prescreen',
        draftsFolder: 't2j-draft',
        noActionFolder: 't2j-no-action',
        spamFolder: 't2j-spam'
      });

      const requiredFolders = router.getRequiredFolders();
      
      // With root folder, should include root and subfolders
      expect(requiredFolders).toEqual([
        'Prescreen',
        'Prescreen/t2j-draft',
        'Prescreen/t2j-no-action',
        'Prescreen/t2j-spam'
      ]);
    });
  });

  describe('action routing', () => {
    let router: EmailActionRouter;

    beforeEach(() => {
      router = new EmailActionRouter({
        rootFolder: '',
        draftsFolder: 't2j-draft',
        noActionFolder: 't2j-no-action',
        spamFolder: 't2j-spam'
      });
    });

    it('should route reply actions to drafts folder', () => {
      const replyRoute = router.getActionRoute('reply');
      expect(replyRoute.folder).toBe('t2j-draft');
      expect(replyRoute.displayName).toBe('t2j-draft');
      expect(replyRoute.flags).toContain('\\Draft');
      expect(replyRoute.flags).not.toContain('\\Seen');  // Drafts should not be marked as Seen
    });

    it('should route reply-all actions to drafts folder', () => {
      const replyAllRoute = router.getActionRoute('reply-all');
      expect(replyAllRoute.folder).toBe('t2j-draft');
      expect(replyAllRoute.displayName).toBe('t2j-draft');
    });

    it('should route forward actions to drafts folder', () => {
      const forwardRoute = router.getActionRoute('forward');
      expect(forwardRoute.folder).toBe('t2j-draft');
      expect(forwardRoute.displayName).toBe('t2j-draft');
    });

    it('should route silent-fyi-only to no-action folder', () => {
      const silentRoute = router.getActionRoute('silent-fyi-only');
      expect(silentRoute.folder).toBe('t2j-no-action');
      expect(silentRoute.displayName).toBe('t2j-no-action');
      expect(silentRoute.flags).not.toContain('\\Seen');  // No-action items should not be marked as Seen
      expect(silentRoute.flags).not.toContain('\\Draft');
    });

    it('should route silent-spam to spam folder', () => {
      const spamRoute = router.getActionRoute('silent-spam');
      expect(spamRoute.folder).toBe('t2j-spam');
      expect(spamRoute.displayName).toBe('t2j-spam');
      expect(spamRoute.flags).toContain('\\Seen');
    });

    it('should default unknown actions to drafts folder', () => {
      const unknownRoute = router.getActionRoute('unknown-action' as any);
      expect(unknownRoute.folder).toBe('t2j-draft');
      expect(unknownRoute.displayName).toBe('t2j-draft');
    });
  });

  describe('folder creation', () => {
    it('should check for missing folders', async () => {
      const router = new EmailActionRouter({
        rootFolder: '',
        draftsFolder: 't2j-draft',
        noActionFolder: 't2j-no-action',
        spamFolder: 't2j-spam'
      });

      // Mock IMAP operations
      const mockImapOps = {
        getFolders: jest.fn().mockResolvedValue([
          { path: 't2j-draft' },
          { path: 't2j-no-action' }
          // t2j-spam is missing
        ])
      };

      const result = await router.checkFolders(mockImapOps as any);
      
      expect(result.existing).toContain('t2j-draft');
      expect(result.existing).toContain('t2j-no-action');
      expect(result.missing).toContain('t2j-spam');
    });
  });
});