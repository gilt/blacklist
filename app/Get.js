const AWS = require('aws-sdk'),
      dynamo = new AWS.DynamoDB();

exports.handler = (event, context, callback) => {
  console.info(toMessageString(event));
  const blacklistId = sanitizeNumber(event.pathParameters.blacklist_id);
  withSupportedType(event, context, callback, function(notificationType) {
    dynamo.getItem({
      TableName: event.stageVariables.TABLE_NAME,
      Key: { Id: { S: blacklistId }, Type: { S: notificationType } }
    }, function(err, data) {
      if (err) return callback(err);
      if ((data && data.Item && afterNow(data, "DeletedAt") && matchesFilter(event, data.Item)) || !onWhitelist(blacklistId, event.stageVariables.WHITELIST)) {
        callback(null, { statusCode: 200, body: JSON.stringify({ id: blacklistId }) });
      } else {
        callback(null, { statusCode: 404, body: JSON.stringify({ message: "Entry not blacklisted" }) });
      }
    })
  });
}

function afterNow(data, propertyName) {
  if (data && data.Item && data.Item[propertyName] && data.Item[propertyName].S) {
    return Date.parse(data.Item[propertyName].S) >= new Date();
  } else {
    return true;
  }
}

function matchesFilter(event, item) {
  const queryStringParams = event.queryStringParameters || {};
  return queryStringParams.length == 0 || Object.keys(queryStringParams).every(function(key) {
    const k = sanitizeString(key),
          values = item['MetaData.' + k] || { SS: [] };
    return !values || !values.SS || values.SS.includes(queryStringParams[key]);
  });
}

// Set the whitelist in staging to only allow certain entries.
function onWhitelist(blacklistId, whitelist) {
  if (whitelist && whitelist.trim() != '') {
    const whitelisted = whitelist.split(',');
    return whitelisted.findIndex(function(item) { return blacklistId == item.trim(); }) >= 0;
  } else {
    return true;
  }
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
