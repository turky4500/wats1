const express = require('express');
const router = express.Router();
const { authenticateToken } = require('./apiRoutes');

// Check authentication status without failing
const checkAuth = (req, res, next) => {
    const jwt = require('jsonwebtoken');
    const token = req.cookies?.token;
    if (token) {
        jwt.verify(token, 'premium_secret_wats1_replace_me', (err, user) => {
            if (!err) req.user = user;
            next();
        });
    } else {
        next();
    }
};

router.get('/', checkAuth, (req, res) => {
    if (req.user) {
        return res.redirect(req.user.role === 'admin' ? '/admin' : '/dashboard');
    }
    res.render('landing');
});

router.get('/login', checkAuth, (req, res) => {
    if (req.user) return res.redirect(req.user.role === 'admin' ? '/admin' : '/dashboard');
    res.render('login');
});

router.get('/register', checkAuth, (req, res) => {
    if (req.user) return res.redirect(req.user.role === 'admin' ? '/admin' : '/dashboard');
    res.render('register');
});

router.get('/dashboard', authenticateToken, (req, res) => {
    if (req.user.role === 'admin') return res.redirect('/admin');
    res.render('dashboard', { user: req.user });
});

router.get('/admin', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.redirect('/dashboard');
    res.render('admin', { user: req.user });
});

module.exports = router;
