const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { expect } = require('chai');

const mockUserController = {
  signUp: jest.fn(),
  verifyEmail: jest.fn(),
  signIn: jest.fn(),
  logout: jest.fn(),
  createUser: jest.fn(),
  getCurrentUser: jest.fn(),
  updateUser: jest.fn(),
  changePassword: jest.fn(),
  getTwoFactorStatus: jest.fn(),
  generateTwoFactorSecret: jest.fn(),
  verifyAndEnableTwoFactor: jest.fn(),
  disableTwoFactor: jest.fn(),
  verifyTwoFactorLogin: jest.fn(),
  deleteAccount: jest.fn(),
  getAllUsers: jest.fn(),
  toggleUserStatus: jest.fn(),
  upload: {
    single: jest.fn(() => (req, res, next) => next())
  }
};

const mockAuthMiddleware = {
  requireAuth: jest.fn((req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'Token manquant' });
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-secret');
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(401).json({ message: 'Token invalide' });
    }
  }),
  requireAuthSuperAdmin: jest.fn((req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'Token manquant' });
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-secret');
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(401).json({ message: 'Token invalide' });
    }
  }),
  requireSuperAdmin: jest.fn((req, res, next) => {
    if (req.user && req.user.role === 'superadmin') {
      next();
    } else {
      return res.status(403).json({ message: 'Accès refusé - Super Admin requis' });
    }
  })
};

// Mock des modules
jest.mock('../../controllers/userController', () => mockUserController);
jest.mock('../../middleware/authMiddleware', () => mockAuthMiddleware);

