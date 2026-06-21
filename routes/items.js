const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { nanoid } = require('nanoid');

const db = require('../db');
const { authRequired } = require('../middleware/auth');
const router = express.Router();

const uploadDir = path.join(__dirname, '..', 'public', 'uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${nanoid(12)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  }
});

// PUBLIC MENU
router.get('/public/:shopId', async (req, res) => {
  try {
    const [shops] = await db.execute(
      'SELECT id, name, address FROM shops WHERE id = ?',
      [req.params.shopId]
    );

    if (shops.length === 0) {
      return res.status(404).json({ error: 'Shop not found' });
    }

    const [items] = await db.execute(
      'SELECT * FROM items WHERE shop_id = ? AND available = 1 ORDER BY created_at DESC',
      [req.params.shopId]
    );

    res.json({
      shop: shops[0],
      items
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Server error'
    });
  }
});

// ADMIN ALL ITEMS
router.get('/', authRequired, async (req, res) => {
  try {
    const [items] = await db.execute(
      'SELECT * FROM items WHERE shop_id = ? ORDER BY created_at DESC',
      [req.shop.id]
    );

    res.json({ items });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Server error'
    });
  }
});

// ADD ITEM
router.post('/', authRequired, upload.single('photo'), async (req, res) => {
  try {
    const { name, description, price, category } = req.body;

    if (!name || !price) {
      return res.status(400).json({
        error: 'name and price are required'
      });
    }

    const id = nanoid(10);

    const photoPath =
      req.file ? `/uploads/${req.file.filename}` : null;

    await db.execute(
      `INSERT INTO items
      (id, shop_id, name, description, price, photo_path, category, available)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        req.shop.id,
        name,
        description || '',
        parseFloat(price),
        photoPath,
        category || 'General',
        1
      ]
    );

    const [rows] = await db.execute(
      'SELECT * FROM items WHERE id = ?',
      [id]
    );

    res.json({
      message: 'Item added',
      item: rows[0]
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Server error adding item'
    });
  }
});

// UPDATE ITEM
router.put('/:id', authRequired, upload.single('photo'), async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT * FROM items WHERE id = ? AND shop_id = ?',
      [req.params.id, req.shop.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        error: 'Item not found'
      });
    }

    const existing = rows[0];

    const photoPath =
      req.file
        ? `/uploads/${req.file.filename}`
        : existing.photo_path;

    await db.execute(
      `UPDATE items
       SET name = ?,
           description = ?,
           price = ?,
           category = ?,
           photo_path = ?,
           available = ?
       WHERE id = ? AND shop_id = ?`,
      [
        req.body.name || existing.name,
        req.body.description ?? existing.description,
        req.body.price
          ? parseFloat(req.body.price)
          : existing.price,
        req.body.category || existing.category,
        photoPath,
        req.body.available !== undefined
          ? Number(req.body.available)
          : existing.available,
        req.params.id,
        req.shop.id
      ]
    );

    const [updated] = await db.execute(
      'SELECT * FROM items WHERE id = ?',
      [req.params.id]
    );

    res.json({
      message: 'Item updated',
      item: updated[0]
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Server error updating item'
    });
  }
});

// DELETE ITEM
router.delete('/:id', authRequired, async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT * FROM items WHERE id = ? AND shop_id = ?',
      [req.params.id, req.shop.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        error: 'Item not found'
      });
    }

    await db.execute(
      'DELETE FROM items WHERE id = ? AND shop_id = ?',
      [req.params.id, req.shop.id]
    );

    res.json({
      message: 'Item deleted'
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Server error deleting item'
    });
  }
});

module.exports = router;