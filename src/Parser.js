const Errors = require("./Errors");
const Token = require("./Token");
const ExpressionBlockNode = require("./Nodes/ExpressionBlockNode");
const PrintNode = require("./Nodes/PrintNode");
const IntNode = require("./Nodes/IntNode");
const VariableNode = require("./Nodes/VariableNode");

// Parser class
class Parser {
  constructor(scanner) {
    this.scanner = scanner;
    this.currentToken = new Token();
    this.lookaheadToken = new Token();
    this.lookaheadToken.consumed = true;
  }

  nextToken() {
    let token;
    if (this.lookaheadToken.consumed) {
      token = this.scanner.nextToken();
      // skip comments
      while (
        token === Token.tokens.LINECOMMENT_TOKEN ||
        token === Token.tokens.BLOCKCOMMENT_TOKEN
      ) {
        token = this.scanner.nextToken();
      }
      this.currentToken.type = token;
      this.currentToken.text = this.scanner.currentToken.text;
      return token;
    } else {
      this.currentToken.type = this.lookaheadToken.type;
      this.currentToken.text = this.lookaheadToken.text;
      this.lookaheadToken.consumed = true;
      return this.currentToken.type;
    }
  }

  lookahead() {
    if (this.lookaheadToken.consumed) {
      let token = this.scanner.nextToken();
      // skip comments
      while (
        token === Token.tokens.LINECOMMENT_TOKEN ||
        token === Token.tokens.BLOCKCOMMENT_TOKEN
      ) {
        token = this.scanner.nextToken();
      }
      this.lookaheadToken.type = token;
      this.lookaheadToken.text = this.scanner.currentToken.text;
      this.lookaheadToken.consumed = false;
      return token;
    } else {
      return this.lookaheadToken.type;
    }
  }

  // the entry point of our parser
  parse() {
    let rootBlock = new ExpressionBlockNode();
    this.parseExpressions(rootBlock);
    return rootBlock;
  }

  // to parse a list of expressions
  parseExpressions(expressionBlockNode) {
    while (
      this.lookahead() !== Token.tokens.RIGHTBRACE_TOKEN &&
      this.lookahead() !== Token.tokens.EOS_TOKEN
    ) {
      let expressionNode = this.parseExpression();
      if (expressionNode) {
        expressionBlockNode.push(expressionNode);
      }

      // consume the semicolon
      if (this.lookahead() === Token.tokens.SEMICOLON_TOKEN) {
        this.nextToken();
      } else {
        // syntax error
        Errors.push({
          type: Errors.SYNTAX_ERROR,
          msg: "Expecting a semicolon at the end of expression",
          line: this.scanner.currLine
        });
      }
    }
  }

  // to parse an expression
  parseExpression() {
    switch (this.lookahead()) {
      case Token.tokens.PRINT_TOKEN:
        let printToken = this.nextToken();
        let expressionNode = this.parseExpression();
        if (expressionNode === undefined) {
          Errors.push({
            type: Errors.SYNTAX_ERROR,
            msg: 'Missing an expression after "print"',
            line: this.scanner.currLine
          });
        }
        return new PrintNode(expressionNode);
      case Token.tokens.INTLITERAL_TOKEN:
        let intToken = this.nextToken();
        return new IntNode(this.currentToken.text);
      case Token.tokens.VAR_TOKEN:
        return this.parseVarExpression();
      default:
        // unexpected, consume it
        this.nextToken();
    }
  }

  parseVarExpression() {
    // consume "var"
    this.nextToken();

    // expecting an identifier
    if (this.lookahead() === Token.tokens.IDENTIFIER_TOKEN) {
      this.nextToken();
      let varName = this.currentToken.text;

      // consume a colon
      if (this.nextToken() !== Token.tokens.COLON_TOKEN) {
        this.skipError();
        return;
      }

      // type token
      if (this.lookahead() !== Token.tokens.TYPE_TOKEN) {
        this.skipError();
        return;
      }

      this.nextToken();
      let typeName = this.currentToken.text;

      let initNode;
      // check if it has initialization expression
      if (this.lookahead() === Token.tokens.ASSIGN_TOKEN) {
        initNode = this.parseSimpleAssignmentExpression();
      }
      return new VariableNode(varName, typeName, initNode);
    }

    this.skipError();
  }

