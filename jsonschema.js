const queueIDregex = /^((?!_) \w){10}$/i;
const queueIDinputSchema = {
  "type":"string",
  "pattern": queueIDregex
}

const customerIDregex = /^\d{10}$/i;
const customerIDinputSchema = {
  "type":"string",
  "pattern": customerIDregex
}

// 10-character Alphanumeric strinng
const checkQueueID = {
  type: 'string',
  pattern: '^[a-zA-Z0-9_]*$',
  minLength: 10,
  maxLength: 10
}

// Max No. of minutes worth of data to receive
const checkDuration = {
  type: 'integer',
  minimum: 1,
  maximum: 1440
}

const jasonschema = require('jsonschema');

function valid(instance, schema) {
  if ((jasonschema.validate(instance, schema).errors.length) == 0) {
      return true;
  } else {
      return false;
  }
}

module.exports = {
  checkQueueID,
  valid,
  checkDuration,
  customerIDinputSchema,
  queueIDinputSchema,

}