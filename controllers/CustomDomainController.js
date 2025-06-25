const db = require('../models');
const { CustomDomain } = db;
const dns = require('dns').promises;
const { Op } = require('sequelize');

const isValidUrl = (url) => {
  try {
    return Boolean(new URL(url));
  } catch {
    return false;
  }
};

const verifyCNAME = async (domain, target) => {
  try {
    const records = await dns.resolveCname(domain);
    return records.includes(target);
  } catch (error) {
    if (error.code === 'ENODATA' || error.code === 'ENOTFOUND') {
      return false;
    }
    console.error(`DNS CNAME verification error for ${domain}:`, error);
    throw error;
  }
};

const verifyTXTRecord = async (domain, code) => {
  try {
    const records = await dns.resolveTxt(`_vcard-verify.${domain}`);
    const flattened = records.flat();
    return flattened.includes(code);
  } catch (error) {
    if (error.code === 'ENODATA' || error.code === 'ENOTFOUND') {
      return false;
    }
    console.error(`DNS TXT verification error for ${domain}:`, error);
    throw error;
  }
};

const createCustomDomain = async (req, res) => {
  try {
    const { domain, custom_index_url, custom_not_found_url, vcardId } = req.body;
    const userId = req.user.id;

    if (!domain) {
      return res.status(400).json({ 
        success: false,
        message: "Domain is required" 
      });
    }

    if (custom_index_url && !isValidUrl(custom_index_url)) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid custom index URL" 
      });
    }

    if (custom_not_found_url && !isValidUrl(custom_not_found_url)) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid custom 404 URL" 
      });
    }

    const existingDomain = await CustomDomain.findOne({
      where: { domain }
    });

    if (existingDomain) {
      return res.status(409).json({ 
        success: false,
        message: "Domain already exists" 
      });
    }

    let vcardIdValue = null;
    if (vcardId) {
      const vcard = await db.VCard.findOne({
        where: { id: vcardId, userId }
      });

      if (!vcard) {
        return res.status(404).json({
          success: false,
          message: "vCard not found or unauthorized"
        });
      }
      vcardIdValue = vcardId;
    }

    const newDomain = await CustomDomain.create({
      domain,
      userId,
      custom_index_url,
      custom_not_found_url,
      vcardId: vcardIdValue, 
      status: 'pending'
    });

    res.status(201).json({
      success: true,
      message: "Domain created successfully",
      domain: newDomain,
      dns_instructions: {
        cname: {
          name: '@',
          value: newDomain.cname_target
        },
        txt: {
          name: `_vcard-verify.${domain}`,
          value: newDomain.verification_code
        }
      }
    });

  } catch (error) {
    console.error("Error creating custom domain:", error);
    res.status(500).json({ 
      success: false,
      message: "Internal server error" 
    });
  }
};

const updateCustomDomain = async (req, res) => {
  try {
    const { id } = req.params;
    const { domain, custom_index_url, custom_not_found_url, vcardId } = req.body;
    const userId = req.user.id;

    const domainRecord = await CustomDomain.findOne({
      where: { id, userId }
    });

    if (!domainRecord) {
      return res.status(404).json({ 
        success: false,
        message: "Domain not found" 
      });
    }

    if (custom_index_url && !isValidUrl(custom_index_url)) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid custom index URL" 
      });
    }

    if (custom_not_found_url && !isValidUrl(custom_not_found_url)) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid custom 404 URL" 
      });
    }

    if (vcardId) {
      const vcard = await db.VCard.findOne({
        where: { id: vcardId, userId }
      });

      if (!vcard) {
        return res.status(404).json({
          success: false,
          message: "vCard not found or unauthorized"
        });
      }
    }

    const updates = {
      domain: domain || domainRecord.domain,
      custom_index_url: custom_index_url || domainRecord.custom_index_url,
      custom_not_found_url: custom_not_found_url || domainRecord.custom_not_found_url,
      vcardId: vcardId || domainRecord.vcardId,
      status: domain && domain !== domainRecord.domain ? 'pending' : domainRecord.status
    };

    await domainRecord.update(updates);

    res.json({
      success: true,
      message: "Domain updated successfully",
      domain: domainRecord
    });

  } catch (error) {
    console.error("Error updating custom domain:", error);
    res.status(500).json({ 
      success: false,
      message: "Internal server error" 
    });
  }
};

