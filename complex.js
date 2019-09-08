function Complex(re, im) {
  this.re = re;
  this.im = im;
}

Complex.fromPolar = function(abs, arg) {
  return new Complex(abs * Math.cos(arg), abs * Math.sin(arg));
};

/* Reads a complex number from a string. Not for use with ComplexExpr.
 */
Complex.fromString = function(txt) {
  const NUM_REGEX = '-?\\d+(\\.\\d+)?';
  const RE_REGEX = new RegExp('^' + NUM_REGEX);
  const IM_REGEX = new RegExp('^' + NUM_REGEX + 'i');
  const CPX_REGEX = new RegExp('^' + NUM_REGEX + '\\s*\\+\\s*' + NUM_REGEX + 'i');
  if (CPX_REGEX.test(txt)) {
    let [re, im] = txt.split('+', 2);
    // note that parseFloat ignores the trailing 'i'
    return new Complex(Number.parseFloat(re), Number.parseFloat(im));
  } else if (IM_REGEX.test(txt)) {
    return new Complex(0, Number.parseFloat(txt));
  } else if (RE_REGEX.test(txt)) {
    return new Complex(Number.parseFloat(txt), 0);
  }
  throw 'Could not parse complex number: ' + txt;
};

/* Returns a human- and machine-readable text representation of the number.
 */
Complex.prototype.toString = function() {
  if (this.re == 0) {
    return this.im + 'i';
  }
  if (this.im == 0) {
    return this.re + '';
  }
  return this.re + '+' + this.im + 'i';
};

/* Checks for exact equality. Watch out for floating-point problems. */
Complex.prototype.equals = function(that) {
  return this.re == that.re && this.im == that.im;
};

/* Here follow some standard arithmetic functions for complex numbers */

Complex.prototype.add = function(that) {
  return new Complex(this.re + that.re, this.im + that.im);
};

Complex.prototype.mul = function(that) {
  return new Complex(this.re * that.re - this.im * that.im,
                     this.re * that.im + that.re * this.im);
};

Complex.prototype.sub = function(that) {
  return new Complex(this.re - that.re, this.im - that.im);
};

Complex.prototype.div = function(that) {
  let absSqr = that.re * that.re + that.im * that.im;
  return new Complex((this.re * that.re - this.im * -that.im) / absSqr,
                     (this.re * -that.im + that.re * this.im) / absSqr);
};

Complex.prototype.neg = function() {
  return new Complex(-this.re, -this.im);
};

Complex.prototype.conj = function() {
  return new Complex(this.re, -this.im);
};

Complex.prototype.abs = function() {
  return Math.sqrt(this.re * this.re + this.im * this.im);
};

Complex.prototype.arg = function() {
  return Math.atan2(this.im, this.re);
};

Complex.prototype.log = function() {
  return new Complex(Math.log(this.abs()), this.arg());
};

Complex.prototype.exp = function() {
  // TODO: is this really correct?
  return Complex.fromPolar(Math.exp(this.re), this.im);
};

Complex.prototype.pow = function(that) {
  return that.mul(this.log()).exp();
};

Complex.prototype.sin = function() {
  let i = new Complex(0, 1);
  return this.mul(i).exp().sub(this.mul(i.neg()).exp()).div(new Complex(0, 2));
}

// mapping from symbol/token to method name
const BINARY_OPS = {
    // TODO use regular plus and minus in glsl...
    '+': 'add',
    '-': 'sub',
    '*': 'c_mul',
    '/': 'c_div',
    '^': 'c_pow'
};
const UNARY_OPS = {
    '-': 'neg',
    'Log': 'c_log',
    'exp': 'c_exp',
    'sin': 'c_sin',
    'cos': 'c_cos',
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
    this.opSym = arguments[1];
    this.target = arguments[2];
    break;
  case EXPR_BINARY:
    this.opSym = arguments[1];
    this.left = arguments[2];
    this.right = arguments[3];
    break;
  }
}

ComplexExpr.prototype.toString = function() {
    switch (this.type) {
    case EXPR_VALUE:
        return '(' + this.value[0] + '+' + this.value[1] + 'i)';
    case EXPR_NAME:
        return this.name;
    case EXPR_UNARY:
        // no parenthesis because unary have (second) highest precendence
        return this.opSym + ' ' + this.target.toString();
    case EXPR_BINARY:
        // parenthezised to guarantee correct parsing
        return '(' + this.left.toString() + ' ' + this.opSym + ' ' + this.right.toString() + ')';
    }
};

const GLSL_DIGITS = 8; // 2 for testing, set to 8 for exact numbers

ComplexExpr.prototype.toGLSL = function() {
    switch (this.type) {
    case EXPR_VALUE:
        return 'vec2(' + this.value[0].toFixed(GLSL_DIGITS) + ',' + this.value[1].toFixed(GLSL_DIGITS) + ')';
    case EXPR_NAME:
        return 'z';
    case EXPR_UNARY:
        let target = this.target.toGLSL();
        if (this.opSym == '-') {
            return '(-' + target + ')';
        } else {
            let unMethod = UNARY_OPS[this.opSym];
            return unMethod + '(' + target + ')';
        }
    case EXPR_BINARY:
        let left = this.left.toGLSL();
        let right = this.right.toGLSL();
        // TODO make this less ugly
        if (this.opSym == '+') {
            return '(' + left + '+' + right + ')';
        } else if (this.opSym == '-') {
            return '(' + left + '-' + right + ')';
        } else {
            let binMethod = BINARY_OPS[this.opSym];
            return binMethod + '(' + left + ',' + right + ')';
        }
    }
}

