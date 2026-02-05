/**
 * Notification Sound Utility
 * Shared notification sound presets for reminders across all windows
 */

import { logger } from './logger';

const LOG_CONTEXT = 'NotificationSound';

/** Valid sound preset types */
export type SoundType = 'whoosh' | 'chime' | 'bell' | 'gentle' | 'alert';

/**
 * Play a notification sound by type
 * @param soundType - The preset sound to play (defaults to 'whoosh')
 */
export function playNotificationSound(soundType?: SoundType | string): void {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

    switch (soundType || 'whoosh') {
      case 'chime':
        playChime(audioContext);
        break;
      case 'bell':
        playBell(audioContext);
        break;
      case 'gentle':
        playGentle(audioContext);
        break;
      case 'alert':
        playAlert(audioContext);
        break;
      case 'whoosh':
      default:
        playWhoosh(audioContext);
        break;
    }

    logger.debug(`Notification sound played: ${soundType || 'whoosh'}`, LOG_CONTEXT);
  } catch (error) {
    logger.warn('Failed to play notification sound', LOG_CONTEXT, error);
  }
}

/**
 * Whoosh sound with impact - distinctive swoosh to draw attention
 */
function playWhoosh(audioContext: AudioContext): void {
  const currentTime = audioContext.currentTime;

  // Create noise buffer for the "air" component of the whoosh
  const noiseLength = audioContext.sampleRate * 1.2;
  const noiseBuffer = audioContext.createBuffer(1, noiseLength, audioContext.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseLength; i++) {
    noiseData[i] = Math.random() * 2 - 1;
  }

  // Noise source
  const noiseSource = audioContext.createBufferSource();
  noiseSource.buffer = noiseBuffer;

  // Filter for the noise (bandpass to shape the whoosh)
  const noiseFilter = audioContext.createBiquadFilter();
  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.setValueAtTime(200, currentTime);
  noiseFilter.frequency.exponentialRampToValueAtTime(2000, currentTime + 0.6);
  noiseFilter.frequency.exponentialRampToValueAtTime(400, currentTime + 1.2);
  noiseFilter.Q.value = 1.5;

  // Noise gain envelope
  const noiseGain = audioContext.createGain();
  noiseGain.gain.setValueAtTime(0, currentTime);
  noiseGain.gain.linearRampToValueAtTime(0.4, currentTime + 0.15);
  noiseGain.gain.linearRampToValueAtTime(0.6, currentTime + 0.5);
  noiseGain.gain.exponentialRampToValueAtTime(0.01, currentTime + 1.2);

  noiseSource.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(audioContext.destination);

  // Frequency sweep oscillator (adds tonal quality to the whoosh)
  const sweepOsc = audioContext.createOscillator();
  sweepOsc.type = 'sine';
  sweepOsc.frequency.setValueAtTime(150, currentTime);
  sweepOsc.frequency.exponentialRampToValueAtTime(800, currentTime + 0.5);
  sweepOsc.frequency.exponentialRampToValueAtTime(300, currentTime + 1.0);

  const sweepGain = audioContext.createGain();
  sweepGain.gain.setValueAtTime(0, currentTime);
  sweepGain.gain.linearRampToValueAtTime(0.25, currentTime + 0.2);
  sweepGain.gain.linearRampToValueAtTime(0.35, currentTime + 0.5);
  sweepGain.gain.exponentialRampToValueAtTime(0.01, currentTime + 1.0);

  sweepOsc.connect(sweepGain);
  sweepGain.connect(audioContext.destination);

  // Impact "thud" at the end
  const impactTime = currentTime + 0.9;
  const impactOsc = audioContext.createOscillator();
  impactOsc.type = 'sine';
  impactOsc.frequency.setValueAtTime(150, impactTime);
  impactOsc.frequency.exponentialRampToValueAtTime(60, impactTime + 0.15);

  const impactGain = audioContext.createGain();
  impactGain.gain.setValueAtTime(0, impactTime);
  impactGain.gain.linearRampToValueAtTime(0.5, impactTime + 0.02);
  impactGain.gain.exponentialRampToValueAtTime(0.01, impactTime + 0.2);

  impactOsc.connect(impactGain);
  impactGain.connect(audioContext.destination);

  // Start all sounds
  noiseSource.start(currentTime);
  noiseSource.stop(currentTime + 1.3);
  sweepOsc.start(currentTime);
  sweepOsc.stop(currentTime + 1.1);
  impactOsc.start(impactTime);
  impactOsc.stop(impactTime + 0.25);
}

