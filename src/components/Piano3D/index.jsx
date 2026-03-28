import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { FIRST_NOTE, LAST_NOTE, isBlackKey, getWhiteKeyIndex } from '@/engine/constants';
import styles from './index.module.css';

// ─── Key layout constants ────────────────────────────────────────────────────
const TOTAL_WHITE = 52;
const WKW = 0.221;   // white key width  (~2.2 cm)
const WKH = 0.13;    // white key height (~1.3 cm)
const WKD = 1.20;    // white key depth  (~12 cm)
const BKW = 0.133;   // black key width
const BKH = 0.23;    // black key height (above white key surface)
const BKD = 0.73;    // black key depth
const OFFSET_X   = -(TOTAL_WHITE * WKW) / 2;
const PIANO_W    = TOTAL_WHITE * WKW;   // ~11.49 units
const BODY_W     = PIANO_W + 0.50;
const BODY_D     = 6.50;
const RIM_H      = 0.42;               // piano case wall height
const KEY_BASE_Y = RIM_H - WKH;        // white key bottom = 0.29
const KEY_TOP    = RIM_H;              // white key surface = note landing Y

// ─── Note fall ───────────────────────────────────────────────────────────────
const UPS        = 1.4;
const LOOK_AHEAD = 4.0;
const NOTE_POOL  = 300;

// ─── Camera presets ──────────────────────────────────────────────────────────
const PRESETS = [
    { name: 'Front',  pos: new THREE.Vector3(0, 6, 16),    target: new THREE.Vector3(0, 0.5,  0)   },
    { name: 'Stage',  pos: new THREE.Vector3(-9, 8, 15),   target: new THREE.Vector3(0, 0.3, -1)   },
    { name: 'Player', pos: new THREE.Vector3(0, 1.8, 6.5), target: new THREE.Vector3(0, 0.15, 0.6) },
];

function easeInOut(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }

// ════════════════════════════════════════════════════════════════════════════
// ─── Procedural Canvas Textures (no external assets) ────────────────────────
// ════════════════════════════════════════════════════════════════════════════

/** Dark polished hardwood planks — stage floor */
function makeDarkWoodTex(w = 1024, h = 1024) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#060402';
    ctx.fillRect(0, 0, w, h);
    const planks = 10, ph = h / planks;
    for (let p = 0; p < planks; p++) {
        const py = p * ph;
        ctx.fillStyle = p % 2 === 0 ? '#070503' : '#060402';
        ctx.fillRect(0, py, w, ph - 1);
        const lines = 10 + (p * 3 % 6);
        for (let g = 0; g < lines; g++) {
            const gy = py + (g / lines) * ph;
            ctx.strokeStyle = '#0E0906';
            ctx.lineWidth = 0.6 + (g % 3) * 0.4;
            ctx.globalAlpha = 0.18 + (g % 4) * 0.08;
            ctx.beginPath(); ctx.moveTo(0, gy);
            for (let x = 0; x < w; x += 18)
                ctx.lineTo(x, gy + Math.sin(x * 0.018 + g) * 5 + ((x * g % 7) - 3) * 0.4);
            ctx.stroke();
        }
        ctx.globalAlpha = 0.6;
        ctx.strokeStyle = '#020100'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(w, py); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    return new THREE.CanvasTexture(c);
}

/** Warm walnut veneer — piano body outer curved walls */
function makeWalnutTex(w = 512, h = 512) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#3A1B08';
    ctx.fillRect(0, 0, w, h);
    for (let g = 0; g < 60; g++) {
        const sy = (g / 60) * h;
        ctx.strokeStyle = g % 3 === 0 ? '#4E2610' : '#2A1206';
        ctx.lineWidth   = 0.5 + (g % 3) * 0.5;
        ctx.globalAlpha = 0.25 + (g % 5) * 0.08;
        ctx.beginPath(); ctx.moveTo(0, sy);
        for (let x = 0; x < w; x += 12)
            ctx.lineTo(x, sy + Math.sin(x * 0.03 + g * 0.7) * 10 + Math.sin(x * 0.08) * 4);
        ctx.stroke();
    }
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0,   'rgba(107,53,21,0.08)');
    grad.addColorStop(0.5, 'rgba(80,38,12,0)');
    grad.addColorStop(1,   'rgba(107,53,21,0.08)');
    ctx.globalAlpha = 1; ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
    return new THREE.CanvasTexture(c);
}

