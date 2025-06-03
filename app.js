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

// Call the new XJC parser function
let includedFiles = parser.parseXjc();

console.log("Included Files:");
includedFiles.forEach(file => {
  console.log(file);
});
console.log("\\n---");

// Print any errors accumulated during parsing
if (Errors.getErrorCount() > 0) {
  console.error("Errors encountered during parsing:");
  Errors.getAllErrors().forEach(error => { // Use getAllErrors() and forEach for simplicity
    errorLog(
      "Line " + error.line + ": (" + (Errors.type[error.type] || "Unknown Type") + ") " + error.msg
    );
  });
} else {
  console.log("Parsing completed with no errors.");
}
