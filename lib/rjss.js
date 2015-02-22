var parser = require('./parser');
var fs = require('fs');
var path = require('path');
var _ = require('lodash');

var RJSS = module.exports = function () {
  this._cache = {};
};

RJSS.prototype = {
  parseFile: function (filepath) {
    var absolutePath = path.resolve(filepath);
    var stat = fs.statSync(absolutePath);

    if (!stat.isFile()) {
      throw new Error(filepath + " is not a file");
    }

    var mtime = stat.mtime;

    var cached;

    if ((cached = this._cache[absolutePath]) && cached.mtime === mtime) {
      return cached.content;
    }

    var content = fs.readFileSync(absolutePath);

    var result = this.parseContent(content, {
      path: filepath,
      absolute_path: absolutePath
    });

    this._cache[absolutePath] = {
      mtime: mtime,
      content: result
    };

    return result;
  },
  parseContent: function (content, options) {
    var options = options || {};

    if (!options.absolute_path && options.path) {
      options.absolute_path = path.resolve(options.path);
    }

    var result = parser.parse(content.toString());

    var imports = this._processImports(result);

    return {
      code: this._generateCode(result, imports, options),
      parsed: result,
      imports: imports
    }
  },
  _isRJSSFile: function (path) {
    var ext = path.extname(path);
    return ext === '.rjss';
  },
  _processImports: function (parsedStyles, options) {
    var imports = [];

    if (parsedStyles.imports) {
      var dirName = path.dirname(options.absolute_path);
      _.each(parsedStyles.imports, function (fileImport) {
        if (this._isRJSSFile(fileImport.file)) {
          imports.push(this._parseFile(path.join(dirName, fileImport.file)));
        }
      }, this)
    }

    return imports;
  },
  _generateDeclaration: function (declaration) {
    switch(declaration.type) {
      case "NUMBER":
        return declaration.value;
        break;
      default:
        return '"' + declaration.value + '"';
        break;
    }
  },
  _generateRule: function (rule) {
    var result = "rules." + rule.selector + " = function () {\n";
    result += "var style = {};\n";

    _.each(rule.declarations, function (declaration, key) {
      result += "style." + key + " = " + this._generateDeclaration(declaration) + ";\n";
    }, this);

    result += "return style;\n};\n";
    return result;
  },
  _generateRules: function (parsedStyles, imports, options) {
    var rulelist = parsedStyles.rulelist || [];

    var result = "var rules = {};\n";

    _.each(rulelist, function (rule) {
      result += this._generateRule(rule);
    }, this);

    return result;
  },
  _generateFactory: function (parsedStyles) {
    var rulelist = parsedStyles.rulelist || [];

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
  _generateCode: function (parsedStyles, imports, options) {
    var ruleList = parsedStyles.rulelist;

    var usedImports = [];

    if (parsedStyles.imports) {
      _.each(parsedStyles.imports, function (fileImport) {
        if (!this._isRJSSFile(fileImport.file)) {
          usedImports.push(fileImport.file);
        }
      }, this)
    }

    var result = "";
    result += this._generateRules(parsedStyles, imports, options, usedImports);
    result += this._generateFactory(parsedStyles);

    return result;
  }
};
