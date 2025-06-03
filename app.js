const fs = require("fs");
const Reader = require("./src/Reader");
const Scanner = require("./src/Scanner");
const Token = require("./src/Token");
const Parser = require("./src/Parser");
const Errors = require("./src/Errors");

function log(str) {
  console.log(str);
}

function errorLog(str) {
  console.error(str);
}

let dataToBeCompiled = fs.readFileSync("test.xjc", "utf8");
let reader = new Reader(dataToBeCompiled);
let scanner = new Scanner(reader);
let parser = new Parser(scanner);

expressionBlockNode = parser.parse();

console.log(expressionBlockNode);

Errors.each(function(error, i) {
  errorLog(
    "Line " + error.line + ": (" + Errors.type[error.type] + ") " + error.msg
  );
});
