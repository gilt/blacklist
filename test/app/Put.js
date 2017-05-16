var assert = require('assert'),
    common = require('../testHelper'),
    helper = require('../dynamoTestHelper'),
    lib = require('../../app/Put');

process.env.TABLE_NAME = "blacklist";

describe('Put', function() {
  common.sanitizationVariants.forEach(function(phoneNumber) {
    describe('Variant ' + phoneNumber, function() {
      beforeEach(function() {
        lib = helper.mockFor('../app/Put');
      });

      afterEach(function() {
        helper.clear();
      });

      it('should successfully add to the blacklist', function() {
        assert.equal(helper.get('2125555555', 'sms'), undefined);
        lib.handler({
          pathParameters: {
            blacklist_id: phoneNumber,
            notification_type: 'sms'
          }
        }, null, function(err, data) {
          assert.equal(err, null);
          assert.equal(data.statusCode, 200);
          assert.deepEqual(JSON.parse(data.body), {id: '2125555555'});
          var rawValue = helper.get('2125555555', 'sms');
          assert.equal(rawValue.Id.S, '2125555555');
          assert.equal(rawValue.Type.S, 'sms');
          assert.notEqual(rawValue.UpdatedAt, null);
          assert.notEqual(rawValue.UpdatedAt.S, null);
        });
      });

      it('should successfully update the blacklist without dropping existing properties', function() {
        helper.put({Id:{S:'2125555555'},Type:{S:'sms'},Foo:{S:'Bar'}});
        lib.handler({
          pathParameters: {
            blacklist_id: phoneNumber,
            notification_type: 'sms'
          }
        }, null, function(err, data) {
          assert.equal(err, null);
          assert.equal(data.statusCode, 200);
          assert.deepEqual(JSON.parse(data.body), {id: '2125555555'});
          var rawValue = helper.get('2125555555', 'sms');
          assert.equal(rawValue.Id.S, '2125555555');
          assert.equal(rawValue.Type.S, 'sms');
          assert.notEqual(rawValue.UpdatedAt, null);
          assert.notEqual(rawValue.UpdatedAt.S, null);
          assert.equal(rawValue.Foo.S, 'Bar');
        });
      });

      it('should not allow invalid notification types', function() {
        lib.handler({
          pathParameters: {
            blacklist_id: phoneNumber,
            notification_type: 'invalid'
          }
        }, null, function(err, data) {
          assert.equal(err, null);
          assert.equal(data.statusCode, 400);
          assert.deepEqual(JSON.parse(data.body), {message: 'Notification type [invalid] not supported.'});
          assert.equal(helper.get('2125555555', 'invalid'), undefined)
        });
      });

      it('should remove the DeletedAt property when present', function() {
        helper.put({Id:{S:'2125555555'},Type:{S:'sms'},DeletedAt:{S: '2017-01-01 00:00:00'}});
        lib.handler({
          pathParameters: {
            blacklist_id: phoneNumber,
            notification_type: 'sms'
          }
        }, null, function(err, data) {
          assert.equal(err, null);
          assert.equal(data.statusCode, 200);
          assert.deepEqual(JSON.parse(data.body), {id: '2125555555'});
          var rawValue = helper.get('2125555555', 'sms');
          assert.equal(rawValue.Id.S, '2125555555');
          assert.equal(rawValue.Type.S, 'sms');
          assert.notEqual(rawValue.UpdatedAt, null);
          assert.notEqual(rawValue.UpdatedAt.S, null);
        });
      });
    });
  });
});