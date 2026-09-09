import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

// Middleware to check if user is admin
const isAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const result = await pool.query(
      'SELECT is_admin FROM users WHERE id = $1',
      [req.user.id]
    );

    if (!result.rows[0]?.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── PUBLIC: Get all active hero cards (for home page) ────────────────────────
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        id, 
        title, 
        image_url, 
        reference_type, 
        reference_value, 
        position 
       FROM hero_cards 
       WHERE is_active = true 
       ORDER BY position ASC`
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── ADMIN: Get all hero cards (including inactive) ────────────────────────────
router.get('/admin/all', isAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        id, 
        title, 
        image_url, 
        reference_type, 
        reference_value, 
        position, 
        is_active,
        created_at,
        updated_at,
        created_by
       FROM hero_cards 
       ORDER BY position ASC`
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── ADMIN: Create new hero card ────────────────────────────────────────────────
router.post('/admin', isAdmin, async (req, res) => {
  const { title, image_url, reference_type, reference_value, position } = req.body;

  try {
    // Check if we already have 15 cards
    const countResult = await pool.query('SELECT COUNT(*) as count FROM hero_cards');
    if (parseInt(countResult.rows[0].count) >= 15) {
      return res.status(400).json({ error: 'Maximum 15 hero cards allowed' });
    }

    // Validate reference_type
    const validTypes = ['brand', 'category', 'search', 'link'];
    if (!validTypes.includes(reference_type)) {
      return res.status(400).json({ 
        error: `Invalid reference_type. Allowed: ${validTypes.join(', ')}` 
      });
    }

    // Check if position already exists
    if (position !== undefined && position !== null) {
      const posResult = await pool.query(
        'SELECT id FROM hero_cards WHERE position = $1',
        [position]
      );
      if (posResult.rows.length > 0) {
        return res.status(400).json({ error: 'Position already exists' });
      }
    }

    const result = await pool.query(
      `INSERT INTO hero_cards 
       (title, image_url, reference_type, reference_value, position, created_by) 
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [title, image_url, reference_type, reference_value, position || 0, req.user.id]
    );

    res.status(201).json({
      success: true,
      message: 'Hero card created successfully',
      data: result.rows[0],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── ADMIN: Update hero card ────────────────────────────────────────────────────
router.put('/admin/:id', isAdmin, async (req, res) => {
  const { id } = req.params;
  const { title, image_url, reference_type, reference_value, position, is_active } = req.body;

  try {
    // Validate reference_type if provided
    if (reference_type) {
      const validTypes = ['brand', 'category', 'search', 'link'];
      if (!validTypes.includes(reference_type)) {
        return res.status(400).json({ 
          error: `Invalid reference_type. Allowed: ${validTypes.join(', ')}` 
        });
      }
    }

    // Check if new position conflicts with another card
    if (position !== undefined && position !== null) {
      const posResult = await pool.query(
        'SELECT id FROM hero_cards WHERE position = $1 AND id != $2',
        [position, id]
      );
      if (posResult.rows.length > 0) {
        return res.status(400).json({ error: 'Position already exists' });
      }
    }

    const result = await pool.query(
      `UPDATE hero_cards 
       SET 
         title = COALESCE($1, title),
         image_url = COALESCE($2, image_url),
         reference_type = COALESCE($3, reference_type),
         reference_value = COALESCE($4, reference_value),
         position = COALESCE($5, position),
         is_active = COALESCE($6, is_active)
       WHERE id = $7
       RETURNING *`,
      [title, image_url, reference_type, reference_value, position, is_active, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Hero card not found' });
    }

    res.json({
      success: true,
      message: 'Hero card updated successfully',
      data: result.rows[0],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── ADMIN: Delete hero card ────────────────────────────────────────────────────
router.delete('/admin/:id', isAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM hero_cards WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Hero card not found' });
    }

    res.json({
      success: true,
      message: 'Hero card deleted successfully',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── ADMIN: Reorder hero cards ──────────────────────────────────────────────────
router.post('/admin/reorder', isAdmin, async (req, res) => {
  const { cards } = req.body; // Array of { id, position }

  try {
    if (!Array.isArray(cards)) {
      return res.status(400).json({ error: 'cards must be an array' });
    }

    // Update positions for each card
    const updatePromises = cards.map(({ id, position }) =>
      pool.query(
        'UPDATE hero_cards SET position = $1 WHERE id = $2',
        [position, id]
      )
    );

    await Promise.all(updatePromises);

    res.json({
      success: true,
      message: 'Hero cards reordered successfully',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
