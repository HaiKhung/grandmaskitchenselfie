const OUTPUT_WIDTH = 1080; // saved photo is 1080x1440 (3:4)
const COUNTDOWN_SECONDS = 3;

// Hat placement relative to the detected face box (tweak these to taste)
const HAT_WIDTH_PER_FACE_WIDTH = 1.8; // hat width = face width * this
const HAT_BRIM_Y = 0.31;              // where the brim ends inside the hat image (0..1 of its height)
const HAT_BRIM_ABOVE_FACE = 0.15;     // brim sits this fraction of face height above the box top
const HAT_SMOOTHING = 0.25;           // 0..1, higher = snappier
const FACE_LOST_MS = 1500;            // fall back to the fixed hat after this long without a face

const $ = id => document.getElementById(id);
const stage = $('stage');
const video = $('video');
const canvas = $('canvas');
const result = $('result');
const countdownEl = $('countdown');
const flash = $('flash');
const message = $('message');
const captureBtn = $('capture');
const retakeBtn = $('retake');
const shareBtn = $('share');
const downloadLink = $('downloadLink');
const switchBtn = $('switchCamera');
const hat = $('hat');
const food = $('food');
const frame = $('frame');

let photoBlob = null;
let facingMode = 'user';

function showMessage(text) {
  message.textContent = text;
  message.hidden = !text;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ---- Camera ----
async function startCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showMessage('Your browser cannot access the camera. Please open this page over HTTPS in a modern browser.');
    return;
  }
  if (video.srcObject) video.srcObject.getTracks().forEach(t => t.stop());
  captureBtn.disabled = true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode, width: { ideal: 1440 }, height: { ideal: 1080 } },
      audio: false
    });
    video.srcObject = stream;
    await video.play();
    stage.classList.toggle('mirrored', facingMode === 'user');
    showMessage('');
    captureBtn.disabled = !result.hidden;
    faceTarget = null; hatCur = null;
    const cams = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput');
    switchBtn.hidden = cams.length < 2;
  } catch (err) {
    showMessage(err.name === 'NotAllowedError'
      ? 'Camera access was blocked. Allow the camera in your browser settings, then reload.'
      : 'Could not start the camera (' + err.name + ').');
  }
}

switchBtn.addEventListener('click', () => {
  facingMode = facingMode === 'user' ? 'environment' : 'user';
  startCamera();
});

// ---- Layout helpers ----
function videoLayout() {
  const sw = stage.clientWidth, sh = stage.clientHeight;
  const vw = video.videoWidth, vh = video.videoHeight;
  const ratio = Math.max(sw / vw, sh / vh); // object-fit: cover
  return { sw, sh, ratio, ox: (sw - vw * ratio) / 2, oy: (sh - vh * ratio) / 2 };
}

// ---- Face tracking (face-api.js tiny face detector, model lives in /models) ----
let detectorReady = false;
let faceTarget = null;   // {cx, top, w, h} in stage pixels
let hatCur = null;       // smoothed copy of faceTarget-derived hat rect
let lastFaceAt = 0;

async function initFaceTracking() {
  if (!window.faceapi) return; // CDN blocked/offline: the fixed hat remains
  try {
    await faceapi.nets.tinyFaceDetector.loadFromUri('models/tiny_face_detector');
    detectorReady = true;
    detectLoop();
    animateHat();
  } catch (e) {
    console.warn('Face tracking unavailable, using fixed hat.', e);
  }
}

async function detectLoop() {
  const opts = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 });
  while (detectorReady) {
    const active = !hat.hidden && result.hidden && !document.hidden && video.readyState >= 2 && video.videoWidth;
    if (active) {
      try {
        const det = await faceapi.detectSingleFace(video, opts);
        if (det) {
          const { sw, ratio, ox, oy } = videoLayout();
          const b = det.box;
          let x1 = ox + b.x * ratio, x2 = ox + (b.x + b.width) * ratio;
          if (stage.classList.contains('mirrored')) { [x1, x2] = [sw - x2, sw - x1]; }
          faceTarget = { cx: (x1 + x2) / 2, top: oy + b.y * ratio, w: x2 - x1, h: b.height * ratio };
          lastFaceAt = performance.now();
        }
      } catch (e) { /* skip this frame */ }
    }
    await sleep(80);
  }
}

function animateHat() {
  if (!detectorReady) return;
  const tracking = faceTarget && !hat.hidden && performance.now() - lastFaceAt < FACE_LOST_MS;
  if (tracking && hat.naturalWidth) {
    const W = faceTarget.w * HAT_WIDTH_PER_FACE_WIDTH;
    const H = W * hat.naturalHeight / hat.naturalWidth;
    const goal = { x: faceTarget.cx - W / 2, y: faceTarget.top - HAT_BRIM_ABOVE_FACE * faceTarget.h - HAT_BRIM_Y * H, w: W };
    hatCur = hatCur ? {
      x: hatCur.x + (goal.x - hatCur.x) * HAT_SMOOTHING,
      y: hatCur.y + (goal.y - hatCur.y) * HAT_SMOOTHING,
      w: hatCur.w + (goal.w - hatCur.w) * HAT_SMOOTHING
    } : goal;
    hat.style.width = hatCur.w + 'px';
    hat.style.left = hatCur.x + 'px';
    hat.style.top = hatCur.y + 'px';
    hat.style.height = 'auto';
  } else if (hatCur) {
    // Face lost: go back to the default fixed position from the stylesheet
    hatCur = null;
    hat.style.width = hat.style.left = hat.style.top = hat.style.height = '';
  }
  requestAnimationFrame(animateHat);
}

