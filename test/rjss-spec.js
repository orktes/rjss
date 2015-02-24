var fs = require('fs');

require('chai').should();


var RJSS = require('../lib/rjss');
var rjss = new RJSS();

require.extensions['.rjss'] = function(module, filename) {
  var result = rjss.parseFile(filename);
  return module._compile(result.getCode(), filename);
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
    // THIS will fail until support is implemented
    /**
    main {
      top: 10;
      left: 0;
      width: ${width +'px'};
      height: $height;
      foobar: ${testing + foo + bar(foo).baz}
      line-height: 20;
      fontSize: 12;
    }
    **/

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
      fontSize: 12
    });


  });

  it('should process rjss file with one rule and functions and variables', function () {

  });

  it('should process rjss file with variable defination', function () {

  });

  it('should process rjss file with imports', function () {

  });
});
