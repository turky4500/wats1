const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs-extra');
const db = require('../database/db');

class WhatsAppManager {
    constructor() {
        this.sessions = new Map(); // deviceId → { sock, userId, status, qr, pairingCode }
        this.io = null;
    }

    setSocketIo(io) { this.io = io; }

    getSession(deviceId) { return this.sessions.get(String(deviceId)); }

    getCurrentQR(deviceId) {
        const s = this.getSession(deviceId);
        return s ? s.qr : null;
    }

    async createSession(userId, deviceId) {
        deviceId = String(deviceId);
        const existing = this.sessions.get(deviceId);
        if (existing && existing.status === 'connected') return existing;

        const authFolder = path.resolve(__dirname, `../baileys_auth_info/device_${deviceId}`);
        await fs.ensureDir(authFolder);
        const { state, saveCreds } = await useMultiFileAuthState(authFolder);

        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }),
            browser: ['EasyWhats', 'Chrome', '3.0.0'],
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
        });

        const sessionData = { sock, userId: String(userId), deviceId, status: 'initializing', qr: null, pairingCode: null };
        this.sessions.set(deviceId, sessionData);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                try {
                    sessionData.qr = await qrcode.toDataURL(qr, { width: 256, margin: 1 });
                    sessionData.status = 'qr_ready';
                    this._emit(userId, 'qr_update', { deviceId, qr: sessionData.qr });
                    this._updateDeviceStatus(deviceId, 'qr_ready');
                } catch (e) { console.error('QR gen error:', e.message); }
            }

            if (connection === 'close') {
                const code = lastDisconnect?.error?.output?.statusCode;
                const loggedOut = code === DisconnectReason.loggedOut;
                sessionData.status = 'disconnected';
                this._emit(userId, 'status_update', { deviceId, status: 'disconnected' });
                this._updateDeviceStatus(deviceId, 'disconnected');
                this.sessions.delete(deviceId);

                if (!loggedOut) {
                    console.log(`Device ${deviceId} reconnecting in 5s...`);
                    setTimeout(() => this.createSession(userId, deviceId), 5000);
                } else {
                    await fs.remove(authFolder).catch(() => {});
                    db.run('UPDATE devices SET status=?, phone_number=NULL WHERE id=?', ['disconnected', deviceId]);
                }
            }

            if (connection === 'open') {
                const phone = sock.user?.id?.split(':')[0] || '';
                sessionData.status = 'connected';
                sessionData.qr = null;
                db.run('UPDATE devices SET status=?, phone_number=? WHERE id=?', ['connected', phone, deviceId]);
                this._emit(userId, 'status_update', { deviceId, status: 'connected', phone });
            }
        });

        sock.ev.on('creds.update', saveCreds);

        // ── Auto Reply Listener ────────────────────────────────────────────────
        sock.ev.on('messages.upsert', async ({ messages }) => {
            const msg = messages[0];
            if (!msg?.message || msg.key.fromMe) return;

            const text = msg.message.conversation
                || msg.message.extendedTextMessage?.text
                || msg.message.imageMessage?.caption
                || '';
            if (!text) return;

            db.all('SELECT * FROM auto_replies WHERE device_id=? AND is_active=1', [deviceId], async (err, replies) => {
                if (err || !replies?.length) return;
                for (const reply of replies) {
                    const keyword = reply.keyword.toLowerCase();
                    const msgLower = text.toLowerCase();
                    const matches = reply.match_type === 'exact' ? msgLower === keyword : msgLower.includes(keyword);
                    if (matches) {
                        try {
                            const jid = msg.key.remoteJid;
                            if (reply.media_url) {
                                await sock.sendMessage(jid, {
                                    document: { url: reply.media_url },
                                    fileName: path.basename(reply.media_url),
                                    caption: reply.reply_content
                                });
                            } else {
                                await sock.sendMessage(jid, { text: reply.reply_content });
                            }
                            // Log to archive
                            const sender = jid.split('@')[0];
                            db.run(
                                `INSERT INTO message_archive (user_id,device_id,recipient_phone,message_content,media_url,type,status)
                                 VALUES (?,?,?,?,?,'auto_reply','sent')`,
                                [userId, deviceId, sender, reply.reply_content, reply.media_url || null]
                            );
                            db.run('UPDATE auto_replies SET trigger_count=trigger_count+1 WHERE id=?', [reply.id]);
                        } catch (e) { console.error('Auto-reply error:', e.message); }
                        break;
                    }
                }
            });
        });

        return sessionData;
    }

    async requestPairingCode(userId, deviceId, phoneNumber) {
        deviceId = String(deviceId);
        // Clean phone: digits only
        const cleanPhone = phoneNumber.replace(/\D/g, '');
        if (!this.sessions.has(deviceId)) {
            await this.createSession(userId, deviceId);
            await new Promise(r => setTimeout(r, 3000));
        }
        const session = this.sessions.get(deviceId);
        if (!session?.sock) throw new Error('Session not ready. Try again.');
        const code = await session.sock.requestPairingCode(cleanPhone);
        // WhatsApp returns 8-digit codes; ensure display as XXXX-XXXX
        const cleaned = code?.replace(/\D/g, '') || code || '';
        session.pairingCode = cleaned;
        this._emit(userId, 'pairing_code_update', { deviceId, code: cleaned });
        return cleaned;
    }

    async sendMessage(deviceId, number, text, mediaPath = null) {
        deviceId = String(deviceId);
        const session = this.sessions.get(deviceId);
        if (!session || session.status !== 'connected') throw new Error('الجهاز غير متصل.');
        const jid = number.replace(/\D/g, '') + '@s.whatsapp.net';
        if (mediaPath) {
            const absPath = path.resolve(__dirname, '..', mediaPath.replace(/^\//, ''));
            const ext = path.extname(absPath).toLowerCase();
            const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
            if (isImage) {
                await session.sock.sendMessage(jid, { image: { url: absPath }, caption: text });
            } else {
                await session.sock.sendMessage(jid, {
                    document: { url: absPath },
                    fileName: path.basename(absPath),
                    caption: text
                });
            }
        } else {
            await session.sock.sendMessage(jid, { text });
        }
    }

    async logout(deviceId) {
        deviceId = String(deviceId);
        const session = this.sessions.get(deviceId);
        if (session?.sock) {
            try { await session.sock.logout(); } catch { }
        }
        this.sessions.delete(deviceId);
        db.run('UPDATE devices SET status=?, phone_number=NULL WHERE id=?', ['disconnected', deviceId]);
        const authFolder = path.resolve(__dirname, `../baileys_auth_info/device_${deviceId}`);
        await fs.remove(authFolder).catch(() => {});
    }

    async initSavedDevices() {
        db.all("SELECT id, user_id FROM devices WHERE status='connected'", [], (err, devices) => {
            if (!devices?.length) return;
            for (const d of devices) {
                setTimeout(() => this.createSession(d.user_id, d.id), 1000);
            }
        });
    }

    _emit(userId, event, data) {
        if (this.io) this.io.to(`user_${userId}`).emit(event, data);
    }

    _updateDeviceStatus(deviceId, status) {
        db.run('UPDATE devices SET status=? WHERE id=?', [status, deviceId]);
    }
}

module.exports = new WhatsAppManager();
