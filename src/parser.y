%start stylesheet

%%

stylesheet
  : source_elements
  %{
    var map = {};
    _.each($1, function (item) {
      var type = item[0];
      item = item[1];

      switch (type) {
        case "rule":
          map.rules = map.rules || {};
          map.rules[item[0]] = item[1];
        break;
        case "variable":
          map.variables = map.variables || {};
          map.variables[item[0]] = item[1];
        break;
        case "function":
          map.functions = map.functions || {};
          map.functions[item[0]] = item[1];
        break;
        case "macro":
          map.macros = map.macros || {};
          map.macros[item[0]] = item[1];
        break;
        case "import":
          map.imports = map.imports || [];
          map.imports.push(item);
        break;
      }

    });
    return map;
  %}
  ;

source_elements
  : source_element
  %{
    $$ = [];
    if ( $1 !== null && $1[1])
      $$.push ( $1 );
  %}
  | source_elements source_element
  %{
    $$ = $1;
    if ( $2 !== null && $2[1])
      $$.push ( $2 );
  %}
  |   -> null
  ;

source_element
  : import_item -> ["import", $1];
  | variable_item -> ["variable", $1];
  | rule_item -> ["rule", $1];
  | macro_item -> ["macro", $1];
  | function_item -> ["function", $1]
  ;
import_item
  : import          -> $1
  | space_cdata_list    -> null
  ;
import
  : IMPORT_SYM wempty string_or_uri import_name ';' wempty
    %{
      $$ = {
        file: JSON.parse($3),
        line: yylineno,
        name: $4
      };
    %}
  ;
import_name
  : AS wempty IDENT wempty -> $3
  | wempty -> null
  ;

variable_item
  : VAR_DEFINE_SYM wempty declaration ";" -> $3
  | space_cdata_list                  -> null
  ;

function_item
  : function_def wempty function_def_name wempty function_def_attrs wempty ')' wempty '{' code_block '}'
  %{
    $$ = [
      $3,
      {
        type: "FUNC_DEF",
        attributes: $5,
        value: $10,
        line: $1[1]
      }
    ];
  %}
  | space_cdata_list                  -> null
  ;

macro_item
  : macro_def wempty function_def_name wempty function_def_attrs wempty ')' wempty '{' code_block '}'
  %{
    $$ = [
      $3,
      {
        type: "MACRO_DEF",
        attributes: $5,
        value: $10,
        line: $1[1]
      }
    ];
  %}
  | space_cdata_list                  -> null
  ;
function_def_name
  : IDENT wempty '('  -> $1
  | FUNCTION          -> $1.substring(0, $1.length - 1)
  ;
function_def
  : FUNC_DEFINE_SYM -> [$1, yylineno]
  ;
macro_def
  : MACRO_DEFINE_SYM -> [$1, yylineno]
  ;
function_def_attrs
  : wempty -> []
  | IDENT
  %{
    $$ = [];
    if ( $1 !== null )
      $$.push ( $1 );
  %}
  | function_def_attrs wempty ',' wempty IDENT
  %{
    $$ = $1;
    if ( $5 !== null )
      $$.push ( $5 );
  %}
  ;
string_or_uri
  : STRING wempty      -> $1
  | URI wempty         -> $1
  ;
rule_map
  : rule_item
    %{
      $$ = {};
      if ( $1 !== null )
        $$[$1[0]] = $1[1];
    %}
  | rule_map rule_item
    %{
      $$ = $1;
      if ( $2 !== null )
        $$[$2[0]] = $2[1];
    %}
  |  -> null
  ;
rule_item
  : ruleset          -> $1
  | space_cdata_list -> null
  ;
unary_operator
  : '-'              -> $1
  | '+'              -> $1
  ;
property
  : IDENT wempty
  %{
    $$ = $1.replace(/[-_]([a-zA-Z])/g, function (g) { return g[1].toUpperCase(); });
  %}
  | '*' IDENT wempty      -> $1 + $2      /* cwdoh; */
  ;
ruleset
  : rule_base '{' declaration_list '}' wempty    -> [$1[0], { "type": "style", "selector": $1[0], "parents": $1[1], "declarations": $3, "line": $1[2] }]
  ;
rule_base
  : IDENT wempty parent -> [$1, $3, yylineno]
  ;
parent
  : wempty                  -> []
  | EXTENDS wempty IDENT wempty  -> [$3]
  ;
combinator
  : '+' wempty          -> $1
  | '>' wempty          -> $1
  | /* empty */         -> ""
  ;

