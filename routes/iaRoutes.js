const express = require("express");
const router = express.Router();
const { generateVCard, notifyVCardAction, testVCardGeneration } = require("../controllers/iaController");

/**
 * 🚀 ROUTES IA POUR GÉNÉRATION DE VCARD AVEC GESTION DES ACTIONS
 */

// 🎯 Route 1: Génération et sauvegarde systématique de VCard
// POST /api/ia/generate-vcard
router.post("/generate-vcard", generateVCard);

// 🎯 Route 2: Gestion des actions utilisateur (accept/regenerate)  
// POST /api/ia/vcard-action
router.post("/vcard-action", notifyVCardAction);


module.exports = router;