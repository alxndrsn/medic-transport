var assert = require('assert'),
    request = require('request'),
    sinon = require('sinon'),
    adaptor = require('../../lib/adaptor.js');

describe('medic-mobile', function() {
  var TEST_MESSAGE = {content:'', from:'', timestamp:''},
      TEST_URL_ROOT = 'http://localhost/nonsense'
      _json = JSON.stringify,
      mm = adaptor.create('medic-mobile',
         {debug:true, pass:'secret', url:TEST_URL_ROOT});

  before(function(done) {
    sinon.stub(request, 'get');
    sinon.stub(request, 'post')
        .yields(null, {statusCode:200}, _json({
          payload: {
            messages:null
          }
        }));
    done();
  });

  after(function(done) {
    request.get.restore();
    request.post.restore();
    done();
  });

  it('should be defined', function() {
    assert.notEqual(null, mm);
  });
  it('should have deliver function', function() {
    assert.notEqual(null, mm.deliver);
  });
  describe('.deliver()', function() {
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
        assert(!request.get.called);
        assert.deepEqual(response, {total_sent:1, status:'success'});

        var args = request.post.firstCall.args;
        assert.equal(args.length, 2);
        assert.equal(args[0].url, TEST_URL_ROOT + '/add');

        // FIXME at the moment, we appear to make two identical calls to '/add'
        assert.equal(request.post.callCount, 2);
        assert.deepEqual(request.post.firstCall.args[0], request.post.secondCall.args[0]);

        done();
      });
    });
  });
});
