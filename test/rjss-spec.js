var fs = require('fs');

require('chai').should();


var RJSS = require('../lib/rjss');

describe('rjss', function () {
  it('should process simple rjss file with two rules', function () {
    var rjss = new RJSS();

    var result = rjss.parseFile(require.resolve('../test_data/simple.rjss'));

    console.log(result);
  });

  it('should process rjss file with one rule and variables', function () {

  });

  it('should process rjss file with one rule and functions and variables', function () {

  });

  it('should process rjss file with variable defination', function () {

  });

  it('should process rjss file with imports', function () {

  });
});
