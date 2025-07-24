const jwt = require('jsonwebtoken');
const { requireAuth, requireAuthSuperAdmin, requireSuperAdmin } = require('../../middleware/authMiddleware');
const { createMockModels } = require('../utils/mockModels');
const { createTestToken, createTestUser } = require('../utils/testHelpers');

describe('AuthMiddleware', () => {
  let models;
  let req, res, next;

  beforeAll(async () => {
    models = createMockModels();
    await models.sequelize.sync({ force: true });
  });

  beforeEach(async () => {
    req = {
      headers: {},
      cookies: {},
      connection: { remoteAddress: '127.0.0.1' }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    next = jest.fn();

    jest.clearAllMocks();
  });

  afterAll(async () => {
    await models.sequelize.close();
  });

  describe('requireAuth', () => {
    test('should authenticate with valid JWT token in headers', async () => {
      const userData = await createTestUser();
      const user = await models.User.create(userData);
      
      const token = createTestToken({ id: user.id, email: user.email, role: user.role });
      req.headers.authorization = `Bearer ${token}`;

      await requireAuth(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.user).toBeDefined();
      expect(req.user.id).toBe(user.id);
      expect(req.authInfo).toBeDefined();
      expect(req.authInfo.userId).toBe(user.id);
    });

    test('should authenticate with valid JWT token in cookies', async () => {
      const userData = await createTestUser();
      const user = await models.User.create(userData);
      
      const token = createTestToken({ id: user.id, email: user.email, role: user.role });
      req.cookies.jwt = token;

      await requireAuth(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.user).toBeDefined();
      expect(req.user.id).toBe(user.id);
    });

    test('should reject request without token', async () => {
      await requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Authentification requise'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should reject request with invalid token', async () => {
      req.headers.authorization = 'Bearer invalid-token';

      await requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Session invalide ou expirée'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should reject request with expired token', async () => {
      const expiredToken = jwt.sign(
        { id: 1, email: 'test@example.com', role: 'admin' },
        process.env.JWT_SECRET,
        { expiresIn: '-1h' }
      );
      req.headers.authorization = `Bearer ${expiredToken}`;

      await requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Session invalide ou expirée'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should reject request when user not found', async () => {
      const token = createTestToken({ id: 999, email: 'nonexistent@example.com' });
      req.headers.authorization = `Bearer ${token}`;

      await requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Utilisateur non trouvé'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should include correct authInfo', async () => {
      const userData = await createTestUser();
      const user = await models.User.create(userData);
      
      const token = createTestToken({ id: user.id, email: user.email, role: user.role });
      req.headers.authorization = `Bearer ${token}`;
      req.headers['user-agent'] = 'Test User Agent';
      req.headers['x-forwarded-for'] = '192.168.1.1';

      await requireAuth(req, res, next);

      expect(req.authInfo).toEqual({
        userId: user.id,
        isAdmin: user.isAdmin,
        ipAddress: '192.168.1.1',
        userAgent: 'Test User Agent'
      });
    });
  });

  describe('requireAuthSuperAdmin', () => {
    test('should authenticate superAdmin user successfully', async () => {
      const userData = await createTestUser({ role: 'superAdmin' });
      const user = await models.User.create(userData);
      
      const token = createTestToken({ id: user.id, email: user.email, role: 'superAdmin' });
      req.headers.authorization = `Bearer ${token}`;

      await requireAuthSuperAdmin(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.user).toBeDefined();
      expect(req.user.role).toBe('superAdmin');
      expect(req.authInfo.role).toBe('superAdmin');
    });

    test('should reject non-superAdmin user', async () => {
      const userData = await createTestUser({ role: 'admin' });
      const user = await models.User.create(userData);
      
      const token = createTestToken({ id: user.id, email: user.email, role: 'admin' });
      req.headers.authorization = `Bearer ${token}`;

      await requireAuthSuperAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Accès refusé. Privilèges Super-admin requis.'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should reject request without token', async () => {
      await requireAuthSuperAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Authentification requise'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should reject regular user', async () => {
      const userData = await createTestUser({ role: 'user' });
      const user = await models.User.create(userData);
      
      const token = createTestToken({ id: user.id, email: user.email, role: 'user' });
      req.headers.authorization = `Bearer ${token}`;

      await requireAuthSuperAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Accès refusé. Privilèges Super-admin requis.'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('requireSuperAdmin', () => {
    test('should allow superAdmin user', () => {
      req.user = { role: 'superAdmin' };

      requireSuperAdmin(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    test('should reject non-superAdmin user', () => {
      req.user = { role: 'admin' };

      requireSuperAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Super-admin privileges required'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should reject request without user', () => {
      requireSuperAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Super-admin privileges required'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });
});
