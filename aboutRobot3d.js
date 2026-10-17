/* -------------------------------------------------------------------------
 * aboutRobot3d.js - interactive robot head for the About section.
 *
 * Mounts the owner's procedural robot (see robot.js) head-only inside the
 * existing portrait container (#about-visual), replacing the photo once it
 * initializes. The portrait (myPic.jpeg) stays as the fallback.
 *
 * INTERACTION (all genuine):
 *   - head yaw / pitch / roll follow the pointer (eased)
 *   - the two eyes slide independently inside the visor toward the pointer
 *   - blinks, antenna spring, hover bob; click/tap the head for a hop + spin
 *   - eases back to a calm idle wander when the pointer leaves
 *
 * Isolated from fp.js and hero3d.js.
 *
 * -------- KILL SWITCH ---------------------------------------------------
 * Load the page with "?no-face" (e.g. http://localhost:5173/?no-face), or set
 * ENABLE_ABOUT_3D = false below. The portrait photo then remains.
 * ----------------------------------------------------------------------- */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createRobotHead } from './robot.js';

// === Feature flag ========================================================
const ENABLE_ABOUT_3D = true;

const urlDisabled =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).has('no-face');

// === Tunables ============================================================
const CONFIG = {
  fov: 24, // narrow FOV keeps proportions undistorted
  fillY: 0.8, // head+antenna height as a fraction of the container height
  fillX: 0.93, // head width (incl. ears) as a fraction of the container width
  lift: 0.0, // vertical nudge, fraction of visible height
  lookScale: 0.5, // limits how far the head/eyes travel (portrait box is narrow)
  idleX: 0.12, // idle wander amplitude when the pointer is away
  idleY: 0.05,
  lookEase: 6, // pointer smoothing (per second)
  maxPixelRatio: 1.5,
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
      (c.getContext('webgl2') || c.getContext('webgl'))
    );
  } catch (e) {
    return false;
  }
}

