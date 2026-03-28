/* ==========================================
   StarCoin Dashboard - JavaScript v2
   ========================================== */

// ==========================================
// AUTH & USER MANAGEMENT
// ==========================================
const AUTH_KEY = 'starcoin_users';
const SESSION_KEY = 'starcoin_session';

function getUsers() {
    return JSON.parse(localStorage.getItem(AUTH_KEY) || '[]');
}
function saveUsers(users) {
    localStorage.setItem(AUTH_KEY, JSON.stringify(users));
}
function getSession() {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
}
function setSession(user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}
function clearSession() {
    localStorage.removeItem(SESSION_KEY);
}
function generateUserId() {
    return 'SC' + Math.floor(100000 + Math.random() * 900000);
}
function generateReferralLink(userId) {
    const base = window.location.origin + window.location.pathname;
    return base + '?ref=' + userId;
}

// Seed demo users if none exist
function seedDemoData(currentUser) {
    const users = getUsers();
    const hasA = users.find(u => u.name === 'User A');
    if (!hasA) {
        const userA = {
            id: 'SC482910',
            name: 'User A',
            email: 'usera@demo.com',
            phone: '9999999901',
            password: 'demo123',
            referredBy: currentUser.id,
            joinDate: 'Mar 20, 2026'
        };
        const userB = {
            id: 'SC593021',
            name: 'User B',
            email: 'userb@demo.com',
            phone: '9999999902',
            password: 'demo123',
            referredBy: 'SC482910',
            joinDate: 'Mar 22, 2026'
        };
        users.push(userA, userB);
        saveUsers(users);
    }
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
    const session = getSession();
    if (session) {
        showApp(session);
    } else {
        showLogin();
        if (refCode) {
            document.getElementById('regReferral').value = refCode;
            switchTab('register');
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

        // Load StarCoin image
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
                    // color hue: mostly white, some blue-ish, some gold
                    hue: Math.random() < 0.15 ? 45 : (Math.random() < 0.3 ? 220 : 0),
                    sat: Math.random() < 0.3 ? Math.random() * 40 + 20 : 0
                });
            }
            // Create orbiter stars (stars that orbit cursor)
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

        // Mouse tracking relative to panel
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
            // Soft nebula behind the coin
            const g1 = ctx.createRadialGradient(cx, cy, 0, cx, cy, 200);
            g1.addColorStop(0, 'rgba(255,215,0,0.06)');
            g1.addColorStop(0.3, 'rgba(255,180,0,0.03)');
            g1.addColorStop(0.6, 'rgba(100,60,180,0.02)');
            g1.addColorStop(1, 'transparent');
            ctx.fillStyle = g1;
            ctx.fillRect(cx - 200, cy - 200, 400, 400);

            // Subtle purple nebula patch
            const g2 = ctx.createRadialGradient(cx + 100, cy - 80, 0, cx + 100, cy - 80, 160);
            g2.addColorStop(0, 'rgba(102,60,200,0.04)');
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
            // Glow
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
            // Gravitational ring glow
            const glow = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 90);
            glow.addColorStop(0, 'rgba(255,215,0,0.05)');
            glow.addColorStop(0.5, 'rgba(255,215,0,0.02)');
            glow.addColorStop(1, 'transparent');
            ctx.fillStyle = glow;
            ctx.fillRect(mouse.x - 90, mouse.y - 90, 180, 180);

            orbiters.forEach(o => {
                o.angle += o.speed;
                const ox = mouse.x + Math.cos(o.angle) * o.dist;
                const oy = mouse.y + Math.sin(o.angle) * o.dist;
                // Trail
                o.trail.push({ x: ox, y: oy });
                if (o.trail.length > 6) o.trail.shift();
                for (let t = 0; t < o.trail.length; t++) {
                    const ta = (t / o.trail.length) * o.alpha * 0.3;
                    ctx.beginPath();
                    ctx.arc(o.trail[t].x, o.trail[t].y, o.r * 0.6, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(255,215,0,${ta})`;
                    ctx.fill();
                }
                // Star
                ctx.beginPath();
                ctx.arc(ox, oy, o.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255,235,180,${o.alpha})`;
                ctx.fill();
                // Tiny glow
                ctx.beginPath();
                ctx.arc(ox, oy, o.r * 2, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255,215,0,${o.alpha * 0.15})`;
                ctx.fill();
            });
        }

        function drawStarCoin(cx, cy) {
            if (!coinLoaded) return;
            const pulse = Math.sin(time * 0.015) * 0.08 + 1;
            const size = 100 * pulse;
            // Outer glow rings
            for (let i = 3; i >= 1; i--) {
                const glowSize = size + i * 25;
                const alpha = 0.03 / i;
                ctx.beginPath();
                ctx.arc(cx, cy, glowSize / 2, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255,215,0,${alpha})`;
                ctx.fill();
            }
            // Draw coin
            ctx.save();
            ctx.globalAlpha = 0.9;
            ctx.drawImage(coinImg, cx - size / 2, cy - size / 2, size, size);
            ctx.restore();
        }

        // Attract nearby stars toward cursor
        function attractStar(star) {
            if (mouse.x < 0) return;
            const dx = mouse.x - star.x;
            const dy = mouse.y - star.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 150) {
                const force = (150 - dist) / 150;
                const angle = Math.atan2(dy, dx);
                // Push slightly toward cursor orbit
                star.x += Math.cos(angle + Math.PI / 2) * force * 0.3;
                star.y += Math.sin(angle + Math.PI / 2) * force * 0.3;
                star.alpha = Math.min(1, star.baseAlpha + force * 0.5);
            }
        }

        function animate() {
            time++;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, W, H);

            // Background gradient
            const bg = ctx.createLinearGradient(0, 0, W, H);
            bg.addColorStop(0, '#030510');
            bg.addColorStop(0.5, '#060a1a');
            bg.addColorStop(1, '#0a0820');
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, W, H);

            const coinCX = W * 0.5;
            const coinCY = H * 0.42;
            drawNebulaGlow(coinCX, coinCY);

            // Draw stars
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
    // LOGIN FORM
    // ==========================================
    document.getElementById('loginForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;
        const users = getUsers();
        const user = users.find(u => u.email === email && u.password === password);
        if (user) {
            setSession(user);
            showApp(user);
        } else {
            document.getElementById('loginError').textContent = 'Invalid email or password.';
        }
    });

    // ==========================================
    // REGISTER FORM
    // ==========================================
    document.getElementById('registerForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('regName').value.trim();
        const email = document.getElementById('regEmail').value.trim();
        const phone = document.getElementById('regPhone').value.trim();
        const password = document.getElementById('regPassword').value;
        const referral = document.getElementById('regReferral').value.trim();

        if (!name || !email || !phone || !password) {
            document.getElementById('registerError').textContent = 'Please fill all required fields.';
            return;
        }

        const users = getUsers();
        if (users.find(u => u.email === email)) {
            document.getElementById('registerError').textContent = 'Email already registered.';
            return;
        }

        const newUser = {
            id: generateUserId(),
            name,
            email,
            phone,
            password,
            referredBy: referral || null,
            joinDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        };

        users.push(newUser);
        saveUsers(users);
        setSession(newUser);
        showApp(newUser);
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
        seedDemoData(user);
        populateDashboard(user);
        initAppLogic();
    }

    // ==========================================
    // POPULATE DASHBOARD
    // ==========================================
    function populateDashboard(user) {
        // Welcome
        const welcomeEl = document.getElementById('welcomeHeading');
        if (welcomeEl) welcomeEl.textContent = `Welcome Back, ${user.name}!`;

        // User IDs
        const idInputs = ['iboUserId', 'ewalletIboId', 'ewalletReqUserId'];
        idInputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = user.id;
        });

        // Ewallet name
        const ewalletName = document.getElementById('ewalletReqName');
        if (ewalletName) ewalletName.value = user.name;

        // Referral link
        const refInput = document.getElementById('referralLinkInput');
        if (refInput) refInput.value = generateReferralLink(user.id);

        // Welcome letter
        const letterName = document.getElementById('letterUserName');
        if (letterName) letterName.textContent = user.name;
        const letterId = document.getElementById('letterUserId');
        if (letterId) letterId.textContent = user.id;
        const letterDate = document.getElementById('letterDate');
        if (letterDate) letterDate.textContent = user.joinDate || new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

        // Profile view
        const profileDetails = document.getElementById('profileDetails');
        if (profileDetails) {
            profileDetails.innerHTML = `
                <div class="profile-row"><span class="profile-label">Name</span><span class="profile-value">${user.name}</span></div>
                <div class="profile-row"><span class="profile-label">Email</span><span class="profile-value">${user.email}</span></div>
                <div class="profile-row"><span class="profile-label">Phone</span><span class="profile-value">${user.phone || 'N/A'}</span></div>
                <div class="profile-row"><span class="profile-label">User ID</span><span class="profile-value">${user.id}</span></div>
                <div class="profile-row"><span class="profile-label">Joined</span><span class="profile-value">${user.joinDate}</span></div>
                <div class="profile-row"><span class="profile-label">Referral Link</span><span class="profile-value" style="font-size:12px;word-break:break-all">${generateReferralLink(user.id)}</span></div>
            `;
        }

        // Profile edit
        const editName = document.getElementById('editName');
        if (editName) editName.value = user.name;
        const editPhone = document.getElementById('editPhone');
        if (editPhone) editPhone.value = user.phone || '';

        // Render trees
        renderTree('treeContainer', user);
        renderTree('treeContainerPage', user);

        // Team count
        const users = getUsers();
        const directRefs = users.filter(u => u.referredBy === user.id);
        const getAllDownline = (userId) => {
            const direct = users.filter(u => u.referredBy === userId);
            let total = direct.length;
            direct.forEach(d => { total += getAllDownline(d.id); });
            return total;
        };
        const totalTeam = getAllDownline(user.id);
        const teamStat = document.getElementById('teamSizeStat');
        if (teamStat) teamStat.dataset.count = totalTeam;
        const refStat = document.getElementById('referralsStat');
        if (refStat) refStat.dataset.count = directRefs.length;
    }

    // ==========================================
    // RENDER REFERRAL TREE
    // ==========================================
    function renderTree(containerId, rootUser) {
        const container = document.getElementById(containerId);
        if (!container) return;
        const users = getUsers();

        function buildNode(userId) {
            const user = users.find(u => u.id === userId) || rootUser;
            const children = users.filter(u => u.referredBy === userId);
            const isRoot = userId === rootUser.id;

            let html = `<div class="tree-node">`;
            html += `<div class="tree-node-content ${isRoot ? 'root' : ''}">`;
            html += `<div class="tree-node-name">${isRoot ? user.name + ' (You)' : user.name}</div>`;
            html += `<div class="tree-node-id">${user.id}</div>`;
            html += `</div>`;

            if (children.length > 0) {
                html += `<div class="tree-connector"></div>`;
                html += `<div class="tree-children">`;
                children.forEach(child => {
                    html += `<div style="display:flex;flex-direction:column;align-items:center">`;
                    html += `<div class="tree-branch-connector"></div>`;
                    html += buildNode(child.id);
                    html += `</div>`;
                });
                html += `</div>`;
            }
            html += `</div>`;
            return html;
        }

        container.innerHTML = buildNode(rootUser.id);
    }

    // ==========================================
    // APP LOGIC (navigation, charts, etc)
    // ==========================================
    function initAppLogic() {
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

        // Logout
        document.getElementById('logoutBtn').addEventListener('click', (e) => {
            e.preventDefault();
            clearSession();
            showToast('Logging out...', 'logout');
            setTimeout(() => location.reload(), 1000);
        });

        // E-wallet form
        const ewalletForm = document.getElementById('ewalletRequestForm');
        if (ewalletForm) {
            ewalletForm.addEventListener('submit', (e) => {
                e.preventDefault(); showToast('Coin credit request submitted!');
            });
        }

        // Edit profile
        const editForm = document.getElementById('editProfileForm');
        if (editForm) {
            editForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const session = getSession();
                const users = getUsers();
                const idx = users.findIndex(u => u.id === session.id);
                if (idx >= 0) {
                    users[idx].name = document.getElementById('editName').value.trim();
                    users[idx].phone = document.getElementById('editPhone').value.trim();
                    saveUsers(users);
                    setSession(users[idx]);
                    populateDashboard(users[idx]);
                    showToast('Profile updated!');
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

        // Buy button
        const buyBtn = document.getElementById('buyStarBtn');
        if (buyBtn) {
            buyBtn.addEventListener('click', () => {
                const amount = parseFloat(starInput.value);
                if (!amount || amount <= 0) { showToast('Enter a valid amount', 'error'); return; }
                const receive = (amount * STAR_RATE).toLocaleString();
                showToast(`Purchased ~${receive} StarCoin for $${amount.toLocaleString()}!`);
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
        ctx.strokeStyle = 'rgba(0,0,0,0.05)'; ctx.lineWidth = 1;
        for (let i = 0; i <= 5; i++) {
            const y = padding.top + (chartHeight / 5) * i;
            ctx.beginPath(); ctx.moveTo(padding.left, y); ctx.lineTo(width - padding.right, y); ctx.stroke();
            ctx.fillStyle = '#9ca3af'; ctx.font = '11px Inter'; ctx.textAlign = 'right';
            ctx.fillText(Math.round(maxValue - (maxValue / 5) * i).toLocaleString(), padding.left - 10, y + 4);
        }
        months.forEach((m, i) => {
            const x = padding.left + (chartWidth / (months.length - 1)) * i;
            ctx.fillStyle = '#9ca3af'; ctx.font = '11px Inter'; ctx.textAlign = 'center';
            ctx.fillText(m, x, height - padding.bottom + 24);
        });
        // Draw line
        ctx.beginPath(); ctx.strokeStyle = 'rgb(67,233,123)'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        starData.forEach((v, i) => {
            const x = padding.left + (chartWidth / (starData.length - 1)) * i;
            const y = padding.top + chartHeight - (v / maxValue) * chartHeight;
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight);
        ctx.lineTo(padding.left, padding.top + chartHeight); ctx.closePath();
        const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartHeight);
        gradient.addColorStop(0, 'rgba(67,233,123,0.15)'); gradient.addColorStop(1, 'rgba(67,233,123,0.01)');
        ctx.fillStyle = gradient; ctx.fill();
        starData.forEach((v, i) => {
            const x = padding.left + (chartWidth / (starData.length - 1)) * i;
            const y = padding.top + chartHeight - (v / maxValue) * chartHeight;
            ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fillStyle = 'rgba(67,233,123,0.15)'; ctx.fill();
            ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fillStyle = 'rgb(67,233,123)'; ctx.fill();
            ctx.strokeStyle = 'white'; ctx.lineWidth = 2; ctx.stroke();
        });
        // Legend
        ctx.beginPath(); ctx.arc(width - padding.right - 80, 15, 5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgb(67,233,123)'; ctx.fill();
        ctx.fillStyle = '#6b7280'; ctx.font = '12px Inter'; ctx.textAlign = 'left';
        ctx.fillText('StarCoin', width - padding.right - 70, 19);
    }
});

console.log('⭐ StarCoin Dashboard v2 initialized');
