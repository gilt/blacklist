var assert = require('assert'),
    helper = require('../dynamoTestHelper'),
    lib = require('../../app/Delete');

process.env.TABLE_NAME = "blacklist";

describe('Delete', function() {
  beforeEach(function() {
    lib = helper.mockFor('../app/Delete');
  });

  afterEach(function() {
    helper.clear();
  });

  it('should successfully delete from the blacklist', function() {
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
      var rawValue = helper.get('2125555555', 'sms');
      assert.equal(rawValue.Id.S, '2125555555');
      assert.equal(rawValue.Type.S, 'sms');
      assert.notEqual(rawValue.DeletedAt, null);
      assert.notEqual(rawValue.DeletedAt.S, null);
      assert.notEqual(rawValue.UpdatedAt, null);
      assert.notEqual(rawValue.UpdatedAt.S, null);
    });
  });

  it('should not fail if the entry is not already blacklisted', function() {
    assert.equal(helper.get('2125555555', 'sms'), undefined);
    lib.handler({
      pathParameters: {
        blacklist_id: '2125555555',
        notification_type: 'sms'
      }
    }, null, function(err, data) {
      assert.equal(err, null);
      assert.equal(data.statusCode, 200);
      assert.deepEqual(JSON.parse(data.body), {id: '2125555555'});
      var rawValue = helper.get('2125555555', 'sms');
      assert.equal(rawValue.Id.S, '2125555555');
      assert.equal(rawValue.Type.S, 'sms');
      assert.notEqual(rawValue.DeletedAt, null);
      assert.notEqual(rawValue.DeletedAt.S, null);
      assert.notEqual(rawValue.UpdatedAt, null);
      assert.notEqual(rawValue.UpdatedAt.S, null);
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