const AWS = require('aws-sdk'),
      dynamo = new AWS.DynamoDB(),
      sns = new AWS.SNS();

exports.handler = (event, context, callback) => {
  const moMessageXml = event.body;
  console.info(moMessageXml);
  if (messageMatch = moMessageXml.match(/<message>(.*)<\/message>/)) {
    if (messageMatch[1].toLowerCase().match(process.env.STOP_WORDS)) { // STOP_WORDS should be a Regex
      if (originNumberMatch = moMessageXml.match(/<\s*source\s+.*?address\s*=\s*["'](.*?)["']/)) {
        var originNumber = sanitizeNumber(originNumberMatch[1]);
        dynamo.updateItem({
          TableName: event.stageVariables.TABLE_NAME,
          Key: { Id: { S: originNumber }, Type: { S: 'sms' } },
          ExpressionAttributeNames: { '#l': 'Log' },
          ExpressionAttributeValues: {
            ':d': { S: (new Date()).toISOString() },
            ':m': { SS: [ moMessageXml ] }
          },
          UpdateExpression: 'SET UpdatedAt=:d ADD #l :m REMOVE DeletedAt'
        }, function(err, data) {
          if (err) return callback(err);
          sns.publish({
            Message: JSON.stringify({
              phone_number: originNumber
            }),
            TopicArn: event.stageVariables.NOTIFICATION_QUEUE
          }, function(err, data) {
            if (err) return callback(err);
            callback(null, { statusCode: 200, body: JSON.stringify({ id: originNumber }) });
          })
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
