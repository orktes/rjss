require('chai').should();

var fs = require('fs');
var RJSS = require('../lib/rjss');
var rjss = new RJSS({sourceMap: true});
var SourceMapConsumer = require('source-map').SourceMapConsumer;

describe('source maps', function () {
  it('should generate a source map', function () {

    var file = require.resolve('../test_data/lines.rjss');
    var result = rjss.parseFileSync(file);
    var code = result.getCode();
    var map = result.getSourceMap();

    var consumer = new SourceMapConsumer(map);

    var mapping = [
      [2,1],
      [3,3],
      [4,4],
      [8,8],
      [10,9],
      [11,10],
      [14,13],
      [16,14],
      [17,15],
      [18,16],
      [19,17],
      [20,18]
    ];

    mapping.forEach(function (lines) {
      var pos = consumer.originalPositionFor({
        line: lines[0],
        column: 1
      });

      pos.line.should.be.equal(lines[1]);

    });

    mapping.forEach(function (lines) {
      var pos = consumer.generatedPositionFor({
        source: file,
        line: lines[1],
        column: 1
      }).line.should.be.equal(lines[0]);
    });

  });
});
