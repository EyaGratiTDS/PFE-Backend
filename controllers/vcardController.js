const VCard = require("../models/Vcard");
const User = require("../models/User");
const { upload, deleteFileIfExists } = require('../services/uploadService');
const path = require("path");
const fs = require('fs');
const { generateUniqueUrl } = require("../services/generateUrl");
const { Op } = require('sequelize');
const Plan = require('../models/Plan');
const Subscription = require('../models/Subscription');


const createVCard = async (req, res) => {
  try {
    const { name, description, userId } = req.body;

    if (!name || !userId) {
      return res.status(400).json({
        message: "The 'name' and 'userId' fields are mandatory"
      });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const uniqueUrl = generateUniqueUrl(name);

    const vcard = await VCard.create({
      name,
      description: description || null,
      url: uniqueUrl,
      userId,
      is_active: false,
      is_share: false,
      is_downloaded: false
    });

    res.status(201).json({
      message: "VCard created successfully",
      vcard: {
        id: vcard.id,
        name: vcard.name,
        description: vcard.description,
        url: vcard.url,
        userId: vcard.userId,
        createdAt: vcard.createdAt
      }
    });

  } catch (error) {
    console.error("Error creating vCard:", error);

    if (error.name === "SequelizeValidationError") {
      const errors = error.errors.map(err => ({
        field: err.path,
        message: err.message
      }));
      return res.status(400).json({
        message: "Validation error",
        errors
      });
    }

    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        message: "A vCard with this name or URL already exists",
        field: error.errors[0].path
      });
    }

    res.status(500).json({
      message: "Internal server error while creating vCard",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const getVCardsByUserId = async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const vcards = await VCard.findAll({
      where: {
        userId: userId,
        status: false
      }
    });

    res.json(vcards);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getVCardById = async (req, res) => {
  try {
    const vcard = await VCard.findByPk(req.params.id);
    if (vcard) {
      res.json(vcard);
    } else {
      res.status(404).json({ message: "VCard not found" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteLogo = async (req, res) => {
  const { logoPath } = req.body;

  if (!logoPath) {
    return res.status(400).json({ message: 'Missing logo path.' });
  }

  const absolutePath = path.join(__dirname, '../uploads', logoPath.replace('/uploads/', ''));

  if (fs.existsSync(absolutePath)) {
    try {
      fs.unlinkSync(absolutePath);
      res.status(200).json({ message: 'Logo successfully removed.' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Failed to delete logo.' });
    }
  } else {
    res.status(404).json({ message: 'Logo not found.' });
  }
};

const updateVCard = async (req, res) => {
  const { id } = req.params;
  const {
    name,
    description,
    favicon,
    remove_branding,
    search_engine_visibility,
    is_share,
    is_downloaded,
    is_active,
    background_type,
    background_value,
    font_family,
    font_size,
    projectId
  } = req.body;

  const logoFile = req.files['logoFile'] ? req.files['logoFile'][0] : null;
  const backgroundFile = req.files['backgroundFile'] ? req.files['backgroundFile'][0] : null;
  const faviconFile = req.files['faviconFile'] ? req.files['faviconFile'][0] : null;

  try {
    const currentVCard = await VCard.findByPk(id);
    if (!currentVCard) {
      return res.status(404).json({ message: "VCard not found" });
    }

    const vcardData = {
      name,
      description,
      remove_branding,
      search_engine_visibility,
      is_share,
      is_downloaded,
      is_active,
      background_type,
      font_family,
      font_size,
      projectId: projectId || null
    };

    if (backgroundFile) {
      vcardData.background_value = `/uploads/${backgroundFile.filename}`;

      if (currentVCard.background_type === 'custom-image' && currentVCard.background_value) {
        deleteFileIfExists(currentVCard.background_value);
      }
    } else {
      vcardData.background_value = background_value || currentVCard.background_value;
    }

    if (logoFile) {
      vcardData.logo = `/uploads/${logoFile.filename}`;

      if (currentVCard.logo) {
        deleteFileIfExists(currentVCard.logo);
      }
    } else {
      vcardData.logo = currentVCard.logo;
    }

    if (faviconFile) {
      vcardData.favicon = `/uploads/${faviconFile.filename}`;

      if (currentVCard.favicon && currentVCard.favicon.startsWith('/uploads/')) {
        deleteFileIfExists(currentVCard.favicon);
      }
    } else if (favicon) {
      vcardData.favicon = favicon;

      if (currentVCard.favicon && currentVCard.favicon.startsWith('/uploads/')) {
        deleteFileIfExists(currentVCard.favicon);
      }
    } else {
      vcardData.favicon = currentVCard.favicon;
    }

    const [updated] = await VCard.update(vcardData, {
      where: { id },
    });

    if (updated) {
      const updatedVCard = await VCard.findByPk(id);
      res.json(updatedVCard);
    } else {
      res.status(404).json({ message: "VCard not found" });
    }
  } catch (error) {
    console.error("Error updating vCard:", error);
    res.status(400).json({ message: error.message });
  }
};

const deleteVCard = async (req, res) => {
  try {
    const vcard = await VCard.findByPk(req.params.id);
    if (!vcard) {
      return res.status(404).json({ message: "VCard not found" });
    }

    if (vcard.logo) deleteFileIfExists(vcard.logo);
    if (vcard.favicon && vcard.favicon.startsWith('/uploads/')) deleteFileIfExists(vcard.favicon);
    if (vcard.background_type === 'image' && vcard.background_value) deleteFileIfExists(vcard.background_value);

    await VCard.destroy({
      where: { id: req.params.id },
    });

    res.json({ message: "VCard and associated files deleted successfully" });
  } catch (error) {
    console.error("Error deleting vCard::", error);
    res.status(500).json({ message: error.message });
  }
};

const getVCardByUrl = async (req, res) => {
  try {
    const vcard = await VCard.findOne({
      where: { url: req.params.url },
      include: [{
        model: User,
        as: 'Users',
        include: [{
          model: Subscription,
          as: 'Subscription',
          where: { status: 'active' },
          include: [{
            model: Plan,
            as: 'Plan'
          }],
          required: false
        }]
      }]
    });

    if (!vcard) return res.status(404).end();
    if (!vcard.is_active) {
      return res.status(403).json({
        message: "VCard disabled",
        isNotActive: true
      });
    }
    const vcardIndex = await VCard.count({
      where: {
        userId: vcard.userId,
        createdAt: { [Op.lte]: vcard.createdAt }
      }
    });

    let plan = vcard.Users?.Subscription?.[0]?.Plan;
    if (!plan) {
      plan = await Plan.findOne({ where: { name: 'Free' } });
    }
    if (!plan) return res.status(404).end();

    let maxAllowed = 1;
    let maxBlocksAllowed = 10;
    const planName = plan.name.trim().toLowerCase();

    if (planName === 'pro') {
      maxAllowed = Infinity;
      maxBlocksAllowed = Infinity;
    } else if (planName === 'basic') {
      maxAllowed = 5;
      maxBlocksAllowed = 50;
    } else {
      const vcardFeature = plan.features.find(f =>
        f.toLowerCase().includes('vcard') && !f.toLowerCase().includes('unlimited')
      );
      const match = vcardFeature?.match(/\d+/);
      maxAllowed = match ? parseInt(match[0]) : 1;
      const blocksFeature = plan.features.find(f => 
        f.toLowerCase().includes('vcard blocks')
      );
      const blocksMatch = blocksFeature?.match(/\d+/);
      maxBlocksAllowed = blocksMatch ? parseInt(blocksMatch[0]) : 10;
    }
    const isAllowed = maxAllowed === Infinity || vcardIndex <= maxAllowed;
    if (!isAllowed) {
      return res.status(404).end();
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const response = {
      ...vcard.get({ plain: true }),
      logo: vcard.logo ? `${baseUrl}${vcard.logo}` : null,
      favicon: vcard.favicon ? `${baseUrl}${vcard.favicon}` : null,
      background_value: vcard.background_type === 'custom-image'
        ? `${baseUrl}${vcard.background_value}`
        : vcard.background_value,
      maxBlocksAllowed: maxBlocksAllowed
    };
    res.json(response);

  } catch (error) {
    console.error("Error retrieving vCard:", error);
    res.status(500).end();
  }
};

const getAllVCardsWithUsers = async (req, res) => {
  try {
    const vcards = await VCard.findAll({
      include: [
        {
          model: User,
          as: 'Users',
          attributes: ['id', 'name', 'avatar','email', 'role'] 
        }
      ],
      order: [['createdAt', 'DESC']]
    });
    res.json({
      success: true,
      data: vcards,
    });
  } catch (error) {
    console.error("Error fetching VCards with users:", error);
    res.status(500).json({
      message: "Internal server error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
const toggleVCardStatus = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ message: "VCard ID is required" });
    }

    const vcard = await VCard.findByPk(id);
    if (!vcard) {
      return res.status(404).json({ message: "VCard not found" });
    }

    const newStatus = !vcard.status;
    
    await VCard.update(
      { status: newStatus },
      { where: { id } }
    );

    res.json({
      message: `VCard ${newStatus ? 'activated' : 'deactivated'} successfully`,
      vcardId: id,
      newStatus
    });

  } catch (error) {
    console.error("Error toggling VCard status:", error);
    res.status(500).json({
      message: "Internal server error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  createVCard,
  getVCardsByUserId,
  getVCardById,
  updateVCard,
  deleteVCard,
  deleteLogo,
  getVCardByUrl,
  getAllVCardsWithUsers,
  toggleVCardStatus
};