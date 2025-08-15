const webpush = require('web-push');

const vapidKeys = webpush.generateVAPIDKeys();

console.log("private key: ", vapidKeys.privateKey);
console.log("public key: ", vapidKeys.publicKey);
