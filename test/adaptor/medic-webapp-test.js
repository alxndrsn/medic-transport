var chai = require('chai'),
    assert = chai.assert,
    adaptor = require('../../lib/adaptor.js'),
    request = require('request'),
    mock_http = require('../request-mocker.js').mock_request;

describe('medic-webapp', function() {
  var adapter, mock_webapp,
      TEST_URL_ROOT = 'http://localhost/nonsense',
      TODO = function(done) { done(new Error('Not Yet Implemented')); },
      PENDING_PATH = '/api/v1/messages?state=pending',
      PENDING_URL = TEST_URL_ROOT + PENDING_PATH;

  beforeEach(function() {
    adapter = adaptor.create('medic-webapp',
        {debug:true, pass:'secret', url:TEST_URL_ROOT, interval:100});
    mock_webapp = (function() {
      this.poll_count = function() {
        return mock_http.handlers.GET[PENDING_URL].count;
      };

      var behaviour = {};
      behaviour['GET ' + PENDING_URL] = function() {};
      mock_http.mock(behaviour);

      return this;
    }());
  });

  afterEach(function() {
    if(adapter) adapter.stop();
    mock_http.restore();
  });

  describe('test setup', function() {
    it('should provide mock_webapp implementation', function() {
      assert.ok(mock_webapp);
    });
    it('should have a poll_count available', function() {
      assert.equal(typeof mock_webapp.poll_count(), 'number');
    });
    it('should count number of pollings done', function() {
      assert.equal(mock_webapp.poll_count(), 0);
      request.get(PENDING_URL);
      assert.equal(mock_webapp.poll_count(), 1);
      request.get(PENDING_URL);
      assert.equal(mock_webapp.poll_count(), 2);
      request.get(PENDING_URL);
      assert.equal(mock_webapp.poll_count(), 3);
    });
    it('should only count pollings to the correct URL', function() {
      assert.equal(mock_webapp.poll_count(), 0);
      request.get(TEST_URL_ROOT + '/something-wrong');
      assert.equal(mock_webapp.poll_count(), 0);
      request.get(TEST_URL_ROOT + '/api/v1/messages?status=not-pending');
      assert.equal(mock_webapp.poll_count(), 0);
      request.get(PENDING_URL);
      assert.equal(mock_webapp.poll_count(), 1);
    });
  });

  describe('mobile-originating', function() {
    describe('when not started', function() {
      it('should do nothing', function(done) {
        this.timeout(0);
        adapter.start(); // TODO once the adapter is implemented, this test should fail until this line is removed
        setTimeout(done, 500);
      });
    });
    describe('when started', function() {
      it('should poll ' + PENDING_PATH, function(done) {
        // then
        this.timeout(0);
        setTimeout(function() {
          assert.ok(mock_webapp.poll_count() > 0);
          done();
        }, 200);

        // when
        adapter.start();
      });
      it('should poll once every interval', function(done) {
        // setup
        this.timeout(0);

        // then
        setTimeout(function() {
          assert.ok(mock_webapp.poll_count() >= 4);
          assert.ok(mock_webapp.poll_count() <= 6);
          done();
        }, 500);

        // when
        adapter.start();
      });
      it('should no longer poll when stopped', function(done) {
        // setup
        this.timeout(0);

        // then
        setTimeout(function() {
          var initial_poll_count = mock_webapp.poll_count();
          assert.ok(initial_poll_count > 0);
          adapter.stop();
          setTimeout(function() {
            assert.equal(mock_webapp.poll_count(), initial_poll_count);
            done();
          }, 300);
        }, 300);

        // when
        adapter.start();
      });
    });
    describe('when ' + PENDING_PATH + ' provides a message', function() {
      it('should be transmitted', function(done) {
        TODO(done);
      });
    });
    describe('when ' + PENDING_PATH + ' provides messages', function() {
      it('should transmit all of them', function(done) {
        TODO(done);
      });
    });
    describe('when a message transmits successfully', function() {
      it('should update state with medic-webapp', function(done) {
        TODO(done);
      });
    });
    describe('when a message transmit fails', function() {
      it('should update state with medic-webapp', function(done) {
        TODO(done);
      });
      it('should retry sending three times', function(done) {
        TODO(done);
      });
      it('should notify error handler if it still fails', function(done) {
        TODO(done);
      });
    });
  });
  describe('mobile-terminating', function() {
    describe('successful delivery', function() {
      it('should be reported to medic-webapp', function(done) {
        TODO(done);
      });
      it('should occur once', function(done) {
        TODO(done);
      });
    });
    describe('failed deliver', function() {
      it('should be reported to medic-webapp', function(done) {
        TODO(done);
      });
      it('should be retried three times', function(done) {
        TODO(done);
      });
      it('should notify error handler if it still fails', function(done) {
        TODO(done);
      });
    });
  });
});
