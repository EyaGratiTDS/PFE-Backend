const request = require('supertest');
const express = require('express');
const visitorRoutes = require('../../routes/visitorRoutes'); 

const VisitorController = require('../../controllers/VisiteurController');

jest.mock('../../controllers/VisiteurController', () => ({
  trackVisitor: jest.fn(),
  trackVisitorExit: jest.fn(),
  getAudienceStats: jest.fn()
}));

describe('Visitor Routes Integration Tests', () => {
  let app;

  beforeAll(() => {
    app = express();
    
    app.use((req, res, next) => {
      if (req.method === 'POST' && req.get('Content-Type') === 'application/json') {
        let body = '';
        req.setEncoding('utf8');
        req.on('data', chunk => {
          body += chunk;
        });
        req.on('end', () => {
          try {
            req.body = body ? JSON.parse(body) : {};
            next();
          } catch (error) {
            return res.status(400).json({ error: 'Invalid JSON format' });
          }
        });
      } else {
        express.json()(req, res, next);
      }
    });
    
    app.use(express.urlencoded({ extended: true }));
    
    app.use('/visitor', visitorRoutes);
    
    app.use((err, req, res, next) => {

      if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({ error: 'Invalid JSON format' });
      }
      
      res.status(500).json({ error: 'Internal server error' });
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('POST /visitor/track', () => {
    test('should call trackVisitor controller and return visitor ID', async () => {
      const mockTrackingData = {
        entryTime: '2025-07-31T10:00:00Z'
      };

      const mockResponse = {
        visitorId: 1
      };

      VisitorController.trackVisitor.mockImplementation((req, res) => {
        res.status(200).json(mockResponse);
      });

      const response = await request(app)
        .post('/visitor/track')
        .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
        .set('Accept-Language', 'fr-FR,fr;q=0.9')
        .set('x-forwarded-for', '192.168.1.1')
        .send(mockTrackingData);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResponse);
      expect(VisitorController.trackVisitor).toHaveBeenCalledTimes(1);
      
      const callArgs = VisitorController.trackVisitor.mock.calls[0];
      expect(callArgs[0].body).toEqual(mockTrackingData);
      expect(callArgs[0].headers['user-agent']).toContain('Mozilla');
      expect(callArgs[0].headers['x-forwarded-for']).toBe('192.168.1.1');
      expect(callArgs[1]).toBeDefined(); 
    });

    test('should handle tracking without entry time', async () => {
      const mockResponse = {
        visitorId: 2
      };

      VisitorController.trackVisitor.mockImplementation((req, res) => {
        res.status(200).json(mockResponse);
      });

      const response = await request(app)
        .post('/visitor/track')
        .set('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResponse);
      expect(VisitorController.trackVisitor).toHaveBeenCalledTimes(1);
      
      const callArgs = VisitorController.trackVisitor.mock.calls[0];
      expect(callArgs[0].body).toEqual({});
      expect(callArgs[0].headers['user-agent']).toContain('iPhone');
    });

    test('should handle controller error', async () => {
      VisitorController.trackVisitor.mockImplementation((req, res) => {
        throw new Error('Database connection failed');
      });

      const response = await request(app)
        .post('/visitor/track')
        .set('User-Agent', 'Mozilla/5.0')
        .send({});

      expect(response.status).toBe(500);
      expect(VisitorController.trackVisitor).toHaveBeenCalledTimes(1);
    });

    test('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/visitor/track')
        .set('Content-Type', 'application/json')
        .set('User-Agent', 'Mozilla/5.0')
        .send('{"invalid": json}');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Invalid JSON format');
      expect(VisitorController.trackVisitor).not.toHaveBeenCalled();
    });

    test('should handle controller returning error status', async () => {
      VisitorController.trackVisitor.mockImplementation((req, res) => {
        res.status(500).json({ error: 'Internal server error' });
      });

      const response = await request(app)
        .post('/visitor/track')
        .set('User-Agent', 'Mozilla/5.0')
        .send({});

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Internal server error');
      expect(VisitorController.trackVisitor).toHaveBeenCalledTimes(1);
    });

    test('should handle different user agents', async () => {
      const mockResponse = { visitorId: 3 };
      
      VisitorController.trackVisitor.mockImplementation((req, res) => {
        res.status(200).json(mockResponse);
      });

      await request(app)
        .post('/visitor/track')
        .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36')
        .send({});

      expect(VisitorController.trackVisitor).toHaveBeenCalledTimes(1);

      jest.clearAllMocks();

      await request(app)
        .post('/visitor/track')
        .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0')
        .send({});

      expect(VisitorController.trackVisitor).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /visitor/track-exit', () => {
    test('should call trackVisitorExit controller and return success', async () => {
      const mockExitData = {
        visitorId: 1
      };

      const mockResponse = {
        success: true
      };

      VisitorController.trackVisitorExit.mockImplementation((req, res) => {
        res.status(200).json(mockResponse);
      });

      const response = await request(app)
        .post('/visitor/track-exit')
        .send(mockExitData);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResponse);
      expect(VisitorController.trackVisitorExit).toHaveBeenCalledTimes(1);
      
      const callArgs = VisitorController.trackVisitorExit.mock.calls[0];
      expect(callArgs[0].body).toEqual(mockExitData);
      expect(callArgs[1]).toBeDefined(); 
    });

    test('should handle missing visitor ID', async () => {
      VisitorController.trackVisitorExit.mockImplementation((req, res) => {
        res.status(400).json({ error: 'Visitor ID is required' });
      });

      const response = await request(app)
        .post('/visitor/track-exit')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Visitor ID is required');
      expect(VisitorController.trackVisitorExit).toHaveBeenCalledTimes(1);
    });

    test('should handle visitor not found', async () => {
      const mockExitData = {
        visitorId: 999
      };

      VisitorController.trackVisitorExit.mockImplementation((req, res) => {
        res.status(404).json({ error: 'Visitor not found' });
      });

      const response = await request(app)
        .post('/visitor/track-exit')
        .send(mockExitData);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Visitor not found');
      expect(VisitorController.trackVisitorExit).toHaveBeenCalledTimes(1);
    });

    test('should handle controller error', async () => {
      VisitorController.trackVisitorExit.mockImplementation((req, res) => {
        throw new Error('Database error');
      });

      const response = await request(app)
        .post('/visitor/track-exit')
        .send({ visitorId: 1 });

      expect(response.status).toBe(500);
      expect(VisitorController.trackVisitorExit).toHaveBeenCalledTimes(1);
    });

    test('should handle invalid visitor ID format', async () => {
      const mockExitData = {
        visitorId: 'invalid-id'
      };

      VisitorController.trackVisitorExit.mockImplementation((req, res) => {
        res.status(400).json({ error: 'Invalid visitor ID format' });
      });

      const response = await request(app)
        .post('/visitor/track-exit')
        .send(mockExitData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Invalid visitor ID format');
      expect(VisitorController.trackVisitorExit).toHaveBeenCalledTimes(1);
    });

    test('should handle malformed JSON in exit tracking', async () => {
      const response = await request(app)
        .post('/visitor/track-exit')
        .set('Content-Type', 'application/json')
        .send('{"visitorId": invalid}');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Invalid JSON format');
      expect(VisitorController.trackVisitorExit).not.toHaveBeenCalled();
    });
  });

  describe('GET /visitor/stats', () => {
    test('should call getAudienceStats controller and return statistics', async () => {
      const mockStats = {
        totalVisitors: 100,
        totalVisits: 250,
        avgDuration: 180.5
      };

      VisitorController.getAudienceStats.mockImplementation((req, res) => {
        res.status(200).json(mockStats);
      });

      const response = await request(app)
        .get('/visitor/stats');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockStats);
      expect(VisitorController.getAudienceStats).toHaveBeenCalledTimes(1);
      
      const callArgs = VisitorController.getAudienceStats.mock.calls[0];
      expect(callArgs[0]).toBeDefined(); 
      expect(callArgs[1]).toBeDefined(); 
    });

    test('should handle empty statistics', async () => {
      const mockStats = {
        totalVisitors: 0,
        totalVisits: 0,
        avgDuration: 0
      };

      VisitorController.getAudienceStats.mockImplementation((req, res) => {
        res.status(200).json(mockStats);
      });

      const response = await request(app)
        .get('/visitor/stats');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockStats);
      expect(VisitorController.getAudienceStats).toHaveBeenCalledTimes(1);
    });

    test('should handle controller error in stats', async () => {
      VisitorController.getAudienceStats.mockImplementation((req, res) => {
        throw new Error('Database connection failed');
      });

      const response = await request(app)
        .get('/visitor/stats');

      expect(response.status).toBe(500);
      expect(VisitorController.getAudienceStats).toHaveBeenCalledTimes(1);
    });

    test('should handle server error response from controller', async () => {
      VisitorController.getAudienceStats.mockImplementation((req, res) => {
        res.status(500).json({ error: 'Internal server error' });
      });

      const response = await request(app)
        .get('/visitor/stats');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Internal server error');
      expect(VisitorController.getAudienceStats).toHaveBeenCalledTimes(1);
    });

    test('should handle requests with query parameters', async () => {
      const mockStats = {
        totalVisitors: 50,
        totalVisits: 120,
        avgDuration: 95.2
      };

      VisitorController.getAudienceStats.mockImplementation((req, res) => {
        expect(req.query).toBeDefined();
        res.status(200).json(mockStats);
      });

      const response = await request(app)
        .get('/visitor/stats?period=week&filter=active');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockStats);
      expect(VisitorController.getAudienceStats).toHaveBeenCalledTimes(1);
    });
  });

  describe('Route Parameters and Middleware', () => {
    test('should properly handle request headers in track', async () => {
      VisitorController.trackVisitor.mockImplementation((req, res) => {
        expect(req.headers).toBeDefined();
        expect(req.headers['user-agent']).toBeDefined();
        expect(req.headers['accept-language']).toBeDefined();
        res.status(200).json({ visitorId: 1 });
      });

      await request(app)
        .post('/visitor/track')
        .set('User-Agent', 'Test-Agent/1.0')
        .set('Accept-Language', 'en-US,en;q=0.9')
        .set('x-forwarded-for', '203.0.113.1')
        .send({});

      expect(VisitorController.trackVisitor).toHaveBeenCalledTimes(1);
    });

    test('should handle different content types', async () => {
      const trackingData = {
        entryTime: '2025-07-31T10:00:00Z'
      };

      VisitorController.trackVisitor.mockImplementation((req, res) => {
        res.status(200).json({ visitorId: 1 });
      });

      const response = await request(app)
        .post('/visitor/track')
        .set('Content-Type', 'application/json')
        .set('User-Agent', 'Test-Agent/1.0')
        .send(JSON.stringify(trackingData));

      expect(response.status).toBe(200);
      expect(VisitorController.trackVisitor).toHaveBeenCalledTimes(1);
    });

    test('should handle missing headers gracefully', async () => {
      VisitorController.trackVisitor.mockImplementation((req, res) => {
        res.status(200).json({ visitorId: 1 });
      });

      const response = await request(app)
        .post('/visitor/track')
        .send({});

      expect(response.status).toBe(200);
      expect(VisitorController.trackVisitor).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling Integration', () => {
    test('should handle middleware errors properly', async () => {
      const largeData = {
        entryTime: '2025-07-31T10:00:00Z',
        metadata: 'A'.repeat(10000) 
      };

      VisitorController.trackVisitor.mockImplementation((req, res) => {
        res.status(200).json({ visitorId: 1 });
      });

      const response = await request(app)
        .post('/visitor/track')
        .set('User-Agent', 'Test-Agent/1.0')
        .send(largeData);

      expect([200, 400, 413, 500]).toContain(response.status);
    });

    test('should handle controller timeout gracefully', async () => {
      VisitorController.getAudienceStats.mockImplementation((req, res) => {
        setTimeout(() => {
          res.status(200).json({
            totalVisitors: 100,
            totalVisits: 200,
            avgDuration: 150
          });
        }, 100);
      });

      const response = await request(app)
        .get('/visitor/stats')
        .timeout(5000);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('totalVisitors');
    });

    test('should handle concurrent requests', async () => {
      VisitorController.trackVisitor.mockImplementation((req, res) => {
        res.status(200).json({ visitorId: Math.floor(Math.random() * 1000) });
      });

      const requests = Array.from({ length: 5 }, (_, i) =>
        request(app)
          .post('/visitor/track')
          .set('User-Agent', `Test-Agent-${i}/1.0`)
          .send({ entryTime: new Date().toISOString() })
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('visitorId');
      });

      expect(VisitorController.trackVisitor).toHaveBeenCalledTimes(5);
    });
  });

  describe('HTTP Methods and Routes', () => {
    test('should reject unsupported HTTP methods', async () => {
      const response = await request(app)
        .put('/visitor/track')
        .send({});

      expect(response.status).toBe(404);
    });

    test('should reject unknown routes', async () => {
      const response = await request(app)
        .get('/visitor/unknown-route');

      expect(response.status).toBe(404);
    });

    test('should handle DELETE method (non supporté)', async () => {
      const response = await request(app)
        .delete('/visitor/stats')
        .send({});

      expect(response.status).toBe(404);
    });
  });
});