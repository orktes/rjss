var _ = require('lodash');
var falafel = require('falafel');
var path = require('path');
var SourceMapGenerator = require('source-map').SourceMapGenerator;
var deparse = require('escodegen').generate;
var resolve = require('enhanced-resolve');
var utils = require('./utils');

var Generator = module.exports = function (file) {
  this.file = file;
  this.ast = file.ast;
  this.options = file.options;
  this.usedImports = [];
  this._importIDCache = [];
  this._fnIds = 0;
};

Generator.prototype = {
  _hasIndentifiers: function (arg) {
    var type = arg.type;

    if (type === "Identifier") {
      return true;
    }

    if (type === "ConditionalExpression") {
      return this._hasIndentifiers(arg.test) ||
             this._hasIndentifiers(arg.consequent) ||
             this._hasIndentifiers(arg.alternate);
    }

    if (type === "BinaryExpression") {
      return this._hasIndentifiers(arg.left) || this._hasIndentifiers(arg.right);
    }

    return false;
  },
  _getMacroNameAndFile: function (callExpression) {
    if (callExpression.macro) {
      return callExpression.macro;
    }

    // Check that callee is a macro
    var callee = callExpression.callee;
    var file;
    var macroName;

    if (callee.type === 'MemberExpression') {
      //fn = callee.object.name + '.' + callee.property.name;
      var namedImport;
      if (
        (namedImport = this.file.namedMacroScope[callee.object.name]) &&
        (file = namedImport.scope[callee.property.name])) {
        macroName = callee.property.name;
        //console.log("There exists a macro from named import", callee.object.name, callee.property.name);
      }
    } else if (callee.type === 'Identifier') {
      if ((file = this.file.macroScope[callee.name])) {
        macroName = callee.name;
        //console.log("There exists a macro with the name", callee.name);
      }
    }

    if (file) {
      return callExpression.macro = {file: file, name: macroName};
    }
  },
  _canPrecompileCallExpression: function (callExpression) {
    if (callExpression.can_precompile) {
      return true;
    }

    var hasIdentifiersInArguments = _.find(
      callExpression.arguments,
      this._hasIndentifiers,
      this
    );

    if (hasIdentifiersInArguments) {
      return false;
    }

    var file = this._getMacroNameAndFile(callExpression);
    if (file) {
      callExpression.can_precompile = true;
      return true;
    }

    return false;
  },
  _preCompileCallExpression: function (callExpression) {
    var file = callExpression.macro.file;
    var name = callExpression.macro.name;

    var fn = file.getMacroFunction(name);
    var result = fn.apply(null, _.map(callExpression.arguments, function (attr) {
      return utils.evaluateJavascript(deparse(attr));
    }));

    return JSON.stringify(result);
  },
  _resolveScopeAndGenerateCode: function (code, attributes, includeValues, canPrecompileResult) {
    var localVariables = _.clone(attributes);
    var outsideVariables = false;

    var res = falafel(code, _.bind(function (node) {
      if (node.parent &&
          node.parent.type === 'CallExpression' &&
          this._canPrecompileCallExpression(node.parent)) {
        return;
      } else if (node.type === 'CallExpression' &&
                 this._canPrecompileCallExpression(node)) {
        node.update(this._preCompileCallExpression(node));
      }
      if (node.type === "Identifier") {
       if (node.parent && (
          node.parent.type === 'VariableDeclarator' || node.parent.type === 'FunctionDeclaration'
         )) {
         localVariables.push(node.name);
       } else if (localVariables.indexOf(node.name) === -1) {
         outsideVariables = true;
         if (node.parent.type !== 'MemberExpression' || node.parent.object === node) {
            variable = node.name;
            if (node.parent.type === 'MemberExpression') {
              variable += "." + node.parent.property.name;
            }
            var globalScope = this._resolveGlobalVariable(variable);
            if (includeValues) {
              node.update("((typeof values." + node.name + " !== 'undefined') ? values." + node.name + " : " + globalScope + ")");
            } else {
              node.update(globalScope)
            }
         }
       }
      }
    }, this));

    if (canPrecompileResult && !outsideVariables) {
      res = JSON.stringify(utils.evaluateJavascript(res));
    }

    return res;
  },
  createFunction: function (code, attributes, name) {
    var localVariables = ["$rel", "require"].concat(attributes);

    var macroCode = "function fn" + (++this._fnIds) + "(" + localVariables.join(', ') + ") {";
    macroCode += code;
    macroCode += "}";

    var ref = {};

    var res = falafel(macroCode, _.bind(function (node) {
      if (node.type === "Identifier") {
       if (node.parent && (
          node.parent.type === 'VariableDeclarator' || node.parent.type === 'FunctionDeclaration'
         )) {
         localVariables.push(node.name);
       } else if (localVariables.indexOf(node.name) === -1) {
         if (node.parent.type !== 'MemberExpression' || node.parent.object === node) {
            variable = node.name;
            if (node.parent.type === 'MemberExpression') {
              var parts = variable.split('.');
              var namedImport = variable;
              variable = node.parent.property.name;

              var file;

              if ((file = this.file.namedImports[namedImport])) {
                ref[namedImport] = ref[namedImport] || {};
                if (typeof ref[namedImport][variable] === 'undefined') {
                  ref[namedImport][variable] = file.compileDeclaration(variable, true);
                }
                node.update("$rel." + node.name);
              }

            } else {
              if (this.file.macroScope[variable] ||
                  this.file.functionScope[variable] ||
                  this.file.variableScope[variable]) {
                if (typeof ref[variable] === 'undefined') {
                  ref[variable] = this.file.compileDeclaration(variable, variable !== name, true);
                }
                node.update("$rel." + node.name);
              }
            }
         }
       }
      }
    }, this));

    var fn = utils.evaluateJavascript(res);

    var dirName = path.dirname(this.file.options.absolute_path);

    var requireFn = function (path) {
      var fullPath = resolve.sync(dirName, path);
      return require(fullPath);
    };

    return function () {
      var args = [ref, requireFn].concat(Array.prototype.slice.call(arguments));
      return fn.apply(fn, args);
    };
  },
  _generateDeclaration: function (declaration, includeValues) {
    switch(declaration.type) {
      case "NUMBER":
      case "STRING":
        return declaration.value;
        break;
      case "CODE":
        return this._resolveScopeAndGenerateCode(declaration.value, [], includeValues, true);
        break;
      case "FUNC_DEF":
        var code = "function fn" + (++this._fnIds) + "(" + declaration.attributes.join(', ') + ") {";
        code += declaration.value;
        code += "}";
        return this._resolveScopeAndGenerateCode(code, declaration.attributes, false, false);
      case "FUNC":
        var code = declaration.name + "(" +
          _.map(declaration.attributes, function (attr) {
            if (attr.type === "code") {
              return declaration.value;
            }
            return this._generateDeclaration(attr, false);
          }, this).join(', ') +
          ")";
        return this._resolveScopeAndGenerateCode(code, [], includeValues, false);
      default:
        return '"' + declaration.value + '"';
        break;
    }
  },
  _getImportIDForFile: function (file) {
    var indx;

    if ((indx = this._importIDCache.indexOf(file.options.absolute_path)) === -1) {
      this._importIDCache.push(file.options.absolute_path);
      indx = this._importIDCache.length - 1;
    }

    return "$im_" + indx;
  },
  _resolveGlobalVariable: function (variable, stringNull) {
    var namedScope, file, namedImport;

    if (variable.indexOf('.') === -1) {
      file = this.file.functionScope[variable];

      if (!file) {
        file = this.file.variableScope[variable];
      }
    } else {
      var parts = variable.split('.');
      namedImport = parts.shift();
      var namedImportVariable = parts.join('.');

      if (!file) {
        file = this.file.namedFunctionScope[namedImport];
        if (file && (file = file.scope[namedImportVariable])) {
          namedScope = true;
          // TODO trough error if not exposed by import
        } else {
          file = null;
        }
      }

      if (!file) {
        file = this.file.namedVariableScope[namedImport];
        if (file && (file = file.scope[namedImportVariable])) {
          namedScope = true;
          // TODO trough error if not exposed by import
        } else {
          file = null;
        }
      }
    }

    if (file == this.file) {
      // variable is local
      return "defines." + variable;
    } else if (file) {
      if (this.usedImports.indexOf(file) === -1) {
        this.usedImports.push(file);
      }
      if (namedScope) {
        // Find a better way to handle named scope
        return this._getImportIDForFile(file) + ".d";
      } else {
        return this._getImportIDForFile(file) + ".d." + variable;
      }
    }

    if (namedImport) {
      return namedImport;
    } else {
      return variable;
    }
  },
  _resolveGlobalRule: function (selector) {
    var file, parts, details;

    if (selector.indexOf('.') === -1) {
      file = this.file.ruleScope[selector];
      if (file === this.file) {
        return "rules." + selector;
      } else if (file) {
        if (this.usedImports.indexOf(file) === -1) {
          this.usedImports.push(file);
        }
        return this._getImportIDForFile(file) + ".r." + selector;
      }
    } else {
      parts = selector.split('.');
      importName = parts.shift();
      selector = parts.join('.');

      details = this.file.namedRuleScope[importName];

      if (details && (file = details.scope[selector])) {
        if (this.usedImports.indexOf(file) === -1) {
          this.usedImports.push(file);
        }
        return this._getImportIDForFile(file) + ".r." + selector;
      }
    }

    // TODO better error messages
    throw new Error("Could not find rule " + selector);
  },
  _generateRule: function (rule) {
    this.lines.push(["rules." + rule.selector + " = function (values) {", rule.line]);

    if (rule.parents.length === 0) {
      this.lines.push(["var style = {};"]);
    } else {
      var parentSelector = this._resolveGlobalRule(rule.parents[0]);
      if (!parentSelector) {
        // TODO trough proper error
        throw new Error("Can't extend " + rule.parents[0] + " (Rule not found)");
      }
      this.lines.push(["var style = " + parentSelector + "(values);"]);
    }

    _.each(rule.declarations, function (declaration, key) {
      var style = "style." + key + " = " + this._generateDeclaration(declaration, true) + ";"
      this.lines = this.lines.concat(_.map(style.split('\n'), function (line, indx) {
        return [line, declaration.line + indx];
      }));
    }, this);

    this.lines.push(["return style;"]);
    this.lines.push(["};"]);
  },
  _generateRules: function () {
    var rules = this.file.ast.rules || [];

    this.lines.push(["var rules = {};"]);

    _.each(rules, this._generateRule, this);
  },
  _generateFactory: function () {
    var rules = this.file.ast.rules || {};

    var main = rules.main;
    if (!main && _.keys(rules).length > 0) {
      main = rules[_.keys(rules)[0]];
    }

    this.lines.push(["var factory = function (name, values) {"]);

    this.lines.push(["if (typeof name !== 'string') { values = name; name = null; }"]);
    this.lines.push(["values = values || {}"]);
    this.lines.push(["name = name || '" + (main ? main.selector : '') + "'"]);
    this.lines.push(["return rules[name] ? rules[name](values) : {};"]);
    this.lines.push(["};"]);

    this.lines.push(["factory.r = rules;"]);
    this.lines.push(["factory.d = defines;"]);
    this.lines.push(["module.exports = factory;"]);
  },
  _generateDefines: function () {
    var defines = _.extend({}, this.file.ast.variables, this.file.ast.functions);

    this.lines.push(["var defines = {};"]);

    _.each(defines, function (type, define) {
      var defineCode = "defines['" + define + "'] = " + this._generateDeclaration(type, false) + ";";
      this.lines = this.lines.concat(_.map(defineCode.split('\n'), function (line, indx) {
        return [line, type.line + indx];
      }));
    }, this);
  },
  _generateImports: function () {
    var dirName = path.dirname(this.options.absolute_path);
    this.lines = _.map(this.usedImports, function (file) {
      var relativePath = path.relative(dirName, file.options.absolute_path);

      // TODO make windows compitable
      if (relativePath[0] !== '.' && relativePath[0] !== '/') {
        relativePath = './' + relativePath;
      }
      // TODO resolve correct line for import
      return ["var " + this._getImportIDForFile(file) +" = require('" + relativePath + "');", 0];
    }, this).concat(this.lines);
  },
  _generateCodeFromLines: function () {
    var map;
    if (this.options.sourceMap) {
      this._map = map = new SourceMapGenerator({
        file: this.options.path
      });
    }
    return _.map(this.lines, function (line, i) {
      if (this.options.sourceMap && line.length > 1) {
        map.addMapping({
          generated: {
            line: i+1,
            column: 1
          },
          source: this.options.path,
          original: {
            line: line[1] + 1,
            column: 1
          }
        });
      }

      return line[0];
    }, this).join('\n');
  },
  _generateCode: function () {

    this.lines = [];
    this._generateDefines();
    this._generateRules();
    this._generateFactory();
    this._generateImports();

    return this._generateCodeFromLines();
  },
  getJavaScript: function () {
    this._javascript = this._javascript || this._generateCode();
    return this._javascript;
  },
  getSourceMap: function () {
    if (this.options.sourceMap && !this._map) {
      this._javascript = this._javascript || this._generateCode();
    }

    return this._map;
  }
};
