var assert = require('assert'),
    common = require('../testHelper'),
    helper = require('../dynamoTestHelper'),
    lib = require('../../app/MoMessage');

process.env.TABLE_NAME = "blacklist";
process.env.STOP_WORDS = "(stop|unsubscribe)"

const moMessageTemplate = '<?xml version="1.0" encoding="UTF-8"?>' +
    '<moMessage messageId="234723487234234" receiptDate="YYYY-MM-DD HH:MM:SS Z" attemptNumber="1">' +
      '<source address="{number}" carrier="103" type="MDN" />' +
      '<destination address="12345" type="SC" />' +
      '<message>{message}</message>' +
    '</moMessage>'

describe('MoMessage', function() {
  common.sanitizationVariants.forEach(function(phoneNumber) {
    describe('Variant ' + phoneNumber, function() {
      beforeEach(function() {
        lib = helper.mockFor('../app/MoMessage');
      });

      afterEach(function() {
        helper.clear();
      });

      it('should successfully add to the blacklist', function() {
        assert.equal(helper.get('2125555555', 'sms'), undefined);
        lib.handler({
          body: moMessageTemplate.replace('{message}', 'Please Stop').replace('{number}', phoneNumber)
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

      it('should work for alternative stop words', function() {
        assert.equal(helper.get('2125555555', 'sms'), undefined);
        lib.handler({
          body: moMessageTemplate.replace('{message}', 'UnSubscribeMe!!!').replace('{number}', phoneNumber)
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

      it('should not blacklist if the message does not include a stop word', function() {
        assert.equal(helper.get('2125555555', 'sms'), undefined);
        lib.handler({
          body: moMessageTemplate.replace('{message}', 'Hello there').replace('{number}', phoneNumber)
        }, null, function(err, data) {
          assert.equal(err, null);
          assert.equal(data.statusCode, 200);
          assert.deepEqual(JSON.parse(data.body), {id: ''});
          assert.equal(helper.get('2125555555', 'sms'), undefined);
        });
      });

      it('should successfully update the blacklist without dropping existing properties', function() {
        helper.put({Id:{S:'2125555555'},Type:{S:'sms'},Foo:{S:'Bar'}});
        lib.handler({
          body: moMessageTemplate.replace('{message}', 'Please Stop').replace('{number}', phoneNumber)
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

      it('should remove the DeletedAt property when present', function() {
        helper.put({Id:{S:'2125555555'},Type:{S:'sms'},DeletedAt:{S: '2017-01-01 00:00:00'}});
        lib.handler({
          body: moMessageTemplate.replace('{message}', 'Please Stop').replace('{number}', phoneNumber)
        }, null, function(err, data) {
          assert.equal(err, null);
          assert.equal(data.statusCode, 200);
          assert.deepEqual(JSON.parse(data.body), {id: '2125555555'});
          var rawValue = helper.get('2125555555', 'sms');
          assert.equal(rawValue.Id.S, '2125555555');
          assert.equal(rawValue.Type.S, 'sms');
          assert.notEqual(rawValue.UpdatedAt, null);
          assert.notEqual(rawValue.UpdatedAt.S, null);
          assert.equal(rawValue.DeletedAt, null);
        });
      });
    });
  });

  it('should fail gracefully if the message is invalid', function() {
    assert.equal(helper.get('2125555555', 'sms'), undefined);
    lib.handler({
      body: 'invalid'
    }, null, function(err, data) {
      assert.equal(err, null);
      assert.equal(data.statusCode, 400);
      assert.deepEqual(JSON.parse(data.body), {message: 'Invalid message xml'});
      assert.equal(helper.get('2125555555', 'sms'), undefined);
    });
  });

  it('should fail gracefully if there is no source address', function() {
    assert.equal(helper.get('2125555555', 'sms'), undefined);
    lib.handler({
      body: '<moMessage><message>Please Stop</message><moMessage>'
    }, null, function(err, data) {
      assert.equal(err, null);
      assert.equal(data.statusCode, 400);
      assert.deepEqual(JSON.parse(data.body), {message: 'Missing source address'});
      assert.equal(helper.get('2125555555', 'sms'), undefined);
    });
  });
});