var adaptor = require('../adaptor.js'),
    request = require('request');

exports.prototype = (function() {
  "use strict";
  var self = {},

  wrap = function(type, options) {
    self.wrapping = type;

    var wrapped = adaptor.create(type, options);

    self.start = wrapped.start;
    self.stop = wrapped.stop;
    self.destroy = wrapped.destroy;
    self.deliver = wrapped.deliver;
    self.register_error_handler = wrapped.register_error_handler;
    self.register_transmit_handler = wrapped.register_transmit_handler;
  };

  self.initialize = function(options) {
    self = this;
    request.head(options.url + '/api/v1/messages', function(err, response) {
      if(err || response.statusCode != 200) {
        wrap('medic-mobile', options);
      } else {
        wrap('medic-webapp', options);
      }
    });
  };

  return self;
}());

