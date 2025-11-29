const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');

const config = {
  host: process.env.HOST,
  user: process.env.USER,
  password: process.env.PASSWORD,
  database: process.env.DATABASE,
  port: 11742,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 120000,   // ⚡ à la racine (pas dans dialectOptions)
  multipleStatements: true, // ⚡ idem
  charset: 'utf8mb4',       // ⚡ idem
};

const connection = mysql.createConnection(config);

const initializeDatabase = () => {
  return new Promise((resolve, reject) => {
    connection.query('CREATE DATABASE IF NOT EXISTS pfe_project', (err) => {
      if (err) {
        console.error('Error creating the database:', err);
        return reject(err);
      }

      console.log('“pfe_project” database created or already existing.');
      resolve();
    });
  });
};

connection.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
    return;
  }

  console.log('✅ Connected to MySQL!');

  initializeDatabase()
    .then(() => {
      console.log('✅ Database ready to use.');
    })
    .catch((err) => {
      console.error('❌ Error during database initialization:', err);
    });
});

module.exports = connection;