/**
 * Two-tone ascending chime - pleasant doorbell-like notification
 */
function playChime(audioContext: AudioContext): void {
  const currentTime = audioContext.currentTime;

  // First tone: C5 (523 Hz)
  const osc1 = audioContext.createOscillator();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(523, currentTime);

  const gain1 = audioContext.createGain();
  gain1.gain.setValueAtTime(0, currentTime);
  gain1.gain.linearRampToValueAtTime(0.35, currentTime + 0.02);
  gain1.gain.exponentialRampToValueAtTime(0.01, currentTime + 0.5);

  osc1.connect(gain1);
  gain1.connect(audioContext.destination);

  // Second tone: E5 (659 Hz) - starts slightly after first
  const osc2 = audioContext.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(659, currentTime + 0.15);

  const gain2 = audioContext.createGain();
  gain2.gain.setValueAtTime(0, currentTime + 0.15);
  gain2.gain.linearRampToValueAtTime(0.35, currentTime + 0.17);
  gain2.gain.exponentialRampToValueAtTime(0.01, currentTime + 0.7);

  osc2.connect(gain2);
  gain2.connect(audioContext.destination);

  // Third tone: G5 (784 Hz) - completes the major triad
  const osc3 = audioContext.createOscillator();
  osc3.type = 'sine';
  osc3.frequency.setValueAtTime(784, currentTime + 0.3);

  const gain3 = audioContext.createGain();
  gain3.gain.setValueAtTime(0, currentTime + 0.3);
  gain3.gain.linearRampToValueAtTime(0.3, currentTime + 0.32);
  gain3.gain.exponentialRampToValueAtTime(0.01, currentTime + 0.9);

  osc3.connect(gain3);
  gain3.connect(audioContext.destination);

  osc1.start(currentTime);
  osc1.stop(currentTime + 0.55);
  osc2.start(currentTime + 0.15);
  osc2.stop(currentTime + 0.75);
  osc3.start(currentTime + 0.3);
  osc3.stop(currentTime + 0.95);
}

/**
 * Single clear bell ring with harmonics and long decay
 */
function playBell(audioContext: AudioContext): void {
  const currentTime = audioContext.currentTime;

  // Fundamental: A5 (880 Hz)
  const fundamental = audioContext.createOscillator();
  fundamental.type = 'sine';
  fundamental.frequency.setValueAtTime(880, currentTime);

  const fundGain = audioContext.createGain();
  fundGain.gain.setValueAtTime(0, currentTime);
  fundGain.gain.linearRampToValueAtTime(0.4, currentTime + 0.005);
  fundGain.gain.exponentialRampToValueAtTime(0.01, currentTime + 1.8);

  fundamental.connect(fundGain);
  fundGain.connect(audioContext.destination);

  // Second harmonic (slightly detuned for richness)
  const harmonic2 = audioContext.createOscillator();
  harmonic2.type = 'sine';
  harmonic2.frequency.setValueAtTime(1764, currentTime); // ~2x fundamental, slightly sharp

  const harm2Gain = audioContext.createGain();
  harm2Gain.gain.setValueAtTime(0, currentTime);
  harm2Gain.gain.linearRampToValueAtTime(0.15, currentTime + 0.005);
  harm2Gain.gain.exponentialRampToValueAtTime(0.01, currentTime + 1.2);

  harmonic2.connect(harm2Gain);
  harm2Gain.connect(audioContext.destination);

  // Third harmonic (adds shimmer)
  const harmonic3 = audioContext.createOscillator();
  harmonic3.type = 'sine';
  harmonic3.frequency.setValueAtTime(2640, currentTime); // 3x fundamental

  const harm3Gain = audioContext.createGain();
  harm3Gain.gain.setValueAtTime(0, currentTime);
  harm3Gain.gain.linearRampToValueAtTime(0.08, currentTime + 0.005);
  harm3Gain.gain.exponentialRampToValueAtTime(0.01, currentTime + 0.8);

  harmonic3.connect(harm3Gain);
  harm3Gain.connect(audioContext.destination);

  fundamental.start(currentTime);
  fundamental.stop(currentTime + 2.0);
  harmonic2.start(currentTime);
  harmonic2.stop(currentTime + 1.3);
  harmonic3.start(currentTime);
  harmonic3.stop(currentTime + 0.9);
}

