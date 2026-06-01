const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = process.env.DB_PATH || path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error('SQLite Error:', err);
    else { console.log('Connected to SQLite database.'); initDb(); }
});

const initDb = () => {
    db.serialize(() => {
        db.run('PRAGMA foreign_keys = ON');

        // ── Plans ─────────────────────────────────────────────────────────────
        db.run(`CREATE TABLE IF NOT EXISTS plans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            max_devices INTEGER DEFAULT 1,
            max_contacts INTEGER DEFAULT 1000,
            max_campaigns INTEGER DEFAULT 5,
            max_auto_replies INTEGER DEFAULT 3
        )`);

        // ── Users ─────────────────────────────────────────────────────────────
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            email TEXT UNIQUE,
            phone TEXT UNIQUE,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'user',
            plan_id INTEGER DEFAULT 1,
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (plan_id) REFERENCES plans(id)
        )`);

        // ── Devices ───────────────────────────────────────────────────────────
        db.run(`CREATE TABLE IF NOT EXISTS devices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            session_id TEXT UNIQUE NOT NULL,
            phone_number TEXT,
            status TEXT DEFAULT 'disconnected',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )`);

        // ── Contacts ──────────────────────────────────────────────────────────
        db.run(`CREATE TABLE IF NOT EXISTS contacts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT DEFAULT '',
            phone_number TEXT NOT NULL,
            group_name TEXT DEFAULT 'default',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )`);

        // ── Campaigns ─────────────────────────────────────────────────────────
        db.run(`CREATE TABLE IF NOT EXISTS campaigns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            device_id INTEGER,
            name TEXT NOT NULL,
            message_content TEXT NOT NULL,
            media_url TEXT,
            total_count INTEGER DEFAULT 0,
            sent_count INTEGER DEFAULT 0,
            failed_count INTEGER DEFAULT 0,
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )`);

        // ── Message Archive ───────────────────────────────────────────────────
        db.run(`CREATE TABLE IF NOT EXISTS message_archive (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            device_id INTEGER,
            campaign_id INTEGER,
            recipient_phone TEXT NOT NULL,
            recipient_name TEXT DEFAULT '',
            message_content TEXT NOT NULL,
            media_url TEXT,
            type TEXT DEFAULT 'campaign',
            status TEXT DEFAULT 'sent',
            sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )`);

        // ── Auto Replies ──────────────────────────────────────────────────────
        db.run(`CREATE TABLE IF NOT EXISTS auto_replies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            device_id INTEGER NOT NULL,
            keyword TEXT NOT NULL,
            reply_content TEXT NOT NULL,
            media_url TEXT,
            match_type TEXT DEFAULT 'contains',
            is_active INTEGER DEFAULT 1,
            trigger_count INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )`);

        // ── Seed Plans ────────────────────────────────────────────────────────
        db.get("SELECT COUNT(*) as c FROM plans", (err, row) => {
            if (!err && row.c === 0) {
                db.run(`INSERT INTO plans VALUES (1,'Starter',1,1000,5,3)`);
                db.run(`INSERT INTO plans VALUES (2,'Growth',3,10000,50,20)`);
                db.run(`INSERT INTO plans VALUES (3,'Pro',10,100000,500,100)`);
                db.run(`INSERT INTO plans VALUES (4,'Admin',999,999999,99999,99999)`);
            }
        });

        // ── Seed Admin User ───────────────────────────────────────────────────
        db.get("SELECT id FROM users WHERE role='admin'", async (err, row) => {
            if (!row) {
                const hash = await bcrypt.hash('admin123', 10);
                db.run(`INSERT INTO users (username,email,password,role,plan_id) VALUES (?,?,?,?,?)`,
                    ['admin','admin@easywhats.app', hash, 'admin', 4]);
                console.log('Admin user seeded: admin@easywhats.app / admin123');
            }
        });
    });
};

module.exports = db;
