// generates regexes for the desired imaginary unit (usually 'i' or 'j')
const IMAG_LETTER = 'i';
// TODO: check if allowing negative numbers here will affect ComplexExpr.parse.
//       Maybe just use .neg() and make the ComplexExpr.parseValue function completely separate from Complex.parse
const NUM_REGEX = '\\d+(.\\d+)?'; 
const RE_REGEX = new RegExp('^' + NUM_REGEX);
const IM_REGEX = new RegExp('^' + NUM_REGEX + IMAG_LETTER);
const CPX_REGEX = new RegExp('^' + NUM_REGEX + '\\s*\\+\\s*' + NUM_REGEX + IMAG_LETTER);
const NAME_REGEX = /^[a-z]/; // a single lowercase letter

function Complex(re, im) {
  this.re = re;
  this.im = im;
}

Complex.fromPolar = function(abs, arg) {
  return new Complex(abs * Math.cos(arg), arg * Math.sin(arg));
}

/* Parses a complex number.
 * Returns an array [z, txt], containing the number (or null) and the remaning text.
 */
Complex.parse = function(txt) {
  if (CPX_REGEX.test(txt)) {
    let [re, im] = txt.split('+', 2);
    // note that parseFloat ignores the trailing 'i'
    return [new Complex(Number.parseFloat(re), Number.parseFloat(im)), txt.replace(CPX_REGEX, '')];
  } else {
    let [z, rem] = Complex.parseSingle(txt);
    if (z) {
      return [z, rem];
    }
  }
  return [null, txt];
}

/* Parses a real or imaginary number. For use with ComplexExpr.
 * Returns an array [z, txt], containing the number (or null) and the remaning text.
 */
Complex.parseSingle = function(txt) {
  if (IM_REGEX.test(txt)) {
    return [new Complex(0, Number.parseFloat(txt)), txt.replace(IM_REGEX, '')];
  } else if (RE_REGEX.test(txt)) {
    return [new Complex(Number.parseFloat(txt), 0), txt.replace(RE_REGEX, '')];
  }
  return [null, txt];
}

Complex.fromString = function(txt) {
  let [z, rem] = Complex.parse(txt);
  if (z == null || rem != '') {
    throw 'Not a complex number: ' + txt;
  }
  return z;
}

/* Returns a human- and machine-readable text representation of the number.
 */
Complex.prototype.toString = function() {
  if (this.re == 0) {
    return this.im + IMAG_LETTER;
  }
  if (this.im == 0) {
    return this.re + '';
  }
  return this.re + '+' + this.im + IMAG_LETTER;
}

/* Here follow some standard arithmetic functions for complex numbers */

Complex.prototype.add = function(that) {
  return new Complex(this.re + that.re, this.im + that.im);
}

Complex.prototype.mul = function(that) {
  return new Complex(this.re * that.re - this.im * that.im,
                     this.re * that.im + that.re * this.im);
}

Complex.prototype.sub = function(that) {
  return new Complex(this.re - that.re, this.im - that.im);
}

Complex.prototype.div = function(that) {
  let absSqr = that.re * that.re + that.im * that.im;
  return new Complex((this.re * that.re - this.im * -that.im) / absSqr,
                     (this.re * -that.im + that.re * this.im) / absSqr);
}

Complex.prototype.neg = function() {
  return new Complex(-this.re, -this.im);
}

Complex.prototype.conj = function() {
  return new Complex(this.re, -this.im);
}

Complex.prototype.abs = function() {
  return Math.sqrt(this.re * this.re + this.im * this.im);
}

Complex.prototype.arg = function() {
  return Math.atan2(this.im, this.re);
}

Complex.prototype.log = function() {
  return new Complex(Math.log(this.abs()), this.arg());
}

Complex.prototype.exp = function() {
  // TODO: is this really correct?
  return Complex.fromPolar(Math.exp(this.abs()), this.arg());
}

Complex.prototype.pow = function(that) {
  let abs = this.abs();
  let arg = this.arg();
  return Complex.fromPolar(Math.pow(abs, that.re) * Math.exp(-that.im * arg),
                           that.im * Math.log(abs) + that.re * arg);
}

