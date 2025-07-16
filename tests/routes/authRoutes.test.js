const request = require('supertest');
const express = require('express');
const passport = require('passport');
const authRoutes = require('../../routes/authRoutes');
const { createMockModels } = require('../utils/mockModels');
const { 
  createTestUser,
  expectSuccessResponse,
  expectErrorResponse 
} = require('../utils/testHelpers');

// Mock passport pour les tests
jest.mock('passport');

describe('AuthRoutes', () => {
  let app;
  let models;

  beforeAll(async () => {
    models = createMockModels();
    await models.sequelize.sync({ force: true });

    // Configuration de l'app Express pour les tests
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    
    // Mock du middleware de session
    app.use((req, res, next) => {
      req.session = {};
      next();
    });
    
    // Mock de passport
    app.use((req, res, next) => {
      req.logout = jest.fn((cb) => cb && cb());
      next();
    });
    
    // Routes de test
    app.use('/auth', authRoutes);
  });

  beforeEach(async () => {
    // Nettoyer la base de données avant chaque test
    await models.User.destroy({ where: {} });
    
    // Réinitialiser les mocks
    jest.clearAllMocks();
    
    // Configuration des mocks par défaut
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
      // Mock passport.authenticate pour Google
      passport.authenticate = jest.fn().mockImplementation((strategy, options) => {
        return (req, res, next) => {
          // Simuler une redirection vers Google
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

      // Mock passport.authenticate pour le callback
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
      // Mock passport.authenticate pour simuler un échec
      passport.authenticate = jest.fn().mockImplementation((strategy, options) => {
        return (req, res, next) => {
          // Simuler un échec d'authentification
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
          req.user = null; // Pas d'utilisateur
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
            // Pas de token
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
          // Simuler une erreur dans le callback
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
      
      // Vérifier que les données sont encodées
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

      // Mock du gestionnaire d'erreur global
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
          // Simuler une erreur réseau
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
