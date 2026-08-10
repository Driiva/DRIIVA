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

/* Driiva palette (linear-ish; gentle gamma applied at the end) */
const vec3 C_AMBER  = vec3(0.835, 0.521, 0.040); // #d4850a
const vec3 C_AMBER2 = vec3(0.984, 0.749, 0.141); // #fbbf24
const vec3 C_BURNT  = vec3(0.627, 0.298, 0.165); // #a04c2a
const vec3 C_VIOLET = vec3(0.420, 0.247, 0.627); // #6b3fa0
const vec3 C_INDIGO = vec3(0.231, 0.176, 0.545); // #3b2d8b
const vec3 C_IRIS   = vec3(0.388, 0.400, 0.945); // #6366f1
const vec3 C_PURPLE = vec3(0.545, 0.361, 0.965); // #8b5cf6
const vec3 C_LILAC  = vec3(0.654, 0.545, 0.980); // #a78bfa
const vec3 C_PLUM   = vec3(0.102, 0.059, 0.122); // #1a0f1f
const vec3 C_INK    = vec3(0.020, 0.020, 0.035); // #050509

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

/* Smooth weighted blend of colour stops on an S-curve diagonal from top-left
 * (amber) -> bottom-right (deep indigo), plus floating orbs for depth. */
vec3 meshBlend(vec2 uv){
  vec2 ar = vec2(uRes.x/uRes.y, 1.0);
  vec2 p  = uv * ar;

  /* The field drifts predominantly along X, at a rate that differs per stop,
   * so the near colours slide past faster than the far ones. That parallax is
   * what makes it read as light moving past a car rather than a lava lamp:
   * amber sodium light behind, indigo night ahead. */
  float t  = uTime * 0.16;
  float drift = uTime * 0.020;
  float mx = (uMouse.x - 0.5);
  float my = (uMouse.y - 0.5);
  float s  = uScroll;

  /* Lateral travel, one long-period sine per stop at rates that share no
   * common multiple, so the field never resynchronises into a visible loop.
   * A sine rather than a wrap because a wrapped stop pops when it crosses the
   * seam: these weights are wide enough to still be on screen at the edge.
   * The near stops (x3, x4) swing furthest, which is the parallax. */
  float x0 = (0.08 + 0.10*sin(drift*0.61)) * ar.x;
  float x1 = (0.30 + 0.14*sin(drift*0.43 + 1.7)) * ar.x;
  float x2 = (0.66 + 0.19*sin(drift*0.29 + 3.1)) * ar.x;
  float x3 = (0.38 + 0.24*sin(drift*0.37 + 4.6)) * ar.x;
  float x4 = (0.94 + 0.28*sin(drift*0.23 + 5.8)) * ar.x;

  vec2 p0 = vec2(x0 + 0.05*sin(t*1.2),       0.94 + 0.03*cos(t*0.9));
  vec2 p1 = vec2(x1 + 0.05*sin(t*0.7 + 0.5), 0.72 + 0.04*cos(t*1.3));
  vec2 p2 = vec2(x2 + 0.07*sin(t*0.6),       0.50 + 0.05*cos(t*0.8));
  vec2 p3 = vec2(x3 + 0.06*cos(t*1.0),       0.28 + 0.04*sin(t*1.2));
  vec2 p4 = vec2(x4 + 0.05*sin(t*1.3),       0.06 + 0.03*cos(t*0.7));
  vec2 p5 = vec2(uMouse.x*ar.x, uMouse.y);

  vec2 sN = vec2(s*0.08, -s*0.30);
  p0 += sN*0.4; p1 += sN*0.6; p2 += sN; p3 += sN*1.2; p4 += sN*1.4;

  vec2 par = vec2(mx, my) * 0.06;
  p0 -= par;        p1 -= par*0.6;
  p3 += par*0.6;    p4 += par;

  vec3 cAmber  = mix(C_AMBER,  C_BURNT,  0.18);
  vec3 cBurnt  = mix(C_BURNT,  C_VIOLET, 0.20 + s*0.30);
  vec3 cViolet = mix(C_VIOLET, C_PLUM,   0.22);
  vec3 cIris   = mix(C_IRIS,   C_INDIGO, 0.45);
  vec3 cIndigo = mix(C_INDIGO, C_PLUM,   0.45 + s*0.20);
  vec3 cCursor = mix(C_PURPLE, C_LILAC,  0.30 + 0.30*uPulse);

  float r0 = 0.50 + 0.04*sin(t*1.6);
  float r1 = 0.44 + 0.03*cos(t*1.2);
  float r2 = 0.48 + 0.05*sin(t*0.9);
  float r3 = 0.42 + 0.04*cos(t*1.3);
  float r4 = 0.54 + 0.05*sin(t*0.7);
  float r5 = 0.24 + 0.10*uPulse;

  float clickD = distance(uv, uPulsePos*ar);
  float ripple = uPulse * exp(-clickD*4.0) * sin(clickD*22.0 - uTime*8.0);
  r5 += uPulse * 0.10;

  float w0 = exp(-pow(distance(p,p0),2.0) / (r0*r0));
  float w1 = exp(-pow(distance(p,p1),2.0) / (r1*r1));
  float w2 = exp(-pow(distance(p,p2),2.0) / (r2*r2));
  float w3 = exp(-pow(distance(p,p3),2.0) / (r3*r3));
  float w4 = exp(-pow(distance(p,p4),2.0) / (r4*r4));
  float w5 = exp(-pow(distance(p,p5),2.0) / (r5*r5)) * (1.0 + uPulse*2.0);

  float n = fbm(p*1.8 + uTime*0.05);
  float warp = (n - 0.5) * 0.06;
  w0 *= 1.0 + warp;  w1 *= 1.0 - warp;
  w2 *= 1.0 - warp;  w3 *= 1.0 + warp;
  w4 *= 1.0 + warp*0.5;

  float wsum = w0+w1+w2+w3+w4+w5 + 1e-4;
  vec3 col = (cAmber*w0 + cBurnt*w1 + cViolet*w2 + cIris*w3 + cIndigo*w4 + cCursor*w5) / wsum;

  float diag = (uv.x + (1.0-uv.y)) * 0.5;
  col *= mix(1.02, 0.62, smoothstep(0.0, 1.0, diag));

  float t2 = uTime;
  vec3 orbAcc = vec3(0.0);
  for (int i = 0; i < 10; i++) {
    float fi = float(i);
    float depth = 0.35 + fract(fi*0.317) * 1.40;

    float ph = fi * 1.732;
    float sp = 0.18 + fract(fi*0.611) * 0.34;
    vec2 path = vec2(
      0.26*sin(t2*sp        + ph)        + 0.09*sin(t2*sp*0.41 + ph*1.7),
      0.20*cos(t2*sp*0.83   + ph*0.7)    + 0.07*sin(t2*sp*0.37 + ph*2.1)
    );
    vec2 base = vec2(
      (0.15 + fi*0.197) * ar.x,
       0.20 + fract(fi*0.241) * 0.66
    ) + path;

    vec2 c = base - vec2(mx, my) * 0.06 * depth;

    float breath  = 0.78 + 0.34 * sin(t2*1.10 + fi*2.13);
    float gate    = smoothstep(0.55, 0.95, fract(t2*0.42 + fi*0.317 + 0.18*sin(t2*0.7+fi)));
    float spark   = 0.55 + 0.55 * sin(t2*7.20 + fi*5.31);
    float twinkle = mix(0.55, 1.30, gate * spark);

    float sz = (0.0090 + 0.0050*depth) * breath;
    float d  = distance(p, c);
    float core = exp(-d*d / (sz*sz*1.6));
    float halo = exp(-d*d / (sz*sz*14.0)) * 0.36;
    float crossSpark = exp(-d*d / (sz*sz*40.0)) * gate * 0.50;

    float bright = (core + halo + crossSpark) * (0.22 + 0.18*depth) * twinkle;

    float hueId = fract(fi*0.418 + 0.10*sin(t2*0.30 + fi));
    vec3 warm   = vec3(1.00, 0.94, 0.84);
    vec3 amber  = vec3(1.00, 0.83, 0.55);
    vec3 lilac  = vec3(0.84, 0.80, 1.00);
    vec3 hue    = mix(warm, mix(amber, lilac, hueId), 0.45);

    orbAcc += hue * bright;
  }
  col += orbAcc * 0.60;

  vec2 q = uv - 0.5;
  float vign = 1.0 - dot(q,q)*0.70;
  col *= mix(0.74, 1.02, vign);

  col += ripple * 0.06 * C_LILAC;

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
  // brightest part of the field (the amber corner).
  col *= 0.80;

  // gentle gamma correction
  col = pow(max(col, 0.0), vec3(0.92));

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