/* Checks for exact equality. Watch out for floating-point problems. */
Complex.prototype.equals = function(that) {
  return this.re == that.re && this.im == that.im;
}

// mapping from symbol/token to method name
const BINARY_OPS = {
  '+': 'add',
  '-': 'sub',
  '*': 'mul',
  '/': 'div',
  '^': 'pow'
};
const UNARY_OPS = {
  'Log': 'log',
  'exp': 'exp',
  // TODO: trigonometric functions (and hyperbolic)
};

const EXPR_BINARY = 'binary';
const EXPR_UNARY = 'unary';
const EXPR_NAME = 'name';
const EXPR_VALUE = 'value';

function ComplexExpr(type) {
  this.type = type;
  switch (type) {
  case EXPR_VALUE:
    this.value = arguments[1];
    break;
  case EXPR_NAME:
    this.name = arguments[1];
    break;
  case EXPR_UNARY:
    this.op = arguments[1];
    this.target = arguments[2];
    break;
  case EXPR_BINARY:
    this.op = arguments[1];
    this.left = arguments[2];
    this.right = arguments[3];
    break;
  }
}

/* Evaluates a function of one variable.
 * Takes a name (String) and a Complex.
 * Returns a Complex.
 */
ComplexExpr.prototype.eval = function(name, value) {
  switch (this.type) {
  case EXPR_VALUE:
    return this.value;
  case EXPR_NAME:
    if (this.name != name) {
      throw 'Expression is not a function of one variable, found "' + this.name + '".'
    }
    return value;
  case EXPR_UNARY:
    let target = this.target.eval(name, value);
    return target[this.op]();
  case EXPR_BINARY:
    let left = this.left.eval(name, value);
    let right = this.right.eval(name, value);
    return left[this.op](right);
  }
}

// TODO: Create a function for replacing a EXPR_NAME with another arbitrary ComplexExpr

ComplexExpr.parse = function(txt) {
  let [e, rem] = ComplexExpr.parseSums(txt);
  if (!e || rem != '') {
    throw 'No parse on: ' + txt;
  }
  return e;
}

/* Parses a complex number or a name (as specified by NAME_REGEX).
 * Returns a list [expr, txt] of a ComplexExpr (or null) and the remaning text.
 */
ComplexExpr.parseValueOrName = function(txt) {
  // TODO: add parsing of parenthesised operations after figuring out how
  let [z, rem] = Complex.parseSingle(txt);
  if (z) {
    return [new ComplexExpr(EXPR_VALUE, z), rem];
  }
  let match = NAME_REGEX.exec(txt);
  if (match) {
    let name = match[0];
    return [new ComplexExpr(EXPR_NAME, name), txt.slice(name.length)];
  }
  return [null, txt];
}

/* TODO: describe this mess
 */
ComplexExpr.parseZeroOrMoreBinary = function(opSyms, parseHigherPrec, txt) {
  // parse left hand side
  let [left, rem] = parseHigherPrec(txt);
  if (!left) {
    return [null, txt];
  }
oneTerm:
  while (true) {
    let tst = rem.replace(/^\s+/, ''); // remove spaces before operator
    for (let i = 0; i < opSyms.length; i++) {
      let sym = opSyms[i];
      if (tst.startsWith(sym)) {
        rem = tst.slice(sym.length).replace(/^\s+/, ''); // remove operator and spaces after
        // parse right hand side
        let right = null;
        [right, rem] = parseHigherPrec(rem);
        if (!right) {
          return [null, txt];
        }
        left = new ComplexExpr(EXPR_BINARY, BINARY_OPS[sym], left, right);
        continue oneTerm;
      }
    }
    // no operator matched, return what we got so far
    return [left, rem];
  }
}

ComplexExpr.parsePower = function(txt) {
  // TODO: how should this really be handled? Precedence?
  return ComplexExpr.parseZeroOrMoreBinary(['^'], ComplexExpr.parseValueOrName, txt);
}

ComplexExpr.parseProducts = function(txt) {
  return ComplexExpr.parseZeroOrMoreBinary(['*', '/'], ComplexExpr.parsePower, txt);
}

ComplexExpr.parseSums = function(txt) {
  return ComplexExpr.parseZeroOrMoreBinary(['+', '-'], ComplexExpr.parseProducts, txt);
}
