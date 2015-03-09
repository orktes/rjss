exports.evaluateJavascript = function (expr) {
  //console.log(expr);
  var expression = new Function('return ' + expr);
  return expression.call(this);
};
