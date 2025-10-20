const axios = require("axios");
const randomImageService = require("./randomImageService");

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const API_KEY = process.env.OPENROUTER_API_KEY;

// 🌐 CLOUDINARY CONFIGURATION
const CLOUDINARY_CONFIG = {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'demo',
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  upload_preset: process.env.CLOUDINARY_UPLOAD_PRESET || 'unsigned_preset'
};

// API key verification
if (!API_KEY) {
  console.warn("⚠️ OPENROUTER_API_KEY missing in .env - Fallback mode activated");
}

// 🎨 OPTIMIZED CONSTANTS
const COLOR_PALETTES = [
  { primary: "#2563EB", secondary: "#F8FAFC", accent: "#1E40AF", theme: "tech" },
  { primary: "#059669", secondary: "#F0FDF4", accent: "#047857", theme: "growth" },
  { primary: "#7C3AED", secondary: "#FAF5FF", accent: "#6D28D9", theme: "creative" },
  { primary: "#DC2626", secondary: "#FEF2F2", accent: "#B91C1C", theme: "dynamic" },
  { primary: "#EA580C", secondary: "#FFF7ED", accent: "#C2410C", theme: "energetic" },
  { primary: "#0891B2", secondary: "#F0F9FF", accent: "#0E7490", theme: "professional" }
];

const PROFESSIONAL_FONTS = [
  "Inter", "Roboto", "Open Sans", "Poppins", "Montserrat", "Lato", "Nunito", "Work Sans"
];

const VALID_BLOCK_TYPES = [
  'Link', 'Email', 'Address', 'Phone', 'Facebook',
  'Twitter', 'Instagram', 'Youtube', 'Whatsapp',
  'Tiktok', 'Telegram', 'Spotify', 'Pinterest',
  'Linkedin', 'Snapchat', 'Twitch', 'Discord',
  'Messenger', 'Reddit', 'GitHub'
];

const PROFESSIONAL_BLOCKS = {
  "developer": ["Email", "GitHub", "Linkedin", "Phone", "Discord"],
  "designer": ["Email", "Instagram", "Linkedin", "Phone", "Pinterest"],
  "consultant": ["Email", "Linkedin", "Phone", "Address", "Link"],
  "doctor": ["Email", "Phone", "Address", "Linkedin", "Whatsapp"],
  "teacher": ["Email", "Phone", "Linkedin", "Address", "Youtube"],
  "artist": ["Instagram", "Email", "Pinterest", "Youtube", "Link"],
  "manager": ["Email", "Linkedin", "Phone", "Address", "Whatsapp"],
  "freelance": ["Email", "Linkedin", "Instagram", "Phone", "Link"],
  "default": ["Email", "Phone", "Linkedin", "Link", "Address"]
};

const MAX_LENGTHS = {
  PROJECT_NAME: 100,
  PROJECT_DESCRIPTION: 300,
  VCARD_NAME: 80,
  VCARD_DESCRIPTION: 200,
  BLOCK_NAME: 50,
  BLOCK_DESCRIPTION: 150
};

// 🌈 CONSTANTS FOR INNOVATIVE BACKGROUNDS
const BACKGROUND_THEMES = {
  'tech': ['abstract technology', 'digital patterns', 'circuit boards', 'neon networks', 'futuristic grids'],
  'creative': ['artistic gradients', 'watercolor textures', 'geometric patterns', 'vibrant colors', 'creative spaces'],
  'professional': ['modern minimalism', 'corporate elegance', 'business textures', 'professional patterns', 'clean design'],
  'medical': ['medical patterns', 'healthcare blue', 'clean white', 'medical equipment', 'health symbols'],
  'education': ['academic patterns', 'educational symbols', 'learning environments', 'books textures', 'knowledge graphics']
};

const GRADIENT_STYLES = [
  'linear-gradient(45deg, {color1}, {color2})',
  'linear-gradient(135deg, {color1}, {color2})',
  'linear-gradient(90deg, {color1}, {color2})',
  'radial-gradient(circle, {color1}, {color2})',
  'linear-gradient(180deg, {color1} 0%, {color2} 100%)'
];

// 💾 OPTIMIZED CACHE
const CACHE = {
  svg: new Map(),
  backgrounds: new Map(),
  colors: new Map()
};
const MAX_CACHE_SIZE = 100;

/**
 * 🚀 UNIFIED INTELLIGENT CACHE
 */
function getCached(cacheType, key, generateFn) {
  const cache = CACHE[cacheType];
  if (!cache) return generateFn();
  
  if (cache.has(key)) {
    return cache.get(key);
  }
  
  const result = generateFn();
  
  if (cache.size >= MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
  
  cache.set(key, result);
  return result;
}

/**
 * 🔧 OPTIMIZED UTILITIES
 */
function validateDescriptionLength(text, maxLength = MAX_LENGTHS.BLOCK_DESCRIPTION) {
  if (!text || typeof text !== 'string') return '';
  return text.length > maxLength ? text.substring(0, maxLength - 3) + '...' : text;
}

function selectColorByJob(job) {
  const jobLower = job.toLowerCase();
  const colorMap = {
    tech: ["developer", "engineer", "programmer", "analyst"],
    creative: ["designer", "artist", "photographer", "creative"],
    professional: ["manager", "consultant", "director", "executive"],
    medical: ["doctor", "nurse", "therapist", "medical"],
    education: ["teacher", "professor", "instructor", "educator"]
  };
  
  for (const [theme, keywords] of Object.entries(colorMap)) {
    if (keywords.some(keyword => jobLower.includes(keyword))) {
      return COLOR_PALETTES.find(p => p.theme === theme) || COLOR_PALETTES[0];
    }
  }
  
  return COLOR_PALETTES[Math.floor(Math.random() * COLOR_PALETTES.length)];
}

function getBlockDisplayName(type) {
  const displayNames = {
    'Email': '📧 Professional Contact',
    'Phone': '📱 Direct Line', 
    'Address': '📍 Office Location',
    'Link': '🌐 Portfolio Showcase',
    'GitHub': '💻 GitHub Projects',
    'Linkedin': '💼 LinkedIn Network',
    'Instagram': '📸 Instagram Gallery',
    'Twitter': '🐦 Twitter Updates',
    'Facebook': '👥 Facebook Community',
    'Youtube': '🎥 YouTube Channel',
    'Whatsapp': '💬 WhatsApp Chat',
    'Discord': '🎮 Discord Server',
    'Telegram': '📱 Telegram Channel',
    'Pinterest': '📌 Pinterest Boards',
    'Spotify': '🎵 Spotify Playlists',
    'Snapchat': '👻 Snapchat Stories',
    'Tiktok': '🎬 TikTok Content',
    'Twitch': '🎮 Twitch Streams',
    'Messenger': '💬 Messenger Chat',
    'Reddit': '🔥 Reddit Community'
  };
  
  return displayNames[type] || `🔗 ${type}`;
}

/**
 * � GÉNÉRATION BACKGROUND INNOVANTE VIA IA
 */
async function generateInnovativeBackground(job, skills, colorPalette, userName = null) {
  const cacheKey = `${job}_${Array.isArray(skills) ? skills.join('') : skills}_${colorPalette.theme}_${Date.now()}`;
  
  // Générer via IA si possible
  if (API_KEY) {
    try {
      const backgroundResult = await generateBackgroundViaIA(job, skills, colorPalette, userName);
      if (backgroundResult) {
        return backgroundResult;
      }
    } catch (error) {
      console.warn('⚠️ Background IA generation failed, using intelligent fallback:', error.message);
    }
  }
  
  // Fallback intelligent avec variété
  return await generateIntelligentBackgroundFallback(job, skills, colorPalette);
}

/**
 * 🤖 GÉNÉRATION BACKGROUND VIA IA
 */
async function generateBackgroundViaIA(job, skills, colorPalette, userName = null) {
  const skillsText = Array.isArray(skills) ? skills.join(', ') : skills || 'various skills';
  const jobTheme = colorPalette.theme || 'professional';
  
  const backgroundPrompt = `As a UI/UX designer expert, create an innovative background design for a ${job} VCard profile.

🎨 REQUIREMENTS:
- Job: ${job}
- Skills: ${skillsText}
- Theme: ${jobTheme}
- Name: ${userName || 'Professional'}

🎆 BACKGROUND OPTIONS (choose the most innovative):
1. CUSTOM-IMAGE: Generate Unsplash/abstract image URL for professional background
2. COLOR: Single premium color that matches the profession
3. GRADIENT: Creative gradient with 2-3 colors

💡 CREATIVITY GUIDELINES:
- For tech jobs: Use modern, digital-inspired backgrounds
- For creative jobs: Use artistic, vibrant designs
- For business jobs: Use professional, elegant styles
- Make it UNIQUE and MEMORABLE
- Ensure readability of text over background

Return ONLY this JSON:
{
  "background_type": "[custom-image|color|gradient]",
  "background_value": "[URL for custom-image | HEX color for color | linear-gradient(...) for gradient]",
  "reasoning": "Brief explanation why this background fits the ${job} profile"
}`;

  try {
    const response = await axios({
      method: 'post',
      url: OPENROUTER_API_URL,
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.BACKEND_URL || 'http://localhost:3000',
        'X-Title': 'Background Generator'
      },
      data: {
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: backgroundPrompt }],
        max_tokens: 500,
        temperature: 0.8
      },
      timeout: 10000
    });

    if (response.data?.choices?.[0]?.message?.content) {
      const content = response.data.choices[0].message.content.trim();
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const parsedData = JSON.parse(jsonMatch[0]);
        if (parsedData.background_type && parsedData.background_value) {
          console.log(`🌈 Background IA généré: ${parsedData.background_type} - ${parsedData.reasoning}`);
          return {
            type: parsedData.background_type,
            value: parsedData.background_value
          };
        }
      }
    }
  } catch (error) {
    console.warn('⚠️ IA background generation error:', error.message);
  }
  
  return null;
}

