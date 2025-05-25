const { VCard, Pixel, EventTracking } = require('../models');
const { generateUniqueUrl } = require('../services/generateUrl');
const geoip = require('geoip-lite');
const { getClientIp } = require('request-ip');

const createPixel = async (req, res) => {
  try {
    const { vcardId, name, userId } = req.body;
    const vcard = await VCard.findOne({
      where: { id: vcardId, userId }
    });

    if (!vcard) {
      return res.status(404).json({ 
        success: false,
        message: "VCard not found or unauthorized" 
      });
    }

    const existingPixel = await Pixel.findOne({ where: { vcardId } });
    if (existingPixel) {
      return res.status(409).json({
        success: false,
        message: "A pixel already exists for this vCard"
      });
    }

    const pixel = await Pixel.create({
      name: name || `Pixel - ${vcard.name}`,
      vcardId,
      is_active: true
    });

    res.status(201).json({
      success: true,
      pixel: {
        id: pixel.id,
        name: pixel.name,
        trackingUrl: `${process.env.API_URL}/track/${pixel.id}`,
        vcardId: pixel.vcardId,
        is_active: pixel.is_active
      }
    });

  } catch (error) {
    console.error("Pixel creation error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

const updatePixel = async (req, res) => {
  try {
    const { pixelId } = req.params;
    const { name, vcardId, is_active } = req.body;

    const pixel = await Pixel.findOne({
      include: [{
        model: VCard,
        as: "VCard",
      }],
      where: { id: pixelId }
    });

    if (!pixel) {
      return res.status(404).json({
        success: false,
        message: "Pixel not found"
      });
    }

    const updates = {
      name: name || pixel.name,
      vcardId: vcardId || pixel.vcardId,
      is_active: typeof is_active === 'boolean' ? is_active : pixel.is_active
    };


    await pixel.update(updates);

    res.json({
      success: true,
      pixel: {
        id: pixel.id,
        name: pixel.name,
        is_active: pixel.is_active
      }
    });

  } catch (error) {
    console.error("Pixel update error:", error);
    res.status(500).json({
      success: false,
      message: "Server error "
    });
  }
};

const deletePixel = async (req, res) => {
  try {
    const { pixelId } = req.params;

    const pixel = await Pixel.findOne({
      include: [{
        model: VCard,
        as: "VCard",
      }],
      where: { id: pixelId }
    });

    if (!pixel) {
      return res.status(404).json({
        success: false,
        message: "Pixel not found"
      });
    }

    await pixel.destroy();

    res.json({
      success: true,
      message: "Pixel deleted"
    });

  } catch (error) {
    console.error("Pixel deletion error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

const getUserPixels = async (req, res) => {
  try {
    const { userId } = req.query;
    const pixels = await Pixel.findAll({
      include: [{
        model: VCard,
        as : "VCard",
        where: { userId },
        attributes: ['id', 'name']
      }]
    });

    res.json({
      success: true,
      pixels: pixels.map(p => ({
        id: p.id,
        name: p.name,
        vcard: p.VCard,
        is_active: p.is_active,
        created_at: p.created_at
      }))
    });

  } catch (error) {
    console.error("Pixel recovery error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

const getPixelById = async (req, res) => {
  try {
    const { pixelId } = req.params;

    const pixel = await Pixel.findOne({
      where: { id: pixelId },
      include: [{
        model: VCard,
        as: "VCard",
      }]
    });

    if (!pixel) {
      return res.status(404).json({
        success: false,
        message: "Pixel not found or unauthorized"
      });
    }

    res.json({
      success: true,
      pixel: {
        id: pixel.id,
        name: pixel.name,
        is_active: pixel.is_active,
        trackingUrl: `${process.env.API_URL}/track/${pixel.id}`,
        vcard: {
          id: pixel.VCard.id,
          name: pixel.VCard.name
        },
        created_at: pixel.created_at,
        updated_at: pixel.updated_at
      }
    });

  } catch (error) {
    console.error("Get pixel error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

module.exports = {
  createPixel,
  updatePixel,
  deletePixel,
  getUserPixels,
  getPixelById
};