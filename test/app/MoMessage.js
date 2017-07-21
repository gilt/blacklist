var assert = require('assert'),
    common = require('../testHelper'),
    dynamoHelper = require('../dynamoTestHelper'),
    snsHelper = require('../snsTestHelper'),
    lib = require('../../app/MoMessage');

process.env.STOP_WORDS = "(stop|unsubscribe)"

const moMessageTemplate = '<?xml version="1.0" encoding="UTF-8"?>' +
    '<moMessage messageId="234723487234234" receiptDate="YYYY-MM-DD HH:MM:SS Z" attemptNumber="1">' +
      '<source address="{number}" carrier="103" type="MDN" />' +
      '<destination address="{short_code}" type="SC" />' +
      '<message>{message}</message>' +
    '</moMessage>'

describe('MoMessage', function() {
  common.sanitizationVariants.forEach(function(phoneNumber) {
    describe('Variant ' + phoneNumber, function() {
      beforeEach(function() {
        lib = dynamoHelper.mockFor('../app/MoMessage');
        lib = snsHelper.mockFor('../app/MoMessage');
      });

      afterEach(function() {
        dynamoHelper.clear();
        snsHelper.clear();
      });

      it('should successfully add to the blacklist', function() {
        const arn = 'sns-topic-arn';
        assert.equal(dynamoHelper.get('2125555555', 'sms'), undefined);
        assert.deepEqual(snsHelper.getMessages(arn), []);
        lib.handler({
          body: moMessageTemplate.replace('{message}', 'Please Stop').replace('{number}', phoneNumber),
          stageVariables: { NOTIFICATION_QUEUE: arn, TABLE_NAME: common.tableName }
        }, null, function(err, data) {
          assert.equal(err, null);
          assert.equal(data.statusCode, 200);
          assert.deepEqual(JSON.parse(data.body), {id: '2125555555'});
          var rawValue = dynamoHelper.get('2125555555', 'sms');
          assert.equal(rawValue.Id.S, '2125555555');
          assert.equal(rawValue.Type.S, 'sms');
          assert.notEqual(rawValue.UpdatedAt, null);
          assert.notEqual(rawValue.UpdatedAt.S, null);
          assert.deepEqual(snsHelper.getMessages(arn), [JSON.stringify({ phone_number: '2125555555' })]);
        });
      });

      it('should work for alternative stop words', function() {
        assert.equal(dynamoHelper.get('2125555555', 'sms'), undefined);
        lib.handler({
          body: moMessageTemplate.replace('{message}', 'UnSubscribeMe!!!').replace('{number}', phoneNumber),
          stageVariables: { TABLE_NAME: common.tableName }
        }, null, function(err, data) {
          assert.equal(err, null);
          assert.equal(data.statusCode, 200);
          assert.deepEqual(JSON.parse(data.body), {id: '2125555555'});
          var rawValue = dynamoHelper.get('2125555555', 'sms');
          assert.equal(rawValue.Id.S, '2125555555');
          assert.equal(rawValue.Type.S, 'sms');
          assert.notEqual(rawValue.UpdatedAt, null);
          assert.notEqual(rawValue.UpdatedAt.S, null);
        });
      });

      it('should keep track of messages', function() {
        assert.equal(dynamoHelper.get('2125555555', 'sms'), undefined);
        var body = moMessageTemplate.replace('{message}', 'UnSubscribeMe!!!').replace('{number}', phoneNumber);
        lib.handler({
          body: body,
          stageVariables: { TABLE_NAME: common.tableName }
        }, null, function(err, data) {
          assert.equal(err, null);
          assert.equal(data.statusCode, 200);
          assert.deepEqual(JSON.parse(data.body), {id: '2125555555'});
          var rawValue = dynamoHelper.get('2125555555', 'sms');
          assert.equal(rawValue.Id.S, '2125555555');
          assert.equal(rawValue.Type.S, 'sms');
          assert.deepEqual(rawValue.Log.SS, [JSON.stringify({body: body})]);
          lib.handler({
            body: body,
            stageVariables: { TABLE_NAME: common.tableName },
            queryStringParameters: { origin: "website" }
          }, null, function(err, data) {
            assert.equal(err, null);
            assert.equal(data.statusCode, 200);
            assert.deepEqual(JSON.parse(data.body), {id: '2125555555'});
            var rawValue = dynamoHelper.get('2125555555', 'sms');
            assert.equal(rawValue.Id.S, '2125555555');
            assert.equal(rawValue.Type.S, 'sms');
            assert.deepEqual(rawValue.Log.SS, [JSON.stringify({body: body}), JSON.stringify({body: body, queryStringParameters: { origin: "website" }})]);
          });
        });
      });

      it('should not blacklist if the message does not include a stop word', function() {
        const arn = 'sns-topic-arn';
        assert.equal(dynamoHelper.get('2125555555', 'sms'), undefined);
        assert.deepEqual(snsHelper.getMessages(arn), []);
        lib.handler({
          body: moMessageTemplate.replace('{message}', 'Hello there').replace('{number}', phoneNumber),
          stageVariables: { NOTIFICATION_QUEUE: arn, TABLE_NAME: common.tableName }
        }, null, function(err, data) {
          assert.equal(err, null);
          assert.equal(data.statusCode, 200);
          assert.deepEqual(JSON.parse(data.body), {id: ''});
          assert.equal(dynamoHelper.get('2125555555', 'sms'), undefined);
          assert.deepEqual(snsHelper.getMessages(arn), []);
        });
      });

      it('should successfully update the blacklist without dropping existing properties', function() {
        dynamoHelper.put({Id:{S:'2125555555'},Type:{S:'sms'},Foo:{S:'Bar'}});
        lib.handler({
          body: moMessageTemplate.replace('{message}', 'Please Stop').replace('{number}', phoneNumber),
          stageVariables: { TABLE_NAME: common.tableName }
        }, null, function(err, data) {
          assert.equal(err, null);
          assert.equal(data.statusCode, 200);
          assert.deepEqual(JSON.parse(data.body), {id: '2125555555'});
          var rawValue = dynamoHelper.get('2125555555', 'sms');
          assert.equal(rawValue.Id.S, '2125555555');
          assert.equal(rawValue.Type.S, 'sms');
          assert.notEqual(rawValue.UpdatedAt, null);
          assert.notEqual(rawValue.UpdatedAt.S, null);
          assert.equal(rawValue.Foo.S, 'Bar');
        });
      });

      it('should remove the DeletedAt property when present', function() {
        const arn = 'sns-topic-arn';
        dynamoHelper.put({Id:{S:'2125555555'},Type:{S:'sms'},DeletedAt:{S: '2017-01-01 00:00:00'}});
        assert.deepEqual(snsHelper.getMessages(arn), []);
        lib.handler({
          body: moMessageTemplate.replace('{message}', 'Please Stop').replace('{number}', phoneNumber),
          stageVariables: { NOTIFICATION_QUEUE: arn, TABLE_NAME: common.tableName }
        }, null, function(err, data) {
          assert.equal(err, null);
          assert.equal(data.statusCode, 200);
          assert.deepEqual(JSON.parse(data.body), {id: '2125555555'});
          var rawValue = dynamoHelper.get('2125555555', 'sms');
          assert.equal(rawValue.Id.S, '2125555555');
          assert.equal(rawValue.Type.S, 'sms');
          assert.notEqual(rawValue.UpdatedAt, null);
          assert.notEqual(rawValue.UpdatedAt.S, null);
          assert.equal(rawValue.DeletedAt, null);
          assert.deepEqual(snsHelper.getMessages(arn), [JSON.stringify({ phone_number: '2125555555' })]);
        });
      });

      it('should record the short code in MetaData', function() {
        assert.equal(dynamoHelper.get('2125555555', 'sms'), undefined);
        lib.handler({
          body: moMessageTemplate.replace('{message}', 'Please Stop').replace('{number}', phoneNumber).replace('{short_code}', '12345'),
          stageVariables: { TABLE_NAME: common.tableName }
        }, null, function(err, data) {
          assert.equal(err, null);
          assert.equal(data.statusCode, 200);
          var rawValue = dynamoHelper.get('2125555555', 'sms');
          assert.deepEqual(rawValue['MetaData.short_code'].SS, ['12345']);
        });
      });

      it('should record multiple short codes in MetaData', function() {
        assert.equal(dynamoHelper.get('2125555555', 'sms'), undefined);
        lib.handler({
          body: moMessageTemplate.replace('{message}', 'Please Stop').replace('{number}', phoneNumber).replace('{short_code}', '12345'),
          stageVariables: { TABLE_NAME: common.tableName }
        }, null, function(err, data) {
          lib.handler({
            body: moMessageTemplate.replace('{message}', 'Please Stop').replace('{number}', phoneNumber).replace('{short_code}', '67890'),
            stageVariables: { TABLE_NAME: common.tableName }
          }, null, function(err, data) {
            assert.equal(err, null);
            assert.equal(data.statusCode, 200);
            var rawValue = dynamoHelper.get('2125555555', 'sms');
            assert.deepEqual(rawValue['MetaData.short_code'].SS, ['12345', '67890']);
          });
        });
      });

      it('should record querystring parameters in MetaData', function() {
        assert.equal(dynamoHelper.get('2125555555', 'sms'), undefined);
        lib.handler({
          body: moMessageTemplate.replace('{message}', 'Please Stop').replace('{number}', phoneNumber).replace('{short_code}', '12345'),
          stageVariables: { TABLE_NAME: common.tableName },
          queryStringParameters: { origin: 'website' }
        }, null, function(err, data) {
          assert.equal(err, null);
          assert.equal(data.statusCode, 200);
          var rawValue = dynamoHelper.get('2125555555', 'sms');
          assert.deepEqual(rawValue['MetaData.short_code'].SS, ['12345']);
          assert.deepEqual(rawValue['MetaData.origin'].SS, ['website']);
        });
      });


      it('should sanitize querystring parameter names', function() {
        assert.equal(dynamoHelper.get('2125555555', 'sms'), undefined);
        lib.handler({
          body: moMessageTemplate.replace('{message}', 'Please Stop').replace('{number}', phoneNumber).replace('{short_code}', '12345'),
          stageVariables: { TABLE_NAME: common.tableName },
          queryStringParameters: { "origin.$va!lid": "website" }
        }, null, function(err, data) {
          assert.equal(err, null);
          assert.equal(data.statusCode, 200);
          var rawValue = dynamoHelper.get('2125555555', 'sms');
          assert.deepEqual(rawValue['MetaData.origin_va_lid'].SS, ['website']);
        });
      });

      it('should not fail if short code is missing', function() {
        assert.equal(dynamoHelper.get('2125555555', 'sms'), undefined);
        lib.handler({
          body: moMessageTemplate.replace('{message}', 'Please Stop').replace('{number}', phoneNumber).replace('address="{short_code}"', ''),
          stageVariables: { TABLE_NAME: common.tableName }
        }, null, function(err, data) {
          assert.equal(err, null);
          assert.equal(data.statusCode, 200);
          var rawValue = dynamoHelper.get('2125555555', 'sms');
          assert.deepEqual(rawValue['MetaData.short_code'].SS, ['']);
        });
      });
    });
  });

  it('should fail gracefully if the message is invalid', function() {
    assert.equal(dynamoHelper.get('2125555555', 'sms'), undefined);
    lib.handler({
      body: 'invalid',
      stageVariables: { TABLE_NAME: common.tableName }
    }, null, function(err, data) {
      assert.equal(err, null);
      assert.equal(data.statusCode, 400);
      assert.deepEqual(JSON.parse(data.body), {message: 'Invalid message xml'});
      assert.equal(dynamoHelper.get('2125555555', 'sms'), undefined);
    });
  });

  it('should fail gracefully if there is no source address', function() {
    assert.equal(dynamoHelper.get('2125555555', 'sms'), undefined);
    lib.handler({
      body: '<moMessage><message>Please Stop</message><moMessage>',
      stageVariables: { TABLE_NAME: common.tableName }
    }, null, function(err, data) {
      assert.equal(err, null);
      assert.equal(data.statusCode, 400);
      assert.deepEqual(JSON.parse(data.body), {message: 'Missing source address'});
      assert.equal(dynamoHelper.get('2125555555', 'sms'), undefined);
    });
  });
});