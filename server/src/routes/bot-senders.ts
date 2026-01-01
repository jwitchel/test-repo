/**
 * Bot Senders Routes
 * CRUD operations for managing known bot/automated email senders
 */
import express from 'express';
import { requireAuth } from '../middleware/auth';
import { pool } from '../lib/db';
import { isValidEmail, isValidUUID } from '../lib/validation';

const router = express.Router();

// Types
interface BotSender {
  id: string;
  email_address: string;
  company_name: string;
  category: string;
  is_confirmed: boolean;
  created_at: string;
  updated_at: string;
}

interface CreateBotSenderRequest {
  email_address: string;
  company_name: string;
  category: string;
  is_confirmed?: boolean;
}

interface UpdateBotSenderRequest {
  email_address?: string;
  company_name?: string;
  category?: string;
  is_confirmed?: boolean;
}

// Category options for validation
const VALID_CATEGORIES = [
  'airlines',
  'banks',
  'ecommerce',
  'payments',
  'shipping_logistics',
  'saas_productivity',
  'streaming',
  'rideshare_delivery',
  'travel_hotels',
  'social_media',
  'developer_tools',
  'healthcare',
  'utilities',
  'government',
  'education',
  'other'
];

// Validation middleware
function validateBotSender(req: express.Request, res: express.Response, next: express.NextFunction) {
  const data = req.body as CreateBotSenderRequest;

  if (!data.email_address || data.email_address.trim().length === 0) {
    return res.status(400).json({ error: 'Email address is required' });
  }

  if (!isValidEmail(data.email_address)) {
    return res.status(400).json({ error: 'Invalid email address format' });
  }

  if (!data.company_name || data.company_name.trim().length === 0) {
    return res.status(400).json({ error: 'Company name is required' });
  }

  if (!data.category || !VALID_CATEGORIES.includes(data.category)) {
    return res.status(400).json({
      error: 'Invalid category',
      validCategories: VALID_CATEGORIES
    });
  }

  next();
  return;
}

// Get bot senders with server-side pagination
router.get('/', requireAuth, async (req, res) => {
  try {
    const { category, search, page = '0', pageSize = '25' } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limit = parseInt(pageSize as string, 10);
    const offset = pageNum * limit;

    let whereClause = 'WHERE 1=1';
    const params: (string | number)[] = [];

    if (category && typeof category === 'string') {
      params.push(category);
      whereClause += ` AND category = $${params.length}`;
    }

    if (search && typeof search === 'string' && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      whereClause += ` AND (LOWER(email_address) LIKE $${params.length} OR LOWER(company_name) LIKE $${params.length})`;
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
      SELECT id, email_address, company_name, category, is_confirmed, created_at, updated_at
      FROM bot_senders
      ${whereClause}
      ORDER BY category ASC, company_name ASC, email_address ASC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    const result = await pool.query(query, params);

    const rows: BotSender[] = result.rows.map(row => ({
      id: row.id,
      email_address: row.email_address,
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

// Add new bot sender
router.post('/', requireAuth, validateBotSender, async (req, res): Promise<void> => {
  try {
    const data = req.body as CreateBotSenderRequest;

    // Check if email already exists
    const existing = await pool.query(
      'SELECT id FROM bot_senders WHERE email_address = $1',
      [data.email_address.toLowerCase()]
    );

    if (existing.rows.length > 0) {
      res.status(409).json({
        error: 'Email address already exists',
        field: 'email_address'
      });
      return;
    }

    const result = await pool.query(
      `INSERT INTO bot_senders (email_address, company_name, category, is_confirmed)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email_address, company_name, category, is_confirmed, created_at, updated_at`,
      [
        data.email_address.toLowerCase(),
        data.company_name.trim(),
        data.category,
        data.is_confirmed ?? false
      ]
    );

    const sender: BotSender = {
      id: result.rows[0].id,
      email_address: result.rows[0].email_address,
      company_name: result.rows[0].company_name,
      category: result.rows[0].category,
      is_confirmed: result.rows[0].is_confirmed,
      created_at: result.rows[0].created_at.toISOString(),
      updated_at: result.rows[0].updated_at.toISOString()
    };

    console.log('[bot-senders] Created sender: %s (%s)', sender.email_address, sender.company_name);
    res.status(201).json(sender);
  } catch (error) {
    console.error('Error creating bot sender:', error);
    res.status(500).json({ error: 'Failed to create bot sender' });
  }
});

// Update bot sender
router.put('/:id', requireAuth, async (req, res): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body as UpdateBotSenderRequest;

    if (!isValidUUID(id)) {
      res.status(400).json({ error: 'Invalid ID format' });
      return;
    }

    // Check if sender exists
    const existing = await pool.query('SELECT id FROM bot_senders WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Bot sender not found' });
      return;
    }

    // Validate email if updating
    if (updates.email_address) {
      if (!isValidEmail(updates.email_address)) {
        res.status(400).json({ error: 'Invalid email address format' });
        return;
      }

      // Check for duplicate email
      const duplicate = await pool.query(
        'SELECT id FROM bot_senders WHERE email_address = $1 AND id != $2',
        [updates.email_address.toLowerCase(), id]
      );
      if (duplicate.rows.length > 0) {
        res.status(409).json({
          error: 'Email address already exists',
          field: 'email_address'
        });
        return;
      }
    }

    // Validate category if updating
    if (updates.category && !VALID_CATEGORIES.includes(updates.category)) {
      res.status(400).json({
        error: 'Invalid category',
        validCategories: VALID_CATEGORIES
      });
      return;
    }

    // Build update query dynamically
    const updateFields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (updates.email_address !== undefined) {
      updateFields.push(`email_address = $${paramIndex++}`);
      values.push(updates.email_address.toLowerCase());
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

    const query = `
      UPDATE bot_senders
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramIndex}
      RETURNING id, email_address, company_name, category, is_confirmed, created_at, updated_at
    `;

    const result = await pool.query(query, values);

    const sender: BotSender = {
      id: result.rows[0].id,
      email_address: result.rows[0].email_address,
      company_name: result.rows[0].company_name,
      category: result.rows[0].category,
      is_confirmed: result.rows[0].is_confirmed,
      created_at: result.rows[0].created_at.toISOString(),
      updated_at: result.rows[0].updated_at.toISOString()
    };

    console.log('[bot-senders] Updated sender: %s', sender.email_address);
    res.json(sender);
  } catch (error) {
    console.error('Error updating bot sender:', error);
    res.status(500).json({ error: 'Failed to update bot sender' });
  }
});

// Delete bot sender
router.delete('/:id', requireAuth, async (req, res): Promise<void> => {
  try {
    const { id } = req.params;

    if (!isValidUUID(id)) {
      res.status(400).json({ error: 'Invalid ID format' });
      return;
    }

    const result = await pool.query(
      'DELETE FROM bot_senders WHERE id = $1 RETURNING email_address',
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Bot sender not found' });
      return;
    }

    console.log('[bot-senders] Deleted sender: %s', result.rows[0].email_address);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting bot sender:', error);
    res.status(500).json({ error: 'Failed to delete bot sender' });
  }
});

export default router;
