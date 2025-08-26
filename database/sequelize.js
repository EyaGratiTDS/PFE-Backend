const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DATABASE,
  process.env.USER, 
  process.env.PASSWORD, 
  {
    host: process.env.HOST,
    dialect: "mysql",
    port: 48418,
    logging: false,
    pool: {
    max: 5,
    min: 0,
    acquire: 120000,
    idle: 60000,
    evict: 1000,
    handleDisconnects: true
  },
  retry: {
    match: [
      /PROTOCOL_CONNECTION_LOST/,
      /ECONNREFUSED/,
      /ENOTFOUND/,
      /EHOSTUNREACH/,
      /ETIMEDOUT/,
      /ECONNRESET/,
      /SequelizeConnectionError/,
      /SequelizeConnectionRefusedError/,
      /SequelizeHostNotFoundError/,
      /SequelizeHostNotReachableError/,
      /SequelizeInvalidConnectionError/,
      /SequelizeConnectionTimedOutError/
    ],
    max: 5
  }
});

async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection successfully established.');
  } catch (error) {
    console.error('❌ Unable to connect to the database:');
    console.error(`   Host: ${process.env.HOST || "mysql-2eff92c3-eyagrati02-743b.l.aivencloud.com"}`);
    console.error(`   Database: ${process.env.DATABASE || "pfe_project"}`);
    console.error(`   User: ${process.env.USER || "avnadmin"}`);
    console.error(`   Error: ${error.message}`);
    
    if (error.original) {
      console.error(`   Original error: ${error.original.message}`);
      console.error(`   Code: ${error.original.code}`);
    }
  }
}

testConnection();

module.exports = sequelize;