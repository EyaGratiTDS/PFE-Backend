const request = require('supertest');
const express = require('express');
const pixelController = require('../../controllers/pixelController');
const { createMockModels } = require('../utils/mockModels');
const { 
  createTestPixel, 
  createTestVCard, 
  createTestUser,
  expectSuccessResponse, 
  expectErrorResponse,
  expectNotFoundError,
  mockExternalServices
} = require('../utils/testHelpers');

jest.mock('axios');
const axios = require('axios');

describe('PixelController', () => {
  let app;
  let models;

  beforeAll(async () => {
    models = createMockModels();
    await models.sequelize.sync({ force: true });
    
    mockExternalServices();

    app = express();
    app.use(express.json());
    
    app.use((req, res, next) => {
      req.user = { id: 1, role: 'admin' };
      next();
    });
    
    app.post('/pixels', pixelController.createPixel);
    app.put('/pixels/:pixelId', pixelController.updatePixel);
    app.delete('/pixels/:pixelId', pixelController.deletePixel);
    app.get('/pixels/user', pixelController.getUserPixels);
    app.get('/pixels/:pixelId', pixelController.getPixelById);
    app.post('/pixels/:pixelId/track', pixelController.trackEvent);
    app.get('/pixels/vcard/:vcardId', pixelController.getPixelsByVCard);
    app.get('/pixels', pixelController.getPixels);
    app.put('/pixels/:id/toggle-blocked', pixelController.toggleBlocked);
  });

  beforeEach(async () => {
    await models.User.destroy({ where: {} });
    await models.VCard.destroy({ where: {} });
    await models.Pixel.destroy({ where: {} });
    await models.EventTracking.destroy({ where: {} });
    
    jest.clearAllMocks();
    
    axios.get.mockResolvedValue({ data: { ip: '127.0.0.1' } });
    axios.post.mockResolvedValue({ data: { id: 'meta_pixel_123' } });
    axios.delete.mockResolvedValue({ data: {} });
  });

  afterAll(async () => {
    await models.sequelize.close();
  });

  describe('POST /pixels - createPixel', () => {
    test('should create pixel successfully', async () => {
      const user = await models.User.create(await createTestUser());
      const vcard = await models.VCard.create(createTestVCard({ userId: user.id }));

      const pixelData = {
        vcardId: vcard.id,
        name: 'Test Pixel',
        userId: user.id
      };

      const response = await request(app)
        .post('/pixels')
        .send(pixelData);

      expectSuccessResponse(response);
      expect(response.body.pixel.name).toBe(pixelData.name);
      expect(response.body.pixel.vcardId).toBe(vcard.id);
      expect(response.body.pixel.trackingUrl).toContain('/track');
    });

    test('should create pixel with Meta integration', async () => {
      const user = await models.User.create(await createTestUser());
      const vcard = await models.VCard.create(createTestVCard({ userId: user.id }));

      const pixelData = {
        vcardId: vcard.id,
        name: 'Meta Pixel',
        userId: user.id,
        metaAccessToken: 'test_token',
        metaAccountId: 'test_account'
      };

      axios.post.mockResolvedValueOnce({ data: { id: 'meta_pixel_123' } });

      const response = await request(app)
        .post('/pixels')
        .send(pixelData);

      expectSuccessResponse(response);
      expect(response.body.pixel.metaPixelId).toBe('meta_pixel_123');
    });

    test('should return 404 for non-existent vCard', async () => {
      const pixelData = {
        vcardId: 999,
        name: 'Test Pixel',
        userId: 1
      };

      const response = await request(app)
        .post('/pixels')
        .send(pixelData);

      expectNotFoundError(response, 'VCard not found');
    });

    test('should return 409 for existing pixel on vCard', async () => {
      const user = await models.User.create(await createTestUser());
      const vcard = await models.VCard.create(createTestVCard({ userId: user.id }));
      await models.Pixel.create(createTestPixel({ vcardId: vcard.id }));

      const pixelData = {
        vcardId: vcard.id,
        name: 'Another Pixel',
        userId: user.id
      };

      const response = await request(app)
        .post('/pixels')
        .send(pixelData);

      expectErrorResponse(response, 409, 'A pixel already exists');
    });
  });

  describe('PUT /pixels/:pixelId - updatePixel', () => {
    test('should update pixel successfully', async () => {
      const user = await models.User.create(await createTestUser());
      const vcard = await models.VCard.create(createTestVCard({ userId: user.id }));
      const pixel = await models.Pixel.create(createTestPixel({ vcardId: vcard.id }));

      const updateData = {
        name: 'Updated Pixel',
        is_active: false
      };

      const response = await request(app)
        .put(`/pixels/${pixel.id}`)
        .send(updateData);

      expectSuccessResponse(response);
      expect(response.body.pixel.name).toBe(updateData.name);
      expect(response.body.pixel.is_active).toBe(false);
    });

    test('should return 404 for non-existent pixel', async () => {
      const updateData = {
        name: 'Non-existent Pixel'
      };

      const response = await request(app)
        .put('/pixels/999')
        .send(updateData);

      expectNotFoundError(response, 'Pixel not found');
    });
  });

  describe('DELETE /pixels/:pixelId - deletePixel', () => {
    test('should delete pixel successfully', async () => {
      const user = await models.User.create(await createTestUser());
      const vcard = await models.VCard.create(createTestVCard({ userId: user.id }));
      const pixel = await models.Pixel.create(createTestPixel({ vcardId: vcard.id }));

      const response = await request(app).delete(`/pixels/${pixel.id}`);

      expectSuccessResponse(response);
      expect(response.body.message).toBe('Pixel deleted');

      const deletedPixel = await models.Pixel.findByPk(pixel.id);
      expect(deletedPixel).toBeNull();
    });

    test('should delete pixel with Meta integration', async () => {
      const user = await models.User.create(await createTestUser());
      const vcard = await models.VCard.create(createTestVCard({ userId: user.id }));
      const pixel = await models.Pixel.create(createTestPixel({ 
        vcardId: vcard.id,
        metaPixelId: 'meta_pixel_123'
      }));

      axios.delete.mockResolvedValueOnce({ data: {} });

      const response = await request(app).delete(`/pixels/${pixel.id}`);

      expectSuccessResponse(response);
      expect(axios.delete).toHaveBeenCalled();
    });

    test('should return 404 for non-existent pixel', async () => {
      const response = await request(app).delete('/pixels/999');

      expectNotFoundError(response, 'Pixel not found');
    });
  });

  describe('GET /pixels/user - getUserPixels', () => {
    test('should return user pixels successfully', async () => {
      const user = await models.User.create(await createTestUser());
      const vcard = await models.VCard.create(createTestVCard({ userId: user.id }));
      await models.Pixel.create(createTestPixel({ vcardId: vcard.id }));

      const response = await request(app).get(`/pixels/user?userId=${user.id}`);

      expectSuccessResponse(response);
      expect(response.body.pixels).toHaveLength(1);
      expect(response.body.pixels[0].vcard.id).toBe(vcard.id);
    });

    test('should return empty array for user with no pixels', async () => {
      const user = await models.User.create(await createTestUser());

      const response = await request(app).get(`/pixels/user?userId=${user.id}`);

      expectSuccessResponse(response);
      expect(response.body.pixels).toHaveLength(0);
    });
  });

  describe('GET /pixels/:pixelId - getPixelById', () => {
    test('should return pixel by id successfully', async () => {
      const user = await models.User.create(await createTestUser());
      const vcard = await models.VCard.create(createTestVCard({ userId: user.id }));
      const pixel = await models.Pixel.create(createTestPixel({ vcardId: vcard.id }));

      const response = await request(app).get(`/pixels/${pixel.id}`);

      expectSuccessResponse(response);
      expect(response.body.data.id).toBe(pixel.id);
      expect(response.body.data.vcard.id).toBe(vcard.id);
      expect(response.body.data.trackingUrl).toContain(`/pixels/${pixel.id}/track`);
    });

    test('should return 404 for non-existent pixel', async () => {
      const response = await request(app).get('/pixels/999');

      expectNotFoundError(response, 'Pixel not found');
    });
  });

  describe('POST /pixels/:pixelId/track - trackEvent', () => {
    test('should track event successfully', async () => {
      const user = await models.User.create(await createTestUser());
      const vcard = await models.VCard.create(createTestVCard({ userId: user.id }));
      const pixel = await models.Pixel.create(createTestPixel({ vcardId: vcard.id }));

      const eventData = {
        eventType: 'view',
        metadata: { page: 'home' }
      };

      axios.get.mockResolvedValueOnce({
        data: {
          status: 'success',
          countryCode: 'US',
          regionName: 'California',
          city: 'San Francisco',
          query: '127.0.0.1'
        }
      });

      const response = await request(app)
        .post(`/pixels/${pixel.id}/track`)
        .send(eventData)
        .set('User-Agent', 'Test Browser')
        .set('Accept-Language', 'en-US,en;q=0.9');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('image/gif');

      const events = await models.EventTracking.findAll({ where: { pixelId: pixel.id } });
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('view');
    });

    test('should handle inactive pixel gracefully', async () => {
      const user = await models.User.create(await createTestUser());
      const vcard = await models.VCard.create(createTestVCard({ userId: user.id }));
      const pixel = await models.Pixel.create(createTestPixel({ 
        vcardId: vcard.id,
        is_active: false
      }));

      const response = await request(app)
        .post(`/pixels/${pixel.id}/track`)
        .send({ eventType: 'view' });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('image/gif');
    });

    test('should track event with Meta pixel integration', async () => {
      const user = await models.User.create(await createTestUser());
      const vcard = await models.VCard.create(createTestVCard({ userId: user.id }));
      const pixel = await models.Pixel.create(createTestPixel({ 
        vcardId: vcard.id,
        metaPixelId: 'meta_pixel_123'
      }));

      axios.get.mockResolvedValueOnce({ data: { ip: '127.0.0.1' } });
      axios.post.mockResolvedValueOnce({ data: {} });

      const response = await request(app)
        .post(`/pixels/${pixel.id}/track`)
        .send({ 
          eventType: 'view',
          value: 10.99,
          currency: 'USD'
        });

      expect(response.status).toBe(200);
      expect(axios.post).toHaveBeenCalled();
    });
  });

  describe('GET /pixels/vcard/:vcardId - getPixelsByVCard', () => {
    test('should return pixels for vCard successfully', async () => {
      const user = await models.User.create(await createTestUser());
      const vcard = await models.VCard.create(createTestVCard({ userId: user.id }));
      await models.Pixel.create(createTestPixel({ vcardId: vcard.id }));

      const response = await request(app).get(`/pixels/vcard/${vcard.id}`);

      expectSuccessResponse(response);
      expect(response.body.pixels).toHaveLength(1);
      expect(response.body.pixels[0].trackingUrl).toContain('/track');
    });

    test('should return 404 for non-existent vCard', async () => {
      const response = await request(app).get('/pixels/vcard/999');

      expectNotFoundError(response, 'VCard not found');
    });
  });

  describe('GET /pixels - getPixels', () => {
    test('should return all pixels successfully', async () => {
      const user = await models.User.create(await createTestUser());
      const vcard = await models.VCard.create(createTestVCard({ userId: user.id }));
      await models.Pixel.create(createTestPixel({ vcardId: vcard.id }));

      const response = await request(app).get('/pixels');

      expectSuccessResponse(response);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].vcard.user.id).toBe(user.id);
    });

    test('should return empty array when no pixels exist', async () => {
      const response = await request(app).get('/pixels');

      expectSuccessResponse(response);
      expect(response.body.data).toHaveLength(0);
    });
  });

  describe('PUT /pixels/:id/toggle-blocked - toggleBlocked', () => {
    test('should toggle pixel blocked status successfully', async () => {
      const user = await models.User.create(await createTestUser());
      const vcard = await models.VCard.create(createTestVCard({ userId: user.id }));
      const pixel = await models.Pixel.create(createTestPixel({ 
        vcardId: vcard.id,
        is_blocked: false
      }));

      const response = await request(app).put(`/pixels/${pixel.id}/toggle-blocked`);

      expectSuccessResponse(response);
      expect(response.body.data.is_blocked).toBe(true);
      expect(response.body.data.message).toContain('blocked');
    });

    test('should toggle blocked pixel to unblocked', async () => {
      const user = await models.User.create(await createTestUser());
      const vcard = await models.VCard.create(createTestVCard({ userId: user.id }));
      const pixel = await models.Pixel.create(createTestPixel({ 
        vcardId: vcard.id,
        is_blocked: true
      }));

      const response = await request(app).put(`/pixels/${pixel.id}/toggle-blocked`);

      expectSuccessResponse(response);
      expect(response.body.data.is_blocked).toBe(false);
      expect(response.body.data.message).toContain('unblocked');
    });

    test('should return 404 for non-existent pixel', async () => {
      const response = await request(app).put('/pixels/999/toggle-blocked');

      expectNotFoundError(response, 'Pixel not found');
    });
  });
});
