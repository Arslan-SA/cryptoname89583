/* ==========================================
   StarCoin Dashboard — JavaScript v3
   Now connected to Express/SQLite Backend API
   ========================================== */

// ==========================================
// API Helper
// ==========================================
const API_BASE = '/api';

async function api(endpoint, options = {}) {
    const token = localStorage.getItem('starcoin_token');
    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...options.headers
    };

    try {
        const res = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || `API error: ${res.status}`);
        }

        return data;
    } catch (err) {
        if (err.message.includes('Token expired') || err.message.includes('Access denied') || err.message.includes('Invalid token')) {
            localStorage.removeItem('starcoin_token');
            localStorage.removeItem('starcoin_user');
            location.reload();
        }
        throw err;
    }
}

// Session helpers
function getToken() {
    return localStorage.getItem('starcoin_token');
}
function getUser() {
    return JSON.parse(localStorage.getItem('starcoin_user') || 'null');
}
function setAuth(user, token) {
    localStorage.setItem('starcoin_token', token);
    localStorage.setItem('starcoin_user', JSON.stringify(user));
}
function clearAuth() {
    localStorage.removeItem('starcoin_token');
    localStorage.removeItem('starcoin_user');
}
function generateReferralLink(userId) {
    return `${window.location.origin}?ref=${userId}`;
}

