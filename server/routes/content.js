// ==========================================
// StarCoin — Content Routes (News, Promotions)
// ==========================================
const express = require('express');
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// ==========================================
// GET /api/content/news — Public news feed
// ==========================================
router.get('/news', (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        const news = db.prepare(`
            SELECT * FROM news
            WHERE is_active = 1
            ORDER BY published_at DESC
            LIMIT ? OFFSET ?
        `).all(limit, offset);

        const total = db.prepare('SELECT COUNT(*) as count FROM news WHERE is_active = 1').get();

        res.json({
            success: true,
            data: {
                news: news.map(item => ({
                    id: item.id,
                    title: item.title,
                    content: item.content,
                    summary: item.summary,
                    icon: item.icon,
                    gradient: item.gradient,
                    publishedAt: item.published_at,
                    formattedDate: formatNewsDate(item.published_at)
                })),
                pagination: {
                    page,
                    limit,
                    total: total.count,
                    pages: Math.ceil(total.count / limit)
                }
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});

// ==========================================
// GET /api/content/promotions — Active promotions
// ==========================================
router.get('/promotions', (req, res) => {
    try {
        const promotions = db.prepare(`
            SELECT * FROM promotions
            WHERE is_active = 1
            ORDER BY created_at DESC
        `).all();

        res.json({
            success: true,
            data: {
                promotions: promotions.map(item => ({
                    id: item.id,
                    title: item.title,
                    description: item.description,
                    tag: item.tag,
                    gradient: item.gradient,
                    validUntil: item.valid_until,
                    formattedValidity: item.valid_until
                        ? `Valid till: ${new Date(item.valid_until).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                        : 'Ongoing'
                }))
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});

// ==========================================
// GET /api/content/market-stats — Public market stats
// ==========================================
router.get('/market-stats', (req, res) => {
    try {
        const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get();
        const totalStar = db.prepare('SELECT SUM(star_balance) as total FROM users').get();
        const totalVolume = db.prepare('SELECT SUM(amount_usd) as total FROM transactions WHERE status = ? AND type = ?').get('confirmed', 'buy');

        const STAR_RATE = parseInt(process.env.STAR_RATE) || 150;

        res.json({
            success: true,
            data: {
                marketCap: '$8.5M',
                volume24h: '$1.2M',
                totalSupply: '10M STAR',
                allTimeHigh: '$1.24',
                rate: `1 USD = ${STAR_RATE} STAR`,
                priceChange: '+12.3%',
                totalUsers: totalUsers.count,
                circulatingSupply: totalStar.total || 0,
                totalVolumeUsd: totalVolume.total || 0
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});

function formatNewsDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

module.exports = router;
