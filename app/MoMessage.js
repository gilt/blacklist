const AWS = require('aws-sdk'),
      dynamo = new AWS.DynamoDB(),
      sns = new AWS.SNS();

exports.handler = (event, context, callback) => {
  const moMessageXml = event.body;
  console.info(moMessageXml);
  if (messageMatch = moMessageXml.match(/<message>(.*)<\/message>/)) {
    if (messageMatch[1].toLowerCase().match(process.env.STOP_WORDS)) { // STOP_WORDS should be a Regex
      if (originNumberMatch = moMessageXml.match(/<\s*source\s+.*?address\s*=\s*["'](.*?)["']/)) {
        const originNumber = sanitizeNumber(originNumberMatch[1]),
              shortCodeMatch = moMessageXml.match(/<\s*destination\s+.*?address\s*=\s*["'](.*?)["']/),
              shortCode = (shortCodeMatch ? shortCodeMatch[1] : '');
        withQueryStringAsMetaData(
          event.queryStringParameters,
          { '#l': 'Log', '#short_code': 'MetaData.short_code' },
          {
            ':d': { S: (new Date()).toISOString() },
            ':l': { SS: [ toMessageString(event) ] },
            ':short_code': { SS: [ shortCode ] }
          },
          '#l :l, #short_code :short_code',
          function(attrNames, attrValues, addExpr) {
            dynamo.updateItem({
              TableName: event.stageVariables.TABLE_NAME,
              Key: { Id: { S: originNumber }, Type: { S: 'sms' } },
              ExpressionAttributeNames: attrNames,
              ExpressionAttributeValues: attrValues,
              UpdateExpression: 'SET UpdatedAt=:d ADD ' + addExpr + ' REMOVE DeletedAt'
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
          }
        );
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

function sanitizeString(raw) {
  return raw.replace(/\W+/g, '_').toLowerCase();
}

function withQueryStringAsMetaData(queryStringParams, attrNames, attrValues, addExpr, callback) {
  queryStringParams = queryStringParams || {};
  Object.keys(queryStringParams).forEach(function(key) {
    const k = sanitizeString(key);
    attrNames['#' + k] = 'MetaData.' + k;
    attrValues[':' + k] = { SS: [ queryStringParams[key] ]};
    if (addExpr.trim() != '') addExpr += ', ';
    addExpr += '#' + k + ' :' + k;
  });
  callback(attrNames, attrValues, addExpr);
}

function toMessageString(event) {
  return JSON.stringify({
    body: event.body,
    queryStringParameters: event.queryStringParameters
  })
}