/** Acoustic foam panels — concert hall / studio walls */
function makeAcousticPanelTex(w = 512, h = 512) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    const tile = 64, gap = 3;
    ctx.fillStyle = '#0C1219'; ctx.fillRect(0, 0, w, h);
    for (let row = 0; row <= h / tile; row++) {
        for (let col = 0; col <= w / tile; col++) {
            const x = col * tile + gap, y = row * tile + gap;
            const tw = tile - gap * 2,  th = tile - gap * 2;
            ctx.fillStyle = '#14202E'; ctx.fillRect(x, y, tw, th);
            const cx = x + tw / 2, cy = y + th / 2;
            const rad = ctx.createRadialGradient(cx, cy, 0, cx, cy, tw * 0.58);
            rad.addColorStop(0,    '#233040');
            rad.addColorStop(0.55, '#1A2838');
            rad.addColorStop(1,    '#111C28');
            ctx.fillStyle = rad; ctx.fillRect(x + 2, y + 2, tw - 4, th - 4);
            ctx.fillStyle = 'rgba(50,80,110,0.12)';
            ctx.fillRect(x + 2, y + 2, tw - 4, 3);
            ctx.fillRect(x + 2, y + 2, 3, th - 4);
        }
    }
    return new THREE.CanvasTexture(c);
}

// ════════════════════════════════════════════════════════════════════════════
// ─── createMaterials() — Shared PBR material set ────────────────────────────
// ════════════════════════════════════════════════════════════════════════════

function createMaterials() {
    const walnutTex = makeWalnutTex();
    walnutTex.wrapS = walnutTex.wrapT = THREE.RepeatWrapping;
    walnutTex.repeat.set(3, 1);

    return {
        /** Deep gloss black lacquer — piano top surfaces */
        lacquer: new THREE.MeshStandardMaterial({
            color: 0x020208, roughness: 0.06, metalness: 0.08, envMapIntensity: 1.20,
        }),
        /** Dark matte — interior surfaces */
        lacquerInner: new THREE.MeshStandardMaterial({
            color: 0x080810, roughness: 0.75, metalness: 0.0,
        }),
        /** Warm walnut veneer — outer curved walls */
        walnut: new THREE.MeshStandardMaterial({
            color: 0x4A2008, roughness: 0.52, metalness: 0.02,
            map: walnutTex, envMapIntensity: 0.30,
        }),
        /** Aged brass — pedals, casters, hardware */
        metal: new THREE.MeshStandardMaterial({
            color: 0xC9A96E, roughness: 0.18, metalness: 0.88, envMapIntensity: 1.5,
        }),
        /** Golden piano strings */
        strings: new THREE.MeshStandardMaterial({
            color: 0xBEA030, roughness: 0.22, metalness: 0.92,
        }),
        /** Ivory/bone — white keys */
        ivory: new THREE.MeshStandardMaterial({
            color: 0xF8F2E4, roughness: 0.78, metalness: 0.0,
        }),
        /** Ebony — black keys */
        ebony: new THREE.MeshStandardMaterial({
            color: 0x0A0A0E, roughness: 0.16, metalness: 0.06,
        }),
        /** Dark fabric — bench seat */
        felt: new THREE.MeshStandardMaterial({
            color: 0x100808, roughness: 0.88, metalness: 0.0,
        }),
    };
}

// ════════════════════════════════════════════════════════════════════════════
// ─── Key geometry helpers — rounded edges via ExtrudeGeometry ────────────────
// ════════════════════════════════════════════════════════════════════════════
//
// STRATEGY: draw the key SIDE PROFILE as a 2D shape (X=depth, Y=height),
// extrude it along the key's WIDTH, then rotate so world axes are correct.
//
// After ExtrudeGeometry: geoX=depth, geoY=height, geoZ=width
// After translate-to-center + rotateY(-PI/2):
//   worldX = width (geoZ)  ✓
//   worldY = height (geoY) ✓
//   worldZ = depth (geoX)  ✓  — front of key (rounded corner) at +Z

function makeWhiteKeyGeo() {
    const keyW = WKW - 0.012;   // width accounting for key gap
    const r    = 0.020;         // front-bottom corner radius

    // Side profile in shape XY: X = depth (back=0, front=WKD), Y = height
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);                             // back-bottom
    shape.lineTo(WKD - r, 0);                       // bottom edge toward front
    shape.quadraticCurveTo(WKD, 0,  WKD, r);        // ↙ rounded front-bottom corner
    shape.lineTo(WKD, WKH);                         // up the front face
    shape.lineTo(0,   WKH);                         // back-top
    shape.closePath();                              // back face

    const geo = new THREE.ExtrudeGeometry(shape, {
        depth: keyW,
        bevelEnabled: false,
        curveSegments: 7,       // smooth the quadratic curve
    });

    // Center then rotate: geoX→worldZ, geoZ→worldX
    geo.translate(-WKD / 2, -WKH / 2, -keyW / 2);
    geo.rotateY(-Math.PI / 2);
    geo.computeVertexNormals();
    return geo;
}

