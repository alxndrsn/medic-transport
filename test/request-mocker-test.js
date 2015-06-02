var chai = require('chai'),
    assert = chai.assert,
    request = require('request'),
    sinon = require('sinon'),
    mock_request = require('./request-mocker.js').mock_request;

describe('mocker', function() {
  beforeEach(function() {
    this.timeout(500);
  });

  afterEach(function() {
    mock_request.restore();
  });

  it('should allow simple mocks with an object', function(done) {
    // given
    mock_request.mock({
      'GET http://example.com/path': [{content:true}]
    });

    // when
    request.get('http://example.com/path', function(err, resp, body) {
      // then
      assert.equal(err, null);
      assert.deepEqual(body, {content:true});
      done();
    });
  });
  it('should repeat final response for multiple requests', function(done) {
    // given
    mock_request.mock({
      'GET http://example.com/path': [{content:1}, {content:2}, {content:'everything else'}]
    });

    // when
    request.get('http://example.com/path', function(err, resp, body) {
      // then
      assert.deepEqual(body.content, 1);
    });
    // and
    request.get('http://example.com/path', function(err, resp, body) {
      // then
      assert.deepEqual(body.content, 2);
    });
    // and
    request.get('http://example.com/path', function(err, resp, body) {
      // then
      assert.deepEqual(body.content, 'everything else');
    });
    // and
    request.get('http://example.com/path', function(err, resp, body) {
      // then
      assert.deepEqual(body.content, 'everything else');
      done();
    });
  });
  it('should return an error for unmocked paths', function(done) {
    // given
    mock_request.mock({
      'GET http://example.com/path': [{content:1}, {content:2}, {content:'everything else'}]
    });

    // when
    request.get('http://example.com/bad_path', function(err, resp, body) {
      // then
      assert.ok(err);
      done();
    });
  });
  it('should call functions listed as responses', function(done) {
    // given
    mock_request.mock({
      'GET http://example.com/path': new function() { done(); }
    });

    // when
    request.get('http://example.com/path', function(err, resp, body) {
      console.log('In response handler with err=' + err +
          ' resp=' + resp +
          ' body=' + body);
//      done(new Error('Should not have got this far!'));
    });
  });
});
