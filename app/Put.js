const AWS = require('aws-sdk'),
      dynamo = new AWS.DynamoDB();

exports.handler = (event, context, callback) => {
  const blacklistId = event.pathParameters.blacklist_id;
  withSupportedType(event, context, callback, function(notificationType) {
    dynamo.updateItem({
      TableName: process.env.TABLE_NAME,
      Key: { Id: { S: blacklistId }, Type: { S: notificationType } },
      ExpressionAttributeValues: {
        ':d': { S: (new Date()).toISOString() }
      },
      UpdateExpression: 'SET UpdatedAt=:d REMOVE DeletedAt'
    }, function(err, data) {
      if (err) return callback(err);
      callback(null, { statusCode: 200, body: JSON.stringify({ id: blacklistId }) });
    })
  });
}

function withSupportedType(event, context, lambdaCallback, callback) {
  const supportedTypes = ['sms'];
  if (supportedTypes.indexOf(event.pathParameters.notification_type.toLowerCase()) >= 0) {
    callback(event.pathParameters.notification_type.toLowerCase());
  } else {
    lambdaCallback(null, { statusCode: 400, body: JSON.stringify({ message: 'Notification type [' + event.pathParameters.notification_type + '] not supported.' }) });
  }
}
