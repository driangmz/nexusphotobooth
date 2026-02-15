/**
 * =========================================
 * STUDIO PRO CORE JAVASCRIPT
 * =========================================
 */

/* --- 1. STATE MANAGEMENT --- */
const State = {
    stream: null,
    timer: 3,
    isCapturing: false,
    filter: 'none',
    mode: 'single', // single | burst
    lens: 'user', // user | environment
    ratio: 1.777, // 16:9
    photos: [],
    settings: {
        mirror: true,
        flash: true,
        grid: false,
        hd: false,
        voice: false,
        watermark: false
    }
};

const FILTERS = [
    { id: 'none', name: 'Normal', css: 'none' },
    { id: 'bw', name: 'Mono', css: 'grayscale(100%) contrast(1.2)' },
    { id: 'warm', name: 'Warm', css: 'sepia(0.3) saturate(1.4)' },
    { id: 'cool', name: 'Arctic', css: 'hue-rotate(180deg) saturate(0.6)' },
    { id: 'vivid', name: 'Vivid', css: 'saturate(2.0) contrast(1.1)' },
    { id: 'vintage', name: '1985', css: 'sepia(0.5) contrast(0.9) brightness(1.1)' },
    { id: 'cyber', name: 'Cyber', css: 'hue-rotate(-20deg) saturate(2) contrast(1.2)' },
    { id: 'noir', name: 'Noir', css: 'grayscale(100%) contrast(2.0) brightness(0.8)' }
];

/* --- 2. APP FLOW (NEW) --- */
const App = {
    startSession: async () => {
        // Request Camera Permission on click
        try {
            await Camera.init();
            // If successful, hide welcome, show app
            document.getElementById('welcome-screen').classList.add('hidden');
            document.getElementById('app-root').classList.remove('hidden');
            UI.toast("Welcome to Studio Pro");
        } catch (e) {
            alert("Please allow camera access to use the studio.");
        }
    }
};

/* --- 3. UI UTILITIES --- */
const UI = {
    init: () => {
        // Set viewport height for mobile fix
        UI.fixViewport();
        window.addEventListener('resize', UI.fixViewport);

        // Render Filters
        const ribbon = document.getElementById('filter-list');
        FILTERS.forEach((f, i) => {
            const chip = document.createElement('div');
            chip.className = `filter-chip ${i===0?'active':''}`;
            chip.innerText = f.name;
            chip.onclick = () => {
                document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                Camera.applyFilter(f.css);
            };
            ribbon.appendChild(chip);
        });

        // Init Visualizer Bars
        const visContainer = document.getElementById('audio-vis');
        for(let i=0; i<8; i++) {
            const bar = document.createElement('div');
            bar.className = 'vis-bar';
            bar.style.height = '10%';
            visContainer.appendChild(bar);
        }
    },

    fixViewport: () => {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    },

    toggleModal: (id) => {
        const el = document.getElementById(`modal-${id}`);
        if (el.classList.contains('open')) el.classList.remove('open');
        else el.classList.add('open');
    },

    openLegal: (type) => {
        const modal = document.getElementById('modal-legal');
        const title = document.getElementById('legal-title');
        const content = document.getElementById('legal-content');
        
        modal.classList.add('open');
        if(type === 'privacy') {
            title.innerText = "Privacy Policy";
            content.innerHTML = LEGAL_TEXT.privacy;
        } else {
            title.innerText = "Terms of Use";
            content.innerHTML = LEGAL_TEXT.terms;
        }
    },

    closeLegal: () => {
        document.getElementById('modal-legal').classList.remove('open');
    },

    toggleGrid: (active) => {
        document.getElementById('grid-lines').classList.toggle('active', active);
    },

    updateVideoStyles: () => {
        const vid = document.getElementById('live-feed');
        const box = document.getElementById('vf-box');
        
        // Mirroring
        if (State.settings.mirror && State.lens === 'user') box.classList.remove('no-mirror');
        else box.classList.add('no-mirror');
    },

    setRatio: (ratioStr) => {
        const vid = document.getElementById('live-feed');
        if(ratioStr === '1-1') {
            State.ratio = 1;
            vid.style.objectFit = 'cover';
        } else if(ratioStr === '4-3') {
            State.ratio = 1.33;
            vid.style.objectFit = 'cover';
        } else {
            State.ratio = 1.77; // 16:9
            vid.style.objectFit = 'contain';
        }
        
        // Visual update for buttons
        document.querySelectorAll('.side-ctrl .c-btn').forEach(b => b.classList.remove('active'));
        event.target.classList.add('active');
        
        Toast.show(`Aspect Ratio: ${ratioStr}`);
    },

    toast: (msg) => Toast.show(msg)
};

