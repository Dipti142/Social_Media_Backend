const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth.routes');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend assets
app.use(express.static(path.join(__dirname, '../socialmedia_Frontend')));

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Social Media API is running'
  });
});

// Auth routes
app.use('/api/v1/auth', authRoutes);

module.exports = app;