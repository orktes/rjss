build-parser:
	./node_modules/.bin/jison ./src/parser.y ./src/parser.l -o ./lib/parser.js
