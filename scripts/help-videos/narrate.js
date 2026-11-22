// v178: the spoken narration of the help videos: each caption, read aloud.
// v179: a more natural voice. Walter found the first voice (Piper) sounded too much like AI.
//
// The voice is Kokoro (https://github.com/hexgrad/kokoro), a free text-to-speech
// model that runs on the recording computer (nothing is sent anywhere), with its
// "Heart" voice (af_heart: a warm American woman's voice). Kokoro and its voices are
// licensed Apache 2.0: they may be used commercially (the credit is in
// public/help/CREDITS.txt). The model files come from the kokoro-onnx project
// (https://github.com/thewh1teagle/kokoro-onnx, MIT licence).
//
// Needs, on the recording computer: Python 3 with "pip install kokoro-onnx soundfile",
// and the model (downloaded once, about 350 MB, the first time it is needed).
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync, spawnSync, spawn } = require('child_process');

const MODEL_BASE = 'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/';
const VOICE_URL = MODEL_BASE + 'kokoro-v1.0.onnx';
const VOICE_DIR = process.env.TROTHEN_VOICE_DIR || path.join(os.homedir(), '.cache', 'trothen-help-voice-kokoro');
const MODEL = path.join(VOICE_DIR, 'kokoro-v1.0.onnx');
const VOICES = path.join(VOICE_DIR, 'voices-v1.0.bin');
const SPEAKER = process.env.TROTHEN_VOICE || 'af_heart'; // Walter chose sample A: a warm American woman's voice
const PACE = Number(process.env.TROTHEN_VOICE_PACE || 0.92); // 1 = the voice's natural speed; lower is slower
const CACHE = path.join(os.tmpdir(), 'trothen-help-voice-cache');

