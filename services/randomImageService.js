/**
 * 🎯 SERVICE GÉNÉRATION D'IMAGES ALÉATOIRES AVEC PIXABAY
 * 
 * Solution pour générer des images DIFFÉRENTES à chaque fois
 * Basé sur job et skills avec multiple APIs et randomisation
 * 
 * ✅ Pixabay API pour images contextuelles haute qualité
 * ✅ Lorem Picsum pour images génériques
 * ✅ DiceBear pour avatars stylisés
 * ✅ Robohash pour images robotiques
 * ✅ UI Faces pour portraits professionnels
 * ✅ Seed aléatoire à chaque génération
 */

const axios = require('axios');

// 🌟 CONFIGURATION APIS MULTIPLES
const RANDOM_IMAGE_APIS = {
  pixabay: {
    enabled: true,
    baseUrl: 'https://pixabay.com/api/',
    key: process.env.PIXABAY_API_KEY || '52574919-72b53965047f517adb52afa2a'
  },
  loremPicsum: {
    enabled: true,
    baseUrl: 'https://picsum.photos'
  },
  diceBear: {
    enabled: true,
    baseUrl: 'https://api.dicebear.com/7.x'
  },
  robohash: {
    enabled: true,
    baseUrl: 'https://robohash.org'
  },
  uiFaces: {
    enabled: true,
    baseUrl: 'https://ui-avatars.com/api'
  }
};

// 🎨 CORRESPONDANCES MÉTIERS SPÉCIFIQUES POUR IMAGES CONTEXTUELLES
const JOB_SPECIFIC_MAPPING = {
  // 💻 DÉVELOPPEMENT & TECH
  'developer': {
    pixabayQueries: ['programming', 'coding', 'software development', 'computer screen'],
    dicebearStyle: 'bottts',
    robohashSet: 'set1',
    uiAvatarSymbol: 'DEV'
  },
  'web developer': {
    pixabayQueries: ['web development', 'website coding', 'javascript', 'computer programming'],
    dicebearStyle: 'identicon',
    robohashSet: 'set1',
    uiAvatarSymbol: 'WD'
  },
  'frontend developer': {
    pixabayQueries: ['user interface', 'web design', 'responsive design', 'javascript'],
    dicebearStyle: 'shapes',
    robohashSet: 'set1',
    uiAvatarSymbol: 'FE'
  },
  'backend developer': {
    pixabayQueries: ['server', 'database', 'api development', 'cloud computing'],
    dicebearStyle: 'bottts',
    robohashSet: 'set2',
    uiAvatarSymbol: 'BE'
  },
  'fullstack developer': {
    pixabayQueries: ['full stack development', 'web application', 'technology stack'],
    dicebearStyle: 'bottts',
    robohashSet: 'set1',
    uiAvatarSymbol: 'FS'
  },
  
  // 🎨 DESIGN & CRÉATIF
  'designer': {
    pixabayQueries: ['graphic design', 'creative work', 'design studio', 'artistic'],
    dicebearStyle: 'avataaars',
    robohashSet: 'set4',
    uiAvatarSymbol: 'DES'
  },
  'ui designer': {
    pixabayQueries: ['user interface design', 'app design', 'digital design'],
    dicebearStyle: 'fun-emoji',
    robohashSet: 'set4',
    uiAvatarSymbol: 'UI'
  },
  'ux designer': {
    pixabayQueries: ['user experience', 'usability', 'user research', 'wireframe'],
    dicebearStyle: 'big-smile',
    robohashSet: 'set4',
    uiAvatarSymbol: 'UX'
  },
  'graphic designer': {
    pixabayQueries: ['graphic design', 'visual design', 'branding', 'illustration'],
    dicebearStyle: 'avataaars',
    robohashSet: 'set4',
    uiAvatarSymbol: 'GD'
  },
  'photographer': {
    pixabayQueries: ['photography', 'camera', 'photo studio', 'portrait photography'],
    dicebearStyle: 'avataaars',
    robohashSet: 'set4',
    uiAvatarSymbol: 'PHO'
  },
  
  // 💼 BUSINESS & MANAGEMENT
  'manager': {
    pixabayQueries: ['business meeting', 'office management', 'team leadership'],
    dicebearStyle: 'personas',
    robohashSet: 'set2',
    uiAvatarSymbol: 'MGR'
  },
  'project manager': {
    pixabayQueries: ['project management', 'team collaboration', 'planning'],
    dicebearStyle: 'miniavs',
    robohashSet: 'set2',
    uiAvatarSymbol: 'PM'
  },
  'product manager': {
    pixabayQueries: ['product development', 'strategy', 'business analysis'],
    dicebearStyle: 'personas',
    robohashSet: 'set2',
    uiAvatarSymbol: 'PD'
  },
  
  // 🏥 MÉDICAL & SANTÉ
  'doctor': {
    pixabayQueries: ['medical doctor', 'healthcare', 'hospital', 'stethoscope'],
    dicebearStyle: 'personas',
    robohashSet: 'set1',
    uiAvatarSymbol: 'DR'
  },
  'nurse': {
    pixabayQueries: ['nursing', 'healthcare worker', 'medical care'],
    dicebearStyle: 'miniavs',
    robohashSet: 'set1',
    uiAvatarSymbol: 'RN'
  },
  
  // 📚 ÉDUCATION
  'teacher': {
    pixabayQueries: ['education', 'classroom', 'teaching', 'school'],
    dicebearStyle: 'big-smile',
    robohashSet: 'set1',
    uiAvatarSymbol: 'TEA'
  },
  'professor': {
    pixabayQueries: ['university', 'academic', 'research', 'lecture'],
    dicebearStyle: 'avataaars',
    robohashSet: 'set1',
    uiAvatarSymbol: 'PRO'
  }
};

