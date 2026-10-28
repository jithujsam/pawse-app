import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { describePet } from "./pet-label";
import { tuxedoPixels } from "./pets";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { Stage } from "@detox/engine";
import type { Gesture, Mood } from "./Companion";

/**
 * Animated 3D companions (rigged, CC0 models by Quaternius; see public/models/LICENSE.md).
 * The same age, mood and gesture props as the 2D art drive skeletal animation clips, cross-faded,
 * plus a little procedural posing on top (head droop with age, bigger head for babies, looking at
 * your finger). Rendering stops when the pet is off screen or the app is hidden.
 *
 * The models have no facial rig, so the dog gets a small one built here: eyelids, brows, tears and a
 * tongue parented to the head bone, plus ear and tail posing and floating hearts, z's and drops.
 * Accessories are not shown in 3D.
 */
import { markPet3d, modelFor, type Species3D } from "./pet3d-support";
export type { Species3D };

type Clip = "idle" | "waiting" | "happy" | "hurt" | "sick" | "dying" | "petted" | "giggle";
/** Clip per state. `once` clips play through, then fall back to the mood's resting clip. */
const CLIPS: Record<Species3D, Record<Clip, { name: string; once?: boolean; hold?: boolean }>> = {
  dog: {
    idle: { name: "Idle" }, waiting: { name: "Idle_2" }, sick: { name: "Idle_2_HeadLow" }, dying: { name: "Death", once: true, hold: true },
    happy: { name: "Jump_ToIdle", once: true }, hurt: { name: "Idle_HitReact_Left", once: true }, petted: { name: "Idle_HitReact_Right", once: true }, giggle: { name: "Jump_ToIdle", once: true },
  },
  fox: {
    idle: { name: "Idle" }, waiting: { name: "Idle_2" }, sick: { name: "Idle_2_HeadLow" }, dying: { name: "Death", once: true, hold: true },
    happy: { name: "Jump_ToIdle", once: true }, hurt: { name: "Idle_HitReact_Left", once: true }, petted: { name: "Idle_HitReact_Right", once: true }, giggle: { name: "Jump_ToIdle", once: true },
  },
  cat: {
    idle: { name: "Idle" }, waiting: { name: "Idle" }, sick: { name: "Idle" }, dying: { name: "Death", once: true, hold: true },
    happy: { name: "Jump_Start", once: true }, hurt: { name: "Idle", once: true }, petted: { name: "Headbutt", once: true }, giggle: { name: "Jump_Start", once: true },
  },
};

const STAGE_SCALE: Record<Stage, number> = { baby: 0.74, young: 0.88, adult: 1, middle: 1.02, old: 1, frail: 0.95, dead: 0.95 };
const STAGE_SPEED: Record<Stage, number> = { baby: 1.2, young: 1.1, adult: 1, middle: 0.88, old: 0.72, frail: 0.58, dead: 0.5 };
const STAGE_GREY: Record<Stage, number> = { baby: 0, young: 0, adult: 0, middle: 0.18, old: 0.34, frail: 0.42, dead: 0.42 };
const STAGE_DROOP: Record<Stage, number> = { baby: 0, young: 0, adult: 0, middle: 0.05, old: 0.16, frail: 0.26, dead: 0.26 };

/** Coat colours for the fur material ("Main" on the dog and fox; a tint over the cat's texture). The tuxedo is repainted, not tinted. */
const COAT: Record<Species3D, Record<string, string>> = {
  dog: { golden: "#c8803f", cocoa: "#6b4126", cream: "#e8cfa5" },
  fox: { red: "#d8692c", arctic: "#eef0f4", silver: "#70737f" },
  cat: { tabby: "#ffffff", ginger: "#ffc48a", tuxedo: "#ffffff" },
};

