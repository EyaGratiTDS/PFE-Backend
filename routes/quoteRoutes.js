
const express = require('express');
const router = express.Router();
const QuoteController = require('../controllers/QuoteController');

router.post('/', QuoteController.addQuote);
router.get('/', QuoteController.getAllQuotes);
router.delete('/:id', QuoteController.deleteQuote);

module.exports = router;
