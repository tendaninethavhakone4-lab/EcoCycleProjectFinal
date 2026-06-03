const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json({ limit: '3mb' }));

app.use('/api/auth', require('./routes/users'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/materials', require('./routes/materials'));
app.use('/api/locations', require('./routes/locations'));
app.use('/api/rewards', require('./routes/rewards'));
app.use('/api/admin', require('./routes/admin'));

const { authRequired } = require('./middleware/auth');
const adminRoute = require('./routes/admin');
app.get('/api/pickers', authRequired, (req, res) => {
  res.json({ pickers: adminRoute.pickers || [] });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'EcoCycle API is running!',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`EcoCycle API is running on http://localhost:${PORT}`);
  console.log(`Test it: http://localhost:${PORT}/api/health`);
});