// 🔧 CORRESPONDANCES SKILLS SPÉCIFIQUES
const SKILL_SPECIFIC_MAPPING = {
  // Tech Skills
  'react': { pixabayTerms: ['react development', 'frontend framework'], symbol: 'R' },
  'javascript': { pixabayTerms: ['javascript programming', 'web development'], symbol: 'JS' },
  'python': { pixabayTerms: ['python programming', 'data science'], symbol: 'PY' },
  'java': { pixabayTerms: ['java programming', 'enterprise software'], symbol: 'J' },
  'node.js': { pixabayTerms: ['backend development', 'server programming'], symbol: 'N' },
  'angular': { pixabayTerms: ['angular framework', 'typescript'], symbol: 'A' },
  'vue': { pixabayTerms: ['vue framework', 'progressive app'], symbol: 'V' },
  
  // Design Skills
  'photoshop': { pixabayTerms: ['photo editing', 'digital art', 'graphic design'], symbol: 'PS' },
  'illustrator': { pixabayTerms: ['vector graphics', 'illustration'], symbol: 'AI' },
  'figma': { pixabayTerms: ['ui design tool', 'design collaboration'], symbol: 'F' },
  'sketch': { pixabayTerms: ['interface design', 'app mockup'], symbol: 'SK' },
  'adobe xd': { pixabayTerms: ['user experience design', 'prototyping'], symbol: 'XD' },
  
  // Other Skills
  'marketing': { pixabayTerms: ['digital marketing', 'advertising'], symbol: 'MK' },
  'seo': { pixabayTerms: ['search optimization', 'digital marketing'], symbol: 'SEO' },
  'analytics': { pixabayTerms: ['data analysis', 'business intelligence'], symbol: 'AN' }
};

// 🎨 CONSERVATION DE L'ANCIEN SYSTÈME POUR COMPATIBILITÉ
const JOB_VISUAL_CATEGORIES = {
  tech: {
    keywords: ['developer', 'engineer', 'programmer', 'analyst', 'architect', 'devops', 'admin'],
    dicebearStyles: ['bottts', 'shapes', 'identicon'],
    robohashSets: ['set1', 'set2', 'set3'],
    colors: ['007bff', '28a745', '6f42c1', 'fd7e14'],
    pixabayQueries: ['technology', 'computer', 'coding', 'software', 'digital', 'programming']
  },
  creative: {
    keywords: ['designer', 'artist', 'creative', 'marketing', 'content', 'writer', 'photographer'],
    dicebearStyles: ['avataaars', 'big-smile', 'fun-emoji'],
    robohashSets: ['set4', 'set1'],
    colors: ['e83e8c', '20c997', 'fd7e14', 'ffc107'],
    pixabayQueries: ['design', 'art', 'creative', 'illustration', 'photography', 'graphics']
  },
  business: {
    keywords: ['manager', 'director', 'executive', 'consultant', 'analyst', 'coordinator'],
    dicebearStyles: ['miniavs', 'personas', 'bottts-neutral'],
    robohashSets: ['set2', 'set3'],
    colors: ['6c757d', '343a40', '007bff', '28a745'],
    pixabayQueries: ['business', 'office', 'professional', 'meeting', 'corporate', 'workplace']
  }
};

