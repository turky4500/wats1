const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const path = require('path');
const cookieParser = require('cookie-parser');

const { apiRoutes, authenticateToken } = require('./routes/apiRoutes');
const viewRoutes = require('./routes/viewRoutes');
const { initializeWhatsApp, getStatus, getQrData } = require('./config/whatsapp');

const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Set EJS as templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
app.use('/', viewRoutes);
app.use('/api', apiRoutes);

// Socket.io connection for real-time QR/status updates
io.on('connection', (socket) => {
    console.log('A user connected');
    
    // Send current status on connect
    socket.emit('status', getStatus());
    if (getStatus() === 'qr_ready') {
        socket.emit('qr', getQrData());
    }

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

// Initialize WhatsApp Client and pass socket io instance
initializeWhatsApp(io);

server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
