const sequelize = require('../database/sequelize');

const checkIndexes = async () => {
  try {
    console.log('🔍 Checking database indexes...');
    
    // Vérifier les index de la table vcards
    const [results] = await sequelize.query(`
      SELECT 
        TABLE_NAME,
        INDEX_NAME,
        COLUMN_NAME,
        INDEX_TYPE
      FROM INFORMATION_SCHEMA.STATISTICS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'vcards'
      ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;
    `);
    
    console.log('📊 Indexes in vcards table:');
    console.table(results);
    
    // Compter le nombre total d'index
    const indexCount = new Set(results.map(r => r.INDEX_NAME)).size;
    console.log(`\n📈 Total indexes in vcards table: ${indexCount}/64`);
    
    if (indexCount >= 60) {
      console.log('⚠️  WARNING: Approaching MySQL index limit!');
    }
    
    // Vérifier les clés étrangères
    const [fkResults] = await sequelize.query(`
      SELECT 
        CONSTRAINT_NAME,
        TABLE_NAME,
        COLUMN_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'vcards'
      AND REFERENCED_TABLE_NAME IS NOT NULL;
    `);
    
    console.log('\n🔗 Foreign keys in vcards table:');
    console.table(fkResults);
    
  } catch (error) {
    console.error('❌ Error checking indexes:', error);
  } finally {
    await sequelize.close();
  }
};

// Exécuter la vérification si ce script est appelé directement
if (require.main === module) {
  checkIndexes();
}

module.exports = checkIndexes;
