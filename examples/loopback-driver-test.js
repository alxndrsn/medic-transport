var args = process.argv.slice(2),
    driver = require('../lib/driver'),
    assert = require('chai').assert,
    log = function(message) { console.log('LOG | ' + message); },
    error = function(message) { console.log('ERR | ' + message); },
    _ = require('underscore'),
    TEST_MESSAGES = [
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
