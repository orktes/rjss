# work in progress
# rjss
CSS style syntax for creating inlineable style objects for react-native and react-canvas. RJSS files are precompiled to javascript.

## Documentation

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
