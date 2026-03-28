import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { FIRST_NOTE, LAST_NOTE, isBlackKey, getWhiteKeyIndex } from '@/engine/constants';
import styles from './index.module.css';

// ─── Key layout ─────────────────────────────────────────────────────────────
const TOTAL_WHITE = 52;
const WKW = 0.221;    // white key width
const WKH = 0.13;     // white key height  (Y)
const WKD = 1.2;      // white key depth   (Z)
const BKW = 0.133;    // black key width
const BKH = 0.23;     // black key height
const BKD = 0.73;     // black key depth
const OFFSET_X = -(TOTAL_WHITE * WKW) / 2;
const KEY_TOP = WKH;
const PIANO_W = TOTAL_WHITE * WKW;

// ─── Note fall ──────────────────────────────────────────────────────────────
const UPS = 2.8;        // units-per-second (faster for taller canvas)
const LOOK_AHEAD = 5.0; // seconds of notes visible
const NOTE_POOL = 300;

// ─── Camera presets ─────────────────────────────────────────────────────────
const PRESETS = [
    {
        name: 'Front',
        pos: new THREE.Vector3(0, 5.5, 10),
        target: new THREE.Vector3(0, 1.2, -1),
    },
    {
        name: 'Stage',
        pos: new THREE.Vector3(-6, 6.5, 8),
        target: new THREE.Vector3(0, 1.0, -1),
    },
    {
        name: 'Player',
        pos: new THREE.Vector3(0, 3.2, 5.5),
        target: new THREE.Vector3(0, 1.5, -2),
    },
];

function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

