
const Quote = require('../models/Quote');

exports.addQuote = async (req, res) => {
  try {
    const { name, email, service, description } = req.body;
    const quote = await Quote.create({ name, email, service, description });
    res.status(201).json(quote);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getAllQuotes = async (req, res) => {
  try {
    const quotes = await Quote.findAll();
    res.status(200).json(quotes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteQuote = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Quote.destroy({ where: { id } });
    if (deleted) {
      res.status(200).json({ message: 'Quote deleted successfully' });
    } else {
      res.status(404).json({ error: 'Quote not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
