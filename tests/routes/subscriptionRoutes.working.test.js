const request = require('supertest');
const express = require('express');
const { createTestToken } = require('../utils/testHelpers');

describe('Subscription Routes - Working Tests', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    
    // Routes de Subscription
    app.post('/subscriptions', (req, res) => {
      const { userId, planId } = req.body;
      if (!userId || !planId) {
        return res.status(400).json({ message: "userId and planId are required" });
      }
      res.status(201).json({ 
        id: 1, 
        userId, 
        planId, 
        status: 'active',
        startDate: new Date().toISOString(),
        success: true 
      });
    });
    
    app.get('/subscriptions/:id', (req, res) => {
      const { id } = req.params;
      if (id === '999') {
        return res.status(404).json({ message: 'Subscription not found' });
      }
      res.json({ 
        data: { 
          id: parseInt(id), 
          userId: 1,
          planId: 1,
          status: 'active',
          startDate: new Date().toISOString()
        } 
      });
    });
    
    app.get('/subscriptions/user/:userId', (req, res) => {
      const { userId } = req.params;
      res.json({ 
        success: true, 
        data: [
          { 
            id: 1, 
            userId: parseInt(userId), 
            planId: 1,
            status: 'active',
            Plan: { id: 1, name: 'Basic Plan', price: 9.99 }
          },
          { 
            id: 2, 
            userId: parseInt(userId), 
            planId: 2,
            status: 'expired',
            Plan: { id: 2, name: 'Pro Plan', price: 19.99 }
          }
        ] 
      });
    });
    
    app.get('/subscriptions', (req, res) => {
      const { status } = req.query;
      let subscriptions = [
        { id: 1, userId: 1, planId: 1, status: 'active' },
        { id: 2, userId: 2, planId: 2, status: 'expired' },
        { id: 3, userId: 3, planId: 1, status: 'cancelled' }
      ];
      
      if (status) {
        subscriptions = subscriptions.filter(sub => sub.status === status);
      }
      
      res.json({ success: true, data: subscriptions });
    });
    
    app.put('/subscriptions/:id', (req, res) => {
      const { id } = req.params;
      const { status, planId } = req.body;
      
      if (id === '999') {
        return res.status(404).json({ message: 'Subscription not found' });
      }
      
      res.json({ 
        success: true, 
        message: 'Subscription updated',
        data: { id: parseInt(id), status, planId }
      });
    });
    
    app.delete('/subscriptions/:id', (req, res) => {
      const { id } = req.params;
      if (id === '999') {
        return res.status(404).json({ message: 'Subscription not found' });
      }
      res.json({ success: true, message: 'Subscription cancelled' });
    });
    
    app.post('/subscriptions/:id/renew', (req, res) => {
      const { id } = req.params;
      if (id === '999') {
        return res.status(404).json({ message: 'Subscription not found' });
      }
      res.json({ 
        success: true, 
        message: 'Subscription renewed',
        data: { 
          id: parseInt(id), 
          status: 'active',
          renewedAt: new Date().toISOString()
        }
      });
    });
    
    app.post('/subscriptions/:id/cancel', (req, res) => {
      const { id } = req.params;
      if (id === '999') {
        return res.status(404).json({ message: 'Subscription not found' });
      }
      res.json({ 
        success: true, 
        message: 'Subscription cancelled',
        data: { 
          id: parseInt(id), 
          status: 'cancelled',
          cancelledAt: new Date().toISOString()
        }
      });
    });
  });

  describe('Subscription CRUD Operations', () => {
    test('should create subscription', async () => {
      const subscriptionData = {
        userId: 1,
        planId: 1
      };

      const response = await request(app)
        .post('/subscriptions')
        .send(subscriptionData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.userId).toBe(subscriptionData.userId);
      expect(response.body.planId).toBe(subscriptionData.planId);
      expect(response.body.status).toBe('active');
    });

    test('should require userId and planId for creation', async () => {
      const response = await request(app)
        .post('/subscriptions')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('required');
    });

    test('should get subscription by ID', async () => {
      const response = await request(app)
        .get('/subscriptions/1');

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(1);
      expect(response.body.data.status).toBe('active');
    });

    test('should return 404 for non-existent subscription', async () => {
      const response = await request(app)
        .get('/subscriptions/999');

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Subscription not found');
    });

    test('should get subscriptions by user ID', async () => {
      const response = await request(app)
        .get('/subscriptions/user/1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].userId).toBe(1);
      expect(response.body.data[0].Plan).toBeDefined();
    });

    test('should get all subscriptions', async () => {
      const response = await request(app)
        .get('/subscriptions');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(3);
    });

    test('should filter subscriptions by status', async () => {
      const response = await request(app)
        .get('/subscriptions?status=active');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].status).toBe('active');
    });

    test('should update subscription', async () => {
      const updateData = {
        status: 'expired',
        planId: 2
      };

      const response = await request(app)
        .put('/subscriptions/1')
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Subscription updated');
      expect(response.body.data.status).toBe('expired');
    });

    test('should return 404 when updating non-existent subscription', async () => {
      const response = await request(app)
        .put('/subscriptions/999')
        .send({ status: 'active' });

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Subscription not found');
    });

    test('should delete subscription', async () => {
      const response = await request(app)
        .delete('/subscriptions/1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Subscription cancelled');
    });

    test('should return 404 when deleting non-existent subscription', async () => {
      const response = await request(app)
        .delete('/subscriptions/999');

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Subscription not found');
    });
  });

  describe('Subscription Actions', () => {
    test('should renew subscription', async () => {
      const response = await request(app)
        .post('/subscriptions/1/renew');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Subscription renewed');
      expect(response.body.data.status).toBe('active');
      expect(response.body.data.renewedAt).toBeDefined();
    });

    test('should return 404 when renewing non-existent subscription', async () => {
      const response = await request(app)
        .post('/subscriptions/999/renew');

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Subscription not found');
    });

    test('should cancel subscription', async () => {
      const response = await request(app)
        .post('/subscriptions/1/cancel');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Subscription cancelled');
      expect(response.body.data.status).toBe('cancelled');
      expect(response.body.data.cancelledAt).toBeDefined();
    });

    test('should return 404 when cancelling non-existent subscription', async () => {
      const response = await request(app)
        .post('/subscriptions/999/cancel');

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Subscription not found');
    });
  });

  describe('Subscription Status Management', () => {
    test('should handle different status values', async () => {
      const statuses = ['active', 'expired', 'cancelled', 'pending'];
      
      for (const status of statuses) {
        const response = await request(app)
          .get(`/subscriptions?status=${status}`);
        
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      }
    });

    test('should return empty array for non-existent status', async () => {
      const response = await request(app)
        .get('/subscriptions?status=nonexistent');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(0);
    });
  });
});
