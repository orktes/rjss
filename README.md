# rjss
Style sheet language for creating inlineable style objects for react-native and react-canvas.

- Playground http://orktes.github.io/rjss-playground/
- Webpack loader https://github.com/orktes/rjss-loader
- Browserify plugin TODO
- CLI TODO
- Linter TODO
- Atom syntax and linter plugin TODO

## Documentation
RJSS is still WIP and the parser, syntax and other tools are subject to change.

### Basic syntax
```css
/* simple.rjss */
main {
  top: 10;
  left: 0;
  width: 100;
  height: 20;
  margin-top: 20;
  margin-bottom: 30;
}
```
usage
```js
var styles = require('./simple.rjss');

...
  render: function () {
    return <View style={styles('main')} />;
  }
...

```

### Runtime variables
```css
/* variables.rjss */
main {
  top: $top;
  left: $left;
  width: 100;
  height: 20;
  margin-top: 20;
  margin-bottom: 30;
}
```
usage
```js
var styles = require('./variables.rjss');

...
  render: function () {
    return <View style={styles('main', {top: 10, left: 10})} />;
  }
...

```
### Defining variables in RJSS
```css
/* variables.rjss */

@var top: 100;
@var height: ${1000 - top};

main {
  top: $top;
  left: $left;
  width: 100;
  height: $height;
  margin-top: 20;
  margin-bottom: 30;
}
```
usage
```js
var styles = require('./variables.rjss');

...
  render: function () {
    return <View style={styles('main', {left: 10})} />;
  }
...

or

...
  render: function () {
    // This will override the top variable set in the rjss file
    return <View style={styles('main', {top: 20, left: 10})} />;
  }
...

```
### Inheritance
```css
/* buttons.rjss */

button {
  width: 100;
  height: 20;
}

green extends button {
  background-color: "#00FF00"
}

red extends button {
  background-color: "#FF0000"
}

blue extends button {
  background-color: "#0000FF"
}

```
usage
```js
var buttons = require('./buttons.rjss');

...
  render: function () {
    return <View>
      <View style={styles('red')} />
      <View style={styles('green')} />
      <View style={styles('blue')} />
    </View>;
  }
...

```
### Defining functions in RJSS
```css
/* functions.rjss */

@var top: 100;

@func random (min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

@func topToPowerOf (powerOf) {
  return Math.pow(top, powerOf);
}

main {
  left: random(1, 100);
  top: topToPowerOf(2);
}
```
usage
```js
var styles = require('./functions.rjss');

...
  render: function () {
    return <View style={styles('main')} />;
  }
...

```

```
### Defining macros in RJSS
Macros are defined similar to functions. Key difference is that macros are executed compile time rather than in the runtime. Macro names can overlap with runtime functions to provide better usability and optimization when possible.

See example: https://github.com/orktes/rjss/blob/master/mixins/color_submixins/lighten.rjss

```css
/* macros.rjss */

@var value: 1;

@func min(a, b) {
  return Math.min(a, b);
}

@macro min(a, b) {
  return min(a, b); // Refers to @func min
}

main {
  first: min(1, 2); // Precompiled to 1
  second: min(1, $second); // Will be executed in the runtime
}
```
usage
```js
var styles = require('./macros.rjss');

...
  render: function () {
    return <View style={styles('main')} />;
  }
...

```

### Import other RJSS files

```css
/* variables.rjss */

@var brandColor: "#ff00ff";
@var smallText: 10;
@var mediumText: 15;
@var largeText: 20;
```

```css
/* other.rjss */

@import "./variables.rjss";

header {
  font-size: $largeText;
  color: $brandColor;
}

```