// The words as they should be said (the captions use symbols a voice would misread).
function spoken(text) {
  // v179: units and short forms are always said in full (on screen they keep their
  // international symbols: 256 GB, 650 W, 50 kg, as SI / ISO 80000 write them).
  return String(text)
    .replace(/L\$ or US\$/g, 'Liberian dollars or US dollars')
    .replace(/L\$\s?(\d[\d,.]*)/g, '$1 Liberian dollars').replace(/US\$\s?(\d[\d,.]*)/g, '$1 US dollars')
    .replace(/L\$/g, 'Liberian dollars').replace(/US\$/g, 'US dollars').replace(/\bLRD\b/g, 'Liberian dollars').replace(/\bUSD\b/g, 'US dollars')
    .replace(/(\d+(?:\.\d+)?)\s?TB\b/g, '$1 terabytes').replace(/(\d+(?:\.\d+)?)\s?GB\b/gi, '$1 gigabytes').replace(/(\d+(?:\.\d+)?)\s?MB\b/g, '$1 megabytes')
    .replace(/(\d+(?:\.\d+)?)\s?mAh\b/g, '$1 milliamp hours').replace(/(\d+(?:\.\d+)?)\s?MP\b/g, '$1 megapixels').replace(/(\d+(?:\.\d+)?)\s?Hz\b/g, '$1 hertz')
    .replace(/(\d+(?:\.\d+)?)\s?kW\b/g, '$1 kilowatts').replace(/(\d+(?:\.\d+)?)\s?W\b/g, '$1 watts').replace(/(\d+(?:\.\d+)?)\s?V\b/g, '$1 volts')
    .replace(/(\d+(?:\.\d+)?)\s?kg\b/g, '$1 kilograms').replace(/(\d+(?:\.\d+)?)\s?g\b/g, '$1 grams')
    .replace(/(\d+(?:\.\d+)?)\s?km\b/g, '$1 kilometres').replace(/\bkm\b/g, 'kilometres').replace(/(\d+(?:\.\d+)?)\s?cm\b/g, '$1 centimetres').replace(/(\d+(?:\.\d+)?)\s?mm\b/g, '$1 millimetres').replace(/(\d+(?:\.\d+)?)\s?m\b/g, '$1 metres')
    .replace(/(\d+(?:\.\d+)?)\s?(?:in|")(?=\W|$)/g, '$1 inches').replace(/(\d+(?:\.\d+)?)\s?L\b/g, '$1 litres').replace(/(\d+(?:\.\d+)?)\s?ml\b/gi, '$1 millilitres')
    .replace(/(\d+(?:\.\d+)?)\s?%/g, '$1 percent')
    .replace(/\be\.g\./gi, 'for example').replace(/\bi\.e\./gi, 'that is').replace(/\betc\./gi, 'and so on').replace(/\bapprox\.?\b/gi, 'about')
    .replace(/\bno\.\s?(\d)/gi, 'number $1').replace(/\bqty\b/gi, 'quantity').replace(/\bpcs\b/gi, 'pieces').replace(/\bmin\b/g, 'minutes').replace(/\bhrs?\b/g, 'hours')
    // a unit before a noun is said in the singular: "a 50-kilogram bag", "a 2-metre pipe"
    .replace(/(\d) (terabytes|gigabytes|megabytes|milliamp hours|megapixels|kilowatts|watts|volts|kilograms|grams|kilometres|centimetres|millimetres|metres|inches|litres|millilitres) (?!(?:of|or|and|with|for|to|in|on|at|each|per|a|an|the|is|are|from|by)\b)(?=[a-z])/g, (m, n, u) => `${n} ${u === 'inches' ? 'inch' : u.replace(/s$/, '')} `)
    .replace(/\s&\s/g, ' and ').replace(/\s*→\s*/g, ', then ').replace(/(^|\s)\+\s/g, '$1').replace(/[…]/g, '.')
    .replace(/["“”]/g, '').replace(/\s+/g, ' ').trim();
}

function ensureVoice() {
  if (fs.existsSync(MODEL) && fs.existsSync(VOICES)) return true;
  fs.mkdirSync(VOICE_DIR, { recursive: true });
  console.log('Downloading the narrator voice (once, about 350 MB)…');
  try {
    for (const [file, name] of [[MODEL, 'kokoro-v1.0.onnx'], [VOICES, 'voices-v1.0.bin']]) {
      if (!fs.existsSync(file)) { execFileSync('curl', ['-sSL', '--fail', '-o', file + '.part', MODEL_BASE + name], { stdio: 'inherit' }); fs.renameSync(file + '.part', file); }
    }
  } catch (e) { return false; }
  return fs.existsSync(MODEL) && fs.existsSync(VOICES);
}
function available() {
  const py = spawnSync('python3', ['-c', 'import kokoro_onnx, soundfile'], { stdio: 'ignore' });
  if (py.status !== 0) return { ok: false, why: 'Kokoro is not installed (pip install kokoro-onnx soundfile)' };
  if (!ensureVoice()) return { ok: false, why: `the narrator voice could not be downloaded from ${MODEL_BASE}` };
  return { ok: true };
}
function seconds(wav) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wav]).toString().trim();
  return Number(out) || 0;
}
// One Python process keeps the voice loaded, so each line takes a fraction of a second
// (the video doesn't stand still while the narrator "thinks").
const WORKER = `
import sys, re, wave, warnings
warnings.filterwarnings('ignore')
import numpy as np
from kokoro_onnx import Kokoro
k = Kokoro(sys.argv[1], sys.argv[2])
voice = sys.argv[3]; pace = float(sys.argv[4])
print('ready', flush=True)
for line in sys.stdin:
    out, text = line.rstrip('\\n').split('\\t', 1)
    # whole sentences, so the voice keeps its natural rise and fall; a short breath between sentences
    parts = [p.strip() for p in re.findall(r'[^.!?]+[.!?]*', text) if p.strip()]
    rate = 24000; chunks = [np.zeros(int(rate * 0.2), dtype=np.float32)]
    for p in parts:
        a, rate = k.create(p, voice=voice, speed=pace, lang='en-us')
        chunks.append(a.astype(np.float32)); chunks.append(np.zeros(int(rate * 0.45), dtype=np.float32))
    pcm = (np.clip(np.concatenate(chunks), -1, 1) * 32767).astype('<i2').tobytes()
    with wave.open(out, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate); w.writeframes(pcm)
    print('done ' + out, flush=True)
`;
let worker = null;
function startWorker() {
  if (worker) return worker;
  const p = spawn('python3', ['-c', WORKER, MODEL, VOICES, String(SPEAKER), String(PACE)], { stdio: ['pipe', 'pipe', 'pipe'] });
  const waiting = new Map(); let ready; const isReady = new Promise(r => { ready = r; });
  let buf = '';
  p.stdout.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); if (l === 'ready') ready(); else if (l.startsWith('done ')) { const f = l.slice(5); const w = waiting.get(f); if (w) { waiting.delete(f); w(); } } } });
  let err = ''; p.stderr.on('data', (d) => { err += d; });
  p.on('exit', () => { for (const w of waiting.values()) w(new Error('The narrator voice stopped: ' + err.slice(-300))); worker = null; });
  worker = { p, waiting, isReady };
  return worker;
}
// Speaks one caption into a WAV file (kept, so a second recording is quicker). Returns { file, seconds }.
async function say(text) {
  fs.mkdirSync(CACHE, { recursive: true });
  const words = spoken(text);
  const file = path.join(CACHE, crypto.createHash('sha1').update(`kokoro|${SPEAKER}|${PACE}|v4|${words}`).digest('hex').slice(0, 16) + '.wav');
  if (!fs.existsSync(file)) {
    const w = startWorker(); await w.isReady;
    await new Promise((res, rej) => { w.waiting.set(file, (e) => (e ? rej(e) : res())); w.p.stdin.write(`${file}\t${words.replace(/[\t\n]/g, ' ')}\n`); });
  }
  return { file, seconds: seconds(file) };
}
async function warm() { const w = startWorker(); await w.isReady; }
function stop() { if (worker) { try { worker.p.stdin.end(); } catch (e) {} worker = null; } }
// Speaks every line ahead of time (used before recording, so nothing waits on the voice).
async function prepare(texts) { for (const t of texts) await say(t); }
// Lays each spoken line at the moment its caption appeared, and puts the sound on the video.
function addSound(mp4, lines, out) {
  if (!lines.length) return false;
  const args = ['-y', '-loglevel', 'error', '-i', mp4];
  for (const l of lines) args.push('-i', l.file);
  const parts = lines.map((l, i) => `[${i + 1}:a]aresample=44100,adelay=${Math.max(0, Math.round(l.at * 1000))}:all=1[a${i}]`);
  const mix = `${lines.map((l, i) => `[a${i}]`).join('')}amix=inputs=${lines.length}:normalize=0:dropout_transition=0,loudnorm=I=-16:TP=-1.5:LRA=11[aout]`;
  args.push('-filter_complex', parts.join(';') + ';' + mix, '-map', '0:v', '-map', '[aout]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '96k', '-ac', '1', '-shortest', '-movflags', '+faststart', out);
  execFileSync('ffmpeg', args);
  return true;
}

module.exports = { available, say, prepare, warm, stop, addSound, spoken, SPEAKER, VOICE_URL };
