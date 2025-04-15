const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const captureBtn = document.getElementById('capture');
const downloadLink = document.getElementById('downloadLink');

// Setup camera
navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
  video.srcObject = stream;
});

// Capture
captureBtn.addEventListener('click', () => {
  const context = canvas.getContext('2d');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  
  // Draw video frame
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  
  // Draw overlays
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

  // Draw slogan text
  context.fillStyle = 'rgba(0,0,0,0.5)';
  context.fillRect(0, canvas.height - 50, canvas.width, 50);
  context.fillStyle = 'white';
  context.font = '20px sans-serif';
  context.textAlign = 'center';
  context.fillText("Grandma's Kitchen – Vietnamese Traditional Food", canvas.width / 2, canvas.height - 20);

  // Show download
  const dataURL = canvas.toDataURL('image/png');
  downloadLink.href = dataURL;
  downloadLink.style.display = 'inline-block';
  downloadLink.textContent = '📥 Download Photo';
});
