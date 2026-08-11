import { useEffect, useRef } from 'react';

/**
 * DriivaShaderBackground
 * ----------------------
 * The field behind the marketing site: one directional brand gradient, amber
 * to indigo, animated.
 *
 * THREE VERSIONS DEEP, AND WHY THIS ONE. It began as five gaussian bands laid
 * along x, reverse-engineered from a static PNG, which read as a horizontal
 * smear. It was then rebuilt as a domain-warped fBm nebula ported from
 * shippers 4.0 / frontier six, which had real structure but the wrong kind:
 * letting noise decide where colour goes means there is no direction to read,
 * so the eye finds shapes instead of a gradient, and the fine octaves resolved
 * into vertical filaments drifting up the page.
 *
 * So the hierarchy is now inverted from that attempt. The composition is a
 * single axis and nothing is allowed to compete with it. Noise survives only
 * as a small perturbation of WHERE that axis sits, at an amplitude too low to
 * close a shape - enough that it does not look like a CSS linear-gradient, not
 * enough to become an object. Three octaves rather than five, because the fine
 * detail was the streaking.
 *
 * The four canonical stops are the only source of hue and are darkened on the
 * way into the ramp rather than dimmed afterwards, so the far end stays a true
 * ink instead of a muddy indigo. The top of the frame is pulled down
 * separately because it carries the nav and the wordmark.
 *
 * Kept from the previous implementation: the whole performance harness, which
 * is unrelated to how the field looks. Render scale capped at 1, the loop
 * self-governs to 30fps if frames slip, drawing suspends while the tab is
 * hidden, and reduced motion gets one composed still frame rather than a
 * slowed animation.
 */

const VERT = `attribute vec2 aPos; void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `precision highp float;

uniform vec2  uRes;
uniform float uTime;
uniform vec2  uMouse;
uniform float uScroll;
uniform float uPulse;
uniform vec2  uPulsePos;

/* The four canonical Driiva stops, and the ink they sit in. Only source of
 * hue in the field. Retune in design-system tokens and mirror here. */
const vec3 C_AMBER  = vec3(0.831, 0.522, 0.039); // #d4850a
const vec3 C_BURNT  = vec3(0.627, 0.298, 0.165); // #a04c2a
const vec3 C_VIOLET = vec3(0.420, 0.247, 0.627); // #6b3fa0
const vec3 C_INDIGO = vec3(0.231, 0.176, 0.545); // #3b2d8b
const vec3 C_DEEP   = vec3(0.020, 0.020, 0.036); // #050509 ink
/* The warm extreme. Neither amber alone works here: #fbbf24 and #d4850a are
 * both yellow-leaning, and darkening either one far enough to sit behind text
 * drops the red faster than the green, so the corner read olive rather than
 * orange. Blending amber toward burnt raises red against green and lands a
 * true orange while staying entirely inside the palette - it is two canonical
 * stops mixed, not a fifth colour. */
const vec3 C_ORANGE = vec3(0.760, 0.444, 0.083); // mix(#d4850a, #a04c2a, 0.35)

float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f*f*(3.0-2.0*f);
  return mix(mix(h(i),           h(i+vec2(1,0)), f.x),
             mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y);
}

/* Three octaves, not five. The extra two only ever added fine detail, and
 * fine detail in a noise field is exactly what read as streaks. */
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 3; i++){ v += a*vnoise(p); p = m*p; a *= 0.5; }
  return v;
}

void main(){
  vec2 uv   = (gl_FragCoord.xy - 0.5*uRes) / uRes.y;
  vec2 uv01 = gl_FragCoord.xy / uRes.xy;

  /* ONE DIRECTION. The whole composition is a single axis: amber at one end,
   * indigo at the other, running on a fixed diagonal. The nebula version
   * before this let noise decide where colour went, which is what produced
   * the drifting blobs and the vertical filaments - there was no direction to
   * read, so the eye found shapes instead of a gradient. */
  vec2 dir = normalize(vec2(1.0, 0.52));
  float g = dot(uv, dir) * 0.62 + 0.5;

  /* Noise is demoted to a perturbation of WHERE the ramp sits, at an
   * amplitude too small to ever close a shape. It keeps the gradient from
   * looking like a CSS linear-gradient and stops 8-bit banding, and that is
   * all it is allowed to do. Parallax and drift move the ramp, not the hue. */
  vec2 par = (uMouse - 0.5) * 0.06;
  float n = fbm(uv*1.15 + par + vec2(uTime*0.014, uTime*-0.009));
  g += (n - 0.5) * 0.085;
  g += uScroll * 0.06;

  /* The ramp. Stops are darkened on the way in rather than dimmed afterwards,
   * so the dark end stays a true ink instead of a muddy indigo. */
  vec3 col = mix(C_ORANGE*0.98,   C_ORANGE*0.80, smoothstep(-0.14, 0.12, g));
  col      = mix(col,             C_BURNT*0.72, smoothstep(0.08, 0.40, g));
  col      = mix(col,             C_VIOLET*0.70, smoothstep(0.32, 0.66, g));
  col      = mix(col,             C_INDIGO*0.76, smoothstep(0.60, 0.90, g));
  col      = mix(col,             C_DEEP,        smoothstep(0.86, 1.18, g));

  /* Top of the frame carries the nav and the wordmark, so it is pulled down
   * regardless of where the ramp happens to be. */
  col *= mix(0.80, 1.0, smoothstep(0.98, 0.42, uv01.y));

  /* Click ripple, amber so an interaction cannot introduce an off-palette
   * colour. */
  float clickD = distance(uv01, uPulsePos);
  col += uPulse * exp(-clickD*4.0) * sin(clickD*22.0 - uTime*8.0) * 0.04 * C_AMBER;

  /* Gentle falloff, then the single contrast lever for the whole field. */
  col *= 1.0 - 0.34*dot(uv, uv);
  col *= 0.92;

  /* Dither. At these very low channel values 8-bit output bands visibly
   * across a smooth ramp, and this is the cheapest fix. */
  float grain = (fract(sin(dot(gl_FragCoord.xy + uTime*37.0, vec2(12.9898, 78.233)))*43758.5453) - 0.5) * 0.030;
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
