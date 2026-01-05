/**
 * Bot Senders Routes
 * CRUD operations for managing known bot/automated email senders
 * Uses regex patterns with domain-based filtering
 */
import express from 'express';
import { requireAuth } from '../middleware/auth';
import { pool } from '../lib/db';
import { extractDomainFromPattern } from '../lib/email-processing/bot-detector';

const router = express.Router();

// Types
interface BotSender {
  id: string;
  email_pattern: string;
  domain: string;
  company_name: string;
  category: string;
  is_confirmed: boolean;
  created_at: string;
  updated_at: string;
}

interface CreateBotSenderRequest {
  email_pattern: string;
  company_name: string;
  category: string;
  is_confirmed?: boolean;
}

interface UpdateBotSenderRequest {
  email_pattern?: string;
  company_name?: string;
  category?: string;
  is_confirmed?: boolean;
}

interface RegexValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate that a string is a valid regex pattern
 */
function isValidRegex(pattern: string): RegexValidationResult {
  try {
    new RegExp(pattern);
    return { valid: true };
  } catch (e) {
    return { valid: false, error: e instanceof Error ? e.message : 'Invalid regex' };
  }
}

/**
 * Validation middleware for bot sender creation
 * Only validates what the DB cannot: regex syntax and domain extraction
 * DB handles NOT NULL constraints for company_name, category, etc.
 */
function validateBotSender(req: express.Request, res: express.Response, next: express.NextFunction) {
  const data = req.body as CreateBotSenderRequest;

  // Validate regex syntax (DB cannot validate this)
  const regexCheck = isValidRegex(data.email_pattern);
  if (!regexCheck.valid) {
    return res.status(400).json({ error: `Invalid regex pattern: ${regexCheck.error}` });
  }

  // Pattern must contain @ to extract domain (business logic)
  const domain = extractDomainFromPattern(data.email_pattern);
  if (!domain) {
    return res.status(400).json({ error: 'Pattern must contain @ followed by domain' });
  }

  next();
  return;
}

