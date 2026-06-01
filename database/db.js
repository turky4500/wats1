const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error('Error connecting to SQLite database', err);
    else {
        console.log('Connected to SQLite database.');
        initDb();
    }
});

const initDb = () => {
    db.serialize(() => {
        // Users & SaaS Plans
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'user',
            plan_id INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS plans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            max_devices INTEGER DEFAULT 1,
            max_contacts INTEGER DEFAULT 1000,
            max_campaigns INTEGER DEFAULT 5
        )`);

        // Devices (WhatsApp Sessions)
        db.run(`CREATE TABLE IF NOT EXISTS devices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            session_id TEXT UNIQUE NOT NULL,
            phone_number TEXT,
            status TEXT DEFAULT 'disconnected',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`);

        // Contacts
        db.run(`CREATE TABLE IF NOT EXISTS contacts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT,
            phone_number TEXT NOT NULL,
            group_name TEXT DEFAULT 'default',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`);

        // Campaigns
        db.run(`CREATE TABLE IF NOT EXISTS campaigns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            device_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            message_content TEXT NOT NULL,
            media_url TEXT,
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (device_id) REFERENCES devices(id)
        )`);

        // Auto Replies
        db.run(`CREATE TABLE IF NOT EXISTS auto_replies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            device_id INTEGER NOT NULL,
            keyword TEXT NOT NULL,
            reply_content TEXT NOT NULL,
            media_url TEXT,
            is_active INTEGER DEFAULT 1,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (device_id) REFERENCES devices(id)
        )`);

        // Seed basic plans and admin
        db.get("SELECT count(*) as count FROM plans", (err, row) => {
            if (row.count === 0) {
                db.run(`INSERT INTO plans (name, max_devices, max_contacts, max_campaigns) VALUES ('Starter', 1, 1000, 5)`);
                db.run(`INSERT INTO plans (name, max_devices, max_contacts, max_campaigns) VALUES ('Growth', 3, 10000, 50)`);
                db.run(`INSERT INTO plans (name, max_devices, max_contacts, max_campaigns) VALUES ('Pro', 10, 100000, 500)`);
            }
        });

        db.get("SELECT * FROM users WHERE role = 'admin'", async (err, row) => {
            if (!row) {
                const salt = await bcrypt.genSalt(10);
                const hashedPassword = await bcrypt.hash('admin123', salt);
                db.run(
                    `INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, 'admin')`,
                    ['admin', 'admin@easywhats.app', hashedPassword]
                );
            }
        });
    });
};

module.exports = db;
