const  Plan  = require('../models/Plan');
const { Op } = require('sequelize');

const VALID_PLAN_TYPES = ['Free', 'Basic', 'Pro'];
const validatePlanType = (req, res, next) => {
  if (req.body.name && !VALID_PLAN_TYPES.includes(req.body.name)) {
    return res.status(400).json({ 
      error: 'Type de plan invalide',
      validTypes: VALID_PLAN_TYPES 
    });
  }
  next();
};

const searchPlans = async (req, res) => {
  try {
    const { q, activeOnly } = req.query;
    
    const whereClause = {};
    
    if (q) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${q}%` } },
        { description: { [Op.like]: `%${q}%` } }
      ];
    }
    
    if (activeOnly === 'true') {
      whereClause.is_active = true;
    }

    const plans = await Plan.findAll({
      where: whereClause,
      order: [['price', 'ASC']],
      limit: 20
    });

    res.json({
      success: true,
      data: plans,
      count: plans.length
    });
  } catch (error) {
    console.error('Erreur recherche plans:', error);
    res.status(500).json({ 
      success: false,
      error: 'Erreur serveur',
      details: error.message 
    });
  }
};

const createPlan = async (req, res) => {
  try {
    const { features = [], ...planData } = req.body;
    
    if (!planData.name || planData.price === undefined || planData.duration_days === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Name, price and duration_days are required fields'
      });
    }

    if (!VALID_PLAN_TYPES.includes(planData.name)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid plan type',
        validTypes: VALID_PLAN_TYPES
      });
    }

    let featuresArray = [];
    if (features) {
      featuresArray = Array.isArray(features) 
        ? features 
        : typeof features === 'string' 
          ? features.split(',').map(f => f.trim()).filter(f => f)
          : [];
    }

    const price = Number(planData.price);
    const durationDays = Number(planData.duration_days);

    if (isNaN(price) || isNaN(durationDays)) {
      return res.status(400).json({
        success: false,
        error: 'Price and duration_days must be valid numbers'
      });
    }

    const plan = await Plan.create({
      name: planData.name.trim(),
      description: planData.description ? planData.description.trim() : null,
      price: price,
      duration_days: durationDays,
      features: featuresArray,
      is_active: planData.is_active !== undefined ? Boolean(planData.is_active) : true,
      is_default: planData.is_default !== undefined ? Boolean(planData.is_default) : false
    });

    res.status(201).json({
      success: true,
      data: plan
    });
  } catch (error) {
    console.error('Erreur création plan:', error);
    
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors.map(err => ({
          field: err.path,
          message: err.message
        }))
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
};

const getFreePlan = async (req, res) => {
  try {
    const freePlans = await Plan.findAll({
      where: {
        price: 0.00,
      },
      limit: 1 
    });

    if (!freePlans || freePlans.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Aucun plan gratuit trouvé'
      });
    }

    res.json({
      success: true,
      data: freePlans[0] 
    });
  } catch (error) {
    console.error('Erreur récupération plan gratuit:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      details: error.message
    });
  }
};

const getAllPlans = async (req, res) => {
  try {
    const { active_only, is_default } = req.query;
    
    const where = {};
    if (active_only === 'true') where.is_active = true;
    if (is_default === 'true') where.is_default = true;

    const plans = await Plan.findAll({
      where,
      order: [['price', 'ASC']]
    });

    res.json({
      success: true,
      data: plans,
      count: plans.length
    });
  } catch (error) {
    console.error('Erreur récupération plans:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
};

const getPlanById = async (req, res) => {
  try {
    const plan = await Plan.findByPk(req.params.id);
    
    if (!plan) {
      return res.status(404).json({
        success: false,
        error: 'Plan non trouvé'
      });
    }

    res.json({
      success: true,
      data: plan
    });
  } catch (error) {
    console.error('Erreur récupération plan:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
}; 

const updatePlan = async (req, res) => {
  try {
    const plan = await Plan.findByPk(req.params.id);
    if (!plan) {
      return res.status(404).json({
        success: false,
        error: 'Plan non trouvé'
      });
    }

    const { features, ...updateData } = req.body;

    if (features) {
      updateData.features = Array.isArray(features) 
        ? features 
        : features.split(',').map(f => f.trim());
    }

    await plan.update(updateData);

    res.json({
      success: true,
      data: plan
    });
  } catch (error) {
    console.error('Erreur mise à jour plan:', error);
    res.status(400).json({
      success: false,
      error: 'Données invalides',
      details: error.message
    });
  }
};

const deletePlan = async (req, res) => {
  try {
    const plan = await Plan.findByPk(req.params.id);
    if (!plan) {
      return res.status(404).json({
        success: false,
        error: 'Plan non trouvé'
      });
    }

    await plan.destroy();
    res.status(204).end();
  } catch (error) {
    console.error('Erreur suppression plan:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
};

const togglePlanStatus = async (req, res) => {
  try {
    const plan = await Plan.findByPk(req.params.id);
    if (!plan) {
      return res.status(404).json({
        success: false,
        error: 'Plan non trouvé'
      });
    }

    const updatedPlan = await plan.update({ 
      is_active: !plan.is_active 
    });

    res.json({
      success: true,
      data: {
        id: updatedPlan.id,
        name: updatedPlan.name,
        is_active: updatedPlan.is_active
      }
    });
  } catch (error) {
    console.error('Erreur changement statut plan:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
};

module.exports = {
  validatePlanType,
  searchPlans,
  createPlan,
  getAllPlans,
  getPlanById,
  updatePlan,
  deletePlan,
  togglePlanStatus,
  getFreePlan,
  VALID_PLAN_TYPES
};