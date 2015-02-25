var fs = require('fs');

require('chai').should();

var parser = require('../lib/parser');

describe('parser', function () {
  it('should parse simple rjss file with two rules', function () {
    var result = parser.parse(fs.readFileSync(require.resolve('../test_data/simple.rjss')).toString());

    result.rulelist.should.exist;
    result.rulelist.length.should.equal(2);

    var firstRule = result.rulelist[0];
    firstRule.selector.should.equal('main');
    firstRule.declarations.top.value.should.equal('10');
    firstRule.declarations.left.value.should.equal('0');
    firstRule.declarations.width.value.should.equal('100px');
    firstRule.declarations.height.value.should.equal('20');
    firstRule.declarations.lineHeight.value.should.equal('20');
    firstRule.declarations.fontSize.value.should.equal("12");

    var secondRule = result.rulelist[1];
    secondRule.selector.should.equal('button');
    secondRule.declarations.top.value.should.equal('10');
    secondRule.declarations.left.value.should.equal('0');
    secondRule.declarations.width.value.should.equal('100px');
    secondRule.declarations.height.value.should.equal('20');
    secondRule.declarations.lineHeight.value.should.equal('20');
    secondRule.declarations.fontSize.value.should.equal("12");

  });

  it('should parse rjss file with one rule and variables', function () {
    var result = parser.parse(fs.readFileSync(require.resolve('../test_data/variables.rjss')).toString());

    result.rulelist.should.exist;
    result.rulelist.length.should.equal(1);

    var firstRule = result.rulelist[0];
    firstRule.selector.should.equal('main');
    firstRule.declarations.top.value.should.equal('10');
    firstRule.declarations.left.value.should.equal('0');
    firstRule.declarations.width.value.should.equal('width + \'px\'');
    firstRule.declarations.foobar.value.should.equal('testing + foo + bar(foo).baz');
    firstRule.declarations.height.value.should.equal('height');
    firstRule.declarations.lineHeight.value.should.equal('20');
    firstRule.declarations.fontSize.value.should.equal("12");
  });

  it('should parse rjss file with one rule and functions and variables', function () {
    var result = parser.parse(fs.readFileSync(require.resolve('../test_data/functions.rjss')).toString());

    result.rulelist.should.exist;
    result.rulelist.length.should.equal(1);

    var firstRule = result.rulelist[0];
    firstRule.selector.should.equal('main');
    firstRule.declarations.top.value.should.equal('10');
    firstRule.declarations.left.value.should.equal('0');
    firstRule.declarations.width.name.should.equal('calc');
    firstRule.declarations.width.attributes.length.should.equal(2);
    firstRule.declarations.lineHeight.value.should.equal('20');
    firstRule.declarations.fontSize.value.should.equal("12");
  });

  it('should parse rjss file with variable defination', function () {
    var result = parser.parse(fs.readFileSync(require.resolve('../test_data/variable_define.rjss')).toString());
    result.defines.should.exist;
    Object.keys(result.defines).length.should.equal(5);
    result.defines.width.value.should.equal('100px');
    result.defines.height.value.should.equal('100px');
    result.defines.calc.type.should.equal('FUNC_DEF');
    result.defines.calc.attributes.length.should.equal(2);
    result.defines.calc.value.trim().should.equal('return attr1 * attr2;');
  });

  it('should parse rjss file with imports', function () {
    var result = parser.parse(fs.readFileSync(require.resolve('../test_data/imports.rjss')).toString());
    result.imports.should.exist;
    result.imports.length.should.equal(1);
    result.imports[0].file.should.equal('./variable_define.rjss');
  });

  it('should parse rjss file with extends', function () {
    var result = parser.parse(fs.readFileSync(require.resolve('../test_data/extends.rjss')).toString());
    result.rulelist.should.exist;
    result.rulelist.length.should.equal(2);
    result.rulelist[1].parents[0].should.equal('main');
  });
});
