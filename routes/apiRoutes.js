const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const db = require('../database/db');
const whatsappManager = require('../utils/whatsappManager');

const JWT_SECRET = 'easywhats_clone_secret';

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads/')),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// ── Middlewares ───────────────────────────────────────────────────────────────
const authenticateToken = (req, res, next) => {
    const token = req.cookies?.token;
    if (!token) return res.status(401).json({ error: 'غير مصرح.' });
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'الجلسة منتهية.' });
        req.user = user;
        next();
    });
};

// ── Auth ──────────────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
    const { username, email, password, planId } = req.body;
    if (!username || !email || !password) return res.status(400).json({ error: 'جميع الحقول مطلوبة.' });
    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        db.run(
            `INSERT INTO users (username, email, password, plan_id) VALUES (?, ?, ?, ?)`,
            [username, email, hashedPassword, planId || 1],
            function (err) {
                if (err) return res.status(400).json({ error: 'البريد أو اسم المستخدم مستخدم مسبقاً.' });
                const token = jwt.sign({ id: this.lastID, username, role: 'user' }, JWT_SECRET);
                res.cookie('token', token, { httpOnly: true });
                res.json({ message: 'تم إنشاء الحساب.', role: 'user' });
            }
        );
    } catch (e) {
        res.status(500).json({ error: 'خطأ في الخادم.' });
    }
});

router.post('/login', (req, res) => {
    const { email, password } = req.body;
    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (err || !user) return res.status(400).json({ error: 'بيانات غير صحيحة.' });
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(400).json({ error: 'بيانات غير صحيحة.' });
        const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET);
        res.cookie('token', token, { httpOnly: true });
        res.json({ message: 'تم الدخول', role: user.role });
    });
});

router.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'تم الخروج' });
});

// ── Devices ───────────────────────────────────────────────────────────────────
router.post('/devices', authenticateToken, (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'اسم الجهاز مطلوب.' });

    // Admin bypasses plan limits
    if (req.user.role === 'admin') {
        const sessionId = 'sess_' + Date.now();
        return db.run(
            `INSERT INTO devices (user_id, name, session_id) VALUES (?, ?, ?)`,
            [req.user.id, name, sessionId],
            function (err) {
                if (err) return res.status(500).json({ error: 'خطأ في قاعدة البيانات.' });
                res.json({ message: 'تمت الإضافة', id: this.lastID });
            }
        );
    }

    // For regular users, check plan
    db.get(
        `SELECT u.plan_id, p.max_devices FROM users u JOIN plans p ON u.plan_id = p.id WHERE u.id = ?`,
        [req.user.id],
        (err, plan) => {
            if (err || !plan) return res.status(500).json({ error: 'خطأ في جلب الباقة.' });

            db.get(
                `SELECT COUNT(*) as count FROM devices WHERE user_id = ?`,
                [req.user.id],
                (err2, row) => {
                    if (row && row.count >= plan.max_devices) {
                        return res.status(403).json({ error: `وصلت للحد الأقصى (${plan.max_devices} أجهزة) في باقتك. يرجى الترقية.` });
                    }
                    const sessionId = 'sess_' + Date.now();
                    db.run(
                        `INSERT INTO devices (user_id, name, session_id) VALUES (?, ?, ?)`,
                        [req.user.id, name, sessionId],
                        function (err3) {
                            if (err3) return res.status(500).json({ error: 'خطأ في قاعدة البيانات.' });
                            res.json({ message: 'تمت الإضافة', id: this.lastID });
                        }
                    );
                }
            );
        }
    );
});

