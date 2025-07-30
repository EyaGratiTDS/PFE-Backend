const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

// Configuration de l'environnement de test
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';

// Mock du contrôleur utilisateur
jest.mock('../../controllers/userController', () => ({
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
    single: jest.fn(() => (req, res, next) => {
      if (req.body.hasFile) {
        req.file = {
          filename: 'test-avatar.jpg',
          originalname: 'avatar.jpg',
          mimetype: 'image/jpeg',
          size: 1024
        };
      }
      next();
    })
  }
}));

// Mock des modèles
jest.mock('../../models', () => ({
  User: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn()
  },
  Project: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn()
  }
}));

// Mock du middleware d'authentification
jest.mock('../../middleware/authMiddleware', () => ({
  requireAuth: (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'Token manquant' });
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(401).json({ message: 'Token invalide' });
    }
  },
  requireAuthSuperAdmin: (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'Token manquant' });
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(401).json({ message: 'Token invalide' });
    }
  },
  requireSuperAdmin: (req, res, next) => {
    if (req.user && req.user.role === 'superadmin') {
      next();
    } else {
      return res.status(403).json({ message: 'Accès refusé - Super Admin requis' });
    }
  }
}));

// Fonctions utilitaires
const createTestToken = (payload = { id: 1, email: 'test@example.com' }) => {
  const secret = process.env.JWT_SECRET || 'test-secret-key';
  return jwt.sign(payload, secret, { expiresIn: '24h' });
};