function makeBlackKeyGeo() {
    const r = 0.009;   // tighter radius for the slim black key

    // Side profile: rounded front-bottom + rounded front-top + rounded back-top
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);                               // back-bottom
    shape.lineTo(BKD - r, 0);                         // bottom edge
    shape.quadraticCurveTo(BKD, 0,   BKD, r);         // rounded front-bottom
    shape.lineTo(BKD, BKH - r);                       // up front face
    shape.quadraticCurveTo(BKD, BKH, BKD - r, BKH);   // rounded front-top
    shape.lineTo(r,   BKH);                           // top edge
    shape.quadraticCurveTo(0,   BKH, 0,   BKH - r);   // rounded back-top
    shape.lineTo(0, 0);                               // back face
    shape.closePath();

    const geo = new THREE.ExtrudeGeometry(shape, {
        depth: BKW,
        bevelEnabled: false,
        curveSegments: 5,
    });

    geo.translate(-BKD / 2, -BKH / 2, -BKW / 2);
    geo.rotateY(-Math.PI / 2);
    geo.computeVertexNormals();
    return geo;
}

// ════════════════════════════════════════════════════════════════════════════
// ─── createBody() — Case, soundboard, strings, fallboard, desk, pedals ──────
// ════════════════════════════════════════════════════════════════════════════
// COORDINATE NOTE:
//   ExtrudeGeometry shapes live in XY plane → rotateX(-PI/2) bakes shape_Y → -world_Z
//   Positive shapeY → world -Z  (tail, away from viewer)
//   Negative shapeY → world +Z  (front, toward viewer)

function createBody(mats) {
    const group = new THREE.Group();
    group.name = 'body';

    const hw       = BODY_W / 2;
    const rearZ_s  = BODY_D - WKD;      //  5.30 → world Z -5.30 (tail)
    const frontZ_s = -(WKD + 0.15);     // -1.35 → world Z +1.35 (front edge)

    // ── Grand piano outline (top-view silhouette) ────────────────────────
    const caseShape = new THREE.Shape();
    caseShape.moveTo(-hw, frontZ_s);
    caseShape.lineTo( hw, frontZ_s);
    // Bass side — straight wall with flare
    caseShape.lineTo( hw + 0.12, -WKD * 0.30);
    caseShape.lineTo( hw + 0.08, -WKD);
    caseShape.lineTo( hw * 0.92,  rearZ_s * 0.22);
    caseShape.lineTo( hw * 0.82,  rearZ_s * 0.42);
    // Treble tail — signature grand piano curve
    caseShape.quadraticCurveTo( hw * 0.52, rearZ_s * 0.68,  hw * 0.16, rearZ_s * 0.88);
    caseShape.quadraticCurveTo(0,           rearZ_s + 0.12, -hw * 0.16, rearZ_s * 0.88);
    // Treble side — mirror of bass
    caseShape.lineTo(-hw * 0.82,  rearZ_s * 0.42);
    caseShape.lineTo(-hw * 0.92,  rearZ_s * 0.22);
    caseShape.lineTo(-hw - 0.08, -WKD);
    caseShape.lineTo(-hw - 0.12, -WKD * 0.30);
    caseShape.lineTo(-hw, frontZ_s);

    // Rim — ExtrudeGeometry material groups after rotateX(-PI/2):
    //   group 0 = extruded side walls → walnut veneer
    //   group 1 = bottom cap (interior floor) → dark inner
    //   group 2 = top cap (visible black rim strip) → lacquer
    const rimGeo = new THREE.ExtrudeGeometry(caseShape, { depth: RIM_H, bevelEnabled: false });
    rimGeo.rotateX(-Math.PI / 2);
    const rim = new THREE.Mesh(rimGeo, [mats.walnut, mats.lacquerInner, mats.lacquer]);
    rim.position.y = -0.01;
    rim.castShadow = rim.receiveShadow = true;
    group.add(rim);

    // Soundboard — interior floor of the case
    const boardGeo = new THREE.ShapeGeometry(caseShape);
    boardGeo.rotateX(-Math.PI / 2);
    const board = new THREE.Mesh(boardGeo, mats.lacquerInner);
    board.position.y = 0.005;
    board.receiveShadow = true;
    group.add(board);

    // ── Piano strings (visible through open lid) ─────────────────────────
    const strGeo = new THREE.CylinderGeometry(0.002, 0.002, 1, 4);
    for (let i = 0; i < 32; i++) {
        const t      = i / 31;
        const strLen = 3.2 - t * 2.2;   // bass=long 3.2, treble=short 1.0
        const sx     = OFFSET_X + t * PIANO_W + PIANO_W / 64;
        const sz     = -(WKD * 0.3 + strLen * 0.5);
        const str    = new THREE.Mesh(strGeo, mats.strings);
        str.position.set(sx, 0.06, sz);
        str.scale.set(1, strLen, 1);
        str.rotation.x = Math.PI / 2;
        group.add(str);
    }

    // ── Fallboard (front lip above keyboard) ────────────────────────────
    const fall = new THREE.Mesh(
        new THREE.BoxGeometry(BODY_W + 0.04, 0.065, 0.12), mats.lacquer
    );
    fall.position.set(0, RIM_H * 0.5, WKD + 0.13);
    group.add(fall);

    // ── Music desk (sheet music holder) ─────────────────────────────────
    const desk = new THREE.Mesh(
        new THREE.BoxGeometry(PIANO_W * 0.62, 0.78, 0.03), mats.lacquer
    );
    desk.position.set(0, RIM_H + 0.46, -0.30);
    desk.rotation.x = -0.20;
    desk.castShadow = true;
    group.add(desk);

    // Desk support brackets (brass)
    [-(PIANO_W * 0.22), PIANO_W * 0.22].forEach(bx => {
        const br = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.55, 0.22), mats.metal);
        br.position.set(bx, RIM_H + 0.28, -0.14);
        group.add(br);
    });

    // ── Pedal lyre ───────────────────────────────────────────────────────
    const lyre = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.72, 0.05), mats.lacquer);
    lyre.position.set(0.10, -1.28, 1.45);
    lyre.rotation.x = -0.08;
    lyre.castShadow = true;
    group.add(lyre);

    // Three pedals (soft, sostenuto, sustain)
    [-0.22, 0, 0.22].forEach(px => {
        const ped = new THREE.Mesh(
            new THREE.CylinderGeometry(0.035, 0.040, 0.14, 12), mats.metal
        );
        ped.position.set(px + 0.10, -1.56, 1.60);
        ped.rotation.x = -0.35;
        group.add(ped);
    });

    return group;
}

