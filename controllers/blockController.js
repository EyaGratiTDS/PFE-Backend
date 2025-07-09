const Block = require("../models/Block");
const VCard = require("../models/Vcard");
const { Op } = require("sequelize");
const { getActiveBlockLimit } = require('../middleware/planLimiter');

const VALID_BLOCK_TYPES = new Set([
  'Link', 'Email', 'Address', 'Phone', 'Facebook',
  'Twitter', 'Instagram', 'Youtube', 'Whatsapp',
  'Tiktok', 'Telegram', 'Spotify', 'Pinterest',
  'Linkedin', 'Snapchat', 'Twitch', 'Discord',
  'Messenger', 'Reddit', 'GitHub'
]);

const SEARCH_CONFIG = {
  limit: 10,
  order: [['createdAt', 'DESC']]
};

const ERROR_RESPONSES = {
  invalidType: { error: 'Invalid block type' },
  missingParams: { error: 'The vcardId and q (query) parameters are required' },
  missingVcardId: { error: 'vcardId is required' },
  notFound: { error: 'Block not found' },
  serverError: (details) => ({ error: 'Server error', ...(details && { details }) })
};

const sendErrorResponse = (res, status, message, error = null) => {
  if (error) console.error(message, error);
  res.status(status).json({ ...message, ...(error && process.env.NODE_ENV === 'development' && { details: error.message }) });
};

const validateQueryParams = (params) => (req, res, next) => {
  if (params.every(p => req.query[p])) return next();
  sendErrorResponse(res, 400, ERROR_RESPONSES.missingParams);
};

const validateBlockType = (req, res, next) => {
  if (req.body.type_block && !VALID_BLOCK_TYPES.has(req.body.type_block)) {
    return sendErrorResponse(res, 400, ERROR_RESPONSES.invalidType);
  }
  next();
};

const searchBlocks = async (req, res) => {
  try {
    const { vcardId, q } = req.query;
    const searchCondition = { 
      [Op.or]: ['name', 'type_block', 'description'].map(field => ({
        [field]: { [Op.iLike]: `%${q}%` }
      }))
    };

    const blocks = await Block.findAll({
      where: { vcardId, ...searchCondition },
      ...SEARCH_CONFIG
    });

    res.json(blocks);
  } catch (error) {
    sendErrorResponse(res, 500, ERROR_RESPONSES.serverError(), error);
  }
};

const createBlock = async (req, res) => {
  try {
    const { status = true, ...blockData } = req.body;
    const newBlock = await Block.create({ ...blockData, status });
    
    res.status(201).json(newBlock);
  } catch (error) {
    sendErrorResponse(res, 500, ERROR_RESPONSES.serverError(), error);
  }
};

const getBlocksByVcardId = async (req, res) => {
  try {
    const { vcardId } = req.query;
    if (!vcardId) return sendErrorResponse(res, 400, ERROR_RESPONSES.missingVcardId);

    const [blocks, maxActive] = await Promise.all([
      Block.findAll({ where: { vcardId }, order: [['createdAt', 'ASC']] }),
      getActiveBlockLimit(req.user.id, vcardId)
    ]);

    const result = blocks.map((block, index) => ({
      ...block.get({ plain: true }),
      isDisabled: index >= maxActive
    }));

    res.json(result);
  } catch (error) {
    sendErrorResponse(res, 500, ERROR_RESPONSES.serverError(), error);
  }
};

const getBlocksByVcardIdAdmin = async (req, res) => {
  try {
    const { vcardId } = req.query;
    if (!vcardId) return sendErrorResponse(res, 400, ERROR_RESPONSES.missingVcardId);

    const [blocks, maxActive] = await Promise.all([
      Block.findAll({ where: { vcardId, status: true }, order: [['createdAt', 'ASC']] }),
      getActiveBlockLimit(req.user.id, vcardId)
    ]);

    const result = blocks.map((block, index) => ({
      ...block.get({ plain: true }),
      isDisabled: index >= maxActive
    }));

    res.json(result);
  } catch (error) {
    sendErrorResponse(res, 500, ERROR_RESPONSES.serverError(), error);
  }
};

const getBlockById = async (req, res) => {
  try {
    const block = await Block.findByPk(req.params.id, {
      include: { model: VCard, as: 'VCard', attributes: ['id', 'name'] }
    });

    block ? res.json(block) : sendErrorResponse(res, 404, ERROR_RESPONSES.notFound);
  } catch (error) {
    sendErrorResponse(res, 500, ERROR_RESPONSES.serverError(), error);
  }
};

const updateBlock = async (req, res) => {
  try {
    const block = await Block.findByPk(req.params.id);
    if (!block) return sendErrorResponse(res, 404, ERROR_RESPONSES.notFound);

    const { vcardId, ...updateData } = req.body;
    await block.update(updateData);
    
    res.json(block);
  } catch (error) {
    sendErrorResponse(res, 500, ERROR_RESPONSES.serverError(), error);
  }
};

const deleteBlock = async (req, res) => {
  try {
    const block = await Block.findByPk(req.params.id);
    if (!block) return sendErrorResponse(res, 404, ERROR_RESPONSES.notFound);

    await block.destroy();
    res.status(204).end();
  } catch (error) {
    sendErrorResponse(res, 500, ERROR_RESPONSES.serverError(), error);
  }
};

const toggleBlock = async (req, res) => {
  try {
    const blockId = req.params.id;
    const block = await Block.findByPk(blockId);
    
    if (!block) {
      return sendErrorResponse(res, 404, ERROR_RESPONSES.notFound);
    }

    const newStatus = !block.status;
    
    const updatedBlock = await block.update({ status: newStatus });
    
    res.json({
      message: `Block status toggled successfully`,
      blockId: updatedBlock.id,
      newStatus: updatedBlock.status
    });
    
  } catch (error) {
    sendErrorResponse(res, 500, ERROR_RESPONSES.serverError(), error);
  }
};

module.exports = {
  validateBlockType,
  searchBlocks: [validateQueryParams(['vcardId', 'q']), searchBlocks],
  createBlock,
  getBlocksByVcardId: [validateQueryParams(['vcardId']), getBlocksByVcardId],
  getBlockById,
  updateBlock,
  deleteBlock,
  toggleBlock,
  getBlocksByVcardIdAdmin,
  VALID_BLOCK_TYPES: Array.from(VALID_BLOCK_TYPES)
};