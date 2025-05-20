const Block = require("../models/Block");
const VCard = require("../models/Vcard"); 
const { Op } = require("sequelize"); 
const { getActiveBlockLimit } = require('../middleware/planLimiter');

const VALID_BLOCK_TYPES = [
  'Link', 'Email', 'Address', 'Phone', 'Facebook',
  'Twitter', 'Instagram', 'Youtube', 'Whatsapp',
  'Tiktok', 'Telegram', 'Spotify', 'Pinterest',
  'Linkedin', 'Snapchat', 'Twitch', 'Discord',
  'Messenger', 'Reddit', 'GitHub'
];

const validateBlockType = (req, res, next) => {
  if (req.body.type_block && !VALID_BLOCK_TYPES.includes(req.body.type_block)) {
    return res.status(400).json({ error: 'Invalid block type' });
  }
  next();
};

const searchBlocks = async (req, res) => {
  try {
    const { vcardId, q } = req.query;
    
    if (!vcardId || !q) {
      return res.status(400).json({ 
        error: 'The vcardId and q (query) parameters are required' 
      });
    }

    const blocks = await Block.findAll({
      where: {
        vcardId,
        [Op.or]: [
          { name: { [Op.like]: `%${q}%` } },
          { type_block: { [Op.like]: `%${q}%` } },
          { description: { [Op.like]: `%${q}%` } }
        ]
      },
      order: [['createdAt', 'DESC']],
      limit: 10 
    });

    res.json(blocks);
  } catch (error) {
    console.error('Error searching for blocks:', error);
    res.status(500).json({ 
      error: 'Server error',
      details: error.message 
    });
  }
};

const createBlock = async (req, res) => {
  try {
    const { type_block, name, description, status, vcardId } = req.body;
    
    const newBlock = await Block.create({
      type_block,
      name,
      description,
      status: status !== undefined ? status : true, 
      vcardId
    });

    res.status(201).json(newBlock);
  } catch (error) {
    console.error('Error creating block:', error);
    res.status(500).json({ 
      error: 'Server error',
      details: error.message 
    });
  }
};

const getBlocksByVcardId = async (req, res) => {
  try {
    const { vcardId } = req.query;
    const userId = req.user.id;

    if (!vcardId) {
      return res.status(400).json({ error: 'vcardId is required' });
    }

    const blocks = await Block.findAll({ 
      where: { vcardId },
      order: [['createdAt', 'ASC']] 
    });

    const maxActive = await getActiveBlockLimit(userId, vcardId);

    const result = blocks.map((block, index) => ({
      ...block.get({ plain: true }),
      isDisabled: index >= maxActive
    }));

    res.json(result);
  } catch (error) {
    console.error('Error fetching blocks:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const getBlockById = async (req, res) => {
  try {
    const block = await Block.findByPk(req.params.id, {
      include: [{ model: VCard, as: 'vcard' }], 
    });

    if (!block) {
      return res.status(404).json({ error: 'Block not found' });
    }

    res.json(block);
  } catch (error) {
    console.error('Error retrieving block:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const updateBlock = async (req, res) => {
  try {
    const block = await Block.findByPk(req.params.id);
    if (!block) {
      return res.status(404).json({ error: 'Block not found' });
    }

    const { vcardId, ...updateData } = req.body;

    await block.update(updateData);

    res.json(block);
  } catch (error) {
    console.error('Error updating block:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const deleteBlock = async (req, res) => {
  try {
    const block = await Block.findByPk(req.params.id);
    if (!block) {
      return res.status(404).json({ error: 'Block not found' });
    }

    await block.destroy();
    res.status(204).end(); 
  } catch (error) {
    console.error('Error deleting block:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  validateBlockType,
  searchBlocks,
  createBlock,
  getBlocksByVcardId,
  getBlockById,
  updateBlock,
  deleteBlock,
  VALID_BLOCK_TYPES
};