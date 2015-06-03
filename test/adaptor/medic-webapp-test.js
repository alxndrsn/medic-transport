var adaptor = require('../../lib/adaptor.js'),
    mock_http = require('../request-mocker.js').mock_request;

describe('medic-webapp', function() {
  var mw,
      TEST_URL_ROOT = 'http://localhost/nonsense';

  beforeEach(function() {
    mw = adaptor.create('medic-webapp',
        {debug:true, pass:'secret', url:TEST_URL_ROOT, interval:100});
  });

  afterEach(function() {
    if(mw) mw.stop();
    mock_http.restore();
  });

  var TODO = function() { throw new Error('Not Yet Implemented'); },
      PENDING_MESSAGE_URL = '/api/v1/messages?state=pending';

  describe('mobile-originating', function() {
    describe('when not started', function() {
      it('should do nothing', function() {
        TODO();
      });
    });
    describe('when started', function() {
      it('should poll ' + PENDING_MESSAGE_URL, function() {
        TODO();
      });
    });
    describe('when ' + PENDING_MESSAGE_URL + ' provides a message', function() {
      it('should be transmitted', function() {
        TODO();
      });
    });
    describe('when ' + PENDING_MESSAGE_URL + ' provides messages', function() {
      it('should transmit all of them', function() {
        TODO();
      });
    });
    describe('when a message transmits successfully', function() {
      it('should update state with medic-webapp', function() {
        TODO();
      });
    });
    describe('when a message transmit fails', function() {
      it('should update state with medic-webapp', function() {
        TODO();
      });
      it('should retry sending three times', function() {
        TODO();
      });
      it('should notify error handler if it still fails', function() {
        TODO();
      });
    });
  });
  describe('mobile-terminating', function() {
    describe('successful delivery', function() {
      it('should be reported to medic-webapp', function() {
        TODO();
      });
      it('should occur once', function() {
        TODO();
      });
    });
    describe('failed deliver', function() {
      it('should be reported to medic-webapp', function() {
        TODO();
      });
      it('should be retried three times', function() {
        TODO();
      });
      it('should notify error handler if it still fails', function() {
        TODO();
      });
    });
  });
});