router.post('/devices/:id/connect', authenticateToken, async (req, res) => {
    try {
        await whatsappManager.createSession(req.user.id, req.params.id);
        res.json({ message: 'جاري التهيئة...' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/devices/:id/pairing', authenticateToken, async (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'رقم الجوال مطلوب.' });
    try {
        const code = await whatsappManager.requestPairingCode(req.user.id, req.params.id, phone);
        res.json({ code });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/devices/:id/logout', authenticateToken, async (req, res) => {
    await whatsappManager.logout(req.params.id);
    res.json({ message: 'تم الفصل' });
});

router.delete('/devices/:id', authenticateToken, async (req, res) => {
    await whatsappManager.logout(req.params.id);
    db.run('DELETE FROM devices WHERE id = ? AND user_id = ?', [req.params.id, req.user.id], (err) => {
        if (err) return res.status(500).json({ error: 'خطأ في الحذف.' });
        res.json({ message: 'تم الحذف' });
    });
});

// ── Contacts ──────────────────────────────────────────────────────────────────
router.post('/contacts', authenticateToken, (req, res) => {
    const { name, phone_number, group_name } = req.body;
    if (!phone_number) return res.status(400).json({ error: 'رقم الجوال مطلوب.' });
    db.run(
        `INSERT INTO contacts (user_id, name, phone_number, group_name) VALUES (?, ?, ?, ?)`,
        [req.user.id, name || '', phone_number, group_name || 'default'],
        function (err) {
            if (err) return res.status(500).json({ error: 'خطأ في قاعدة البيانات.' });
            res.json({ message: 'تمت الإضافة', id: this.lastID });
        }
    );
});

router.delete('/contacts/:id', authenticateToken, (req, res) => {
    db.run('DELETE FROM contacts WHERE id = ? AND user_id = ?', [req.params.id, req.user.id], (err) => {
        if (err) return res.status(500).json({ error: 'خطأ في الحذف.' });
        res.json({ message: 'تم الحذف' });
    });
});

// ── Campaigns ─────────────────────────────────────────────────────────────────
router.post('/campaigns', authenticateToken, upload.single('media'), (req, res) => {
    const { name, device_id, message_content, group_name } = req.body;
    if (!name || !device_id || !message_content) return res.status(400).json({ error: 'جميع الحقول مطلوبة.' });
    const media_url = req.file ? `/uploads/${req.file.filename}` : null;

    db.run(
        `INSERT INTO campaigns (user_id, device_id, name, message_content, media_url, status) VALUES (?, ?, ?, ?, ?, 'processing')`,
        [req.user.id, device_id, name, message_content, media_url],
        function (err) {
            if (err) return res.status(500).json({ error: 'خطأ في قاعدة البيانات.' });
            const campaignId = this.lastID;

            db.all(
                `SELECT phone_number FROM contacts WHERE user_id = ? AND group_name = ?`,
                [req.user.id, group_name || 'default'],
                async (err2, contacts) => {
                    if (!contacts || contacts.length === 0) {
                        db.run(`UPDATE campaigns SET status = 'failed' WHERE id = ?`, [campaignId]);
                        return;
                    }
                    for (const contact of contacts) {
                        try {
                            await whatsappManager.sendMessage(device_id, contact.phone_number, message_content, media_url);
                            await new Promise(r => setTimeout(r, 2500));
                        } catch (e) {
                            console.error('Campaign send error:', e.message);
                        }
                    }
                    db.run(`UPDATE campaigns SET status = 'completed' WHERE id = ?`, [campaignId]);
                }
            );

            res.json({ message: 'تم إطلاق الحملة في الخلفية.', id: campaignId });
        }
    );
});

// ── Auto Replies ──────────────────────────────────────────────────────────────
router.post('/auto-replies', authenticateToken, upload.single('media'), (req, res) => {
    const { device_id, keyword, reply_content } = req.body;
    if (!device_id || !keyword || !reply_content) return res.status(400).json({ error: 'جميع الحقول مطلوبة.' });
    const media_url = req.file ? `/uploads/${req.file.filename}` : null;

    db.run(
        `INSERT INTO auto_replies (user_id, device_id, keyword, reply_content, media_url) VALUES (?, ?, ?, ?, ?)`,
        [req.user.id, device_id, keyword, reply_content, media_url],
        function (err) {
            if (err) return res.status(500).json({ error: 'خطأ في قاعدة البيانات.' });
            res.json({ message: 'تم حفظ الرد التلقائي', id: this.lastID });
        }
    );
});

router.delete('/auto-replies/:id', authenticateToken, (req, res) => {
    db.run('DELETE FROM auto_replies WHERE id = ? AND user_id = ?', [req.params.id, req.user.id], (err) => {
        if (err) return res.status(500).json({ error: 'خطأ في الحذف.' });
        res.json({ message: 'تم الحذف' });
    });
});

router.patch('/auto-replies/:id/toggle', authenticateToken, (req, res) => {
    db.run(
        'UPDATE auto_replies SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END WHERE id = ? AND user_id = ?',
        [req.params.id, req.user.id],
        (err) => {
            if (err) return res.status(500).json({ error: 'خطأ.' });
            res.json({ message: 'تم التحديث' });
        }
    );
});

// ── Admin APIs ────────────────────────────────────────────────────────────────
router.delete('/admin/users/:id', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'غير مصرح.' });
    const id = req.params.id;
    db.serialize(() => {
        db.run('DELETE FROM auto_replies WHERE user_id = ?', [id]);
        db.run('DELETE FROM campaigns WHERE user_id = ?', [id]);
        db.run('DELETE FROM contacts WHERE user_id = ?', [id]);
        db.run('DELETE FROM devices WHERE user_id = ?', [id]);
        db.run('DELETE FROM users WHERE id = ? AND role != "admin"', [id], function (err) {
            if (err) return res.status(500).json({ error: 'خطأ في الحذف.' });
            res.json({ message: 'تم حذف المستخدم.' });
        });
    });
});

module.exports = { apiRoutes: router, authenticateToken, JWT_SECRET };
