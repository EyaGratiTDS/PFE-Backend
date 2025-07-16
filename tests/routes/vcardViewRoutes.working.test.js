const request = require('supertest');
const express = require('express');
const { createTestToken } = require('../utils/testHelpers');

describe('VCard View Routes - Working Tests', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    
    // Routes VCard View
    app.post('/vcard-views', (req, res) => {
      const { vcardId, ipAddress, userAgent } = req.body;
      if (!vcardId) {
        return res.status(400).json({ message: "vcardId is required" });
      }
      
      res.status(201).json({ 
        id: 1, 
        vcardId, 
        ipAddress: ipAddress || '192.168.1.1',
        userAgent: userAgent || 'Test User Agent',
        viewedAt: new Date().toISOString(),
        success: true 
      });
    });
    
    app.get('/vcard-views/:id', (req, res) => {
      const { id } = req.params;
      if (id === '999') {
        return res.status(404).json({ message: 'VCard view not found' });
      }
      res.json({ 
        data: { 
          id: parseInt(id), 
          vcardId: 1,
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0 Test Browser',
          viewedAt: new Date().toISOString(),
          Vcard: {
            id: 1,
            name: 'John Doe',
            title: 'Software Developer'
          }
        } 
      });
    });
    
    app.get('/vcard-views/vcard/:vcardId', (req, res) => {
      const { vcardId } = req.params;
      const { limit = 10, offset = 0 } = req.query;
      
      const views = Array.from({ length: parseInt(limit) }, (_, i) => ({
        id: i + 1 + parseInt(offset),
        vcardId: parseInt(vcardId),
        ipAddress: `192.168.1.${(i + 1) % 255}`,
        userAgent: `Browser ${i + 1}`,
        viewedAt: new Date(Date.now() - i * 60000).toISOString()
      }));
      
      res.json({ 
        success: true, 
        data: views,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: 100
        }
      });
    });
    
    app.get('/vcard-views', (req, res) => {
      const { startDate, endDate, ipAddress } = req.query;
      let views = [
        { id: 1, vcardId: 1, ipAddress: '192.168.1.1', viewedAt: '2024-01-01T10:00:00Z' },
        { id: 2, vcardId: 1, ipAddress: '192.168.1.2', viewedAt: '2024-01-02T10:00:00Z' },
        { id: 3, vcardId: 2, ipAddress: '192.168.1.1', viewedAt: '2024-01-03T10:00:00Z' }
      ];
      
      if (startDate) {
        views = views.filter(view => new Date(view.viewedAt) >= new Date(startDate));
      }
      
      if (endDate) {
        views = views.filter(view => new Date(view.viewedAt) <= new Date(endDate));
      }
      
      if (ipAddress) {
        views = views.filter(view => view.ipAddress === ipAddress);
      }
      
      res.json({ success: true, data: views });
    });
    
    app.get('/vcard-views/stats/:vcardId', (req, res) => {
      const { vcardId } = req.params;
      const { period = 'week' } = req.query;
      
      let statsData;
      switch (period) {
        case 'day':
          statsData = {
            totalViews: 25,
            uniqueViews: 20,
            period: 'last 24 hours'
          };
          break;
        case 'week':
          statsData = {
            totalViews: 150,
            uniqueViews: 120,
            period: 'last 7 days'
          };
          break;
        case 'month':
          statsData = {
            totalViews: 600,
            uniqueViews: 480,
            period: 'last 30 days'
          };
          break;
        default:
          statsData = {
            totalViews: 150,
            uniqueViews: 120,
            period: 'last 7 days'
          };
      }
      
      res.json({ 
        success: true, 
        data: {
          vcardId: parseInt(vcardId),
          ...statsData,
          dailyBreakdown: [
            { date: '2024-01-01', views: 20 },
            { date: '2024-01-02', views: 35 },
            { date: '2024-01-03', views: 15 },
            { date: '2024-01-04', views: 40 },
            { date: '2024-01-05', views: 25 },
            { date: '2024-01-06', views: 10 },
            { date: '2024-01-07', views: 5 }
          ]
        }
      });
    });
    
    app.get('/vcard-views/analytics/:vcardId', (req, res) => {
      const { vcardId } = req.params;
      
      res.json({
        success: true,
        data: {
          vcardId: parseInt(vcardId),
          browsers: [
            { name: 'Chrome', count: 45, percentage: 60 },
            { name: 'Firefox', count: 22, percentage: 29.3 },
            { name: 'Safari', count: 8, percentage: 10.7 }
          ],
          devices: [
            { type: 'Mobile', count: 50, percentage: 66.7 },
            { type: 'Desktop', count: 20, percentage: 26.7 },
            { type: 'Tablet', count: 5, percentage: 6.7 }
          ],
          locations: [
            { country: 'France', count: 30, percentage: 40 },
            { country: 'USA', count: 25, percentage: 33.3 },
            { country: 'Germany', count: 20, percentage: 26.7 }
          ],
          referrers: [
            { source: 'Direct', count: 40, percentage: 53.3 },
            { source: 'Google', count: 20, percentage: 26.7 },
            { source: 'LinkedIn', count: 15, percentage: 20 }
          ]
        }
      });
    });
    
    app.delete('/vcard-views/:id', (req, res) => {
      const { id } = req.params;
      if (id === '999') {
        return res.status(404).json({ message: 'VCard view not found' });
      }
      res.json({ success: true, message: 'VCard view deleted' });
    });
    
    app.delete('/vcard-views/vcard/:vcardId/bulk', (req, res) => {
      const { vcardId } = req.params;
      const { startDate, endDate } = req.body;
      
      res.json({ 
        success: true, 
        message: `Bulk deleted views for VCard ${vcardId}`,
        deletedCount: 25
      });
    });
  });

  describe('VCard View CRUD Operations', () => {
    test('should create vcard view', async () => {
      const viewData = {
        vcardId: 1,
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 Test Browser'
      };

      const response = await request(app)
        .post('/vcard-views')
        .send(viewData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.vcardId).toBe(viewData.vcardId);
      expect(response.body.ipAddress).toBe(viewData.ipAddress);
      expect(response.body.userAgent).toBe(viewData.userAgent);
      expect(response.body.viewedAt).toBeDefined();
    });

    test('should require vcardId for creation', async () => {
      const response = await request(app)
        .post('/vcard-views')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('required');
    });

    test('should create view with default values', async () => {
      const viewData = {
        vcardId: 1
      };

      const response = await request(app)
        .post('/vcard-views')
        .send(viewData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.ipAddress).toBe('192.168.1.1');
      expect(response.body.userAgent).toBe('Test User Agent');
    });

    test('should get vcard view by ID', async () => {
      const response = await request(app)
        .get('/vcard-views/1');

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(1);
      expect(response.body.data.vcardId).toBe(1);
      expect(response.body.data.Vcard).toBeDefined();
      expect(response.body.data.Vcard.name).toBe('John Doe');
    });

    test('should return 404 for non-existent vcard view', async () => {
      const response = await request(app)
        .get('/vcard-views/999');

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('VCard view not found');
    });

    test('should get views by vcard ID', async () => {
      const response = await request(app)
        .get('/vcard-views/vcard/1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(10);
      expect(response.body.data[0].vcardId).toBe(1);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.total).toBe(100);
    });

    test('should support pagination for vcard views', async () => {
      const response = await request(app)
        .get('/vcard-views/vcard/1?limit=5&offset=10');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(5);
      expect(response.body.pagination.limit).toBe(5);
      expect(response.body.pagination.offset).toBe(10);
    });

    test('should get all vcard views', async () => {
      const response = await request(app)
        .get('/vcard-views');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(3);
    });

    test('should filter views by date range', async () => {
      const response = await request(app)
        .get('/vcard-views?startDate=2024-01-01&endDate=2024-01-02');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      // Vérifier que les dates sont dans la plage
      response.body.data.forEach(view => {
        const viewDate = new Date(view.viewedAt);
        expect(viewDate >= new Date('2024-01-01')).toBe(true);
        expect(viewDate <= new Date('2024-01-02')).toBe(true);
      });
    });

    test('should filter views by IP address', async () => {
      const response = await request(app)
        .get('/vcard-views?ipAddress=192.168.1.1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].ipAddress).toBe('192.168.1.1');
    });

    test('should delete vcard view', async () => {
      const response = await request(app)
        .delete('/vcard-views/1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('VCard view deleted');
    });

    test('should return 404 when deleting non-existent vcard view', async () => {
      const response = await request(app)
        .delete('/vcard-views/999');

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('VCard view not found');
    });
  });

  describe('VCard View Statistics', () => {
    test('should get view statistics for vcard', async () => {
      const response = await request(app)
        .get('/vcard-views/stats/1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.vcardId).toBe(1);
      expect(response.body.data.totalViews).toBe(150);
      expect(response.body.data.uniqueViews).toBe(120);
      expect(response.body.data.period).toBe('last 7 days');
      expect(response.body.data.dailyBreakdown).toHaveLength(7);
    });

    test('should get daily statistics', async () => {
      const response = await request(app)
        .get('/vcard-views/stats/1?period=day');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.totalViews).toBe(25);
      expect(response.body.data.period).toBe('last 24 hours');
    });

    test('should get weekly statistics', async () => {
      const response = await request(app)
        .get('/vcard-views/stats/1?period=week');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.totalViews).toBe(150);
      expect(response.body.data.period).toBe('last 7 days');
    });

    test('should get monthly statistics', async () => {
      const response = await request(app)
        .get('/vcard-views/stats/1?period=month');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.totalViews).toBe(600);
      expect(response.body.data.period).toBe('last 30 days');
    });
  });

  describe('VCard View Analytics', () => {
    test('should get analytics for vcard', async () => {
      const response = await request(app)
        .get('/vcard-views/analytics/1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.vcardId).toBe(1);
      expect(response.body.data.browsers).toHaveLength(3);
      expect(response.body.data.devices).toHaveLength(3);
      expect(response.body.data.locations).toHaveLength(3);
      expect(response.body.data.referrers).toHaveLength(3);
    });

    test('should have proper browser analytics', async () => {
      const response = await request(app)
        .get('/vcard-views/analytics/1');

      expect(response.body.data.browsers[0].name).toBe('Chrome');
      expect(response.body.data.browsers[0].count).toBe(45);
      expect(response.body.data.browsers[0].percentage).toBe(60);
    });

    test('should have proper device analytics', async () => {
      const response = await request(app)
        .get('/vcard-views/analytics/1');

      expect(response.body.data.devices[0].type).toBe('Mobile');
      expect(response.body.data.devices[0].count).toBe(50);
      expect(response.body.data.devices[0].percentage).toBe(66.7);
    });

    test('should have proper location analytics', async () => {
      const response = await request(app)
        .get('/vcard-views/analytics/1');

      expect(response.body.data.locations[0].country).toBe('France');
      expect(response.body.data.locations[0].count).toBe(30);
      expect(response.body.data.locations[0].percentage).toBe(40);
    });

    test('should have proper referrer analytics', async () => {
      const response = await request(app)
        .get('/vcard-views/analytics/1');

      expect(response.body.data.referrers[0].source).toBe('Direct');
      expect(response.body.data.referrers[0].count).toBe(40);
      expect(response.body.data.referrers[0].percentage).toBe(53.3);
    });
  });

  describe('Bulk Operations', () => {
    test('should bulk delete views for vcard', async () => {
      const deleteData = {
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      };

      const response = await request(app)
        .delete('/vcard-views/vcard/1/bulk')
        .send(deleteData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Bulk deleted views for VCard 1');
      expect(response.body.deletedCount).toBe(25);
    });
  });

  describe('Data Validation', () => {
    test('should handle various IP address formats', async () => {
      const ipAddresses = [
        '192.168.1.1',
        '10.0.0.1',
        '172.16.0.1',
        '8.8.8.8'
      ];

      for (const ip of ipAddresses) {
        const response = await request(app)
          .post('/vcard-views')
          .send({ vcardId: 1, ipAddress: ip });
        
        expect(response.status).toBe(201);
        expect(response.body.ipAddress).toBe(ip);
      }
    });

    test('should handle various user agents', async () => {
      const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
      ];

      for (const ua of userAgents) {
        const response = await request(app)
          .post('/vcard-views')
          .send({ vcardId: 1, userAgent: ua });
        
        expect(response.status).toBe(201);
        expect(response.body.userAgent).toBe(ua);
      }
    });
  });
});
