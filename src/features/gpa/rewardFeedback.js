// Optional sound/vibration when a higher reward tier is reached.
// Both are OFF by default and only run after the student switches them on.

export function vibrate(pattern) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(pattern);
  } catch {
    /* unsupported device — ignore */
  }
}

let audioContext = null;

export function playChime(level) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    audioContext ??= new AudioCtx();
    const notes = level === "presidential" ? [659.25, 783.99, 1046.5] : [659.25, 880];
    const start = audioContext.currentTime;

    notes.forEach((frequency, index) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const t = start + index * 0.11;
      osc.type = "sine";
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.08, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      osc.connect(gain).connect(audioContext.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  } catch {
    /* audio blocked — ignore */
  }
}
