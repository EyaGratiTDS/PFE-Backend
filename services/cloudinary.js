const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");

// Configuration Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Définir le storage multer avec Cloudinary
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "nexcard_uploads", // Nom du dossier dans Cloudinary
    allowed_formats: ["jpg", "png", "jpeg", "webp"],
    transformation: [{ quality: "auto", fetch_format: "auto" }], // Optimisation auto
  },
});

// Middleware upload
const upload = multer({ storage });

// Fonction pour supprimer un fichier Cloudinary
const deleteFileIfExists = async (publicId) => {
  if (!publicId) return;

  try {
    const result = await cloudinary.uploader.destroy(publicId);
    console.log(`Cloudinary delete result:`, result);
  } catch (error) {
    console.error(`Erreur lors de la suppression sur Cloudinary:`, error);
  }
};

module.exports = {
  upload,
  deleteFileIfExists,
  cloudinary,
};
