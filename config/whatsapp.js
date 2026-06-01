const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode');

let sock;
let qrCodeData = '';
let status = 'disconnected';

const initializeWhatsApp = async (io) => {
    const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info');

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }) // Silence logs for cleaner console
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log('QR RECEIVED');
            status = 'qr_ready';
            try {
                qrCodeData = await qrcode.toDataURL(qr);
                if (io) {
                    io.emit('qr', qrCodeData);
                    io.emit('status', status);
                }
            } catch (err) {
                console.error('Error generating QR code', err);
            }
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('connection closed due to ', lastDisconnect.error, ', reconnecting ', shouldReconnect);
            
            status = 'disconnected';
            qrCodeData = '';
            if (io) io.emit('status', status);
            
            if (shouldReconnect) {
                initializeWhatsApp(io);
            }
        } else if (connection === 'open') {
            console.log('Client is ready!');
            status = 'connected';
            qrCodeData = '';
            if (io) io.emit('status', status);
        }
    });

    sock.ev.on('creds.update', saveCreds);
};

const getStatus = () => status;
const getQrData = () => qrCodeData;

const sendMessage = async (number, message) => {
    if (status !== 'connected' || !sock) {
        throw new Error('WhatsApp client is not connected.');
    }
    // Baileys requires JID format for numbers
    const jid = number + "@s.whatsapp.net";
    await sock.sendMessage(jid, { text: message });
};

const logout = async () => {
     if(sock) {
         try {
            await sock.logout();
            status = 'disconnected';
            qrCodeData = '';
         } catch(err) {
             console.error("Logout Error:", err);
         }
     }
}


module.exports = {
    initializeWhatsApp,
    getStatus,
    getQrData,
    sendMessage,
    logout
};
