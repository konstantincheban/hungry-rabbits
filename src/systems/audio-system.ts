export type SoundEffectId =
  | 'ui-click'
  | 'shot'
  | 'hit-normal'
  | 'hit-golden'
  | 'combo'
  | 'miss'
  | 'submit-success'
  | 'network-error'
  | 'game-over';

const AUDIO_PREFS_KEY = 'hungry-rabbits:sfx-enabled';

interface ToneParams {
  frequency: number;
  durationMs: number;
  gain: number;
  type?: OscillatorType;
  detune?: number;
  startOffsetMs?: number;
  attackMs?: number;
  releaseMs?: number;
}

class AudioSystem {
  private audioContext: AudioContext | null = null;
  private enabled = true;

  public constructor() {
    this.enabled = this.readInitialEnabledValue();
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.persistEnabledValue();

    if (enabled) {
      this.unlockFromGesture();
    }
  }

  public toggleEnabled(): boolean {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  public unlockFromGesture(): void {
    if (!this.enabled) {
      return;
    }

    const context = this.getAudioContext();
    if (!context) {
      return;
    }

    if (context.state === 'suspended') {
      void context.resume().catch(() => {
        // Ignore resume errors. Audio stays optional for the demo.
      });
    }
  }

  public play(soundId: SoundEffectId): void {
    if (!this.enabled) {
      return;
    }

    const context = this.getAudioContext();
    if (!context || context.state !== 'running') {
      return;
    }

    switch (soundId) {
      case 'ui-click':
        this.playToneBatch(context, [
          { frequency: 520, durationMs: 46, gain: 0.05, type: 'triangle' },
          { frequency: 730, durationMs: 52, gain: 0.04, type: 'triangle', startOffsetMs: 26 },
        ]);
        break;
      case 'shot':
        this.playToneBatch(context, [
          { frequency: 180, durationMs: 80, gain: 0.1, type: 'sawtooth' },
          { frequency: 120, durationMs: 120, gain: 0.06, type: 'triangle', detune: -20 },
        ]);
        break;
      case 'hit-normal':
        this.playToneBatch(context, [
          { frequency: 600, durationMs: 58, gain: 0.07, type: 'square' },
          { frequency: 820, durationMs: 74, gain: 0.06, type: 'triangle', startOffsetMs: 28 },
        ]);
        break;
      case 'hit-golden':
        this.playToneBatch(context, [
          { frequency: 520, durationMs: 65, gain: 0.08, type: 'triangle' },
          { frequency: 780, durationMs: 85, gain: 0.07, type: 'triangle', startOffsetMs: 18 },
          { frequency: 1060, durationMs: 112, gain: 0.05, type: 'sine', startOffsetMs: 44 },
        ]);
        break;
      case 'combo':
        this.playToneBatch(context, [
          { frequency: 420, durationMs: 50, gain: 0.05, type: 'triangle' },
          { frequency: 540, durationMs: 50, gain: 0.05, type: 'triangle', startOffsetMs: 48 },
          { frequency: 660, durationMs: 60, gain: 0.05, type: 'triangle', startOffsetMs: 96 },
        ]);
        break;
      case 'miss':
        this.playToneBatch(context, [
          { frequency: 170, durationMs: 80, gain: 0.06, type: 'triangle' },
          { frequency: 135, durationMs: 108, gain: 0.05, type: 'triangle', startOffsetMs: 26 },
        ]);
        break;
      case 'submit-success':
        this.playToneBatch(context, [
          { frequency: 460, durationMs: 55, gain: 0.06, type: 'triangle' },
          { frequency: 620, durationMs: 60, gain: 0.06, type: 'triangle', startOffsetMs: 40 },
          { frequency: 800, durationMs: 65, gain: 0.06, type: 'triangle', startOffsetMs: 84 },
        ]);
        break;
      case 'network-error':
        this.playToneBatch(context, [
          { frequency: 240, durationMs: 84, gain: 0.06, type: 'square' },
          { frequency: 190, durationMs: 120, gain: 0.05, type: 'square', startOffsetMs: 60 },
        ]);
        break;
      case 'game-over':
        this.playToneBatch(context, [
          { frequency: 440, durationMs: 90, gain: 0.06, type: 'triangle' },
          { frequency: 320, durationMs: 130, gain: 0.06, type: 'triangle', startOffsetMs: 68 },
          { frequency: 220, durationMs: 170, gain: 0.05, type: 'triangle', startOffsetMs: 132 },
        ]);
        break;
      default:
        break;
    }
  }

  private playToneBatch(context: AudioContext, tones: ToneParams[]): void {
    for (const tone of tones) {
      this.playTone(context, tone);
    }
  }

  private playTone(context: AudioContext, params: ToneParams): void {
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    const startOffsetSeconds = (params.startOffsetMs ?? 0) / 1000;
    const durationSeconds = Math.max(0.01, params.durationMs / 1000);
    const attackSeconds = Math.max(0.002, (params.attackMs ?? 8) / 1000);
    const releaseSeconds = Math.max(0.004, (params.releaseMs ?? 55) / 1000);

    const startTime = context.currentTime + startOffsetSeconds;
    const endTime = startTime + durationSeconds;

    oscillator.type = params.type ?? 'sine';
    oscillator.frequency.setValueAtTime(params.frequency, startTime);

    if (params.detune !== undefined) {
      oscillator.detune.setValueAtTime(params.detune, startTime);
    }

    gainNode.gain.setValueAtTime(0.0001, startTime);
    gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0001, params.gain), startTime + attackSeconds);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, endTime + releaseSeconds);

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);

    oscillator.start(startTime);
    oscillator.stop(endTime + releaseSeconds + 0.01);
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') {
      return null;
    }

    if (this.audioContext) {
      return this.audioContext;
    }

    const AudioContextCtor = window.AudioContext ?? (window as Window & {
      webkitAudioContext?: typeof AudioContext;
    }).webkitAudioContext;

    if (!AudioContextCtor) {
      return null;
    }

    this.audioContext = new AudioContextCtor();
    return this.audioContext;
  }

  private readInitialEnabledValue(): boolean {
    if (typeof window === 'undefined') {
      return true;
    }

    try {
      const stored = window.localStorage.getItem(AUDIO_PREFS_KEY);

      if (stored === null) {
        return true;
      }

      return stored !== '0';
    } catch {
      return true;
    }
  }

  private persistEnabledValue(): void {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(AUDIO_PREFS_KEY, this.enabled ? '1' : '0');
    } catch {
      // Ignore persistence failure.
    }
  }
}

export const audioSystem = new AudioSystem();
