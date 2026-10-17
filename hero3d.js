/* -------------------------------------------------------------------------
 * hero3d.js - persistent, site-wide neural-network background.
 *
 * ONE fixed, full-viewport canvas (#bg-canvas) sits behind the whole page and
 * is the only network renderer. It keeps the hero's look: small crisp points,
 * a few fine low-opacity lines, depth from perspective and fog, muted
 * grey-lavender with sparse violet nodes.
 *
 * Continuity: the field is one tall volume that scrolls with a slow parallax
 * (about 28% of page scroll speed), so the network reads as a single space
 * spanning the document and never restarts at section boundaries.
 *
 * Readability: the canvas fades from full strength at the hero to ~60% over
 * content sections, and near-camera (largest) points are dimmed.
 *
 * Isolated from fp.js and aboutRobot3d.js.
 *
 * -------- FEATURE FLAG --------------------------------------------------
 * Disable with ENABLE_HERO_3D = false below, or load the page with "?no3d"
 * (e.g. http://localhost:5173/?no3d). The plain dark page background remains.
 * ----------------------------------------------------------------------- */

import * as THREE from 'three';

// === Feature flag ========================================================
const ENABLE_HERO_3D = true;

const urlDisabled =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).has('no3d');

// === Tunables ============================================================
const CONFIG = {
  mobileBreakpoint: 768,
  maxPixelRatio: { desktop: 1.5, mobile: 1.25 },

  // Particle density per world-unit^3 (the hero's original look), with caps.
  density: { desktop: 0.0245, mobile: 0.0125 },
  maxParticles: { desktop: 1500, mobile: 480 },

  colors: {
    violet: 0x8b5cf6, // --accent (used sparingly)
    lavender: 0xa78bfa, // --accent-hover
    muted: 0x8f8ca3, // dim grey-lavender (most points)
  },
  paletteWeights: { muted: 0.78, lavender: 0.14, violet: 0.08 },

  fogColor: 0x0b0b10, // --bg-dark
  fogDensity: 0.035,

  pointSizeMin: 0.9,
  pointSizeMax: 2.0,
  pointMaxPx: 5, // hard cap on any point's on-screen size
  pointOpacity: 0.55,

  lineMaxDistance: 3.2,
  lineMaxPerPoint: 2,
  lineOpacity: 0.08,

  fov: 60,
  camZ: 18,
  baseHalfY: 10.8, // half-height of the field at the top of the page
  depthMin: -18,
  depthMax: 10,

  scrollParallax: 0.28, // field moves at this fraction of page scroll
  scrollEase: 8, // smoothing of the scroll follow (per second)
  contentFade: 0.6, // canvas opacity once scrolled past the hero

  sway: 0.22, // +/- rad of slow rotation about the vertical axis
  swayRate: 0.05, // rad/s phase rate (period ~2 minutes)
  parallax: 0.05, // pointer lean
  parallaxEase: 2.2, // per second
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function prefersReducedMotion() {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (c.getContext('webgl') || c.getContext('experimental-webgl'))
    );
  } catch (e) {
    return false;
  }
}

// Small crisp circular dot (hard edge, no glow halo).
function makeDotTexture() {
  const size = 32;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,1)';
  ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

