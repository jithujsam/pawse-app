import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
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
 * Limitations, honestly: these models have no facial rig (no blend shapes), so expressions come
 * from body animation and posture, not from the face. Accessories are not shown in 3D.
 */
import { markPet3d, MODEL, type Species3D } from "./pet3d-support";
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

/** Coat colours for the fur material ("Main" on the dog and fox; a tint over the cat's texture). */
const COAT: Record<Species3D, Record<string, string>> = {
  dog: { golden: "#c8803f", cocoa: "#6b4126", cream: "#e8cfa5" },
  fox: { red: "#d8692c", arctic: "#eef0f4", silver: "#70737f" },
  cat: { tabby: "#ffffff", ginger: "#ffc48a", tuxedo: "#55555c" },
};

/** Turned a little toward the viewer, so the face reads. */
const ROTATION: Record<Species3D, number> = { dog: -0.38, fox: -0.38, cat: -0.38 };

function restingClip(mood: Mood): Clip {
  if (mood === "dying") return "dying";
  if (mood === "sick" || mood === "sad") return "sick";
  if (mood === "waiting") return "waiting";
  return "idle";
}
function clipFor(mood: Mood, gesture: Gesture): Clip {
  if (gesture === "petted" || gesture === "treat") return "petted";
  if (gesture === "giggle" || gesture === "hop") return "giggle";
  if (mood === "hurt") return "hurt";
  if (mood === "happy" && gesture !== "none") return "happy";
  return restingClip(mood);
}

interface Props { species: Species3D; coat?: string; stage: Stage; mood: Mood; age: number; gesture?: Gesture; look?: { x: number; y: number }; reduced?: boolean }

function Model({ species, coat, stage, mood, gesture = "none", look = { x: 0, y: 0 }, reduced }: Props) {
  const gltf = useLoader(GLTFLoader, MODEL[species], (l) => { (l as GLTFLoader).setMeshoptDecoder(MeshoptDecoder); }) as GLTF;
  useEffect(() => markPet3d("ok"), []);
  const { scene, mixer, actions, head, neck } = useMemo(() => {
    const scene = cloneSkinned(gltf.scene) as THREE.Group;
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
    return { scene, mixer, actions, head, neck };
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
        const isFur = species === "cat" || m.name === "Main";
        const base = isFur ? tint.clone() : (m.userData.base as THREE.Color).clone();
        // Age: the coat loses colour and lightens a touch, like a greying muzzle, not a tint.
        if (isFur || m.name === "Main_Light") { const hsl = { h: 0, s: 0, l: 0 }; base.getHSL(hsl); base.setHSL(hsl.h, hsl.s * (1 - grey * 1.4), Math.min(0.9, hsl.l + grey * 0.12)); }
        m.color.copy(base);
        m.roughness = 0.85; m.metalness = 0;
      }
    });
  }, [scene, species, coat, stage]);

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

  useFrame((_, dt) => {
    if (reduced) return;
    const step = Math.min(dt, 0.05);
    const sickSlow = mood === "sick" || mood === "sad" ? 0.7 : 1;
    mixer.update(step * STAGE_SPEED[stage] * sickSlow);
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
    const tired = mood === "sick" || mood === "sad";
    if (mood !== "dying") {
      pose(head, (b) => {
        b.rotateX(STAGE_DROOP[stage] + (tired ? 0.08 : 0));
        b.rotateY(Math.max(-1, Math.min(1, look.x)) * 0.35);
        if (stage === "baby") b.scale.multiplyScalar(1.22);
      });
      if (species !== "cat") pose(neck, (b) => b.rotateX(STAGE_DROOP[stage] * 0.5));
    }
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

export function Pet3D({ size, fallback, onFail, ...props }: Props & { size: number; fallback: ReactNode; onFail?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const on = useOnScreen(ref);
  return (
    <div ref={ref} className="pet3d" style={{ width: size, height: size }} aria-label={`${props.species}, ${props.stage}, ${props.mood}`} role="img">
      <Guard fallback={fallback} onFail={onFail}>
        <Suspense fallback={fallback}>
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
        </Suspense>
      </Guard>
    </div>
  );
}
