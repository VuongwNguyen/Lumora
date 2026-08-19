import * as THREE from 'three';

function pointsLayer(count, spread, zDepth, color, size, opacity, direction) {
  const positions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - .5) * spread.x;
    positions[i * 3 + 1] = (Math.random() - .5) * spread.y;
    positions[i * 3 + 2] = -Math.random() * zDepth;
    speeds[i] = (.05 + Math.random() * .07) * direction;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(geometry, new THREE.PointsMaterial({ color, size, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  points.userData.waterLayer = { speeds, direction, zDepth, spread };
  return points;
}

export function createWaterFX(theme, tier, reducedMotion) {
  const group = new THREE.Group();
  const near = pointsLayer(reducedMotion ? Math.floor(tier.near * .25) : tier.near, { x: 34, y: 24 }, 180, theme.memoryGlow, .09, .42, -1);
  const far = pointsLayer(reducedMotion ? Math.floor(tier.far * .25) : tier.far, { x: 70, y: 48 }, 500, theme.bioluminescent, .035, .26, -1);
  const snow = pointsLayer(reducedMotion ? Math.floor(tier.snow * .25) : tier.snow, { x: 44, y: 30 }, 260, theme.memoryGlow, .06, .3, -1);
  near.userData.layerName = 'plankton'; far.userData.layerName = 'plankton'; snow.userData.layerName = 'marineSnow';
  group.add(far, snow, near);

  const bubbleGroup = new THREE.Group();
  const bubbleCount = reducedMotion ? 12 : 34;
  for (let i = 0; i < bubbleCount; i++) {
    const bubble = new THREE.Mesh(new THREE.SphereGeometry(.035 + Math.random() * .09, 8, 8), new THREE.MeshBasicMaterial({ color: theme.memoryGlow, transparent: true, opacity: .26, depthWrite: false, blending: THREE.AdditiveBlending }));
    bubble.position.set((Math.random() - .5) * 34, -7 + Math.random() * 17, -10 - Math.random() * 220);
    bubble.userData.bubbleSpeed = .05 + Math.random() * .1;
    bubbleGroup.add(bubble);
  }
  group.add(bubbleGroup);

  const causticGroup = new THREE.Group();
  const shaftCount = reducedMotion ? 0 : tier.caustics;
  for (let i = 0; i < shaftCount; i++) {
    const material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: Math.random() * 4 }, uColor: { value: theme.coldTeal } },
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: 'uniform float uTime; uniform vec3 uColor; varying vec2 vUv; void main(){float wave=sin(vUv.y*8.0+uTime+sin(vUv.x*5.0))*0.5+0.5;float edge=smoothstep(0.0,.28,vUv.x)*smoothstep(1.0,.72,vUv.x);gl_FragColor=vec4(uColor,(.035+.05*wave)*edge);}',
    });
    const shaft = new THREE.Mesh(new THREE.PlaneGeometry(11, 52), material);
    shaft.position.set((i - shaftCount / 2) * 9, 17, -25 - i * 34);
    shaft.rotation.z = (Math.random() - .5) * .13;
    causticGroup.add(shaft);
  }
  group.add(causticGroup);
  // Task 8 cần biết các cột sáng nằm ở đâu để làm counter-illumination cho
  // DeepSilhouette (mục 14.5); Task 11 cần tắt chúng khi đổi tier.
  const causticShafts = causticGroup.children.map(shaft => ({ x: shaft.position.x, z: shaft.position.z }));
  function getCausticShafts() { return causticShafts; }
  function setCausticsEnabled(enabled) { causticGroup.visible = enabled; }
  const waterVeil = new THREE.Mesh(new THREE.PlaneGeometry(120, 100), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false,
    uniforms: { uColor: { value: theme.coldTeal }, uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'uniform vec3 uColor; uniform float uTime; varying vec2 vUv; void main(){float top=smoothstep(0.0,.62,vUv.y);float ripple=.5+.5*sin(vUv.x*9.0+uTime*.25);gl_FragColor=vec4(uColor,(.055+.035*top*ripple));}',
  }));
  waterVeil.position.set(0, 0, -18);
  group.add(waterVeil);
  let alarm = 0;

  function triggerAlarm() { alarm = Math.max(alarm, 1); }

  function update(dt, camera, elapsed) {
    alarm = Math.max(0, alarm - dt / 1.8);
    group.traverse(object => {
      const layer = object.userData.waterLayer;
      if (layer) {
        const positions = object.geometry.attributes.position.array;
        for (let i = 0; i < layer.speeds.length; i++) {
          const index = i * 3 + 1;
          positions[index] += layer.speeds[i] * dt;
          positions[i * 3] += Math.sin(elapsed * .2 + i) * .0008;
          if (positions[index] < -18) positions[index] = 15;
        }
        object.geometry.attributes.position.needsUpdate = true;
      }
      if (object.userData.bubbleSpeed) {
        object.position.y += reducedMotion ? object.userData.bubbleSpeed * .1 * dt : object.userData.bubbleSpeed * dt;
        if (object.position.y > 10) object.position.y = -8;
      }
      if (object.material?.uniforms?.uTime) object.material.uniforms.uTime.value += dt;
    });
    // Burglar-alarm response: the near plankton brightens around the camera.
    const nearMaterial = near.material;
    nearMaterial.opacity = .16 + Math.min(.28, alarm * .18 + Math.abs(Math.sin(elapsed * .4)) * .04 + Math.max(0, -camera.position.y) * .002);
  }
  return { group, update, triggerAlarm, getCausticShafts, setCausticsEnabled };
}
