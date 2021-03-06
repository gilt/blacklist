var assert = require('assert'),
    common = require('../testHelper'),
    helper = require('../dynamoTestHelper'),
    lib = require('../../app/Put');

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
          },
          stageVariables: { TABLE_NAME: common.tableName }
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
          },
          stageVariables: { TABLE_NAME: common.tableName }
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

      it('should keep track of messages', function() {
        assert.equal(helper.get('2125555555', 'sms'), undefined);
        const message = JSON.stringify({
          httpMethod: 'PUT',
          pathParameters: {
            blacklist_id: phoneNumber,
            notification_type: 'sms'
          }
        })
        lib.handler({
          httpMethod: 'PUT',
          pathParameters: {
            blacklist_id: phoneNumber,
            notification_type: 'sms'
          },
          stageVariables: { TABLE_NAME: common.tableName }
        }, null, function(err, data) {
          assert.equal(err, null);
          assert.equal(data.statusCode, 200);
          assert.deepEqual(JSON.parse(data.body), {id: '2125555555'});
          var rawValue = helper.get('2125555555', 'sms');
          assert.equal(rawValue.Id.S, '2125555555');
          assert.equal(rawValue.Type.S, 'sms');
          assert.deepEqual(rawValue.Log.SS, [message]);
          lib.handler({
            httpMethod: 'PUT',
            pathParameters: {
              blacklist_id: phoneNumber,
              notification_type: 'sms'
            },
            stageVariables: { TABLE_NAME: common.tableName }
          }, null, function(err, data) {
            assert.equal(err, null);
            assert.equal(data.statusCode, 200);
            assert.deepEqual(JSON.parse(data.body), {id: '2125555555'});
            var rawValue = helper.get('2125555555', 'sms');
            assert.equal(rawValue.Id.S, '2125555555');
            assert.equal(rawValue.Type.S, 'sms');
            assert.deepEqual(rawValue.Log.SS, [message, message]);
          });
        });
      });

      it('should not allow invalid notification types', function() {
        lib.handler({
          pathParameters: {
            blacklist_id: phoneNumber,
            notification_type: 'invalid'
          },
          stageVariables: { TABLE_NAME: common.tableName }
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
          },
          stageVariables: { TABLE_NAME: common.tableName }
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

      it('should store querystring parameters as MetaData', function() {
        assert.equal(helper.get('2125555555', 'sms'), undefined);
        lib.handler({
          pathParameters: {
            blacklist_id: phoneNumber,
            notification_type: 'sms'
          },
          stageVariables: { TABLE_NAME: common.tableName },
          queryStringParameters: { origin: "website" }
        }, null, function(err, data) {
          assert.equal(err, null);
          assert.equal(data.statusCode, 200);
          var rawValue = helper.get('2125555555', 'sms');
          assert.deepEqual(rawValue['MetaData.origin'].SS, ['website']);
        });
      });

      it('should store multiple querystring parameters', function() {
        assert.equal(helper.get('2125555555', 'sms'), undefined);
        lib.handler({
          pathParameters: {
            blacklist_id: phoneNumber,
            notification_type: 'sms'
          },
          stageVariables: { TABLE_NAME: common.tableName },
          queryStringParameters: { origin: "website", short_code: "12345" }
        }, null, function(err, data) {
          lib.handler({
            pathParameters: {
              blacklist_id: phoneNumber,
              notification_type: 'sms'
            },
            stageVariables: { TABLE_NAME: common.tableName },
            queryStringParameters: { origin: "mobile" }
          }, null, function(err, data) {
            assert.equal(err, null);
            assert.equal(data.statusCode, 200);
            var rawValue = helper.get('2125555555', 'sms');
            assert.deepEqual(rawValue['MetaData.origin'].SS, ['website', 'mobile']);
            assert.deepEqual(rawValue['MetaData.short_code'].SS, ['12345']);
          });
        });
      });

      it('should sanitize querystring parameter names', function() {
        assert.equal(helper.get('2125555555', 'sms'), undefined);
        lib.handler({
          pathParameters: {
            blacklist_id: phoneNumber,
            notification_type: 'sms'
          },
          stageVariables: { TABLE_NAME: common.tableName },
          queryStringParameters: { "origin.$va!lid": "website" }
        }, null, function(err, data) {
          assert.equal(err, null);
          assert.equal(data.statusCode, 200);
          var rawValue = helper.get('2125555555', 'sms');
          assert.deepEqual(rawValue['MetaData.origin_va_lid'].SS, ['website']);
        });
      });
    });
  });
});