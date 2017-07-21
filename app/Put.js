const AWS = require('aws-sdk'),
      dynamo = new AWS.DynamoDB();

exports.handler = (event, context, callback) => {
  console.info(toMessageString(event));
  const blacklistId = sanitizeNumber(event.pathParameters.blacklist_id);
  withSupportedType(event, context, callback, function(notificationType) {
    withQueryStringAsMetaData(
      event.queryStringParameters,
      { '#l': 'Log' },
      {
        ':d': { S: (new Date()).toISOString() },
        ':l': { SS: [ toMessageString(event) ] }
      },
      '#l :l',
      function(attrNames, attrValues, addExpr) {
        dynamo.updateItem({
          TableName: event.stageVariables.TABLE_NAME,
          Key: { Id: { S: blacklistId }, Type: { S: notificationType } },
          ExpressionAttributeNames: attrNames,
          ExpressionAttributeValues: attrValues,
          UpdateExpression: 'SET UpdatedAt=:d ADD ' + addExpr + ' REMOVE DeletedAt'
        }, function(err, data) {
          if (err) return callback(err);
          callback(null, { statusCode: 200, body: JSON.stringify({ id: blacklistId }) });
        })
      }
    );
  });
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

function withSupportedType(event, context, lambdaCallback, callback) {
  const supportedTypes = ['sms'];
  if (supportedTypes.indexOf(event.pathParameters.notification_type.toLowerCase()) >= 0) {
    callback(event.pathParameters.notification_type.toLowerCase());
  } else {
    lambdaCallback(null, { statusCode: 400, body: JSON.stringify({ message: 'Notification type [' + event.pathParameters.notification_type + '] not supported.' }) });
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

function toMessageString(event) {
  return JSON.stringify({
    httpMethod: event.httpMethod,
    pathParameters: event.pathParameters,
    queryStringParameters: event.queryStringParameters
  })
}
