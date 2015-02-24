var fs = require('fs');

require('chai').should();


var RJSS = require('../lib/rjss');
var rjss = new RJSS();

require.extensions['.rjss'] = function(module, filename) {
  var result = rjss.parseFile(filename);
  var code = result.getCode();
  //console.log(code);
  return module._compile(code, filename);
};

describe('rjss', function () {
  it('should process simple rjss file with two rules', function () {
    var simple = require('../test_data/simple.rjss');

    var main = simple('main');
    main.top.should.equal(10);
    main.left.should.equal(0);
    main.width.should.equal('100px');
    main.height.should.equal(20);
    main.lineHeight.should.equal(20);
    main.fontSize.should.equal(12);

    main = simple();
    main.top.should.equal(10);
    main.left.should.equal(0);
    main.width.should.equal('100px');
    main.height.should.equal(20);
    main.lineHeight.should.equal(20);
    main.fontSize.should.equal(12);

    var button = simple('button');
    button.top.should.equal(10);
    button.left.should.equal(0);
    button.width.should.equal('100px');
    button.height.should.equal(20);
    button.lineHeight.should.equal(20);
    button.fontSize.should.equal(12);

  });

  it('should process rjss file with one rule and variables', function () {
    var variables = require('../test_data/variables.rjss');

    variables({
      width: 10,
      height: 10,
      testing: "test",
      foo: "foo",
      bar: function (attr) {
        return {
          baz: attr
        }
      }
    }).should.deep.equal({
      top: 10,
      left: 0,
      width: '10px',
      height: 10,
      foobar: 'testfoofoo',
      lineHeight: 20,
      fontSize: 12,
      barfoo: 'bar'
    });
  });

  it('should process rjss file with one rule and functions and variables', function () {
    var funcsAndRules = require('../test_data/functions.rjss');

    var data = funcsAndRules({
      calc: function (a, b) {
        return a * b;
      },
      width: 100
    });

    data.width.should.equal(20 * 100);
  });

  it('should process rjss file with variable defination', function () {
    var variablesDefinations = require('../test_data/variable_define.rjss');
    var data = variablesDefinations();
    data.should.deep.equal({
      top: 10,
      left: 0,
      width: '100px',
      height: '100px',
      lineHeight: 40,
      fontSize: 12,
      advanced: '123bar'
    });
  });

  it('should process rjss file with imports', function () {

  });

  it('should process rjss file with extends', function () {
    var extended = require('../test_data/extends.rjss');
    var data = extended('button');
    data.should.deep.equal({
      top: 10,
      left: 0,
      width: '100px',
      height: 20,
      lineHeight: 20,
      fontSize: 120
    });

    data = extended('main');
    data.should.deep.equal({
      top: 10,
      left: 0,
      width: '100px',
      height: 20,
      lineHeight: 20,
      fontSize: 12
    });
  });
});
