var _ = require('lodash');
var falafel = require('falafel');
var path = require('path');
var SourceMapGenerator = require('source-map').SourceMapGenerator;

var Generator = module.exports = function (parsedStyles, imports, namedImports, options) {
  this.parsedStyles = parsedStyles;
  this.imports = imports;
  this.namedImports = namedImports;
  this.options = options;
  this.usedImports = [];
  this.defineScope = {};
  this.ruleScope = {};
  this._importIDCache = [];
  this._fnIds = 0;

  this._resolveScope();
};

Generator.prototype = {
  _resolveScopeAndGenerateCode: function (code, attributes, includeValues, canPrecompile) {
    var localVariables = _.clone(attributes);
    var outsideVariables = false;

    var res = falafel(code, _.bind(function (node) {
      if (node.type === "Identifier") {
       if (node.parent && (
          node.parent.type === 'VariableDeclarator' || node.parent.type === 'FunctionDeclaration'
         )) {
         localVariables.push(node.name);
       } else if (localVariables.indexOf(node.name) === -1) {
         outsideVariables = true;
         if (node.parent.type !== 'MemberExpression' || node.parent.object === node) {
            var globalScope = this._resolveGlobalVariable(node.name);
            if (includeValues) {
              node.update("((typeof values." + node.name + " !== 'undefined') ? values." + node.name + " : " + globalScope + ")");
            } else {
              node.update(globalScope)
            }
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
        // TODO resolve scope and add global variables
        var globalScope = this._resolveGlobalVariable(declaration.name);
        var fn = (includeValues ? (("typeof values." + declaration.name + " !== 'undefined' && values." +
               declaration.name) + " || ") : '') + globalScope;
        return "(" + fn + ")(" +
               _.map(declaration.attributes, function (attr) {
                 return this._generateDeclaration(attr, includeValues);
               }, this).join(', ') +
               ")";
        return "null";
      default:
        return '"' + declaration.value + '"';
        break;
    }
  },
  _getImportIDForFile: function (file) {
    var indx;

    if ((indx = this._importIDCache.indexOf(file.absolute_path)) === -1) {
      this._importIDCache.push(file.absolute_path);
      indx = this._importIDCache.length - 1;
    }

    return "$im_" + indx;
  },
  _resolveGlobalVariable: function (variable, stringNull) {
    var defines = this.parsedStyles.defines || {};

    var local = !!defines[variable];

    if (local) {
      // Variable is defined in the local file
      return "defines." + variable;
    }

    var fileWithVar;

    if ((fileWithVar = this.namedImports[variable])) {
      if (this.usedImports.indexOf(fileWithVar) === -1) {
        this.usedImports.push(fileWithVar);
      }
      return this._getImportIDForFile(fileWithVar) + ".d";
    }

    fileWithVar = this.defineScope[variable];

    if (fileWithVar) {
      if (this.usedImports.indexOf(fileWithVar) === -1) {
        this.usedImports.push(fileWithVar);
      }
      return this._getImportIDForFile(fileWithVar) + ".d." + variable;
    }

    return variable;
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

    var fileWithRule;

    if (selector.indexOf('.') > -1) {
      var parts = selector.split('.');
      var importName = parts[0];
      selector = parts[1];
      if ((fileWithRule = this.namedImports[importName])) {
        var rule = _.find(fileWithRule.parsed.rulelist, function (rule) {
          return rule.selector === selector;
        });

        if (!rule) {
          return null;
        }

        if (this.usedImports.indexOf(fileWithRule) === -1) {
          this.usedImports.push(fileWithRule);
        }
        return this._getImportIDForFile(fileWithRule) + ".r." + selector;
      }
    }

    fileWithRule = this.ruleScope[selector];
    if (fileWithRule) {
      if (this.usedImports.indexOf(fileWithRule) === -1) {
        this.usedImports.push(fileWithRule);
      }
      return this._getImportIDForFile(fileWithRule) + ".r." + selector;
    }

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
    var rulelist = this.parsedStyles.rulelist || [];

    this.lines.push(["var rules = {};"]);

    _.each(rulelist, this._generateRule, this);
  },
  _generateFactory: function () {
    var rulelist = this.parsedStyles.rulelist || [];

    var main = _.find(rulelist, function (rule) {
      return rule.selector === 'main';
    });

    if (!main) {
      main = rulelist[0];
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
    var defines = this.parsedStyles.defines || {};

    this.lines.push(["var defines = {};"]);

    _.each(defines, function (type, define) {
      var defineCode = "defines['" + define + "'] = " + this._generateDeclaration(type, false) + ";";
      this.lines = this.lines.concat(_.map(defineCode.split('\n'), function (line, indx) {
        return [line, type.line + indx];
      }));
    }, this);
  },
  _resolveScope: function () {
    var self = this;
    (function walk(imports) {
      _.eachRight(imports, function (importedFile) {
        if (importedFile.parsed.defines) {
          _.each(importedFile.parsed.defines, function (value, key) {
            if (!self.defineScope[key]) {
              self.defineScope[key] = importedFile;
            }
          });
        }

        if (importedFile.parsed.rulelist) {
          _.eachRight(importedFile.parsed.rulelist, function (rule) {
            if (!self.ruleScope[rule.selector]) {
              self.ruleScope[rule.selector] = importedFile;
            }
          });
        }

        walk(importedFile.imports);
      });
    })(this.imports || []);
  },
  _generateImports: function () {
    var dirName = path.dirname(this.options.absolute_path);
    this.lines = _.map(this.usedImports, function (file) {
      var relativePath = path.relative(dirName, file.absolute_path);

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
    var ruleList = this.parsedStyles.rulelist;

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
