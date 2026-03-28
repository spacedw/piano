import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { FIRST_NOTE, LAST_NOTE, isBlackKey, getWhiteKeyIndex } from '@/engine/constants';
import styles from './index.module.css';

// ─── Layout constants ───────────────────────────────────────────────────────
const TOTAL_WHITE = 52;
const WKW = 0.221;    // white key width
const WKH = 0.13;     // white key height  (Y)
const WKD = 1.2;      // white key depth   (Z)
const BKW = 0.133;    // black key width
const BKH = 0.23;     // black key height
const BKD = 0.73;     // black key depth
const OFFSET_X = -(TOTAL_WHITE * WKW) / 2;
const KEY_TOP = WKH;  // Y of the white-key top surface
const UPS = 1.8;      // units-per-second for note fall speed
const LOOK_AHEAD = 2.4; // seconds of notes rendered above keys
const NOTE_POOL = 200;  // max simultaneous note meshes

// ─── Camera presets ─────────────────────────────────────────────────────────
const PRESETS = [
    {
        name: 'Front',
        pos: new THREE.Vector3(0, 3.2, 6.5),
        target: new THREE.Vector3(0, 0.4, 0.6),
    },
    {
        name: 'Stage',
        pos: new THREE.Vector3(-4.5, 4.5, 5.0),
        target: new THREE.Vector3(0, 0.3, 0.6),
    },
    {
        name: 'Player',
        pos: new THREE.Vector3(0, 1.5, 3.8),
        target: new THREE.Vector3(0, 0.7, -0.3),
    },
];

function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

