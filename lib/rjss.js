var parser = require('./parser');
var File = require('./file');

var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var resolve = require('enhanced-resolve');

var RJSS = module.exports = function (options) {
  this._cache = {};
  this.options = options;
};

RJSS.prototype = {
  parseFileSync: function (filepath) {
    var absolutePath = resolve.sync(process.cwd(), filepath);
    var stat = fs.statSync(absolutePath);

    if (!stat.isFile()) {
      throw new Error(filepath + " is not a file");
    }

    var mtime = stat.mtime;

    var cached;

    if ((cached = this._cache[absolutePath]) && cached.mtime === mtime) {
      return cached.file;
    }

    var content = fs.readFileSync(absolutePath);

    var file = this.parseContentSync(content, {
      path: filepath,
      absolute_path: absolutePath
    });

    this._cache[absolutePath] = {
      mtime: mtime,
      file: file
    };

    return file;
  },
  parseContentSync: function (content, options) {
    var options = _.extend({}, this.options, options || {});

    if (!options.absolute_path && options.path) {
      options.absolute_path = resolve.sync(process.cwd(), options.path);
    }

    var result = parser.parse(content.toString());
    var file = new File(result, this, options);
    file.processScopeSync();
    return file;
  }
};
