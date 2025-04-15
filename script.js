const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const captureBtn = document.getElementById('capture');
const downloadLink = document.getElementById('downloadLink');
const hatImg = document.getElementById('hatImage');

// Load face detection model
Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri('/models/tiny_face_detector'),
]).then(startVideo);

function startVideo() {
  navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => {
      video.srcObject = stream;
    })
    .catch(err => console.error('Camera access error:', err));
}

captureBtn.addEventListener('click', async () => {
  const context = canvas.getContext('2d');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  // Draw current frame from video
  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  // Detect face
  const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions());

  if (detection) {
    const { x, y, width } = detection.box;

    // Draw hat based on face box
    const hatWidth = width * 1.6;
    const hatHeight = hatWidth * (hatImg.naturalHeight / hatImg.naturalWidth);
    const hatX = x - (hatWidth - width) / 2;
    const hatY = y - hatHeight * 0.7;

    context.drawImage(hatImg, hatX, hatY, hatWidth, hatHeight);
  } else {
    alert("No face detected.");
  }

  // Draw logo and food overlay
  document.querySelectorAll('.overlay').forEach(img => {
    const rect = img.getBoundingClientRect();
    const scaleX = canvas.width / video.offsetWidth;
    const scaleY = canvas.height / video.offsetHeight;
    context.drawImage(img,
      (rect.left - video.offsetLeft) * scaleX,
      (rect.top - video.offsetTop) * scaleY,
      rect.width * scaleX,
      rect.height * scaleY
    );
  });

  // Draw slogan
  context.fillStyle = 'rgba(0,0,0,0.5)';
  context.fillRect(0, canvas.height - 50, canvas.width, 50);
  context.fillStyle = 'white';
  context.font = '20px sans-serif';
  context.textAlign = 'center';
  context.fillText("Grandma's Kitchen – Vietnamese Traditional Food", canvas.width / 2, canvas.height - 20);

  // Show download link
  const dataURL = canvas.toDataURL('image/png');
  downloadLink.href = dataURL;
  downloadLink.style.display = 'inline-block';
});
