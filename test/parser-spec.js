var fs = require('fs');

require('chai').should();

var parser = require('../lib/parser');

describe('parser', function () {
  it('should parse simple rjss file with two rules', function () {
    var result = parser.parse(fs.readFileSync(require.resolve('../test_data/simple.rjss')).toString());

    result.rules.should.exist;
    Object.keys(result.rules).length.should.equal(2);

    var firstRule = result.rules.main;
    firstRule.selector.should.equal('main');
    firstRule.declarations.top.value.should.equal('10');
    firstRule.declarations.left.value.should.equal('0');
    firstRule.declarations.width.value.should.equal('100px');
    firstRule.declarations.height.value.should.equal('20');
    firstRule.declarations.lineHeight.value.should.equal('20');
    firstRule.declarations.fontSize.value.should.equal("12");

    var secondRule = result.rules.button;
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

    result.rules.should.exist;
    Object.keys(result.rules).length.should.equal(1);

    var firstRule = result.rules.main;
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

    result.rules.should.exist;
    Object.keys(result.rules).length.should.equal(1);

    var firstRule = result.rules.main;
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
    result.variables.should.exist;
    result.functions.should.exist;
    Object.keys(result.variables).length.should.equal(3);
    Object.keys(result.functions).length.should.equal(2);
    result.variables.width.value.should.equal('100px');
    result.variables.height.value.should.equal('100px');
    result.functions.calc.type.should.equal('FUNC_DEF');
    result.functions.calc.attributes.length.should.equal(2);
    result.functions.calc.value.trim().should.equal('return attr1 * attr2;');
  });

  it('should parse rjss file with imports', function () {
    var result = parser.parse(fs.readFileSync(require.resolve('../test_data/imports.rjss')).toString());
    result.imports.should.exist;
    result.imports.length.should.equal(2);
    result.imports[0].file.should.equal('./variable_define2.rjss');
    result.imports[0].name.should.equal('defines2')
    result.imports[1].file.should.equal('./variable_define.rjss');
  });

  it('should parse rjss file with extends', function () {
    var result = parser.parse(fs.readFileSync(require.resolve('../test_data/extends.rjss')).toString());
    result.rules.should.exist;
    Object.keys(result.rules).length.should.equal(2);
    result.rules.button.parents[0].should.equal('main');
  });

  it('should parse rjss file with strings', function () {
    var result = parser.parse(fs.readFileSync(require.resolve('../test_data/strings.rjss')).toString());
    result.rules.should.exist;
    Object.keys(result.rules).length.should.equal(1);
    result.rules.main.declarations.textAlign.value.should.equal('"center"');
    result.rules.main.declarations.position.value.should.equal('"relative"');
    result.rules.main.declarations.color.value.should.equal('"#fff"');
  });

  it('should parse rjss file with macros', function () {
    var result = parser.parse(fs.readFileSync(require.resolve('../test_data/macros.rjss')).toString());
    result.macros.foobar.should.exist;
  });

  it('should parse rjss with javascript', function () {
    parser.parse(fs.readFileSync(require.resolve('../test_data/javascript.rjss')).toString());
  });

  it('should throw parse error', function () {
    try {
      parser.parse(fs.readFileSync(require.resolve('../test_data/parsererror.rjss')).toString());
    } catch(e) {
      e.lineNumber.should.equal(5);
      e.message.should.equal('Unexpected \'foo\' on line 6');
    }
  });
});