// ---- Options ----
$('optHat').addEventListener('change', e => { hat.hidden = !e.target.checked; if (hat.hidden) hatCur = null; });
$('optFood').addEventListener('change', e => { food.hidden = !e.target.checked; });
$('optFrame').addEventListener('change', e => { frame.hidden = !e.target.checked; });

// ---- Compose the final image (identical to the preview, including the mirror) ----
function composePhoto() {
  const scale = OUTPUT_WIDTH / stage.clientWidth;
  canvas.width = OUTPUT_WIDTH;
  canvas.height = Math.round(stage.clientHeight * scale);
  const ctx = canvas.getContext('2d');

  // Video, cropped like CSS object-fit: cover, mirrored like the preview
  const vw = video.videoWidth, vh = video.videoHeight;
  const ratio = Math.max(canvas.width / vw, canvas.height / vh);
  const dw = vw * ratio, dh = vh * ratio;
  ctx.save();
  if (stage.classList.contains('mirrored')) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh);
  ctx.restore();

  // Overlays, positioned from layout (offset* ignores the floating animation)
  stage.querySelectorAll('.overlay').forEach(img => {
    if (img.hidden) return;
    const w = img.offsetWidth, h = img.offsetHeight;
    const r = Math.min(w / img.naturalWidth, h / img.naturalHeight); // object-fit: contain
    const iw = img.naturalWidth * r, ih = img.naturalHeight * r;
    ctx.globalAlpha = parseFloat(getComputedStyle(img).opacity);
    ctx.drawImage(img,
      (img.offsetLeft + (w - iw) / 2) * scale,
      (img.offsetTop + (h - ih) / 2) * scale,
      iw * scale, ih * scale);
    ctx.globalAlpha = 1;
  });

  // Slogan, same box and font size as on screen
  const s = $('slogan');
  const style = getComputedStyle(s);
  ctx.fillStyle = style.backgroundColor;
  ctx.fillRect(s.offsetLeft * scale, s.offsetTop * scale, s.offsetWidth * scale, s.offsetHeight * scale);
  ctx.fillStyle = style.color;
  ctx.font = `${parseFloat(style.fontSize) * scale}px ${style.fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(s.textContent, (s.offsetLeft + s.offsetWidth / 2) * scale, (s.offsetTop + s.offsetHeight / 2) * scale);

  // Frame
  if (!frame.hidden) {
    const fs = getComputedStyle(frame);
    const bw = parseFloat(fs.borderTopWidth) * scale;
    ctx.lineWidth = bw;
    ctx.strokeStyle = fs.borderTopColor;
    ctx.strokeRect(bw / 2, bw / 2, canvas.width - bw, canvas.height - bw);
  }
}

// ---- Flow ----
async function runCountdown() {
  countdownEl.hidden = false;
  for (let i = COUNTDOWN_SECONDS; i > 0; i--) {
    countdownEl.textContent = i;
    await sleep(1000);
  }
  countdownEl.hidden = true;
}

async function takePhoto() {
  captureBtn.disabled = true;
  await runCountdown();

  // Make sure overlay images are decoded before drawing
  await Promise.all([...stage.querySelectorAll('.overlay')].map(i => i.decode().catch(() => {})));
  composePhoto();

  flash.classList.add('go');
  setTimeout(() => flash.classList.remove('go'), 300);

  photoBlob = await new Promise(res => canvas.toBlob(res, 'image/png'));
  if (result.src) URL.revokeObjectURL(result.src);
  const url = URL.createObjectURL(photoBlob);
  result.src = url;
  downloadLink.href = url;
  result.hidden = false;

  captureBtn.hidden = true;
  retakeBtn.hidden = false;
  downloadLink.hidden = false;
  shareBtn.hidden = !(navigator.canShare && navigator.canShare({ files: [new File([photoBlob], 'photo.png', { type: 'image/png' })] }));
}

function retake() {
  result.hidden = true;
  retakeBtn.hidden = true;
  downloadLink.hidden = true;
  shareBtn.hidden = true;
  captureBtn.hidden = false;
  captureBtn.disabled = false;
}

async function sharePhoto() {
  if (!photoBlob) return;
  const file = new File([photoBlob], 'grandmas-photo.png', { type: 'image/png' });
  try {
    await navigator.share({ files: [file], title: "Grandma's Kitchen" });
  } catch (err) {
    if (err.name !== 'AbortError') showMessage('Sharing failed. Use Download instead.');
  }
}

captureBtn.addEventListener('click', takePhoto);
retakeBtn.addEventListener('click', retake);
shareBtn.addEventListener('click', sharePhoto);

startCamera();
window.addEventListener('load', initFaceTracking);

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
