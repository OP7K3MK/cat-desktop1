import * as THREE from '../node_modules/three/build/three.module.js';
export function makeCat() {
  const noise = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d'), d = x.createImageData(128, 128);
    for (let i = 0; i < d.data.length; i += 4) { d.data[i] = d.data[i + 1] = d.data[i + 2] = Math.random() * 255; d.data[i + 3] = 255; }
    x.putImageData(d, 0, 0);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); return t;
  })();
  const SG = new THREE.SphereGeometry(1, 28, 20), CG = new THREE.CylinderGeometry(1, .8, 1, 14), KG = new THREE.ConeGeometry(1, 1, 4);
  // fur = layered shells pushed along normals (shell-fur technique)
  function fur(geo, col, sx, sy, sz, layers = 10) {
    const g = new THREE.Group(), len = .04 / ((sx + sy + sz) / 3);
    for (let i = 0; i <= layers; i++) {
      const k = i / layers;
      const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(col).multiplyScalar(.6 + .5 * k), roughness: 1, alphaMap: i ? noise : null, alphaTest: i ? .12 + .8 * k : 0 });
      const off = (len * k).toFixed(4);
      m.onBeforeCompile = s => { s.vertexShader = s.vertexShader.replace('#include <begin_vertex>', `vec3 transformed=position+normal*${off};`); };
      g.add(new THREE.Mesh(geo, m));
    }
    g.scale.set(sx, sy, sz); return g;
  }
  const flat = (col, s) => { const m = new THREE.Mesh(SG, new THREE.MeshStandardMaterial({ color: col, roughness: .5 })); m.scale.set(...s); return m; };
  const C = 0xd9904f, W = 0xf3e6d3;
  const root = new THREE.Group(), pose = new THREE.Group(); root.add(pose);
  const put = (o, x, y, z, p = pose) => { o.position.set(x, y, z); p.add(o); return o; };
  put(fur(SG, C, .42, .4, .75), 0, .58, 0); put(fur(SG, W, .28, .3, .3), 0, .5, .5);
  put(fur(SG, C, .24, .3, .32), -.3, .45, -.42); put(fur(SG, C, .24, .3, .32), .3, .45, -.42);
  const head = put(new THREE.Group(), 0, .88, .72);
  head.add(fur(SG, C, .31, .27, .27)); put(fur(SG, W, .13, .09, .11), 0, -.07, .22, head); put(flat(0xe88a9a, [.03, .022, .02]), 0, -.02, .32, head);
  const mouth = put(flat(0x5a1a1a, [.04, .005, .03]), 0, -.115, .24, head);
  const ears = [], eyes = [];
  for (const s of [-1, 1]) {
    const e = put(new THREE.Group(), s * .18, .22, -.02, head);
    const m = fur(KG, C, .1, .2, .05, 6); m.position.y = .1; e.add(m);
    const inner = flat(0xe8a0a8, [.05, .1, .02]); inner.position.set(0, .09, .035); e.add(inner); ears.push({ g: e, s });
    const eg = put(new THREE.Group(), s * .12, .04, .2, head);
    const ball = flat(0xa5d46a, [.065, .065, .065]); eg.add(ball);
    const pupil = flat(0x050505, [.014, .05, .02]); pupil.position.z = .055; eg.add(pupil);
    const lid = flat(C, [.072, .001, .072]); eg.add(lid); eyes.push({ ball, pupil, lid });
    for (let i = 0; i < 3; i++) {
      const w = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(s * .3, (i - 1) * .05, .04)]), new THREE.LineBasicMaterial({ color: 0xffffff }));
      put(w, s * .1, -.08, .28, head);
    }
  }
  const legs = [];
  for (const [x, z] of [[-.2, .45], [.2, .45], [-.24, -.45], [.24, -.45]]) {
    const g = put(new THREE.Group(), x, .42, z, pose);
    const u = fur(CG, C, .07, .42, .07, 7); u.position.y = -.21; g.add(u);
    const p = fur(SG, W, .085, .05, .11, 6); p.position.set(0, -.43, .04); g.add(p); legs.push(g);
  }
  const tail = []; let par = pose;
  for (let i = 0; i < 7; i++) {
    const g = new THREE.Group(); g.position.set(0, i ? .17 : 0, 0);
    if (!i) g.position.set(0, .68, -.72);
    const m = fur(CG, i > 5 ? 0x3a2a20 : C, .055, .18, .055, 6); m.position.y = .09; g.add(m);
    par.add(g); par = g; tail.push(g);
  }
  return { root, pose, head, ears, eyes, mouth, legs, tail };
}
