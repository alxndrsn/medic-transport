
var path = require('path');
_ = require('underscore');

/**
* @name create:
*   Factory method. Create an instance of the router class
*   whose name matches `_router_name`, and return the instance.
*/
exports.create = function (_router_name /* ... */) {

  var router_name = path.basename(_router_name, '.js') + '.js';
  var router_path = path.resolve(__dirname, 'router', router_name);

  var router = require(router_path);

  var klass = function (_arguments) {
    return this.initialize.apply(this, _arguments);
  };

  klass.prototype = _.extend({}, router.prototype);
  return new klass(Array.prototype.slice.call(arguments, 1));
};