/**
 * 🔍 TROUVER CORRESPONDANCE EXACTE JOB/SKILLS
 */
function findExactJobMapping(job, skills = []) {
  const jobLower = job.toLowerCase().trim();
  
  // Recherche exacte du métier
  const exactMatch = JOB_SPECIFIC_MAPPING[jobLower];
  if (exactMatch) {
    console.log(`🎯 Correspondance exacte trouvée pour: ${job}`);
    return exactMatch;
  }
  
  // Recherche par mots-clés dans le job
  for (const [jobKey, mapping] of Object.entries(JOB_SPECIFIC_MAPPING)) {
    if (jobLower.includes(jobKey) || jobKey.includes(jobLower)) {
      console.log(`🔍 Correspondance partielle trouvée: ${jobKey} pour ${job}`);
      return mapping;
    }
  }
  
  // Fallback générique basé sur les skills
  if (skills.length > 0) {
    const firstSkill = skills[0].toLowerCase();
    for (const [skillKey, skillMapping] of Object.entries(SKILL_SPECIFIC_MAPPING)) {
      if (firstSkill.includes(skillKey) || skillKey.includes(firstSkill)) {
        console.log(`💡 Fallback basé sur skill: ${skillKey}`);
        return {
          pixabayQueries: skillMapping.pixabayTerms,
          dicebearStyle: 'avataaars',
          robohashSet: 'set1',
          uiAvatarSymbol: skillMapping.symbol
        };
      }
    }
  }
  
  // Fallback ultime
  console.log(`⚠️ Aucune correspondance trouvée, utilisation fallback générique`);
  return {
    pixabayQueries: ['professional', 'business', 'work'],
    dicebearStyle: 'personas',
    robohashSet: 'set2',
    uiAvatarSymbol: 'PRO'
  };
}

/**
 * 🎨 CRÉER SEED CONTEXTUEL BASÉ SUR JOB + SKILLS
 */
function createContextualSeed(job, skills, mapping) {
  const jobHash = job.replace(/\s+/g, '').toLowerCase();
  const skillsHash = skills.map(s => s.replace(/\s+/g, '').toLowerCase()).join('');
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  
  // Inclure des éléments du mapping pour plus de contexte
  const contextHash = `${jobHash}_${skillsHash}_${mapping.uiAvatarSymbol}_${timestamp}_${random}`;
  
  return contextHash.substring(0, 50);
}

/**
 * 🔍 DÉTERMINER CATÉGORIE VISUELLE PAR JOB
 */
function determineJobCategory(job) {
  const jobLower = job.toLowerCase();
  
  for (const [category, config] of Object.entries(JOB_VISUAL_CATEGORIES)) {
    if (config.keywords.some(keyword => jobLower.includes(keyword))) {
      return category;
    }
  }
  
  return 'business'; // Catégorie par défaut
}

/**
 * 🎲 GÉNÉRATEUR SEED ALÉATOIRE UNIQUE
 */
function generateUniqueSeed(job, skills, extraSalt = '') {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2);
  const skillsHash = skills.join('').replace(/\s/g, '').toLowerCase();
  const jobHash = job.replace(/\s/g, '').toLowerCase();
  
  return `${jobHash}_${skillsHash}_${timestamp}_${random}_${extraSalt}`.substring(0, 50);
}

/**
 * � PIXABAY - Images contextuelles haute qualité
 */
/**
 * 🎨 PIXABAY CONTEXTUEL - Images vraiment liées au job et skills
 */
