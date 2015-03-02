var parser = require('./parser');
var Generator = require('./generator');

var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var resolve = require('enhanced-resolve');

var RJSS = module.exports = function (options) {
  this._cache = {};
  this.options = options;
};

RJSS.prototype = {
  parseFile: function (filepath) {
    var absolutePath = resolve.sync(process.cwd(), filepath);
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
    var options = _.extend({}, this.options, options || {});

    if (!options.absolute_path && options.path) {
      options.absolute_path = resolve.sync(process.cwd(), options.path);
    }

    var result = parser.parse(content.toString());

    var processedImports = this._processImports(result, options);

    var generator = new Generator(
      result,
      processedImports.imports,
      processedImports.named,
      options
    );

    return {
      getCode: _.bind(function () {
        return generator.getJavaScript();
      }, this),
      getSourceMap: _.bind(function () {
        return generator.getSourceMap().toString();
      }, this),
      path: options.path,
      absolute_path: options.absolute_path,
      parsed: result,
      imports: processedImports.imports,
      named_imports: processedImports.named
    }
  },
  _processImports: function (parsedStyles, options) {
    var imports = [];
    var namedImports = {};

    if (parsedStyles.imports) {
      var dirName = path.dirname(options.absolute_path);
      _.each(parsedStyles.imports, function (fileImport) {
        var fullPath = resolve.sync(dirName, fileImport.file);
        var parsedFile = this.parseFile(fullPath);
        if (fileImport.name) {
          namedImports[fileImport.name] = parsedFile;
        }
        imports.push(parsedFile);
      }, this)
    }

    return {named: namedImports, imports: imports};
  }
};
