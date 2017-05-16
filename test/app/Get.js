var assert = require('assert'),
    helper = require('../dynamoTestHelper'),
    lib = require('../../app/Get');

process.env.TABLE_NAME = "blacklist";

describe('Get', function() {
  beforeEach(function() {
    lib = helper.mockFor('../app/Get');
  });

  afterEach(function() {
    helper.clear();
  });

  it('should return 404 when the number is not on the blacklist', function() {
    assert.equal(helper.get('2125555555', 'sms'), undefined);
    lib.handler({
      pathParameters: {
        blacklist_id: '2125555555',
        notification_type: 'sms'
      }
    }, null, function(err, data) {
      assert.equal(err, null);
      assert.equal(data.statusCode, 404);
      assert.deepEqual(JSON.parse(data.body), {message: 'Entry not blacklisted'});
    });
  });

  it('should successfully return an entry from the blacklist', function() {
    helper.put({Id:{S:'2125555555'},Type:{S:'sms'}});
    lib.handler({
      pathParameters: {
        blacklist_id: '2125555555',
        notification_type: 'sms'
      }
    }, null, function(err, data) {
      assert.equal(err, null);
      assert.equal(data.statusCode, 200);
      assert.deepEqual(JSON.parse(data.body), {id: '2125555555'});
    });
  });

  it('should return a 404 if the entry is deleted', function() {
    helper.put({Id:{S:'2125555555'},Type:{S:'sms'},DeletedAt:{S: '2017-01-01 00:00:00'}});
    lib.handler({
      pathParameters: {
        blacklist_id: '2125555555',
        notification_type: 'sms'
      }
    }, null, function(err, data) {
      assert.equal(err, null);
      assert.equal(data.statusCode, 404);
      assert.deepEqual(JSON.parse(data.body), {message: 'Entry not blacklisted'});
    });
  });

  it('should return an entry if it is deleted in the future (i.e. an expiration)', function() {
    var nextYear = new Date();
    nextYear.setYear(nextYear.getFullYear() + 1);
    helper.put({Id:{S:'2125555555'},Type:{S:'sms'},DeletedAt:{S: nextYear.toISOString()}});
    lib.handler({
      pathParameters: {
        blacklist_id: '2125555555',
        notification_type: 'sms'
      }
    }, null, function(err, data) {
      assert.equal(err, null);
      assert.equal(data.statusCode, 200);
      assert.deepEqual(JSON.parse(data.body), {id: '2125555555'});
    });
  });

  it('should successfully return an entry as blacklisted if there is a whitelist and it is not on the whitelist', function() {
    process.env.WHITELIST = '2125555550, 2125555551';
    lib.handler({
      pathParameters: {
        blacklist_id: '2125555555',
        notification_type: 'sms'
      }
    }, null, function(err, data) {
      assert.equal(err, null);
      assert.equal(data.statusCode, 200);
      assert.deepEqual(JSON.parse(data.body), {id: '2125555555'});
    });
  });

  it('should return a 404 if there is a whitelist and it is on the whitelist', function() {
    process.env.WHITELIST = '2125555555, 2125555550';
    lib.handler({
      pathParameters: {
        blacklist_id: '2125555555',
        notification_type: 'sms'
      }
    }, null, function(err, data) {
      assert.equal(err, null);
      assert.equal(data.statusCode, 404);
      assert.deepEqual(JSON.parse(data.body), {message: 'Entry not blacklisted'});
    });
  });

  it('should return a 404 by ignoring the whitelist if it is empty', function() {
    process.env.WHITELIST = ' ';
    lib.handler({
      pathParameters: {
        blacklist_id: '2125555555',
        notification_type: 'sms'
      }
    }, null, function(err, data) {
      assert.equal(err, null);
      assert.equal(data.statusCode, 404);
      assert.deepEqual(JSON.parse(data.body), {message: 'Entry not blacklisted'});
    });
  });

  it('should not allow invalid notification types', function() {
    lib.handler({
      pathParameters: {
        blacklist_id: '2125555555',
        notification_type: 'invalid'
      }
    }, null, function(err, data) {
      assert.equal(err, null);
      assert.equal(data.statusCode, 400);
      assert.deepEqual(JSON.parse(data.body), {message: 'Notification type [invalid] not supported.'});
      assert.equal(helper.get('2125555555', 'invalid'), undefined)
    });
  });
});