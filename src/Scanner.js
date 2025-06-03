// Scanner class
// reader: the reader used to read in characters
const Token = require("./Token");
const Errors = require("./Errors");

class Scanner {
  constructor(reader) {
    this.reader = reader;
    this.currentToken = new Token(); // storing the current analysed token
    this.currLine = 0; // the line number of the current line being read
    this.state = Scanner.START_STATE;
  }

  makeToken(type, text = "") { // Default text to empty string
    this.currentToken.type = type;
    this.currentToken.text = text;
    return type;
  }

  nextToken() {
    let bufferStr = "",
      c = "",
      d = "";
    while (true) {
      switch (this.state) {
        case Scanner.START_STATE:
          c = this.reader.nextChar();
          // Skip leading whitespace characters for directives, but not for other tokens
          // This is a bit tricky because we don't want to skip all whitespace, just leading.
          // Let's assume directives are always at the start of a line or after other directives.
          
          // Handle whitespace before potential directive
          while (c === ' ' || c === '\t') {
            c = this.reader.nextChar();
          }

          if (c === '#') {
            this.state = Scanner.DIRECTIVE_STATE;
            bufferStr = c; // Keep '#' for now to identify it's a directive line
          // Check for characters that can start an identifier (letters, '_', or '/')
          } else if ((c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === '_' || c === '/') {
            // If it's a slash, we need to determine if it's a comment, division, or path start.
            if (c === '/') {
              let nextChar = this.reader.nextChar(); // Look ahead
              this.reader.retract(); // Retract immediately, as we only wanted to peek
              
              if (nextChar === '/' || nextChar === '*') {
                // It's a comment, delegate to SLASH_STATE by re-processing '/'
                this.reader.retract(); // Retract current 'c' which is '/'
                this.state = Scanner.START_STATE; // to re-evaluate '/'
                continue; // Re-evaluate '/' in the next iteration to go to SLASH_STATE path
              }
              // Otherwise, it's a path starting with '/', treat as identifier part
            }
            this.state = Scanner.IDENTIFIER_STATE;
            bufferStr = c;
          } else if (c >= "0" && c <= "9") {
            bufferStr = c;
            let d;
            while (true) {
              d = this.reader.nextChar();
              if (d >= "0" && d <= "9") {
                bufferStr += d;
              } else {
                this.reader.retract();
                return this.makeToken(Token.tokens.INTLITERAL_TOKEN, bufferStr);
              }
            }
          } else {
            switch (c) {
              case ":":
                return this.makeToken(Token.tokens.COLON_TOKEN);
              case ";":
                return this.makeToken(Token.tokens.SEMICOLON_TOKEN);
              case "(":
                return this.makeToken(Token.tokens.LEFTPAREN_TOKEN);
              case ")":
                return this.makeToken(Token.tokens.RIGHTPAREN_TOKEN);
              case "{":
                return this.makeToken(Token.tokens.LEFTBRACE_TOKEN);
              case "}":
                return this.makeToken(Token.tokens.RIGHTBRACE_TOKEN);
              case "%":
                return this.makeToken(Token.tokens.MOD_TOKEN);
              case "!":
                if (this.reader.nextChar() === "=") {
                  return this.makeToken(Token.tokens.NOTEQUAL_TOKEN);
                } else {
                  // we have consumed one more char in if-condition
                  this.reader.retract();
                  return this.makeToken(Token.tokens.NOT_TOKEN);
                }
              case "+":
                d = this.reader.nextChar();
                if (d === "=") {
                  return this.makeToken(Token.tokens.PLUSASSIGN_TOKEN);
                } else if (d === "+") {
                  return this.makeToken(Token.tokens.PLUSPLUS_TOKEN);
                } else {
                  this.reader.retract();
                  return this.makeToken(Token.tokens.PLUS_TOKEN);
                }
              case "-":
                d = this.reader.nextChar();
                if (d === "=") {
                  return this.makeToken(Token.tokens.MINUSASSIGN_TOKEN);
                } else if (d === "-") {
                  return this.makeToken(Token.tokens.MINUSMINUS_TOKEN);
                } else {
                  this.reader.retract();
                  return this.makeToken(Token.tokens.MINUS_TOKEN);
                }
              case "*":
                return this.makeToken(Token.tokens.MULT_TOKEN);
              case "=":
                if (this.reader.nextChar() === "=") {
                  return this.makeToken(Token.tokens.EQUAL_TOKEN);
                } else {
                  this.reader.retract();
                  return this.makeToken(Token.tokens.ASSIGN_TOKEN);
                }
              case ">":
                if (this.reader.nextChar() === "=") {
                  return this.makeToken(Token.tokens.GREATEREQUAL_TOKEN);
                } else {
                  this.reader.retract();
                  return this.makeToken(Token.tokens.GREATER_TOKEN);
                }
              case "<": // For ANGLE_BRACKET_CONTENT
                // This will read content until '>'
                bufferStr = ""; 
                let charInBracket = this.reader.nextChar();
                while(charInBracket !== '>' && charInBracket !== -1 && charInBracket !== '\n' && charInBracket !== '\r') {
                  bufferStr += charInBracket;
                  charInBracket = this.reader.nextChar();
                }
                if (charInBracket === '>') {
                  return this.makeToken(Token.tokens.ANGLE_BRACKET_CONTENT, bufferStr);
                } else {
                  // Error or unexpected end
                  this.reader.retract(); // Retract the non '>' char
                  Errors.push({
                    type: Errors.SYNTAX_ERROR,
                    msg: "Unterminated angle bracket content",
                    line: this.currLine
                  });
                  // Fall through to default to ignore or handle as error token
                }
                break; // Added break
              case "/": // This case in the switch(c) block handles actual division or comments
                // The IDENTIFIER_STATE starter above handles paths starting with '/'
                // This means if we reach here, '/' was not followed by path-like characters
                // or it was whitespace-separated.
                let nextCharAfterSlash = this.reader.nextChar();
                this.reader.retract(); // peek
                if (nextCharAfterSlash === '/' || nextCharAfterSlash === '*') {
                    this.state = Scanner.SLASH_STATE; // Let SLASH_STATE handle comment
                } else {
                    // It's a DIV_TOKEN if not starting a comment or path.
                    // This assumes paths starting with / are handled by IDENTIFIER_STATE transition.
                    // If IDENTIFIER_STATE did not pick it up, it might be a standalone '/'
                    return this.makeToken(Token.tokens.DIV_TOKEN, "/");
                }
                break;
              case "&":
                if (this.reader.nextChar() === "&") {
                  return this.makeToken(Token.tokens.AND_TOKEN);
                } else {
                  this.reader.retract();
                  Errors.push({
                    type: Errors.SYNTAX_ERROR,
                    msg: "You have only one &",
                    line: this.currLine
                  });
                }
                break;
              case "|":
                if (this.reader.nextChar() === "|") {
                  return this.makeToken(Token.tokens.OR_TOKEN);
                } else {
                  this.reader.retract();
                  Errors.push({
                    type: Errors.SYNTAX_ERROR,
                    msg: "You have only one |",
                    line: this.currLine
                  });
                }
                break;
              case -1:
                return this.makeToken(Token.tokens.EOS_TOKEN);
              case "\r":
              case "\n":
                this.currLine++;
                // NEWLINE_TOKEN could be useful for XJC parser to know line endings for directives
                // but for now, stick to requirements.
                // this.state = Scanner.START_STATE; // Reset state for next line
                // return this.makeToken(Token.tokens.NEWLINE_TOKEN); 
                break; 
              default:
              // ignore them, or report as unexpected character
            }
          }
          break;
        case Scanner.IDENTIFIER_STATE:
          c = this.reader.nextChar();
          // Allow letters, numbers (after the first char), underscores, periods, and slashes in identifiers
          if ((c >= "a" && c <= "z") || (c >= "A" && c <= "Z") ||
              (c >= "0" && c <= "9" && bufferStr.length > 0) || // Numbers allowed if not the first character
              c === '_' || c === '.' || c === '/') {
            bufferStr += c;
          } else if (c === -1) { // End of stream
            // If bufferStr is not empty, it's an identifier at EOS
            if (bufferStr.length > 0) {
                 // No keywords check here, assuming IDENTIFIER_TOKEN is desired for paths at EOS
                 this.state = Scanner.START_STATE; // Reset state
                 return this.makeToken(Token.tokens.IDENTIFIER_TOKEN, bufferStr);
            }
            return this.makeToken(Token.tokens.EOS_TOKEN);
          } else {
            // Character does not belong to this identifier. Retract and finalize token.
            this.reader.retract();
            // Change back state for next token
            this.state = Scanner.START_STATE;
            // Check if the formed bufferStr is a keyword, otherwise it's an identifier
            // This check should ideally happen *after* the full identifier is read.
            // The original placement of keyword check was correct.
            switch (bufferStr) {
              // XJC Keywords (like 'eq', 'THEN')
              // Be careful: if 'eq' can be part of a path, this needs adjustment.
              // For now, assume 'eq' and 'THEN' are standalone keywords.
              case "eq":
              case "THEN":
                return this.makeToken(Token.tokens.DIRECTIVE_KEYWORD, bufferStr);
              // Original keywords (like 'var', 'if', etc.)
              case "var":
                return this.makeToken(Token.tokens.VAR_TOKEN);
              case "int":
              case "bool":
                return this.makeToken(Token.tokens.TYPE_TOKEN, bufferStr);
              case "true":
              case "false":
              case "TRUE":
              case "FALSE":
                return this.makeToken(Token.tokens.BOOLLITERAL_TOKEN, bufferStr);
              case "if":
                return this.makeToken(Token.tokens.IF_TOKEN);
              case "else":
                return this.makeToken(Token.tokens.ELSE_TOKEN);
              case "while":
                return this.makeToken(Token.tokens.WHILE_TOKEN);
              case "print":
                return this.makeToken(Token.tokens.PRINT_TOKEN);
              default:
                // If it's not a keyword, it's an IDENTIFIER_TOKEN (potentially a path component)
                return this.makeToken(Token.tokens.IDENTIFIER_TOKEN, bufferStr);
            }
          }
          break;
        case Scanner.DIRECTIVE_STATE: // New state for handling directives
          // We have already consumed '#' and it's in bufferStr if we kept it.
          // Or, we can just read starting from after '#'
          bufferStr = ""; // Reset buffer for the directive keyword
          let directiveChar = this.reader.nextChar();
          while ((directiveChar >= "A" && directiveChar <= "Z")) { // Directives are uppercase
            bufferStr += directiveChar;
            directiveChar = this.reader.nextChar();
          }
          this.reader.retract(); // Retract the char that's not part of the directive keyword
          this.state = Scanner.START_STATE; // Go back to start state for the next token

          switch (bufferStr) {
            case "DEFINE":
              return this.makeToken(Token.tokens.DIRECTIVE_DEFINE);
            case "IF":
              return this.makeToken(Token.tokens.DIRECTIVE_IF);
            case "ELSE":
              return this.makeToken(Token.tokens.DIRECTIVE_ELSE);
            case "ENDIF":
              return this.makeToken(Token.tokens.DIRECTIVE_ENDIF);
            case "INCLUDE":
              return this.makeToken(Token.tokens.DIRECTIVE_INCLUDE);
            default:
              Errors.push({
                type: Errors.SYNTAX_ERROR,
                msg: "Unknown directive: #" + bufferStr,
                line: this.currLine
              });
              // Skip the rest of the line for unknown directives?
              // For now, just return an error token or skip.
              // This part needs robust error handling.
              // Let's try to consume until newline.
              let errChar = this.reader.nextChar();
              while(errChar !== '\n' && errChar !== '\r' && errChar !== -1) {
                errChar = this.reader.nextChar();
              }
              if (errChar === '\n' || errChar === '\r') this.currLine++;
              return this.nextToken(); // Try to get the next valid token
          }
        case Scanner.SLASH_STATE:
          d = this.reader.nextChar();
          if (d === "/") {
            // line comment
            bufferStr = "";
            // reading 1 more char here can prevent the case that a // is followed by a line break char immediately
            d = this.reader.nextChar();
            if (d !== "\r" && d !== "\n") {
              while (d !== "\r" && d !== "\n") {
                bufferStr += d;
                d = this.reader.nextChar();
                if (d === -1) {
                  break;
                }
              }
              // to retract the line break char
              this.reader.retract();
            }
            this.state = Scanner.START_STATE;
            return this.makeToken(Token.tokens.LINECOMMENT_TOKEN, bufferStr);
          } else if (d === "*") {
            // block comment
            bufferStr = "";
            let end = false;
            while (!end) {
              d = this.reader.nextChar();
              if (d !== -1) {
                if (d === "\r" || d === "\n") {
                  this.currLine++;
                }
                if (d === "*") {
                  let e = this.reader.nextChar();
                  if (e === "/") {
                    // meet */
                    end = true;
                  } else {
                    bufferStr += "*" + e;
                  }
                } else {
                  bufferStr += d;
                }
              } else {
                end = true;
              }
            }
            this.state = Scanner.START_STATE;
            return this.makeToken(Token.tokens.BLOCKCOMMENT_TOKEN, bufferStr);
          } else {
            // This is the original DIV_TOKEN logic from SLASH_STATE
            // It should only be reached if SLASH_STATE determined it's not a comment.
            // We need to ensure paths starting with / are routed to IDENTIFIER_STATE from START_STATE.
            // If execution reaches here, it means '/' was not part of a comment.
            // The modified START_STATE should ideally handle path-starting slashes.
            // If it's a simple '/', it becomes DIV_TOKEN.
            this.state = Scanner.START_STATE; // Reset state
            this.reader.retract(); // Retract the character after '/' that wasn't part of a comment
            return this.makeToken(Token.tokens.DIV_TOKEN, "/");
          }
      }
    }
  }
}

// Ensure Reader has a peekChar method if used, or simulate with nextChar/retract
// For this implementation, I've used nextChar/retract to simulate peeking.

Scanner.START_STATE = 1; // every FSM should have a start state
Scanner.IDENTIFIER_STATE = Scanner.START_STATE + 1;
Scanner.SLASH_STATE = Scanner.IDENTIFIER_STATE + 1; // For actual comment parsing
Scanner.DIRECTIVE_STATE = Scanner.SLASH_STATE + 1;

module.exports = Scanner;