async function generatePixabayImage(job, skills, size = 400) {
  try {
    if (!RANDOM_IMAGE_APIS.pixabay.enabled || !RANDOM_IMAGE_APIS.pixabay.key) {
      console.warn('⚠️ Pixabay API désactivée ou clé manquante');
      return null;
    }

    const jobMapping = findExactJobMapping(job, skills);
    
    // Sélection d'une requête contextuelle spécifique au métier
    const availableQueries = jobMapping.pixabayQueries;
    const selectedQuery = availableQueries[Math.floor(Math.random() * availableQueries.length)];
    
    // Ajouter des termes de skills si disponibles
    let enhancedQuery = selectedQuery;
    if (skills.length > 0) {
      const firstSkill = skills[0].toLowerCase();
      const skillMapping = SKILL_SPECIFIC_MAPPING[firstSkill];
      if (skillMapping && skillMapping.pixabayTerms.length > 0) {
        enhancedQuery = skillMapping.pixabayTerms[0];
        console.log(`🔧 Query enrichie avec skill: ${enhancedQuery}`);
      }
    }
    
    // Paramètres de recherche Pixabay contextuels
    const params = {
      key: RANDOM_IMAGE_APIS.pixabay.key,
      q: encodeURIComponent(enhancedQuery),
      image_type: 'photo',
      orientation: 'horizontal',
      category: 'business',
      min_width: size,
      min_height: size,
      safesearch: 'true',
      per_page: 20,
      page: Math.floor(Math.random() * 3) + 1,
      order: 'popular'
    };
    
    const queryString = Object.entries(params)
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
      
    const apiUrl = `${RANDOM_IMAGE_APIS.pixabay.baseUrl}?${queryString}`;
    
    console.log(`🔍 Recherche Pixabay contextuelle: "${enhancedQuery}" pour ${job}`);
    
    const response = await axios.get(apiUrl, {
      timeout: 5000,
      headers: {
        'User-Agent': 'VCard-Generator/1.0'
      }
    });
    
    if (response.data && response.data.hits && response.data.hits.length > 0) {
      const randomIndex = Math.floor(Math.random() * response.data.hits.length);
      const selectedImage = response.data.hits[randomIndex];
      
      const imageUrl = selectedImage.webformatURL || selectedImage.previewURL;
      
      console.log(`🎨 Image Pixabay contextuelle sélectionnée: ${selectedImage.tags}`);
      
      return {
        url: imageUrl,
        source: 'pixabay_contextual',
        tags: selectedImage.tags,
        query: enhancedQuery,
        jobMapping: jobMapping
      };
      
    } else {
      console.warn(`⚠️ Aucun résultat Pixabay contextuel pour "${enhancedQuery}"`);
      return null;
    }
    
  } catch (error) {
    console.error('❌ Erreur API Pixabay contextuelle:', error.message);
    return null;
  }
}

/**
 * �🌅 LOREM PICSUM - Images génériques avec filtres
 */
function generateLoremPicsumImage(job, skills, size = 400) {
  try {
    const seed = generateUniqueSeed(job, skills, 'picsum');
    const category = determineJobCategory(job);
    
    // Paramètres aléatoires pour variation
    const blur = Math.random() > 0.8 ? `&blur=${Math.floor(Math.random() * 3) + 1}` : '';
    const grayscale = Math.random() > 0.7 ? '&grayscale' : '';
    
    const imageUrl = `${RANDOM_IMAGE_APIS.loremPicsum.baseUrl}/${size}/${size}?random=${seed}${blur}${grayscale}`;
    
    console.log(`🌅 Lorem Picsum généré: ${imageUrl}`);
    return imageUrl;
    
  } catch (error) {
    console.error('❌ Erreur Lorem Picsum:', error.message);
    return null;
  }
}

/**
 * 🎭 DICEBEAR CONTEXTUEL - Avatars stylisés selon le métier exact
 */
