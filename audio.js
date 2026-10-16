// Audio Engine for Harmonium & Drums Studio
// Uses Web Audio API for 100% offline, zero-latency realistic sound synthesis

class SoundEngine {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.harmoniumGain = null;
        this.drumsGain = null;
        this.activeNotes = new Map(); // noteName -> { oscillators, gainNode }
        this.activeDrone = null;
        this.bellowsPressure = 1.0;
        this.reedType = 'double'; // 'single', 'double', 'triple'
        this.currentInstrument = 'harmonium'; // 'harmonium', 'flute', 'violin', 'guitar'
        this.fluteTone = 'bansuri'; // 'bansuri', 'folk', 'bass'
        this.violinTone = 'solo'; // 'solo', 'warm', 'folk'
        this.guitarTone = 'steel'; // 'steel', 'nylon', 'twelve'
        this.pianoTone = 'grand'; // 'grand', 'upright', 'rhodes'
        this.sitarTone = 'gandhar'; // 'gandhar', 'kharaj', 'darbari'
        this.santoorTone = 'kashmiri'; // 'kashmiri', 'persian', 'ambient'
        this.saxTone = 'alto'; // 'alto', 'tenor', 'soprano'
        
        // Recording
        this.dest = null;
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.isRecording = false;

        // Loop Sequencer
        this.currentRhythm = null;
        this.isPlayingRhythm = false;
        this.bpm = 100;
        this.stepIndex = 0;
        this.rhythmInterval = null;

        // Studio Effects Engine (Reverb, Delay, 3-Band EQ, Tube Warmth, Chorus, Limiter)
        this.currentStudioPreset = 'mehfil'; // 'mehfil', 'classical', 'bollywood', 'qawwali', 'clean'
        this.reverbPreset = 'mehfil'; // 'mehfil', 'studio', 'plate', 'cathedral', 'spring', 'off'
        this.reverbWet = 0.38;
        this.delayEnabled = true;
        this.delayTime = 0.34;
        this.delayFeedback = 0.32;
        this.delayWet = 0.20;
        this.tubeWarmth = 25; // 0 to 100%
        this.eqLowGain = 2.5; // dB (-12 to +12)
        this.eqMidGain = 1.0; // dB (-12 to +12)
        this.eqHighGain = 1.5; // dB (-12 to +12)
        this.chorusEnabled = true;

