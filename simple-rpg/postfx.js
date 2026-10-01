// GPU pass: the 2D canvas frame is uploaded to a WebGL texture and a shader draws it to the screen.
//  - Ultra ("fx"): bloom, colour grading, a vignette and a red damage pulse.
//  - Upscaler (any quality): when the game is rendered below the output resolution (Render scale < 100%) the frame is
//    enlarged with a bicubic (Catmull-Rom) filter and then sharpened with contrast-adaptive sharpening (CAS).
//    This is an FSR-style spatial upscaler written for this game, not AMD FSR itself, and not DLSS (which is impossible here).
// Requests the high-performance (discrete) GPU.
const PostFX = (() => {
  const glc = document.getElementById('gl');
  let gl = null, tex, uni = {}, ok = null, gpuName = 'unknown';

  const VS = `attribute vec2 p; varying vec2 uv;
    void main(){ uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;
  const FS = `#ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif
    uniform sampler2D t;
    uniform vec2 px;        // size of one OUTPUT pixel in uv units (effects keep the same size on screen at any render scale)
    uniform vec2 texSize;   // size of the rendered frame in pixels
    uniform float hurt, time, warm, fx, up, sharp;
    varying vec2 uv;

    // Catmull-Rom bicubic filtering in 9 bilinear taps
    vec3 bicubic(vec2 q) {
      vec2 pos = q * texSize, center = floor(pos - 0.5) + 0.5, f = pos - center, f2 = f * f, f3 = f2 * f;
      vec2 w0 = f2 - 0.5 * (f3 + f), w1 = 1.5 * f3 - 2.5 * f2 + 1.0, w3 = 0.5 * (f3 - f2), w2 = 1.0 - w0 - w1 - w3;
      vec2 w12 = w1 + w2;
      vec2 t0 = (center - 1.0) / texSize, t3 = (center + 2.0) / texSize, t12 = (center + w2 / w12) / texSize;
      vec3 c = texture2D(t, vec2(t0.x, t0.y)).rgb * (w0.x * w0.y) + texture2D(t, vec2(t12.x, t0.y)).rgb * (w12.x * w0.y) + texture2D(t, vec2(t3.x, t0.y)).rgb * (w3.x * w0.y)
             + texture2D(t, vec2(t0.x, t12.y)).rgb * (w0.x * w12.y) + texture2D(t, vec2(t12.x, t12.y)).rgb * (w12.x * w12.y) + texture2D(t, vec2(t3.x, t12.y)).rgb * (w3.x * w12.y)
             + texture2D(t, vec2(t0.x, t3.y)).rgb * (w0.x * w3.y) + texture2D(t, vec2(t12.x, t3.y)).rgb * (w12.x * w3.y) + texture2D(t, vec2(t3.x, t3.y)).rgb * (w3.x * w3.y);
      return max(c, vec3(0.0));
    }

    void main(){
      vec3 c;
      if (up > 0.5) {
        c = bicubic(uv);
        if (sharp > 0.0) {                       // contrast-adaptive sharpening (after AMD FidelityFX CAS)
          vec3 n = texture2D(t, uv + vec2(0.0, -px.y)).rgb, s = texture2D(t, uv + vec2(0.0, px.y)).rgb;
          vec3 w = texture2D(t, uv + vec2(-px.x, 0.0)).rgb, e = texture2D(t, uv + vec2(px.x, 0.0)).rgb;
          vec3 mn = min(min(min(w, c), min(e, n)), s), mx = max(max(max(w, c), max(e, n)), s);
          vec3 amp = sqrt(clamp(min(mn, 1.0 - mx) / max(mx, vec3(0.0001)), 0.0, 1.0));
          vec3 k = amp * (-1.0 / mix(8.0, 5.0, sharp));
          c = clamp((n * k + w * k + e * k + s * k + c) / (1.0 + 4.0 * k), 0.0, 1.0);
        }
      } else c = texture2D(t, uv).rgb;
      if (fx > 0.5) {
        // bloom: blur of the bright parts over a wide 5x5 kernel
        vec3 b = vec3(0.0);
        for (int i = -2; i <= 2; i++) for (int j = -2; j <= 2; j++) {
          vec3 s = texture2D(t, uv + vec2(float(i), float(j)) * px * 5.0).rgb;
          b += max(s - 0.78, 0.0) * (1.0 - 0.12 * float(i * i + j * j));
        }
        c += b * 0.14;
        // slight chromatic aberration toward the edges
        vec2 d = uv - 0.5;
        c.r = mix(c.r, texture2D(t, uv + d * px * 5.0).r, 0.5);
        c.b = mix(c.b, texture2D(t, uv - d * px * 5.0).b, 0.5);
        // color grade: contrast, saturation, biome warmth
        float l = dot(c, vec3(0.299, 0.587, 0.114));
        c = mix(vec3(l), c, 1.15);
        c = (c - 0.5) * 1.06 + 0.5;
        c *= vec3(1.0 + warm * 0.06, 1.0, 1.0 - warm * 0.06);
        // vignette + damage pulse
        float v = smoothstep(0.85, 0.3, length(d * vec2(1.0, 0.8)));
        c *= mix(0.55, 1.0, v);
        c = mix(c, vec3(0.8, 0.0, 0.0), hurt * (1.0 - v) * 0.6);
      }
      gl_FragColor = vec4(c, 1.0);
    }`;

  function init() {
    if (ok !== null) return ok;
    try {
      gl = glc.getContext('webgl', { powerPreference: 'high-performance', antialias: false, alpha: false, depth: false });
    } catch { gl = null; }
    if (!gl) return (ok = false);
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    gpuName = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    const sh = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    try {
      const prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
      gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog); gl.useProgram(prog);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'p');
      gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      for (const n of ['px', 'texSize', 'hurt', 'time', 'warm', 'fx', 'up', 'sharp']) uni[n] = gl.getUniformLocation(prog, n);
      tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      for (const p of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, p, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      ok = true;
    } catch (e) { console.warn('PostFX disabled:', e); ok = false; }
    return ok;
  }

  function setActive(on, src) {
    const active = on && init();
    glc.style.display = active ? 'block' : 'none';
    src.style.visibility = active ? 'hidden' : 'visible';
    return active;
  }

  // outW/outH: the size the picture is shown at (bigger than src when the game renders at a reduced scale)
  function present(src, { hurt = 0, warm = 0, fx = true, sharp = 0.6, outW = src.width, outH = src.height } = {}) {
    if (glc.width !== outW || glc.height !== outH) { glc.width = outW; glc.height = outH; }
    gl.viewport(0, 0, glc.width, glc.height);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.uniform2f(uni.px, 1 / outW, 1 / outH);
    gl.uniform2f(uni.texSize, src.width, src.height);
    gl.uniform1f(uni.fx, fx ? 1 : 0);
    gl.uniform1f(uni.up, outW > src.width * 1.02 ? 1 : 0);
    gl.uniform1f(uni.sharp, sharp);
    gl.uniform1f(uni.hurt, hurt);
    gl.uniform1f(uni.warm, warm);
    gl.uniform1f(uni.time, performance.now() / 1000);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function info() {
    // query the GPU even when Ultra is off, without keeping a context
    if (ok === null) {
      try {
        const g = document.createElement('canvas').getContext('webgl', { powerPreference: 'high-performance' });
        const dbg = g && g.getExtension('WEBGL_debug_renderer_info');
        if (g) gpuName = dbg ? g.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER);
        g?.getExtension('WEBGL_lose_context')?.loseContext();
      } catch {}
    }
    return gpuName;
  }

  return { setActive, present, info };
})();
