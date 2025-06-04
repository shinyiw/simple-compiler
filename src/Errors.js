let errors = [];

class Errors {
  static push(error) {
    errors.push(error);
  }

  static print() {
    console.dir(errors);
  }

  static each(cb) {
    for (let i = 0, l = errors.length; i < l; i++) {
      cb(errors[i], i);
    }
  }

  static getErrorCount() {
    return errors.length;
  }

  static getAllErrors() {
    return errors;
  }
}

Errors.SYNTAX_ERROR = 0;
Errors.type = ["Syntax error"];

module.exports = Errors;
