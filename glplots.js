const vertexSource = `
attribute vec2 aPosition;

void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

function fragmentSource(expr) {
    let source = `
precision mediump float;

#define PI 3.1415926535

// TODO remove these
#define add(z, w) (z + w)
#define sub(z, w) (z - w)
#define neg(z) (-z)

// these are neccesary
#define c_mul(z, w) vec2((z).x * (w).x - (z).y * (w).y, (z).y * (w).x + (z).x * (w).y)
#define c_div(z, w) (vec2((z).x * (w).x + (z).y * (w).y, (z).y * (w).x - (z).x * (w).y) / length(w) / length(w))
#define c_log(z) vec2(log(length(z)), atan((z).y, (z).x))
#define c_exp(z) vec2(exp((z).x) * cos((z).y), exp((z).x) * sin((z).y))

vec2 c_pow(vec2 z, vec2 w) {
  return c_exp(c_mul(c_log(z), w));
}
vec2 c_sin(vec2 z) {
  return c_div(c_exp(vec2(-z.y, z.x)) - c_exp(vec2(z.y, -z.x)), vec2(0.0, 2.0));
}
vec2 c_cos(vec2 z) {
  return (c_exp(vec2(-z.y, z.x)) - c_exp(vec2(z.y, -z.x))) / 2.0;
}

#define fracPart(x) (x - floor(x))

vec4 colorOf(vec2 z) {
  float l = fracPart(log(length(z)) / log(2.0));
  float h = fracPart(atan(z.y, z.x) / (2.0 * PI));
  return vec4(l * min(2.0 * h, 1.0), l * h, 0.0, 1.0);
}

uniform vec2 uViewportSize;
uniform float uScale;
uniform vec2 uTranslation;

void main() {
  vec2 z = (2.0 * gl_FragCoord.xy / uViewportSize - vec2(1.0)) * uScale - uTranslation / uViewportSize;
  vec2 w = ${expr};
  gl_FragColor = colorOf(w);
}
`;
    return source;
}

function Renderer(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl');
    this.program = null;
    this.vShader = null;
    this.fShader = null;
    this.arrayBuffer = null;

    this.setExpr('z');
    this.setScale(1.0);
    this.setTranslation(0.0, 0.0);
}

Renderer.prototype.clearProgram = function() {
    this.gl.deleteBuffer(this.arrayBuffer);
    this.arrayBuffer = null;
    this.gl.detachShader(this.program, this.vShader);
    this.gl.deleteShader(this.vShader);
    this.vShader = null;
    this.gl.detachShader(this.program, this.fShader);
    this.gl.deleteShader(this.fShader);
    this.fShader = null;
    this.gl.deleteProgram(this.program);
    this.program = null;
}

Renderer.prototype.createBuffer = function() {
    let corners = [
        -1.0, -1.0,
        -1.0, 1.0,
        1.0, -1.0,
        1.0, 1.0,
        -1.0, 1.0,
        1.0, -1.0,
    ];
    this.arrayBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.arrayBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(corners), this.gl.STATIC_DRAW);
}

Renderer.prototype.buildShader = function(type, source) {
    let shader = this.gl.createShader(type);
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', this.gl.getShaderInfoLog(shader));
        this.gl.deleteShader(shader);
        return null;
    }
    return shader;
}

Renderer.prototype.buildProgram = function(vSource, fSource) {
    if (this.program) {
        this.clearProgram();
    }
    this.program = this.gl.createProgram();
    this.vShader = this.buildShader(this.gl.VERTEX_SHADER, vSource);
    this.fShader = this.buildShader(this.gl.FRAGMENT_SHADER, fSource);
    if (!this.vShader || !this.fShader) {
        return;
    }
    this.gl.attachShader(this.program, this.vShader);
    this.gl.attachShader(this.program, this.fShader);
    this.gl.linkProgram(this.program);
    if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
        console.error('Program link error:', this.gl.getProgramInfoLog(program));
        return;
    }
    this.gl.useProgram(this.program);
    this.createBuffer();
}

Renderer.prototype.setExpr = function(expr) {
    this.buildProgram(vertexSource, fragmentSource(expr));
}

Renderer.prototype.setScale = function(scale) {
    if (!this.program) {
        console.error('no program');
    }
    let uScale = this.gl.getUniformLocation(this.program, 'uScale');
    this.gl.uniform1f(uScale, scale);
}

Renderer.prototype.setTranslation = function(tx, ty) {
    if (!this.program) {
        console.error('no program');
    }
    let uTranslation = this.gl.getUniformLocation(this.program, 'uTranslation');
    this.gl.uniform2f(uTranslation, tx, ty);
}

Renderer.prototype.draw = function() {
    if (!this.program) {
        console.error('no program');
        return;
    }

    let aPosition = this.gl.getAttribLocation(this.program, 'aPosition');
    this.gl.vertexAttribPointer(aPosition, 2, this.gl.FLOAT, false, 0, 0);
    this.gl.enableVertexAttribArray(aPosition);
    let viewportSize = this.gl.getUniformLocation(this.program, 'uViewportSize');
    this.gl.uniform2f(viewportSize, this.canvas.height, this.canvas.width);

    // this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
    // this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
}

function onLoad() {
    let canvas = document.getElementById('canvas');
    canvas.height = Math.floor(window.innerHeight * 0.80);
    canvas.width = canvas.height;
    let funcInput = document.getElementById('function');
    let drawButton = document.getElementById('draw');
    let infoText = document.getElementById('infoText');

    let renderer = new Renderer(canvas);
    let scale = 3.0;
    let tx = 0;
    let ty = 0;
    let drag = false;

    let drawCallback = () => {
        renderer.setScale(scale);
        renderer.setTranslation(tx, ty);
        renderer.draw();
        infoText.textContent = 'Plot width: ' + scale.toFixed(2) + ', Center: ' + (tx / canvas.width).toFixed(2) + ' + ' + (ty / canvas.height).toFixed(2) + 'i';
    };

    canvas.addEventListener('wheel', e => {
        e.preventDefault();
        if (e.deltaY > 0) {
            scale *= 0.9;
        } else if (e.deltaY < 0) {
            scale *= 1.2;
        }
        drawCallback();
    });
    canvas.addEventListener('mousedown', e => {
        if (e.button == 0) {
            drag = true;
        }
    });
    canvas.addEventListener('mouseup', e => {
        if (e.button == 0) {
            drag = false;
        }
    });
    canvas.addEventListener('mouseleave', e => {
        drag = false;
    });
    canvas.addEventListener('mousemove', e => {
        if (drag) {
            tx += e.movementX * scale;
            ty -= e.movementY * scale;
            drawCallback();
        }
    });

    let changeExpr = () => {
        let expr = ComplexExpr.parse(funcInput.value).toGLSL();
        renderer.setExpr(expr);
        scale = 3.0;
        tx = ty = 0;
        drawCallback();
    };
    drawButton.addEventListener('click', changeExpr);
    changeExpr();

    let funcSamples = document.getElementsByClassName('funcSample');
    for(let i = 0; i < funcSamples.length; i++) {
        funcSamples[i].addEventListener('click', function(e) {
            funcInput.value = e.target.textContent;
            changeExpr();
        });
    }

}
window.addEventListener('load', onLoad);
