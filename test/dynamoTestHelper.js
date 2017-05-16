const AWS = require('aws-sdk'),
      sinon = require('sinon');

exports.clear = function() {
  AWS.DynamoDB.restore();
  mockDynamo.clear();
}

exports.get = function(blacklistId, notificationType) {
  if (mockDynamo.objects[process.env.TABLE_NAME]) {
    return mockDynamo.objects[process.env.TABLE_NAME][{id:{S:blacklistId},type:{S:notificationType}}];
  }
}

exports.mockFor = function(lib) {
  sinon.stub(AWS, 'DynamoDB').returns(mockDynamo);
  return refreshRequire(lib);
}

exports.put = function(value) {
  if (!mockDynamo.objects[process.env.TABLE_NAME]) mockDynamo.objects[process.env.TABLE_NAME] = {};
  mockDynamo.objects[process.env.TABLE_NAME][{id:{S:value.id},type:{S:value.type}}] = value;
}

function refreshRequire(lib) {
  delete require.cache[require.resolve(lib)];
  return require(lib);
}

var mockDynamo = {
  'objects': {},
  'clear': function() {
    this.objects = {};
  },
  'getItem': function(request, callback) {
    if (this.objects[request.TableName]) {
      callback(null, {
        Item: this.objects[request.TableName][request.Key]
      });
    } else {
      callback(null, null);
    }
  },
  'putItem': function(request, callback) {
    if (!this.objects[request.TableName]) this.objects[request.TableName] = {};
    this.objects[request.TableName][request.Key] = request.Item;
    callback(null, {});
  },
  'updateItem': function(request, callback) {
    if (!this.objects[request.TableName]) this.objects[request.TableName] = {};
    var item = this.objects[request.TableName][request.Key];
    if (!item) item = {};
    if (request.AttributeUpdates) {
      var keys = Object.keys(request.AttributeUpdates);
      for (var i = 0; i < keys.length; i++) {
        var value = request.AttributeUpdates[keys[i]];
        if (value.Action == 'DELETE') {
          delete item[keys[i]]
        } else {
          item[keys[i]] = value.Value;
        }
      }
    }
    if (request.UpdateExpression) {
      var matches = request.UpdateExpression.match(/(set)\s+([^\s=]+\s*=\s*[^\s=]+\s*,?\s*)+/ig);
      if (matches) {
        matches[0].substring(3,matches[0].length).split(',').forEach(function(keyValue) {
          var kv = keyValue.split('='),
              key = kv[0].trim(),
              value = kv[1].trim();
          if (request.ExpressionAttributeNames && request.ExpressionAttributeNames[key]) key = request.ExpressionAttributeNames[key];
          if (request.ExpressionAttributeValues && request.ExpressionAttributeValues[value]) value = request.ExpressionAttributeValues[value];
          item[key] = value;
        });
      }

      matches = request.UpdateExpression.match(/(remove)\s+([^\s]+\s*)+/ig);
      if (matches) {
        matches[0].substring(6, matches[0].length).split(',').forEach(function(key) {
          key = key.trim();
          if (request.ExpressionAttributeNames && request.ExpressionAttributeNames[key]) key = request.ExpressionAttributeNames[key];
          delete item[key];
        });
      }
    }
    keys = Object.keys(request.Key);
    for (var i = 0; i < keys.length; i++) {
      item[keys[i]] = request.Key[keys[i]];
    }
    this.objects[request.TableName][request.Key] = item;
    callback(null, {});
  }
}