/**
 * 🌐 GESTION CLOUDINARY POUR BACKGROUNDS CUSTOM
 */
async function processCustomImageBackground(imageUrl, job, userName) {
  try {
    // Si Cloudinary est configuré, uploader l'image
    if (CLOUDINARY_CONFIG.cloud_name && CLOUDINARY_CONFIG.cloud_name !== 'demo') {
      console.log('📤 Upload de l\'image background vers Cloudinary...');
      
      // Simuler l'upload Cloudinary (remplacer par vraie intégration)
      const cloudinaryUrl = `https://res.cloudinary.com/${CLOUDINARY_CONFIG.cloud_name}/image/upload/c_fill,w_1200,h_800/v1/${job.toLowerCase().replace(/\s+/g, '')}_bg_${Date.now()}`;
      
      console.log(`✅ Background uploadé sur Cloudinary: ${cloudinaryUrl}`);
      return cloudinaryUrl;
    } else {
      // Utiliser l'URL directe si Cloudinary n'est pas configuré
      console.log('⚠️ Cloudinary non configuré, utilisation URL directe');
      return imageUrl;
    }
  } catch (error) {
    console.warn('⚠️ Erreur upload Cloudinary, utilisation URL fallback:', error.message);
    return imageUrl;
  }
}

/**
 * 💡 FALLBACK INTELLIGENT POUR BACKGROUNDS
 */
async function generateIntelligentBackgroundFallback(job, skills, colorPalette) {
  const jobLower = job.toLowerCase();
  const backgroundOptions = ['gradient', 'color', 'custom-image'];
  const selectedOption = backgroundOptions[Math.floor(Math.random() * backgroundOptions.length)];
  
  switch (selectedOption) {
    case 'custom-image':
      // Générer URL d'image contextuelle
      const themes = BACKGROUND_THEMES[colorPalette.theme] || BACKGROUND_THEMES.professional;
      const theme = themes[Math.floor(Math.random() * themes.length)];
      let imageUrl = `https://source.unsplash.com/1200x800/?${encodeURIComponent(theme)}`;
      
      // Traiter via Cloudinary si configuré
      imageUrl = await processCustomImageBackground(imageUrl, job, 'fallback');
      
      return {
        type: 'custom-image',
        value: imageUrl
      };
      
    case 'color':
      // Couleur unie contextuelle
      const colors = [colorPalette.primary, colorPalette.accent, colorPalette.secondary];
      return {
        type: 'color',
        value: colors[Math.floor(Math.random() * colors.length)]
      };
      
    default: // gradient
      // Gradient innovant
      const gradientTemplate = GRADIENT_STYLES[Math.floor(Math.random() * GRADIENT_STYLES.length)];
      const gradient = gradientTemplate
        .replace('{color1}', colorPalette.primary)
        .replace('{color2}', colorPalette.accent);
      return {
        type: 'gradient',
        value: gradient
      };
  }
}

/**
 * 📱 GÉNÉRATION BLOCK DESCRIPTIONS OPTIMISÉE
 */
function generateBlockDescription(type, job, skills, userName = null, userEmail = null, userPhone = null, userSocialData = {}) {
  const skillsText = Array.isArray(skills) ? skills.join(", ") : skills || "various skills";
  const jobNormalized = job.toLowerCase().replace(/\s+/g, '').replace(/[éèêë]/g, 'e').replace(/[àâä]/g, 'a').replace(/[ç]/g, 'c');
  const userNormalized = userName?.toLowerCase().replace(/\s+/g, '').replace(/[éèêë]/g, 'e').replace(/[àâä]/g, 'a').replace(/[ç]/g, 'c') || jobNormalized;
  
  // 📱 GÉNÉRATION D'ADRESSES RÉALISTES
  const businessAddresses = [
    "123 Business Avenue, New York, NY 10001",
    "456 Professional Street, Los Angeles, CA 90210",
    "789 Corporate Blvd, Chicago, IL 60601", 
    "321 Innovation Drive, San Francisco, CA 94107",
    "654 Executive Plaza, Boston, MA 02101",
    "987 Tech Center, Austin, TX 78701",
    "147 Creative Square, Miami, FL 33101",
    "258 Success Lane, Seattle, WA 98101"
  ];
  
  // 📞 GÉNÉRATION DE NUMÉROS RÉALISTES  
  const phoneNumbers = [
    "+1 (555) 123-4567", "+1 (555) 234-5678", "+1 (555) 345-6789",
    "+1 (555) 456-7890", "+1 (555) 567-8901", "+1 (555) 678-9012",
    "+1 (555) 789-0123", "+1 (555) 890-1234"
  ];
  
  const randomAddress = businessAddresses[Math.floor(Math.random() * businessAddresses.length)];
  const randomPhone = phoneNumbers[Math.floor(Math.random() * phoneNumbers.length)];
  
  // 🎯 UTILISER LES VRAIES DONNÉES UTILISATEUR QUAND DISPONIBLES
  const templates = {
    // 📧 CONTACTS DIRECTS - UTILISER LES VRAIES DONNÉES
    Email: userEmail || `contact@${jobNormalized}.com`,
    Phone: userPhone || randomPhone,
    Address: userSocialData.address || randomAddress,
    
    // 🌐 SITES WEB - UTILISER LES VRAIES DONNÉES
    Link: userSocialData.website || `https://${userNormalized}-portfolio.com`,
    
    // 💻 DÉVELOPPEMENT - UTILISER LES VRAIS USERNAMES
    GitHub: userSocialData.github ? `https://github.com/${userSocialData.github}` : `https://github.com/${userNormalized}`,
    
    // 💼 PROFESSIONNEL - UTILISER LES VRAIS USERNAMES
    Linkedin: userSocialData.linkedin ? `https://linkedin.com/in/${userSocialData.linkedin}` : `https://linkedin.com/in/${userNormalized}`,
    
    // 📸 RÉSEAUX SOCIAUX VISUELS - UTILISER LES VRAIS USERNAMES
    Instagram: userSocialData.instagram ? `https://instagram.com/${userSocialData.instagram}` : `https://instagram.com/${userNormalized}`,
    Pinterest: userSocialData.pinterest ? `https://pinterest.com/${userSocialData.pinterest}` : `https://pinterest.com/${userNormalized}`,
    Snapchat: userSocialData.snapchat ? `https://snapchat.com/add/${userSocialData.snapchat}` : `https://snapchat.com/add/${userNormalized}`,
    Tiktok: userSocialData.tiktok ? `https://tiktok.com/@${userSocialData.tiktok}` : `https://tiktok.com/@${userNormalized}`,
    
    // 🐦 MICRO-BLOGGING - UTILISER LES VRAIS USERNAMES
    Twitter: userSocialData.twitter ? `https://twitter.com/${userSocialData.twitter}` : `https://twitter.com/${userNormalized}`,
    
    // 🎥 VIDÉO & STREAMING - UTILISER LES VRAIS USERNAMES
    Youtube: userSocialData.youtube ? `https://youtube.com/@${userSocialData.youtube}` : `https://youtube.com/@${userNormalized}`,
    Twitch: userSocialData.twitch ? `https://twitch.tv/${userSocialData.twitch}` : `https://twitch.tv/${userNormalized}`,
    
    // 💬 MESSAGERIE - UTILISER LES VRAIES DONNÉES
    Whatsapp: userPhone || randomPhone,
    Discord: userSocialData.discord || `${userName || jobNormalized}#${Math.floor(Math.random() * 9000) + 1000}`,
    Telegram: userSocialData.telegram ? `https://t.me/${userSocialData.telegram}` : `https://t.me/${userNormalized}`,
    Messenger: userSocialData.messenger ? `https://m.me/${userSocialData.messenger}` : `https://m.me/${userNormalized}`,
    
    // 🎵 AUDIO - UTILISER LES VRAIS USERNAMES
    Spotify: userSocialData.spotify ? `https://open.spotify.com/user/${userSocialData.spotify}` : `https://open.spotify.com/user/${userNormalized}`,
    
    // 💬 FORUMS - UTILISER LES VRAIS USERNAMES
    Reddit: userSocialData.reddit ? `https://reddit.com/u/${userSocialData.reddit}` : `https://reddit.com/u/${userNormalized}`,
    
    // 📘 AUTRES RÉSEAUX - UTILISER LES VRAIS USERNAMES
    Facebook: userSocialData.facebook ? `https://facebook.com/${userSocialData.facebook}` : `https://facebook.com/${userNormalized}`
  };
  
  return validateDescriptionLength(templates[type] || `${job} ${type} Contact`);
}

