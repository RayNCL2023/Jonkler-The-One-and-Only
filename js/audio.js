"use strict";
// Thin wrapper around HTMLAudioElement so the game also works when opened straight from disk (file://).
const Sound = (() => {
    const SFX = ["hit", "bighit", "jump", "coin", "wave", "select", "move", "hurt", "scream", "gameover", "fall", "swing"];
    const pools = {};
    // Extra copies (so a sound can overlap itself) are cloned on first use, not downloaded up front.
    for (const n of SFX) {
        pools[n] = { list: [new Audio(`assets/sfx/${n}.wav`)], i: 0 };
    }

    // Music is large, so it only starts downloading when it is first played.
    const tracks = {};
    for (const name of ["title", "battle"]) {
        const t = new Audio();
        t.preload = "none";
        t.loop = true;
        t.volume = 0.3;
        t.dataset.src = `assets/music/${name}.wav`;
        tracks[name] = t;
    }

    function startTrack(t) {
        if (!t.src) t.src = t.dataset.src;
        t.play().catch(() => {});
    }

    let muted = false;
    let unlocked = false;
    let current = null;

    function play(name, vol = 0.6) {
        if (muted || !unlocked) return;
        const p = pools[name];
        if (p.list.length < 4) p.list.push(p.list[0].cloneNode());
        const a = p.list[p.i++ % p.list.length];
        a.volume = vol;
        a.currentTime = 0;
        a.play().catch(() => {});
    }

    function track(name) {
        const next = name ? tracks[name] : null;
        if (next === current) return;
        if (current) current.pause();
        current = next;
        if (!current) return;
        if (current.src) current.currentTime = 0;
        if (unlocked && !muted) startTrack(current);
    }

    // Browsers block audio until the first user gesture.
    function unlock() {
        if (unlocked) return;
        unlocked = true;
        if (current && !muted) startTrack(current);
    }

    function toggleMute() {
        muted = !muted;
        if (current) muted ? current.pause() : startTrack(current);
    }

    return { play, track, unlock, toggleMute, get muted() { return muted; } };
})();
