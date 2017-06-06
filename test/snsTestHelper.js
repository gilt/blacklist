const AWS = require('aws-sdk'),
      common = require('./testHelper'),
      sinon = require('sinon');

exports.clear = function() {
  AWS.SNS.restore();
  mockSns.clear();
}

exports.getMessages = function(topicArn) {
  console.log(mockSns.objects);
  var obj = mockSns.objects[topicArn];
  if (obj) {
    return Object.keys(obj).map(function(key){return obj[key]});
  } else {
    return [];
  }
}

exports.mockFor = function(lib) {
  sinon.stub(AWS, 'SNS').returns(mockSns);
  return refreshRequire(lib);
}

function refreshRequire(lib) {
  delete require.cache[require.resolve(lib)];
  return require(lib);
}

var mockSns = {
  'objects': {},
  'clear': function() {
    this.objects = {};
  },
  'publish': function(request, callback) {
    if (!this.objects[request.TopicArn]) this.objects[request.TopicArn] = {};
    var id = (new Date()).getTime().toString();
    this.objects[request.TopicArn][id] = request.Message
    callback(null, {
      MessageId: id
    });
  }
}