var chai = require('chai'),
    request = require('request'),
    sinon = require('sinon'),
    adaptor = require('../../lib/adaptor.js'),
    assert = chai.assert;
chai.config.includeStack = true;

describe('medic-mobile', function() {
  var TEST_MESSAGE = {content:'', from:'', timestamp:''},
      TEST_URL_ROOT = 'http://localhost/nonsense',
      CALLBACK_URL = 'http://localhost:5999/weird-callback',
      _json = JSON.stringify,
      mm = null;

  beforeEach(function() {
    this.timeout(500);
  });

  afterEach(function() {
    if(mm) mm.stop();
    request.post.restore && request.post.restore();
    request.get.restore && request.get.restore();
  });

  describe('receiving', function() {
    beforeEach(function() {
      mm = adaptor.create('medic-mobile',
          {debug:true, pass:'secret', url:TEST_URL_ROOT, interval:100});
    });
    it('should poll by GETting /add', function(done) {
      sinon.stub(request, 'get', function(options) {
        assert.equal(options.url, TEST_URL_ROOT + '/add');
        return done();
      });
      mm.start();
    });
   it('should call transmit handler once for each message when messages are successfully sent', function(done) {
      // setup
      var calls = { get: {}, transmit_handler:[] };
      var ALPHABET = 'abc';
      sinon.stub(request, 'get', function(options, callback) {
        var url = options.url;
        calls.get[url] = calls.get[url] || [];
        calls.get[url].push(options);
        if(url === TEST_URL_ROOT + '/add') {
          if(calls.get[url].length === 1) {
            callback(null, {statusCode:200}, _json({
              payload:{messages:[
                  {uuid:0, message:'a', to:'0', random_key:'should be ignored'},
                  {uuid:1, message:'b', to:'1'},
                  {uuid:2, message:'c', to:'2'}]},
              callback:{data:{docs:['asdf', '123']}, options:{protocol:'http', host:'localhost', port:5999, path:'/weird-callback'}}
            }));
          } else {
            callback(null, {statusCode:200}, _json({}));
          }
        } else if(url === CALLBACK_URL) {
          if(calls.get[url].length === 1) {
            assert.deepEqual(options, {url:'http://localhost:5999/weird-callback',
                headers:{}, method:'GET', body:'{"docs":["asdf","123"]}'});
          } else {
            return done(new Error("Should only make one callback."));
          }
        } else return done(new Error('Unexpected GET request to: ' + url));
      });
      mm.register_transmit_handler(function(message, callback) { // TODO not reuiqred
        var actual, i;
        calls.transmit_handler.push(message);
        if(calls.transmit_handler.length === 3) {
          for(i=0; i<3; ++i) {
            actual = calls.transmit_handler[i];
            assert.equal(actual.uuid, i);
            assert.equal(actual.content, ALPHABET.charAt(i));
            assert.equal(actual.to, ""+i);
            assert.ok(actual.timestamp);
            assert.notOk(actual.random_key);
          }
          return done();
        }
        callback(null, { status:'success', total_sent:calls.transmit_handler.length });
      });
      mm.register_error_handler(function(error) { // TODO not reuiqred
        return done(error);
      });

      // given
      // TODO define messages to transmit

      // when
      mm.start();
    });
    it('should call transmit handler for messages marked "failure"', function(done) {
      // setup
      var calls = { get: {}, transmit_handler:[] };
      var ALPHABET = 'abc';
      sinon.stub(request, 'get', function(options, callback) {
        var url = options.url;
        calls.get[url] = calls.get[url] || [];
        calls.get[url].push(options);
        if(url === TEST_URL_ROOT + '/add') {
          if(calls.get[url].length === 1) {
            callback(null, {statusCode:200}, _json({
              payload:{messages:[
                  {uuid:0, message:'I will fail', to:'0'}]},
              callback:{data:{docs:['asdf', '123']}, options:{protocol:'http', host:'localhost', port:5999, path:'/weird-callback'}}
            }));
          } else {
            callback(null, {statusCode:200}, _json({}));
          }
        } else if(url === CALLBACK_URL) {
          assert.deepEqual(options, {url:'http://localhost:5999/weird-callback',
              headers:{}, method:'GET', body:'{"docs":["asdf","123"]}'});
          return done();
        } else return done(new Error("Unexpected GET request to: " + url));
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
      // setup
      this.timeout(0); // disable mocha timeout
      setTimeout(done, 1000);

      var calls = { get: {}, transmit_handler:[] };
      var ALPHABET = 'abc';
      sinon.stub(request, 'get', function(options, callback) {
        var url = options.url;
        calls.get[url] = calls.get[url] || [];
        calls.get[url].push(options);
        if(url === TEST_URL_ROOT + '/add') {
          if(calls.get[url].length === 1) {
            callback(null, {statusCode:200}, _json({
              payload:{messages:[
                  {uuid:0, message:'I will fail', to:'0'}]},
              callback:{data:{docs:['asdf', '123']}, options:{protocol:'http', host:'localhost', port:5999, path:'/weird-callback'}}
            }));
          } else {
            callback(null, {statusCode:200}, _json({}));
          }
        } else return done(new Error("Unexpected GET request to: " + url));
      });
      var transmit_handler_called = false;
      mm.register_transmit_handler(function(message, callback) {
        callback(new Error("Manufactured error for testing"));
      });

      // when
      mm.start();
    });
    it('should call transmit error handler when there are transmit errors', function(done) {
      // setup
      var calls = { get: {}, transmit_handler:[] };
      var ALPHABET = 'abc';
      sinon.stub(request, 'get', function(options, callback) {
        var url = options.url;
        calls.get[url] = calls.get[url] || [];
        calls.get[url].push(options);
        if(url === TEST_URL_ROOT + '/add') {
          if(calls.get[url].length === 1) {
            callback(null, {statusCode:200}, _json({
              payload:{messages:[
                  {uuid:0, message:'I will fail', to:'0'}]},
              callback:{data:{docs:['asdf', '123']}, options:{protocol:'http', host:'localhost', port:5999, path:'/weird-callback'}}
            }));
          } else {
            callback(null, {statusCode:200}, _json({}));
          }
        } else return done(new Error("Unexpected GET request to: " + url));
      });
      var transmit_handler_called = false;
      mm.register_transmit_handler(function(message, callback) {
        callback(new Error("Manufactured error for testing"));
      });
      mm.register_error_handler(function(error) {
	assert.equal(error.toString(), "Error: Manufactured error for testing");
        return done();
      });

      // when
      mm.start();
    });
    it('should retry messages which return status `failure`', function(done) {
      var calls = { get: {}, transmit_handler:[] };
      var sendAttempts = 0;
      this.timeout(0);
      setTimeout(function() {
        assert.equal(sendAttempts, 10);
        return done();
      }, 1000);
      // setup
      var ALPHABET = 'abc';
      sinon.stub(request, 'get', function(options, callback) {
        var url = options.url;
        calls.get[url] = calls.get[url] || [];
        calls.get[url].push(options);
        if(url === TEST_URL_ROOT + '/add') {
          if(calls.get[url].length === 1) {
            callback(null, {statusCode:200}, _json({
              payload:{messages:[
                  {uuid:0, message:'I will fail', to:'0'}]},
              callback:{data:{docs:['asdf', '123']}, options:{protocol:'http', host:'localhost', port:5999, path:'/weird-callback'}}
            }));
          } else {
            callback(null, {statusCode:200}, _json({}));
          }
        } else if(url === CALLBACK_URL) {
          // TODO why do we get a callback here?  The message should have failed...
        } else return done(new Error("Unexpected GET request to: " + url));
      });
      var transmit_handler_called = false;
      mm.register_transmit_handler(function(message, callback) {
        ++sendAttempts;
        callback(false, { status:'failure' });
      });
      mm.register_error_handler(function(error) {
      });

      // when
      mm.start();
    });
  });
  describe('.deliver()', function() {
    // To prevent noise in the tests, this adapter should never poll for
    // messages to send.  We achieve this with a very high interval.
    beforeEach(function() {
      mm = adaptor.create('medic-mobile',
          {debug:true, pass:'secret', url:TEST_URL_ROOT, interval:100});
      sinon.stub(request, 'post')
          .yields(null, {statusCode:200}, _json({
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
      sinon.stub(request, 'post').yields(null, {statusCode:200}, _json({}));;
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