const deleteCustomDomain = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const domain = await CustomDomain.findOne({
      where: { id, userId }
    });

    if (!domain) {
      return res.status(404).json({ 
        success: false,
        message: "Domain not found" 
      });
    }

    await domain.destroy();
    res.status(200).json({
      success: true,
      message: "Domain deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting custom domain:", error);
    res.status(500).json({ 
      success: false,
      message: "Internal server error" 
    });
  }
};

const getUserDomains = async (req, res) => {
  try {
    const userId = req.user.id;

    const domains = await CustomDomain.findAll({
      where: { userId },
      include: [
        {
          model: db.Users,
          attributes: ['id', 'email'],
          as: 'Users'
        },
        {
          model: db.VCard,
          attributes: ['id', 'name', 'url'],
          as: 'vcard',
          required: false
        }
      ]
    });

    res.json({
      success: true,
      domains
    });

  } catch (error) {
    console.error("Error fetching user domains:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

const verifyDomain = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const domain = await CustomDomain.findOne({
      where: { id, userId }
    });

    if (!domain) {
      return res.status(404).json({ 
        success: false,
        message: "Domain not found" 
      });
    }

    const verificationTimeout = 10000; 
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("DNS verification timeout")), verificationTimeout)
    );

    const verificationPromise = Promise.all([
      verifyCNAME(domain.domain, domain.cname_target),
      verifyTXTRecord(domain.domain, domain.verification_code)
    ]);

    const [cnameVerified, txtVerified] = await Promise.race([
      verificationPromise,
      timeoutPromise
    ]);

    if (!cnameVerified || !txtVerified) {
      await domain.update({ status: 'failed' });
      return res.status(400).json({
        success: false,
        message: "DNS not configured properly",
        details: {
          cname: cnameVerified,
          txt: txtVerified,
          instructions: {
            cname: {
              name: '@',
              value: domain.cname_target
            },
            txt: {
              name: `_vcard-verify.${domain.domain}`,
              value: domain.verification_code
            }
          }
        }
      });
    }

    await domain.update({ status: 'active' });
    
    res.json({
      success: true,
      message: "Domain verified and activated",
      domain
    });

  } catch (error) {
    console.error("Error verifying domain:", error);
    
    if (error.message === "DNS verification timeout") {
      return res.status(408).json({ 
        success: false,
        message: "DNS verification timed out",
        error: "DNS servers responded too slowly"
      });
    }

    res.status(500).json({ 
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

const handleDomainRequest = async (req, res) => {
  try {
    const hostname = req.hostname;
    const path = req.path;
    const isRoot = path === '/';

    // Ajouter un timeout pour la recherche du domaine
    const domain = await CustomDomain.findOne({
      where: { domain: hostname, status: 'active' },
      include: [{
        model: db.VCard,
        as: 'vcard'
      }]
    });

    if (!domain) {
      return res.status(404).send(`
        <html>
          <head><title>404 - Page Not Found</title></head>
          <body>
            <h1>404 - Page Not Found</h1>
            <p>The requested domain ${hostname} is not configured</p>
          </body>
        </html>
      `);
    }

    if (isRoot && domain.custom_index_url) {
      return res.redirect(301, domain.custom_index_url);
    }

    if (domain.vcard) {
      return res.redirect(301, `/vcards/${domain.vcard.url}`);
    }

    if (domain.custom_not_found_url) {
      return res.redirect(302, domain.custom_not_found_url);
    }

    res.status(404).send(`
      <html>
        <head><title>404 - Page Not Found</title></head>
        <body>
          <h1>404 - Page Not Found</h1>
          <p>The requested page could not be found</p>
        </body>
      </html>
    `);

  } catch (error) {
    console.error("Error handling domain request:", error);
    res.status(500).send(`
      <html>
        <head><title>Server Error</title></head>
        <body>
          <h1>500 - Server Error</h1>
          <p>An unexpected error occurred</p>
        </body>
      </html>
    `);
  }
};

const handleNotFound = async (req, res) => {
  try {
    const hostname = req.hostname;

    const domain = await CustomDomain.findOne({
      where: { domain: hostname, status: 'active' }
    });

    if (domain && domain.custom_not_found_url) {
      return res.redirect(302, domain.custom_not_found_url);
    }

    res.status(404).send(`
      <html>
        <head><title>404 - Page Not Found</title></head>
        <body>
          <h1>404 - Page Not Found</h1>
          <p>The requested page could not be found</p>
        </body>
      </html>
    `);

  } catch (error) {
    console.error("Error handling 404:", error);
    res.status(500).send("Internal server error");
  }
};

const linkToVCard = async (req, res) => {
  try {
    const { domainId, vcardId } = req.body;
    const userId = req.user.id;

    const domain = await CustomDomain.findOne({
      where: { id: domainId, userId }
    });

    if (!domain) {
      return res.status(404).json({ 
        success: false,
        message: "Domain not found or unauthorized" 
      });
    }

    if (domain.status !== 'active') {
      return res.status(400).json({ 
        success: false,
        message: "Domain must be active to link to vCard" 
      });
    }

    const vcard = await db.VCard.findOne({
      where: { id: vcardId, userId }
    });

    if (!vcard) {
      return res.status(404).json({ 
        success: false,
        message: "vCard not found or unauthorized" 
      });
    }

    const existingDomain = await CustomDomain.findOne({
      where: { vcardId, id: { [Op.ne]: domainId } }
    });

    if (existingDomain) {
      return res.status(400).json({
        success: false,
        message: "This vCard is already linked to another domain"
      });
    }

    await domain.update({ vcardId });

    res.json({
      success: true,
      message: "Domain successfully linked to vCard",
      domain,
      vcard
    });

  } catch (error) {
    console.error("Error linking domain to vCard:", error);
    res.status(500).json({ 
      success: false,
      message: "Internal server error" 
    });
  }
};

const unlinkFromVCard = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const domain = await CustomDomain.findOne({
      where: { id, userId }
    });

    if (!domain) {
      return res.status(404).json({ 
        success: false,
        message: "Domain not found" 
      });
    }

    if (domain.vcardId) {
      await domain.update({ vcardId: null });
    }

    res.json({
      success: true,
      message: "Domain unlinked from vCard",
      domain
    });

  } catch (error) {
    console.error("Error unlinking domain from vCard:", error);
    res.status(500).json({ 
      success: false,
      message: "Internal server error" 
    });
  }
};

const getDomainById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const domain = await CustomDomain.findOne({
      where: { id, userId },
      include: [
        {
          model: db.VCard,
          attributes: ['id', 'name', 'url'],
          as: 'vcard'
        },
        {
          model: db.Users,
          attributes: ['id', 'email'],
          as: 'Users'
        }
      ]
    });

    if (!domain) {
      return res.status(404).json({ 
        success: false,
        message: "Domain not found or unauthorized" 
      });
    }

    res.json({
      success: true,
      data: domain 
    });

  } catch (error) {
    console.error("Error getting domain by ID:", error);
    res.status(500).json({ 
      success: false,
      message: "Internal server error" 
    });
  }
};

module.exports = {
  createCustomDomain,
  updateCustomDomain,
  deleteCustomDomain,
  getUserDomains,
  getDomainById,
  verifyDomain,
  handleDomainRequest,
  handleNotFound,
  linkToVCard,
  unlinkFromVCard
};