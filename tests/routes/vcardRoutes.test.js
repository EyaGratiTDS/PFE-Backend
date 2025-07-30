const request = require('supertest');
const express = require('express');
const http = require('http');

// Mocks définis AVANT l'importation des modules
jest.mock('../../controllers/vcardController');
jest.mock('../../controllers/vcardViewController');
jest.mock('../../middleware/planLimiter');
jest.mock('../../middleware/authMiddleware');

jest.mock('../../services/uploadService', () => ({
  upload: {
    fields: jest.fn(() => (req, res, next) => {
      req.files = {
        logoFile: [{ filename: 'logo.png', path: '/uploads/logo.png' }],
        backgroundFile: [{ filename: 'bg.jpg', path: '/uploads/bg.jpg' }],
        faviconFile: [{ filename: 'favicon.ico', path: '/uploads/favicon.ico' }]
      };
      next();
    })
  }
}));

// Importations APRÈS les mocks
const vcardController = require('../../controllers/vcardController');
const vcardViewController = require('../../controllers/vcardViewController');
const { checkVCardCreation } = require('../../middleware/planLimiter');
const uploadService = require('../../services/uploadService');
const { requireAuth, requireAuthSuperAdmin } = require('../../middleware/authMiddleware');
const vcardRoutes = require('../../routes/vcardRoutes');

