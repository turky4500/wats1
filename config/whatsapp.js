const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');

let client;
let qrCodeData = '';
let status = 'disconnected';

const initializeWhatsApp = (io) => {
    client = new Client({
        authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
        puppeteer: {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-extensions']
        }
    });

    client.on('qr', async (qr) => {
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
    });

    client.on('ready', () => {
        console.log('Client is ready!');
        status = 'connected';
        qrCodeData = '';
        if (io) {
            io.emit('status', status);
        }
    });

    client.on('authenticated', () => {
        console.log('AUTHENTICATED');
    });

    client.on('auth_failure', msg => {
        console.error('AUTHENTICATION FAILURE', msg);
        status = 'auth_failure';
        if (io) {
            io.emit('status', status);
        }
    });

    client.on('disconnected', (reason) => {
        console.log('Client was logged out', reason);
        status = 'disconnected';
        qrCodeData = '';
        if (io) {
            io.emit('status', status);
        }
        // Reinitialize client
        setTimeout(() => {
            initializeWhatsApp(io);
        }, 5000);
    });

    client.initialize();
};

const getStatus = () => status;
const getQrData = () => qrCodeData;
const sendMessage = async (number, message) => {
    if (status !== 'connected') {
        throw new Error('WhatsApp client is not connected.');
    }
    const chatId = number + "@c.us";
    await client.sendMessage(chatId, message);
};
const logout = async () => {
     if(client) {
         try {
            await client.logout();
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
