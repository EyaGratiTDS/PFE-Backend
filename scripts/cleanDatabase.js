const sequelize = require('../database/sequelize');

const cleanDatabase = async () => {
  try {
    console.log('🧹 Cleaning database...');

    // Désactiver les vérifications de clés étrangères temporairement
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');

    // Supprimer toutes les tables pour éviter les conflits de clés
    await sequelize.drop();
    console.log('✅ All tables dropped');

    // Réactiver les vérifications de clés étrangères
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');

    // Recréer toutes les tables avec la nouvelle structure
    await sequelize.sync({ force: true });
    console.log('✅ Database recreated with new structure');

    console.log('🎉 Database cleanup completed successfully!');
    console.log('📋 New structure:');
    console.log('   - VCard (1) ←→ (1) CustomDomain');
    console.log('   - CustomDomain.vcardId → VCard.id (unique)');
    console.log('   - VCard.hasOne(CustomDomain)');
    console.log('   - CustomDomain.belongsTo(VCard)');

    process.exit(0);

  } catch (error) {
    console.error('❌ Database cleanup failed:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  }
};

// Exécuter le nettoyage si ce script est appelé directement
if (require.main === module) {
  cleanDatabase();
}

module.exports = cleanDatabase;
