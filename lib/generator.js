var _ = require('lodash');
var falafel = require('falafel');

var Generator = module.exports = function (parsedStyles, imports, options) {
  this.parsedStyles = parsedStyles;
  this.imports = imports;
  this.options = options;
  this.usedImports = [];
};

Generator.prototype = {
  _resolveScopeAndGenerateCode: function (code, includeValues) {
    var localVariables = [];
    var globalVariables = [];

    return falafel(code, function (node) {
      if (node.type === "Identifier" &&
         (!node.parent || node.parent.type !== 'MemberExpression')) {
        if (includeValues) {
          node.update("values." + node.name);
        }
      }
    });
  },
  _generateDeclaration: function (declaration) {
    switch(declaration.type) {
      case "NUMBER":
        return declaration.value;
        break;
      case "CODE":
        // TODO process code and change variables to point to object
        return this._resolveScopeAndGenerateCode(declaration.value, true);
        break;
      default:
        return '"' + declaration.value + '"';
        break;
    }
  },
  _resolveFileForVariable: function (variable) {
    return null;
  },
  _generateRule: function (rule) {
    var result = "rules." + rule.selector + " = function (values) {\n";
    result += "var style = {};\n";

    _.each(rule.declarations, function (declaration, key) {
      result += "style." + key + " = " + this._generateDeclaration(declaration) + ";\n";
    }, this);

    result += "return style;\n};\n";
    return result;
  },
  _generateRules: function () {
    var rulelist = this.parsedStyles.rulelist || [];

    var result = "var rules = {};\n";

    _.each(rulelist, function (rule) {
      result += this._generateRule(rule);
    }, this);

    return result;
  },
  _generateFactory: function () {
    var rulelist = this.parsedStyles.rulelist || [];

    var main = _.find(rulelist, function (rule) {
      return rule.selector === 'main';
    });

    if (!main) {
      main = rulelist[0];
    }

    var result = "module.exports = function (name, values) {\n";

    result += "if (typeof name !== 'string') { values = name; name = null; }\n";
    result += "values = values || {}\n";
    result += "name = name || '" + (main ? main.selector : '') + "'\n";
    result += "return rules[name](values);\n"
    result += "};\n";

    result += "module.exports.rules = rules;\n";

    return result;
  },
  _generateCode: function () {
    var ruleList = this.parsedStyles.rulelist;

    if (this.parsedStyles.imports) {
      _.each(this.parsedStyles.imports, function (fileImport) {
        if (!this._isRJSSFile(fileImport.file)) {
          this.usedImports.push(fileImport.file);
        }
      }, this)
    }

    var result = "";
    result += this._generateRules();
    result += this._generateFactory();

    return result;
  },
  getJavaScript: function () {
    this._javascript = this._javascript || this._generateCode();
    return this._javascript;
  }
};
