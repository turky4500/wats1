const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../database/db');
const { JWT_SECRET } = require('./apiRoutes');

const checkAuth = (req, res, next) => {
    const token = req.cookies?.token;
    if (token) {
        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (!err) req.user = user;
            next();
        });
    } else {
        next();
    }
};

const requireAuth = (req, res, next) => {
    if (!req.user) return res.redirect('/login');
    next();
};

const requireAdmin = (req, res, next) => {
    if (!req.user) return res.redirect('/login');
    if (req.user.role !== 'admin') return res.redirect('/dashboard');
    next();
};

router.use(checkAuth);

// Landing
router.get('/', (req, res) => {
    res.render('landing', { user: req.user });
});

// Auth
router.get('/login', (req, res) => {
    if (req.user) return req.user.role === 'admin' ? res.redirect('/admin') : res.redirect('/dashboard');
    res.render('login');
});

router.get('/register', (req, res) => {
    if (req.user) return res.redirect('/dashboard');
    res.render('register', { planId: req.query.plan || 1 });
});

// ─── User Dashboard ──────────────────────────────────────────────────────────
router.get('/dashboard', requireAuth, (req, res) => {
    db.all('SELECT * FROM devices WHERE user_id = ?', [req.user.id], (err, devices) => {
        db.all('SELECT * FROM campaigns WHERE user_id = ? ORDER BY created_at DESC', [req.user.id], (err2, campaigns) => {
            db.all('SELECT * FROM auto_replies WHERE user_id = ?', [req.user.id], (err3, replies) => {
                db.get('SELECT COUNT(*) as cnt FROM contacts WHERE user_id = ?', [req.user.id], (err4, contacts) => {
                    res.render('dashboard/index', {
                        user: req.user,
                        devices: devices || [],
                        campaigns: campaigns || [],
                        replies: replies || [],
                        contactsCount: contacts?.cnt || 0
                    });
                });
            });
        });
    });
});

router.get('/dashboard/devices', requireAuth, (req, res) => {
    db.all('SELECT * FROM devices WHERE user_id = ?', [req.user.id], (err, devices) => {
        res.render('dashboard/devices', { user: req.user, devices: devices || [] });
    });
});

router.get('/dashboard/campaigns', requireAuth, (req, res) => {
    db.all('SELECT * FROM devices WHERE user_id = ? AND status = "connected"', [req.user.id], (err, devices) => {
        db.all('SELECT DISTINCT group_name FROM contacts WHERE user_id = ?', [req.user.id], (err2, groups) => {
            db.all('SELECT c.*, d.name as device_name FROM campaigns c LEFT JOIN devices d ON c.device_id = d.id WHERE c.user_id = ? ORDER BY c.created_at DESC', [req.user.id], (err3, campaigns) => {
                res.render('dashboard/campaigns', {
                    user: req.user,
                    devices: devices || [],
                    groups: groups || [],
                    campaigns: campaigns || []
                });
            });
        });
    });
});

router.get('/dashboard/contacts', requireAuth, (req, res) => {
    db.all('SELECT * FROM contacts WHERE user_id = ? ORDER BY created_at DESC', [req.user.id], (err, contacts) => {
        res.render('dashboard/contacts', { user: req.user, contacts: contacts || [] });
    });
});

router.get('/dashboard/auto-replies', requireAuth, (req, res) => {
    db.all('SELECT * FROM devices WHERE user_id = ?', [req.user.id], (err, devices) => {
        db.all('SELECT ar.*, d.name as device_name FROM auto_replies ar LEFT JOIN devices d ON ar.device_id = d.id WHERE ar.user_id = ? ORDER BY ar.id DESC', [req.user.id], (err2, replies) => {
            res.render('dashboard/auto_replies', { user: req.user, devices: devices || [], replies: replies || [] });
        });
    });
});

// ─── Admin Panel ──────────────────────────────────────────────────────────────
router.get('/admin', requireAdmin, (req, res) => {
    db.all('SELECT u.*, p.name as plan_name FROM users u LEFT JOIN plans p ON u.plan_id = p.id ORDER BY u.created_at DESC', [], (err, users) => {
        db.all('SELECT * FROM devices ORDER BY created_at DESC', [], (err2, devices) => {
            db.all('SELECT * FROM campaigns ORDER BY created_at DESC', [], (err3, campaigns) => {
                db.get('SELECT COUNT(*) as cnt FROM users', [], (err4, usersCount) => {
                    db.get('SELECT COUNT(*) as cnt FROM devices WHERE status = "connected"', [], (err5, connectedDevices) => {
                        res.render('admin/index', {
                            user: req.user,
                            users: users || [],
                            devices: devices || [],
                            campaigns: campaigns || [],
                            usersCount: usersCount?.cnt || 0,
                            connectedDevices: connectedDevices?.cnt || 0
                        });
                    });
                });
            });
        });
    });
});

router.get('/admin/users', requireAdmin, (req, res) => {
    db.all('SELECT u.*, p.name as plan_name FROM users u LEFT JOIN plans p ON u.plan_id = p.id ORDER BY u.created_at DESC', [], (err, users) => {
        res.render('admin/users', { user: req.user, users: users || [] });
    });
});

router.get('/admin/devices', requireAdmin, (req, res) => {
    db.all('SELECT d.*, u.username, u.email FROM devices d JOIN users u ON d.user_id = u.id ORDER BY d.created_at DESC', [], (err, devices) => {
        res.render('admin/devices', { user: req.user, devices: devices || [] });
    });
});

module.exports = router;
