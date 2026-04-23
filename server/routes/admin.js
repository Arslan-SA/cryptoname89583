// ==========================================
// StarCoin — Admin Routes
// ==========================================
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication + admin role
router.use(authenticate);
router.use(requireAdmin);

// ==========================================
// GET /api/admin/stats — Admin dashboard stats
// ==========================================
router.get('/stats', (req, res) => {
    try {
        const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get();
        const activeUsers = db.prepare('SELECT COUNT(*) as count FROM users WHERE status = ?').get('active');
        const totalStar = db.prepare('SELECT SUM(star_balance) as total FROM users').get();
        const totalTransactions = db.prepare('SELECT COUNT(*) as count FROM transactions').get();
        const pendingTransactions = db.prepare('SELECT COUNT(*) as count FROM transactions WHERE status = ?').get('pending');
        const confirmedVolume = db.prepare('SELECT SUM(amount_usd) as total FROM transactions WHERE status = ? AND type = ?').get('confirmed', 'buy');
        const pendingRequests = db.prepare('SELECT COUNT(*) as count FROM wallet_requests WHERE status = ?').get('pending');

        // Recent signups (last 7 days)
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const recentSignups = db.prepare('SELECT COUNT(*) as count FROM users WHERE join_date >= ?').get(weekAgo.toISOString());

        res.json({
            success: true,
            data: {
                totalUsers: totalUsers.count,
                activeUsers: activeUsers.count,
                totalStarInCirculation: totalStar.total || 0,
                totalTransactions: totalTransactions.count,
                pendingTransactions: pendingTransactions.count,
                confirmedVolumeUsd: confirmedVolume.total || 0,
                pendingWalletRequests: pendingRequests.count,
                recentSignups: recentSignups.count
            }
        });
    } catch (err) {
        console.error('Admin stats error:', err);
        res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});

// ==========================================
// GET /api/admin/users — List all users
// ==========================================
router.get('/users', (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const search = req.query.search || '';
        const offset = (page - 1) * limit;

        let query = `SELECT user_id, name, email, phone, referred_by, star_balance, role, status, join_date, updated_at FROM users`;
        let countQuery = `SELECT COUNT(*) as count FROM users`;
        const params = [];

        if (search) {
            const searchClause = ` WHERE name LIKE ? OR email LIKE ? OR user_id LIKE ?`;
            query += searchClause;
            countQuery += searchClause;
            const searchParam = `%${search}%`;
            params.push(searchParam, searchParam, searchParam);
        }

        query += ' ORDER BY id DESC LIMIT ? OFFSET ?';

        const users = db.prepare(query).all(...params, limit, offset);
        const total = db.prepare(countQuery).get(...params);

        res.json({
            success: true,
            data: {
                users,
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
// GET /api/admin/users/:userId — Get specific user
// ==========================================
router.get('/users/:userId', (req, res) => {
    try {
        const user = db.prepare(`
            SELECT user_id, name, email, phone, referred_by, star_balance, role, status, join_date, updated_at
            FROM users WHERE user_id = ?
        `).get(req.params.userId);

        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }

        // Get referral count
        const directRefs = db.prepare('SELECT COUNT(*) as count FROM users WHERE referred_by = ?').get(user.user_id);

        // Get transaction count
        const txCount = db.prepare('SELECT COUNT(*) as count FROM transactions WHERE user_id = ?').get(user.user_id);

        res.json({
            success: true,
            data: {
                user,
                directReferrals: directRefs.count,
                transactionCount: txCount.count
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});

// ==========================================
// PUT /api/admin/users/:userId — Update user (admin)
// ==========================================
router.put('/users/:userId', (req, res) => {
    try {
        const { name, phone, status, role, star_balance } = req.body;
        const now = new Date().toISOString();

        const user = db.prepare('SELECT * FROM users WHERE user_id = ?').get(req.params.userId);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }

        db.prepare(`
            UPDATE users SET
                name = COALESCE(?, name),
                phone = COALESCE(?, phone),
                status = COALESCE(?, status),
                role = COALESCE(?, role),
                star_balance = COALESCE(?, star_balance),
                updated_at = ?
            WHERE user_id = ?
        `).run(name || null, phone || null, status || null, role || null, star_balance ?? null, now, req.params.userId);

        const updatedUser = db.prepare('SELECT user_id, name, email, phone, star_balance, role, status FROM users WHERE user_id = ?').get(req.params.userId);

        res.json({
            success: true,
            message: 'User updated successfully.',
            data: { user: updatedUser }
        });
    } catch (err) {
        console.error('Admin update user error:', err);
        res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});

// ==========================================
// GET /api/admin/transactions — All transactions
// ==========================================
router.get('/transactions', (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const status = req.query.status;
        const offset = (page - 1) * limit;

        let query = `
            SELECT t.*, u.name as user_name, u.email as user_email
            FROM transactions t
            JOIN users u ON t.user_id = u.user_id
        `;
        let countQuery = 'SELECT COUNT(*) as count FROM transactions';
        const params = [];

        if (status) {
            query += ' WHERE t.status = ?';
            countQuery += ' WHERE status = ?';
            params.push(status);
        }

        query += ' ORDER BY t.created_at DESC LIMIT ? OFFSET ?';

        const transactions = db.prepare(query).all(...params, limit, offset);
        const total = db.prepare(countQuery).get(...params);

        res.json({
            success: true,
            data: {
                transactions,
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
// PUT /api/admin/transactions/:id/approve — Approve transaction
// ==========================================
router.put('/transactions/:id/approve', (req, res) => {
    try {
        const tx = db.prepare('SELECT * FROM transactions WHERE transaction_id = ?').get(req.params.id);
        if (!tx) return res.status(404).json({ success: false, error: 'Transaction not found.' });
        if (tx.status !== 'pending') return res.status(400).json({ success: false, error: `Transaction already ${tx.status}.` });

        const now = new Date().toISOString();

        // Approve transaction
        db.prepare('UPDATE transactions SET status = ?, updated_at = ? WHERE transaction_id = ?')
            .run('confirmed', now, req.params.id);

        // Credit user balance
        db.prepare('UPDATE users SET star_balance = star_balance + ?, updated_at = ? WHERE user_id = ?')
            .run(tx.amount_star, now, tx.user_id);

        // Notify user
        db.prepare(`
            INSERT INTO notifications (user_id, title, message, type, created_at)
            VALUES (?, ?, ?, ?, ?)
        `).run(tx.user_id, 'Transaction Approved', `Your purchase of ★${tx.amount_star.toLocaleString()} has been approved and credited.`, 'success', now);

        res.json({
            success: true,
            message: 'Transaction approved and balance credited.'
        });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});

// ==========================================
// PUT /api/admin/transactions/:id/reject — Reject transaction
// ==========================================
router.put('/transactions/:id/reject', (req, res) => {
    try {
        const { reason } = req.body;
        const tx = db.prepare('SELECT * FROM transactions WHERE transaction_id = ?').get(req.params.id);
        if (!tx) return res.status(404).json({ success: false, error: 'Transaction not found.' });
        if (tx.status !== 'pending') return res.status(400).json({ success: false, error: `Transaction already ${tx.status}.` });

        const now = new Date().toISOString();

        db.prepare('UPDATE transactions SET status = ?, description = COALESCE(description, "") || ?, updated_at = ? WHERE transaction_id = ?')
            .run('rejected', reason ? ` | Rejected: ${reason}` : '', now, req.params.id);

        // Notify user
        db.prepare(`
            INSERT INTO notifications (user_id, title, message, type, created_at)
            VALUES (?, ?, ?, ?, ?)
        `).run(tx.user_id, 'Transaction Rejected', `Your purchase of ★${tx.amount_star.toLocaleString()} was rejected.${reason ? ' Reason: ' + reason : ''}`, 'error', now);

        res.json({
            success: true,
            message: 'Transaction rejected.'
        });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});

// ==========================================
// GET /api/admin/wallet-requests — All wallet requests
// ==========================================
router.get('/wallet-requests', (req, res) => {
    try {
        const status = req.query.status;
        let query = `
            SELECT wr.*, u.name as user_name, u.email as user_email
            FROM wallet_requests wr
            JOIN users u ON wr.user_id = u.user_id
        `;
        const params = [];

        if (status) {
            query += ' WHERE wr.status = ?';
            params.push(status);
        }

        query += ' ORDER BY wr.created_at DESC';

        const requests = db.prepare(query).all(...params);

        res.json({
            success: true,
            data: { requests }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});

// ==========================================
// PUT /api/admin/wallet-requests/:id/approve
// ==========================================
router.put('/wallet-requests/:id/approve', (req, res) => {
    try {
        const request = db.prepare('SELECT * FROM wallet_requests WHERE request_id = ?').get(req.params.id);
        if (!request) return res.status(404).json({ success: false, error: 'Request not found.' });
        if (request.status !== 'pending') return res.status(400).json({ success: false, error: `Request already ${request.status}.` });

        const now = new Date().toISOString();

        // Approve
        db.prepare('UPDATE wallet_requests SET status = ?, updated_at = ? WHERE request_id = ?')
            .run('approved', now, req.params.id);

        // Credit balance
        db.prepare('UPDATE users SET star_balance = star_balance + ?, updated_at = ? WHERE user_id = ?')
            .run(request.amount_star, now, request.user_id);

        // Create transaction record
        db.prepare(`
            INSERT INTO transactions (transaction_id, user_id, type, amount_usd, amount_star, status, payment_method, reference_no, description, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(uuidv4(), request.user_id, 'credit', 0, request.amount_star, 'confirmed', request.payment_method, request.reference_no, 'E-Wallet credit request approved', now);

        // Notify user
        db.prepare(`
            INSERT INTO notifications (user_id, title, message, type, created_at)
            VALUES (?, ?, ?, ?, ?)
        `).run(request.user_id, 'Credit Approved!', `★${request.amount_star.toLocaleString()} has been credited to your wallet.`, 'success', now);

        res.json({
            success: true,
            message: 'Credit request approved and balance updated.'
        });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});

// ==========================================
// PUT /api/admin/wallet-requests/:id/reject
// ==========================================
router.put('/wallet-requests/:id/reject', (req, res) => {
    try {
        const { reason } = req.body;
        const request = db.prepare('SELECT * FROM wallet_requests WHERE request_id = ?').get(req.params.id);
        if (!request) return res.status(404).json({ success: false, error: 'Request not found.' });
        if (request.status !== 'pending') return res.status(400).json({ success: false, error: `Request already ${request.status}.` });

        const now = new Date().toISOString();

        db.prepare('UPDATE wallet_requests SET status = ?, admin_note = ?, updated_at = ? WHERE request_id = ?')
            .run('rejected', reason || null, now, req.params.id);

        db.prepare(`
            INSERT INTO notifications (user_id, title, message, type, created_at)
            VALUES (?, ?, ?, ?, ?)
        `).run(request.user_id, 'Credit Request Rejected', `Your request for ★${request.amount_star.toLocaleString()} was rejected.${reason ? ' Reason: ' + reason : ''}`, 'error', now);

        res.json({
            success: true,
            message: 'Credit request rejected.'
        });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});

// ==========================================
// POST /api/admin/news — Create news article
// ==========================================
router.post('/news', (req, res) => {
    try {
        const { title, content, summary, icon, gradient } = req.body;

        if (!title || !content) {
            return res.status(400).json({ success: false, error: 'Title and content are required.' });
        }

        const result = db.prepare(`
            INSERT INTO news (title, content, summary, icon, gradient, published_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(title, content, summary || null, icon || 'article', gradient || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', new Date().toISOString());

        res.status(201).json({
            success: true,
            message: 'News article created.',
            data: { id: result.lastInsertRowid }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});

// ==========================================
// POST /api/admin/promotions — Create promotion
// ==========================================
router.post('/promotions', (req, res) => {
    try {
        const { title, description, tag, gradient, validUntil } = req.body;

        if (!title || !description) {
            return res.status(400).json({ success: false, error: 'Title and description are required.' });
        }

        const result = db.prepare(`
            INSERT INTO promotions (title, description, tag, gradient, valid_until, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(title, description, tag || 'NEW', gradient || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', validUntil || null, new Date().toISOString());

        res.status(201).json({
            success: true,
            message: 'Promotion created.',
            data: { id: result.lastInsertRowid }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});

module.exports = router;
