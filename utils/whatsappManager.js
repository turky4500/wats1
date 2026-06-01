const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs-extra');
const db = require('../database/db');

class WhatsAppManager {
    constructor() {
        this.sessions = new Map(); // Key: device_id, Value: sessionData
        this.io = null;
    }

    setSocketIo(io) {
        this.io = io;
    }

    async createSession(userId, deviceId) {
        if (this.sessions.has(deviceId)) {
            const currentSession = this.sessions.get(deviceId);
            if (currentSession.status === 'connected') return;
        }

        const authFolder = path.resolve(__dirname, `../baileys_auth_info/device_${deviceId}`);
        const { state, saveCreds } = await useMultiFileAuthState(authFolder);

        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }),
            browser: ['EasyWhats App', 'Chrome', '1.0.0']
        });

        let sessionData = {
            sock,
            userId,
            deviceId,
            status: 'initializing',
            qr: '',
            pairingCode: ''
        };

        this.sessions.set(deviceId, sessionData);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                sessionData.status = 'qr_ready';
                sessionData.qr = await qrcode.toDataURL(qr);
                this.emitToUser(userId, 'qr_update', { deviceId, qr: sessionData.qr });
                this.updateDeviceStatus(deviceId, 'qr_ready');
            }

            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
                
                if (shouldReconnect) {
                    sessionData.status = 'reconnecting';
                    this.updateDeviceStatus(deviceId, 'reconnecting');
                    setTimeout(() => this.createSession(userId, deviceId), 5000);
                } else {
                    sessionData.status = 'disconnected';
                    this.updateDeviceStatus(deviceId, 'disconnected');
                    this.sessions.delete(deviceId);
                    await fs.remove(authFolder).catch(()=>{});
                }
            } else if (connection === 'open') {
                sessionData.status = 'connected';
                sessionData.qr = '';
                
                // Get phone number
                const phoneNumber = sock.user.id.split(':')[0];
                db.run('UPDATE devices SET status = ?, phone_number = ? WHERE id = ?', ['connected', phoneNumber, deviceId]);
                this.emitToUser(userId, 'status_update', { deviceId, status: 'connected', phone: phoneNumber });
            }
        });

        sock.ev.on('creds.update', saveCreds);

        // Auto Reply Listener
        sock.ev.on('messages.upsert', async (m) => {
            const msg = m.messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
            if (!text) return;

            // Check auto replies for this device
            db.all('SELECT * FROM auto_replies WHERE device_id = ? AND is_active = 1', [deviceId], async (err, replies) => {
                if (err || !replies) return;
                for (const reply of replies) {
                    if (text.toLowerCase().includes(reply.keyword.toLowerCase())) {
                        try {
                            const jid = msg.key.remoteJid;
                            let msgToSend = { text: reply.reply_content };
                            if (reply.media_url) {
                                msgToSend = {
                                    document: { url: reply.media_url },
                                    mimetype: 'application/pdf',
                                    fileName: path.basename(reply.media_url),
                                    caption: reply.reply_content
                                };
                            }
                            await sock.sendMessage(jid, msgToSend);
                        } catch (e) {
                            console.error("Auto Reply Error: ", e);
                        }
                        break; // Stop after first match
                    }
                }
            });
        });

        return sessionData;
    }

    async requestPairingCode(userId, deviceId, phoneNumber) {
        const session = this.sessions.get(deviceId);
        if (!session || !session.sock) throw new Error("يجب تهيئة الاتصال أولاً.");
        if (session.status === 'connected') throw new Error("الواتساب متصل بالفعل.");

        const code = await session.sock.requestPairingCode(phoneNumber);
        session.pairingCode = code;
        this.emitToUser(userId, 'pairing_code_update', { deviceId, code });
        return code;
    }

    updateDeviceStatus(deviceId, status) {
        db.run('UPDATE devices SET status = ? WHERE id = ?', [status, deviceId]);
    }

    emitToUser(userId, event, data) {
        if (this.io) {
            this.io.to(`user_${userId}`).emit(event, data);
        }
    }

    async sendMessage(deviceId, number, messageText, mediaUrl = null) {
        const session = this.sessions.get(deviceId);
        if (!session || session.status !== 'connected') {
            throw new Error('الجهاز غير متصل.');
        }

        const jid = number + "@s.whatsapp.net";
        let messageObj = { text: messageText };

        if (mediaUrl) {
            messageObj = {
                document: { url: mediaUrl },
                mimetype: 'application/pdf',
                fileName: path.basename(mediaUrl),
                caption: messageText
            };
        }

        await session.sock.sendMessage(jid, messageObj);
    }

    async logout(deviceId) {
        const session = this.sessions.get(deviceId);
        if (session && session.sock) {
            try { await session.sock.logout(); } catch (err) {}
        }
        this.sessions.delete(deviceId);
        db.run('UPDATE devices SET status = ?, phone_number = NULL WHERE id = ?', ['disconnected', deviceId]);
        const authFolder = path.resolve(__dirname, `../baileys_auth_info/device_${deviceId}`);
        await fs.remove(authFolder).catch(()=>{});
    }

    // Initialize all connected devices on server start
    async initSavedDevices() {
        db.all("SELECT id, user_id FROM devices WHERE status = 'connected'", [], (err, devices) => {
            if (err || !devices) return;
            devices.forEach(d => {
                this.createSession(d.user_id, d.id);
            });
        });
    }
}

module.exports = new WhatsAppManager();
