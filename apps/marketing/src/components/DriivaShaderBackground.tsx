import { useEffect, useRef } from 'react';

/**
 * DriivaShaderBackground
 * ----------------------
 * Full-viewport animated mesh-gradient wallpaper for the marketing site.
 * Brand palette (amber → burnt → violet → indigo) arranged on an S-curve with
 * floating twinkling orbs, reacting in real time to mouse, scroll and click.
 *
 * Ported from the design handoff. Only the production "mesh" mode is kept; the
 * four exploratory modes (aurora / chrome / gravity / bloom) were dropped per
 * the handoff. Sits at z-index -1 behind all content and is purely visual
 * (pointer-events: none) — clicks are read off `window`, so the canvas never
 * intercepts UI input. Falls back to solid ink without WebGL, and respects
 * prefers-reduced-motion (animation at 30% speed, click ripples disabled).
 */

const VERT = `attribute vec2 aPos; void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`;

// Mesh-gradient fragment shader. The meshBlend body is the approved source of
// truth from the handoff (shader.js); only the multi-mode dispatch was removed.
const FRAG = `precision highp float;

uniform vec2  uRes;
uniform float uTime;
uniform vec2  uMouse;
uniform float uScroll;
uniform float uPulse;
uniform vec2  uPulsePos;

/* Driiva palette (linear-ish; gentle gamma applied at the end). The four brand
 * stops are canonical and must not be retuned here; C_PLUM is the ink the
 * stops are darkened against and C_BLOOM is sampled straight out of the
 * bottom-right corner of the reference wash. */
const vec3 C_AMBER  = vec3(0.835, 0.521, 0.040); // #d4850a
const vec3 C_BURNT  = vec3(0.627, 0.298, 0.165); // #a04c2a
const vec3 C_VIOLET = vec3(0.420, 0.247, 0.627); // #6b3fa0
const vec3 C_INDIGO = vec3(0.231, 0.176, 0.545); // #3b2d8b
const vec3 C_PLUM   = vec3(0.102, 0.059, 0.122); // #1a0f1f
const vec3 C_BLOOM  = vec3(0.357, 0.137, 0.176); // #5b232d, corner of the wash

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash(i),         hash(i+vec2(1,0)), u.x),
             mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i=0;i<5;i++){ v += a*vnoise(p); p = p*2.02 + 17.3; a *= 0.5; }
  return v;
}

/* The wash is the brand stops SATURATED and DEEPENED, not blended toward each
 * other. Sampling the reference makes this unambiguous: its middle is
 * #5d140b, whose blue channel is 11/255, while any burnt-to-violet blend puts
 * blue near 100. Pushing a stop away from its own grey and then darkening it
 * reproduces the wash while keeping the four canonical stops as the only
 * source of hue. */
vec3 deepen(vec3 c, float sat, float dark){
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  return max(mix(vec3(l), c, sat), 0.0) * dark;
}

/* The canonical Driiva wash, animated.
 *
 * design-system/assets/gradient-background.png is the source of truth. Sampled
 * on a 9x9 grid it is a HORIZONTAL progression and barely varies vertically:
 * amber #92490a hard against the left edge, rust #5d140b, deep maroon #470c1a
 * through the middle, indigo #23124a on the right, plus one warm plum bloom
 * #5b232d in the bottom-right corner. There are no orbs, no sparkles and no
 * cursor-coloured blob in the reference, so there are none here.
 *
 * The composition is therefore driven by x, and the motion is the band
 * boundaries breathing against each other rather than stops wandering the
 * frame. A stop that travels far enough to leave its side of the picture
 * stops being this wash, which is the thing that has to survive the animation. */
vec3 meshBlend(vec2 uv){
  float t  = uTime * 0.16;
  float drift = uTime * 0.020;
  float mx = (uMouse.x - 0.5);
  float s  = uScroll;

  /* Band centres along x, placed on the sampled positions. Each breathes on
   * its own long-period sine at rates sharing no common multiple, so the
   * boundaries never resynchronise into a visible loop, but the amplitudes are
   * small enough that amber stays a left-edge colour and indigo a right-edge
   * one at every point in the cycle. */
  /* The outer two sit off-screen. With the amber peak at x=0 exactly, half its
   * falloff is outside the viewport and the left edge only ever shows the
   * shoulder of the band, which reads far weaker than the reference. */
  float b0 = -0.08 + 0.030*sin(drift*0.61);
  float b1 =  0.22 + 0.042*sin(drift*0.43 + 1.7);
  float b2 =  0.48 + 0.048*sin(drift*0.29 + 3.1);
  float b3 =  0.74 + 0.042*sin(drift*0.37 + 4.6);
  float b4 =  1.08 + 0.030*sin(drift*0.23 + 5.8);

  /* Pointer and scroll lean the whole ladder rather than moving one stop, so
   * the field answers the reader without the composition sliding off. */
  float shift = mx*0.030 + s*0.045;
  b0 += shift*0.3; b1 += shift*0.6; b2 += shift; b3 += shift*0.8; b4 += shift*0.4;

  /* A slight lean and a slow wave so the bands are not dead-straight columns. */
  float x = uv.x + (uv.y - 0.5)*0.055 + 0.022*sin(t*0.5 + uv.y*2.3);

  /* Each band is one canonical stop, saturated and deepened onto its sampled
   * value in the reference. The ladder runs warm to cool exactly as the brand
   * gradient does; only the depth changes across it. */
  /* The amber edge is the only part of the wash bright enough to threaten text
   * contrast, and it was rendering slightly brighter than the reference, so
   * pulling it down serves the match and the legibility at the same time. */
  vec3 cAmber  = deepen(C_AMBER,  1.80, 0.92);            // #92490a
  vec3 cRust   = deepen(C_BURNT,  2.15, 0.92);            // #5d140b
  vec3 cMaroon = deepen(mix(C_BURNT, C_VIOLET, 0.30), 2.00, 0.62); // #470c1a
  vec3 cViolet = deepen(mix(C_VIOLET, C_INDIGO, 0.62), 1.52, 0.74); // #241046
  vec3 cIndigo = deepen(C_INDIGO, 1.34, 0.84 - s*0.08);   // #2b1547

  /* Band softness. Wide relative to the 0.24 spacing, so neighbouring bands
   * overlap heavily and no boundary can read as an edge. */
  const float sd = 0.21;
  float w0 = exp(-pow((x-b0)/sd, 2.0));
  float w1 = exp(-pow((x-b1)/sd, 2.0));
  float w2 = exp(-pow((x-b2)/sd, 2.0));
  float w3 = exp(-pow((x-b3)/sd, 2.0));
  float w4 = exp(-pow((x-b4)/sd, 2.0));

  /* Warp the weights so the boundaries are not mathematically clean. */
  float n = fbm(vec2(uv.x*2.2, uv.y*1.5) + uTime*0.03);
  float warp = (n - 0.5) * 0.10;
  w0 *= 1.0 + warp;        w1 *= 1.0 - warp;
  w2 *= 1.0 + warp*0.6;    w3 *= 1.0 - warp;
  w4 *= 1.0 + warp*0.4;

  float wsum = w0+w1+w2+w3+w4 + 1e-4;
  vec3 col = (cAmber*w0 + cRust*w1 + cMaroon*w2 + cViolet*w3 + cIndigo*w4) / wsum;

  /* The plum bloom in the bottom-right corner, the one genuinely 2-D feature
   * of the source wash. */
  vec2 bloomC = vec2(1.04 + 0.020*sin(drift*0.31), 1.00 + 0.020*cos(drift*0.27));
  float bloomD = distance(vec2(uv.x, (uv.y - 1.0)*0.85 + 1.0), bloomC);
  float bloom = exp(-pow(bloomD/0.54, 2.0));
  col = mix(col, C_BLOOM, bloom*0.42);

  /* The reference lifts slightly at the top and bottom of the amber edge and
   * carries no strong vignette, so this is a gentle shaping pass only. */
  float edgeLift = (1.0 - smoothstep(0.0, 0.34, uv.x)) * pow(abs(uv.y - 0.5)*2.0, 2.0);
  col *= 1.0 + edgeLift*0.10;

  vec2 q = uv - 0.5;
  col *= mix(0.92, 1.02, 1.0 - dot(q,q)*0.70);

  /* Click ripple, kept because it is an interaction rather than a colour, and
   * tinted amber so it stays inside the wash. */
  float clickD = distance(uv, uPulsePos);
  float ripple = uPulse * exp(-clickD*4.0) * sin(clickD*22.0 - uTime*8.0);
  col += ripple * 0.05 * C_AMBER;

  /* Previously 0.88 here and 0.84 again in main(), so the brand stops were
   * mixed at full strength and then cut to 74% before they ever reached a
   * pixel. That is what made a moving field read as a flat wash. The dimming
   * now happens once, in main(), against the text-contrast floor. */
  col  = pow(max(col, 0.0), vec3(1.06));

  return col;
}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes.xy;
  vec3 col = meshBlend(uv);

  // One dimming pass, sized so body copy still clears contrast over the
  // brightest part of the field (the amber edge). A multiply rather than a
  // gamma, so it scales every channel proportionally instead of lifting the
  // near-zero ones the wash depends on.
  col *= 0.88;

  // gentle gamma correction
  /* Near 1.0 on purpose. A lifting gamma raises the near-zero channels most,
   * and the reference wash is built on channels that sit near zero (its middle
   * is #470c1a, green 12/255). At 0.92 that lift alone put roughly ten points
   * of green and blue into every dark band and turned the maroon olive. */
  col = pow(max(col, 0.0), vec3(0.99));

  // light animated film grain (doubles as anti-banding)
  float grain = (fract(sin(dot(gl_FragCoord.xy + uTime*37.0, vec2(12.9898, 78.233)))*43758.5453) - 0.5) * 0.040;
  col += grain;

  gl_FragColor = vec4(col, 1.0);
}`;