/**
 * � EXTRACTION DES DONNÉES SOCIALES DE L'UTILISATEUR
 */
function extractUserSocialData(userData = {}) {
  return {
    instagram: userData.instagram || userData.instagramUsername,
    twitter: userData.twitter || userData.twitterUsername,
    facebook: userData.facebook || userData.facebookUsername,
    linkedin: userData.linkedin || userData.linkedinUsername,
    github: userData.github || userData.githubUsername,
    youtube: userData.youtube || userData.youtubeUsername,
    tiktok: userData.tiktok || userData.tiktokUsername,
    snapchat: userData.snapchat || userData.snapchatUsername,
    twitch: userData.twitch || userData.twitchUsername,
    discord: userData.discord || userData.discordUsername,
    telegram: userData.telegram || userData.telegramUsername,
    messenger: userData.messenger || userData.messengerUsername,
    spotify: userData.spotify || userData.spotifyUsername,
    reddit: userData.reddit || userData.redditUsername,
    pinterest: userData.pinterest || userData.pinterestUsername,
    website: userData.website || userData.websiteUrl,
    address: userData.address || userData.physicalAddress
  };
}

/**
 * �🔧 VALIDATION ET CORRECTION BLOCKS DYNAMIQUES OPTIMISÉE
 */
function validateAndCorrectBlocks(blocks, job, skills, userName = null, userEmail = null, userPhone = null, userData = {}) {
  console.log(`🔍 Validation des blocks pour ${job}: ${blocks ? blocks.length : 0} blocks reçus`);
  
  // Extraire les données sociales de l'utilisateur
  const userSocialData = extractUserSocialData(userData);
  
  if (!Array.isArray(blocks) || blocks.length === 0) {
    console.log('⚠️ Aucun block reçu, génération fallback dynamique');
    return generateDynamicBlocksForJob(job, skills, userName, userEmail, userPhone, userData);
  }
  
  // Validation et nettoyage des blocks IA
  let validBlocks = blocks.filter(block => {
    // Vérifier que le block a les propriétés requises
    const hasValidStructure = block && 
                             typeof block === 'object' && 
                             block.type_block && 
                             VALID_BLOCK_TYPES.includes(block.type_block);
    
    if (!hasValidStructure) {
      console.log(`⚠️ Block invalide ignoré: ${JSON.stringify(block)}`);
      return false;
    }
    
    return true;
  });
  
  // S'assurer qu'Email est présent
  const hasEmail = validBlocks.some(block => block.type_block === 'Email');
  if (!hasEmail) {
    console.log('📧 Ajout forcé du block Email manquant');
    validBlocks.unshift({
      name: "📧 Professional Contact",
      type_block: "Email",
      description: userEmail || `contact@${job.toLowerCase().replace(/\s+/g, '')}.com`,
      status: true
    });
  }
  
  // Limiter entre 3 et 8 blocks selon le métier
  const maxBlocks = getRandomBlockCountForJob(job);
  validBlocks = validBlocks.slice(0, maxBlocks);
  
  // Si on a moins de 3 blocks, ajouter des blocks pertinents
  if (validBlocks.length < 3) {
    console.log(`⚠️ Seulement ${validBlocks.length} blocks, ajout de blocks contextuels`);
    const additionalBlocks = generateAdditionalBlocksForJob(job, skills, validBlocks);
    validBlocks = [...validBlocks, ...additionalBlocks].slice(0, maxBlocks);
  }
  
  // Nettoyer et formater les blocks - TOUJOURS utiliser nos données pures
  const finalBlocks = validBlocks.map(block => ({
    ...block,
    name: validateDescriptionLength(block.name || getContextualBlockName(block.type_block, job), MAX_LENGTHS.BLOCK_NAME),
    description: validateDescriptionLength(generateBlockDescription(block.type_block, job, skills, userName, userEmail, userPhone, userSocialData)),
    status: true
  }));
  
  console.log(`✅ ${finalBlocks.length} blocks validés: ${finalBlocks.map(b => b.type_block).join(', ')}`);
  return finalBlocks;
}

/**
 * 🎯 GÉNÉRATION BLOCKS FALLBACK DYNAMIQUES PAR JOB
 */
