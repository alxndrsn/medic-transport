var chai = require('chai'),
    request = require('request'),
    sinon = require('sinon'),
    adaptor = require('../../lib/adaptor.js'),
    assert = chai.assert,
    mock_http = require('../request-mocker.js').mock_request;
chai.config.includeStack = true;

describe('medic-mobile', function() {
  var TEST_MESSAGE = {content:'', from:'', timestamp:''},
      TEST_URL_ROOT = 'http://localhost/nonsense',
      CALLBACK_URL = 'http://localhost:5999/weird-callback',
      TEST_CALLBACK_OBJ = {url:'http://localhost:5999/weird-callback',
          headers:{}, method:'GET', body:'{"docs":["asdf","123"]}'};
      mm = null;

  beforeEach(function() {
    mm = adaptor.create('medic-mobile',
        {debug:true, pass:'secret', url:TEST_URL_ROOT, interval:100});
  });

  afterEach(function() {
    if(mm) mm.stop();
    request.post.restore && request.post.restore();
    request.get.restore && request.get.restore();
  });

  var error_and_done = function(done, error_message) {
    return function() { return done(new Error(error_message)); };
  }

  var MESSAGES_TO_SEND_ONCE = [
    {
          payload:{messages:[
              {uuid:0, message:'a', to:'0', random_key:'should be ignored'},
              {uuid:1, message:'b', to:'1'},
              {uuid:2, message:'c', to:'2'}]},
          callback:{data:{docs:['asdf', '123']}, options:{protocol:'http', host:'localhost', port:5999, path:'/weird-callback'}}},
    {}
  ];

  describe('receiving', function() {
    it('should poll by GETting /add', function(done) {
      sinon.stub(request, 'get', function(options) {
        assert.equal(options.url, TEST_URL_ROOT + '/add');
        return done();
      });
      mm.start();
    });
   it('should call transmit handler once for each message when messages are successfully sent', function(done) {
      this.timeout(600);
      mock_http.mock({
        'GET http://localhost/nonsense/add': MESSAGES_TO_SEND_ONCE,
        'GET http://localhost:5999/weird-callback': [
          function(url, options) {
            assert.deepEqual(options, TEST_CALLBACK_OBJ);
          },
          error_and_done(done, "Should only make one callback.")
        ]
      });

      var transmit_handler_calls = [];
      mm.register_transmit_handler(function(message, callback) { // TODO not reuiqred
        var actual, i,
            ALPHABET = 'abc';
        transmit_handler_calls.push(message);
        if(transmit_handler_calls.length === 3) {
          for(i=0; i<3; ++i) {
            actual = transmit_handler_calls[i];
            assert.equal(actual.uuid, i);
            assert.equal(actual.content, ALPHABET.charAt(i));
            assert.equal(actual.to, ""+i);
            assert.ok(actual.timestamp);
            assert.notOk(actual.random_key);
          }
          return done();
        }
        callback(null, { status:'success', total_sent:transmit_handler_calls.length });
      });

      mm.start();
    });
    it('should call transmit handler for messages marked "failure"', function(done) {
      mock_http.mock({
        'GET http://localhost/nonsense/add': MESSAGES_TO_SEND_ONCE,
        'GET http://localhost:5999/weird-callback': [
          function(url, options) {
            assert.deepEqual(options, TEST_CALLBACK_OBJ);
            return done();
          },
          error_and_done(done, "Should only make one callback.")
        ]
      });

      var transmit_handler_called = false;
      mm.register_transmit_handler(function(message, callback) {
        //done(new Error("Should not call the transmit handler for a bad message!"));
        callback(false, { status:'failure' });
      });
      mm.register_error_handler(function(error) {
        return done(error);
      });

      // when
      mm.start();
    });
    it('should not call transmit handler when there are transmit errors', function(done) {
      mock_http.mock({
        'GET http://localhost/nonsense/add': MESSAGES_TO_SEND_ONCE
      });

      this.timeout(0); // disable mocha timeout
      setTimeout(done, 1000);

      var transmit_handler_called = false;
      mm.register_transmit_handler(function(message, callback) {
        callback(new Error("Manufactured error for testing"));
      });

      // when
      mm.start();
    });
    it('should call transmit error handler when there are transmit errors', function(done) {
      mock_http.mock({
        'GET http://localhost/nonsense/add': MESSAGES_TO_SEND_ONCE
      });

      var transmit_handler_called = false;
      mm.register_transmit_handler(function(message, callback) {
        callback(new Error("Manufactured error for testing"));
      });
      var error_handler_call_count = 0;
      mm.register_error_handler(function(error) {
        assert.equal(error.toString(), "Error: Manufactured error for testing");
	if(++error_handler_call_count === 1) {
	  // TODO this currently gets called once for every failed message
	  // please determine if this is correct behaviour!
          return done();
	}
      });

      mm.start();
    });
    it('should retry messages which return status `failure`', function(done) {
      mock_http.mock({
          'GET http://localhost/nonsense/add': MESSAGES_TO_SEND_ONCE,
          'GET http://localhost:5899/weird-callback': error_and_done(done,
              'Should not have callback with failed messages.')
      });

      var sendAttempts = 0;
      this.timeout(0);
      setTimeout(function() {
        assert.equal(sendAttempts, 30);
        return done();
      }, 1000);

      var transmit_handler_called = false;
      mm.register_transmit_handler(function(message, callback) {
        ++sendAttempts;
        callback(false, { status:'failure' });
      });

      mm.start();
    });
  });
  describe('.deliver()', function() {
    beforeEach(function() {
      sinon.stub(request, 'post')
          .yields(null, {statusCode:200}, JSON.stringify({
              payload: {
              messages:[{}, {}, {}]
            },
            callback:{data:{docs:['asdf', '123']}, options:{protocol:'http', host:'localhost', port:5999, path:'/weird-callback'}}
          }));
    });
    it('should call supplied callback if a good message is supplied', function(done) {
      // when
      mm.deliver(TEST_MESSAGE, function(error, response) {
        return done();
      });
    });
    it('should POST to /add', function(done) {
      request.post.restore();

      mock_http.mock({ 'POST http://localhost/nonsense/add': {} });

      // when
      mm.deliver(TEST_MESSAGE, function(error, response) {
        if(error) return done(error);
        assert.deepEqual(response, {total_sent:1, status:'success'});

        var args = request.post.firstCall.args;
        assert.equal(args.length, 2);
        assert.equal(args[0].url, TEST_URL_ROOT + '/add');

        // FIXME at the moment, we appear to make two identical calls to '/add'
        assert.equal(request.post.callCount, 1);

        assert.notOk(request.get.called);

        return done();
      });
    });
    it('should report success to the callback URL', function(done) {
      // setup
      sinon.stub(request, 'get', function(request, callback) {
        assert.equal(request.url, 'http://localhost:5999/weird-callback');
        // for some reason, the body should equal the data we passed in
        // in the `callback` field of the `POST` to `/add`
        assert.deepEqual(request.body, '{"docs":["asdf","123"]}');
        return done();
      });

      // when
      mm.deliver(TEST_MESSAGE, function(error, response) {
        if(error) return done(error);
        assert.deepEqual(response, {total_sent:1, status:'success'});

        var args = request.post.firstCall.args;
        assert.equal(args.length, 2);
        assert.equal(args[0].url, TEST_URL_ROOT + '/add');

        // FIXME at the moment, we appear to make two identical calls to '/add'
        assert.equal(request.post.callCount, 1);

        assert.notOk(request.get.called);
      });
    });
    it('should retry failed deliveries', function(done) {
      // TODO request a delivery, then have it fail, then make sure
      // that this is passed to the callback
      return done(new Error('TODO - please implement me!'));
    });
  });
});
