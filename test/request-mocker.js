var request = require('request'),
    _ = require('underscore'),
    sinon = require('sinon'),
    DEBUG = false,
    AUTOJSON = false;

"use strict";
exports.mock_request = (function() {
  var map,
  handle_action = function(handler, url, options, callback) {
    if(DEBUG) console.log('handle_action() :: url=' + url);

    var hit_count = handler.count++,
        actions = handler.actions,
        response_body;

    if(_.isArray(handler.actions)) {
      if(hit_count < actions.length) {
        response_body = perform_action(actions[hit_count], url, options);
      } else {
        response_body = perform_action(actions[actions.length-1], url, options);
      }
    } else response_body = perform_action(actions, url, options);

    // TODO set response-type as JSON
    callback(null, {
            headers: { 'Content-type': 'application/json' },
            statusCode:200 },
        AUTOJSON ? response_body : JSON.stringify(response_body));
  },
  perform_action = function(action, url, options) {
    if(typeof action === 'function') {
      if(DEBUG) console.log('perform_action() returning result of "action":' + action);
      return action(url, options);
    } else if(typeof action === 'string') {
      if(DEBUG) console.log('perform_action() returning "action":' + action);
      return action;
    } else {
      if(DEBUG) console.log('perform_action() returning "action":' + JSON.stringify(action));
      return action;
    }
  },
  stubs_for = function(verbs) {
    _.each(verbs, function(verb) {
      var VERB = verb.toUpperCase();
      sinon.stub(request, verb, function(url, options, callback) {
        if(DEBUG) console.log('request() :: initial args = [' +
            typeof url + ', ' +
            typeof options + ', ' +
            typeof callback + ']');
        if(typeof url === 'object') {
          if(DEBUG) console.log('Received url as `options` object - remapping...');
          if(typeof callback !== 'undefined') {
            throw new Error('Too many args supplied.');
          }
          callback = options;
          options = url;
          url = options.url;
        }
        if(typeof callback === 'undefined') {
          // TODO check if including `options` in convenience methods is
          // actually supported
          callback = options;
          options = {};
        }
        callback = callback || function() {};

        if(DEBUG) console.log('request() :: remappd args = [' +
            typeof url + ', ' +
            typeof options + ', ' +
            typeof callback + ']');
        if(DEBUG) console.log(VERB + ':' +
            ' url=' + JSON.stringify(url) +
            ' options=' + JSON.stringify(options) +
            ' callback=' + JSON.stringify(callback));

        var handler = map[VERB][url];
        if(!handler) {
          callback(new Error('No mock found for ' + VERB + ' at: ' + url));
          return;
        }
        if(DEBUG) console.log('Found handler for ' + VERB + ' to ' + url + '!');
        return handle_action(handler, url, options, callback);
      });
    });
  };

  this.restore = function() {
    request.get.restore && request.get.restore();
    request.post.restore && request.post.restore();
    map = {};
  };
  this.mock = function(behaviour) {
    map = { GET:{}, POST:{} };
    _.mapObject(behaviour, function(resp, req) {
      if(DEBUG) console.log('Mapping: ' + req + ' -> ' + resp);
      var pieces = req.split(' ', 2),
          verb = pieces[0].toUpperCase(),
          url = pieces[1];
      if(!verb || !url) {
        throw new Error('Both VERB and URL to mock.  Supplied:' + req);
      }
      if(DEBUG) console.log('  verb: ' + verb + ', url: ' + url);
      map[verb][url] = { count:0, actions:resp };
    });
    stubs_for(['get', 'post']);
    // TODO need to stub the global `request()` method
  };

  return this;
}());

