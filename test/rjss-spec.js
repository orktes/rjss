var fs = require('fs');

require('chai').should();


var RJSS = require('../lib/rjss');
var rjss = new RJSS({sourceMap: true});

require.extensions['.rjss'] = function(module, filename) {
  var code;
  try {
    var result = rjss.parseFileSync(filename);
    code = result.getCode();
    //console.log(result.getSourceMap())
    //console.log("\n" + filename + "\n");
    //console.log(code);
    return module._compile(code, filename);
  } catch (e) {
    console.log(filename);
    console.log(code);
    throw e;
  }
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
      square: 100 * 100,
      lineHeight: 40,
      fontSize: 12,
      advanced: '123bar'
    });

    data = variablesDefinations({width: 0});
    data.should.deep.equal({
      top: 10,
      left: 0,
      width: 0,
      height: '100px',
      square: 100 * 100,
      lineHeight: 40,
      fontSize: 12,
      advanced: '123bar'
    });
  });

  it('should process rjss file with imports', function () {
    var imports = require('../test_data/imports.rjss');
    var data = imports();
    data.should.deep.equal({
      top: 10,
      left: 0,
      anotherWidth: '1000px',
      width: '100px',
      height: '100px',
      lineHeight: 40,
      fontSize: 12,
      advanced: '123bar'
    });

    data = imports({defines2: {width: 10}});
    data.should.deep.equal({
      top: 10,
      left: 0,
      anotherWidth: 10,
      width: '100px',
      height: '100px',
      lineHeight: 40,
      fontSize: 12,
      advanced: '123bar'
    });

    data = imports('bar');
    data.should.deep.equal({
      top: 100,
      left: 0,
      width: '100px',
      height: '100px',
      lineHeight: 40,
      square: 10000,
      fontSize: 12,
      advanced: '123bar'
    });

    data = imports('baz');
    data.should.deep.equal({
      foobar: "foobar",
      top: 100,
      left: 1000
    });

    data = imports('baz', {defines2: {foobar: function () {
      return "barfoo";
    }}});
    data.should.deep.equal({
      foobar: "barfoo",
      top: 100,
      left: 1000
    });
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

  it.skip('should process rjss file with macros', function () {
    var macros = require('../test_data/macros.rjss');
    macros().foobar.should.be.equal("foobar");
  });

  it('should process rjss file with strings', function () {
    var strings = require('../test_data/strings.rjss');

    var data = strings();

    data.textAlign.should.equal('center');
    data.position.should.equal('relative');
    data.color.should.equal('#fff');
  });


});
