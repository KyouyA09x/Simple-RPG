// GPU post-processing (Ultra): the 2D canvas frame is uploaded to a WebGL texture and a shader adds
// bloom, color grading, a vignette and a red damage pulse. Requests the high-performance (discrete) GPU.
const PostFX = (() => {
  const glc = document.getElementById('gl');
  let gl = null, tex, uni = {}, ok = null, gpuName = 'unknown';

  const VS = `attribute vec2 p; varying vec2 uv;
    void main(){ uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;
  const FS = `precision mediump float;
    uniform sampler2D t; uniform vec2 px; uniform float hurt, time, warm;
    varying vec2 uv;
    void main(){
      vec3 c = texture2D(t, uv).rgb;
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
      for (const n of ['px', 'hurt', 'time', 'warm']) uni[n] = gl.getUniformLocation(prog, n);
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

  function present(src, { hurt = 0, warm = 0 } = {}) {
    if (glc.width !== src.width || glc.height !== src.height) { glc.width = src.width; glc.height = src.height; }
    gl.viewport(0, 0, glc.width, glc.height);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.uniform2f(uni.px, 1 / src.width, 1 / src.height);
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
