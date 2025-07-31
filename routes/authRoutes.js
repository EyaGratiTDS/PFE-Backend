const request = require('supertest');
const express = require('express');

// Mock de Passport avant l'import
const mockPassport = {
  authenticate: jest.fn()
};

jest.mock('passport', () => mockPassport);

// Import des routes après le mock
const authRoutes = require('../routes/authRoutes'); // Ajustez le chemin selon votre structure

describe('Auth Routes Integration Tests', () => {
  let app;
  let consoleSpy;

  beforeAll(() => {
    // Mock console.error pour les tests
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Variables d'environnement pour les tests
    process.env.FRONTEND_URL = 'http://localhost:3000';
  });

  beforeEach(() => {
    // Créer une nouvelle instance d'Express pour chaque test
    app = express();
    app.use('/auth', authRoutes);

    // Réinitialiser tous les mocks
    jest.clearAllMocks();
    
    // Configuration par défaut du mock passport
    mockPassport.authenticate.mockReturnValue((req, res, next) => {
      next();
    });
  });

  afterAll(() => {
    consoleSpy.mockRestore();
  });

  describe('GET /auth/google', () => {
    it('should initiate Google OAuth flow', async () => {
      // Mock passport.authenticate pour simuler la redirection vers Google
      mockPassport.authenticate.mockReturnValue((req, res, next) => {
        // Simuler la redirection vers Google
        res.redirect('https://accounts.google.com/oauth/authorize?client_id=test&redirect_uri=callback&scope=profile+email');
      });

      const response = await request(app)
        .get('/auth/google')
        .expect(302);

      expect(response.headers.location).toContain('accounts.google.com');
      expect(mockPassport.authenticate).toHaveBeenCalledWith('google', {
        scope: ['profile', 'email'],
        prompt: 'select_account consent'
      });
    });

    it('should handle passport authentication middleware correctly', async () => {
      let middlewareCallCount = 0;
      
      mockPassport.authenticate.mockImplementation((strategy, options) => {
        middlewareCallCount++;
        expect(strategy).toBe('google');
        expect(options.scope).toEqual(['profile', 'email']);
        expect(options.prompt).toBe('select_account consent');
        
        return (req, res, next) => {
          res.status(200).json({ initiated: true });
        };
      });

      await request(app)
        .get('/auth/google')
        .expect(200);

      expect(middlewareCallCount).toBe(1);
    });
  });

  describe('GET /auth/google/callback', () => {
    it('should handle successful Google callback', async () => {
      const mockUser = {
        token: 'jwt_token_12345',
        user: {
          id: 'user123',
          email: 'test@gmail.com',
          name: 'Test User',
          picture: 'https://avatar.url'
        }
      };

      // Mock passport.authenticate pour le callback
      mockPassport.authenticate.mockReturnValue((req, res, next) => {
        // Simuler un utilisateur authentifié
        req.user = mockUser;
        next();
      });

      const response = await request(app)
        .get('/auth/google/callback')
        .expect(302);

      const expectedToken = encodeURIComponent(mockUser.token);
      const expectedUser = encodeURIComponent(JSON.stringify(mockUser.user));
      const expectedRedirect = `${process.env.FRONTEND_URL}/auth/handler?token=${expectedToken}&user=${expectedUser}&auth=success`;

      expect(response.headers.location).toBe(expectedRedirect);
      expect(mockPassport.authenticate).toHaveBeenCalledWith('google', {
        failureRedirect: `${process.env.FRONTEND_URL}/sign-in?error=auth_failed`,
        session: false
      });
    });

    it('should handle callback when user is missing', async () => {
      mockPassport.authenticate.mockReturnValue((req, res, next) => {
        // Pas d'utilisateur dans req.user
        req.user = null;
        next();
      });

      const response = await request(app)
        .get('/auth/google/callback')
        .expect(302);

      expect(response.headers.location).toBe(`${process.env.FRONTEND_URL}/sign-in?error=auth_failed`);
      expect(consoleSpy).toHaveBeenCalledWith('Auth callback failed: No user or token');
    });

    it('should handle callback when token is missing', async () => {
      mockPassport.authenticate.mockReturnValue((req, res, next) => {
        // Utilisateur sans token
        req.user = {
          user: { id: 'user123', email: 'test@gmail.com' }
          // token manquant
        };
        next();
      });

      const response = await request(app)
        .get('/auth/google/callback')
        .expect(302);

      expect(response.headers.location).toBe(`${process.env.FRONTEND_URL}/sign-in?error=auth_failed`);
      expect(consoleSpy).toHaveBeenCalledWith('Auth callback failed: No user or token');
    });

    it('should handle callback when user object is missing', async () => {
      mockPassport.authenticate.mockReturnValue((req, res, next) => {
        // Token mais pas d'objet user
        req.user = {
          token: 'jwt_token_12345'
          // user manquant
        };
        next();
      });

      const response = await request(app)
        .get('/auth/google/callback')
        .expect(302);

      expect(response.headers.location).toBe(`${process.env.FRONTEND_URL}/sign-in?error=auth_failed`);
      expect(consoleSpy).toHaveBeenCalledWith('Auth callback failed: No user or token');
    });

    it('should handle JSON stringify error', async () => {
      mockPassport.authenticate.mockReturnValue((req, res, next) => {
        // Créer un objet user avec référence circulaire pour causer une erreur JSON.stringify
        const circularUser = { id: 'user123' };
        circularUser.self = circularUser;
        
        req.user = {
          token: 'jwt_token_12345',
          user: circularUser
        };
        next();
      });

      const response = await request(app)
        .get('/auth/google/callback')
        .expect(302);

      expect(response.headers.location).toBe(`${process.env.FRONTEND_URL}/sign-in?error=callback_failed`);
      expect(consoleSpy).toHaveBeenCalledWith('Google callback error:', expect.any(TypeError));
    });

    it('should handle passport authentication failure', async () => {
      mockPassport.authenticate.mockReturnValue((req, res, next) => {
        // Simuler un échec d'authentification - passport redirige automatiquement
        res.redirect(`${process.env.FRONTEND_URL}/sign-in?error=auth_failed`);
      });

      const response = await request(app)
        .get('/auth/google/callback')
        .expect(302);

      expect(response.headers.location).toBe(`${process.env.FRONTEND_URL}/sign-in?error=auth_failed`);
    });

    it('should properly encode special characters in token and user data', async () => {
      const mockUser = {
        token: 'jwt+token/with=special&chars',
        user: {
          id: 'user123',
          email: 'test+user@gmail.com',
          name: 'Test & User',
          picture: 'https://avatar.url?param=value&other=test'
        }
      };

      mockPassport.authenticate.mockReturnValue((req, res, next) => {
        req.user = mockUser;
        next();
      });

      const response = await request(app)
        .get('/auth/google/callback')
        .expect(302);

      const location = response.headers.location;
      
      // Vérifier que les caractères spéciaux sont correctement encodés
      expect(location).toContain('token=jwt%2Btoken%2Fwith%3Dspecial%26chars');
      expect(location).toContain('auth=success');
      expect(location).toContain('user=');
      
      // Décoder et vérifier les données utilisateur
      const urlParams = new URLSearchParams(location.split('?')[1]);
      const decodedUser = JSON.parse(decodeURIComponent(urlParams.get('user')));
      
      expect(decodedUser.email).toBe('test+user@gmail.com');
      expect(decodedUser.name).toBe('Test & User');
    });
  });

  describe('Environment Variables', () => {
    it('should use correct FRONTEND_URL in redirects', async () => {
      const originalUrl = process.env.FRONTEND_URL;
      process.env.FRONTEND_URL = 'https://myapp.com';

      mockPassport.authenticate.mockReturnValue((req, res, next) => {
        req.user = null; // Forcer l'échec
        next();
      });

      const response = await request(app)
        .get('/auth/google/callback')
        .expect(302);

      expect(response.headers.location).toBe('https://myapp.com/sign-in?error=auth_failed');

      // Restaurer l'URL originale
      process.env.FRONTEND_URL = originalUrl;
    });
  });

  describe('Route Parameters and Query Strings', () => {
    it('should handle callback with query parameters', async () => {
      const mockUser = {
        token: 'jwt_token_12345',
        user: { id: 'user123', email: 'test@gmail.com' }
      };

      mockPassport.authenticate.mockReturnValue((req, res, next) => {
        req.user = mockUser;
        next();
      });

      const response = await request(app)
        .get('/auth/google/callback?code=auth_code&state=random_state')
        .expect(302);

      const expectedToken = encodeURIComponent(mockUser.token);
      const expectedUser = encodeURIComponent(JSON.stringify(mockUser.user));
      const expectedRedirect = `${process.env.FRONTEND_URL}/auth/handler?token=${expectedToken}&user=${expectedUser}&auth=success`;

      expect(response.headers.location).toBe(expectedRedirect);
    });
  });

  describe('Error Handling Edge Cases', () => {
    it('should handle undefined req.user.user', async () => {
      mockPassport.authenticate.mockReturnValue((req, res, next) => {
        req.user = {
          token: 'jwt_token_12345',
          user: undefined
        };
        next();
      });

      const response = await request(app)
        .get('/auth/google/callback')
        .expect(302);

      expect(response.headers.location).toBe(`${process.env.FRONTEND_URL}/sign-in?error=auth_failed`);
    });

    it('should handle empty token', async () => {
      mockPassport.authenticate.mockReturnValue((req, res, next) => {
        req.user = {
          token: '',
          user: { id: 'user123' }
        };
        next();
      });

      const response = await request(app)
        .get('/auth/google/callback')
        .expect(302);

      expect(response.headers.location).toBe(`${process.env.FRONTEND_URL}/sign-in?error=auth_failed`);
    });

    it('should handle null token', async () => {
      mockPassport.authenticate.mockReturnValue((req, res, next) => {
        req.user = {
          token: null,
          user: { id: 'user123' }
        };
        next();
      });

      const response = await request(app)
        .get('/auth/google/callback')
        .expect(302);

      expect(response.headers.location).toBe(`${process.env.FRONTEND_URL}/sign-in?error=auth_failed`);
    });
  });

  describe('Response Headers and Status Codes', () => {
    it('should return correct status code for successful authentication', async () => {
      const mockUser = {
        token: 'jwt_token_12345',
        user: { id: 'user123', email: 'test@gmail.com' }
      };

      mockPassport.authenticate.mockReturnValue((req, res, next) => {
        req.user = mockUser;
        next();
      });

      const response = await request(app)
        .get('/auth/google/callback')
        .expect(302);

      expect(response.status).toBe(302);
      expect(response.headers.location).toBeDefined();
    });

    it('should return correct status code for authentication failure', async () => {
      mockPassport.authenticate.mockReturnValue((req, res, next) => {
        req.user = null;
        next();
      });

      const response = await request(app)
        .get('/auth/google/callback')
        .expect(302);

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('error=auth_failed');
    });
  });
});