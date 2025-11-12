// Single AudioContext for all sounds.
let audioCtx;
let gainNode;

// Polyfill decodeAudioData Promise-based syntax on safari.
const decodeAudioData = (arrayBuffer) => new Promise((resolve, reject) => {
    audioCtx.decodeAudioData(arrayBuffer, resolve, reject);
});

class Sound {
    constructor(url) {
        // Lazily create and guard the AudioContext; if creation fails (e.g., Safari quirks),
        // mark audio as disabled so loading doesn't block the UI.
        if (!audioCtx) {
            try {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                audioCtx = new AudioContext();
                gainNode = audioCtx.createGain();
                gainNode.connect(audioCtx.destination);
            } catch (e) {
                this._disabled = true;
            }
        }

        this.url = url;
    }

    load() {
        // If audio is disabled/unavailable, don't block game start.
        if (this._disabled) {
            return Promise.resolve();
        }

        // Helper to create a tiny silent buffer so readiness checks pass even if decode fails.
        const createSilentBuffer = () => {
            try {
                const sampleRate = (audioCtx && audioCtx.sampleRate) || 44100;
                const frameCount = Math.max(1, Math.floor(sampleRate * 0.05)); // ~50ms
                return audioCtx.createBuffer(1, frameCount, sampleRate);
            } catch (e) {
                return null;
            }
        };

        return fetch(this.url)
            .then(response => response.arrayBuffer())
            .then(arrayBuffer => decodeAudioData(arrayBuffer))
            .then(audioBuffer => {
                this.audioBuffer = audioBuffer;
                return audioBuffer;
            })
            .catch(() => {
                // On Safari or network failures, fall back to a silent buffer so the loader can finish.
                this.audioBuffer = createSilentBuffer();
            });
    }

    play() {
        if (this._disabled || !audioCtx || !this.audioBuffer) return;

        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        const trackSource = audioCtx.createBufferSource();
        trackSource.buffer = this.audioBuffer;
        trackSource.connect(gainNode);
        trackSource.start();
    }

    mute(muted) {
        // Muted my default unless muted === false.
        this.muted = muted !== false;

        if (!gainNode || !audioCtx) return;

        if (this.muted) {
            gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
        } else {
            gainNode.gain.setValueAtTime(1, audioCtx.currentTime);
        }
    }

    isReady() {
        // If audio is disabled, treat as ready so UI isn't blocked.
        return this._disabled ? true : !!this.audioBuffer;
    }
}

export default Sound;
