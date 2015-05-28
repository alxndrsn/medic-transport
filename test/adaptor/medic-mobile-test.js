var chai = require('chai'),
    request = require('request'),
    sinon = require('sinon'),
    adaptor = require('../../lib/adaptor.js'),
    assert = chai.assert;
chai.config.includeStack = true;

describe('medic-mobile', function() {
  var TEST_MESSAGE = {content:'', from:'', timestamp:''},
      TEST_URL_ROOT = 'http://localhost/nonsense'
      _json = JSON.stringify,
      mm = null;

  beforeEach(function(done) {
    sinon.stub(request, 'post')
        .yields(null, {statusCode:200}, _json({
          payload: {
            messages:[{}, {}, {}]
          }
        }));
    sinon.stub(request, 'call')
        .yields(null, {statusCode:200}, _json({
          payload:{messages:[{uuid:'123-345-123', content:'a message', to:'recipient'}]}
        }));
    done(); // TODO prob not required
  });

  afterEach(function(done) {
    if(mm) mm.stop();
    request.post.restore();
    request.get.restore && request.get.restore();
    request.call.restore();
    done(); // TODO prob not required
  });

  describe('receiving', function() {
    beforeEach(function() {
      mm = adaptor.create('medic-mobile',
          {debug:true, pass:'secret', url:TEST_URL_ROOT, interval:1});
    });
    it('should poll by GETting /add', function(done) {
      sinon.stub(request, 'get', function(options) {
        assert.equal(options.url, TEST_URL_ROOT + '/add');
        done();
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
        if(url == TEST_URL_ROOT + '/add') {
          if(calls.get[url].length == 1) {
            callback(null, {statusCode:200}, _json({
              payload:{messages:[
		  {uuid:0, message:'a', to:'0', random_key:'should be ignored'},
		  {uuid:1, message:'b', to:'1'},
		  {uuid:2, message:'c', to:'2'}]},
              callback:{data:{docs:['asdf', '123']}, options:{protocol:'http', host:'localhost', port:123, path:'/weird-callback'}}
            }));
          } else {
            callback(null, {statusCode:200}, _json({}));
          }
        } else done("Unexpected GET request to: " + url);
      });
      mm.register_transmit_handler(function(message, callback) { // TODO not reuiqred
        var actual, i;
	calls.transmit_handler.push(message);
	if(calls.transmit_handler.length == 3) {
	  for(i=0; i<3; ++i) {
	    actual = calls.transmit_handler[i];
	    assert.equal(actual.uuid, i);
	    assert.equal(actual.content, ALPHABET.charAt(i));
	    assert.equal(actual.to, ""+i);
	    assert.ok(actual.timestamp);
	    assert.notOk(actual.random_key);
	  }
          done();
	}
      });
      mm.register_error_handler(function(error) { // TODO not reuiqred
        done(error);
      });

      // given
      // TODO define messages to transmit

      // when
      mm.start();
    });
  });
  describe('.deliver()', function() {
    // To prevent noise in the tests, this adapter should never poll for
    // messages to send.  We achieve this with a very high interval.
    before(function() {
      mm = adaptor.create('medic-mobile',
          {debug:true, pass:'secret', url:TEST_URL_ROOT, interval:20000});
    });
    it('should be callable', function(done) {
      // when
      mm.deliver(TEST_MESSAGE, function(error, response) {
        done();
      });
    });
    it('should POST to /add', function(done) {
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

        done();
      });
    });
  });
});