function initAbout3D() {
  if (!ENABLE_ABOUT_3D || urlDisabled) return;

  const container = document.getElementById('about-visual');
  const canvas = document.getElementById('about-canvas');
  if (!container || !canvas) return;
  if (!webglAvailable()) return; // portrait fallback stays

  const reduceMotion = prefersReducedMotion();
  const coarsePointer =
    typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;

  // --- Renderer ---------------------------------------------------------
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'default',
    });
  } catch (e) {
    console.warn('[aboutRobot3d] WebGL init failed; keeping portrait.', e);
    return;
  }
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const sizeOf = () => {
    const r = container.getBoundingClientRect();
    return { w: Math.max(1, Math.round(r.width)), h: Math.max(1, Math.round(r.height)) };
  };
  const applyPixelRatio = () =>
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CONFIG.maxPixelRatio));
  applyPixelRatio();
  let { w, h } = sizeOf();
  renderer.setSize(w, h, false);

  // --- Scene, environment, lights ---------------------------------------
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTexture;
  scene.environmentIntensity = 0.9;

  const camera = new THREE.PerspectiveCamera(CONFIG.fov, w / h, 0.1, 100);

  const lights = [];
  const addLight = (l) => {
    scene.add(l);
    lights.push(l);
    return l;
  };
  const key = addLight(new THREE.DirectionalLight(0xf4f2fa, 1.5));
  key.position.set(-3, 5, 6);
  const fill = addLight(new THREE.DirectionalLight(0x9aa3c8, 0.7));
  fill.position.set(5, 1, 4);
  const rimViolet = addLight(new THREE.DirectionalLight(0x8b5cf6, 2.6));
  rimViolet.position.set(3, 4, -5);
  const rimCool = addLight(new THREE.DirectionalLight(0xb9b4ff, 1.2));
  rimCool.position.set(-4, 2, -5);

  // --- Robot ------------------------------------------------------------
  let robot;
  try {
    robot = createRobotHead();
  } catch (e) {
    console.warn('[aboutRobot3d] robot build failed; keeping portrait.', e);
    pmrem.dispose();
    renderer.dispose();
    return;
  }
  scene.add(robot.root);

  // Measure the head at rest so framing follows its real bounds.
  robot.root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(robot.headPivot);
  const boxSize = bounds.getSize(new THREE.Vector3());
  const boxCenter = bounds.getCenter(new THREE.Vector3());

  function frameCamera() {
    const aspect = w / h;
    const visH = Math.max(boxSize.y / CONFIG.fillY, boxSize.x / CONFIG.fillX / aspect);
    const dist = visH / 2 / Math.tan(THREE.MathUtils.degToRad(CONFIG.fov / 2)) + boxSize.z / 2;
    const cy = boxCenter.y + visH * CONFIG.lift;
    camera.aspect = aspect;
    camera.position.set(boxCenter.x, cy, dist);
    camera.lookAt(boxCenter.x, cy, 0);
    camera.updateProjectionMatrix();
  }
  frameCamera();

  // --- Pointer state (preallocated; no per-frame allocation) -------------
  const pointer = { x: 0, y: 0, active: false };
  const look = { x: 0, y: 0 };

  function updateFromClient(cx, cy) {
    const r = container.getBoundingClientRect();
    const nx = (cx - (r.left + r.width / 2)) / (r.width * 1.8);
    const ny = (cy - (r.top + r.height / 2)) / (r.height * 1.8);
    pointer.x = Math.max(-1, Math.min(1, nx));
    pointer.y = Math.max(-1, Math.min(1, ny));
    pointer.active = true;
  }
  const onPointerMove = (e) => updateFromClient(e.clientX, e.clientY);
  const onTouchMove = (e) => {
    if (e.touches && e.touches.length) updateFromClient(e.touches[0].clientX, e.touches[0].clientY);
  };
  const onLeave = () => {
    pointer.active = false;
  };
  const onMouseOut = (e) => {
    if (!e.relatedTarget) pointer.active = false;
  };
  // Click or tap the head for a hop. Never calls preventDefault, so scrolling
  // and links are unaffected.
  const onPoke = () => {
    if (!reduceMotion) robot.poke();
  };

  // --- Render loop -------------------------------------------------------
  let rafId = null;
  let running = false;
  let lastTime = 0;
  let clock = 0;

  function renderOnce() {
    renderer.render(scene, camera);
  }

  function frame(now) {
    // Clamp to [0, 0.05]: a stale rAF timestamp can make dt negative, which would turn the exp() smoothing into amplification.
    const dt = Math.min(Math.max((now - lastTime) / 1000, 0), 0.05);
    lastTime = now;
    clock += dt;

    let tx;
    let ty;
    if (pointer.active) {
      tx = pointer.x * CONFIG.lookScale;
      ty = pointer.y * CONFIG.lookScale;
    } else {
      tx = Math.sin(clock * 0.5) * CONFIG.idleX;
      ty = Math.sin(clock * 0.37) * CONFIG.idleY;
    }
    const k = 1 - Math.exp(-dt * CONFIG.lookEase);
    look.x += (tx - look.x) * k;
    look.y += (ty - look.y) * k;

    if (!Number.isFinite(look.x) || !Number.isFinite(look.y)) {
      look.x = 0;
      look.y = 0;
    }
    robot.update(dt, clock, look);
    renderOnce();
    rafId = requestAnimationFrame(frame);
  }

  function start() {
    if (running || reduceMotion) return;
    running = true;
    lastTime = performance.now();
    rafId = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  // --- Resize (container-driven) -----------------------------------------
  const ro = new ResizeObserver(() => {
    const s = sizeOf();
    w = s.w;
    h = s.h;
    applyPixelRatio();
    renderer.setSize(w, h, false);
    frameCamera();
    if (!running) renderOnce();
  });
  ro.observe(container);

  // --- Visibility pausing -------------------------------------------------
  let visible = true;
  const onVisibility = () => {
    if (document.hidden) stop();
    else if (visible) start();
  };
  const io = new IntersectionObserver(
    (entries) => {
      visible = entries[0].isIntersecting;
      if (visible && !document.hidden) start();
      else stop();
    },
    { threshold: 0.05 }
  );
  io.observe(container);

  // --- WebGL context loss: fall back to the portrait ----------------------
  const onContextLost = (e) => {
    e.preventDefault();
    stop();
    container.classList.remove('robot-active');
  };
  canvas.addEventListener('webglcontextlost', onContextLost);

  // --- Listeners -----------------------------------------------------------
  if (!reduceMotion) {
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    if (coarsePointer) {
      window.addEventListener('touchmove', onTouchMove, { passive: true });
      window.addEventListener('touchend', onLeave, { passive: true });
    }
    document.addEventListener('mouseout', onMouseOut);
    window.addEventListener('blur', onLeave);
    container.addEventListener('click', onPoke);
  }
  window.addEventListener('resize', applyPixelRatio, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);

  // --- Go live ---------------------------------------------------------------
  robot.update(0.016, 0, look); // settle the neutral pose
  renderOnce();
  container.classList.add('robot-active');
  if (!reduceMotion) start();

  // --- Cleanup -------------------------------------------------------------
  function dispose() {
    stop();
    io.disconnect();
    ro.disconnect();
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('touchmove', onTouchMove);
    window.removeEventListener('touchend', onLeave);
    document.removeEventListener('mouseout', onMouseOut);
    window.removeEventListener('blur', onLeave);
    container.removeEventListener('click', onPoke);
    window.removeEventListener('resize', applyPixelRatio);
    document.removeEventListener('visibilitychange', onVisibility);
    canvas.removeEventListener('webglcontextlost', onContextLost);
    robot.dispose();
    lights.forEach((l) => l.dispose && l.dispose());
    envTexture.dispose();
    pmrem.dispose();
    renderer.dispose();
  }
  if (import.meta && import.meta.hot) import.meta.hot.dispose(dispose);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAbout3D, { once: true });
} else {
  initAbout3D();
}
