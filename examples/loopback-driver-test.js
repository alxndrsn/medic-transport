var args = process.argv.slice(2),
    driver = require('../lib/driver'),
    assert = require('chai').assert,
    log = function(message) { console.log('LOG | ' + message); },
    error = function(message) { console.log('ERR | ' + message); },
    _ = require('underscore'),
    TEST_MESSAGES = [
      /* GSM-7 single */ 'This is a simple test message.',
      /* GSM-7 multi  */ 'This is a simple test message. This is only a test. Had this been an actual message, the authorities in your area (with cooperation from federal and state authorities) would have already read it for you.',
      /* UCS-2 single */ 'This is a test message. الحروف عربية. ان شاء الله.',
      /* UCS-2 multi  */ 'The portion before this contains only Latin characters. Nepali text follows this. हो'',
    ],
    received = [];

function sorter(s) { return s; }
function sort(arr) { return _.sortBy(arr, sorter); }

function testDriver(type, phoneNumber, timeout) {
  timeout |= 1000;
  log('Testing driver: ' + type + ' on phone number ' + phoneNumber);

  d = driver.create(type);
  d.register_receive_handler(function (message, callback) {
    log('received: ', JSON.stringify(message));
    received.push(message.content);
    return callback();
  });
  d.start();

  _.each(TEST_MESSAGES, function(text) {
    d.send({ to:phoneNumber, content:text }, function (err) {
      error(err + ' sending: ' + text);
    });
  });

  setTimeout(function() {
    assert.deepEqual(sort(TEST_MESSAGES), sort(received));
    System.exit(0);
  }, timeout);
}

testDriver(args[0], args[1]);
