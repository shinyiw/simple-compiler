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

let dataToBeCompiled = fs.readFileSync("test2.xjc", "utf8"); // Changed to test2.xjc
let reader = new Reader(dataToBeCompiled);
let scanner = new Scanner(reader);
let parser = new Parser(scanner);

// Call the new XJC parser function
// Note: parseXjc() returns includedFiles, but we also need to call getModelFiles() later.
// So, just call parseXjc to populate internal lists in the parser instance.
parser.parseXjc();

// Get and print unique included files
let includedFiles = parser.includedFiles; // Accessing the property directly as per Parser.js structure
let uniqueIncludedFiles = [...new Set(includedFiles)];
console.log("Included Files:");
uniqueIncludedFiles.forEach(file => {
  console.log(file);
});
console.log("\\n---");

// Get and print unique model filenames
let modelFiles = parser.getModelFiles();
let uniqueModelFiles = [...new Set(modelFiles)];
console.log("Model Files:");
uniqueModelFiles.forEach(file => {
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
