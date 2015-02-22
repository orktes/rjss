%start stylesheet

%%

stylesheet
  : import_list defines general_list
    %{
      $$ = {};
      if ( $1 )
        $$["imports"]  = $1;
      if ( $2 )
        $$["defines"]  = $2;
      if ( $3 )
        $$["rulelist"]  = $3;

      return $$;
    %}
  ;
import_list
  : import_item
    %{
      $$ = [];
      if ( $1 !== null )
        $$.push ( $1 );
    %}
  | import_list import_item
    %{
      $$ = $1;
      if ( $2 !== null )
        $$.push ( $2 );
    %}
  |              -> null
  ;
import_item
  : import          -> $1
  | space_cdata_list    -> null
  ;
import
  : IMPORT_SYM wempty string_or_uri ';' wempty
    %{
      $$ = {
        "import": $3
      };
    %}
  ;
defines
  : define_item
    %{
      $$ = {};
      if ( $1 !== null )
        $$[$1[0]] = $1[1];
    %}
  | defines define_item
    %{
      $$ = $1;
      if ( $2 !== null )
        $$[$2[0]] = $2[1];
    %}
  |              -> null
  ;
define_item
  : FUNC_DEFINE_SYM wempty IDENT wempty '(' wempty function_def_attrs wempty ')' wempty '{' code_block '}'
  %{
    $$ = [
      $3,
      {
        "type": "FUNC",
        "attributes": $7,
        "value": $12
      }
    ];
  %}
  | VAR_DEFINE_SYM wempty declaration ";" -> $3
  | space_cdata_list                  -> null
  ;
function_def_attrs
  : IDENT
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
general_list
  : general_item
    %{
      $$ = [];
      if ( $1 !== null )
        $$.push ( $1 );
    %}
  | general_list general_item
    %{
      $$ = $1;
      $$.push( $2 );
    %}
  |  -            > null
  ;
general_item
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
  : selector_list '{' wempty declaration_list '}' wempty    -> { "type": "style", "selector": $1, "declarations": $4 }
  ;
selector_list
  : selector                               -> $1
  | selector_list ',' wempty selector      -> $1 + $2 + ' ' + $4
  ;
selector
  : simple_selector                          -> $1
  | selector combinator simple_selector      -> $1 + $2 + $3
  ;
combinator
  : '+' wempty          -> $1
  | '>' wempty          -> $1
  | /* empty */         -> ""
  ;
simple_selector
  : simple_selector_atom_list wempty          -> $1
  | element_name simple_selector_atom_list wempty    -> $1 + $2
  ;
simple_selector_atom_list
  : simple_selector_atom                -> $1
  | simple_selector_atom_list simple_selector_atom    -> $1 + $2
  |                            -> ""
  ;
simple_selector_atom
  : IDENT      -> $1
  ;
element_name
  : IDENT      -> $1
  ;

declaration_list
  : declaration_parts
    %{

      $$ = {};
      if ( $1 !== null ) {
        if(!$$[ $1[0] ]){
          $$[ $1[0] ] = $1[1];
        } else if(Object.prototype.toString.call($$[ $1[0] ]) === '[object Array]') {
          $$[ $1[0] ].push($1[1]);
        } else {
          $$[ $1[0] ] = [ $$[ $1[0] ], $1[1] ];
        }
      }
    %}
  | declaration_list declaration_parts
    %{
      $$ = $1;
      if ( $2 !== null ) {
        if(!$$[ $2[0] ]){
          $$[ $2[0] ] = $2[1];
        } else if(Object.prototype.toString.call($$[ $2[0] ]) === '[object Array]') {
          $$[ $2[0] ].push($2[1]);
        } else {
          $$[ $2[0] ] = [ $$[ $2[0] ], $2[1] ];
        }
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
  | string_term                -> {type: "STRING", value: $1}
  ;

computable_term
  : NUMBER wempty              -> {type: "NUMBER", value: $1}
  | PERCENTAGE wempty          -> {type: "PERCENTAGE", value: $1}
  | LENGTH wempty              -> {type: "LENGTH", value: $1}
  | EMS wempty                 -> {type: "EMS", value: $1}
  | EXS wempty                 -> {type: "EXS", value: $1}
  | ANGLE wempty               -> {type: "ANGLE", value: $1}
  | TIME wempty                -> {type: "TIME", value: $1}
  | FREQ wempty                -> {type: "FREQ", value: $1}
  ;

inline_code
  : CODE '{' code_block '}'       -> {type: "CODE", value: $3}
  | FUNCTION wempty expr ')'      -> {type: "FUNC", name: $1.substring(0, $1.length - 1), attributes: $3}
  ;

code_block
  : wempty                       -> $1
  | IDENT                        -> $1
  | combinator                   -> $1 + " "
  | unary_operator               -> $1 + " "
  | STRING                       -> $1
  | RANDOM_CONTENT               -> $1
  | FUNCTION                     -> $1
  | "("                          -> $1
  | ")"                          -> $1
  | ";"                          -> $1
  | code_block code_block        -> $1 + $2
  | code_block code_block        -> $1 + $2
  ;

string_term
  : STRING wempty            -> $1
  | IDENT wempty             -> $1
  | URI wempty               -> $1
  | UNICODERANGE wempty      -> $1
  | hexcolor                 -> $1
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