/** The tuxedo's repainted atlas, built once per source texture. */
const tuxedoMaps = new WeakMap<THREE.Texture, THREE.Texture>();
function tuxedoMap(src: THREE.Texture): THREE.Texture {
  let out = tuxedoMaps.get(src);
  if (!out) {
    const img = src.image as CanvasImageSource & { width: number; height: number };
    const canvas = document.createElement("canvas");
    canvas.width = img.width; canvas.height = img.height;
    const cx = canvas.getContext("2d")!;
    cx.drawImage(img, 0, 0);
    const data = cx.getImageData(0, 0, canvas.width, canvas.height);
    tuxedoPixels(data.data);
    cx.putImageData(data, 0, 0);
    out = new THREE.CanvasTexture(canvas);
    out.flipY = src.flipY;
    out.colorSpace = src.colorSpace;
    tuxedoMaps.set(src, out);
  }
  return out;
}

/** Turned a little toward the viewer, so the face reads. */
const ROTATION: Record<Species3D, number> = { dog: -0.38, fox: -0.38, cat: -0.38 };

function restingClip(mood: Mood): Clip {
  if (mood === "dying") return "dying";
  if (mood === "sick" || mood === "sad") return "sick";
  if (mood === "waiting") return "waiting";
  return "idle";
}
function clipFor(mood: Mood, gesture: Gesture): Clip {
  if (gesture === "petted") return "petted";
  if (gesture === "giggle" || gesture === "hop") return "giggle";
  if (mood === "hurt") return "hurt";
  if (mood === "happy" && gesture !== "none") return "happy";
  return restingClip(mood);
}


/** What the face and body should be doing for a mood and gesture. All values ease toward these. */
interface Expr { wide: number; lid: number; brow: number; lift: number; tongue: number; tears: number; ears: number; tail: number; bob: number; tilt: number }
function expressionFor(mood: Mood, gesture: Gesture, stage: Stage): Expr {
  const e: Expr = { wide: 1, lid: 0, brow: 0, lift: 0, tongue: 0, tears: 0, ears: 0, tail: 0, bob: 0, tilt: 0 };
  const tired = stage === "old" || stage === "frail" || stage === "dead";
  if (tired) { e.wide = 0.92; e.lid = 0.38; e.ears = -0.6; e.brow = 0.5; }
  switch (mood) {
    case "happy": e.wide = 1.06; e.lift = 0.5; e.tongue = 0.55; e.tail = 1; e.bob = 1; e.ears = 0.3; break;
    case "waiting": e.wide = 1.18; e.lift = 0.8; e.brow = 0.55; e.tilt = 1; e.tail = 0.35; e.ears = 0.6; break;
    case "hurt": e.wide = 1.15; e.lid = 0.3; e.brow = 1; e.tears = 1; e.ears = -1; break;
    case "sad": e.lid = 0.42; e.brow = 1; e.tears = 0.6; e.ears = -1; break;
    case "sick": e.lid = 0.5; e.brow = 0.8; e.ears = -0.9; e.tears = stage === "frail" ? 0.4 : 0; break;
    case "dying": e.lid = 1; e.ears = -1; break;
    default: break;
  }
  if (mood !== "dying") {
    if (gesture === "petted") { e.lid = 0.82; e.brow = 0; e.lift = 0.3; e.tongue = 0.8; e.tail = 1.6; e.ears = -0.3; e.tears = 0; }
    else if (gesture === "giggle" || gesture === "hop") { e.lid = 0.7; e.brow = 0; e.lift = 0.6; e.tongue = 1; e.tail = 1.6; e.bob = 1.6; e.tears = 0; }
    else if (gesture === "yawn" || gesture === "nap") { e.lid = 1; e.tongue = gesture === "yawn" ? 1 : 0; }
    else if (gesture === "dizzy") { e.lid = 0.5; e.brow = 0.6; }
  }
  return e;
}

interface Face { balls: THREE.Mesh[]; glints: THREE.Mesh[]; lids: THREE.Mesh[]; brows: THREE.Mesh[]; tears: THREE.Mesh[]; tongue: THREE.Mesh; eyeR: number; eyes: THREE.Vector3[] }

