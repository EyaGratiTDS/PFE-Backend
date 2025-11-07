require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const cookieParser = require('cookie-parser');
const path = require('path');
const jwt = require('jsonwebtoken');
const url = require('url');
const { createServer } = require('http');
const { Server } = require('ws');
const net = require('net');
const sequelize = require('./database/sequelize');
const { requireAuth } = require('./middleware/authMiddleware');
require('./config/passport');

// Import routes
const routes = {
  user: require('./routes/userRoutes'),
  auth: require('./routes/authRoutes'),
  password: require('./routes/passwordRoutes'),
  vcard: require('./routes/vcardRoutes'),
  block: require('./routes/blockRoutes'),
  activityLogs: require('./routes/activityLogsRoutes'),
  apiKey: require('./routes/apiKeyRoutes'),
  plans: require('./routes/planRoutes'),
  subscription: require('./routes/subscriptionRoutes'),
  payment: require('./routes/paymentRoutes'),
  notification: require('./routes/notificationRoutes'),
  limits: require('./routes/LimiteRoutes'),
  project: require('./routes/projectRoutes'),
  pixel: require('./routes/pixelRoutes'),
  customDomain: require('./routes/customDomainRoutes'),
  quotes: require('./routes/quoteRoutes'),
  visitor: require('./routes/visitorRoutes'),
  webNotifications: require('./routes/webNotificationRoutes'),
  ia: require('./routes/iaRoutes') // ✅ Ajout des routes IA
};

const app = express();
const PORT = process.env.PORT || 3000;

// HTTP + WebSocket
const httpServer = createServer(app);
const wss = new Server({ server: httpServer, path: '/ws', clientTracking: true });
const clients = new Map(); // userId -> Set(ws)

// --------------------
// Middleware
// --------------------
app.use(cors({
  origin: process.env.FRONTEND_URL,
  methods: 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
  allowedHeaders: 'Content-Type, Authorization, Stripe-Version',
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'vcard-session',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.NODE_ENV === 'production', sameSite: 'lax', httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }
}));
app.use(passport.initialize());
app.use(passport.session());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// --------------------
// Routes
// --------------------
app.use('/users', routes.user);
app.use('/auth', routes.auth);
app.use('/password', routes.password);
app.use('/vcard', routes.vcard);
app.use('/block', routes.block);
app.use('/activity-logs', routes.activityLogs);
app.use('/apiKey', requireAuth, routes.apiKey);
app.use('/plans', routes.plans);
app.use('/subscription', routes.subscription);
app.use('/payment', routes.payment);
app.use('/notification', routes.notification);
app.use('/limits', routes.limits);
app.use('/project', routes.project);
app.use('/pixel', routes.pixel);
app.use('/custom-domain', routes.customDomain);
app.use('/quotes', routes.quotes);
app.use('/visitor', routes.visitor);
app.use('/web-notifications', routes.webNotifications);
app.use('/ia', routes.ia); // ✅ Routes IA

// Refresh token endpoint
app.post('/auth/refresh-token', async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) return res.status(401).json({ error: 'Refresh token missing' });

    const user = await sequelize.models.User.findOne({ where: { refresh_token: refreshToken } });
    if (!user) return res.status(401).json({ error: 'Invalid refresh token' });

    const newToken = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_ACCESS_EXPIRATION });
    res.json({ token: newToken });
  } catch (error) {
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

// --------------------
// Basic routes
// --------------------
app.get('/', (_req, res) => res.send('Welcome to the User Management API!'));
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

// --------------------
// WebSocket
// --------------------
wss.on('connection', async (ws, req) => {
  const token = url.parse(req.url, true).query.token;
  if (!token) return ws.close(1008, 'Token missing');

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id.toString();
    if (!clients.has(userId)) clients.set(userId, new Set());
    clients.get(userId).add(ws);

    ws.on('close', () => {
      clients.get(userId)?.delete(ws);
      if (clients.get(userId)?.size === 0) clients.delete(userId);
    });

    ws.on('message', (message) => {
      const data = JSON.parse(message.toString());
      if (data.type === 'PING') ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
    });
  } catch {
    ws.close(1008, 'Invalid or expired token');
  }
});

app.locals.wsBroadcastToUser = (userId, data) => {
  const message = JSON.stringify(data);
  clients.get(userId)?.forEach(ws => ws.readyState === 1 && ws.send(message));
};

// --------------------
// Graceful shutdown
// --------------------
const gracefulShutdown = async () => {
  console.log('Shutting down...');
  httpServer.close(() => console.log('HTTP server closed.'));
  await sequelize.close();
  console.log('Database connections closed.');
  process.exit(0);
};
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// --------------------
// Server start
// --------------------
const isPortAvailable = (port) => new Promise(resolve => {
  const server = net.createServer().listen(port, () => server.close(() => resolve(true)));
  server.on('error', () => resolve(false));
});

const findAvailablePort = async (startPort) => {
  for (let port = startPort; port < startPort + 100; port++) {
    if (await isPortAvailable(port)) return port;
  }
  throw new Error('No available port found');
};

const startServer = async () => {
  let serverPort = PORT;
  if (!(await isPortAvailable(PORT))) {
    serverPort = await findAvailablePort(PORT + 1);
    console.log(`Port ${PORT} busy, using ${serverPort} instead`);
  }
  httpServer.listen(serverPort, () => {
    console.log(`Server running on http://localhost:${serverPort}`);
    console.log(`WebSocket at ws://localhost:${serverPort}/ws`);
  });
};

const initializeApp = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connected');
  } catch (error) {
    console.error('Database connection failed, starting server offline mode');
  }
  await startServer();
};

initializeApp();