// ─── Component ──────────────────────────────────────────────────────────────
export default function Piano3D({
    activeNotes = new Map(),
    songActiveNotes = [],
    visibleNotes = [],
    currentTime = 0,
    width = 1200,
    height = 240,
}) {
    const canvasRef = useRef(null);

    // Three.js object refs (never trigger re-renders)
    const rendererRef = useRef(null);
    const cameraRef = useRef(null);
    const keyMeshesRef = useRef([]);        // [88] key meshes
    const noteMeshesRef = useRef([]);       // pool of note meshes
    const noteMatRef = useRef({});          // { rightActive, rightIdle, leftActive, leftIdle }
    const frameIdRef = useRef(null);
    const camLookAtRef = useRef(PRESETS[0].target.clone());
    const transitionRef = useRef(null);     // active camera lerp

    // Latest-prop refs (written by effects, read by rAF loop)
    const activeNotesRef = useRef(activeNotes);
    const songActiveNotesRef = useRef(songActiveNotes);
    const visibleNotesRef = useRef(visibleNotes);
    const currentTimeRef = useRef(currentTime);

    const [presetIdx, setPresetIdx] = useState(0);

    // ── Scene setup (once on mount) ─────────────────────────────────────────
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Renderer
        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
        renderer.setSize(width, height);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        rendererRef.current = renderer;

        // Scene
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0A0A0B);
        scene.fog = new THREE.FogExp2(0x0A0A0B, 0.042);

        // Camera
        const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
        camera.position.copy(PRESETS[0].pos);
        camera.lookAt(PRESETS[0].target);
        cameraRef.current = camera;

        // ── Lights ──────────────────────────────────────────────────────────
        scene.add(new THREE.AmbientLight(0xffffff, 0.32));

        const sun = new THREE.DirectionalLight(0xffffff, 1.1);
        sun.position.set(2, 9, 6);
        sun.castShadow = true;
        sun.shadow.mapSize.set(1024, 1024);
        Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -2, far: 30 });
        scene.add(sun);

        // Warm fill from front to give keys dimension
        const fill = new THREE.DirectionalLight(0xfff5e0, 0.25);
        fill.position.set(0, 1, 8);
        scene.add(fill);

        // Subtle cool accent from below
        const cool = new THREE.DirectionalLight(0x4466aa, 0.15);
        cool.position.set(0, -3, 5);
        scene.add(cool);

        // Warm point light over the key area for glow
        const keyGlow = new THREE.PointLight(0xC9A96E, 0.5, 7);
        keyGlow.position.set(0, 1.2, 1.8);
        scene.add(keyGlow);

        // ── Piano body ──────────────────────────────────────────────────────
        const lacquer = new THREE.MeshStandardMaterial({
            color: 0x0D0D10,
            roughness: 0.06,
            metalness: 0.3,
        });
        const bodyW = TOTAL_WHITE * WKW + 0.4;

        // Platform
        const platform = new THREE.Mesh(new THREE.BoxGeometry(bodyW, 0.14, WKD + 0.5), lacquer);
        platform.position.set(0, -0.07, WKD / 2 + 0.05);
        platform.receiveShadow = true;
        scene.add(platform);

        // Back panel
        const backPanel = new THREE.Mesh(new THREE.BoxGeometry(bodyW, 0.55, 0.08), lacquer);
        backPanel.position.set(0, 0.28, -0.04);
        scene.add(backPanel);

        // Front rail (fallboard edge)
        const frontRail = new THREE.Mesh(new THREE.BoxGeometry(bodyW, 0.055, 0.07), lacquer);
        frontRail.position.set(0, 0.028, WKD + 0.08);
        scene.add(frontRail);

        // Side cheeks
        const cheekGeo = new THREE.BoxGeometry(0.08, 0.55, WKD + 0.5);
        const leftCheek = new THREE.Mesh(cheekGeo, lacquer);
        leftCheek.position.set(OFFSET_X - 0.22, 0.28, WKD / 2 + 0.05);
        scene.add(leftCheek);
        const rightCheek = new THREE.Mesh(cheekGeo, lacquer);
        rightCheek.position.set(-OFFSET_X + 0.22, 0.28, WKD / 2 + 0.05);
        scene.add(rightCheek);

        // ── Keys ────────────────────────────────────────────────────────────
        const whiteMat = new THREE.MeshStandardMaterial({
            color: 0xF5F0E8, roughness: 0.28, metalness: 0.0,
        });
        const blackMat = new THREE.MeshStandardMaterial({
            color: 0x1A1A1E, roughness: 0.11, metalness: 0.08,
        });

        const keyMeshes = new Array(88);
        for (let midi = FIRST_NOTE; midi <= LAST_NOTE; midi++) {
            const black = isBlackKey(midi);
            const wi = getWhiteKeyIndex(midi);
            const mat = (black ? blackMat : whiteMat).clone();
            mat.emissive = new THREE.Color(0x000000);

            let geo, x, y, z;
            if (black) {
                geo = new THREE.BoxGeometry(BKW, BKH, BKD);
                x = OFFSET_X + wi * WKW;
                y = BKH / 2 + 0.03;
                z = BKD / 2;
            } else {
                geo = new THREE.BoxGeometry(WKW - 0.005, WKH, WKD);
                x = OFFSET_X + wi * WKW + WKW / 2;
                y = WKH / 2;
                z = WKD / 2;
            }

            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(x, y, z);
            mesh.castShadow = true;
            mesh.receiveShadow = !black;
            mesh.userData = { isBlack: black, baseY: y };
            scene.add(mesh);
            keyMeshes[midi - FIRST_NOTE] = mesh;
        }
        keyMeshesRef.current = keyMeshes;

        // ── Note pool ───────────────────────────────────────────────────────
        const noteGeo = new THREE.BoxGeometry(1, 1, 1); // scaled per note

        const noteMats = {
            rightActive: new THREE.MeshStandardMaterial({
                color: 0xC9A96E, emissive: 0xC9A96E, emissiveIntensity: 0.55,
                transparent: true, opacity: 0.93, roughness: 0.35, metalness: 0.05,
            }),
            rightIdle: new THREE.MeshStandardMaterial({
                color: 0xC9A96E, emissive: 0xC9A96E, emissiveIntensity: 0.2,
                transparent: true, opacity: 0.72, roughness: 0.35, metalness: 0.05,
            }),
            leftActive: new THREE.MeshStandardMaterial({
                color: 0x8B9DC3, emissive: 0x8B9DC3, emissiveIntensity: 0.55,
                transparent: true, opacity: 0.93, roughness: 0.35, metalness: 0.05,
            }),
            leftIdle: new THREE.MeshStandardMaterial({
                color: 0x8B9DC3, emissive: 0x8B9DC3, emissiveIntensity: 0.2,
                transparent: true, opacity: 0.72, roughness: 0.35, metalness: 0.05,
            }),
        };
        noteMatRef.current = noteMats;

        const noteMeshes = [];
        for (let i = 0; i < NOTE_POOL; i++) {
            const mesh = new THREE.Mesh(noteGeo, noteMats.rightIdle);
            mesh.visible = false;
            scene.add(mesh);
            noteMeshes.push(mesh);
        }
        noteMeshesRef.current = noteMeshes;

        // ── Animation loop ──────────────────────────────────────────────────
        const animate = () => {
            frameIdRef.current = requestAnimationFrame(animate);

            const kMeshes = keyMeshesRef.current;
            const aNotes = activeNotesRef.current;
            const sNotes = songActiveNotesRef.current;
            const vNotes = visibleNotesRef.current;
            const cTime = currentTimeRef.current;
            const nMeshes = noteMeshesRef.current;
            const mats = noteMatRef.current;

            // ── Update keys ────────────────────────────────────────────────
            const activeSet = new Map();
            aNotes.forEach((_, midi) => activeSet.set(midi, { source: 'user' }));
            sNotes.forEach(n => {
                if (!activeSet.has(n.midi))
                    activeSet.set(n.midi, { source: 'song', isRight: n.isRightHand !== false });
            });

            for (let i = 0; i < 88; i++) {
                const mesh = kMeshes[i];
                if (!mesh) continue;
                const midi = FIRST_NOTE + i;
                const active = activeSet.get(midi);
                const { isBlack, baseY } = mesh.userData;
                const mat = mesh.material;

                if (active) {
                    const isRight = active.source === 'user' || active.isRight;
                    if (active.source === 'user') {
                        mat.color.set(0xE8D5A8);
                        mat.emissive.set(0xC9A96E);
                        mat.emissiveIntensity = 0.5;
                    } else if (isRight) {
                        mat.color.set(isBlack ? 0xC9A96E : 0xE8D5A8);
                        mat.emissive.set(0xC9A96E);
                        mat.emissiveIntensity = 0.32;
                    } else {
                        mat.color.set(isBlack ? 0x8B9DC3 : 0xC5CEDF);
                        mat.emissive.set(0x8B9DC3);
                        mat.emissiveIntensity = 0.32;
                    }
                    mesh.position.y = baseY - (isBlack ? 0.022 : 0.028);
                } else {
                    mat.color.set(isBlack ? 0x1A1A1E : 0xF5F0E8);
                    mat.emissive.setScalar(0);
                    mat.emissiveIntensity = 0;
                    mesh.position.y = baseY;
                }
            }

            // ── Update notes ───────────────────────────────────────────────
            for (const m of nMeshes) m.visible = false;
            let ni = 0;

            for (const note of vNotes) {
                if (ni >= NOTE_POOL) break;
                const dt = note.time - cTime;
                if (dt > LOOK_AHEAD || dt + note.duration < -0.08) continue;

                const black = isBlackKey(note.midi);
                const wi = getWhiteKeyIndex(note.midi);
                const noteX = black
                    ? OFFSET_X + wi * WKW
                    : OFFSET_X + wi * WKW + WKW / 2;
                const noteW = black ? BKW * 0.8 : (WKW - 0.005) * 0.82;
                const noteD = black ? BKD * 0.8 : WKD * 0.72;
                const noteH = Math.max(note.duration * UPS, 0.04);
                const bottomY = KEY_TOP + dt * UPS;
                const noteZ = black ? BKD / 2 : WKD / 2;

                const isRight = note.isRightHand !== false;
                const isActive = note.time <= cTime && note.time + note.duration > cTime;

                const mesh = nMeshes[ni++];
                mesh.material = isRight
                    ? (isActive ? mats.rightActive : mats.rightIdle)
                    : (isActive ? mats.leftActive : mats.leftIdle);
                mesh.position.set(noteX, bottomY + noteH / 2, noteZ);
                mesh.scale.set(noteW, noteH, noteD);
                mesh.visible = true;
            }

            // ── Camera transition ──────────────────────────────────────────
            const tr = transitionRef.current;
            if (tr) {
                const elapsed = Math.min((Date.now() - tr.t0) / tr.dur, 1);
                const s = easeInOut(elapsed);
                camera.position.lerpVectors(tr.fromPos, tr.toPos, s);
                camLookAtRef.current.lerpVectors(tr.fromLook, tr.toLook, s);
                camera.lookAt(camLookAtRef.current);
                if (elapsed >= 1) transitionRef.current = null;
            }

            renderer.render(scene, camera);
        };

        animate();

        return () => {
            cancelAnimationFrame(frameIdRef.current);
            renderer.dispose();
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Resize ──────────────────────────────────────────────────────────────
    useEffect(() => {
        const r = rendererRef.current;
        const c = cameraRef.current;
        if (!r || !c) return;
        r.setSize(width, height);
        c.aspect = width / height;
        c.updateProjectionMatrix();
    }, [width, height]);

    // ── Prop → ref sync ─────────────────────────────────────────────────────
    useEffect(() => { activeNotesRef.current = activeNotes; }, [activeNotes]);
    useEffect(() => { songActiveNotesRef.current = songActiveNotes; }, [songActiveNotes]);
    useEffect(() => { visibleNotesRef.current = visibleNotes; }, [visibleNotes]);
    useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);

    // ── Camera preset switch ─────────────────────────────────────────────────
    const switchPreset = (idx) => {
        const cam = cameraRef.current;
        if (!cam) return;
        const p = PRESETS[idx];
        transitionRef.current = {
            fromPos: cam.position.clone(),
            fromLook: camLookAtRef.current.clone(),
            toPos: p.pos.clone(),
            toLook: p.target.clone(),
            t0: Date.now(),
            dur: 650,
        };
        setPresetIdx(idx);
    };

    return (
        <div className={styles.container}>
            <canvas ref={canvasRef} className={styles.canvas} />
            <div className={styles.camControls}>
                {PRESETS.map((p, i) => (
                    <button
                        key={p.name}
                        className={`${styles.camBtn} ${presetIdx === i ? styles.active : ''}`}
                        onClick={() => switchPreset(i)}
                        title={`Camera: ${p.name}`}
                    >
                        {p.name}
                    </button>
                ))}
            </div>
        </div>
    );
}