/**
 * Builds the face from the eye geometry itself, so it lands where this model's eyes are. Everything is parented to
 * the head bone through a group that cancels the rig's own rotation and scale, which lets us work in plain model
 * space (x right, y up, z forward). Returns null for a model with no separate eye parts.
 */
function buildFace(scene: THREE.Group, head: THREE.Object3D): Face | null {
  scene.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  const white: THREE.Vector3[] = [];
  const nose: THREE.Vector3[] = [];
  scene.traverse((o) => {
    const sm = o as THREE.SkinnedMesh;
    if (!sm.isSkinnedMesh) return;
    const name = (sm.material as THREE.Material).name;
    if (name !== "Eyes_White" && name !== "Black") return;
    sm.skeleton.update();
    const n = sm.geometry.attributes.position.count;
    for (let i = 0; i < n; i++) { sm.getVertexPosition(i, v); v.applyMatrix4(sm.matrixWorld); (name === "Black" ? nose : white).push(v.clone()); }
  });
  if (white.length < 6) return null;
  const mid = white.reduce((a, p) => a + p.x, 0) / white.length;
  const eyes = [white.filter((p) => p.x > mid), white.filter((p) => p.x <= mid)].map((ps) => {
    const c = ps.reduce((a, p) => a.add(p), new THREE.Vector3()).divideScalar(ps.length);
    return { c, r: Math.max(...ps.map((p) => p.distanceTo(c))) };
  });
  // The eye parts reach well into the skull; the part that shows is about half that.
  const eyeR = ((eyes[0].r + eyes[1].r) / 2) * 0.5;

  const face = new THREE.Group();
  face.matrixAutoUpdate = false;
  face.matrix.copy(head.matrixWorld).invert();
  head.add(face);

  const skin = new THREE.MeshStandardMaterial({ name: "Main", color: "#c8803f" });
  const ink = new THREE.MeshStandardMaterial({ color: "#26170d", roughness: 0.7 });
  // A rounder, glossier eyeball over the model's tiny one, so the eyes can open wide or droop.
  const out = (c: THREE.Vector3) => new THREE.Vector3(Math.sign(c.x - mid) * eyeR * 0.12, 0, eyeR * 0.25);
  const balls = eyes.map(({ c }) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(eyeR * 1.05, 18, 14), new THREE.MeshStandardMaterial({ color: "#1b1009", roughness: 0.25, metalness: 0.1 }));
    m.position.copy(c).add(out(c)); face.add(m); return m;
  });
  const glintMat = new THREE.MeshBasicMaterial({ color: "#ffffff" });
  const glints = eyes.map(({ c }) => {
    const g = new THREE.Mesh(new THREE.SphereGeometry(eyeR * 0.3, 10, 8), glintMat);
    g.position.copy(c).add(out(c)).add(new THREE.Vector3(eyeR * 0.3, eyeR * 0.38, eyeR * 0.82)); face.add(g); return g;
  });
  const lids = eyes.map(({ c }) => {
    const lid = new THREE.Mesh(new THREE.SphereGeometry(eyeR * 1.17, 20, 14, 0, Math.PI * 2, 0, (110 * Math.PI) / 180), skin);
    lid.position.copy(c).add(out(c)); face.add(lid); return lid;
  });
  const brows = eyes.map(({ c }, i) => {
    const b = new THREE.Mesh(new THREE.CapsuleGeometry(eyeR * 0.26, eyeR * 1.6, 3, 8), ink);
    b.userData.home = c.clone().add(new THREE.Vector3(0, eyeR * 1.75, eyeR * 0.55)); b.userData.side = i === 0 ? 1 : -1;
    b.position.copy(b.userData.home as THREE.Vector3); face.add(b); return b;
  });
  const tears = eyes.map(({ c }) => {
    const t = new THREE.Mesh(new THREE.SphereGeometry(eyeR * 0.3, 10, 8), new THREE.MeshStandardMaterial({ color: "#9fd4ff", transparent: true, opacity: 0, roughness: 0.2 }));
    t.userData.home = c.clone().add(new THREE.Vector3(0, -eyeR * 0.9, eyeR * 0.9)); t.position.copy(t.userData.home as THREE.Vector3); face.add(t); return t;
  });
  // The nose is the part of the "Black" material furthest forward; the tongue hangs just below it.
  const tip = nose.reduce((a, p) => (p.z > a.z ? p : a), nose[0] ?? new THREE.Vector3());
  const tongue = new THREE.Mesh(new THREE.SphereGeometry(eyeR * 0.8, 12, 8), new THREE.MeshStandardMaterial({ color: "#ee7f8c", roughness: 0.6 }));
  tongue.userData.home = tip.clone().add(new THREE.Vector3(0, -eyeR * 2.6, -eyeR * 1.1));
  tongue.position.copy(tongue.userData.home as THREE.Vector3); tongue.scale.set(1, 0, 1); face.add(tongue);
  return { balls, glints, lids, brows, tears, tongue, eyeR, eyes: eyes.map((e) => e.c) };
}

