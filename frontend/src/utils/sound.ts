/**
 * The timer's beeps, synthesised with Web Audio rather than played from files: nothing to load or
 * cache for offline use, and each beep can be scheduled on the audio clock ahead of time, so it
 * lands on the second even when the page's own timers are throttled.
 */

/** 3-2-1 before a phase ends, a high tone into work, a low one into rest, three rising at the end. */
export type Cue = 'tick' | 'work' | 'rest' | 'finish';

interface Tone {
  freq: number;
  /** Seconds after the cue's start. */
  offset: number;
  duration: number;
}

const TONES: Record<Cue, Tone[]> = {
  tick: [{ freq: 880, offset: 0, duration: 0.12 }],
  work: [{ freq: 1320, offset: 0, duration: 0.45 }],
  rest: [{ freq: 660, offset: 0, duration: 0.45 }],
  finish: [
    { freq: 880, offset: 0, duration: 0.18 },
    { freq: 1100, offset: 0.22, duration: 0.18 },
    { freq: 1320, offset: 0.44, duration: 0.5 },
  ],
};

const VOLUME = 0.6;
/** A short fade in and out: a tone cut off at full volume clicks. */
const FADE = 0.01;

let context: AudioContext | null = null;

/**
 * Creates or wakes the audio context. Must run inside a tap: iOS keeps audio silent until a user
 * gesture has started it. 'playback' tells Safari this is media, which the mute switch leaves alone.
 */
export function unlockAudio(): AudioContext | null {
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  if (session) session.type = 'playback';
  try {
    context ??= new AudioContext();
  } catch (err) {
    console.error(err);
    return null;
  }
  if (context.state !== 'running') void context.resume();
  return context;
}

/** Beeps scheduled but not yet played, so a pause or a skip can take them back. */
const pending = new Set<OscillatorNode>();

/** Plays `cue` once `delaySec` seconds from now. */
export function scheduleCue(cue: Cue, delaySec: number): void {
  if (!context) return;
  const start = context.currentTime + Math.max(0, delaySec);
  for (const tone of TONES[cue]) {
    const at = start + tone.offset;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.frequency.value = tone.freq;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(VOLUME, at + FADE);
    gain.gain.setValueAtTime(VOLUME, at + tone.duration - FADE);
    gain.gain.linearRampToValueAtTime(0, at + tone.duration);
    osc.connect(gain).connect(context.destination);
    osc.onended = () => {
      pending.delete(osc);
      osc.disconnect();
    };
    osc.start(at);
    osc.stop(at + tone.duration);
    pending.add(osc);
  }
}

export function cancelCues(): void {
  for (const osc of pending) {
    osc.onended = null;
    osc.stop();
    osc.disconnect();
  }
  pending.clear();
}

const SOUND_KEY = 'timer-sound';

/** Whether the beeps are on, remembered per device; on unless turned off here before. */
export function loadSoundOn(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function storeSoundOn(on: boolean): void {
  try {
    localStorage.setItem(SOUND_KEY, on ? 'on' : 'off');
  } catch {
    // A private window may refuse storage; the setting then lasts until the page closes.
  }
}
