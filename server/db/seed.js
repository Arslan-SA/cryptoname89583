// ==========================================
// StarCoin — Database Seeder
// ==========================================
const db = require('./database');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

function generateUserId() {
    return 'SC' + Math.floor(100000 + Math.random() * 900000);
}

function now() {
    return new Date().toISOString();
}

function seedDatabase() {
    console.log('🌱 Seeding database...');

    // Check if already seeded
    const existingUsers = db.prepare('SELECT COUNT(*) as count FROM users').get();
    if (existingUsers.count > 0) {
        console.log('⚡ Database already has data. Skipping seed.');
        return;
    }

    const salt = bcrypt.genSaltSync(10);

    // ========== ADMIN USER ==========
    const adminId = 'SC100000';
    const adminHash = bcrypt.hashSync('admin123', salt);
    db.prepare(`
        INSERT INTO users (user_id, name, email, phone, password_hash, referred_by, star_balance, role, join_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(adminId, 'Admin', 'admin@starcoin.com', '+91-8884635989', adminHash, null, 50000, 'admin', 'Jan 1, 2026');

    // ========== DEMO USERS ==========
    const demoUserId = 'SC200000';
    const demoHash = bcrypt.hashSync('demo123', salt);
    db.prepare(`
        INSERT INTO users (user_id, name, email, phone, password_hash, referred_by, star_balance, role, join_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(demoUserId, 'John Doe', 'demo@starcoin.com', '9999999900', demoHash, adminId, 1250, 'user', 'Mar 15, 2026');

    const userAId = 'SC482910';
    const userAHash = bcrypt.hashSync('demo123', salt);
    db.prepare(`
        INSERT INTO users (user_id, name, email, phone, password_hash, referred_by, star_balance, role, join_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userAId, 'User A', 'usera@demo.com', '9999999901', userAHash, demoUserId, 500, 'user', 'Mar 20, 2026');

    const userBId = 'SC593021';
    const userBHash = bcrypt.hashSync('demo123', salt);
    db.prepare(`
        INSERT INTO users (user_id, name, email, phone, password_hash, referred_by, star_balance, role, join_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userBId, 'User B', 'userb@demo.com', '9999999902', userBHash, userAId, 200, 'user', 'Mar 22, 2026');

    // ========== TRANSACTIONS ==========
    const insertTx = db.prepare(`
        INSERT INTO transactions (transaction_id, user_id, type, amount_usd, amount_star, status, payment_method, description, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertTx.run(uuidv4(), demoUserId, 'buy', 100, 15000, 'confirmed', 'UPI', 'Initial StarCoin purchase', '2026-03-15T10:00:00.000Z');
    insertTx.run(uuidv4(), demoUserId, 'referral_bonus', 0, 50, 'confirmed', null, 'Referral bonus: User A joined', '2026-03-20T12:00:00.000Z');
    insertTx.run(uuidv4(), userAId, 'buy', 50, 7500, 'confirmed', 'NEFT', 'First purchase', '2026-03-20T14:00:00.000Z');

    // ========== NOTIFICATIONS ==========
    const insertNotif = db.prepare(`
        INSERT INTO notifications (user_id, title, message, type, created_at)
        VALUES (?, ?, ?, ?, ?)
    `);

    insertNotif.run(demoUserId, 'Welcome to StarCoin!', 'Your account has been created successfully. Start exploring!', 'success', '2026-03-15T10:00:00.000Z');
    insertNotif.run(demoUserId, 'Referral Bonus', 'You earned ★50 StarCoins from User A joining your network!', 'success', '2026-03-20T12:00:00.000Z');
    insertNotif.run(demoUserId, 'Payment Confirmed', 'Your purchase of 15,000 STAR has been confirmed.', 'info', '2026-03-15T10:30:00.000Z');

    // ========== NEWS ==========
    const insertNews = db.prepare(`
        INSERT INTO news (title, content, summary, icon, gradient, published_at)
        VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertNews.run(
        'StarCoin Reaches $0.85 — New Monthly High!',
        'StarCoin has achieved a new monthly high, surging 12.3% this week. Analysts attribute the growth to increased platform adoption and referral activity.',
        'STAR hits new monthly high with 12.3% surge.',
        'trending_up',
        'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
        '2026-03-25T00:00:00.000Z'
    );

    insertNews.run(
        'StarCoin Platform V2.0 Launched',
        'We\'re excited to announce the launch of StarCoin Platform V2.0 with a brand new dashboard, referral tree visualization, and improved user experience.',
        'Platform V2.0 brings new dashboard and referral features.',
        'rocket_launch',
        'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        '2026-03-18T00:00:00.000Z'
    );

    insertNews.run(
        '10,000 Users Milestone Achieved',
        'The StarCoin community has crossed 10,000 registered users! Thank you for being part of this incredible journey. More rewards are on the way.',
        '10K users milestone reached!',
        'groups',
        'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        '2026-03-10T00:00:00.000Z'
    );

    // ========== PROMOTIONS ==========
    const insertPromo = db.prepare(`
        INSERT INTO promotions (title, description, tag, gradient, valid_until, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertPromo.run(
        'Double StarCoin Week',
        'Get double StarCoins on all purchases this week!',
        'HOT',
        'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        '2026-04-05T23:59:59.000Z',
        now()
    );

    insertPromo.run(
        'Referral Bonus',
        'Earn ★ 50 StarCoins for every new member you refer!',
        'NEW',
        'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        '2026-06-30T23:59:59.000Z',
        now()
    );

    insertPromo.run(
        'Team Growth Bonus',
        'Build a team of 10+ and unlock ★ 500 StarCoin bonus!',
        'EARN',
        'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
        null,
        now()
    );

    // ========== ACTIVITY LOG ==========
    const insertActivity = db.prepare(`
        INSERT INTO activity_log (user_id, action, details, color, created_at)
        VALUES (?, ?, ?, ?, ?)
    `);

    insertActivity.run(demoUserId, 'Account created', 'Welcome to StarCoin!', '#43e97b', '2026-03-15T10:00:00.000Z');
    insertActivity.run(demoUserId, 'Referral link ready', 'Your referral link is ready', '#4facfe', '2026-03-15T10:01:00.000Z');
    insertActivity.run(demoUserId, 'New referral', 'User A joined your network', '#667eea', '2026-03-20T12:00:00.000Z');
    insertActivity.run(demoUserId, 'Network growth', 'User B joined via User A', '#f093fb', '2026-03-22T14:00:00.000Z');

    console.log('✅ Database seeded successfully!');
    console.log('   👤 Admin: admin@starcoin.com / admin123');
    console.log('   👤 Demo:  demo@starcoin.com / demo123');
}

module.exports = seedDatabase;

// Run directly
if (require.main === module) {
    seedDatabase();
}
