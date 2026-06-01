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

// Restore active sessions from DB
setTimeout(() => {
    whatsappManager.initSavedDevices();
}, 2000);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api', apiRoutes);
app.use('/', viewRoutes);

io.on('connection', (socket) => {
    socket.on('join_room', (userId) => {
        socket.join(`user_${userId}`);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`SaaS Server running on port ${PORT}`));