function generateDynamicBlocksForJob(job, skills, userName = null, userEmail = null, userPhone = null, userData = {}) {
  const jobLower = job.toLowerCase();
  const skillsArray = Array.isArray(skills) ? skills : [skills];
  const skillsText = skillsArray.join(' ').toLowerCase();
  
  // Extraire les données sociales de l'utilisateur
  const userSocialData = extractUserSocialData(userData);
  
  console.log(`🎯 Génération blocks dynamiques pour: ${job} avec skills: ${skillsText}`);
  
  // 📱 MAPPING INTELLIGENT DES BLOCKS PAR PROFESSION
  const jobBlockMapping = {
    // 💻 DÉVELOPPEMENT & TECH
    'developer': ['Email', 'GitHub', 'Linkedin', 'Discord', 'Link'],
    'développeur': ['Email', 'GitHub', 'Linkedin', 'Discord', 'Link'],
    'programmeur': ['Email', 'GitHub', 'Linkedin', 'Discord', 'Link'],
    'ingénieur': ['Email', 'GitHub', 'Linkedin', 'Phone', 'Link'],
    'tech': ['Email', 'GitHub', 'Linkedin', 'Discord', 'Link'],
    
    // 🎨 DESIGN & CRÉATIF
    'designer': ['Email', 'Instagram', 'Linkedin', 'Pinterest', 'Link'],
    'graphiste': ['Email', 'Instagram', 'Pinterest', 'Link', 'Linkedin'],
    'artist': ['Instagram', 'Email', 'Youtube', 'Pinterest', 'Link'],
    'photographe': ['Instagram', 'Email', 'Pinterest', 'Link', 'Phone'],
    'créatif': ['Email', 'Instagram', 'Pinterest', 'Link', 'Youtube'],
    
    // 🏥 MÉDICAL & SANTÉ
    'doctor': ['Email', 'Phone', 'Address', 'Linkedin', 'Whatsapp'],
    'médecin': ['Email', 'Phone', 'Address', 'Linkedin', 'Whatsapp'],
    'dentiste': ['Email', 'Phone', 'Address', 'Linkedin', 'Whatsapp'],
    'infirmier': ['Email', 'Phone', 'Address', 'Whatsapp', 'Linkedin'],
    'thérapeute': ['Email', 'Phone', 'Address', 'Whatsapp', 'Linkedin'],
    
    // 📚 ÉDUCATION
    'teacher': ['Email', 'Phone', 'Linkedin', 'Youtube', 'Address'],
    'professeur': ['Email', 'Phone', 'Linkedin', 'Youtube', 'Address'],
    'formateur': ['Email', 'Linkedin', 'Youtube', 'Phone', 'Link'],
    'enseignant': ['Email', 'Phone', 'Linkedin', 'Youtube', 'Address'],
    
    // 💼 BUSINESS & MANAGEMENT
    'manager': ['Email', 'Linkedin', 'Phone', 'Address', 'Whatsapp'],
    'consultant': ['Email', 'Linkedin', 'Phone', 'Address', 'Link'],
    'directeur': ['Email', 'Linkedin', 'Phone', 'Address', 'Link'],
    'chef': ['Email', 'Linkedin', 'Phone', 'Whatsapp', 'Address'],
    
    // 🎬 MÉDIA & ENTERTAINMENT
    'youtuber': ['Youtube', 'Email', 'Instagram', 'Twitter', 'Discord'],
    'influenceur': ['Instagram', 'Tiktok', 'Youtube', 'Email', 'Snapchat'],
    'streamer': ['Twitch', 'Discord', 'Youtube', 'Email', 'Twitter'],
    'musicien': ['Spotify', 'Instagram', 'Youtube', 'Email', 'Link'],
    
    // 🛒 COMMERCE & VENTE
    'vendeur': ['Email', 'Phone', 'Whatsapp', 'Linkedin', 'Link'],
    'commercial': ['Email', 'Phone', 'Linkedin', 'Whatsapp', 'Link'],
    'entrepreneur': ['Email', 'Linkedin', 'Link', 'Phone', 'Instagram'],
    
    // 📖 COMMUNICATION & MARKETING
    'marketeur': ['Email', 'Linkedin', 'Instagram', 'Twitter', 'Link'],
    'journaliste': ['Email', 'Twitter', 'Linkedin', 'Link', 'Phone'],
    'communicant': ['Email', 'Linkedin', 'Twitter', 'Instagram', 'Link'],
    
    // 🏃 SPORT & FITNESS
    'coach': ['Email', 'Phone', 'Instagram', 'Whatsapp', 'Youtube'],
    'sportif': ['Instagram', 'Email', 'Youtube', 'Twitter', 'Link'],
    'fitness': ['Instagram', 'Email', 'Youtube', 'Whatsapp', 'Link']
  };
  
  // 🔍 DÉTECTION INTELLIGENTE DU JOB
  let selectedBlocks = ['Email', 'Phone', 'Linkedin', 'Link']; // Fallback par défaut
  
  // Recherche exacte d'abord
  if (jobBlockMapping[jobLower]) {
    selectedBlocks = jobBlockMapping[jobLower];
  } else {
    // Recherche par mots-clés
    for (const [keyword, blocks] of Object.entries(jobBlockMapping)) {
      if (jobLower.includes(keyword) || keyword.includes(jobLower.split(' ')[0])) {
        selectedBlocks = blocks;
        break;
      }
    }
    
    // Recherche par skills si aucun match sur le job
    if (selectedBlocks.length === 4) { // Si toujours le fallback
      if (skillsText.includes('react') || skillsText.includes('node') || skillsText.includes('javascript')) {
        selectedBlocks = ['Email', 'GitHub', 'Linkedin', 'Discord', 'Link'];
      } else if (skillsText.includes('design') || skillsText.includes('figma') || skillsText.includes('photoshop')) {
        selectedBlocks = ['Email', 'Instagram', 'Linkedin', 'Pinterest', 'Link'];
      } else if (skillsText.includes('marketing') || skillsText.includes('social')) {
        selectedBlocks = ['Email', 'Linkedin', 'Instagram', 'Twitter', 'Link'];
      } else if (skillsText.includes('youtube') || skillsText.includes('video')) {
        selectedBlocks = ['Youtube', 'Email', 'Instagram', 'Link', 'Discord'];
      }
    }
  }
  
  // � UTILISER LE SYSTÈME ALÉATOIRE DE BLOCKS
  const targetBlockCount = getRandomBlockCountForJob(job);
  console.log(`🎲 Nombre aléatoire de blocks pour ${job}: ${targetBlockCount}`);
  
  // �🎯 GÉNÉRATION DES BLOCKS AVEC NOMS CONTEXTUELS
  const contextualBlocks = selectedBlocks.slice(0, targetBlockCount).map(type => ({
    name: getContextualBlockName(type, job),
    type_block: type,
    description: generateBlockDescription(type, job, skills, userName, userEmail, userPhone, userSocialData),
    status: true
  }));
  
  // Si on n'a pas assez de blocks, en ajouter d'autres
  if (contextualBlocks.length < targetBlockCount) {
    const additionalTypes = ['Address', 'Twitter', 'Facebook', 'Pinterest', 'Telegram', 'Snapchat'];
    const usedTypes = contextualBlocks.map(b => b.type_block);
    
    for (const type of additionalTypes) {
      if (contextualBlocks.length >= targetBlockCount) break;
      if (!usedTypes.includes(type)) {
        contextualBlocks.push({
          name: getContextualBlockName(type, job),
          type_block: type,
          description: generateBlockDescription(type, job, skills, userName, userEmail, userPhone, userSocialData),
          status: true
        });
      }
    }
  }
  
  console.log(`🎯 ${contextualBlocks.length} blocks dynamiques générés pour ${job}: ${contextualBlocks.map(b => b.type_block).join(', ')}`);
  return contextualBlocks;
}

/**
 * 🏷️ NOMS CONTEXTUELS POUR LES BLOCKS SELON LE JOB
 */
function getContextualBlockName(blockType, job) {
  const jobLower = job.toLowerCase();
  
  const contextualNames = {
    'Email': {
      'developer': '💻 Code & Contact',
      'designer': '🎨 Creative Inbox',
      'doctor': '🏥 Medical Contact',
      'teacher': '📚 Academic Email',
      'manager': '💼 Executive Contact',
      'default': '📧 Professional Contact'
    },
    'GitHub': {
      'developer': '🚀 Code Repository',
      'designer': '💻 Design Code',
      'default': '💻 GitHub Projects'
    },
    'Instagram': {
      'designer': '🎨 Visual Portfolio',
      'artist': '🎭 Artistic Gallery',
      'influenceur': '✨ Influence Hub',
      'photographe': '📸 Photo Gallery',
      'default': '📸 Instagram Gallery'
    },
    'Linkedin': {
      'manager': '🤝 Executive Network',
      'consultant': '💡 Business Network',
      'developer': '💻 Tech Network',
      'default': '💼 LinkedIn Network'
    },
    'Youtube': {
      'teacher': '🎓 Educational Channel',
      'youtuber': '🎬 Main Channel',
      'coach': '💪 Training Videos',
      'default': '🎥 YouTube Channel'
    },
    'Discord': {
      'developer': '💬 Dev Community',
      'gamer': '🎮 Gaming Server',
      'default': '🎮 Discord Server'
    },
    'Phone': {
      'doctor': '🚨 Emergency Line',
      'coach': '📞 Consultation Line',
      'commercial': '📱 Sales Hotline',
      'default': '📱 Direct Line'
    },
    'Whatsapp': {
      'coach': '💬 Quick Chat',
      'doctor': '🏥 Patient Contact',
      'commercial': '💬 Sales Chat',
      'default': '💬 WhatsApp Chat'
    }
  };
  
  const blockContext = contextualNames[blockType];
  if (blockContext) {
    // Recherche par job spécifique
    for (const [jobKey, name] of Object.entries(blockContext)) {
      if (jobKey !== 'default' && jobLower.includes(jobKey)) {
        return name;
      }
    }
    return blockContext.default;
  }
  
  return getBlockDisplayName(blockType);
}

/**
 * 🎲 GÉNÉRATION NOMBRE ALÉATOIRE DE BLOCKS PAR MÉTIER
 */
