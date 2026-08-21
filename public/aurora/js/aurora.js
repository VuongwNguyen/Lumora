import * as THREE from 'three';

// ── Fetch ─────────────────────────────────────────────────────────────────────
const galaxyId = new URLSearchParams(location.search).get('galaxyId');
const activity = window.LumoraActivity;
async function fetchData() {
  if (!galaxyId) return { images:[], captions:[], soundscape:null, theme:null, name:'' };
  try {
    const [vr,ir] = await Promise.all([
      fetch(`/galaxies/${galaxyId}/view`),
      fetch(`/gallary/items?galaxyId=${encodeURIComponent(galaxyId)}`)
    ]);
    const view = vr.ok ? (await vr.json()).meta : {};
    const imgs = ir.ok ? (await ir.json()).meta : [];
    return { images:imgs.map(i=>i.imageUrl), captions:view.caption||[],
             soundscape:view.soundscape||null, theme:view.theme?.colors||null, name:view.name||'' };
  } catch { return { images:[], captions:[], soundscape:null, theme:null, name:'' }; }
}

// ── Renderer ──────────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias:true });
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth, innerHeight);
document.getElementById('canvas-container').appendChild(renderer.domElement);

const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, innerWidth/innerHeight, 0.1, 3000);
camera.position.set(0, 3.0, 0);
// Positive rotation.x = look UP (right-hand rule about X-axis)
camera.rotation.x = 0.55;

