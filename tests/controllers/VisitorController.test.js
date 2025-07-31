const request = require('supertest');
const express = require('express');
const axios = require('axios');
const UAParser = require('ua-parser-js');
const visitorRoutes = require('../../routes/visitorRoutes'); 
const User = require('../../models/User');

jest.mock('axios');
jest.mock('ua-parser-js');
jest.mock('../../models/User');
jest.mock('../../database/sequelize');

const mockedAxios = axios;
const mockedUAParser = UAParser;

describe('Visitor Controller Integration Tests', () => {
  let app;
  let mockUser;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    
    app.use('/visitor', visitorRoutes);
    
    app.use((err, req, res, next) => {
      console.error('Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockUser = {
      id: 1,
      role: 'user',
      ipAddress: '192.168.1.1',
      location: 'Paris, France',
      language: 'fr-FR',
      browser: 'Chrome',
      os: 'Windows',
      deviceType: 'desktop',
      entryTime: new Date('2025-07-31T10:00:00Z'),
      exitTime: null,
      duration: null,
      visitCount: 1,
      lastVisit: new Date('2025-07-31T10:00:00Z'),
      save: jest.fn().mockResolvedValue(true),
      get: jest.fn().mockReturnValue({
        id: 1,
        ipAddress: '192.168.1.1',
        location: 'Paris, France',
        language: 'fr-FR',
        browser: 'Chrome',
        os: 'Windows',
        deviceType: 'desktop',
        entryTime: new Date('2025-07-31T10:00:00Z'),
        exitTime: null,
        duration: null,
        visitCount: 1,
        lastVisit: new Date('2025-07-31T10:00:00Z')
      })
    };

    mockedAxios.get.mockImplementation((url) => {
      if (url.includes('ipify')) {
        return Promise.resolve({ data: { ip: '203.0.113.1' } });
      }
      if (url.includes('ip.sb')) {
        return Promise.resolve({ data: '203.0.113.1' });
      }
      if (url.includes('ip-api.com')) {
        return Promise.resolve({
          data: {
            status: 'success',
            country: 'France',
            city: 'Paris',
            query: '203.0.113.1'
          }
        });
      }
      return Promise.reject(new Error('Unknown API'));
    });

    mockedUAParser.mockImplementation(() => ({
      getResult: () => ({
        browser: { name: 'Chrome' },
        os: { name: 'Windows' }
      }),
      getDevice: () => ({ type: null })
    }));
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('POST /visitor/track', () => {
    test('should track new visitor successfully', async () => {
      User.findOne.mockResolvedValue(null);
      User.create.mockResolvedValue({ id: 1, ...mockUser });

      const response = await request(app)
        .post('/visitor/track')
        .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
        .set('Accept-Language', 'fr-FR,fr;q=0.9')
        .set('x-forwarded-for', '192.168.1.1')
        .send({
          entryTime: '2025-07-31T10:00:00Z'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('visitorId');
      expect(User.create).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'user',
          ipAddress: '203.0.113.1',
          location: 'Paris, France',
          language: 'fr-FR',
          browser: 'Chrome',
          os: 'Windows',
          deviceType: 'desktop',
          visitCount: 1
        })
      );
    });

    test('should update existing visitor', async () => {
      const existingVisitor = {
        ...mockUser,
        visitCount: 2,
        save: jest.fn().mockResolvedValue(true)
      };
      
      User.findOne.mockResolvedValue(existingVisitor);

      const response = await request(app)
        .post('/visitor/track')
        .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
        .set('Accept-Language', 'en-US,en;q=0.9')
        .set('x-forwarded-for', '192.168.1.1')
        .send();

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('visitorId', 1);
      expect(existingVisitor.visitCount).toBe(3);
      expect(existingVisitor.save).toHaveBeenCalled();
    });

    test('should handle localhost IP address', async () => {
      User.findOne.mockResolvedValue(null);
      User.create.mockResolvedValue({ id: 1, ...mockUser });

      const response = await request(app)
        .post('/visitor/track')
        .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
        .send();

      expect(response.status).toBe(200);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('ipify'),
        expect.any(Object)
      );
    });

    test('should handle geolocation API failure', async () => {
      mockedAxios.get.mockImplementation((url) => {
        if (url.includes('ipify')) {
          return Promise.resolve({ data: { ip: '203.0.113.1' } });
        }
        if (url.includes('ip-api.com')) {
          return Promise.reject(new Error('Geolocation API error'));
        }
      });

      User.findOne.mockResolvedValue(null);
      User.create.mockResolvedValue({ id: 1, ...mockUser });

      const response = await request(app)
        .post('/visitor/track')
        .set('x-forwarded-for', '203.0.113.1')
        .send();

      expect(response.status).toBe(200);
      expect(User.create).toHaveBeenCalledWith(
        expect.objectContaining({
          location: 'Unknown',
          ipAddress: '203.0.113.1'
        })
      );
    });

    test('should handle database error', async () => {
      User.findOne.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .post('/visitor/track')
        .send();

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Internal server error');
    });

    test('should handle missing user agent', async () => {
      mockedUAParser.mockImplementation(() => ({
        getResult: () => ({
          browser: { name: null },
          os: { name: null }
        }),
        getDevice: () => ({ type: null })
      }));

      User.findOne.mockResolvedValue(null);
      User.create.mockResolvedValue({ id: 1, ...mockUser });

      const response = await request(app)
        .post('/visitor/track')
        .set('x-forwarded-for', '192.168.1.1')
        .send();

      expect(response.status).toBe(200);
      expect(User.create).toHaveBeenCalledWith(
        expect.objectContaining({
          browser: 'Unknown',
          os: 'Unknown',
          deviceType: 'desktop'
        })
      );
    });
  });

  describe('POST /visitor/track-exit', () => {
    test('should track visitor exit successfully', async () => {
      const entryTime = new Date(Date.now() - 300000); 
      
      const visitor = {
        ...mockUser,
        entryTime: entryTime,
        save: jest.fn().mockResolvedValue(true)
      };
      
      User.findByPk.mockResolvedValue(visitor);

      const response = await request(app)
        .post('/visitor/track-exit')
        .send({
          visitorId: 1
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
      expect(visitor.exitTime).toBeDefined();
      expect(visitor.duration).toBeGreaterThan(0);
      expect(visitor.save).toHaveBeenCalled();
    });

    test('should handle visitor not found', async () => {
      User.findByPk.mockResolvedValue(null);

      const response = await request(app)
        .post('/visitor/track-exit')
        .send({
          visitorId: 999
        });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Visitor not found');
    });

    test('should handle visitor with wrong role', async () => {
      const adminUser = { ...mockUser, role: 'admin' };
      User.findByPk.mockResolvedValue(adminUser);

      const response = await request(app)
        .post('/visitor/track-exit')
        .send({
          visitorId: 1
        });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Visitor not found');
    });

    test('should handle visitor without entry time', async () => {
      const visitor = {
        ...mockUser,
        entryTime: null,
        duration: null,
        save: jest.fn().mockResolvedValue(true)
      };
      
      User.findByPk.mockResolvedValue(visitor);

      const response = await request(app)
        .post('/visitor/track-exit')
        .send({
          visitorId: 1
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
      expect(visitor.duration).toBeNull();
      expect(visitor.save).toHaveBeenCalled();
    });

    test('should handle database error', async () => {
      User.findByPk.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/visitor/track-exit')
        .send({
          visitorId: 1
        });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Internal server error');
    });
  });

  describe('GET /visitor/stats', () => {
    test('should return audience statistics', async () => {
      User.count.mockResolvedValue(100);
      User.sum.mockResolvedValue(250);
      User.findOne.mockResolvedValue({ avgDuration: 180.5 });

      const response = await request(app)
        .get('/visitor/stats');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        totalVisitors: 100,
        totalVisits: 250,
        avgDuration: 180.5
      });
      
      expect(User.count).toHaveBeenCalledWith({
        where: { role: 'user' }
      });
      expect(User.sum).toHaveBeenCalledWith('visitCount', {
        where: { role: 'user' }
      });
    });

    test('should handle null values in statistics', async () => {
      User.count.mockResolvedValue(0);
      User.sum.mockResolvedValue(null);
      User.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get('/visitor/stats');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        totalVisitors: 0,
        totalVisits: 0,
        avgDuration: 0
      });
    });

    test('should handle database error', async () => {
      User.count.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/visitor/stats');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Internal server error');
    });
  });

  describe('GET /visitor/details/:visitorId', () => {
    beforeEach(() => {
      const visitorController = require('../../controllers/VisiteurController');
      app.get('/visitor/details/:visitorId', visitorController.getVisitorDetails);
    });

    test('should return visitor details', async () => {
      User.findByPk.mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/visitor/details/1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: expect.objectContaining({
          id: 1,
          ipAddress: '192.168.1.1',
          location: 'Paris, France',
          isActive: true
        })
      });
      
      expect(User.findByPk).toHaveBeenCalledWith('1', {
        attributes: [
          'id',
          'ipAddress',
          'location',
          'language',
          'browser',
          'os',
          'deviceType',
          'entryTime',
          'exitTime',
          'duration',
          'visitCount',
          'lastVisit'
        ]
      });
    });

    test('should handle visitor not found', async () => {
      User.findByPk.mockResolvedValue(null);

      const response = await request(app)
        .get('/visitor/details/999');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Visitor not found');
    });

    test('should return inactive visitor', async () => {
      const inactiveVisitor = {
        ...mockUser,
        exitTime: new Date('2025-07-31T11:00:00Z'),
        get: jest.fn().mockReturnValue({
          ...mockUser.get(),
          exitTime: new Date('2025-07-31T11:00:00Z')
        })
      };
      
      User.findByPk.mockResolvedValue(inactiveVisitor);

      const response = await request(app)
        .get('/visitor/details/1');

      expect(response.status).toBe(200);
      expect(response.body.data.isActive).toBe(false);
    });

    test('should handle database error', async () => {
      User.findByPk.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/visitor/details/1');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Internal server error');
    });
  });

  describe('IP Address Handling', () => {
    test('should handle x-real-ip header', async () => {
      User.findOne.mockResolvedValue(null);
      User.create.mockResolvedValue({ id: 1, ...mockUser });

      const response = await request(app)
        .post('/visitor/track')
        .set('x-real-ip', '203.0.113.1')
        .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
        .send();

      expect(response.status).toBe(200);
      expect(User.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ipAddress: '203.0.113.1'
        })
      );
    });

    test('should clean IPv6 mapped IPv4 addresses', async () => {
      User.findOne.mockResolvedValue(null);
      User.create.mockResolvedValue({ id: 1, ...mockUser });

      const response = await request(app)
        .post('/visitor/track')
        .set('x-forwarded-for', '::ffff:192.168.1.1')
        .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
        .send();

      expect(response.status).toBe(200);
      expect(User.create).toHaveBeenCalled();
    });

    test('should handle multiple IPs in x-forwarded-for', async () => {
      User.findOne.mockResolvedValue(null);
      User.create.mockResolvedValue({ id: 1, ...mockUser });

      const response = await request(app)
        .post('/visitor/track')
        .set('x-forwarded-for', '203.0.113.1, 192.168.1.1, 10.0.0.1')
        .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
        .send();

      expect(response.status).toBe(200);
      expect(User.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ipAddress: '203.0.113.1'
        })
      );
    });
  });

  describe('External API Failures', () => {
    test('should handle all IP API providers failing', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network error'));
      
      User.findOne.mockResolvedValue(null);
      User.create.mockResolvedValue({ id: 1, ...mockUser });

      const response = await request(app)
        .post('/visitor/track')
        .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
        .send();

      expect(response.status).toBe(200);
      expect(User.create).toHaveBeenCalledWith(
        expect.objectContaining({
          location: 'Unknown'
        })
      );
    });

    test('should fallback to second IP provider', async () => {
      mockedAxios.get.mockImplementation((url) => {
        if (url.includes('ipify')) {
          return Promise.reject(new Error('First API failed'));
        }
        if (url.includes('ip.sb')) {
          return Promise.resolve({ data: '203.0.113.1' });
        }
        if (url.includes('ip-api.com')) {
          return Promise.resolve({
            data: {
              status: 'success',
              country: 'France',
              city: 'Paris',
              query: '203.0.113.1'
            }
          });
        }
        return Promise.reject(new Error('Unknown API'));
      });

      User.findOne.mockResolvedValue(null);
      User.create.mockResolvedValue({ id: 1, ...mockUser });

      const response = await request(app)
        .post('/visitor/track')
        .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
        .send();

      expect(response.status).toBe(200);
      expect(User.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ipAddress: '203.0.113.1',
          location: 'Paris, France'
        })
      );
    });
  });
});