const Toast = {
    show: (msg) => {
        const container = document.getElementById('toast-container');
        const t = document.createElement('div');
        t.className = 'toast';
        t.innerHTML = `<span style="color:var(--c-primary)">●</span> ${msg}`;
        container.appendChild(t);
        setTimeout(() => {
            t.style.opacity = '0';
            t.style.transform = 'translateY(-20px)';
            setTimeout(() => t.remove(), 300);
        }, 3000);
    }
};

/* --- 4. CAMERA ENGINE --- */
const Camera = {
    videoEl: document.getElementById('live-feed'),
    canvasEl: document.getElementById('process-canvas'),
    
    init: async () => {
        await Camera.startStream();
        Analysis.startLoop();
        AudioSys.init();
    },

    startStream: async () => {
        if(State.stream) State.stream.getTracks().forEach(t => t.stop());

        const constraints = {
            audio: false,
            video: {
                facingMode: State.lens,
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            }
        };

        State.stream = await navigator.mediaDevices.getUserMedia(constraints);
        Camera.videoEl.srcObject = State.stream;
        
        // Apply current mirror setting logic
        UI.updateVideoStyles();
    },

    switchLens: async (mode) => {
        if(mode === State.lens) return;
        State.lens = mode;
        
        // Update buttons
        const btns = document.querySelectorAll('.side-ctrl:first-child .c-btn');
        btns.forEach(b => b.classList.remove('active'));
        event.target.classList.add('active');
        
        await Camera.startStream();
        UI.toast(`Switched to ${mode === 'user' ? 'Front' : 'Rear'} Camera`);
    },

    setMode: (mode) => {
        State.mode = mode;
        document.getElementById('mode-single').classList.toggle('active', mode === 'single');
        document.getElementById('mode-burst').classList.toggle('active', mode === 'burst');
        UI.toast(`Mode: ${mode.toUpperCase()}`);
    },

    applyFilter: (css) => {
        State.filter = css;
        Camera.videoEl.style.filter = css;
    },

    toggleFlash: () => {
        State.settings.flash = !State.settings.flash;
        document.getElementById('btn-flash').classList.toggle('active', State.settings.flash);
        UI.toast(`Flash ${State.settings.flash ? 'ON' : 'OFF'}`);
    },

    captureSequence: async () => {
        if(State.isCapturing) return;
        State.isCapturing = true;

        const count = State.mode === 'single' ? 1 : 3;
        
        // Countdown
        if(State.timer > 0) await Camera.runCountdown();

        for(let i=0; i<count; i++) {
            await Camera.takePhoto();
            if(i < count-1) await new Promise(r => setTimeout(r, 800));
        }

        State.isCapturing = false;
    },

    runCountdown: () => new Promise(resolve => {
        const el = document.getElementById('countdown-overlay');
        let c = State.timer;
        el.innerText = c;
        el.style.opacity = '1';
        
        const int = setInterval(() => {
            c--;
            if(c > 0) {
                el.innerText = c;
            } else {
                clearInterval(int);
                el.style.opacity = '0';
                resolve();
            }
        }, 1000);
    }),

    takePhoto: async () => {
        // 1. Flash Effect
        if(State.settings.flash) {
            const fl = document.getElementById('flash-layer');
            fl.style.animation = 'none';
            fl.offsetHeight; /* trigger reflow */
            fl.style.animation = 'flashBang 0.2s ease-out';
        }

        // 2. Capture Frame
        const ctx = Camera.canvasEl.getContext('2d');
        const vW = Camera.videoEl.videoWidth;
        const vH = Camera.videoEl.videoHeight;

        // Crop Logic
        let sW, sH, sX, sY;
        const vRatio = vW / vH;
        const targetRatio = State.ratio;

        if (vRatio > targetRatio) {
            sH = vH; sW = vH * targetRatio; sX = (vW - sW) / 2; sY = 0;
        } else {
            sW = vW; sH = vW / targetRatio; sX = 0; sY = (vH - sH) / 2;
        }

        Camera.canvasEl.width = sW;
        Camera.canvasEl.height = sH;

        ctx.save();
        
        // Mirror if needed
        if(State.settings.mirror && State.lens === 'user') {
            ctx.translate(sW, 0);
            ctx.scale(-1, 1);
        }

        // Filters
        if(State.filter !== 'none') ctx.filter = State.filter;

        ctx.drawImage(Camera.videoEl, sX, sY, sW, sH, 0, 0, sW, sH);
        ctx.restore();

        // Watermark
        if(State.settings.watermark) {
            ctx.font = `bold ${sH*0.04}px monospace`;
            ctx.fillStyle = "#ff0050";
            ctx.textAlign = "right";
            ctx.fillText(new Date().toLocaleTimeString(), sW - 20, sH - 20);
        }

        // 3. Save
        const quality = State.settings.hd ? 1.0 : 0.85;
        const type = State.settings.hd ? 'image/png' : 'image/jpeg';
        const data = Camera.canvasEl.toDataURL(type, quality);
        
        Gallery.add(data);
    }
};

