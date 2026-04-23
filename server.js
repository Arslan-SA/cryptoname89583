// ==========================================
// StarCoin — Express Server
// ==========================================
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// MIDDLEWARE
// ==========================================
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        const color = res.statusCode >= 400 ? '\x1b[31m' : '\x1b[32m';
        console.log(`${color}${req.method}\x1b[0m ${req.path} → ${res.statusCode} (${duration}ms)`);
    });
    next();
});

// ==========================================
// STATIC FILES — Serve frontend
// ==========================================
app.use(express.static(path.join(__dirname), {
    extensions: ['html'],
    index: 'index.html'
}));

// ==========================================
// API ROUTES
// ==========================================
const authRoutes = require('./server/routes/auth');
const userRoutes = require('./server/routes/users');
const walletRoutes = require('./server/routes/wallet');
const adminRoutes = require('./server/routes/admin');
const contentRoutes = require('./server/routes/content');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/content', contentRoutes);

// ==========================================
// API HEALTH CHECK
// ==========================================
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: '⭐ StarCoin API is running!',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// ==========================================
// CATCH-ALL — Serve index.html for SPA routes
// ==========================================
app.get('/{*path}', (req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({
            success: false,
            error: 'API endpoint not found.'
        });
    }
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ==========================================
// ERROR HANDLER
// ==========================================
app.use((err, req, res, next) => {
    console.error('❌ Server error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error.'
    });
});

// ==========================================
// SEED DATABASE & START SERVER
// ==========================================
const seedDatabase = require('./server/db/seed');
seedDatabase();

app.listen(PORT, () => {
    console.log('');
    console.log('  ⭐ ═══════════════════════════════════════');
    console.log(`  ⭐  StarCoin Server v2.0.0`);
    console.log(`  ⭐  Running on http://localhost:${PORT}`);
    console.log('  ⭐ ═══════════════════════════════════════');
    console.log('');
    console.log('  📡 API Endpoints:');
    console.log(`     POST   /api/auth/register`);
    console.log(`     POST   /api/auth/login`);
    console.log(`     GET    /api/auth/me`);
    console.log(`     GET    /api/users/dashboard`);
    console.log(`     GET    /api/users/profile`);
    console.log(`     PUT    /api/users/profile`);
    console.log(`     GET    /api/users/team/tree`);
    console.log(`     GET    /api/users/team/direct`);
    console.log(`     GET    /api/wallet/balance`);
    console.log(`     POST   /api/wallet/buy`);
    console.log(`     POST   /api/wallet/confirm-payment`);
    console.log(`     POST   /api/wallet/request-credit`);
    console.log(`     GET    /api/wallet/transactions`);
    console.log(`     GET    /api/content/news`);
    console.log(`     GET    /api/content/promotions`);
    console.log(`     GET    /api/content/market-stats`);
    console.log(`     GET    /api/admin/stats`);
    console.log(`     GET    /api/health`);
    console.log('');
});

module.exports = app;
