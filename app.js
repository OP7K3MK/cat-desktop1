import * as THREE from '../node_modules/three/build/three.module.js';
import { makeCat } from './cat.js';
const $ = id => document.getElementById(id), api = window.api;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const R = new THREE.WebGLRenderer({ canvas: $('c'), alpha: true, antialias: true });
R.setPixelRatio(devicePixelRatio); R.setSize(innerWidth, innerHeight); R.autoClear = false; R.setClearColor(0x000000, 0);
const S = new THREE.Scene();
S.add(new THREE.HemisphereLight(0xfff2e0, 0x806040, 1.2));
const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(2, 3, 3); S.add(sun);
const cam = new THREE.PerspectiveCamera(30, 1, .1, 50); cam.position.set(0, 1, 3.2); cam.lookAt(0, .55, 0);
const cat = makeCat(); S.add(cat.root);

// ---------- state ----------
const VP = 240, floor = () => innerHeight - 8;
let px = innerWidth * .7, cy = floor(), vy = 0, tx = px, state = 'idle', stT = 2, emo = 'neutral', emoUntil = 0;
let yaw = .5, mx = px, my = 0, lastMove = 0, lastAct = 0, phase = 0, nextBlink = 2, hopT = -9, mouthT = 0, speaking = false;
let chatOpen = false, clicks = [], dragging = false, down = null, over = false;
const EM = {
  neutral: { eye: 1, ear: 0, mouth: 0, tail: .25, spd: 2, pup: .014 }, happy: { eye: .55, ear: .1, mouth: .12, tail: .7, spd: 4, pup: .03 },
  love: { eye: .35, ear: .1, mouth: .08, tail: .8, spd: 3, pup: .045 }, curious: { eye: 1.15, ear: .35, mouth: 0, tail: .4, spd: 3, pup: .03 },
  surprised: { eye: 1.3, ear: .4, mouth: .3, tail: .9, spd: 6, pup: .05 }, angry: { eye: .6, ear: -.7, mouth: .35, tail: .9, spd: 7, pup: .01 },
  sad: { eye: .7, ear: -.5, mouth: 0, tail: -.2, spd: 1, pup: .04 }, sleepy: { eye: .25, ear: -.1, mouth: 0, tail: .1, spd: 1, pup: .014 }
};
const P = { ...EM.neutral, sit: 0, sleep: 0, str: 0, walk: 0 };
const now = () => performance.now() / 1000;
const setState = (s, d) => { state = s; stT = d; };
const setEmo = (e, sec) => { emo = EM[e] ? e : 'happy'; emoUntil = now() + sec; };

// ---------- audio ----------
let actx; const A = () => actx || (actx = new AudioContext());
function meow(p = 1, d = .7) {
  const c = A(), t = c.currentTime, o = c.createOscillator(), f1 = c.createBiquadFilter(), f2 = c.createBiquadFilter(), g = c.createGain();
  o.type = 'sawtooth'; o.frequency.setValueAtTime(380 * p, t); o.frequency.linearRampToValueAtTime(720 * p, t + d * .35); o.frequency.linearRampToValueAtTime(420 * p, t + d);
  f1.type = f2.type = 'bandpass'; f1.Q.value = 6; f2.Q.value = 9;
  f1.frequency.setValueAtTime(700, t); f1.frequency.linearRampToValueAtTime(1500, t + d * .4); f1.frequency.linearRampToValueAtTime(900, t + d); f2.frequency.value = 2600;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1.5, t + .06); g.gain.linearRampToValueAtTime(1, t + d * .6); g.gain.linearRampToValueAtTime(0, t + d);
  o.connect(f1); o.connect(f2); f1.connect(g); f2.connect(g); g.connect(c.destination); o.start(t); o.stop(t + d + .05); mouthT = now() + d;
}
function purr(sec = 3) {
  const c = A(), n = c.sampleRate * 2, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const s = c.createBufferSource(); s.buffer = b; s.loop = true;
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220;
  const g = c.createGain(), l = c.createOscillator(), lg = c.createGain(); g.gain.value = .3; l.frequency.value = 24; lg.gain.value = .25;
  l.connect(lg); lg.connect(g.gain); s.connect(lp); lp.connect(g); g.connect(c.destination); s.start(); l.start();
  setTimeout(() => { s.stop(); l.stop(); }, sec * 1000);
}
function speak(txt) {
  if (!txt.trim()) return;
  const u = new SpeechSynthesisUtterance(txt), ar = /[\u0600-\u06FF]/.test(txt);
  u.lang = ar ? 'ar-SA' : (/[a-zA-Z]/.test(txt) ? 'en-US' : navigator.language);
  const v = speechSynthesis.getVoices().find(v => v.lang.toLowerCase().startsWith(u.lang.slice(0, 2).toLowerCase()));
  if (!v) return; u.voice = v; u.pitch = 1.6; u.rate = 1.05;
  u.onstart = () => speaking = true; u.onend = () => speaking = false;
  speechSynthesis.cancel(); speechSynthesis.speak(u);
}
function heart() {
  const h = document.createElement('div'); h.className = 'heart'; h.textContent = '💗';
  h.style.left = (px + Math.random() * 40 - 20) + 'px'; h.style.top = (cy - 160) + 'px'; document.body.appendChild(h); setTimeout(() => h.remove(), 1700);
}

