/**
 * 🖼️ SERVICE D'IMAGES PROFESSIONNELLES
 * 
 * Ce service fournit des URLs d'images fiables et stables
 * avec plusieurs sources de fallback garanties
 */

// 🎨 Collection d'images Unsplash fiables et testées
const PROFESSIONAL_IMAGES = {
  developer: {
    logos: [
      'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=400&h=400&fit=crop',
      'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=400&h=400&fit=crop',
      'https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=400&h=400&fit=crop'
    ],
    backgrounds: [
      'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1920&h=1080&fit=crop',
      'https://images.unsplash.com/photo-1484417894907-623942c8ee29?w=1920&h=1080&fit=crop'
    ]
  },
  designer: {
    logos: [
      'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=400&h=400&fit=crop',
      'https://images.unsplash.com/photo-1572044162444-ad60f128bdea?w=400&h=400&fit=crop',
      'https://images.unsplash.com/photo-1626785774573-4b799315345d?w=400&h=400&fit=crop'
    ],
    backgrounds: [
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1920&h=1080&fit=crop',
      'https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=1920&h=1080&fit=crop'
    ]
  },
  marketing: {
    logos: [
      'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=400&fit=crop',
      'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&h=400&fit=crop'
    ],
    backgrounds: [
      'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1920&h=1080&fit=crop',
      'https://images.unsplash.com/photo-1556761175-4b46a572b786?w=1920&h=1080&fit=crop'
    ]
  },
  business: {
    logos: [
      'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=400&h=400&fit=crop',
      'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=400&h=400&fit=crop'
    ],
    backgrounds: [
      'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1920&h=1080&fit=crop',
      'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=1920&h=1080&fit=crop'
    ]
  },
  creative: {
    logos: [
      'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=400&h=400&fit=crop',
      'https://images.unsplash.com/photo-1452860606245-08befc0ff44b?w=400&h=400&fit=crop'
    ],
    backgrounds: [
      'https://images.unsplash.com/photo-1506012787146-f92b2d7d6d96?w=1920&h=1080&fit=crop',
      'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=1920&h=1080&fit=crop'
    ]
  }
};

/**
 * 🎯 Obtenir une image de logo fiable
 */
function getReliableLogoImage(job) {
  const jobLower = job.toLowerCase();
  
  // Mapper le job à une catégorie
  let category = 'business';
  if (jobLower.includes('develop') || jobLower.includes('program')) category = 'developer';
  else if (jobLower.includes('design')) category = 'designer';
  else if (jobLower.includes('market')) category = 'marketing';
  else if (jobLower.includes('artist') || jobLower.includes('creative')) category = 'creative';
  
  // Récupérer une image aléatoire de la catégorie
  const logos = PROFESSIONAL_IMAGES[category]?.logos || PROFESSIONAL_IMAGES.business.logos;
  const randomIndex = Math.floor(Math.random() * logos.length);
  
  return logos[randomIndex];
}

/**
 * 🎨 Obtenir une image de background fiable
 */
function getReliableBackgroundImage(job) {
  const jobLower = job.toLowerCase();
  
  // Mapper le job à une catégorie
  let category = 'business';
  if (jobLower.includes('develop') || jobLower.includes('program')) category = 'developer';
  else if (jobLower.includes('design')) category = 'designer';
  else if (jobLower.includes('market')) category = 'marketing';
  else if (jobLower.includes('artist') || jobLower.includes('creative')) category = 'creative';
  
  // Récupérer une image aléatoire de la catégorie
  const backgrounds = PROFESSIONAL_IMAGES[category]?.backgrounds || PROFESSIONAL_IMAGES.business.backgrounds;
  const randomIndex = Math.floor(Math.random() * backgrounds.length);
  
  return backgrounds[randomIndex];
}

/**
 * 🎯 Générer un favicon avec UI Avatars (toujours fiable)
 */
function generateFavicon(job, colorPalette) {
  const initials = job.substring(0, 2).toUpperCase();
  const color = colorPalette.primary.replace('#', '');
  
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&size=128&background=${color}&color=fff&bold=true&font-size=0.5&rounded=true`;
}

/**
 * 🎨 Générer un logo avec UI Avatars en fallback
 */
function generateLogoFallback(job, colorPalette) {
  const initials = job.substring(0, 2).toUpperCase();
  const color = colorPalette.primary.replace('#', '');
  
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&size=400&background=${color}&color=fff&bold=true&font-size=0.4`;
}

/**
 * 🚀 Service principal - obtenir toutes les images nécessaires
 */
function getAllImages(job, colorPalette, useRealImages = true) {
  let logo, favicon, backgroundImage;
  
  if (useRealImages) {
    // Essayer d'utiliser des vraies images professionnelles
    logo = getReliableLogoImage(job);
    favicon = generateFavicon(job, colorPalette);
    backgroundImage = getReliableBackgroundImage(job);
  } else {
    // Utiliser les fallbacks avec avatars
    logo = generateLogoFallback(job, colorPalette);
    favicon = generateFavicon(job, colorPalette);
    backgroundImage = null; // Utiliser gradient à la place
  }
  
  return {
    logo,
    favicon,
    backgroundImage
  };
}

module.exports = {
  getReliableLogoImage,
  getReliableBackgroundImage,
  generateFavicon,
  generateLogoFallback,
  getAllImages,
  PROFESSIONAL_IMAGES
};