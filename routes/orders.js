const express = require('express');
const { nanoid } = require('nanoid');

const db = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

// PLACE ORDER
router.post('/', async (req, res) => {
  try {
    const {
      shopId,
      tableNo,
      customerName,
      customerPhone,
      comments,
      items,
      paymentMethod
    } = req.body;

    if (!shopId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: 'shopId and at least one item are required'
      });
    }

    const [shops] = await db.execute(
      'SELECT * FROM shops WHERE id = ?',
      [shopId]
    );

    if (shops.length === 0) {
      return res.status(404).json({
        error: 'Shop not found'
      });
    }

    const total = items.reduce(
      (sum, it) =>
        sum + Number(it.price) * Number(it.qty),
      0
    );

    const orderId = nanoid(10);

    await db.execute(
      `INSERT INTO orders
      (id, shop_id, table_no, customer_name,
       customer_phone, comments, total,
       status, payment_status, payment_method)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderId,
        shopId,
        tableNo || '',
        customerName || '',
        customerPhone || '',
        comments || '',
        total,
        'placed',
        'paid',
        paymentMethod || 'mock'
      ]
    );

    for (const it of items) {
      await db.execute(
        `INSERT INTO order_items
        (order_id, item_id, item_name, price, qty)
        VALUES (?, ?, ?, ?, ?)`,
        [
          orderId,
          it.itemId || null,
          it.name,
          Number(it.price),
          Number(it.qty)
        ]
      );
    }

    res.json({
      message: 'Order placed successfully',
      orderId,
      total,
      status: 'placed'
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Server error placing order'
    });
  }
});

// TRACK ORDER
router.get('/track/:orderId', async (req, res) => {
  try {
    const [orders] = await db.execute(
      'SELECT * FROM orders WHERE id = ?',
      [req.params.orderId]
    );

    if (orders.length === 0) {
      return res.status(404).json({
        error: 'Order not found'
      });
    }

    const [items] = await db.execute(
      'SELECT * FROM order_items WHERE order_id = ?',
      [req.params.orderId]
    );

    res.json({
      order: orders[0],
      items
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Server error'
    });
  }
});

// ADMIN ORDERS
router.get('/', authRequired, async (req, res) => {
  try {
    let sql =
      'SELECT * FROM orders WHERE shop_id = ?';

    const params = [req.shop.id];

    if (req.query.status) {
      sql += ' AND status = ?';
      params.push(req.query.status);
    }

    sql += ' ORDER BY created_at DESC';

    const [orders] = await db.execute(
      sql,
      params
    );

    for (const order of orders) {
      const [items] = await db.execute(
        'SELECT * FROM order_items WHERE order_id = ?',
        [order.id]
      );

      order.items = items;
    }

    res.json({ orders });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Server error'
    });
  }
});

// UPDATE STATUS
router.put('/:id/status', authRequired, async (req, res) => {
  try {
    const { status } = req.body;

    const allowed = [
      'placed',
      'preparing',
      'ready',
      'delivered',
      'cancelled'
    ];

    if (!allowed.includes(status)) {
      return res.status(400).json({
        error: `status must be one of: ${allowed.join(', ')}`
      });
    }

    const [result] = await db.execute(
      `UPDATE orders
       SET status = ?
       WHERE id = ? AND shop_id = ?`,
      [
        status,
        req.params.id,
        req.shop.id
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: 'Order not found'
      });
    }

    res.json({
      message: 'Order status updated',
      status
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Server error'
    });
  }
});

module.exports = router;