// ---------- UI / chat ----------
let bt; const bub = $('bub'), row = $('row'), ui = $('ui');
const updateUI = () => { row.style.display = chatOpen ? 'flex' : 'none'; ui.style.display = (chatOpen || bub.style.display === 'block') ? 'block' : 'none'; };
function say(txt, sec) {
  bub.textContent = txt; bub.style.display = 'block'; clearTimeout(bt);
  if (sec < 90) bt = setTimeout(() => { bub.style.display = 'none'; updateUI(); }, sec * 1000); updateUI();
}
api.on('status', s => say(s, 8)); api.on('open-chat', () => { chatOpen = true; updateUI(); $('t').focus(); }); api.on('sleep', () => setState('sleep', 25));
async function send(text) {
  text = text.trim(); if (!text) return; lastAct = now(); say('…', 99); setEmo('curious', 30);
  let r; try { r = await api.chat(text); } catch (e) { r = '[sad] ' + e.message; }
  const m = r.match(/^\s*\[(\w+)\]\s*/), e = m ? m[1].toLowerCase() : 'happy', body = r.replace(/^\s*\[\w+\]\s*/, '');
  setEmo(e, 7); say(body, 14); meow(1.1 + Math.random() * .3);
  if (e === 'love' || e === 'happy') purr(2.5);
  setTimeout(() => speak(body.replace(/meow|مياو/gi, '')), 600);
}
$('s').onclick = () => { send($('t').value); $('t').value = ''; };
$('t').onkeydown = e => { if (e.key === 'Enter') $('s').onclick(); };
let rec = null;
$('m').onclick = async () => {
  if (!rec) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true }), ac = new AudioContext({ sampleRate: 16000 });
    const src = ac.createMediaStreamSource(stream), proc = ac.createScriptProcessor(4096, 1, 1), ch = [];
    proc.onaudioprocess = e => ch.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    src.connect(proc); proc.connect(ac.destination); rec = { stream, ac, proc, src, ch };
    $('m').textContent = '⏹'; say('🎙️ ...', 99); setEmo('curious', 60);
  } else {
    const { stream, ac, proc, src, ch } = rec; rec = null; proc.disconnect(); src.disconnect(); stream.getTracks().forEach(t => t.stop()); ac.close();
    const a = new Float32Array(ch.reduce((n, c) => n + c.length, 0)); let o = 0; ch.forEach(c => { a.set(c, o); o += c.length; });
    $('m').textContent = '🎤'; say('…', 99);
    const txt = await api.stt(a); if (txt) { say(txt, 3); send(txt); } else say('🙉', 3);
  }
};

// ---------- input on the cat ----------
const hitCat = e => Math.abs(e.clientX - px) < 70 && e.clientY > cy - 150 && e.clientY < cy + 5;
addEventListener('pointermove', e => {
  mx = e.clientX; my = e.clientY; lastMove = now();
  if (down && !dragging && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) { dragging = true; setState('drag', 999); setEmo('surprised', 999); }
  if (dragging) { px = e.clientX; cy = Math.min(floor(), e.clientY + 120); }
  const o = !!down || hitCat(e) || !!(e.target.closest && e.target.closest('#ui'));
  if (o !== over) { over = o; api.ignore(!o); }
});
addEventListener('pointerdown', e => { if (e.target.closest('#ui') || !hitCat(e)) return; down = { x: e.clientX, y: e.clientY }; });
addEventListener('pointerup', () => {
  if (!down) return; const d = dragging; down = null; dragging = false;
  if (d) { emo = 'neutral'; setState('idle', 2); return; }
  lastAct = now(); const t = now(); clicks = clicks.filter(c => t - c < 1.5); clicks.push(t);
  if (clicks.length >= 5) { setEmo('angry', 3); meow(.7, .4); clicks = []; }
  else { setEmo(Math.random() < .5 ? 'love' : 'happy', 3); meow(1 + Math.random() * .4, .5); hopT = t; heart(); if (state === 'sleep') setState('idle', 3); }
});
addEventListener('dblclick', e => { if (hitCat(e)) { chatOpen = !chatOpen; updateUI(); if (chatOpen) $('t').focus(); } });
addEventListener('contextmenu', e => { if (hitCat(e)) api.menu(); });