        // Effect Nodes
        this.preFxBus = null;
        this.postFxBus = null;
        this.eqLow = null;
        this.eqMid = null;
        this.eqHigh = null;
        this.driveNode = null;
        this.driveDryGain = null;
        this.driveWetGain = null;
        this.driveSum = null;
        this.delaySendGain = null;
        this.delayReturnGain = null;
        this.delayL = null;
        this.delayR = null;
        this.delayFeedbackL = null;
        this.delayFeedbackR = null;
        this.delayFilter = null;
        this.reverbSendGain = null;
        this.reverbReturnGain = null;
        this.reverbConvolver = null;
        this.reverbBuffers = {};
        this.chorusLfo = null;
        this.chorusDelayL = null;
        this.chorusDelayR = null;
        this.chorusDepthL = null;
        this.chorusDepthR = null;
        this.chorusDryGain = null;
        this.chorusWetGain = null;
        this.chorusSum = null;
        this.masterLimiter = null;
    }

    setInstrument(inst) {
        if (this.currentInstrument === inst) return;
        this.stopAllHarmoniumNotes();
        this.currentInstrument = inst;
    }

    setTone(tone) {
        if (this.currentInstrument === 'harmonium') this.reedType = tone;
        else if (this.currentInstrument === 'flute') this.fluteTone = tone;
        else if (this.currentInstrument === 'violin') this.violinTone = tone;
        else if (this.currentInstrument === 'guitar') this.guitarTone = tone;
        else if (this.currentInstrument === 'piano') this.pianoTone = tone;
        else if (this.currentInstrument === 'sitar') this.sitarTone = tone;
        else if (this.currentInstrument === 'santoor') this.santoorTone = tone;
        else if (this.currentInstrument === 'sax') this.saxTone = tone;
    }

    setFluteTone(tone) {
        this.fluteTone = tone;
    }

    setViolinTone(tone) {
        this.violinTone = tone;
    }

    setGuitarTone(tone) {
        this.guitarTone = tone;
    }

    setPianoTone(tone) {
        this.pianoTone = tone;
    }

    setSitarTone(tone) {
        this.sitarTone = tone;
    }

    setSantoorTone(tone) {
        this.santoorTone = tone;
    }

    setSaxTone(tone) {
        this.saxTone = tone;
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();

            // 1. Sub channels for instruments & drums
            this.harmoniumGain = this.ctx.createGain();
            this.harmoniumGain.gain.setValueAtTime(0.85, this.ctx.currentTime);

            this.drumsGain = this.ctx.createGain();
            this.drumsGain.gain.setValueAtTime(0.9, this.ctx.currentTime);

            // 2. Pre-FX Summing Bus
            this.preFxBus = this.ctx.createGain();
            this.harmoniumGain.connect(this.preFxBus);
            this.drumsGain.connect(this.preFxBus);

            // 3. 3-Band Parametric Studio Equalizer
            this.eqLow = this.ctx.createBiquadFilter();
            this.eqLow.type = 'lowshelf';
            this.eqLow.frequency.setValueAtTime(130, this.ctx.currentTime);
            this.eqLow.gain.setValueAtTime(this.eqLowGain, this.ctx.currentTime);

            this.eqMid = this.ctx.createBiquadFilter();
            this.eqMid.type = 'peaking';
            this.eqMid.frequency.setValueAtTime(1200, this.ctx.currentTime);
            this.eqMid.Q.setValueAtTime(1.0, this.ctx.currentTime);
            this.eqMid.gain.setValueAtTime(this.eqMidGain, this.ctx.currentTime);

            this.eqHigh = this.ctx.createBiquadFilter();
            this.eqHigh.type = 'highshelf';
            this.eqHigh.frequency.setValueAtTime(6000, this.ctx.currentTime);
            this.eqHigh.gain.setValueAtTime(this.eqHighGain, this.ctx.currentTime);

            this.preFxBus.connect(this.eqLow);
            this.eqLow.connect(this.eqMid);
            this.eqMid.connect(this.eqHigh);

            // 4. Analog Tube Saturation & Warmth Stage
            this.driveNode = this.ctx.createWaveShaper();
            this.driveNode.curve = this.createWarmthCurve(this.tubeWarmth);
            this.driveNode.oversample = '4x';

            this.driveDryGain = this.ctx.createGain();
            this.driveWetGain = this.ctx.createGain();
            const wetWarmth = this.tubeWarmth / 100;
            this.driveWetGain.gain.setValueAtTime(wetWarmth * 0.85, this.ctx.currentTime);
            this.driveDryGain.gain.setValueAtTime(1.0 - (wetWarmth * 0.35), this.ctx.currentTime);

            this.driveSum = this.ctx.createGain();
            this.eqHigh.connect(this.driveDryGain);
            this.eqHigh.connect(this.driveNode);
            this.driveNode.connect(this.driveWetGain);
            this.driveDryGain.connect(this.driveSum);
            this.driveWetGain.connect(this.driveSum);

            // 5. Stereo Chorus / Dimension Widener Stage
            this.chorusDryGain = this.ctx.createGain();
            this.chorusWetGain = this.ctx.createGain();
            this.chorusSum = this.ctx.createGain();

            this.chorusDelayL = this.ctx.createDelay(0.1);
            this.chorusDelayR = this.ctx.createDelay(0.1);
            this.chorusDelayL.delayTime.setValueAtTime(0.022, this.ctx.currentTime);
            this.chorusDelayR.delayTime.setValueAtTime(0.027, this.ctx.currentTime);

            this.chorusLfo = this.ctx.createOscillator();
            this.chorusLfo.frequency.setValueAtTime(0.75, this.ctx.currentTime);

            this.chorusDepthL = this.ctx.createGain();
            this.chorusDepthR = this.ctx.createGain();
            this.chorusDepthL.gain.setValueAtTime(0.003, this.ctx.currentTime);
            this.chorusDepthR.gain.setValueAtTime(-0.003, this.ctx.currentTime);

            this.chorusLfo.connect(this.chorusDepthL);
            this.chorusLfo.connect(this.chorusDepthR);
            this.chorusDepthL.connect(this.chorusDelayL.delayTime);
            this.chorusDepthR.connect(this.chorusDelayR.delayTime);

            const chorusMerger = this.ctx.createChannelMerger(2);
            this.chorusDelayL.connect(chorusMerger, 0, 0);
            this.chorusDelayR.connect(chorusMerger, 0, 1);
            chorusMerger.connect(this.chorusWetGain);

            this.driveSum.connect(this.chorusDryGain);
            this.driveSum.connect(this.chorusDelayL);
            this.driveSum.connect(this.chorusDelayR);

            this.chorusDryGain.connect(this.chorusSum);
            this.chorusWetGain.connect(this.chorusSum);

            this.chorusWetGain.gain.setValueAtTime(this.chorusEnabled ? 0.65 : 0.0001, this.ctx.currentTime);
            this.chorusDryGain.gain.setValueAtTime(this.chorusEnabled ? 0.85 : 1.0, this.ctx.currentTime);
            try { this.chorusLfo.start(); } catch(e) {}

            // 6. Post-FX Bus (Sums Dry, Delay, and Reverb)
            this.postFxBus = this.ctx.createGain();
            this.chorusSum.connect(this.postFxBus); // Dry through path

            // 7. Stereo Ping-Pong / Tape Echo Delay Network
            this.delaySendGain = this.ctx.createGain();
            this.delayReturnGain = this.ctx.createGain();
            this.delayL = this.ctx.createDelay(2.0);
            this.delayR = this.ctx.createDelay(2.0);
            this.delayL.delayTime.setValueAtTime(this.delayTime, this.ctx.currentTime);
            this.delayR.delayTime.setValueAtTime(Math.min(1.2, this.delayTime * 1.25), this.ctx.currentTime);

            this.delayFeedbackL = this.ctx.createGain();
            this.delayFeedbackR = this.ctx.createGain();
            this.delayFeedbackL.gain.setValueAtTime(this.delayFeedback, this.ctx.currentTime);
            this.delayFeedbackR.gain.setValueAtTime(this.delayFeedback, this.ctx.currentTime);

            this.delayFilter = this.ctx.createBiquadFilter();
            this.delayFilter.type = 'lowpass';
            this.delayFilter.frequency.setValueAtTime(2800, this.ctx.currentTime);

            this.chorusSum.connect(this.delaySendGain);
            this.delaySendGain.connect(this.delayL);
            this.delayL.connect(this.delayFilter);
            this.delayFilter.connect(this.delayFeedbackL);
            this.delayFeedbackL.connect(this.delayR); // Cross feed L -> R

            this.delayR.connect(this.delayFeedbackR);
            this.delayFeedbackR.connect(this.delayL); // Cross feed R -> L

            const delayMerger = this.ctx.createChannelMerger(2);
            this.delayL.connect(delayMerger, 0, 0);
            this.delayR.connect(delayMerger, 0, 1);
            delayMerger.connect(this.delayReturnGain);

            this.delayReturnGain.gain.setValueAtTime(this.delayEnabled ? this.delayWet : 0.0001, this.ctx.currentTime);
            this.delayReturnGain.connect(this.postFxBus);

            // 8. Studio Reverb (Procedural Convolver) Network
            this.reverbSendGain = this.ctx.createGain();
            this.reverbReturnGain = this.ctx.createGain();
            this.reverbConvolver = this.ctx.createConvolver();

            // Build and load initial impulse
            this.reverbBuffers[this.reverbPreset] = this.buildImpulseBuffer(this.reverbPreset);
            this.reverbConvolver.buffer = this.reverbBuffers[this.reverbPreset];

            this.chorusSum.connect(this.reverbSendGain);
            this.reverbSendGain.connect(this.reverbConvolver);
            this.reverbConvolver.connect(this.reverbReturnGain);

            this.reverbReturnGain.gain.setValueAtTime(this.reverbPreset === 'off' ? 0.0001 : this.reverbWet, this.ctx.currentTime);
            this.reverbReturnGain.connect(this.postFxBus);

            // 9. Master Studio Limiter / Mastering Compressor (Zero distortion)
            this.masterLimiter = this.ctx.createDynamicsCompressor();
            this.masterLimiter.threshold.setValueAtTime(-2.0, this.ctx.currentTime);
            this.masterLimiter.knee.setValueAtTime(6.0, this.ctx.currentTime);
            this.masterLimiter.ratio.setValueAtTime(12.0, this.ctx.currentTime);
            this.masterLimiter.attack.setValueAtTime(0.003, this.ctx.currentTime);
            this.masterLimiter.release.setValueAtTime(0.15, this.ctx.currentTime);

            this.postFxBus.connect(this.masterLimiter);

            // 10. Master Channel Gain
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.setValueAtTime(0.85, this.ctx.currentTime);
            this.masterLimiter.connect(this.masterGain);

            // 11. Final output to speakers & recorder
            this.masterGain.connect(this.ctx.destination);
            try {
                this.dest = this.ctx.createMediaStreamDestination();
                this.masterGain.connect(this.dest);
            } catch (e) {
                console.warn("MediaStreamDestination not supported", e);
            }
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    /* ===================================================
       MULTI-INSTRUMENT ACOUSTIC SYNTHESIS ENGINE
       1. Indian Harmonium: Male, Female, Bass reeds, acoustic chamber
       2. Indian Bansuri Flute: 100% Real acoustic bamboo woodwind with
          pink-noise note-tracking breath turbulence, embouchure chiff,
          delayed-onset vibrato, and breath tremolo
       3. Classical Violin: Bowed string sawtooth + chorus, rosin scratch,
          and wooden body acoustic formants (Helmholtz, Wood, Bridge hill)
       4. Acoustic & Classical Guitar: Plucked string with pick snap transient,
          frequency-dependent multi-harmonic decay, and wooden soundboard cavity
    =================================================== */

    playHarmoniumNote(freq, noteId) {
        this.init();
        if (this.currentInstrument === 'flute') {
            this.playFluteNote(freq, noteId);
            return;
        }
        if (this.currentInstrument === 'violin') {
            this.playViolinNote(freq, noteId);
            return;
        }
        if (this.currentInstrument === 'guitar') {
            this.playGuitarNote(freq, noteId);
            return;
        }
        if (this.currentInstrument === 'piano') {
            this.playPianoNote(freq, noteId);
            return;
        }
        if (this.currentInstrument === 'sitar') {
            this.playSitarNote(freq, noteId);
            return;
        }
        if (this.currentInstrument === 'santoor') {
            this.playSantoorNote(freq, noteId);
            return;
        }
        if (this.currentInstrument === 'sax') {
            this.playSaxNote(freq, noteId);
            return;
        }
        this.playHarmoniumVoice(freq, noteId);
    }

    /* ---------------- PROFESSIONAL INDIAN HARMONIUM ---------------- */
    playHarmoniumVoice(freq, noteId) {
        if (this.activeNotes.has(noteId)) return;

        const now = this.ctx.currentTime;
        const voiceGain = this.ctx.createGain();
        voiceGain.gain.setValueAtTime(0.0001, now);
        
        // Natural swell attack (~0.040s) imitating harmonium bellows wind entering reed chamber
        const targetVol = 0.32 * this.bellowsPressure;
        voiceGain.gain.exponentialRampToValueAtTime(Math.max(0.001, targetVol), now + 0.040);

        // Acoustic wooden reed box formant filters
        // 1. Body cavity warmth formant (650 Hz)
        const fBody = this.ctx.createBiquadFilter();
        fBody.type = 'peaking';
        fBody.frequency.setValueAtTime(650, now);
        fBody.Q.setValueAtTime(2.0, now);
        fBody.gain.setValueAtTime(3.5, now);

        // 2. Reed throat ring formant (1450 Hz)
        const fThroat = this.ctx.createBiquadFilter();
        fThroat.type = 'peaking';
        fThroat.frequency.setValueAtTime(1450, now);
        fThroat.Q.setValueAtTime(1.8, now);
        fThroat.gain.setValueAtTime(2.2, now);

        // 3. Low-pass filter to give organic wooden reed warmth & remove electronic edge
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(3400, now);
        filter.Q.setValueAtTime(1.3, now);

        const oscs = [];

        // 1. Male Reed (Fundamental acoustic rich wave)
        const oscMale = this.ctx.createOscillator();
        oscMale.type = 'sawtooth';
        oscMale.frequency.setValueAtTime(freq, now);
        oscMale.connect(fBody);
        oscs.push(oscMale);

        // 2. Female Reed (Authentic Desi Chorus: 7.5 cents sharp beating)
        if (this.reedType === 'double' || this.reedType === 'triple') {
            const oscFemale = this.ctx.createOscillator();
            oscFemale.type = 'sawtooth';
            oscFemale.frequency.setValueAtTime(freq, now);
            oscFemale.detune.setValueAtTime(7.5, now);

            const femaleGain = this.ctx.createGain();
            femaleGain.gain.setValueAtTime(0.78, now);
            oscFemale.connect(femaleGain);
            femaleGain.connect(fBody);
            oscs.push(oscFemale);
        }

        // 3. Bass Reed (Deep organ resonance: 1 octave down)
        if (this.reedType === 'triple') {
            const oscBass = this.ctx.createOscillator();
            oscBass.type = 'sawtooth';
            oscBass.frequency.setValueAtTime(freq / 2, now);
            oscBass.detune.setValueAtTime(-3, now);
            
            const bassGain = this.ctx.createGain();
            bassGain.gain.setValueAtTime(0.60, now);
            oscBass.connect(bassGain);
            bassGain.connect(fBody);
            oscs.push(oscBass);

            // Sub-harmonic warm body
            const oscSub = this.ctx.createOscillator();
            oscSub.type = 'triangle';
            oscSub.frequency.setValueAtTime(freq / 2, now);
            const subGain = this.ctx.createGain();
            subGain.gain.setValueAtTime(0.35, now);
            oscSub.connect(subGain);
            subGain.connect(fBody);
            oscs.push(oscSub);
        }

        // 4. Subtle Reed Buzz & Upper Harmonic Ring
        const oscSubtle = this.ctx.createOscillator();
        oscSubtle.type = 'square';
        oscSubtle.frequency.setValueAtTime(freq * 2, now);
        const subtleGain = this.ctx.createGain();
        subtleGain.gain.setValueAtTime(0.09, now);
        oscSubtle.connect(subtleGain);
        subtleGain.connect(fBody);
        oscs.push(oscSubtle);

        // 5. Tactile Reed Valve Key-Drop Acoustic Transient (15ms soft puff)
        let valveNoise = null;
        try {
            const vBufSize = Math.floor(this.ctx.sampleRate * 0.025);
            const vBuf = this.ctx.createBuffer(1, vBufSize, this.ctx.sampleRate);
            const vData = vBuf.getChannelData(0);
            for (let i = 0; i < vBufSize; i++) {
                vData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.006));
            }
            valveNoise = this.ctx.createBufferSource();
            valveNoise.buffer = vBuf;

            const vFilter = this.ctx.createBiquadFilter();
            vFilter.type = 'bandpass';
            vFilter.frequency.setValueAtTime(1600, now);
            vFilter.Q.setValueAtTime(2.5, now);

            const vGain = this.ctx.createGain();
            vGain.gain.setValueAtTime(0.05 * this.bellowsPressure, now);
            vGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

            valveNoise.connect(vFilter);
            vFilter.connect(vGain);
            vGain.connect(voiceGain);
            valveNoise.start(now);
        } catch (e) {}

        // Connect acoustic chain: fBody -> fThroat -> filter -> voiceGain -> harmoniumGain
        fBody.connect(fThroat);
        fThroat.connect(filter);
        filter.connect(voiceGain);
        voiceGain.connect(this.harmoniumGain);

        oscs.forEach(osc => osc.start(now));

        this.activeNotes.set(noteId, {
            instrument: 'harmonium',
            oscs,
            valveNoise,
            gainNode: voiceGain,
            filter
        });
    }

    stopHarmoniumVoice(noteId) {
        if (!this.activeNotes.has(noteId)) return;
        const noteObj = this.activeNotes.get(noteId);
        const { oscs, valveNoise, gainNode } = noteObj;
        const now = this.ctx.currentTime;

        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(gainNode.gain.value, now);
        // Realistic reed wind release (~0.13s)
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);

        setTimeout(() => {
            oscs.forEach(osc => {
                try { osc.stop(); osc.disconnect(); } catch (e) {}
            });
            if (valveNoise) {
                try { valveNoise.stop(); valveNoise.disconnect(); } catch (e) {}
            }
            gainNode.disconnect();
        }, 160);

        this.activeNotes.delete(noteId);
    }

    /* ---------------- REALISTIC BANSURI FLUTE ---------------- */
    playFluteNote(freq, noteId) {
        this.init();
        if (this.activeNotes.has(noteId)) return;

        const now = this.ctx.currentTime;
        const voiceGain = this.ctx.createGain();
        voiceGain.gain.setValueAtTime(0.0001, now);

        // Natural breath swell attack (~0.045s)
        const targetVol = 0.32 * this.bellowsPressure;
        voiceGain.gain.exponentialRampToValueAtTime(Math.max(0.001, targetVol), now + 0.045);

        // Acoustic bamboo tone filter (Lowpass + body resonance)
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        let cutoffFreq = Math.min(6500, Math.max(1800, freq * 4.8));
        if (this.fluteTone === 'folk') cutoffFreq = Math.min(8500, freq * 6.2);
        if (this.fluteTone === 'bass') cutoffFreq = Math.min(4200, freq * 3.6);
        filter.frequency.setValueAtTime(cutoffFreq, now);
        filter.Q.setValueAtTime(2.2, now);

        // Bamboo acoustic cavity resonance (sweet warmth formant around 2200 Hz)
        const bodyPeaking = this.ctx.createBiquadFilter();
        bodyPeaking.type = 'peaking';
        bodyPeaking.frequency.setValueAtTime(2200, now);
        bodyPeaking.Q.setValueAtTime(1.8, now);
        bodyPeaking.gain.setValueAtTime(3.5, now);

        // 1. Classical Bansuri Vibrato LFO & Breath Tremolo (5.2 Hz)
        // With delayed onset so note begins cleanly and swells naturally
        const vibratoLfo = this.ctx.createOscillator();
        vibratoLfo.frequency.setValueAtTime(5.2, now);

        // Pitch vibrato gain
        const vibratoGain = this.ctx.createGain();
        vibratoGain.gain.setValueAtTime(0.0, now);
        const vibDepth = Math.max(1.8, freq * 0.013);
        vibratoGain.gain.setValueAtTime(0.0, now + 0.07);
        vibratoGain.gain.linearRampToValueAtTime(vibDepth, now + 0.22);
        vibratoLfo.connect(vibratoGain);

        // Breath Tremolo (amplitude flutter in sync with vibrato)
        const tremoloDepth = this.ctx.createGain();
        tremoloDepth.gain.setValueAtTime(0.0, now);
        tremoloDepth.gain.setValueAtTime(0.0, now + 0.07);
        tremoloDepth.gain.linearRampToValueAtTime(0.07, now + 0.22);
        vibratoLfo.connect(tremoloDepth);
        tremoloDepth.connect(voiceGain.gain);

        const oscs = [];

        // 2. Fundamental Bamboo Tone:
        // A blend of pure sine (warm core) and triangle (organic woody presence)
        const oscSine = this.ctx.createOscillator();
        oscSine.type = 'sine';
        oscSine.frequency.setValueAtTime(freq, now);
        vibratoGain.connect(oscSine.frequency);

        const oscTri = this.ctx.createOscillator();
        oscTri.type = 'triangle';
        oscTri.frequency.setValueAtTime(freq, now);
        vibratoGain.connect(oscTri.frequency);

        const triGain = this.ctx.createGain();
        triGain.gain.setValueAtTime(0.18, now);
        oscTri.connect(triGain);

        oscSine.connect(filter);
        triGain.connect(filter);
        oscs.push(oscSine, oscTri);

        // 3. Second Harmonic (Pure octave overtone, gives sweet singing clarity)
        const osc2 = this.ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(freq * 2, now);
        vibratoGain.connect(osc2.frequency);
        const osc2Gain = this.ctx.createGain();
        osc2Gain.gain.setValueAtTime(this.fluteTone === 'folk' ? 0.22 : 0.15, now);
        osc2.connect(osc2Gain);
        osc2Gain.connect(filter);
        oscs.push(osc2);

        // 4. Third Harmonic (Hollow bamboo overtone)
        const osc3 = this.ctx.createOscillator();
        osc3.type = 'sine';
        osc3.frequency.setValueAtTime(freq * 3, now);
        vibratoGain.connect(osc3.frequency);
        const osc3Gain = this.ctx.createGain();
        osc3Gain.gain.setValueAtTime(0.045, now);
        osc3.connect(osc3Gain);
        osc3Gain.connect(filter);
        oscs.push(osc3);

        // 5. Fourth Harmonic (Subtle airy presence)
        const osc4 = this.ctx.createOscillator();
        osc4.type = 'sine';
        osc4.frequency.setValueAtTime(freq * 4, now);
        vibratoGain.connect(osc4.frequency);
        const osc4Gain = this.ctx.createGain();
        osc4Gain.gain.setValueAtTime(0.015, now);
        osc4.connect(osc4Gain);
        osc4Gain.connect(filter);
        oscs.push(osc4);

        // 6. Dual-Stage Realistic Breath Turbulence & Embouchure Chiff
        // Soft pink noise filtered through note-tuned pipe resonator and blowing hole chiff
        let noiseNode = null;
        let noiseGain = null;
        try {
            const noiseBufSize = Math.floor(this.ctx.sampleRate * 2.0);
            const noiseBuffer = this.ctx.createBuffer(1, noiseBufSize, this.ctx.sampleRate);
            const noiseData = noiseBuffer.getChannelData(0);
            let b0 = 0, b1 = 0, b2 = 0;
            for (let i = 0; i < noiseBufSize; i++) {
                const white = Math.random() * 2 - 1;
                b0 = 0.99765 * b0 + white * 0.0990460;
                b1 = 0.96300 * b1 + white * 0.2965164;
                b2 = 0.57000 * b2 + white * 1.0526913;
                noiseData[i] = (b0 + b1 + b2 + white * 0.1848) * 0.08;
            }
            noiseNode = this.ctx.createBufferSource();
            noiseNode.buffer = noiseBuffer;
            noiseNode.loop = true;

            // Bandpass 1: Resonant pipe breath tuned directly to note frequency!
            const breathPipeFilter = this.ctx.createBiquadFilter();
            breathPipeFilter.type = 'bandpass';
            breathPipeFilter.frequency.setValueAtTime(freq, now);
            breathPipeFilter.Q.setValueAtTime(6.5, now);

            // Bandpass 2: Blowing hole chiff hiss (around 3800 Hz)
            const breathChiffFilter = this.ctx.createBiquadFilter();
            breathChiffFilter.type = 'bandpass';
            breathChiffFilter.frequency.setValueAtTime(3800, now);
            breathChiffFilter.Q.setValueAtTime(2.5, now);

            noiseGain = this.ctx.createGain();
            noiseGain.gain.setValueAtTime(0.0001, now);
            // Dynamic attack breath puff, then continuous airy flow
            noiseGain.gain.linearRampToValueAtTime(0.065, now + 0.025);
            noiseGain.gain.exponentialRampToValueAtTime(0.035, now + 0.12);

            noiseNode.connect(breathPipeFilter);
            noiseNode.connect(breathChiffFilter);
            breathPipeFilter.connect(noiseGain);
            breathChiffFilter.connect(noiseGain);
            noiseGain.connect(filter);
            noiseNode.start(now);
        } catch (e) {
            console.warn("Flute breath noise error", e);
        }

        filter.connect(bodyPeaking);
        bodyPeaking.connect(voiceGain);
        voiceGain.connect(this.harmoniumGain);

        vibratoLfo.start(now);
        oscs.forEach(o => o.start(now));

        this.activeNotes.set(noteId, {
            instrument: 'flute',
            isFlute: true,
            oscs,
            vibratoLfo,
            noiseNode,
            gainNode: voiceGain,
            filter
        });
    }

    stopFluteNote(noteId) {
        if (!this.activeNotes.has(noteId)) return;
        const noteObj = this.activeNotes.get(noteId);
        const { oscs, vibratoLfo, noiseNode, gainNode } = noteObj;
        const now = this.ctx.currentTime;

        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(gainNode.gain.value, now);
        // Smooth acoustic decay tail (~0.18s) as air column rings out
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

        setTimeout(() => {
            oscs.forEach(osc => {
                try { osc.stop(); osc.disconnect(); } catch (e) {}
            });
            if (vibratoLfo) {
                try { vibratoLfo.stop(); vibratoLfo.disconnect(); } catch (e) {}
            }
            if (noiseNode) {
                try { noiseNode.stop(); noiseNode.disconnect(); } catch (e) {}
            }
            gainNode.disconnect();
        }, 220);

        this.activeNotes.delete(noteId);
    }

    /* ---------------- MODERN & REALISTIC CONCERT VIOLIN ----------------
       Physical acoustic model of bowed string & master violin body:
       1. Helmholtz Stick-Slip string motion: Asymmetric multi-harmonic wave synthesis:
          - Primary fundamental bowed sawtooth with fine string tension.
          - Wound-string torsional detune (+2.1 cents) representing synthetic/gut core.
          - Warm soundboard woody core (triangle fundamental).
          - Harmonic overtone shimmer (2nd harmonic octave overtone).
          - Sub-harmonic taraf/sympathetic resonance for Desi classical mode,
            or harmonic saturation for modern electric crossover mode.
       2. Tactile Bow Rosin & Horsehair Friction Dynamics:
          - Dynamic bow attack bite (35ms bandpass noise burst at bridge excitation).
          - Continuous organic rosin texture: velvety tracking pink/filtered noise
            simulating horsehair friction that dynamically breathes with Bow Pressure.
       3. 4-Stage Master Violin Body Resonances (Wood & Air Cavity):
          - Formant 1 (Helmholtz A0 air resonance): 280 Hz (+4.5 to +5.5 dB, Q=3.2)
          - Formant 2 (B1 Main Wood top plate resonance): 470-520 Hz (+6.5 dB, Q=2.6)
          - Formant 3 (Back plate / Rib projection formant): 1120 Hz (+3.8 dB, Q=2.2)
          - Formant 4 (Bridge Hill "Singer's Formant of Violin"): 2600-3400 Hz (+5.0 to +8.5 dB, Q=2.5)
          - High-frequency wood damping filter (5.6 kHz to 9.5 kHz).
       4. Expressive Delayed-Onset Human Vibrato & Tremolo:
          - 100-120ms pure pitch entry, followed by 220ms smooth expansion of vibrato depth.
          - Coupled amplitude tremolo (5-8%) and body formant sweeping.
       5. 4 Modern & Realistic Tone Profiles:
          - 'solo': Concert Master Solo (Stradivarius Sweet & Expressive)
          - 'cinema' / 'warm': Romantic Cinema & Film Strings (Silky, Warm & Emotional Legato)
          - 'electric' / 'modern': Modern Electric / Crossover Violin (Punchy & Contemporary)
          - 'desi' / 'folk': Desi Classical Fiddle / Sarangi-Bela (Taraf Resonance & Microtonal)
       6. Natural Bow-Lift String Resonance Release (~0.24s decay tail).
    -------------------------------------------------------------------- */
    playViolinNote(freq, noteId) {
        this.init();
        if (this.activeNotes.has(noteId)) return;

        const now = this.ctx.currentTime;
        const voiceGain = this.ctx.createGain();
        voiceGain.gain.setValueAtTime(0.0001, now);

        const tone = this.violinTone || 'solo';
        const isCinema = (tone === 'cinema' || tone === 'warm');
        const isElectric = (tone === 'electric' || tone === 'modern');
        const isDesi = (tone === 'desi' || tone === 'folk');

        // Dynamic bow attack swell:
        // Cinema/Warm: 0.075s luscious romantic legato swell
        // Electric/Modern: 0.025s tight, punchy transient
        // Desi/Fiddle: 0.038s agile folk bow touch
        // Solo Concert: 0.045s natural Stradivarius horsehair grip
        const attackTime = isCinema ? 0.075 : (isElectric ? 0.025 : (isDesi ? 0.038 : 0.045));
        const targetVol = (isElectric ? 0.32 : (isCinema ? 0.29 : 0.30)) * this.bellowsPressure;
        voiceGain.gain.exponentialRampToValueAtTime(Math.max(0.001, targetVol), now + attackTime);

        // ---------------- 4-Stage Master Violin Body Formants ----------------
        // Formant 1: Air cavity (Helmholtz resonance A0) at 275 - 285 Hz
        const fAir = this.ctx.createBiquadFilter();
        fAir.type = 'peaking';
        fAir.frequency.setValueAtTime(280, now);
        fAir.Q.setValueAtTime(3.2, now);
        fAir.gain.setValueAtTime(isCinema ? 5.5 : 4.5, now);

        // Formant 2: Main Wood top plate resonance (B1 Corpus) at 470 - 520 Hz
        const fWood = this.ctx.createBiquadFilter();
        fWood.type = 'peaking';
        const woodFreq = isDesi ? 520 : (isCinema ? 465 : 485);
        fWood.frequency.setValueAtTime(woodFreq, now);
        fWood.Q.setValueAtTime(2.6, now);
        fWood.gain.setValueAtTime(6.5, now);

        // Formant 3: Back plate & Rib cavity projection formant at 1120 Hz
        const fBack = this.ctx.createBiquadFilter();
        fBack.type = 'peaking';
        fBack.frequency.setValueAtTime(1120, now);
        fBack.Q.setValueAtTime(2.2, now);
        fBack.gain.setValueAtTime(isElectric ? 4.5 : 3.8, now);

        // Formant 4: Bridge Hill ("Singer's Formant of the Violin") at 2600 - 3400 Hz
        const fBridge = this.ctx.createBiquadFilter();
        fBridge.type = 'peaking';
        const bridgeFreq = isElectric ? 3400 : (isDesi ? 3100 : (isCinema ? 2550 : 2800));
        fBridge.frequency.setValueAtTime(bridgeFreq, now);
        fBridge.Q.setValueAtTime(2.5, now);
        const bridgeGain = isElectric ? 8.5 : (isDesi ? 7.8 : (isCinema ? 4.8 : 6.8));
        fBridge.gain.setValueAtTime(bridgeGain, now);

        // High-frequency acoustic wood damping filter
        const fLowpass = this.ctx.createBiquadFilter();
        fLowpass.type = 'lowpass';
        const lpCut = isElectric ? 9500 : (isDesi ? 7800 : (isCinema ? 5600 : 6800));
        fLowpass.frequency.setValueAtTime(lpCut, now);
        fLowpass.Q.setValueAtTime(1.15, now);

        // ---------------- Expressive Human Vibrato & Tremolo ----------------
        const vibRate = isDesi ? 6.2 : (isCinema ? 5.4 : 5.8);
        const vibratoLfo = this.ctx.createOscillator();
        vibratoLfo.frequency.setValueAtTime(vibRate, now);

        const vibratoGain = this.ctx.createGain();
        vibratoGain.gain.setValueAtTime(0.0, now);
        const vibDelay = isCinema ? 0.08 : 0.11;
        const vibDepth = Math.max(2.2, freq * (isCinema ? 0.019 : 0.016));
        vibratoGain.gain.setValueAtTime(0.0, now + vibDelay);
        vibratoGain.gain.linearRampToValueAtTime(vibDepth, now + vibDelay + 0.22);
        vibratoLfo.connect(vibratoGain);

        // Coupled acoustic amplitude tremolo
        const tremoloGain = this.ctx.createGain();
        tremoloGain.gain.setValueAtTime(0.0, now);
        tremoloGain.gain.setValueAtTime(0.0, now + vibDelay);
        tremoloGain.gain.linearRampToValueAtTime(0.065, now + vibDelay + 0.22);
        vibratoLfo.connect(tremoloGain);
        tremoloGain.connect(voiceGain.gain);

        const oscs = [];

        // ---------------- Bowed String Multi-Harmonic Oscillation ----------------
        // 1. Primary Bowed Sawtooth (Fundamental String Core)
        const oscBowed = this.ctx.createOscillator();
        oscBowed.type = 'sawtooth';
        oscBowed.frequency.setValueAtTime(freq, now);
        vibratoGain.connect(oscBowed.frequency);
        oscs.push(oscBowed);

        // 2. Wound-String Torsional Mode (Detuned Course & Sympathetic Open String Ring)
        const oscTorsion = this.ctx.createOscillator();
        oscTorsion.type = 'sawtooth';
        oscTorsion.frequency.setValueAtTime(freq, now);
        oscTorsion.detune.setValueAtTime(isDesi ? 3.5 : 2.1, now);
        vibratoGain.connect(oscTorsion.frequency);
        const torsionGain = this.ctx.createGain();
        torsionGain.gain.setValueAtTime(isCinema ? 0.48 : 0.40, now);
        oscTorsion.connect(torsionGain);
        oscs.push(oscTorsion);

        // 3. Soundboard Woody Core (Triangle Wave Fundamental)
        const oscWood = this.ctx.createOscillator();
        oscWood.type = 'triangle';
        oscWood.frequency.setValueAtTime(freq, now);
        vibratoGain.connect(oscWood.frequency);
        const woodGain = this.ctx.createGain();
        woodGain.gain.setValueAtTime(isCinema ? 0.35 : 0.26, now);
        oscWood.connect(woodGain);
        oscs.push(oscWood);

        // 4. Harmonic Overtone Shimmer (Octave Harmonic)
        const oscHarm2 = this.ctx.createOscillator();
        oscHarm2.type = 'sine';
        oscHarm2.frequency.setValueAtTime(freq * 2, now);
        oscHarm2.detune.setValueAtTime(-1.5, now);
        vibratoGain.connect(oscHarm2.frequency);
        const harm2Gain = this.ctx.createGain();
        harm2Gain.gain.setValueAtTime(isElectric ? 0.22 : 0.16, now);
        oscHarm2.connect(harm2Gain);
        oscs.push(oscHarm2);

        // 5. Special Layer: Modern Electric Saturation or Desi Taraf Drone
        if (isElectric) {
            const oscHarm3 = this.ctx.createOscillator();
            oscHarm3.type = 'sawtooth';
            oscHarm3.frequency.setValueAtTime(freq * 3, now);
            vibratoGain.connect(oscHarm3.frequency);
            const harm3Gain = this.ctx.createGain();
            harm3Gain.gain.setValueAtTime(0.09, now);
            oscHarm3.connect(harm3Gain);
            harm3Gain.connect(fAir);
            oscs.push(oscHarm3);
        } else if (isDesi) {
            const oscTaraf = this.ctx.createOscillator();
            oscTaraf.type = 'sine';
            oscTaraf.frequency.setValueAtTime(freq / 2, now);
            vibratoGain.connect(oscTaraf.frequency);
            const tarafGain = this.ctx.createGain();
            tarafGain.gain.setValueAtTime(0.14, now);
            oscTaraf.connect(tarafGain);
            tarafGain.connect(fAir);
            oscs.push(oscTaraf);
        }

        // ---------------- Tactile Bow Rosin & Horsehair Friction Dynamics ----------------
        // A. Dynamic Bow Attack Bite (35ms transient noise burst)
        let bowBiteNode = null;
        try {
            const biteBufSize = Math.floor(this.ctx.sampleRate * 0.08);
            const biteBuf = this.ctx.createBuffer(1, biteBufSize, this.ctx.sampleRate);
            const biteData = biteBuf.getChannelData(0);
            for (let i = 0; i < biteBufSize; i++) {
                biteData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.012));
            }
            bowBiteNode = this.ctx.createBufferSource();
            bowBiteNode.buffer = biteBuf;

            const biteFilter = this.ctx.createBiquadFilter();
            biteFilter.type = 'bandpass';
            biteFilter.frequency.setValueAtTime(Math.min(3500, Math.max(1600, freq * 2.5)), now);
            biteFilter.Q.setValueAtTime(2.8, now);

            const biteGain = this.ctx.createGain();
            const biteVol = (isCinema ? 0.035 : (isElectric ? 0.075 : 0.055)) * this.bellowsPressure;
            biteGain.gain.setValueAtTime(biteVol, now);
            biteGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.045);

            bowBiteNode.connect(biteFilter);
            biteFilter.connect(biteGain);
            biteGain.connect(fAir);
            bowBiteNode.start(now);
        } catch (e) {
            console.warn("Violin bow bite error", e);
        }

        // B. Continuous Horsehair Rosin Texture (Continuous Organic Bow Texture)
        let bowContinuousNode = null;
        let bowContinuousGain = null;
        try {
            const contBufSize = Math.floor(this.ctx.sampleRate * 2.0);
            const contBuf = this.ctx.createBuffer(1, contBufSize, this.ctx.sampleRate);
            const contData = contBuf.getChannelData(0);
            let b0 = 0, b1 = 0;
            for (let i = 0; i < contBufSize; i++) {
                const white = Math.random() * 2 - 1;
                b0 = 0.98 * b0 + white * 0.15;
                b1 = 0.92 * b1 + white * 0.25;
                contData[i] = (b0 + b1 + white * 0.1) * 0.12;
            }
            bowContinuousNode = this.ctx.createBufferSource();
            bowContinuousNode.buffer = contBuf;
            bowContinuousNode.loop = true;

            const contFilter = this.ctx.createBiquadFilter();
            contFilter.type = 'bandpass';
            contFilter.frequency.setValueAtTime(Math.min(4200, Math.max(1800, freq * 3.0)), now);
            contFilter.Q.setValueAtTime(2.2, now);

            bowContinuousGain = this.ctx.createGain();
            const contVol = (isCinema ? 0.015 : (isElectric ? 0.022 : 0.020)) * this.bellowsPressure;
            bowContinuousGain.gain.setValueAtTime(0.0001, now);
            bowContinuousGain.gain.linearRampToValueAtTime(contVol, now + attackTime);

            bowContinuousNode.connect(contFilter);
            contFilter.connect(bowContinuousGain);
            bowContinuousGain.connect(fAir);
            bowContinuousNode.start(now);
        } catch (e) {
            console.warn("Violin continuous rosin error", e);
        }

        // Connect acoustic chain:
        // Sources -> fAir -> fWood -> fBack -> fBridge -> fLowpass -> voiceGain -> harmoniumGain
        oscBowed.connect(fAir);
        torsionGain.connect(fAir);
        woodGain.connect(fAir);
        harm2Gain.connect(fAir);

        fAir.connect(fWood);
        fWood.connect(fBack);
        fBack.connect(fBridge);
        fBridge.connect(fLowpass);
        fLowpass.connect(voiceGain);
        voiceGain.connect(this.harmoniumGain);

        vibratoLfo.start(now);
        oscs.forEach(o => o.start(now));

        this.activeNotes.set(noteId, {
            instrument: 'violin',
            oscs,
            vibratoLfo,
            bowBiteNode,
            bowContinuousNode,
            bowContinuousGain,
            gainNode: voiceGain,
            filter: fLowpass
        });
    }

    stopViolinNote(noteId) {
        if (!this.activeNotes.has(noteId)) return;
        const noteObj = this.activeNotes.get(noteId);
        const { oscs, vibratoLfo, bowBiteNode, bowContinuousNode, bowContinuousGain, gainNode } = noteObj;
        const now = this.ctx.currentTime;

        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(gainNode.gain.value, now);
        // Realistic string ring-out and bow-lift release (~0.24s natural decay tail)
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);

        if (bowContinuousGain) {
            bowContinuousGain.gain.cancelScheduledValues(now);
            bowContinuousGain.gain.setValueAtTime(bowContinuousGain.gain.value, now);
            bowContinuousGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
        }

        setTimeout(() => {
            oscs.forEach(osc => {
                try { osc.stop(); osc.disconnect(); } catch (e) {}
            });
            if (vibratoLfo) {
                try { vibratoLfo.stop(); vibratoLfo.disconnect(); } catch (e) {}
            }
            if (bowBiteNode) {
                try { bowBiteNode.stop(); bowBiteNode.disconnect(); } catch (e) {}
            }
            if (bowContinuousNode) {
                try { bowContinuousNode.stop(); bowContinuousNode.disconnect(); } catch (e) {}
            }
            gainNode.disconnect();
        }, 280);

        this.activeNotes.delete(noteId);
    }

    /* ---------------- ACOUSTIC & CLASSICAL GUITAR ---------------- */
    playGuitarNote(freq, noteId) {
        this.init();
        if (this.activeNotes.has(noteId)) {
            this.stopGuitarNote(noteId);
        }

        const now = this.ctx.currentTime;
        const voiceGain = this.ctx.createGain();
        voiceGain.gain.setValueAtTime(0.0001, now);

        // Immediate pluck strike attack (<5ms)
        const masterVol = 0.35 * this.bellowsPressure;
        voiceGain.gain.setValueAtTime(masterVol, now + 0.003);

        // Guitar Body Wooden Resonator (Spruce top plate + soundhole air cavity)
        const bodyCavity = this.ctx.createBiquadFilter();
        bodyCavity.type = 'peaking';
        bodyCavity.frequency.setValueAtTime(115, now);
        bodyCavity.Q.setValueAtTime(3.5, now);
        bodyCavity.gain.setValueAtTime(4.0, now);

        const bodyWood = this.ctx.createBiquadFilter();
        bodyWood.type = 'peaking';
        bodyWood.frequency.setValueAtTime(225, now);
        bodyWood.Q.setValueAtTime(3.0, now);
        bodyWood.gain.setValueAtTime(5.0, now);

        const bodyTone = this.ctx.createBiquadFilter();
        bodyTone.type = 'lowpass';
        const toneCutoff = this.guitarTone === 'steel' ? 7000 : (this.guitarTone === 'twelve' ? 9500 : 4800);
        bodyTone.frequency.setValueAtTime(toneCutoff, now);
        bodyTone.Q.setValueAtTime(1.1, now);

        const oscs = [];

        // 1. Pluck Transient / Pick Strike Snap
        let pickNoise = null;
        try {
            const pickBufSize = Math.floor(this.ctx.sampleRate * 0.035);
            const pickBuf = this.ctx.createBuffer(1, pickBufSize, this.ctx.sampleRate);
            const pickData = pickBuf.getChannelData(0);
            for (let i = 0; i < pickBufSize; i++) {
                pickData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.005));
            }
            pickNoise = this.ctx.createBufferSource();
            pickNoise.buffer = pickBuf;

            const pickFilter = this.ctx.createBiquadFilter();
            pickFilter.type = 'highpass';
            pickFilter.frequency.setValueAtTime(this.guitarTone === 'nylon' ? 1200 : 2500, now);

            const pickGain = this.ctx.createGain();
            pickGain.gain.setValueAtTime(0.12, now);
            pickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

            pickNoise.connect(pickFilter);
            pickFilter.connect(pickGain);
            pickGain.connect(voiceGain);
            pickNoise.start(now);
        } catch (e) {
            console.warn("Guitar pick noise error", e);
        }

        // 2. Frequency-Dependent Decaying Harmonics:
        // Fundamental (Sustains longest ~2.8s)
        const osc1 = this.ctx.createOscillator();
        osc1.type = this.guitarTone === 'nylon' ? 'sine' : 'triangle';
        osc1.frequency.setValueAtTime(freq, now);
        const g1 = this.ctx.createGain();
        g1.gain.setValueAtTime(0.65, now);
        g1.gain.exponentialRampToValueAtTime(0.0001, now + 2.8);
        osc1.connect(g1);
        g1.connect(bodyCavity);
        oscs.push(osc1);

        // 2nd Harmonic (Octave overtone, decays ~1.9s)
        const osc2 = this.ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(freq * 2, now);
        const g2 = this.ctx.createGain();
        g2.gain.setValueAtTime(0.32, now);
        g2.gain.exponentialRampToValueAtTime(0.0001, now + 1.9);
        osc2.connect(g2);
        g2.connect(bodyCavity);
        oscs.push(osc2);

        // 3rd Harmonic (Fifth overtone, decays ~1.3s)
        const osc3 = this.ctx.createOscillator();
        osc3.type = 'sine';
        osc3.frequency.setValueAtTime(freq * 3, now);
        const g3 = this.ctx.createGain();
        g3.gain.setValueAtTime(0.16, now);
        g3.gain.exponentialRampToValueAtTime(0.0001, now + 1.3);
        osc3.connect(g3);
        g3.connect(bodyCavity);
        oscs.push(osc3);

        // 4th Harmonic (Crisp metallic overtone, decays ~0.8s)
        const osc4 = this.ctx.createOscillator();
        osc4.type = 'sine';
        osc4.frequency.setValueAtTime(freq * 4, now);
        const g4 = this.ctx.createGain();
        g4.gain.setValueAtTime(this.guitarTone === 'steel' ? 0.12 : 0.05, now);
        g4.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
        osc4.connect(g4);
        g4.connect(bodyCavity);
        oscs.push(osc4);

        // 12-String Shimmer / Chorus mode
        if (this.guitarTone === 'twelve') {
            const osc12 = this.ctx.createOscillator();
            osc12.type = 'triangle';
            osc12.frequency.setValueAtTime(freq * 2, now);
            osc12.detune.setValueAtTime(8, now);
            const g12 = this.ctx.createGain();
            g12.gain.setValueAtTime(0.25, now);
            g12.gain.exponentialRampToValueAtTime(0.0001, now + 1.6);
            osc12.connect(g12);
            g12.connect(bodyCavity);
            oscs.push(osc12);
        }

        bodyCavity.connect(bodyWood);
        bodyWood.connect(bodyTone);
        bodyTone.connect(voiceGain);
        voiceGain.connect(this.harmoniumGain);

        oscs.forEach(o => o.start(now));

        this.activeNotes.set(noteId, {
            instrument: 'guitar',
            oscs,
            pickNoise,
            gainNode: voiceGain,
            filter: bodyTone
        });
    }

    stopGuitarNote(noteId) {
        if (!this.activeNotes.has(noteId)) return;
        const noteObj = this.activeNotes.get(noteId);
        const { oscs, pickNoise, gainNode } = noteObj;
        const now = this.ctx.currentTime;

        // Fret damping when finger leaves string (~0.12s)
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(gainNode.gain.value, now);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

        setTimeout(() => {
            oscs.forEach(osc => {
                try { osc.stop(); osc.disconnect(); } catch (e) {}
            });
            if (pickNoise) {
                try { pickNoise.stop(); pickNoise.disconnect(); } catch (e) {}
            }
            gainNode.disconnect();
        }, 160);

        this.activeNotes.delete(noteId);
    }


    /* ---------------- CONCERT GRAND & VINTAGE PIANO ----------------
       Physical acoustic model of acoustic and electric piano:
       - Multi-unison strings with sub-cent micro-detuning
       - Felt hammer attack transient (<3ms knock)
       - Frequency-dependent multi-harmonic decay
       - Cast iron frame & wooden soundboard acoustic resonance
       - Tone profiles: 'grand' (Steinway Concert Grand), 'upright' (Studio Felt), 'rhodes' (Electric Tine)
    ----------------------------------------------------------------- */
    playPianoNote(freq, noteId) {
        this.init();
        if (this.activeNotes.has(noteId)) {
            this.stopPianoNote(noteId);
        }
        const now = this.ctx.currentTime;
        const voiceGain = this.ctx.createGain();
        voiceGain.gain.setValueAtTime(0.0001, now);

        const tone = this.pianoTone || 'grand';
        const touch = this.bellowsPressure; // Touch velocity
        const targetVol = (tone === 'rhodes' ? 0.32 : 0.35) * touch;
        voiceGain.gain.setValueAtTime(0.001, now);
        voiceGain.gain.linearRampToValueAtTime(targetVol, now + 0.003);

        // Soundboard & body acoustics
        const fSoundboard = this.ctx.createBiquadFilter();
        fSoundboard.type = 'lowshelf';
        fSoundboard.frequency.setValueAtTime(220, now);
        fSoundboard.gain.setValueAtTime(tone === 'upright' ? 4.5 : 2.5, now);

        const fWood = this.ctx.createBiquadFilter();
        fWood.type = 'peaking';
        fWood.frequency.setValueAtTime(750, now);
        fWood.Q.setValueAtTime(1.8, now);
        fWood.gain.setValueAtTime(2.0, now);

        const fHigh = this.ctx.createBiquadFilter();
        fHigh.type = 'lowpass';
        fHigh.frequency.setValueAtTime(tone === 'grand' ? 8800 : (tone === 'rhodes' ? 6200 : 5400), now);
        fHigh.Q.setValueAtTime(1.0, now);

        // 1. Felt Hammer Knock
        let hammerNoise = null;
        try {
            const hBufSize = Math.floor(this.ctx.sampleRate * 0.025);
            const hBuf = this.ctx.createBuffer(1, hBufSize, this.ctx.sampleRate);
            const hData = hBuf.getChannelData(0);
            for (let i = 0; i < hBufSize; i++) {
                hData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.0035));
            }
            hammerNoise = this.ctx.createBufferSource();
            hammerNoise.buffer = hBuf;

            const hFilter = this.ctx.createBiquadFilter();
            hFilter.type = 'bandpass';
            hFilter.frequency.setValueAtTime(tone === 'rhodes' ? 1400 : 2400, now);
            hFilter.Q.setValueAtTime(2.5, now);

            const hGain = this.ctx.createGain();
            hGain.gain.setValueAtTime(0.08 * touch, now);
            hGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.018);

            hammerNoise.connect(hFilter);
            hFilter.connect(hGain);
            hGain.connect(fSoundboard);
            hammerNoise.start(now);
        } catch(e) {}

        const oscs = [];

        // 2. Multi-string Unisons (Trichord with micro-detuning +0.8 cents, -0.8 cents)
        const decayTime = tone === 'rhodes' ? 3.8 : (tone === 'upright' ? 2.8 : 4.2);

        // String 1 (Center)
        const osc1 = this.ctx.createOscillator();
        osc1.type = tone === 'rhodes' ? 'sine' : 'triangle';
        osc1.frequency.setValueAtTime(freq, now);
        const g1 = this.ctx.createGain();
        g1.gain.setValueAtTime(0.70, now);
        g1.gain.exponentialRampToValueAtTime(0.0001, now + decayTime);
        osc1.connect(g1);
        g1.connect(fSoundboard);
        oscs.push(osc1);

        // String 2 (Slightly sharp +0.9 cents for rich phase bloom)
        const osc2 = this.ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(freq, now);
        osc2.detune.setValueAtTime(tone === 'upright' ? 2.2 : 0.9, now);
        const g2 = this.ctx.createGain();
        g2.gain.setValueAtTime(0.45, now);
        g2.gain.exponentialRampToValueAtTime(0.0001, now + decayTime * 0.85);
        osc2.connect(g2);
        g2.connect(fSoundboard);
        oscs.push(osc2);

        // String 3 (Slightly flat -0.9 cents)
        const osc3 = this.ctx.createOscillator();
        osc3.type = 'sine';
        osc3.frequency.setValueAtTime(freq, now);
        osc3.detune.setValueAtTime(tone === 'upright' ? -2.2 : -0.9, now);
        const g3 = this.ctx.createGain();
        g3.gain.setValueAtTime(0.40, now);
        g3.gain.exponentialRampToValueAtTime(0.0001, now + decayTime * 0.80);
        osc3.connect(g3);
        g3.connect(fSoundboard);
        oscs.push(osc3);

        // 3. Higher Harmonics with Faster Frequency-Dependent Decay
        const oscH2 = this.ctx.createOscillator();
        oscH2.type = 'sine';
        oscH2.frequency.setValueAtTime(freq * 2, now);
        const gH2 = this.ctx.createGain();
        gH2.gain.setValueAtTime(tone === 'rhodes' ? 0.35 : 0.28, now);
        gH2.gain.exponentialRampToValueAtTime(0.0001, now + decayTime * 0.60);
        oscH2.connect(gH2);
        gH2.connect(fSoundboard);
        oscs.push(oscH2);

        if (tone === 'rhodes') {
            const oscTine = this.ctx.createOscillator();
            oscTine.type = 'sine';
            oscTine.frequency.setValueAtTime(freq * 3.8, now); // Rhodes bell chime
            const gTine = this.ctx.createGain();
            gTine.gain.setValueAtTime(0.25, now);
            gTine.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
            oscTine.connect(gTine);
            gTine.connect(fSoundboard);
            oscs.push(oscTine);
        } else {
            const oscH3 = this.ctx.createOscillator();
            oscH3.type = 'sine';
            oscH3.frequency.setValueAtTime(freq * 3, now);
            const gH3 = this.ctx.createGain();
            gH3.gain.setValueAtTime(0.14, now);
            gH3.gain.exponentialRampToValueAtTime(0.0001, now + decayTime * 0.45);
            oscH3.connect(gH3);
            gH3.connect(fSoundboard);
            oscs.push(oscH3);
        }

        fSoundboard.connect(fWood);
        fWood.connect(fHigh);
        fHigh.connect(voiceGain);
        voiceGain.connect(this.harmoniumGain);

        oscs.forEach(o => o.start(now));

        this.activeNotes.set(noteId, {
            instrument: 'piano',
            oscs,
            hammerNoise,
            gainNode: voiceGain,
            filter: fHigh
        });
    }

    stopPianoNote(noteId) {
        if (!this.activeNotes.has(noteId)) return;
        const noteObj = this.activeNotes.get(noteId);
        const { oscs, hammerNoise, gainNode } = noteObj;
        const now = this.ctx.currentTime;

        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(gainNode.gain.value, now);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

        setTimeout(() => {
            oscs.forEach(osc => {
                try { osc.stop(); osc.disconnect(); } catch (e) {}
            });
            if (hammerNoise) {
                try { hammerNoise.stop(); hammerNoise.disconnect(); } catch (e) {}
            }
            gainNode.disconnect();
        }, 250);

        this.activeNotes.delete(noteId);
    }

    /* ---------------- CLASSICAL INDIAN SITAR ----------------
       Physical acoustic model of classical Indian Sitar:
       - Authentic Jawari (wide flat bone bridge buzz & harmonic shower)
       - Steel mizrab metallic pluck transient (<20ms click)
       - Taraf & Chikari sympathetic string shimmer
       - Tumba (gourd) and Tabli resonance
       - Tone profiles: 'gandhar' (Vilayat Khan style), 'kharaj' (Ravi Shankar style), 'darbari' (Alap)
    ---------------------------------------------------------- */
    playSitarNote(freq, noteId) {
        this.init();
        if (this.activeNotes.has(noteId)) {
            this.stopSitarNote(noteId);
        }
        const now = this.ctx.currentTime;
        const voiceGain = this.ctx.createGain();
        voiceGain.gain.setValueAtTime(0.0001, now);

        const tone = this.sitarTone || 'gandhar';
        const touch = this.bellowsPressure;
        const targetVol = 0.36 * touch;

        voiceGain.gain.setValueAtTime(0.001, now);
        voiceGain.gain.linearRampToValueAtTime(targetVol, now + 0.008);

        // Gourd resonator (Tumba)
        const fTumba = this.ctx.createBiquadFilter();
        fTumba.type = 'peaking';
        fTumba.frequency.setValueAtTime(tone === 'kharaj' ? 240 : 310, now);
        fTumba.Q.setValueAtTime(2.8, now);
        fTumba.gain.setValueAtTime(6.0, now);

        // Jawari dynamic bridge resonance (wide flat bridge buzz around 2.4 - 3.8 kHz)
        const fJawari = this.ctx.createBiquadFilter();
        fJawari.type = 'peaking';
        const jawariFreq = tone === 'kharaj' ? 2400 : (tone === 'darbari' ? 2900 : 3400);
        fJawari.frequency.setValueAtTime(jawariFreq, now);
        fJawari.Q.setValueAtTime(3.2, now);
        fJawari.gain.setValueAtTime(tone === 'gandhar' ? 12.0 : 9.0, now);
        fJawari.gain.exponentialRampToValueAtTime(tone === 'gandhar' ? 6.0 : 4.0, now + 0.35);

        // 1. Mizrab Metallic Pluck Transient
        let mizrabNoise = null;
        try {
            const mBufSize = Math.floor(this.ctx.sampleRate * 0.030);
            const mBuf = this.ctx.createBuffer(1, mBufSize, this.ctx.sampleRate);
            const mData = mBuf.getChannelData(0);
            for (let i = 0; i < mBufSize; i++) {
                mData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.004));
            }
            mizrabNoise = this.ctx.createBufferSource();
            mizrabNoise.buffer = mBuf;

            const mFilter = this.ctx.createBiquadFilter();
            mFilter.type = 'bandpass';
            mFilter.frequency.setValueAtTime(4200, now);
            mFilter.Q.setValueAtTime(3.5, now);

            const mGain = this.ctx.createGain();
            mGain.gain.setValueAtTime(0.12 * touch, now);
            mGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.022);

            mizrabNoise.connect(mFilter);
            mFilter.connect(mGain);
            mGain.connect(fTumba);
            mizrabNoise.start(now);
        } catch(e) {}

        const oscs = [];

        // 2. Main Playing String (Baj Tar - Sawtooth + Jawari Harmonic Shower)
        const decay = tone === 'darbari' ? 4.5 : 3.4;
        const oscBaj = this.ctx.createOscillator();
        oscBaj.type = 'sawtooth';
        oscBaj.frequency.setValueAtTime(freq, now);
        const gBaj = this.ctx.createGain();
        gBaj.gain.setValueAtTime(0.75, now);
        gBaj.gain.exponentialRampToValueAtTime(0.0001, now + decay);
        oscBaj.connect(gBaj);
        gBaj.connect(fTumba);
        oscs.push(oscBaj);

        // 3. Taraf Sympathetic String Shimmer (+3.8 cents detune)
        const oscTaraf = this.ctx.createOscillator();
        oscTaraf.type = 'sawtooth';
        oscTaraf.frequency.setValueAtTime(freq, now);
        oscTaraf.detune.setValueAtTime(3.8, now);
        const gTaraf = this.ctx.createGain();
        gTaraf.gain.setValueAtTime(0.40, now);
        gTaraf.gain.exponentialRampToValueAtTime(0.0001, now + decay * 1.1);
        oscTaraf.connect(gTaraf);
        gTaraf.connect(fTumba);
        oscs.push(oscTaraf);

        // 4. Octave Chikari Ring
        const oscChikari = this.ctx.createOscillator();
        oscChikari.type = 'sine';
        oscChikari.frequency.setValueAtTime(freq * 2, now);
        const gChikari = this.ctx.createGain();
        gChikari.gain.setValueAtTime(0.24, now);
        gChikari.gain.exponentialRampToValueAtTime(0.0001, now + decay * 0.7);
        oscChikari.connect(gChikari);
        gChikari.connect(fTumba);
        oscs.push(oscChikari);

        const fLowpass = this.ctx.createBiquadFilter();
        fLowpass.type = 'lowpass';
        fLowpass.frequency.setValueAtTime(7800, now);

        fTumba.connect(fJawari);
        fJawari.connect(fLowpass);
        fLowpass.connect(voiceGain);
        voiceGain.connect(this.harmoniumGain);

        oscs.forEach(o => o.start(now));

        this.activeNotes.set(noteId, {
            instrument: 'sitar',
            oscs,
            mizrabNoise,
            gainNode: voiceGain,
            filter: fLowpass
        });
    }

    stopSitarNote(noteId) {
        if (!this.activeNotes.has(noteId)) return;
        const noteObj = this.activeNotes.get(noteId);
        const { oscs, mizrabNoise, gainNode } = noteObj;
        const now = this.ctx.currentTime;

        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(gainNode.gain.value, now);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.30);

        setTimeout(() => {
            oscs.forEach(osc => {
                try { osc.stop(); osc.disconnect(); } catch (e) {}
            });
            if (mizrabNoise) {
                try { mizrabNoise.stop(); mizrabNoise.disconnect(); } catch (e) {}
            }
            gainNode.disconnect();
        }, 340);

        this.activeNotes.delete(noteId);
    }

    /* ---------------- KASHMIRI & PERSIAN SANTOOR ----------------
       Physical acoustic model of Kashmiri & Persian 100-string Santoor:
       - Walnut wood mezrab mallet tap transient
       - 4-string course acoustic shimmer with natural micro-beating
       - Walnut soundbox cavity resonance
       - Long sustained crystalline reverberation
       - Tone profiles: 'kashmiri' (Walnut mallet chime), 'persian' (Sharp metallic), 'ambient' (Celestial)
    -------------------------------------------------------------- */
    playSantoorNote(freq, noteId) {
        this.init();
        if (this.activeNotes.has(noteId)) {
            this.stopSantoorNote(noteId);
        }
        const now = this.ctx.currentTime;
        const voiceGain = this.ctx.createGain();
        voiceGain.gain.setValueAtTime(0.0001, now);

        const tone = this.santoorTone || 'kashmiri';
        const touch = this.bellowsPressure;
        const targetVol = 0.34 * touch;

        voiceGain.gain.setValueAtTime(0.001, now);
        voiceGain.gain.linearRampToValueAtTime(targetVol, now + 0.005);

        // Soundbox cavity
        const fBox = this.ctx.createBiquadFilter();
        fBox.type = 'peaking';
        fBox.frequency.setValueAtTime(420, now);
        fBox.Q.setValueAtTime(2.2, now);
        fBox.gain.setValueAtTime(4.0, now);

        const fChime = this.ctx.createBiquadFilter();
        fChime.type = 'peaking';
        fChime.frequency.setValueAtTime(2400, now);
        fChime.Q.setValueAtTime(2.5, now);
        fChime.gain.setValueAtTime(tone === 'persian' ? 6.5 : 5.0, now);

        // 1. Walnut Mezrab Mallet Tap
        let mezrabTap = null;
        try {
            const tBufSize = Math.floor(this.ctx.sampleRate * 0.020);
            const tBuf = this.ctx.createBuffer(1, tBufSize, this.ctx.sampleRate);
            const tData = tBuf.getChannelData(0);
            for (let i = 0; i < tBufSize; i++) {
                tData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.003));
            }
            mezrabTap = this.ctx.createBufferSource();
            mezrabTap.buffer = tBuf;

            const tFilter = this.ctx.createBiquadFilter();
            tFilter.type = 'bandpass';
            tFilter.frequency.setValueAtTime(2800, now);
            tFilter.Q.setValueAtTime(2.2, now);

            const tGain = this.ctx.createGain();
            tGain.gain.setValueAtTime(0.09 * touch, now);
            tGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.015);

            mezrabTap.connect(tFilter);
            tFilter.connect(tGain);
            tGain.connect(fBox);
            mezrabTap.start(now);
        } catch(e) {}

        const oscs = [];

        // 2. 4-String Course Shimmer
        const decay = tone === 'ambient' ? 4.8 : (tone === 'persian' ? 2.6 : 3.6);

        // Course String 1
        const osc1 = this.ctx.createOscillator();
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(freq, now);
        const g1 = this.ctx.createGain();
        g1.gain.setValueAtTime(0.65, now);
        g1.gain.exponentialRampToValueAtTime(0.0001, now + decay);
        osc1.connect(g1);
        g1.connect(fBox);
        oscs.push(osc1);

        // Course String 2 (+1.4 cents shimmer)
        const osc2 = this.ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(freq, now);
        osc2.detune.setValueAtTime(1.4, now);
        const g2 = this.ctx.createGain();
        g2.gain.setValueAtTime(0.45, now);
        g2.gain.exponentialRampToValueAtTime(0.0001, now + decay * 0.95);
        osc2.connect(g2);
        g2.connect(fBox);
        oscs.push(osc2);

        // Course String 3 (-1.4 cents shimmer)
        const osc3 = this.ctx.createOscillator();
        osc3.type = 'sine';
        osc3.frequency.setValueAtTime(freq, now);
        osc3.detune.setValueAtTime(-1.4, now);
        const g3 = this.ctx.createGain();
        g3.gain.setValueAtTime(0.40, now);
        g3.gain.exponentialRampToValueAtTime(0.0001, now + decay * 0.90);
        osc3.connect(g3);
        g3.connect(fBox);
        oscs.push(osc3);

        // Octave metallic chime
        const oscChime = this.ctx.createOscillator();
        oscChime.type = 'sine';
        oscChime.frequency.setValueAtTime(freq * 2, now);
        const gChime = this.ctx.createGain();
        gChime.gain.setValueAtTime(0.20, now);
        gChime.gain.exponentialRampToValueAtTime(0.0001, now + decay * 0.65);
        oscChime.connect(gChime);
        gChime.connect(fBox);
        oscs.push(oscChime);

        const fLp = this.ctx.createBiquadFilter();
        fLp.type = 'lowpass';
        fLp.frequency.setValueAtTime(8200, now);

        fBox.connect(fChime);
        fChime.connect(fLp);
        fLp.connect(voiceGain);
        voiceGain.connect(this.harmoniumGain);

        oscs.forEach(o => o.start(now));

        this.activeNotes.set(noteId, {
            instrument: 'santoor',
            oscs,
            mezrabTap,
            gainNode: voiceGain,
            filter: fLp
        });
    }

    stopSantoorNote(noteId) {
        if (!this.activeNotes.has(noteId)) return;
        const noteObj = this.activeNotes.get(noteId);
        const { oscs, mezrabTap, gainNode } = noteObj;
        const now = this.ctx.currentTime;

        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(gainNode.gain.value, now);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

        setTimeout(() => {
            oscs.forEach(osc => {
                try { osc.stop(); osc.disconnect(); } catch (e) {}
            });
            if (mezrabTap) {
                try { mezrabTap.stop(); mezrabTap.disconnect(); } catch (e) {}
            }
            gainNode.disconnect();
        }, 390);

        this.activeNotes.delete(noteId);
    }

    /* ---------------- STUDIO JAZZ & BRASS SAXOPHONE ----------------
       Physical acoustic model of Alto, Tenor, and Soprano Saxophone:
       - Cane reed vibration & breath turbulence noise
       - Conical brass bore multi-harmonics
       - Warm throat & brass flare acoustic formants
       - Expressive delayed-onset human breath vibrato & tremolo
       - Tone profiles: 'alto' (Smooth Jazz), 'tenor' (Smoky Late-Night), 'soprano' (Bright Lead)
    ----------------------------------------------------------------- */
    playSaxNote(freq, noteId) {
        this.init();
        if (this.activeNotes.has(noteId)) return;

        const now = this.ctx.currentTime;
        const voiceGain = this.ctx.createGain();
        voiceGain.gain.setValueAtTime(0.0001, now);

        const tone = this.saxTone || 'alto';
        const touch = this.bellowsPressure;
        const targetVol = 0.32 * touch;

        // Breath swell attack (0.040s)
        voiceGain.gain.setValueAtTime(0.001, now);
        voiceGain.gain.exponentialRampToValueAtTime(targetVol, now + 0.040);

        // Conical brass bore formants
        const fThroat = this.ctx.createBiquadFilter();
        fThroat.type = 'peaking';
        fThroat.frequency.setValueAtTime(tone === 'tenor' ? 680 : 880, now);
        fThroat.Q.setValueAtTime(2.2, now);
        fThroat.gain.setValueAtTime(5.5, now);

        const fFlare = this.ctx.createBiquadFilter();
        fFlare.type = 'peaking';
        fFlare.frequency.setValueAtTime(tone === 'soprano' ? 2800 : 2200, now);
        fFlare.Q.setValueAtTime(2.5, now);
        fFlare.gain.setValueAtTime(tone === 'soprano' ? 7.0 : 4.5, now);

        // Vibrato LFO (5.4 Hz delayed onset)
        const vibratoLfo = this.ctx.createOscillator();
        vibratoLfo.frequency.setValueAtTime(5.4, now);

        const vibratoGain = this.ctx.createGain();
        vibratoGain.gain.setValueAtTime(0.0, now);
        const vibDepth = Math.max(2.0, freq * 0.015);
        vibratoGain.gain.setValueAtTime(0.0, now + 0.09);
        vibratoGain.gain.linearRampToValueAtTime(vibDepth, now + 0.26);
        vibratoLfo.connect(vibratoGain);

        // Breath tremolo
        const tremoloGain = this.ctx.createGain();
        tremoloGain.gain.setValueAtTime(0.0, now);
        tremoloGain.gain.setValueAtTime(0.0, now + 0.09);
        tremoloGain.gain.linearRampToValueAtTime(0.07, now + 0.26);
        vibratoLfo.connect(tremoloGain);
        tremoloGain.connect(voiceGain.gain);

        const oscs = [];

        // Primary reed wave (Sawtooth fundamental)
        const oscReed = this.ctx.createOscillator();
        oscReed.type = 'sawtooth';
        oscReed.frequency.setValueAtTime(freq, now);
        vibratoGain.connect(oscReed.frequency);
        oscs.push(oscReed);

        // Second harmonic
        const osc2 = this.ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(freq * 2, now);
        vibratoGain.connect(osc2.frequency);
        const g2 = this.ctx.createGain();
        g2.gain.setValueAtTime(0.35, now);
        osc2.connect(g2);
        oscs.push(osc2);

        // Third harmonic
        const osc3 = this.ctx.createOscillator();
        osc3.type = 'triangle';
        osc3.frequency.setValueAtTime(freq * 3, now);
        vibratoGain.connect(osc3.frequency);
        const g3 = this.ctx.createGain();
        g3.gain.setValueAtTime(0.18, now);
        osc3.connect(g3);
        oscs.push(osc3);

        // Breath turbulence noise
        let saxBreathNode = null;
        try {
            const bBufSize = Math.floor(this.ctx.sampleRate * 1.5);
            const bBuf = this.ctx.createBuffer(1, bBufSize, this.ctx.sampleRate);
            const bData = bBuf.getChannelData(0);
            for (let i = 0; i < bBufSize; i++) {
                bData[i] = (Math.random() * 2 - 1) * 0.1;
            }
            saxBreathNode = this.ctx.createBufferSource();
            saxBreathNode.buffer = bBuf;
            saxBreathNode.loop = true;

            const bFilter = this.ctx.createBiquadFilter();
            bFilter.type = 'bandpass';
            bFilter.frequency.setValueAtTime(Math.min(3200, freq * 2.8), now);
            bFilter.Q.setValueAtTime(3.0, now);

            const bGain = this.ctx.createGain();
            bGain.gain.setValueAtTime(0.025 * touch, now);

            saxBreathNode.connect(bFilter);
            bFilter.connect(bGain);
            bGain.connect(fThroat);
            saxBreathNode.start(now);
        } catch(e) {}

        const fLp = this.ctx.createBiquadFilter();
        fLp.type = 'lowpass';
        fLp.frequency.setValueAtTime(tone === 'soprano' ? 7200 : 5400, now);
        fLp.Q.setValueAtTime(1.2, now);

        oscReed.connect(fThroat);
        g2.connect(fThroat);
        g3.connect(fThroat);

        fThroat.connect(fFlare);
        fFlare.connect(fLp);
        fLp.connect(voiceGain);
        voiceGain.connect(this.harmoniumGain);

        vibratoLfo.start(now);
        oscs.forEach(o => o.start(now));

        this.activeNotes.set(noteId, {
            instrument: 'sax',
            oscs,
            vibratoLfo,
            saxBreathNode,
            gainNode: voiceGain,
            filter: fLp
        });
    }

    stopSaxNote(noteId) {
        if (!this.activeNotes.has(noteId)) return;
        const noteObj = this.activeNotes.get(noteId);
        const { oscs, vibratoLfo, saxBreathNode, gainNode } = noteObj;
        const now = this.ctx.currentTime;

        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(gainNode.gain.value, now);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

        setTimeout(() => {
            oscs.forEach(osc => {
                try { osc.stop(); osc.disconnect(); } catch (e) {}
            });
            if (vibratoLfo) {
                try { vibratoLfo.stop(); vibratoLfo.disconnect(); } catch (e) {}
            }
            if (saxBreathNode) {
                try { saxBreathNode.stop(); saxBreathNode.disconnect(); } catch (e) {}
            }
            gainNode.disconnect();
        }, 220);

        this.activeNotes.delete(noteId);
    }


    /* ---------------- STOP DISPATCHERS ---------------- */
    stopHarmoniumNote(noteId) {
        if (!this.activeNotes.has(noteId)) return;
        const noteObj = this.activeNotes.get(noteId);
        if (!noteObj) return;

        if (noteObj.instrument === 'flute' || noteObj.isFlute) {
            this.stopFluteNote(noteId);
        } else if (noteObj.instrument === 'violin') {
            this.stopViolinNote(noteId);
        } else if (noteObj.instrument === 'guitar') {
            this.stopGuitarNote(noteId);
        } else if (noteObj.instrument === 'piano') {
            this.stopPianoNote(noteId);
        } else if (noteObj.instrument === 'sitar') {
            this.stopSitarNote(noteId);
        } else if (noteObj.instrument === 'santoor') {
            this.stopSantoorNote(noteId);
        } else if (noteObj.instrument === 'sax') {
            this.stopSaxNote(noteId);
        } else {
            this.stopHarmoniumVoice(noteId);
        }
    }

    stopAllHarmoniumNotes() {
        for (const [noteId, noteObj] of Array.from(this.activeNotes.entries())) {
            if (noteObj.instrument === 'flute' || noteObj.isFlute) {
                this.stopFluteNote(noteId);
            } else if (noteObj.instrument === 'violin') {
                this.stopViolinNote(noteId);
            } else if (noteObj.instrument === 'guitar') {
                this.stopGuitarNote(noteId);
            } else if (noteObj.instrument === 'piano') {
                this.stopPianoNote(noteId);
            } else if (noteObj.instrument === 'sitar') {
                this.stopSitarNote(noteId);
            } else if (noteObj.instrument === 'santoor') {
                this.stopSantoorNote(noteId);
            } else if (noteObj.instrument === 'sax') {
                this.stopSaxNote(noteId);
            } else {
                this.stopHarmoniumVoice(noteId);
            }
        }
    }

    // Drone / Sur (Continuous background note e.g. Sa or Pa)
    toggleDrone(freq, droneId) {
        this.init();
        if (this.activeDrone && this.activeDrone.id === droneId) {
            this.stopDrone();
            return false;
        }

        this.stopDrone();

        const now = this.ctx.currentTime;
        const droneGain = this.ctx.createGain();
        droneGain.gain.setValueAtTime(0.001, now);
        droneGain.gain.exponentialRampToValueAtTime(0.2, now + 0.3);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1800, now);

        const osc1 = this.ctx.createOscillator();
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(freq, now);

        const osc2 = this.ctx.createOscillator();
        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(freq, now);
        osc2.detune.setValueAtTime(5, now);

        const oscSub = this.ctx.createOscillator();
        oscSub.type = 'triangle';
        oscSub.frequency.setValueAtTime(freq / 2, now);

        osc1.connect(filter);
        osc2.connect(filter);
        oscSub.connect(filter);
        filter.connect(droneGain);
        droneGain.connect(this.harmoniumGain);

        osc1.start(now);
        osc2.start(now);
        oscSub.start(now);

        this.activeDrone = {
            id: droneId,
            oscs: [osc1, osc2, oscSub],
            gain: droneGain
        };
        return true;
    }

    stopDrone() {
        if (!this.activeDrone) return;
        const now = this.ctx.currentTime;
        const { oscs, gain } = this.activeDrone;
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
        setTimeout(() => {
            oscs.forEach(o => {
                try { o.stop(); o.disconnect(); } catch (e) {}
            });
            gain.disconnect();
        }, 350);
        this.activeDrone = null;
    }

    /* ===================================================
       DRUM & TABLA SYNTHESIS
       Synthesizes Kick, Snare, Hi-Hats, Toms, Crash,
       plus Classical Tabla sounds (Dha, Ge, Na, Tin)!
    =================================================== */

    playDrum(type) {
        this.init();
        const now = this.ctx.currentTime;

        switch (type) {
            case 'kick':
                this.soundKick(now);
                break;
            case 'snare':
                this.soundSnare(now);
                break;
            case 'hihat-closed':
                this.soundHiHat(now, false);
                break;
            case 'hihat-open':
                this.soundHiHat(now, true);
                break;
            case 'tom-high':
                this.soundTom(now, 175, 80);
                break;
            case 'tom-low':
                this.soundTom(now, 110, 50);
                break;
            case 'crash':
                this.soundCrash(now);
                break;
            case 'clap':
                this.soundClap(now);
                break;
            // Indian Percussion (Tabla) - Full 16 Bols
            case 'tabla-dha':
                this.soundTablaDha(now);
                break;
            case 'tabla-ge':
                this.soundTablaGe(now);
                break;
            case 'tabla-na':
                this.soundTablaNa(now);
                break;
            case 'tabla-tin':
                this.soundTablaTin(now);
                break;
            case 'tabla-tun':
                this.soundTablaTun(now);
                break;
            case 'tabla-ke':
                this.soundTablaKe(now);
                break;
            case 'tabla-dhin':
                this.soundTablaDhin(now);
                break;
            case 'tabla-ti':
                this.soundTablaTi(now);
                break;
            case 'tabla-te':
                this.soundTablaTe(now);
                break;
            case 'tabla-ghe':
                this.soundTablaGhe(now);
                break;
            case 'tabla-thun':
                this.soundTablaThun(now);
                break;
            case 'tabla-tak':
                this.soundTablaTak(now);
                break;
            case 'tabla-chap':
                this.soundTablaChap(now);
                break;
            case 'tabla-kda':
                this.soundTablaKda(now);
                break;
            case 'tabla-dhage':
                this.soundTablaDhaGe(now);
                break;
            case 'tabla-trkt':
                this.soundTablaTirKit(now);
                break;
            // Punjabi Wedding Dhol (شادی بیاہ کا روایتی پنجابی ڈھول)
            case 'dhol-dhum':
                this.soundDholDhum(now);
                break;
            case 'dhol-dagga':
                this.soundDholDagga(now);
                break;
            case 'dhol-tilli':
                this.soundDholTilli(now);
                break;
            case 'dhol-roll':
                this.soundDholRoll(now);
                break;
            case 'dhol-ghad':
                this.soundDholGhad(now);
                break;
            case 'dhol-khad':
                this.soundDholKhad(now);
                break;
            case 'dhol-takk':
                this.soundDholTakk(now);
                break;
            case 'dhol-dhamal':
                this.soundDholDhamal(now);
                break;
            default:
                break;
        }
    }

    soundKick(now) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        // Punchy pitch drop: 140Hz -> 36Hz
        osc.frequency.setValueAtTime(145, now);
        osc.frequency.exponentialRampToValueAtTime(36, now + 0.11);

        gain.gain.setValueAtTime(1.0, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

        // Click transient for punch
        const clickOsc = this.ctx.createOscillator();
        const clickGain = this.ctx.createGain();
        clickOsc.frequency.setValueAtTime(280, now);
        clickGain.gain.setValueAtTime(0.4, now);
        clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

        osc.connect(gain);
        clickOsc.connect(clickGain);
        gain.connect(this.drumsGain);
        clickGain.connect(this.drumsGain);

        osc.start(now);
        clickOsc.start(now);
        osc.stop(now + 0.4);
        clickOsc.stop(now + 0.03);
    }

    soundSnare(now) {
        // Noise component
        const bufferSize = this.ctx.sampleRate * 0.22;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.setValueAtTime(900, now);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.85, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.drumsGain);

        // Snare shell tone
        const osc = this.ctx.createOscillator();
        const toneGain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(90, now + 0.1);

        toneGain.gain.setValueAtTime(0.65, now);
        toneGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        osc.connect(toneGain);
        toneGain.connect(this.drumsGain);

        noise.start(now);
        osc.start(now);
        osc.stop(now + 0.2);
    }

    soundHiHat(now, isOpen) {
        const duration = isOpen ? 0.38 : 0.065;
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(6800, now);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.55, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.drumsGain);

        noise.start(now);
    }

    soundTom(now, startFreq, endFreq) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(startFreq, now);
        osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.22);

        gain.gain.setValueAtTime(0.9, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

        osc.connect(gain);
        gain.connect(this.drumsGain);

        osc.start(now);
        osc.stop(now + 0.3);
    }

    soundCrash(now) {
        const duration = 1.3;
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(5500, now);
        filter.Q.setValueAtTime(0.8, now);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.65, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.drumsGain);

        noise.start(now);
    }

    soundClap(now) {
        const times = [0, 0.012, 0.024];
        times.forEach(t => {
            const bufferSize = this.ctx.sampleRate * 0.04;
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            const noise = this.ctx.createBufferSource();
            noise.buffer = buffer;

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(1400, now + t);

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.6, now + t);
            gain.gain.exponentialRampToValueAtTime(0.001, now + t + 0.04);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.drumsGain);
            noise.start(now + t);
        });
    }

    /* Tabla Percussion Synthesizers - Professional Acoustic Modeling */
    soundTablaGe(now) {
        // Authentic Bayan (Dagga) Meend: Palm pressure pitch swoop with sub-bass punch
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        // Fundamental Meend curve: starts at 75Hz, sweeps up to 135Hz on palm press, decays to 55Hz
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(75, now);
        osc1.frequency.exponentialRampToValueAtTime(135, now + 0.08);
        osc1.frequency.exponentialRampToValueAtTime(55, now + 0.36);

        // 2nd Harmonic skin tone for body
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(150, now);
        osc2.frequency.exponentialRampToValueAtTime(270, now + 0.08);
        osc2.frequency.exponentialRampToValueAtTime(110, now + 0.28);
        const gain2 = this.ctx.createGain();
        gain2.gain.setValueAtTime(0.35, now);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

        gain.gain.setValueAtTime(1.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);

        // Tactile hand skin friction transient
        try {
            const bufSize = Math.floor(this.ctx.sampleRate * 0.03);
            const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
            const d = buf.getChannelData(0);
            for (let i = 0; i < bufSize; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.008));
            const noise = this.ctx.createBufferSource();
            noise.buffer = buf;
            const nFilt = this.ctx.createBiquadFilter();
            nFilt.type = 'lowpass';
            nFilt.frequency.setValueAtTime(450, now);
            const nGain = this.ctx.createGain();
            nGain.gain.setValueAtTime(0.18, now);
            nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
            noise.connect(nFilt);
            nFilt.connect(nGain);
            nGain.connect(this.drumsGain);
            noise.start(now);
        } catch(e) {}

        osc1.connect(gain);
        osc2.connect(gain2);
        gain2.connect(gain);
        gain.connect(this.drumsGain);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.44);
        osc2.stop(now + 0.30);
    }

    soundTablaNa(now) {
        // Dayan edge rim strike (Kinar): Crisp metallic ring at D5 (587.33 Hz) + high chime
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        const base = 587.33; // D5 pitch
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(base, now);

        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(base * 2.18, now); // Metallic overtone

        gain.gain.setValueAtTime(0.85, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

        // Rim click transient
        const clickOsc = this.ctx.createOscillator();
        const clickGain = this.ctx.createGain();
        clickOsc.type = 'triangle';
        clickOsc.frequency.setValueAtTime(1400, now);
        clickOsc.frequency.exponentialRampToValueAtTime(600, now + 0.015);
        clickGain.gain.setValueAtTime(0.4, now);
        clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.015);

        osc1.connect(gain);
        osc2.connect(gain);
        clickOsc.connect(clickGain);
        clickGain.connect(gain);
        gain.connect(this.drumsGain);

        osc1.start(now);
        osc2.start(now);
        clickOsc.start(now);
        osc1.stop(now + 0.30);
        osc2.stop(now + 0.30);
        clickOsc.stop(now + 0.02);
    }

    soundTablaTin(now) {
        // Open singing ring on Dayan syahi: Prolonged sustained bell resonance
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        const base = 587.33; // D5 pitch
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(base, now);

        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(base * 3.0, now); // 3rd harmonic bell overtone
        const gain2 = this.ctx.createGain();
        gain2.gain.setValueAtTime(0.18, now);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        gain.gain.setValueAtTime(0.72, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.52);

        osc1.connect(gain);
        osc2.connect(gain2);
        gain2.connect(gain);
        gain.connect(this.drumsGain);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.55);
        osc2.stop(now + 0.38);
    }

    soundTablaDha(now) {
        // Dha = Ge (Bass) + Na (Treble) simultaneous
        this.soundTablaGe(now);
        this.soundTablaNa(now);
    }

    // ===== NEW EXPANDED TABLA BOLS =====

    soundTablaTun(now) {
        // Tun - Deep resonant Dayan center stroke, long sustain
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(380, now + 0.08);
        osc.frequency.exponentialRampToValueAtTime(350, now + 0.5);

        gain.gain.setValueAtTime(0.7, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

        // Add subtle overtone for richness
        const osc2 = this.ctx.createOscillator();
        const gain2 = this.ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(880, now);
        gain2.gain.setValueAtTime(0.15, now);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

        osc.connect(gain);
        osc2.connect(gain2);
        gain.connect(this.drumsGain);
        gain2.connect(this.drumsGain);

        osc.start(now);
        osc2.start(now);
        osc.stop(now + 0.58);
        osc2.stop(now + 0.32);
    }

    soundTablaKe(now) {
        // Ke/Ka - Dry muted Dayan slap, very short, no sustain
        const bufferSize = this.ctx.sampleRate * 0.04;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(2000, now);
        filter.Q.setValueAtTime(3, now);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.65, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.drumsGain);

        noise.start(now);
    }

    soundTablaDhin(now) {
        // Dhin = Ge (Bass) + Tin (Open ring) simultaneous
        this.soundTablaGe(now);
        this.soundTablaTin(now);
    }

    soundTablaTi(now) {
        // Ti - Light Dayan fingertip tap, very quiet, high pitched, very short
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(750, now + 0.04);

        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        osc.connect(gain);
        gain.connect(this.drumsGain);

        osc.start(now);
        osc.stop(now + 0.1);
    }

    soundTablaTe(now) {
        // Te/Re - Rim shot click, sharp metallic, very short 30ms
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.02);

        gain.gain.setValueAtTime(0.6, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

        // Metallic click component
        const osc2 = this.ctx.createOscillator();
        const gain2 = this.ctx.createGain();
        osc2.type = 'square';
        osc2.frequency.setValueAtTime(2400, now);
        gain2.gain.setValueAtTime(0.2, now);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.015);

        osc.connect(gain);
        osc2.connect(gain2);
        gain.connect(this.drumsGain);
        gain2.connect(this.drumsGain);

        osc.start(now);
        osc2.start(now);
        osc.stop(now + 0.04);
        osc2.stop(now + 0.02);
    }

    soundTablaGhe(now) {
        // Ghe - Heavy deep Bayan palm press, deeper than Ge
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(50, now);
        osc.frequency.exponentialRampToValueAtTime(35, now + 0.15);
        osc.frequency.exponentialRampToValueAtTime(25, now + 0.4);

        gain.gain.setValueAtTime(1.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

        // Sub-bass rumble
        const osc2 = this.ctx.createOscillator();
        const gain2 = this.ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(30, now);
        gain2.gain.setValueAtTime(0.5, now);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        osc.connect(gain);
        osc2.connect(gain2);
        gain.connect(this.drumsGain);
        gain2.connect(this.drumsGain);

        osc.start(now);
        osc2.start(now);
        osc.stop(now + 0.48);
        osc2.stop(now + 0.38);
    }

    soundTablaThun(now) {
        // Thun - Resonant Bayan open stroke, long sustain
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(90, now);
        osc.frequency.exponentialRampToValueAtTime(75, now + 0.1);
        osc.frequency.exponentialRampToValueAtTime(65, now + 0.5);

        gain.gain.setValueAtTime(0.9, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

        // Warm overtone
        const osc2 = this.ctx.createOscillator();
        const gain2 = this.ctx.createGain();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(180, now);
        gain2.gain.setValueAtTime(0.25, now);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

        osc.connect(gain);
        osc2.connect(gain2);
        gain.connect(this.drumsGain);
        gain2.connect(this.drumsGain);

        osc.start(now);
        osc2.start(now);
        osc.stop(now + 0.58);
        osc2.stop(now + 0.42);
    }

    soundTablaTak(now) {
        // Tak - Flat palm slap on Dayan edge, mid-range noise burst
        const bufferSize = this.ctx.sampleRate * 0.1;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1500, now);
        filter.Q.setValueAtTime(2, now);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.7, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

        // Add a pitch component for body
        const osc = this.ctx.createOscillator();
        const oscGain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.06);
        oscGain.gain.setValueAtTime(0.35, now);
        oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.drumsGain);
        osc.connect(oscGain);
        oscGain.connect(this.drumsGain);

        noise.start(now);
        osc.start(now);
        osc.stop(now + 0.08);
    }

    soundTablaChap(now) {
        // Chap - Full palm mute on Dayan, very muffled thud
        const bufferSize = this.ctx.sampleRate * 0.08;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(600, now);
        filter.Q.setValueAtTime(1, now);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.55, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.drumsGain);

        noise.start(now);
    }

    soundTablaKda(now) {
        // Kda - Dry compound stroke: Ke + short bass thud
        this.soundTablaKe(now);
        // Add a short low thud
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(60, now + 0.06);
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.connect(gain);
        gain.connect(this.drumsGain);
        osc.start(now);
        osc.stop(now + 0.1);
    }

    soundTablaDhaGe(now) {
        // Dha-Ge - Quick double stroke
        this.soundTablaDha(now);
        setTimeout(() => {
            if (this.ctx && this.ctx.state === 'running') {
                this.soundTablaGe(this.ctx.currentTime);
            }
        }, 80);
    }

    soundTablaTirKit(now) {
        // Tir-Kit - Quick double stroke Ti+Ke
        this.soundTablaTi(now);
        setTimeout(() => {
            if (this.ctx && this.ctx.state === 'running') {
                this.soundTablaKe(this.ctx.currentTime);
            }
        }, 60);
    }

    /* ===================================================
       PUNJABI WEDDING DHOL ACOUSTIC SYNTHESIS ENGINE
       (شادی بیاہ کا روایتی پنجابی ڈھول)
       Authentic Sheesham Wood Barrel, Dagga Bass & Tilli Snap
    =================================================== */

    soundDholDagga(now) {
        // Deep booming wooden barrel bass of the curved Dagga stick
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const oscSub = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        // 1. Fundamental pitch drop: 96Hz down to 50Hz with natural skin sustain (~0.52s)
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(96, now);
        osc1.frequency.exponentialRampToValueAtTime(50, now + 0.14);

        // 2. Sheesham wood barrel resonant overtone (2nd harmonic with slight phase detune)
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(180, now);
        osc2.frequency.exponentialRampToValueAtTime(98, now + 0.12);
        const g2 = this.ctx.createGain();
        g2.gain.setValueAtTime(0.35, now);
        g2.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        osc2.connect(g2);

        // 3. Sub-bass chest thump (38Hz - 44Hz)
        oscSub.type = 'sine';
        oscSub.frequency.setValueAtTime(44, now);
        const gSub = this.ctx.createGain();
        gSub.gain.setValueAtTime(0.45, now);
        gSub.gain.exponentialRampToValueAtTime(0.001, now + 0.40);
        oscSub.connect(gSub);

        // 4. Heavy curved stick strike transient (12ms impact punch)
        try {
            const bufSize = Math.floor(this.ctx.sampleRate * 0.035);
            const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
            const d = buf.getChannelData(0);
            for (let i = 0; i < bufSize; i++) {
                d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.006));
            }
            const click = this.ctx.createBufferSource();
            click.buffer = buf;
            const clickFilter = this.ctx.createBiquadFilter();
            clickFilter.type = 'lowpass';
            clickFilter.frequency.setValueAtTime(450, now);
            const clickGain = this.ctx.createGain();
            clickGain.gain.setValueAtTime(0.40, now);
            clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
            click.connect(clickFilter);
            clickFilter.connect(clickGain);
            clickGain.connect(gain);
            click.start(now);
        } catch(e) {}

        // Barrel cavity resonance filter
        const barrelFilter = this.ctx.createBiquadFilter();
        barrelFilter.type = 'peaking';
        barrelFilter.frequency.setValueAtTime(110, now);
        barrelFilter.Q.setValueAtTime(2.8, now);
        barrelFilter.gain.setValueAtTime(4.5, now);

        gain.gain.setValueAtTime(1.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

        osc1.connect(gain);
        g2.connect(gain);
        gSub.connect(gain);
        gain.connect(barrelFilter);
        barrelFilter.connect(this.drumsGain);

        osc1.start(now);
        osc2.start(now);
        oscSub.start(now);
        osc1.stop(now + 0.58);
        osc2.stop(now + 0.30);
        oscSub.stop(now + 0.42);
    }

    soundDholTilli(now) {
        // High-pitched, biting crack of the thin cane stick (Tilli) on the treble rim
        // 1. Sharp cane strike noise snap
        const duration = 0.16;
        const bufSize = Math.floor(this.ctx.sampleRate * duration);
        const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.022));
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buf;

        const hpFilter = this.ctx.createBiquadFilter();
        hpFilter.type = 'highpass';
        hpFilter.frequency.setValueAtTime(2800, now);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.95, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        noise.connect(hpFilter);
        hpFilter.connect(noiseGain);
        noiseGain.connect(this.drumsGain);
        noise.start(now);

        // 2. High-tension goat-skin treble harmonic ring (840Hz & 1820Hz)
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const ringGain = this.ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(840, now);
        osc1.frequency.exponentialRampToValueAtTime(720, now + 0.08);

        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(1820, now);
        osc2.frequency.exponentialRampToValueAtTime(1450, now + 0.05);

        ringGain.gain.setValueAtTime(0.60, now);
        ringGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

        osc1.connect(ringGain);
        osc2.connect(ringGain);
        ringGain.connect(this.drumsGain);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.18);
        osc2.stop(now + 0.18);
    }

    soundDholDhum(now) {
        // Massive wedding downbeat smash: Simultaneous Dagga Bass + Tilli Snap
        this.soundDholDagga(now);
        this.soundDholTilli(now);
    }

    soundDholRoll(now) {
        // Rapid wedding flurry / stick roll (Trrrr-Taa!)
        const times = [0, 0.026, 0.052, 0.082];
        times.forEach((t, idx) => {
            setTimeout(() => {
                if (this.ctx && this.ctx.state === 'running') {
                    const hitTime = this.ctx.currentTime;
                    if (idx === times.length - 1) {
                        this.soundDholTilli(hitTime);
                    } else {
                        // Light micro-snap
                        const osc = this.ctx.createOscillator();
                        const g = this.ctx.createGain();
                        osc.type = 'triangle';
                        osc.frequency.setValueAtTime(950, hitTime);
                        g.gain.setValueAtTime(0.35, hitTime);
                        g.gain.exponentialRampToValueAtTime(0.001, hitTime + 0.04);
                        osc.connect(g);
                        g.connect(this.drumsGain);
                        osc.start(hitTime);
                        osc.stop(hitTime + 0.05);
                    }
                }
            }, t * 1000);
        });
    }

    soundDholGhad(now) {
        // Bouncing double bass stroke: Initial strike + rapid rebound bounce
        this.soundDholDagga(now);
        setTimeout(() => {
            if (this.ctx && this.ctx.state === 'running') {
                const reboundNow = this.ctx.currentTime;
                const osc = this.ctx.createOscillator();
                const g = this.ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(85, reboundNow);
                osc.frequency.exponentialRampToValueAtTime(52, reboundNow + 0.12);
                g.gain.setValueAtTime(0.85, reboundNow);
                g.gain.exponentialRampToValueAtTime(0.001, reboundNow + 0.35);
                osc.connect(g);
                g.connect(this.drumsGain);
                osc.start(reboundNow);
                osc.stop(reboundNow + 0.38);
            }
        }, 50);
    }

    soundDholKhad(now) {
        // Muted / slapped bass hit with wooden rim contact (Khad / Dhap)
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(65, now + 0.05);

        gain.gain.setValueAtTime(0.9, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        // Wood rim slap click
        const clickOsc = this.ctx.createOscillator();
        const clickGain = this.ctx.createGain();
        clickOsc.type = 'square';
        clickOsc.frequency.setValueAtTime(650, now);
        clickGain.gain.setValueAtTime(0.4, now);
        clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

        osc.connect(gain);
        clickOsc.connect(clickGain);
        gain.connect(this.drumsGain);
        clickGain.connect(this.drumsGain);

        osc.start(now);
        clickOsc.start(now);
        osc.stop(now + 0.09);
        clickOsc.stop(now + 0.03);
    }

    soundDholTakk(now) {
        // Dry muted cane tap on the treble rim
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1350, now);
        osc.frequency.exponentialRampToValueAtTime(900, now + 0.025);

        gain.gain.setValueAtTime(0.65, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

        osc.connect(gain);
        gain.connect(this.drumsGain);
        osc.start(now);
        osc.stop(now + 0.05);
    }

    soundDholDhamal(now) {
        // Deep ecstatic Dhamal stroke: sweeping pitch bend with sub-bass power
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(115, now);
        osc.frequency.exponentialRampToValueAtTime(46, now + 0.22);

        gain.gain.setValueAtTime(1.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.60);

        osc.connect(gain);
        gain.connect(this.drumsGain);
        osc.start(now);
        osc.stop(now + 0.65);

        // Treble shimmer
        this.soundDholTilli(now);
    }

    /* ===================================================
       BUILT-IN RHYTHM LOOPER (Keherwa, Dadra, Rock, Disco)
    =================================================== */

    // Rhythm patterns definitions (16 steps per bar)
    getRhythmPatterns() {
        return {
            bhangra: {
                name: "💃 Wedding Bhangra (شادی بیاہ کا بھنگڑا - 8 Matra / 130 BPM)",
                steps: 8,
                tempoDefault: 130,
                grid: [
                    { drum: ['dhol-dhum'] },
                    { drum: 'dhol-tilli' },
                    { drum: ['dhol-dagga', 'dhol-tilli'] },
                    { drum: 'dhol-tilli' },
                    { drum: ['dhol-ghad'] },
                    { drum: 'dhol-tilli' },
                    { drum: ['dhol-roll'] },
                    { drum: 'dhol-tilli' }
                ]
            },
            luddi: {
                name: "👰 Wedding Luddi & Mehndi (شادی کی لدھی اور رسمِ حنا - 6 Matra / 115 BPM)",
                steps: 6,
                tempoDefault: 115,
                grid: [
                    { drum: ['dhol-dhum'] },
                    { drum: 'dhol-tilli' },
                    { drum: ['dhol-ghad'] },
                    { drum: ['dhol-dhum'] },
                    { drum: 'dhol-tilli' },
                    { drum: 'dhol-khad' }
                ]
            },
            dhamal: {
                name: "📿 Mast Qalandar Dhamal (مست قلندر دھمال - 8 Matra / 140 BPM)",
                steps: 8,
                tempoDefault: 140,
                grid: [
                    { drum: ['dhol-dhamal'] },
                    { drum: 'dhol-tilli' },
                    { drum: ['dhol-dagga'] },
                    { drum: 'dhol-tilli' },
                    { drum: ['dhol-dhum'] },
                    { drum: 'dhol-tilli' },
                    { drum: ['dhol-roll'] },
                    { drum: 'dhol-tilli' }
                ]
            },
            keherwa: {
                name: "Keherwa Taal (8 Matra / Ghazal)",
                steps: 8,
                tempoDefault: 95,
                grid: [
                    { drum: 'tabla-dha' }, // Dha
                    { drum: 'tabla-ge' },  // Ge
                    { drum: 'tabla-na' },  // Na
                    { drum: 'tabla-tin' }, // Ti
                    { drum: 'tabla-na' },  // Na
                    { drum: 'tabla-tin' }, // Ka
                    { drum: 'tabla-dha' }, // Dhi
                    { drum: 'tabla-na' }   // Na
                ]
            },
            dadra: {
                name: "Dadra Taal (6 Matra / Folk)",
                steps: 6,
                tempoDefault: 110,
                grid: [
                    { drum: 'tabla-dha' }, // Dha
                    { drum: 'tabla-dha' }, // Dhi
                    { drum: 'tabla-na' },  // Na
                    { drum: 'tabla-dha' }, // Dha
                    { drum: 'tabla-tin' }, // Ti
                    { drum: 'tabla-na' }   // Na
                ]
            },
            rock: {
                name: "Rock / Pop (4/4 Standard)",
                steps: 8,
                tempoDefault: 105,
                grid: [
                    { drum: ['kick', 'hihat-closed'] },
                    { drum: 'hihat-closed' },
                    { drum: ['snare', 'hihat-closed'] },
                    { drum: 'hihat-closed' },
                    { drum: ['kick', 'hihat-closed'] },
                    { drum: ['kick', 'hihat-closed'] },
                    { drum: ['snare', 'hihat-open'] },
                    { drum: 'hihat-closed' }
                ]
            },
            disco: {
                name: "Disco / Dance (4 on Floor)",
                steps: 8,
                tempoDefault: 120,
                grid: [
                    { drum: 'kick' },
                    { drum: 'hihat-open' },
                    { drum: ['kick', 'snare'] },
                    { drum: 'hihat-open' },
                    { drum: 'kick' },
                    { drum: 'hihat-open' },
                    { drum: ['kick', 'snare'] },
                    { drum: 'hihat-open' }
                ]
            },
            metronome: {
                name: "Metronome (Tick-Tock)",
                steps: 4,
                tempoDefault: 90,
                grid: [
                    { drum: 'tom-high' },
                    { drum: 'hihat-closed' },
                    { drum: 'hihat-closed' },
                    { drum: 'hihat-closed' }
                ]
            }
        };
    }

    startRhythm(rhythmKey, onStepCallback) {
        this.init();
        this.stopRhythm();
        const patterns = this.getRhythmPatterns();
        const pattern = patterns[rhythmKey];
        if (!pattern) return;

        this.currentRhythm = rhythmKey;
        this.isPlayingRhythm = true;
        this.stepIndex = 0;

        const intervalMs = (60 / this.bpm) * 1000 / (pattern.steps === 4 ? 1 : 2);

        const playStep = () => {
            if (!this.isPlayingRhythm) return;
            const currentItem = pattern.grid[this.stepIndex % pattern.steps];
            if (currentItem) {
                if (Array.isArray(currentItem.drum)) {
                    currentItem.drum.forEach(d => this.playDrum(d));
                } else if (currentItem.drum) {
                    this.playDrum(currentItem.drum);
                }
            }

            if (onStepCallback) {
                onStepCallback(this.stepIndex % pattern.steps);
            }

            this.stepIndex = (this.stepIndex + 1) % pattern.steps;
        };

        playStep();
        this.rhythmInterval = setInterval(playStep, intervalMs);
    }

    updateTempo(newBpm) {
        this.bpm = newBpm;
        if (this.isPlayingRhythm && this.currentRhythm) {
            const cb = this.onStepCb;
            const rk = this.currentRhythm;
            clearInterval(this.rhythmInterval);
            const patterns = this.getRhythmPatterns();
            const pattern = patterns[rk];
            const intervalMs = (60 / this.bpm) * 1000 / (pattern.steps === 4 ? 1 : 2);
            this.rhythmInterval = setInterval(() => {
                if (!this.isPlayingRhythm) return;
                const currentItem = pattern.grid[this.stepIndex % pattern.steps];
                if (currentItem) {
                    if (Array.isArray(currentItem.drum)) {
                        currentItem.drum.forEach(d => this.playDrum(d));
                    } else if (currentItem.drum) {
                        this.playDrum(currentItem.drum);
                    }
                }
                if (cb) cb(this.stepIndex % pattern.steps);
                this.stepIndex = (this.stepIndex + 1) % pattern.steps;
            }, intervalMs);
        }
    }

    stopRhythm() {
        this.isPlayingRhythm = false;
        if (this.rhythmInterval) {
            clearInterval(this.rhythmInterval);
            this.rhythmInterval = null;
        }
        this.stepIndex = 0;
    }

    /* ===================================================
       AUDIO RECORDER
    =================================================== */

    startRecording() {
        this.init();
        if (!this.dest) {
            alert("Recording is not supported in this browser version.");
            return false;
        }

        this.recordedChunks = [];
        try {
            this.mediaRecorder = new MediaRecorder(this.dest.stream);
            this.mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    this.recordedChunks.push(e.data);
                }
            };
            this.mediaRecorder.start();
            this.isRecording = true;
            return true;
        } catch (err) {
            console.error("Recording error:", err);
            return false;
        }
    }

    stopRecording() {
        return new Promise((resolve) => {
            if (!this.mediaRecorder || !this.isRecording) {
                resolve(null);
                return;
            }

            this.mediaRecorder.onstop = () => {
                this.isRecording = false;
                const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
                const url = URL.createObjectURL(blob);
                resolve({ blob, url });
            };

            this.mediaRecorder.stop();
        });
    }

    /* ===================================================
       ACCESSIBILITY EARCONS & AUDIO CUES
       Tonal feedback for blind users
    =================================================== */

    playEarcon(type) {
        this.init();
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.masterGain);

        switch (type) {
            case 'octave-up':
                // Two rising cheerful pings
                osc.type = 'sine';
                osc.frequency.setValueAtTime(523.25, now);
                osc.frequency.setValueAtTime(659.25, now + 0.08);
                gain.gain.setValueAtTime(0.25, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
                osc.start(now);
                osc.stop(now + 0.24);
                break;
            case 'octave-down':
                // Two falling pings
                osc.type = 'sine';
                osc.frequency.setValueAtTime(659.25, now);
                osc.frequency.setValueAtTime(523.25, now + 0.08);
                gain.gain.setValueAtTime(0.25, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
                osc.start(now);
                osc.stop(now + 0.24);
                break;
            case 'record-start':
                // High double beep
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(880, now);
                osc.frequency.setValueAtTime(1174, now + 0.1);
                gain.gain.setValueAtTime(0.3, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
                osc.start(now);
                osc.stop(now + 0.26);
                break;
            case 'record-stop':
                // Low falling double beep
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(880, now);
                osc.frequency.setValueAtTime(440, now + 0.1);
                gain.gain.setValueAtTime(0.3, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
                osc.start(now);
                osc.stop(now + 0.26);
                break;
            case 'toggle-on':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(587.33, now);
                gain.gain.setValueAtTime(0.25, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
                osc.start(now);
                osc.stop(now + 0.14);
                break;
            case 'toggle-off':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(293.66, now);
                gain.gain.setValueAtTime(0.25, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
                osc.start(now);
                osc.stop(now + 0.14);
                break;
            case 'panic-stop':
                // Low double thump to confirm all sounds cut
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(120, now);
                gain.gain.setValueAtTime(0.3, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
                osc.start(now);
                osc.stop(now + 0.16);
                break;
            default:
                break;
        }
    }

    /* ===================================================
       STUDIO EFFECTS RACK PROCESSORS & PRESET CONTROLLER
    =================================================== */

    buildImpulseBuffer(preset) {
        if (!this.ctx) return null;
        const rate = this.ctx.sampleRate;
        let duration = 2.5;
        let decay = 2.5;
        let damping = 1.5;

        if (preset === 'mehfil') {
            duration = 2.8;
            decay = 2.1;
            damping = 1.6;
        } else if (preset === 'studio') {
            duration = 1.2;
            decay = 4.2;
            damping = 3.0;
        } else if (preset === 'plate') {
            duration = 2.2;
            decay = 2.4;
            damping = 0.55; // Bright high-frequency metallic sustain
        } else if (preset === 'cathedral') {
            duration = 4.4;
            decay = 1.3;
            damping = 1.0; // Enormous lush ambient trail
        } else if (preset === 'spring') {
            duration = 1.4;
            decay = 3.2;
            damping = 1.8;
        }

        const length = Math.floor(rate * duration);
        const buffer = this.ctx.createBuffer(2, length, rate);
        const left = buffer.getChannelData(0);
        const right = buffer.getChannelData(1);

        for (let i = 0; i < length; i++) {
            const t = i / rate;
            let env = Math.exp(-t * decay);
            const damp = Math.exp(-t * damping * 1.6);

            // Uncorrelated stereo noise
            let nL = (Math.random() * 2 - 1) * env * damp;
            let nR = (Math.random() * 2 - 1) * env * damp;

            // Early reflections taps for Mehfil / Concert Hall realism
            if (preset === 'mehfil' || preset === 'cathedral') {
                if (t > 0.012 && t < 0.016) { nL += 0.45 * env; nR += 0.25 * env; }
                if (t > 0.028 && t < 0.033) { nL += 0.35 * env; nR += 0.45 * env; }
                if (t > 0.052 && t < 0.058) { nL += 0.25 * env; nR += 0.30 * env; }
                if (t > 0.085 && t < 0.092) { nL += 0.20 * env; nR += 0.22 * env; }
            } else if (preset === 'spring') {
                const chirp = Math.sin(t * (1800 - t * 400)) * Math.exp(-t * 6);
                nL += chirp * 0.4;
                nR += chirp * 0.35;
            }

            left[i] = nL;
            right[i] = nR;
        }
        return buffer;
    }

    createWarmthCurve(amount) {
        const k = Math.max(0, Math.min(100, amount));
        const n_samples = 4096;
        const curve = new Float32Array(n_samples);
        if (k === 0) {
            for (let i = 0; i < n_samples; i++) {
                curve[i] = (i * 2) / n_samples - 1;
            }
            return curve;
        }
        const drive = 1 + (k / 16);
        for (let i = 0; i < n_samples; ++i) {
            let x = (i * 2) / n_samples - 1;
            const xDrive = x * drive;
            // Soft-saturation curve modeling triode tube warmth
            curve[i] = Math.tanh(xDrive) + 0.06 * (Math.sin(xDrive * Math.PI) * (1 - Math.abs(x)));
        }
        return curve;
    }

    setReverbPreset(preset) {
        this.init();
        this.reverbPreset = preset;
        if (!this.reverbConvolver || !this.reverbReturnGain) return;
        const now = this.ctx.currentTime;
        if (preset === 'off') {
            this.reverbReturnGain.gain.setValueAtTime(0.0001, now);
            return;
        }
        try {
            if (!this.reverbBuffers[preset]) {
                this.reverbBuffers[preset] = this.buildImpulseBuffer(preset);
            }
            this.reverbConvolver.buffer = this.reverbBuffers[preset];
            this.reverbReturnGain.gain.setValueAtTime(this.reverbWet, now);
        } catch (e) {
            console.warn("Error setting reverb preset:", e);
        }
    }

    setReverbWet(val) {
        this.init();
        this.reverbWet = Math.max(0, Math.min(1.0, parseFloat(val)));
        if (!this.reverbReturnGain) return;
        const now = this.ctx.currentTime;
        if (this.reverbPreset === 'off') {
            this.reverbReturnGain.gain.setValueAtTime(0.0001, now);
        } else {
            this.reverbReturnGain.gain.setValueAtTime(this.reverbWet, now);
        }
    }

    setDelayEnabled(enabled) {
        this.init();
        this.delayEnabled = !!enabled;
        if (!this.delayReturnGain) return;
        const now = this.ctx.currentTime;
        this.delayReturnGain.gain.setValueAtTime(this.delayEnabled ? this.delayWet : 0.0001, now);
    }

    setDelayTime(sec) {
        this.init();
        this.delayTime = Math.max(0.05, Math.min(1.0, parseFloat(sec)));
        if (!this.delayL || !this.delayR) return;
        const now = this.ctx.currentTime;
        this.delayL.delayTime.setValueAtTime(this.delayTime, now);
        this.delayR.delayTime.setValueAtTime(Math.min(1.2, this.delayTime * 1.25), now);
    }

    setDelayFeedback(fb) {
        this.init();
        this.delayFeedback = Math.max(0, Math.min(0.85, parseFloat(fb)));
        if (!this.delayFeedbackL || !this.delayFeedbackR) return;
        const now = this.ctx.currentTime;
        this.delayFeedbackL.gain.setValueAtTime(this.delayFeedback, now);
        this.delayFeedbackR.gain.setValueAtTime(this.delayFeedback, now);
    }

    setDelayWet(wet) {
        this.init();
        this.delayWet = Math.max(0, Math.min(1.0, parseFloat(wet)));
        if (!this.delayReturnGain) return;
        const now = this.ctx.currentTime;
        if (this.delayEnabled) {
            this.delayReturnGain.gain.setValueAtTime(this.delayWet, now);
        }
    }

    setEqLow(gainDb) {
        this.init();
        this.eqLowGain = Math.max(-12, Math.min(12, parseFloat(gainDb)));
        if (this.eqLow) {
            this.eqLow.gain.setValueAtTime(this.eqLowGain, this.ctx.currentTime);
        }
    }

    setEqMid(gainDb) {
        this.init();
        this.eqMidGain = Math.max(-12, Math.min(12, parseFloat(gainDb)));
        if (this.eqMid) {
            this.eqMid.gain.setValueAtTime(this.eqMidGain, this.ctx.currentTime);
        }
    }

    setEqHigh(gainDb) {
        this.init();
        this.eqHighGain = Math.max(-12, Math.min(12, parseFloat(gainDb)));
        if (this.eqHigh) {
            this.eqHigh.gain.setValueAtTime(this.eqHighGain, this.ctx.currentTime);
        }
    }

    setTubeWarmth(driveVal) {
        this.init();
        this.tubeWarmth = Math.max(0, Math.min(100, parseFloat(driveVal)));
        if (!this.driveNode || !this.driveWetGain || !this.driveDryGain) return;
        const now = this.ctx.currentTime;
        this.driveNode.curve = this.createWarmthCurve(this.tubeWarmth);
        const wet = this.tubeWarmth / 100;
        this.driveWetGain.gain.setValueAtTime(wet * 0.85, now);
        this.driveDryGain.gain.setValueAtTime(1.0 - (wet * 0.35), now);
    }

    setChorusEnabled(enabled) {
        this.init();
        this.chorusEnabled = !!enabled;
        if (!this.chorusWetGain || !this.chorusDryGain) return;
        const now = this.ctx.currentTime;
        if (this.chorusEnabled) {
            this.chorusWetGain.gain.setValueAtTime(0.65, now);
            this.chorusDryGain.gain.setValueAtTime(0.85, now);
        } else {
            this.chorusWetGain.gain.setValueAtTime(0.0001, now);
            this.chorusDryGain.gain.setValueAtTime(1.0, now);
        }
    }

    applyStudioPreset(presetKey) {
        this.init();
        this.currentStudioPreset = presetKey;
        switch (presetKey) {
            case 'mehfil':
                // Classic Ghazal, Harmonium & Tabla in a royal acoustic mehfil
                this.setReverbPreset('mehfil');
                this.setReverbWet(0.38);
                this.setDelayEnabled(true);
                this.setDelayTime(0.34);
                this.setDelayFeedback(0.32);
                this.setDelayWet(0.20);
                this.setEqLow(2.5);
                this.setEqMid(1.0);
                this.setEqHigh(1.5);
                this.setTubeWarmth(25);
                this.setChorusEnabled(true);
                break;
            case 'classical':
                // Pure acoustic chamber, transparent studio sound
                this.setReverbPreset('studio');
                this.setReverbWet(0.24);
                this.setDelayEnabled(false);
                this.setDelayWet(0.0);
                this.setEqLow(0);
                this.setEqMid(0);
                this.setEqHigh(0);
                this.setTubeWarmth(12);
                this.setChorusEnabled(false);
                break;
            case 'bollywood':
                // Shimmering plate reverb, crisp stereo delay & bright high end
                this.setReverbPreset('plate');
                this.setReverbWet(0.36);
                this.setDelayEnabled(true);
                this.setDelayTime(0.28);
                this.setDelayFeedback(0.38);
                this.setDelayWet(0.25);
                this.setEqLow(3.0);
                this.setEqMid(-0.5);
                this.setEqHigh(3.5);
                this.setTubeWarmth(30);
                this.setChorusEnabled(true);
                break;
            case 'qawwali':
                // Vast cathedral reverb, deep low-end punch & hypnotic echo
                this.setReverbPreset('cathedral');
                this.setReverbWet(0.45);
                this.setDelayEnabled(true);
                this.setDelayTime(0.38);
                this.setDelayFeedback(0.45);
                this.setDelayWet(0.30);
                this.setEqLow(4.0);
                this.setEqMid(1.5);
                this.setEqHigh(2.0);
                this.setTubeWarmth(40);
                this.setChorusEnabled(true);
                break;
            case 'clean':
            default:
                // Transparent flat dry bypass
                this.setReverbPreset('off');
                this.setReverbWet(0.0);
                this.setDelayEnabled(false);
                this.setDelayWet(0.0);
                this.setEqLow(0);
                this.setEqMid(0);
                this.setEqHigh(0);
                this.setTubeWarmth(0);
                this.setChorusEnabled(false);
                break;
        }
    }

    stopAllSound() {
        this.stopAllHarmoniumNotes();
        this.stopDrone();
        this.stopRhythm();
        this.playEarcon('panic-stop');
    }
}

window.soundEngine = new SoundEngine();

