var async = require('async'),
    _ = require('underscore'),
    jsdump = require('jsDump'),
    moment = require('moment'),
    http_request = require('request');

exports.prototype = {
  initialize: function (_options) {
    this._options = _options || {};
    this._url = this._options.url;

    this._error_handler = false;
    this._transmit_handler = false;

    this._previously_sent_uuids = {};
    this._http_callback_autoreplies = [];

    // TODO probably don't need both of these vars
    this._is_polling = false;
    this._is_started = false;

    this._pass = this._options.pass || this._options.password;
    this._user = this._options.user || this._options.username || 'admin';

    this._debug = this._options.debug;

    this._poll_interval = parseInt((this._options.interval || 5000), 10);

    this._max_callback_depth =
      parseInt((this._options.max_callback_depth || 15), 10);

    return this;
  },

  /**
   * @name deliver:
   *   Deliver the message `_message` to this adaptor's medic-webapp
   *   instance. Invoke `_callback(_err, _rx_result)` once the message has
   *   been successfully received and committed to Kujua Lite's persistent
   *   storage.
   *
   *   The `_message` argument should be an object, containing at least
   *   three properties: `content` should contain the body of the message,
   *   `from` should contain the phone number (MSISDN) from which the
   *   message originated, and `timestamp` should contain the ISO-8601
   *   formatted timestamp (i.e. "combined date and time in UTC") of when
   *   the message was first received by the originating system.
   */
  deliver: function (_message, _callback) {
    var self = this;

    var request = {
      url: this._url + '/add',
      auth: { user: this._user, pass: this._pass },
      form: self._rewrite_message_for_delivery(_message)
    };

    http_request.post(request, function (_err, _resp, _body) {
      if (_err) {
        return _callback.call(self, _err);
      }

      var response = null;
      try {
        response = JSON.parse(_body);
      } catch (_e) {
        return _callback.call(self, _e);
      }

      var rc = response.callback;
      var rv = { total_sent: 1, status: 'success' };
      if (!rc) {
        return _callback.call(self, null, rv);
      }
      return self._perform_http_callbacks(rc, 1, function (_e) {
        if (_e) {
          return _callback.call(self, _e, { total_sent: 0, status: 'failure' });
        }
        return _callback.call(self, null, rv);
      });
    });
    return this;
  },

  register_transmit_handler: function (_handler) {
    this._transmit_handler = _handler;
    return this;
  },

  register_error_handler: function (_handler) {
    this._error_handler = _handler;
    return this;
  },

  start: function () {
    this._is_polling = true;
    if (!this._is_started) {
      this._run_transmit_timer();
      this._is_started = true;
    }
    return this;
  },

  stop: function () {
    this._is_polling = false;
    clearTimeout(this.timeout);
    return this;
  },

  destroy: function () {
    return this.stop();
  },

  _invoke_transmit_handler: function (_message, _callback) {
    if (!_.isFunction(this._transmit_handler)) {
      return _completion_callback.call(self, new Error(
        'No transmit handler is registered; please ' +
          'register one before invoking the `start` method'
      ));
    }

    var uuid = _message.uuid;
    if (uuid && this._previously_sent_uuids[uuid]) {
      return _callback.call(this, false, {
        status: 'success', previously_sent: true
      });
    }
    return this._transmit_handler.call(this, _message, _callback);
  },

  _rewrite_message_for_delivery: function (_message) {
    var timestamp = _message.sent_timestamp || moment().unix();
    var m = moment.unix(timestamp);
    return {
      message: _message.content,
      from: _message.from,
      sent_timestamp: m.format()
    };
  },

  _rewrite_message_for_transmission: function (_message) {
    return {
      uuid: _message.uuid,
      content: _message.message,
      to: _message.to,
      timestamp: moment(_message.sent_timestamp).unix()
    };
  },

  _run_transmit_timer: function () {
    var self = this;
    self.timeout = setTimeout(function () {
      self._handle_transmit_timer(function (_err) {
        if (self._is_polling) {
          return self._run_transmit_timer();
        }
        self._is_started = false;
      });

    }, self._poll_interval);
    return self;
  },

  _handle_transmit_timer: function (_completion_callback) {
    var self = this;

    self._poll_for_transmit(function (_err, _poll_results) {
      var payload = (_poll_results || {}).payload;
      var messages = (payload || {}).messages || [];
      var total_messages = messages.length;

      if (total_messages <= 0) {
        return _completion_callback.call(self);
      }

      var total_sent = 0;

      self._discard_http_callback_autoreplies();

      async.each(messages,
        /* Iterator */ function (_message, _callback) {
          var message;
          try {
            message = self._rewrite_message_for_transmission(_message);
          } catch (_e) {
            self._log_transmit_format_error(_e);
            return _callback(); /* Next message */
          }

          self._invoke_transmit_handler(message, function (_e, _tx_result) {
            if (_e) {
              self._handle_transmit_error(_e);
              return _callback(_e);
            }
            if (message.uuid) {
              self._previously_sent_uuids[message.uuid] = true;
            }
            ++total_sent;
            return _callback(); /* Next message */
          });
        },
        /* Final */ function (_e) {
         if (_e) {
           /* Hard error:
               If we couldn't even start processing the batch due to
               an error, skip this step and just inform our instansiator. */
           return _completion_callback.call(self, _e);
         }

         if (total_sent < total_messages) {
           // FIXME we should actually be doing something here, otherwise
           // we will still perform the callback!
         }
         return self._perform_http_callbacks(
           _poll_results.callback, 1, _completion_callback
         );
        }
      );
    });
    return self;
  },

  _build_callback_request: function(_callback_object) {
    var o = (_callback_object.options || {});

    var url =
      (o.protocol || 'http') + '://' +
      (o.host || 'localhost') + ':' +
      (o.port || 5984) +
      (o.path || '/');

    return request = {
      url: url,
      headers: (o.headers || {}),
      method: (o.method || 'GET'),
      body: JSON.stringify(_callback_object.data || {})
    };
  },

  _handle_transmit_error: function (_e) {
    /* Message couldn't be transmitted:
        Our underlying driver was unable to send this message.
        Don't invoke any callbacks; we'll retry again next time. */
    // FIXME how does the retry occur?
    if(this._error_handler) {
      this._error_handler(_e);
    }
  },

  _perform_http_callbacks: function (_callback_object, _depth, _callback) {
    var self = this;

    if (_depth > self._max_callback_depth) {
      return _callback.call(self, new Error(
        'While processing callbacks: ' +
          'Reached maximum recursion depth of ' + self._max_callback_depth
      ));
    }

    var request = self._build_callback_request(_callback_object);

 // FIXME have hardcoded this to `get()` to temporarily solve mocking issues
    http_request.get(request, function (_err, _resp, _body) {
      if (_err) {
        return _callback.call(self, _err);
      }

      var body = null;
      try {
        body = JSON.parse(_body);
      } catch (_e) {
        return _callback.call(self, _e);
      }

      if (_.indexOf([ 200, 201 ], _resp.statusCode) < 0) {
        return _callback.call(self, new Error(
          'HTTP callback returned an error status of ' + _resp.statusCode
        ));
      }

      var payload = body.payload || {};
      var next_callback_object = body.callback;

      if (_.isArray(payload.messages)) {
        self._append_http_callback_autoreplies(payload.messages);
      }

      if (!next_callback_object) {
        return self._transmit_http_callback_autoreplies(_callback);
      }
      return self._perform_http_callbacks(
        next_callback_object, _depth + 1, _callback
      );
    });
  },

 _append_http_callback_autoreplies: function (_messages) {
   var self = this;
   _.each(_messages, function (_message) {
     self._http_callback_autoreplies.push(_message);
   });
 },

 _discard_http_callback_autoreplies: function () {
   this._http_callback_autoreplies = [];
 },

 _transmit_http_callback_autoreplies: function (_callback) {
   var self = this;

   async.each(this._http_callback_autoreplies,
     function (_message, _completion_fn) {
       var message;
       try {
         message = self._rewrite_message_for_transmission(_message);
       } catch (e) {
         return _completion_fn(e);
       }

       /* Omit the transmit-completed callback:
           If we're currently in the process of receiving messages,
           further incoming messages won't be processed until we
           invoke `_completion_fn`. If we wait try to wait until the
           autoreply has been actually transmitted, we'll deadlock
           (N.B. we won't finish the receive process until the message
           is transmitted, and we won't process the queue of outgoing
           messages until we've finished processing the incoming ones). */

       self._invoke_transmit_handler(message, function () {
         self._debug_print(
           '_transmit_http_callback_autoreplies: reply sent'
         );
       });

       _completion_fn();
     },

     function (_err) {
       self._discard_http_callback_autoreplies();
       return _callback.call(self, _err);
     }
   );
   return self;
 },

  _poll_for_transmit: function (_callback) {
    var self = this;
    var request = {
      method: 'GET',
      url: this._url + '/add',
      auth: { user: this._user, pass: this._pass }
    };
    http_request.get(request, function (_err, _resp, _body) {
      var rv = null;
      try {
        rv = JSON.parse(_body);
      } catch (_e) {
        return _callback.call(self, _e);
      }
      return _callback.call(self, _err, rv);
    });
  },

  _log_transmit_format_error: function (_e, _message) {
    this._debug_print('transmit_handler: Invalid or unrecognized message format');
    this._debug_print('format exception was: ' + JSON.stringify(_e));
    this._debug_print('original message was: ' + JSON.stringify(_message));
  },

  _debug_http_request: function (_req) {
    var self = this;

    self._debug_print('_debug_http_request: starting');
    self._debug_print('  URL: ' + _req.url);
    self._debug_print('  Method: ' + _req.method);
    self._debug_print('  Body: ' + _req.body);
    self._debug_print('  Headers: ' + JSON.stringify(_req.headers || {}));
    self._debug_print('_debug_http_request: finished');

    return self;
  },

  _debug_http_response: function (_err, _req, _resp, _body) {
    var self = this;

    self._debug_print('_debug_http_response: starting');
    self._debug_print('  Result: ' + (_err ? 'Error' : 'Successful'));

    if (_err) {
      self._debug_print('  Error Message: ' + _err.message);
    }

    self._debug_print('  Original URL: ' + _req.url);
    self._debug_print('  Original Method: ' + _req.method);
    self._debug_print('  Status: ' + (_resp || {}).statusCode);
    self._debug_print('  Body: ' + _body);
    self._debug_print('_debug_http_response: finished');

    return self;
  },

  _debug_print: function (_string) {
    if (this._debug) {
      process.stderr.write(_string.replace(/\s+$/, '') + '\n');
    }
  }
};
