const AWS = require('aws-sdk'),
      dynamo = new AWS.DynamoDB();

exports.handler = (event, context, callback) => {
  const moMessageXml = event.body;
  if (messageMatch = moMessageXml.match(/<message>(.*)<\/message>/)) {
    if (messageMatch[1].toLowerCase().match(process.env.STOP_WORDS)) { // STOP_WORDS should be a Regex
      if (originNumberMatch = moMessageXml.match(/<\s*source\s+.*?address\s*=\s*["'](.*?)["']/)) {
        var originNumber = sanitizeNumber(originNumberMatch[1]);
        dynamo.updateItem({
          TableName: process.env.TABLE_NAME,
          Key: { Id: { S: originNumber }, Type: { S: 'sms' } },
          ExpressionAttributeValues: {
            ':d': { S: (new Date()).toISOString() }
          },
          UpdateExpression: 'SET UpdatedAt=:d REMOVE DeletedAt'
        }, function(err, data) {
          if (err) return callback(err);
          callback(null, { statusCode: 200, body: JSON.stringify({ id: originNumber }) });
        });
      } else {
        callback(null, { statusCode: 400, body: JSON.stringify({ message: 'Missing source address' }) });
      }
    } else {
      callback(null, { statusCode: 200, body: JSON.stringify({ id: '' }) });
    }
  } else {
    callback(null, { statusCode: 400, body: JSON.stringify({ message: 'Invalid message xml' }) });
  }
}

function sanitizeNumber(raw) {
  var numbers = raw.replace(/[^\d]+/g, '');
  if (numbers.match(/^1\d{10}$/)) numbers = numbers.substring(1, 11);
  return numbers;
}