interface Props { species: Species3D; coat?: string; breed?: string; stage: Stage; mood: Mood; age: number; gesture?: Gesture; look?: { x: number; y: number }; reduced?: boolean }

function Model({ species, coat, breed, stage, mood, gesture = "none", look = { x: 0, y: 0 }, reduced }: Props) {
  const gltf = useLoader(GLTFLoader, modelFor(species, breed), (l) => { (l as GLTFLoader).setMeshoptDecoder(MeshoptDecoder); }) as GLTF;
  useEffect(() => markPet3d("ok"), []);
  const { scene, mixer, actions, head, neck, face, ears, tail, catEyes } = useMemo(() => {
    const scene = cloneSkinned(gltf.scene) as THREE.Group;
    const found: Record<string, THREE.Object3D> = {};
    scene.traverse((o) => { if (["Head", "Ear1.L", "Ear1.R", "Tail1", "Tail2"].includes(o.name)) found[o.name] = o; });
    const face = found.Head ? buildFace(scene, found.Head) : null;
    // Fit to a 1-unit tall box standing on the floor, centred. Bounds come from the posed skeleton.
    scene.updateMatrixWorld(true);
    scene.traverse((o) => { const sm = o as THREE.SkinnedMesh; if (sm.isSkinnedMesh) { sm.skeleton.update(); sm.computeBoundingBox(); } });
    const box = new THREE.Box3().setFromObject(scene, true);
    const size = box.getSize(new THREE.Vector3());
    const k = 1 / Math.max(size.y, size.z * 0.62, 1e-6);
    scene.scale.setScalar(k);
    const c = box.getCenter(new THREE.Vector3());
    scene.position.set(-c.x * k, -box.min.y * k, -c.z * k);
    const mixer = new THREE.AnimationMixer(scene);
    const byName = new Map<string, THREE.AnimationClip>();
    for (const clip of gltf.animations) {
      const short = clip.name.split("|").pop()!;
      if (!byName.has(short) || clip.name === short) byName.set(short, clip);
    }
    const actions = new Map<string, THREE.AnimationAction>();
    for (const [n, clip] of byName) actions.set(n, mixer.clipAction(clip));
    let head: THREE.Object3D | undefined, neck: THREE.Object3D | undefined;
    scene.traverse((o) => {
      if (o.name === "Head") head = o;
      if (o.name === "Neck3" || (!neck && o.name === "Body" && species === "cat")) neck = o;
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.frustumCulled = false;
        mesh.material = Array.isArray(mesh.material) ? mesh.material.map((m) => m.clone()) : mesh.material.clone();
      }
    });
    const ears = [found["Ear1.L"], found["Ear1.R"]].filter(Boolean);
    const tail = [found.Tail1, found.Tail2].filter(Boolean);
    // The cat's eyes are dark patches in its texture, so the tuxedo's white eyes are spheres on the face.
    const catEyes: THREE.Mesh[] = [];
    if (species === "cat") for (const [x, y] of [[-0.19, 0.57], [0.19, 0.54]]) {
      // The scene is scaled, so the radius is divided by its world scale.
      const radius = 0.05 / scene.getWorldScale(new THREE.Vector3()).x;
      const eye = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 12), new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.3 }));
      scene.add(eye);
      scene.worldToLocal(eye.position.set(x, y, 0.53));
      catEyes.push(eye);
    }
    return { scene, mixer, actions, head, neck, face, ears, tail, catEyes };
  }, [gltf, species]);

  // Coat colour and age greying, applied to cloned materials so other instances are untouched.
  useEffect(() => {
    const grey = STAGE_GREY[stage];
    const tint = new THREE.Color(COAT[species][coat ?? ""] ?? Object.values(COAT[species])[0]);
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      for (const m of (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as THREE.MeshStandardMaterial[]) {
        if (!m.color) continue;
        m.userData.base ??= m.color.clone();
        m.userData.map ??= m.map;
        const isFur = species === "cat" || m.name === "Main";
        const base = isFur ? tint.clone() : (m.userData.base as THREE.Color).clone();
        // Age: the coat loses colour and lightens a touch, like a greying muzzle, not a tint.
        if (isFur || m.name === "Main_Light") { const hsl = { h: 0, s: 0, l: 0 }; base.getHSL(hsl); base.setHSL(hsl.h, hsl.s * (1 - grey * 1.4), Math.min(0.9, hsl.l + grey * 0.12)); }
        m.color.copy(base);
        if (species === "cat" && m.userData.map) { m.map = coat === "tuxedo" ? tuxedoMap(m.userData.map) : m.userData.map; m.needsUpdate = true; }
        m.roughness = 0.85; m.metalness = 0;
      }
    });
    catEyes.forEach((e) => (e.visible = coat === "tuxedo"));
  }, [scene, species, coat, stage, catEyes]);

  // Cross-fade between clips whenever the state changes.
  const current = useRef<THREE.AnimationAction | null>(null);
  const want = clipFor(mood, gesture);
  useEffect(() => {
    const spec = CLIPS[species][want];
    const rest = CLIPS[species][restingClip(mood)];
    const next = actions.get(spec.name) ?? actions.get(rest.name) ?? actions.get("Idle");
    if (!next) return;
    next.reset();
    next.setLoop(spec.once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    next.clampWhenFinished = !!spec.hold;
    next.enabled = true;
    if (current.current && current.current !== next) next.crossFadeFrom(current.current, 0.35, true);
    next.play();
    current.current = next;
    if (reduced) mixer.update(spec.hold ? next.getClip().duration : 0.01);
    if (!spec.once || spec.hold) return;
    const back = () => {
      const r = actions.get(rest.name) ?? actions.get("Idle");
      if (!r || current.current !== next) return;
      r.reset(); r.setLoop(THREE.LoopRepeat, Infinity); r.enabled = true; r.crossFadeFrom(next, 0.4, true); r.play(); current.current = r;
    };
    const onDone = (e: { action: THREE.AnimationAction }) => { if (e.action === next) back(); };
    mixer.addEventListener("finished", onDone);
    return () => mixer.removeEventListener("finished", onDone);
  }, [want, mood, species, actions, mixer, reduced]);

  const flinch = useRef(0);
  useEffect(() => { if (mood === "hurt") flinch.current = 0.5; }, [mood]);
  const scale = STAGE_SCALE[stage];

  // Procedural posing on top of the clip: droop with age, a baby's bigger head, eyes on your finger.
  // A bone the current clip doesn't animate keeps last frame's pose, so undo our own tweak first.
  const pose = (bone: THREE.Object3D | undefined, apply: (b: THREE.Object3D) => void) => {
    if (!bone) return;
    const u = bone.userData as { post?: THREE.Quaternion; pre?: THREE.Quaternion; spost?: THREE.Vector3; spre?: THREE.Vector3 };
    if (u.post && bone.quaternion.equals(u.post)) bone.quaternion.copy(u.pre!);
    if (u.spost && bone.scale.equals(u.spost)) bone.scale.copy(u.spre!);
    u.pre = bone.quaternion.clone(); u.spre = bone.scale.clone();
    apply(bone);
    u.post = bone.quaternion.clone(); u.spost = bone.scale.clone();
  };

  // The face and body language ease toward the mood's expression; `t` drives blinking, wagging and tears.
  const ex = useRef<Expr>(expressionFor("idle", "none", "adult"));
  const blinkAt = useRef({ next: 1.5, until: 0 });
  const wantEx = expressionFor(mood, gesture, stage);
  const drive = (t: number, dt: number, live: boolean) => {
    const k = live ? 1 - Math.exp(-dt * 9) : 1;
    for (const key of Object.keys(wantEx) as (keyof Expr)[]) ex.current[key] += (wantEx[key] - ex.current[key]) * k;
    const e = ex.current;
    if (live && t > blinkAt.current.next) { blinkAt.current = { next: t + 2.2 + Math.random() * 4, until: t + 0.14 }; }
    const blinking = live && t < blinkAt.current.until && mood !== "dying";
    if (face) {
      const close = Math.max(e.lid, blinking ? 1 : 0);
      const phi = (-62 + 80 * close) * (Math.PI / 180);
      face.balls.forEach((m, i) => { m.scale.setScalar(e.wide); face.glints[i].scale.setScalar(e.wide * (1 - 0.35 * Math.min(1, e.lid))); });
      for (const lid of face.lids) { lid.rotation.x = phi; lid.visible = close > 0.04; }
      for (const b of face.brows) {
        const home = b.userData.home as THREE.Vector3, side = b.userData.side as number;
        b.position.set(home.x, home.y + face.eyeR * 0.7 * e.lift - face.eyeR * 0.5 * e.brow * 0.3, home.z);
        b.rotation.z = -side * e.brow * 0.7 + Math.PI / 2;
        b.visible = Math.abs(e.brow) + e.lift > 0.05 && close < 0.9;
        b.scale.y = 1 - 0.25 * e.brow;
      }
      const pant = e.tongue > 0.5 && live ? 1 + Math.sin(t * 9) * 0.12 : 1;
      face.tongue.scale.set(1, Math.max(0.0001, e.tongue * pant), 1);
      face.tongue.visible = e.tongue > 0.04;
      face.tears.forEach((tear, i) => {
        const ph = live ? ((t * 0.55 + i * 0.37) % 1) : 0.4;
        const home = tear.userData.home as THREE.Vector3;
        tear.position.set(home.x, home.y - ph * face.eyeR * 4.5, home.z);
        (tear.material as THREE.MeshStandardMaterial).opacity = Math.min(1, e.tears * 1.4) * Math.sin(Math.PI * ph);
        tear.visible = e.tears > 0.05;
      });
    }
    // Ears perk or droop; the tail wags when it is glad and hangs when it is not.
    ears.forEach((b, i) => pose(b, (bb) => { bb.rotateX(-e.ears * 0.5); bb.rotateZ((i === 0 ? 1 : -1) * e.ears * 0.25); }));
    tail.forEach((b, i) => pose(b, (bb) => { bb.rotateY(live ? Math.sin(t * 9 - i) * 0.5 * e.tail * (1 - i * 0.3) : 0); bb.rotateX(e.tail > 0.3 ? 0 : 0.35 * (1 - e.tail)); }));
    if (mood !== "dying") pose(head, (b) => {
      b.rotateX(STAGE_DROOP[stage] + (mood === "sick" || mood === "sad" ? 0.08 : 0) - (live ? Math.sin(t * 6) * 0.05 * e.bob : 0));
      b.rotateY(Math.max(-1, Math.min(1, look.x)) * 0.35);
      b.rotateZ(live ? Math.sin(t * 1.1) * 0.14 * e.tilt + 0.1 * e.tilt : 0.1 * e.tilt);
      if (stage === "baby") b.scale.multiplyScalar(1.22);
    });
  };
  useEffect(() => { if (reduced) { drive(0, 0, false); mixer.update(0); } });

  useFrame((state, dt) => {
    if (reduced) return;
    const step = Math.min(dt, 0.05);
    const sickSlow = mood === "sick" || mood === "sad" ? 0.7 : 1;
    mixer.update(step * STAGE_SPEED[stage] * sickSlow);
    drive(state.clock.elapsedTime, step, true);
    if (mood !== "dying" && species !== "cat") pose(neck, (b) => b.rotateX(STAGE_DROOP[stage] * 0.5));
    if (flinch.current > 0) {
      flinch.current = Math.max(0, flinch.current - step);
      scene.rotation.z = Math.sin(flinch.current * 40) * 0.05 * flinch.current * 2;
    } else scene.rotation.z = 0;
  });

  const lying = mood === "dying";
  return <group scale={scale * (lying ? 0.82 : 1)} position={[lying ? -0.12 : 0, 0, 0]} rotation={[0, ROTATION[species], 0]}><primitive object={scene} /></group>;
}

