const request = require('supertest');
const express = require('express');
const pixelRoutes = require('../../routes/pixelRoutes');
const pixelController = require('../../controllers/pixelController');
const { requireAuth, requireAuthSuperAdmin } = require('../../middleware/authMiddleware');

jest.mock('../../middleware/authMiddleware', () => ({
  requireAuth: jest.fn((req, res, next) => {
    req.user = { id: 'user123', role: 'user' };
    next();
  }),
  requireAuthSuperAdmin: jest.fn((req, res, next) => {
    req.user = { id: 'admin123', role: 'superadmin' };
    next();
  })
}));

jest.mock('../../controllers/pixelController', () => ({
  toggleBlocked: jest.fn(),
  createPixel: jest.fn(),
  updatePixel: jest.fn(),
  deletePixel: jest.fn(),
  getPixels: jest.fn(),
  getUserPixels: jest.fn(),
  getPixelById: jest.fn(),
  getPixelsByVCard: jest.fn(),
  trackEvent: jest.fn()
}));

jest.mock('express-rate-limit', () => {
  return jest.fn(() => (req, res, next) => next());
});

describe('Pixel Routes Integration Tests', () => {
  let app;
  let server;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/pixel', pixelRoutes);
  });

  afterAll((done) => {
    if (server) {
      server.close(done);
    } else {
      done();
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    requireAuth.mockImplementation((req, res, next) => {
      req.user = { id: 'user123', role: 'user' };
      next();
    });
    
    requireAuthSuperAdmin.mockImplementation((req, res, next) => {
      req.user = { id: 'admin123', role: 'superadmin' };
      next();
    });
  });

  describe('PUT /pixel/:id/toggle-status', () => {
    it('should toggle pixel blocked status with super admin auth', async () => {
      pixelController.toggleBlocked.mockImplementation((req, res) => {
        res.status(200).json({ success: true, message: 'Status toggled' });
      });

      const response = await request(app)
        .put('/pixel/pixel123/toggle-status')
        .expect(200);

      expect(requireAuthSuperAdmin).toHaveBeenCalled();
      expect(pixelController.toggleBlocked).toHaveBeenCalled();
      expect(response.body).toEqual({ success: true, message: 'Status toggled' });
    });
  });

  describe('POST /pixel', () => {
    it('should create a new pixel with authentication', async () => {
      const newPixel = {
        name: 'Test Pixel',
        description: 'Test description'
      };

      pixelController.createPixel.mockImplementation((req, res) => {
        res.status(201).json({ 
          success: true, 
          pixel: { id: 'pixel123', ...req.body } 
        });
      });

      const response = await request(app)
        .post('/pixel')
        .send(newPixel)
        .expect(201);

      expect(requireAuth).toHaveBeenCalled();
      expect(pixelController.createPixel).toHaveBeenCalled();
      expect(response.body.success).toBe(true);
      expect(response.body.pixel.name).toBe(newPixel.name);
    });

    it('should return validation error for invalid data', async () => {
      pixelController.createPixel.mockImplementation((req, res) => {
        res.status(400).json({ 
          success: false, 
          message: 'Validation error' 
        });
      });

      const response = await request(app)
        .post('/pixel')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation error');
    });
  });

  describe('PUT /pixel/:pixelId', () => {
    it('should update pixel with authentication', async () => {
      const updateData = {
        name: 'Updated Pixel',
        description: 'Updated description'
      };

      pixelController.updatePixel.mockImplementation((req, res) => {
        res.status(200).json({ 
          success: true, 
          pixel: { id: req.params.pixelId, ...req.body } 
        });
      });

      const response = await request(app)
        .put('/pixel/pixel123')
        .send(updateData)
        .expect(200);

      expect(requireAuth).toHaveBeenCalled();
      expect(pixelController.updatePixel).toHaveBeenCalled();
      expect(response.body.success).toBe(true);
    });

    it('should return 404 for non-existent pixel', async () => {
      pixelController.updatePixel.mockImplementation((req, res) => {
        res.status(404).json({ 
          success: false, 
          message: 'Pixel not found' 
        });
      });

      const response = await request(app)
        .put('/pixel/nonexistent')
        .send({ name: 'Test' })
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /pixel/:pixelId', () => {
    it('should delete pixel with authentication', async () => {
      pixelController.deletePixel.mockImplementation((req, res) => {
        res.status(200).json({ 
          success: true, 
          message: 'Pixel deleted successfully' 
        });
      });

      const response = await request(app)
        .delete('/pixel/pixel123')
        .expect(200);

      expect(requireAuth).toHaveBeenCalled();
      expect(pixelController.deletePixel).toHaveBeenCalled();
      expect(response.body.success).toBe(true);
    });

    it('should return 404 for non-existent pixel', async () => {
      pixelController.deletePixel.mockImplementation((req, res) => {
        res.status(404).json({ 
          success: false, 
          message: 'Pixel not found' 
        });
      });

      const response = await request(app)
        .delete('/pixel/nonexistent')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Pixel not found');
    });
  });

  describe('GET /pixel/pixels', () => {
    it('should get all pixels with super admin auth', async () => {
      const mockPixels = [
        { id: 'pixel1', name: 'Pixel 1' },
        { id: 'pixel2', name: 'Pixel 2' }
      ];

      pixelController.getPixels.mockImplementation((req, res) => {
        res.status(200).json({ 
          success: true, 
          pixels: mockPixels 
        });
      });

      const response = await request(app)
        .get('/pixel/pixels')
        .expect(200);

      expect(requireAuthSuperAdmin).toHaveBeenCalled();
      expect(pixelController.getPixels).toHaveBeenCalled();
      expect(response.body.pixels).toEqual(mockPixels);
    });
  });

  describe('GET /pixel/user', () => {
    it('should get user pixels with authentication', async () => {
      const mockUserPixels = [
        { id: 'pixel1', name: 'User Pixel 1', userId: 'user123' }
      ];

      pixelController.getUserPixels.mockImplementation((req, res) => {
        res.status(200).json({ 
          success: true, 
          pixels: mockUserPixels 
        });
      });

      const response = await request(app)
        .get('/pixel/user')
        .expect(200);

      expect(requireAuth).toHaveBeenCalled();
      expect(pixelController.getUserPixels).toHaveBeenCalled();
      expect(response.body.pixels).toEqual(mockUserPixels);
    });
  });

  describe('GET /pixel/:pixelId', () => {
    it('should get pixel by ID with authentication', async () => {
      const mockPixel = { id: 'pixel123', name: 'Test Pixel' };

      pixelController.getPixelById.mockImplementation((req, res) => {
        res.status(200).json({ 
          success: true, 
          pixel: mockPixel 
        });
      });

      const response = await request(app)
        .get('/pixel/pixel123')
        .expect(200);

      expect(requireAuth).toHaveBeenCalled();
      expect(pixelController.getPixelById).toHaveBeenCalled();
      expect(response.body.pixel).toEqual(mockPixel);
    });

    it('should return 404 for non-existent pixel', async () => {
      pixelController.getPixelById.mockImplementation((req, res) => {
        res.status(404).json({ 
          success: false, 
          message: 'Pixel not found' 
        });
      });

      const response = await request(app)
        .get('/pixel/nonexistent')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Pixel not found');
    });
  });

  describe('GET /pixel/vcard/:vcardId', () => {
    it('should get pixels by vCard ID without authentication', async () => {
      const mockPixels = [
        { id: 'pixel1', vcardId: 'vcard123' },
        { id: 'pixel2', vcardId: 'vcard123' }
      ];

      pixelController.getPixelsByVCard.mockImplementation((req, res) => {
        res.status(200).json({ 
          success: true, 
          pixels: mockPixels 
        });
      });

      const response = await request(app)
        .get('/pixel/vcard/vcard123')
        .expect(200);

      expect(pixelController.getPixelsByVCard).toHaveBeenCalled();
      expect(response.body.pixels).toEqual(mockPixels);
    });
  });

  describe('GET /pixel/:pixelId/track', () => {
    it('should track event via GET with rate limiting', async () => {
      pixelController.trackEvent.mockImplementation((req, res) => {
        res.status(200).json({ 
          success: true, 
          message: 'Event tracked' 
        });
      });

      const response = await request(app)
        .get('/pixel/pixel123/track')
        .expect(200);

      expect(pixelController.trackEvent).toHaveBeenCalled();
      expect(response.body.message).toBe('Event tracked');
    });

    it('should handle rate limiting', async () => {
      pixelController.trackEvent.mockImplementation((req, res) => {
        res.status(200).json({ 
          success: true, 
          message: 'Event tracked' 
        });
      });

      const normalRequests = [];
      for (let i = 0; i < 3; i++) {
        normalRequests.push(
          request(app)
            .get('/pixel/pixel123/track')
            .expect(200)
        );
      }

      const responses = await Promise.all(normalRequests);
      responses.forEach(response => {
        expect(response.body.success).toBe(true);
      });
    });
  });

  describe('POST /pixel/:pixelId/track', () => {
    it('should track event via POST with rate limiting', async () => {
      const trackData = {
        event: 'click',
        metadata: { page: 'home' }
      };

      pixelController.trackEvent.mockImplementation((req, res) => {
        res.status(200).json({ 
          success: true, 
          message: 'Event tracked',
          data: req.body
        });
      });

      const response = await request(app)
        .post('/pixel/pixel123/track')
        .send(trackData)
        .expect(200);

      expect(pixelController.trackEvent).toHaveBeenCalled();
      expect(response.body.message).toBe('Event tracked');
    });

    it('should handle tracking without authentication', async () => {
      pixelController.trackEvent.mockImplementation((req, res) => {
        res.status(200).json({ 
          success: true, 
          message: 'Anonymous tracking successful' 
        });
      });

      const response = await request(app)
        .post('/pixel/pixel123/track')
        .send({ event: 'view' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Route Parameters Validation', () => {
    it('should handle invalid pixel ID format', async () => {
      pixelController.getPixelById.mockImplementation((req, res) => {
        res.status(400).json({ 
          success: false, 
          message: 'Invalid pixel ID format' 
        });
      });

      const response = await request(app)
        .get('/pixel/invalid-id!')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid pixel ID format');
    });
  });

  describe('Middleware Integration', () => {
    it('should apply authentication middleware correctly', async () => {
      pixelController.createPixel.mockImplementation((req, res) => {
        expect(req.user).toBeDefined();
        expect(req.user.id).toBe('user123');
        res.status(201).json({ success: true });
      });

      const response = await request(app)
        .post('/pixel')
        .send({ name: 'Test' })
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    it('should apply super admin middleware correctly', async () => {
      pixelController.getPixels.mockImplementation((req, res) => {
        expect(req.user).toBeDefined();
        expect(req.user.role).toBe('superadmin');
        res.status(200).json({ success: true, pixels: [] });
      });

      const response = await request(app)
        .get('/pixel/pixels')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});