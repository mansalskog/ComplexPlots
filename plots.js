function nonNegativeModulo(x, m) {
  return ((x % m) + m) % m;
}

function complexColor(z) {
  let light = nonNegativeModulo(Math.log(z.abs()) / Math.log(2), 1);
  let hue = nonNegativeModulo(z.arg() / (2 * Math.PI), 1);
  let r = light * Math.min(2 * hue, 1);
  let g = light * hue;
  let b = 0;
  return [r, g, b].map((c) => Math.floor(255 * c));
}

function drawComplexFunc(canvas, funcText, minR, minI, maxR, maxI) {
  let ctx = canvas.getContext('2d');
  let f = ComplexExpr.parse(funcText);
  console.log('Parsed', funcText, 'as f(z) =', f.toString());
  let img = ctx.createImageData(canvas.width, canvas.height);
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      let re = minR + (x / img.width) * (maxR - minR);
      let im = minI + (1 - y / img.height) * (maxI - minI);
      let z = new Complex(re, im);
      let w = f.eval('z', z);
      let idx = 4 * (y * img.width + x);
      let [r, g, b] = complexColor(w);
      img.data[idx + 0] = r;
      img.data[idx + 1] = g;
      img.data[idx + 2] = b;
      img.data[idx + 3] = 255; // alpha
    }
  }
  ctx.putImageData(img, 0, 0);
}

window.addEventListener('load', function() {
  let canvas = document.getElementById('canvas');
  canvas.height = Math.floor(window.innerHeight * 0.85);
  canvas.width = canvas.height;
  let funcInput = document.getElementById('function');
  let drawButton = document.getElementById('draw');

  let minReIn = document.getElementById('minRe');
  let maxReIn = document.getElementById('maxRe');
  let minImIn = document.getElementById('minIm');
  let maxImIn = document.getElementById('maxIm');

  let drawCallback = () => drawComplexFunc(canvas, funcInput.value,
                                                             parseFloat(minReIn.value), parseFloat(minImIn.value),
                                                             parseFloat(maxReIn.value), parseFloat(maxImIn.value));
  drawButton.addEventListener('click', drawCallback);
  funcInput.addEventListener('keyup', (e) => {
    if (e.key == 'Enter') {
      drawCallback();
    }
  });
  drawButton.click(); // draw default function on page load

  let funcSamples = document.getElementsByClassName('funcSample');
  for(let i = 0; i < funcSamples.length; i++) {
    funcSamples[i].addEventListener('click', function(e) {
      funcInput.value = e.target.textContent;
      drawCallback();
    });
  }
});
