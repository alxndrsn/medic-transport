var chai = require('chai'),
    adaptor = require('../../lib/adaptor.js'),
    assert = chai.assert,
    mock_http = require('../request-mocker.js');

describe('medic-wrapper', function() {
  it('should check for the new API on initialization', function(done) {
    // given
    mock_http.mock({
      'HEAD http://localhost:5988/api/v1/messages':function() { done(); }
    });

    // when
    adaptor.create('medic-wrapper',
        { url:'http://localhost:5988' });
  });

  describe('can contact the new API', function() {
    beforeEach(function() {
      mock_http.mock({
        'HEAD http://localhost:5988/api/v1/messages':''
      });
    });
      
    it('should decorate the new adaptor', function() {
      // when
      var adapter = adaptor.create('medic-wrapper',
          { url:'http://localhost:5988' });

      // then
      assert.equal(adapter.wrapping, 'medic-webapp');
    });
  });

  describe('cannot contact the new API', function() {
    beforeEach(function() {
      mock_http.mock({
        'HEAD http://localhost:5988/api/v1/messages':function(request, url, callback) {
          callback(null, { statusCode:404 }, '');
        }
      });
    });
    it('should decorate the old adaptor', function() {
      // when
      var adapter = adaptor.create('medic-wrapper',
          { url:'http://localhost:5988' });

      // then
      assert.equal(adapter.wrapping, 'medic-mobile');
    });
  });
});
