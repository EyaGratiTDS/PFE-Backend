const request = require('supertest');
const express = require('express');
const quoteRoutes = require('../../routes/quoteRoutes'); 

const QuoteController = require('../../controllers/QuoteController');

jest.mock('../../controllers/QuoteController', () => ({
  addQuote: jest.fn(),
  getAllQuotes: jest.fn(),
  deleteQuote: jest.fn()
}));

describe('Quote Routes Integration Tests', () => {
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
    
    app.use('/quote', quoteRoutes);
    
    app.use((err, req, res, next) => {
      console.error('Error:', err);
      
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

  describe('POST /quote', () => {
    test('should call addQuote controller and return 201 on success', async () => {
      const mockQuoteData = {
        name: 'John Doe',
        email: 'john@example.com',
        service: 'Web Development',
        description: 'I need a professional website'
      };

      const mockCreatedQuote = {
        id: 1,
        ...mockQuoteData,
        createdAt: '2025-07-31T01:08:57.218Z',
        updatedAt: '2025-07-31T01:08:57.218Z'
      };

      QuoteController.addQuote.mockImplementation((req, res) => {
        res.status(201).json(mockCreatedQuote);
      });

      const response = await request(app)
        .post('/quote')
        .send(mockQuoteData);

      expect(response.status).toBe(201);
      expect(response.body).toEqual(mockCreatedQuote);
      expect(QuoteController.addQuote).toHaveBeenCalledTimes(1);
      
      const callArgs = QuoteController.addQuote.mock.calls[0];
      expect(callArgs[0].body).toEqual(mockQuoteData);
      expect(callArgs[1]).toBeDefined(); 
    });

    test('should call addQuote controller and return 400 for validation errors', async () => {
      const invalidData = {
        name: 'John Doe'
      };

      QuoteController.addQuote.mockImplementation((req, res) => {
        res.status(400).json({ error: 'All fields are required' });
      });

      const response = await request(app)
        .post('/quote')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(QuoteController.addQuote).toHaveBeenCalledTimes(1);
    });

    test('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/quote')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Invalid JSON format');
      expect(QuoteController.addQuote).not.toHaveBeenCalled();
    });

    test('should handle controller throwing an error', async () => {
      const mockQuoteData = {
        name: 'John Doe',
        email: 'john@example.com',
        service: 'Web Development',
        description: 'I need a website'
      };

      QuoteController.addQuote.mockImplementation((req, res) => {
        throw new Error('Database connection failed');
      });

      const response = await request(app)
        .post('/quote')
        .send(mockQuoteData);

      expect(response.status).toBe(500);
      expect(QuoteController.addQuote).toHaveBeenCalledTimes(1);
    });

    test('should handle empty request body', async () => {
      QuoteController.addQuote.mockImplementation((req, res) => {
        res.status(400).json({ error: 'Request body is required' });
      });

      const response = await request(app)
        .post('/quote')
        .send({});

      expect(response.status).toBe(400);
      expect(QuoteController.addQuote).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /quote', () => {
    test('should call getAllQuotes controller and return quotes', async () => {
      const mockQuotes = [
        {
          id: 1,
          name: 'John Doe',
          email: 'john@example.com',
          service: 'Web Development',
          description: 'Need a website',
          createdAt: '2025-07-31T01:08:57.487Z',
          updatedAt: '2025-07-31T01:08:57.487Z'
        },
        {
          id: 2,
          name: 'Jane Smith',
          email: 'jane@example.com',
          service: 'Design',
          description: 'Need a logo',
          createdAt: '2025-07-31T01:08:57.487Z',
          updatedAt: '2025-07-31T01:08:57.487Z'
        }
      ];

      QuoteController.getAllQuotes.mockImplementation((req, res) => {
        res.status(200).json(mockQuotes);
      });

      const response = await request(app)
        .get('/quote');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockQuotes);
      expect(response.body).toHaveLength(2);
      expect(QuoteController.getAllQuotes).toHaveBeenCalledTimes(1);
      
      const callArgs = QuoteController.getAllQuotes.mock.calls[0];
      expect(callArgs[0]).toBeDefined(); 
      expect(callArgs[1]).toBeDefined();
    });

    test('should handle empty quotes list', async () => {
      QuoteController.getAllQuotes.mockImplementation((req, res) => {
        res.status(200).json([]);
      });

      const response = await request(app)
        .get('/quote');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
      expect(Array.isArray(response.body)).toBe(true);
      expect(QuoteController.getAllQuotes).toHaveBeenCalledTimes(1);
    });

    test('should handle controller error in getAllQuotes', async () => {
      QuoteController.getAllQuotes.mockImplementation((req, res) => {
        throw new Error('Database error');
      });

      const response = await request(app)
        .get('/quote');

      expect(response.status).toBe(500);
      expect(QuoteController.getAllQuotes).toHaveBeenCalledTimes(1);
    });

    test('should handle server error response from controller', async () => {
      QuoteController.getAllQuotes.mockImplementation((req, res) => {
        res.status(500).json({ error: 'Internal server error' });
      });

      const response = await request(app)
        .get('/quote');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
      expect(QuoteController.getAllQuotes).toHaveBeenCalledTimes(1);
    });
  });

  describe('DELETE /quote/:id', () => {
    test('should call deleteQuote controller and return success message', async () => {
      const quoteId = '1';
      
      QuoteController.deleteQuote.mockImplementation((req, res) => {
        res.status(200).json({ message: 'Quote deleted successfully' });
      });

      const response = await request(app)
        .delete(`/quote/${quoteId}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Quote deleted successfully' });
      expect(QuoteController.deleteQuote).toHaveBeenCalledTimes(1);
      
      const callArgs = QuoteController.deleteQuote.mock.calls[0];
      expect(callArgs[0].params.id).toBe(quoteId);
      expect(callArgs[1]).toBeDefined(); 
    });

    test('should handle non-existent quote ID', async () => {
      const quoteId = '999';
      
      QuoteController.deleteQuote.mockImplementation((req, res) => {
        res.status(404).json({ error: 'Quote not found' });
      });

      const response = await request(app)
        .delete(`/quote/${quoteId}`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Quote not found');
      expect(QuoteController.deleteQuote).toHaveBeenCalledTimes(1);
    });

    test('should handle invalid quote ID', async () => {
      const invalidId = 'invalid-id';
      
      QuoteController.deleteQuote.mockImplementation((req, res) => {
        res.status(400).json({ error: 'Invalid ID format' });
      });

      const response = await request(app)
        .delete(`/quote/${invalidId}`);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Invalid ID format');
      expect(QuoteController.deleteQuote).toHaveBeenCalledTimes(1);
    });

    test('should handle controller error in deleteQuote', async () => {
      const quoteId = '1';
      
      QuoteController.deleteQuote.mockImplementation((req, res) => {
        throw new Error('Database connection failed');
      });

      const response = await request(app)
        .delete(`/quote/${quoteId}`);

      expect(response.status).toBe(500);
      expect(QuoteController.deleteQuote).toHaveBeenCalledTimes(1);
    });

    test('should handle numeric ID', async () => {
      const quoteId = '123';
      
      QuoteController.deleteQuote.mockImplementation((req, res) => {
        res.status(200).json({ message: 'Quote deleted successfully' });
      });

      const response = await request(app)
        .delete(`/quote/${quoteId}`);

      expect(response.status).toBe(200);
      
      const callArgs = QuoteController.deleteQuote.mock.calls[0];
      expect(callArgs[0].params.id).toBe(quoteId);
    });

    test('should handle database error from controller', async () => {
      const quoteId = '1';
      
      QuoteController.deleteQuote.mockImplementation((req, res) => {
        res.status(500).json({ error: 'Database connection error' });
      });

      const response = await request(app)
        .delete(`/quote/${quoteId}`);

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Database connection error');
      expect(QuoteController.deleteQuote).toHaveBeenCalledTimes(1);
    });
  });

  describe('Route Parameters and Middleware', () => {
    test('should properly parse route parameters', async () => {
      const quoteId = 'abc123';
      
      QuoteController.deleteQuote.mockImplementation((req, res) => {
        expect(req.params.id).toBe(quoteId);
        res.status(200).json({ message: 'Quote deleted successfully' });
      });

      await request(app)
        .delete(`/quote/${quoteId}`);

      expect(QuoteController.deleteQuote).toHaveBeenCalledTimes(1);
    });

    test('should handle requests with query parameters', async () => {
      QuoteController.getAllQuotes.mockImplementation((req, res) => {
        expect(req.query).toBeDefined();
        res.status(200).json([]);
      });

      await request(app)
        .get('/quote?page=1&limit=10');

      expect(QuoteController.getAllQuotes).toHaveBeenCalledTimes(1);
    });

    test('should handle different content types', async () => {
      const quoteData = {
        name: 'John Doe',
        email: 'john@example.com',
        service: 'Web Development',
        description: 'I need a website'
      };

      QuoteController.addQuote.mockImplementation((req, res) => {
        res.status(201).json({ id: 1, ...req.body });
      });

      const response = await request(app)
        .post('/quote')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify(quoteData));

      expect(response.status).toBe(201);
      expect(QuoteController.addQuote).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling Integration', () => {
    test('should handle middleware errors properly', async () => {
      const largeData = {
        name: 'John Doe',
        email: 'john@example.com',
        service: 'Web Development',
        description: 'A'.repeat(10000)
      };

      QuoteController.addQuote.mockImplementation((req, res) => {
        res.status(201).json({ id: 1, ...req.body });
      });

      const response = await request(app)
        .post('/quote')
        .send(largeData);

      expect([201, 400, 413, 500]).toContain(response.status);
    });

    test('should handle controller response timeout', async () => {
      QuoteController.getAllQuotes.mockImplementation((req, res) => {
        setTimeout(() => {
          res.status(200).json([]);
        }, 100);
      });

      const response = await request(app)
        .get('/quote')
        .timeout(5000); 

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });
});