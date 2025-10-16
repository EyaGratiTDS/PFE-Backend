const pixelController = require('../../controllers/pixelController');
const { VCard, Pixel, EventTracking } = require('../../models');
const User = require('../../models/User');
const { getClientIp } = require('request-ip');
const axios = require('axios');
const UAParser = require('ua-parser-js');

jest.mock('../../models', () => ({
  VCard: {
    findOne: jest.fn(),
  },
  Pixel: {
    create: jest.fn(),
    findOne: jest.fn(),
    findByPk: jest.fn(),
    findAll: jest.fn(),
  },
  EventTracking: {
    create: jest.fn(),
  },
}));

jest.mock('../../models/User', () => ({
  findByPk: jest.fn(),
}));

jest.mock('request-ip', () => ({
  getClientIp: jest.fn(),
}));

jest.mock('axios');

jest.mock('ua-parser-js');

process.env.META_API_URL = 'https://graph.facebook.com';
process.env.META_API_VERSION = 'v18.0';
process.env.API_URL = 'https://api.test.com';
process.env.META_SYSTEM_ACCESS_TOKEN = 'test_access_token';

describe('PixelController', () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      query: {},
      headers: {},
      user: { id: 1 },
    };
    res = {
      status: jest.fn(() => res),
      json: jest.fn(() => res),
      writeHead: jest.fn(() => res),
      end: jest.fn(() => res),
    };

    jest.clearAllMocks();
  });

  describe('createPixel', () => {
    it('devrait créer un pixel avec succès', async () => {
      req.body = {
        vcardId: 1,
        name: 'Test Pixel',
        userId: 1,
        metaAccessToken: 'test_token',
        metaAccountId: 'test_account_id',
      };

      const mockVCard = { id: 1, name: 'Test VCard', userId: 1 };
      const mockPixel = {
        id: 1,
        name: 'Test Pixel',
        vcardId: 1,
        metaPixelId: 'meta_pixel_123',
        is_active: true,
        is_blocked: false,
        created_at: new Date()
      };

      VCard.findOne.mockResolvedValue(mockVCard);
      Pixel.findOne.mockResolvedValue(null); 
      axios.post.mockResolvedValue({ data: { id: 'meta_pixel_123' } });
      Pixel.create.mockResolvedValue(mockPixel);

      await pixelController.createPixel(req, res);

      expect(VCard.findOne).toHaveBeenCalledWith({
        where: { id: 1, userId: 1 },
      });
      expect(Pixel.create).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          id: 1,
          name: 'Test Pixel',
          type: undefined,
          pixelCode: undefined,
          trackingUrl: 'https://api.test.com/pixels/1/track',
          vcardId: 1,
          is_active: true,
          is_blocked: false,
          created_at: mockPixel.created_at
        },
      });
    });

    it('devrait retourner 404 si la VCard n\'existe pas', async () => {
      req.body = { vcardId: 999, userId: 1 };
      VCard.findOne.mockResolvedValue(null);

      await pixelController.createPixel(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'VCard not found or unauthorized',
      });
    });
  });

  describe('updatePixel', () => {
    it('devrait mettre à jour un pixel avec succès', async () => {
      req.params = { pixelId: 1 };
      req.body = { name: 'Updated Pixel', is_active: false };

      const mockPixel = {
        id: 1,
        name: 'Test Pixel',
        metaPixelId: 'meta_123',
        is_active: true,
        update: jest.fn(),
        VCard: { id: 1, name: 'Test VCard' },
      };

      Pixel.findByPk.mockResolvedValue(mockPixel);
      mockPixel.update.mockResolvedValue();

      await pixelController.updatePixel(req, res);

      expect(Pixel.findByPk).toHaveBeenCalledWith(1, {
        include: [{ model: VCard, as: 'VCard' }],
      });
      expect(mockPixel.update).toHaveBeenCalledWith({
        name: 'Updated Pixel',
        is_active: false,
        type: undefined,
        pixelCode: undefined
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          id: 1,
          name: 'Test Pixel',
          type: undefined,
          pixelCode: undefined,
          is_active: true,
          is_blocked: undefined,
          trackingUrl: 'https://api.test.com/pixels/1/track',
          vcardId: undefined
        },
      });
    });

    it('devrait débloquer un pixel déjà bloqué', async () => {
      req.params = { id: 2 };
      const mockPixel = {
        id: 2,
        name: 'Blocked Pixel',
        is_blocked: true,
        update: jest.fn().mockImplementation(function(updates) {
          this.is_blocked = updates.is_blocked;
        }),
      };

      Pixel.findByPk.mockResolvedValue(mockPixel);

      await pixelController.toggleBlocked(req, res);

      expect(Pixel.findByPk).toHaveBeenCalledWith(2);
      expect(mockPixel.update).toHaveBeenCalledWith({ is_blocked: false });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          id: 2,
          name: 'Blocked Pixel',
          is_blocked: false,
          message: 'Pixel unblocked successfully',
        },
      });
    });

    it('devrait retourner 404 si le pixel n\'existe pas', async () => {
      req.params = { pixelId: 999 };
      Pixel.findByPk.mockResolvedValue(null);

      await pixelController.updatePixel(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Pixel not found',
      });
    });
  });

  describe('deletePixel', () => {
    it('devrait supprimer un pixel avec succès', async () => {
      req.params = { pixelId: 1 };
      const mockPixel = {
        id: 1,
        metaPixelId: 'meta_123',
        destroy: jest.fn(),
      };

      Pixel.findByPk.mockResolvedValue(mockPixel);
      axios.delete.mockResolvedValue({});

      await pixelController.deletePixel(req, res);

      expect(Pixel.findByPk).toHaveBeenCalledWith(1);
      expect(mockPixel.destroy).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Pixel deleted successfully',
      });
    });

    it('devrait retourner 404 si le pixel n\'existe pas', async () => {
      req.params = { pixelId: 999 };
      Pixel.findByPk.mockResolvedValue(null);

      await pixelController.deletePixel(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Pixel not found',
      });
    });
  });

  describe('getUserPixels', () => {
    it('devrait récupérer les pixels d\'un utilisateur', async () => {
      req.query = { userId: 1 };
      const mockPixels = [
        {
          id: 1,
          name: 'Pixel 1',
          metaPixelId: 'meta_123',
          is_active: true,
          created_at: new Date(),
          VCard: { id: 1, name: 'VCard 1', is_active: true, status: 'active' },
        },
      ];

      Pixel.findAll.mockResolvedValue(mockPixels);

      await pixelController.getUserPixels(req, res);

      expect(Pixel.findAll).toHaveBeenCalledWith({
        include: [
          {
            model: VCard,
            as: 'VCard',
            where: { userId: 1, is_active: true },
            attributes: ['id', 'name', 'is_active', 'status'],
          },
        ],
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [
          {
            id: 1,
            name: 'Pixel 1',
            type: undefined,
            pixelCode: undefined,
            vcard: mockPixels[0].VCard,
            is_active: true,
            is_blocked: undefined,
            created_at: mockPixels[0].created_at,
            trackingUrl: 'https://api.test.com/pixels/1/track',
          },
        ],
      });
    });
  });

  describe('getPixelById', () => {
    it('devrait récupérer un pixel par son ID', async () => {
      req.params = { pixelId: 1 };
      const mockPixel = {
        id: 1,
        name: 'Test Pixel',
        metaPixelId: 'meta_123',
        is_active: true,
        created_at: new Date(),
        VCard: { id: 1, name: 'Test VCard' },
      };

      Pixel.findByPk.mockResolvedValue(mockPixel);

      await pixelController.getPixelById(req, res);

      expect(Pixel.findByPk).toHaveBeenCalledWith(1, {
        include: [{ model: VCard, as: 'VCard', attributes: ['id', 'name', 'url'] }],
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          id: 1,
          name: 'Test Pixel',
          type: undefined,
          pixelCode: undefined,
          is_active: true,
          is_blocked: undefined,
          trackingUrl: 'https://api.test.com/pixels/1/track',
          vcard: { id: 1, name: 'Test VCard' },
          created_at: mockPixel.created_at,
        },
      });
    });

    it('devrait retourner 404 si le pixel n\'existe pas', async () => {
      req.params = { pixelId: 999 };
      Pixel.findByPk.mockResolvedValue(null);

      await pixelController.getPixelById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Pixel not found',
      });
    });
  });

  describe('trackEvent', () => {
    beforeEach(() => {
      getClientIp.mockReturnValue('192.168.1.1');
      axios.get.mockImplementation((url) => {
        if (url.includes('ipify.org')) {
          return Promise.resolve({ data: { ip: '203.0.113.1' } });
        }
        if (url.includes('ip-api.com')) {
          return Promise.resolve({
            data: {
              status: 'success',
              countryCode: 'US',
              regionName: 'California',
              city: 'San Francisco',
              query: '203.0.113.1',
            },
          });
        }
      });

      UAParser.mockImplementation(() => ({
        getResult: () => ({
          device: { type: 'desktop' },
          os: { name: 'Windows' },
          browser: { name: 'Chrome' },
        }),
      }));
    });

    it('devrait tracker un événement avec succès', async () => {
      req.params = { pixelId: 1 };
      req.body = {
        eventType: 'view',
        blockId: 'block_123',
        duration: 5000,
        metadata: { page: 'home' },
      };
      req.headers = {
        'user-agent': 'Mozilla/5.0 Chrome/91.0',
        'accept-language': 'en-US,en;q=0.9',
      };

      const mockPixel = {
        id: 1,
        vcardId: 1,
        metaPixelId: 'meta_123',
        is_active: true,
      };
      const mockEvent = { id: 1 };

      Pixel.findByPk.mockResolvedValue(mockPixel);
      EventTracking.create.mockResolvedValue(mockEvent);
      axios.post.mockResolvedValue({});

      await pixelController.trackEvent(req, res);

      expect(Pixel.findByPk).toHaveBeenCalledWith(1);
      expect(EventTracking.create).toHaveBeenCalledWith({
        eventType: 'view',
        metadata: { page: 'home' },
        duration: 5000,
        blockId: 'block_123',
        pixelId: 1,
        userAgent: 'Mozilla/5.0 Chrome/91.0',
        ipAddress: '203.0.113.1',
        country: 'US',
        region: 'California',
        city: 'San Francisco',
        deviceType: 'desktop',
        os: 'Windows',
        browser: 'Chrome',
        language: 'en-US',
        source: 'internal_tracking',
      });
      expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
      expect(res.end).toHaveBeenCalled();
    });

    it('ne devrait pas tracker si le pixel est inactif', async () => {
      req.params = { pixelId: 1 };
      const mockPixel = { id: 1, is_active: false };
      Pixel.findByPk.mockResolvedValue(mockPixel);

      await pixelController.trackEvent(req, res);

      expect(EventTracking.create).not.toHaveBeenCalled();
      expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
      expect(res.end).toHaveBeenCalled();
    });

    it('ne devrait pas tracker si le pixel n\'existe pas', async () => {
      req.params = { pixelId: 999 };
      Pixel.findByPk.mockResolvedValue(null);

      await pixelController.trackEvent(req, res);

      expect(EventTracking.create).not.toHaveBeenCalled();
      expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
      expect(res.end).toHaveBeenCalled();
    });
  });

  describe('getPixelsByVCard', () => {
    it('devrait récupérer les pixels d\'une VCard', async () => {
      req.params = { vcardId: 1 };
      req.user = { id: 1 };

      const mockVCard = { id: 1, userId: 1 };
      const mockPixels = [
        {
          id: 1,
          name: 'Pixel 1',
          is_active: true,
          created_at: new Date(),
        },
      ];

      VCard.findOne.mockResolvedValue(mockVCard);
      Pixel.findAll.mockResolvedValue(mockPixels);

      await pixelController.getPixelsByVCard(req, res);

      expect(VCard.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(Pixel.findAll).toHaveBeenCalledWith({
        where: { vcardId: 1 },
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [
          {
            id: 1,
            name: 'Pixel 1',
            type: undefined,
            pixelCode: undefined,
            is_active: true,
            is_blocked: undefined,
            created_at: mockPixels[0].created_at,
            trackingUrl: 'https://api.test.com/pixels/1/track',
          },
        ],
      });
    });
  });

  describe('getPixels', () => {
    it('devrait récupérer tous les pixels', async () => {
      const mockPixels = [
        {
          id: 1,
          name: 'Pixel 1',
          metaPixelId: 'meta_123',
          is_active: true,
          is_blocked: false,
          created_at: new Date(),
          VCard: {
            id: 1,
            name: 'VCard 1',
            url: 'https://vcard1.com',
            Users: {
              id: 1,
              name: 'User 1',
              email: 'user1@test.com',
            },
          },
        },
      ];

      Pixel.findAll.mockResolvedValue(mockPixels);

      await pixelController.getPixels(req, res);

      expect(Pixel.findAll).toHaveBeenCalledWith({
        include: [
          {
            model: VCard,
            as: 'VCard',
            attributes: ['id', 'name', 'url'],
            include: [
              {
                model: User,
                as: 'Users',
                attributes: ['id', 'name', 'email'],
              },
            ],
          },
        ],
        attributes: [
          'id',
          'name',
          'type',
          'pixelCode',
          'is_active',
          'is_blocked',
          'created_at',
        ],
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [
          {
            id: 1,
            name: 'Pixel 1',
            type: undefined,
            pixelCode: undefined,
            is_active: true,
            is_blocked: false,
            created_at: mockPixels[0].created_at,
            trackingUrl: 'https://api.test.com/pixels/1/track',
            vcard: {
              id: 1,
              name: 'VCard 1',
              url: 'https://vcard1.com',
              user: {
                id: 1,
                name: 'User 1',
                email: 'user1@test.com',
              },
            },
          },
        ],
      });
    });
  });

  describe('toggleBlocked', () => {
    it('devrait basculer le statut bloqué d\'un pixel', async () => {
      req.params = { id: 1 };
      const mockPixel = {
        id: 1,
        name: 'Test Pixel',
        is_blocked: false,
        update: jest.fn().mockImplementation(function(updates) {
          this.is_blocked = updates.is_blocked;
        }),
      };

      Pixel.findByPk.mockResolvedValue(mockPixel);

      await pixelController.toggleBlocked(req, res);

      expect(Pixel.findByPk).toHaveBeenCalledWith(1);
      expect(mockPixel.update).toHaveBeenCalledWith({ is_blocked: true });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          id: 1,
          name: 'Test Pixel',
          is_blocked: true,
          message: 'Pixel blocked successfully',
        },
      });
    });

    it('devrait retourner 404 si le pixel n\'existe pas', async () => {
      req.params = { id: 999 };
      Pixel.findByPk.mockResolvedValue(null);

      await pixelController.toggleBlocked(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Pixel not found',
      });
    });
  });

  describe('Gestion des erreurs', () => {
    it('devrait gérer les erreurs de base de données dans createPixel', async () => {
      req.body = { vcardId: 1, userId: 1 };
      VCard.findOne.mockRejectedValue(new Error('Database error'));

      await pixelController.createPixel(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Server error',
      });
    });

    it('devrait gérer les erreurs dans trackEvent', async () => {
      req.params = { pixelId: 1 };
      Pixel.findByPk.mockRejectedValue(new Error('Database error'));

      await pixelController.trackEvent(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
      expect(res.end).toHaveBeenCalled();
    });
  });
});