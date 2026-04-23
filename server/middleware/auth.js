// ==========================================
// StarCoin — JWT Authentication Middleware
// ==========================================
const jwt = require('jsonwebtoken');
const db = require('../db/database');

const JWT_SECRET = process.env.JWT_SECRET || 'starcoin_super_secret_key_change_in_production_2026';

/**
 * Middleware: Authenticate JWT token
 * Attaches user object to req.user
 */
function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            error: 'Access denied. No token provided.'
        });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = db.prepare('SELECT * FROM users WHERE user_id = ? AND status = ?').get(decoded.userId, 'active');

        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Invalid token. User not found or inactive.'
            });
        }

        // Attach user (without password hash) to request
        const { password_hash, ...safeUser } = user;
        req.user = safeUser;
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                error: 'Token expired. Please login again.'
            });
        }
        return res.status(401).json({
            success: false,
            error: 'Invalid token.'
        });
    }
}

/**
 * Middleware: Require admin role
 */
function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            error: 'Access denied. Admin privileges required.'
        });
    }
    next();
}

/**
 * Generate JWT token for a user
 */
function generateToken(userId) {
    return jwt.sign(
        { userId },
        JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
}

module.exports = { authenticate, requireAdmin, generateToken };