// ════════════════════════════════════════════════════════════════════════════
// ─── createLid() — Piano lid with pivot hinge + prop ────────────────────────
// ════════════════════════════════════════════════════════════════════════════

function createLid(mats) {
    const hw          = BODY_W / 2;
    const lhw         = hw - 0.12;
    const rearZ_s     = BODY_D - WKD;
    const lidRearZ_s  = rearZ_s - 0.15;   //  5.15 → world Z = -5.15 (hinge)
    const lidFrontZ_s = -(WKD + 0.05);    // -1.25 → world Z = +1.25

    const lidShape = new THREE.Shape();
    lidShape.moveTo(-lhw, lidFrontZ_s);
    lidShape.lineTo( lhw, lidFrontZ_s);
    lidShape.lineTo( lhw + 0.08,  -WKD * 0.30);
    lidShape.lineTo( lhw * 0.90,   lidRearZ_s * 0.22);
    lidShape.lineTo( lhw * 0.80,   lidRearZ_s * 0.42);
    lidShape.quadraticCurveTo( lhw * 0.50, lidRearZ_s * 0.68,  lhw * 0.14, lidRearZ_s * 0.86);
    lidShape.quadraticCurveTo(0,            lidRearZ_s * 0.97, -lhw * 0.14, lidRearZ_s * 0.86);
    lidShape.lineTo(-lhw * 0.80,   lidRearZ_s * 0.42);
    lidShape.lineTo(-lhw * 0.90,   lidRearZ_s * 0.22);
    lidShape.lineTo(-lhw - 0.08,  -WKD * 0.30);
    lidShape.lineTo(-lhw, lidFrontZ_s);

    const lidGeo = new THREE.ExtrudeGeometry(lidShape, { depth: 0.035, bevelEnabled: false });
    lidGeo.rotateX(-Math.PI / 2);
    const lid = new THREE.Mesh(lidGeo, mats.lacquer);
    lid.castShadow = true;

    // Prop stick — brass support rod
    const prop = new THREE.Mesh(
        new THREE.CylinderGeometry(0.014, 0.014, 1.85, 6), mats.metal
    );
    prop.position.set(lhw * 0.38, RIM_H + 0.82, -0.50);
    prop.rotation.z = 0.06;
    prop.rotation.x = -0.20;
    prop.castShadow = true;

    // Pivot group: group origin = hinge point at world Z = -lidRearZ_s
    // lid.position offsets geometry so its rear edge aligns with group origin
    const lidGroup = new THREE.Group();
    lidGroup.name = 'lid';
    lid.position.set(0, -RIM_H, lidRearZ_s);
    lidGroup.add(lid, prop);
    lidGroup.position.set(0, RIM_H, -lidRearZ_s);
    lidGroup.rotation.x = -0.50;   // ~29° open by default

    return {
        group: lidGroup,
        /** Animate lid: 0 = closed, -PI/2.2 = fully open */
        setAngle: (rad) => { lidGroup.rotation.x = rad; },
    };
}