// ==========================================
// DOM READY
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const loginScreen = document.getElementById('loginScreen');
    const appWrapper = document.getElementById('appWrapper');

    // Check URL for referral code
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');

    // Check session
    const token = getToken();
    const user = getUser();
    if (token && user) {
        verifyAndShowApp(user);
    } else {
        showLogin();
        if (refCode) {
            document.getElementById('regReferral').value = refCode;
            switchTab('register');
        }
    }

    // Verify token is still valid, then show app
    async function verifyAndShowApp(cachedUser) {
        try {
            const result = await api('/auth/me');
            setAuth(result.data.user, getToken());
            showApp(result.data.user);
        } catch {
            // Token invalid, show login
            clearAuth();
            showLogin();
        }
    }

    // ==========================================
    // GALAXY CANVAS — Interactive Star Field
    // ==========================================
    (function initGalaxy() {
        const canvas = document.getElementById('galaxyCanvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const panel = document.getElementById('galaxyPanel');
        let W, H, dpr;
        let mouse = { x: -1000, y: -1000 };
        let stars = [];
        let orbiters = [];
        let coinImg = null;
        let coinLoaded = false;
        let time = 0;

        const img = new Image();
        img.src = 'starcoin.png';
        img.onload = () => { coinImg = img; coinLoaded = true; };

        function resize() {
            dpr = window.devicePixelRatio || 1;
            W = panel.clientWidth;
            H = panel.clientHeight;
            canvas.width = W * dpr;
            canvas.height = H * dpr;
            canvas.style.width = W + 'px';
            canvas.style.height = H + 'px';
            ctx.scale(dpr, dpr);
            if (stars.length === 0) createStars();
        }

        function createStars() {
            stars = [];
            const count = Math.min(350, Math.floor((W * H) / 2500));
            for (let i = 0; i < count; i++) {
                stars.push({
                    x: Math.random() * W,
                    y: Math.random() * H,
                    r: Math.random() * 1.8 + 0.3,
                    baseAlpha: Math.random() * 0.6 + 0.2,
                    alpha: 0,
                    twinkleSpeed: Math.random() * 0.02 + 0.005,
                    twinkleOffset: Math.random() * Math.PI * 2,
                    hue: Math.random() < 0.15 ? 45 : (Math.random() < 0.3 ? 220 : 0),
                    sat: Math.random() < 0.3 ? Math.random() * 40 + 20 : 0
                });
            }
            orbiters = [];
            for (let i = 0; i < 24; i++) {
                orbiters.push({
                    angle: (Math.PI * 2 / 24) * i + Math.random() * 0.5,
                    dist: Math.random() * 60 + 30,
                    speed: (Math.random() * 0.02 + 0.008) * (Math.random() < 0.5 ? 1 : -1),
                    r: Math.random() * 1.5 + 0.5,
                    alpha: Math.random() * 0.5 + 0.3,
                    trail: []
                });
            }
        }

        panel.addEventListener('mousemove', (e) => {
            const rect = panel.getBoundingClientRect();
            mouse.x = e.clientX - rect.left;
            mouse.y = e.clientY - rect.top;
        });
        panel.addEventListener('mouseleave', () => {
            mouse.x = -1000;
            mouse.y = -1000;
        });

        function drawNebulaGlow(cx, cy) {
            const g1 = ctx.createRadialGradient(cx, cy, 0, cx, cy, 200);
            g1.addColorStop(0, 'rgba(161,250,255,0.06)');
            g1.addColorStop(0.3, 'rgba(0,229,238,0.03)');
            g1.addColorStop(0.6, 'rgba(172,137,255,0.02)');
            g1.addColorStop(1, 'transparent');
            ctx.fillStyle = g1;
            ctx.fillRect(cx - 200, cy - 200, 400, 400);

            const g2 = ctx.createRadialGradient(cx + 100, cy - 80, 0, cx + 100, cy - 80, 160);
            g2.addColorStop(0, 'rgba(213,117,255,0.04)');
            g2.addColorStop(1, 'transparent');
            ctx.fillStyle = g2;
            ctx.fillRect(cx - 100, cy - 250, 400, 400);
        }

        function drawStar(x, y, r, alpha, hue, sat) {
            const color = sat > 0 ? `hsla(${hue},${sat}%,80%,${alpha})` : `rgba(255,255,255,${alpha})`;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            if (r > 1) {
                ctx.beginPath();
                ctx.arc(x, y, r * 2.5, 0, Math.PI * 2);
                const glowColor = sat > 0 ? `hsla(${hue},${sat}%,85%,${alpha * 0.15})` : `rgba(255,255,255,${alpha * 0.15})`;
                ctx.fillStyle = glowColor;
                ctx.fill();
            }
        }

        function drawCursorOrbit() {
            if (mouse.x < 0) return;
            const glow = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 90);
            glow.addColorStop(0, 'rgba(161,250,255,0.05)');
            glow.addColorStop(0.5, 'rgba(161,250,255,0.02)');
            glow.addColorStop(1, 'transparent');
            ctx.fillStyle = glow;
            ctx.fillRect(mouse.x - 90, mouse.y - 90, 180, 180);

            orbiters.forEach(o => {
                o.angle += o.speed;
                const ox = mouse.x + Math.cos(o.angle) * o.dist;
                const oy = mouse.y + Math.sin(o.angle) * o.dist;
                o.trail.push({ x: ox, y: oy });
                if (o.trail.length > 6) o.trail.shift();
                for (let t = 0; t < o.trail.length; t++) {
                    const ta = (t / o.trail.length) * o.alpha * 0.3;
                    ctx.beginPath();
                    ctx.arc(o.trail[t].x, o.trail[t].y, o.r * 0.6, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(161,250,255,${ta})`;
                    ctx.fill();
                }
                ctx.beginPath();
                ctx.arc(ox, oy, o.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(200,250,255,${o.alpha})`;
                ctx.fill();
                ctx.beginPath();
                ctx.arc(ox, oy, o.r * 2, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(161,250,255,${o.alpha * 0.15})`;
                ctx.fill();
            });
        }

        function drawStarCoin(cx, cy) {
            if (!coinLoaded) return;
            const pulse = Math.sin(time * 0.015) * 0.08 + 1;
            const size = 100 * pulse;
            for (let i = 3; i >= 1; i--) {
                const glowSize = size + i * 25;
                const alpha = 0.03 / i;
                ctx.beginPath();
                ctx.arc(cx, cy, glowSize / 2, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(161,250,255,${alpha})`;
                ctx.fill();
            }
            ctx.save();
            ctx.globalAlpha = 0.9;
            ctx.drawImage(coinImg, cx - size / 2, cy - size / 2, size, size);
            ctx.restore();
        }

        function attractStar(star) {
            if (mouse.x < 0) return;
            const dx = mouse.x - star.x;
            const dy = mouse.y - star.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 150) {
                const force = (150 - dist) / 150;
                const angle = Math.atan2(dy, dx);
                star.x += Math.cos(angle + Math.PI / 2) * force * 0.3;
                star.y += Math.sin(angle + Math.PI / 2) * force * 0.3;
                star.alpha = Math.min(1, star.baseAlpha + force * 0.5);
            }
        }

        function animate() {
            time++;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, W, H);

            const bg = ctx.createLinearGradient(0, 0, W, H);
            bg.addColorStop(0, '#030510');
            bg.addColorStop(0.5, '#060a1a');
            bg.addColorStop(1, '#0a0820');
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, W, H);

            const coinCX = W * 0.5;
            const coinCY = H * 0.42;
            drawNebulaGlow(coinCX, coinCY);

            stars.forEach(s => {
                s.alpha = s.baseAlpha + Math.sin(time * s.twinkleSpeed + s.twinkleOffset) * 0.2;
                attractStar(s);
                drawStar(s.x, s.y, s.r, Math.max(0, s.alpha), s.hue, s.sat);
            });

            drawStarCoin(coinCX, coinCY);
            drawCursorOrbit();

            requestAnimationFrame(animate);
        }

        resize();
        window.addEventListener('resize', () => {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            resize();
        });
        animate();
    })();

    // ==========================================
    // LOGIN TABS
    // ==========================================
    document.getElementById('tabLogin').addEventListener('click', () => switchTab('login'));
    document.getElementById('tabRegister').addEventListener('click', () => switchTab('register'));

    function switchTab(tab) {
        document.getElementById('tabLogin').classList.toggle('active', tab === 'login');
        document.getElementById('tabRegister').classList.toggle('active', tab === 'register');
        document.getElementById('loginForm').classList.toggle('hidden', tab !== 'login');
        document.getElementById('registerForm').classList.toggle('hidden', tab !== 'register');
        document.getElementById('loginError').textContent = '';
        document.getElementById('registerError').textContent = '';
    }

    // ==========================================
    // LOGIN FORM — API call
    // ==========================================
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;
        const errorEl = document.getElementById('loginError');
        const btn = document.getElementById('loginBtn');

        btn.disabled = true;
        btn.querySelector('span:first-child').textContent = 'Signing In...';

        try {
            const result = await api('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });

            setAuth(result.data.user, result.data.token);
            showApp(result.data.user);
        } catch (err) {
            errorEl.textContent = err.message || 'Invalid email or password.';
        } finally {
            btn.disabled = false;
            btn.querySelector('span:first-child').textContent = 'Sign In';
        }
    });

    // ==========================================
    // REGISTER FORM — API call
    // ==========================================
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('regName').value.trim();
        const email = document.getElementById('regEmail').value.trim();
        const phone = document.getElementById('regPhone').value.trim();
        const password = document.getElementById('regPassword').value;
        const referralCode = document.getElementById('regReferral').value.trim();
        const errorEl = document.getElementById('registerError');
        const btn = document.getElementById('registerBtn');

        if (!name || !email || !phone || !password || !referralCode) {
            errorEl.textContent = 'Please fill all required fields, including Referral Code.';
            return;
        }

        btn.disabled = true;
        btn.querySelector('span:first-child').textContent = 'Creating Account...';

        try {
            const result = await api('/auth/register', {
                method: 'POST',
                body: JSON.stringify({ name, email, phone, password, referralCode })
            });

            setAuth(result.data.user, result.data.token);
            showApp(result.data.user);
        } catch (err) {
            errorEl.textContent = err.message || 'Registration failed.';
        } finally {
            btn.disabled = false;
            btn.querySelector('span:first-child').textContent = 'Create Account';
        }
    });

    // ==========================================
    // SHOW LOGIN / SHOW APP
    // ==========================================
    function showLogin() {
        loginScreen.classList.remove('hidden');
        loginScreen.style.display = '';
        appWrapper.classList.add('hidden');
    }

    function showApp(user) {
        loginScreen.classList.add('hidden');
        loginScreen.style.display = 'none';
        appWrapper.classList.remove('hidden');
        appWrapper.style.display = '';
        populateDashboard(user);
        initAppLogic(user);
    }

    // ==========================================
    // POPULATE DASHBOARD — from API
    // ==========================================
    async function populateDashboard(user) {
        // Set initial data from user object
        const welcomeEl = document.getElementById('welcomeHeading');
        if (welcomeEl) welcomeEl.textContent = `Welcome Back, ${user.name}!`;

        const balanceEl = document.getElementById('walletBalanceAmount');
        if (balanceEl) balanceEl.textContent = `★ ${(user.star_balance || 0).toLocaleString()}`;

        const idInputs = ['iboUserId', 'ewalletIboId', 'ewalletReqUserId'];
        idInputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = user.user_id;
        });

        const ewalletName = document.getElementById('ewalletReqName');
        if (ewalletName) ewalletName.value = user.name;

        const refInput = document.getElementById('referralLinkInput');
        if (refInput) refInput.value = generateReferralLink(user.user_id);

        // Welcome letter
        const letterName = document.getElementById('letterUserName');
        if (letterName) letterName.textContent = user.name;
        const letterId = document.getElementById('letterUserId');
        if (letterId) letterId.textContent = user.user_id;
        const letterDate = document.getElementById('letterDate');
        if (letterDate) letterDate.textContent = user.join_date || new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

        // Profile view
        const profileDetails = document.getElementById('profileDetails');
        if (profileDetails) {
            profileDetails.innerHTML = `
                <div class="profile-row"><span class="profile-label">Name</span><span class="profile-value">${user.name}</span></div>
                <div class="profile-row"><span class="profile-label">Email</span><span class="profile-value">${user.email}</span></div>
                <div class="profile-row"><span class="profile-label">Phone</span><span class="profile-value">${user.phone || 'N/A'}</span></div>
                <div class="profile-row"><span class="profile-label">User ID</span><span class="profile-value">${user.user_id}</span></div>
                <div class="profile-row"><span class="profile-label">Joined</span><span class="profile-value">${user.join_date}</span></div>
                <div class="profile-row"><span class="profile-label">Star Balance</span><span class="profile-value">★ ${(user.star_balance || 0).toLocaleString()}</span></div>
                <div class="profile-row"><span class="profile-label">Referral Link</span><span class="profile-value" style="font-size:12px;word-break:break-all">${generateReferralLink(user.user_id)}</span></div>
            `;
        }

        // Profile edit
        const editName = document.getElementById('editName');
        if (editName) editName.value = user.name;
        const editPhone = document.getElementById('editPhone');
        if (editPhone) editPhone.value = user.phone || '';

        // Fetch dashboard data from API
        try {
            const dashResult = await api('/users/dashboard');
            const dash = dashResult.data;

            // Update stat cards
            const balStat = document.querySelector('[data-count]');
            if (balStat && balStat.dataset.prefix === '★ ') {
                balStat.dataset.count = dash.starBalance || 0;
            }

            const teamStat = document.getElementById('teamSizeStat');
            if (teamStat) teamStat.dataset.count = dash.totalTeam || 0;
            const refStat = document.getElementById('referralsStat');
            if (refStat) refStat.dataset.count = dash.directReferrals || 0;

            // Update wallet balance
            if (balanceEl) balanceEl.textContent = `★ ${(dash.starBalance || 0).toLocaleString()}`;

            // Update USD equivalent
            const usdEl = document.querySelector('.wallet-balance-usd');
            if (usdEl) {
                const usdValue = (dash.starBalance / 150).toFixed(2);
                usdEl.textContent = `≈ $${parseFloat(usdValue).toLocaleString()} USD`;
            }

            // Notification badge
            const badge = document.querySelector('.notification-badge');
            if (badge) {
                badge.textContent = dash.unreadNotifications || 0;
                badge.style.display = dash.unreadNotifications > 0 ? 'flex' : 'none';
            }

            // Activity list
            if (dash.activities && dash.activities.length > 0) {
                const activityList = document.querySelector('.activity-list');
                if (activityList) {
                    activityList.innerHTML = dash.activities.map(a => `
                        <div class="activity-item">
                            <div class="activity-dot" style="background: ${a.color}"></div>
                            <div class="activity-content">
                                <p><strong>${a.action}</strong> — ${a.details || ''}</p>
                                <span class="activity-time">${a.time}</span>
                            </div>
                        </div>
                    `).join('');
                }
            }
        } catch (err) {
            console.warn('Failed to load dashboard data:', err.message);
        }

        // Fetch and render referral tree from API
        try {
            const treeResult = await api('/users/team/tree');
            if (treeResult.data.tree) {
                renderTree('treeContainer', treeResult.data.tree, user.user_id);
                renderTree('treeContainerPage', treeResult.data.tree, user.user_id);
            }
        } catch (err) {
            console.warn('Failed to load team tree:', err.message);
        }

        // Fetch and render direct referrals from API
        try {
            const directResult = await api('/users/team/direct');
            const directBody = document.getElementById('directTeamBody');
            if (directBody && directResult.data.referrals) {
                directBody.innerHTML = directResult.data.referrals.map((ref, i) => `
                    <tr>
                        <td>${i + 1}</td>
                        <td>${ref.name}</td>
                        <td>${ref.user_id}</td>
                        <td>${ref.join_date}</td>
                        <td><span class="badge badge-success">${ref.status === 'active' ? 'Active' : ref.status}</span></td>
                    </tr>
                `).join('');
            }
        } catch (err) {
            console.warn('Failed to load direct referrals:', err.message);
        }

        // Fetch news from API
        try {
            const newsResult = await api('/content/news');
            const newsGrid = document.querySelector('#page-news .news-grid');
            if (newsGrid && newsResult.data.news) {
                newsGrid.innerHTML = newsResult.data.news.map((item, i) => `
                    <div class="news-card animate-in" style="--delay: ${0.1 * (i + 1)}s">
                        <div class="news-image" style="background: ${item.gradient};">
                            <span class="material-icons-outlined">${item.icon}</span>
                        </div>
                        <div class="news-content">
                            <span class="news-date">${item.formattedDate}</span>
                            <h3>${item.title}</h3>
                            <p>${item.content}</p>
                            <a href="#" class="news-link">Read More →</a>
                        </div>
                    </div>
                `).join('');
            }
        } catch (err) {
            console.warn('Failed to load news:', err.message);
        }

        // Fetch promotions from API
        try {
            const promoResult = await api('/content/promotions');
            const promoGrid = document.querySelector('#page-promotion .promotions-grid');
            if (promoGrid && promoResult.data.promotions) {
                promoGrid.innerHTML = promoResult.data.promotions.map((item, i) => `
                    <div class="promo-card animate-in" style="--delay: ${0.1 * (i + 1)}s">
                        <div class="promo-banner" style="background: ${item.gradient};">
                            <span class="promo-tag">${item.tag}</span>
                            <h3>${item.title}</h3>
                            <p>${item.description}</p>
                        </div>
                        <div class="promo-details">
                            <span class="promo-validity">${item.formattedValidity}</span>
                            <button class="btn btn-outline btn-sm">Learn More</button>
                        </div>
                    </div>
                `).join('');
            }
        } catch (err) {
            console.warn('Failed to load promotions:', err.message);
        }
    }

    // ==========================================
    // RENDER REFERRAL TREE — from API data
    // ==========================================
    function renderTree(containerId, treeData, currentUserId) {
        const container = document.getElementById(containerId);
        if (!container || !treeData) return;

        function buildNode(node) {
            const isRoot = node.userId === currentUserId;
            let html = `<div class="tree-node">`;
            html += `<div class="tree-node-content ${isRoot ? 'root' : ''}">`;
            html += `<div class="tree-node-name">${isRoot ? node.name + ' (You)' : node.name}</div>`;
            html += `<div class="tree-node-id">${node.userId}</div>`;
            html += `</div>`;

            if (node.children && node.children.length > 0) {
                html += `<div class="tree-connector"></div>`;
                html += `<div class="tree-children">`;
                node.children.forEach(child => {
                    html += `<div style="display:flex;flex-direction:column;align-items:center">`;
                    html += `<div class="tree-branch-connector"></div>`;
                    html += buildNode(child);
                    html += `</div>`;
                });
                html += `</div>`;
            }
            html += `</div>`;
            return html;
        }

        container.innerHTML = buildNode(treeData);
    }

    // ==========================================
    // APP LOGIC (navigation, charts, etc)
    // ==========================================
    function initAppLogic(currentUser) {
        const sidebar = document.getElementById('sidebar');
        const sidebarOverlay = document.getElementById('sidebarOverlay');
        const menuToggle = document.getElementById('menuToggle');
        const breadcrumbCurrent = document.getElementById('breadcrumbCurrent');
        const toastContainer = document.getElementById('toastContainer');
        const navItems = document.querySelectorAll('.nav-item');
        const pages = document.querySelectorAll('.page');

        const pageTitles = {
            'dashboard': 'Dashboard', 'profile': 'Profile', 'profile-view': 'View Profile',
            'profile-edit': 'Edit Profile', 'team': 'Referral Tree', 'team-tree': 'Referral Tree',
            'team-direct': 'Direct Referrals', 'coin-buy': 'Buy StarCoin',
            'ewallet': 'E-Wallet', 'ewallet-request': 'Add Coins', 'ewallet-status': 'Coin Balance',
            'documents': 'Documents', 'documents-welcome': 'Welcome Letter', 'documents-bank': 'Bank Account',
            'promotion': 'Promotion', 'news': 'StarCoin News'
        };

        function navigateToPage(pageId) {
            pages.forEach(page => page.classList.remove('active'));
            const targetPage = document.getElementById(`page-${pageId}`);
            if (targetPage) {
                targetPage.classList.add('active');
                targetPage.querySelectorAll('.animate-in').forEach(el => {
                    el.style.animation = 'none'; void el.offsetHeight; el.style.animation = '';
                });
                targetPage.querySelectorAll('.stat-card').forEach(card => {
                    card.style.animation = 'none'; void card.offsetHeight; card.style.animation = '';
                });
            }
            navItems.forEach(item => item.classList.remove('active'));
            breadcrumbCurrent.textContent = pageTitles[pageId] || pageId;
            closeSidebar();
            if (pageId === 'dashboard') setTimeout(() => animateCounters(), 300);
        }

        navItems.forEach(item => {
            const link = item.querySelector('.nav-link');
            const pageId = item.dataset.page;
            link.addEventListener('click', (e) => {
                e.preventDefault();
                if (item.classList.contains('has-submenu')) {
                    const wasOpen = item.classList.contains('open');
                    navItems.forEach(other => { if (other !== item) other.classList.remove('open'); });
                    item.classList.toggle('open');
                    if (!wasOpen) { item.classList.add('active'); navigateToPage(pageId); }
                } else {
                    item.classList.add('active');
                    navigateToPage(pageId);
                }
            });
            item.querySelectorAll('.submenu a').forEach(subLink => {
                subLink.addEventListener('click', (e) => {
                    e.preventDefault(); e.stopPropagation();
                    document.querySelectorAll('.submenu a').forEach(a => a.classList.remove('active-sub'));
                    subLink.classList.add('active-sub');
                    navItems.forEach(ni => ni.classList.remove('active'));
                    item.classList.add('active');
                    navigateToPage(subLink.dataset.page);
                });
            });
        });

        function openSidebar() { sidebar.classList.add('open'); sidebarOverlay.classList.add('active'); document.body.style.overflow = 'hidden'; }
        function closeSidebar() { sidebar.classList.remove('open'); sidebarOverlay.classList.remove('active'); document.body.style.overflow = ''; }
        menuToggle.addEventListener('click', () => { sidebar.classList.contains('open') ? closeSidebar() : openSidebar(); });
        sidebarOverlay.addEventListener('click', closeSidebar);

        // Counters
        function animateCounters() {
            document.querySelectorAll('.stat-value').forEach(counter => {
                const target = parseInt(counter.dataset.count);
                const prefix = counter.dataset.prefix || '';
                if (isNaN(target)) return;
                const duration = 1500; const startTime = performance.now();
                function update(currentTime) {
                    const elapsed = currentTime - startTime;
                    const progress = Math.min(elapsed / duration, 1);
                    const eased = 1 - Math.pow(1 - progress, 3);
                    counter.textContent = prefix + Math.round(eased * target).toLocaleString('en-IN');
                    if (progress < 1) requestAnimationFrame(update);
                }
                requestAnimationFrame(update);
            });
        }
        setTimeout(() => animateCounters(), 500);

        // Toast
        function showToast(message, icon = 'check_circle') {
            const toast = document.createElement('div');
            toast.classList.add('toast');
            toast.innerHTML = `<span class="material-icons-outlined">${icon}</span><span>${message}</span>`;
            toastContainer.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);
        }

        // Copy referral
        const copyBtn = document.getElementById('copyReferralBtn');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                const input = document.getElementById('referralLinkInput');
                navigator.clipboard.writeText(input.value).then(() => showToast('Referral link copied!'));
            });
        }

        // Logout — clear token
        document.getElementById('logoutBtn').addEventListener('click', (e) => {
            e.preventDefault();
            clearAuth();
            showToast('Logging out...', 'logout');
            setTimeout(() => location.reload(), 1000);
        });

        // E-wallet form — API call
        const ewalletForm = document.getElementById('ewalletRequestForm');
        if (ewalletForm) {
            ewalletForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const amountInput = ewalletForm.querySelector('input[type="number"]');
                const paymentSelect = ewalletForm.querySelector('select');
                const referenceInput = ewalletForm.querySelectorAll('.form-input')[4]; // reference no input

                const amountStar = parseFloat(amountInput?.value) || 0;
                const paymentMethod = paymentSelect?.value || '';
                const referenceNo = referenceInput?.value?.trim() || '';

                if (!amountStar || paymentMethod === 'Select Mode Of Payment' || !referenceNo) {
                    showToast('Please fill all fields correctly.', 'error');
                    return;
                }

                try {
                    await api('/wallet/request-credit', {
                        method: 'POST',
                        body: JSON.stringify({ amountStar, paymentMethod, referenceNo })
                    });
                    showToast('Coin credit request submitted!');
                    ewalletForm.reset();
                    // Re-fill readonly fields
                    document.getElementById('ewalletReqUserId').value = currentUser.user_id;
                    document.getElementById('ewalletReqName').value = currentUser.name;
                } catch (err) {
                    showToast(err.message || 'Request failed.', 'error');
                }
            });
        }

        // Edit profile — API call
        const editForm = document.getElementById('editProfileForm');
        if (editForm) {
            editForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const name = document.getElementById('editName').value.trim();
                const phone = document.getElementById('editPhone').value.trim();

                try {
                    const result = await api('/users/profile', {
                        method: 'PUT',
                        body: JSON.stringify({ name, phone })
                    });

                    setAuth(result.data.user, getToken());
                    populateDashboard(result.data.user);
                    showToast('Profile updated!');
                } catch (err) {
                    showToast(err.message || 'Profile update failed.', 'error');
                }
            });
        }

        // StarCoin buy
        const starInput = document.getElementById('starAmountInput');
        const starReceive = document.getElementById('starReceiveAmount');
        const STAR_RATE = 150;

        function updateReceive() {
            const amount = parseFloat(starInput.value) || 0;
            const receive = amount * STAR_RATE;
            starReceive.textContent = receive > 0 ? `~${receive.toLocaleString()} STAR` : '~0 STAR';
        }
        if (starInput) {
            starInput.addEventListener('input', updateReceive);
            updateReceive();
        }

        // Package buttons
        document.querySelectorAll('.pkg-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.pkg-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                starInput.value = btn.dataset.amount;
                updateReceive();
            });
        });

        // Buy button — API call
        const buyBtn = document.getElementById('buyStarBtn');
        const paymentModal = document.getElementById('paymentModalOverlay');
        const closeModalBtn = document.getElementById('closeModalBtn');
        const confirmBtn = document.getElementById('confirmPaymentBtn');
        let currentTransactionId = null;

        if (buyBtn) {
            buyBtn.addEventListener('click', async () => {
                const amount = parseFloat(starInput.value);
                if (!amount || amount <= 0) { showToast('Enter a valid amount', 'error'); return; }

                try {
                    const result = await api('/wallet/buy', {
                        method: 'POST',
                        body: JSON.stringify({ amountUsd: amount, paymentMethod: 'USDT' })
                    });

                    currentTransactionId = result.data.transactionId;
                    paymentModal.classList.add('active');
                } catch (err) {
                    showToast(err.message || 'Purchase failed.', 'error');
                }
            });
        }

        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', () => {
                paymentModal.classList.remove('active');
            });
        }

        if (confirmBtn) {
            confirmBtn.addEventListener('click', async () => {
                if (!currentTransactionId) {
                    showToast('No pending transaction.', 'error');
                    return;
                }

                confirmBtn.disabled = true;
                confirmBtn.querySelector('span').textContent = 'done';

                try {
                    const result = await api('/wallet/confirm-payment', {
                        method: 'POST',
                        body: JSON.stringify({ transactionId: currentTransactionId })
                    });

                    paymentModal.classList.remove('active');
                    showToast(result.message || 'Please wait 24 hours, your coin will be credited.', 'schedule');

                    currentTransactionId = null;
                } catch (err) {
                    showToast(err.message || 'Payment confirmation failed.', 'error');
                } finally {
                    confirmBtn.disabled = false;
                    confirmBtn.querySelector('span').textContent = 'check_circle';
                }
            });
        }

        // Chart
        drawSalesChart();
        let resizeTimeout;
        window.addEventListener('resize', () => { clearTimeout(resizeTimeout); resizeTimeout = setTimeout(drawSalesChart, 200); });

        // Keyboard
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSidebar(); });
    }

    // ==========================================
    // CHART
    // ==========================================
    function drawSalesChart() {
        const canvas = document.getElementById('salesChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const container = canvas.parentElement;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = container.clientWidth * dpr;
        canvas.height = container.clientHeight * dpr;
        canvas.style.width = container.clientWidth + 'px';
        canvas.style.height = container.clientHeight + 'px';
        ctx.scale(dpr, dpr);
        const width = container.clientWidth;
        const height = container.clientHeight;
        const padding = { top: 30, right: 30, bottom: 50, left: 60 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;
        const months = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
        const starData = [120, 340, 580, 750, 980, 1250];
        const maxValue = Math.max(...starData) * 1.2;
        ctx.clearRect(0, 0, width, height);
        ctx.strokeStyle = 'rgba(71,71,78,0.15)'; ctx.lineWidth = 1;
        for (let i = 0; i <= 5; i++) {
            const y = padding.top + (chartHeight / 5) * i;
            ctx.beginPath(); ctx.moveTo(padding.left, y); ctx.lineTo(width - padding.right, y); ctx.stroke();
            ctx.fillStyle = '#75757b'; ctx.font = '11px Manrope'; ctx.textAlign = 'right';
            ctx.fillText(Math.round(maxValue - (maxValue / 5) * i).toLocaleString(), padding.left - 10, y + 4);
        }
        months.forEach((m, i) => {
            const x = padding.left + (chartWidth / (months.length - 1)) * i;
            ctx.fillStyle = '#75757b'; ctx.font = '11px Manrope'; ctx.textAlign = 'center';
            ctx.fillText(m, x, height - padding.bottom + 24);
        });
        ctx.beginPath(); ctx.strokeStyle = 'rgb(161,250,255)'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        starData.forEach((v, i) => {
            const x = padding.left + (chartWidth / (starData.length - 1)) * i;
            const y = padding.top + chartHeight - (v / maxValue) * chartHeight;
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight);
        ctx.lineTo(padding.left, padding.top + chartHeight); ctx.closePath();
        const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartHeight);
        gradient.addColorStop(0, 'rgba(161,250,255,0.15)'); gradient.addColorStop(1, 'rgba(161,250,255,0.01)');
        ctx.fillStyle = gradient; ctx.fill();
        starData.forEach((v, i) => {
            const x = padding.left + (chartWidth / (starData.length - 1)) * i;
            const y = padding.top + chartHeight - (v / maxValue) * chartHeight;
            ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fillStyle = 'rgba(161,250,255,0.15)'; ctx.fill();
            ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fillStyle = 'rgb(161,250,255)'; ctx.fill();
            ctx.strokeStyle = '#1e1f26'; ctx.lineWidth = 2; ctx.stroke();
        });
        ctx.beginPath(); ctx.arc(width - padding.right - 80, 15, 5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgb(161,250,255)'; ctx.fill();
        ctx.fillStyle = '#abaab1'; ctx.font = '12px Space Grotesk'; ctx.textAlign = 'left';
        ctx.fillText('StarCoin', width - padding.right - 70, 19);
    }
});

console.log('⭐ StarCoin Dashboard v3 — Connected to Backend API');
