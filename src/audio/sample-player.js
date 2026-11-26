/**
 * Procedural drum synthesis for all 23 instruments.
 *
 * A custom decoded AudioBuffer, when supplied, takes precedence over the
 * built-in synthesis for that instrument. The function only schedules Web
 * Audio nodes; it never uses timers for audio playback.
 */
export function renderInstrumentSound(
  audioContext,
  destinationNode,
  noiseBuffer,
  instrumentId,
  startTime,
  customBuffer = null,
) {
  const time = Math.max(audioContext.currentTime, startTime);

  if (customBuffer) {
    const source = audioContext.createBufferSource();
    source.buffer = customBuffer;
    source.connect(destinationNode);
    source.start(time);
    return;
  }

  switch (instrumentId) {
    case 'kick': {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(150, time);
      oscillator.frequency.exponentialRampToValueAtTime(42, time + 0.11);
      oscillator.frequency.exponentialRampToValueAtTime(28, time + 0.28);
      gain.gain.setValueAtTime(1.0, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
      oscillator.connect(gain);
      gain.connect(destinationNode);
      oscillator.start(time);
      oscillator.stop(time + 0.31);
      break;
    }
    case 'kick_dry': {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(175, time);
      oscillator.frequency.exponentialRampToValueAtTime(50, time + 0.075);
      gain.gain.setValueAtTime(0.95, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
      oscillator.connect(gain);
      gain.connect(destinationNode);
      oscillator.start(time);
      oscillator.stop(time + 0.16);
      break;
    }
    case 'kick_boom': {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(112, time);
      oscillator.frequency.exponentialRampToValueAtTime(33, time + 0.25);
      gain.gain.setValueAtTime(1.0, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.56);
      oscillator.connect(gain);
      gain.connect(destinationNode);
      oscillator.start(time);
      oscillator.stop(time + 0.57);
      break;
    }
    case 'snare': {
      const noise = audioContext.createBufferSource();
      noise.buffer = noiseBuffer;
      const highpass = audioContext.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.setValueAtTime(950, time);
      const noiseGain = audioContext.createGain();
      noiseGain.gain.setValueAtTime(0.72, time);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.19);
      noise.connect(highpass);
      highpass.connect(noiseGain);
      noiseGain.connect(destinationNode);
      noise.start(time);
      noise.stop(time + 0.2);

      const oscillator = audioContext.createOscillator();
      const oscillatorGain = audioContext.createGain();
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(200, time);
      oscillator.frequency.exponentialRampToValueAtTime(105, time + 0.1);
      oscillatorGain.gain.setValueAtTime(0.68, time);
      oscillatorGain.gain.exponentialRampToValueAtTime(0.01, time + 0.12);
      oscillator.connect(oscillatorGain);
      oscillatorGain.connect(destinationNode);
      oscillator.start(time);
      oscillator.stop(time + 0.13);
      break;
    }
    case 'snare_stick': {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(860, time);
      oscillator.frequency.exponentialRampToValueAtTime(420, time + 0.035);
      gain.gain.setValueAtTime(0.7, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.045);
      oscillator.connect(gain);
      gain.connect(destinationNode);
      oscillator.start(time);
      oscillator.stop(time + 0.05);
      break;
    }
    case 'snare_brush': {
      const noise = audioContext.createBufferSource();
      noise.buffer = noiseBuffer;
      const bandpass = audioContext.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.setValueAtTime(2400, time);
      bandpass.Q.value = 1.2;
      const gain = audioContext.createGain();
      gain.gain.setValueAtTime(0.05, time);
      gain.gain.linearRampToValueAtTime(0.45, time + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.005, time + 0.28);
      noise.connect(bandpass);
      bandpass.connect(gain);
      gain.connect(destinationNode);
      noise.start(time);
      noise.stop(time + 0.29);
      break;
    }
    case 'close_hat': {
      const noise = audioContext.createBufferSource();
      noise.buffer = noiseBuffer;
      const highpass = audioContext.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.setValueAtTime(7600, time);
      const gain = audioContext.createGain();
      gain.gain.setValueAtTime(0.42, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.055);
      noise.connect(highpass);
      highpass.connect(gain);
      gain.connect(destinationNode);
      noise.start(time);
      noise.stop(time + 0.06);
      break;
    }
    case 'open_hat': {
      const noise = audioContext.createBufferSource();
      noise.buffer = noiseBuffer;
      const highpass = audioContext.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.setValueAtTime(6800, time);
      const gain = audioContext.createGain();
      gain.gain.setValueAtTime(0.44, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.34);
      noise.connect(highpass);
      highpass.connect(gain);
      gain.connect(destinationNode);
      noise.start(time);
      noise.stop(time + 0.35);
      break;
    }
    case 'ride': {
      const noise = audioContext.createBufferSource();
      noise.buffer = noiseBuffer;
      const bandpass = audioContext.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.setValueAtTime(5200, time);
      bandpass.Q.value = 2.5;
      const gain = audioContext.createGain();
      gain.gain.setValueAtTime(0.46, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.55);
      noise.connect(bandpass);
      bandpass.connect(gain);
      gain.connect(destinationNode);
      noise.start(time);
      noise.stop(time + 0.56);
      break;
    }
    case 'crash': {
      const noise = audioContext.createBufferSource();
      noise.buffer = noiseBuffer;
      const highpass = audioContext.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.setValueAtTime(4200, time);
      const gain = audioContext.createGain();
      gain.gain.setValueAtTime(0.62, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.85);
      noise.connect(highpass);
      highpass.connect(gain);
      gain.connect(destinationNode);
      noise.start(time);
      noise.stop(time + 0.86);
      break;
    }
    case 'tom_low':
    case 'tom_mid':
    case 'tom_high': {
      const frequencies = { tom_low: [115, 58], tom_mid: [165, 85], tom_high: [230, 120] };
      const [startFrequency, endFrequency] = frequencies[instrumentId];
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(startFrequency, time);
      oscillator.frequency.exponentialRampToValueAtTime(endFrequency, time + 0.18);
      gain.gain.setValueAtTime(0.8, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.24);
      oscillator.connect(gain);
      gain.connect(destinationNode);
      oscillator.start(time);
      oscillator.stop(time + 0.25);
      break;
    }
    case 'clap': {
      [0, 0.012, 0.024].forEach((offset, index) => {
        const noise = audioContext.createBufferSource();
        noise.buffer = noiseBuffer;
        const bandpass = audioContext.createBiquadFilter();
        bandpass.type = 'bandpass';
        bandpass.frequency.setValueAtTime(1350, time + offset);
        bandpass.Q.value = 1.4;
        const gain = audioContext.createGain();
        const duration = index === 2 ? 0.18 : 0.025;
        gain.gain.setValueAtTime(0.65, time + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, time + offset + duration);
        noise.connect(bandpass);
        bandpass.connect(gain);
        gain.connect(destinationNode);
        noise.start(time + offset);
        noise.stop(time + offset + duration + 0.01);
      });
      break;
    }
    case 'cowbell': {
      [540, 800].forEach(frequency => {
        const oscillator = audioContext.createOscillator();
        const bandpass = audioContext.createBiquadFilter();
        const gain = audioContext.createGain();
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(frequency, time);
        bandpass.type = 'bandpass';
        bandpass.frequency.setValueAtTime(700, time);
        gain.gain.setValueAtTime(0.32, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);
        oscillator.connect(bandpass);
        bandpass.connect(gain);
        gain.connect(destinationNode);
        oscillator.start(time);
        oscillator.stop(time + 0.23);
      });
      break;
    }
    case 'wood_low':
    case 'wood_hi': {
      const baseFrequency = instrumentId === 'wood_low' ? 680 : 960;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(baseFrequency, time);
      oscillator.frequency.exponentialRampToValueAtTime(baseFrequency * 0.85, time + 0.05);
      gain.gain.setValueAtTime(0.7, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.065);
      oscillator.connect(gain);
      gain.connect(destinationNode);
      oscillator.start(time);
      oscillator.stop(time + 0.07);
      break;
    }
    case 'maracas':
    case 'shaker': {
      const noise = audioContext.createBufferSource();
      noise.buffer = noiseBuffer;
      const bandpass = audioContext.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.setValueAtTime(instrumentId === 'maracas' ? 6200 : 4800, time);
      const gain = audioContext.createGain();
      gain.gain.setValueAtTime(0.02, time);
      gain.gain.linearRampToValueAtTime(0.35, time + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.09);
      noise.connect(bandpass);
      bandpass.connect(gain);
      gain.connect(destinationNode);
      noise.start(time);
      noise.stop(time + 0.1);
      break;
    }
    case 'tambourine': {
      const noise = audioContext.createBufferSource();
      noise.buffer = noiseBuffer;
      const highpass = audioContext.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.setValueAtTime(7200, time);
      const gain = audioContext.createGain();
      gain.gain.setValueAtTime(0.45, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);
      noise.connect(highpass);
      highpass.connect(gain);
      gain.connect(destinationNode);
      noise.start(time);
      noise.stop(time + 0.23);
      break;
    }
    case 'rimshot': {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(460, time);
      oscillator.frequency.exponentialRampToValueAtTime(210, time + 0.05);
      gain.gain.setValueAtTime(0.8, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.07);
      oscillator.connect(gain);
      gain.connect(destinationNode);
      oscillator.start(time);
      oscillator.stop(time + 0.08);
      break;
    }
    case 'bongo_low':
    case 'bongo_high': {
      const frequency = instrumentId === 'bongo_low' ? 210 : 340;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency * 1.25, time);
      oscillator.frequency.exponentialRampToValueAtTime(frequency, time + 0.06);
      gain.gain.setValueAtTime(0.75, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.14);
      oscillator.connect(gain);
      gain.connect(destinationNode);
      oscillator.start(time);
      oscillator.stop(time + 0.15);
      break;
    }
    default:
      break;
  }
}
