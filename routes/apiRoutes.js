const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const db = require('../database/db');
const wm = require('../utils/whatsappManager');

const JWT_SECRET = process.env.JWT_SECRET || 'easywhats_saas_secret_2026';

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads/')),
    filename: (req, file, cb) => cb(null, Date.now() + '_' + file.originalname.replace(/\s/g, '_'))
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// ── Helpers ───────────────────────────────────────────────────────────────────
const auth = (req, res, next) => {
    const token = req.cookies?.token;
    if (!token) return res.status(401).json({ error: 'غير مصرح. سجّل الدخول أولاً.' });
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'انتهت الجلسة. أعد تسجيل الدخول.' });
        req.user = user;
        next();
    });
};

const adminOnly = (req, res, next) => {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'للمدير فقط.' });
    next();
};

const planLimit = (userId, field, cb) => {
    db.get(
        `SELECT p.${field} as lim, (SELECT COUNT(*) FROM ${field === 'max_devices' ? 'devices' : field === 'max_contacts' ? 'contacts' : 'auto_replies'} WHERE user_id=?) as cnt
         FROM users u JOIN plans p ON u.plan_id=p.id WHERE u.id=?`,
        [userId, userId], cb
    );
};

// ── Auth ──────────────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
    let { identifier, password, planId } = req.body;
    if (!identifier || !password) return res.status(400).json({ error: 'أدخل معرّفك وكلمة المرور.' });
    identifier = identifier.trim();

    // Detect identifier type
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
    const isPhone = /^\+?[\d\s\-]{7,15}$/.test(identifier);
    let field = isEmail ? 'email' : isPhone ? 'phone' : 'username';
    const cleanPhone = isPhone ? identifier.replace(/\D/g, '') : null;
    const valueToStore = isPhone ? cleanPhone : identifier;

    // Check duplicate
    const query = isEmail
        ? 'SELECT id FROM users WHERE email=?'
        : isPhone ? 'SELECT id FROM users WHERE phone=?'
        : 'SELECT id FROM users WHERE username=?';

    db.get(query, [valueToStore], async (err, row) => {
        if (row) return res.status(400).json({ error: 'هذا المعرّف مستخدم مسبقاً.' });
        const hash = await bcrypt.hash(password, 10);
        const cols = field === 'email' ? '(email,password,plan_id)' : field === 'phone' ? '(phone,password,plan_id)' : '(username,password,plan_id)';
        db.run(`INSERT INTO users ${cols} VALUES (?,?,?)`, [valueToStore, hash, planId || 1], function (err) {
            if (err) return res.status(500).json({ error: 'خطأ في قاعدة البيانات.' });
            const token = jwt.sign({ id: this.lastID, identifier, role: 'user' }, JWT_SECRET, { expiresIn: '30d' });
            res.cookie('token', token, { httpOnly: true, maxAge: 30 * 24 * 3600 * 1000 });
            res.json({ message: 'تم إنشاء الحساب.', role: 'user' });
        });
    });
});

router.post('/login', (req, res) => {
    let { identifier, password } = req.body;
    if (!identifier || !password) return res.status(400).json({ error: 'جميع الحقول مطلوبة.' });
    identifier = identifier.trim();
    const cleanPhone = /^\+?[\d\s\-]{7,15}$/.test(identifier) ? identifier.replace(/\D/g, '') : null;

    db.get(
        `SELECT * FROM users WHERE email=? OR username=? OR phone=? LIMIT 1`,
        [identifier, identifier, cleanPhone || identifier],
        async (err, user) => {
            if (err || !user) return res.status(400).json({ error: 'بيانات غير صحيحة.' });
            if (!user.is_active) return res.status(403).json({ error: 'الحساب موقوف. تواصل مع الإدارة.' });
            const valid = await bcrypt.compare(password, user.password);
            if (!valid) return res.status(400).json({ error: 'بيانات غير صحيحة.' });
            const displayName = user.username || user.email || user.phone;
            const token = jwt.sign({ id: user.id, username: displayName, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
            res.cookie('token', token, { httpOnly: true, maxAge: 30 * 24 * 3600 * 1000 });
            res.json({ message: 'تم الدخول.', role: user.role });
        }
    );
});

router.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'تم الخروج.' });
});

