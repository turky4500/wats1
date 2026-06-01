const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const db = require('../database/db');
const whatsappManager = require('../utils/whatsappManager');

const JWT_SECRET = 'premium_secret_wats1_replace_me';

// Setup multer for media uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../uploads/'));
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// --- Middlewares ---
const authenticateToken = (req, res, next) => {
    const token = req.cookies?.token;
    if (!token) return res.status(401).json({ error: 'غير مصرح لك بالدخول.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'الجلسة منتهية.' });
        req.user = user;
        next();
    });
};

const isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') next();
    else res.status(403).json({ error: 'صلاحيات الإدارة مطلوبة.' });
};

// --- Auth APIs ---
router.post('/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'الرجاء إدخال اسم المستخدم وكلمة المرور.' });

    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        // Users registered themselves wait for admin approval to send messages
        db.run(`INSERT INTO users (username, password, role, can_send_messages) VALUES (?, ?, 'user', 0)`, 
        [username, hashedPassword], function(err) {
            if (err) {
                if(err.message.includes('UNIQUE')) return res.status(400).json({ error: 'اسم المستخدم موجود مسبقاً.' });
                return res.status(500).json({ error: 'خطأ في قاعدة البيانات.' });
            }
            res.json({ message: 'تم إنشاء الحساب بنجاح! بانتظار تفعيل الإدارة.' });
        });
    } catch (e) {
        res.status(500).json({ error: 'خطأ في الخادم.' });
    }
});

router.post('/login', (req, res) => {
    const { username, password } = req.body;

    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
        if (err) return res.status(500).json({ error: 'خطأ في قاعدة البيانات.' });
        if (!user) return res.status(400).json({ error: 'بيانات الدخول غير صحيحة.' });

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(400).json({ error: 'بيانات الدخول غير صحيحة.' });

        const token = jwt.sign({ id: user.id, username: user.username, role: user.role, can_send_messages: user.can_send_messages }, JWT_SECRET, { expiresIn: '7d' });
        res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
        res.json({ message: 'تم تسجيل الدخول بنجاح', role: user.role });
    });
});

router.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'تم تسجيل الخروج.' });
});

// --- WhatsApp APIs ---
router.post('/wa/connect', authenticateToken, async (req, res) => {
    try {
        await whatsappManager.createSession(req.user.id);
        res.json({ message: 'جاري تهيئة الاتصال...' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/wa/pairing-code', authenticateToken, async (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'رقم الهاتف مطلوب.' });
    try {
        const code = await whatsappManager.requestPairingCode(req.user.id, phone);
        res.json({ code });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/wa/logout', authenticateToken, async (req, res) => {
    await whatsappManager.logout(req.user.id);
    res.json({ message: 'تم تسجيل الخروج من الواتساب.' });
});

router.get('/wa/status', authenticateToken, (req, res) => {
    res.json({
        status: whatsappManager.getStatus(req.user.id),
        qr: whatsappManager.getQr(req.user.id)
    });
});

// --- Messaging APIs ---
router.post('/messages/send', authenticateToken, upload.single('media'), async (req, res) => {
    const { phone, content } = req.body;
    const file = req.file;
    
    db.get('SELECT can_send_messages FROM users WHERE id = ?', [req.user.id], async (err, user) => {
        if (err || !user || user.can_send_messages === 0) {
            return res.status(403).json({ error: 'عفواً، لا تملك صلاحية الإرسال حالياً.' });
        }

        try {
            const mediaUrl = file ? path.resolve(file.path) : null;
            await whatsappManager.sendMessage(req.user.id, phone, content, mediaUrl);
            
            // Save to history (success)
            db.run(`INSERT INTO messages (user_id, phone_number, content, media_path, status) VALUES (?, ?, ?, ?, 'success')`,
                [req.user.id, phone, content, file ? file.filename : null]);
                
            res.json({ success: true, message: 'تم الإرسال بنجاح.' });
        } catch (error) {
            // Save to history (failed)
            db.run(`INSERT INTO messages (user_id, phone_number, content, media_path, status, error_message) VALUES (?, ?, ?, ?, 'failed', ?)`,
                [req.user.id, phone, content, file ? file.filename : null, error.message]);
                
            res.status(500).json({ error: 'فشل الإرسال: ' + error.message });
        }
    });
});

router.get('/messages/history', authenticateToken, (req, res) => {
    db.all('SELECT * FROM messages WHERE user_id = ? ORDER BY created_at DESC', [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: 'خطأ في جلب الأرشيف.' });
        res.json(rows);
    });
});

// --- Admin APIs ---
router.get('/admin/users', authenticateToken, isAdmin, (req, res) => {
    db.all("SELECT id, username, role, can_send_messages, created_at FROM users WHERE role != 'admin'", [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error.' });
        res.json(rows);
    });
});

router.put('/admin/users/:id/toggle-permission', authenticateToken, isAdmin, (req, res) => {
    const { can_send_messages } = req.body;
    db.run(`UPDATE users SET can_send_messages = ? WHERE id = ?`, [can_send_messages ? 1 : 0, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: 'Database error.' });
        res.json({ message: 'تم تحديث الصلاحية بنجاح.' });
    });
});

router.delete('/admin/users/:id', authenticateToken, isAdmin, (req, res) => {
    db.run(`DELETE FROM users WHERE id = ? AND role != 'admin'`, [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: 'Database error.' });
        res.json({ message: 'تم حذف المستخدم بنجاح.' });
    });
});

module.exports = { apiRoutes: router, authenticateToken };