function getRandomBlockCountForJob(job) {
  const jobLower = job.toLowerCase();
  
  // 🎯 RÈGLES SPÉCIFIQUES PAR MÉTIER
  const blockCountRules = {
    // Métiers nécessitant BEAUCOUP de blocks (6-8)
    'influenceur': () => Math.floor(Math.random() * 3) + 6, // 6-8
    'youtuber': () => Math.floor(Math.random() * 3) + 6,    // 6-8
    'gamer': () => Math.floor(Math.random() * 3) + 6,       // 6-8
    'streamer': () => Math.floor(Math.random() * 3) + 6,    // 6-8
    'artist': () => Math.floor(Math.random() * 2) + 6,      // 6-7
    'musician': () => Math.floor(Math.random() * 2) + 6,    // 6-7
    'musicien': () => Math.floor(Math.random() * 2) + 6,    // 6-7
    
    // Métiers nécessitant MOYENNEMENT de blocks (4-6)
    'designer': () => Math.floor(Math.random() * 3) + 4,    // 4-6
    'graphiste': () => Math.floor(Math.random() * 3) + 4,   // 4-6
    'developer': () => Math.floor(Math.random() * 2) + 4,   // 4-5
    'développeur': () => Math.floor(Math.random() * 2) + 4, // 4-5
    'freelance': () => Math.floor(Math.random() * 3) + 4,   // 4-6
    'entrepreneur': () => Math.floor(Math.random() * 3) + 4, // 4-6
    
    // Métiers nécessitant PEU de blocks (3-4)
    'doctor': () => Math.floor(Math.random() * 2) + 3,      // 3-4
    'médecin': () => Math.floor(Math.random() * 2) + 3,     // 3-4
    'lawyer': () => Math.floor(Math.random() * 2) + 3,      // 3-4
    'avocat': () => Math.floor(Math.random() * 2) + 3,      // 3-4
    'comptable': () => Math.floor(Math.random() * 2) + 3,   // 3-4
    'notaire': () => Math.floor(Math.random() * 2) + 3,     // 3-4
  };
  
  // Recherche par mots-clés dans le job
  for (const [jobKey, countGenerator] of Object.entries(blockCountRules)) {
    if (jobLower.includes(jobKey)) {
      const count = countGenerator();
      console.log(`🎲 ${job} → ${count} blocks (règle: ${jobKey})`);
      return count;
    }
  }
  
  // Fallback aléatoire entre 4-6
  const defaultCount = Math.floor(Math.random() * 3) + 4; // 4-6
  console.log(`🎲 ${job} → ${defaultCount} blocks (défaut)`);
  return defaultCount;
}

/**
 * 🔧 GÉNÉRATION BLOCKS ADDITIONNELS POUR COMPLÉTER
 */
function generateAdditionalBlocksForJob(job, skills, existingBlocks) {
  const jobLower = job.toLowerCase();
  const existingTypes = existingBlocks.map(block => block.type_block);
  
  // Blocks recommandés par métier
  const recommendedBlocks = {
    'developer': ['GitHub', 'Linkedin', 'Discord', 'Phone', 'Link'],
    'développeur': ['GitHub', 'Linkedin', 'Discord', 'Phone', 'Link'],
    'designer': ['Instagram', 'Pinterest', 'Linkedin', 'Phone', 'Link'],
    'graphiste': ['Instagram', 'Pinterest', 'Linkedin', 'Phone', 'Link'],
    'doctor': ['Phone', 'Address', 'Linkedin', 'Whatsapp'],
    'médecin': ['Phone', 'Address', 'Linkedin', 'Whatsapp'],
    'youtuber': ['Youtube', 'Instagram', 'Twitter', 'Discord', 'Tiktok'],
    'influenceur': ['Instagram', 'Tiktok', 'Youtube', 'Snapchat', 'Twitter'],
    'gamer': ['Twitch', 'Discord', 'Youtube', 'Twitter', 'Instagram'],
    'musician': ['Spotify', 'Instagram', 'Youtube', 'Link', 'Twitter'],
    'teacher': ['Phone', 'Youtube', 'Linkedin', 'Address', 'Link'],
    'professeur': ['Phone', 'Youtube', 'Linkedin', 'Address', 'Link'],
  };
  
  let suggestedBlocks = recommendedBlocks['default'] || ['Phone', 'Linkedin', 'Link', 'Address'];
  
  // Recherche par mots-clés
  for (const [jobKey, blocks] of Object.entries(recommendedBlocks)) {
    if (jobLower.includes(jobKey)) {
      suggestedBlocks = blocks;
      break;
    }
  }
  
  // Filtrer les blocks déjà existants
  const newBlocks = suggestedBlocks
    .filter(blockType => !existingTypes.includes(blockType))
    .slice(0, 3) // Maximum 3 blocks additionnels
    .map(blockType => ({
      name: getContextualBlockName(blockType, job),
      type_block: blockType,
      description: generateBlockDescription(blockType, job, skills),
      status: true
    }));
  
  console.log(`🔧 Ajout de ${newBlocks.length} blocks: ${newBlocks.map(b => b.type_block).join(', ')}`);
  return newBlocks;
}

/**
 * 🤖 GÉNÉRATION IA OPTIMISÉE AVEC RETRY
 */
async function generateVCardJSON(job, skills, userName = null, userEmail = null, userPhone = null, userData = {}) {
  if (!API_KEY) {
    throw new Error("API_KEY missing - fallback activated");
  }
  
  const skillsText = Array.isArray(skills) ? skills.join(", ") : skills || "various skills";
  const colorPalette = selectColorByJob(job);
  
  const prompt = `You are an expert marketing copywriter and brand strategist. Create a UNIQUE, DYNAMIC VCard JSON for a ${job} professional.

🚀 CRITICAL REQUIREMENTS:
- Generate COMPLETELY DIFFERENT content each time - NO templates or static phrases
- Project name: Create a UNIQUE, brandable company/agency name (50-80 chars) - be creative!
- Project description: Write an ENGAGING, detailed description (280-300 chars) showcasing specific achievements and value
- VCard description: Craft a COMPELLING personal brand statement (180-200 chars) with unique positioning
- Use dynamic, action-oriented language with emotional triggers
- Be SPECIFIC to ${job} and ${skillsText} - avoid generic corporate speak

🎯 BLOCKS GENERATION - CRITICAL:
You MUST generate a RANDOM number of blocks (between 3 and 8 blocks) based on profession relevance. Each block MUST have this exact structure:
{"name": "descriptive name with emoji", "type_block": "BlockType", "description": "relevant content", "status": true}

📱 AVAILABLE BLOCK TYPES (choose the most relevant):
Email, Phone, Address, Link, Facebook, Twitter, Instagram, Youtube, Whatsapp, Tiktok, Telegram, Spotify, Pinterest, Linkedin, Snapchat, Twitch, Discord, Messenger, Reddit, GitHub

🎨 DYNAMIC BLOCK SELECTION FOR ${job}:
- Email is MANDATORY (always include first)
- Generate RANDOM number of additional blocks (2-7 more) based on profession needs
- Some professions need MORE blocks (influencers, gamers: 6-8 blocks)
- Some professions need FEWER blocks (doctors, lawyers: 3-4 blocks)
- Consider ${skillsText} when selecting relevant platforms
- Create contextual names with relevant emojis
- Make descriptions profession-specific and realistic
- BE CREATIVE with the number - don't always use the same amount!

💡 PROFESSION GUIDANCE (ADAPT NUMBER OF BLOCKS):
- DEVELOPERS (4-5 blocks): Include GitHub, Linkedin, Discord/Slack for collaboration
- DESIGNERS (5-6 blocks): Include Instagram, Pinterest, Linkedin, Behance for portfolio
- DOCTORS (3-4 blocks): Include Phone, Address, Linkedin for professional contact
- TEACHERS (4-5 blocks): Include Phone, Youtube, Linkedin for educational content
- ARTISTS (6-7 blocks): Include Instagram, Youtube, Pinterest, Spotify for creative showcase
- MANAGERS (4-5 blocks): Include Linkedin, Phone, Whatsapp for business communication
- INFLUENCERS (7-8 blocks): Include Instagram, Tiktok, Youtube, Snapchat for content platforms
- GAMERS (6-8 blocks): Include Twitch, Discord, Youtube, Twitter for gaming community
- MUSICIANS (6-7 blocks): Include Spotify, Instagram, Youtube, Soundcloud for music sharing
- FREELANCERS (5-6 blocks): Multiple platforms for client acquisition

CONTEXT:
Profession: ${job}
Skills: ${skillsText}
Client Name: ${userName || 'Professional Expert'}

Generate ONLY this JSON structure:
{
  "project": {
    "name": "Creative and unique company name here",
    "description": "Engaging 280-300 character description showcasing specific achievements and value proposition",
    "logo": null,
    "color": "${colorPalette.primary}"
  },
  "vcard": {
    "name": "${userName || 'Expert Professional'}",
    "description": "Compelling 180-200 character personal brand statement with unique positioning",
    "font_family": "${PROFESSIONAL_FONTS[Math.floor(Math.random() * PROFESSIONAL_FONTS.length)]}",
    "font_size": 16,
    "background_type": "gradient",
    "background_value": "linear-gradient(135deg, ${colorPalette.primary}, ${colorPalette.accent})",
    "logo": null,
    "favicon": null
  },
  "blocks": [
    {"name": "📧 Professional Contact", "type_block": "Email", "description": "${userEmail || 'contact@professional.com'}", "status": true},
    {"name": "profession-specific name", "type_block": "RelevantType", "description": "realistic content", "status": true},
    {"name": "another relevant block", "type_block": "AnotherType", "description": "contextual content", "status": true}
    // GENERATE MORE BLOCKS DYNAMICALLY - RANDOM NUMBER BETWEEN 3-8 TOTAL
    // Add more blocks based on profession needs (influencers need more, doctors need fewer)
  ]
}`;

  const requestConfig = {
    method: 'post',
    url: OPENROUTER_API_URL,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.BACKEND_URL || 'http://localhost:3000',
      'X-Title': 'VCard Generator'
    },
    data: {
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1200,
      temperature: 0.9
    },
    timeout: 15000
  };

  // Retry logic
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await axios(requestConfig);
      
      if (response.data?.choices?.[0]?.message?.content) {
        const content = response.data.choices[0].message.content.trim();
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        
        if (jsonMatch) {
          const parsedData = JSON.parse(jsonMatch[0]);
          
          // Validation et correction
          if (parsedData.project && parsedData.vcard && parsedData.blocks) {
            parsedData.blocks = validateAndCorrectBlocks(parsedData.blocks, job, skills, userName, userEmail, userPhone, userData);
            return parsedData;
          }
        }
      }
    } catch (error) {
      console.warn(`⚠️ IA attempt ${attempt} failed:`, error.message);
      if (attempt === 2) throw error;
    }
  }
  
  throw new Error("All IA attempts failed");
}

