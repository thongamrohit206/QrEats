const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');
const { nanoid } = require('nanoid');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const db = require('../db');
const router = express.Router();

const qrDir = path.join(__dirname, '..', 'public', 'qrcodes');
if (!fs.existsSync(qrDir)) fs.mkdirSync(qrDir, { recursive: true });

// SIGNUP
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, address } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        error: 'name, email and password are required'
      });
    }

    const [existing] = await db.execute(
      'SELECT * FROM shops WHERE email = ?',
      [email]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        error: 'Email already registered'
      });
    }

    const id = nanoid(10);
    const hash = await bcrypt.hash(password, 10);

    await db.execute(
      `INSERT INTO shops
      (id, name, email, password, address)
      VALUES (?, ?, ?, ?, ?)`,
      [id, name, email, hash, address || '']
    );

    const menuUrl = `${process.env.BASE_URL}/menu.html?shop=${id}`;
    const qrFilePath = path.join(qrDir, `${id}.png`);

    await QRCode.toFile(qrFilePath, menuUrl, {
      width: 400
    });

    const token = jwt.sign(
      { id, email, name },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Signup successful',
      token,
      shop: { id, name, email },
      menuUrl,
      qrCodeUrl: `/qrcodes/${id}.png`
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Server error during signup'
    });
  }
});

// LOGIN
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const [rows] = await db.execute(
      'SELECT * FROM shops WHERE email = ?',
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    const shop = rows[0];

    const valid = await bcrypt.compare(
      password,
      shop.password
    );

    if (!valid) {
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    const token = jwt.sign(
      {
        id: shop.id,
        email: shop.email,
        name: shop.name
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const menuUrl =
      `${process.env.BASE_URL}/menu.html?shop=${shop.id}`;

    res.json({
      message: 'Login successful',
      token,
      shop: {
        id: shop.id,
        name: shop.name,
        email: shop.email
      },
      menuUrl,
      qrCodeUrl: `/qrcodes/${shop.id}.png`
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Server error during login'
    });
  }
});

// QR Code
router.get('/qrcode/:shopId', async (req, res) => {
  try {
    const { shopId } = req.params;

    const [rows] = await db.execute(
      'SELECT * FROM shops WHERE id = ?',
      [shopId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        error: 'Shop not found'
      });
    }

    const menuUrl =
      `${process.env.BASE_URL}/menu.html?shop=${shopId}`;

    const qrFilePath =
      path.join(qrDir, `${shopId}.png`);

    if (!fs.existsSync(qrFilePath)) {
      await QRCode.toFile(
        qrFilePath,
        menuUrl,
        { width: 400 }
      );
    }

    res.json({
      menuUrl,
      qrCodeUrl: `/qrcodes/${shopId}.png`
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Server error generating QR code'
    });
  }
});

module.exports = router;