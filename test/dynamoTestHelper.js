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
      callback(null, {});
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
      var matches = request.UpdateExpression.match(/\badd\s+(.+)/ig);
      if (matches) {
        isolateExpression(matches[0], 'add').split(',').forEach(function(keyValue) {
          var kv = keyValue.trim().split(/\s+/),
              key = kv[0].trim(),
              value = kv[1].trim();
          if (request.ExpressionAttributeNames && request.ExpressionAttributeNames[key]) key = request.ExpressionAttributeNames[key];
          if (request.ExpressionAttributeValues && request.ExpressionAttributeValues[value]) value = request.ExpressionAttributeValues[value];
          if (value.SS) {
            if (!item[key]) item[key] = {SS: []};
            item[key].SS = item[key].SS.concat(value.SS);
          } else if (value.N) {
            if (!item[key]) item[key] = 0;
            item[key] += value.N;
          }
        });
      }

      var matches = request.UpdateExpression.match(/\bset\s+(.+)/ig);
      if (matches) {
        isolateExpression(matches[0], 'set').split(',').forEach(function(keyValue) {
          var kv = keyValue.split('='),
              key = kv[0].trim(),
              value = kv[1].trim();
          if (request.ExpressionAttributeNames && request.ExpressionAttributeNames[key]) key = request.ExpressionAttributeNames[key];
          if (request.ExpressionAttributeValues && request.ExpressionAttributeValues[value]) value = request.ExpressionAttributeValues[value];
          item[key] = value;
        });
      }

      matches = request.UpdateExpression.match(/\bremove\s+(.+)/ig);
      if (matches) {
        isolateExpression(matches[0], 'remove').split(',').forEach(function(key) {
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
    console.log(JSON.stringify(item));
    this.objects[request.TableName][request.Key] = item;
    callback(null, {});
  }
}

function isolateExpression(str, currentTerm) {
  const terms = ['add', 'delete', 'set', 'REMOVE'];
  var result = str.replace(new RegExp('^' + currentTerm.toLowerCase(), 'ig'), '');
  terms.forEach(function(term) {
    if (term != currentTerm.toLowerCase()) result = result.replace(new RegExp('\\b' + term + '\\s+.*', 'ig'), '');
  });
  return result;
}