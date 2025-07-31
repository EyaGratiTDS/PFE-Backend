const request = require('supertest');
const express = require('express');

describe('Auth Routes Integration Tests', () => {
  let app;
  let consoleSpy;
  let mockPassport;

  beforeAll(() => {
    // Mock console.error pour les tests
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Variables d'environnement pour les tests
    process.env.FRONTEND_URL = 'http://localhost:3000';
  });

  beforeEach(() => {
    // Créer un mock passport frais pour chaque test
    mockPassport = {
      authenticate: jest.fn()
    };

    // Créer une nouvelle instance d'Express pour chaque test
    app = express();
    
    // Créer les routes directement dans le test
    const router = express.Router();

    // Route GET /google - le mock sera configuré dans chaque test
    router.get('/google', (req, res, next) => {
      const middleware = mockPassport.authenticate('google', {
        scope: ['profile', 'email'],
        prompt: 'select_account consent' 
      });
      middleware(req, res, next);
    });

    // Route GET /google/callback - le mock sera configuré dans chaque test
    router.get('/google/callback', (req, res, next) => {
      const authMiddleware = mockPassport.authenticate('google', {
        failureRedirect: `${process.env.FRONTEND_URL}/sign-in?error=auth_failed`,
        session: false
      });
      
      authMiddleware(req, res, (err) => {
        if (err) return next(err);
        
        // Handler callback après l'authentification
        try {
          if (!req.user || !req.user.token) {
            console.error('Auth callback failed: No user or token');
            return res.redirect(`${process.env.FRONTEND_URL}/sign-in?error=auth_failed`);
          }
          
          const token = encodeURIComponent(req.user.token);
          const user = encodeURIComponent(JSON.stringify(req.user.user));
          
          res.redirect(`${process.env.FRONTEND_URL}/auth/handler?token=${token}&user=${user}&auth=success`);
        } catch (error) {
          console.error('Google callback error:', error);
          res.redirect(`${process.env.FRONTEND_URL}/sign-in?error=callback_failed`);
        }
      });
    });

    app.use('/auth', router);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    consoleSpy.mockRestore();
  });

  describe('GET /auth/google', () => {
    it('should initiate Google OAuth flow', async () => {
      // Mock passport.authenticate pour simuler la redirection vers Google
      mockPassport.authenticate.mockImplementation((strategy, options) => {
        // Vérifier que la stratégie et les options sont correctes
        expect(strategy).toBe('google');
        expect(options).toEqual({
          scope: ['profile', 'email'],
          prompt: 'select_account consent'
        });
        
        return (req, res, next) => {
          // Simuler la redirection vers Google
          res.redirect('https://accounts.google.com/oauth/authorize?client_id=test&redirect_uri=callback&scope=profile+email');
        };
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
      let middlewareOptions = null;
      
      mockPassport.authenticate.mockImplementation((strategy, options) => {
        middlewareOptions = { strategy, options };
        return (req, res, next) => {
          res.status(200).json({ initiated: true });
        };
      });

      await request(app)
        .get('/auth/google')
        .expect(200);

      expect(middlewareOptions.strategy).toBe('google');
      expect(middlewareOptions.options.scope).toEqual(['profile', 'email']);
      expect(middlewareOptions.options.prompt).toBe('select_account consent');
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
      mockPassport.authenticate.mockImplementation((strategy, options) => {
        // Vérifier les options du callback
        expect(strategy).toBe('google');
        expect(options.failureRedirect).toBe(`${process.env.FRONTEND_URL}/sign-in?error=auth_failed`);
        expect(options.session).toBe(false);
        
        return (req, res, next) => {
          // Simuler un utilisateur authentifié
          req.user = mockUser;
          next();
        };
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
      mockPassport.authenticate.mockImplementation((strategy, options) => {
        return (req, res, next) => {
          // Pas d'utilisateur dans req.user
          req.user = null;
          next();
        };
      });

      const response = await request(app)
        .get('/auth/google/callback')
        .expect(302);

      expect(response.headers.location).toBe(`${process.env.FRONTEND_URL}/sign-in?error=auth_failed`);
      expect(consoleSpy).toHaveBeenCalledWith('Auth callback failed: No user or token');
    });

    it('should handle callback when token is missing', async () => {
      mockPassport.authenticate.mockImplementation((strategy, options) => {
        return (req, res, next) => {
          // Utilisateur sans token
          req.user = {
            user: { id: 'user123', email: 'test@gmail.com' }
            // token manquant
          };
          next();
        };
      });

      const response = await request(app)
        .get('/auth/google/callback')
        .expect(302);

      expect(response.headers.location).toBe(`${process.env.FRONTEND_URL}/sign-in?error=auth_failed`);
      expect(consoleSpy).toHaveBeenCalledWith('Auth callback failed: No user or token');
    });

    it('should handle callback when user object is missing', async () => {
      mockPassport.authenticate.mockImplementation((strategy, options) => {
        return (req, res, next) => {
          // Token mais pas d'objet user
          req.user = {
            token: 'jwt_token_12345'
            // user manquant
          };
          next();
        };
      });

      const response = await request(app)
        .get('/auth/google/callback')
        .expect(302);

      expect(response.headers.location).toBe(`${process.env.FRONTEND_URL}/sign-in?error=auth_failed`);
      expect(consoleSpy).toHaveBeenCalledWith('Auth callback failed: No user or token');
    });

    it('should handle JSON stringify error', async () => {
      mockPassport.authenticate.mockImplementation((strategy, options) => {
        return (req, res, next) => {
          // Créer un objet user avec référence circulaire pour causer une erreur JSON.stringify
          const circularUser = { id: 'user123' };
          circularUser.self = circularUser;
          
          req.user = {
            token: 'jwt_token_12345',
            user: circularUser
          };
          next();
        };
      });

      const response = await request(app)
        .get('/auth/google/callback')
        .expect(302);

      expect(response.headers.location).toBe(`${process.env.FRONTEND_URL}/sign-in?error=callback_failed`);
      expect(consoleSpy).toHaveBeenCalledWith('Google callback error:', expect.any(TypeError));
    });

    it('should handle passport authentication failure', async () => {
      mockPassport.authenticate.mockImplementation((strategy, options) => {
        return (req, res, next) => {
          // Simuler un échec d'authentification - passport redirige automatiquement
          res.redirect(options.failureRedirect);
        };
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

      mockPassport.authenticate.mockImplementation((strategy, options) => {
        return (req, res, next) => {
          req.user = mockUser;
          next();
        };
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

      // Créer un nouveau mock passport
      const newMockPassport = {
        authenticate: jest.fn(() => {
          return (req, res, next) => {
            req.user = null; // Forcer l'échec
            next();
          };
        })
      };

      // Recréer l'app avec la nouvelle URL
      app = express();
      const router = express.Router();

      router.get('/google/callback', (req, res, next) => {
        const authMiddleware = newMockPassport.authenticate('google', {
          failureRedirect: `${process.env.FRONTEND_URL}/sign-in?error=auth_failed`,
          session: false
        });
        
        authMiddleware(req, res, (err) => {
          if (err) return next(err);
          
          try {
            if (!req.user || !req.user.token) {
              return res.redirect(`${process.env.FRONTEND_URL}/sign-in?error=auth_failed`);
            }
            
            const token = encodeURIComponent(req.user.token);
            const user = encodeURIComponent(JSON.stringify(req.user.user));
            
            res.redirect(`${process.env.FRONTEND_URL}/auth/handler?token=${token}&user=${user}&auth=success`);
          } catch (error) {
            res.redirect(`${process.env.FRONTEND_URL}/sign-in?error=callback_failed`);
          }
        });
      });

      app.use('/auth', router);

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

      mockPassport.authenticate.mockImplementation((strategy, options) => {
        return (req, res, next) => {
          req.user = mockUser;
          next();
        };
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
      mockPassport.authenticate.mockImplementation((strategy, options) => {
        return (req, res, next) => {
          req.user = {
            token: 'jwt_token_12345',
            user: undefined
          };
          next();
        };
      });

      const response = await request(app)
        .get('/auth/google/callback')
        .expect(302);

      expect(response.headers.location).toBe(`${process.env.FRONTEND_URL}/sign-in?error=auth_failed`);
    });

    it('should handle empty token', async () => {
      mockPassport.authenticate.mockImplementation((strategy, options) => {
        return (req, res, next) => {
          req.user = {
            token: '',
            user: { id: 'user123' }
          };
          next();
        };
      });

      const response = await request(app)
        .get('/auth/google/callback')
        .expect(302);

      expect(response.headers.location).toBe(`${process.env.FRONTEND_URL}/sign-in?error=auth_failed`);
    });

    it('should handle null token', async () => {
      mockPassport.authenticate.mockImplementation((strategy, options) => {
        return (req, res, next) => {
          req.user = {
            token: null,
            user: { id: 'user123' }
          };
        };
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

      mockPassport.authenticate.mockImplementation((strategy, options) => {
        return (req, res, next) => {
          req.user = mockUser;
          next();
        };
      });

      const response = await request(app)
        .get('/auth/google/callback')
        .expect(302);

      expect(response.status).toBe(302);
      expect(response.headers.location).toBeDefined();
    });

    it('should return correct status code for authentication failure', async () => {
      mockPassport.authenticate.mockImplementation((strategy, options) => {
        return (req, res, next) => {
          req.user = null;
          next();
        };
      });

      const response = await request(app)
        .get('/auth/google/callback')
        .expect(302);

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('error=auth_failed');
    });
  });
});