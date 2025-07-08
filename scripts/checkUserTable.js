const sequelize = require('../database/sequelize');

const checkUserTable = async () => {
  try {
    console.log('🔍 Checking users table structure...');
    
    // Vérifier la structure de la table users
    const [results] = await sequelize.query("DESCRIBE users");
    
    console.log('\n📋 Users table columns:');
    results.forEach(column => {
      console.log(`- ${column.Field} (${column.Type}) ${column.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${column.Key ? `KEY: ${column.Key}` : ''}`);
    });
    
    // Tester une requête simple
    console.log('\n🧪 Testing simple user query...');
    const [users] = await sequelize.query("SELECT id, name, email FROM users LIMIT 1");
    console.log(`✅ Found ${users.length} user(s)`);
    
    // Tester la requête problématique
    console.log('\n🧪 Testing VCard with Users join...');
    const [vcards] = await sequelize.query(`
      SELECT 
        VCard.id, 
        VCard.name, 
        Users.id AS user_id, 
        Users.name AS user_name, 
        Users.email AS user_email,
        Users.created_at AS user_created_at,
        Users.isActive AS user_is_active,
        Users.role AS user_role
      FROM vcards AS VCard 
      LEFT OUTER JOIN users AS Users ON VCard.userId = Users.id 
      LIMIT 1
    `);
    
    console.log(`✅ VCard-Users join successful, found ${vcards.length} record(s)`);
    
    if (vcards.length > 0) {
      console.log('Sample record:', vcards[0]);
    }
    
  } catch (error) {
    console.error('❌ Error checking users table:', error.message);
    if (error.sql) {
      console.error('SQL:', error.sql);
    }
  } finally {
    await sequelize.close();
    process.exit(0);
  }
};

// Exécuter le test
checkUserTable();
