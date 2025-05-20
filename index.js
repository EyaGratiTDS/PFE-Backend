const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const cookieParser = require('cookie-parser');
const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const passwordRoutes = require('./routes/passwordRoutes');
const vcardRoutes = require('./routes/vcardRoutes');
const blockRoutes = require('./routes/blockRoutes');
const activityLogRoutes = require('./routes/activityLogsRoutes');
const apiKeyRoutes = require('./routes/apiKeyRoutes');
const planRoutes = require('./routes/planRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const LimitsRoutes = require('./routes/LimiteRoutes');
const projectRoutes = require('./routes/projectRoutes');
const sequelize = require('./database/sequelize');
const { requireAuth } = require('./middleware/authMiddleware');
const path = require("path");
const jwt = require('jsonwebtoken');
const url = require('url');
const { createServer } = require('http');
const { Server } = require('ws');
require('./config/passport');

const app = express();
const PORT = process.env.PORT || 3000;
const httpServer = createServer(app);

const wss = new Server({
  server: httpServer,
  path: '/ws',
  clientTracking: true
});

const clients = new Map();

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  methods: 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
  allowedHeaders: 'Content-Type, Authorization, Stripe-Version',
  credentials: true
}));

wss.on('connection', (ws, req) => {
  const token = url.parse(req.url, true).query.token;
  if (!token) {
    ws.close(1008, 'Token manquant');
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id.toString();

    ws.isAlive = true;

    const heartbeatInterval = setInterval(() => {
      if (ws.isAlive !== true) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    }, 3000);

    ws.on('pong', () => {
      ws.isAlive = true;
      ws.send(JSON.stringify({ type: 'HEARTBEAT_ACK' }));
    });

    if (!clients.has(userId)) {
      clients.set(userId, new Set());
    }
    clients.get(userId).add(ws);

    ws.on('close', () => {
      clearInterval(heartbeatInterval);
      if (clients.has(userId)) {
        clients.get(userId).delete(ws);
        if (clients.get(userId).size === 0) {
          clients.delete(userId);
        }
      }
    });

    ws.on('message', (message) => {

      ws.isAlive = true; 
      try {
        const data = JSON.parse(message.toString());
         if (data.type === 'PING') {
            ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
          }
        if (data.type === 'IDENTIFY' && data.userId) {
          const clientUserId = data.userId.toString();
          if (clientUserId !== userId) {
            if (clients.has(userId)) {
              clients.get(userId).delete(ws);
              if (clients.get(userId).size === 0) {
                clients.delete(userId);
              }
            }
            if (!clients.has(clientUserId)) {
              clients.set(clientUserId, new Set());
            }
            clients.get(clientUserId).add(ws);
          }
        }
      } catch (error) {
        console.error('Error processing message:', error);
      }
    });
  } catch (error) {
    console.error('WebSocket authentication error:', error);
    ws.close(1008, 'Authentication failed');
  }
});

const broadcastToUser = (userId, data) => {
  if (!clients.has(userId)) {
    return; 
  }

  const message = JSON.stringify(data);
  clients.get(userId).forEach(client => {
    if (client.readyState === 1) { 
      client.send(message, { compress: true }, (err) => {
        if (err) {
          console.error(`Erreur d'envoi à ${userId}:`, err);
        }
      });
    }
  });
};

app.locals.wsBroadcastToUser = broadcastToUser;

app.use(session({
  secret: process.env.SESSION_SECRET || 'vcard-session',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

app.use(cookieParser());
app.use(passport.initialize());
app.use(passport.session());

app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use('/users', userRoutes);
app.use('/auth', authRoutes);
app.use('/password', passwordRoutes);
app.use('/vcard', requireAuth, vcardRoutes);
app.use('/block', requireAuth, blockRoutes);
app.use('/activity-logs', activityLogRoutes);
app.use('/apiKey', requireAuth, apiKeyRoutes);
app.use('/plans', planRoutes);
app.use('/subscription', subscriptionRoutes);
app.use('/payment', paymentRoutes);
app.use('/notification', notificationRoutes);
app.use('/limits', LimitsRoutes);
app.use('/project', projectRoutes);

app.get('/', (_req, res) => {
  res.send('Welcome to the User Management API!');
});

app.get('/api/status', (_req, res) => {
  res.json({
    status: 'online',
    activeWebSocketConnections: Array.from(clients.keys()).reduce((acc, userId) => {
      acc[userId] = clients.get(userId).size;
      return acc;
    }, {}),
    uptime: process.uptime()
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`WebSocket server is available at ws://localhost:${PORT}/ws`);
});

const syncDatabase = async () => {
  try {
    await sequelize.sync({ alter: true });
    console.log('Synchronized database');
  } catch (error) {
    console.error('Error while synchronizing:', error);
  }
};

syncDatabase();