const multer = require("multer");
const path = require("path");
const fs = require('fs');


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

const deleteFileIfExists = (filePath) => {
  if (!filePath) return;

  const normalizedPath = filePath.startsWith('/uploads/')
    ? filePath.substring(9)
    : filePath;

  const absolutePath = path.join(__dirname, '../uploads', normalizedPath);

  if (fs.existsSync(absolutePath)) {
    try {
      fs.unlinkSync(absolutePath);
      console.log(`Fichier supprimé: ${absolutePath}`);
    } catch (error) {
      console.error(`Erreur lors de la suppression du fichier ${absolutePath}:`, error);
    }
  }
};


module.exports = {
  upload,
  deleteFileIfExists
};