function generateDiceBearAvatar(job, skills, type = 'image') {
  try {
    const jobMapping = findExactJobMapping(job, skills);
    const seed = createContextualSeed(job, skills, jobMapping);
    
    // Utiliser le style spécifique au métier au lieu d'un style aléatoire
    const selectedStyle = jobMapping.dicebearStyle;
    
    // Couleur contextuelle (on garde un peu de variabilité)
    const contextColors = ['007bff', '28a745', '6f42c1', 'fd7e14', 'dc3545', '20c997'];
    const selectedColor = contextColors[Math.floor(Math.random() * contextColors.length)];
    
    const size = type === 'favicon' ? 128 : 400;
    const imageUrl = `${RANDOM_IMAGE_APIS.diceBear.baseUrl}/${selectedStyle}/svg?seed=${encodeURIComponent(seed)}&backgroundColor=${selectedColor}&size=${size}`;
    
    console.log(`🎭 DiceBear contextuel généré pour ${job}: style=${selectedStyle}, seed=${seed.substring(0,20)}...`);
    return imageUrl;
    
  } catch (error) {
    console.error('❌ Erreur DiceBear contextuel:', error.message);
    return null;
  }
}

/**
 * 🤖 ROBOHASH CONTEXTUEL - Robots selon le métier
 */
function generateRobohashImage(job, skills) {
  try {
    const jobMapping = findExactJobMapping(job, skills);
    const seed = createContextualSeed(job, skills, jobMapping);
    
    // Utiliser le set spécifique au métier
    const selectedSet = jobMapping.robohashSet;
    
    const imageUrl = `${RANDOM_IMAGE_APIS.robohash.baseUrl}/${encodeURIComponent(seed)}.png?set=${selectedSet}&size=400x400`;
    
    console.log(`🤖 Robohash contextuel généré pour ${job}: set=${selectedSet}, seed=${seed.substring(0,20)}...`);
    return imageUrl;
    
  } catch (error) {
    console.error('❌ Erreur Robohash contextuel:', error.message);
    return null;
  }
}

/**
 * 👤 UI AVATAR CONTEXTUEL - Avec symboles du métier
 */
function generateUIAvatar(job, skills, name = null) {
  try {
    const jobMapping = findExactJobMapping(job, skills);
    const seed = createContextualSeed(job, skills, jobMapping);
    
    // Couleur contextuelle
    const contextColors = ['007bff', '28a745', '6f42c1', 'fd7e14', 'dc3545', '20c997'];
    const selectedColor = contextColors[Math.floor(Math.random() * contextColors.length)];
    
    // Texte à afficher : priorité au symbole du métier, puis initiales, puis symbole métier
    let displayText;
    if (name) {
      displayText = name.split(' ').map(n => n.charAt(0)).join('').substring(0, 2);
    } else {
      displayText = jobMapping.uiAvatarSymbol;
    }
    
    const imageUrl = `${RANDOM_IMAGE_APIS.uiFaces.baseUrl}/?name=${encodeURIComponent(displayText)}&background=${selectedColor}&color=fff&size=400&format=svg&seed=${seed}`;
    
    console.log(`👤 UI Avatar contextuel généré pour ${job}: texte=${displayText}, couleur=${selectedColor}`);
    return imageUrl;
    
  } catch (error) {
    console.error('❌ Erreur UI Avatar contextuel:', error.message);
    return null;
  }
}

/**
 * 🎯 GÉNÉRATEUR D'IMAGES ALÉATOIRES MULTIPLES AVEC PIXABAY
 */
