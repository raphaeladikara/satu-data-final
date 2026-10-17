import * as THREE from 'three';

/**
 * Cincin gravitasi di sekitar otak (port 21st.dev "lunar-gravity-card" ke three.js biasa):
 * puluhan ribu partikel yang berpusar keluar dari permukaan lalu membentuk cincin, dan
 * bongkahan kecil yang mengorbit sambil mendorong partikel di dekatnya.
 * Skala: `radius` = jari-jari objek tengah; cincin mulai 1,1x radius.
 */
const N_AST = 40;

export function createGravityRing(radius: number, opts: { count?: number; reduced?: boolean } = {}) {
  const count = opts.count ?? 52000;
  const s = radius / 2; // geometri asli dibuat untuk bulan berjari-jari 2
  const group = new THREE.Group();

  // ── partikel cincin, di bidang XZ ──
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const rnd = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const rd = Math.pow(Math.random(), 1.5);
    const r = (2.25 + rd * 2.3) * s;
    const th = (0.4 - rd * 0.2) * s;
    const y = (Math.random() + Math.random() + Math.random() - 1.5) * th;
    pos[i * 3] = Math.cos(a) * r;
    pos[i * 3 + 1] = y;
    pos[i * 3 + 2] = Math.sin(a) * r;
    const k = 1 - rd;
    const p = Math.random();
    // palet SINAPS: abu kebiruan, teal, sesekali jingga lesi
    let [cr, cg, cb] = p < 0.78 ? [0.24, 0.32, 0.36] : p < 0.95 ? [0.05, 0.62, 0.58] : [1.0, 0.5, 0.25];
    cr = Math.min(1, Math.max(0, cr + (Math.random() - 0.5) * 0.1));
    cg = Math.min(1, Math.max(0, cg + (Math.random() - 0.5) * 0.1));
    cb = Math.min(1, Math.max(0, cb + (Math.random() - 0.5) * 0.1));
    const sp = (Math.random() > 0.95 ? 2.4 : 1) * 1.35;
    col[i * 3] = cr * k * sp;
    col[i * 3 + 1] = cg * k * sp;
    col[i * 3 + 2] = cb * k * sp;
    rnd[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aRandom', new THREE.BufferAttribute(rnd, 1));

  const uniforms = {
    uProgress: { value: opts.reduced ? 1 : 0 },
    uAsteroids: { value: Array.from({ length: N_AST }, () => new THREE.Vector4()) },
    uTime: { value: 0 },
    uScale: { value: s },
  };
  const mat = new THREE.PointsMaterial({ size: 0.05 * Math.max(0.6, s), vertexColors: true, transparent: true, opacity: 0.85, sizeAttenuation: true, blending: THREE.AdditiveBlending, depthWrite: false });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader =
      `uniform float uProgress;\nuniform vec4 uAsteroids[${N_AST}];\nuniform float uTime;\nuniform float uScale;\nattribute float aRandom;\nvarying float vProgress;\n` +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        /* glsl */ `
        vec3 transformed = vec3(position);
        float ang = atan(transformed.x, transformed.z);
        float spawn = 1.0 - abs(ang) / 3.14159265;
        float pp = smoothstep(0.0, 0.4, uProgress * 1.4 - spawn);
        vProgress = pp;
        transformed.y += sin(ang * 10.0 + uTime) * 0.05 * uScale * aRandom;
        if (uProgress > 0.5) {
          for (int i = 0; i < ${N_AST}; i++) {
            vec4 ast = uAsteroids[i];
            vec3 d = transformed - ast.xyz;
            float dist = length(d);
            float rad = ast.w * 2.0 + 0.15 * uScale;
            if (dist < rad) {
              float f = pow((rad - dist) / rad, 2.0);
              transformed += normalize(d) * f * 0.4 * uScale;
              transformed.y += f * 0.2 * uScale * (aRandom - 0.5);
            }
          }
        }
        float sw = (1.0 - pp) * 4.0;
        transformed.xz = mat2(cos(sw), -sin(sw), sin(sw), cos(sw)) * transformed.xz;
        transformed.y += (1.0 - pp) * (transformed.y >= 0.0 ? 1.0 : -1.0) * uScale;
        vec3 surf = normalize(transformed) * 2.1 * uScale;
        transformed = mix(surf, transformed, pp);
        `,
      );
    shader.fragmentShader = 'varying float vProgress;\n' + shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.a *= vProgress;');
  };
  const points = new THREE.Points(geo, mat);
  group.add(points);

  // ── bongkahan yang mengorbit ──
  const asts = Array.from({ length: N_AST }, () => ({
    angle: Math.random() * Math.PI * 2,
    base: (2.8 + Math.random() * 2.0) * s,
    amp: (0.5 + Math.random() * 1.5) * s,
    rs: 0.15 + Math.random() * 0.25,
    phase: Math.random() * Math.PI * 2,
    yOff: (Math.random() - 0.5) * 0.8 * s,
    speed: (0.04 + Math.random() * 0.08) * (Math.random() > 0.5 ? 1 : -1),
    rot: new THREE.Euler(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI),
    rv: [(Math.random() - 0.5) * 0.05, (Math.random() - 0.5) * 0.05, (Math.random() - 0.5) * 0.05],
    scale: (0.02 + Math.pow(Math.random(), 4) * 0.16) * s,
  })).sort((a, b) => b.scale - a.scale);
  const astGeo = new THREE.DodecahedronGeometry(1, 0);
  const astMat = new THREE.MeshStandardMaterial({ color: '#7d8b91', roughness: 0.75, metalness: 0.1, flatShading: true });
  const rocks = new THREE.InstancedMesh(astGeo, astMat, N_AST);
  rocks.visible = false;
  group.add(rocks);
  const light = new THREE.DirectionalLight('#ffffff', 2.2);
  light.position.set(5, 4, 4);
  const fill = new THREE.DirectionalLight('#5eead4', 0.35);
  fill.position.set(-4, -2, -4);
  group.add(light, fill, new THREE.AmbientLight('#ffffff', 0.12));

  const dummy = new THREE.Object3D();
  const inv = new THREE.Matrix4();
  const tmp = new THREE.Vector3();
  let rockScale = 0;
  let state: 'hidden' | 'animating' | 'visible' = opts.reduced ? 'visible' : 'hidden';

  return {
    group,
    /** mulai animasi cincin terbentuk; dipanggil ulang = putar ulang dari awal */
    play() {
      if (opts.reduced) return;
      uniforms.uProgress.value = 0;
      state = 'animating';
    },
    tick(dt: number, t: number) {
      uniforms.uTime.value = t;
      if (state === 'animating') {
        uniforms.uProgress.value = Math.min(1, uniforms.uProgress.value + dt * 0.35);
        if (uniforms.uProgress.value >= 1) state = 'visible';
      }
      points.rotation.y -= dt * 0.02;
      points.updateMatrix();
      inv.copy(points.matrix).invert();

      const target = state === 'hidden' ? 0 : 1;
      rockScale += (target - rockScale) * Math.min(1, dt * (state === 'hidden' ? 5 : 2));
      rocks.visible = rockScale > 0.01;
      asts.forEach((a, i) => {
        a.angle += a.speed * dt;
        a.phase += a.rs * dt;
        let r = a.base + Math.sin(a.phase) * a.amp;
        const floor = 2.15 * s;
        if (r < floor) r = floor + (floor - r) * 0.85;
        const x = Math.cos(a.angle) * r;
        const z = Math.sin(a.angle) * r;
        // posisi dalam koordinat lokal cincin untuk efek dorong
        tmp.set(x, a.yOff, z).applyMatrix4(inv);
        uniforms.uAsteroids.value[i].set(tmp.x, tmp.y, tmp.z, a.scale);
        if (!rocks.visible) return;
        a.rot.x += a.rv[0];
        a.rot.y += a.rv[1];
        a.rot.z += a.rv[2];
        dummy.position.set(x, a.yOff, z);
        dummy.rotation.copy(a.rot);
        dummy.scale.setScalar(a.scale * rockScale);
        dummy.updateMatrix();
        rocks.setMatrixAt(i, dummy.matrix);
      });
      rocks.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
      astGeo.dispose();
      astMat.dispose();
      rocks.dispose();
    },
  };
}
