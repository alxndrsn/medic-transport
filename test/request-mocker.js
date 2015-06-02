var request = require('request'),
    _ = require('underscore'),
    sinon = require('sinon'),
    DEBUG = false;

"use strict";
exports.mock_request = (function() {
  var handle_action = function(handler, url, callback) {
    var hit_count = handler.count++,
        actions = handler.actions,
        response_body;

    if(_.isArray(handler.actions)) {
      if(hit_count < actions.length) {
        response_body = perform_action(actions[hit_count]);
      } else {
        response_body = perform_action(actions[actions.length-1]);
      }
    } else response_body = perform_action(actions);

    // TODO set response-type as JSON
    callback(null, { 
            headers: { 'Content-type': 'application/json' },
            statusCode:200 },
        response_body);
  },
  perform_action = function(action) {
    if(typeof action === 'function') {
      return action();
    } else if(typeof action === 'string') {
      return action;
    } else {
      return action;
    }
  };

  this.restore = function() {
    request.get.restore && request.get.restore();
    request.post.restore && request.post.restore();
  };
  this.mock = function(behaviour) {
    var map = { GET:{}, POST:{} };
    _.mapObject(behaviour, function(resp, req) {
      if(DEBUG) console.log('Mapping: ' + req + ' -> ' + resp);
      var pieces = req.split(' ', 2),
          verb = pieces[0].toUpperCase(),
          url = pieces[1];
      if(DEBUG) console.log('  verb: ' + verb + ', url: ' + url);
      map[verb][url] = { count:0, actions:resp };
    });
    sinon.stub(request, 'get', function(url, callback) {
      if(DEBUG) console.log('GET: url=' + url + ', callback=' + callback);
      var handler = map.GET[url];
      if(!handler) {
        callback(new Error('No mock found for GET at: ' + url));
        return;
      }
      return handle_action(handler, url, callback);
    });
    sinon.stub(request, 'post', function(url, callback) {
      var handler = map.POST[url];
      if(!handler) {
        callback(new Error('No mock found for POST at: ' + url));
        return;
      }
      return handle_action(handler, url, callback);
    });
  };

  return this;
}());