// ════════════════════════════════════════════════════════════════════════════
// ─── createLegs() — 3 tapered legs + brass casters ──────────────────────────
// ════════════════════════════════════════════════════════════════════════════

function createLegs(mats) {
    const group = new THREE.Group();
    group.name = 'legs';

    const hw      = BODY_W / 2;
    const rearZ_s = BODY_D - WKD;
    const legGeo  = new THREE.CylinderGeometry(0.068, 0.052, 1.85, 12);

    [
        [-hw + 0.50,  WKD * 0.75],       // front-left  (treble side)
        [ hw - 0.50,  WKD * 0.75],       // front-right (bass side)
        [ 0.00,      -rearZ_s * 0.55],   // rear center
    ].forEach(([lx, lz]) => {
        const leg = new THREE.Mesh(legGeo, mats.lacquer);
        leg.position.set(lx, -0.93, lz);
        leg.castShadow = true;
        group.add(leg);

        // Brass caster wheel
        const caster = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), mats.metal);
        caster.position.set(lx, -1.86, lz);
        group.add(caster);
    });

    return group;
}

// ════════════════════════════════════════════════════════════════════════════
// ─── createKeyboard() — 88 real key meshes (52 white + 36 black) ─────────────
// ════════════════════════════════════════════════════════════════════════════

function createKeyboard(mats) {
    const group     = new THREE.Group();
    group.name      = 'keyboard';
    const keyMeshes = new Array(88);

    // Build shared geometries once — all white keys share one geo, all black keys share another.
    // This saves memory and init time vs creating 88 individual ExtrudeGeometry objects.
    const whiteGeo = makeWhiteKeyGeo();
    const blackGeo = makeBlackKeyGeo();

    for (let midi = FIRST_NOTE; midi <= LAST_NOTE; midi++) {
        const black = isBlackKey(midi);
        const wi    = getWhiteKeyIndex(midi);

        // Each key gets its own cloned material so emissive can be animated independently
        const mat = (black ? mats.ebony : mats.ivory).clone();
        mat.emissive = new THREE.Color(0);

        let x, y, z;
        if (black) {
            x = OFFSET_X + wi * WKW;
            y = KEY_BASE_Y + 0.03 + BKH / 2;   // top protrudes above rim
            z = BKD / 2;
        } else {
            x = OFFSET_X + wi * WKW + WKW / 2;
            y = KEY_BASE_Y + WKH / 2;            // top flush with rim
            z = WKD / 2;
        }

        const mesh = new THREE.Mesh(black ? blackGeo : whiteGeo, mat);
        mesh.position.set(x, y, z);
        mesh.castShadow    = true;
        mesh.receiveShadow = !black;
        mesh.userData      = { isBlack: black, baseY: y };
        group.add(mesh);
        keyMeshes[midi - FIRST_NOTE] = mesh;
    }

    return { group, keyMeshes };
}

// ════════════════════════════════════════════════════════════════════════════
// ─── createBench() — Piano bench with 4-leg metal base ──────────────────────
// ════════════════════════════════════════════════════════════════════════════

function createBench(mats) {
    const group = new THREE.Group();
    group.name  = 'bench';

    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.08, 0.68), mats.felt);
    seat.position.set(0.20, -0.52, 3.60);
    seat.castShadow = seat.receiveShadow = true;
    group.add(seat);

    const blGeo = new THREE.CylinderGeometry(0.024, 0.020, 1.34, 8);
    [[-0.56, 3.28], [0.56, 3.28], [-0.56, 3.92], [0.56, 3.92]].forEach(([bx, bz]) => {
        const bl = new THREE.Mesh(blGeo, mats.metal);
        bl.position.set(bx + 0.20, -1.22, bz);
        bl.castShadow = true;
        group.add(bl);
    });

    return group;
}

// ════════════════════════════════════════════════════════════════════════════
// ─── createGrandPiano() — Assembles all parts into one THREE.Group ───────────
// ════════════════════════════════════════════════════════════════════════════

function createGrandPiano() {
    const pianoGroup = new THREE.Group();
    pianoGroup.name  = 'grandPiano';

    const mats = createMaterials();

    const body                           = createBody(mats);
    const { group: lidGroup, setAngle }  = createLid(mats);
    const legs                           = createLegs(mats);
    const { group: keyboard, keyMeshes } = createKeyboard(mats);
    const bench                          = createBench(mats);

    pianoGroup.add(body, lidGroup, legs, keyboard, bench);

    return {
        pianoGroup,
        keyMeshes,
        /** Open/close lid: 0=closed, -Math.PI/2.2=fully open */
        setLidAngle: setAngle,
    };
}

