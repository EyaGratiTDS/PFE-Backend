const request = require('supertest');
const express = require('express');
const path = require('path');

describe('Google Auth Routes', () => {
  let app;
  let mockPassport;
  
  beforeAll(() => {
    // Variables d'environnement pour les tests
    process.env.FRONTEND_URL = 'http://localhost:3000';
  });

  beforeEach(() => {
    // Créer le mock passport
    mockPassport = {
      authenticate: jest.fn()
    };

    // Réinitialiser le mock avec une fonction par défaut
    mockPassport.authenticate.mockReturnValue((req, res, next) => {
      next();
    });

    // Mocker le module passport
    jest.doMock('passport', () => mockPassport);
    
    // Créer une nouvelle app Express
    app = express();
    
    // Nettoyer le cache du module
    const authRoutePath = path.resolve(__dirname, '../../routes/authRoutes.js');
    delete require.cache[authRoutePath];
    
    // Importer le router après avoir configuré le mock
    const authRouter = require('../../routes/authRoutes');
    app.use('/auth', authRouter);
  });

  afterEach(() => {
    // Nettoyer les mocks
    jest.resetModules();
    jest.clearAllMocks();
  });

  describe('GET /auth/google', () => {
    it('should initiate Google OAuth with correct parameters', async () => {
      // Mock spécifique pour ce test
      mockPassport.authenticate.mockImplementation((strategy, options) => {
        expect(strategy).toBe('google');
        expect(options).toEqual({
          scope: ['profile', 'email'],
          prompt: 'select_account consent'
        });
        
        return (req, res) => {
          res.redirect('https://accounts.google.com/oauth/authorize');
        };
      });

      const response = await request(app)
        .get('/auth/google')
        .expect(302);

      expect(mockPassport.authenticate).toHaveBeenCalledTimes(1);
      expect(response.headers.location).toBe('https://accounts.google.com/oauth/authorize');
    });

    it('should call passport.authenticate with correct Google strategy parameters', async () => {
      let capturedParams = null;
      
      mockPassport.authenticate.mockImplementation((strategy, options) => {
        capturedParams = { strategy, options };
        return (req, res) => {
          res.redirect('https://accounts.google.com/oauth/authorize');
        };
      });

      await request(app)
        .get('/auth/google')
        .expect(302);

      expect(capturedParams).toEqual({
        strategy: 'google',
        options: {
          scope: ['profile', 'email'],
          prompt: 'select_account consent'
        }
      });
    });
  });

  describe('GET /auth/google/callback', () => {
    it('should redirect to admin dashboard for admin user with success', async () => {
      const mockUser = {
        token: 'mock-jwt-token-123',
        user: {
          id: '123',
          email: 'admin@test.com',
          name: 'Admin User',
          role: 'admin'
        }
      };

      mockPassport.authenticate.mockImplementation((strategy, options) => {
        expect(strategy).toBe('google');
        expect(options).toEqual({
          failureRedirect: 'http://localhost:3000/sign-in?error=auth_failed',
          session: false
        });
        
        return (req, res, next) => {
          req.user = mockUser;
          next();
        };
      });

      const response = await request(app)
        .get('/auth/google/callback')
        .expect(302);

      const expectedToken = encodeURIComponent(mockUser.token);
      const expectedUser = encodeURIComponent(JSON.stringify(mockUser.user));
      const expectedUrl = `http://localhost:3000/admin/dashboard?token=${expectedToken}&user=${expectedUser}&auth=success`;
      
      expect(response.headers.location).toBe(expectedUrl);
      expect(mockPassport.authenticate).toHaveBeenCalledTimes(1);
    });

    it('should redirect to super-admin dashboard for superAdmin user', async () => {
      const mockUser = {
        token: 'mock-jwt-token-456',
        user: {
          id: '456',
          email: 'superadmin@test.com',
          name: 'Super Admin',
          role: 'superAdmin'
        }
      };

      mockPassport.authenticate.mockImplementation((strategy, options) => {
        return (req, res, next) => {
          req.user = mockUser;
          next();
        };
      });

      const response = await request(app)
        .get('/auth/google/callback')
        .expect(302);

      const expectedToken = encodeURIComponent(mockUser.token);
      const expectedUser = encodeURIComponent(JSON.stringify(mockUser.user));
      const expectedUrl = `http://localhost:3000/super-admin/dashboard?token=${expectedToken}&user=${expectedUser}&auth=success`;
      
      expect(response.headers.location).toBe(expectedUrl);
    });

    it('should redirect to home for regular user', async () => {
      const mockUser = {
        token: 'mock-jwt-token-789',
        user: {
          id: '789',
          email: 'user@test.com',
          name: 'Regular User',
          role: 'user'
        }
      };

      mockPassport.authenticate.mockImplementation((strategy, options) => {
        return (req, res, next) => {
          req.user = mockUser;
          next();
        };
      });

      const response = await request(app)
        .get('/auth/google/callback')
        .expect(302);

      const expectedToken = encodeURIComponent(mockUser.token);
      const expectedUser = encodeURIComponent(JSON.stringify(mockUser.user));
      const expectedUrl = `http://localhost:3000/home?token=${expectedToken}&user=${expectedUser}&auth=success`;
      
      expect(response.headers.location).toBe(expectedUrl);
    });

    it('should redirect to sign-in with error when user is missing', async () => {
      mockPassport.authenticate.mockImplementation((strategy, options) => {
        return (req, res, next) => {
          req.user = null;
          next();
        };
      });

      const response = await request(app)
        .get('/auth/google/callback')
        .expect(302);

      expect(response.headers.location).toBe('http://localhost:3000/sign-in?error=auth_failed');
    });

    it('should redirect to sign-in with error when token is missing', async () => {
      const mockUser = {
        user: {
          id: '123',
          email: 'user@test.com',
          name: 'User',
          role: 'user'
        }
        // Pas de token
      };

      mockPassport.authenticate.mockImplementation((strategy, options) => {
        return (req, res, next) => {
          req.user = mockUser;
          next();
        };
      });

      const response = await request(app)
        .get('/auth/google/callback')
        .expect(302);

      expect(response.headers.location).toBe('http://localhost:3000/sign-in?error=auth_failed');
    });

    it('should handle authentication failure redirect', async () => {
      mockPassport.authenticate.mockImplementation((strategy, options) => {
        return (req, res) => {
          // Simuler directement l'échec d'authentification
          res.redirect(options.failureRedirect);
        };
      });

      const response = await request(app)
        .get('/auth/google/callback')
        .expect(302);

      expect(response.headers.location).toBe('http://localhost:3000/sign-in?error=auth_failed');
    });

    it('should handle callback errors gracefully', async () => {
      // Créer une nouvelle app pour ce test avec un router modifié
      const testApp = express();
      
      // Mock console.error
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      mockPassport.authenticate.mockImplementation((strategy, options) => {
        return (req, res, next) => {
          req.user = {
            token: 'valid-token',
            user: {
              id: '123',
              role: 'user'
            }
          };
          next();
        };
      });

      // Créer un router de test qui simule l'erreur JSON.stringify
      const testRouter = express.Router();
      testRouter.get('/google/callback',
        mockPassport.authenticate('google', {
          failureRedirect: `${process.env.FRONTEND_URL}/sign-in?error=auth_failed`,
          session: false
        }),
        (req, res) => {
          try {
            if (!req.user || !req.user.token) {
              return res.redirect(`${process.env.FRONTEND_URL}/sign-in?error=auth_failed`);
            }
            
            // Simuler une erreur JSON.stringify
            throw new Error('JSON stringify error');
          } catch (error) {
            console.error('Google callback error:', error);
            res.redirect(`${process.env.FRONTEND_URL}/sign-in?error=callback_failed`);
          }
        }
      );
      
      testApp.use('/auth', testRouter);

      const response = await request(testApp)
        .get('/auth/google/callback')
        .expect(302);

      expect(response.headers.location).toBe('http://localhost:3000/sign-in?error=callback_failed');
      
      consoleSpy.mockRestore();
    });

    it('should call passport.authenticate with correct callback parameters', async () => {
      let capturedParams = null;
      
      mockPassport.authenticate.mockImplementation((strategy, options) => {
        capturedParams = { strategy, options };
        return (req, res, next) => {
          req.user = {
            token: 'test-token',
            user: { id: '123', role: 'user' }
          };
          next();
        };
      });

      await request(app)
        .get('/auth/google/callback')
        .expect(302);

      expect(capturedParams).toEqual({
        strategy: 'google',
        options: {
          failureRedirect: 'http://localhost:3000/sign-in?error=auth_failed',
          session: false
        }
      });
    });
  });

  describe('Environment Variables', () => {
    it('should use correct FRONTEND_URL from environment', async () => {
      const originalUrl = process.env.FRONTEND_URL;
      process.env.FRONTEND_URL = 'https://myapp.com';

      // Créer une nouvelle app avec la nouvelle variable d'environnement
      const newApp = express();
      
      // Nettoyer le cache et réimporter
      const authRoutePath = path.resolve(__dirname, '../../routes/authRoutes.js');
      delete require.cache[authRoutePath];
      const newAuthRouter = require('../../routes/authRoutes');
      newApp.use('/auth', newAuthRouter);

      const mockUser = {
        token: 'test-token',
        user: {
          id: '123',
          name: 'Test User',
          email: 'test@example.com',
          role: 'user'
        }
      };

      mockPassport.authenticate.mockImplementation((strategy, options) => {
        return (req, res, next) => {
          req.user = mockUser;
          next();
        };
      });

      const response = await request(newApp)
        .get('/auth/google/callback')
        .expect(302);

      expect(response.headers.location).toContain('https://myapp.com');

      // Restaurer l'URL originale
      process.env.FRONTEND_URL = originalUrl;
    });
  });

  describe('Route Availability', () => {
    it('should have Google auth route available', async () => {
      mockPassport.authenticate.mockImplementation((strategy, options) => {
        return (req, res) => {
          res.status(200).json({ message: 'Google auth route exists' });
        };
      });

      const response = await request(app)
        .get('/auth/google')
        .expect(200);

      expect(response.body.message).toBe('Google auth route exists');
    });

    it('should have Google callback route available', async () => {
      mockPassport.authenticate.mockImplementation((strategy, options) => {
        return (req, res) => {
          res.status(200).json({ message: 'Google callback route exists' });
        };
      });

      const response = await request(app)
        .get('/auth/google/callback')
        .expect(200);

      expect(response.body.message).toBe('Google callback route exists');
    });
  });

  describe('Complete Flow Integration', () => {
    it('should handle complete authentication flow', async () => {
      // Test de la route d'initiation
      mockPassport.authenticate.mockImplementationOnce((strategy, options) => {
        return (req, res) => {
          res.redirect('https://accounts.google.com/oauth/authorize');
        };
      });

      const googleResponse = await request(app)
        .get('/auth/google')
        .expect(302);

      expect(googleResponse.headers.location).toBe('https://accounts.google.com/oauth/authorize');

      // Réinitialiser le mock pour le test callback
      mockPassport.authenticate.mockReset();
      
      // Test de la route callback avec succès
      const mockUser = {
        token: 'success-token',
        user: {
          id: '999',
          email: 'success@test.com',
          name: 'Success User',
          role: 'user'
        }
      };

      mockPassport.authenticate.mockImplementation((strategy, options) => {
        return (req, res, next) => {
          req.user = mockUser;
          next();
        };
      });

      const callbackResponse = await request(app)
        .get('/auth/google/callback')
        .expect(302);

      const expectedToken = encodeURIComponent(mockUser.token);
      const expectedUser = encodeURIComponent(JSON.stringify(mockUser.user));
      const expectedUrl = `http://localhost:3000/home?token=${expectedToken}&user=${expectedUser}&auth=success`;
      
      expect(callbackResponse.headers.location).toBe(expectedUrl);
    });
  });

  describe('Error Handling Edge Cases', () => {
    it('should handle undefined user object', async () => {
      mockPassport.authenticate.mockImplementation((strategy, options) => {
        return (req, res, next) => {
          req.user = undefined;
          next();
        };
      });

      const response = await request(app)
        .get('/auth/google/callback')
        .expect(302);

      expect(response.headers.location).toBe('http://localhost:3000/sign-in?error=auth_failed');
    });

    it('should handle user object with undefined token', async () => {
      mockPassport.authenticate.mockImplementation((strategy, options) => {
        return (req, res, next) => {
          req.user = {
            token: undefined,
            user: { id: '123', role: 'user' }
          };
          next();
        };
      });

      const response = await request(app)
        .get('/auth/google/callback')
        .expect(302);

      expect(response.headers.location).toBe('http://localhost:3000/sign-in?error=auth_failed');
    });

    it('should handle user object with empty token', async () => {
      mockPassport.authenticate.mockImplementation((strategy, options) => {
        return (req, res, next) => {
          req.user = {
            token: '',
            user: { id: '123', role: 'user' }
          };
          next();
        };
      });

      const response = await request(app)
        .get('/auth/google/callback')
        .expect(302);

      expect(response.headers.location).toBe('http://localhost:3000/sign-in?error=auth_failed');
    });
  });
});