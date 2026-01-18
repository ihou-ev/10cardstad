// Sound effects using Web Audio API

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  return audioContext;
}

// Card flip/reveal sound effect
export function playCardFlipSound(): void {
  if (typeof window === "undefined") return;

  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Create oscillator for a short "flip" sound
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Quick descending tone
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(800, now);
    oscillator.frequency.exponentialRampToValueAtTime(400, now + 0.1);

    // Quick fade out
    gainNode.gain.setValueAtTime(0.3, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    oscillator.start(now);
    oscillator.stop(now + 0.15);
  } catch {
    // Ignore audio errors
  }
}

// Winner announcement sound effect
export function playWinnerSound(): void {
  if (typeof window === "undefined") return;

  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Create a simple fanfare-like sound
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6

    notes.forEach((freq, i) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(freq, now + i * 0.15);

      gainNode.gain.setValueAtTime(0, now + i * 0.15);
      gainNode.gain.linearRampToValueAtTime(0.2, now + i * 0.15 + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + i * 0.15 + 0.3);

      oscillator.start(now + i * 0.15);
      oscillator.stop(now + i * 0.15 + 0.3);
    });
  } catch {
    // Ignore audio errors
  }
}