describe('VCard Routes Integration Tests', () => {
  let app;
  let server;
  let baseURL;
  const sockets = new Set(); // Utilisation d'un Set pour stocker les sockets

  beforeAll((done) => {
    // Configuration de l'app Express pour les tests
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    
    // Mock du middleware d'authentification
    requireAuth.mockImplementation((req, res, next) => {
      req.user = { id: 'user123', email: 'test@example.com' };
      next();
    });

    requireAuthSuperAdmin.mockImplementation((req, res, next) => {
      req.user = { id: 'admin123', role: 'superadmin' };
      next();
    });

    // Mock du middleware de limitation de plan
    checkVCardCreation.mockImplementation((req, res, next) => {
      next();
    });

    // Utilisation des routes
    app.use('/vcard', vcardRoutes);

    // Créer et démarrer le serveur
    server = http.createServer(app);
    
    // Track active connections
    server.on('connection', (socket) => {
      sockets.add(socket);
      socket.on('close', () => {
        sockets.delete(socket);
      });
    });
    
    server.listen(0, () => {
      baseURL = `http://localhost:${server.address().port}`;
      done();
    });
  });

  afterAll((done) => {
    // Fermer toutes les connexions actives
    for (const socket of sockets) {
      socket.destroy();
    }
    
    // Fermer le serveur
    server.close(() => {
      done();
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /vcard', () => {
    it('should create a new vCard successfully', async () => {
      const mockVCard = {
        id: 'vcard123',
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+1234567890'
      };

      vcardController.createVCard.mockImplementation((req, res) => {
        res.status(201).json({ success: true, data: mockVCard });
      });

      const response = await request(baseURL)
        .post('/vcard')
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          phone: '+1234567890'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockVCard);
    });

    it('should return error when creation fails', async () => {
      vcardController.createVCard.mockImplementation((req, res) => {
        res.status(400).json({ success: false, error: 'Invalid data' });
      });

      const response = await request(baseURL)
        .post('/vcard')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /vcard', () => {
    it('should get vCards by user ID', async () => {
      const mockVCards = [
        { id: 'vcard1', name: 'Card 1' },
        { id: 'vcard2', name: 'Card 2' }
      ];

      vcardController.getVCardsByUserId.mockImplementation((req, res) => {
        res.status(200).json({ success: true, data: mockVCards });
      });

      const response = await request(baseURL).get('/vcard');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(mockVCards);
    });
  });

  describe('GET /vcard/:id', () => {
    it('should get vCard by ID', async () => {
      const mockVCard = { id: 'vcard123', name: 'John Doe' };

      vcardController.getVCardById.mockImplementation((req, res) => {
        res.status(200).json({ success: true, data: mockVCard });
      });

      const response = await request(baseURL).get('/vcard/vcard123');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(mockVCard);
    });

    it('should return 404 when vCard not found', async () => {
      vcardController.getVCardById.mockImplementation((req, res) => {
        res.status(404).json({ success: false, error: 'VCard not found' });
      });

      const response = await request(baseURL).get('/vcard/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /vcard/:id', () => {
    it('should update vCard with file uploads', async () => {
      const mockUpdatedVCard = {
        id: 'vcard123',
        name: 'Updated John Doe',
        logoUrl: '/uploads/logo.png'
      };

      vcardController.updateVCard.mockImplementation((req, res) => {
        res.status(200).json({ success: true, data: mockUpdatedVCard });
      });

      const response = await request(baseURL)
        .put('/vcard/vcard123')
        .field('name', 'Updated John Doe')
        .attach('logoFile', Buffer.from('fake logo'), 'logo.png');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(mockUpdatedVCard);
    });

    it('should update vCard without file uploads', async () => {
      const mockUpdatedVCard = {
        id: 'vcard123',
        name: 'Updated John Doe'
      };

      vcardController.updateVCard.mockImplementation((req, res) => {
        res.status(200).json({ success: true, data: mockUpdatedVCard });
      });

      const response = await request(baseURL)
        .put('/vcard/vcard123')
        .send({ name: 'Updated John Doe' });

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(mockUpdatedVCard);
    });
  });

  describe('DELETE /vcard/:id', () => {
    it('should delete vCard successfully', async () => {
      vcardController.deleteVCard.mockImplementation((req, res) => {
        res.status(200).json({ success: true, message: 'VCard deleted' });
      });

      const response = await request(baseURL).delete('/vcard/vcard123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return error when vCard not found for deletion', async () => {
      vcardController.deleteVCard.mockImplementation((req, res) => {
        res.status(404).json({ success: false, error: 'VCard not found' });
      });

      const response = await request(baseURL).delete('/vcard/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /vcard/delete-logo', () => {
    it('should delete logo successfully', async () => {
      vcardController.deleteLogo.mockImplementation((req, res) => {
        res.status(200).json({ success: true, message: 'Logo deleted' });
      });

      const response = await request(baseURL).delete('/vcard/delete-logo');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return error when logo deletion fails', async () => {
      vcardController.deleteLogo.mockImplementation((req, res) => {
        res.status(400).json({ success: false, error: 'No logo to delete' });
      });

      const response = await request(baseURL).delete('/vcard/delete-logo');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /vcard/url/:url', () => {
    it('should get vCard by URL', async () => {
      const mockVCard = { id: 'vcard123', url: 'johndoe', name: 'John Doe' };

      vcardController.getVCardByUrl.mockImplementation((req, res) => {
        res.status(200).json({ success: true, data: mockVCard });
      });

      const response = await request(baseURL).get('/vcard/url/johndoe');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(mockVCard);
    });

    it('should return 404 when vCard URL not found', async () => {
      vcardController.getVCardByUrl.mockImplementation((req, res) => {
        res.status(404).json({ success: false, error: 'VCard not found' });
      });

      const response = await request(baseURL).get('/vcard/url/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /vcard/:id/views', () => {
    it('should register view successfully', async () => {
      vcardViewController.registerView.mockImplementation((req, res) => {
        res.status(200).json({ success: true, message: 'View registered' });
      });

      const response = await request(baseURL)
        .post('/vcard/vcard123/views')
        .send({ userAgent: 'Mozilla/5.0', ip: '127.0.0.1' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should handle view registration with minimal data', async () => {
      vcardViewController.registerView.mockImplementation((req, res) => {
        res.status(200).json({ success: true, message: 'View registered' });
      });

      const response = await request(baseURL)
        .post('/vcard/vcard123/views')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /vcard/admin/vcards-with-users', () => {
    it('should get all vCards with users for super admin', async () => {
      const mockVCardsWithUsers = [
        {
          id: 'vcard1',
          name: 'Card 1',
          user: { id: 'user1', email: 'user1@example.com' }
        },
        {
          id: 'vcard2',
          name: 'Card 2',
          user: { id: 'user2', email: 'user2@example.com' }
        }
      ];

      vcardController.getAllVCardsWithUsers.mockImplementation((req, res) => {
        res.status(200).json({ success: true, data: mockVCardsWithUsers });
      });

      const response = await request(baseURL).get('/vcard/admin/vcards-with-users');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(mockVCardsWithUsers);
    });

    it('should return empty array when no vCards exist', async () => {
      vcardController.getAllVCardsWithUsers.mockImplementation((req, res) => {
        res.status(200).json({ success: true, data: [] });
      });

      const response = await request(baseURL).get('/vcard/admin/vcards-with-users');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
    });
  });

  describe('PUT /vcard/:id/toggle-status', () => {
    it('should toggle vCard status for super admin', async () => {
      const mockVCard = { id: 'vcard123', status: 'inactive' };

      vcardController.toggleVCardStatus.mockImplementation((req, res) => {
        res.status(200).json({ success: true, data: mockVCard });
      });

      const response = await request(baseURL).put('/vcard/vcard123/toggle-status');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(mockVCard);
    });

    it('should return error when vCard not found for status toggle', async () => {
      vcardController.toggleVCardStatus.mockImplementation((req, res) => {
        res.status(404).json({ success: false, error: 'VCard not found' });
      });

      const response = await request(baseURL).put('/vcard/nonexistent/toggle-status');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Middleware Integration', () => {
    it('should call middleware on POST', async () => {
      vcardController.createVCard.mockImplementation((req, res) => {
        res.status(201).json({ success: true });
      });

      await request(baseURL).post('/vcard').send({ name: 'Test' });

      expect(vcardController.createVCard).toHaveBeenCalled();
    });

    it('should handle file upload middleware on PUT', async () => {
      vcardController.updateVCard.mockImplementation((req, res) => {
        res.status(200).json({ success: true });
      });

      await request(baseURL)
        .put('/vcard/vcard123')
        .field('name', 'Test');

      expect(vcardController.updateVCard).toHaveBeenCalled();
    });

    it('should process uploaded files correctly', async () => {
      vcardController.updateVCard.mockImplementation((req, res) => {
        res.status(200).json({ success: true });
      });

      await request(baseURL)
        .put('/vcard/vcard123')
        .attach('logoFile', Buffer.from('fake logo'), 'logo.png');

      expect(vcardController.updateVCard).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle controller errors gracefully', async () => {
      vcardController.getVCardById.mockImplementation((req, res) => {
        res.status(500).json({ success: false, error: 'Internal server error' });
      });

      const response = await request(baseURL).get('/vcard/error-test');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });

    it('should handle middleware errors', async () => {
      checkVCardCreation.mockImplementationOnce((req, res, next) => {
        res.status(403).json({ success: false, error: 'Plan limit exceeded' });
      });

      const response = await request(baseURL).post('/vcard').send({ name: 'Test' });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should handle upload service errors', async () => {
      // Sauvegarder l'implémentation originale
      const originalUpload = uploadService.upload.fields;
      
      // Simuler une erreur d'upload
      uploadService.upload.fields = jest.fn(() => (req, res, next) => {
        res.status(400).json({ success: false, error: 'Upload failed' });
      });

      const response = await request(baseURL)
        .put('/vcard/vcard123')
        .attach('logoFile', Buffer.from('fake logo'), 'logo.png');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      
      uploadService.upload.fields = originalUpload;
    });
  });

  describe('Route Parameters', () => {
    it('should handle valid vCard ID parameter', async () => {
      vcardController.getVCardById.mockImplementation((req, res) => {
        expect(req.params.id).toBe('vcard123');
        res.status(200).json({ success: true, data: { id: 'vcard123' } });
      });

      await request(baseURL).get('/vcard/vcard123');
    });

    it('should handle valid URL parameter', async () => {
      vcardController.getVCardByUrl.mockImplementation((req, res) => {
        expect(req.params.url).toBe('test-url');
        res.status(200).json({ success: true, data: { url: 'test-url' } });
      });

      await request(baseURL).get('/vcard/url/test-url');
    });
  });

  describe('Request Body Handling', () => {
    it('should handle JSON request body', async () => {
      vcardController.createVCard.mockImplementation((req, res) => {
        expect(req.body.name).toBe('Test Name');
        expect(req.body.email).toBe('test@example.com');
        res.status(201).json({ success: true });
      });

      await request(baseURL)
        .post('/vcard')
        .send({
          name: 'Test Name',
          email: 'test@example.com'
        });
    });

    it('should handle form data', async () => {
      vcardController.updateVCard.mockImplementation((req, res) => {
        expect(req.body.name).toBe('Updated Name');
        res.status(200).json({ success: true });
      });

      await request(baseURL)
        .put('/vcard/vcard123')
        .field('name', 'Updated Name');
    });
  });
});