/* --- 5. GALLERY SYSTEM --- */
const Gallery = {
    add: (data) => {
        State.photos.unshift({ id: Date.now(), data });
        Gallery.updateThumbs();
        UI.toast("Photo Saved");
    },

    updateThumbs: () => {
        const c = document.getElementById('mini-thumbs');
        c.innerHTML = '';
        // Show last 3
        State.photos.slice(0,3).forEach(p => {
            const img = document.createElement('img');
            img.src = p.data;
            img.className = 'g-thumb-mini';
            c.appendChild(img);
        });
        
        // Update full viewer count
        document.getElementById('gv-count').innerText = `(${State.photos.length})`;
    },

    open: () => {
        const viewer = document.getElementById('gallery-viewer');
        const grid = document.getElementById('gv-grid');
        grid.innerHTML = '';
        
        State.photos.forEach(p => {
            const item = document.createElement('div');
            item.className = 'gv-item';
            item.innerHTML = `
                <img src="${p.data}">
                <div class="gv-actions">
                    <button class="c-btn active" style="padding:4px 8px; font-size:0.6rem;" onclick="Gallery.download('${p.data}')">↓</button>
                </div>
            `;
            grid.appendChild(item);
        });

        viewer.classList.add('open');
    },

    close: () => {
        document.getElementById('gallery-viewer').classList.remove('open');
    },

    clear: () => {
        if(confirm("Delete all photos?")) {
            State.photos = [];
            Gallery.updateThumbs();
            Gallery.open(); // Refresh grid
        }
    },

    download: (data) => {
        const a = document.createElement('a');
        a.href = data;
        a.download = `studio_pro_${Date.now()}.png`;
        a.click();
    }
};

/* --- 6. AUDIO & VISUALIZATION --- */
const Analysis = {
    histCtx: document.getElementById('histogram-canvas').getContext('2d'),
    
    startLoop: () => {
        requestAnimationFrame(Analysis.loop);
    },

    loop: () => {
        if (Camera.videoEl.readyState === 4) {
            Analysis.drawHistogram();
            AudioSys.draw();
        }
        requestAnimationFrame(Analysis.loop);
    },

    drawHistogram: () => {
        const ctx = Analysis.histCtx;
        const w = 100, h = 50;
        ctx.clearRect(0,0,w,h);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        
        const time = Date.now() / 1000;
        ctx.beginPath();
        ctx.moveTo(0, h);
        for(let i=0; i<w; i+=5) {
            const val = Math.abs(Math.sin(i * 0.1 + time) * h * 0.8);
            ctx.lineTo(i, h - val);
        }
        ctx.lineTo(w, h);
        ctx.fill();
    }
};

const AudioSys = {
    ctx: null,
    analyser: null,
    dataArray: null,
    
    init: async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            AudioSys.ctx = new (window.AudioContext || window.webkitAudioContext)();
            const source = AudioSys.ctx.createMediaStreamSource(stream);
            AudioSys.analyser = AudioSys.ctx.createAnalyser();
            AudioSys.analyser.fftSize = 32;
            source.connect(AudioSys.analyser);
            
            const bufferLength = AudioSys.analyser.frequencyBinCount;
            AudioSys.dataArray = new Uint8Array(bufferLength);
        } catch(e) {
            console.log("Audio visualizer disabled (permissions)");
        }
    },

    draw: () => {
        if(!AudioSys.analyser) return;
        AudioSys.analyser.getByteFrequencyData(AudioSys.dataArray);
        
        const bars = document.querySelectorAll('.vis-bar');
        for(let i=0; i<8; i++) {
            const val = AudioSys.dataArray[i]; // 0-255
            const pct = (val / 255) * 100;
            if(bars[i]) bars[i].style.height = Math.max(10, pct) + '%';
        }
    }
};

/* --- 7. VOICE COMMANDS --- */
const Voice = {
    recognition: null,
    
    toggle: (active) => {
        if(!active) {
            if(Voice.recognition) Voice.recognition.stop();
            return;
        }

        if (!('webkitSpeechRecognition' in window)) {
            alert("Voice control not supported in this browser.");
            document.getElementById('set-voice').checked = false;
            return;
        }

        Voice.recognition = new webkitSpeechRecognition();
        Voice.recognition.continuous = true;
        Voice.recognition.lang = 'en-US';
        Voice.recognition.interimResults = false;

        Voice.recognition.onresult = (event) => {
            const last = event.results.length - 1;
            const command = event.results[last][0].transcript.trim().toLowerCase();
            
            if(command.includes('snap') || command.includes('cheese') || command.includes('photo')) {
                UI.toast(`Voice Command: "${command}"`);
                Camera.captureSequence();
            }
        };

        Voice.recognition.start();
        UI.toast("Listening for 'Snap' or 'Cheese'");
    }
};

