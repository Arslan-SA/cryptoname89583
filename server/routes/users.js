// ==========================================
// StarCoin — User Routes (Profile, Team, etc)
// ==========================================
const express = require('express');
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// ==========================================
// GET /api/users/profile — Get full profile
// ==========================================
router.get('/profile', (req, res) => {
    const user = req.user;
    const referralLink = `${req.protocol}://${req.get('host')}?ref=${user.user_id}`;

    res.json({
        success: true,
        data: {
            ...user,
            referralLink
        }
    });
});

// ==========================================
// PUT /api/users/profile — Update profile
// ==========================================
router.put('/profile', (req, res) => {
    try {
        const { name, phone } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                error: 'Name is required.'
            });
        }

        db.prepare('UPDATE users SET name = ?, phone = ?, updated_at = ? WHERE user_id = ?')
            .run(name, phone || null, new Date().toISOString(), req.user.user_id);

        const updatedUser = db.prepare('SELECT * FROM users WHERE user_id = ?').get(req.user.user_id);
        const { password_hash, ...safeUser } = updatedUser;

        res.json({
            success: true,
            message: 'Profile updated successfully.',
            data: { user: safeUser }
        });
    } catch (err) {
        console.error('Update profile error:', err);
        res.status(500).json({
            success: false,
            error: 'Internal server error.'
        });
    }
});

// ==========================================
// GET /api/users/dashboard — Dashboard stats
// ==========================================
router.get('/dashboard', (req, res) => {
    try {
        const userId = req.user.user_id;

        // Star balance
        const user = db.prepare('SELECT star_balance FROM users WHERE user_id = ?').get(userId);

        // Direct referrals
        const directRefs = db.prepare('SELECT COUNT(*) as count FROM users WHERE referred_by = ?').get(userId);

        // Total team (recursive downline)
        function getDownlineCount(uid) {
            const direct = db.prepare('SELECT user_id FROM users WHERE referred_by = ?').all(uid);
            let count = direct.length;
            for (const d of direct) {
                count += getDownlineCount(d.user_id);
            }
            return count;
        }
        const totalTeam = getDownlineCount(userId);

        // Recent activity
        const activities = db.prepare(`
            SELECT action, details, color, created_at
            FROM activity_log
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT 10
        `).all(userId);

        // Unread notifications count
        const unread = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0').get(userId);

        // Monthly coin data (for chart)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const transactions = db.prepare(`
            SELECT 
                strftime('%Y-%m', created_at) as month,
                SUM(amount_star) as total_star
            FROM transactions
            WHERE user_id = ? AND status = 'confirmed' AND type IN ('buy', 'credit', 'referral_bonus', 'promo_bonus')
            GROUP BY month
            ORDER BY month ASC
        `).all(userId);

        const referralLink = `${req.protocol}://${req.get('host')}?ref=${userId}`;

        res.json({
            success: true,
            data: {
                starBalance: user.star_balance,
                directReferrals: directRefs.count,
                totalTeam,
                unreadNotifications: unread.count,
                activities: activities.map(a => ({
                    action: a.action,
                    details: a.details,
                    color: a.color,
                    time: formatRelativeTime(a.created_at)
                })),
                chartData: transactions,
                referralLink,
                userId
            }
        });
    } catch (err) {
        console.error('Dashboard error:', err);
        res.status(500).json({
            success: false,
            error: 'Internal server error.'
        });
    }
});

// ==========================================
// GET /api/users/team/tree — Referral tree
// ==========================================
router.get('/team/tree', (req, res) => {
    try {
        const userId = req.user.user_id;

        function buildTree(uid) {
            const user = db.prepare('SELECT user_id, name, email, join_date, status, star_balance FROM users WHERE user_id = ?').get(uid);
            if (!user) return null;

            const children = db.prepare('SELECT user_id FROM users WHERE referred_by = ?').all(uid);
            const childTrees = children.map(c => buildTree(c.user_id)).filter(Boolean);

            return {
                userId: user.user_id,
                name: user.name,
                email: user.email,
                joinDate: user.join_date,
                status: user.status,
                starBalance: user.star_balance,
                children: childTrees
            };
        }

        const tree = buildTree(userId);

        res.json({
            success: true,
            data: { tree }
        });
    } catch (err) {
        console.error('Team tree error:', err);
        res.status(500).json({
            success: false,
            error: 'Internal server error.'
        });
    }
});

// ==========================================
// GET /api/users/team/direct — Direct referrals
// ==========================================
router.get('/team/direct', (req, res) => {
    try {
        const referrals = db.prepare(`
            SELECT user_id, name, email, phone, join_date, status, star_balance
            FROM users
            WHERE referred_by = ?
            ORDER BY id ASC
        `).all(req.user.user_id);

        res.json({
            success: true,
            data: {
                referrals,
                count: referrals.length
            }
        });
    } catch (err) {
        console.error('Direct referrals error:', err);
        res.status(500).json({
            success: false,
            error: 'Internal server error.'
        });
    }
});

// ==========================================
// GET /api/users/notifications
// ==========================================
router.get('/notifications', (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        const notifications = db.prepare(`
            SELECT * FROM notifications
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `).all(req.user.user_id, limit, offset);

        const total = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ?').get(req.user.user_id);
        const unread = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0').get(req.user.user_id);

        res.json({
            success: true,
            data: {
                notifications,
                unreadCount: unread.count,
                pagination: {
                    page,
                    limit,
                    total: total.count,
                    pages: Math.ceil(total.count / limit)
                }
            }
        });
    } catch (err) {
        console.error('Notifications error:', err);
        res.status(500).json({
            success: false,
            error: 'Internal server error.'
        });
    }
});

// ==========================================
// PUT /api/users/notifications/:id/read
// ==========================================
router.put('/notifications/:id/read', (req, res) => {
    try {
        db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?')
            .run(req.params.id, req.user.user_id);

        res.json({ success: true, message: 'Notification marked as read.' });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});

// ==========================================
// PUT /api/users/notifications/read-all
// ==========================================
router.put('/notifications/read-all', (req, res) => {
    try {
        db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?')
            .run(req.user.user_id);

        res.json({ success: true, message: 'All notifications marked as read.' });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});

// ==========================================
// GET /api/users/activity
// ==========================================
router.get('/activity', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;

        const activities = db.prepare(`
            SELECT * FROM activity_log
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT ?
        `).all(req.user.user_id, limit);

        res.json({
            success: true,
            data: {
                activities: activities.map(a => ({
                    ...a,
                    relativeTime: formatRelativeTime(a.created_at)
                }))
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});

// ==========================================
// Helper: Format relative time
// ==========================================
function formatRelativeTime(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

module.exports = router;
