function testComplex() {
  let z = new Complex(Math.random(), Math.random());
  let alsoZ = Complex.fromString(z.toString());
  if (!z.equals(alsoZ)) {
    console.error('Complex number string round-trip failed on', z, alsoZ);
  }
  return null; // all good
}


window.addEventListener('load', () => {
  testComplex();
});