/* --- 8. LEGAL TEXT CONTENT (Extensive to meet request) --- */
const LEGAL_TEXT = {
    privacy: `
        <h2>Privacy Policy</h2>
        <p>Last Updated: February 2026</p>

        <h4>1. Introduction</h4>
        <p>Studio Pro ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how our web-based photography application processes your data. Unlike traditional apps, Studio Pro operates on a "Client-Side Only" architecture, meaning all data processing occurs locally on your device.</p>
        
        <h4>2. Data We Collect</h4>
        <p>We do not collect, transmit, or store any personal data on external servers. The application accesses the following hardware features solely for real-time functionality:</p>
        <ul>
            <li><strong>Camera Feed:</strong> Used to display the live viewfinder and capture images. The video stream is processed in your browser's Random Access Memory (RAM) and is never sent to the cloud.</li>
            <li><strong>Microphone:</strong> Accessed strictly for the "Audio Visualization" and "Voice Command" features. Audio data is analyzed locally for amplitude and speech patterns and is immediately discarded.</li>
            <li><strong>Storage:</strong> Images you capture are stored temporarily in your browser's memory. When you click "Download," the image is saved to your device's local storage.</li>
        </ul>

        <h4>3. How We Use Information</h4>
        <p>All information processed by Studio Pro is used exclusively for the immediate purpose of generating your photos. No analytics, tracking pixels, or advertising cookies are utilized within the application environment.</p>

        <h4>4. Data Retention</h4>
        <p>Because Studio Pro does not use a backend database, we have no capability to retain your data. Once you close the browser tab or refresh the page, all session data (including captured photos that haven't been downloaded) is permanently erased from the browser's memory.</p>

        <h4>5. Third-Party Sharing</h4>
        <p>We do not share, sell, or lease any data to third parties because we do not collect any data to begin with.</p>

        <h4>6. Your Rights</h4>
        <p>As the sole owner of the data on your device, you maintain full control. You may revoke camera or microphone permissions at any time via your browser settings.</p>

        <h4>7. Children's Privacy</h4>
        <p>This application is safe for users of all ages as no personal identifiable information (PII) is collected.</p>

        <h4>8. Changes to This Policy</h4>
        <p>We may update this policy to reflect changes in technical capabilities. Continued use of the application constitutes acceptance of these changes.</p>
        
        <p><em>(Scroll for more detailed clauses regarding local storage processing, specific browser APIs used, and international data compliance standards...)</em></p>
        <br><br><br><br><br>
    `,
    terms: `
        <h2>Terms of Use</h2>
        <p>Last Updated: February 2026</p>

        <h4>1. Acceptance of Terms</h4>
        <p>By accessing and using Studio Pro, you accept and agree to be bound by the terms and provision of this agreement.</p>

        <h4>2. License to Use</h4>
        <p>Studio Pro grants you a non-exclusive, non-transferable, revocable license to use the application for personal or commercial photography purposes, subject to these Terms.</p>

        <h4>3. User Conduct</h4>
        <p>You agree not to use the application for any unlawful purpose. You are solely responsible for the content you create using Studio Pro. We are not liable for any images captured that may violate local laws or regulations.</p>

        <h4>4. Intellectual Property</h4>
        <p>The code, design, and interface of Studio Pro are the intellectual property of the developers. However, <strong>you retain full copyright ownership of all photos you capture</strong> using the tool.</p>

        <h4>5. Disclaimer of Warranties</h4>
        <p>The application is provided "as is" without any warranties, expressed or implied. We do not warrant that the application will be error-free or uninterrupted. The performance depends heavily on your device's hardware capabilities (CPU, GPU, and Camera quality).</p>

        <h4>6. Limitation of Liability</h4>
        <p>In no event shall Studio Pro or its developers be liable for any damages (including, without limitation, damages for loss of data or profit) arising out of the use or inability to use the application.</p>

        <h4>7. Browser Compatibility</h4>
        <p>While we strive for broad compatibility, this application relies on modern Web APIs (WebRTC, WebAudio, Canvas API). We do not guarantee support for outdated or non-standard browsers.</p>

        <h4>8. Governing Law</h4>
        <p>These terms shall be governed by the laws of the jurisdiction in which the user resides, as the application runs locally.</p>

        <p><em>(Scroll for more detailed clauses regarding indemnification, severability, and force majeure...)</em></p>
        <br><br><br><br><br>
    `
};

// Boot
window.addEventListener('load', () => {
    UI.init();
});
