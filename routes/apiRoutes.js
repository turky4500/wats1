const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database/db');
const { sendMessage } = require('../config/whatsapp');

const JWT_SECRET = 'your_super_secret_key_change_this_in_production';

// Auth middleware
const authenticateToken = (req, res, next) => {
    const token = req.cookies?.token || req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token.' });
        req.user = user;
        next();
    });
};

const isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ error: 'Access denied. Admin only.' });
    }
};

// --- API Routes ---

// Login
router.post('/login', (req, res) => {
    const { username, password } = req.body;

    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
        if (err) return res.status(500).json({ error: 'Database error.' });
        if (!user) return res.status(400).json({ error: 'Invalid username or password.' });

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(400).json({ error: 'Invalid username or password.' });

        const token = jwt.sign({ id: user.id, username: user.username, role: user.role, can_send_messages: user.can_send_messages }, JWT_SECRET, { expiresIn: '24h' });
        
        // Use cookie for easier frontend management in this lightweight app
        res.cookie('token', token, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
        res.json({ message: 'Logged in successfully', role: user.role });
    });
});

// Logout
router.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Logged out successfully' });
});

// --- Admin Routes ---

// Get all users
router.get('/users', authenticateToken, isAdmin, (req, res) => {
    db.all("SELECT id, username, role, can_send_messages FROM users WHERE role != 'admin'", [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error.' });
        res.json(rows);
    });
});

// Add user
router.post('/users', authenticateToken, isAdmin, async (req, res) => {
    const { username, password } = req.body;
    if(!username || !password) return res.status(400).json({ error: 'Username and password required' });

    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        db.run(`INSERT INTO users (username, password) VALUES (?, ?)`, [username, hashedPassword], function(err) {
            if (err) {
                 if(err.message.includes('UNIQUE constraint failed')) {
                     return res.status(400).json({ error: 'Username already exists.' });
                 }
                 return res.status(500).json({ error: 'Database error.' });
            }
            res.json({ message: 'User added successfully', id: this.lastID });
        });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete user
router.delete('/users/:id', authenticateToken, isAdmin, (req, res) => {
    const id = req.params.id;
    db.run(`DELETE FROM users WHERE id = ? AND role != 'admin'`, [id], function(err) {
        if (err) return res.status(500).json({ error: 'Database error.' });
        res.json({ message: 'User deleted successfully' });
    });
});

// Toggle send message permission
router.put('/users/:id/toggle-permission', authenticateToken, isAdmin, (req, res) => {
    const id = req.params.id;
    const { can_send_messages } = req.body;
    
    db.run(`UPDATE users SET can_send_messages = ? WHERE id = ?`, [can_send_messages, id], function(err) {
        if (err) return res.status(500).json({ error: 'Database error.' });
        res.json({ message: 'Permission updated successfully' });
    });
});


// --- User Routes ---
// Get current user info
router.get('/me', authenticateToken, (req, res) => {
    db.get('SELECT id, username, role, can_send_messages FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if(err) return res.status(500).json({error: 'Database error'});
        if(!user) return res.status(404).json({error: 'User not found'});
        res.json(user);
    })
});

// Send WhatsApp message
router.post('/send-message', authenticateToken, async (req, res) => {
    const { number, message } = req.body;
    
    // Re-verify permission from DB directly to be safe
    db.get('SELECT can_send_messages FROM users WHERE id = ?', [req.user.id], async (err, user) => {
        if (err) return res.status(500).json({ error: 'Database error.' });
        if (!user || user.can_send_messages === 0) {
            return res.status(403).json({ error: 'You do not have permission to send messages.' });
        }

        try {
            await sendMessage(number, message);
            res.json({ success: true, message: 'Message sent successfully.' });
        } catch (error) {
            console.error('Error sending message:', error);
            res.status(500).json({ error: 'Failed to send message. Ensure WhatsApp is connected.' });
        }
    });
});

module.exports = {
    apiRoutes: router,
    authenticateToken
};
