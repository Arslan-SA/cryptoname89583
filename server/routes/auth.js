// ==========================================
// StarCoin — Auth Routes (Login / Register)
// ==========================================
const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { authenticate, generateToken } = require('../middleware/auth');

const router = express.Router();

function generateUserId() {
    let id;
    do {
        id = 'SC' + Math.floor(100000 + Math.random() * 900000);
    } while (db.prepare('SELECT 1 FROM users WHERE user_id = ?').get(id));
    return id;
}

function formatDate(date) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ==========================================
// POST /api/auth/register
// ==========================================
router.post('/register', (req, res) => {
    try {
        const { name, email, phone, password, referralCode } = req.body;

        // Validation
        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Name, email, and password are required.'
            });
        }

        if (!referralCode) {
            return res.status(400).json({
                success: false,
                error: 'Referral code is required.'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                error: 'Password must be at least 6 characters.'
            });
        }

        // Check email uniqueness
        const existing = db.prepare('SELECT 1 FROM users WHERE email = ?').get(email);
        if (existing) {
            return res.status(409).json({
                success: false,
                error: 'Email already registered.'
            });
        }

        // Validate referral code if provided
        if (referralCode) {
            const referrer = db.prepare('SELECT user_id FROM users WHERE user_id = ?').get(referralCode);
            if (!referrer) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid referral code.'
                });
            }
        }

        // Create user
        const userId = generateUserId();
        const passwordHash = bcrypt.hashSync(password, 10);
        const joinDate = formatDate(new Date());

        db.prepare(`
            INSERT INTO users (user_id, name, email, phone, password_hash, referred_by, star_balance, join_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(userId, name, email, phone || null, passwordHash, referralCode || null, 0, joinDate);

        // Create welcome notification
        db.prepare(`
            INSERT INTO notifications (user_id, title, message, type, created_at)
            VALUES (?, ?, ?, ?, ?)
        `).run(userId, 'Welcome to StarCoin!', 'Your account has been created successfully. Start exploring the StarCoin ecosystem!', 'success', new Date().toISOString());

        // Log activity
        db.prepare(`
            INSERT INTO activity_log (user_id, action, details, color, created_at)
            VALUES (?, ?, ?, ?, ?)
        `).run(userId, 'Account created', 'Welcome to StarCoin!', '#43e97b', new Date().toISOString());

        db.prepare(`
            INSERT INTO activity_log (user_id, action, details, color, created_at)
            VALUES (?, ?, ?, ?, ?)
        `).run(userId, 'Referral link ready', 'Your referral link is ready to share', '#4facfe', new Date().toISOString());

        // Give referral bonus to referrer
        if (referralCode) {
            const REFERRAL_BONUS = 50;
            db.prepare('UPDATE users SET star_balance = star_balance + ? WHERE user_id = ?').run(REFERRAL_BONUS, referralCode);

            db.prepare(`
                INSERT INTO transactions (transaction_id, user_id, type, amount_usd, amount_star, status, description, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(uuidv4(), referralCode, 'referral_bonus', 0, REFERRAL_BONUS, 'confirmed', `Referral bonus: ${name} joined your network`, new Date().toISOString());

            db.prepare(`
                INSERT INTO notifications (user_id, title, message, type, created_at)
                VALUES (?, ?, ?, ?, ?)
            `).run(referralCode, 'New Referral!', `${name} joined your network! You earned ★${REFERRAL_BONUS} StarCoins.`, 'success', new Date().toISOString());

            db.prepare(`
                INSERT INTO activity_log (user_id, action, details, color, created_at)
                VALUES (?, ?, ?, ?, ?)
            `).run(referralCode, 'New referral', `${name} joined your network`, '#667eea', new Date().toISOString());
        }

        // Generate token
        const token = generateToken(userId);

        const user = db.prepare('SELECT * FROM users WHERE user_id = ?').get(userId);
        const { password_hash, ...safeUser } = user;

        res.status(201).json({
            success: true,
            message: 'Account created successfully!',
            data: {
                user: safeUser,
                token
            }
        });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({
            success: false,
            error: 'Internal server error.'
        });
    }
});

// ==========================================
// POST /api/auth/login
// ==========================================
router.post('/login', (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email and password are required.'
            });
        }

        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password.'
            });
        }

        if (user.status !== 'active') {
            return res.status(403).json({
                success: false,
                error: 'Account is suspended or inactive.'
            });
        }

        const validPassword = bcrypt.compareSync(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password.'
            });
        }

        const token = generateToken(user.user_id);
        const { password_hash, ...safeUser } = user;

        // Log activity
        db.prepare(`
            INSERT INTO activity_log (user_id, action, details, color, created_at)
            VALUES (?, ?, ?, ?, ?)
        `).run(user.user_id, 'Login', 'Logged into dashboard', '#4facfe', new Date().toISOString());

        res.json({
            success: true,
            message: 'Login successful!',
            data: {
                user: safeUser,
                token
            }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({
            success: false,
            error: 'Internal server error.'
        });
    }
});

// ==========================================
// GET /api/auth/me — Get current user
// ==========================================
router.get('/me', authenticate, (req, res) => {
    res.json({
        success: true,
        data: { user: req.user }
    });
});

// ==========================================
// POST /api/auth/change-password
// ==========================================
router.post('/change-password', authenticate, (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                error: 'Current and new password are required.'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                error: 'New password must be at least 6 characters.'
            });
        }

        const user = db.prepare('SELECT password_hash FROM users WHERE user_id = ?').get(req.user.user_id);
        const valid = bcrypt.compareSync(currentPassword, user.password_hash);

        if (!valid) {
            return res.status(401).json({
                success: false,
                error: 'Current password is incorrect.'
            });
        }

        const newHash = bcrypt.hashSync(newPassword, 10);
        db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE user_id = ?')
            .run(newHash, new Date().toISOString(), req.user.user_id);

        res.json({
            success: true,
            message: 'Password changed successfully.'
        });
    } catch (err) {
        console.error('Change password error:', err);
        res.status(500).json({
            success: false,
            error: 'Internal server error.'
        });
    }
});

module.exports = router;
