var request = require('request'),
    moment = require('moment'),
    AUTOJSON = false;

exports.prototype = (function() {
	var self = this,
	is_running, timeout, transmit_handler,
	config = {},
	tick = function() {
		var poll_url = config.url + '/messages?state=pending';
		request.get(poll_url, function(err, resp, body) {
			if(is_running) schedule_next_tick();
			if(!AUTOJSON) body = JSON.parse(body);
			_.each(body, process_pending_message);
		});
	},
	schedule_next_tick = function() {
		timeout = setTimeout(tick, config.interval);
	},
	process_pending_message = function(m) {
		m = rewrite_message_for_transmission(m);
		transmit_handler(m, perform_http_callback);
	},
	perform_http_callback = function(err, tx_result) {
		var state = tx_result.status === 'success' ? 'sent' : 'failed',
		    state_url = config.url + '/messages/state/' + tx_result.uuid;
		request.put(state_url,
				{ state:state },
				state_update_callback);
	},
	state_update_callback = function(err, resp, body) {
	},
	rewrite_message_for_transmission = function (m) {
		return {
			uuid: m.uuid,
			content: m.message,
			to: m.to,
			timestamp: moment(m.sent_timestamp).unix()
		};
	};

	self.initialize = function(options) {
		config.interval = options.interval || 2000;
		config.url = options.url + '/api/v1';
	};
	self.start = function() {
		if(typeof transmit_handler !== 'function')
				throw new Error('No transmit handler set.');
		if(is_running) return;
		is_running = true;
		schedule_next_tick();
	};
	self.stop = function() {
		is_running = false;
		clearTimeout(timeout);
	};
	self.destroy = function() {};
	self.deliver = function() {};
	self.register_error_handler = function() {};
	self.register_transmit_handler = function(handler) {
		transmit_handler = handler;
	};

	return self;
}());
