const db = require('../models');

console.log('📋 Available models in database:');
console.log('Models:', Object.keys(db).filter(key => key !== 'sequelize' && key !== 'Sequelize'));

console.log('\n🔗 CustomDomain associations:');
if (db.CustomDomain && db.CustomDomain.associations) {
  Object.keys(db.CustomDomain.associations).forEach(assoc => {
    const association = db.CustomDomain.associations[assoc];
    console.log(`- ${assoc}: ${association.associationType} with ${association.target.name}`);
  });
} else {
  console.log('No CustomDomain model or associations found');
}

console.log('\n🔗 VCard associations:');
if (db.VCard && db.VCard.associations) {
  Object.keys(db.VCard.associations).forEach(assoc => {
    const association = db.VCard.associations[assoc];
    console.log(`- ${assoc}: ${association.associationType} with ${association.target.name}`);
  });
} else {
  console.log('No VCard model or associations found');
}

console.log('\n🔗 Users associations:');
if (db.Users && db.Users.associations) {
  Object.keys(db.Users.associations).forEach(assoc => {
    const association = db.Users.associations[assoc];
    console.log(`- ${assoc}: ${association.associationType} with ${association.target.name}`);
  });
} else {
  console.log('No Users model or associations found');
}

process.exit(0);