/**
 * 🎨 GÉNÉRATEUR DE CONTENU DYNAMIQUE FALLBACK
 */
function generateDynamicFallbackContent(job, skills, userName = null) {
  const skillsText = Array.isArray(skills) ? skills.join(", ") : skills || "various skills";
  
  // Mots créatifs pour noms d'entreprises
  const premiumWords = ['Elite', 'Quantum', 'Nexus', 'Pinnacle', 'Zenith', 'Apex', 'Vanguard', 'Sterling', 'Prime', 'Platinum'];
  const industryTerms = ['Digital', 'Tech', 'Innovation', 'Solutions', 'Dynamics', 'Labs', 'Studios', 'Works', 'Forge', 'Hub'];
  const businessTypes = ['Consultancy', 'Agency', 'Partners', 'Group', 'Collective', 'Network', 'Alliance', 'Ventures'];
  
  // Génération de nom dynamique
  const word1 = premiumWords[Math.floor(Math.random() * premiumWords.length)];
  const word2 = industryTerms[Math.floor(Math.random() * industryTerms.length)];
  const word3 = businessTypes[Math.floor(Math.random() * businessTypes.length)];
  
  const nameTemplates = [
    `${word1} ${word2} ${word3}`,
    `${word2} ${word1} ${word3}`,
    `${word1} ${word2}`,
    `${word2} ${word1} Solutions`,
    `${word1} ${word3}`
  ];
  
  const dynamicProjectName = nameTemplates[Math.floor(Math.random() * nameTemplates.length)];
  
  // Templates dynamiques pour descriptions
  const projectTemplates = [
    `Transform your business with cutting-edge ${job} expertise in ${skillsText}. We deliver breakthrough solutions that drive measurable ROI and sustainable competitive advantage through innovative methodologies and proven industry best practices.`,
    `Premium ${job} consultancy specializing in ${skillsText}. Our award-winning team creates game-changing solutions that exceed expectations, accelerate growth, and position your organization as an industry leader in today's digital landscape.`,
    `Revolutionary ${job} services leveraging ${skillsText} to unlock unprecedented business potential. Partner with industry experts who understand your challenges and deliver transformational results that matter to your bottom line.`,
    `Elite ${job} professionals delivering exceptional outcomes through ${skillsText}. We combine strategic thinking with tactical execution to create sustainable solutions that drive innovation, efficiency, and long-term success.`
  ];
  
  const vcardTemplates = [
    `${userName || 'Expert'} - Visionary ${job} transforming businesses through ${skillsText.split(',')[0]?.trim() || skillsText}. Trusted advisor delivering breakthrough results with proven methodologies and innovative thinking.`,
    `${userName || 'Professional'} - Elite ${job} specialist driving digital transformation via ${skillsText.split(',')[0]?.trim() || skillsText}. Results-focused expert with exceptional track record in complex project delivery.`,
    `${userName || 'Consultant'} - Distinguished ${job} leader leveraging ${skillsText.split(',')[0]?.trim() || skillsText} for strategic advantage. Award-winning professional creating measurable impact for forward-thinking organizations.`,
    `${userName || 'Strategist'} - Premier ${job} expert specializing in ${skillsText.split(',')[0]?.trim() || skillsText}. Innovation catalyst helping enterprises achieve breakthrough performance and sustainable growth.`
  ];
  
  return {
    projectName: dynamicProjectName,
    projectDescription: projectTemplates[Math.floor(Math.random() * projectTemplates.length)],
    vcardDescription: vcardTemplates[Math.floor(Math.random() * vcardTemplates.length)]
  };
}

/**
 * 🎯 SYSTÈME COMPLET D'IMAGES CONTEXTUELLES PAR JOB ET SKILLS
 */

