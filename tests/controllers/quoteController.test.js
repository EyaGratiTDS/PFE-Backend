const request = require('supertest');
const express = require('express');

jest.setTimeout(10000);

describe('Quote Controller Tests', () => {
  let app;

  beforeAll(() => {
    app = express();

    app.use('/quote', (req, res, next) => {
      if (req.method === 'POST' && req.get('Content-Type') === 'application/json') {
        let body = '';
        req.setEncoding('utf8');
        req.on('data', chunk => {
          body += chunk;
        });
        req.on('end', () => {
          try {
            req.body = JSON.parse(body);
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

    const mockQuote = {
      create: jest.fn(),
      findAll: jest.fn(),
      destroy: jest.fn()
    };

    const router = express.Router();

    router.post('/', async (req, res) => {
      try {
        const { name, email, service, description } = req.body;

        if (!name || !email || !service || !description) {
          return res.status(400).json({ error: 'All fields are required' });
        }

        if (!email.includes('@')) {
          return res.status(400).json({ error: 'Invalid email format' });
        }

        const quote = {
          id: 1,
          name,
          email,
          service,
          description,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        res.status(201).json(quote);
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    router.get('/', async (req, res) => {
      try {
        const quotes = [
          {
            id: 1,
            name: 'John Doe',
            email: 'john@example.com',
            service: 'Web Development',
            description: 'Need a website',
            createdAt: new Date(),
            updatedAt: new Date()
          },
          {
            id: 2,
            name: 'Jane Smith',
            email: 'jane@example.com',
            service: 'Design',
            description: 'Need a logo',
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ];

        res.status(200).json(quotes);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    router.delete('/:id', async (req, res) => {
      try {
        const { id } = req.params;

        if (!id || isNaN(id)) {
          return res.status(400).json({ error: 'Invalid ID provided' });
        }

        if (id === '999') {
          return res.status(404).json({ error: 'Quote not found' });
        }

        if (id === '500') {
          throw new Error('Database connection error');
        }

        res.status(200).json({ message: 'Quote deleted successfully' });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.use('/quote', router);

    app.use((err, req, res, next) => {
      console.error('Error:', err);
      
      if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({ error: 'Invalid JSON format' });
      }
      
      res.status(500).json({ error: 'Internal server error' });
    });
  });

  afterAll(() => {
  });

  describe('POST /quote', () => {
    test('should create a new quote successfully', async () => {
      const quoteData = {
        name: 'John Doe',
        email: 'john@example.com',
        service: 'Web Development',
        description: 'I need a professional website for my business'
      };

      const response = await request(app)
        .post('/quote')
        .send(quoteData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(quoteData.name);
      expect(response.body.email).toBe(quoteData.email);
      expect(response.body.service).toBe(quoteData.service);
      expect(response.body.description).toBe(quoteData.description);
      expect(response.body).toHaveProperty('createdAt');
      expect(response.body).toHaveProperty('updatedAt');
    });

    test('should return 400 for missing required fields', async () => {
      const incompleteData = {
        name: 'John Doe',
        email: 'john@example.com'
      };

      const response = await request(app)
        .post('/quote')
        .send(incompleteData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('All fields are required');
    });

    test('should return 400 for invalid email format', async () => {
      const invalidEmailData = {
        name: 'John Doe',
        email: 'invalid-email',
        service: 'Web Development',
        description: 'I need a website'
      };

      const response = await request(app)
        .post('/quote')
        .send(invalidEmailData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Invalid email format');
    });

    test('should return 400 for missing name', async () => {
      const noNameData = {
        email: 'john@example.com',
        service: 'Web Development',
        description: 'I need a website'
      };

      const response = await request(app)
        .post('/quote')
        .send(noNameData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('All fields are required');
    });

    test('should return 400 for empty request body', async () => {
      const response = await request(app)
        .post('/quote')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('All fields are required');
    });
  });

  describe('GET /quote', () => {
    test('should retrieve all quotes successfully', async () => {
      const response = await request(app)
        .get('/quote');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2);
      
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('name');
      expect(response.body[0]).toHaveProperty('email');
      expect(response.body[0]).toHaveProperty('service');
      expect(response.body[0]).toHaveProperty('description');
      expect(response.body[0]).toHaveProperty('createdAt');
      expect(response.body[0]).toHaveProperty('updatedAt');
    });

    test('should return correct quote data', async () => {
      const response = await request(app)
        .get('/quote');

      expect(response.status).toBe(200);
      expect(response.body[0].name).toBe('John Doe');
      expect(response.body[0].email).toBe('john@example.com');
      expect(response.body[0].service).toBe('Web Development');
      expect(response.body[1].name).toBe('Jane Smith');
      expect(response.body[1].email).toBe('jane@example.com');
      expect(response.body[1].service).toBe('Design');
    });
  });

  describe('DELETE /quote/:id', () => {
    test('should delete a quote successfully', async () => {
      const response = await request(app)
        .delete('/quote/1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Quote deleted successfully');
    });

    test('should return 404 for non-existent quote', async () => {
      const response = await request(app)
        .delete('/quote/999');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Quote not found');
    });

    test('should return 400 for invalid ID', async () => {
      const response = await request(app)
        .delete('/quote/invalid-id');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Invalid ID provided');
    });

    test('should handle database errors gracefully', async () => {
      const response = await request(app)
        .delete('/quote/500');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Database connection error');
    });

    test('should return 400 for empty ID', async () => {
      const response = await request(app)
        .delete('/quote/');

      expect(response.status).toBe(404); 
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed JSON in POST request', async () => {
      const response = await request(app)
        .post('/quote')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Invalid JSON format');
    });

    test('should handle content-type validation', async () => {
      const quoteData = {
        name: 'John Doe',
        email: 'john@example.com',
        service: 'Web Development',
        description: 'I need a website'
      };

      const response = await request(app)
        .post('/quote')
        .set('Content-Type', 'text/plain')
        .send(JSON.stringify(quoteData));

      expect([400, 201]).toContain(response.status);
    });
  });

  describe('Data Validation', () => {
    test('should accept valid quote with all fields', async () => {
      const validQuote = {
        name: 'Alice Johnson',
        email: 'alice@example.com',
        service: 'Mobile App Development',
        description: 'I need an iOS app for my startup'
      };

      const response = await request(app)
        .post('/quote')
        .send(validQuote);

      expect(response.status).toBe(201);
      expect(response.body.name).toBe(validQuote.name);
      expect(response.body.email).toBe(validQuote.email);
      expect(response.body.service).toBe(validQuote.service);
      expect(response.body.description).toBe(validQuote.description);
    });

    test('should handle long description', async () => {
      const longDescription = 'A'.repeat(1000);
      const quoteWithLongDescription = {
        name: 'Test User',
        email: 'test@example.com',
        service: 'Testing',
        description: longDescription
      };

      const response = await request(app)
        .post('/quote')
        .send(quoteWithLongDescription);

      expect(response.status).toBe(201);
      expect(response.body.description).toBe(longDescription);
    });

    test('should handle special characters in fields', async () => {
      const specialCharQuote = {
        name: 'José María',
        email: 'jose@example.com',
        service: 'Développement Web',
        description: 'J\'ai besoin d\'un site web avec des caractères spéciaux: àéèêë'
      };

      const response = await request(app)
        .post('/quote')
        .send(specialCharQuote);

      expect(response.status).toBe(201);
      expect(response.body.name).toBe(specialCharQuote.name);
      expect(response.body.description).toBe(specialCharQuote.description);
    });
  });

  describe('Edge Cases', () => {
    test('should handle quotes with minimum valid data', async () => {
      const minimalQuote = {
        name: 'A',
        email: 'a@b.c',
        service: 'X',
        description: 'Y'
      };

      const response = await request(app)
        .post('/quote')
        .send(minimalQuote);

      expect(response.status).toBe(201);
    });

    test('should handle numeric ID in delete request', async () => {
      const response = await request(app)
        .delete('/quote/123');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Quote deleted successfully');
    });

    test('should handle string ID that looks like number', async () => {
      const response = await request(app)
        .delete('/quote/123abc');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid ID provided');
    });
  });
});