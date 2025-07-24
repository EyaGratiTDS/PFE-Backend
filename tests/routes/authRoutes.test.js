const request = require('supertest');
const express = require('express');
const passport = require('passport');
const authRoutes = require('../../routes/authRoutes');
const { createMockModels } = require('../utils/mockModels');

jest.mock('passport');

describe('AuthRoutes', () => {
  let app;
  let models;

  beforeAll(async () => {
    models = createMockModels();
    await models.sequelize.sync({ force: true });

    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    
    app.use((req, res, next) => {
      req.session = {};
      next();
    });
    
    app.use((req, res, next) => {
      req.logout = jest.fn((cb) => cb && cb());
      next();
    });
    
    app.use('/auth', authRoutes);
  });

  beforeEach(async () => {
    await models.User.destroy({ where: {} });
    
    jest.clearAllMocks();
    
    process.env.FRONTEND_URL = 'http://localhost:5173';
    process.env.GOOGLE_CLIENT_ID = 'test_google_client_id';
    process.env.GOOGLE_CLIENT_SECRET = 'test_google_client_secret';
    process.env.GOOGLE_CALLBACK_URL = 'http://localhost:3000/auth/google/callback';
  });

  afterAll(async () => {
    await models.sequelize.close();
  });

  describe('GET /auth/google', () => {
    test('should redirect to Google OAuth', async () => {
      passport.authenticate = jest.fn().mockImplementation((strategy, options) => {
        return (req, res, next) => {
          res.redirect('https://accounts.google.com/oauth/authorize?client_id=test');
        };
      });

      const response = await request(app).get('/auth/google');

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('accounts.google.com');
      expect(passport.authenticate).toHaveBeenCalledWith('google', {
        scope: ['profile', 'email'],
        prompt: 'select_account consent'
      });
    });
  });

  describe('GET /auth/google/callback', () => {
    test('should handle successful Google authentication', async () => {
      const mockUser = {
        token: 'test_jwt_token',
        user: {
          id: 1,
          email: 'test@example.com',
          role: 'admin',
          name: 'Test User'
        }
      };

      passport.authenticate = jest.fn().mockImplementation((strategy, options) => {
        return (req, res, next) => {
          req.user = mockUser;
          next();
        };
      });

      const response = await request(app).get('/auth/google/callback');

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('http://localhost:5173/dashboard');
      expect(response.headers.location).toContain('token=');
      expect(response.headers.location).toContain('user=');
      expect(response.headers.location).toContain('auth=success');
    });

    test('should redirect admin to dashboard', async () => {
      const mockUser = {
        token: 'test_jwt_token',
        user: {
          id: 1,
          email: 'admin@example.com',
          role: 'admin',
          name: 'Admin User'
        }
      };

      passport.authenticate = jest.fn().mockImplementation((strategy, options) => {
        return (req, res, next) => {
          req.user = mockUser;
          next();
        };
      });

      const response = await request(app).get('/auth/google/callback');

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('/dashboard');
    });

    test('should redirect user to user-dashboard', async () => {
      const mockUser = {
        token: 'test_jwt_token',
        user: {
          id: 2,
          email: 'user@example.com',
          role: 'user',
          name: 'Regular User'
        }
      };

      passport.authenticate = jest.fn().mockImplementation((strategy, options) => {
        return (req, res, next) => {
          req.user = mockUser;
          next();
        };
      });

      const response = await request(app).get('/auth/google/callback');

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('/user-dashboard');
    });

    test('should handle authentication failure', async () => {
      passport.authenticate = jest.fn().mockImplementation((strategy, options) => {
        return (req, res, next) => {
          res.redirect(`${process.env.FRONTEND_URL}/sign-in?error=auth_failed`);
        };
      });

      const response = await request(app).get('/auth/google/callback');

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('sign-in?error=auth_failed');
    });

    test('should handle missing user or token', async () => {
      passport.authenticate = jest.fn().mockImplementation((strategy, options) => {
        return (req, res, next) => {
          req.user = null; 
          next();
        };
      });

      const response = await request(app).get('/auth/google/callback');

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('sign-in?error=auth_failed');
    });

    test('should handle missing token in user object', async () => {
      passport.authenticate = jest.fn().mockImplementation((strategy, options) => {
        return (req, res, next) => {
          req.user = {
            user: {
              id: 1,
              email: 'test@example.com',
              role: 'admin'
            }
          };
          next();
        };
      });

      const response = await request(app).get('/auth/google/callback');

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('sign-in?error=auth_failed');
    });

    test('should handle callback errors gracefully', async () => {
      passport.authenticate = jest.fn().mockImplementation((strategy, options) => {
        return (req, res, next) => {
          throw new Error('Callback error');
        };
      });

      const response = await request(app).get('/auth/google/callback');

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('sign-in?error=callback_failed');
    });

    test('should properly encode token and user data in URL', async () => {
      const mockUser = {
        token: 'test.jwt.token-with-special+chars',
        user: {
          id: 1,
          email: 'test+user@example.com',
          role: 'admin',
          name: 'Test User with Spaces'
        }
      };

      passport.authenticate = jest.fn().mockImplementation((strategy, options) => {
        return (req, res, next) => {
          req.user = mockUser;
          next();
        };
      });

      const response = await request(app).get('/auth/google/callback');

      expect(response.status).toBe(302);
      
      const location = response.headers.location;
      expect(location).toContain('token=');
      expect(location).toContain('user=');
      
      expect(decodeURIComponent(location)).toContain('test+user@example.com');
      expect(decodeURIComponent(location)).toContain('Test User with Spaces');
    });

    test('should include auth=success parameter on successful authentication', async () => {
      const mockUser = {
        token: 'test_jwt_token',
        user: {
          id: 1,
          email: 'test@example.com',
          role: 'admin'
        }
      };

      passport.authenticate = jest.fn().mockImplementation((strategy, options) => {
        return (req, res, next) => {
          req.user = mockUser;
          next();
        };
      });

      const response = await request(app).get('/auth/google/callback');

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('auth=success');
    });
  });

  describe('Error handling', () => {
    test('should handle passport strategy errors', async () => {
      passport.authenticate = jest.fn().mockImplementation((strategy, options) => {
        return (req, res, next) => {
          const error = new Error('Strategy error');
          next(error);
        };
      });

      app.use((err, req, res, next) => {
        res.redirect(`${process.env.FRONTEND_URL}/sign-in?error=strategy_error`);
      });

      const response = await request(app).get('/auth/google/callback');

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('error=strategy_error');
    });

    test('should handle network errors gracefully', async () => {
      passport.authenticate = jest.fn().mockImplementation((strategy, options) => {
        return (req, res, next) => {
          const error = new Error('Network error');
          error.code = 'NETWORK_ERROR';
          throw error;
        };
      });

      const response = await request(app).get('/auth/google/callback');

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('sign-in?error=callback_failed');
    });
  });

  describe('Environment configuration', () => {
    test('should use correct redirect URLs from environment', async () => {
      process.env.FRONTEND_URL = 'https://custom-domain.com';
      
      const mockUser = {
        token: 'test_jwt_token',
        user: {
          id: 1,
          email: 'test@example.com',
          role: 'admin'
        }
      };

      passport.authenticate = jest.fn().mockImplementation((strategy, options) => {
        return (req, res, next) => {
          req.user = mockUser;
          next();
        };
      });

      const response = await request(app).get('/auth/google/callback');

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('https://custom-domain.com/dashboard');
    });
  });
});
