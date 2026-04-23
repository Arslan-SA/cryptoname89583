// ==========================================
// StarCoin — Wallet & Transaction Routes
// ==========================================
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

const STAR_RATE = parseInt(process.env.STAR_RATE) || 150;

// ==========================================
// GET /api/wallet/balance — Get wallet balance
// ==========================================
router.get('/balance', (req, res) => {
    try {
        const user = db.prepare('SELECT star_balance FROM users WHERE user_id = ?').get(req.user.user_id);

        res.json({
            success: true,
            data: {
                starBalance: user.star_balance,
                usdEquivalent: (user.star_balance / STAR_RATE).toFixed(2),
                rate: STAR_RATE
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});

// ==========================================
// POST /api/wallet/buy — Buy StarCoin
// ==========================================
router.post('/buy', (req, res) => {
    try {
        const { amountUsd, paymentMethod } = req.body;

        if (!amountUsd || amountUsd <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid purchase amount.'
            });
        }

        if (amountUsd > 10000) {
            return res.status(400).json({
                success: false,
                error: 'Maximum purchase amount is $10,000.'
            });
        }

        const amountStar = amountUsd * STAR_RATE;
        const transactionId = uuidv4();
        const now = new Date().toISOString();

        // Create transaction
        db.prepare(`
            INSERT INTO transactions (transaction_id, user_id, type, amount_usd, amount_star, status, payment_method, description, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(transactionId, req.user.user_id, 'buy', amountUsd, amountStar, 'pending', paymentMethod || 'USDT', `Purchase ${amountStar.toLocaleString()} STAR for $${amountUsd}`, now);

        // Notification
        db.prepare(`
            INSERT INTO notifications (user_id, title, message, type, created_at)
            VALUES (?, ?, ?, ?, ?)
        `).run(req.user.user_id, 'Purchase Initiated', `Your purchase of ${amountStar.toLocaleString()} STAR ($${amountUsd}) is being processed.`, 'info', now);

        // Activity log
        db.prepare(`
            INSERT INTO activity_log (user_id, action, details, color, created_at)
            VALUES (?, ?, ?, ?, ?)
        `).run(req.user.user_id, 'Purchase initiated', `$${amountUsd} → ${amountStar.toLocaleString()} STAR`, '#667eea', now);

        res.status(201).json({
            success: true,
            message: 'Purchase initiated. Please complete payment.',
            data: {
                transactionId,
                amountUsd,
                amountStar,
                rate: STAR_RATE,
                status: 'pending',
                walletAddress: '0x4fbF173F95F62270CBCcEa4D11135fE469b45128',
                network: 'USDT (BEP20)'
            }
        });
    } catch (err) {
        console.error('Buy error:', err);
        res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});

// ==========================================
// POST /api/wallet/confirm-payment — Confirm payment
// ==========================================
router.post('/confirm-payment', (req, res) => {
    try {
        const { transactionId } = req.body;

        if (!transactionId) {
            return res.status(400).json({
                success: false,
                error: 'Transaction ID is required.'
            });
        }

        const tx = db.prepare('SELECT * FROM transactions WHERE transaction_id = ? AND user_id = ?')
            .get(transactionId, req.user.user_id);

        if (!tx) {
            return res.status(404).json({
                success: false,
                error: 'Transaction not found.'
            });
        }

        if (tx.status !== 'pending') {
            return res.status(400).json({
                success: false,
                error: `Transaction already ${tx.status}.`
            });
        }

        const now = new Date().toISOString();

        // Mark transaction as payment submitted (awaiting admin approval)
        db.prepare('UPDATE transactions SET status = ?, updated_at = ? WHERE transaction_id = ?')
            .run('pending', now, transactionId);

        // Notification
        db.prepare(`
            INSERT INTO notifications (user_id, title, message, type, created_at)
            VALUES (?, ?, ?, ?, ?)
        `).run(req.user.user_id, 'Payment Received', `Please wait 24 hours, your ${tx.amount_star.toLocaleString()} STAR will be credited to your wallet.`, 'info', now);

        // Activity
        db.prepare(`
            INSERT INTO activity_log (user_id, action, details, color, created_at)
            VALUES (?, ?, ?, ?, ?)
        `).run(req.user.user_id, 'Payment received', `Please wait 24 hours — ${tx.amount_star.toLocaleString()} STAR will be credited`, '#f5a623', now);

        res.json({
            success: true,
            message: `Please wait 24 hours, your ${tx.amount_star.toLocaleString()} STAR will be credited to your wallet.`,
            data: {
                transactionId,
                amountStar: tx.amount_star,
                status: 'pending'
            }
        });
    } catch (err) {
        console.error('Confirm payment error:', err);
        res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});

// ==========================================
// POST /api/wallet/request-credit — E-wallet credit request
// ==========================================
router.post('/request-credit', (req, res) => {
    try {
        const { amountStar, paymentMethod, referenceNo } = req.body;

        if (!amountStar || amountStar <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid StarCoin amount.'
            });
        }

        if (!paymentMethod || !referenceNo) {
            return res.status(400).json({
                success: false,
                error: 'Payment method and reference number are required.'
            });
        }

        const requestId = uuidv4();
        const now = new Date().toISOString();

        db.prepare(`
            INSERT INTO wallet_requests (request_id, user_id, amount_star, payment_method, reference_no, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(requestId, req.user.user_id, amountStar, paymentMethod, referenceNo, 'pending', now);

        // Notification
        db.prepare(`
            INSERT INTO notifications (user_id, title, message, type, created_at)
            VALUES (?, ?, ?, ?, ?)
        `).run(req.user.user_id, 'Credit Request Submitted', `Your request for ★${amountStar.toLocaleString()} has been submitted for review.`, 'info', now);

        // Activity
        db.prepare(`
            INSERT INTO activity_log (user_id, action, details, color, created_at)
            VALUES (?, ?, ?, ?, ?)
        `).run(req.user.user_id, 'Credit request', `Requested ★${amountStar.toLocaleString()} via ${paymentMethod}`, '#f093fb', now);

        res.status(201).json({
            success: true,
            message: 'Credit request submitted successfully.',
            data: {
                requestId,
                amountStar,
                paymentMethod,
                referenceNo,
                status: 'pending'
            }
        });
    } catch (err) {
        console.error('Credit request error:', err);
        res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});

// ==========================================
// GET /api/wallet/transactions — Transaction history
// ==========================================
router.get('/transactions', (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const type = req.query.type; // optional filter
        const offset = (page - 1) * limit;

        let query = 'SELECT * FROM transactions WHERE user_id = ?';
        let countQuery = 'SELECT COUNT(*) as count FROM transactions WHERE user_id = ?';
        const params = [req.user.user_id];

        if (type) {
            query += ' AND type = ?';
            countQuery += ' AND type = ?';
            params.push(type);
        }

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';

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
// GET /api/wallet/requests — Wallet credit requests
// ==========================================
router.get('/requests', (req, res) => {
    try {
        const requests = db.prepare(`
            SELECT * FROM wallet_requests
            WHERE user_id = ?
            ORDER BY created_at DESC
        `).all(req.user.user_id);

        res.json({
            success: true,
            data: { requests }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});

module.exports = router;
