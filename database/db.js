const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.resolve(__dirname, 'database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to database', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    initDb();
  }
});

const initDb = () => {
  db.serialize(() => {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user', -- 'admin' or 'user'
      can_send_messages INTEGER DEFAULT 0 -- 0: no, 1: yes
    )`);

    // Insert default admin if not exists
    db.get("SELECT * FROM users WHERE role = 'admin'", async (err, row) => {
      if (err) {
        console.error("Error checking admin user:", err);
        return;
      }
      if (!row) {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('admin123', salt);
        db.run(
          `INSERT INTO users (username, password, role, can_send_messages) VALUES (?, ?, 'admin', 1)`,
          ['admin', hashedPassword],
          (err) => {
            if (err) {
              console.error("Error creating default admin:", err);
            } else {
              console.log("Default admin created (username: admin, password: admin123)");
            }
          }
        );
      }
    });
  });
};

module.exports = db;
