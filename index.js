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
const pixelRoutes = require('./routes/pixelRoutes');
const customDomainRoutes = require('./routes/customDomainRoutes');
const QuoteRoutes = require('./routes/quoteRoutes');
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

app.use(async (req, res, next) => {
  if (req.path === '/auth/refresh-token' || req.path === '/auth/login') {
    return next();
  }
  
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    
    try {
      const decoded = jwt.decode(token);
      if (decoded && decoded.exp * 1000 < Date.now()) {
        const refreshToken = req.cookies.refreshToken;
        if (refreshToken) {
          const newToken = await refreshAccessToken(refreshToken);
          if (newToken) {
            req.headers.authorization = `Bearer ${newToken}`;
            res.set('X-New-Access-Token', newToken);
          }
        }
      }
    } catch (error) {
      console.log('Token refresh middleware:', error.message);
    }
  }
  next();
});

async function refreshAccessToken(refreshToken) {
  try {
    const user = await User.findOne({ where: { refresh_token: refreshToken } });
    if (!user) return null;
    
    const newToken = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_ACCESS_EXPIRATION }
    );
    
    return newToken;
  } catch (error) {
    console.error('Token refresh failed:', error);
    return null;
  }
}

const verifyToken = async (token, ws) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      if (ws && ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({
          type: 'TOKEN_EXPIRED',
          message: 'Access token expired. Please refresh your token.',
          expiredAt: error.expiredAt.toISOString()
        }));
      }
      throw error;
    }
    
    if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token format');
    }
    
    if (error.name === 'NotBeforeError') {
      throw new Error('Token not yet valid');
    }
    
    throw error;
  }
};

wss.on('connection', (ws, req) => {
  const token = url.parse(req.url, true).query.token;
  
  if (!token) {
    ws.close(1008, 'Token manquant');
    return;
  }

  const handleConnection = async () => {
    try {
      const decoded = await verifyToken(token, ws);
      const userId = decoded.id.toString();

      const heartbeatInterval = setInterval(() => {
        if (ws.readyState !== ws.OPEN) return;
        ws.ping();
      }, 30000);

      ws.on('pong', () => {
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

      ws.on('message', async (message) => {
        try {
          const data = JSON.parse(message.toString());
          
          if (data.type === 'REFRESH_TOKEN') {
            const newToken = await refreshAccessToken(data.refreshToken);
            if (newToken) {
              ws.send(JSON.stringify({
                type: 'NEW_TOKEN',
                token: newToken
              }));
            } else {
              ws.send(JSON.stringify({
                type: 'REFRESH_FAILED',
                message: 'Failed to refresh token'
              }));
            }
            return;
          }
          
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
      //console.error('WebSocket authentication error:', error.message);
      
      let closeReason = 'Authentication failed';
      if (error.message.includes('expired')) {
        closeReason = `Token expired at ${error.expiredAt}`;
        return;
      } else if (error.message.includes('Invalid token format')) {
        closeReason = 'Invalid token format';
      } else if (error.message.includes('not yet valid')) {
        closeReason = 'Token not yet valid';
      }
      
      ws.close(1008, closeReason);
    }
  };

  handleConnection();
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
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
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
app.use('/pixel', pixelRoutes);
app.use('/custom-domain', customDomainRoutes);
app.use('/quotes', QuoteRoutes);

app.post('/auth/refresh-token', async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token missing' });
    }

    const newToken = await refreshAccessToken(refreshToken);
    if (!newToken) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    res.json({ token: newToken });
  } catch (error) {
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

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