// ════════════════════════════════════════════════════════════════════════════
// ─── buildConcertHall() — Stage, acoustic walls, rig, audience ───────────────
// ════════════════════════════════════════════════════════════════════════════

function buildConcertHall(scene) {
    // Stage floor — dark polished hardwood planks
    const floorTex = makeDarkWoodTex();
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(7, 6);
    const stageMat = new THREE.MeshStandardMaterial({
        color: 0x070503, map: floorTex,
        roughness: 0.32, metalness: 0.06, envMapIntensity: 0.45,
    });
    const stage = new THREE.Mesh(new THREE.PlaneGeometry(30, 26), stageMat);
    stage.rotation.x = -Math.PI / 2;
    stage.position.y = -1.87;
    stage.receiveShadow = true;
    scene.add(stage);

    // Back wall — acoustic foam panels
    const panelTex = makeAcousticPanelTex();
    panelTex.wrapS = panelTex.wrapT = THREE.RepeatWrapping;
    panelTex.repeat.set(9, 5);
    const wallMat = new THREE.MeshStandardMaterial({
        color: 0x0E1820, map: panelTex, roughness: 0.94, metalness: 0.0,
    });
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(30, 20, 0.35), wallMat);
    backWall.position.set(0, 8.1, -11.2);
    backWall.receiveShadow = true;
    scene.add(backWall);

    // Side wings — same acoustic panel texture
    const wingTex = makeAcousticPanelTex();
    wingTex.wrapS = wingTex.wrapT = THREE.RepeatWrapping;
    wingTex.repeat.set(6, 4);
    const wingMat = new THREE.MeshStandardMaterial({
        color: 0x0E1820, map: wingTex, roughness: 0.94, metalness: 0.0,
    });
    [-13.4, 13.4].forEach(x => {
        const wing = new THREE.Mesh(new THREE.BoxGeometry(0.35, 18, 24), wingMat);
        wing.position.set(x, 7.1, -2);
        wing.receiveShadow = true;
        scene.add(wing);
    });

    // Ceiling — dark, barely visible
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x08090E, roughness: 1.0, metalness: 0.0 });
    const ceil    = new THREE.Mesh(new THREE.PlaneGeometry(30, 26), darkMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = 9.5;
    scene.add(ceil);

    // Stage apron (front step)
    const apron = new THREE.Mesh(new THREE.BoxGeometry(30, 0.18, 0.32), darkMat);
    apron.position.set(0, -1.78, 4.2);
    scene.add(apron);

    // ── Decorative lighting rig ──────────────────────────────────────────
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
    const canMat  = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6, metalness: 0.6 });
    const lensMat = new THREE.MeshStandardMaterial({
        color: 0xffe8cc, emissive: 0xffe8cc, emissiveIntensity: 0.8, roughness: 0.2,
    });
    [-5.5, -2.5, 0, 2.5, 5.5].forEach(cx => {
        const can  = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.09, 0.38, 8), canMat);
        can.position.set(cx, 7.62, 0.5);
        scene.add(can);
        const lens = new THREE.Mesh(new THREE.CircleGeometry(0.08, 8), lensMat);
        lens.rotation.x = Math.PI / 2;
        lens.position.set(cx, 7.43, 0.5);
        scene.add(lens);
    });

    // ── Audience silhouettes ─────────────────────────────────────────────
    const silMat = new THREE.MeshStandardMaterial({
        color: 0x020105, roughness: 1.0, transparent: true, opacity: 0.50,
    });
    [{ z: 5.8, n: 8, y: -1.87 }, { z: 7.2, n: 10, y: -1.70 }, { z: 8.6, n: 12, y: -1.55 }]
        .forEach(({ z, n, y }) => {
            for (let i = 0; i < n; i++) {
                const x    = -9.5 + (i / (n - 1)) * 19;
                const head = new THREE.Mesh(new THREE.SphereGeometry(0.20, 6, 5), silMat);
                head.position.set(x, y + 1.06, z);
                scene.add(head);
                const shld = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.28, 0.22), silMat);
                shld.position.set(x, y + 0.72, z);
                scene.add(shld);
            }
        });
}

// ════════════════════════════════════════════════════════════════════════════
// ─── Piano3D React Component ─────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════

