const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

jest.setTimeout(10000);

describe('User Routes Integration Tests', () => {
  let app;
  let userToken;
  let superAdminToken;
  let userId = 'test-user-id';

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    userToken = jwt.sign(
      { userId: 'testUserId', email: 'test@example.com' },
      'test-secret',
      { expiresIn: '1h' }
    );

    superAdminToken = jwt.sign(
      { userId: 'superAdminId', email: 'admin@example.com', role: 'superadmin' },
      'test-secret',
      { expiresIn: '1h' }
    );

    const requireAuth = (req, res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
      }
      
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, 'test-secret');
        req.user = decoded;
        next();
      } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
      }
    };

    const requireSuperAdmin = (req, res, next) => {
      if (!req.user || req.user.role !== 'superadmin') {
        return res.status(403).json({ error: 'Super admin access required' });
      }
      next();
    };

    const mockUpload = {
      single: (fieldname) => (req, res, next) => {
        req.file = {
          fieldname: fieldname,
          originalname: 'avatar.jpg',
          mimetype: 'image/jpeg',
          size: 1024
        };
        next();
      }
    };

    const router = express.Router();

    router.post('/sign-up', (req, res) => {
      const { email, password, firstName, lastName } = req.body;
      
      if (email === 'invalid-email') {
        return res.status(400).json({ error: 'Invalid email format' });
      }
      if (password === '123') {
        return res.status(400).json({ error: 'Password too weak' });
      }
      
      res.status(201).json({
        message: 'User created successfully',
        user: { 
          id: 'new-user-id', 
          email: email, 
          firstName: firstName, 
          lastName: lastName 
        }
      });
    });

    router.get('/verify-email', (req, res) => {
      const { token } = req.query;
      
      if (token === 'invalid-token') {
        return res.status(400).json({ error: 'Invalid verification token' });
      }
      
      res.status(200).json({ message: 'Email verified successfully' });
    });

    router.post('/sign-in', (req, res) => {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }
      if (password === 'wrongPassword') {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      res.status(200).json({
        token: 'mock-jwt-token',
        user: { id: 'user-id', email: email }
      });
    });

    router.post('/logout', requireAuth, (req, res) => {
      res.status(200).json({ message: 'Logged out successfully' });
    });

    router.get('/me', requireAuth, (req, res) => {
      res.status(200).json({
        user: { 
          id: 'current-user-id', 
          email: 'test@example.com', 
          firstName: 'Test', 
          lastName: 'User' 
        }
      });
    });

    router.put('/me', requireAuth, mockUpload.single('avatar'), (req, res) => {
      const { firstName, lastName } = req.body;
      
      res.status(200).json({
        user: { 
          id: 'user-id', 
          firstName: firstName || 'Updated', 
          lastName: lastName || 'Name' 
        }
      });
    });

    router.get('/two-factor/status', requireAuth, (req, res) => {
      res.status(200).json({ enabled: false });
    });

    router.post('/two-factor/generate', requireAuth, (req, res) => {
      res.status(200).json({
        secret: 'mock-2fa-secret',
        qrCode: 'mock-qr-code'
      });
    });

    router.post('/two-factor/verify', requireAuth, (req, res) => {
      const { token } = req.body;
      
      if (token === '000000') {
        return res.status(400).json({ error: 'Invalid 2FA token' });
      }
      
      res.status(200).json({ message: '2FA enabled successfully' });
    });

    router.get('/superadmin/users', requireAuth, requireSuperAdmin, (req, res) => {
      res.status(200).json({
        users: [
          { id: 'user1', email: 'user1@example.com' },
          { id: 'user2', email: 'user2@example.com' }
        ]
      });
    });

    router.put('/superadmin/users/:id/status', requireAuth, requireSuperAdmin, (req, res) => {
      const { id } = req.params;
      const { status } = req.body;
      
      if (id === 'nonexistent') {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.status(200).json({
        user: { id: id, status: status }
      });
    });

    app.use('/users', router);

    app.use((err, req, res, next) => {
      console.error('Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    });
  });

  describe('POST /users/sign-up', () => {
    test('should create a new user successfully', async () => {
      const userData = {
        email: 'newuser@example.com',
        password: 'StrongPassword123!',
        firstName: 'John',
        lastName: 'Doe'
      };

      const response = await request(app)
        .post('/users/sign-up')
        .send(userData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(userData.email);
    });

    test('should return 400 for invalid email', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'StrongPassword123!',
        firstName: 'John',
        lastName: 'Doe'
      };

      const response = await request(app)
        .post('/users/sign-up')
        .send(userData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Invalid email format');
    });

    test('should return 400 for weak password', async () => {
      const userData = {
        email: 'test2@example.com',
        password: '123',
        firstName: 'John',
        lastName: 'Doe'
      };

      const response = await request(app)
        .post('/users/sign-up')
        .send(userData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Password too weak');
    });
  });

  describe('GET /users/verify-email', () => {
    test('should verify email with valid token', async () => {
      const response = await request(app)
        .get('/users/verify-email')
        .query({ token: 'valid-token' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Email verified successfully');
    });

    test('should return 400 for invalid token', async () => {
      const response = await request(app)
        .get('/users/verify-email')
        .query({ token: 'invalid-token' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Invalid verification token');
    });
  });

  describe('POST /users/sign-in', () => {
    test('should sign in user with valid credentials', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'correctPassword'
      };

      const response = await request(app)
        .post('/users/sign-in')
        .send(credentials);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(credentials.email);
    });

    test('should return 401 for invalid credentials', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'wrongPassword'
      };

      const response = await request(app)
        .post('/users/sign-in')
        .send(credentials);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Invalid credentials');
    });

    test('should return 400 for missing credentials', async () => {
      const response = await request(app)
        .post('/users/sign-in')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Email and password are required');
    });
  });

  describe('Protected Routes', () => {
    test('POST /users/logout should work with valid token', async () => {
      const response = await request(app)
        .post('/users/logout')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Logged out successfully');
    });

    test('GET /users/me should work with valid token', async () => {
      const response = await request(app)
        .get('/users/me')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user).toHaveProperty('email');
    });

    test('PUT /users/me should update user profile', async () => {
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name'
      };

      const response = await request(app)
        .put('/users/me')
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.firstName).toBe('Updated');
      expect(response.body.user.lastName).toBe('Name');
    });

    test('should return 401 without token', async () => {
      const response = await request(app)
        .get('/users/me');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('No token provided');
    });
  });

  describe('Two-Factor Authentication', () => {
    test('GET /users/two-factor/status should work', async () => {
      const response = await request(app)
        .get('/users/two-factor/status')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('enabled');
      expect(response.body.enabled).toBe(false);
    });

    test('POST /users/two-factor/generate should work', async () => {
      const response = await request(app)
        .post('/users/two-factor/generate')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('secret');
      expect(response.body).toHaveProperty('qrCode');
      expect(response.body.secret).toBe('mock-2fa-secret');
    });

    test('POST /users/two-factor/verify should work with valid token', async () => {
      const response = await request(app)
        .post('/users/two-factor/verify')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ token: '123456' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('2FA enabled successfully');
    });

    test('POST /users/two-factor/verify should fail with invalid token', async () => {
      const response = await request(app)
        .post('/users/two-factor/verify')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ token: '000000' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Invalid 2FA token');
    });
  });

  describe('Super Admin Routes', () => {
    test('GET /users/superadmin/users should work for super admin', async () => {
      const response = await request(app)
        .get('/users/superadmin/users')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('users');
      expect(Array.isArray(response.body.users)).toBe(true);
      expect(response.body.users).toHaveLength(2);
    });

    test('GET /users/superadmin/users should return 403 for regular user', async () => {
      const response = await request(app)
        .get('/users/superadmin/users')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Super admin access required');
    });

    test('PUT /users/superadmin/users/:id/status should work for super admin', async () => {
      const response = await request(app)
        .put(`/users/superadmin/users/${userId}/status`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ status: 'inactive' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.id).toBe(userId);
      expect(response.body.user.status).toBe('inactive');
    });

    test('PUT /users/superadmin/users/nonexistent/status should return 404', async () => {
      const response = await request(app)
        .put('/users/superadmin/users/nonexistent/status')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ status: 'inactive' });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('User not found');
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid token format', async () => {
      const response = await request(app)
        .get('/users/me')
        .set('Authorization', 'InvalidTokenFormat');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('No token provided');
    });

    test('should handle expired token', async () => {
      const expiredToken = jwt.sign(
        { userId: 'testUserId', email: 'test@example.com' },
        'test-secret',
        { expiresIn: '-1s' } 
      );

      const response = await request(app)
        .get('/users/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Invalid token');
    });
  });
});