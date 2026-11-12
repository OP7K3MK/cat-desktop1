const { app, BrowserWindow, ipcMain, screen, Menu, session } = require('electron');
const path = require('path');
const fs = require('fs');
const logFile = () => path.join(app.getPath('userData'), 'log.txt');
const log = (...a) => { try { fs.appendFileSync(logFile(), new Date().toISOString() + ' ' + a.join(' ') + '\n'); } catch {} };
process.on('uncaughtException', e => log('UNCAUGHT', e.stack || e.message));
let win, llm = null, asr = null;
const modelsDir = () => path.join(app.getPath('userData'), 'models');
const send = (c, d) => win && win.webContents.send(c, d);
const SYS = "You are a small, cute, playful house cat living on the user's desktop. Always answer in the same language and dialect the user writes in (Arabic, English or any other language). Keep every reply to 1-2 short playful sentences. Begin every reply with exactly one emotion tag in square brackets chosen from: [happy] [curious] [sleepy] [angry] [sad] [love] [surprised]. Sometimes add a meow.";

async function loadLLM() {
  try {
    const { getLlama, resolveModelFile, LlamaChatSession } = await import('node-llama-cpp');
    send('status', 'أول مرة: القطة تنزّل عقلها… (مرة وحدة بس)');
    const modelPath = await resolveModelFile('hf:Qwen/Qwen2.5-1.5B-Instruct-GGUF:Q4_K_M', {
      directory: modelsDir(),
      onProgress: p => p.totalSize && send('status', 'تنزيل العقل ' + Math.round(p.downloadedSize / p.totalSize * 100) + '%')
    });
    const llama = await getLlama();
    const model = await llama.loadModel({ modelPath });
    const ctx = await model.createContext({ contextSize: 2048 });
    llm = new LlamaChatSession({ contextSequence: ctx.getSequence(), systemPrompt: SYS });
    send('status', 'مياو! جاهزة 🐱');
  } catch (e) { send('status', 'تعذّر تحميل العقل: ' + e.message); }
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((w, p, cb) => cb(p === 'media'));
  const { x, y, width, height } = screen.getPrimaryDisplay().workArea;
  win = new BrowserWindow({
    x, y, width, height, transparent: true, frame: false, alwaysOnTop: true, hasShadow: false,
    resizable: false, webPreferences: { preload: path.join(__dirname, 'preload.js'), autoplayPolicy: 'no-user-gesture-required' }
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setIgnoreMouseEvents(true, { forward: true });
  win.loadFile('renderer/index.html');
  win.webContents.on('console-message', (e, lvl, msg, line, src) => log('CONSOLE', lvl, msg, src + ':' + line));
  win.webContents.on('did-fail-load', (e, code, desc, url) => log('LOAD FAIL', code, desc, url));
  win.webContents.on('render-process-gone', (e, d) => log('RENDER GONE', d.reason));
  win.webContents.on('preload-error', (e, p, err) => log('PRELOAD ERR', p, err.message));
  log('started; app dir =', __dirname);
  win.webContents.once('did-finish-load', loadLLM);
});

ipcMain.on('ignore', (e, v) => win.setIgnoreMouseEvents(v, { forward: true }));
ipcMain.on('menu', () => Menu.buildFromTemplate([
  { label: 'محادثة', click: () => send('open-chat') },
  { label: 'نوم', click: () => send('sleep') },
  { type: 'separator' },
  { label: 'إغلاق', click: () => app.quit() }
]).popup({ window: win }));

ipcMain.handle('chat', async (e, text) => {
  if (!llm) return '[curious] مياو… لسا أصحّى، لحظة!';
  try { return await llm.prompt(text, { maxTokens: 120 }); } catch (err) { return '[sad] ' + err.message; }
});

ipcMain.handle('stt', async (e, a) => {
  try {
    if (!asr) {
      send('status', 'تحميل أذن القطة (مرة وحدة)…');
      const { pipeline, env } = await import('@huggingface/transformers');
      env.cacheDir = modelsDir();
      asr = await pipeline('automatic-speech-recognition', 'Xenova/whisper-base');
    }
    const f = a instanceof Float32Array ? a : new Float32Array(a.buffer, a.byteOffset, a.byteLength / 4);
    return (await asr(f, { task: 'transcribe' })).text.trim();
  } catch (err) { send('status', 'خطأ بالتعرف على الصوت: ' + err.message); return ''; }
});
app.on('window-all-closed', () => app.quit());
