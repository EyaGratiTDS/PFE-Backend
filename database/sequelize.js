const { Sequelize } = require('sequelize');

const sequelize = new Sequelize("pfe_project", "root", "", {
  host: "localhost",
  dialect: "mysql",
  port: 3306,
  logging: false 
});

async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log('Database connection successfully established.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
}

testConnection();

module.exports = sequelize;