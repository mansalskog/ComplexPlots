function testComplex() {
  let z = new Complex(Math.random(), Math.random());
  let alsoZ = Complex.fromString(z.toString());
  if (!z.equals(alsoZ)) {
    console.error('Complex number string round-trip failed on', z, alsoZ);
  }
}

/* Returns a random element from the list
 */
function randomElement(list) {
  return list[Math.floor(Math.random() * list.length)];
}

/* Generates a "simple" expression, i.e. an expression with no parenthesized parts
 */
function generateSimpleExpr() {
  let tokens = [];
  do {
    let unary = randomElement([null, '-', 'exp', 'Log']);
    let binary = randomElement(['+', '-', '*', '/']);
    if (unary) {
      tokens.push(unary);
    }
    tokens.push('z');
    tokens.push(binary);
  } while (Math.random() > 0.3);
  return tokens.slice(0, -1).join(' ') // remove last binary operator and join with spaces
}

function testComplexExpr() {
  // TODO: maybe make a more complicated testing function?
  let expr = generateSimpleExpr();
  let alsoExpr = ComplexExpr.parse(expr).toString().replace(/[\(\)]/g, '');
  if (expr != alsoExpr) {
    console.error('Complex expression failed string round-trip: "' + expr + '" vs "' + alsoExpr + '"');
  }
}

window.addEventListener('load', () => {
  testComplex();
  testComplexExpr();
});
