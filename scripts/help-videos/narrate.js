// v178: the spoken narration of the help videos: each caption, read aloud.
//
// The voice is Piper (https://github.com/rhasspy/piper), a free text-to-speech
// program that runs on the recording computer (nothing is sent anywhere), with
// its "LibriTTS (high)" English voice. That voice is trained on the LibriTTS
// recordings, licensed CC BY 4.0: it may be used commercially, with credit
// (the credit is in public/help/CREDITS.txt). The voices trained on other
// recordings (Lessac, Ryan) are for research or non-commercial use only, so
// they are not used.
//
// Needs, on the recording computer: Python 3 with "pip install piper-tts", and
// the voice (downloaded once, about 120 MB, the first time it is needed).
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync, spawnSync, spawn } = require('child_process');

const VOICE_URL = 'https://github.com/rhasspy/piper/releases/download/v0.0.2/voice-en-us-libritts-high.tar.gz';
const VOICE_DIR = process.env.TROTHEN_VOICE_DIR || path.join(os.homedir(), '.cache', 'trothen-help-voice');
const MODEL = path.join(VOICE_DIR, 'en-us-libritts-high.onnx');
const SPEAKER = Number(process.env.TROTHEN_VOICE_SPEAKER || 37);
const PACE = Number(process.env.TROTHEN_VOICE_PACE || 1.38); // 1 = the voice's natural speed; higher is slower (Walter: "too fast") // which of the voice's speakers (37: a clear, calm woman's voice)
const CACHE = path.join(os.tmpdir(), 'trothen-help-voice-cache');

// The words as they should be said (the captions use symbols a voice would misread).
function spoken(text) {
  return String(text)
    .replace(/L\$ or US\$/g, 'Liberian dollars or US dollars')
    .replace(/L\$/g, 'Liberian dollars').replace(/US\$/g, 'US dollars')
    .replace(/(\d+)\s?GB\b/gi, '$1 gigabytes').replace(/(\d+)\s?W\b/g, '$1 watts')
    .replace(/\bkm\b/g, 'kilometres').replace(/\bcm\b/g, 'centimetres')
    .replace(/\be\.g\./gi, 'for example').replace(/(^|\s)\+\s/g, '$1').replace(/[…]/g, '.')
    .replace(/["“”]/g, '').replace(/\s+/g, ' ').trim();
}

function ensureVoice() {
  if (fs.existsSync(MODEL) && fs.existsSync(MODEL + '.json')) return true;
  fs.mkdirSync(VOICE_DIR, { recursive: true });
  const tgz = path.join(VOICE_DIR, 'voice.tar.gz');
  console.log('Downloading the narrator voice (once, about 120 MB)…');
  try { execFileSync('curl', ['-sSL', '-o', tgz, VOICE_URL], { stdio: 'inherit' }); execFileSync('tar', ['-xzf', tgz, '-C', VOICE_DIR]); fs.unlinkSync(tgz); }
  catch (e) { return false; }
  return fs.existsSync(MODEL);
}
function available() {
  const py = spawnSync('python3', ['-c', 'import piper'], { stdio: 'ignore' });
  if (py.status !== 0) return { ok: false, why: 'Piper is not installed (pip install piper-tts)' };
  if (!ensureVoice()) return { ok: false, why: `the narrator voice could not be downloaded from ${VOICE_URL}` };
  return { ok: true };
}
function seconds(wav) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wav]).toString().trim();
  return Number(out) || 0;
}
// One Python process keeps the voice loaded, so each line takes a fraction of a second
// (the video doesn't stand still while the narrator "thinks").
const WORKER = `
import sys, wave, re
from piper import PiperVoice, SynthesisConfig
v = PiperVoice.load(sys.argv[1], config_path=sys.argv[1] + '.json')
pace = float(sys.argv[3])
# steady and calm: slower (pace), less wobble in the voice (noise), and real pauses between phrases
cfg = SynthesisConfig(speaker_id=int(sys.argv[2]), length_scale=pace, noise_scale=0.55, noise_w_scale=0.6)
print('ready', flush=True)
for line in sys.stdin:
    out, text = line.rstrip('\\n').split('\\t', 1)
    # phrases, each with the pause that follows it: a sentence end 0.5 s, a comma or colon 0.22 s
    parts = re.findall(r'[^.!?,;:]+[.!?,;:]*', text)
    with wave.open(out, 'wb') as w:
        rate = None
        for p in parts:
            p = p.strip()
            if not p:
                continue
            for c in v.synthesize(p, syn_config=cfg):
                if rate is None:
                    rate = c.sample_rate; w.setframerate(rate); w.setsampwidth(c.sample_width); w.setnchannels(c.sample_channels)
                    w.writeframes(b'\\x00\\x00' * int(rate * 0.2))
                w.writeframes(c.audio_int16_bytes)
            gap = 0.5 if p[-1] in '.!?' else 0.22 if p[-1] in ',;:' else 0.15
            w.writeframes(b'\\x00\\x00' * int(rate * gap))
    print('done ' + out, flush=True)
`;
let worker = null;
function startWorker() {
  if (worker) return worker;
  const p = spawn('python3', ['-c', WORKER, MODEL, String(SPEAKER), String(PACE)], { stdio: ['pipe', 'pipe', 'pipe'] });
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
  const file = path.join(CACHE, crypto.createHash('sha1').update(`${SPEAKER}|${PACE}|v2|${words}`).digest('hex').slice(0, 16) + '.wav');
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
