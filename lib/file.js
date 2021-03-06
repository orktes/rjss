var _ = require('lodash');
var resolve = require('enhanced-resolve');
var path = require('path');

var Generator = require('./generator');

var File = module.exports = function (ast, rjss, options) {
  this.ast = ast;
  this.options = options;
  this.rjss = rjss;

  this.variableScope = {};
  this.functionScope = {};
  this.macroScope = {};
  this.ruleScope = {};

  this.namedVariableScope = {};
  this.namedFunctionScope = {};
  this.namedMacroScope = {};
  this.namedRuleScope = {};
  this.namedImports = {};

  this.generator = new Generator(this);
};

File.prototype._addScopes = function (variables, functions, macros, rules, file) {
  _.eachRight(variables || {}, function (value, key) {
    if (!this.variableScope[key]) {
      this.variableScope[key] = file || value;
    }
  }, this);

  _.eachRight(functions || {}, function (value, key) {
    if (!this.functionScope[key]) {
      this.functionScope[key] = file || value;
    }
  }, this);

  _.eachRight(macros || {}, function (value, key) {
    if (!this.macroScope[key]) {
      this.macroScope[key] = file || value;
    }
  }, this);

  _.eachRight(rules || {}, function (value, key) {
    if (!this.ruleScope[key]) {
      this.ruleScope[key] = file || value;
    }
  }, this);
};

File.prototype.getDependenciesSync = function () {
  var dirName = path.dirname(this.options.absolute_path);
  var files = [this.options.absolute_path];

  _.each(this.ast.imports || [], function (imported) {
    var file = this.rjss.parseFileSync(resolve.sync(dirname, imported.file));
    files = _.union(files, file.getDependenciesSync());
  }, this);

  return files;
};

File.prototype.processScopeSync = function () {
  var dirName = path.dirname(this.options.absolute_path);
  var imports = this.ast.imports || [];
  var variables = this.ast.variables || {};
  var functions = this.ast.functions || {};
  var macros = this.ast.macros || {};
  var rules = this.ast.rules || {};

  this._addScopes(variables, functions, macros, rules, this);

  _.eachRight(imports, function (imported) {
    var file = this.rjss.parseFileSync(resolve.sync(dirName, imported.file));
    var variableScope, functionScope, macroScope, ruleScope;
    var name;
    if ((name = imported.name)) {
      this.namedImports[name] = file;
      this.namedVariableScope[name] = {file: file, scope: file.variableScope};
      this.namedFunctionScope[name] = {file: file, scope: file.functionScope};
      this.namedMacroScope[name] = {file: file, scope: file.macroScope};
      this.namedRuleScope[name] = {file: file, scope: file.ruleScope};
    } else {
      variableScope = this.variableScope;
      functionScope = this.functionScope;
      macroScope = this.macroScope;
      ruleScope = this.ruleScope;

      this._addScopes(
        file.variableScope,
        file.functionScope,
        file.macroScope,
        file.ruleScope
      );
    }

  }, this);
};

File.prototype.getMacroFunction = function (name) {
  var macroFile = this.macroScope[name];

  if (macroFile !== this) {
    return macroFile.getMacroFunction(name);
  }

  var macro = this.ast.macros[name];

  // TODO cache generated function

  var fn = this.generator.createFunction(macro.value, macro.attributes);

  return fn;
};

File.prototype.getDeclaration = function (name, macro, fallbackToMacro) {
  var file, declaration;
  if (macro) {
    if ((file = this.macroScope[name])) {
      declaration = file.ast.macros[name];
    }
  }

  if (!declaration) {
    if ((file = this.functionScope[name])) {
      declaration = file.ast.functions[name];
    } else if ((file = this.variableScope[name])) {
      declaration = file.ast.variables[name];
    }
  }

  if (fallbackToMacro && !declaration) {
    if ((file = this.macroScope[name])) {
      declaration = file.ast.macros[name];
    }
  }

  if (declaration) {
    return {file: file, declaration: declaration};
  }
};

File.prototype.compileDeclaration = function (name, macro, fallbackToMacro) {
  var declarationInfo = this.getDeclaration(name, macro, fallbackToMacro);

  if (!declarationInfo) {
    // TODO better error message
    //throw new Error("No declaration found with the name " + name);
    return global[name];
  }

  if (declarationInfo.file !== this) {
    return declarationInfo.file.compileDeclaration(name, macro, fallbackToMacro);
  }

  var declaration = declarationInfo.declaration;

  var result;

  switch (declaration.type) {
    case "MACRO_DEF":
    case "FUNC_DEF":
      result = this.generator.createFunction(declaration.value, declaration.attributes, name);
      break;
    case "CODE":
      result = this.generator.createFunction("return " + declaration.value, [], name)();
      break;
    default:
      result = declaration.value;
      break;
  }

  return result;
};

File.prototype.getCode = function () {
  return this.generator.getJavaScript();
};

File.prototype.getSourceMap = function () {
  return this.generator.getSourceMap().toString();
};
