const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs-extra');

class WhatsAppManager {
    constructor() {
        this.sessions = new Map();
        this.io = null;
    }

    setSocketIo(io) {
        this.io = io;
    }

    async createSession(userId) {
        if (this.sessions.has(userId)) {
            const currentSession = this.sessions.get(userId);
            if (currentSession.status === 'connected') return;
        }

        const authFolder = path.resolve(__dirname, `../baileys_auth_info/user_${userId}`);
        const { state, saveCreds } = await useMultiFileAuthState(authFolder);

        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }),
            browser: ['Lightweight Web App', 'Chrome', '1.0.0']
        });

        let sessionData = {
            sock,
            status: 'initializing',
            qr: '',
            pairingCode: ''
        };

        this.sessions.set(userId, sessionData);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                sessionData.status = 'qr_ready';
                sessionData.qr = await qrcode.toDataURL(qr);
                this.emitToUser(userId, 'qr_update', sessionData.qr);
                this.emitToUser(userId, 'status_update', sessionData.status);
            }

            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
                
                if (shouldReconnect) {
                    sessionData.status = 'reconnecting';
                    this.emitToUser(userId, 'status_update', sessionData.status);
                    setTimeout(() => this.createSession(userId), 5000);
                } else {
                    sessionData.status = 'disconnected';
                    this.emitToUser(userId, 'status_update', sessionData.status);
                    this.sessions.delete(userId);
                    // Cleanup auth folder
                    await fs.remove(authFolder).catch(()=>console.log("Could not delete auth folder"));
                }
            } else if (connection === 'open') {
                sessionData.status = 'connected';
                sessionData.qr = '';
                this.emitToUser(userId, 'status_update', sessionData.status);
            }
        });

        sock.ev.on('creds.update', saveCreds);
        return sessionData;
    }

    async requestPairingCode(userId, phoneNumber) {
        const session = this.sessions.get(userId);
        if (!session || !session.sock) throw new Error("يجب تهيئة الاتصال أولاً بالضغط على توليد كود.");
        
        if (session.status === 'connected') throw new Error("الواتساب متصل بالفعل.");

        const code = await session.sock.requestPairingCode(phoneNumber);
        session.pairingCode = code;
        this.emitToUser(userId, 'pairing_code_update', code);
        return code;
    }

    emitToUser(userId, event, data) {
        if (this.io) {
            this.io.to(`user_${userId}`).emit(event, data);
        }
    }

    getStatus(userId) {
        const session = this.sessions.get(userId);
        return session ? session.status : 'disconnected';
    }

    getQr(userId) {
        const session = this.sessions.get(userId);
        return session ? session.qr : '';
    }

    async sendMessage(userId, number, messageText, mediaUrl = null) {
        const session = this.sessions.get(userId);
        if (!session || session.status !== 'connected') {
            throw new Error('الواتساب غير متصل.');
        }

        const jid = number + "@s.whatsapp.net";
        let messageObj = { text: messageText };

        if (mediaUrl) {
            // Note: Simplistic implementation, expecting path to file. 
            // Better to use Document or Image types from baileys based on mime type.
            messageObj = {
                document: { url: mediaUrl },
                mimetype: 'application/pdf', // fallback, should be dynamic in reality
                fileName: path.basename(mediaUrl),
                caption: messageText
            };
        }

        await session.sock.sendMessage(jid, messageObj);
    }

    async logout(userId) {
        const session = this.sessions.get(userId);
        if (session && session.sock) {
            try {
                await session.sock.logout();
            } catch (err) {
                console.error("Logout Error:", err);
            }
        }
        this.sessions.delete(userId);
        const authFolder = path.resolve(__dirname, `../baileys_auth_info/user_${userId}`);
        await fs.remove(authFolder).catch(()=>console.log("Could not delete auth folder"));
    }
}

module.exports = new WhatsAppManager();
