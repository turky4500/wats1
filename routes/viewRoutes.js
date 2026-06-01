const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../database/db');
const { JWT_SECRET } = require('./apiRoutes');

const checkAuth = (req, res, next) => {
    const token = req.cookies?.token;
    if (token) jwt.verify(token, JWT_SECRET, (err, u) => { if (!err) req.user = u; next(); });
    else next();
};

const requireAuth = (req, res, next) => { if (!req.user) return res.redirect('/login'); next(); };
const requireAdmin = (req, res, next) => {
    if (!req.user) return res.redirect('/login');
    if (req.user.role !== 'admin') return res.redirect('/dashboard');
    next();
};

router.use(checkAuth);

// ── Public ────────────────────────────────────────────────────────────────────
router.get('/', (req, res) => res.render('landing', { user: req.user }));
router.get('/login', (req, res) => {
    if (req.user) return res.redirect(req.user.role === 'admin' ? '/admin' : '/dashboard');
    res.render('login');
});
router.get('/register', (req, res) => {
    if (req.user) return res.redirect('/dashboard');
    res.render('register', { planId: req.query.plan || 1 });
});

// ── Dashboard ─────────────────────────────────────────────────────────────────
router.get('/dashboard', requireAuth, (req, res) => {
    db.all('SELECT * FROM devices WHERE user_id=?', [req.user.id], (e, devices) => {
        db.all('SELECT * FROM campaigns WHERE user_id=? ORDER BY created_at DESC LIMIT 5', [req.user.id], (e2, campaigns) => {
            db.all('SELECT * FROM auto_replies WHERE user_id=?', [req.user.id], (e3, replies) => {
                db.get('SELECT COUNT(*) as cnt FROM contacts WHERE user_id=?', [req.user.id], (e4, contacts) => {
                    db.get('SELECT COUNT(*) as cnt FROM message_archive WHERE user_id=?', [req.user.id], (e5, msgs) => {
                        res.render('dashboard/index', {
                            user: req.user, devices: devices || [], campaigns: campaigns || [],
                            replies: replies || [], contactsCount: contacts?.cnt || 0, messagesCount: msgs?.cnt || 0
                        });
                    });
                });
            });
        });
    });
});

router.get('/dashboard/devices', requireAuth, (req, res) => {
    db.all('SELECT * FROM devices WHERE user_id=? ORDER BY created_at DESC', [req.user.id], (e, devices) => {
        res.render('dashboard/devices', { user: req.user, devices: devices || [] });
    });
});

router.get('/dashboard/contacts', requireAuth, (req, res) => {
    db.all('SELECT * FROM contacts WHERE user_id=? ORDER BY created_at DESC', [req.user.id], (e, contacts) => {
        res.render('dashboard/contacts', { user: req.user, contacts: contacts || [] });
    });
});

router.get('/dashboard/campaigns', requireAuth, (req, res) => {
    db.all('SELECT * FROM devices WHERE user_id=? AND status="connected"', [req.user.id], (e, devices) => {
        db.all('SELECT DISTINCT group_name FROM contacts WHERE user_id=?', [req.user.id], (e2, groups) => {
            db.all('SELECT * FROM campaigns WHERE user_id=? ORDER BY created_at DESC', [req.user.id], (e3, campaigns) => {
                res.render('dashboard/campaigns', { user: req.user, devices: devices || [], groups: groups || [], campaigns: campaigns || [] });
            });
        });
    });
});

router.get('/dashboard/auto-replies', requireAuth, (req, res) => {
    db.all('SELECT * FROM devices WHERE user_id=?', [req.user.id], (e, devices) => {
        db.all(`SELECT ar.*, d.name as device_name FROM auto_replies ar
                LEFT JOIN devices d ON ar.device_id=d.id WHERE ar.user_id=? ORDER BY ar.id DESC`, [req.user.id], (e2, replies) => {
            res.render('dashboard/auto_replies', { user: req.user, devices: devices || [], replies: replies || [] });
        });
    });
});

router.get('/dashboard/archive', requireAuth, (req, res) => {
    const { type, status, page = 1 } = req.query;
    const limit = 30, offset = (page - 1) * limit;
    let where = 'WHERE ma.user_id=?', params = [req.user.id];
    if (type) { where += ' AND ma.type=?'; params.push(type); }
    if (status) { where += ' AND ma.status=?'; params.push(status); }

    db.all(
        `SELECT ma.*, d.name as device_name FROM message_archive ma
         LEFT JOIN devices d ON ma.device_id=d.id ${where} ORDER BY ma.sent_at DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset], (e, messages) => {
            db.get(`SELECT COUNT(*) as total FROM message_archive ma ${where}`, params, (e2, count) => {
                res.render('dashboard/archive', {
                    user: req.user, messages: messages || [],
                    total: count?.total || 0, page: +page, limit,
                    type: type || '', status: status || ''
                });
            });
        });
});

// ── Admin ─────────────────────────────────────────────────────────────────────
router.get('/admin', requireAdmin, (req, res) => {
    db.all(`SELECT u.*, p.name as plan_name,
            (SELECT COUNT(*) FROM devices WHERE user_id=u.id) as device_count,
            (SELECT COUNT(*) FROM message_archive WHERE user_id=u.id) as msg_count
            FROM users u LEFT JOIN plans p ON u.plan_id=p.id ORDER BY u.created_at DESC`, [], (e, users) => {
        db.get('SELECT COUNT(*) as c FROM users WHERE role!="admin"', [], (e2, uCount) => {
            db.get('SELECT COUNT(*) as c FROM devices WHERE status="connected"', [], (e3, dCount) => {
                db.get('SELECT COUNT(*) as c FROM campaigns', [], (e4, cCount) => {
                    db.get('SELECT COUNT(*) as c FROM message_archive', [], (e5, mCount) => {
                        db.all('SELECT * FROM plans', [], (e6, plans) => {
                            res.render('admin/index', {
                                user: req.user, users: users || [], plans: plans || [],
                                stats: { users: uCount?.c || 0, connected: dCount?.c || 0, campaigns: cCount?.c || 0, messages: mCount?.c || 0 }
                            });
                        });
                    });
                });
            });
        });
    });
});

router.get('/admin/user/:id', requireAdmin, (req, res) => {
    db.get(`SELECT u.*, p.name as plan_name FROM users u LEFT JOIN plans p ON u.plan_id=p.id WHERE u.id=?`, [req.params.id], (e, targetUser) => {
        if (!targetUser) return res.redirect('/admin');
        db.all('SELECT * FROM devices WHERE user_id=?', [req.params.id], (e2, devices) => {
            db.all('SELECT * FROM campaigns WHERE user_id=? ORDER BY created_at DESC', [req.params.id], (e3, campaigns) => {
                db.all(`SELECT ma.*, d.name as device_name FROM message_archive ma
                        LEFT JOIN devices d ON ma.device_id=d.id WHERE ma.user_id=? ORDER BY ma.sent_at DESC LIMIT 50`, [req.params.id], (e4, archive) => {
                    db.all('SELECT * FROM plans', [], (e5, plans) => {
                        db.get('SELECT COUNT(*) as cnt FROM contacts WHERE user_id=?', [req.params.id], (e6, contacts) => {
                            res.render('admin/user_detail', {
                                user: req.user, targetUser, devices: devices || [],
                                campaigns: campaigns || [], archive: archive || [],
                                plans: plans || [], contactsCount: contacts?.cnt || 0
                            });
                        });
                    });
                });
            });
        });
    });
});

module.exports = router;