describe('Routes utilisateur - Tests d\'intégration', () => {
  let app;
  let userToken;
  let superAdminToken;

  beforeAll(() => {
    // Configuration de l'application Express pour les tests
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    
    // Import des routes après la configuration des mocks
    const userRoutes = require('../../routes/userRoutes');
    app.use('/users', userRoutes);

    // Génération des tokens de test
    userToken = jwt.sign(
      { id: 1, email: 'user@test.com', role: 'user' },
      process.env.JWT_SECRET || 'test-secret'
    );
    
    superAdminToken = jwt.sign(
      { id: 2, email: 'admin@test.com', role: 'superadmin' },
      process.env.JWT_SECRET || 'test-secret'
    );
  });

  beforeEach(() => {
    // Reset des mocks avant chaque test
    jest.clearAllMocks();
  });

  describe('POST /users/sign-up', () => {
    it('devrait créer un nouvel utilisateur avec succès', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe'
      };

      mockUserController.signUp.mockImplementation((req, res) => {
        res.status(201).json({
          message: 'Utilisateur créé avec succès',
          user: { id: 1, email: userData.email }
        });
      });

      const response = await request(app)
        .post('/users/sign-up')
        .send(userData);

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Utilisateur créé avec succès');
      expect(mockUserController.signUp).toHaveBeenCalledTimes(1);
    });

    it('devrait retourner une erreur si les données sont invalides', async () => {
      mockUserController.signUp.mockImplementation((req, res) => {
        res.status(400).json({ message: 'Données invalides' });
      });

      const response = await request(app)
        .post('/users/sign-up')
        .send({ email: 'invalid-email' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Données invalides');
    });
  });

  describe('GET /users/verify-email', () => {
    it('devrait vérifier l\'email avec un token valide', async () => {
      mockUserController.verifyEmail.mockImplementation((req, res) => {
        res.status(200).json({ message: 'Email vérifié avec succès' });
      });

      const response = await request(app)
        .get('/users/verify-email')
        .query({ token: 'valid-token' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Email vérifié avec succès');
    });

    it('devrait retourner une erreur avec un token invalide', async () => {
      mockUserController.verifyEmail.mockImplementation((req, res) => {
        res.status(400).json({ message: 'Token de vérification invalide' });
      });

      const response = await request(app)
        .get('/users/verify-email')
        .query({ token: 'invalid-token' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Token de vérification invalide');
    });
  });

  describe('POST /users/sign-in', () => {
    it('devrait connecter un utilisateur avec des identifiants valides', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'password123'
      };

      mockUserController.signIn.mockImplementation((req, res) => {
        res.status(200).json({
          message: 'Connexion réussie',
          token: userToken,
          user: { id: 1, email: credentials.email }
        });
      });

      const response = await request(app)
        .post('/users/sign-in')
        .send(credentials);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Connexion réussie');
      expect(response.body.token).toBeDefined();
    });

    it('devrait retourner une erreur avec des identifiants invalides', async () => {
      mockUserController.signIn.mockImplementation((req, res) => {
        res.status(401).json({ message: 'Identifiants invalides' });
      });

      const response = await request(app)
        .post('/users/sign-in')
        .send({ email: 'test@example.com', password: 'wrongpassword' });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Identifiants invalides');
    });
  });

  describe('POST /users/logout', () => {
    it('devrait déconnecter un utilisateur authentifié', async () => {
      mockUserController.logout.mockImplementation((req, res) => {
        res.status(200).json({ message: 'Déconnexion réussie' });
      });

      const response = await request(app)
        .post('/users/logout')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Déconnexion réussie');
    });

    it('devrait retourner une erreur sans token d\'authentification', async () => {
      const response = await request(app)
        .post('/users/logout');

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Token manquant');
    });
  });

  describe('POST /users/add-user', () => {
    it('devrait créer un utilisateur', async () => {
      const userData = {
        email: 'newuser@example.com',
        password: 'password123',
        role: 'user'
      };

      mockUserController.createUser.mockImplementation((req, res) => {
        res.status(201).json({
          message: 'Utilisateur ajouté avec succès',
          user: { id: 2, email: userData.email }
        });
      });

      const response = await request(app)
        .post('/users/add-user')
        .send(userData);

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Utilisateur ajouté avec succès');
    });
  });

  describe('GET /users/me', () => {
    it('devrait retourner les informations de l\'utilisateur connecté', async () => {
      mockUserController.getCurrentUser.mockImplementation((req, res) => {
        res.status(200).json({
          user: { id: 1, email: 'test@example.com', firstName: 'John' }
        });
      });

      const response = await request(app)
        .get('/users/me')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe('test@example.com');
    });

    it('devrait retourner une erreur sans authentification', async () => {
      const response = await request(app)
        .get('/users/me');

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Token manquant');
    });
  });

  describe('PUT /users/me', () => {
    it('devrait mettre à jour le profil utilisateur', async () => {
      const updateData = {
        firstName: 'Jane',
        lastName: 'Smith'
      };

      mockUserController.updateUser.mockImplementation((req, res) => {
        res.status(200).json({
          message: 'Profil mis à jour avec succès',
          user: { id: 1, ...updateData }
        });
      });

      const response = await request(app)
        .put('/users/me')
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Profil mis à jour avec succès');
    });

    it('devrait supporter l\'upload d\'avatar', async () => {
      mockUserController.updateUser.mockImplementation((req, res) => {
        res.status(200).json({
          message: 'Avatar mis à jour',
          user: { id: 1, avatar: 'new-avatar.jpg' }
        });
      });

      const response = await request(app)
        .put('/users/me')
        .set('Authorization', `Bearer ${userToken}`)
        .attach('avatar', Buffer.from('fake-image-data'), 'avatar.jpg');

      expect(response.status).toBe(200);
      expect(mockUserController.upload.single).toHaveBeenCalledWith('avatar');
    });
  });

  describe('POST /users/change-password', () => {
    it('devrait changer le mot de passe avec succès', async () => {
      const passwordData = {
        currentPassword: 'oldpassword',
        newPassword: 'newpassword123'
      };

      mockUserController.changePassword.mockImplementation((req, res) => {
        res.status(200).json({ message: 'Mot de passe changé avec succès' });
      });

      const response = await request(app)
        .post('/users/change-password')
        .set('Authorization', `Bearer ${userToken}`)
        .send(passwordData);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Mot de passe changé avec succès');
    });
  });

  describe('Routes 2FA', () => {
    describe('GET /users/two-factor/status', () => {
      it('devrait retourner le statut 2FA', async () => {
        mockUserController.getTwoFactorStatus.mockImplementation((req, res) => {
          res.status(200).json({ enabled: false });
        });

        const response = await request(app)
          .get('/users/two-factor/status')
          .set('Authorization', `Bearer ${userToken}`);

        expect(response.status).toBe(200);
        expect(response.body.enabled).toBe(false);
      });
    });

    describe('POST /users/two-factor/generate', () => {
      it('devrait générer un secret 2FA', async () => {
        mockUserController.generateTwoFactorSecret.mockImplementation((req, res) => {
          res.status(200).json({
            secret: 'JBSWY3DPEHPK3PXP',
            qrCode: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...'
          });
        });

        const response = await request(app)
          .post('/users/two-factor/generate')
          .set('Authorization', `Bearer ${userToken}`);

        expect(response.status).toBe(200);
        expect(response.body.secret).toBeDefined();
        expect(response.body.qrCode).toBeDefined();
      });
    });

    describe('POST /users/two-factor/verify', () => {
      it('devrait vérifier et activer 2FA', async () => {
        mockUserController.verifyAndEnableTwoFactor.mockImplementation((req, res) => {
          res.status(200).json({ message: '2FA activé avec succès' });
        });

        const response = await request(app)
          .post('/users/two-factor/verify')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ token: '123456' });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('2FA activé avec succès');
      });
    });

    describe('POST /users/two-factor/disable', () => {
      it('devrait désactiver 2FA', async () => {
        mockUserController.disableTwoFactor.mockImplementation((req, res) => {
          res.status(200).json({ message: '2FA désactivé avec succès' });
        });

        const response = await request(app)
          .post('/users/two-factor/disable')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ password: 'currentpassword' });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('2FA désactivé avec succès');
      });
    });

    describe('POST /users/two-factor/login', () => {
      it('devrait vérifier le token 2FA lors de la connexion', async () => {
        mockUserController.verifyTwoFactorLogin.mockImplementation((req, res) => {
          res.status(200).json({
            message: 'Connexion 2FA réussie',
            token: userToken
          });
        });

        const response = await request(app)
          .post('/users/two-factor/login')
          .send({
            email: 'test@example.com',
            token: '123456'
          });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Connexion 2FA réussie');
        expect(response.body.token).toBeDefined();
      });
    });
  });

  describe('DELETE /users/me', () => {
    it('devrait supprimer le compte utilisateur', async () => {
      mockUserController.deleteAccount.mockImplementation((req, res) => {
        res.status(200).json({ message: 'Compte supprimé avec succès' });
      });

      const response = await request(app)
        .delete('/users/me')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ password: 'confirmpassword' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Compte supprimé avec succès');
    });
  });

  describe('Routes Super Admin', () => {
    describe('GET /users/superadmin/users', () => {
      it('devrait retourner tous les utilisateurs pour un super admin', async () => {
        mockUserController.getAllUsers.mockImplementation((req, res) => {
          res.status(200).json({
            users: [
              { id: 1, email: 'user1@test.com', status: 'active' },
              { id: 2, email: 'user2@test.com', status: 'inactive' }
            ]
          });
        });

        const response = await request(app)
          .get('/users/superadmin/users')
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(response.status).toBe(200);
        expect(response.body.users).toHaveLength(2);
      });

      it('devrait retourner une erreur pour un utilisateur normal', async () => {
        const response = await request(app)
          .get('/users/superadmin/users')
          .set('Authorization', `Bearer ${userToken}`);

        expect(response.status).toBe(403);
        expect(response.body.message).toBe('Accès refusé - Super Admin requis');
      });

      it('devrait retourner une erreur sans authentification', async () => {
        const response = await request(app)
          .get('/users/superadmin/users');

        expect(response.status).toBe(401);
        expect(response.body.message).toBe('Token manquant');
      });
    });

    describe('PUT /users/superadmin/users/:id/status', () => {
      it('devrait changer le statut d\'un utilisateur pour un super admin', async () => {
        mockUserController.toggleUserStatus.mockImplementation((req, res) => {
          res.status(200).json({
            message: 'Statut utilisateur mis à jour',
            user: { id: 1, status: 'inactive' }
          });
        });

        const response = await request(app)
          .put('/users/superadmin/users/1/status')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({ status: 'inactive' });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Statut utilisateur mis à jour');
      });

      it('devrait retourner une erreur pour un utilisateur normal', async () => {
        const response = await request(app)
          .put('/users/superadmin/users/1/status')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ status: 'inactive' });

        expect(response.status).toBe(403);
        expect(response.body.message).toBe('Accès refusé - Super Admin requis');
      });
    });
  });

  describe('Tests de sécurité', () => {
    it('devrait rejeter les requêtes avec un token malformé', async () => {
      const response = await request(app)
        .get('/users/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Token invalide');
    });

    it('devrait rejeter les requêtes sans header Authorization', async () => {
      const response = await request(app)
        .get('/users/me');

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Token manquant');
    });

    it('devrait rejeter les requêtes avec un token expiré', async () => {
      const expiredToken = jwt.sign(
        { id: 1, email: 'test@example.com' },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '-1h' }
      );

      const response = await request(app)
        .get('/users/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Token invalide');
    });
  });

  describe('Tests d\'erreur', () => {
    it('devrait gérer les erreurs de serveur', async () => {
      mockUserController.getCurrentUser.mockImplementation((req, res) => {
        res.status(500).json({ message: 'Erreur interne du serveur' });
      });

      const response = await request(app)
        .get('/users/me')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Erreur interne du serveur');
    });

    it('devrait gérer les routes non existantes', async () => {
      const response = await request(app)
        .get('/users/nonexistent-route');

      expect(response.status).toBe(404);
    });
  });
});