// ── Devices ───────────────────────────────────────────────────────────────────
router.post('/devices', auth, (req, res) => {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'اسم الجهاز مطلوب.' });

    const proceed = () => {
        const sessionId = 'sess_' + Date.now() + '_' + req.user.id;
        db.run('INSERT INTO devices (user_id,name,session_id) VALUES (?,?,?)', [req.user.id, name.trim(), sessionId], function (err) {
            if (err) return res.status(500).json({ error: 'خطأ في قاعدة البيانات.' });
            res.json({ message: 'تمت الإضافة.', id: this.lastID });
        });
    };

    if (req.user.role === 'admin') return proceed();

    db.get('SELECT p.max_devices, COUNT(d.id) as cnt FROM users u JOIN plans p ON u.plan_id=p.id LEFT JOIN devices d ON d.user_id=u.id WHERE u.id=?', [req.user.id], (err, row) => {
        if (row && row.cnt >= row.max_devices) return res.status(403).json({ error: `وصلت للحد الأقصى (${row.max_devices} أجهزة). يرجى ترقية باقتك.` });
        proceed();
    });
});

router.post('/devices/:id/connect', auth, async (req, res) => {
    try {
        await wm.createSession(req.user.id, req.params.id);
        res.json({ message: 'جاري التهيئة...' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// REST fallback for QR (important for Render)
router.get('/devices/:id/qr', auth, (req, res) => {
    const qr = wm.getCurrentQR(req.params.id);
    if (qr) res.json({ qr });
    else res.json({ qr: null, status: wm.getSession(req.params.id)?.status || 'idle' });
});

router.post('/devices/:id/pairing', auth, async (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'رقم الجوال مطلوب.' });
    try {
        const code = await wm.requestPairingCode(req.user.id, req.params.id, phone);
        res.json({ code });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/devices/:id/logout', auth, async (req, res) => {
    await wm.logout(req.params.id);
    res.json({ message: 'تم الفصل.' });
});

router.delete('/devices/:id', auth, async (req, res) => {
    await wm.logout(req.params.id);
    db.run('DELETE FROM devices WHERE id=? AND user_id=?', [req.params.id, req.user.id], (err) => {
        if (err) return res.status(500).json({ error: 'خطأ في الحذف.' });
        res.json({ message: 'تم حذف الجهاز.' });
    });
});

// ── Contacts ──────────────────────────────────────────────────────────────────
router.post('/contacts', auth, (req, res) => {
    const { name, phone_number, group_name } = req.body;
    if (!phone_number?.trim()) return res.status(400).json({ error: 'رقم الجوال مطلوب.' });
    const clean = phone_number.replace(/\D/g, '');
    db.run('INSERT INTO contacts (user_id,name,phone_number,group_name) VALUES (?,?,?,?)',
        [req.user.id, name || '', clean, group_name || 'default'],
        function (err) {
            if (err) return res.status(500).json({ error: 'خطأ في قاعدة البيانات.' });
            res.json({ message: 'تمت الإضافة.', id: this.lastID });
        });
});

router.delete('/contacts/:id', auth, (req, res) => {
    db.run('DELETE FROM contacts WHERE id=? AND user_id=?', [req.params.id, req.user.id], (err) => {
        if (err) return res.status(500).json({ error: 'خطأ.' });
        res.json({ message: 'تم الحذف.' });
    });
});

// ── Campaigns ─────────────────────────────────────────────────────────────────
router.post('/campaigns', auth, upload.single('media'), async (req, res) => {
    const { name, device_id, message_content, group_name } = req.body;
    if (!name || !device_id || !message_content) return res.status(400).json({ error: 'جميع الحقول مطلوبة.' });
    const media_url = req.file ? `/uploads/${req.file.filename}` : null;

    db.all('SELECT * FROM contacts WHERE user_id=? AND group_name=?', [req.user.id, group_name || 'default'], async (err, contacts) => {
        if (!contacts?.length) return res.status(400).json({ error: 'لا توجد جهات اتصال في هذه المجموعة.' });

        db.run(
            `INSERT INTO campaigns (user_id,device_id,name,message_content,media_url,total_count,status) VALUES (?,?,?,?,?,?,'processing')`,
            [req.user.id, device_id, name, message_content, media_url, contacts.length],
            function (err) {
                if (err) return res.status(500).json({ error: 'خطأ في قاعدة البيانات.' });
                const campaignId = this.lastID;
                res.json({ message: 'تم إطلاق الحملة.', id: campaignId, total: contacts.length });

                // Background processing
                (async () => {
                    let sent = 0, failed = 0;
                    for (const contact of contacts) {
                        try {
                            await wm.sendMessage(device_id, contact.phone_number, message_content, media_url);
                            sent++;
                            // Archive
                            db.run(
                                `INSERT INTO message_archive (user_id,device_id,campaign_id,recipient_phone,recipient_name,message_content,media_url,type,status)
                                 VALUES (?,?,?,?,?,?,?,'campaign','sent')`,
                                [req.user.id, device_id, campaignId, contact.phone_number, contact.name, message_content, media_url]
                            );
                            await new Promise(r => setTimeout(r, 2000 + Math.random() * 1000));
                        } catch (e) {
                            failed++;
                            db.run(
                                `INSERT INTO message_archive (user_id,device_id,campaign_id,recipient_phone,recipient_name,message_content,type,status)
                                 VALUES (?,?,?,?,?,?,'campaign','failed')`,
                                [req.user.id, device_id, campaignId, contact.phone_number, contact.name, message_content]
                            );
                        }
                        db.run('UPDATE campaigns SET sent_count=?,failed_count=? WHERE id=?', [sent, failed, campaignId]);
                    }
                    db.run(`UPDATE campaigns SET status=?,sent_count=?,failed_count=? WHERE id=?`,
                        [failed === contacts.length ? 'failed' : 'completed', sent, failed, campaignId]);
                })();
            }
        );
    });
});

// ── Auto Replies ──────────────────────────────────────────────────────────────
router.post('/auto-replies', auth, upload.single('media'), (req, res) => {
    const { device_id, keyword, reply_content, match_type } = req.body;
    if (!device_id || !keyword || !reply_content) return res.status(400).json({ error: 'جميع الحقول مطلوبة.' });
    const media_url = req.file ? `/uploads/${req.file.filename}` : null;
    db.run(`INSERT INTO auto_replies (user_id,device_id,keyword,reply_content,media_url,match_type) VALUES (?,?,?,?,?,?)`,
        [req.user.id, device_id, keyword.trim(), reply_content, media_url, match_type || 'contains'],
        function (err) {
            if (err) return res.status(500).json({ error: 'خطأ.' });
            res.json({ message: 'تم الحفظ.', id: this.lastID });
        });
});

router.delete('/auto-replies/:id', auth, (req, res) => {
    db.run('DELETE FROM auto_replies WHERE id=? AND user_id=?', [req.params.id, req.user.id], (err) => {
        if (err) return res.status(500).json({ error: 'خطأ.' });
        res.json({ message: 'تم الحذف.' });
    });
});

router.patch('/auto-replies/:id/toggle', auth, (req, res) => {
    db.run('UPDATE auto_replies SET is_active=CASE WHEN is_active=1 THEN 0 ELSE 1 END WHERE id=? AND user_id=?',
        [req.params.id, req.user.id], (err) => {
            if (err) return res.status(500).json({ error: 'خطأ.' });
            res.json({ message: 'تم التحديث.' });
        });
});

// ── Message Archive (User) ────────────────────────────────────────────────────
router.get('/archive', auth, (req, res) => {
    const { type, status, page = 1 } = req.query;
    const limit = 50, offset = (page - 1) * limit;
    let where = 'WHERE ma.user_id=?', params = [req.user.id];
    if (type) { where += ' AND ma.type=?'; params.push(type); }
    if (status) { where += ' AND ma.status=?'; params.push(status); }
    db.all(
        `SELECT ma.*, d.name as device_name FROM message_archive ma
         LEFT JOIN devices d ON ma.device_id=d.id
         ${where} ORDER BY ma.sent_at DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset], (err, rows) => {
            if (err) return res.status(500).json({ error: 'خطأ.' });
            res.json(rows || []);
        });
});

// ── Admin APIs ────────────────────────────────────────────────────────────────
// Create user
router.post('/admin/users', auth, adminOnly, async (req, res) => {
    let { identifier, password, role, planId } = req.body;
    if (!identifier || !password) return res.status(400).json({ error: 'المعرّف وكلمة المرور مطلوبان.' });
    identifier = identifier.trim();
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
    const isPhone = /^\+?[\d\s\-]{7,15}$/.test(identifier);
    const field = isEmail ? 'email' : isPhone ? 'phone' : 'username';
    const value = isPhone ? identifier.replace(/\D/g, '') : identifier;
    const hash = await bcrypt.hash(password, 10);
    db.run(`INSERT INTO users (${field},password,role,plan_id) VALUES (?,?,?,?)`,
        [value, hash, role || 'user', planId || 1],
        function (err) {
            if (err) return res.status(400).json({ error: 'المعرّف مستخدم مسبقاً.' });
            res.json({ message: 'تم إنشاء المستخدم.', id: this.lastID });
        });
});

// List all users
router.get('/admin/users', auth, adminOnly, (req, res) => {
    db.all(`SELECT u.*, p.name as plan_name FROM users u LEFT JOIN plans p ON u.plan_id=p.id ORDER BY u.created_at DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'خطأ.' });
        res.json(rows || []);
    });
});

// Update user (password, plan, role, is_active)
router.patch('/admin/users/:id', auth, adminOnly, async (req, res) => {
    const { password, plan_id, role, is_active } = req.body;
    const updates = [], params = [];
    if (password) { updates.push('password=?'); params.push(await bcrypt.hash(password, 10)); }
    if (plan_id !== undefined) { updates.push('plan_id=?'); params.push(plan_id); }
    if (role) { updates.push('role=?'); params.push(role); }
    if (is_active !== undefined) { updates.push('is_active=?'); params.push(is_active ? 1 : 0); }
    if (!updates.length) return res.status(400).json({ error: 'لا يوجد ما يُحدَّث.' });
    params.push(req.params.id);
    db.run(`UPDATE users SET ${updates.join(',')} WHERE id=?`, params, (err) => {
        if (err) return res.status(500).json({ error: 'خطأ في التحديث.' });
        res.json({ message: 'تم التحديث.' });
    });
});

// Delete user
router.delete('/admin/users/:id', auth, adminOnly, (req, res) => {
    db.get('SELECT role FROM users WHERE id=?', [req.params.id], (err, u) => {
        if (u?.role === 'admin') return res.status(403).json({ error: 'لا يمكن حذف مدير.' });
        db.run('DELETE FROM users WHERE id=?', [req.params.id], async (err) => {
            if (err) return res.status(500).json({ error: 'خطأ في الحذف.' });
            res.json({ message: 'تم حذف المستخدم.' });
        });
    });
});

// Admin view user's devices
router.get('/admin/users/:id/devices', auth, adminOnly, (req, res) => {
    db.all('SELECT * FROM devices WHERE user_id=?', [req.params.id], (err, rows) => res.json(rows || []));
});

// Admin view user's message archive
router.get('/admin/users/:id/archive', auth, adminOnly, (req, res) => {
    const { page = 1 } = req.query;
    const limit = 50, offset = (page - 1) * limit;
    db.all(
        `SELECT ma.*, d.name as device_name FROM message_archive ma
         LEFT JOIN devices d ON ma.device_id=d.id
         WHERE ma.user_id=? ORDER BY ma.sent_at DESC LIMIT ? OFFSET ?`,
        [req.params.id, limit, offset],
        (err, rows) => res.json(rows || [])
    );
});

// Admin view user's campaigns
router.get('/admin/users/:id/campaigns', auth, adminOnly, (req, res) => {
    db.all('SELECT * FROM campaigns WHERE user_id=? ORDER BY created_at DESC', [req.params.id], (err, rows) => res.json(rows || []));
});

// Admin statistics
router.get('/admin/stats', auth, adminOnly, (req, res) => {
    db.get('SELECT COUNT(*) as users FROM users WHERE role!=?', ['admin'], (err, u) => {
        db.get('SELECT COUNT(*) as cnt FROM devices WHERE status=?', ['connected'], (err2, d) => {
            db.get('SELECT COUNT(*) as cnt FROM campaigns', [], (err3, c) => {
                db.get('SELECT COUNT(*) as cnt FROM message_archive', [], (err4, m) => {
                    res.json({ users: u?.users || 0, connected: d?.cnt || 0, campaigns: c?.cnt || 0, messages: m?.cnt || 0 });
                });
            });
        });
    });
});

module.exports = { apiRoutes: router, JWT_SECRET };