ComplexExpr.sum = function(f, start, end) {
    let e = f(start);
    for (let k = start + 1; k <= end; k++) {
        e = new ComplexExpr(EXPR_BINARY, '+', e, f(k));
    }
    return e;
}

/* Here follows a simple (probably quite buggy) parser for complex expressions. */

ComplexExpr.parse = function(txt) {
  let [e, rem] = ComplexExpr.parseSums(txt);
  if (!e || rem != '') {
    throw 'No parse on: ' + txt;
  }
  return e;
};

/* Parses a real or imaginary number. For use with ComplexExpr. Returns null on leading spaces.
 * Returns an array [z, txt], containing the number (or null) and the remaning text.
 */
ComplexExpr.parseSingle = function(txt) {
    if (txt.startsWith('i')) {
        return [[0, 1], txt.slice(1)];
    }
    let match = /^\d+(\.\d+)?i/.exec(txt);
    if (match) {
        let im = match[0];
        return [[0, Number.parseFloat(im)], txt.slice(im.length)];
    }
    match = /^\d+(\.\d+)?/.exec(txt);
    if (match) {
        let re = match[0];
        return [[Number.parseFloat(re), 0], txt.slice(re.length)];
    }
    return [null, txt];
};


/* Parses a complex number or a name (as specified by NAME_REGEX).
 * Returns a list [expr, txt] of a ComplexExpr (or null) and the remaning text.
 */
ComplexExpr.parseValueOrName = function(txt) {
  let tst = txt.replace(/^\s+/, '');
  let [z, rem] = ComplexExpr.parseSingle(tst);
  if (z) {
    return [new ComplexExpr(EXPR_VALUE, z), rem];
  }
  let match = /^[a-hj-z]/.exec(tst); // a single letter that is not "i"
  if (match) {
    let name = match[0];
    return [new ComplexExpr(EXPR_NAME, name), tst.slice(name.length)];
  }
  return [null, txt];
};

/* Parses a number of unary operators followed by a valueOrName
 * Example: op op value => (op (op value))
 */
ComplexExpr.parseZeroOrMoreUnary = function(opSyms, parseHigherPrec) {
  return function(txt) {
    let ops = [];
    let rem = txt;
    oneOp: while (true) {
      let tst = rem.replace(/^\s+/, '');
      for (let i = 0; i < opSyms.length; i++) {
        let sym = opSyms[i];
        if (tst.startsWith(sym)) {
          rem = tst.slice(sym.length).replace(/^\s+/, '');
          ops.push(sym);
          continue oneOp;
        }
      }
      break;
    }
    let val = null;
    [val, rem] = parseHigherPrec(rem);
    if (!val) {
      return [null, rem];
    }
    if (ops.length == 0) {
      return [val, rem];
    }
    let expr = ops.reduceRight((acc, sym) => new ComplexExpr(EXPR_UNARY, sym, acc), val);
    return [expr, rem];
  };
};

/* TODO: describe this mess
 * Return a parser that parses a list of binary operator expressions
 * Example: parses an expression like "hp op hp op hp" and produces a parse tree like ((hp op hp) op hp),
 *          where hp is a string matching parseHigherPrec and op is one of the strings in opSyms
 */
ComplexExpr.parseZeroOrMoreBinary = function(opSyms, parseHigherPrec) {
  return function(txt) {
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
          left = new ComplexExpr(EXPR_BINARY, sym, left, right);
          continue oneTerm;
        }
      }
      // no operator matched, return what we got so far
      return [left, rem];
    }
  };
};

ComplexExpr.parseMaybeParenthesis = function(parseNoParen, parseInParen) {
  return function(txt) {
    let tst = txt.replace(/^\s+/, ''); // TODO: make a function called removeLeadingSpaces or something
    if (!tst.startsWith('(')) {
      return parseNoParen(txt);
    }
    tst = tst.slice(1);
    let [inside, rem] = parseInParen(tst);
    rem = rem.replace(/^\s+/, '');
    if (!rem.startsWith(')')) {
      // missing close parenthesis
      return [null, rem];
    }
    rem = rem.slice(1);
    return [inside, rem];
  }
};

// this is needed to solve the chicken-and-egg-problem caused below
function hackyThing(txt) {
  return ComplexExpr.parseSums(txt);
}
let parseParen = ComplexExpr.parseMaybeParenthesis(ComplexExpr.parseValueOrName, hackyThing); // this depends on parseSums, but parseSums depends on parseTerm
let parseTerm = ComplexExpr.parseZeroOrMoreUnary(['-', 'exp', 'Log', 'sin'], parseParen);

ComplexExpr.parsePower = ComplexExpr.parseZeroOrMoreBinary(['^'], parseTerm);
// TODO: create a function to parse right-associative exponents, as this is currently wrong

ComplexExpr.parseProducts = ComplexExpr.parseZeroOrMoreBinary(['*', '/'], ComplexExpr.parsePower);

ComplexExpr.parseSums = ComplexExpr.parseZeroOrMoreBinary(['+', '-'], ComplexExpr.parseProducts);
