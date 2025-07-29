const jwt = require('jsonwebtoken');

const mockUser = {
  findByPk: jest.fn()
};

jest.mock('../../models/User', () => mockUser);

const { requireAuth, requireAuthSuperAdmin, requireSuperAdmin } = require('../../middleware/authMiddleware');

describe('AuthMiddleware', () => {
  let req, res, next;
  let originalEnv;

  beforeAll(() => {
    originalEnv = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'test-secret-key-for-testing-purposes';
  });

  afterAll(() => {
    if (originalEnv) {
      process.env.JWT_SECRET = originalEnv;
    } else {
      delete process.env.JWT_SECRET;
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
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
  });

  const createTestToken = (payload, options = {}) => {
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h', ...options });
  };

  const createTestUser = (overrides = {}) => {
    return {
      id: 1,
      email: 'test@example.com',
      role: 'user',
      isAdmin: false,
      ...overrides
    };
  };

  describe('requireAuth', () => {
    test('should authenticate with valid JWT token in headers', async () => {
      const userData = createTestUser();
      mockUser.findByPk.mockResolvedValue(userData);
      
      const token = createTestToken({ 
        id: userData.id, 
        email: userData.email, 
        role: userData.role 
      });
      req.headers.authorization = `Bearer ${token}`;

      await requireAuth(req, res, next);

      expect(mockUser.findByPk).toHaveBeenCalledWith(userData.id);
      expect(next).toHaveBeenCalledWith();
      expect(req.user).toBeDefined();
      expect(req.user.id).toBe(userData.id);
      expect(req.authInfo).toBeDefined();
      expect(req.authInfo.userId).toBe(userData.id);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    test('should authenticate with valid JWT token in cookies', async () => {
      const userData = createTestUser();
      mockUser.findByPk.mockResolvedValue(userData);
      
      const token = createTestToken({ 
        id: userData.id, 
        email: userData.email, 
        role: userData.role 
      });
      req.cookies.jwt = token;

      await requireAuth(req, res, next);

      expect(mockUser.findByPk).toHaveBeenCalledWith(userData.id);
      expect(next).toHaveBeenCalledWith();
      expect(req.user).toBeDefined();
      expect(req.user.id).toBe(userData.id);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    test('should reject request without token', async () => {
      await requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Authentification requise'
      });
      expect(next).not.toHaveBeenCalled();
      expect(mockUser.findByPk).not.toHaveBeenCalled();
    });

    test('should reject request with invalid token', async () => {
      req.headers.authorization = 'Bearer invalid-token';

      await requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Session invalide ou expirée'
      });
      expect(next).not.toHaveBeenCalled();
      expect(mockUser.findByPk).not.toHaveBeenCalled();
    });

    test('should reject request with expired token', async () => {
      const expiredToken = createTestToken(
        { id: 1, email: 'test@example.com', role: 'user' },
        { expiresIn: '-1h' }
      );
      req.headers.authorization = `Bearer ${expiredToken}`;

      await requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Session invalide ou expirée'
      });
      expect(next).not.toHaveBeenCalled();
      expect(mockUser.findByPk).not.toHaveBeenCalled();
    });

    test('should reject request when user not found', async () => {
      const token = createTestToken({ id: 999, email: 'nonexistent@example.com' });
      req.headers.authorization = `Bearer ${token}`;
      
      mockUser.findByPk.mockResolvedValue(null);

      await requireAuth(req, res, next);

      expect(mockUser.findByPk).toHaveBeenCalledWith(999);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Utilisateur non trouvé'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should include correct authInfo', async () => {
      const userData = createTestUser({ isAdmin: true });
      mockUser.findByPk.mockResolvedValue(userData);
      
      const token = createTestToken({ 
        id: userData.id, 
        email: userData.email, 
        role: userData.role 
      });
      req.headers.authorization = `Bearer ${token}`;
      req.headers['user-agent'] = 'Test User Agent';
      req.headers['x-forwarded-for'] = '192.168.1.1';

      await requireAuth(req, res, next);

      expect(req.authInfo).toEqual({
        userId: userData.id,
        isAdmin: userData.isAdmin,
        ipAddress: '192.168.1.1',
        userAgent: 'Test User Agent'
      });
      expect(next).toHaveBeenCalledWith();
    });

    test('should use connection.remoteAddress when x-forwarded-for is not present', async () => {
      const userData = createTestUser();
      mockUser.findByPk.mockResolvedValue(userData);
      
      const token = createTestToken({ 
        id: userData.id, 
        email: userData.email, 
        role: userData.role 
      });
      req.headers.authorization = `Bearer ${token}`;
      req.connection.remoteAddress = '192.168.1.100';

      await requireAuth(req, res, next);

      expect(req.authInfo.ipAddress).toBe('192.168.1.100');
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('requireAuthSuperAdmin', () => {
    test('should authenticate superAdmin user successfully', async () => {
      const userData = createTestUser({ 
        role: 'superAdmin', 
        isAdmin: true 
      });
      mockUser.findByPk.mockResolvedValue(userData);
      
      const token = createTestToken({ 
        id: userData.id, 
        email: userData.email, 
        role: 'superAdmin' 
      });
      req.headers.authorization = `Bearer ${token}`;

      await requireAuthSuperAdmin(req, res, next);

      expect(mockUser.findByPk).toHaveBeenCalledWith(userData.id);
      expect(next).toHaveBeenCalledWith();
      expect(req.user).toBeDefined();
      expect(req.user.role).toBe('superAdmin');
      expect(req.authInfo.role).toBe('superAdmin');
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    test('should reject non-superAdmin user', async () => {
      const userData = createTestUser({ 
        role: 'admin', 
        isAdmin: true 
      });
      mockUser.findByPk.mockResolvedValue(userData);
      
      const token = createTestToken({ 
        id: userData.id, 
        email: userData.email, 
        role: 'admin' 
      });
      req.headers.authorization = `Bearer ${token}`;

      await requireAuthSuperAdmin(req, res, next);

      expect(mockUser.findByPk).toHaveBeenCalledWith(userData.id);
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
      expect(mockUser.findByPk).not.toHaveBeenCalled();
    });

    test('should reject regular user', async () => {
      const userData = createTestUser({ 
        role: 'user', 
        isAdmin: false 
      });
      mockUser.findByPk.mockResolvedValue(userData);
      
      const token = createTestToken({ 
        id: userData.id, 
        email: userData.email, 
        role: 'user' 
      });
      req.headers.authorization = `Bearer ${token}`;

      await requireAuthSuperAdmin(req, res, next);

      expect(mockUser.findByPk).toHaveBeenCalledWith(userData.id);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Accès refusé. Privilèges Super-admin requis.'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should reject request when user not found', async () => {
      const token = createTestToken({ id: 999, email: 'nonexistent@example.com' });
      req.headers.authorization = `Bearer ${token}`;
      
      mockUser.findByPk.mockResolvedValue(null);

      await requireAuthSuperAdmin(req, res, next);

      expect(mockUser.findByPk).toHaveBeenCalledWith(999);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Utilisateur non trouvé'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should handle invalid token', async () => {
      req.headers.authorization = 'Bearer invalid-token';

      await requireAuthSuperAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Session invalide ou expirée'
      });
      expect(next).not.toHaveBeenCalled();
      expect(mockUser.findByPk).not.toHaveBeenCalled();
    });
  });

  describe('requireSuperAdmin', () => {
    test('should allow superAdmin user', () => {
      req.user = { role: 'superAdmin' };

      requireSuperAdmin(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
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

    test('should reject regular user', () => {
      req.user = { role: 'user' };

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

    test('should reject request with null user', () => {
      req.user = null;

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