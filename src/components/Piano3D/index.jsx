import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
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
const UPS = 1.4;        // units-per-second for note fall speed
const LOOK_AHEAD = 4.0; // seconds of notes visible
const NOTE_POOL = 300;

// ─── Camera presets ─────────────────────────────────────────────────────────
const PRESETS = [
    {
        name: 'Front',
        pos: new THREE.Vector3(0, 6, 16),
        target: new THREE.Vector3(0, 0.5, 0),
    },
    {
        name: 'Stage',
        pos: new THREE.Vector3(-9, 8, 15),
        target: new THREE.Vector3(0, 0.3, -1),
    },
    {
        name: 'Player',
        pos: new THREE.Vector3(0, 1.8, 6.5),
        target: new THREE.Vector3(0, 0.15, 0.6),
    },
];

function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

// ─── Grand piano body + concert hall ────────────────────────────────────────
// COORDINATE NOTE:
//   ExtrudeGeometry shapes are drawn in the XY plane, then rotateX(-PI/2) is applied.
//   This bakes: shape_Y → -world_Z   (so positive shapeY ends up behind the viewer)
//   To put the piano front at world +Z, use negative shapeY.
//   To put the tail at world -Z, use positive shapeY.
function buildScene(scene) {
    const bodyW = PIANO_W + 0.5;
    const bodyD = 6.5;
    const rimH = 0.20;  // must stay below black key top (0.26) so keys are visible
    const hw = bodyW / 2;

    // Shape-space Y values (→ negated world Z after rotateX(-PI/2))
    const rearZ_s  = bodyD - WKD;          // = 5.3  →  world Z = -5.3  (tail)
    const frontZ_s = -(WKD + 0.15);        // = -1.35 →  world Z = +1.35 (front edge)

    // ── Materials ─────────────────────────────────────────────────────────
    const lacquer = new THREE.MeshStandardMaterial({
        color: 0x06060E, roughness: 0.10, metalness: 0.10, envMapIntensity: 0.45,
    });
    const lacquerInner = new THREE.MeshStandardMaterial({
        color: 0x0C0C18, roughness: 0.65, metalness: 0.0,
    });
    const metalMat = new THREE.MeshStandardMaterial({
        color: 0xC9A96E, roughness: 0.18, metalness: 0.88, envMapIntensity: 1.5,
    });
    const stringsMat = new THREE.MeshStandardMaterial({
        color: 0xBEA030, roughness: 0.22, metalness: 0.92,
    });

    // ── Main case shape ────────────────────────────────────────────────────
    const caseShape = new THREE.Shape();
    // Front edge (toward viewer  = negative shapeY → positive worldZ)
    caseShape.moveTo(-hw, frontZ_s);
    caseShape.lineTo( hw, frontZ_s);
    // Bass side (right, straight wall)
    caseShape.lineTo( hw + 0.12, -WKD * 0.3);
    caseShape.lineTo( hw + 0.08, -WKD);
    caseShape.lineTo( hw * 0.92,  rearZ_s * 0.22);
    caseShape.lineTo( hw * 0.82,  rearZ_s * 0.42);
    // Curved treble tail
    caseShape.quadraticCurveTo( hw * 0.52,  rearZ_s * 0.68,  hw * 0.16,  rearZ_s * 0.88);
    caseShape.quadraticCurveTo(0,            rearZ_s + 0.12, -hw * 0.16,  rearZ_s * 0.88);
    // Treble side (mirror)
    caseShape.lineTo(-hw * 0.82,  rearZ_s * 0.42);
    caseShape.lineTo(-hw * 0.92,  rearZ_s * 0.22);
    caseShape.lineTo(-hw - 0.08, -WKD);
    caseShape.lineTo(-hw - 0.12, -WKD * 0.3);
    caseShape.lineTo(-hw, frontZ_s);

    // Rim (extruded side walls)
    const rimGeo = new THREE.ExtrudeGeometry(caseShape, { depth: rimH, bevelEnabled: false });
    rimGeo.rotateX(-Math.PI / 2);
    const rim = new THREE.Mesh(rimGeo, lacquer);
    rim.position.y = -0.01;
    rim.castShadow = rim.receiveShadow = true;
    scene.add(rim);

    // Soundboard (flat surface inside)
    const boardGeo = new THREE.ShapeGeometry(caseShape);
    boardGeo.rotateX(-Math.PI / 2);
    const board = new THREE.Mesh(boardGeo, lacquerInner);
    board.position.y = 0.005;
    board.receiveShadow = true;
    scene.add(board);

    // ── Lid ───────────────────────────────────────────────────────────────
    const lhw       = hw - 0.12;
    const lidRearZ_s  = rearZ_s - 0.15;   // 5.15 → world Z = -5.15  (hinge edge)
    const lidFrontZ_s = -(WKD + 0.05);    // -1.25 → world Z = +1.25

    const lidShape = new THREE.Shape();
    lidShape.moveTo(-lhw, lidFrontZ_s);
    lidShape.lineTo( lhw, lidFrontZ_s);
    lidShape.lineTo( lhw + 0.08,  -WKD * 0.3);
    lidShape.lineTo( lhw * 0.90,   lidRearZ_s * 0.22);
    lidShape.lineTo( lhw * 0.80,   lidRearZ_s * 0.42);
    lidShape.quadraticCurveTo( lhw * 0.50,  lidRearZ_s * 0.68,  lhw * 0.14,  lidRearZ_s * 0.86);
    lidShape.quadraticCurveTo(0,             lidRearZ_s * 0.97, -lhw * 0.14,  lidRearZ_s * 0.86);
    lidShape.lineTo(-lhw * 0.80,   lidRearZ_s * 0.42);
    lidShape.lineTo(-lhw * 0.90,   lidRearZ_s * 0.22);
    lidShape.lineTo(-lhw - 0.08,  -WKD * 0.3);
    lidShape.lineTo(-lhw, lidFrontZ_s);

    const lidGeo = new THREE.ExtrudeGeometry(lidShape, { depth: 0.035, bevelEnabled: false });
    lidGeo.rotateX(-Math.PI / 2);
    const lid = new THREE.Mesh(lidGeo, lacquer);
    lid.castShadow = true;

    // Pivot the lid from its rear hinge (world Z ≈ -5.15)
    // Group position = hinge world position
    // Lid position inside group offsets geometry so rear edge sits at group origin
    const lidHingeZ = -lidRearZ_s; // = -5.15 world Z
    const lidGroup = new THREE.Group();
    lid.position.set(0, -rimH, lidRearZ_s); // brings rear edge of lid to group local origin
    lidGroup.add(lid);
    lidGroup.position.set(0, rimH, lidHingeZ);
    lidGroup.rotation.x = -0.50;            // ~29° open — front rises upward
    lid.castShadow = true;
    scene.add(lidGroup);

    // ── Lid prop (support stick) ───────────────────────────────────────────
    const propGeo = new THREE.CylinderGeometry(0.014, 0.014, 1.85, 6);
    const prop = new THREE.Mesh(propGeo, metalMat);
    prop.position.set(hw * 0.38, rimH + 0.82, -0.5);
    prop.rotation.z = 0.06;
    prop.rotation.x = -0.20;
    prop.castShadow = true;
    scene.add(prop);

    // ── Piano strings (visible through open lid) ───────────────────────────
    const baseStrGeo = new THREE.CylinderGeometry(0.002, 0.002, 1, 4);
    for (let i = 0; i < 32; i++) {
        const t = i / 31;
        // Bass (i=0, t=0) → long strings on left; treble (i=31, t=1) → short on right
        const strLen = 3.2 - t * 2.2; // 3.2 → 1.0
        const sx = OFFSET_X + t * PIANO_W + PIANO_W / 32 * 0.5;
        const sz = -(WKD * 0.3 + strLen * 0.5);
        const strMesh = new THREE.Mesh(baseStrGeo, stringsMat);
        strMesh.position.set(sx, 0.06, sz);
        strMesh.scale.set(1, strLen, 1);   // scale along Y before rotation
        strMesh.rotation.x = Math.PI / 2;  // cylinder Y → world Z
        scene.add(strMesh);
    }

    // ── 3 legs ────────────────────────────────────────────────────────────
    const legGeo = new THREE.CylinderGeometry(0.068, 0.052, 1.85, 12);
    const legPositions = [
        [-hw + 0.5,   WKD * 0.75],          // front-left  (treble side)
        [ hw - 0.5,   WKD * 0.75],          // front-right (bass side)
        [ 0,         -rearZ_s * 0.55],       // rear center  (-2.92 world Z)
    ];
    for (const [lx, lz] of legPositions) {
        const leg = new THREE.Mesh(legGeo, lacquer);
        leg.position.set(lx, -0.93, lz);
        leg.castShadow = true;
        scene.add(leg);
        const caster = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), metalMat);
        caster.position.set(lx, -1.86, lz);
        scene.add(caster);
    }

    // ── Music desk ────────────────────────────────────────────────────────
    const desk = new THREE.Mesh(
        new THREE.BoxGeometry(PIANO_W * 0.62, 0.78, 0.03), lacquer
    );
    desk.position.set(0, rimH + 0.46, -0.3);
    desk.rotation.x = -0.20;
    desk.castShadow = true;
    scene.add(desk);
    // Brackets
    [-(PIANO_W * 0.22), PIANO_W * 0.22].forEach(bx => {
        const br = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.55, 0.22), metalMat);
        br.position.set(bx, rimH + 0.28, -0.14);
        scene.add(br);
    });

    // ── Fallboard (front lip above keys) ──────────────────────────────────
    const fall = new THREE.Mesh(
        new THREE.BoxGeometry(bodyW + 0.04, 0.065, 0.12), lacquer
    );
    fall.position.set(0, rimH * 0.5, WKD + 0.13);
    scene.add(fall);

    // ── Piano bench ───────────────────────────────────────────────────────
    const seatMat = new THREE.MeshStandardMaterial({ color: 0x100808, roughness: 0.88, metalness: 0.0 });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.08, 0.68), seatMat);
    seat.position.set(0.2, -0.52, 3.6);
    seat.castShadow = seat.receiveShadow = true;
    scene.add(seat);
    const benchLegGeo = new THREE.CylinderGeometry(0.024, 0.020, 1.34, 8);
    [[-0.56, 3.28], [0.56, 3.28], [-0.56, 3.92], [0.56, 3.92]].forEach(([bx, bz]) => {
        const bl = new THREE.Mesh(benchLegGeo, metalMat);
        bl.position.set(bx + 0.2, -1.22, bz);
        bl.castShadow = true;
        scene.add(bl);
    });

    // ══════════════════════════════════════════════════════════════════════
    // ─── Concert Hall ────────────────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════

    // Stage floor — dark polished hardwood
    const stageMat = new THREE.MeshStandardMaterial({
        color: 0x120A02, roughness: 0.55, metalness: 0.02,
    });
    const stage = new THREE.Mesh(new THREE.PlaneGeometry(30, 26), stageMat);
    stage.rotation.x = -Math.PI / 2;
    stage.position.y = -1.87;
    stage.receiveShadow = true;
    scene.add(stage);

    // Back curtain / velvet backdrop
    const curtainMat = new THREE.MeshStandardMaterial({
        color: 0x04030A, roughness: 0.97, metalness: 0.0,
    });
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(30, 20, 0.35), curtainMat);
    backWall.position.set(0, 8.1, -11.2);
    backWall.receiveShadow = true;
    scene.add(backWall);

    // Side wings (theatrical flats)
    const wingGeo = new THREE.BoxGeometry(0.35, 18, 24);
    [-13.4, 13.4].forEach(x => {
        const wing = new THREE.Mesh(wingGeo, curtainMat);
        wing.position.set(x, 7.1, -2);
        wing.receiveShadow = true;
        scene.add(wing);
    });

    // Ceiling (dark — barely visible, closes the space)
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(30, 26), curtainMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = 9.5;
    scene.add(ceil);

    // Stage apron (front edge)
    const apron = new THREE.Mesh(new THREE.BoxGeometry(30, 0.18, 0.32), curtainMat);
    apron.position.set(0, -1.78, 4.2);
    scene.add(apron);

    // ── Lighting rig (decorative) ──────────────────────────────────────────
    const rigMat = new THREE.MeshStandardMaterial({ color: 0x121212, roughness: 0.7, metalness: 0.55 });
    const rigBar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 24, 6), rigMat);
    rigBar.rotation.z = Math.PI / 2;
    rigBar.position.set(0, 7.8, 0.5);
    scene.add(rigBar);
    [-7.5, 7.5].forEach(x => {
        const sup = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.6, 6), rigMat);
        sup.position.set(x, 8.6, 0.5);
        scene.add(sup);
    });
    // Stage light cans
    const canMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6, metalness: 0.6 });
    const lensMat = new THREE.MeshStandardMaterial({
        color: 0xffe8cc, emissive: 0xffe8cc, emissiveIntensity: 0.8, roughness: 0.2,
    });
    [-5.5, -2.5, 0, 2.5, 5.5].forEach(cx => {
        const can = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.09, 0.38, 8), canMat);
        can.position.set(cx, 7.62, 0.5);
        scene.add(can);
        const lens = new THREE.Mesh(new THREE.CircleGeometry(0.08, 8), lensMat);
        lens.rotation.x = Math.PI / 2;
        lens.position.set(cx, 7.43, 0.5);
        scene.add(lens);
    });

    // ── Audience silhouettes (dark, atmospheric) ───────────────────────────
    const silMat = new THREE.MeshStandardMaterial({
        color: 0x020105, roughness: 1.0, metalness: 0.0,
        transparent: true, opacity: 0.55,
    });
    const headGeo  = new THREE.SphereGeometry(0.20, 6, 5);
    const shldGeo  = new THREE.BoxGeometry(0.55, 0.28, 0.22);
    const rowConfigs = [
        { z: 5.8, count: 8,  y: -1.87 },
        { z: 7.2, count: 10, y: -1.70 },
        { z: 8.6, count: 12, y: -1.55 },
    ];
    for (const { z, count, y } of rowConfigs) {
        for (let i = 0; i < count; i++) {
            const t = i / (count - 1);
            const x = -9.5 + t * 19;
            const head = new THREE.Mesh(headGeo, silMat);
            head.position.set(x, y + 1.06, z);
            scene.add(head);
            const shld = new THREE.Mesh(shldGeo, silMat);
            shld.position.set(x, y + 0.72, z);
            scene.add(shld);
        }
    }
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
        renderer.toneMappingExposure = 1.5;
        rendererRef.current = renderer;

        // Scene
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x04040A);
        scene.fog = new THREE.FogExp2(0x04040A, 0.016);

        // Environment map (PBR reflections for glossy lacquer)
        const pmrem = new THREE.PMREMGenerator(renderer);
        const envTexture = pmrem.fromScene(new RoomEnvironment(0.01)).texture;
        scene.environment = envTexture;
        pmrem.dispose();

        // Camera
        const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 120);
        camera.position.copy(PRESETS[0].pos);
        camera.lookAt(PRESETS[0].target);
        cameraRef.current = camera;

        // ── Concert lighting ─────────────────────────────────────────────
        // Hemisphere: warm sky, deep cool ground — theatrical contrast
        const hemi = new THREE.HemisphereLight(0xFFF0D8, 0x08061A, 0.40);
        scene.add(hemi);

        // Main stage spotlight — focused, warm, from above-front
        const mainSpot = new THREE.SpotLight(0xFFFAF0, 4.0, 32, 0.52, 0.65, 1.0);
        mainSpot.position.set(0, 9, 5);
        mainSpot.target.position.set(0, 0, 0.5);
        mainSpot.castShadow = true;
        mainSpot.shadow.mapSize.set(2048, 2048);
        Object.assign(mainSpot.shadow.camera, { near: 0.5, far: 35 });
        mainSpot.shadow.bias = -0.001;
        scene.add(mainSpot);
        scene.add(mainSpot.target);

        // Second spot from upper-left (gives depth to piano body)
        const spot2 = new THREE.SpotLight(0xFFEEDD, 2.8, 28, 0.62, 0.6, 1.2);
        spot2.position.set(-6, 8, 7);
        spot2.target.position.set(-1, 0, 0);
        scene.add(spot2);
        scene.add(spot2.target);

        // Blue-violet atmospheric fill from audience direction — Einaudi signature
        const blueAtmo = new THREE.DirectionalLight(0x2A40C0, 0.38);
        blueAtmo.position.set(0, 2, 14);
        scene.add(blueAtmo);

        // Warm amber side (bass side) for body glow
        const warmSide = new THREE.DirectionalLight(0xFF9933, 0.25);
        warmSide.position.set(11, 4, 2);
        scene.add(warmSide);

        // Cool edge light from behind — defines piano silhouette
        const rimLight = new THREE.DirectionalLight(0x4477BB, 0.18);
        rimLight.position.set(0, 6, -14);
        scene.add(rimLight);

        // ── Build scene ──────────────────────────────────────────────────
        buildScene(scene);

        // ── Keys ────────────────────────────────────────────────────────
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

        // ── Note pool ───────────────────────────────────────────────────
        const noteGeo = new THREE.BoxGeometry(1, 1, 1);
        const mkMat = (color, ei, op) => new THREE.MeshStandardMaterial({
            color, emissive: color, emissiveIntensity: ei,
            transparent: true, opacity: op, roughness: 0.3, metalness: 0.05,
            depthWrite: false,
        });
        const noteMats = {
            rightActive: mkMat(0xC9A96E, 0.65, 0.93),
            rightIdle:   mkMat(0xC9A96E, 0.20, 0.70),
            leftActive:  mkMat(0x8B9DC3, 0.65, 0.93),
            leftIdle:    mkMat(0x8B9DC3, 0.20, 0.70),
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

        // ── Animation loop ──────────────────────────────────────────────
        const animate = () => {
            frameIdRef.current = requestAnimationFrame(animate);

            const kMeshes = keyMeshesRef.current;
            const aNotes  = activeNotesRef.current;
            const sNotes  = songActiveNotesRef.current;
            const vNotes  = visibleNotesRef.current;
            const cTime   = currentTimeRef.current;
            const nMeshes = noteMeshesRef.current;
            const mats    = noteMatRef.current;

            // ── Update key visuals ───────────────────────────────────────
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

            // ── Update falling notes ─────────────────────────────────────
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
                const noteW = black ? BKW * 0.78 : (WKW - 0.005) * 0.80;
                const noteD = 0.12;
                const noteH = Math.max(note.duration * UPS, 0.06);
                const bottomY = KEY_TOP + dt * UPS;
                const noteZ = black ? BKD / 2 : WKD / 2;

                const isRight  = note.isRightHand !== false;
                const isActive = note.time <= cTime && note.time + note.duration > cTime;

                const mesh = nMeshes[ni++];
                mesh.material = isRight
                    ? (isActive ? mats.rightActive : mats.rightIdle)
                    : (isActive ? mats.leftActive  : mats.leftIdle);
                mesh.position.set(noteX, bottomY + noteH / 2, noteZ);
                mesh.scale.set(noteW, noteH, noteD);
                mesh.visible = true;
            }

            // ── Camera transition ────────────────────────────────────────
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

        // ── Resize observer ──────────────────────────────────────────────
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

    // ── Camera preset switch ─────────────────────────────────────────────────
    const switchPreset = useCallback((idx) => {
        const cam = cameraRef.current;
        if (!cam) return;
        const p = PRESETS[idx];
        transitionRef.current = {
            fromPos:  cam.position.clone(),
            fromLook: camLookAtRef.current.clone(),
            toPos:    p.pos.clone(),
            toLook:   p.target.clone(),
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
