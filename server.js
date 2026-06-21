require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const itemRoutes = require('./routes/items');
const orderRoutes = require('./routes/orders');
const shopRoutes = require('./routes/shop');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', authRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/shop', shopRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🍽️  QR Food Ordering System running at http://localhost:${PORT}`);
});