export default function Piano3D({
    activeNotes     = new Map(),
    songActiveNotes = [],
    visibleNotes    = [],
    currentTime     = 0,
    width           = 1200,
    fullHeight      = false,
}) {
    const containerRef      = useRef(null);
    const canvasRef         = useRef(null);
    const rendererRef       = useRef(null);
    const cameraRef         = useRef(null);
    const keyMeshesRef      = useRef([]);
    const noteMeshesRef     = useRef([]);
    const noteMatRef        = useRef({});
    const frameIdRef        = useRef(null);
    const camLookAtRef      = useRef(PRESETS[0].target.clone());
    const transitionRef     = useRef(null);
    const sizeRef           = useRef({ w: width, h: 600 });

    const activeNotesRef     = useRef(activeNotes);
    const songActiveNotesRef = useRef(songActiveNotes);
    const visibleNotesRef    = useRef(visibleNotes);
    const currentTimeRef     = useRef(currentTime);

    const [presetIdx, setPresetIdx] = useState(0);

    // ── Scene setup (runs once on mount) ────────────────────────────────────
    useEffect(() => {
        const canvas    = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const h = container.clientHeight || 600;
        const w = container.clientWidth  || width;
        sizeRef.current = { w, h };

        // Renderer
        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
        renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
        renderer.setSize(w, h);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
        renderer.toneMapping       = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.25;
        rendererRef.current = renderer;

        // Scene
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x030308);
        scene.fog        = new THREE.FogExp2(0x030308, 0.022);

        // PBR environment — realistic reflections on lacquer
        const pmrem = new THREE.PMREMGenerator(renderer);
        scene.environment = pmrem.fromScene(new RoomEnvironment(0.5)).texture;
        pmrem.dispose();

        // Camera
        const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 120);
        camera.position.copy(PRESETS[0].pos);
        camera.lookAt(PRESETS[0].target);
        cameraRef.current = camera;

        // ── Lighting ────────────────────────────────────────────────────
        // Hemisphere — minimal ambient, keeps surroundings dark
        scene.add(new THREE.HemisphereLight(0xFFEDD8, 0x04030A, 0.18));

        // Main stage spotlight — tight cone, doesn't reach back wall
        const mainSpot = new THREE.SpotLight(0xFFFBF2, 3.2, 20, 0.30, 0.28, 1.3);
        mainSpot.position.set(0, 11, 7);
        mainSpot.target.position.set(0, 0, 0.5);
        mainSpot.castShadow = true;
        mainSpot.shadow.mapSize.set(2048, 2048);
        Object.assign(mainSpot.shadow.camera, { near: 1, far: 28 });
        mainSpot.shadow.bias = -0.0012;
        scene.add(mainSpot, mainSpot.target);

        // Left fill — gives depth to piano body curves
        const spot2 = new THREE.SpotLight(0xFFE8CC, 2.2, 22, 0.40, 0.45, 1.2);
        spot2.position.set(-7, 9, 5);
        spot2.target.position.set(-1, 0, -1);
        scene.add(spot2, spot2.target);

        // Key fill — direct light so ivory keys read bright white
        const keyFill = new THREE.DirectionalLight(0xFFF5E8, 1.10);
        keyFill.position.set(0, 5, 12);
        scene.add(keyFill);

        // Warm bass-side point — body glow, short range (doesn't reach walls)
        const warmSide = new THREE.PointLight(0xFF8833, 0.55, 8, 1.8);
        warmSide.position.set(4.5, 0.5, 0);
        scene.add(warmSide);

        // Under-piano bounce — fills leg area
        const underBounce = new THREE.PointLight(0x201008, 0.35, 5, 2.0);
        underBounce.position.set(0, -1.2, 0.5);
        scene.add(underBounce);

        // ── Grand piano ──────────────────────────────────────────────────
        const { pianoGroup, keyMeshes } = createGrandPiano();
        scene.add(pianoGroup);
        keyMeshesRef.current = keyMeshes;

        // ── Concert hall environment ─────────────────────────────────────
        buildConcertHall(scene);

        // ── Note fall pool (300 pre-created meshes, 4 shared materials) ──
        const noteGeo  = new THREE.BoxGeometry(1, 1, 1);
        const mkMat    = (color, ei, op) => new THREE.MeshStandardMaterial({
            color, emissive: color, emissiveIntensity: ei,
            transparent: true, opacity: op,
            roughness: 0.3, metalness: 0.05, depthWrite: false,
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
            const m = new THREE.Mesh(noteGeo, noteMats.rightIdle);
            m.visible = false;
            scene.add(m);
            noteMeshes.push(m);
        }
        noteMeshesRef.current = noteMeshes;

        // ── Animation loop ───────────────────────────────────────────────
        const animate = () => {
            frameIdRef.current = requestAnimationFrame(animate);

            const kMeshes = keyMeshesRef.current;
            const aNotes  = activeNotesRef.current;
            const sNotes  = songActiveNotesRef.current;
            const vNotes  = visibleNotesRef.current;
            const cTime   = currentTimeRef.current;
            const nMeshes = noteMeshesRef.current;
            const mats    = noteMatRef.current;

            // ── Key colors & press animation ─────────────────────────
            const activeSet = new Map();
            aNotes.forEach((_, midi) => activeSet.set(midi, { source: 'user' }));
            sNotes.forEach(n => {
                if (!activeSet.has(n.midi))
                    activeSet.set(n.midi, { source: 'song', isRight: n.isRightHand !== false });
            });

            for (let i = 0; i < 88; i++) {
                const mesh = kMeshes[i];
                if (!mesh) continue;
                const midi   = FIRST_NOTE + i;
                const active = activeSet.get(midi);
                const { isBlack, baseY } = mesh.userData;
                const mat = mesh.material;

                if (active) {
                    const isRight = active.source === 'user' || active.isRight;
                    if (active.source === 'user') {
                        mat.color.set(isBlack ? 0xC9A96E : 0xEEDDB8);
                        mat.emissive.set(0xB89050);
                        mat.emissiveIntensity = 0.55;
                    } else if (isRight) {
                        mat.color.set(isBlack ? 0xB89050 : 0xE8D8A8);
                        mat.emissive.set(0xA08040);
                        mat.emissiveIntensity = 0.30;
                    } else {
                        mat.color.set(isBlack ? 0x6070A0 : 0xB8C4DC);
                        mat.emissive.set(0x506090);
                        mat.emissiveIntensity = 0.30;
                    }
                    mesh.position.y = baseY - (isBlack ? 0.022 : 0.028);
                } else {
                    mat.color.set(isBlack ? 0x0A0A0E : 0xF8F2E4);
                    mat.emissive.setScalar(0);
                    mat.emissiveIntensity = 0;
                    mesh.position.y = baseY;
                }
            }

            // ── Falling note rectangles ───────────────────────────────
            for (const m of nMeshes) m.visible = false;
            let ni = 0;
            for (const note of vNotes) {
                if (ni >= NOTE_POOL) break;
                const dt = note.time - cTime;
                if (dt > LOOK_AHEAD || dt + note.duration < -0.1) continue;

                const black  = isBlackKey(note.midi);
                const wi     = getWhiteKeyIndex(note.midi);
                const noteX  = black ? OFFSET_X + wi * WKW : OFFSET_X + wi * WKW + WKW / 2;
                const noteW  = black ? BKW * 0.76 : (WKW - 0.012) * 0.82;
                const noteH  = Math.max(note.duration * UPS, 0.06);
                const botY   = KEY_TOP + dt * UPS;
                const noteZ  = black ? BKD / 2 : WKD / 2;
                const isRight  = note.isRightHand !== false;
                const isActive = note.time <= cTime && note.time + note.duration > cTime;

                const mesh = nMeshes[ni++];
                mesh.material = isRight
                    ? (isActive ? mats.rightActive : mats.rightIdle)
                    : (isActive ? mats.leftActive  : mats.leftIdle);
                mesh.position.set(noteX, botY + noteH / 2, noteZ);
                mesh.scale.set(noteW, noteH, 0.12);
                mesh.visible = true;
            }

            // ── Camera eased transition ───────────────────────────────
            const tr = transitionRef.current;
            if (tr) {
                const s = easeInOut(Math.min((Date.now() - tr.t0) / tr.dur, 1));
                camera.position.lerpVectors(tr.fromPos, tr.toPos, s);
                camLookAtRef.current.lerpVectors(tr.fromLook, tr.toLook, s);
                camera.lookAt(camLookAtRef.current);
                if (s >= 1) transitionRef.current = null;
            }

            renderer.render(scene, camera);
        };
        animate();

        // ── Resize observer ──────────────────────────────────────────────
        const ro = new ResizeObserver(([entry]) => {
            const { width: cw, height: ch } = entry.contentRect;
            if (cw < 1 || ch < 1) return;
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

    // ── Props → refs (avoids stale closure in rAF loop) ─────────────────────
    useEffect(() => { activeNotesRef.current     = activeNotes;     }, [activeNotes]);
    useEffect(() => { songActiveNotesRef.current = songActiveNotes; }, [songActiveNotes]);
    useEffect(() => { visibleNotesRef.current    = visibleNotes;    }, [visibleNotes]);
    useEffect(() => { currentTimeRef.current     = currentTime;     }, [currentTime]);

    // ── Camera preset transition ─────────────────────────────────────────────
    const switchPreset = useCallback((idx) => {
        const cam = cameraRef.current;
        if (!cam) return;
        const p = PRESETS[idx];
        transitionRef.current = {
            fromPos:  cam.position.clone(),
            fromLook: camLookAtRef.current.clone(),
            toPos:    p.pos.clone(),
            toLook:   p.target.clone(),
            t0: Date.now(), dur: 700,
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
