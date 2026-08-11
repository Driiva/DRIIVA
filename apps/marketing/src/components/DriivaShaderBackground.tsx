import { useEffect, useRef } from 'react';

/**
 * DriivaShaderBackground
 * ----------------------
 * Full-viewport animated field behind the marketing site.
 *
 * WHAT CHANGED AND WHY. This used to be five gaussian bands laid along x,
 * reverse-engineered from design-system/assets/gradient-background.png. It
 * matched that PNG closely, and that was the problem: a still image made into
 * a moving one is still a wash. The bands could only ever breathe against each
 * other, so at any instant the screen was a horizontal smear of orange into
 * purple with no structure to look at.
 *
 * It is now built on the technique from shippers 4.0 / frontier six, which is
 * the reference Jamal actually asked for: a single-pass domain-warped fBm
 * nebula. Two noise fields, where the first warps the coordinates of the
 * second (q feeds into f), which is what produces filament and cloud structure
 * instead of gradient. Colour is then assigned by DENSITY rather than by
 * position - each brand stop is mixed in over a smoothstep window of the noise
 * value - so the palette organises itself into deep voids and bright edges
 * wherever the noise happens to go, and never repeats.
 *
 * The four canonical brand stops are unchanged and are still the only source
 * of hue. What changed is where they land: indigo and violet hold the mass of
 * the field, burnt marks the denser edges, and amber is reserved for the
 * brightest filaments, so the gradient still reads amber-to-indigo but as
 * light rather than as a ladder.
 *
 * Kept from frontier six: pointer parallax on the sample point, the sparse
 * star field, the scroll-driven warm horizon lift, the radial falloff, and the
 * single 0.88 multiply at the end that holds the field under the text
 * contrast floor.
 *
 * Kept from the previous implementation: the whole performance harness, which
 * was hard won and is unrelated to how the field looks. Render scale is capped
 * at 1, the loop self-governs down to 30fps if frames slip, drawing stops
 * while the tab is hidden, and reduced motion gets one composed still frame
 * rather than a slowed animation.
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

/* The four canonical Driiva stops. These are the only source of hue in the
 * field and must not be retuned here; retune them in design-system tokens and
 * mirror the value across. C_DEEP is the ink the field sits in, taken from the
 * top of the surface ladder rather than invented. */
const vec3 C_AMBER  = vec3(0.831, 0.522, 0.039); // #d4850a
const vec3 C_BURNT  = vec3(0.627, 0.298, 0.165); // #a04c2a
const vec3 C_VIOLET = vec3(0.420, 0.247, 0.627); // #6b3fa0
const vec3 C_INDIGO = vec3(0.231, 0.176, 0.545); // #3b2d8b
const vec3 C_DEEP   = vec3(0.020, 0.020, 0.036); // #050509 ink

float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f*f*(3.0-2.0*f);
  return mix(mix(h(i),           h(i+vec2(1,0)), f.x),
             mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y);
}

/* Five octaves through a rotation-and-scale matrix rather than a plain
 * doubling. The rotation is what stops successive octaves lining up into
 * visible axis-aligned tiling, and it is the reason this reads as cloud
 * rather than as noise. */
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++){ v += a*vnoise(p); p = m*p; a *= 0.5; }
  return v;
}

void main(){
  /* Centred and aspect-corrected, so the composition does not stretch on wide
   * monitors the way a straight 0..1 mapping does. */
  vec2 uv  = (gl_FragCoord.xy - 0.5*uRes) / uRes.y;
  vec2 uv01 = gl_FragCoord.xy / uRes.xy;

  /* Parallax moves the point we SAMPLE the noise at, not the finished image,
   * so the cloud appears to sit at depth behind the page instead of sliding
   * across it. */
  vec2 par = (uMouse - 0.5) * 0.09;
  vec2 p = uv*1.35 + par;

  float t = uTime * 0.022;

  /* The domain warp. q is a slow field; feeding it into the coordinates of f
   * is what turns two smooth noises into filaments and voids. */
  float q = fbm(p + vec2(t, -t*0.6));
  float f = fbm(p*1.8 + q*1.5 + vec2(-t*0.7, t*0.4));

  /* Colour by density. Each stop is mixed over its own smoothstep window of
   * the noise, so the ladder runs cool in the mass of the cloud and warm at
   * the bright edges. Amber sits last and weakest: it is the highlight, and
   * it is also the only stop bright enough to threaten text contrast. */
  vec3 col = C_DEEP;
  col = mix(col, C_INDIGO, smoothstep(0.24, 0.62, f));
  col = mix(col, C_VIOLET, smoothstep(0.46, 0.80, f) * 0.72);
  col = mix(col, C_BURNT,  smoothstep(0.62, 0.94, f) * 0.46);
  col = mix(col, C_AMBER,  smoothstep(0.74, 1.05, f*q + f*0.25) * 0.38);

  /* One deep violet bloom off the upper left, the single placed feature in an
   * otherwise procedural field. It gives the composition somewhere to sit. */
  col = mix(col, C_VIOLET*0.55,
            smoothstep(0.95, 0.15, length(uv - vec2(-0.72, 0.44))) * 0.13 * (0.6 + 0.4*q));

  /* Warm horizon along the bottom that opens up as the reader scrolls, so the
   * page warms rather than the background simply scrolling away. */
  float hor = smoothstep(0.55, -0.42, uv.y);
  col = mix(col, C_AMBER*0.8, hor*hor * (0.05 + 0.17*uScroll) * (0.5 + 0.5*f));

  /* Sparse stars. The threshold is deliberately severe: a handful per screen
   * reads as depth, any more reads as a screensaver. */
  vec2 sp = uv * uRes.y / 3.1 + par*36.0;
  vec2 cell = floor(sp);
  vec2 fc = fract(sp) - 0.5;
  float sr = h(cell);
  if (sr > 0.9955){
    float tw = 0.5 + 0.5*sin(uTime*(1.0 + sr*3.0) + sr*44.0);
    col += vec3(1.0, 0.95, 0.85) * smoothstep(0.15, 0.0, length(fc)) * tw * 0.45;
  }

  /* Click ripple, tinted amber so an interaction cannot introduce a colour
   * that is not in the palette. */
  float clickD = distance(uv01, uPulsePos);
  col += uPulse * exp(-clickD*4.0) * sin(clickD*22.0 - uTime*8.0) * 0.05 * C_AMBER;

  /* Radial falloff, then one dimming pass. This 0.88 is the contrast lever:
   * it is the single place the whole field is scaled against the body-copy
   * floor, so changing it changes legibility everywhere at once. */
  col *= 1.0 - 0.5*dot(uv, uv);
  col *= 0.88;

  /* Animated grain, which doubles as the anti-banding dither the smooth
   * gradients need at 8 bits. */
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
