var request = require('request');

exports.prototype = (function() {
	var self = this,
	    tick = function() {
		var poll_url = self.url + '/messages?state=pending';
		request.get(poll_url, function(err) {
			if(self.is_running) schedule_next_tick();
			console.log('tick().request_callback() :: arguments = '
					+ arguments.length + ';'
					+ 'err=' + err);
		});
	},
	schedule_next_tick = function() {
		self.timeout = setTimeout(tick, self.interval);
	};

	self.initialize = function(options) {
		self.interval = options.interval || 2000;
		self.url = options.url + '/api/v1';
	};
	self.start = function() {
		if(self.is_running) return;
		self.is_running = true;
		schedule_next_tick();
	};
	self.stop = function() {
		self.is_running = false;
		clearTimeout(self.timeout);
	};
	self.destroy = function() {};
	self.deliver = function() {};
	self.register_error_handler = function() {};
	self.register_transmit_handler = function() {};

	return self;
}());