/**
 * Soft warm tone - quiet, non-intrusive notification
 */
function playGentle(audioContext: AudioContext): void {
  const currentTime = audioContext.currentTime;

  // Warm sine at A4 (440 Hz)
  const osc = audioContext.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(440, currentTime);
  osc.frequency.exponentialRampToValueAtTime(415, currentTime + 1.0); // Slight downward drift

  const gain = audioContext.createGain();
  gain.gain.setValueAtTime(0, currentTime);
  gain.gain.linearRampToValueAtTime(0.18, currentTime + 0.2); // Gradual attack
  gain.gain.linearRampToValueAtTime(0.15, currentTime + 0.5); // Sustain
  gain.gain.exponentialRampToValueAtTime(0.01, currentTime + 1.0); // Gentle decay

  osc.connect(gain);
  gain.connect(audioContext.destination);

  // Soft high overtone for warmth
  const overtone = audioContext.createOscillator();
  overtone.type = 'sine';
  overtone.frequency.setValueAtTime(880, currentTime);

  const overtoneGain = audioContext.createGain();
  overtoneGain.gain.setValueAtTime(0, currentTime);
  overtoneGain.gain.linearRampToValueAtTime(0.05, currentTime + 0.3);
  overtoneGain.gain.exponentialRampToValueAtTime(0.01, currentTime + 0.7);

  overtone.connect(overtoneGain);
  overtoneGain.connect(audioContext.destination);

  osc.start(currentTime);
  osc.stop(currentTime + 1.1);
  overtone.start(currentTime);
  overtone.stop(currentTime + 0.8);
}

/**
 * Urgent double-beep - attention-grabbing alert
 */
function playAlert(audioContext: AudioContext): void {
  const currentTime = audioContext.currentTime;

  // First beep
  const osc1 = audioContext.createOscillator();
  osc1.type = 'square';
  osc1.frequency.setValueAtTime(800, currentTime);

  const gain1 = audioContext.createGain();
  gain1.gain.setValueAtTime(0, currentTime);
  gain1.gain.linearRampToValueAtTime(0.25, currentTime + 0.01);
  gain1.gain.setValueAtTime(0.25, currentTime + 0.1);
  gain1.gain.linearRampToValueAtTime(0, currentTime + 0.12);

  // Low-pass filter to soften the square wave
  const filter1 = audioContext.createBiquadFilter();
  filter1.type = 'lowpass';
  filter1.frequency.setValueAtTime(2000, currentTime);

  osc1.connect(filter1);
  filter1.connect(gain1);
  gain1.connect(audioContext.destination);

  // Second beep (slightly higher)
  const beep2Start = currentTime + 0.2;
  const osc2 = audioContext.createOscillator();
  osc2.type = 'square';
  osc2.frequency.setValueAtTime(900, beep2Start);

  const gain2 = audioContext.createGain();
  gain2.gain.setValueAtTime(0, beep2Start);
  gain2.gain.linearRampToValueAtTime(0.25, beep2Start + 0.01);
  gain2.gain.setValueAtTime(0.25, beep2Start + 0.1);
  gain2.gain.linearRampToValueAtTime(0, beep2Start + 0.12);

  const filter2 = audioContext.createBiquadFilter();
  filter2.type = 'lowpass';
  filter2.frequency.setValueAtTime(2000, beep2Start);

  osc2.connect(filter2);
  filter2.connect(gain2);
  gain2.connect(audioContext.destination);

  osc1.start(currentTime);
  osc1.stop(currentTime + 0.15);
  osc2.start(beep2Start);
  osc2.stop(beep2Start + 0.15);
}