class Guard extends Component<{ fallback: ReactNode; onFail?: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFail?.(); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

/** Stops the render loop while the pet is off screen or the app is in the background. */
function useOnScreen(ref: React.RefObject<HTMLElement | null>) {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const el = ref.current;
    let visible = true, shown = document.visibilityState === "visible";
    const update = () => setOn(visible && shown);
    const io = typeof IntersectionObserver !== "undefined" && el ? new IntersectionObserver(([e]) => { visible = e.isIntersecting; update(); }) : null;
    if (io && el) io.observe(el);
    const vis = () => { shown = document.visibilityState === "visible"; update(); };
    document.addEventListener("visibilitychange", vis);
    return () => { io?.disconnect(); document.removeEventListener("visibilitychange", vis); };
  }, [ref]);
  return on;
}

/** Little things that float up from the pet while it feels something: hearts, z's, a sweat drop. */
function fxFor(mood: Mood, gesture: Gesture): "heart" | "zzz" | "drop" | null {
  if (mood === "dying" || gesture === "nap") return "zzz";
  if (gesture === "petted" || gesture === "giggle" || (mood === "happy" && gesture === "hop")) return "heart";
  if (mood === "sick" || mood === "sad" || mood === "hurt") return "drop";
  return null;
}

/** `loading` is shown while the model downloads, `fallback` only if 3D can't run, so the 2D art never flashes in first. */
export function Pet3D({ size, fallback, loading, onFail, ...props }: Props & { size: number; fallback: ReactNode; loading?: ReactNode; onFail?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const on = useOnScreen(ref);
  const fx = props.reduced ? null : fxFor(props.mood, props.gesture ?? "none");
  return (
    <div ref={ref} className="pet3d" style={{ width: size, height: size }} aria-label={describePet(props.species, props.stage, props.mood)} role="img">
      <Guard fallback={fallback} onFail={onFail}>
        <Suspense fallback={loading ?? fallback}>
          <Canvas frameloop={on && !props.reduced ? "always" : "demand"} dpr={[1, 2]} gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
            camera={{ fov: 26, position: [0, 0.66, 2.8], near: 0.1, far: 20 }} onCreated={({ camera }) => camera.lookAt(0, 0.5, 0)}>
            <hemisphereLight args={["#fff8ee", "#b8a48c", 1.6]} />
            <directionalLight position={[2, 3, 2.5]} intensity={1.6} />
            <directionalLight position={[-2, 1.5, -1]} intensity={0.4} />
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
              <circleGeometry args={[0.42, 40]} />
              <meshBasicMaterial color="#000000" transparent opacity={0.08} />
            </mesh>
            <Model {...props} />
          </Canvas>
          {fx && <span className={`pet3d-fx fx-${fx}`} aria-hidden><i /><i /><i /></span>}
        </Suspense>
      </Guard>
    </div>
  );
}
