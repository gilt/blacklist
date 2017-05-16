const AWS = require('aws-sdk'),
      dynamo = new AWS.DynamoDB();

exports.handler = (event, context, callback) => {
  const blacklistId = sanitizeNumber(event.pathParameters.blacklist_id);
  withSupportedType(event, context, callback, function(notificationType) {
    dynamo.getItem({
      TableName: process.env.TABLE_NAME,
      Key: { Id: blacklistId, Type: notificationType }
    }, function(err, data) {
      if (err) return callback(err);
      if ((data && afterNow(data, "DeletedAt")) || !onWhitelist(blacklistId)) {
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

function onWhitelist(blacklistId) {
  // Set the whitelist in staging to only allow certain entries.
  var whitelist = process.env.WHITELIST;
  if (whitelist && whitelist.trim() != '') {
    const whitelisted = process.env.WHITELIST.split(',');
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