// 🎨 MAPPING PRÉCIS MÉTIERS → TYPES D'IMAGES
const JOB_IMAGE_MAPPING = {
  // 💻 DÉVELOPPEMENT & TECHNOLOGIE
  'developer': {
    pixabayQueries: ['programming', 'coding', 'software development', 'computer screen', 'tech workspace'],
    imageStyle: 'tech',
    faviconStyle: 'bottts',
    backgroundColor: '#007bff'
  },
  'développeur': {
    pixabayQueries: ['programming', 'coding', 'software development', 'computer screen', 'tech workspace'],
    imageStyle: 'tech',
    faviconStyle: 'bottts',
    backgroundColor: '#007bff'
  },
  'programmeur': {
    pixabayQueries: ['programming', 'coding', 'software development', 'computer screen'],
    imageStyle: 'tech',
    faviconStyle: 'bottts',
    backgroundColor: '#007bff'
  },
  'ingénieur': {
    pixabayQueries: ['engineering', 'technology', 'technical work', 'innovation'],
    imageStyle: 'tech',
    faviconStyle: 'bottts',
    backgroundColor: '#28a745'
  },
  
  // 🎨 DESIGN & CRÉATIF
  'designer': {
    pixabayQueries: ['graphic design', 'creative work', 'design studio', 'artistic workspace'],
    imageStyle: 'creative',
    faviconStyle: 'avataaars',
    backgroundColor: '#ff6b6b'
  },
  'graphiste': {
    pixabayQueries: ['graphic design', 'visual design', 'creative work', 'artistic'],
    imageStyle: 'creative',
    faviconStyle: 'avataaars',
    backgroundColor: '#ff6b6b'
  },
  'artist': {
    pixabayQueries: ['art', 'creative', 'artistic work', 'studio'],
    imageStyle: 'creative',
    faviconStyle: 'avataaars',
    backgroundColor: '#e74c3c'
  },
  
  // 🏥 MÉDICAL & SANTÉ
  'doctor': {
    pixabayQueries: ['medical doctor', 'healthcare', 'hospital', 'medical professional'],
    imageStyle: 'medical',
    faviconStyle: 'avataaars',
    backgroundColor: '#28a745'
  },
  'médecin': {
    pixabayQueries: ['medical doctor', 'healthcare', 'hospital', 'medical professional'],
    imageStyle: 'medical',
    faviconStyle: 'avataaars',
    backgroundColor: '#28a745'
  },
  'nurse': {
    pixabayQueries: ['nursing', 'healthcare worker', 'medical care'],
    imageStyle: 'medical',
    faviconStyle: 'avataaars',
    backgroundColor: '#17a2b8'
  },
  'infirmier': {
    pixabayQueries: ['nursing', 'healthcare worker', 'medical care'],
    imageStyle: 'medical',
    faviconStyle: 'avataaars',
    backgroundColor: '#17a2b8'
  },
  
  // 📚 ÉDUCATION
  'teacher': {
    pixabayQueries: ['education', 'classroom', 'teaching', 'academic'],
    imageStyle: 'education',
    faviconStyle: 'avataaars',
    backgroundColor: '#ffc107'
  },
  'professeur': {
    pixabayQueries: ['education', 'classroom', 'teaching', 'academic'],
    imageStyle: 'education',
    faviconStyle: 'avataaars',
    backgroundColor: '#ffc107'
  },
  'enseignant': {
    pixabayQueries: ['education', 'classroom', 'teaching', 'academic'],
    imageStyle: 'education',
    faviconStyle: 'avataaars',
    backgroundColor: '#ffc107'
  },
  
  // 💼 BUSINESS & MANAGEMENT
  'manager': {
    pixabayQueries: ['business meeting', 'office management', 'team leadership', 'corporate'],
    imageStyle: 'business',
    faviconStyle: 'avataaars',
    backgroundColor: '#343a40'
  },
  'chef': {
    pixabayQueries: ['business meeting', 'office management', 'team leadership'],
    imageStyle: 'business',
    faviconStyle: 'avataaars',
    backgroundColor: '#343a40'
  },
  'directeur': {
    pixabayQueries: ['executive', 'business leadership', 'corporate management'],
    imageStyle: 'business',
    faviconStyle: 'avataaars',
    backgroundColor: '#343a40'
  },
  'consultant': {
    pixabayQueries: ['business consulting', 'professional services', 'strategy'],
    imageStyle: 'business',
    faviconStyle: 'avataaars',
    backgroundColor: '#6c757d'
  }
};

// 🔍 ENRICHISSEMENT PAR SKILLS
const SKILL_ENHANCEMENT = {
  'react': ['react development', 'frontend development', 'javascript'],
  'nodejs': ['backend development', 'server development', 'javascript'],
  'python': ['python programming', 'data science', 'ai development'],
  'figma': ['ui design', 'interface design', 'design tools'],
  'photoshop': ['graphic design', 'visual design', 'creative software'],
  'scrum': ['agile development', 'project management', 'team collaboration'],
  'docker': ['devops', 'containerization', 'deployment'],
  'aws': ['cloud computing', 'infrastructure', 'devops']
};

async function generatePreciseVCardImage(job, skills, userData = {}) {
  try {
    console.log(`🎯 Génération image précise pour: ${job} avec skills: ${Array.isArray(skills) ? skills.join(', ') : skills}`);
    
    // 1. Détection précise du métier
    const jobMapping = detectJobMapping(job, skills);
    
    // 2. Tentative Pixabay contextuel PRIORITAIRE
    if (jobMapping && jobMapping.pixabayQueries) {
      const pixabayResult = await generateEnhancedPixabayImage(job, skills, jobMapping);
      if (pixabayResult) {
        console.log(`✅ Image Pixabay contextuelle générée pour ${job}`);
        return pixabayResult;
      }
    }
    
    // 3. Fallback contextuel selon le métier
    const contextualImage = generateJobSpecificImage(job, skills, userData, jobMapping);
    console.log(`🎨 Image contextuelle fallback générée pour ${job}`);
    return contextualImage;
    
  } catch (error) {
    console.error(`❌ Erreur génération image précise:`, error.message);
    // Fallback ultime
    const seed = `${job}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    return `https://picsum.photos/400/400?random=${seed}`;
  }
}

async function generatePreciseVCardFavicon(job, skills, userData = {}) {
  try {
    console.log(`🎯 Génération favicon précis pour: ${job}`);
    
    const jobMapping = detectJobMapping(job, skills);
    const userName = userData.name || userData.userName || 'Pro';
    const seed = `${job}_${Array.isArray(skills) ? skills.join('') : skills}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    // Style et couleur selon le métier exact
    const style = jobMapping?.faviconStyle || 'avataaars';
    const backgroundColor = jobMapping?.backgroundColor?.replace('#', '') || '6c757d';
    
    const faviconUrl = `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(seed)}&backgroundColor=${backgroundColor}&size=128`;
    
    console.log(`✅ Favicon ${style} (${backgroundColor}) généré pour ${job}`);
    return faviconUrl;
    
  } catch (error) {
    console.error(`❌ Erreur génération favicon précis:`, error.message);
    const seed = Date.now().toString(36) + Math.random().toString(36).substr(2);
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&size=128`;
  }
}

function detectJobMapping(job, skills) {
  const jobLower = job.toLowerCase();
  const skillsArray = Array.isArray(skills) ? skills : [skills];
  const skillsText = skillsArray.join(' ').toLowerCase();
  
  // 1. Recherche exacte dans le mapping
  if (JOB_IMAGE_MAPPING[jobLower]) {
    return JOB_IMAGE_MAPPING[jobLower];
  }
  
  // 2. Recherche par mots-clés dans le job
  for (const [keyword, mapping] of Object.entries(JOB_IMAGE_MAPPING)) {
    if (jobLower.includes(keyword) || keyword.includes(jobLower.split(' ')[0])) {
      return mapping;
    }
  }
  
  // 3. Détection par skills si aucun match job
  if (skillsText.includes('react') || skillsText.includes('javascript') || skillsText.includes('programming')) {
    return JOB_IMAGE_MAPPING['developer'];
  }
  if (skillsText.includes('design') || skillsText.includes('figma') || skillsText.includes('photoshop')) {
    return JOB_IMAGE_MAPPING['designer'];
  }
  if (skillsText.includes('medical') || skillsText.includes('health')) {
    return JOB_IMAGE_MAPPING['doctor'];
  }
  if (skillsText.includes('teaching') || skillsText.includes('education')) {
    return JOB_IMAGE_MAPPING['teacher'];
  }
  
  // 4. Fallback business générique
  return {
    pixabayQueries: ['business', 'professional', 'office'],
    imageStyle: 'business',
    faviconStyle: 'avataaars',
    backgroundColor: '#6c757d'
  };
}

async function generateEnhancedPixabayImage(job, skills, jobMapping) {
  try {
    // Sélectionner une requête contextuelle
    const baseQuery = jobMapping.pixabayQueries[Math.floor(Math.random() * jobMapping.pixabayQueries.length)];
    
    // Enrichir avec skills spécifiques
    let enhancedQuery = baseQuery;
    const skillsArray = Array.isArray(skills) ? skills : [skills];
    
    for (const skill of skillsArray) {
      const skillLower = skill.toLowerCase();
      if (SKILL_ENHANCEMENT[skillLower]) {
        enhancedQuery = SKILL_ENHANCEMENT[skillLower][0]; // Prendre la première suggestion
        console.log(`🔧 Query enrichie avec skill ${skill}: ${enhancedQuery}`);
        break;
      }
    }
    
    // Appel Pixabay avec query enrichie
    const pixabayResult = await randomImageService.generatePixabayImage(job, [enhancedQuery]);
    if (pixabayResult && pixabayResult.url) {
      return pixabayResult.url;
    }
    
    return null;
    
  } catch (error) {
    console.warn('⚠️ Erreur Pixabay enrichi:', error.message);
    return null;
  }
}