const createTestUser = (overrides = {}) => {
  return {
    id: 1,
    firstName: 'Test',
    lastName: 'User',
    email: 'test@example.com',
    password: 'hashed-password',
    role: 'user',
    isVerified: true,
    twoFactorEnabled: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
};

// Import des routes après les mocks
const userRoutes = require('../../routes/userRoutes');

// Configuration de l'application Express
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/users', userRoutes);

describe('User Routes - Tests d\'intégration', () => {
  let userToken;
  let superAdminToken;
  let testUser;
  let userController;

  beforeEach(() => {
    testUser = createTestUser();
    userToken = createTestToken({ id: 1, email: testUser.email, role: 'user' });
    superAdminToken = createTestToken({ id: 2, email: 'admin@test.com', role: 'superadmin' });
    userController = require('../../controllers/userController');
    jest.clearAllMocks();
  });

  describe('POST /users/sign-up', () => {
    test('should create new user successfully', async () => {
      const userData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'password123'
      };

      const createdUser = {
        id: 1,
        ...userData,
        isVerified: false,
        role: 'user'
      };

      userController.signUp.mockImplementation((req, res) => {
        res.status(201).json({
          message: 'Utilisateur créé avec succès',
          user: createdUser
        });
      });

      const response = await request(app)
        .post('/users/sign-up')
        .send(userData);

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Utilisateur créé avec succès');
      expect(response.body.user.email).toBe(userData.email);
      expect(userController.signUp).toHaveBeenCalledTimes(1);
    });

    test('should return validation error for invalid data', async () => {
      userController.signUp.mockImplementation((req, res) => {
        res.status(400).json({ message: 'Email déjà utilisé' });
      });

      const response = await request(app)
        .post('/users/sign-up')
        .send({ email: 'existing@example.com', password: '123' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Email déjà utilisé');
    });

    test('should handle server errors', async () => {
      userController.signUp.mockImplementation((req, res) => {
        res.status(500).json({ message: 'Erreur interne du serveur' });
      });

      const response = await request(app)
        .post('/users/sign-up')
        .send({
          firstName: 'John',
          lastName: 'Doe',
          email: 'test@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Erreur interne du serveur');
    });
  });

  describe('GET /users/verify-email', () => {
    test('should verify email with valid token', async () => {
      userController.verifyEmail.mockImplementation((req, res) => {
        res.status(200).json({ message: 'Email vérifié avec succès' });
      });

      const response = await request(app)
        .get('/users/verify-email')
        .query({ token: 'valid-verification-token' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Email vérifié avec succès');
      expect(userController.verifyEmail).toHaveBeenCalledTimes(1);
    });

    test('should return error with invalid token', async () => {
      userController.verifyEmail.mockImplementation((req, res) => {
        res.status(400).json({ message: 'Token de vérification invalide ou expiré' });
      });

      const response = await request(app)
        .get('/users/verify-email')
        .query({ token: 'invalid-token' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Token de vérification invalide ou expiré');
    });

    test('should return error without token', async () => {
      userController.verifyEmail.mockImplementation((req, res) => {
        res.status(400).json({ message: 'Token de vérification requis' });
      });

      const response = await request(app)
        .get('/users/verify-email');

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Token de vérification requis');
    });
  });

  describe('POST /users/sign-in', () => {
    test('should sign in user with valid credentials', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'password123'
      };

      userController.signIn.mockImplementation((req, res) => {
        res.status(200).json({
          message: 'Connexion réussie',
          token: userToken,
          user: { id: 1, email: credentials.email, role: 'user' }
        });
      });

      const response = await request(app)
        .post('/users/sign-in')
        .send(credentials);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Connexion réussie');
      expect(response.body.token).toBeDefined();
      expect(response.body.user.email).toBe(credentials.email);
      expect(userController.signIn).toHaveBeenCalledTimes(1);
    });

    test('should return error with invalid credentials', async () => {
      userController.signIn.mockImplementation((req, res) => {
        res.status(401).json({ message: 'Email ou mot de passe incorrect' });
      });

      const response = await request(app)
        .post('/users/sign-in')
        .send({ email: 'test@example.com', password: 'wrongpassword' });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Email ou mot de passe incorrect');
    });

    test('should return error for unverified user', async () => {
      userController.signIn.mockImplementation((req, res) => {
        res.status(403).json({ message: 'Veuillez vérifier votre email avant de vous connecter' });
      });

      const response = await request(app)
        .post('/users/sign-in')
        .send({ email: 'unverified@example.com', password: 'password123' });

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Veuillez vérifier votre email avant de vous connecter');
    });
  });

  describe('POST /users/logout', () => {
    test('should logout user successfully', async () => {
      userController.logout.mockImplementation((req, res) => {
        res.status(200).json({ message: 'Déconnexion réussie' });
      });

      const response = await request(app)
        .post('/users/logout')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Déconnexion réussie');
      expect(userController.logout).toHaveBeenCalledTimes(1);
    });

    test('should return error without authentication', async () => {
      const response = await request(app)
        .post('/users/logout');

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Token manquant');
    });

    test('should return error with invalid token', async () => {
      const response = await request(app)
        .post('/users/logout')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Token invalide');
    });
  });

  describe('POST /users/add-user', () => {
    test('should add new user successfully', async () => {
      const userData = {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        password: 'password123',
        role: 'user'
      };

      const createdUser = {
        id: 2,
        ...userData,
        isVerified: true
      };

      userController.createUser.mockImplementation((req, res) => {
        res.status(201).json({
          message: 'Utilisateur ajouté avec succès',
          user: createdUser
        });
      });

      const response = await request(app)
        .post('/users/add-user')
        .send(userData);

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Utilisateur ajouté avec succès');
      expect(response.body.user.email).toBe(userData.email);
    });

    test('should validate required fields', async () => {
      userController.createUser.mockImplementation((req, res) => {
        res.status(400).json({ message: 'Tous les champs requis doivent être fournis' });
      });

      const response = await request(app)
        .post('/users/add-user')
        .send({ email: 'incomplete@example.com' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Tous les champs requis doivent être fournis');
    });
  });

  describe('GET /users/me', () => {
    test('should get current user profile', async () => {
      const userProfile = {
        id: 1,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        role: 'user',
        isVerified: true
      };

      userController.getCurrentUser.mockImplementation((req, res) => {
        res.status(200).json({ user: userProfile });
      });

      const response = await request(app)
        .get('/users/me')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.user.email).toBe('john@example.com');
      expect(response.body.user.id).toBe(1);
      expect(userController.getCurrentUser).toHaveBeenCalledTimes(1);
    });

    test('should return error without authentication', async () => {
      const response = await request(app)
        .get('/users/me');

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Token manquant');
    });
  });

  describe('PUT /users/me', () => {
    test('should update user profile successfully', async () => {
      const updateData = {
        firstName: 'John Updated',
        lastName: 'Doe Updated'
      };

      const updatedUser = {
        id: 1,
        ...updateData,
        email: 'john@example.com'
      };

      userController.updateUser.mockImplementation((req, res) => {
        res.status(200).json({
          message: 'Profil mis à jour avec succès',
          user: updatedUser
        });
      });

      const response = await request(app)
        .put('/users/me')
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Profil mis à jour avec succès');
      expect(response.body.user.firstName).toBe('John Updated');
    });

    test('should update user with avatar upload', async () => {
      const updateData = {
        firstName: 'John',
        hasFile: true
      };

      const updatedUser = {
        id: 1,
        firstName: 'John',
        email: 'john@example.com',
        avatar: '/uploads/test-avatar.jpg'
      };

      userController.updateUser.mockImplementation((req, res) => {
        res.status(200).json({
          message: 'Profil et avatar mis à jour avec succès',
          user: updatedUser
        });
      });

      const response = await request(app)
        .put('/users/me')
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.user.avatar).toBe('/uploads/test-avatar.jpg');
    });

    test('should return error without authentication', async () => {
      const response = await request(app)
        .put('/users/me')
        .send({ firstName: 'John' });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Token manquant');
    });
  });

  describe('POST /users/change-password', () => {
    test('should change password successfully', async () => {
      const passwordData = {
        currentPassword: 'oldpassword123',
        newPassword: 'newpassword123'
      };

      userController.changePassword.mockImplementation((req, res) => {
        res.status(200).json({ message: 'Mot de passe modifié avec succès' });
      });

      const response = await request(app)
        .post('/users/change-password')
        .set('Authorization', `Bearer ${userToken}`)
        .send(passwordData);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Mot de passe modifié avec succès');
    });

    test('should return error with wrong current password', async () => {
      userController.changePassword.mockImplementation((req, res) => {
        res.status(400).json({ message: 'Mot de passe actuel incorrect' });
      });

      const response = await request(app)
        .post('/users/change-password')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          currentPassword: 'wrongpassword',
          newPassword: 'newpassword123'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Mot de passe actuel incorrect');
    });
  });

  describe('Two-Factor Authentication Routes', () => {
    describe('GET /users/two-factor/status', () => {
      test('should get 2FA status', async () => {
        userController.getTwoFactorStatus.mockImplementation((req, res) => {
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
      test('should generate 2FA secret', async () => {
        const mockResponse = {
          secret: 'JBSWY3DPEHPK3PXP',
          qrCode: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
          backupCodes: ['123456', '789012']
        };

        userController.generateTwoFactorSecret.mockImplementation((req, res) => {
          res.status(200).json(mockResponse);
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
      test('should verify and enable 2FA', async () => {
        userController.verifyAndEnableTwoFactor.mockImplementation((req, res) => {
          res.status(200).json({ message: 'Authentification à deux facteurs activée avec succès' });
        });

        const response = await request(app)
          .post('/users/two-factor/verify')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ token: '123456' });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Authentification à deux facteurs activée avec succès');
      });

      test('should return error with invalid token', async () => {
        userController.verifyAndEnableTwoFactor.mockImplementation((req, res) => {
          res.status(400).json({ message: 'Code de vérification invalide' });
        });

        const response = await request(app)
          .post('/users/two-factor/verify')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ token: '000000' });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Code de vérification invalide');
      });
    });

    describe('POST /users/two-factor/disable', () => {
      test('should disable 2FA successfully', async () => {
        userController.disableTwoFactor.mockImplementation((req, res) => {
          res.status(200).json({ message: 'Authentification à deux facteurs désactivée' });
        });

        const response = await request(app)
          .post('/users/two-factor/disable')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ password: 'currentpassword' });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Authentification à deux facteurs désactivée');
      });

      test('should return error with wrong password', async () => {
        userController.disableTwoFactor.mockImplementation((req, res) => {
          res.status(400).json({ message: 'Mot de passe incorrect' });
        });

        const response = await request(app)
          .post('/users/two-factor/disable')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ password: 'wrongpassword' });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Mot de passe incorrect');
      });
    });

    describe('POST /users/two-factor/login', () => {
      test('should verify 2FA login token', async () => {
        userController.verifyTwoFactorLogin.mockImplementation((req, res) => {
          res.status(200).json({
            message: 'Authentification réussie',
            token: userToken,
            user: { id: 1, email: 'test@example.com' }
          });
        });

        const response = await request(app)
          .post('/users/two-factor/login')
          .send({
            email: 'test@example.com',
            token: '123456'
          });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Authentification réussie');
        expect(response.body.token).toBeDefined();
      });

      test('should return error with invalid 2FA token', async () => {
        userController.verifyTwoFactorLogin.mockImplementation((req, res) => {
          res.status(400).json({ message: 'Code d\'authentification invalide' });
        });

        const response = await request(app)
          .post('/users/two-factor/login')
          .send({
            email: 'test@example.com',
            token: '000000'
          });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Code d\'authentification invalide');
      });
    });
  });

  describe('DELETE /users/me', () => {
    test('should delete user account successfully', async () => {
      userController.deleteAccount.mockImplementation((req, res) => {
        res.status(200).json({ message: 'Compte supprimé avec succès' });
      });

      const response = await request(app)
        .delete('/users/me')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ password: 'confirmpassword' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Compte supprimé avec succès');
    });

    test('should return error with wrong password', async () => {
      userController.deleteAccount.mockImplementation((req, res) => {
        res.status(400).json({ message: 'Mot de passe incorrect' });
      });

      const response = await request(app)
        .delete('/users/me')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ password: 'wrongpassword' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Mot de passe incorrect');
    });

    test('should return error without authentication', async () => {
      const response = await request(app)
        .delete('/users/me')
        .send({ password: 'password' });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Token manquant');
    });
  });

  describe('Super Admin Routes', () => {
    describe('GET /users/superadmin/users', () => {
      test('should get all users for super admin', async () => {
        const mockUsers = [
          { id: 1, email: 'user1@test.com', role: 'user', status: 'active' },
          { id: 2, email: 'user2@test.com', role: 'user', status: 'inactive' }
        ];

        userController.getAllUsers.mockImplementation((req, res) => {
          res.status(200).json({
            users: mockUsers,
            total: mockUsers.length
          });
        });

        const response = await request(app)
          .get('/users/superadmin/users')
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(response.status).toBe(200);
        expect(response.body.users).toHaveLength(2);
        expect(response.body.total).toBe(2);
      });

      test('should return error for non-super admin', async () => {
        const response = await request(app)
          .get('/users/superadmin/users')
          .set('Authorization', `Bearer ${userToken}`);

        expect(response.status).toBe(403);
        expect(response.body.message).toBe('Accès refusé - Super Admin requis');
      });

      test('should return error without authentication', async () => {
        const response = await request(app)
          .get('/users/superadmin/users');

        expect(response.status).toBe(401);
        expect(response.body.message).toBe('Token manquant');
      });
    });

    describe('PUT /users/superadmin/users/:id/status', () => {
      test('should toggle user status for super admin', async () => {
        const updatedUser = {
          id: 1,
          email: 'user@test.com',
          status: 'inactive'
        };

        userController.toggleUserStatus.mockImplementation((req, res) => {
          res.status(200).json({
            message: 'Statut utilisateur mis à jour avec succès',
            user: updatedUser
          });
        });

        const response = await request(app)
          .put('/users/superadmin/users/1/status')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({ status: 'inactive' });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Statut utilisateur mis à jour avec succès');
        expect(response.body.user.status).toBe('inactive');
      });

      test('should return error for non-super admin', async () => {
        const response = await request(app)
          .put('/users/superadmin/users/1/status')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ status: 'inactive' });

        expect(response.status).toBe(403);
        expect(response.body.message).toBe('Accès refusé - Super Admin requis');
      });

      test('should return 404 for non-existent user', async () => {
        userController.toggleUserStatus.mockImplementation((req, res) => {
          res.status(404).json({ message: 'Utilisateur non trouvé' });
        });

        const response = await request(app)
          .put('/users/superadmin/users/999/status')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({ status: 'inactive' });

        expect(response.status).toBe(404);
        expect(response.body.message).toBe('Utilisateur non trouvé');
      });
    });
  });

  describe('Security Tests', () => {
    test('should reject requests with malformed token', async () => {
      const response = await request(app)
        .get('/users/me')
        .set('Authorization', 'Bearer malformed-token');

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Token invalide');
    });

    test('should reject requests without Authorization header', async () => {
      const response = await request(app)
        .get('/users/me');

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Token manquant');
    });

    test('should reject requests with expired token', async () => {
      const expiredToken = jwt.sign(
        { id: 1, email: 'test@example.com' },
        process.env.JWT_SECRET,
        { expiresIn: '-1h' }
      );

      const response = await request(app)
        .get('/users/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Token invalide');
    });

    test('should handle rate limiting gracefully', async () => {
      userController.signIn.mockImplementation((req, res) => {
        res.status(429).json({ message: 'Trop de tentatives de connexion' });
      });

      const response = await request(app)
        .post('/users/sign-in')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(response.status).toBe(429);
      expect(response.body.message).toBe('Trop de tentatives de connexion');
    });
  });

  afterAll(() => {
    jest.clearAllMocks();
  });
});