const Stripe = require('stripe');
const Subscription = require('../models/Subscription');
const Payment = require('../models/Payment');
const User = require('../models/User');
const Plan = require('../models/Plan');
const { Op } = require('sequelize');
const NotificationController = require('./NotificationController');

if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
  throw new Error('Stripe environment variables are missing');
}

const stripe = Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-08-16',
  typescript: true,
});

const createResponse = (success, data = {}, error = null) => ({
  success,
  ...(success ? { data } : { error }),
});

const paymentController = {

  async createPaymentIntent(req, res) {
    const sequelize = Subscription.sequelize;
    let transaction;
    try {
      const { planId, userId, months, paymentMethod } = req.body;

      if (!planId || !userId || !paymentMethod) {
        return res.status(400).json({
          success: false,
          error: 'Champs requis manquants'
        });
      }

      const [user, plan] = await Promise.all([
        User.findByPk(userId),
        Plan.findByPk(planId)
      ]);

      if (!user || !plan) {
        return res.status(404).json({
          success: false,
          error: 'Utilisateur ou plan introuvable'
        });
      }

      transaction = await sequelize.transaction();

      const existingSubscription = await Subscription.findOne({
        where: {
          user_id: userId,
          status: { [Op.in]: ['active'] }
        },
        order: [['end_date', 'DESC']],
        transaction
      });

      let startDate = new Date();
      let endDate = new Date();
      let amount = 0;

      if (existingSubscription) {
        const currentEndDate = new Date(existingSubscription.end_date);
        startDate = currentEndDate > new Date() ? currentEndDate : new Date();
        endDate = new Date(startDate);
        const payment = await Payment.findOne({
          where: { SubscriptionId: existingSubscription.id },
          order: [['created_at', 'DESC']],
          transaction
        });

        if (payment) {
          amount = payment.amount;
        }
      }

      endDate.setDate(endDate.getDate() + (plan.duration_days * months));

      const [subscription] = await Subscription.upsert({
        id: existingSubscription?.id || null,
        user_id: userId,
        plan_id: planId,
        start_date: startDate,
        end_date: endDate,
        status: 'pending',
        payment_method: paymentMethod
      }, {
        transaction,
        returning: true
      });

      const totalAmount = (Number(plan.price) * Number(months)) + Number(amount);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(totalAmount * 100),
        currency: 'USD',
        metadata: {
          userId: userId.toString(),
          subscriptionId: subscription.id.toString(),
          months: months.toString(),
          isRenewal: !!existingSubscription
        }
      });

      const payment = await Payment.create({
        transaction_id: paymentIntent.id,
        amount: totalAmount,
        currency: 'USD',
        payment_method: paymentMethod,
        status: 'pending',
        userId: userId,
        SubscriptionId: subscription.id
      }, { transaction });

      await transaction.commit();

      res.status(200).json({
        success: true,
        data: {
          paymentId: payment.id,
          clientSecret: paymentIntent.client_secret,
          totalAmount,
          endDate: endDate.toISOString()
        }
      });

    } catch (error) {
      if (transaction) await transaction.rollback();
      console.error('Erreur:', error);
      res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur serveur'
      });
    }
},

  async confirmPayment(req, res) {
    const sequelize = Subscription.sequelize;
    let transaction;

    try {
      const { paymentId } = req.body;
      if (!paymentId) {
        return res.status(400).json(createResponse(false, {}, 'Missing paymentId'));
      }

      const existingPayment = await Payment.findByPk(paymentId);
      if (!existingPayment) {
        return res.status(404).json(createResponse(false, {}, 'Payment not found'));
      }

      if (existingPayment.status === 'completed') {
        return res.status(200).json(createResponse(true, {
          message: 'Payment already confirmed',
          paymentId: existingPayment.id
        }));
      }

      transaction = await sequelize.transaction();

      const payment = await Payment.findByPk(paymentId, {
        transaction,
        lock: true
      });

      if (!payment) {
        await transaction.rollback();
        return res.status(404).json(createResponse(false, {}, 'Payment not found'));
      }

      if (payment.status === 'pending') {
        payment.status = 'completed';
        await payment.save({ transaction });
      }

      const subscription = await Subscription.findByPk(payment.SubscriptionId, {
        transaction,
        lock: true
      });

      if (!subscription) {
        await transaction.rollback();
        return res.status(404).json(createResponse(false, {}, 'Subscription not found'));
      }

      if (subscription.status === 'pending') {
        subscription.status = 'active';
        await subscription.save({ transaction });
      }

      const plan = await Plan.findByPk(subscription.plan_id, { transaction });
      if (!plan) {
        await transaction.rollback();
        return res.status(404).json(createResponse(false, {}, 'Plan not found'));
      }

      await transaction.commit();

      const stripePayment = await stripe.paymentIntents.retrieve(payment.transaction_id);
      const isRenewal = stripePayment.metadata.isRenewal === 'true';

      if (subscription.status === 'active') {
        try {
          if (isRenewal) {
            await NotificationController.sendUpdateSubscriptionNotification(
              payment.userId,
              plan.name,
              subscription.start_date,
              subscription.end_date,
              payment.amount
            );
          } else {
            await NotificationController.sendNewSubscriptionNotification(
              payment.userId,
              plan.name,
              subscription.start_date,
              subscription.end_date
            );
          }
        } catch (notificationError) {
          console.error('Error sending notification:', notificationError);
        }
      }

      return res.status(200).json(createResponse(true, {
        paymentId: payment.id,
        subscriptionId: subscription.id,
        status: payment.status
      }));
    } catch (error) {
      if (transaction) await transaction.rollback();
      console.error('Error confirming payment:', error);
      return res.status(500).json(createResponse(false, {}, 'Internal server error'));
    }
  },

  async handlePaymentWebhook(req, res) {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    try {
      const event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);

      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handleSuccessfulPayment(event.data.object);
          break;
        case 'payment_intent.payment_failed':
          await this.handleFailedPayment(event.data.object);
          break;
        default:
          console.log(`Unhandled event type ${event.type}`);
      }

      return res.json(createResponse(true));
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return res.status(400).json(createResponse(false, {}, `Webhook Error: ${err.message}`));
    }
  },



  async handleSuccessfulPayment(paymentIntent) {
    const sequelize = Payment.sequelize;
    let transaction;

    try {
      const existingPayment = await Payment.findOne({
        where: { transaction_id: paymentIntent.id }
      });

      if (!existingPayment) {
        console.log(`Payment with transaction ID ${paymentIntent.id} not found`);
        return;
      }

      if (existingPayment.status === 'completed') {
        console.log(`Payment with transaction ID ${paymentIntent.id} already completed`);
        return;
      }

      transaction = await sequelize.transaction();

      const payment = await Payment.findOne({
        where: { transaction_id: paymentIntent.id },
        lock: true,
        transaction
      });

      if (!payment || payment.status !== 'pending') {
        await transaction.rollback();
        return;
      }

      payment.status = 'completed';
      payment.gateway_response = JSON.stringify(paymentIntent);
      await payment.save({ transaction });

      const subscription = await Subscription.findByPk(payment.SubscriptionId, {
        transaction,
        lock: true
      });

      if (!subscription) {
        await transaction.rollback();
        console.error(`Subscription not found for payment ${payment.id}`);
        return;
      }

      if (subscription.status === 'pending') {
        subscription.status = 'active';
        await subscription.save({ transaction });
      }

      await transaction.commit();

      if (subscription.status === 'active') {
        try {
          const plan = await Plan.findByPk(subscription.plan_id);
          if (plan) {
            const isRenewal = paymentIntent.metadata.isRenewal === 'true';

            if (isRenewal) {
              await NotificationController.sendUpdateSubscriptionNotification(
                payment.userId,
                plan.name,
                subscription.start_date,
                subscription.end_date,
                payment.amount
              );
            } else {
              await NotificationController.sendNewSubscriptionNotification(
                payment.userId,
                plan.name,
                subscription.start_date,
                subscription.end_date
              );
            }
          }
        } catch (notificationError) {
          console.error('Error sending notification:', notificationError);
        }
      }
    } catch (error) {
      if (transaction) await transaction.rollback();
      console.error('Error handling successful payment:', error);
      throw error;
    }
  },

  async handleFailedPayment(paymentIntent) {
    const sequelize = Payment.sequelize;
    let transaction;

    try {
      const existingPayment = await Payment.findOne({
        where: { transaction_id: paymentIntent.id }
      });

      if (!existingPayment) {
        console.log(`Payment with transaction ID ${paymentIntent.id} not found`);
        return;
      }

      if (existingPayment.status === 'failed') {
        console.log(`Payment with transaction ID ${paymentIntent.id} already marked as failed`);
        return;
      }

      transaction = await sequelize.transaction();

      const payment = await Payment.findOne({
        where: { transaction_id: paymentIntent.id },
        lock: true,
        transaction
      });

      if (!payment) {
        await transaction.rollback();
        return;
      }

      payment.status = 'failed';
      payment.gateway_response = JSON.stringify(paymentIntent);
      await payment.save({ transaction });

      const subscription = await Subscription.findByPk(payment.SubscriptionId, {
        transaction,
        lock: true
      });

      if (subscription && subscription.status === 'pending') {
        subscription.status = 'failed';
        await subscription.save({ transaction });
      }

      await transaction.commit();
    } catch (error) {
      if (transaction) await transaction.rollback();
      console.error('Error handling failed payment:', error);
      throw error;
    }
  }
};

module.exports = paymentController;