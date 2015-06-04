var chai = require('chai'),
    assert = chai.assert,
    adaptor = require('../../lib/adaptor.js'),
    request = require('request'),
    mock_http = require('../request-mocker.js'),
    AUTOJSON = false;

describe('medic-webapp', function() {
  var adapter, mock_webapp,
      TEST_URL_ROOT = 'http://localhost/nonsense',
      TODO = function(done) { done(new Error('Not Yet Implemented')); },
      MESSAGES_PATH = '/api/v1/records',
      MESSAGES_URL = TEST_URL_ROOT + MESSAGES_PATH,
      PENDING_PATH = '/api/v1/messages?state=pending',
      PENDING_URL = TEST_URL_ROOT + PENDING_PATH,
      STATE_PATH = '/api/v1/messages/state/',
      STATE_URL = TEST_URL_ROOT + STATE_PATH,
      register_noop_transmit_handler = function() {
        adapter.register_transmit_handler(function() {}); };

  beforeEach(function() {
    adapter = adaptor.create('medic-webapp',
        {debug:true, pass:'secret', url:TEST_URL_ROOT, interval:100});
    mock_webapp = (function() {
      var self = this,
          behaviour = {},
          pending_message_queue = [],
          ID_MATCHER = new RegExp(/\/([^\/]*)$/),
          fail_deliveries;
      self.state_updates = {};
      self.received = [];

      self.poll_count = function() {
        return mock_http.handlers.GET[PENDING_URL].count;
      };
      self.push_pending_messages = function(messages) {
        pending_message_queue.push(messages);
      };
      self.fail_deliveries = function() {
        fail_deliveries = true;
      };

      behaviour['GET ' + PENDING_URL] = function() {
        var next = pending_message_queue.shift() || [];
        return _.isArray(next) ? next : [next];
      };
      behaviour['PUT ' + STATE_URL + '**'] = function(url, req, body) {
        var id = ID_MATCHER.exec(url)[1],
            state = req.state;
        state_updates[id] = state_updates[id] || [];
        state_updates[id].push(state);
      };
      behaviour['POST ' + MESSAGES_URL] = function(url, body) {
        if(fail_deliveries) {
          return { payload: { success:false } };
        } else {
          self.received.push(body);
          return { payload: { success:true } };
        }
      };
      mock_http.mock(behaviour);

      return self;
    }());
  });

  afterEach(function() {
    if(adapter) adapter.stop();
    mock_http.restore();
  });

  false && describe('test setup', function() {
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
    it('should provide empty list if no messages are pending', function(done) {
      // when
      request.get(PENDING_URL, function(err, options, body) {
        if(!AUTOJSON) body = JSON.parse(body);
        // then
        assert.deepEqual(body, []);
        done();
      });
    });
    it('should provide a message from the pending message queue once', function(done) {
      // setup
      mock_webapp.push_pending_messages({ to:'+1234567890', message:'hello' });

      // when
      request.get(PENDING_URL, function(err, options, body) {
        if(!AUTOJSON) body = JSON.parse(body);

        // then
        assert.equal(body.length, 1);
        assert.equal(body[0].to, '+1234567890');
        assert.equal(body[0].message, 'hello');

        // when
        request.get(PENDING_URL, function(err, options, body) {
          if(!AUTOJSON) body = JSON.parse(body);

          // then
          assert.deepEqual(body, []);
          done();
        });
      });
    });
    it('should provide messages from the pending message queue', function(done) {
      // setup
      mock_webapp.push_pending_messages([
          { to:'+1234567890', message:'hello' },
          { to:'+1111111111', message:'aaaaa' }]);

      // when
      request.get(PENDING_URL, function(err, options, body) {
        if(!AUTOJSON) body = JSON.parse(body);

        // then
        assert.equal(body.length, 2);
        assert.equal(body[0].to, '+1234567890');
        assert.equal(body[0].message, 'hello');

        assert.equal(body[1].to, '+1111111111');
        assert.equal(body[1].message, 'aaaaa');

        // when
        request.get(PENDING_URL, function(err, options, body) {
          if(!AUTOJSON) body = JSON.parse(body);

          // then
          assert.deepEqual(body, []);
          done();
        });
      });
    });
    it('should maintain a store of state updates', function() {
      assert.deepEqual(mock_webapp.state_updates, {});
    });
    it('should log state updates', function(done) {
      request.put(TEST_URL_ROOT + '/api/v1/messages/state/a-1',
          { state:'pending', details:{} },
          function() {
            assert.deepEqual(mock_webapp.state_updates,
                { 'a-1':['pending'] });
            request.put(TEST_URL_ROOT + STATE_PATH + 'a-1',
                { state:'failed', details:{} },
                function() {
                  assert.deepEqual(mock_webapp.state_updates,
                      { 'a-1':['pending', 'failed'] });
                  done();
                });
          });
    });
    it('should record saved messages', function(done) {
      assert.deepEqual(mock_webapp.received, []);

      // when
      request.post(MESSAGES_URL, { to:'+123', message:'abc' }, function() {
        // then
        assert.deepEqual(mock_webapp.received,
            [{ to:'+123', message:'abc' }]);

        // when
        request.post(MESSAGES_URL, { to:'+456', message:'def' }, function() {
          // then
          assert.deepEqual(mock_webapp.received, [{ to:'+123', message:'abc' },
              { to:'+456', message:'def' }]);
          done();
        });
      });
    });
    it('should fail deliveries if told to', function(done) {
      // given
      mock_webapp.fail_deliveries();

      // when
      request.post(MESSAGES_URL, { to:'+123', message:'abc' }, function(err, resp, body) {
        assert.notOk(err);
        assert.deepEqual(JSON.parse(body), { payload: { success: false } });
        done();
      });
    });
  });

  describe('initialize', function() {
    it('should fail if no transmit handler is set', function() {
      try {
        adapter.start();
        assert.ok(false);
      } catch(err) {
        assert.equal(err.toString(), 'Error: No transmit handler set.');
      }
    });
  });

  describe('mobile-originating', function() {
    describe('when not started', function() {
      it('should do nothing', function(done) {
        this.timeout(0);
        setTimeout(function() {
          assert.equal(mock_webapp.poll_count(), 0);
          done();
        }, 200);
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
        register_noop_transmit_handler();

        // when
        adapter.start();
      });
      it('should poll once every interval', function(done) {
        // setup
        this.timeout(0);

        // then
        setTimeout(function() {
          assert.isAbove(mock_webapp.poll_count(), 3);
          assert.isBelow(mock_webapp.poll_count(), 7);
          done();
        }, 500);
        register_noop_transmit_handler();

        // when
        adapter.start();
      });
      it('should no longer poll when stopped', function(done) {
        // setup
        this.timeout(0);
        register_noop_transmit_handler();

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
    describe('when ' + PENDING_PATH + ' provides bad JSON', function() {
      it('should call the callback with a suitable error', function(done) {
        TODO(done);
      });
    });
    describe('when ' + PENDING_PATH + ' provides a message', function() {
      it('should be passed to the transmit handler', function(done) {
        // setup
        mock_webapp.push_pending_messages({ to:'+123', message:'hi' });

        adapter.register_transmit_handler(function(message, callback) {
          // then
          assert.equal(message.to, '+123');
          assert.equal(message.content, 'hi');
          // TODO we should really be supplying uuid and timestamp in our
          // original messages.  Perhaps it's safe not to test them?
          //assert.ok(message.uuid);
          //assert.ok(message.timestamp);
          done();
        });

        // when
        adapter.start();
      });
    });
    describe('when ' + PENDING_PATH + ' provides messages', function() {
      it('should transmit all of them', function(done) {
        // setup
        mock_webapp.push_pending_messages([
            { to:'+123', message:'hi' },
            { to:'+456', message:'ho' }]);

        // then
        var transmit_handler_calls = 0;
        adapter.register_transmit_handler(function(message, callback) {
          // then
          ++transmit_handler_calls;
          if(transmit_handler_calls == 1) {
            assert.equal(message.to, '+123');
            assert.equal(message.content, 'hi');
          } else if(transmit_handler_calls == 2) {
            assert.equal(message.to, '+456');
            assert.equal(message.content, 'ho');
            done();
          }
        });

        // when
        adapter.start();
      });
      it('should not stack overflow even with many messages', function(done) {
        // TODO this potential bug may be why async.eachSeries is used instead
        // of _.each?
        TODO(done);
      });
    });
    describe('when a message transmits successfully', function() {
      it('should update state with medic-webapp', function(done) {
        // setup
        this.timeout(0);
        mock_webapp.push_pending_messages({ uuid:'a-1', to:'+123', message:'hi' });
        adapter.register_transmit_handler(function(message, callback) {
          callback(null, { uuid:message.uuid, status:'success' });
        });

        // then
        setTimeout(function() {
          assert.deepEqual(mock_webapp.state_updates,
              { 'a-1':['sent'] });
          done();
        }, 200);

        // when
        adapter.start();
      });
    });
    describe('when a message transmit fails', function() {
      it('should update state with medic-webapp', function(done) {
        // setup
        this.timeout(0);
        mock_webapp.push_pending_messages({ uuid:'a-1', to:'+123', message:'hi' });
        adapter.register_transmit_handler(function(message, callback) {
          callback(null, { uuid:message.uuid, status:'failure' });
        });

        // then
        setTimeout(function() {
          assert.deepEqual(mock_webapp.state_updates,
              { 'a-1':['failed'] });
          done();
        }, 200);

        // when
        adapter.start();
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
      it('should be reported to medic-webapp', function() {
        // when
        adapter.deliver({ from:'+123', content:'hi' });

        // then
        assert.equal(mock_webapp.received.length, 1);
        assert.equal(mock_webapp.received[0].from, '+123');
        assert.equal(mock_webapp.received[0].message, 'hi');
      });
      it('should occur once', function(done) {
        TODO(done);
      });
      it('should report delivery status to supplied callback', function(done) {
        // when
        adapter.deliver({ from:'+123', content:'hi' }, function(err, rx_result) {
          assert.notOk(err);
          assert.equal(rx_result.status, 'success');
          done();
        });
      });
    });
    describe('failed delivery', function() {
      it('should be retried three times', function(done) {
        TODO(done);
      });
      it('should notify error handler if it still fails', function(done) {
        TODO(done);
      });
      it('should report delivery status to supplied callback', function(done) {
        // given
        mock_webapp.fail_deliveries();

        // when
        adapter.deliver({ from:'+123', content:'hi' }, function(err, rx_result) {
          assert.notOk(err);
          assert.equal(rx_result.status, 'failure');
          done();
        });
      });
    });
  });
});
