const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cookieParser = require('cookie-parser');
const path = require('path');
const { apiRoutes } = require('./routes/apiRoutes');
const viewRoutes = require('./routes/viewRoutes');
const whatsappManager = require('./utils/whatsappManager');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

whatsappManager.setSocketIo(io);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api', apiRoutes);
app.use('/', viewRoutes);

// Socket.io connection handling
io.on('connection', (socket) => {
    socket.on('join_room', (userId) => {
        socket.join(`user_${userId}`);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Premium WatsApp server running on port ${PORT}`);
});