  parseSimpleAssignmentExpression() {
    // consume the "=" sign
    this.nextToken();

    return this.parseExpression();
  }

  // a naive implementation for skipping error
  skipError() {
    this.scanner.skipNewLine = false;

    while (
      this.lookahead() !== Token.tokens.NEWLINE_TOKEN &&
      this.lookahead() !== Token.tokens.EOS_TOKEN
    ) {
      this.nextToken();
    }

    this.scanner.skipNewLine = true;
  }
  //
  // matchSemicolon() {
  //   // consume the semicolon
  //   if (this.lookahead() === Token.tokens.SEMICOLON_TOKEN) {
  //     this.nextToken();
  //   } else {
  //     // syntax error
  //     Errors.push({
  //       type: Errors.SYNTAX_ERROR,
  //       msg: "Expecting a semicolon at the end of expression",
  //       line: this.scanner.currLine
  //     });
  //   }
  // }

  // --- XJC Parser Methods ---

  // XJC Parser entry point
  parseXjc() {
    this.definedVariables = {}; // To store #DEFINEd variables
    this.includedFiles = []; // To store #INCLUDEd file paths
    this.activeBlocks = [{ type: "GLOBAL", active: true }]; // Stack to manage #IF/#ELSE blocks

    this.nextToken(); // Initialize currentToken

    while (this.currentToken.type !== Token.tokens.EOS_TOKEN) {
      // Skip tokens if in an inactive block
      if (!this.isCurrentBlockActive()) {
        if (
          this.currentToken.type === Token.tokens.DIRECTIVE_IF ||
          this.currentToken.type === Token.tokens.DIRECTIVE_ELSE ||
          this.currentToken.type === Token.tokens.DIRECTIVE_ENDIF
        ) {
          // Process control directives even in inactive blocks to maintain stack
        } else {
          this.nextToken();
          continue;
        }
      }

      switch (this.currentToken.type) {
        case Token.tokens.DIRECTIVE_DEFINE:
          this.parseDefine();
          break;
        case Token.tokens.DIRECTIVE_IF:
          this.parseIf();
          break;
        case Token.tokens.DIRECTIVE_ELSE:
          this.parseElse();
          break;
        case Token.tokens.DIRECTIVE_ENDIF:
          this.parseEndif();
          break;
        case Token.tokens.DIRECTIVE_INCLUDE:
          this.parseInclude();
          break;
        // NEWLINE_TOKEN could be used to signify end of directive if needed, but current scanner skips them
        // case Token.tokens.NEWLINE_TOKEN: 
        //   break; // Ignore newlines between directives
        default:
          // In a strict XJC parser, any non-directive token at this level might be an error
          // For now, we'll skip it. Could be comments or whitespace the scanner didn't fully consume.
          // Or it could be an error if we expect only directives at the root.
          if (this.currentToken.type !== Token.tokens.LINECOMMENT_TOKEN && 
              this.currentToken.type !== Token.tokens.BLOCKCOMMENT_TOKEN) {
            // Errors.push({
            //   type: Errors.SYNTAX_ERROR,
            //   msg: `Unexpected token in XJC structure: ${Token.backwardMap[this.currentToken.type]}`,
            //   line: this.scanner.currLine,
            // });
          }
          break; 
      }
      this.nextToken(); // Consume the current directive/token and move to the next
    }

    if (this.activeBlocks.length > 1) {
      Errors.push({
        type: Errors.SYNTAX_ERROR,
        msg: "Mismatched #IF/#ENDIF. Unclosed #IF block(s).",
        line: this.scanner.currLine, // Or line of last #IF
      });
    }
    return this.includedFiles;
  }