// ─── Grand piano body builder ───────────────────────────────────────────────
function buildGrandPianoBody(scene) {
    const lacquer = new THREE.MeshStandardMaterial({
        color: 0x080810, roughness: 0.05, metalness: 0.35,
    });
    const lacquerInner = new THREE.MeshStandardMaterial({
        color: 0x12121A, roughness: 0.08, metalness: 0.2,
    });
    const metalMat = new THREE.MeshStandardMaterial({
        color: 0xC9A96E, roughness: 0.25, metalness: 0.85,
    });

    const bodyW = PIANO_W + 0.5;
    const bodyD = 6.5;    // grand piano is deep
    const rimH = 0.22;

    // ── Main case (rim) ─────────────────────────────────────────────────────
    // Approximated with an elongated shape. Using a CatmullRom curve for the
    // curved tail of the grand piano.
    const caseShape = new THREE.Shape();
    const hw = bodyW / 2;
    const rearZ = -bodyD + WKD;
    // Front edge
    caseShape.moveTo(-hw, WKD + 0.15);
    caseShape.lineTo(hw, WKD + 0.15);
    // Right side
    caseShape.lineTo(hw + 0.1, WKD);
    caseShape.lineTo(hw * 0.95, WKD * 0.5);
    caseShape.lineTo(hw * 0.75, rearZ * 0.3);
    // Curved tail
    caseShape.quadraticCurveTo(hw * 0.5, rearZ * 0.7, hw * 0.15, rearZ * 0.85);
    caseShape.quadraticCurveTo(0, rearZ, -hw * 0.15, rearZ * 0.85);
    // Left side
    caseShape.lineTo(-hw * 0.75, rearZ * 0.3);
    caseShape.lineTo(-hw * 0.95, WKD * 0.5);
    caseShape.lineTo(-hw - 0.1, WKD);
    caseShape.lineTo(-hw, WKD + 0.15);

    // Rim (extruded walls)
    const extrudeSettings = { depth: rimH, bevelEnabled: false };
    const rimGeo = new THREE.ExtrudeGeometry(caseShape, extrudeSettings);
    rimGeo.rotateX(-Math.PI / 2);
    const rim = new THREE.Mesh(rimGeo, lacquer);
    rim.position.y = -0.01;
    rim.receiveShadow = true;
    rim.castShadow = true;
    scene.add(rim);

    // Soundboard (flat surface under strings)
    const boardGeo = new THREE.ShapeGeometry(caseShape);
    boardGeo.rotateX(-Math.PI / 2);
    const board = new THREE.Mesh(boardGeo, lacquerInner);
    board.position.y = 0.005;
    board.receiveShadow = true;
    scene.add(board);

    // ── Lid (open at ~30°) ──────────────────────────────────────────────────
    const lidShape = new THREE.Shape();
    const lhw = bodyW / 2 - 0.1;
    const lidRearZ = rearZ + 0.15;
    lidShape.moveTo(-lhw, 0.05);
    lidShape.lineTo(lhw, 0.05);
    lidShape.lineTo(lhw * 0.93, -WKD * 0.3);
    lidShape.lineTo(lhw * 0.73, lidRearZ * 0.3);
    lidShape.quadraticCurveTo(lhw * 0.45, lidRearZ * 0.7, lhw * 0.12, lidRearZ * 0.82);
    lidShape.quadraticCurveTo(0, lidRearZ * 0.95, -lhw * 0.12, lidRearZ * 0.82);
    lidShape.lineTo(-lhw * 0.73, lidRearZ * 0.3);
    lidShape.lineTo(-lhw * 0.93, -WKD * 0.3);
    lidShape.lineTo(-lhw, 0.05);

    const lidGeo = new THREE.ExtrudeGeometry(lidShape, { depth: 0.04, bevelEnabled: false });
    lidGeo.rotateX(-Math.PI / 2);
    const lid = new THREE.Mesh(lidGeo, lacquer);
    lid.position.set(0, rimH + 0.02, 0);
    // Pivot at the back hinge — rotate open ~28°
    const lidGroup = new THREE.Group();
    lidGroup.add(lid);
    lidGroup.position.set(0, rimH, -0.1);
    lidGroup.rotation.x = -0.49; // ~28° open
    lid.position.y = 0;
    lid.castShadow = true;
    scene.add(lidGroup);

    // ── Lid prop (stick holding lid open) ────────────────────────────────────
    const propGeo = new THREE.CylinderGeometry(0.015, 0.015, 1.6, 6);
    const prop = new THREE.Mesh(propGeo, metalMat);
    prop.position.set(hw * 0.3, rimH + 0.75, -0.5);
    prop.rotation.z = 0.08;
    prop.rotation.x = -0.2;
    prop.castShadow = true;
    scene.add(prop);

    // ── Legs (3 legs) ───────────────────────────────────────────────────────
    const legGeo = new THREE.CylinderGeometry(0.06, 0.05, 1.8, 8);
    const legPositions = [
        [-hw + 0.4, WKD - 0.1],   // front-left
        [hw - 0.4, WKD - 0.1],    // front-right
        [0, rearZ * 0.55],         // rear-center
    ];
    for (const [lx, lz] of legPositions) {
        const leg = new THREE.Mesh(legGeo, lacquer);
        leg.position.set(lx, -0.9, lz);
        leg.castShadow = true;
        scene.add(leg);
        // Gold caster
        const caster = new THREE.Mesh(
            new THREE.SphereGeometry(0.06, 8, 6),
            metalMat
        );
        caster.position.set(lx, -1.8, lz);
        scene.add(caster);
    }

    // ── Music rack (the small shelf above keys) ─────────────────────────────
    const rackGeo = new THREE.BoxGeometry(PIANO_W * 0.65, 0.8, 0.03);
    const rack = new THREE.Mesh(rackGeo, lacquer);
    rack.position.set(0, rimH + 0.5, -0.25);
    rack.rotation.x = -0.15;
    rack.castShadow = true;
    scene.add(rack);

    // ── Fallboard (front edge above keys) ───────────────────────────────────
    const fallGeo = new THREE.BoxGeometry(bodyW, 0.06, 0.1);
    const fall = new THREE.Mesh(fallGeo, lacquer);
    fall.position.set(0, rimH * 0.5, WKD + 0.12);
    scene.add(fall);

    // ── Floor / reflective surface ──────────────────────────────────────────
    const floorGeo = new THREE.PlaneGeometry(30, 30);
    const floorMat = new THREE.MeshStandardMaterial({
        color: 0x0A0A0E,
        roughness: 0.35,
        metalness: 0.15,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.82;
    floor.receiveShadow = true;
    scene.add(floor);
}

// ─── Component ──────────────────────────────────────────────────────────────
export default function Piano3D({
    activeNotes = new Map(),
    songActiveNotes = [],
    visibleNotes = [],
    currentTime = 0,
    width = 1200,
    fullHeight = false,
}) {
    const containerRef = useRef(null);
    const canvasRef = useRef(null);
    const rendererRef = useRef(null);
    const cameraRef = useRef(null);
    const keyMeshesRef = useRef([]);
    const noteMeshesRef = useRef([]);
    const noteMatRef = useRef({});
    const frameIdRef = useRef(null);
    const camLookAtRef = useRef(PRESETS[0].target.clone());
    const transitionRef = useRef(null);
    const sizeRef = useRef({ w: width, h: 600 });

    const activeNotesRef = useRef(activeNotes);
    const songActiveNotesRef = useRef(songActiveNotes);
    const visibleNotesRef = useRef(visibleNotes);
    const currentTimeRef = useRef(currentTime);

    const [presetIdx, setPresetIdx] = useState(0);

    // ── Scene setup ─────────────────────────────────────────────────────────
    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const h = container.clientHeight || 600;
        const w = container.clientWidth || width;
        sizeRef.current = { w, h };

        // Renderer
        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
        renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
        renderer.setSize(w, h);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.1;
        rendererRef.current = renderer;

        // Scene
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x06060A);
        scene.fog = new THREE.FogExp2(0x06060A, 0.035);

        // Camera
        const camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 120);
        camera.position.copy(PRESETS[0].pos);
        camera.lookAt(PRESETS[0].target);
        cameraRef.current = camera;

        // ── Lights ──────────────────────────────────────────────────────────
        scene.add(new THREE.AmbientLight(0xffffff, 0.25));

        const sun = new THREE.DirectionalLight(0xfff8f0, 1.4);
        sun.position.set(3, 12, 6);
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        Object.assign(sun.shadow.camera, {
            left: -10, right: 10, top: 10, bottom: -6, far: 40,
        });
        sun.shadow.bias = -0.001;
        scene.add(sun);

        // Warm fill from front
        const fill = new THREE.DirectionalLight(0xfff0d0, 0.3);
        fill.position.set(0, 2, 10);
        scene.add(fill);

        // Cool rim light from behind
        const rim = new THREE.DirectionalLight(0x3355aa, 0.35);
        rim.position.set(0, 4, -8);
        scene.add(rim);

        // Warm spotlight on keys
        const spot = new THREE.SpotLight(0xC9A96E, 1.2, 15, 0.5, 0.7, 1.5);
        spot.position.set(0, 6, 2);
        spot.target.position.set(0, 0, 0.5);
        scene.add(spot);
        scene.add(spot.target);

        // ── Grand piano body ────────────────────────────────────────────────
        buildGrandPianoBody(scene);

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
        const noteGeo = new THREE.BoxGeometry(1, 1, 1);
        const mkMat = (color, ei, op) => new THREE.MeshStandardMaterial({
            color, emissive: color, emissiveIntensity: ei,
            transparent: true, opacity: op, roughness: 0.3, metalness: 0.05,
            depthWrite: false,
        });
        const noteMats = {
            rightActive: mkMat(0xC9A96E, 0.6, 0.92),
            rightIdle: mkMat(0xC9A96E, 0.18, 0.68),
            leftActive: mkMat(0x8B9DC3, 0.6, 0.92),
            leftIdle: mkMat(0x8B9DC3, 0.18, 0.68),
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

            // ── Update keys ─────────────────────────────────────────────────
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

            // ── Update notes ────────────────────────────────────────────────
            for (const m of nMeshes) m.visible = false;
            let ni = 0;

            for (const note of vNotes) {
                if (ni >= NOTE_POOL) break;
                const dt = note.time - cTime;
                if (dt > LOOK_AHEAD || dt + note.duration < -0.1) continue;

                const black = isBlackKey(note.midi);
                const wi = getWhiteKeyIndex(note.midi);
                const noteX = black
                    ? OFFSET_X + wi * WKW
                    : OFFSET_X + wi * WKW + WKW / 2;
                const noteW = black ? BKW * 0.78 : (WKW - 0.005) * 0.8;
                const noteD = 0.12;
                const noteH = Math.max(note.duration * UPS, 0.06);
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

            // ── Camera transition ───────────────────────────────────────────
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

        // ── Resize observer ─────────────────────────────────────────────────
        const ro = new ResizeObserver(([entry]) => {
            const { width: cw, height: ch } = entry.contentRect;
            if (cw < 1 || ch < 1) return;
            sizeRef.current = { w: cw, h: ch };
            renderer.setSize(cw, ch);
            camera.aspect = cw / ch;
            camera.updateProjectionMatrix();
        });
        ro.observe(container);

        return () => {
            ro.disconnect();
            cancelAnimationFrame(frameIdRef.current);
            renderer.dispose();
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Prop → ref sync ─────────────────────────────────────────────────────
    useEffect(() => { activeNotesRef.current = activeNotes; }, [activeNotes]);
    useEffect(() => { songActiveNotesRef.current = songActiveNotes; }, [songActiveNotes]);
    useEffect(() => { visibleNotesRef.current = visibleNotes; }, [visibleNotes]);
    useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);

    // ── Camera preset switch ────────────────────────────────────────────────
    const switchPreset = useCallback((idx) => {
        const cam = cameraRef.current;
        if (!cam) return;
        const p = PRESETS[idx];
        transitionRef.current = {
            fromPos: cam.position.clone(),
            fromLook: camLookAtRef.current.clone(),
            toPos: p.pos.clone(),
            toLook: p.target.clone(),
            t0: Date.now(),
            dur: 700,
        };
        setPresetIdx(idx);
    }, []);

    return (
        <div
            ref={containerRef}
            className={`${styles.container} ${fullHeight ? styles.fullHeight : ''}`}
        >
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
