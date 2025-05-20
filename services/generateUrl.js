const { v4: uuidv4 } = require("uuid");
const slugify = require("slugify");

const generateUniqueUrl = (name) => {
  const uniqueId = uuidv4().substring(0, 8); 

  const slug = slugify(name, {
    lower: true,
    strict: true, 
  });

  return `${slug}-${uniqueId}`;
};

module.exports ={generateUniqueUrl};