/**
 * Sound synthesis utility for payment & collection feedback using Web Audio API.
 * Synthesizes a warm, smooth, elegant fintech confirmation chime
 * with gentle exponential decay, soft attack envelope, and mellow warm resonance.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  } catch (e) {
    console.warn('Web Audio API not supported or initialized', e);
    return null;
  }
}

/**
 * Plays a smooth, silky, melodious fintech payment chime.
 * Uses soft sine waves, warm Butterworth low-pass filtering, gentle linear attack envelopes,
 * and soothing natural acoustic decay.
 */
export function playSuccessSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Master filter to remove harsh high harmonics for smooth, warm acoustic feel
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2400, now);
    filter.Q.setValueAtTime(1.0, now);
    filter.connect(ctx.destination);

    // Master Gain for smooth volume control
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.24, now);
    masterGain.connect(filter);

    // Note 1: Warm Root Tone (F5 ~ 698.46 Hz)
    // Soft attack 15ms, velvety decay
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(698.46, now);
    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.linearRampToValueAtTime(0.35, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(masterGain);
    osc1.start(now);
    osc1.stop(now + 0.36);

    // Note 2: Harmonious Major Third (A5 ~ 880.00 Hz)
    // Starts at +60ms, adds richness
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880.00, now + 0.06);
    gain2.gain.setValueAtTime(0.001, now + 0.06);
    gain2.gain.linearRampToValueAtTime(0.42, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc2.connect(gain2);
    gain2.connect(masterGain);
    osc2.start(now + 0.06);
    osc2.stop(now + 0.46);

    // Note 3: Pure Uplifting Fifth (C6 ~ 1046.50 Hz)
    // Starts at +120ms, ringing clarity
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(1046.50, now + 0.12);
    gain3.gain.setValueAtTime(0.001, now + 0.12);
    gain3.gain.linearRampToValueAtTime(0.5, now + 0.15);
    gain3.gain.exponentialRampToValueAtTime(0.0001, now + 0.75);
    osc3.connect(gain3);
    gain3.connect(masterGain);
    osc3.start(now + 0.12);
    osc3.stop(now + 0.76);

    // Note 4: Subtle warm octave shimmer (F6 ~ 1396.91 Hz)
    // Very gentle overtone for sparkle without sharpness
    const osc4 = ctx.createOscillator();
    const gain4 = ctx.createGain();
    osc4.type = 'sine';
    osc4.frequency.setValueAtTime(1396.91, now + 0.16);
    gain4.gain.setValueAtTime(0.001, now + 0.16);
    gain4.gain.linearRampToValueAtTime(0.18, now + 0.19);
    gain4.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
    osc4.connect(gain4);
    gain4.connect(masterGain);
    osc4.start(now + 0.16);
    osc4.stop(now + 0.61);

  } catch (err) {
    console.warn('Failed to play smooth sound', err);
  }
}
