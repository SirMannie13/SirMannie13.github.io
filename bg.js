(() => {
  const canvas = document.getElementById("fractal-bg");
  if (!canvas) return;

  const gl =
    canvas.getContext("webgl", { antialias: false, preserveDrawingBuffer: false }) ||
    canvas.getContext("experimental-webgl");

  if (!gl) {
    console.warn("WebGL not supported; background disabled.");
    return;
  }

  const start = performance.now();

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1);
    const scale = 0.75; // 0.65 faster, 0.85 sharper
    canvas.width = Math.floor(window.innerWidth * dpr * scale);
    canvas.height = Math.floor(window.innerHeight * dpr * scale);
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  window.addEventListener("resize", resize);
  resize();

  const vertSrc = `
    attribute vec2 a_pos;
    varying vec2 v_uv;
    void main() {
      v_uv = a_pos * 0.5 + 0.5;
      gl_Position = vec4(a_pos, 0.0, 1.0);
    }
  `;

  const fragSrc = `
    precision highp float;

    varying vec2 v_uv;
    uniform vec2 u_res;
    uniform float u_time;

    vec3 palette(float t) {
      float x = fract(t);
      vec3 blue   = vec3(0.10, 0.45, 1.00);
      vec3 green  = vec3(0.10, 0.95, 0.55);
      vec3 yellow = vec3(1.00, 0.95, 0.20);

      vec3 c1 = mix(blue,  green,  smoothstep(0.0, 1.0, x * 3.0));
      vec3 c2 = mix(green, yellow, smoothstep(0.0, 1.0, (x - 1.0/3.0) * 3.0));
      vec3 c3 = mix(yellow, blue,  smoothstep(0.0, 1.0, (x - 2.0/3.0) * 3.0));

      return (x < 1.0/3.0) ? c1 : (x < 2.0/3.0) ? c2 : c3;
    }

    vec2 clifford(vec2 p, float a, float b, float c, float d) {
      return vec2(
        sin(a * p.y) + c * cos(a * p.x),
        sin(b * p.x) + d * cos(b * p.y)
      );
    }

    void main() {
      vec2 uv = (v_uv - 0.5) * 2.0;
      uv.x *= u_res.x / u_res.y;

      vec2 p = uv * 1.15;

      float tt = u_time * 0.18;
      float a = 1.60 + 0.20 * sin(tt * 0.9);
      float b = 1.80 + 0.20 * cos(tt * 0.7);
      float c = 0.90 + 0.15 * sin(tt * 1.3);
      float d = 0.70 + 0.15 * cos(tt * 1.1);

      float glow = 0.0;
      float trap = 1e9;

      const int ITERS = 4;
      for (int i = 0; i < ITERS; i++) {
        p = clifford(p, a, b, c, d);
        float dTrap = min(abs(p.x), abs(p.y));
        trap = min(trap, dTrap);
        glow += exp(-1.25 * dot(p, p));
      }

      float lines = exp(-12.0 * trap);
      float dens  = glow / float(ITERS);

      float hue = u_time * 0.08;
      vec3 col = palette(hue + dens * 0.9);

      col *= (0.25 + 1.20 * dens);
      col += col * (1.35 * lines);

      float v = smoothstep(1.8, 0.25, length(uv));
      col *= (0.55 + 0.45 * v);

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  function compile(type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const err = gl.getShaderInfoLog(sh);
      gl.deleteShader(sh);
      throw new Error(err);
    }
    return sh;
  }

  function createProgram(vsSrc, fsSrc) {
    const vs = compile(gl.VERTEX_SHADER, vsSrc);
    const fs = compile(gl.FRAGMENT_SHADER, fsSrc);
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      const err = gl.getProgramInfoLog(prog);
      gl.deleteProgram(prog);
      throw new Error(err);
    }
    return prog;
  }

  let program;
  try {
    program = createProgram(vertSrc, fragSrc);
  } catch (e) {
    console.error("Shader compile/link error:", e);
    return;
  }

  gl.useProgram(program);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1,-1,  1,-1, -1, 1,  -1, 1,  1,-1,  1, 1]),
    gl.STATIC_DRAW
  );

  const aPos = gl.getAttribLocation(program, "a_pos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(program, "u_res");
  const uTime = gl.getUniformLocation(program, "u_time");

  function frame(now) {
    const t = (now - start) / 1000.0;

    if (uRes) gl.uniform2f(uRes, canvas.width, canvas.height);
    if (uTime) gl.uniform1f(uTime, t);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();
