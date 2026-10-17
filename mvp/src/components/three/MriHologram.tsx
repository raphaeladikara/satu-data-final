import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { loadBrain3D, type Brain3D } from '@/lib/brain3d';
import { createGravityRing } from './gravityRing';
import { cn } from '@/lib/utils';

/**
 * Tumpukan slice MRI asli (SOOP) sebagai hologram 3D.
 * Setiap slice aksial adalah satu bidang bertekstur; lesi dari mask ahli menyala terracotta.
 * Bisa diputar dengan seret, slice bisa dipisahkan (explode), dan satu slice bisa difokuskan.
 */
export type Series3D = 'DWI' | 'FLAIR' | 'ADC';
export type MriHologramProps = {
  caseId?: string;
  series?: Series3D;
  /** 0 = tumpukan rapat, 1 = slice terpisah lebar */
  explode?: number;
  lesion?: boolean;
  /** indeks slice yang disorot; slice lain diredupkan */
  focusSlice?: number | null;
  autoRotate?: boolean;
  /** garis pindai yang menyapu naik-turun */
  scan?: boolean;
  /** jarak kamera relatif (1 = default) */
  zoom?: number;
  /** cincin partikel gravitasi di sekeliling otak (hero landing) */
  ring?: boolean;
  /** ubah nilainya untuk memutar ulang animasi cincin */
  ringKey?: number;
  className?: string;
  onReady?: (b: Brain3D) => void;
};

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uTex;
uniform vec3 uSeries;
uniform float uLesion;
uniform float uOpacity;
uniform float uGlow;
uniform float uDim;
uniform vec2 uTexel;
uniform vec3 uLow;
uniform vec3 uMid;
uniform vec3 uHigh;
uniform vec3 uLesionCol;
varying vec2 vUv;
void main() {
  vec4 t = texture2D(uTex, vUv);
  float v = dot(vec3(t.r, t.g, t.a), uSeries);
  // tepi jaringan dari gradien intensitas, supaya kontur otak tiap slice terbaca
  vec4 tx1 = texture2D(uTex, vUv + vec2(uTexel.x, 0.0));
  vec4 tx0 = texture2D(uTex, vUv - vec2(uTexel.x, 0.0));
  vec4 ty1 = texture2D(uTex, vUv + vec2(0.0, uTexel.y));
  vec4 ty0 = texture2D(uTex, vUv - vec2(0.0, uTexel.y));
  vec2 grad = vec2(dot(tx1.rga, uSeries) - dot(tx0.rga, uSeries), dot(ty1.rga, uSeries) - dot(ty0.rga, uSeries));
  float edge = smoothstep(0.06, 0.22, length(grad));
  float a = smoothstep(0.05, 0.42, v);
  vec3 c = v < 0.45 ? mix(uLow, uMid, v / 0.45) : mix(uMid, uHigh, (v - 0.45) / 0.55);
  c = mix(c, uHigh, edge * 0.55);
  a = max(a * 0.85, edge * 0.9);
  float les = smoothstep(0.25, 0.75, t.b) * uLesion;
  c = mix(c, uLesionCol, les);
  a = max(a * (1.0 - les * 0.3), les * 1.25);
  float alpha = a * uOpacity * (1.0 + uGlow * 1.8) * uDim;
  gl_FragColor = vec4(c, alpha);
}`;

const LOW = new THREE.Color('#0d4a55');
const MID = new THREE.Color('#5fb3bf');
const HIGH = new THREE.Color('#eaf7ef');
const LESION = new THREE.Color('#ff9a62');
const SCAN = new THREE.Color('#aad39c');

export default function MriHologram({
  caseId = 'sub-754',
  series = 'DWI',
  explode = 0,
  lesion = true,
  focusSlice = null,
  autoRotate = true,
  scan = true,
  zoom = 1,
  ring = false,
  ringKey = 0,
  className,
  onReady,
}: MriHologramProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'nogl'>('loading');
  // props dibaca loop render lewat ref supaya scene tidak dibangun ulang tiap perubahan
  const live = useRef({ series, explode, lesion, focusSlice, autoRotate, scan, zoom, ring, ringKey });
  live.current = { series, explode, lesion, focusSlice, autoRotate, scan, zoom, ring, ringKey };
  const readyCb = useRef(onReady);
  readyCb.current = onReady;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let cleanup = () => {};
    setState('loading');

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch {
      setState('nogl');
      return;
    }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'pan-y';
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    const pivot = new THREE.Group();
    scene.add(pivot);

    loadBrain3D(caseId)
      .then((b) => {
        if (disposed) return;
        cleanup = build(b);
        setState('ready');
        readyCb.current?.(b);
      })
      .catch(() => !disposed && setState('error'));

    function build(b: Brain3D) {
      const [X, Y, Z] = b.dims;
      const [sx, sy, sz] = b.spacing;
      const S = 1 / 100; // mm -> unit
      const w = X * sx * S;
      const h = Y * sy * S;
      const dz = sz * S;
      const geo = new THREE.PlaneGeometry(w, h);
      const textures: THREE.DataTexture[] = [];
      const mats: THREE.ShaderMaterial[] = [];
      const meshes: THREE.Mesh[] = [];
      const stack = new THREE.Group();
      pivot.add(stack);

      for (let z = 0; z < Z; z++) {
        const px = new Uint8Array(X * Y * 4);
        const off = z * X * Y;
        for (let i = 0; i < X * Y; i++) {
          px[i * 4] = b.dwi[off + i];
          px[i * 4 + 1] = b.flair[off + i];
          px[i * 4 + 2] = b.mask[off + i];
          px[i * 4 + 3] = b.adc[off + i];
        }
        const tex = new THREE.DataTexture(px, X, Y, THREE.RGBAFormat);
        tex.magFilter = THREE.LinearFilter;
        tex.minFilter = THREE.LinearFilter;
        tex.needsUpdate = true;
        textures.push(tex);
        const mat = new THREE.ShaderMaterial({
          vertexShader: VERT,
          fragmentShader: FRAG,
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          uniforms: {
            uTex: { value: tex },
            uSeries: { value: new THREE.Vector3(1, 0, 0) },
            uLesion: { value: 1 },
            uOpacity: { value: 0.3 },
            uGlow: { value: 0 },
            uDim: { value: 1 },
            uTexel: { value: new THREE.Vector2(1 / X, 1 / Y) },
            uLow: { value: LOW },
            uMid: { value: MID },
            uHigh: { value: HIGH },
            uLesionCol: { value: LESION },
          },
        });
        mats.push(mat);
        const m = new THREE.Mesh(geo, mat);
        // bidang aksial: x gambar -> x dunia, y gambar -> z dunia, slice -> atas
        m.rotation.x = -Math.PI / 2;
        stack.add(m);
        meshes.push(m);
      }

      // titik-titik lesi supaya lesi terasa bervolume, bukan hanya noda di tiap slice
      const pts: number[] = [];
      const ptSlice: number[] = [];
      for (let z = 0; z < Z; z++)
        for (let y = 0; y < Y; y += 2)
          for (let x = 0; x < X; x += 2) {
            if (b.mask[z * X * Y + y * X + x] > 127) {
              pts.push((x / X - 0.5) * w, 0, (0.5 - y / Y) * h);
              ptSlice.push(z);
            }
          }
      const pgeo = new THREE.BufferGeometry();
      const ppos = new Float32Array(pts);
      pgeo.setAttribute('position', new THREE.BufferAttribute(ppos.slice(), 3));
      const pmat = new THREE.PointsMaterial({ color: LESION, size: 0.045, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, map: dotTexture() });
      const points = new THREE.Points(pgeo, pmat);
      stack.add(points);

      // bingkai pindai dan bingkai slice terfokus
      const frameGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(w * 0.8, h * 0.8));
      const scanMat = new THREE.LineBasicMaterial({ color: SCAN, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending });
      const scanFrame = new THREE.LineSegments(frameGeo, scanMat);
      scanFrame.rotation.x = -Math.PI / 2;
      stack.add(scanFrame);
      const focusMat = new THREE.LineBasicMaterial({ color: new THREE.Color('#f4c9ad'), transparent: true, opacity: 0 });
      const focusFrame = new THREE.LineSegments(frameGeo, focusMat);
      focusFrame.rotation.x = -Math.PI / 2;
      stack.add(focusFrame);

      // alas proyektor: cincin konsentris
      const base = new THREE.Group();
      const rings: THREE.LineLoop[] = [];
      for (let r = 0; r < 3; r++) {
        const rad = Math.max(w, h) * (0.5 + r * 0.14);
        const g = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 96 }, (_, i) => new THREE.Vector3(Math.cos((i / 96) * Math.PI * 2) * rad, 0, Math.sin((i / 96) * Math.PI * 2) * rad)));
        const ring = new THREE.LineLoop(g, new THREE.LineBasicMaterial({ color: new THREE.Color('#93c7cf'), transparent: true, opacity: 0.22 - r * 0.06 }));
        base.add(ring);
        rings.push(ring);
      }
      pivot.add(base);

      const reducedNow = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const gravity = live.current.ring ? createGravityRing(Math.max(w, h) * 0.78, { reduced: reducedNow, count: window.innerWidth < 768 ? 26000 : 52000 }) : null;
      if (gravity) {
        gravity.group.rotation.set(0.1, 0, 0.16);
        pivot.add(gravity.group);
        base.visible = false;
      }
      let ringKeySeen = live.current.ringKey;
      let ringStarted = false;

      // debu cahaya di sekitar untuk kedalaman
      const dust = new THREE.BufferGeometry();
      const dn = 140;
      const dpos = new Float32Array(dn * 3);
      for (let i = 0; i < dn; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = 1.3 + Math.random() * 1.6;
        dpos[i * 3] = Math.cos(a) * r;
        dpos[i * 3 + 1] = (Math.random() - 0.3) * 2.6;
        dpos[i * 3 + 2] = Math.sin(a) * r;
      }
      dust.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
      const dustMat = new THREE.PointsMaterial({ color: new THREE.Color('#aad39c'), size: 0.02, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, map: dotTexture() });
      const dustPts = new THREE.Points(dust, dustMat);
      if (!gravity) scene.add(dustPts);

      // interaksi: seret memutar, dengan inersia
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
      let yaw = -0.6;
      let pitch = 0.42;
      let vYaw = 0;
      let dragging = false;
      let lastX = 0;
      let lastY = 0;
      let idleAt = 0;
      const el = renderer.domElement;
      const down = (e: PointerEvent) => {
        dragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
        el.style.cursor = 'grabbing';
      };
      const move = (e: PointerEvent) => {
        if (!dragging) return;
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;
        if (Math.abs(dx) > Math.abs(dy) * 0.6 || e.pointerType === 'mouse') {
          e.preventDefault();
          vYaw = dx * 0.006;
          yaw += vYaw;
          if (e.pointerType === 'mouse') pitch = Math.min(1.05, Math.max(0.05, pitch + dy * 0.004));
        }
      };
      const up = () => {
        dragging = false;
        idleAt = performance.now();
        el.style.cursor = 'grab';
      };
      el.style.cursor = 'grab';
      el.addEventListener('pointerdown', down);
      window.addEventListener('pointermove', move, { passive: false });
      window.addEventListener('pointerup', up);

      const resize = () => {
        const r = host!.getBoundingClientRect();
        if (!r.width || !r.height) return;
        renderer.setSize(r.width, r.height, false);
        camera.aspect = r.width / r.height;
        camera.updateProjectionMatrix();
      };
      const ro = new ResizeObserver(resize);
      ro.observe(host!);
      resize();

      let visible = true;
      const io = new IntersectionObserver((en) => {
        visible = en.some((x) => x.isIntersecting);
        if (visible && !raf) {
          last = performance.now();
          raf = requestAnimationFrame(tick);
        }
      });
      io.observe(host!);

      let raf = 0;
      let last = performance.now();
      let t = 0;
      let ex = live.current.explode;
      const W3 = (s: string) => new THREE.Vector3(s === 'DWI' ? 1 : 0, s === 'FLAIR' ? 1 : 0, s === 'ADC' ? 1 : 0);
      const ser = W3(live.current.series);
      let les = live.current.lesion ? 1 : 0;
      let foc = -1;
      let focusAmt = 0;
      let zoomS = live.current.zoom;
      const dims = new Float32Array(Z).fill(1);

      function tick(now: number) {
        raf = 0;
        if (disposed || !visible) return;
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        const L = live.current;
        const still = reduce.matches;
        t += dt;
        const k = still ? 1 : 1 - Math.exp(-dt * 6);
        ex += (L.explode - ex) * k;
        ser.lerp(W3(L.series), k);
        les += ((L.lesion ? 1 : 0) - les) * k;
        zoomS += (L.zoom - zoomS) * k;
        if (L.focusSlice != null) foc = L.focusSlice;
        focusAmt += ((L.focusSlice != null ? 1 : 0) - focusAmt) * k;

        if (!dragging) {
          vYaw *= Math.pow(0.04, dt);
          yaw += vYaw;
          if (L.autoRotate && !still && now - idleAt > 1600) yaw += dt * 0.22;
        }
        pivot.rotation.set(0, yaw, 0);
        // layar potret butuh kamera lebih jauh supaya lebar otak tetap muat
        const dist = 5.4 * zoomS * (1 + ex * 0.5) * Math.max(1, 0.85 / camera.aspect);
        camera.position.set(0, Math.sin(pitch) * dist, Math.cos(pitch) * dist);
        camera.lookAt(0, 0.05, 0);

        const gap = dz * (1.25 + ex * 1.7);
        const height = gap * (Z - 1);
        const scanZ = L.scan && !still ? ((Math.sin(t * 0.7) + 1) / 2) * (Z - 1) : -10;
        for (let z = 0; z < Z; z++) {
          const y = z * gap - height / 2;
          meshes[z].position.y = y;
          const u = mats[z].uniforms;
          u.uSeries.value = ser;
          u.uLesion.value = les;
          const glow = Math.max(0, 1 - Math.abs(z - scanZ) / 1.4);
          u.uGlow.value = glow * 0.6 + (z === foc ? focusAmt * 1.1 : 0);
          const target = focusAmt > 0.01 && z !== foc ? 1 - focusAmt * 0.72 : 1;
          dims[z] += (target - dims[z]) * k;
          u.uDim.value = dims[z];
          u.uOpacity.value = 0.26 + ex * 0.14;
        }
        // titik lesi ikut posisi slice-nya
        const pa = pgeo.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i < ptSlice.length; i++) pa.setY(i, ptSlice[i] * gap - height / 2 + Math.sin(t * 2 + i) * 0.004);
        pa.needsUpdate = true;
        pmat.opacity = 0.5 * les;

        if (scanZ >= 0) {
          scanFrame.position.y = scanZ * gap - height / 2;
          scanMat.opacity = 0.55;
        } else scanMat.opacity = 0;
        if (foc >= 0) {
          focusFrame.position.y = foc * gap - height / 2;
          focusMat.opacity = focusAmt * 0.9;
        }
        base.position.y = -height / 2 - 0.28;
        rings.forEach((r, i) => (r.rotation.y = t * (0.05 + i * 0.03) * (i % 2 ? -1 : 1)));
        dustPts.rotation.y = t * 0.03;
        if (gravity) {
          if (!ringStarted && t > 0.6) {
            ringStarted = true;
            gravity.play();
          }
          if (L.ringKey !== ringKeySeen) {
            ringKeySeen = L.ringKey;
            gravity.play();
          }
          gravity.tick(dt, t);
        }

        renderer.render(scene, camera);
        raf = requestAnimationFrame(tick);
      }
      raf = requestAnimationFrame(tick);

      return () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        io.disconnect();
        el.removeEventListener('pointerdown', down);
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        textures.forEach((x) => x.dispose());
        mats.forEach((x) => x.dispose());
        geo.dispose();
        pgeo.dispose();
        pmat.dispose();
        frameGeo.dispose();
        dust.dispose();
        dustMat.dispose();
        gravity?.dispose();
      };
    }

    return () => {
      disposed = true;
      cleanup();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [caseId]);

  return (
    <div ref={hostRef} className={cn('relative h-full w-full', className)}>
      {state === 'loading' && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="size-10 animate-spin rounded-full border-2 border-sky/25 border-t-sky" />
        </div>
      )}
      {(state === 'error' || state === 'nogl') && (
        <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-sky/80">
          {state === 'nogl' ? 'Peramban ini tidak mendukung WebGL, jadi tampilan 3D tidak bisa dimuat.' : 'Volume 3D gagal dimuat. Coba muat ulang halaman.'}
        </div>
      )}
    </div>
  );
}

let dot: THREE.Texture | null = null;
function dotTexture() {
  if (dot) return dot;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  dot = new THREE.CanvasTexture(c);
  return dot;
}
