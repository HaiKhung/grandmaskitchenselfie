const OUTPUT_WIDTH = 1080; // saved photo is 1080x1440 (3:4)
const COUNTDOWN_SECONDS = 3;

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

let photoBlob = null;

function showMessage(text) {
  message.textContent = text;
  message.hidden = !text;
}

// ---- Camera ----
async function startCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showMessage('Your browser cannot access the camera. Please open this page over HTTPS in a modern browser.');
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1440 }, height: { ideal: 1080 } },
      audio: false
    });
    video.srcObject = stream;
    await video.play();
    showMessage('');
    captureBtn.disabled = false;
  } catch (err) {
    showMessage(err.name === 'NotAllowedError'
      ? 'Camera access was blocked. Allow the camera in your browser settings, then reload.'
      : 'Could not start the camera (' + err.name + ').');
  }
}

// ---- Compose the final image (mirrors what the preview shows, un-mirrored) ----
function composePhoto() {
  const scale = OUTPUT_WIDTH / stage.clientWidth;
  canvas.width = OUTPUT_WIDTH;
  canvas.height = Math.round(stage.clientHeight * scale);
  const ctx = canvas.getContext('2d');

  // Video, cropped like CSS object-fit: cover
  const vw = video.videoWidth, vh = video.videoHeight;
  const ratio = Math.max(canvas.width / vw, canvas.height / vh);
  const dw = vw * ratio, dh = vh * ratio;
  ctx.drawImage(video, (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh);

  // Overlays, positioned from layout (offset* ignores the floating animation)
  stage.querySelectorAll('.overlay').forEach(img => {
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
}

// ---- Flow ----
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

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
