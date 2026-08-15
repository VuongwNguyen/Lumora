import * as THREE from 'three';

// ── Fetch galaxy data ──────────────────────────────────────────────────────
const params = new URLSearchParams(location.search);
const galaxyId = params.get('galaxyId');
const activity = window.LumoraActivity;

async function fetchData() {
  if (!galaxyId) return { images: [], captions: [], soundscape: null, theme: null };
  try {
    const [viewRes, imgRes] = await Promise.all([
      fetch(`/galaxies/${galaxyId}/view`),
      fetch(`/gallary/items?galaxyId=${encodeURIComponent(galaxyId)}`)
    ]);
    const view = viewRes.ok ? (await viewRes.json()).meta : {};
    const imgs = imgRes.ok ? (await imgRes.json()).meta : [];
    return {
      images: imgs.map(i => i.imageUrl),
      captions: view.caption || [],
      soundscape: view.soundscape || null,
      theme: view.theme?.colors || null,
      name: view.name || ''
    };
  } catch { return { images: [], captions: [], soundscape: null, theme: null }; }
}

// ── Scene setup ────────────────────────────────────────────────────────────
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 2000);
camera.position.set(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.getElementById('canvas-container').appendChild(renderer.domElement);

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ── Starfield ──────────────────────────────────────────────────────────────
function buildStarfield() {
  const count = 8000;
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i*3]   = (Math.random() - 0.5) * 1200;
    pos[i*3+1] = (Math.random() - 0.5) * 1200;
    pos[i*3+2] = -Math.random() * 1200;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.6, transparent: true, opacity: 0.7, depthWrite: false });
  return new THREE.Points(geo, mat);
}
const stars = buildStarfield();
scene.add(stars);

// ── Particle dust ──────────────────────────────────────────────────────────
function buildParticles() {
  const count = 6000;
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i*3]   = (Math.random() - 0.5) * 80;
    pos[i*3+1] = (Math.random() - 0.5) * 70;
    pos[i*3+2] = -Math.random() * 600;
    // Soft purple/white tones
    const r = 0.7 + Math.random() * 0.3;
    const g = 0.5 + Math.random() * 0.3;
    const b = 0.9 + Math.random() * 0.1;
    col[i*3] = r; col[i*3+1] = g; col[i*3+2] = b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color',    new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.12, vertexColors: true,
    transparent: true, opacity: 0.55,
    depthWrite: false, blending: THREE.AdditiveBlending
  });
  return new THREE.Points(geo, mat);
}
const dust = buildParticles();
scene.add(dust);