  isCurrentBlockActive() {
    return this.activeBlocks[this.activeBlocks.length - 1].active;
  }

  parseDefine() {
    // Expect #DEFINE <var_name> <value> ... (value can be complex, for now, simple bracketed content)
    // #DEFINE <is_standalone_xjc> <false> ''<true>
    this.nextToken(); // Consume DEFINE
    if (this.currentToken.type !== Token.tokens.ANGLE_BRACKET_CONTENT) {
      this.reportError("Expected variable name in <...> after #DEFINE");
      return;
    }
    const varName = this.currentToken.text;
    this.nextToken(); // Consume <var_name>

    if (this.currentToken.type !== Token.tokens.ANGLE_BRACKET_CONTENT) {
      // It might also be a quoted string or other literal based on example `''<true>`
      // For now, strictly expect <value> for simplicity
      this.reportError("Expected value in <...> for #DEFINE " + varName);
      return;
    }
    const value = this.currentToken.text;
    
    if (this.isCurrentBlockActive()) {
      this.definedVariables[varName] = value;
    }
    // The example #DEFINE <is_standalone_xjc> <false> ''<true> has more parts.
    // Current implementation only takes the first <value>.
    // We need to consume tokens until the end of the line or next directive.
    while(this.lookahead() !== Token.tokens.EOS_TOKEN &&
          !this.isDirectiveToken(this.lookahead())) {
        this.nextToken(); // consume rest of the line
    }
  }
  
  isDirectiveToken(tokenType) {
      return tokenType === Token.tokens.DIRECTIVE_DEFINE ||
             tokenType === Token.tokens.DIRECTIVE_IF ||
             tokenType === Token.tokens.DIRECTIVE_ELSE ||
             tokenType === Token.tokens.DIRECTIVE_ENDIF ||
             tokenType === Token.tokens.DIRECTIVE_INCLUDE;
  }

  parseIf() {
    // Expect #IF <var_name> eq <value> THEN
    this.nextToken(); // Consume IF
    if (this.currentToken.type !== Token.tokens.ANGLE_BRACKET_CONTENT) {
      this.reportError("Expected <variable> after #IF");
      this.skipToNextDirectiveOrEof();
      return;
    }
    const varName = this.currentToken.text;
    this.nextToken(); // Consume <variable>

    if (this.currentToken.type !== Token.tokens.DIRECTIVE_KEYWORD || this.currentToken.text.toLowerCase() !== "eq") {
      this.reportError("Expected 'eq' after <variable> in #IF");
      this.skipToNextDirectiveOrEof();
      return;
    }
    this.nextToken(); // Consume 'eq'

    if (this.currentToken.type !== Token.tokens.ANGLE_BRACKET_CONTENT) { // or QUOTED_STRING
      this.reportError("Expected <value> or quoted string after 'eq' in #IF");
      this.skipToNextDirectiveOrEof();
      return;
    }
    const valueToCompare = this.currentToken.text;
    this.nextToken(); // Consume <value>

    if (this.currentToken.type !== Token.tokens.DIRECTIVE_KEYWORD || this.currentToken.text.toLowerCase() !== "then") {
       // The example file doesn't always have THEN explicitly after the condition for #IF
       // e.g. #IF "<is_standalone_xjc>" eq "<true>" THEN (here it is)
       // Let's make THEN optional for now, or assume it's consumed if present.
       // If it's truly optional, the grammar is a bit ambiguous without newlines as terminators for the condition.
       // For now, let's assume the scanner handles "THEN" as a DIRECTIVE_KEYWORD and we consume it.
       // If current token is not THEN, we assume it's implicit.
       // This part might need refinement based on stricter grammar rules.
    } else {
        this.nextToken(); // Consume 'THEN' if present
    }


    let conditionMet = false;
    if (this.definedVariables.hasOwnProperty(varName)) {
      conditionMet = this.definedVariables[varName] === valueToCompare;
    }

    if (this.isCurrentBlockActive()) {
      this.activeBlocks.push({ type: "IF", active: conditionMet });
    } else {
      // If parent block is not active, this one isn't either
      this.activeBlocks.push({ type: "IF", active: false });
    }
  }

