const request = require('supertest');
const express = require('express');
const path = require('path');

// Mock amélioré de Passport
jest.mock('passport', () => ({
  initialize: jest.fn(),
  session: jest.fn(),
  authenticate: jest.fn((strategy, options) => {
    return (req, res, next) => {
      // Simuler le comportement de Passport
      if (options.failureRedirect && req.query.failAuth) {
        return res.redirect(options.failureRedirect);
      }
      
      // Simuler l'utilisateur authentifié
      if (req.mockUser) {
        req.user = req.mockUser;
      }
      
      if (next) next();
    };
  })
}));

// Configuration initiale
process.env.FRONTEND_URL = 'http://localhost:3000';

describe('Google Authentication Routes', () => {
  let app;
  let router;
  
  beforeAll(() => {
    // Essayer différents chemins possibles pour trouver authRoutes
    const possiblePaths = [
      '../../../routes/authRoutes',
      '../../routes/authRoutes', 
      '../routes/authRoutes',
      './routes/authRoutes',
      path.resolve(__dirname, '../../../routes/authRoutes'),
      path.resolve(__dirname, '../../routes/authRoutes'),
      path.resolve(process.cwd(), 'routes/authRoutes')
    ];
    
    let routerLoaded = false;
    
    for (const routePath of possiblePaths) {
      try {
        router = require(routePath);
        routerLoaded = true;
        console.log(`Successfully loaded authRoutes from: ${routePath}`);
        break;
      } catch (error) {
        // Continue trying other paths
        continue;
      }
    }
    
    if (!routerLoaded) {
      throw new Error('Could not find authRoutes module. Please check the file path.');
    }
  });

  beforeEach(() => {
    app = express();
    app.use(express.urlencoded({ extended: false }));
    app.use(express.json());
    
    // Middleware pour parser les cookies mockés
    app.use((req, res, next) => {
      if (req.headers.cookie) {
        const cookies = req.headers.cookie.split('; ');
        const mockCookie = cookies.find(c => c.startsWith('mockUser='));
        
        if (mockCookie) {
          const userData = mockCookie.split('=')[1];
          try {
            req.mockUser = JSON.parse(decodeURIComponent(userData));
          } catch (e) {
            req.mockUser = null;
          }
        }
      }
      next();
    });
    
    app.use('/auth', router);
    jest.clearAllMocks();
  });

  describe('GET /auth/google', () => {
    it('should redirect to Google authentication', async () => {
      const passport = require('passport');
      
      // Mock spécifique pour cette route
      passport.authenticate.mockImplementationOnce((strategy, options) => {
        return (req, res, next) => {
          // Simuler la redirection vers Google
          const params = new URLSearchParams({
            scope: options.scope.join(' '),
            prompt: options.prompt
          });
          res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
        };
      });

      const res = await request(app).get('/auth/google');
      
      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toMatch(/accounts\.google\.com/);
      expect(res.headers.location).toContain('scope=profile%20email');
      expect(res.headers.location).toContain('prompt=select_account%20consent');
    });

    it('should handle authentication configuration error', async () => {
      const passport = require('passport');
      
      // Mock qui retourne undefined pour simuler une configuration manquante
      passport.authenticate.mockImplementationOnce(() => undefined);

      const res = await request(app).get('/auth/google');
      
      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({ error: 'Authentication not configured' });
    });
  });

  describe('GET /auth/google/callback', () => {
    beforeEach(() => {
      const passport = require('passport');
      
      // Mock par défaut pour les callbacks
      passport.authenticate.mockImplementation((strategy, options) => {
        return (req, res, next) => {
          if (options.failureRedirect && req.query.failAuth) {
            return res.redirect(options.failureRedirect);
          }
          
          if (req.mockUser) {
            req.user = req.mockUser;
          }
          
          if (next) next();
        };
      });
    });

    it('should redirect to sign-in on authentication failure', async () => {
      const res = await request(app)
        .get('/auth/google/callback?failAuth=true');

      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toBe(
        'http://localhost:3000/sign-in?error=auth_failed'
      );
    });

    it('should handle missing user token', async () => {
      const res = await request(app)
        .get('/auth/google/callback')
        .set('Cookie', ['mockUser=' + JSON.stringify({})]);

      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toContain('error=auth_failed');
    });

    it('should redirect to /home for user role', async () => {
      const mockUser = {
        token: 'user_token_123',
        user: { role: 'user', name: 'Test User', email: 'user@test.com' }
      };

      const res = await request(app)
        .get('/auth/google/callback')
        .set('Cookie', ['mockUser=' + JSON.stringify(mockUser)]);

      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toContain(
        'http://localhost:3000/home?token=user_token_123'
      );
      expect(res.headers.location).toContain('auth=success');
      expect(res.headers.location).toContain(
        encodeURIComponent(JSON.stringify(mockUser.user))
      );
    });

    it('should redirect to /dashboard for admin role', async () => {
      const mockUser = {
        token: 'admin_token_456',
        user: { role: 'admin', name: 'Admin User', email: 'admin@test.com' }
      };

      const res = await request(app)
        .get('/auth/google/callback')
        .set('Cookie', ['mockUser=' + JSON.stringify(mockUser)]);

      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toContain(
        'http://localhost:3000/dashboard?token=admin_token_456'
      );
      expect(res.headers.location).toContain('auth=success');
    });

    it('should handle unexpected errors', async () => {
      const originalConsoleError = console.error;
      console.error = jest.fn();
      
      const res = await request(app)
        .get('/auth/google/callback')
        .set('Cookie', ['mockUser=INVALID_JSON{']);

      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toContain(
        'http://localhost:3000/sign-in?error=callback_failed'
      );
      
      console.error = originalConsoleError;
    });

    it('should handle passport authenticate returning undefined', async () => {
      const passport = require('passport');
      
      // Mock qui ne retourne pas de fonction
      passport.authenticate.mockImplementationOnce(() => undefined);

      const mockUser = {
        token: 'test_token',
        user: { role: 'user', name: 'Test User', email: 'test@test.com' }
      };

      const res = await request(app)
        .get('/auth/google/callback')
        .set('Cookie', ['mockUser=' + JSON.stringify(mockUser)]);

      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toContain('http://localhost:3000/home');
    });
  });

  describe('Error handling', () => {
    it('should handle malformed cookie data gracefully', async () => {
      const res = await request(app)
        .get('/auth/google/callback')
        .set('Cookie', ['mockUser=not-valid-json']);

      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toContain('error=auth_failed');
    });

    it('should handle missing environment variables', async () => {
      const originalFrontendUrl = process.env.FRONTEND_URL;
      delete process.env.FRONTEND_URL;

      const res = await request(app)
        .get('/auth/google/callback')
        .set('Cookie', ['mockUser=' + JSON.stringify({})]);

      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toContain('undefined'); // Fallback behavior

      process.env.FRONTEND_URL = originalFrontendUrl;
    });
  });
});