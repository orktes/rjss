var _ = require('lodash');
var falafel = require('falafel');

var Generator = module.exports = function (parsedStyles, imports, options) {
  this.parsedStyles = parsedStyles;
  this.imports = imports;
  this.options = options;
  this.usedImports = [];
  this._fnIds = 0;
};

Generator.prototype = {
  _resolveScopeAndGenerateCode: function (code, attributes, includeValues, canPrecompile) {
    var localVariables = _.clone(attributes);
    var outsideVariables = false;

    var res = falafel(code, _.bind(function (node) {
      if (node.type === "Identifier" &&
         (!node.parent || (
           node.parent.type !== 'MemberExpression' &&
           node.parent.type !== 'FunctionDeclaration'
         ))) {
        if (node.parent && node.parent.type === 'VariableDeclarator') {
          localVariables.push(node.name);
        } if (localVariables.indexOf(node.name) === -1) {
          outsideVariables = true;
          var globalScope = this._resolveGlobalVariable(node.name);
          if (includeValues) {
            node.update("(values." + node.name + "||" + globalScope + ")");
          } else {
            node.update(globalScope)
          }
        }
      }
    }, this));

    if (canPrecompile && !outsideVariables) {
      // TODO Eval is evil get rid of it by constructing functions etc
      return eval(res);
    }

    return res;
  },
  _generateDeclaration: function (declaration) {
    switch(declaration.type) {
      case "NUMBER":
      case "STRING":
        return declaration.value;
        break;
      case "CODE":
        return this._resolveScopeAndGenerateCode(declaration.value, [], true, true);
        break;
      case "FUNC_DEF":
        var code = "function fn" + (++this._fnIds) + "(" + declaration.attributes.join(', ') + ") {";
        code += declaration.value + "\n";
        code += "}";
        return this._resolveScopeAndGenerateCode(code, declaration.attributes, false, false);;
      case "FUNC":
        // TODO resolve scope and add global variables
        var globalScope = this._resolveGlobalVariable(declaration.name);
        return "(values." +
               declaration.name + " || " + globalScope + ")(" +
               _.map(declaration.attributes, this._generateDeclaration, this).join(', ') +
               ")";
        return "null";
      default:
        return '"' + declaration.value + '"';
        break;
    }
  },
  _resolveGlobalVariable: function (variable, stringNull) {
    var defines = this.parsedStyles.defines || {};

    var local = !!defines[variable];

    if (local) {
      // Variable is defined in the local file
      return "defines." + variable;
    }

    // TODO process imports (should propably preprocess && cache)
    return "null";
  },
  _resolveGlobalRule: function (selector) {
    var rulelist = this.parsedStyles.rulelist || [];

    var rule = _.find(rulelist, function (rule) {
      return rule.selector === selector;
    });

    if (rule) {
      // rule is defined in the local file
      return "rules." + selector;
    }
  },
  _generateRule: function (rule) {
    var result = "rules." + rule.selector + " = function (values) {\n";

    if (rule.parents.length === 0) {
      result += "var style = {};\n";
    } else {
      var parentSelector = this._resolveGlobalRule(rule.parents[0]);
      if (!parentSelector) {
        // TODO trough proper error
        throw new Error("Can't extend " + rule.parents[0] + " (Rule not found)");
      }
      result += "var style = " + parentSelector + "(values);\n";
    }

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

    var result = "var factory = function (name, values) {\n";

    result += "if (typeof name !== 'string') { values = name; name = null; }\n";
    result += "values = values || {}\n";
    result += "name = name || '" + (main ? main.selector : '') + "'\n";
    result += "return rules[name](values);\n"
    result += "};\n";

    result += "factory.r = rules;\n";
    result += "factory.d = defines;\n";
    result += "module.exports = factory;\n"

    return result;
  },
  _generateDefines: function () {
    var defines = this.parsedStyles.defines || {};

    var result = "var defines = {}; \n";

    _.each(defines, function (type, define) {
      result += "defines['" + define + "'] = " + this._generateDeclaration(type) + ";\n";
    }, this);

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
    result += this._generateDefines();
    result += this._generateRules();
    result += this._generateFactory();

    return result;
  },
  getJavaScript: function () {
    this._javascript = this._javascript || this._generateCode();
    return this._javascript;
  }
};