  parseElse() {
    // Expect #ELSE
    if (this.activeBlocks.length < 2 || this.activeBlocks[this.activeBlocks.length - 1].type !== "IF") {
      this.reportError("#ELSE without matching #IF");
      return;
    }
    
    const parentActive = this.activeBlocks[this.activeBlocks.length - 2].active;
    if (parentActive) { // Only flip activity if parent block is active
        const ifBlock = this.activeBlocks[this.activeBlocks.length - 1];
        ifBlock.active = !ifBlock.active; // Flip the activity of the current IF block
        ifBlock.type = "ELSE"; // Mark that we've seen an ELSE for this block
    }
    // If parent is not active, this ELSE block also remains inactive.
  }

  parseEndif() {
    // Expect #ENDIF
    if (this.activeBlocks.length < 2 || 
        (this.activeBlocks[this.activeBlocks.length - 1].type !== "IF" &&
         this.activeBlocks[this.activeBlocks.length - 1].type !== "ELSE") ) {
      this.reportError("#ENDIF without matching #IF/#ELSE");
      return;
    }
    this.activeBlocks.pop();
  }

  parseInclude() {
    // Expect #INCLUDE <directory_path_component>filename_component
    this.nextToken(); // Consume INCLUDE token itself

    if (this.currentToken.type !== Token.tokens.ANGLE_BRACKET_CONTENT) {
      this.reportError("Expected <directory_path> after #INCLUDE");
      this.skipToNextDirectiveOrEof(); // Skip to recover
      return;
    }
    const dirPathComponent = this.currentToken.text;
    this.nextToken(); // Consume <directory_path_component>

    // Now expect the filename component as an IDENTIFIER
    if (this.currentToken.type !== Token.tokens.IDENTIFIER_TOKEN) {
      this.reportError(
        `Expected filename after <${dirPathComponent}> in #INCLUDE. Got ${Token.backwardMap[this.currentToken.type] || this.currentToken.text}`
      );
      this.skipToNextDirectiveOrEof(); // Skip to recover
      return;
    }
    const filenameComponent = this.currentToken.text;
    // this.nextToken(); // Consume IDENTIFIER_TOKEN (filename part) -> This will be done by the main loop's nextToken()

    const fullFilepath = dirPathComponent + filenameComponent; // Keep for potential logging or other uses if needed

    if (this.isCurrentBlockActive()) {
      // Only push the filename component as per the new requirement
      this.includedFiles.push(filenameComponent);
    }
    // Consume any other tokens on the line until next directive or EOS
    // This helps if there are stray characters or comments after the include.
    // The main loop's nextToken() will eventually move to the next line or directive.
    // However, if the current IDENTIFIER_TOKEN (filenameComponent) is the last meaningful token on the line,
    // the main loop's nextToken() call will correctly move to the next directive.
    // So, no special skipping needed here unless grammar allows more after filename on same line.
  }
  
  reportError(msg) {
    Errors.push({
      type: Errors.SYNTAX_ERROR,
      msg: msg,
      line: this.scanner.currLine, // currentToken might be ahead
    });
  }

  skipToNextDirectiveOrEof() {
    while(this.currentToken.type !== Token.tokens.EOS_TOKEN && !this.isDirectiveToken(this.currentToken.type)) {
      this.nextToken();
    }
    // If it's a directive, the main loop will process it. If EOF, loop terminates.
    // Need to call nextToken() before this to ensure currentToken is the one causing trouble.
    // This is a simple recovery; might need to be smarter.
    if (this.currentToken.type !== Token.tokens.EOS_TOKEN && !this.isDirectiveToken(this.currentToken.type)) {
       this.nextToken(); // Ensure progress if not already on a directive
    }
  }
}

module.exports = Parser;
