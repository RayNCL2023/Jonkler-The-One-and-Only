"use strict";
// Thin wrapper around HTMLAudioElement so the game also works when opened straight from disk (file://).
const Sound = (() => {
    const SFX = ["hit", "bighit", "jump", "coin", "wave", "select", "move", "hurt", "scream", "gameover", "fall", "swing"];
    const pools = {};
    for (const n of SFX) {
        pools[n] = { list: Array.from({ length: 4 }, () => new Audio(`assets/sfx/${n}.wav`)), i: 0 };
    }

    const tracks = {
        title: new Audio("assets/music/title.wav"),
        battle: new Audio("assets/music/battle.wav"),
    };
    for (const t of Object.values(tracks)) {
        t.loop = true;
        t.volume = 0.3;
    }

    let muted = false;
    let unlocked = false;
    let current = null;

    function play(name, vol = 0.6) {
        if (muted || !unlocked) return;
        const p = pools[name];
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
        current.currentTime = 0;
        if (unlocked && !muted) current.play().catch(() => {});
    }

    // Browsers block audio until the first user gesture.
    function unlock() {
        if (unlocked) return;
        unlocked = true;
        if (current && !muted) current.play().catch(() => {});
    }

    function toggleMute() {
        muted = !muted;
        if (current) muted ? current.pause() : current.play().catch(() => {});
    }

    return { play, track, unlock, toggleMute, get muted() { return muted; } };
})();
