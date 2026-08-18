import * as THREE from 'three';
import { ABYSS_PALETTE, resolveAccents, resolveSceneColors } from './palette.js';

export { ABYSS_PALETTE };

export function createAbyssTheme(userTheme = {}) {
  const sceneHex = resolveSceneColors(userTheme);
  const accents = resolveAccents(userTheme);
  const scene = {};
  for (const [key, hex] of Object.entries(sceneHex)) scene[key] = new THREE.Color(hex);
  return Object.freeze({
    scene,
    sceneHex,
    accent: new THREE.Color(accents.accent),
    accentSecondary: new THREE.Color(accents.accentSecondary),
  });
}
