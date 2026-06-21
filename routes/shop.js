const express = require('express');
const db = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

// ADMIN: get own shop profile + dashboard stats
router.get('/me', authRequired, async (req, res) => {
  try {
    // Shop details
    const [shops] = await db.execute(
      `SELECT id, name, email, address, created_at
       FROM shops
       WHERE id = ?`,
      [req.shop.id]
    );

    if (shops.length === 0) {
      return res.status(404).json({
        error: 'Shop not found'
      });
    }

    // Total items
    const [itemRows] = await db.execute(
      'SELECT COUNT(*) AS count FROM items WHERE shop_id = ?',
      [req.shop.id]
    );

    // Total orders
    const [orderRows] = await db.execute(
      'SELECT COUNT(*) AS count FROM orders WHERE shop_id = ?',
      [req.shop.id]
    );

    // Pending orders
    const [pendingRows] = await db.execute(
      `SELECT COUNT(*) AS count
       FROM orders
       WHERE shop_id = ?
       AND status IN ('placed', 'preparing', 'ready')`,
      [req.shop.id]
    );

    res.json({
      shop: shops[0],
      stats: {
        itemCount: itemRows[0].count,
        orderCount: orderRows[0].count,
        pendingCount: pendingRows[0].count
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Server error'
    });
  }
});

module.exports = router;