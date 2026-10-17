/* -------------------------------------------------------------------------
 * robot.js - head-only port of the portfolio owner's procedural robot.
 *
 * Geometry and animation logic come from the owner's own robot (rounded-box
 * head, visor, capsule eyes, ear modules, spring antenna). This version:
 *   - drops the torso, arms, thruster, flame and ground shadow so only the
 *     head floats in the About portrait,
 *   - restyles the materials for Obsidian Minimalism (graphite shell,
 *     titanium accents, near-black visor, restrained violet eyes/antenna),
 *   - adds dispose() for GPU cleanup.
 *
 * Interaction (all genuine, driven by `look` in [-1, 1]):
 *   - head yaw/pitch/roll follow `look`
 *   - the two eyes slide inside the visor toward `look`
 *   - random blinks, antenna spring reacting to head motion, hover bob
 *   - poke(): hop with squash, happy-eyes, and a spin every third poke
 * ----------------------------------------------------------------------- */

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function createRobotHead() {
  const root = new THREE.Group();
  const rig = new THREE.Group();
  root.add(rig);

  // --- Obsidian materials ------------------------------------------------
  const shell = new THREE.MeshPhysicalMaterial({
    color: 0x3a3a48,
    metalness: 0.88,
    roughness: 0.34,
    clearcoat: 1,
    clearcoatRoughness: 0.22,
  });
  const titanium = new THREE.MeshStandardMaterial({
    color: 0x7b7b8c,
    roughness: 0.38,
    metalness: 0.92,
  });
  const ink = new THREE.MeshPhysicalMaterial({
    color: 0x060609,
    roughness: 0.28,
    metalness: 0.35,
    clearcoat: 0.6,
    clearcoatRoughness: 0.3,
  });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xc9bbff });
  const tipMat = new THREE.MeshStandardMaterial({
    color: 0xa78bfa,
    emissive: 0x8b5cf6,
    emissiveIntensity: 1.4,
    roughness: 0.3,
  });

  // --- Head ----------------------------------------------------------------
  const headPivot = new THREE.Group();
  rig.add(headPivot);

  const head = new THREE.Mesh(new RoundedBoxGeometry(1.8, 1.35, 1.45, 6, 0.42), shell);
  head.position.y = 0.68;
  headPivot.add(head);

  const visor = new THREE.Mesh(new RoundedBoxGeometry(1.5, 0.86, 0.16, 5, 0.26), ink);
  visor.position.set(0, 0.72, 0.68);
  headPivot.add(visor);

  const eyes = new THREE.Group();
  eyes.position.set(0, 0.72, 0.775);
  headPivot.add(eyes);
  const eyeGeo = new THREE.CapsuleGeometry(0.085, 0.16, 6, 12);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.x = -0.33;
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeR.position.x = 0.33;
  eyes.add(eyeL, eyeR);

  [-1, 1].forEach((s) => {
    const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.18, 32), titanium);
    ear.rotation.z = Math.PI / 2;
    ear.position.set(s * 0.98, 0.68, 0);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.22, 24), ink);
    cap.rotation.z = Math.PI / 2;
    cap.position.copy(ear.position);
    headPivot.add(ear, cap);
  });

  // --- Antenna -------------------------------------------------------------
  const antenna = new THREE.Group();
  antenna.position.y = 1.33;
  headPivot.add(antenna);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.5, 12), titanium);
  stem.position.y = 0.25;
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 20), tipMat);
  tip.position.y = 0.56;
  antenna.add(stem, tip);

  // --- Animation state (no per-frame allocation) -----------------------------
  let blinkIn = 2.5;
  let blink = 0;
  let antA = 0;
  let antW = 0;
  let prevYaw = 0;
  let jump = 0;
  let happy = 0;
  let spin = 0;
  let pokes = 0;
  let sx = 1;
  let sy = 1;
  let tilt = 0;

  function update(dt, t, look) {
    dt = Math.min(Math.max(dt, 0), 0.05); // never negative: exp(-k*dt) must damp, not amplify
    const k = 9;

    // Head follows the pointer.
    headPivot.rotation.y = damp(headPivot.rotation.y, look.x * 0.8, k, dt);
    headPivot.rotation.x = damp(headPivot.rotation.x, look.y * 0.42, k, dt);
    headPivot.rotation.z = damp(headPivot.rotation.z, -look.x * 0.1, k, dt);

    // Eyes slide inside the visor (independent of the head turn).
    eyes.position.x = damp(eyes.position.x, look.x * 0.16, 14, dt);
    eyes.position.y = damp(eyes.position.y, 0.72 - look.y * 0.1, 14, dt);

    // Blink and happy expression.
    blinkIn -= dt;
    if (blinkIn <= 0) {
      blink = 0.14;
      blinkIn = 2 + Math.random() * 3.5;
    }
    blink = Math.max(0, blink - dt);
    let tx = 1;
    let ty = 1;
    if (happy > 0) {
      happy -= dt;
      tx = 1.35;
      ty = 0.38;
      tilt = 0.35;
    } else {
      tilt = damp(tilt, 0, 10, dt);
    }
    if (blink > 0 && happy <= 0) ty = 0.1;
    sx = damp(sx, tx, 18, dt);
    sy = damp(sy, ty, 22, dt);
    eyeL.scale.set(sx, sy, 1);
    eyeL.rotation.z = tilt;
    eyeR.scale.set(sx, sy, 1);
    eyeR.rotation.z = -tilt;

    // Antenna spring reacts to head movement.
    const yawVel = (headPivot.rotation.y - prevYaw) / Math.max(dt, 0.001);
    prevYaw = headPivot.rotation.y;
    antW += (-80 * antA - 6 * antW - yawVel * 3) * dt;
    antA = clamp(antA + antW * dt, -0.8, 0.8);
    antenna.rotation.z = antA;
    tipMat.emissiveIntensity = 1.2 + Math.sin(t * 3) * 0.4;

    // Gentle hover bob, hop with squash, spin.
    let y = Math.sin(t * 1.8) * 0.05;
    let squash = 1;
    if (jump > 0) {
      jump += dt / 0.75;
      if (jump >= 1) jump = 0;
      else {
        y += Math.sin(Math.PI * jump) * 0.3;
        squash = 1 + 0.07 * Math.sin(jump * Math.PI * 2);
      }
    }
    rig.position.y = y;
    rig.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
    if (spin > 0) {
      spin += dt / 1.1;
      if (spin >= 1) {
        spin = 0;
        rig.rotation.y = 0;
      } else {
        rig.rotation.y = (1 - Math.pow(1 - spin, 3)) * Math.PI * 2;
      }
    }
  }

  function poke() {
    jump = 0.0001;
    happy = 1.4;
    pokes++;
    if (pokes % 3 === 0) spin = 0.0001;
  }

  function dispose() {
    root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
    [shell, titanium, ink, eyeMat, tipMat].forEach((m) => m.dispose());
  }

  return { root, rig, headPivot, update, poke, dispose };
}