// ── Sparkles ───────────────────────────────────────────────────────────────
function buildSparkles() {
  const count = 8000;
  const pos   = new Float32Array(count * 3);
  const col   = new Float32Array(count * 3);
  const phase = new Float32Array(count);
  const speed = new Float32Array(count);

  const palette = [
    [1.0, 0.85, 0.25], // gold
    [1.0, 0.40, 0.75], // pink
    [0.30, 0.90, 1.0], // cyan
    [0.80, 0.45, 1.0], // purple
    [1.0, 1.0,  1.0],  // white
  ];

  for (let i = 0; i < count; i++) {
    pos[i*3]   = (Math.random() - 0.5) * 120;
    pos[i*3+1] = (Math.random() - 0.5) * 80;
    pos[i*3+2] = (Math.random() - 0.5) * 700;
    const c = palette[Math.floor(Math.random() * palette.length)];
    col[i*3] = c[0]; col[i*3+1] = c[1]; col[i*3+2] = c[2];
    phase[i] = Math.random() * Math.PI * 2;
    speed[i] = 1.2 + Math.random() * 4.0;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color',    new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aPhase',   new THREE.BufferAttribute(phase, 1));
  geo.setAttribute('aSpeed',   new THREE.BufferAttribute(speed, 1));

  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      attribute float aPhase; attribute float aSpeed;
      uniform float uTime;
      varying vec3 vColor; varying float vAlpha;
      void main() {
        vColor = color;
        float tw = sin(uTime * aSpeed + aPhase) * 0.5 + 0.5;
        vAlpha = tw * tw;
        gl_PointSize = 1.5 + tw * 5.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vColor; varying float vAlpha;
      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        if (length(uv) > 0.5) discard;
        float core = exp(-length(uv) * 14.0);
        float rayH = exp(-abs(uv.y) * 28.0) * (1.0 - smoothstep(0.0, 0.5, abs(uv.x)));
        float rayV = exp(-abs(uv.x) * 28.0) * (1.0 - smoothstep(0.0, 0.5, abs(uv.y)));
        float star = core + (rayH + rayV) * 0.9;
        gl_FragColor = vec4(vColor, star * vAlpha);
      }
    `,
    transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, vertexColors: true,
  });

  return new THREE.Points(geo, mat);
}
const sparkles = buildSparkles();
scene.add(sparkles);

// ── Shooting stars ─────────────────────────────────────────────────────────
const shootingStars = [];

function randomCurve() {
  const s = new THREE.Vector3(-150 + Math.random()*80, -60 + Math.random()*120, cameraZ - 20 - Math.random()*60);
  const e = new THREE.Vector3(s.x + 300 + Math.random()*150, s.y + (-80+Math.random()*160), s.z + (-60+Math.random()*120));
  const c1 = new THREE.Vector3(s.x+120+Math.random()*80, s.y+(-40+Math.random()*80), s.z+(-40+Math.random()*80));
  const c2 = new THREE.Vector3(e.x-120+Math.random()*80, e.y+(-40+Math.random()*80), e.z+(-40+Math.random()*80));
  return new THREE.CubicBezierCurve3(s, c1, c2, e);
}

function spawnShootingStar() {
  const TRAIL = 80;
  const headGeo = new THREE.SphereGeometry(0.8, 8, 8);
  const headMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending });
  const head = new THREE.Mesh(headGeo, headMat);

  const curve = randomCurve();
  const pts = Array.from({ length: TRAIL }, (_, i) => curve.getPoint(i / (TRAIL - 1)));
  const trailGeo = new THREE.BufferGeometry().setFromPoints(pts);
  const trailMat = new THREE.LineBasicMaterial({ color: 0xaaddff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending });
  const trail = new THREE.Line(trailGeo, trailMat);

  const g = new THREE.Group();
  g.add(head); g.add(trail);
  g.userData = { curve, progress: 0, speed: 0.0012 + Math.random()*0.001, life: 0, maxLife: 280, head, trail, pts, TRAIL };
  scene.add(g);
  shootingStars.push(g);
}

function updateShootingStars(t) {
  for (let i = shootingStars.length - 1; i >= 0; i--) {
    const s = shootingStars[i];
    s.userData.life++;
    s.userData.progress += s.userData.speed;

    let opacity = 1;
    if (s.userData.life < 25) opacity = s.userData.life / 25;
    else if (s.userData.life > s.userData.maxLife - 25) opacity = (s.userData.maxLife - s.userData.life) / 25;

    if (s.userData.progress >= 1 || s.userData.life >= s.userData.maxLife) {
      scene.remove(s);
      shootingStars.splice(i, 1);
      continue;
    }

    const pos = s.userData.curve.getPoint(s.userData.progress);
    s.userData.head.position.copy(pos);
    s.userData.head.material.opacity = opacity;

    const pts = s.userData.pts;
    for (let j = 0; j < s.userData.TRAIL; j++) {
      const tp = Math.max(0, s.userData.progress - j * 0.008);
      pts[j].copy(s.userData.curve.getPoint(tp));
    }
    s.userData.trail.geometry.setFromPoints(pts);
    s.userData.trail.material.opacity = opacity * 0.55;
  }
  if (shootingStars.length < 3 && Math.random() < 0.018) spawnShootingStar();
}

// ── Aurora ─────────────────────────────────────────────────────────────────
function buildAurora() {
  // Wide ribbon plane in the background
  const geo = new THREE.PlaneGeometry(200, 40, 60, 1);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime:   { value: 0 },
      uColor1: { value: new THREE.Color(0x00e699) },
      uColor2: { value: new THREE.Color(0x8019e5) },
    },
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 pos = position;
        pos.y += sin(pos.x * 0.08 + uTime * 0.6) * 5.0
                + sin(pos.x * 0.15 + uTime * 0.4) * 3.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      varying vec2 vUv;
      void main() {
        float alpha = sin(vUv.x * 3.14159) * (1.0 - vUv.y) * 0.35;
        alpha *= 0.6 + 0.4 * sin(vUv.x * 8.0 + uTime * 0.7);
        vec3 col = mix(uColor1, uColor2, vUv.x + 0.3 * sin(uTime * 0.3));
        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, 18, -80);
  mesh.rotation.x = 0.15;
  scene.add(mesh);
  return mesh;
}
const auroraMesh = buildAurora();

// ── Mystery planet ─────────────────────────────────────────────────────────
function buildMysteryPlanet() {
  const group = new THREE.Group();
  group.position.set(3, -4, 150);

  // Core sphere — deep purple atmosphere shader
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(14, 64, 64),
    new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        varying vec3 vNormal; varying vec2 vUv;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime; varying vec3 vNormal; varying vec2 vUv;
        void main() {
          float rim = pow(1.0 - abs(dot(vNormal, vec3(0.0,0.0,1.0))), 2.2);
          float band = sin(vUv.y * 18.0 + uTime * 0.12) * 0.5 + 0.5;
          float swirl = sin(vUv.x * 10.0 + vUv.y * 6.0 + uTime * 0.08) * 0.5 + 0.5;
          vec3 dark = vec3(0.03, 0.01, 0.12);
          vec3 mid  = vec3(0.08, 0.03, 0.28);
          vec3 edge = vec3(0.35, 0.08, 0.75);
          vec3 col = mix(dark, mid, band * swirl);
          col = mix(col, edge, rim * 0.7);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      transparent: false,
    })
  );
  group.add(sphere);

  // Atmosphere halo (backside glow)
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(17, 32, 32),
    new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float rim = pow(1.0 - abs(dot(vNormal, vec3(0.0,0.0,1.0))), 3.5);
          gl_FragColor = vec4(0.45, 0.08, 0.9, rim * 0.55);
        }
      `,
      transparent: true, depthWrite: false,
      side: THREE.BackSide, blending: THREE.AdditiveBlending,
    })
  );
  group.add(halo);

  // Rings
  const ringGeo = new THREE.RingGeometry(19, 32, 80);
  // UV remap for ring gradient
  const ringPos = ringGeo.attributes.position;
  const ringUV  = ringGeo.attributes.uv;
  for (let i = 0; i < ringPos.count; i++) {
    const x = ringPos.getX(i), y = ringPos.getY(i);
    const r = Math.sqrt(x*x + y*y);
    ringUV.setXY(i, (r - 19) / 13, 0);
  }
  const ring = new THREE.Mesh(ringGeo, new THREE.ShaderMaterial({
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      varying vec2 vUv;
      void main() {
        float t = vUv.x;
        float gap = smoothstep(0.38, 0.42, t) * (1.0 - smoothstep(0.55, 0.58, t));
        vec3 col = mix(vec3(0.3,0.05,0.6), vec3(0.6,0.2,1.0), t);
        gl_FragColor = vec4(col, (0.25 + t * 0.2) * gap);
      }
    `,
    transparent: true, depthWrite: false,
    side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  }));
  ring.rotation.x = 1.1;
  group.add(ring);

  // Outer glow sprite
  const gc = document.createElement('canvas'); gc.width = gc.height = 256;
  const gctx = gc.getContext('2d');
  const gr = gctx.createRadialGradient(128,128,0,128,128,128);
  gr.addColorStop(0,   'rgba(110,30,255,0.5)');
  gr.addColorStop(0.4, 'rgba(60,10,160,0.15)');
  gr.addColorStop(1,   'rgba(0,0,0,0)');
  gctx.fillStyle = gr; gctx.fillRect(0,0,256,256);
  const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(gc), transparent: true,
    depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  glowSprite.scale.set(80, 80, 1);
  group.add(glowSprite);

  scene.add(group);
  return { group, sphere, ring };
}
const mysteryPlanet = buildMysteryPlanet();

// ── Galaxy band (visible khi nhìn xuống) ───────────────────────────────────
function buildGalaxyBand() {
  const group = new THREE.Group();

  // Soft radial gradient texture dùng cho particles
  function makeBlob(size) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(size/2,size/2,0,size/2,size/2,size/2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.6)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0,0,size,size);
    return new THREE.CanvasTexture(c);
  }
  const blobSm = makeBlob(32);
  const blobLg = makeBlob(128);

  // ── Layer 1: Core sáng trắng/cyan ────────────────────────────────────
  {
    const count = 7000;
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = Math.pow(Math.random(), 1.8) * 28;
      const a = Math.random() * Math.PI * 2;
      pos[i*3] = Math.cos(a) * r; pos[i*3+1] = (Math.random()-0.5) * 1.5; pos[i*3+2] = Math.sin(a) * r;
      const b = 0.8 + Math.random() * 0.2;
      col[i*3] = b; col[i*3+1] = b + 0.05; col[i*3+2] = b + 0.1;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color',    new THREE.BufferAttribute(col, 3));
    group.add(new THREE.Points(geo, new THREE.PointsMaterial({
      map: blobSm, size: 1.5, vertexColors: true,
      transparent: true, opacity: 0.7,
      depthWrite: false, blending: THREE.AdditiveBlending, alphaTest: 0.01,
    })));
  }

  // ── Layer 2: Spiral arms — xanh dương → tím → hồng ───────────────────
  {
    const count = 18000;
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 12 + Math.pow(Math.random(), 0.5) * 150;
      const arm = Math.floor(Math.random() * 3);
      const a = Math.random() * Math.PI * 2 + arm * (Math.PI*2/3) + r * 0.016;
      const sc = (Math.random()-0.5) * r * 0.2;
      pos[i*3] = Math.cos(a)*r+sc; pos[i*3+1] = (Math.random()-0.5)*2*(1-r/165); pos[i*3+2] = Math.sin(a)*r+sc;
      const t = Math.min(1, r / 150);
      const b = 0.5 + Math.random() * 0.5;
      col[i*3]   = b * (0.3 + t * 0.7);
      col[i*3+1] = b * (0.2 + t * 0.15);
      col[i*3+2] = b * (1.0 - t * 0.5);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color',    new THREE.BufferAttribute(col, 3));
    group.add(new THREE.Points(geo, new THREE.PointsMaterial({
      map: blobSm, size: 1.2, vertexColors: true,
      transparent: true, opacity: 0.55,
      depthWrite: false, blending: THREE.AdditiveBlending, alphaTest: 0.01,
    })));
  }

  // ── Layer 3: Nebula clouds — tím/magenta/hồng tỏa ra ─────────────────
  {
    const count = 1200;
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 20 + Math.random() * 170;
      const a = Math.random() * Math.PI * 2;
      pos[i*3] = Math.cos(a)*r + (Math.random()-0.5)*40;
      pos[i*3+1] = (Math.random()-0.5) * 10;
      pos[i*3+2] = Math.sin(a)*r + (Math.random()-0.5)*40;
      const hue = Math.random();
      col[i*3]   = 0.65 + hue * 0.35;
      col[i*3+1] = 0.05 + hue * 0.15;
      col[i*3+2] = 0.85 - hue * 0.3;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color',    new THREE.BufferAttribute(col, 3));
    group.add(new THREE.Points(geo, new THREE.PointsMaterial({
      map: blobLg, size: 9, vertexColors: true,
      transparent: true, opacity: 0.07,
      depthWrite: false, blending: THREE.AdditiveBlending, alphaTest: 0.001,
    })));
  }

  // ── Central glow sprite ───────────────────────────────────────────────
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeBlob(256), transparent: true, opacity: 0.5,
    depthWrite: false, blending: THREE.AdditiveBlending,
    color: new THREE.Color(0.85, 0.95, 1.0),
  }));
  glow.scale.set(22, 22, 1);
  group.add(glow);

  group.position.y = -28;
  group.rotation.x = 0.18;
  scene.add(group);
  return group;
}
const galaxyBand = buildGalaxyBand();

// ── Upper nebula clouds (lấp vùng trên) ────────────────────────────────────
function buildUpperNebula() {
  const makeBlob = (size) => {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(size/2,size/2,0,size/2,size/2,size/2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.4)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0,0,size,size);
    return new THREE.CanvasTexture(c);
  };
  const texMed = makeBlob(128);
  const texLg  = makeBlob(256);

  // Phân tán theo cả Y lẫn Z để phủ khi nhìn 45° lên
  // z âm = phía trước camera, y dương = phía trên
  const cfgs = [
    // Gần + thấp (z -10 đến -25) — thấy khi nhìn lên ~30°
    { x: -50, y: 18, z: -15, s: 75,  col: new THREE.Color(0.25, 0.08, 0.85), op: 0.28, tex: texMed },
    { x:  45, y: 20, z: -20, s: 85,  col: new THREE.Color(0.08, 0.25, 0.95), op: 0.25, tex: texMed },
    { x: -20, y: 15, z: -12, s: 65,  col: new THREE.Color(0.55, 0.08, 0.90), op: 0.22, tex: texMed },
    // Mid range (z -35 đến -55) — thấy khi nhìn ~45°
    { x: -70, y: 35, z: -40, s: 100, col: new THREE.Color(0.15, 0.15, 0.85), op: 0.24, tex: texMed },
    { x:  60, y: 38, z: -45, s: 110, col: new THREE.Color(0.35, 0.05, 0.75), op: 0.21, tex: texMed },
    { x:  -5, y: 30, z: -38, s: 90,  col: new THREE.Color(0.70, 0.10, 0.80), op: 0.20, tex: texMed },
    { x:  80, y: 32, z: -50, s: 95,  col: new THREE.Color(0.20, 0.10, 0.90), op: 0.19, tex: texMed },
    // Far + cao (z -65 đến -90) — thấy khi nhìn ~60-70°
    { x:   0, y: 55, z: -70, s: 130, col: new THREE.Color(0.20, 0.05, 0.80), op: 0.17, tex: texLg },
    { x: -80, y: 60, z: -75, s: 115, col: new THREE.Color(0.50, 0.05, 0.85), op: 0.14, tex: texLg },
    { x:  65, y: 50, z: -65, s: 125, col: new THREE.Color(0.10, 0.20, 0.90), op: 0.16, tex: texLg },
    { x: -35, y: 70, z: -85, s: 105, col: new THREE.Color(0.60, 0.08, 0.75), op: 0.12, tex: texLg },
    { x:  45, y: 65, z: -80, s: 140, col: new THREE.Color(0.30, 0.05, 0.90), op: 0.13, tex: texLg },
  ];

  const group = new THREE.Group();
  cfgs.forEach(({ x, y, z, s, col, op, tex }) => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, transparent: true, opacity: op,
      depthWrite: false, blending: THREE.AdditiveBlending, color: col,
    }));
    sprite.scale.set(s, s, 1);
    sprite.position.set(x, y, z);
    group.add(sprite);
  });

  // Điểm sáng "bắc cực tinh"
  const star = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeBlob(64), transparent: true, opacity: 0.7,
    depthWrite: false, blending: THREE.AdditiveBlending,
    color: new THREE.Color(0.85, 0.90, 1.0),
  }));
  star.scale.set(10, 10, 1);
  star.position.set(5, 90, -60);
  group.add(star);

  scene.add(group);
  return group;
}
const upperNebula = buildUpperNebula();

// ── Polaroid factory ───────────────────────────────────────────────────────
const loader = new THREE.TextureLoader();
const polaroids = [];

function makePolaroidFromTex(tex, col, colOffsets, zPos) {
  const group = new THREE.Group();

  // Fixed width, height adapts to image aspect ratio
  const imgAspect = (tex.image?.height || 1) / (tex.image?.width || 1);
  const photoW = 1.4;
  const photoH = photoW * imgAspect;
  const frameW = photoW + 0.28;        // 0.14 border each side
  const frameH = photoH + 0.14 + 0.5; // 0.14 top, 0.5 bottom (writing space)
  // Photo center y = frameH/2 - 0.14 - photoH/2 = 0.18

  const frame = new THREE.Mesh(
    new THREE.PlaneGeometry(frameW, frameH),
    new THREE.MeshBasicMaterial({ color: 0xf5f0e8, side: THREE.DoubleSide, depthWrite: false })
  );
  frame.renderOrder = 0;
  group.add(frame);

  const photo = new THREE.Mesh(
    new THREE.PlaneGeometry(photoW, photoH),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })
  );
  photo.position.set(0, 0.18, 0.001);
  photo.renderOrder = 1;
  group.add(photo);

  const gc = document.createElement('canvas'); gc.width = gc.height = 128;
  const gctx = gc.getContext('2d');
  const gr = gctx.createRadialGradient(64,64,0,64,64,64);
  gr.addColorStop(0,'rgba(200,160,255,0.35)'); gr.addColorStop(1,'rgba(0,0,0,0)');
  gctx.fillStyle = gr; gctx.fillRect(0,0,128,128);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(gc), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.scale.set(frameW * 2.2, frameH * 2.0, 1); glow.position.z = -0.1;
  group.add(glow);
  group.position.set(colOffsets[col] + (Math.random()-0.5)*2.5, (Math.random()-0.5)*10.0, zPos);
  group.rotation.set((Math.random()-0.5)*0.25, (Math.random()-0.5)*0.2, (Math.random()-0.5)*0.35);
  group.userData = { driftX:(Math.random()-0.5)*0.002, driftY:(Math.random()-0.5)*0.002, rotSpeed:(Math.random()-0.5)*0.0006, phase:Math.random()*Math.PI*2 };
  scene.add(group);
  return group;
}


// ── Camera fall state ──────────────────────────────────────────────────────
const _autostart = new URLSearchParams(location.search).get('autostart') === 'true';
let started = _autostart; // skip intro immediately in preview mode
let fallSpeed = 0;
const TARGET_SPEED = 0.06;
const ACCEL = 0.0004;
let cameraZ = 0;
let totalDepth = 0;

// Subtle camera sway

// Touch/mouse look-around
let lookX = 0, lookY = 0;
let _lastPX = 0, _lastPY = 0, _dragging = false;
const LOOK_SENS_X = 0.004, LOOK_SENS_Y = 0.003;

renderer.domElement.addEventListener('mousemove', e => {
  if (!started || !_dragging) return;
  lookX += (e.clientX - _lastPX) * LOOK_SENS_X;
  lookY += (e.clientY - _lastPY) * LOOK_SENS_Y;
  _lastPX = e.clientX; _lastPY = e.clientY;
});
renderer.domElement.addEventListener('touchmove', e => {
  if (!started) return;
  const t = e.touches[0];
  lookX += (t.clientX - _lastPX) * LOOK_SENS_X;
  lookY += (t.clientY - _lastPY) * LOOK_SENS_Y;
  _lastPX = t.clientX; _lastPY = t.clientY;
}, { passive: true });

const intro = document.getElementById('intro');
function startExperience() {
  started = true;
  intro.classList.add('hidden');
  window.musicManager?.play()
    .then(() => window.musicManager?.setEnvironment('open_space', { transitionSeconds: 4 }))
    .catch(() => {});
  const el = document.documentElement;
  (el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen)?.call(el);
}

// Hide intro immediately in preview mode
if (_autostart) {
  intro.style.display = 'none';
}

// ── Main init ──────────────────────────────────────────────────────────────
async function init() {
  const data = await fetchData();

  // Set title
  if (data.name) document.getElementById('intro-title').textContent = data.name;

  // Background color from theme
  const bgColor = data.theme?.background ? new THREE.Color(data.theme.background) : new THREE.Color(0x000005);
  scene.background = bgColor;
  scene.fog = new THREE.FogExp2(bgColor.getHex(), 0.006);

  // Original Lumora soundscape
  window.musicManager?.init(data.soundscape);
  if (!_autostart) intro.addEventListener('click', startExperience, { once: true });

  // document.title
  if (data.name) document.title = `${data.name} — Lumora`;

  // Apply theme colors to visual elements
  if (data.theme) {
    const primary   = new THREE.Color(data.theme?.colors?.primary   || '#00e699');
    const secondary = new THREE.Color(data.theme?.colors?.secondary || '#8019e5');

    auroraMesh.material.uniforms.uColor1.value.copy(primary);
    auroraMesh.material.uniforms.uColor2.value.copy(secondary);

    const pal = [
      [primary.r, primary.g, primary.b],
      [secondary.r, secondary.g, secondary.b],
      [1, 1, 1],
      [Math.min(1, primary.r*1.4),   Math.min(1, primary.g*1.4),   Math.min(1, primary.b*1.4)],
      [Math.min(1, secondary.r*1.4), Math.min(1, secondary.g*1.4), Math.min(1, secondary.b*1.4)],
    ];
    const sparkleCol = sparkles.geometry.getAttribute('color');
    for (let i = 0; i < sparkleCol.count; i++) {
      const c = pal[i % pal.length];
      sparkleCol.setXYZ(i, c[0], c[1], c[2]);
    }
    sparkleCol.needsUpdate = true;

    const dustCol = dust.geometry.getAttribute('color');
    for (let i = 0; i < dustCol.count; i++) {
      dustCol.setXYZ(i,
        0.4 + primary.r * 0.6,
        0.4 + primary.g * 0.4,
        0.6 + primary.b * 0.4
      );
    }
    dustCol.needsUpdate = true;
  }

  // Build polaroids — infinite pool, pre-spawn ahead of camera
  const images = data.images.length ? data.images : [];
  if (!images.length) { animate(); return; }

  const COLS = images.length <= 12 ? 3 : 4;
  const COL_SPACING = 8.5;
  const colOffsets = Array.from({ length: COLS }, (_, c) => (c - (COLS - 1) / 2) * COL_SPACING);

  // Pre-load all textures once
  const textures = await Promise.all(images.map(url => new Promise(res => {
    loader.load(url, tex => { tex.colorSpace = THREE.SRGBColorSpace; res(tex); }, undefined, () => res(null));
  })));

  // Pool: COLS * VISIBLE_ROWS polaroids
  const VISIBLE_ROWS = 6;
  const ROW_DEPTH = 12;
  let nextRowZ = -5;

  // Caption queue
  const captions = data.captions;
  let captionIdx = 0;
  const captionSprites = [];

  function spawnCaption(zPos) {
    if (!captions.length) return;
    const text = captions[captionIdx % captions.length];
    captionIdx++;

    const FONT = '300 48px Georgia, serif';
    const MAX_W = 640;  // max width mỗi dòng (pixels)
    const PAD_X = 60;
    const LINE_H = 72;
    const PAD_Y = 40;

    // Word-wrap
    const tmp = document.createElement('canvas').getContext('2d');
    tmp.font = FONT;
    const words = text.split(' ');
    const lines = [];
    let cur = '';
    for (const word of words) {
      const test = cur ? cur + ' ' + word : word;
      if (tmp.measureText(test).width > MAX_W && cur) {
        lines.push(cur);
        cur = word;
      } else {
        cur = test;
      }
    }
    if (cur) lines.push(cur);

    const W = MAX_W + PAD_X * 2;
    const H = lines.length * LINE_H + PAD_Y * 2;
    const cx = W / 2;

    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.font = FONT;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

    lines.forEach((line, i) => {
      const y = PAD_Y + i * LINE_H + LINE_H / 2;
      // Outer glow
      ctx.shadowColor = 'rgba(200,140,255,1.0)'; ctx.shadowBlur = 40;
      ctx.fillStyle = 'rgba(200,140,255,0.25)';
      ctx.fillText(line, cx, y);
      // Main text
      ctx.shadowColor = 'rgba(255,200,255,0.9)'; ctx.shadowBlur = 18;
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.fillText(line, cx, y);
    });

    // Scale sprite giữ tỉ lệ canvas
    const scaleX = 18;
    const scaleY = scaleX * (H / W);
    const mat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(scaleX, scaleY, 1);
    sprite.position.set((Math.random()-0.5)*4, (Math.random()-0.5)*2, zPos);
    sprite.userData.pulsePhase = Math.random() * Math.PI * 2;
    scene.add(sprite);
    captionSprites.push(sprite);
  }

  let rowCount = 0;

  function spawnRow(zPos) {
    rowCount++;
    if (captions.length && rowCount % 5 === 0) {
      spawnCaption(zPos - ROW_DEPTH * 0.5);
      // Không return — tiếp tục spawn ảnh bình thường cho row này
    }
    for (let c = 0; c < COLS; c++) {
      const texIdx = Math.floor(Math.random() * textures.length);
      const tex = textures[texIdx];
      if (!tex) continue;
      // Small Z jitter within the row — stay within own row zone
      const zOffset = (Math.random() - 0.5) * ROW_DEPTH * 0.8;
      const p = makePolaroidFromTex(tex, c, colOffsets, zPos + zOffset);
      polaroids.push(p);
    }
    // Spawn 1-2 mini floating photos in the gaps
    const miniCount = 3 + Math.floor(Math.random() * 3);
    for (let m = 0; m < miniCount; m++) {
      const tex = textures[Math.floor(Math.random() * textures.length)];
      if (!tex) continue;
      const mini = makePolaroidFromTex(tex, Math.floor(Math.random() * COLS), colOffsets, zPos + (Math.random() - 0.5) * ROW_DEPTH * 0.6);
      if (m < 2) {
        // High-altitude minis — nhỏ hơn, trông như ảnh xa ở phía trên
        const s = 0.18 + Math.random() * 0.14;
        mini.scale.set(s, s, s);
        mini.position.x += (Math.random() - 0.5) * 28;
        mini.position.y += 9 + Math.random() * 10;
      } else {
        const s = 0.35 + Math.random() * 0.3;
        mini.scale.set(s, s, s);
        mini.position.x += (Math.random() > 0.5 ? 1 : -1) * (4 + Math.random() * 10);
        mini.position.y += (Math.random() - 0.5) * 14;
      }
      polaroids.push(mini);
    }

    // Ambient photos — phân tán Y cao + Z phía trước (giới hạn để không nặng)
    const ambCount = 2 + Math.floor(Math.random() * 2); // 2–3 mỗi row
    for (let a = 0; a < ambCount; a++) {
      const tex = textures[Math.floor(Math.random() * textures.length)];
      if (!tex) continue;
      const zOffset = -(8 + Math.random() * ROW_DEPTH * 2.5); // tối đa ~38 units phía trước
      const amb = makePolaroidFromTex(tex, Math.floor(Math.random() * COLS), colOffsets, zPos + zOffset);
      const s = 0.10 + Math.random() * 0.18;
      amb.scale.set(s, s, s);
      amb.position.x = (Math.random() - 0.5) * 40;
      amb.position.y = 12 + Math.random() * 22;
      polaroids.push(amb);
    }

    window._nextRowZ = zPos - ROW_DEPTH;
  }

  // Pre-spawn initial rows
  for (let r = 0; r < VISIBLE_ROWS; r++) {
    spawnRow(nextRowZ);
  }

  // Store spawn function for animate loop
  window._spawnRow = spawnRow;
  window._colOffsets = colOffsets;
  window._nextRowZ = nextRowZ;
  window._captionSprites = captionSprites;

  // Animate
  animate();
}

let frozen = false;
let boostSpeed = 0;
const BOOST = 1.0;
const BOOST_DECAY = 0.02;


// ── Raycaster (polaroid interaction) ───────────────────────────────────────
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let clickedPolaroid = null;

// ── Burst particles ────────────────────────────────────────────────────────
const bursts = [];

function spawnBurst(pos) {
  const count = 24;
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors    = new Float32Array(count * 3);
  const vel = [];
  for (let i = 0; i < count; i++) {
    positions[i*3]   = pos.x + (Math.random()-0.5)*2;
    positions[i*3+1] = pos.y + (Math.random()-0.5)*2;
    positions[i*3+2] = pos.z + (Math.random()-0.5)*2;
    colors[i*3]   = 0.8 + Math.random()*0.2;
    colors[i*3+1] = 0.5 + Math.random()*0.4;
    colors[i*3+2] = 1.0;
    vel.push({ x: (Math.random()-0.5)*0.06, y: 0.04+Math.random()*0.04, z: (Math.random()-0.5)*0.04 });
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.25, vertexColors: true, transparent: true, opacity: 1.0,
    depthWrite: false, blending: THREE.AdditiveBlending,
    map: (() => { const c=document.createElement('canvas'); c.width=c.height=16; const x=c.getContext('2d'),g=x.createRadialGradient(8,8,0,8,8,8); g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle=g; x.fillRect(0,0,16,16); return new THREE.CanvasTexture(c); })(),
    alphaTest: 0.01,
  });
  const pts = new THREE.Points(geo, mat);
  scene.add(pts);
  bursts.push({ pts, life: 0, maxLife: 60, vel });
}

// Scroll → boost
renderer.domElement.addEventListener('wheel', e => {
  if (!started) return;
  if (e.deltaY > 0) boostSpeed = BOOST; // scroll down = speed up
}, { passive: true });

// Hold → freeze + polaroid click detection
function handlePointerDown(clientX, clientY) {
  if (!started) return;
  frozen = true;
  _dragging = true;
  _lastPX = clientX; _lastPY = clientY;
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((clientX - rect.left) / rect.width)  * 2 - 1;
  mouse.y = -((clientY - rect.top)  / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const meshes = polaroids.flatMap(p => p.children.filter(c => c.isMesh));
  const hits = raycaster.intersectObjects(meshes, false);
  if (hits.length) {
    const parent = polaroids.find(p => p.children.includes(hits[0].object));
    if (parent) {
      activity?.log({ action: 'Viewer Photo Open', feature: 'viewer', galaxyId, description: { template: 'fall' } });
      window.musicManager?.setEnvironment('memory_focus', { transitionSeconds: 1.4 });
      clickedPolaroid = parent;
      parent.userData.targetScale = 3.0;
      // 4 units ahead of camera along its look direction
      const fwd = new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation);
      parent.userData.targetPosition = camera.position.clone().addScaledVector(fwd, 4);
    }
  }
}
function handlePointerUp() {
  frozen = false;
  _dragging = false;
  if (clickedPolaroid) {
    activity?.log({ action: 'Viewer Photo Close', feature: 'viewer', galaxyId, description: { template: 'fall', via: 'release' } });
    window.musicManager?.setEnvironment('open_space', { transitionSeconds: 3.2 });
    clickedPolaroid.userData.targetScale = 1.0;
    delete clickedPolaroid.userData.targetPosition;
    // Đẩy ảnh ra khỏi camera sau khi nhả
    const side = Math.random() > 0.5 ? 1 : -1;
    clickedPolaroid.userData.driftX = side * (0.06 + Math.random() * 0.04);
    clickedPolaroid.userData.driftY = (Math.random() - 0.5) * 0.05;
    clickedPolaroid = null;
  }
}

renderer.domElement.addEventListener('mousedown', e => handlePointerDown(e.clientX, e.clientY));
renderer.domElement.addEventListener('mouseup',   handlePointerUp);
renderer.domElement.addEventListener('touchstart', e => handlePointerDown(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
renderer.domElement.addEventListener('touchend',   handlePointerUp);

// ── "Ngưng Đọng Thời Gian" overlay ────────────────────────────────────────
const freezeEl = document.createElement('div');
freezeEl.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);color:rgba(255,255,255,0.55);font-size:13px;letter-spacing:0.25em;text-transform:uppercase;pointer-events:none;opacity:0;transition:opacity 0.4s;font-family:Georgia,serif;text-shadow:0 0 20px rgba(180,120,255,0.8)';
freezeEl.textContent = '✦ Ngưng Đọng Thời Gian ✦';
document.body.appendChild(freezeEl);
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  if (started) {
    // Freeze overlay
    freezeEl.style.opacity = frozen ? '1' : '0';

    if (!frozen) {
      // Accelerate to target speed + boost decay
      if (fallSpeed < TARGET_SPEED) fallSpeed += ACCEL;
      if (boostSpeed > 0) boostSpeed = Math.max(0, boostSpeed - BOOST_DECAY);

      cameraZ -= (fallSpeed + boostSpeed);
    }

    camera.position.z = cameraZ;

    if (!frozen) {
      camera.position.x += (0 - camera.position.x) * 0.02;
      camera.position.y += (0 - camera.position.y) * 0.02;
    }

    // Look-around theo drag — luôn hoạt động kể cả khi frozen
    camera.rotation.y += (-lookX - camera.rotation.y) * 0.18;
    camera.rotation.x += (-lookY - camera.rotation.x) * 0.18;
  } else {
    // Idle: gentle float
    camera.position.y = Math.sin(t * 0.3) * 0.3;
    camera.rotation.x = Math.sin(t * 0.2) * 0.02;
  }

  // Infinite spawn: spawn new rows ahead, remove old ones behind
  if (window._spawnRow) {
    const SPAWN_AHEAD = 50;
    while (window._nextRowZ > cameraZ - SPAWN_AHEAD) {
      window._spawnRow(window._nextRowZ);
    }
    // Remove polaroids too far behind camera
    for (let i = polaroids.length - 1; i >= 0; i--) {
      if (polaroids[i].position.z > cameraZ + 80) {
        scene.remove(polaroids[i]);
        polaroids.splice(i, 1);
      }
    }
    // Remove + pulse caption sprites
    if (window._captionSprites) {
      for (let i = window._captionSprites.length - 1; i >= 0; i--) {
        const s = window._captionSprites[i];
        if (s.position.z > cameraZ + 80) {
          scene.remove(s);
          window._captionSprites.splice(i, 1);
        } else if (s.userData.pulsePhase !== undefined) {
          const distS = Math.abs(s.position.z - camera.position.z);
          const baseA = Math.max(0, Math.min(1, (70 - distS) / 20));
          s.material.opacity = baseA * (0.75 + 0.25 * Math.sin(t * 1.8 + s.userData.pulsePhase));
        }
      }
    }
  }
  polaroids.forEach(p => {
    const isSelected = clickedPolaroid === p;

    if (isSelected && p.userData.targetPosition) {
      // Zoom in: lerp toward point in front of camera, straighten tilt
      p.position.lerp(p.userData.targetPosition, 0.06);
      p.rotation.x += (0 - p.rotation.x) * 0.08;
      p.rotation.y += (0 - p.rotation.y) * 0.08;
      p.rotation.z += (0 - p.rotation.z) * 0.08;
    } else {
      // Camera proximity avoidance — né camera khi quá gần
      const zDist = Math.abs(p.position.z - camera.position.z);
      const dx = p.position.x - camera.position.x;
      const dy = p.position.y - camera.position.y;
      const lateralDist = Math.sqrt(dx * dx + dy * dy);
      if (zDist < 10 && lateralDist < 4) {
        const strength = (4 - lateralDist) / 4 * 0.12;
        const nx = lateralDist > 0.05 ? dx / lateralDist : (Math.random() > 0.5 ? 1 : -1);
        const ny = lateralDist > 0.05 ? dy / lateralDist : (Math.random() - 0.5);
        p.userData.driftX += nx * strength;
        p.userData.driftY += ny * strength * 0.5;
        // Giới hạn tốc độ né tối đa
        const mag = Math.sqrt(p.userData.driftX ** 2 + p.userData.driftY ** 2);
        if (mag > 0.12) {
          p.userData.driftX = p.userData.driftX / mag * 0.12;
          p.userData.driftY = p.userData.driftY / mag * 0.12;
        }
      } else {
        // Giảm tốc dần về drift bình thường khi đã né xong
        p.userData.driftX *= 0.97;
        p.userData.driftY *= 0.97;
      }

      // Normal drift + bob
      p.position.x += p.userData.driftX;
      p.position.y += p.userData.driftY;
      p.rotation.z += p.userData.rotSpeed;
      p.position.y += Math.sin(t * 0.5 + p.userData.phase) * 0.0008;
      if (Math.abs(p.position.x) > 18) p.userData.driftX *= -1;
      if (Math.abs(p.position.y) > 12) p.userData.driftY *= -1;
    }

    // Fade by distance
    const dist = Math.abs(p.position.z - camera.position.z);
    const alpha = Math.max(0, Math.min(1, (70 - dist) / 20));

    // Scale animation — slow lerp gives the "gradually zooming in" feel
    const targetScale = p.userData.targetScale ?? 1.0;
    p.scale.setScalar(p.scale.x + (targetScale - p.scale.x) * 0.06);

    // Ẩn glow khi zoom để ảnh hiện sạch, không bị chá sáng
    p.children.forEach(child => {
      if (!child.material) return;
      if (child.isSprite) {
        child.material.opacity = isSelected ? 0 : alpha * 0.85;
      } else if (child.material.opacity !== undefined) {
        child.material.opacity = isSelected ? 1 : alpha;
      }
    });

    // Burst on first close pass
    if (dist < 4 && !p.userData.burst) {
      p.userData.burst = true;
      spawnBurst(p.position.clone());
    }
    if (dist > 20) p.userData.burst = false;
  });

  // Update burst particles
  for (let i = bursts.length - 1; i >= 0; i--) {
    const b = bursts[i];
    b.life++;
    b.pts.material.opacity = 1 - b.life / b.maxLife;
    const pos = b.pts.geometry.getAttribute('position');
    for (let j = 0; j < pos.count; j++) {
      pos.setX(j, pos.getX(j) + b.vel[j].x);
      pos.setY(j, pos.getY(j) + b.vel[j].y);
      pos.setZ(j, pos.getZ(j) + b.vel[j].z);
    }
    pos.needsUpdate = true;
    if (b.life >= b.maxLife) { scene.remove(b.pts); bursts.splice(i, 1); }
  }

  // Stars + dust + sparkles scroll with camera
  stars.position.z = cameraZ * 0.3;
  dust.position.z  = cameraZ * 0.85;
  sparkles.position.z = cameraZ * 0.92;
  sparkles.material.uniforms.uTime.value = t;
  dust.position.x = Math.sin(t * 0.15) * 0.5;
  dust.position.y = Math.cos(t * 0.1)  * 0.3;

  // Aurora follows camera
  auroraMesh.material.uniforms.uTime.value = t;
  auroraMesh.position.z = cameraZ - 80;

  // Galaxy band follows camera in Z, slow rotation
  galaxyBand.position.z = cameraZ;
  galaxyBand.rotation.y += 0.0008;

  // Upper nebula follows camera
  upperNebula.position.z = cameraZ + 10;

  // Shooting stars
  updateShootingStars(t);

  // Mystery planet — slow spin, breathe glow
  mysteryPlanet.sphere.rotation.y = t * 0.04;
  mysteryPlanet.sphere.material.uniforms.uTime.value = t;
  mysteryPlanet.ring.rotation.z = t * 0.012;

  renderer.render(scene, camera);
}

init();
