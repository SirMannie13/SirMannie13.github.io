// worker.js (module)

function clamp01(x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }

function colorFire(t) {
  // Similar to "fire": r early, g mid, b late — inverted so inside is dark
  const r = 1 - clamp01(3 * t);
  const g = 1 - clamp01(3 * t - 1);
  const b = 1 - clamp01(3 * t - 2);
  return [Math.floor(r * 255), Math.floor(g * 255), Math.floor(b * 255), 255];
}

function colorGray(t) {
  const g = Math.floor((1 - clamp01(t)) * 255);
  return [g, g, g, 255];
}

function smoothIter(i, zr, zi) {
  // nu = i + 1 - log(log|z|)/log 2
  const mag = Math.sqrt(zr * zr + zi * zi);
  if (!isFinite(mag) || mag <= 0) return i;
  return i + 1 - (Math.log(Math.log(mag)) / Math.LN2);
}

function computePixel(kind, x0, y0, iters, jre, jim) {
  let zr, zi, cr, ci;

  if (kind === "Julia") {
    zr = x0; zi = y0;
    cr = jre; ci = jim;
  } else {
    zr = 0; zi = 0;
    cr = x0; ci = y0;
  }

  for (let i = 0; i < iters; i++) {
    let a = zr, b = zi;

    if (kind === "Burning Ship") {
      a = Math.abs(a);
      b = Math.abs(b);
    }

    let nzr, nzi;

    if (kind === "Tricorn") {
      // conj(z)^2 + c  => imag term is negative
      nzr = a * a - b * b + cr;
      nzi = -2 * a * b + ci;
    } else {
      nzr = a * a - b * b + cr;
      nzi = 2 * a * b + ci;
    }

    zr = nzr; zi = nzi;

    const mag2 = zr * zr + zi * zi;
    if (mag2 > 4) {
      const nu = smoothIter(i, zr, zi);
      return nu;
    }
  }

  return iters; // inside set
}

self.onmessage = (ev) => {
  const t0 = performance.now();

  const {
    token, w, h,
    kind, scheme,
    iters, zoom, cx, cy, jre, jim
  } = ev.data;

  const aspect = w / h;
  const spanX = 3.5 / zoom;
  const spanY = spanX / aspect;

  const buf = new ArrayBuffer(w * h * 4);
  const pixels = new Uint8ClampedArray(buf);

  const colorFn = scheme === "Gray" ? colorGray : colorFire;

  let idx = 0;
  for (let py = 0; py < h; py++) {
    const y0 = cy + ((py / h) - 0.5) * spanY;
    for (let px = 0; px < w; px++) {
      const x0 = cx + ((px / w) - 0.5) * spanX;

      const nu = computePixel(kind, x0, y0, iters, jre, jim);
      const t = clamp01(nu / iters);

      const [r, g, b, a] = colorFn(t);
      pixels[idx++] = r;
      pixels[idx++] = g;
      pixels[idx++] = b;
      pixels[idx++] = a;
    }
  }

  const ms = performance.now() - t0;
  self.postMessage({ token, w, h, buffer: buf, ms }, [buf]);
};
