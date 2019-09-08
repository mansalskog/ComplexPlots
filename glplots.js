const vertexSource = `
attribute vec2 aPosition;

void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

function fragmentSource(glslExpr) {
    let source = `
precision mediump float;

#define PI 3.1415926535

// TODO remove these
#define add(z, w) (z + w)
#define sub(z, w) (z - w)
#define neg(z) (-z)

// these are neccesary
#define conj(z) vec2(z.x, -z.y)
#define mul(z, w) vec2(z.x * w.x - z.y * w.y, z.y * w.x + z.x * w.y)
#define div(z, w) vec2(z.x * w.x + z.y * w.y, z.y * w.x - z.x * w.y) / length(w) / length(w)
#define clog(z) vec2(log(length(z)), atan(z.y, z.x))
#define cexp(z) vec2(exp(z.x) * cos(z.y), exp(z.x) * sin(z.y))

vec2 cpow(vec2 z, vec2 w) {
  return cexp(mul(clog(z), w));
}

float fracPart(float x) {
  return x - floor(x);
}

vec4 colorOf(vec2 z) {
  float l = fracPart(log(length(z)) / log(2.0));
  float h = fracPart(atan(z.y, z.x) / (2.0 * PI));
  return vec4(l * min(2.0 * h, 1.0), l * h, 0.0, 1.0);
}

uniform vec2 uViewportSize;
uniform float uScale;
uniform vec2 uTranslation;

void main() {
  vec2 pos = (2.0 * gl_FragCoord.xy / uViewportSize - vec2(1.0)) * uScale;
  pos = ${glslExpr};
  gl_FragColor = colorOf(pos);
}
`;
    return source;
}


function drawPlot(canvas, text, minRe, minIm, maxRe, maxIm) {
    let t = performance.now();

    let expr = ComplexExpr.parse(text);
    let gl = canvas.getContext('webgl');

    let glslExpr = expr.toGLSL();
    console.log('parsed expression as', expr.toGLSL());

    let fs = fragmentSource(glslExpr);
    let program = buildProgram(gl, vertexSource, fs);
    if (!program) {
        return;
    }
    let posBuffer = createBuffers(gl);
    let aPosition = gl.getAttribLocation(program, 'aPosition');
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aPosition);
    let viewportSize = gl.getUniformLocation(program, 'uViewportSize');
    gl.uniform2f(viewportSize, canvas.height, canvas.width);
    let scale = gl.getUniformLocation(program, 'uScale');
    gl.uniform1f(scale, 3.0);
    let translation = gl.getUniformLocation(program, 'uTranslation');
    gl.uniform2f(translation, 0.0, 0.0);

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    console.log('drew function in', performance.now() - t, 'ms');
}

function createBuffers(gl) {
    let corners = [
        -1.0, -1.0,
        -1.0, 1.0,
        1.0, -1.0,
        1.0, 1.0,
        -1.0, 1.0,
        1.0, -1.0,
    ];
    let posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(corners), gl.STATIC_DRAW);
    return posBuffer;
}

function buildProgram(gl, vSource, fSource) {
    let program = gl.createProgram();
    let vShader = buildShader(gl, gl.VERTEX_SHADER, vSource);
    let fShader = buildShader(gl, gl.FRAGMENT_SHADER, fSource);
    if (!vShader || !fShader) {
        return;
    }
    gl.attachShader(program, vShader);
    gl.attachShader(program, fShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program link error:', gl.getProgramInfoLog(program));
        return null;
    }
    gl.useProgram(program);
    // clean up shaders
    gl.detachShader(program, vShader);
    gl.detachShader(program, fShader);
    gl.deleteShader(vShader);
    gl.deleteShader(fShader);
    return program;
}

function buildShader(gl, type, source) {
    let shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

function onLoad() {
    let canvas = document.getElementById('canvas');
    canvas.height = Math.floor(window.innerHeight * 0.80);
    canvas.width = canvas.height;
    let funcInput = document.getElementById('function');
    let drawButton = document.getElementById('draw');

    let minReIn = document.getElementById('minRe');
    let maxReIn = document.getElementById('maxRe');
    let minImIn = document.getElementById('minIm');
    let maxImIn = document.getElementById('maxIm');

    let drawCallback = () => drawPlot(canvas, funcInput.value,
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

    let allLims = document.getElementById('allLims');
    allLims.addEventListener('input', function() {
        if (parseFloat(allLims.value) >= 0) {
            maxReIn.value = maxImIn.value = allLims.value;
            minReIn.value = minImIn.value = -allLims.value;
        }
    });
}
window.addEventListener('load', onLoad);