async function generateRandomVCardImages(job, skills, userData = {}) {
  try {
    console.log(`🎯 Génération d'images aléatoires pour: ${job}`);
    
    const category = determineJobCategory(job);
    console.log(`📂 Catégorie détectée: ${category}`);
    
    // 🎲 POOL D'IMAGES DISPONIBLES AVEC PIXABAY EN PRIORITÉ
    const imageGenerators = [
      {
        name: 'pixabay_contextual',
        generator: async () => {
          const result = await generatePixabayImage(job, skills);
          return result ? result.url : null;
        },
        weight: 4, // Priorité élevée pour images contextuelles
        isAsync: true
      },
      {
        name: 'lorem_picsum',
        generator: () => generateLoremPicsumImage(job, skills),
        weight: 2,
        isAsync: false
      },
      {
        name: 'dicebear_avatar',
        generator: () => generateDiceBearAvatar(job, skills, 'image'),
        weight: 3,
        isAsync: false
      },
      {
        name: 'robohash_robot',
        generator: () => generateRobohashImage(job, skills),
        weight: 2,
        isAsync: false
      },
      {
        name: 'ui_avatar',
        generator: () => generateUIAvatar(job, skills, userData.name),
        weight: 1,
        isAsync: false
      }
    ];
    
    // 🎲 POOL DE FAVICONS DISPONIBLES
    const faviconGenerators = [
      {
        name: 'dicebear_mini',
        generator: () => generateDiceBearAvatar(job, skills, 'favicon'),
        weight: 3,
        isAsync: false
      },
      {
        name: 'ui_avatar_mini',
        generator: () => generateUIAvatar(job, skills, userData.name),
        weight: 2,
        isAsync: false
      },
      {
        name: 'robohash_mini',
        generator: () => generateRobohashImage(job, skills),
        weight: 1,
        isAsync: false
      }
    ];
    
    // 🎲 SÉLECTION PONDÉRÉE ALÉATOIRE
    function selectWeighted(generators) {
      const totalWeight = generators.reduce((sum, gen) => sum + gen.weight, 0);
      const random = Math.random() * totalWeight;
      
      let currentWeight = 0;
      for (const generator of generators) {
        currentWeight += generator.weight;
        if (random <= currentWeight) {
          return generator;
        }
      }
      
      return generators[generators.length - 1]; // Fallback
    }
    
    const selectedImageGen = selectWeighted(imageGenerators);
    const selectedFaviconGen = selectWeighted(faviconGenerators);
    
    console.log(`🖼️ Image sélectionnée: ${selectedImageGen.name}`);
    console.log(`🔖 Favicon sélectionné: ${selectedFaviconGen.name}`);
    
    // Génération avec support async
    let imageResult;
    if (selectedImageGen.isAsync) {
      imageResult = await selectedImageGen.generator();
      // Fallback si Pixabay échoue
      if (!imageResult) {
        console.log('🔄 Pixabay échoué, fallback vers Lorem Picsum');
        imageResult = generateLoremPicsumImage(job, skills);
      }
    } else {
      imageResult = selectedImageGen.generator();
    }
    
    const faviconResult = selectedFaviconGen.generator();
    
    return {
      logo: imageResult,
      favicon: faviconResult,
      imageType: selectedImageGen.name,
      faviconType: selectedFaviconGen.name,
      category: category,
      timestamp: Date.now(),
      isRandom: true
    };
    
  } catch (error) {
    console.error(`❌ Erreur génération images aléatoires:`, error.message);
    
    // Fallback ultra-simple
    const seed = generateUniqueSeed(job, skills, 'fallback');
    return {
      logo: `${RANDOM_IMAGE_APIS.loremPicsum.baseUrl}/400/400?random=${seed}`,
      favicon: `${RANDOM_IMAGE_APIS.diceBear.baseUrl}/shapes/svg?seed=${seed}&size=128`,
      imageType: 'fallback_picsum',
      faviconType: 'fallback_dicebear',
      category: 'business',
      timestamp: Date.now(),
      isRandom: true
    };
  }
}

/**
 * 🧪 FONCTION DE TEST
 */
async function testRandomImageGeneration() {
  console.log('🧪 Test de génération d\'images aléatoires...\n');
  
  const testCases = [
    { job: 'Développeur React', skills: ['React', 'JavaScript', 'Node.js'] },
    { job: 'Designer UX/UI', skills: ['Figma', 'Adobe XD', 'Prototyping'] },
    { job: 'Chef de Projet', skills: ['Scrum', 'Management', 'Planning'] }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n🔄 Test pour: ${testCase.job}`);
    
    // Générer 3 fois pour voir la randomisation
    for (let i = 1; i <= 3; i++) {
      console.log(`\n   🎲 Génération ${i}:`);
      const result = generateRandomVCardImages(testCase.job, testCase.skills);
      console.log(`   ✅ Image: ${result.imageType}`);
      console.log(`   ✅ Favicon: ${result.faviconType}`);
      console.log(`   📂 Catégorie: ${result.category}`);
    }
  }
  
  console.log('\n✅ Tests terminés!');
}

// 🔄 Export des fonctions
module.exports = {
  generateRandomVCardImages,
  generatePixabayImage,
  generateLoremPicsumImage,
  generateDiceBearAvatar,
  generateRobohashImage,
  generateUIAvatar,
  determineJobCategory,
  generateUniqueSeed,
  testRandomImageGeneration,
  RANDOM_IMAGE_APIS,
  JOB_VISUAL_CATEGORIES
};