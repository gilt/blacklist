const AWS = require('aws-sdk'),
      dynamo = new AWS.DynamoDB();

exports.handler = (event, context, callback) => {
  withSupportedType(event, context, callback, function(notificationType) {
    dynamo.updateItem({
      TableName: process.env.TABLE_NAME,
      Key: { Id: { S: event.pathParameters.blacklist_id }, Type: { S: notificationType } },
      ExpressionAttributeValues: {
        ':d': { S: (new Date()).toISOString() }
      },
      UpdateExpression: 'SET DeletedAt=:d, UpdatedAt=:d'
    }, function(err, data) {
      if (err) return callback(err);
      callback(null, { statusCode: 200, body: JSON.stringify({ id: event.pathParameters.blacklist_id }) });
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
