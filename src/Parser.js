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
    this.modelFilenames = []; // To store model filenames from #DEFINE <model> or #DEFINE <rule>
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
    // #DEFINE <model> TM60L2252X_augmented 'OPC LE'
    // #DEFINE <rule> THJPL2205E.func 'PR model 'OPC LE'

    this.nextToken(); // Consume #DEFINE token itself, currentToken is now the first token after #DEFINE

    if (this.currentToken.type !== Token.tokens.ANGLE_BRACKET_CONTENT) {
      this.reportError("Expected <key> in angle brackets after #DEFINE");
      this.skipToNextDirectiveOrEof(); // error recovery
      return;
    }
    const defineKey = this.currentToken.text; // e.g., "is_standalone_xjc", "model", "rule"
    this.nextToken(); // Consume <key> token

    if (defineKey === "rule" || defineKey.startsWith("model")) {
      // This is a #DEFINE <model> FILENAME or #DEFINE <rule> FILENAME directive
      if (this.currentToken.type !== Token.tokens.IDENTIFIER_TOKEN) {
        this.reportError(`Expected IDENTIFIER (model/rule filename) after #DEFINE <${defineKey}>. Got ${Token.backwardMap[this.currentToken.type]}`);
        this.skipToNextDirectiveOrEof();
        return;
      }
      const modelFilename = this.currentToken.text;
      if (this.isCurrentBlockActive()) {
        this.modelFilenames.push(modelFilename);
      }
      // this.nextToken(); // Consume the IDENTIFIER_TOKEN (modelFilename) - this will be done by the main loop's nextToken

      // Consume any remaining tokens on the current line (e.g., comments)
      // The main loop's nextToken() will handle moving past the IDENTIFIER_TOKEN.
      // We need to ensure we consume anything else *before* the main loop tries to parse the next directive.
      // Lookahead until next directive or EOS. The current nextToken() in main loop might be enough.
      // Let's add explicit consumption here to be safe for remaining parts of the line.
      while (this.lookahead() !== Token.tokens.EOS_TOKEN &&
             !this.isDirectiveToken(this.lookahead()) &&
             this.lookahead() !== Token.tokens.NEWLINE_TOKEN /* Assuming NEWLINE means end of this define for practical purposes */ ) {
        this.nextToken(); // consume rest of the line tokens like comments 'OPC LE'
      }

    } else {
      // This is a standard #DEFINE <var_name> <value> directive
      if (this.currentToken.type !== Token.tokens.ANGLE_BRACKET_CONTENT) {
        this.reportError(`Expected <value> in angle brackets after #DEFINE <${defineKey}>. Got ${Token.backwardMap[this.currentToken.type]}`);
        this.skipToNextDirectiveOrEof();
        return;
      }
      const value = this.currentToken.text;
      // this.nextToken(); // Consume <value> token - done by main loop

      if (this.isCurrentBlockActive()) {
        this.definedVariables[defineKey] = value; // varName is defineKey here
      }

      // Consume any further parts of a complex define like ''<true>
      // The example #DEFINE <is_standalone_xjc> <false> ''<true> has more parts.
      // Current implementation only takes the first <value>.
      // This loop will consume them.
      while (this.lookahead() !== Token.tokens.EOS_TOKEN &&
            !this.isDirectiveToken(this.lookahead()) &&
            this.lookahead() !== Token.tokens.NEWLINE_TOKEN ) {
        this.nextToken(); // consume rest of the line
      }
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
    // Expect #INCLUDE PATH_IDENTIFIER
    this.nextToken(); // Consume INCLUDE token itself, currentToken is now the first token of the path

    if (this.currentToken.type !== Token.tokens.IDENTIFIER_TOKEN) {
      this.reportError(
        `Expected IDENTIFIER (filepath) after #INCLUDE. Got ${Token.backwardMap[this.currentToken.type] || this.currentToken.text }`
      );
      this.skipToNextDirectiveOrEof(); // Skip to recover
      return;
    }
    
    const filepath = this.currentToken.text;
    // The IDENTIFIER_TOKEN (filepath) will be consumed by the main loop's nextToken() call.

    if (this.isCurrentBlockActive()) {
      // As per previous requirements, only push the filename component.
      // We need to extract filename from the full path.
      const filenameOnly = filepath.substring(filepath.lastIndexOf('/') + 1);
      this.includedFiles.push(filenameOnly);
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

  getModelFiles() {
    return this.modelFilenames;
  }
}

module.exports = Parser;
