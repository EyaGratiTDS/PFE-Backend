const request = require('supertest');
const express = require('express');
const vcardViewController = require('../../controllers/vcardViewController');
const { createTestToken, createTestUser, createTestVCard, expectSuccessResponse, expectErrorResponse } = require('../utils/testHelpers');

// Mock des dépendances
jest.mock('../../models', () => require('../utils/mockModels'));
jest.mock('../../services/generateUrl');

const app = express();
app.use(express.json());

// Configuration des routes de test
app.get('/vcard-views', vcardViewController.getVCardViews);
app.post('/vcard-views/track', vcardViewController.trackVCardView);
app.get('/vcard-views/analytics/:vcardId', vcardViewController.getVCardAnalytics);
app.get('/vcard-views/stats/:vcardId', vcardViewController.getVCardStats);
app.delete('/vcard-views/:id', vcardViewController.deleteVCardView);
app.get('/vcard-views/export/:vcardId', vcardViewController.exportVCardViews);

describe('VCardViewController', () => {
  let mockModels;
  let authToken;
  let testUser;
  let testVCard;
  let testView;

  beforeEach(() => {
    mockModels = require('../utils/mockModels')();
    testUser = createTestUser();
    testVCard = createTestVCard({ userId: 1 });
    testView = {
      id: 1,
      vcardId: 1,
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      referrer: 'https://google.com',
      country: 'US',
      city: 'New York',
      device: 'desktop',
      browser: 'Chrome',
      os: 'Windows',
      created_at: new Date()
    };
    authToken = createTestToken({ id: 1, email: testUser.email });

    jest.clearAllMocks();
  });

  describe('GET /vcard-views', () => {
    test('should get vcard views for user', async () => {
      const views = [testView, { ...testView, id: 2, ipAddress: '192.168.1.2' }];
      
      mockModels.VCard.findAll.mockResolvedValue([testVCard]);
      mockModels.VCardView.findAll.mockResolvedValue(views);

      const response = await request(app)
        .get('/vcard-views')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data).toHaveLength(2);
      expect(mockModels.VCardView.findAll).toHaveBeenCalledWith({
        where: { vcardId: { [expect.any(Symbol)]: [1] } },
        include: [{ model: mockModels.VCard, as: 'VCard' }],
        order: [['created_at', 'DESC']]
      });
    });

    test('should filter views by date range', async () => {
      const startDate = '2025-01-01';
      const endDate = '2025-01-31';
      
      mockModels.VCard.findAll.mockResolvedValue([testVCard]);
      mockModels.VCardView.findAll.mockResolvedValue([testView]);

      const response = await request(app)
        .get(`/vcard-views?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
    });

    test('should filter views by vcard', async () => {
      mockModels.VCard.findOne.mockResolvedValue(testVCard);
      mockModels.VCardView.findAll.mockResolvedValue([testView]);

      const response = await request(app)
        .get('/vcard-views?vcardId=1')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
    });

    test('should support pagination', async () => {
      const views = Array.from({ length: 5 }, (_, i) => ({ ...testView, id: i + 1 }));
      
      mockModels.VCard.findAll.mockResolvedValue([testVCard]);
      mockModels.VCardView.findAndCountAll.mockResolvedValue({
        rows: views.slice(0, 3),
        count: 5
      });

      const response = await request(app)
        .get('/vcard-views?page=1&limit=3')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.pagination).toEqual({
        page: 1,
        limit: 3,
        total: 5,
        pages: 2
      });
    });
  });

  describe('POST /vcard-views/track', () => {
    test('should track vcard view successfully', async () => {
      const viewData = {
        vcardId: 1,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        referrer: 'https://facebook.com'
      };

      mockModels.VCard.findByPk.mockResolvedValue(testVCard);
      mockModels.VCardView.create.mockResolvedValue({
        ...testView,
        ...viewData,
        device: 'mobile',
        browser: 'Safari',
        os: 'iOS'
      });

      const response = await request(app)
        .post('/vcard-views/track')
        .set('X-Forwarded-For', '203.0.113.1')
        .send(viewData);

      expectSuccessResponse(response);
      expect(response.status).toBe(201);
      expect(mockModels.VCardView.create).toHaveBeenCalledWith({
        vcardId: 1,
        ipAddress: '203.0.113.1',
        userAgent: viewData.userAgent,
        referrer: viewData.referrer,
        device: 'mobile',
        browser: 'Safari',
        os: 'iOS',
        country: expect.any(String),
        city: expect.any(String)
      });
    });

    test('should handle missing vcard', async () => {
      mockModels.VCard.findByPk.mockResolvedValue(null);

      const response = await request(app)
        .post('/vcard-views/track')
        .send({ vcardId: 999 });

      expectErrorResponse(response);
      expect(response.body.message).toContain('VCard not found');
    });

    test('should parse device information from user agent', async () => {
      const mobileUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)';
      
      mockModels.VCard.findByPk.mockResolvedValue(testVCard);
      mockModels.VCardView.create.mockResolvedValue(testView);

      const response = await request(app)
        .post('/vcard-views/track')
        .send({
          vcardId: 1,
          userAgent: mobileUserAgent
        });

      expectSuccessResponse(response);
    });

    test('should handle duplicate views from same IP', async () => {
      mockModels.VCard.findByPk.mockResolvedValue(testVCard);
      mockModels.VCardView.findOne.mockResolvedValue(testView); // Existing view
      
      const response = await request(app)
        .post('/vcard-views/track')
        .set('X-Forwarded-For', '192.168.1.1')
        .send({ vcardId: 1 });

      expectSuccessResponse(response);
      expect(response.body.message).toContain('View already tracked');
    });

    test('should get geolocation from IP', async () => {
      mockModels.VCard.findByPk.mockResolvedValue(testVCard);
      mockModels.VCardView.create.mockResolvedValue({
        ...testView,
        country: 'FR',
        city: 'Paris'
      });

      const response = await request(app)
        .post('/vcard-views/track')
        .set('X-Forwarded-For', '82.64.30.1') // French IP
        .send({ vcardId: 1 });

      expectSuccessResponse(response);
    });
  });

  describe('GET /vcard-views/analytics/:vcardId', () => {
    test('should get vcard analytics successfully', async () => {
      mockModels.VCard.findOne.mockResolvedValue(testVCard);
      mockModels.VCardView.count.mockResolvedValue(150);
      mockModels.VCardView.findAll.mockResolvedValue([
        { country: 'US', count: 80 },
        { country: 'FR', count: 70 }
      ]);

      const response = await request(app)
        .get('/vcard-views/analytics/1')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data).toHaveProperty('totalViews', 150);
      expect(response.body.data).toHaveProperty('countries');
      expect(response.body.data).toHaveProperty('devices');
      expect(response.body.data).toHaveProperty('browsers');
      expect(response.body.data).toHaveProperty('referrers');
    });

    test('should support date range for analytics', async () => {
      const startDate = '2025-01-01';
      const endDate = '2025-01-31';
      
      mockModels.VCard.findOne.mockResolvedValue(testVCard);
      mockModels.VCardView.count.mockResolvedValue(50);
      mockModels.VCardView.findAll.mockResolvedValue([]);

      const response = await request(app)
        .get(`/vcard-views/analytics/1?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
    });

    test('should return 404 for non-existent vcard', async () => {
      mockModels.VCard.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get('/vcard-views/analytics/999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });

    test('should not allow access to other users vcards analytics', async () => {
      mockModels.VCard.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get('/vcard-views/analytics/1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(mockModels.VCard.findOne).toHaveBeenCalledWith({
        where: { id: 1, userId: 1 }
      });
    });
  });

  describe('GET /vcard-views/stats/:vcardId', () => {
    test('should get vcard stats successfully', async () => {
      mockModels.VCard.findOne.mockResolvedValue(testVCard);
      
      // Mock different time period counts
      mockModels.VCardView.count
        .mockResolvedValueOnce(5)  // today
        .mockResolvedValueOnce(25) // this week
        .mockResolvedValueOnce(100) // this month
        .mockResolvedValueOnce(500); // all time

      const response = await request(app)
        .get('/vcard-views/stats/1')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data).toEqual({
        today: 5,
        thisWeek: 25,
        thisMonth: 100,
        allTime: 500
      });
    });

    test('should get hourly stats for today', async () => {
      mockModels.VCard.findOne.mockResolvedValue(testVCard);
      
      const hourlyViews = Array.from({ length: 24 }, (_, hour) => ({
        hour,
        count: Math.floor(Math.random() * 10)
      }));
      
      mockModels.VCardView.findAll.mockResolvedValue(hourlyViews);

      const response = await request(app)
        .get('/vcard-views/stats/1?period=hourly')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data).toHaveProperty('hourlyViews');
    });

    test('should get daily stats for this month', async () => {
      mockModels.VCard.findOne.mockResolvedValue(testVCard);
      
      const dailyViews = Array.from({ length: 31 }, (_, day) => ({
        day: day + 1,
        count: Math.floor(Math.random() * 20)
      }));
      
      mockModels.VCardView.findAll.mockResolvedValue(dailyViews);

      const response = await request(app)
        .get('/vcard-views/stats/1?period=daily')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data).toHaveProperty('dailyViews');
    });
  });

  describe('DELETE /vcard-views/:id', () => {
    test('should delete vcard view successfully', async () => {
      mockModels.VCardView.findOne.mockResolvedValue(testView);
      mockModels.VCard.findOne.mockResolvedValue(testVCard);
      mockModels.VCardView.destroy.mockResolvedValue(1);

      const response = await request(app)
        .delete('/vcard-views/1')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(mockModels.VCardView.destroy).toHaveBeenCalledWith({
        where: { id: 1 }
      });
    });

    test('should return 404 for non-existent view', async () => {
      mockModels.VCardView.findOne.mockResolvedValue(null);

      const response = await request(app)
        .delete('/vcard-views/999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });

    test('should not allow deleting other users vcard views', async () => {
      mockModels.VCardView.findOne.mockResolvedValue(testView);
      mockModels.VCard.findOne.mockResolvedValue(null);

      const response = await request(app)
        .delete('/vcard-views/1')
        .set('Authorization', `Bearer ${authToken}`);

      expectErrorResponse(response);
      expect(response.body.message).toContain('not authorized');
    });
  });

  describe('GET /vcard-views/export/:vcardId', () => {
    test('should export vcard views as CSV', async () => {
      mockModels.VCard.findOne.mockResolvedValue(testVCard);
      mockModels.VCardView.findAll.mockResolvedValue([testView]);

      const response = await request(app)
        .get('/vcard-views/export/1?format=csv')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('attachment');
    });

    test('should export vcard views as JSON', async () => {
      mockModels.VCard.findOne.mockResolvedValue(testVCard);
      mockModels.VCardView.findAll.mockResolvedValue([testView]);

      const response = await request(app)
        .get('/vcard-views/export/1?format=json')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
      expect(response.body.data).toHaveLength(1);
    });

    test('should export with date range filter', async () => {
      mockModels.VCard.findOne.mockResolvedValue(testVCard);
      mockModels.VCardView.findAll.mockResolvedValue([testView]);

      const response = await request(app)
        .get('/vcard-views/export/1?startDate=2025-01-01&endDate=2025-01-31')
        .set('Authorization', `Bearer ${authToken}`);

      expectSuccessResponse(response);
    });

    test('should handle large exports with streaming', async () => {
      const largeViewSet = Array.from({ length: 1000 }, (_, i) => ({
        ...testView,
        id: i + 1
      }));

      mockModels.VCard.findOne.mockResolvedValue(testVCard);
      mockModels.VCardView.findAll.mockResolvedValue(largeViewSet);

      const response = await request(app)
        .get('/vcard-views/export/1?format=csv')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
    });
  });
});
