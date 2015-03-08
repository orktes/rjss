exports.evaluateJavascript = function (expr) {
  var expression = new Function('return ' + expr);
  return expression.call(this);
};
