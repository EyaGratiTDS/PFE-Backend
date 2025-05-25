const { Pixel, EventTracking } = require('../models');
const geoip = require('geoip-lite');
const { getClientIp } = require('request-ip');

const trackEvent = async (req, res) => {
  const { pixelId } = req.params;
  const { eventType = 'view', blockId, duration, metadata } = req.query;

  try {
    const pixel = await Pixel.findOne({
      where: { id: pixelId, is_active: true },
      include: [VCard]
    });

    if (!pixel) return sendPixelResponse(res);

    const ip = getClientIp(req);
    const geo = geoip.lookup(ip) || {};
    const userAgent = req.headers['user-agent'];

    await EventTracking.create({
      pixelId,
      eventType,
      blockId,
      duration,
      metadata: metadata ? JSON.parse(metadata) : null,
      userAgent,
      ipAddress: ip,
      country: geo.country,
      region: geo.region,
      city: geo.city,
      vcardId: pixel.VCard.id
    });

    sendPixelResponse(res);

  } catch (error) {
    console.error("Tracking error:", error);
    sendPixelResponse(res);
  }
};

const sendPixelResponse = (res) => {
  const pixel = Buffer.from('R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==', 'base64');
  res.writeHead(200, {
    'Content-Type': 'image/gif',
    'Content-Length': pixel.length,
    'Cache-Control': 'no-store, max-age=0'
  });
  res.end(pixel);
};

module.exports = {
  trackEvent
};