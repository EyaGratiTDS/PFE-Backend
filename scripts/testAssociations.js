const db = require('../models');
const { CustomDomain } = db;

const testAssociations = async () => {
  try {
    console.log('🧪 Testing CustomDomain associations...');
    
    // Test 1: Récupérer tous les domaines avec leurs associations
    console.log('\n1. Testing getUserDomains query...');
    const domains = await CustomDomain.findAll({
      include: [
        {
          model: db.Users,
          attributes: ['id', 'email'],
          as: 'Users',
          required: false
        },
        {
          model: db.VCard,
          attributes: ['id', 'name', 'url'],
          as: 'vcard',
          required: false
        }
      ]
    });
    
    console.log(`✅ Found ${domains.length} domains`);
    
    // Test 2: Vérifier les associations définies
    console.log('\n2. Testing model associations...');
    console.log('CustomDomain associations:', Object.keys(CustomDomain.associations));
    console.log('VCard associations:', Object.keys(db.VCard.associations));
    
    // Test 3: Créer un domaine de test
    console.log('\n3. Testing domain creation...');
    const testDomain = await CustomDomain.create({
      domain: 'test-domain.com',
      userId: 1, // Assurez-vous qu'un utilisateur avec ID 1 existe
      custom_index_url: 'https://example.com',
      custom_not_found_url: 'https://example.com/404',
      status: 'pending'
    });
    
    console.log('✅ Test domain created:', testDomain.id);
    
    // Test 4: Récupérer le domaine avec ses associations
    console.log('\n4. Testing domain with associations...');
    const domainWithAssoc = await CustomDomain.findByPk(testDomain.id, {
      include: [
        { model: db.Users, as: 'Users' },
        { model: db.VCard, as: 'vcard' }
      ]
    });
    
    console.log('✅ Domain with associations retrieved');
    console.log('- User:', domainWithAssoc.Users ? 'Found' : 'Not found');
    console.log('- VCard:', domainWithAssoc.vcard ? 'Found' : 'Not found');
    
    // Nettoyer
    await testDomain.destroy();
    console.log('✅ Test domain cleaned up');
    
    console.log('\n🎉 All association tests passed!');
    
  } catch (error) {
    console.error('❌ Association test failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    process.exit(0);
  }
};

// Exécuter les tests si ce script est appelé directement
if (require.main === module) {
  testAssociations();
}

module.exports = testAssociations;