function initBackground() {
  if (!ENABLE_HERO_3D || urlDisabled) return;

  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;
  if (!webglAvailable()) return; // plain dark page background remains

  const reduceMotion = prefersReducedMotion();
  const hero = document.getElementById('hero');

  // --- Renderer ---------------------------------------------------------
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'low-power',
    });
  } catch (e) {
    console.warn('[bg3d] WebGL init failed; using plain background.', e);
    return;
  }
  renderer.setClearColor(0x000000, 0);

  const isMobile = () => window.innerWidth <= CONFIG.mobileBreakpoint;
  const pixelRatio = () =>
    Math.min(
      window.devicePixelRatio || 1,
      isMobile() ? CONFIG.maxPixelRatio.mobile : CONFIG.maxPixelRatio.desktop
    );

  const viewSize = () => ({
    w: Math.max(1, canvas.clientWidth || window.innerWidth),
    h: Math.max(1, canvas.clientHeight || window.innerHeight),
  });

  let { w, h } = viewSize();
  renderer.setPixelRatio(pixelRatio());
  renderer.setSize(w, h, false);

  // --- Scene / camera ---------------------------------------------------
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(CONFIG.fogColor, CONFIG.fogDensity);
  const camera = new THREE.PerspectiveCamera(CONFIG.fov, w / h, 0.1, 120);
  camera.position.z = CONFIG.camZ;

  const HALF = Math.tan(THREE.MathUtils.degToRad(CONFIG.fov / 2));
  const REF_H = 2 * CONFIG.camZ * HALF; // visible world height at the camera plane

  // --- Shared materials (created once; geometry is rebuilt when needed) ---
  const dot = makeDotTexture();
  const pointMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTexture: { value: dot },
      uOpacity: { value: CONFIG.pointOpacity },
      uPixelRatio: { value: renderer.getPixelRatio() },
      uMaxPx: { value: CONFIG.pointMaxPx },
    },
    vertexShader: /* glsl */ `
      attribute float size;
      varying vec3 vColor;
      varying float vAlpha;
      uniform float uPixelRatio;
      uniform float uMaxPx;
      void main() {
        vColor = color;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float d = -mv.z;
        gl_PointSize = min(size * uPixelRatio * (90.0 / d), uMaxPx * uPixelRatio);
        // Near-camera points are the largest; keep them dim behind content.
        vAlpha = mix(0.5, 1.0, smoothstep(8.0, 22.0, d));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uTexture;
      uniform float uOpacity;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        float mask = texture2D(uTexture, gl_PointCoord).a;
        if (mask < 0.1) discard;
        gl_FragColor = vec4(vColor, mask * uOpacity * vAlpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    vertexColors: true,
    blending: THREE.NormalBlending,
  });

  const lineMaterial = new THREE.LineBasicMaterial({
    color: new THREE.Color(CONFIG.colors.lavender),
    transparent: true,
    opacity: CONFIG.lineOpacity,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });

  const palette = {
    violet: new THREE.Color(CONFIG.colors.violet),
    lavender: new THREE.Color(CONFIG.colors.lavender),
    muted: new THREE.Color(CONFIG.colors.muted),
  };
  const pw = CONFIG.paletteWeights;
  const pickColor = () => {
    const r = Math.random();
    if (r < pw.violet) return palette.violet;
    if (r < pw.violet + pw.lavender) return palette.lavender;
    return palette.muted;
  };

  const field = new THREE.Group();
  scene.add(field);

  // --- Layout: field size follows the viewport and the page height --------
  function computeLayout() {
    const v = viewSize();
    const aspect = v.w / v.h;
    const unitsPerPx = REF_H / v.h;
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - v.h);
    const deltaMax = maxScroll * unitsPerPx * CONFIG.scrollParallax;
    return {
      mobile: isMobile(),
      unitsPerPx,
      xSpread: clamp(REF_H * aspect * 1.15, 14, 64),
      yMax: CONFIG.baseHalfY,
      yMin: -(CONFIG.baseHalfY + deltaMax),
    };
  }

  let built = null; // { layout, points, lines, geometries[] }

  function disposeField() {
    if (!built) return;
    field.remove(built.points, built.lines);
    built.geometries.forEach((g) => g.dispose());
    built = null;
  }

  function buildField(layout) {
    disposeField();
    const kind = layout.mobile ? 'mobile' : 'desktop';
    const volume =
      layout.xSpread * (layout.yMax - layout.yMin) * (CONFIG.depthMax - CONFIG.depthMin);
    const count = Math.min(
      CONFIG.maxParticles[kind],
      Math.max(60, Math.round(volume * CONFIG.density[kind]))
    );

    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * layout.xSpread;
      positions[i3 + 1] = layout.yMin + Math.random() * (layout.yMax - layout.yMin);
      positions[i3 + 2] = CONFIG.depthMin + Math.random() * (CONFIG.depthMax - CONFIG.depthMin);
      const c = pickColor();
      colors[i3] = c.r;
      colors[i3 + 1] = c.g;
      colors[i3 + 2] = c.b;
      sizes[i] = CONFIG.pointSizeMin + Math.random() * (CONFIG.pointSizeMax - CONFIG.pointSizeMin);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    const points = new THREE.Points(geometry, pointMaterial);
    points.frustumCulled = false;

    // Sparse fine lines between genuinely close points (computed once).
    const seg = [];
    const links = new Int8Array(count);
    const maxSq = CONFIG.lineMaxDistance * CONFIG.lineMaxDistance;
    for (let i = 0; i < count; i++) {
      if (links[i] >= CONFIG.lineMaxPerPoint) continue;
      const ax = positions[i * 3];
      const ay = positions[i * 3 + 1];
      const az = positions[i * 3 + 2];
      for (let j = i + 1; j < count; j++) {
        if (links[i] >= CONFIG.lineMaxPerPoint) break;
        if (links[j] >= CONFIG.lineMaxPerPoint) continue;
        const dy = ay - positions[j * 3 + 1];
        if (dy * dy > maxSq) continue;
        const dx = ax - positions[j * 3];
        const dz = az - positions[j * 3 + 2];
        if (dx * dx + dy * dy + dz * dz < maxSq) {
          seg.push(ax, ay, az, positions[j * 3], positions[j * 3 + 1], positions[j * 3 + 2]);
          links[i]++;
          links[j]++;
        }
      }
    }
    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(seg), 3));
    const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
    lines.frustumCulled = false;

    field.add(points, lines);
    built = { layout, points, lines, geometries: [geometry, lineGeometry] };
  }

  buildField(computeLayout());

  // Rebuild only when the page or viewport changed enough to matter.
  let rebuildTimer = null;
  function maybeRebuild() {
    const next = computeLayout();
    const cur = built.layout;
    const lenNext = next.yMax - next.yMin;
    const lenCur = cur.yMax - cur.yMin;
    const needs =
      lenNext > lenCur * 1.04 ||
      lenNext < lenCur * 0.6 ||
      Math.abs(next.xSpread - cur.xSpread) / cur.xSpread > 0.2 ||
      next.mobile !== cur.mobile;
    if (needs) {
      buildField(next);
      if (!running) renderOnce();
    } else {
      built.layout.unitsPerPx = next.unitsPerPx;
    }
  }
  const scheduleRebuild = () => {
    clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(maybeRebuild, 200);
  };

  // --- Scroll: content fade (CSS var) and parallax target ------------------
  let heroH = hero ? hero.offsetHeight : h;
  function applyScrollFade() {
    const t = smoothstep(0, heroH * 0.7, window.scrollY);
    canvas.style.setProperty('--bg-fade', String(1 - (1 - CONFIG.contentFade) * t));
  }
  const scrollTarget = () => window.scrollY * built.layout.unitsPerPx * CONFIG.scrollParallax;

  // --- Pointer lean (gentle, no per-frame allocation) -----------------------
  const pointer = { x: 0, y: 0 };
  const lean = { x: 0, y: 0 };
  const onPointerMove = (e) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  };

  // --- Resize ---------------------------------------------------------------
  function onResize() {
    const s = viewSize();
    if (s.w !== w || s.h !== h) {
      w = s.w;
      h = s.h;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(pixelRatio());
      pointMaterial.uniforms.uPixelRatio.value = renderer.getPixelRatio();
      renderer.setSize(w, h, false);
    }
    heroH = hero ? hero.offsetHeight : h;
    applyScrollFade();
    scheduleRebuild();
    if (!running) renderOnce();
  }

  // --- Render loop -----------------------------------------------------------
  let rafId = null;
  let running = false;
  let last = 0;
  let clock = 0;
  let scrollCur = reduceMotion ? 0 : scrollTarget();

  function renderOnce() {
    renderer.render(scene, camera);
  }

  function frame(now) {
    const dt = clamp((now - last) / 1000, 0, 0.05); // never negative
    last = now;
    clock += dt;

    scrollCur += (scrollTarget() - scrollCur) * (1 - Math.exp(-dt * CONFIG.scrollEase));
    const k = 1 - Math.exp(-dt * CONFIG.parallaxEase);
    lean.x += (pointer.x * CONFIG.parallax - lean.x) * k;
    lean.y += (pointer.y * CONFIG.parallax - lean.y) * k;

    field.position.y = scrollCur;
    field.rotation.y = Math.sin(clock * CONFIG.swayRate) * CONFIG.sway;
    field.rotation.x = lean.y * 0.3;
    field.rotation.z = -lean.x * 0.1;

    renderOnce();
    rafId = requestAnimationFrame(frame);
  }

  function start() {
    if (running || reduceMotion) return;
    running = true;
    last = performance.now();
    rafId = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }
  const onVisibility = () => (document.hidden ? stop() : start());

  const onContextLost = (e) => {
    e.preventDefault();
    stop();
    canvas.classList.remove('is-active');
  };
  canvas.addEventListener('webglcontextlost', onContextLost);

  // --- Listeners -------------------------------------------------------------
  window.addEventListener('resize', onResize, { passive: true });
  window.addEventListener('scroll', applyScrollFade, { passive: true });
  window.addEventListener('load', scheduleRebuild, { once: true });
  document.addEventListener('visibilitychange', onVisibility);
  if (!reduceMotion) window.addEventListener('pointermove', onPointerMove, { passive: true });
  const ro = new ResizeObserver(scheduleRebuild); // page height changes (fonts, images)
  ro.observe(document.body);

  // --- Go live ---------------------------------------------------------------
  applyScrollFade();
  field.position.y = scrollCur;
  renderOnce();
  canvas.classList.add('is-active');
  if (!reduceMotion) start();

  // --- Cleanup (HMR / teardown) ----------------------------------------------
  function dispose() {
    stop();
    clearTimeout(rebuildTimer);
    ro.disconnect();
    window.removeEventListener('resize', onResize);
    window.removeEventListener('scroll', applyScrollFade);
    window.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('visibilitychange', onVisibility);
    canvas.removeEventListener('webglcontextlost', onContextLost);
    disposeField();
    pointMaterial.dispose();
    lineMaterial.dispose();
    dot.dispose();
    renderer.dispose();
  }
  if (import.meta && import.meta.hot) import.meta.hot.dispose(dispose);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBackground, { once: true });
} else {
  initBackground();
}