// ---------- behaviour ----------
function decide(t) {
  const r = Math.random();
  if (state === 'sleep' && r < .6) return setState('sleep', 6 + Math.random() * 10);
  if (t - lastMove < 2.5 && Math.abs(mx - px) > 220 && r < .5) { tx = mx - Math.sign(mx - px) * 130; return setState('walk', 8); }
  if (t - lastAct > 45 && r < .4) setState('sleep', 10 + Math.random() * 15);
  else if (r < .35) setState('idle', 3 + Math.random() * 4);
  else if (r < .55) setState('sit', 5 + Math.random() * 6);
  else if (r < .8) { tx = clamp(80 + Math.random() * (innerWidth - 160), 110, innerWidth - 110); setState('walk', 10); }
  else if (r < .9) setState('stretch', 3.5);
  else setState('idle', 2);
}
function update(dt, t) {
  if (emo !== 'neutral' && t > emoUntil) emo = 'neutral';
  if ((stT -= dt) <= 0 && state !== 'drag') decide(t);
  let walk = 0;
  const cursorYaw = clamp((mx - px) / 300, -1, 1) * .8;
  let ty = Math.abs(cursorYaw) < .35 ? (cursorYaw < 0 ? -.35 : .35) : cursorYaw;
  if (state === 'walk') { const d = tx - px; if (Math.abs(d) < 6) setState('idle', 3); else { px += Math.sign(d) * 95 * dt; walk = 1; ty = Math.sign(d) * 1.45; } }
  if (state === 'sleep') ty = ty < 0 ? -1.1 : 1.1;
  px = clamp(px, 110, innerWidth - 110);
  yaw += (ty - yaw) * Math.min(1, dt * 5);
  if (state !== 'drag' && cy < floor()) { vy += 1800 * dt; cy = Math.min(floor(), cy + vy * dt); if (cy >= floor()) vy = 0; }
  // targets
  const T = { ...EM[emo] };
  if (state === 'sleep') { T.eye = .03; T.ear = -.1; T.tail = .05; T.spd = .8; }
  if (state === 'stretch') { T.eye = .2; T.mouth = .6; T.tail = .9; }
  if (state === 'sit' && emo === 'neutral') T.eye = .85;
  T.sit = state === 'sit' ? 1 : 0; T.sleep = state === 'sleep' ? 1 : 0; T.str = state === 'stretch' ? 1 : 0; T.walk = walk;
  for (const k in T) P[k] += (T[k] - P[k]) * Math.min(1, dt * 8);
  phase += dt * 9 * walk;
  // blink
  let blink = 0; if (t > nextBlink) { blink = 1; if (t > nextBlink + .14) nextBlink = t + 2 + Math.random() * 4; }
  const open = blink ? .04 : Math.min(1, P.eye), wide = Math.max(1, P.eye), c = 1 - open;
  for (const e of cat.eyes) {
    e.lid.visible = c > .03; e.lid.scale.y = .072 * c + .001; e.lid.position.y = .075 * (1 - c);
    e.ball.scale.setScalar(.065 * wide); e.pupil.scale.x = P.pup;
  }
  for (const { g, s } of cat.ears) { g.rotation.z = -s * (.25 - P.ear * .9); g.rotation.x = P.ear * .5; }
  const talk = (speaking || mouthT > t) ? .25 + .15 * Math.sin(t * 25) : 0;
  cat.mouth.scale.y = .005 + (P.mouth + talk) * .07;
  // body pose
  const hop = (t - hopT < .35) ? Math.sin((t - hopT) / .35 * Math.PI) * .25 : 0;
  cat.pose.rotation.x = -.5 * P.sit + .45 * P.str;
  cat.pose.position.y = -.14 * P.sit - .3 * P.sleep + Math.abs(Math.sin(phase)) * .03 * P.walk + hop;
  cat.pose.scale.y = 1 - .25 * P.sleep + Math.sin(t * 2) * .012;
  cat.head.rotation.y += (clamp(cursorYaw - yaw, -.7, .7) - cat.head.rotation.y) * Math.min(1, dt * 6);
  cat.head.rotation.x = -clamp((cy - 100 - my) / 400, -1, 1) * .35 + .55 * P.sleep + .5 * P.str;
  const off = [0, Math.PI, Math.PI, 0];
  cat.legs.forEach((l, i) => l.rotation.x = state === 'drag' ? Math.sin(t * 8 + i) * .2 : Math.sin(phase + off[i]) * .65 * P.walk + P.sleep * 1.3);
  cat.tail.forEach((s, i) => s.rotation.x = (i ? .22 : -1.2 + P.tail * .9) + Math.sin(t * P.spd - i * .6) * .6 * (.15 + i * .12));
  cat.root.rotation.y = yaw;
  // UI placement
  ui.style.left = clamp(px - 140, 8, innerWidth - 296) + 'px'; ui.style.bottom = (innerHeight - (cy - 160)) + 'px';
}
let last = performance.now();
(function frame(ts) {
  const dt = Math.min(.05, (ts - last) / 1000); last = ts; update(dt, ts / 1000);
  R.setScissorTest(false); R.clear();
  const x = px - VP / 2, y = innerHeight - (cy - 197 + VP);
  R.setViewport(x, y, VP, VP); R.setScissor(x, y, VP, VP); R.setScissorTest(true); R.render(S, cam);
  requestAnimationFrame(frame);
})(last);
addEventListener('resize', () => R.setSize(innerWidth, innerHeight));
