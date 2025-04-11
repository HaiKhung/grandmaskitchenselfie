const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const captureBtn = document.getElementById('capture');
const downloadLink = document.getElementById('downloadLink');

navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
  video.srcObject = stream;
});

captureBtn.addEventListener('click', async () => {
  if (video.readyState < video.HAVE_ENOUGH_DATA) {
    alert("Camera not ready yet. Please wait a second and try again.");
    return;
  }
  await renderCanvas(video);
});

async function renderCanvas(baseImage) {
  const context = canvas.getContext('2d');
  canvas.width = baseImage.videoWidth || baseImage.width;
  canvas.height = baseImage.videoHeight || baseImage.height;

  const bamboo = await loadImage(document.querySelector('.bamboo').src);
  context.drawImage(bamboo, 0, 0, canvas.width, canvas.height);
  context.drawImage(baseImage, 0, 0, canvas.width, canvas.height);

  const scaleX = canvas.width / video.offsetWidth;
  const scaleY = canvas.height / video.offsetHeight;

  const overlays = document.querySelectorAll('.overlay:not(.bamboo)');
  for (let img of overlays) {
    const loadedImg = await loadImage(img.src);
    const rect = img.getBoundingClientRect();
    context.drawImage(
      loadedImg,
      (rect.left - video.offsetLeft) * scaleX,
      (rect.top - video.offsetTop) * scaleY,
      rect.width * scaleX,
      rect.height * scaleY
    );
  }

  context.fillStyle = 'rgba(0,0,0,0.5)';
  context.fillRect(0, canvas.height - 50, canvas.width, 50);
  context.fillStyle = 'white';
  context.font = '20px sans-serif';
  context.textAlign = 'center';
  context.fillText("Grandma's Kitchen – Vietnamese Traditional Food", canvas.width / 2, canvas.height - 20);

  const dataURL = canvas.toDataURL('image/png');
  downloadLink.href = dataURL;
  downloadLink.style.display = 'inline-block';
  downloadLink.textContent = '📥 Download Photo';
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