// Get bot senders with server-side pagination
router.get('/', requireAuth, async (req, res) => {
  try {
    const { category, search, active, page = '0', pageSize = '25' } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limit = parseInt(pageSize as string, 10);
    const offset = pageNum * limit;

    let whereClause = 'WHERE 1=1';
    const params: (string | number | boolean)[] = [];

    if (category && typeof category === 'string') {
      params.push(category);
      whereClause += ` AND category = $${params.length}`;
    }

    if (active && typeof active === 'string') {
      params.push(active === 'true');
      whereClause += ` AND is_confirmed = $${params.length}`;
    }

    if (search && typeof search === 'string' && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      whereClause += ` AND (LOWER(email_pattern) LIKE $${params.length} OR LOWER(company_name) LIKE $${params.length})`;
    }

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM bot_senders ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get paginated rows
    params.push(limit, offset);
    const query = `
      SELECT id, email_pattern, domain, company_name, category, is_confirmed, created_at, updated_at
      FROM bot_senders
      ${whereClause}
      ORDER BY category ASC, company_name ASC, email_pattern ASC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    const result = await pool.query(query, params);

    const rows: BotSender[] = result.rows.map(row => ({
      id: row.id,
      email_pattern: row.email_pattern,
      domain: row.domain,
      company_name: row.company_name,
      category: row.category,
      is_confirmed: row.is_confirmed,
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at.toISOString()
    }));

    res.json({ rows, total });
  } catch (error) {
    console.error('Error fetching bot senders:', error);
    res.status(500).json({ error: 'Failed to fetch bot senders' });
  }
});

// Get categories with counts
router.get('/categories', requireAuth, async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT category, COUNT(*) as count, SUM(CASE WHEN is_confirmed THEN 1 ELSE 0 END) as confirmed_count
      FROM bot_senders
      GROUP BY category
      ORDER BY category
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Add or update bot sender (upsert)
router.post('/', requireAuth, validateBotSender, async (req, res): Promise<void> => {
  const data = req.body as CreateBotSenderRequest;
  const patternLower = data.email_pattern.toLowerCase();
  const domain = extractDomainFromPattern(patternLower)!; // Validated in middleware

  const result = await pool.query(
    `INSERT INTO bot_senders (email_pattern, domain, company_name, category, is_confirmed)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (email_pattern) DO UPDATE SET
       domain = EXCLUDED.domain,
       company_name = EXCLUDED.company_name,
       category = EXCLUDED.category,
       is_confirmed = EXCLUDED.is_confirmed,
       updated_at = CURRENT_TIMESTAMP
     RETURNING id, email_pattern, domain, company_name, category, is_confirmed, created_at, updated_at`,
    [
      patternLower,
      domain,
      data.company_name.trim(),
      data.category,
      data.is_confirmed ?? false
    ]
  );

  const row = result.rows[0];
  const sender: BotSender = {
    id: row.id,
    email_pattern: row.email_pattern,
    domain: row.domain,
    company_name: row.company_name,
    category: row.category,
    is_confirmed: row.is_confirmed,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString()
  };

  console.log('[bot-senders] Upserted pattern: %s (%s)', sender.email_pattern, sender.company_name);
  res.status(201).json(sender);
});

// Update bot sender
router.put('/:id', requireAuth, async (req, res): Promise<void> => {
  const { id } = req.params;
  const updates = req.body as UpdateBotSenderRequest;

  // Validate pattern if updating (regex syntax and domain extraction)
  let newDomain: string | null = null;
  if (updates.email_pattern) {
    const patternLower = updates.email_pattern.toLowerCase();

    const regexCheck = isValidRegex(patternLower);
    if (!regexCheck.valid) {
      res.status(400).json({ error: `Invalid regex pattern: ${regexCheck.error}` });
      return;
    }

    newDomain = extractDomainFromPattern(patternLower);
    if (!newDomain) {
      res.status(400).json({ error: 'Pattern must contain @ followed by domain' });
      return;
    }
  }

  // Build update query dynamically
  const updateFields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (updates.email_pattern !== undefined) {
    const patternLower = updates.email_pattern.toLowerCase();
    updateFields.push(`email_pattern = $${paramIndex++}`);
    values.push(patternLower);
    updateFields.push(`domain = $${paramIndex++}`);
    values.push(newDomain);
  }

  if (updates.company_name !== undefined) {
    updateFields.push(`company_name = $${paramIndex++}`);
    values.push(updates.company_name.trim());
  }

  if (updates.category !== undefined) {
    updateFields.push(`category = $${paramIndex++}`);
    values.push(updates.category);
  }

  if (updates.is_confirmed !== undefined) {
    updateFields.push(`is_confirmed = $${paramIndex++}`);
    values.push(updates.is_confirmed);
  }

  if (updateFields.length === 0) {
    res.status(400).json({ error: 'No valid fields to update' });
    return;
  }

  values.push(id);

  const result = await pool.query(
    `UPDATE bot_senders
     SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
     WHERE id = $${paramIndex}
     RETURNING id, email_pattern, domain, company_name, category, is_confirmed, created_at, updated_at`,
    values
  );

  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Bot sender not found' });
    return;
  }

  const row = result.rows[0];
  const sender: BotSender = {
    id: row.id,
    email_pattern: row.email_pattern,
    domain: row.domain,
    company_name: row.company_name,
    category: row.category,
    is_confirmed: row.is_confirmed,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString()
  };

  console.log('[bot-senders] Updated pattern: %s', sender.email_pattern);
  res.json(sender);
});

// Delete bot sender
router.delete('/:id', requireAuth, async (req, res): Promise<void> => {
  const { id } = req.params;

  const result = await pool.query(
    'DELETE FROM bot_senders WHERE id = $1 RETURNING email_pattern',
    [id]
  );

  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Bot sender not found' });
    return;
  }

  console.log('[bot-senders] Deleted pattern: %s', result.rows[0].email_pattern);
  res.status(204).send();
});

export default router;