window.addEventListener('resize', () => {
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ── Sky dome — aurora lives here ──────────────────────────────────────────────
const DOME_FRAG = `
  uniform float uTime;
  uniform vec3  uC1;
  uniform vec3  uC2;
  uniform vec3  uC3;
  varying vec3  vN;

  void main(){
    float elev = vN.y;

    // Sky base: dark navy gradient
    vec3 sky = mix(vec3(0.004,0.018,0.055), vec3(0.001,0.006,0.022), clamp(elev,0.0,1.0));

    // Aurora band: centered near horizon, very wide
    float bandCenter = 0.22 + sin(uTime*0.08)*0.04;
    float bandShape  = exp(-pow((elev - bandCenter)/0.38, 2.0));

    // Shimmer using vN.x and vN.z directly (no atan needed)
    float sh1 = sin(vN.x*6.0 + uTime*0.45)*0.5+0.5;
    float sh2 = cos(vN.z*8.0 - uTime*0.30)*0.5+0.5;
    float sh3 = sin(vN.x*3.0 + vN.z*4.0 + uTime*0.20)*0.5+0.5;
    float shimmer = sh1*0.4 + sh2*0.35 + sh3*0.25;

    // Vertical ray curtain effect
    float ray = pow(max(0.0, sin(vN.x*18.0 + uTime*0.12)*0.5+0.5), 2.0);

    float intensity = bandShape * shimmer * (0.8 + ray*0.5) * 4.5;

    // Color: blend C1→C2→C3 across the sphere using vN.x
    float ct = clamp(vN.x*0.5+0.5 + sin(uTime*0.18)*0.1, 0.0, 1.0);
    vec3 aCol = ct < 0.5 ? mix(uC1, uC2, ct*2.0) : mix(uC2, uC3, (ct-0.5)*2.0);

    // Second faint band above (purple)
    float band2 = exp(-pow((elev-(bandCenter+0.20))/0.12, 2.0));
    vec3 aurora2 = vec3(0.5,0.0,1.0) * band2 * (sin(vN.z*6.0+uTime*0.25)*0.5+0.5) * 3.0;

    // Stars: simple dots using fract pattern (no noise function)
    float sx = fract(vN.x*47.3 + vN.z*31.7 + 0.5);
    float sy = fract(vN.y*63.1 + vN.x*19.4 + 0.3);
    float star = step(0.97, sx) * step(0.97, sy) * max(0.0, elev*2.0);

    float fade = smoothstep(0.0, 0.08, elev);
    vec3 col = sky + aCol*intensity*fade + aurora2*fade + vec3(star*0.8);
    gl_FragColor = vec4(col, 1.0);
  }
`;
const DOME_VERT = `
  varying vec3 vN;
  void main(){
    vN = normalize(position);   // direction from sphere centre = sky direction
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const domeMat = new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value:0 },
    uC1:   { value: new THREE.Color(0x00ff55) },  // green
    uC2:   { value: new THREE.Color(0x00ddff) },  // cyan
    uC3:   { value: new THREE.Color(0x8800ff) },  // purple
  },
  vertexShader: DOME_VERT,
  fragmentShader: DOME_FRAG,
  side: THREE.BackSide,
  depthWrite: false,
});
const dome = new THREE.Mesh(new THREE.SphereGeometry(1200, 64, 32), domeMat);
scene.add(dome);

// ── Ground — dark tundra/ice ──────────────────────────────────────────────────
const groundMat = new THREE.ShaderMaterial({
  uniforms: { uTime:{value:0} },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `
    uniform float uTime; varying vec2 vUv;
    float hash(float n){ return fract(sin(n)*43758.5); }
    void main(){
      // dark ice base
      vec3 base = vec3(0.008,0.030,0.055);
      // subtle aurora reflection along x
      float r1 = sin(vUv.x*4.0+uTime*0.3)*0.5+0.5;
      float r2 = cos(vUv.x*7.0-uTime*0.2)*0.5+0.5;
      vec3 reflect = vec3(0.0, r1*0.12+r2*0.05, r2*0.18+r1*0.08);
      // fade by view distance (vUv.y=0 far edge, 1 near feet)
      float near = vUv.y;
      // snow grain
      float grain = hash(vUv.x*512.0+vUv.y*512.0)*0.04;
      gl_FragColor = vec4(base + reflect*(near*0.6+0.2) + grain*0.02, 1.0);
    }
  `,
});
const ground = new THREE.Mesh(new THREE.PlaneGeometry(1200,600,1,1), groundMat);
ground.rotation.x = -Math.PI/2;
ground.position.y = -2.5;
scene.add(ground);

// Horizon soft glow
{
  const hc = document.createElement('canvas'); hc.width=512; hc.height=64;
  const hx = hc.getContext('2d');
  const hg = hx.createLinearGradient(0,0,0,64);
  hg.addColorStop(0,'rgba(0,80,60,0)'); hg.addColorStop(0.5,'rgba(0,120,80,0.35)'); hg.addColorStop(1,'rgba(0,0,0,0)');
  hx.fillStyle=hg; hx.fillRect(0,0,512,64);
  const hsp = new THREE.Sprite(new THREE.SpriteMaterial({
    map:new THREE.CanvasTexture(hc), transparent:true, depthWrite:false, blending:THREE.AdditiveBlending
  }));
  hsp.scale.set(1200,18,1);
  hsp.position.set(0,-0.5,-200);
  scene.add(hsp);
}

// ── Photo frame factory ───────────────────────────────────────────────────────
function makeFrame(tex, imgSrc) {
  const ar  = tex.image.height / tex.image.width;
  const fw  = 13.0, fh = fw * Math.min(Math.max(ar,0.55),1.6);
  const grp = new THREE.Group();

  // Dark mat backing
  const mat = new THREE.Mesh(
    new THREE.PlaneGeometry(fw+0.3, fh+0.3),
    new THREE.MeshBasicMaterial({color:0x030c16})
  );
  mat.position.z = -0.02;
  grp.add(mat);

  // Photo
  const img = new THREE.Mesh(
    new THREE.PlaneGeometry(fw, fh),
    new THREE.MeshBasicMaterial({map:tex})
  );
  img.userData.imgSrc = imgSrc;
  grp.add(img);

  // Aurora border — canvas with edge glow only
  const bc=document.createElement('canvas'); bc.width=256; bc.height=256;
  const bx=bc.getContext('2d');
  const borderGrad = bx.createLinearGradient(0,0,256,256);
  borderGrad.addColorStop(0,   'rgba(0,255,140,1)');
  borderGrad.addColorStop(0.5, 'rgba(0,200,255,1)');
  borderGrad.addColorStop(1,   'rgba(160,0,255,1)');
  bx.fillStyle=borderGrad; bx.shadowColor='#00ffcc'; bx.shadowBlur=20;
  bx.fillRect(0,0,256,256); bx.clearRect(18,18,220,220);
  const bm = new THREE.Mesh(
    new THREE.PlaneGeometry(fw+0.22,fh+0.22),
    new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(bc),transparent:true,depthWrite:false})
  );
  bm.position.z=-0.01;
  grp.add(bm);

  // Wide diffuse glow
  const gc=document.createElement('canvas'); gc.width=256; gc.height=256;
  const gx=gc.getContext('2d');
  const rg=gx.createRadialGradient(128,128,0,128,128,128);
  rg.addColorStop(0,'rgba(0,255,160,0.22)'); rg.addColorStop(0.5,'rgba(0,160,255,0.12)'); rg.addColorStop(1,'rgba(0,0,0,0)');
  gx.fillStyle=rg; gx.fillRect(0,0,256,256);
  const gs=new THREE.Sprite(new THREE.SpriteMaterial({
    map:new THREE.CanvasTexture(gc),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending
  }));
  gs.scale.set(fw*3.8,fh*3.8,1); gs.position.z=-0.05;
  grp.add(gs);

  grp.userData = { imgSrc, imgMesh:img, phase:Math.random()*Math.PI*2,
                   bobSpd:0.28+Math.random()*0.18, bx:0, by:0 };
  return grp;
}

// ── Caption factory ───────────────────────────────────────────────────────────
function makeCaption(text){
  const cw=760,ch=110; const c=document.createElement('canvas'); c.width=cw; c.height=ch;
  const ctx=c.getContext('2d');
  ctx.font='300 italic 23px Georgia,serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
  const words=text.split(' '); let line='',lines=[];
  for(const w of words){const t=line?`${line} ${w}`:w; if(ctx.measureText(t).width>720){lines.push(line);line=w;}else line=t;}
  if(line)lines.push(line);
  const lh=32,sy=ch/2-((lines.length-1)*lh)/2;
  ctx.shadowColor='#00ffcc'; ctx.shadowBlur=28; ctx.fillStyle='rgba(180,255,240,0.92)';
  lines.forEach((l,i)=>ctx.fillText(l,cw/2,sy+i*lh));
  ctx.shadowBlur=7; ctx.fillStyle='rgba(230,255,252,1)';
  lines.forEach((l,i)=>ctx.fillText(l,cw/2,sy+i*lh));
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false}));
  sp.scale.set(15.5,3.1,1); sp.userData.phase=Math.random()*Math.PI*2; return sp;
}

// ── Lightbox ──────────────────────────────────────────────────────────────────
const lb=document.getElementById('lightbox'), lbImg=document.getElementById('lightbox-img');
document.getElementById('lightbox-close').addEventListener('click',()=>{ lb.classList.remove('visible'); activity?.log({ action:'Viewer Photo Close', feature:'viewer', galaxyId, description:{ template:'aurora', via:'button' } }); });
lb.addEventListener('click',e=>{if(e.target===lb){ lb.classList.remove('visible'); activity?.log({ action:'Viewer Photo Close', feature:'viewer', galaxyId, description:{ template:'aurora', via:'backdrop' } }); }});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&lb.classList.contains('visible')){ lb.classList.remove('visible'); activity?.log({ action:'Viewer Photo Close', feature:'viewer', galaxyId, description:{ template:'aurora', via:'escape' } }); }});

// ── State ─────────────────────────────────────────────────────────────────────
let cameraZ=0, fallSpd=0, boost=0, started=false;
let lookX=0, lookY=0;
let panels=[], capSprites=[], textures=[], captions=[];

// Telemetry cho QA tự động — chỉ bật khi ?debug=1 (public/shared/js/lumoraDebug.js).
window.LumoraDebug?.attach({
  template: 'aurora', scene, camera, renderer,
  extra: {
    get cameraZ() { return Math.round(cameraZ); },
    get started() { return started; },
    get panels() { return panels.length; },
  },
});
let pIdx=0, cIdx=0, nextZ=-22;
const clock=new THREE.Clock(), ray=new THREE.Raycaster(), mouse=new THREE.Vector2();

// ── Spawn ─────────────────────────────────────────────────────────────────────
function spawnRow(z){
  if(!textures.length){ nextZ=z-26; return; }

  // 3 columns, photos float in the aurora (y = 3..12)
  const cols=[{x:-17,y:5+Math.random()*4},{x:0,y:4+Math.random()*5},{x:17,y:5+Math.random()*4}];
  const n=textures.length===1?1:textures.length===2?2:3;
  const slots=n===1?[cols[1]]:n===2?[cols[0],cols[2]]:cols;

  slots.forEach(({x,y})=>{
    const tex=textures[pIdx%textures.length], src=tex.image?.src||'';
    pIdx++;
    const p=makeFrame(tex,src);
    const px=x+(Math.random()-0.5)*3, py=y;
    p.position.set(px,py,z);
    p.userData.bx=px; p.userData.by=py;
    p.rotation.y=(Math.random()-0.5)*0.18;
    scene.add(p); panels.push(p);
  });

  // Mid-size floaters spread around, also in the sky
  for(let m=0;m<2+Math.floor(Math.random()*2);m++){
    if(!textures.length)break;
    const tex=textures[pIdx%textures.length], src=tex.image?.src||'';
    pIdx++;
    const p=makeFrame(tex,src);
    const sc=0.35+Math.random()*0.30; p.scale.setScalar(sc);
    const x=(Math.random()-0.5)*45, y=3+Math.random()*10;
    p.position.set(x,y,z+(Math.random()-0.5)*12);
    p.userData.bx=x; p.userData.by=y;
    scene.add(p); panels.push(p);
  }

  if(captions.length && pIdx%4===0){
    const cap=makeCaption(captions[cIdx%captions.length]); cIdx++;
    cap.position.set((Math.random()-0.5)*18, 2+Math.random()*4, z-10);
    scene.add(cap); capSprites.push(cap);
  }
  nextZ=z-32;
}

// ── Input ─────────────────────────────────────────────────────────────────────
let drag=false,dsx=0,dsy=0;
const pointerDown=(cx,cy)=>{ drag=false;dsx=cx;dsy=cy; };
const pointerMove=(cx,cy,btn)=>{ if(!btn)return; if(Math.abs(cx-dsx)+Math.abs(cy-dsy)>5)drag=true; lookX=(cx-dsx)*0.0006; lookY=(cy-dsy)*0.00038; };
const pointerUp=(cx,cy)=>{
  if(drag||!started)return;
  mouse.x=(cx/innerWidth)*2-1; mouse.y=-(cy/innerHeight)*2+1;
  ray.setFromCamera(mouse,camera);
  const hits=ray.intersectObjects(panels.map(p=>p.userData.imgMesh).filter(Boolean));
  if(hits.length){
    lbImg.src=hits[0].object.userData.imgSrc;
    lb.classList.add('visible');
    activity?.log({ action:'Viewer Photo Open', feature:'viewer', galaxyId, description:{ template:'aurora' } });
  }
};
renderer.domElement.addEventListener('mousedown', e=>pointerDown(e.clientX,e.clientY));
renderer.domElement.addEventListener('mousemove', e=>pointerMove(e.clientX,e.clientY,e.buttons));
renderer.domElement.addEventListener('mouseup',   e=>pointerUp(e.clientX,e.clientY));
renderer.domElement.addEventListener('touchstart',e=>pointerDown(e.touches[0].clientX,e.touches[0].clientY),{passive:true});
renderer.domElement.addEventListener('touchmove', e=>pointerMove(e.touches[0].clientX,e.touches[0].clientY,1),{passive:true});
renderer.domElement.addEventListener('touchend',  e=>pointerUp(e.changedTouches[0].clientX,e.changedTouches[0].clientY));
window.addEventListener('wheel',e=>{ if(started&&e.deltaY>0) boost=Math.min(boost+0.22,0.9); });

function startExperience(){
  started=true;
  document.getElementById('intro').classList.add('hidden');
  window.musicManager.play?.().catch?.(()=>{});
  document.documentElement.requestFullscreen?.().catch?.(()=>{});
}

// ── Animate ───────────────────────────────────────────────────────────────────
function animate(){
  requestAnimationFrame(animate);
  const t=clock.getElapsedTime();

  if(started){
    fallSpd += (0.048 - fallSpd)*0.0005;
    boost   *= 0.965;
    cameraZ -= fallSpd+boost;

    camera.rotation.y += (-lookX - camera.rotation.y)*0.07;
    // Clamp vertical look so user can look up at aurora or down at ground
    const targetX = Math.max(-0.1, Math.min(1.0, 0.55 - lookY*0.5));
    camera.rotation.x += (targetX - camera.rotation.x)*0.07;
    lookX*=0.90; lookY*=0.90;
  }

  // Dome always centred on camera
  dome.position.set(camera.position.x, camera.position.y, cameraZ);
  domeMat.uniforms.uTime.value = t;

  // Ground follows camera Z
  ground.position.z = cameraZ;
  groundMat.uniforms.uTime.value = t;

  // Spawn ahead
  while(nextZ > cameraZ-240) spawnRow(nextZ);

  // Panels: gentle bob
  for(let i=panels.length-1;i>=0;i--){
    const p=panels[i];
    p.position.y = p.userData.by + Math.sin(t*p.userData.bobSpd+p.userData.phase)*0.5;
    p.position.x = p.userData.bx + Math.sin(t*0.20+p.userData.phase*1.2)*0.22;
    if(p.position.z > cameraZ+22){ scene.remove(p); panels.splice(i,1); }
  }
  for(let i=capSprites.length-1;i>=0;i--){
    const c=capSprites[i];
    c.material.opacity=0.45+Math.sin(t*1.5+c.userData.phase)*0.42;
    if(c.position.z > cameraZ+22){ scene.remove(c); capSprites.splice(i,1); }
  }

  renderer.render(scene,camera);
}

// ── Init ──────────────────────────────────────────────────────────────────────
async function init(){
  const data=await fetchData();
  captions=data.captions;
  if(data.name){ const el=document.getElementById('intro-title'); if(el)el.textContent=data.name; }
  if(data.theme){
    const c1=data.theme.primary||'#00ff55', c2=data.theme.secondary||'#00ddff';
    domeMat.uniforms.uC1.value.set(c1);
    domeMat.uniforms.uC2.value.set(c2);
  }
  window.musicManager.init(data.soundscape);
  document.getElementById('intro').addEventListener('click',startExperience,{once:true});
  if(data.images.length){
    const loader=new THREE.TextureLoader();
    textures=await Promise.all(data.images.map(url=>new Promise(res=>{
      loader.load(url,t=>{t.colorSpace=THREE.SRGBColorSpace;res(t);},undefined,()=>res(null));
    }))).then(ts=>ts.filter(Boolean));
  }
  for(let z=-22;z>-240;z-=26) spawnRow(z);
  animate();
}
init();
