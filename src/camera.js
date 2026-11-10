// Cámara del dispositivo (getUserMedia). Frontal = 'user', trasera = 'environment'.
const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1;

export class CameraFeed {
  constructor(video) {
    this.video = video;
    this.stream = null;
    this.facing = 'environment';
  }

  async start(facing) {
    this.stop();
    const constraints = {
      audio: false,
      video: {
        facingMode: { ideal: facing },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    };
    this.stream = await navigator.mediaDevices.getUserMedia(constraints);
    const v = this.video;
    v.muted = true;
    v.setAttribute('playsinline', '');
    v.srcObject = this.stream;
    if (!v.videoWidth) {
      await new Promise((resolve) => v.addEventListener('loadedmetadata', resolve, { once: true }));
    }
    await v.play();

    // En computadoras la webcam no informa facingMode: la tratamos como frontal (espejo).
    const reported = this.stream.getVideoTracks()[0]?.getSettings?.().facingMode;
    if (reported) this.facing = reported === 'user' ? 'user' : 'environment';
    else this.facing = isMobile() ? facing : 'user';
  }

  stop() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.srcObject = null;
  }

  get mirrored() {
    return this.facing === 'user';
  }
}