interface DriivaShaderBackgroundProps {
  reactToScroll?: boolean;
  reactToClick?: boolean;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

export function DriivaShaderBackground({
  reactToScroll = true,
  reactToClick = true,
}: DriivaShaderBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', {
      antialias: false,
      alpha: false,
      premultipliedAlpha: false,
    });
    if (!gl) return; // wrapper's solid ink background is the fallback

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    const compile = (type: number, src: string): WebGLShader | null => {
      const sh = gl.createShader(type);
      if (!sh) return null;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        gl.deleteShader(sh);
        return null; // silent: wrapper's ink background is the fallback
      }
      return sh;
    };

    const vert = compile(gl.VERTEX_SHADER, VERT);
    const frag = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vert || !frag) return;

    const prog = gl.createProgram();
    if (!prog) return;
    gl.attachShader(prog, vert);
    gl.attachShader(prog, frag);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      return; // silent: wrapper's ink background is the fallback
    }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const U = {
      uRes: gl.getUniformLocation(prog, 'uRes'),
      uTime: gl.getUniformLocation(prog, 'uTime'),
      uMouse: gl.getUniformLocation(prog, 'uMouse'),
      uScroll: gl.getUniformLocation(prog, 'uScroll'),
      uPulse: gl.getUniformLocation(prog, 'uPulse'),
      uPulsePos: gl.getUniformLocation(prog, 'uPulsePos'),
    };

    const state = {
      mouseTarget: [0.5, 0.5] as [number, number],
      mouse: [0.5, 0.5] as [number, number],
      scrollTarget: 0,
      scroll: 0,
      pulse: 0,
      pulsePos: [0.5, 0.5] as [number, number],
      time: 0,
      lastFrame: performance.now(),
    };

    // Render scale caps the backing-store resolution well below CSS pixel
    // density. The mesh gradient is smooth/blurred noise with no fine detail,
    // so this is visually indistinguishable while cutting per-pixel fragment
    // shader cost (the main-thread-blocking GPU load that was making scroll
    // feel laggy) roughly in half versus the previous 1.5x DPR cap. The
    // canvas is CSS-stretched to 100%/100% (see global.css), so displayed
    // size and layout are unaffected.
    const RENDER_SCALE_CAP = 1;

    // The single composed frame used whenever motion is not allowed. Drawn at
    // a time offset where the five stops are well spread rather than at t=0,
    // where they still sit on their starting diagonal.
    const redrawStatic = () => {
      gl.uniform2f(U.uRes, canvas.width, canvas.height);
      gl.uniform1f(U.uTime, 4000);
      gl.uniform2f(U.uMouse, 0.5, 0.5);
      gl.uniform1f(U.uScroll, 0);
      gl.uniform1f(U.uPulse, 0);
      gl.uniform2f(U.uPulsePos, 0.5, 0.5);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, RENDER_SCALE_CAP);
      const w = Math.floor(canvas.clientWidth * dpr);
      const h = Math.floor(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
        // Resizing clears the backing store. With no loop running under
        // reduced motion, nothing would repaint it, so redraw the one frame.
        if (reduced) redrawStatic();
      }
    };

    const pointFromEvent = (e: MouseEvent | TouchEvent) => {
      const r = canvas.getBoundingClientRect();
      const touch = 'touches' in e ? e.touches[0] : undefined;
      const cx = touch ? touch.clientX : (e as MouseEvent).clientX;
      const cy = touch ? touch.clientY : (e as MouseEvent).clientY;
      return {
        x: clamp01((cx - r.left) / r.width),
        y: 1 - clamp01((cy - r.top) / r.height),
      };
    };

    const onMove = (e: MouseEvent | TouchEvent) => {
      const p = pointFromEvent(e);
      state.mouseTarget[0] = p.x;
      state.mouseTarget[1] = p.y;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (!reactToClick || reduced) return;
      const p = pointFromEvent(e);
      state.pulsePos[0] = p.x;
      state.pulsePos[1] = p.y;
      state.pulse = 1;
    };

    const onScroll = () => {
      if (!reactToScroll) return;
      const max = document.documentElement.scrollHeight - window.innerHeight || 1;
      state.scrollTarget = Math.max(0, Math.min(1.2, window.scrollY / max));
    };

    // Under reduced motion nothing reads these, and a scroll listener that
    // exists only to feed a uniform nobody samples is pure cost on the one
    // interaction this page most needs to stay smooth.
    if (!reduced) {
      window.addEventListener('mousemove', onMove, { passive: true });
      window.addEventListener('touchmove', onMove, { passive: true });
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('pointerdown', onPointerDown, { passive: true });
    }
    window.addEventListener('resize', resize, { passive: true });

    resize();

    let raf = 0;
    // Target 60fps, but fall back to 30 if the machine cannot hold it. A
    // background that costs the page its scroll smoothness is worse than a
    // still one, so the field yields the frame budget rather than competing
    // for it. The governor only ever steps down, so it cannot oscillate.
    let frameBudget = 1000 / 60;
    let slowFrames = 0;
    const FRAME_MS = 1000 / 60;
    // Stop drawing while the tab is backgrounded - the shader has no visible
    // effect then, so there's no reason to keep burning GPU cycles.
    const onVisibility = () => {
      // Under reduced motion there is no loop to suspend or resume; restarting
      // one here would quietly reintroduce the animation on tab focus.
      if (reduced) return;
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (!raf) {
        state.lastFrame = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = now - state.lastFrame;
      if (dt < frameBudget - 0.5) return;
      // A frame that took materially longer than asked for means the page is
      // struggling. Ten of those and the field halves its own rate for good.
      if (frameBudget < 1000 / 31 && dt > FRAME_MS * 1.8) {
        slowFrames += 1;
        if (slowFrames > 10) frameBudget = 1000 / 30;
      }
      state.lastFrame = now;
      // NB: resize() is intentionally NOT called per-frame — reading
      // canvas.clientWidth/Height forces a synchronous layout, which thrashes
      // and stutters scrolling. Size is handled by the resize listener instead.

      const dts = Math.min(0.05, dt / 1000);
      state.time += dts;
      state.mouse[0] = lerp(state.mouse[0], state.mouseTarget[0], 0.12);
      state.mouse[1] = lerp(state.mouse[1], state.mouseTarget[1], 0.12);
      state.scroll = lerp(state.scroll, state.scrollTarget, 0.1);
      state.pulse = Math.max(0, state.pulse - dts * 1.4);

      gl.uniform2f(U.uRes, canvas.width, canvas.height);
      gl.uniform1f(U.uTime, state.time);
      gl.uniform2f(U.uMouse, state.mouse[0], state.mouse[1]);
      gl.uniform1f(U.uScroll, state.scroll);
      gl.uniform1f(U.uPulse, state.pulse);
      gl.uniform2f(U.uPulsePos, state.pulsePos[0], state.pulsePos[1]);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };
    if (reduced) {
      // Reduced motion gets the composition, not a slowed-down version of the
      // animation: one frame, then nothing further is scheduled.
      redrawStatic();
    } else {
      raf = requestAnimationFrame(tick);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
      gl.deleteProgram(prog);
      gl.deleteShader(vert);
      gl.deleteShader(frag);
      gl.deleteBuffer(buf);
    };
  }, [reactToScroll, reactToClick]);

  return (
    <div className="shader-bg" aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}
