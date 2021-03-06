var assert = require('assert'),
    common = require('../testHelper'),
    helper = require('../dynamoTestHelper'),
    lib = require('../../app/Get');

describe('Get', function() {
  common.sanitizationVariants.forEach(function(phoneNumber) {
    describe('Variant ' + phoneNumber, function() {
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
          },
          stageVariables: { TABLE_NAME: common.tableName }
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
          },
          stageVariables: { TABLE_NAME: common.tableName }
        }, null, function(err, data) {
          assert.equal(err, null);
          assert.equal(data.statusCode, 200);
          assert.deepEqual(JSON.parse(data.body), {id: '2125555555'});
        });
      });

      it('should successfully return an entry from the blacklist if it matches the filter', function() {
        helper.put({Id:{S:'2125555555'},Type:{S:'sms'},"MetaData.short_code":{SS: ['12345']}});
        lib.handler({
          pathParameters: {
            blacklist_id: '2125555555',
            notification_type: 'sms'
          },
          stageVariables: { TABLE_NAME: common.tableName },
          queryStringParameters: { short_code: '12345'}
        }, null, function(err, data) {
          assert.equal(err, null);
          assert.equal(data.statusCode, 200);
          assert.deepEqual(JSON.parse(data.body), {id: '2125555555'});
        });
      });

      it('should successfully return an entry from the blacklist if it matches a multi-filter', function() {
        helper.put({Id:{S:'2125555555'},Type:{S:'sms'},"MetaData.short_code":{SS: ['12345', '67890']},"MetaData.origin":{SS: ['mobile','website']}});
        lib.handler({
          pathParameters: {
            blacklist_id: '2125555555',
            notification_type: 'sms'
          },
          stageVariables: { TABLE_NAME: common.tableName },
          queryStringParameters: { short_code: '12345', origin: 'website'}
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
          },
          stageVariables: { TABLE_NAME: common.tableName }
        }, null, function(err, data) {
          assert.equal(err, null);
          assert.equal(data.statusCode, 404);
          assert.deepEqual(JSON.parse(data.body), {message: 'Entry not blacklisted'});
        });
      });

      it('should return a 404 if the entry does not match the filter', function() {
        helper.put({Id:{S:'2125555555'},Type:{S:'sms'},"MetaData.short_code":{SS: ['12345']}});
        lib.handler({
          pathParameters: {
            blacklist_id: '2125555555',
            notification_type: 'sms'
          },
          stageVariables: { TABLE_NAME: common.tableName },
          queryStringParameters: { short_code: '54321'}
        }, null, function(err, data) {
          assert.equal(err, null);
          assert.equal(data.statusCode, 404);
          assert.deepEqual(JSON.parse(data.body), {message: 'Entry not blacklisted'});
        });
      });

      it('should return a 404 if the entry does not match the multi-filter', function() {
        helper.put({Id:{S:'2125555555'},Type:{S:'sms'},"MetaData.short_code":{SS: ['12345']},"MetaData.origin":{SS: ['website']}});
        lib.handler({
          pathParameters: {
            blacklist_id: '2125555555',
            notification_type: 'sms'
          },
          stageVariables: { TABLE_NAME: common.tableName },
          queryStringParameters: { short_code: '54321', origin: 'mobile' }
        }, null, function(err, data) {
          assert.equal(err, null);
          assert.equal(data.statusCode, 404);
          assert.deepEqual(JSON.parse(data.body), {message: 'Entry not blacklisted'});
        });
      });

      it('should return a 404 if there is a filter but the entry does not have MetaData', function() {
        helper.put({Id:{S:'2125555555'},Type:{S:'sms'}});
        lib.handler({
          pathParameters: {
            blacklist_id: '2125555555',
            notification_type: 'sms'
          },
          stageVariables: { TABLE_NAME: common.tableName },
          queryStringParameters: { short_code: '54321' }
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
          },
          stageVariables: { TABLE_NAME: common.tableName }
        }, null, function(err, data) {
          assert.equal(err, null);
          assert.equal(data.statusCode, 200);
          assert.deepEqual(JSON.parse(data.body), {id: '2125555555'});
        });
      });

      it('should successfully return an entry as blacklisted if there is a whitelist and it is not on the whitelist', function() {
        lib.handler({
          pathParameters: {
            blacklist_id: '2125555555',
            notification_type: 'sms'
          },
          stageVariables: { TABLE_NAME: common.tableName, WHITELIST: '2125555550, 2125555551' }
        }, null, function(err, data) {
          assert.equal(err, null);
          assert.equal(data.statusCode, 200);
          assert.deepEqual(JSON.parse(data.body), {id: '2125555555'});
        });
      });

      it('should return a 404 if there is a whitelist and it is on the whitelist', function() {
        lib.handler({
          pathParameters: {
            blacklist_id: '2125555555',
            notification_type: 'sms'
          },
          stageVariables: { TABLE_NAME: common.tableName, WHITELIST: '2125555555, 2125555550' }
        }, null, function(err, data) {
          assert.equal(err, null);
          assert.equal(data.statusCode, 404);
          assert.deepEqual(JSON.parse(data.body), {message: 'Entry not blacklisted'});
        });
      });

      it('should return a 404 by ignoring the whitelist if it is empty', function() {
        lib.handler({
          pathParameters: {
            blacklist_id: '2125555555',
            notification_type: 'sms'
          },
          stageVariables: { TABLE_NAME: common.tableName, WHITELIST: ' ' }
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
          },
          stageVariables: { TABLE_NAME: common.tableName }
        }, null, function(err, data) {
          assert.equal(err, null);
          assert.equal(data.statusCode, 400);
          assert.deepEqual(JSON.parse(data.body), {message: 'Notification type [invalid] not supported.'});
          assert.equal(helper.get('2125555555', 'invalid'), undefined)
        });
      });
    });
  });
});