function generateJobSpecificImage(job, skills, userData, jobMapping) {
  const userName = userData.name || userData.userName || 'Professional';
  const seed = `${job}_${Array.isArray(skills) ? skills.join('') : skills}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  
  switch (jobMapping?.imageStyle) {
    case 'tech':
      // Images robotiques/tech pour développeurs
      return `https://robohash.org/${encodeURIComponent(seed)}.png?set=set1&size=400x400`;
      
    case 'creative':
      // Avatars colorés pour créatifs
      return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}&backgroundColor=f8f9fa&size=400`;
      
    case 'medical':
      // Avatars professionnels pour médical
      const medicalColor = jobMapping.backgroundColor.replace('#', '');
      return `https://ui-avatars.com/api/?name=${encodeURIComponent(userName.substring(0, 2))}&background=${medicalColor}&color=fff&size=400&format=svg`;
      
    case 'education':
      // Avatars éducatifs
      return `https://ui-avatars.com/api/?name=${encodeURIComponent(userName.substring(0, 2))}&background=ffc107&color=000&size=400&format=svg`;
      
    case 'business':
    default:
      // Avatars business par défaut
      return `https://ui-avatars.com/api/?name=${encodeURIComponent(userName.substring(0, 2))}&background=6c757d&color=fff&size=400&format=svg`;
  }
}

// 🔄 REMPLACEMENT DES ANCIENNES FONCTIONS
async function generateVCardImage(job, skills, userData = {}) {
  return await generatePreciseVCardImage(job, skills, userData);
}

async function generateVCardFavicon(job, skills, userData = {}) {
  return await generatePreciseVCardFavicon(job, skills, userData);
}

async function generateRandomVCardVisuals(job, skills, userData = {}) {
  try {
    return await randomImageService.generateRandomVCardImages(job, skills, userData);
  } catch (error) {
    console.error(`❌ Erreur génération visuals VCard:`, error.message);
    const seed = Date.now().toString(36) + Math.random().toString(36).substr(2);
    return {
      logo: `https://picsum.photos/400/400?random=${seed}`,
      favicon: `https://api.dicebear.com/7.x/shapes/svg?seed=${seed}&size=128`,
      imageType: 'fallback_picsum',
      faviconType: 'fallback_dicebear',
      category: 'business',
      timestamp: Date.now(),
      isRandom: true
    };
  }
}

/**
 * 🚀 FONCTION PRINCIPALE OPTIMISÉE
 */
async function generateVCardFull(job, skills, userData = {}) {
  const startTime = Date.now();
  
  try {
    const userName = userData.name || userData.userName || null;
    const userEmail = userData.email || null;
    const userPhone = userData.phone || null;
    
    console.log(`🚀 Génération VCard pour: ${userName || job} - ${job}`);
    console.log(`🎯 Skills: ${Array.isArray(skills) ? skills.join(', ') : skills}`);
    
    if (!job || typeof job !== 'string') {
      throw new Error("Le paramètre 'job' est requis et doit être une string");
    }
    
    // 1️⃣ Générer le JSON via IA
    const { project, vcard, blocks } = await generateVCardJSON(job, skills, userName, userEmail, userPhone, userData);
    
    if (!project || !vcard || !blocks || !Array.isArray(blocks) || blocks.length < 4) {
      throw new Error("Données incomplètes générées");
    }
    
    // 2️⃣ Sélectionner la palette de couleurs
    const colorPalette = selectColorByJob(job);
    
    // 3️⃣ Générer le background innovant via IA
    console.log("🌈 Génération d'un background innovant...");
    const innovativeBackground = await generateInnovativeBackground(job, skills, colorPalette, userName);
    vcard.background_type = innovativeBackground.type;
    vcard.background_value = innovativeBackground.value;
    
    // 4️⃣ Générer les visuels séparément (logo et favicon)
    console.log("🎨 Génération du logo VCard...");
    const logoUrl = await generateVCardImage(job, skills, userData);
    
    console.log("🎨 Génération du favicon VCard...");
    const faviconUrl = await generateVCardFavicon(job, skills, userData);
    
    // 5️⃣ Appliquer les visuels
    project.logo = logoUrl;
    vcard.logo = logoUrl;
    vcard.favicon = faviconUrl;
    
    // 6️⃣ Finalisation
    project.logoUrl = logoUrl;
    project.faviconUrl = faviconUrl;
    
    const duration = Date.now() - startTime;
    console.log(`✅ VCard générée avec succès en ${duration}ms`);
    console.log(`📊 Résumé:`);
    console.log(`   - Projet: ${project.name}`);
    console.log(`   - VCard: ${vcard.name}`);
    console.log(`   - Blocs: ${blocks.length} (${blocks.map(b => b.type_block).join(', ')})`);
    console.log(`   - Logo: ${logoUrl}`);
    console.log(`   - Favicon: ${faviconUrl}`);
    
    return { project, vcard, blocks };
    
  } catch (error) {
    console.error("⚠️ JSON generation error, using fallback:", error.message);
    
    // Fallback optimisé
    const colorPalette = selectColorByJob(job);
    const skillsText = Array.isArray(skills) ? skills.join(", ") : skills || "various skills";
    
    const background = await generateInnovativeBackground(job, skillsText, colorPalette, userData.name || userData.userName);
    const logoUrl = await generateVCardImage(job, skills, userData);
    const faviconUrl = await generateVCardFavicon(job, skills, userData);
    
    console.log(`🔄 Fallback - Logo généré: ${logoUrl}`);
    console.log(`🔄 Fallback - Favicon généré: ${faviconUrl}`);
    
    // 🎨 Génération de contenu dynamique même en fallback
    console.log("🎨 Génération de contenu dynamique fallback...");
    const dynamicContent = generateDynamicFallbackContent(job, skills, userData.name || userData.userName);
    
    return {
      project: {
        name: validateDescriptionLength(dynamicContent.projectName, MAX_LENGTHS.PROJECT_NAME),
        description: validateDescriptionLength(dynamicContent.projectDescription, MAX_LENGTHS.PROJECT_DESCRIPTION),
        logo: logoUrl,
        logoUrl: logoUrl,
        faviconUrl: faviconUrl,
        color: colorPalette.primary
      },
      vcard: {
        name: validateDescriptionLength(userData.name || userData.userName || `${job} Expert`, MAX_LENGTHS.VCARD_NAME),
        description: validateDescriptionLength(dynamicContent.vcardDescription, MAX_LENGTHS.VCARD_DESCRIPTION),
        font_family: PROFESSIONAL_FONTS[0],
        font_size: 16,
        background_type: background.type,
        background_value: background.value,
        logo: logoUrl,
        favicon: faviconUrl
      },
      blocks: generateDynamicBlocksForJob(job, skills, userData.name || userData.userName, userData.email, userData.phone, userData)
    };
  }
}

/**
 * 🔧 FONCTION UTILITAIRE POUR CLEANUP
 */
function prepareForDatabaseOperation() {
  if (global.gc) {
    global.gc();
  }
  return true;
}

/**
 * 🧪 FONCTION DE TEST OPTIMISÉE
 */
async function testVCardGeneration() {
  console.log('🧪 Test de génération VCard optimisée...');
  
  const testCases = [
    { job: 'Développeur Web', skills: ['React', 'Node.js'], user: { name: 'John Doe' } },
    { job: 'Designer UX', skills: ['Figma', 'Adobe XD'], user: { name: 'Jane Smith' } },
    { job: 'Chef de Projet', skills: ['Scrum', 'Management'], user: { name: 'Alice Johnson' } }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n🔄 Test: ${testCase.job}`);
    try {
      const result = await generateVCardFull(testCase.job, testCase.skills, testCase.user);
      console.log(`   ✅ Succès: ${result.project.name}`);
    } catch (error) {
      console.error(`   ❌ Erreur: ${error.message}`);
    }
  }
  
  console.log('\n✅ Tests terminés!');
}

/**
 * 🔗 FONCTION DE GÉNÉRATION URL UNIQUE
 */
function generateUniqueUrl() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}${random}`;
}

// 🔄 Export optimisé
module.exports = { 
  generateVCardFull,
  generateUniqueUrl,
  testVCardGeneration,
  generateBlockDescription,
  validateDescriptionLength,
  selectColorByJob,
  generateInnovativeBackground,
  generateVCardImage,
  generateVCardFavicon,
  generateRandomVCardVisuals,
  generatePreciseVCardImage,
  generatePreciseVCardFavicon,
  detectJobMapping,
  generateJobSpecificImage,
  generateDynamicBlocksForJob,
  getContextualBlockName,
  prepareForDatabaseOperation,
  COLOR_PALETTES,
  PROFESSIONAL_FONTS,
  PROFESSIONAL_BLOCKS,
  VALID_BLOCK_TYPES,
  MAX_LENGTHS,
  JOB_IMAGE_MAPPING
};