declaration_list
  : declaration_parts
    %{
      $$ = {};
      if ( $1 !== null ) {
        $$[$1[0]] = $1[1];
      }
    %}
  | declaration_list declaration_parts
    %{
      $$ = $1;
      if ( $2 !== null ) {
        $$[$2[0]] = $2[1];
      }
    %}
  ;
declaration_parts
  : declaration     -> $1
  | ';'          -> null
  | wempty        -> null
  ;
declaration
  : property ':' wempty expr wempty          -> [ $1, $4[0] ]
  | property ':' wempty expr IMPORTANT_SYM wempty
  %{
    $$ = [ $1, $4[0] ];
    $4[0].important = true;
  %}
  | /* empty */                    -> null
  ;
expr
  : term
  %{
    $$ = [];
    if ( $1 !== null )
      $$.push ( $1 );
  %}
  | expr ',' wempty term
  %{
    $$ = $1;
    $$.push( $4 );
  %}
  | expr term
  %{
    $$ = $1;
    $$.push( $2 );
  %}
  ;
term
  : computable_term              -> $1
  | unary_operator computable_term
  %{
    $$ = $2
    $$.unary_operator = $1
  %}
  | inline_code                -> $1
  | string_term                -> {type: "STRING", value: $1, line: yylineno}
  ;

computable_term
  : NUMBER wempty              -> {type: "NUMBER", value: $1, line: yylineno}
  | PERCENTAGE wempty          -> {type: "PERCENTAGE", value: $1, line: yylineno}
  | LENGTH wempty              -> {type: "LENGTH", value: $1, line: yylineno}
  | EMS wempty                 -> {type: "EMS", value: $1, line: yylineno}
  | EXS wempty                 -> {type: "EXS", value: $1, line: yylineno}
  | ANGLE wempty               -> {type: "ANGLE", value: $1, line: yylineno}
  | TIME wempty                -> {type: "TIME", value: $1, line: yylineno}
  | FREQ wempty                -> {type: "FREQ", value: $1, line: yylineno}
  ;

inline_code
  : code_sym '{' code_block '}'   -> {type: "CODE", value: $3, line: $1}
  | code_sym IDENT                -> {type: "CODE", value: $2, line: $1}
  | FUNCTION wempty ')'           -> {type: "FUNC", name: $1.substring(0, $1.length - 1), attributes: [], line: yylineno}
  | FUNCTION wempty expr ')'      -> {type: "FUNC", name: $1.substring(0, $1.length - 1), attributes: $3, line: yylineno}
  ;
code_sym
  : CODE                         -> yylineno
  ;
code_block
  : S                            -> $1
  |                              -> $1
  | '{' code_block '}'           -> $1 + $2 + $3
  | IDENT                        -> $1
  | combinator                   -> $1 + " "
  | unary_operator               -> $1 + " "
  | STRING                       -> $1
  | RANDOM_CONTENT               -> $1
  | FUNCTION                     -> $1
  | NUMBER                       -> $1
  | AS                           -> $1
  | "<"                          -> $1
  | ">"                          -> $1
  | "("                          -> $1
  | ")"                          -> $1
  | ";"                          -> $1
  | ":"                          -> $1
  | ","                          -> $1
  | "="                          -> $1
  | code_block code_block        -> $1 + $2
  ;

string_term
  : STRING wempty            -> $1
  | IDENT wempty             -> '"' + $1 + '"';
  | URI wempty               -> '"' + $1 + '"';
  | UNICODERANGE wempty      -> '"' + $1 + '"';
  | hexcolor                 -> '"' + $1 + '"';
  ;
operator
  : '/' wempty          -> $1
  | ',' wempty          -> $1
  | '=' wempty          -> $1
  |  /* empty */        -> ""
  ;
hexcolor
  : HASH wempty          -> $1
  ;
whitespace
  : S               -> ' '
  | whitespace S    -> ' '
  ;
wempty
  : whitespace    -> $1
  |               -> ""
  ;
space_cdata_list
  : space_cdata                     -> null
  | space_cdata_list space_cdata    -> null
  |
  ;
space_cdata
  : S        -> null
  | CDO      -> null
  | CDC      -> null
  ;

%%

var _ = require('lodash');

parser.parseError = function(str, hash) {
  var unexpected;

  if (hash.token === lexer.EOF) {
    unexpected = "end of input";
  } else {
    unexpected = "'" + hash.text + "'";
  }

  var str = 'Unexpected ' + unexpected + ' on line ' + (hash.line + 1);
  var error = new Error(str);
  error.lineNumber = hash.line;
  error.token = hash.token;
  error.text = hash.text;
  error.expected = hash.expected;
  error.loc = hash.loc;

  throw error;
};
