// UI Controller, Accessibility Engine & Keyboard Handler for Harmonium, Flute & Drum Studio
// Optimized exclusively for NVDA & JAWS screen reader focus mode & 100% offline ad-free use

document.addEventListener('DOMContentLoaded', () => {
    const engine = window.soundEngine;

    // DOM Elements - Main Controls
    const harmoniumKeyboard = document.getElementById('harmoniumKeyboard');
    const bellowsIndicator = document.getElementById('bellowsIndicator');
    const instrumentSelect = document.getElementById('instrumentSelect');
    const reedSelect = document.getElementById('reedSelect');
    const reedSelectLabel = document.getElementById('reedSelectLabel');
    const octaveSelect = document.getElementById('octaveSelect');
    const notationSelect = document.getElementById('notationSelect');
    const instrumentHeaderTitle = document.getElementById('instrumentHeaderTitle');
    const instrumentHeaderSubtitle = document.getElementById('instrumentHeaderSubtitle');
    const bellowsAirLabel = document.getElementById('bellowsAirLabel');
    const volMaster = document.getElementById('volMaster');
    const volHarmonium = document.getElementById('volHarmonium');
    const volDrums = document.getElementById('volDrums');

    // Accessibility & NVDA / JAWS Elements
    const nvdaWelcomeBanner = document.getElementById('nvdaWelcomeBanner');
    const srAssertive = document.getElementById('srAssertiveAnnouncer');
    const srPolite = document.getElementById('srPoliteAnnouncer');
    const btnToggleInstrument = document.getElementById('btnToggleInstrument');
    const instBtnIcon = document.getElementById('instBtnIcon');
    const instBtnText = document.getElementById('instBtnText');
    const btnTextHelp = document.getElementById('btnTextHelp');
    const btnVoiceMode = document.getElementById('btnVoiceMode');
    const voiceModeText = document.getElementById('voiceModeText');
    const btnEasyMode = document.getElementById('btnEasyMode');
    const easyModeText = document.getElementById('easyModeText');
    const btnToggleSpeakNotes = document.getElementById('btnToggleSpeakNotes');
    const speakNotesBtnText = document.getElementById('speakNotesBtnText');
    const btnHighContrast = document.getElementById('btnHighContrast');
    const btnUpdateCheck = document.getElementById('btnUpdateCheck');
    const updateBtnText = document.getElementById('updateBtnText');
    const btnPanicStop = document.getElementById('btnPanicStop');

    // Text Help Modal Elements
    const helpModal = document.getElementById('helpModal');
    const btnCloseHelpModal = document.getElementById('btnCloseHelpModal');
    const btnCloseHelpModalBottom = document.getElementById('btnCloseHelpModalBottom');

    // Drone Elements
    const droneBtns = document.querySelectorAll('.drone-btn[data-freq]');
    const btnStopDrone = document.getElementById('btnStopDrone');

    // Drum & Percussion Bank Elements
    const drumPads = document.querySelectorAll('.drum-pad');
    const rhythmSelect = document.getElementById('rhythmSelect');
    const btnTogglePercBank = document.getElementById('btnTogglePercBank');
    const percBankBtnText = document.getElementById('percBankBtnText');
    const percBankBtns = document.querySelectorAll('.perc-bank-btn');
    const dholPadsWrapper = document.getElementById('dholPadsWrapper');
    const standardDrumsWrapper = document.getElementById('standardDrumsWrapper');
    const tablaPadsWrapper = document.getElementById('tablaPadsWrapper');
    let currentPercBank = 'dhol'; // 'dhol', 'tabla', 'drums'
    const tempoSlider = document.getElementById('tempoSlider');
    const bpmDisplay = document.getElementById('bpmDisplay');
    const btnPlayRhythm = document.getElementById('btnPlayRhythm');
    const rhythmPlayIcon = document.getElementById('rhythmPlayIcon');
    const rhythmPlayText = document.getElementById('rhythmPlayText');
    const stepLeds = document.querySelectorAll('.step-led');

    // Recording Elements
    const btnRecord = document.getElementById('btnRecord');
    const recText = document.getElementById('recText');
    const btnDownload = document.getElementById('btnDownload');
    let recTimerInterval = null;
    let recSeconds = 0;

    // Mode Buttons
    const modeBtns = document.querySelectorAll('.mode-btn');

    // Accessibility State
    let voiceMode = 'nvda'; // 'nvda' (ARIA live regions for NVDA/JAWS) or 'browser' (built-in speech)
    let easyMode = false;
    let speakNotesEnabled = false;
    let highContrastEnabled = false;
    let hasAnnouncedWelcome = false;
    let currentAppMode = 'dual'; // 'dual', 'harmonium', 'drums'

    /* ==========================================================
       NVDA & JAWS AUTO-FOCUS ON STARTUP
       Locks into Focus Mode immediately so keys pass directly
    ========================================================== */
    setTimeout(() => {
        if (nvdaWelcomeBanner) {
            nvdaWelcomeBanner.focus();
        }
    }, 150);

    /* ==========================================================
       ACCESSIBILITY & SPEECH SYNTHESIS ENGINE
    ========================================================== */

    function announce(text, priority = 'assertive') {
        // 1. Deliver to NVDA / JAWS via ARIA Live Region
        const region = priority === 'assertive' ? srAssertive : srPolite;
        if (region) {
            region.textContent = '';
            setTimeout(() => {
                region.textContent = text;
            }, 30);
        }

        // 2. Deliver via browser TTS only if user explicitly chose Browser Voice Mode
        if (voiceMode === 'browser' && 'speechSynthesis' in window) {
            try {
                window.speechSynthesis.cancel();
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.rate = 1.05;
                utterance.pitch = 1.0;
                window.speechSynthesis.speak(utterance);
            } catch (err) {
                console.warn("TTS error:", err);
            }
        }
    }

    /* ==========================================================
       TEXT HELP MODAL CONTROLLERS (AUDIO TO TEXT CONVERSION)
    ========================================================== */

    function openTextHelp() {
        if (!helpModal) return;
        engine.playEarcon('toggle-on');
        helpModal.removeAttribute('hidden');
        if (btnCloseHelpModal) {
            btnCloseHelpModal.focus();
        }
        announce("Help Guide khul gayi hai. Arrow keys se Roman Urdu aur English shortcuts parhein, band karne ke liye Escape ya F5 dabayein.", 'assertive');
    }

    function closeTextHelp() {
        if (!helpModal || helpModal.hasAttribute('hidden')) return;
        helpModal.setAttribute('hidden', '');
        engine.playEarcon('toggle-off');
        announce("Help Guide band ho gayi. Studio ready hai.", 'assertive');
        if (nvdaWelcomeBanner) {
            nvdaWelcomeBanner.focus();
        }
    }

    function isHelpModalOpen() {
        return helpModal && !helpModal.hasAttribute('hidden');
    }

    if (btnTextHelp) {
        btnTextHelp.addEventListener('click', openTextHelp);
    }
    if (btnCloseHelpModal) {
        btnCloseHelpModal.addEventListener('click', closeTextHelp);
    }
    if (btnCloseHelpModalBottom) {
        btnCloseHelpModalBottom.addEventListener('click', closeTextHelp);
    }

    /* ==========================================================
       INSTRUMENT SWITCHER (HARMONIUM, FLUTE, VIOLIN, GUITAR)
       Dedicated shortcut key: F2 or I (or Alt+F / Alt+I)
    ========================================================== */
    const INSTRUMENTS = ['harmonium', 'flute', 'violin', 'guitar', 'piano', 'sitar', 'santoor', 'sax'];

    function switchInstrument(inst) {
        engine.setInstrument(inst);
        if (instrumentSelect) instrumentSelect.value = inst;
        
        // Update body instrument classes
        INSTRUMENTS.forEach(i => document.body.classList.remove(`instrument-${i}`));
        document.body.classList.add(`instrument-${inst}`);

        // Update 8 Deck Cards UI
        document.querySelectorAll('#instrumentCardsDeck .inst-card').forEach(card => {
            const isMatch = card.dataset.inst === inst;
            card.classList.toggle('active', isMatch);
            card.setAttribute('aria-selected', isMatch ? 'true' : 'false');
        });

        if (inst === 'flute') {
            if (instBtnIcon) instBtnIcon.textContent = '🪈';
            if (instBtnText) instBtnText.textContent = 'Instrument: Bansuri Flute (بانسری) [F2 / I]';
            if (instrumentHeaderTitle) instrumentHeaderTitle.textContent = '🪈 INDIAN BANSURI & FLUTE (بانسری اور فلوٹ)';
            if (instrumentHeaderSubtitle) instrumentHeaderSubtitle.textContent = 'Realistic Bamboo Woodwind with Pure Breath & Vibrato';
            if (reedSelectLabel) reedSelectLabel.textContent = 'Tone / Flute (بانسری کی قسم):';
            if (bellowsAirLabel) bellowsAirLabel.textContent = 'BREATH (پھونک):';
            if (reedSelect) {
                reedSelect.innerHTML = `
                    <option value="bansuri" selected>Classical Bansuri (کلاسیکل بانسری - Sweet & Airy)</option>
                    <option value="folk">Folk Flute (لوک بانسری - Bright & Punchy)</option>
                    <option value="bass">Bass Bansuri (بڑی مدھر بانسری - Deep Warm Pipe)</option>
                `;
            }
            engine.setFluteTone('bansuri');
            engine.playEarcon('toggle-on');
            announce("Indian Bansuri Flute active. Realistic bamboo breath sound and expressive vibrato enabled.", 'assertive');
        } else if (inst === 'violin') {
            if (instBtnIcon) instBtnIcon.textContent = '🎻';
            if (instBtnText) instBtnText.textContent = 'Instrument: Concert Violin (وائلن اور بیلا) [F2 / I]';
            if (instrumentHeaderTitle) instrumentHeaderTitle.textContent = '🎻 MODERN & REALISTIC CONCERT VIOLIN (وائلن اور بیلا)';
            if (instrumentHeaderSubtitle) instrumentHeaderSubtitle.textContent = 'Acoustic Wood Body Formants, Tactile Rosin Bowing & Expressive Vibrato';
            if (reedSelectLabel) reedSelectLabel.textContent = 'Violin Tone (وائلن کی قسم):';
            if (bellowsAirLabel) bellowsAirLabel.textContent = 'BOW (کمان کا دباؤ):';
            if (reedSelect) {
                reedSelect.innerHTML = `
                    <option value="solo" selected>🎻 Solo Concert Master (سولو کنسرٹ ماسٹر - Sweet & Expressive Stradivarius)</option>
                    <option value="cinema">🎬 Romantic Cinema & Film Strings (فلم اور رومانٹک وائلن - Silky, Warm Legato)</option>
                    <option value="electric">⚡ Modern Electric / Crossover (ماڈرن الیکٹرک وائلن - Punchy & Contemporary)</option>
                    <option value="desi">🪕 Desi Fiddle / Classical Sarangi (دیسی بیلا اور سارنگی - Taraf Resonance)</option>
                `;
            }
            engine.setViolinTone('solo');
            engine.playEarcon('toggle-on');
            announce("Modern Realistic Violin active. Acoustic wood formants, tactile bow rosin bite, and expressive vibrato enabled.", 'assertive');
        } else if (inst === 'guitar') {
            if (instBtnIcon) instBtnIcon.textContent = '🎸';
            if (instBtnText) instBtnText.textContent = 'Instrument: Acoustic Guitar (ایکوسٹک گٹار) [F2 / I]';
            if (instrumentHeaderTitle) instrumentHeaderTitle.textContent = '🎸 ACOUSTIC & CLASSICAL GUITAR (ایکوسٹک اور نائلون گٹار)';
            if (instrumentHeaderSubtitle) instrumentHeaderSubtitle.textContent = 'Realistic Plucked String Harmonics & Wood Resonance';
            if (reedSelectLabel) reedSelectLabel.textContent = 'Guitar Tone (گٹار کی قسم):';
            if (bellowsAirLabel) bellowsAirLabel.textContent = 'PLUCK (مضراب / چٹکی):';
            if (reedSelect) {
                reedSelect.innerHTML = `
                    <option value="steel" selected>Acoustic Steel-String (اکوسٹک سٹیل گٹار - Bright & Resonant)</option>
                    <option value="nylon">Classical Spanish Nylon (ہسپانوی نائلون گٹار - Warm & Mellow)</option>
                    <option value="twelve">12-String Shimmer (بارہ تاری گٹار - Chorus & Octave Chime)</option>
                `;
            }
            engine.setGuitarTone('steel');
            engine.playEarcon('toggle-on');
            announce("Acoustic Guitar active. Authentic plucked string harmonics and wooden sustain enabled.", 'assertive');
        } else if (inst === 'piano') {
            if (instBtnIcon) instBtnIcon.textContent = '🎹';
            if (instBtnText) instBtnText.textContent = 'Instrument: Grand Piano (گرینڈ پیانو) [F2 / I]';
            if (instrumentHeaderTitle) instrumentHeaderTitle.textContent = '🎹 CONCERT GRAND & VINTAGE PIANO (گرینڈ پیانو)';
            if (instrumentHeaderSubtitle) instrumentHeaderSubtitle.textContent = 'Acoustic Felt Hammer Knock, Trichord String Unisons & Soundboard Sustain';
            if (reedSelectLabel) reedSelectLabel.textContent = 'Piano Model (پیانو کی قسم):';
            if (bellowsAirLabel) bellowsAirLabel.textContent = 'TOUCH (ہتھوڑی کی چوٹ):';
            if (reedSelect) {
                reedSelect.innerHTML = `
                    <option value="grand" selected>🎹 Concert Grand (کنسرٹ گرینڈ پیانو - Rich & Sparkling Steinway)</option>
                    <option value="upright">🎼 Vintage Studio Upright (سٹوڈیو اپ رائٹ - Warm & Intimate Felt)</option>
                    <option value="rhodes">⚡ Electric Rhodes (ونٹیج الیکٹرک پیانو - Bell Chime & Tremolo)</option>
                `;
            }
            engine.setPianoTone('grand');
            engine.playEarcon('toggle-on');
            announce("Concert Grand Piano active. Felt hammer attack, trichord unisons and soundboard sustain enabled.", 'assertive');
        } else if (inst === 'sitar') {
            if (instBtnIcon) instBtnIcon.textContent = '🪕';
            if (instBtnText) instBtnText.textContent = 'Instrument: Classical Sitar (ستار) [F2 / I]';
            if (instrumentHeaderTitle) instrumentHeaderTitle.textContent = '🪕 CLASSICAL INDIAN SITAR (کلاسیکل ہندوستانی ستار)';
            if (instrumentHeaderSubtitle) instrumentHeaderSubtitle.textContent = 'Authentic Jawari Bridge Buzz, Steel Mizrab Pluck & Taraf Sympathetic Shimmer';
            if (reedSelectLabel) reedSelectLabel.textContent = 'Sitar Baaj (ستار کا انداز):';
            if (bellowsAirLabel) bellowsAirLabel.textContent = 'MIZRAB (مضراب کی چوٹ):';
            if (reedSelect) {
                reedSelect.innerHTML = `
                    <option value="gandhar" selected>✨ Gandhar Pancham (ولایت خانی انگ - Singing Jawari Buzz & High Overtones)</option>
                    <option value="kharaj">🎵 Kharaj Pancham (روی شنکر انگ - Deep Bass Kharaj & Resonant Body)</option>
                    <option value="darbari">🧘 Meditative Alap (درباری الاپ - Long Sustained Drone & Delicate Taraf)</option>
                `;
            }
            engine.setSitarTone('gandhar');
            engine.playEarcon('toggle-on');
            announce("Classical Indian Sitar active. Jawari bridge buzz, steel mizrab and taraf sympathetic strings enabled.", 'assertive');
        } else if (inst === 'santoor') {
            if (instBtnIcon) instBtnIcon.textContent = '🎼';
            if (instBtnText) instBtnText.textContent = 'Instrument: Kashmiri Santoor (سنتور) [F2 / I]';
            if (instrumentHeaderTitle) instrumentHeaderTitle.textContent = '🎼 KASHMIRI & PERSIAN SANTOOR (کشمیری سنتور)';
            if (instrumentHeaderSubtitle) instrumentHeaderSubtitle.textContent = '100-String Hammered Dulcimer with Walnut Mezrab Mallets & Crystalline Chime';
            if (reedSelectLabel) reedSelectLabel.textContent = 'Santoor Style (سنتور کا انداز):';
            if (bellowsAirLabel) bellowsAirLabel.textContent = 'MEZRAB (مضراب کی تھاپ):';
            if (reedSelect) {
                reedSelect.innerHTML = `
                    <option value="kashmiri" selected>🏔️ Classical Kashmiri (کشمیری سنتور - Crystalline Walnut Mallets & Long Shimmer)</option>
                    <option value="persian">🏰 Persian Santur (ایرانی سنتور - Sharp Metallic Resonance & Dynamic Attack)</option>
                    <option value="ambient">🌌 Celestial Ambient (خوابیدہ سنتور - Dreamy Sustained Reverb & Ethereal Chime)</option>
                `;
            }
            engine.setSantoorTone('kashmiri');
            engine.playEarcon('toggle-on');
            announce("Kashmiri Santoor active. 100-string hammered dulcimer with walnut mallets and crystalline chime enabled.", 'assertive');
        } else if (inst === 'sax') {
            if (instBtnIcon) instBtnIcon.textContent = '🎷';
            if (instBtnText) instBtnText.textContent = 'Instrument: Studio Saxophone (سیکسوفون) [F2 / I]';
            if (instrumentHeaderTitle) instrumentHeaderTitle.textContent = '🎷 STUDIO JAZZ & BRASS SAXOPHONE (سٹوڈیو سیکسوفون)';
            if (instrumentHeaderSubtitle) instrumentHeaderSubtitle.textContent = 'Warm Cane Reed Bite, Conical Brass Acoustic Resonance & Expressive Breath Vibrato';
            if (reedSelectLabel) reedSelectLabel.textContent = 'Sax Type (سیکسوفون کی قسم):';
            if (bellowsAirLabel) bellowsAirLabel.textContent = 'BREATH (پھونک کا دباؤ):';
            if (reedSelect) {
                reedSelect.innerHTML = `
                    <option value="alto" selected>🎷 Smooth Jazz Alto (آلٹو سیکسوفون - Sweet, Singing & Expressive Vibrato)</option>
                    <option value="tenor">🎺 Smoky Late-Night Tenor (ٹینر سیکسوفون - Warm Raspy Lower Register & Deep Brass)</option>
                    <option value="soprano">✨ Melodic Soprano (سوپرانو سیکسوفون - Bright, Agile & Penetrating Lead)</option>
                `;
            }
            engine.setSaxTone('alto');
            engine.playEarcon('toggle-on');
            announce("Studio Saxophone active. Cane reed vibration, conical brass bore and expressive breath vibrato enabled.", 'assertive');
        } else {
            if (instBtnIcon) instBtnIcon.textContent = '🪗';
            if (instBtnText) instBtnText.textContent = 'Instrument: Harmonium (ہارمونیم) [F2 / I]';
            if (instrumentHeaderTitle) instrumentHeaderTitle.textContent = '🪗 INDIAN HARMONIUM (ہارمونیم)';
            if (instrumentHeaderSubtitle) instrumentHeaderSubtitle.textContent = 'Authentic Acoustic Reeds';
            if (reedSelectLabel) reedSelectLabel.textContent = 'Reeds (سریں):';
            if (bellowsAirLabel) bellowsAirLabel.textContent = 'BELLOWS (دھونکنی):';
            if (reedSelect) {
                reedSelect.innerHTML = `
                    <option value="double" selected>Double Reed (Chorus / جوڑی)</option>
                    <option value="triple">Triple Reed (Organ Fullness / تہری)</option>
                    <option value="single">Single Reed (Clean / اکیلی)</option>
                `;
            }
            engine.reedType = 'double';
            engine.playEarcon('toggle-on');
            announce("Indian Harmonium active. Authentic acoustic reed banks restored.", 'assertive');
        }
    }

    function toggleInstrument() {
        const idx = INSTRUMENTS.indexOf(engine.currentInstrument);
        const nextIdx = (idx + 1) % INSTRUMENTS.length;
        switchInstrument(INSTRUMENTS[nextIdx]);
    }

    if (btnToggleInstrument) {
        btnToggleInstrument.addEventListener('click', toggleInstrument);
    }

    if (instrumentSelect) {
        instrumentSelect.addEventListener('change', (e) => {
            switchInstrument(e.target.value);
        });
    }

    // 8 Instrument Cards Deck Click Listeners
    document.querySelectorAll('#instrumentCardsDeck .inst-card').forEach(card => {
        card.addEventListener('click', () => {
            const inst = card.dataset.inst;
            if (inst) switchInstrument(inst);
        });
    });

    function toggleVoiceMode() {
        voiceMode = (voiceMode === 'nvda') ? 'browser' : 'nvda';
        if (voiceMode === 'nvda') {
            voiceModeText.textContent = "Voice: NVDA / JAWS";
            btnVoiceMode.classList.add('active');
            if ('speechSynthesis' in window) window.speechSynthesis.cancel();
            announce("Screen Reader mode active. NVDA and JAWS speak all alerts.", 'assertive');
        } else {
            voiceModeText.textContent = "Voice: Browser TTS";
            btnVoiceMode.classList.remove('active');
            announce("Browser voice active. Computer reads alerts aloud.", 'assertive');
        }
        engine.playEarcon('toggle-on');
    }

    function toggleEasyMode() {
        easyMode = !easyMode;
        document.body.classList.toggle('easy-mode', easyMode);
        btnEasyMode.classList.toggle('active', easyMode);
        btnEasyMode.setAttribute('aria-pressed', easyMode);
        easyModeText.textContent = easyMode ? "Easy Mode: ON" : "Easy Mode: OFF";
        engine.playEarcon(easyMode ? 'toggle-on' : 'toggle-off');
        announce(easyMode ? "Easy Mode enabled. Clutter hidden for clean playing." : "Easy Mode disabled. Full studio controls restored.", 'assertive');
    }

    function toggleSpeakNotes() {
        speakNotesEnabled = !speakNotesEnabled;
        btnToggleSpeakNotes.classList.toggle('active', speakNotesEnabled);
        btnToggleSpeakNotes.setAttribute('aria-pressed', speakNotesEnabled);
        speakNotesBtnText.textContent = speakNotesEnabled ? "Speak Notes: ON" : "Speak Notes: OFF";
        engine.playEarcon(speakNotesEnabled ? 'toggle-on' : 'toggle-off');
        announce(speakNotesEnabled ? "Speaking note names enabled." : "Speaking note names disabled.", 'assertive');
    }

    function toggleHighContrast() {
        highContrastEnabled = !highContrastEnabled;
        document.body.classList.toggle('high-contrast-mode', highContrastEnabled);
        btnHighContrast.classList.toggle('active', highContrastEnabled);
        btnHighContrast.setAttribute('aria-pressed', highContrastEnabled);
        engine.playEarcon(highContrastEnabled ? 'toggle-on' : 'toggle-off');
        announce(highContrastEnabled ? "High contrast mode enabled." : "High contrast mode disabled.", 'assertive');
    }

    const GITHUB_REPO_OWNER = 'shakeelahmadakash64-dev';
    const GITHUB_REPO_NAME = 'pro-music-sound-studio';
    const GITHUB_RAW_VERSION_URL = `https://raw.githubusercontent.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/main/version.json`;

    function compareVersions(v1, v2) {
        const p1 = (v1 || '').split('.').map(n => parseInt(n, 10) || 0);
        const p2 = (v2 || '').split('.').map(n => parseInt(n, 10) || 0);
        for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
            const num1 = p1[i] || 0;
            const num2 = p2[i] || 0;
            if (num1 > num2) return 1;
            if (num1 < num2) return -1;
        }
        return 0;
    }

    function checkAppUpdates() {
        if (updateBtnText) updateBtnText.textContent = "Checking GitHub...";
        engine.playEarcon('toggle-on');
        announce("Checking GitHub repository for latest updates...", 'assertive');

        fetch('./version.json?t=' + Date.now())
            .then(res => res.json())
            .then(localData => {
                const currentVer = localData.version || '4.0.0';

                fetch(GITHUB_RAW_VERSION_URL + '?t=' + Date.now(), { cache: 'no-store' })
                    .then(ghRes => {
                        if (!ghRes.ok) throw new Error('GitHub offline or unreachable');
                        return ghRes.json();
                    })
                    .then(ghData => {
                        const cmp = compareVersions(ghData.version, currentVer);
                        if (cmp > 0) {
                            if (updateBtnText) updateBtnText.textContent = `New v${ghData.version}!`;
                            announce(`Naya update version ${ghData.version} GitHub par dastiyaab hai! Update karne ke liye update_app.bat chalayein.`, 'assertive');
                            if (window.confirm && window.confirm(`Pro Music Studio ka naya update (v${ghData.version}) GitHub par dastiyaab hai!\nKya aap GitHub repository kholna chahtay hain?`)) {
                                window.open(`https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}`, '_blank');
                            }
                        } else {
                            if (updateBtnText) updateBtnText.textContent = `v${currentVer} (Latest)`;
                            announce(`Aap ka Pro Music Studio bilkul up to date hai. Version ${currentVer} GitHub se match karta hai.`, 'assertive');
                        }
                    })
                    .catch(() => {
                        if (updateBtnText) updateBtnText.textContent = `v${currentVer} (Offline)`;
                        announce(`Application 100% offline mode mein chal rahi hai. Local version ${currentVer} mehfooz hai.`, 'assertive');
                    });
            })
            .catch(() => {
                if (updateBtnText) updateBtnText.textContent = "v4.0.0 (Offline)";
                announce("Application 100% offline mode mein verified hai.", 'assertive');
            });
    }

    btnVoiceMode.addEventListener('click', toggleVoiceMode);
    btnEasyMode.addEventListener('click', toggleEasyMode);
    btnToggleSpeakNotes.addEventListener('click', toggleSpeakNotes);
    btnHighContrast.addEventListener('click', toggleHighContrast);
    btnUpdateCheck.addEventListener('click', checkAppUpdates);
    btnPanicStop.addEventListener('click', () => {
        engine.stopAllSound();
        announce("All sounds stopped.", 'assertive');
    });

    // Welcome Audio Prompt on first user touch/key
    function handleFirstInteraction() {
        if (!hasAnnouncedWelcome) {
            hasAnnouncedWelcome = true;
            engine.init();
            announce("Music Studio tayyar hai. Harmonium, Flute, Violin aur Guitar active hain. Instrument badalney ke liye F2 ya I dabayein, Help ke liye F5 ya F1 dabayein, aur H key se Dha sur bajayein.", 'polite');
        }
    }
    window.addEventListener('click', handleFirstInteraction, { once: true });
    window.addEventListener('keydown', handleFirstInteraction, { once: true });

    /* ==========================================================
       KEY DEFINITIONS (Harmonium & Flute 2 Octaves: C3 to C5 - ALL 25 KEYS)
    ========================================================== */
    const keysData = [
        // Octave 1 (C3 to B3)
        { note: 'C3', freq: 130.81, type: 'white', sargam: 'Sa', key: 'a', altKey: '', swarUrdu: 'سا' },
        { note: 'Cs3', freq: 138.59, type: 'black', sargam: 're', key: 'w', altKey: '', swarUrdu: 'رے' },
        { note: 'D3', freq: 146.83, type: 'white', sargam: 'Re', key: 's', altKey: '', swarUrdu: 'رے' },
        { note: 'Ds3', freq: 155.56, type: 'black', sargam: 'ga', key: 'e', altKey: '', swarUrdu: 'گا' },
        { note: 'E3', freq: 164.81, type: 'white', sargam: 'Ga', key: 'd', altKey: '', swarUrdu: 'گا' },
        { note: 'F3', freq: 174.61, type: 'white', sargam: 'ma', key: 'f', altKey: '', swarUrdu: 'ما' },
        { note: 'Fs3', freq: 185.00, type: 'black', sargam: 'Ma', key: 't', altKey: '', swarUrdu: 'ما' },
        { note: 'G3', freq: 196.00, type: 'white', sargam: 'Pa', key: 'g', altKey: '', swarUrdu: 'پا' },
        { note: 'Gs3', freq: 207.65, type: 'black', sargam: 'dha', key: 'y', altKey: '', swarUrdu: 'دھا' },
        { note: 'A3', freq: 220.00, type: 'white', sargam: 'Dha', key: 'h', altKey: '', swarUrdu: 'دھا' },
        { note: 'As3', freq: 233.08, type: 'black', sargam: 'ni', key: 'u', altKey: '', swarUrdu: 'نی' },
        { note: 'B3', freq: 246.94, type: 'white', sargam: 'Ni', key: 'j', altKey: '', swarUrdu: 'نی' },

        // Octave 2 (C4 to C5)
        { note: 'C4', freq: 261.63, type: 'white', sargam: "Sa'", key: 'k', altKey: '', swarUrdu: "سا'" },
        { note: 'Cs4', freq: 277.18, type: 'black', sargam: "re'", key: 'o', altKey: '', swarUrdu: "رے'" },
        { note: 'D4', freq: 293.66, type: 'white', sargam: "Re'", key: 'l', altKey: '', swarUrdu: "رے'" },
        { note: 'Ds4', freq: 311.13, type: 'black', sargam: "ga'", key: 'p', altKey: '', swarUrdu: "گا'" },
        { note: 'E4', freq: 329.63, type: 'white', sargam: "Ga'", key: ';', altKey: '', swarUrdu: "گا'" },
        { note: 'F4', freq: 349.23, type: 'white', sargam: "ma'", key: "'", altKey: '', swarUrdu: "ما'" },
        { note: 'Fs4', freq: 369.99, type: 'black', sargam: "Ma'", key: '[', altKey: '', swarUrdu: "ما'" },
        { note: 'G4', freq: 392.00, type: 'white', sargam: "Pa'", key: ']', altKey: '', swarUrdu: "پا'" },
        { note: 'Gs4', freq: 415.30, type: 'black', sargam: "dha'", key: '', altKey: 'numpad1', swarUrdu: "دھا'" },
        { note: 'A4', freq: 440.00, type: 'white', sargam: "Dha'", key: '-', altKey: 'numpad2', swarUrdu: "دھا'" },
        { note: 'As4', freq: 466.16, type: 'black', sargam: "ni'", key: '=', altKey: 'numpad3', swarUrdu: "نی'" },
        { note: 'B4', freq: 493.88, type: 'white', sargam: "Ni'", key: '\\', altKey: 'numpad4', swarUrdu: "نی'" },
        { note: 'C5', freq: 523.25, type: 'white', sargam: "Sa''", key: '`', altKey: 'numpad5', swarUrdu: "سا''" }
    ];

    let octaveShift = 0; // -1, 0, +1
    let notationMode = 'both';
    let isMouseDown = false;
    const pressedKeyCodes = new Set();
    const keyMap = new Map(); // 'a' -> note object

    /* ==========================================================
       RENDER HARMONIUM KEYBOARD WITH ARIA METADATA
    ========================================================== */
    function renderKeyboard() {
        harmoniumKeyboard.innerHTML = '';
        keyMap.clear();

        const whiteKeyWidth = 54;
        const blackKeyWidth = 34;
        let whiteKeyIndex = 0;

        keysData.forEach((k) => {
            if (k.key) {
                keyMap.set(k.key.toLowerCase(), k);
            }

            const keyEl = document.createElement('div');
            keyEl.className = `key ${k.type}`;
            keyEl.dataset.note = k.note;
            keyEl.dataset.baseFreq = k.freq;
            keyEl.setAttribute('role', 'button');
            keyEl.setAttribute('tabindex', '0');
            const shortcutDesc = k.key ? k.key.toUpperCase() : (k.altKey === 'numpad1' ? 'Numpad 1 or Shift+Y' : 'mouse only');
            keyEl.setAttribute('aria-label', `${k.sargam}, Note ${k.note.replace('s', ' sharp')}, ${k.type} key, shortcut ${shortcutDesc}`);

            if (k.type === 'white') {
                keyEl.style.left = `${whiteKeyIndex * whiteKeyWidth}px`;
                whiteKeyIndex++;
            } else {
                keyEl.style.left = `${(whiteKeyIndex * whiteKeyWidth) - (blackKeyWidth / 2)}px`;
            }

            updateKeyLabels(keyEl, k);
            attachKeyEvents(keyEl, k);
            harmoniumKeyboard.appendChild(keyEl);
        });

        harmoniumKeyboard.style.width = `${whiteKeyIndex * whiteKeyWidth}px`;
    }

    function updateKeyLabels(keyEl, k) {
        let labelHtml = '';
        const baseNote = k.note.replace(/[0-9]/g, '');
        const keyHint = k.key ? k.key.toUpperCase() : (k.altKey === 'numpad1' ? 'Num1' : '');
        const hintHtml = keyHint ? `<span class="key-hint">${keyHint}</span>` : '';

        if (notationMode === 'both') {
            labelHtml = `
                <span class="swar-label">${k.sargam}</span>
                <span class="key-label">${baseNote}</span>
                ${hintHtml}
            `;
        } else if (notationMode === 'sargam') {
            labelHtml = `
                <span class="swar-label">${k.sargam}</span>
                <span class="swar-label" style="font-size:0.7rem; opacity:0.8;">${k.swarUrdu}</span>
                ${hintHtml}
            `;
        } else {
            labelHtml = `
                <span class="key-label">${baseNote}</span>
                ${hintHtml}
            `;
        }

        keyEl.innerHTML = labelHtml;
    }

    function getFrequency(baseFreq) {
        return baseFreq * Math.pow(2, octaveShift);
    }

    function pressHarmoniumKey(keyEl, k) {
        if (!keyEl.classList.contains('active')) {
            keyEl.classList.add('active');
            const freq = getFrequency(k.freq);
            engine.playHarmoniumNote(freq, k.note);
            animateBellows(true);

            if (speakNotesEnabled) {
                announce(`${k.sargam}`, true);
            }
        }
    }

    function releaseHarmoniumKey(keyEl, k) {
        if (keyEl.classList.contains('active')) {
            keyEl.classList.remove('active');
            engine.stopHarmoniumNote(k.note);
            checkActiveKeysBellows();
        }
    }

    function attachKeyEvents(keyEl, k) {
        // Mouse Down
        keyEl.addEventListener('mousedown', (e) => {
            e.preventDefault();
            pressHarmoniumKey(keyEl, k);
        });

        // Mouse Enter while dragging (Glissando)
        keyEl.addEventListener('mouseenter', () => {
            if (isMouseDown) {
                pressHarmoniumKey(keyEl, k);
            }
        });

        keyEl.addEventListener('mouseleave', () => {
            releaseHarmoniumKey(keyEl, k);
        });

        keyEl.addEventListener('mouseup', () => {
            releaseHarmoniumKey(keyEl, k);
        });

        // Touch events
        keyEl.addEventListener('touchstart', (e) => {
            e.preventDefault();
            pressHarmoniumKey(keyEl, k);
        }, { passive: false });

        keyEl.addEventListener('touchend', (e) => {
            e.preventDefault();
            releaseHarmoniumKey(keyEl, k);
        });

        // Keyboard Focus Accessibility: Space / Enter to play focused key
        keyEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                pressHarmoniumKey(keyEl, k);
            }
        });

        keyEl.addEventListener('keyup', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                releaseHarmoniumKey(keyEl, k);
            }
        });
    }

    function animateBellows(start) {
        if (start) {
            bellowsIndicator.classList.add('bellows-pumping');
        } else {
            bellowsIndicator.classList.remove('bellows-pumping');
        }
    }

    function checkActiveKeysBellows() {
        const anyActive = document.querySelector('.key.active');
        if (!anyActive) {
            animateBellows(false);
        }
    }

    // Global Mouse Tracker for Glissando
    document.addEventListener('mousedown', () => { isMouseDown = true; });
    document.addEventListener('mouseup', () => {
        isMouseDown = false;
        keysData.forEach(k => {
            const el = document.querySelector(`.key[data-note="${k.note}"]`);
            if (el) releaseHarmoniumKey(el, k);
        });
    });

    /* ==========================================================
       DRUM, TABLA & PUNJABI WEDDING DHOL BANK SYSTEM
    ========================================================== */
    const dholKeyMap = {
        '1': { type: 'dhol-dhum', name: 'Dhol Dhum (ڈھم - بڑا بول)' },
        '2': { type: 'dhol-dagga', name: 'Dhol Dagga Bass (ڈگا بیس)' },
        '3': { type: 'dhol-tilli', name: 'Dhol Tilli Snap (تلی چھانٹ)' },
        '4': { type: 'dhol-roll', name: 'Dhol Tilli Roll (تلی رول)' },
        '5': { type: 'dhol-ghad', name: 'Dhol Ghad (گھڑ - ڈبل بیس)' },
        '6': { type: 'dhol-khad', name: 'Dhol Khad (کھڑ - تھپ)' },
        '7': { type: 'dhol-takk', name: 'Dhol Takk (تک - کناری)' },
        '8': { type: 'dhol-dhamal', name: 'Dhol Dhamal (دھمال جھٹکا)' }
    };

    const standardDrumKeyMap = {
        '1': { type: 'kick', name: 'Kick Bass Drum' },
        '2': { type: 'snare', name: 'Snare' },
        '3': { type: 'hihat-closed', name: 'Hi-Hat Closed' },
        '4': { type: 'hihat-open', name: 'Hi-Hat Open' },
        '5': { type: 'tom-high', name: 'High Tom' },
        '6': { type: 'tom-low', name: 'Low Tom' },
        '7': { type: 'crash', name: 'Crash Cymbal' },
        '8': { type: 'clap', name: 'Hand Clap' }
    };

    const tablaNumberedKeyMap = {
        '1': { type: 'tabla-dha', name: 'Tabla Dha (دھا)' },
        '2': { type: 'tabla-ge', name: 'Tabla Ge (گے)' },
        '3': { type: 'tabla-na', name: 'Tabla Na (نا)' },
        '4': { type: 'tabla-tin', name: 'Tabla Tin (تین)' },
        '5': { type: 'tabla-tun', name: 'Tabla Tun (ٹُن)' },
        '6': { type: 'tabla-ke', name: 'Tabla Ke (کے)' },
        '7': { type: 'tabla-dhin', name: 'Tabla Dhin (دھن)' },
        '8': { type: 'tabla-ti', name: 'Tabla Ti (تی)' }
    };

    const tablaDirectBolsMap = {
        'z': { type: 'tabla-dha', name: 'Tabla Dha (دھا)' },
        'x': { type: 'tabla-ge', name: 'Tabla Ge (گے)' },
        'c': { type: 'tabla-na', name: 'Tabla Na (نا)' },
        'v': { type: 'tabla-tin', name: 'Tabla Tin (تین)' },
        'b': { type: 'tabla-tun', name: 'Tabla Tun (ٹُن)' },
        'n': { type: 'tabla-ke', name: 'Tabla Ke (کے)' },
        'm': { type: 'tabla-dhin', name: 'Tabla Dhin (دھن)' },
        ',': { type: 'tabla-ti', name: 'Tabla Ti (تی)' },
        '.': { type: 'tabla-te', name: 'Tabla Te (ٹے)' },
        '/': { type: 'tabla-ghe', name: 'Tabla Ghe (گھے)' },
        'q': { type: 'tabla-thun', name: 'Tabla Thun (ٹھن)' },
        'r': { type: 'tabla-tak', name: 'Tabla Tak (تک)' },
        '9': { type: 'tabla-chap', name: 'Tabla Chap (چپ)' },
        '0': { type: 'tabla-kda', name: 'Tabla Kda (کدا)' },
        '`': { type: 'tabla-dhage', name: 'Tabla Dha-Ge (دھاگے)' },
        '\\': { type: 'tabla-trkt', name: 'Tabla Tir-Kit (ترکٹ)' }
    };

    function getPercussionHit(key) {
        // Direct tabla keys (z to /, etc.) always work
        if (tablaDirectBolsMap[key]) return tablaDirectBolsMap[key];

        // Numbers 1 to 8 work based on active percussion bank
        if (['1', '2', '3', '4', '5', '6', '7', '8'].includes(key)) {
            if (currentPercBank === 'dhol') return dholKeyMap[key];
            if (currentPercBank === 'tabla') return tablaNumberedKeyMap[key];
            if (currentPercBank === 'drums') return standardDrumKeyMap[key];
        }
        return null;
    }

    function setPercussionBank(bank) {
        currentPercBank = bank;
        percBankBtns.forEach(b => {
            const isActive = b.dataset.bank === bank;
            b.classList.toggle('active', isActive);
            b.setAttribute('aria-checked', isActive ? 'true' : 'false');
        });

        const names = {
            dhol: 'Wedding Dhol (شادی کا روایتی ڈھول)',
            tabla: 'Classical Tabla (طبلہ)',
            drums: 'Standard Drum Kit (ڈرمز)'
        };
        const activeName = names[bank] || bank;
        if (percBankBtnText) percBankBtnText.textContent = `Percussion: ${activeName} [F3]`;

        announce(`Percussion Bank set to ${activeName}. Keys 1 to 8 active.`);
    }

    function cyclePercBank() {
        const banks = ['dhol', 'tabla', 'drums'];
        const nextIdx = (banks.indexOf(currentPercBank) + 1) % banks.length;
        setPercussionBank(banks[nextIdx]);
    }

    function triggerDrum(type, padEl, name = '') {
        engine.playDrum(type);
        if (padEl) {
            padEl.classList.add('hit');
            setTimeout(() => padEl.classList.remove('hit'), 120);
        }
        if (speakNotesEnabled && name) {
            announce(name, true);
        }
    }

    // Percussion Bank Buttons Listener
    percBankBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            setPercussionBank(btn.dataset.bank);
        });
    });

    if (btnTogglePercBank) {
        btnTogglePercBank.addEventListener('click', () => {
            cyclePercBank();
        });
    }

    drumPads.forEach(pad => {
        const drumType = pad.dataset.drum;
        const padName = pad.querySelector('.pad-name') ? pad.querySelector('.pad-name').textContent : drumType;
        pad.setAttribute('role', 'button');
        pad.setAttribute('tabindex', '0');
        pad.setAttribute('aria-label', `${padName}, shortcut key ${pad.dataset.key.toUpperCase()}`);

        pad.addEventListener('mousedown', (e) => {
            e.preventDefault();
            triggerDrum(drumType, pad, padName);
        });

        pad.addEventListener('touchstart', (e) => {
            e.preventDefault();
            triggerDrum(drumType, pad, padName);
        }, { passive: false });

        pad.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                triggerDrum(drumType, pad, padName);
            }
        });
    });


    /* ==========================================================
       STUDIO SETTINGS MODAL & ACCESSIBILITY DIALOG
       Shortcut: F4 or Alt + O
    ========================================================== */
    const settingsModal = document.getElementById('settingsModal');
    const btnOpenSettings = document.getElementById('btnOpenSettings');
    const btnCloseSettings = document.getElementById('btnCloseSettings');
    const btnSaveSettings = document.getElementById('btnSaveSettings');
    const settingsOverlay = document.getElementById('settingsOverlay');
    const btnToggleEarcons = document.getElementById('btnToggleEarcons');
    const settingThemeSelect = document.getElementById('settingThemeSelect');
    const settingTuning = document.getElementById('settingTuning');

    function isSettingsModalOpen() {
        return settingsModal && !settingsModal.hidden && settingsModal.style.display !== 'none';
    }

    function openSettings() {
        if (!settingsModal) return;
        settingsModal.hidden = false;
        settingsModal.style.display = 'flex';
        engine.playEarcon('modal-open');
        announce("Studio Settings menu open. Use Tab to navigate options or Escape to close.", 'assertive');
        if (btnCloseSettings) btnCloseSettings.focus();
    }

    function closeSettings() {
        if (!settingsModal) return;
        settingsModal.hidden = true;
        settingsModal.style.display = 'none';
        engine.playEarcon('modal-close');
        announce("Settings menu closed.", 'assertive');
        if (btnOpenSettings) btnOpenSettings.focus();
    }

    function toggleSettings() {
        if (isSettingsModalOpen()) {
            closeSettings();
        } else {
            openSettings();
        }
    }

    if (btnOpenSettings) btnOpenSettings.addEventListener('click', openSettings);
    if (btnCloseSettings) btnCloseSettings.addEventListener('click', closeSettings);
    if (btnSaveSettings) btnSaveSettings.addEventListener('click', closeSettings);
    if (settingsOverlay) settingsOverlay.addEventListener('click', closeSettings);

    // Settings Tabs switching
    document.querySelectorAll('.settings-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            document.querySelectorAll('.settings-tab-btn').forEach(b => {
                const isActive = b === btn;
                b.classList.toggle('active', isActive);
                b.setAttribute('aria-selected', isActive ? 'true' : 'false');
            });
            document.querySelectorAll('.settings-tab-pane').forEach(pane => {
                pane.classList.toggle('active', pane.id === tabId);
            });
            engine.playEarcon('toggle-on');
        });
    });

    // Theme selector in settings
    if (settingThemeSelect) {
        settingThemeSelect.addEventListener('change', (e) => {
            const theme = e.target.value;
            document.body.classList.remove('theme-dark-gold', 'theme-midnight-blue', 'theme-wood-classic');
            document.body.classList.add(`theme-${theme}`);
            announce(`Studio theme changed to ${settingThemeSelect.options[settingThemeSelect.selectedIndex].text}`);
        });
    }

    // Earcons toggle
    let earconsEnabled = true;
    if (btnToggleEarcons) {
        btnToggleEarcons.addEventListener('click', () => {
            earconsEnabled = !earconsEnabled;
            btnToggleEarcons.innerHTML = earconsEnabled ? '<span>🔔 Earcons: ON</span>' : '<span>🔕 Earcons: OFF</span>';
            btnToggleEarcons.classList.toggle('active', earconsEnabled);
            announce(`Audio earcons ${earconsEnabled ? 'enabled' : 'disabled'}`);
        });
    }

    // Collapsible FX Rack
    const btnToggleFxRack = document.getElementById('btnToggleFxRack');
    const rackGrid = document.getElementById('rackGrid');
    const fxRackToggleIcon = document.getElementById('fxRackToggleIcon');
    let isFxRackExpanded = true;

    if (btnToggleFxRack && rackGrid) {
        btnToggleFxRack.addEventListener('click', () => {
            isFxRackExpanded = !isFxRackExpanded;
            rackGrid.style.display = isFxRackExpanded ? 'grid' : 'none';
            btnToggleFxRack.setAttribute('aria-expanded', isFxRackExpanded ? 'true' : 'false');
            if (fxRackToggleIcon) fxRackToggleIcon.textContent = isFxRackExpanded ? '▼' : '▶';
            engine.playEarcon('toggle-on');
            announce(`Studio Effects Rack ${isFxRackExpanded ? 'expanded' : 'collapsed'}`);
        });
    }

    /* ==========================================================
       KEYBOARD SHORTCUTS LISTENER FOR PLAYING & ACCESSIBILITY
       - All 25 Harmonium / Flute keys playable
       - All 8 Drum kit pieces playable
       - All 16 Tabla bols playable
       - Octave shifting on PageUp/PageDown, freed '[' and ']'
    ========================================================== */
    window.addEventListener('keydown', (e) => {
        // Instrument Switching Shortcuts: F2, I, Alt+F, Alt+I
        if (e.key === 'F2' || (e.altKey && (e.key.toLowerCase() === 'f' || e.key.toLowerCase() === 'i'))) {
            e.preventDefault();
            toggleInstrument();
            return;
        }

        // Percussion Bank Switching Shortcuts: F3, Alt+K
        if (e.key === 'F3' || (e.altKey && e.key.toLowerCase() === 'k')) {
            e.preventDefault();
            cyclePercBank();
            return;
        }

        // Single key 'I' for dedicated Instrument toggle
        if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'i' &&
            document.activeElement.tagName !== 'INPUT' &&
            document.activeElement.tagName !== 'SELECT' &&
            document.activeElement.tagName !== 'TEXTAREA') {
            e.preventDefault();
            toggleInstrument();
            return;
        }
        if (e.altKey && e.key.toLowerCase() === 'v') {
            e.preventDefault();
            toggleVoiceMode();
            return;
        }
        if (e.altKey && e.key.toLowerCase() === 'm') {
            e.preventDefault();
            toggleVoiceMode();
            return;
        }
        if (e.altKey && e.key.toLowerCase() === 'e') {
            e.preventDefault();
            toggleEasyMode();
            return;
        }
        if (e.altKey && e.key.toLowerCase() === 'u') {
            e.preventDefault();
            checkAppUpdates();
            return;
        }
        if (e.altKey && e.key.toLowerCase() === 'n') {
            e.preventDefault();
            toggleSpeakNotes();
            return;
        }
        if (e.altKey && e.key.toLowerCase() === 'c') {
            e.preventDefault();
            toggleHighContrast();
            return;
        }
        if (e.altKey && e.key.toLowerCase() === 's') {
            e.preventDefault();
            cycleStudioFxPreset();
            return;
        }
        if (e.altKey && e.key.toLowerCase() === 'r') {
            e.preventDefault();
            cycleReverbPreset();
            return;
        }
        if (e.altKey && e.key.toLowerCase() === 'd') {
            e.preventDefault();
            toggleDelayEffect();
            return;
        }
        if (e.altKey && e.key.toLowerCase() === 'w') {
            e.preventDefault();
            toggleTubeWarmthEffect();
            return;
        }

        // Text Help Modal Shortcuts: F5 or F1 ('H' key is strictly used for playing Dha / A3 note)
        if (e.key === 'F5' || e.key === 'F1') {
            e.preventDefault();
            if (isHelpModalOpen()) {
                closeTextHelp();
            } else {
                openTextHelp();
            }
            return;
        }

        // Studio Settings Modal Shortcut: F4 or Alt + O
        if (e.key === 'F4' || (e.altKey && e.key.toLowerCase() === 'o')) {
            e.preventDefault();
            toggleSettings();
            return;
        }

        // Cycle Instrument backward: Shift + F2
        if (e.key === 'F2' && e.shiftKey) {
            e.preventDefault();
            const idx = INSTRUMENTS.indexOf(engine.currentInstrument);
            const prevIdx = (idx - 1 + INSTRUMENTS.length) % INSTRUMENTS.length;
            switchInstrument(INSTRUMENTS[prevIdx]);
            return;
        }

        // Panic Stop & Modal Close (Escape)
        if (e.key === 'Escape') {
            e.preventDefault();
            if (isSettingsModalOpen()) {
                closeSettings();
                return;
            }
            if (isHelpModalOpen()) {
                closeTextHelp();
                return;
            }
            engine.stopAllSound();
            announce("All sounds stopped.");
            return;
        }

        // Ignore regular playing keys if user is typing in form controls
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

        // Spacebar shortcut to Start/Stop Rhythm Looper
        if (e.code === 'Space' && document.activeElement.tagName !== 'BUTTON') {
            e.preventDefault();
            toggleRhythm();
            return;
        }

        // Octave Shifting: PageUp (Taar/High) and PageDown (Mandra/Low), or Alt+[ / Alt+]
        if (e.key === 'PageUp' || (e.altKey && e.key === 'ArrowUp') || (e.altKey && e.key === ']')) {
            e.preventDefault();
            if (octaveShift < 1) {
                octaveShift++;
                octaveSelect.value = octaveShift;
                engine.stopAllHarmoniumNotes();
                engine.playEarcon('octave-up');
                announce(`Octave set to ${octaveShift === 1 ? 'Taar Saptak, High' : 'Madhya Saptak, Normal'}`);
            }
            return;
        }
        if (e.key === 'PageDown' || (e.altKey && e.key === 'ArrowDown') || (e.altKey && e.key === '[')) {
            e.preventDefault();
            if (octaveShift > -1) {
                octaveShift--;
                octaveSelect.value = octaveShift;
                engine.stopAllHarmoniumNotes();
                engine.playEarcon('octave-down');
                announce(`Octave set to ${octaveShift === -1 ? 'Mandra Saptak, Low' : 'Madhya Saptak, Normal'}`);
            }
            return;
        }

        // Tempo Shifting: Alt + '+' (Faster) and Alt + '-' (Slower)
        if (e.altKey && (e.key === '+' || e.key === '=')) {
            e.preventDefault();
            const newBpm = Math.min(200, engine.bpm + 5);
            tempoSlider.value = newBpm;
            bpmDisplay.textContent = `${newBpm} BPM`;
            engine.updateTempo(newBpm);
            announce(`Tempo ${newBpm} BPM`);
            return;
        }
        if (e.altKey && (e.key === '-' || e.key === '_')) {
            e.preventDefault();
            const newBpm = Math.max(60, engine.bpm - 5);
            tempoSlider.value = newBpm;
            bpmDisplay.textContent = `${newBpm} BPM`;
            engine.updateTempo(newBpm);
            announce(`Tempo ${newBpm} BPM`);
            return;
        }

        const key = e.key.toLowerCase();
        const code = e.code.toLowerCase();

        // 1. High Notes Check: Numpad keys (Numpad 1 to 5 for Gs4, A4, As4, B4, C5)
        let specialNote = null;
        if (code === 'numpad1') specialNote = keysData.find(k => k.note === 'Gs4');
        else if (code === 'numpad2') specialNote = keysData.find(k => k.note === 'A4');
        else if (code === 'numpad3') specialNote = keysData.find(k => k.note === 'As4');
        else if (code === 'numpad4') specialNote = keysData.find(k => k.note === 'B4');
        else if (code === 'numpad5') specialNote = keysData.find(k => k.note === 'C5');

        // 2. High Notes Check: Shift combinations (Shift+Y, Shift+H, Shift+U, Shift+J, Shift+K)
        if (!specialNote && e.shiftKey) {
            if (key === 'y') specialNote = keysData.find(k => k.note === 'Gs4');
            else if (key === 'h') specialNote = keysData.find(k => k.note === 'A4');
            else if (key === 'u') specialNote = keysData.find(k => k.note === 'As4');
            else if (key === 'j') specialNote = keysData.find(k => k.note === 'B4');
            else if (key === 'k') specialNote = keysData.find(k => k.note === 'C5');
        }

        // 3. High Notes in Harmonium Only Mode: keys 1 to 5
        if (!specialNote && currentAppMode === 'harmonium') {
            if (key === '1') specialNote = keysData.find(k => k.note === 'Gs4');
            else if (key === '2') specialNote = keysData.find(k => k.note === 'A4');
            else if (key === '3') specialNote = keysData.find(k => k.note === 'As4');
            else if (key === '4') specialNote = keysData.find(k => k.note === 'B4');
            else if (key === '5') specialNote = keysData.find(k => k.note === 'C5');
        }

        if (specialNote) {
            if (pressedKeyCodes.has('special_' + specialNote.note)) return;
            pressedKeyCodes.add('special_' + specialNote.note);
            const keyEl = document.querySelector(`.key[data-note="${specialNote.note}"]`);
            if (keyEl) pressHarmoniumKey(keyEl, specialNote);
            return;
        }

        if (pressedKeyCodes.has(key)) return;
        pressedKeyCodes.add(key);

        // 4. Drum, Dhol or Tabla hit (Active in Dual Mode or Drums Only Mode)
        const percHit = getPercussionHit(key);
        if (currentAppMode !== 'harmonium' && percHit) {
            const { type, name } = percHit;
            const padEl = document.querySelector(`.drum-pad[data-drum="${type}"]`);
            triggerDrum(type, padEl, name);
            return;
        }

        // 5. Harmonium / Flute key press (Active in Dual Mode or Harmonium Only Mode)
        if (currentAppMode !== 'drums' && keyMap.has(key)) {
            const k = keyMap.get(key);
            const keyEl = document.querySelector(`.key[data-note="${k.note}"]`);
            if (keyEl) {
                pressHarmoniumKey(keyEl, k);
            }
        }
    });

    window.addEventListener('keyup', (e) => {
        const key = e.key.toLowerCase();
        const code = e.code.toLowerCase();
        pressedKeyCodes.delete(key);

        // Numpad key release
        let specialNote = null;
        if (code === 'numpad1') specialNote = keysData.find(k => k.note === 'Gs4');
        else if (code === 'numpad2') specialNote = keysData.find(k => k.note === 'A4');
        else if (code === 'numpad3') specialNote = keysData.find(k => k.note === 'As4');
        else if (code === 'numpad4') specialNote = keysData.find(k => k.note === 'B4');
        else if (code === 'numpad5') specialNote = keysData.find(k => k.note === 'C5');

        if (specialNote) {
            pressedKeyCodes.delete('special_' + specialNote.note);
            const keyEl = document.querySelector(`.key[data-note="${specialNote.note}"]`);
            if (keyEl) releaseHarmoniumKey(keyEl, specialNote);
            return;
        }

        // Shift key releases
        ['Gs4', 'A4', 'As4', 'B4', 'C5'].forEach(noteName => {
            if (pressedKeyCodes.has('special_' + noteName)) {
                pressedKeyCodes.delete('special_' + noteName);
                const k = keysData.find(x => x.note === noteName);
                const keyEl = document.querySelector(`.key[data-note="${noteName}"]`);
                if (keyEl && k) releaseHarmoniumKey(keyEl, k);
            }
        });

        if (keyMap.has(key)) {
            const k = keyMap.get(key);
            const keyEl = document.querySelector(`.key[data-note="${k.note}"]`);
            if (keyEl) {
                releaseHarmoniumKey(keyEl, k);
            }
        }
    });

    /* ==========================================================
       DRONE (SUR) CONTROLS WITH VOICE ANNOUNCEMENTS
    ========================================================== */
    droneBtns.forEach(btn => {
        btn.setAttribute('role', 'button');
        btn.setAttribute('tabindex', '0');
        btn.addEventListener('click', () => {
            const freq = parseFloat(btn.dataset.freq);
            const id = btn.dataset.drone;
            const title = btn.querySelector('span') ? btn.querySelector('span').textContent : id;

            const isPlaying = engine.toggleDrone(freq, id);

            droneBtns.forEach(b => b.classList.remove('active'));
            if (isPlaying) {
                btn.classList.add('active');
                engine.playEarcon('toggle-on');
                announce(`Continuous drone note ${title} started.`);
            } else {
                engine.playEarcon('toggle-off');
                announce("Continuous drone stopped.");
            }
        });
    });

    btnStopDrone.addEventListener('click', () => {
        engine.stopDrone();
        droneBtns.forEach(b => b.classList.remove('active'));
        engine.playEarcon('toggle-off');
        announce("Continuous drone stopped.");
    });

    /* ==========================================================
       RHYTHM LOOPER WITH ACCESSIBILITY
    ========================================================== */
    function toggleRhythm() {
        if (engine.isPlayingRhythm) {
            engine.stopRhythm();
            btnPlayRhythm.classList.remove('playing');
            rhythmPlayIcon.textContent = '▶️';
            rhythmPlayText.textContent = 'Start Loop (تال چلائیں)';
            stepLeds.forEach(led => led.classList.remove('active'));
            engine.playEarcon('toggle-off');
            announce("Rhythm loop stopped.");
        } else {
            const selectedTaal = rhythmSelect.value;
            const taalName = rhythmSelect.options[rhythmSelect.selectedIndex].text.split('(')[0].trim();
            engine.startRhythm(selectedTaal, (step) => {
                stepLeds.forEach((led, idx) => {
                    led.classList.toggle('active', idx === (step % stepLeds.length));
                });
            });
            btnPlayRhythm.classList.add('playing');
            rhythmPlayIcon.textContent = '⏹️';
            rhythmPlayText.textContent = 'Stop Loop (بند کریں)';
            engine.playEarcon('toggle-on');
            announce(`${taalName} rhythm playing at ${engine.bpm} BPM.`);
        }
    }

    btnPlayRhythm.addEventListener('click', toggleRhythm);

    rhythmSelect.addEventListener('change', () => {
        const taalName = rhythmSelect.options[rhythmSelect.selectedIndex].text.split('(')[0].trim();
        if (engine.isPlayingRhythm) {
            const selectedTaal = rhythmSelect.value;
            engine.startRhythm(selectedTaal, (step) => {
                stepLeds.forEach((led, idx) => {
                    led.classList.toggle('active', idx === (step % stepLeds.length));
                });
            });
            announce(`Switched rhythm to ${taalName}`);
        } else {
            announce(`Selected rhythm: ${taalName}`);
        }
    });

    tempoSlider.addEventListener('input', (e) => {
        const bpm = parseInt(e.target.value);
        bpmDisplay.textContent = `${bpm} BPM`;
        engine.updateTempo(bpm);
    });

    tempoSlider.addEventListener('change', (e) => {
        announce(`Tempo set to ${e.target.value} BPM`);
    });

    /* ==========================================================
       HARMONIUM & FLUTE SETTINGS (REEDS / TONE, OCTAVE, NOTATION)
    ========================================================== */
    reedSelect.addEventListener('change', (e) => {
        engine.setTone(e.target.value);
        const text = reedSelect.options[reedSelect.selectedIndex].text;
        announce(`Instrument tone set to ${text}`);
    });

    octaveSelect.addEventListener('change', (e) => {
        octaveShift = parseInt(e.target.value);
        engine.stopAllHarmoniumNotes();
        const text = octaveSelect.options[octaveSelect.selectedIndex].text;
        announce(`Instrument octave set to ${text}`);
    });

    notationSelect.addEventListener('change', (e) => {
        notationMode = e.target.value;
        document.querySelectorAll('.key').forEach(keyEl => {
            const noteName = keyEl.dataset.note;
            const k = keysData.find(item => item.note === noteName);
            if (k) updateKeyLabels(keyEl, k);
        });
        announce(`Display notation set to ${notationSelect.options[notationSelect.selectedIndex].text}`);
    });

    /* ==========================================================
       VOLUME CONTROLS WITH FEEDBACK
    ========================================================== */
    volMaster.addEventListener('input', (e) => {
        engine.init();
        engine.masterGain.gain.setValueAtTime(parseFloat(e.target.value), engine.ctx.currentTime);
    });
    volMaster.addEventListener('change', (e) => {
        announce(`Master volume ${Math.round(e.target.value * 100)} percent`);
    });

    volHarmonium.addEventListener('input', (e) => {
        engine.init();
        engine.harmoniumGain.gain.setValueAtTime(parseFloat(e.target.value), engine.ctx.currentTime);
    });
    volHarmonium.addEventListener('change', (e) => {
        announce(`Melodic volume ${Math.round(e.target.value * 100)} percent`);
    });

    volDrums.addEventListener('input', (e) => {
        engine.init();
        engine.drumsGain.gain.setValueAtTime(parseFloat(e.target.value), engine.ctx.currentTime);
    });
    volDrums.addEventListener('change', (e) => {
        announce(`Drums volume ${Math.round(e.target.value * 100)} percent`);
    });

    /* ==========================================================
       RECORDING & EXPORT WITH AUDIO CUES
    ========================================================== */
    btnRecord.addEventListener('click', async () => {
        if (!engine.isRecording) {
            const started = engine.startRecording();
            if (started) {
                engine.playEarcon('record-start');
                btnRecord.classList.add('recording');
                recSeconds = 0;
                btnDownload.style.display = 'none';
                announce("Audio recording started.");
                recTimerInterval = setInterval(() => {
                    recSeconds++;
                    const mins = String(Math.floor(recSeconds / 60)).padStart(2, '0');
                    const secs = String(recSeconds % 60).padStart(2, '0');
                    recText.textContent = `Recording (${mins}:${secs})`;
                }, 1000);
            }
        } else {
            clearInterval(recTimerInterval);
            recText.textContent = 'Record (ریکارڈ)';
            btnRecord.classList.remove('recording');
            engine.playEarcon('record-stop');

            const result = await engine.stopRecording();
            if (result && result.url) {
                btnDownload.href = result.url;
                btnDownload.download = `harmonium-flute-session-${Date.now()}.webm`;
                btnDownload.style.display = 'inline-flex';
                btnDownload.textContent = '⬇️ Download Recording (.webm)';
                announce("Recording stopped. File ready for download.");
                btnDownload.focus();
            }
        }
    });

    /* ==========================================================
       MODE SWITCHER WITH VOICE ANNOUNCEMENT
    ========================================================== */
    modeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            modeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const mode = btn.dataset.mode;
            currentAppMode = mode;
            document.body.classList.remove('mode-harmonium-only', 'mode-drums-only', 'mode-dual');
            if (mode === 'harmonium') {
                document.body.classList.add('mode-harmonium-only');
                announce("Harmonium and Flute only mode selected.");
            } else if (mode === 'drums') {
                document.body.classList.add('mode-drums-only');
                announce("Drums and Tabla only mode selected.");
            } else {
                document.body.classList.add('mode-dual');
                announce("Dual mode selected. Both harmonium/flute and drums active.");
            }
        });
    });

    /* ==========================================================
       SONG TUTORIALS & INTERACTIVE PRACTICE ENGINE
    ========================================================== */
    const songsData = [
        {
            id: 'hbd',
            title: 'Happy Birthday to You (سالگرہ مبارک)',
            desc: 'آسان ترین دھن — اپنے کی بورڈ سے A, S, D, F کیز دبائیں۔',
            taal: 'rock',
            bpm: 100,
            notes: [
                { swar: 'Sa', note: 'C3', key: 'A', dur: 350 },
                { swar: 'Sa', note: 'C3', key: 'A', dur: 350 },
                { swar: 'Re', note: 'D3', key: 'S', dur: 500 },
                { swar: 'Sa', note: 'C3', key: 'A', dur: 500 },
                { swar: 'Ma', note: 'F3', key: 'F', dur: 500 },
                { swar: 'Ga', note: 'E3', key: 'D', dur: 800 },

                { swar: 'Sa', note: 'C3', key: 'A', dur: 350 },
                { swar: 'Sa', note: 'C3', key: 'A', dur: 350 },
                { swar: 'Re', note: 'D3', key: 'S', dur: 500 },
                { swar: 'Sa', note: 'C3', key: 'A', dur: 500 },
                { swar: 'Pa', note: 'G3', key: 'G', dur: 500 },
                { swar: 'Ma', note: 'F3', key: 'F', dur: 800 },

                { swar: 'Sa', note: 'C3', key: 'A', dur: 350 },
                { swar: 'Sa', note: 'C3', key: 'A', dur: 350 },
                { swar: "Sa'", note: 'C4', key: 'K', dur: 500 },
                { swar: 'Dha', note: 'A3', key: 'H', dur: 500 },
                { swar: 'Ma', note: 'F3', key: 'F', dur: 500 },
                { swar: 'Ga', note: 'E3', key: 'D', dur: 500 },
                { swar: 'Re', note: 'D3', key: 'S', dur: 700 },

                { swar: 'Ni', note: 'B3', key: 'J', dur: 350 },
                { swar: 'Ni', note: 'B3', key: 'J', dur: 350 },
                { swar: 'Dha', note: 'A3', key: 'H', dur: 500 },
                { swar: 'Ma', note: 'F3', key: 'F', dur: 500 },
                { swar: 'Pa', note: 'G3', key: 'G', dur: 500 },
                { swar: 'Ma', note: 'F3', key: 'F', dur: 900 }
            ]
        },
        {
            id: 'dildil',
            title: 'Dil Dil Pakistan (دل دل پاکستان)',
            desc: 'پاکستان کا مقبول قومی نغمہ — کیز G, F, D, S دبائیں۔',
            taal: 'disco',
            bpm: 115,
            notes: [
                { swar: 'Pa', note: 'G3', key: 'G', dur: 350 },
                { swar: 'Pa', note: 'G3', key: 'G', dur: 350 },
                { swar: 'Ma', note: 'F3', key: 'F', dur: 300 },
                { swar: 'Ga', note: 'E3', key: 'D', dur: 300 },
                { swar: 'Re', note: 'D3', key: 'S', dur: 300 },
                { swar: 'Ga', note: 'E3', key: 'D', dur: 300 },
                { swar: 'Ma', note: 'F3', key: 'F', dur: 600 },

                { swar: 'Ga', note: 'E3', key: 'D', dur: 350 },
                { swar: 'Ga', note: 'E3', key: 'D', dur: 350 },
                { swar: 'Re', note: 'D3', key: 'S', dur: 300 },
                { swar: 'Sa', note: 'C3', key: 'A', dur: 300 },
                { swar: 'Ni', note: 'B3', key: 'J', dur: 300 },
                { swar: 'Sa', note: 'C3', key: 'A', dur: 300 },
                { swar: 'Re', note: 'D3', key: 'S', dur: 600 },

                { swar: 'Pa', note: 'G3', key: 'G', dur: 350 },
                { swar: 'Pa', note: 'G3', key: 'G', dur: 350 },
                { swar: 'Ma', note: 'F3', key: 'F', dur: 300 },
                { swar: 'Ga', note: 'E3', key: 'D', dur: 300 },
                { swar: 'Re', note: 'D3', key: 'S', dur: 300 },
                { swar: 'Ga', note: 'E3', key: 'D', dur: 300 },
                { swar: 'Sa', note: 'C3', key: 'A', dur: 800 }
            ]
        },
        {
            id: 'tajdar',
            title: 'Tajdar-e-Haram (تاجدارِ حرم)',
            desc: 'صوفیانہ قوالی کا پرسکون مکھڑا — کیز A, S, D, F, G دبائیں۔',
            taal: 'keherwa',
            bpm: 85,
            notes: [
                { swar: 'Sa', note: 'C3', key: 'A', dur: 350 },
                { swar: 'Re', note: 'D3', key: 'S', dur: 350 },
                { swar: 'Ga', note: 'E3', key: 'D', dur: 400 },
                { swar: 'Ga', note: 'E3', key: 'D', dur: 400 },
                { swar: 'Ga', note: 'E3', key: 'D', dur: 400 },
                { swar: 'Re', note: 'D3', key: 'S', dur: 350 },
                { swar: 'Ga', note: 'E3', key: 'D', dur: 350 },
                { swar: 'Ma', note: 'F3', key: 'F', dur: 500 },
                { swar: 'Ga', note: 'E3', key: 'D', dur: 400 },
                { swar: 'Re', note: 'D3', key: 'S', dur: 400 },
                { swar: 'Sa', note: 'C3', key: 'A', dur: 700 }
            ]
        },
        {
            id: 'alankar1',
            title: 'Alankar 1 (سارگم پریکٹس: Sa Re Ga Ma)',
            desc: 'سیدھے سروں کی روانی — روزانہ ریاض کے لیے سب سے بہترین۔',
            taal: 'keherwa',
            bpm: 90,
            notes: [
                { swar: 'Sa', note: 'C3', key: 'A', dur: 450 },
                { swar: 'Re', note: 'D3', key: 'S', dur: 450 },
                { swar: 'Ga', note: 'E3', key: 'D', dur: 450 },
                { swar: 'Ma', note: 'F3', key: 'F', dur: 450 },
                { swar: 'Pa', note: 'G3', key: 'G', dur: 450 },
                { swar: 'Dha', note: 'A3', key: 'H', dur: 450 },
                { swar: 'Ni', note: 'B3', key: 'J', dur: 450 },
                { swar: "Sa'", note: 'C4', key: 'K', dur: 600 },
                { swar: "Sa'", note: 'C4', key: 'K', dur: 450 },
                { swar: 'Ni', note: 'B3', key: 'J', dur: 450 },
                { swar: 'Dha', note: 'A3', key: 'H', dur: 450 },
                { swar: 'Pa', note: 'G3', key: 'G', dur: 450 },
                { swar: 'Ma', note: 'F3', key: 'F', dur: 450 },
                { swar: 'Ga', note: 'E3', key: 'D', dur: 450 },
                { swar: 'Re', note: 'D3', key: 'S', dur: 450 },
                { swar: 'Sa', note: 'C3', key: 'A', dur: 700 }
            ]
        },
        {
            id: 'twinkle',
            title: 'Twinkle Twinkle (چم چم چمکے تارے)',
            desc: 'بچوں کی لوری — بہت آسان اور میٹھی دھن۔',
            taal: 'keherwa',
            bpm: 95,
            notes: [
                { swar: 'Sa', note: 'C3', key: 'A', dur: 400 },
                { swar: 'Sa', note: 'C3', key: 'A', dur: 400 },
                { swar: 'Pa', note: 'G3', key: 'G', dur: 400 },
                { swar: 'Pa', note: 'G3', key: 'G', dur: 400 },
                { swar: 'Dha', note: 'A3', key: 'H', dur: 400 },
                { swar: 'Dha', note: 'A3', key: 'H', dur: 400 },
                { swar: 'Pa', note: 'G3', key: 'G', dur: 700 },

                { swar: 'Ma', note: 'F3', key: 'F', dur: 400 },
                { swar: 'Ma', note: 'F3', key: 'F', dur: 400 },
                { swar: 'Ga', note: 'E3', key: 'D', dur: 400 },
                { swar: 'Ga', note: 'E3', key: 'D', dur: 400 },
                { swar: 'Re', note: 'D3', key: 'S', dur: 400 },
                { swar: 'Re', note: 'D3', key: 'S', dur: 400 },
                { swar: 'Sa', note: 'C3', key: 'A', dur: 700 }
            ]
        },
        {
            id: 'bhoop',
            title: 'Raag Bhupali (کلاسیکل راگ بھوپالی)',
            desc: 'شام کا راگ — اس میں ما اور نی نہیں لگتے (Sa, Re, Ga, Pa, Dha)۔',
            taal: 'dadra',
            bpm: 105,
            notes: [
                { swar: 'Sa', note: 'C3', key: 'A', dur: 450 },
                { swar: 'Re', note: 'D3', key: 'S', dur: 450 },
                { swar: 'Ga', note: 'E3', key: 'D', dur: 450 },
                { swar: 'Pa', note: 'G3', key: 'G', dur: 450 },
                { swar: 'Dha', note: 'A3', key: 'H', dur: 450 },
                { swar: "Sa'", note: 'C4', key: 'K', dur: 700 },
                { swar: "Sa'", note: 'C4', key: 'K', dur: 450 },
                { swar: 'Dha', note: 'A3', key: 'H', dur: 450 },
                { swar: 'Pa', note: 'G3', key: 'G', dur: 450 },
                { swar: 'Ga', note: 'E3', key: 'D', dur: 450 },
                { swar: 'Re', note: 'D3', key: 'S', dur: 450 },
                { swar: 'Sa', note: 'C3', key: 'A', dur: 700 }
            ]
        }
    ];

    let currentSong = songsData[0];
    let isPlayingDemo = false;
    let demoTimeouts = [];

    const songSelectorPills = document.getElementById('songSelectorPills');
    const currentSongTitle = document.getElementById('currentSongTitle');
    const currentSongDesc = document.getElementById('currentSongDesc');
    const notesStream = document.getElementById('notesStream');
    const btnPlaySongDemo = document.getElementById('btnPlaySongDemo');
    const demoPlayIcon = document.getElementById('demoPlayIcon');
    const demoPlayText = document.getElementById('demoPlayText');
    const btnSongBeat = document.getElementById('btnSongBeat');

    function renderSongSelector() {
        if (!songSelectorPills) return;
        songSelectorPills.innerHTML = '';
        songsData.forEach((song, idx) => {
            const btn = document.createElement('button');
            btn.className = `song-pill-btn ${idx === 0 ? 'active' : ''}`;
            btn.textContent = song.title.split('(')[0].trim();
            btn.setAttribute('role', 'button');
            btn.addEventListener('click', () => {
                selectSong(song);
            });
            songSelectorPills.appendChild(btn);
        });
        selectSong(songsData[0]);
    }

    function selectSong(song) {
        stopSongDemo();
        currentSong = song;
        currentSongTitle.textContent = song.title;
        currentSongDesc.textContent = song.desc;

        document.querySelectorAll('.song-pill-btn').forEach(b => {
            b.classList.toggle('active', b.textContent === song.title.split('(')[0].trim());
        });

        renderSongNotes(song);
        announce(`Selected song tutorial: ${song.title.split('(')[0]}`);
    }

    function renderSongNotes(song) {
        if (!notesStream) return;
        notesStream.innerHTML = '';
        song.notes.forEach((item, index) => {
            const chip = document.createElement('div');
            chip.className = 'note-chip';
            chip.dataset.index = index;
            chip.innerHTML = `
                <span class="chip-swar">${item.swar}</span>
                <span class="chip-note">${item.note}</span>
                <span class="chip-key">${item.key}</span>
            `;
            chip.setAttribute('role', 'button');
            chip.setAttribute('aria-label', `${item.swar}, note ${item.note}, key ${item.key}`);
            chip.addEventListener('click', () => {
                const k = keysData.find(x => x.note === item.note);
                if (k) {
                    const keyEl = document.querySelector(`.key[data-note="${k.note}"]`);
                    if (keyEl) {
                        pressHarmoniumKey(keyEl, k);
                        setTimeout(() => releaseHarmoniumKey(keyEl, k), item.dur);
                    }
                }
            });
            notesStream.appendChild(chip);
        });
    }

    function playSongDemo() {
        if (isPlayingDemo) {
            stopSongDemo();
            return;
        }

        isPlayingDemo = true;
        btnPlaySongDemo.classList.add('playing');
        demoPlayIcon.textContent = '⏹️';
        demoPlayText.textContent = 'Stop Demo (روکیں)';
        announce(`Playing demonstration for ${currentSong.title.split('(')[0]}`);

        let accumulatedTime = 0;
        const chips = document.querySelectorAll('.note-chip');

        currentSong.notes.forEach((item, i) => {
            const timeoutId = setTimeout(() => {
                if (!isPlayingDemo) return;

                // Highlight chip
                chips.forEach(c => c.classList.remove('current-playing'));
                if (chips[i]) {
                    chips[i].classList.add('current-playing');
                    chips[i].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                }

                // Play key on harmonium
                const k = keysData.find(x => x.note === item.note);
                if (k) {
                    const keyEl = document.querySelector(`.key[data-note="${k.note}"]`);
                    if (keyEl) {
                        pressHarmoniumKey(keyEl, k);
                        const offId = setTimeout(() => {
                            releaseHarmoniumKey(keyEl, k);
                        }, item.dur - 40);
                        demoTimeouts.push(offId);
                    }
                }
            }, accumulatedTime);

            demoTimeouts.push(timeoutId);
            accumulatedTime += item.dur + 40;
        });

        const finishTimeout = setTimeout(() => {
            stopSongDemo();
            announce("Demonstration finished.");
        }, accumulatedTime + 200);
        demoTimeouts.push(finishTimeout);
    }

    function stopSongDemo() {
        isPlayingDemo = false;
        demoTimeouts.forEach(t => clearTimeout(t));
        demoTimeouts = [];
        if (btnPlaySongDemo) {
            btnPlaySongDemo.classList.remove('playing');
            demoPlayIcon.textContent = '▶️';
            demoPlayText.textContent = 'Play Demo (ڈیمو سنیں)';
        }
        document.querySelectorAll('.note-chip').forEach(c => c.classList.remove('current-playing'));
        engine.stopAllHarmoniumNotes();
    }

    if (btnPlaySongDemo) {
        btnPlaySongDemo.addEventListener('click', playSongDemo);
    }

    if (btnSongBeat) {
        btnSongBeat.addEventListener('click', () => {
            if (currentSong.taal) {
                rhythmSelect.value = currentSong.taal;
                tempoSlider.value = currentSong.bpm;
                bpmDisplay.textContent = `${currentSong.bpm} BPM`;
                engine.updateTempo(currentSong.bpm);
                if (!engine.isPlayingRhythm) {
                    toggleRhythm();
                } else {
                    const taalName = rhythmSelect.options[rhythmSelect.selectedIndex].text.split('(')[0].trim();
                    engine.startRhythm(currentSong.taal, (step) => {
                        stepLeds.forEach((led, idx) => {
                            led.classList.toggle('active', idx === (step % stepLeds.length));
                        });
                    });
                    announce(`Started recommended rhythm ${taalName} at ${currentSong.bpm} BPM.`);
                }
            }
        });
    }

    // Stop song demo on Panic (Esc)
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            stopSongDemo();
        }
    });


    /* ==========================================================
       STUDIO MASTER EFFECTS RACK CONTROLLER
       Full accessibility, real-time value updates & NVDA announcements
    ========================================================== */
    const studioPresetSelect = document.getElementById('studioPresetSelect');
    const btnStudioFxPreset = document.getElementById('btnStudioFxPreset');
    const fxPresetBtnText = document.getElementById('fxPresetBtnText');
    const reverbPresetSelect = document.getElementById('reverbPresetSelect');
    const reverbBadge = document.getElementById('reverbBadge');
    const reverbWetSlider = document.getElementById('reverbWetSlider');
    const reverbWetVal = document.getElementById('reverbWetVal');
    const btnToggleDelay = document.getElementById('btnToggleDelay');
    const delayToggleText = document.getElementById('delayToggleText');
    const delayTimeSlider = document.getElementById('delayTimeSlider');
    const delayTimeVal = document.getElementById('delayTimeVal');
    const delayFeedbackSlider = document.getElementById('delayFeedbackSlider');
    const delayFeedbackVal = document.getElementById('delayFeedbackVal');
    const delayWetSlider = document.getElementById('delayWetSlider');
    const delayWetVal = document.getElementById('delayWetVal');
    const eqLowSlider = document.getElementById('eqLowSlider');
    const eqLowVal = document.getElementById('eqLowVal');
    const eqMidSlider = document.getElementById('eqMidSlider');
    const eqMidVal = document.getElementById('eqMidVal');
    const eqHighSlider = document.getElementById('eqHighSlider');
    const eqHighVal = document.getElementById('eqHighVal');
    const btnToggleChorus = document.getElementById('btnToggleChorus');
    const chorusToggleText = document.getElementById('chorusToggleText');
    const tubeWarmthSlider = document.getElementById('tubeWarmthSlider');
    const tubeWarmthVal = document.getElementById('tubeWarmthVal');
    const btnResetFx = document.getElementById('btnResetFx');

    const studioPresetOrder = ['mehfil', 'classical', 'bollywood', 'qawwali', 'clean'];
    const reverbPresetOrder = ['mehfil', 'studio', 'plate', 'cathedral', 'spring', 'off'];

    function syncFxUiFromEngine() {
        if (studioPresetSelect) studioPresetSelect.value = engine.currentStudioPreset;
        if (fxPresetBtnText) {
            const pName = engine.currentStudioPreset === 'mehfil' ? 'Mehfil Hall' :
                          engine.currentStudioPreset === 'classical' ? 'Classical Solo' :
                          engine.currentStudioPreset === 'bollywood' ? 'Bollywood Studio' :
                          engine.currentStudioPreset === 'qawwali' ? 'Sufi Qawwali' : 'Clean / Dry';
            fxPresetBtnText.textContent = `FX: ${pName} [Alt+S]`;
        }

        if (reverbPresetSelect) reverbPresetSelect.value = engine.reverbPreset;
        if (reverbBadge) {
            reverbBadge.textContent = engine.reverbPreset === 'off' ? 'Bypassed (OFF)' :
                                     engine.reverbPreset.charAt(0).toUpperCase() + engine.reverbPreset.slice(1);
        }
        if (reverbWetSlider) reverbWetSlider.value = engine.reverbWet;
        if (reverbWetVal) reverbWetVal.textContent = `${Math.round(engine.reverbWet * 100)}%`;

        if (btnToggleDelay) {
            btnToggleDelay.classList.toggle('active', engine.delayEnabled);
            btnToggleDelay.setAttribute('aria-pressed', engine.delayEnabled ? 'true' : 'false');
        }
        if (delayToggleText) delayToggleText.textContent = `Delay: ${engine.delayEnabled ? 'ON' : 'OFF'} [Alt+D]`;
        if (delayTimeSlider) delayTimeSlider.value = engine.delayTime;
        if (delayTimeVal) delayTimeVal.textContent = `${Math.round(engine.delayTime * 1000)} ms`;
        if (delayFeedbackSlider) delayFeedbackSlider.value = engine.delayFeedback;
        if (delayFeedbackVal) delayFeedbackVal.textContent = `${Math.round(engine.delayFeedback * 100)}%`;
        if (delayWetSlider) delayWetSlider.value = engine.delayWet;
        if (delayWetVal) delayWetVal.textContent = `${Math.round(engine.delayWet * 100)}%`;

        if (eqLowSlider) eqLowSlider.value = engine.eqLowGain;
        if (eqLowVal) eqLowVal.textContent = `${engine.eqLowGain > 0 ? '+' : ''}${engine.eqLowGain.toFixed(1)} dB`;
        if (eqMidSlider) eqMidSlider.value = engine.eqMidGain;
        if (eqMidVal) eqMidVal.textContent = `${engine.eqMidGain > 0 ? '+' : ''}${engine.eqMidGain.toFixed(1)} dB`;
        if (eqHighSlider) eqHighSlider.value = engine.eqHighGain;
        if (eqHighVal) eqHighVal.textContent = `${engine.eqHighGain > 0 ? '+' : ''}${engine.eqHighGain.toFixed(1)} dB`;

        if (btnToggleChorus) {
            btnToggleChorus.classList.toggle('active', engine.chorusEnabled);
            btnToggleChorus.setAttribute('aria-pressed', engine.chorusEnabled ? 'true' : 'false');
        }
        if (chorusToggleText) chorusToggleText.textContent = `3D Chorus: ${engine.chorusEnabled ? 'ON' : 'OFF'}`;

        if (tubeWarmthSlider) tubeWarmthSlider.value = engine.tubeWarmth;
        if (tubeWarmthVal) tubeWarmthVal.textContent = `${Math.round(engine.tubeWarmth)}%`;
    }

    function cycleStudioFxPreset() {
        const curIdx = studioPresetOrder.indexOf(engine.currentStudioPreset);
        const nextIdx = (curIdx + 1) % studioPresetOrder.length;
        const nextPreset = studioPresetOrder[nextIdx];
        engine.applyStudioPreset(nextPreset);
        syncFxUiFromEngine();
        const names = {
            mehfil: 'Mehfil and Ghazal Hall Reverb and Tape Echo',
            classical: 'Classical Solo Pure Acoustic Studio',
            bollywood: 'Bollywood Film Studio Shimmer Plate and Wide Delay',
            qawwali: 'Sufi Qawwali Grand Cathedral and Deep Echo',
            clean: 'Clean Dry Bypass'
        };
        announce(`Studio Effects Preset: ${names[nextPreset] || nextPreset}`);
    }

    function cycleReverbPreset() {
        const curIdx = reverbPresetOrder.indexOf(engine.reverbPreset);
        const nextIdx = (curIdx + 1) % reverbPresetOrder.length;
        const nextPreset = reverbPresetOrder[nextIdx];
        engine.setReverbPreset(nextPreset);
        syncFxUiFromEngine();
        announce(`Reverb Space set to ${nextPreset === 'off' ? 'OFF' : nextPreset}`);
    }

    function toggleDelayEffect() {
        engine.setDelayEnabled(!engine.delayEnabled);
        syncFxUiFromEngine();
        announce(`Stereo Delay Echo: ${engine.delayEnabled ? 'ON' : 'OFF'}`);
    }

    function toggleTubeWarmthEffect() {
        const newWarmth = engine.tubeWarmth > 0 ? 0 : 25;
        engine.setTubeWarmth(newWarmth);
        syncFxUiFromEngine();
        announce(`Tube Warmth: ${newWarmth > 0 ? 'ON, 25 percent' : 'OFF'}`);
    }

    function initStudioFxController() {
        if (studioPresetSelect) {
            studioPresetSelect.addEventListener('change', (e) => {
                engine.applyStudioPreset(e.target.value);
                syncFxUiFromEngine();
                announce(`Studio Preset: ${e.target.options[e.target.selectedIndex].text}`);
            });
        }

        if (btnStudioFxPreset) {
            btnStudioFxPreset.addEventListener('click', () => {
                cycleStudioFxPreset();
            });
        }

        if (reverbPresetSelect) {
            reverbPresetSelect.addEventListener('change', (e) => {
                engine.setReverbPreset(e.target.value);
                syncFxUiFromEngine();
                announce(`Reverb Space: ${e.target.options[e.target.selectedIndex].text}`);
            });
        }

        if (reverbWetSlider) {
            reverbWetSlider.addEventListener('input', (e) => {
                engine.setReverbWet(parseFloat(e.target.value));
                if (reverbWetVal) reverbWetVal.textContent = `${Math.round(engine.reverbWet * 100)}%`;
            });
        }

        if (btnToggleDelay) {
            btnToggleDelay.addEventListener('click', () => {
                toggleDelayEffect();
            });
        }

        if (delayTimeSlider) {
            delayTimeSlider.addEventListener('input', (e) => {
                engine.setDelayTime(parseFloat(e.target.value));
                if (delayTimeVal) delayTimeVal.textContent = `${Math.round(engine.delayTime * 1000)} ms`;
            });
        }

        if (delayFeedbackSlider) {
            delayFeedbackSlider.addEventListener('input', (e) => {
                engine.setDelayFeedback(parseFloat(e.target.value));
                if (delayFeedbackVal) delayFeedbackVal.textContent = `${Math.round(engine.delayFeedback * 100)}%`;
            });
        }

        if (delayWetSlider) {
            delayWetSlider.addEventListener('input', (e) => {
                engine.setDelayWet(parseFloat(e.target.value));
                if (delayWetVal) delayWetVal.textContent = `${Math.round(engine.delayWet * 100)}%`;
            });
        }

        if (eqLowSlider) {
            eqLowSlider.addEventListener('input', (e) => {
                engine.setEqLow(parseFloat(e.target.value));
                if (eqLowVal) eqLowVal.textContent = `${engine.eqLowGain > 0 ? '+' : ''}${engine.eqLowGain.toFixed(1)} dB`;
            });
        }

        if (eqMidSlider) {
            eqMidSlider.addEventListener('input', (e) => {
                engine.setEqMid(parseFloat(e.target.value));
                if (eqMidVal) eqMidVal.textContent = `${engine.eqMidGain > 0 ? '+' : ''}${engine.eqMidGain.toFixed(1)} dB`;
            });
        }

        if (eqHighSlider) {
            eqHighSlider.addEventListener('input', (e) => {
                engine.setEqHigh(parseFloat(e.target.value));
                if (eqHighVal) eqHighVal.textContent = `${engine.eqHighGain > 0 ? '+' : ''}${engine.eqHighGain.toFixed(1)} dB`;
            });
        }

        if (btnToggleChorus) {
            btnToggleChorus.addEventListener('click', () => {
                engine.setChorusEnabled(!engine.chorusEnabled);
                syncFxUiFromEngine();
                announce(`3D Chorus: ${engine.chorusEnabled ? 'ON' : 'OFF'}`);
            });
        }

        if (tubeWarmthSlider) {
            tubeWarmthSlider.addEventListener('input', (e) => {
                engine.setTubeWarmth(parseFloat(e.target.value));
                if (tubeWarmthVal) tubeWarmthVal.textContent = `${Math.round(engine.tubeWarmth)}%`;
            });
        }

        if (btnResetFx) {
            btnResetFx.addEventListener('click', () => {
                engine.applyStudioPreset('mehfil');
                syncFxUiFromEngine();
                announce("Studio Effects reset to default Mehfil & Ghazal Hall preset.");
            });
        }

        syncFxUiFromEngine();
    }
    // Initialize Studio Effects Rack Controller
    initStudioFxController();

    // Initialize Song Tutorials
    renderSongSelector();

    // Initial render
    renderKeyboard();
});

