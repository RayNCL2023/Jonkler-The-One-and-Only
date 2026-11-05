"use strict";
// ===== Setup =====
// The world renders to a tiny 320x180 canvas, which is blitted 4x onto the screen canvas.
// Text is drawn afterwards at full resolution so it stays crisp.
const W = 320, H = 180, S = 4;
const screen = document.getElementById("screen");
screen.width = W * S;
screen.height = H * S;
const d = screen.getContext("2d");
d.imageSmoothingEnabled = false;
const low = document.createElement("canvas");
low.width = W;
low.height = H;
const g = low.getContext("2d");

const G = 0.25;
const PTOP = 124;
const PILLAR_MIN = 72;
const ATK_LEN = 16;
let PL = 96, PR = 224;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ===== Input =====
const KEYMAP = {
    ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
    ArrowUp: "jump", KeyW: "jump", Space: "jump", ArrowDown: "down", KeyS: "down",
    KeyJ: "bonk", KeyZ: "bonk", KeyK: "pie", KeyX: "pie",
    Enter: "start", KeyP: "pause", Escape: "pause", KeyM: "mute", KeyC: "credits", KeyT: "tree",
};
const keys = new Set();
const pressed = new Set();
const held = (a) => keys.has(a);
const hit = (a) => pressed.has(a);

function press(a) {
    Sound.unlock();
    if (!keys.has(a)) pressed.add(a);
    keys.add(a);
}

addEventListener("keydown", (e) => {
    const a = KEYMAP[e.code];
    if (!a) return;
    e.preventDefault();
    press(a);
});
addEventListener("keyup", (e) => {
    const a = KEYMAP[e.code];
    if (a) keys.delete(a);
});
addEventListener("blur", () => {
    keys.clear();
    if (state === "play" || state === "clear") paused = true;
});

const isTouch = matchMedia("(pointer: coarse)").matches;
if (isTouch) document.body.classList.add("touch");
for (const b of document.querySelectorAll("#touch button")) {
    const a = b.dataset.a;
    b.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        press(a);
    });
    for (const ev of ["pointerup", "pointerleave", "pointercancel"]) b.addEventListener(ev, () => keys.delete(a));
}

// ===== Perks =====
// Base perks stack up to LV3. A LV3 perk evolves once you also hold its partner perk (any level).
// The partners form a ring (each base is the partner of exactly one evolution), which is also
// how the perk tree screen lays them out.
const MAX_LV = 3;
const BASE_ORDER = ["bigbonk", "heavy", "laugh", "society", "pie", "shoes", "whoopee"];
const PERKS = {
    bigbonk: {
        name: "BIG BONK", blurb: "BIGGER MALLET, BIGGER BONKS", evo: "wrecking",
        lv: [["RANGE +15%", "KNOCKBACK +8%"], ["RANGE +15%", "KNOCKBACK +8%"], ["RANGE +15%", "KNOCKBACK +8%"]],
    },
    heavy: {
        name: "HEAVY BONES", blurb: "HARDER TO SHOVE AROUND", evo: "ironclown",
        lv: [["TAKE 15% LESS", "KNOCKBACK"], ["TAKE 15% LESS", "KNOCKBACK"], ["TAKE 15% LESS", "KNOCKBACK"]],
    },
    laugh: {
        name: "LAUGH TRACK", blurb: "MORE HA, MORE HEALING", evo: "encore",
        lv: [["+1 MAX HA", "(AND HEAL IT)"], ["+1 MAX HA", "(AND HEAL IT)"], ["+1 MAX HA", "HEAL 2 PER WAVE"]],
    },
    society: {
        name: "SOCIETY", blurb: "REGULAR CRITICAL HITS", evo: "anarchy",
        lv: [["EVERY 5TH HIT", "IS A CRIT"], ["EVERY 4TH HIT", "IS A CRIT"], ["EVERY 3RD HIT", "IS A CRIT"]],
    },
    pie: {
        name: "PIE-ROMANIAC", blurb: "FASTER PIE COOLDOWN", evo: "piegun",
        lv: [["PIE COOLDOWN", "-20%"], ["PIE COOLDOWN", "-20%"], ["PIE COOLDOWN", "-20% (TOTAL -60%)"]],
    },
    shoes: {
        name: "CLOWN SHOES", blurb: "FASTER FEET, MORE JUMPS", evo: "jet",
        lv: [["MOVE SPEED +10%", ""], ["MOVE SPEED +10%", "+ TRIPLE JUMP"], ["MOVE SPEED +10%", "(TOTAL +30%)"]],
    },
    whoopee: {
        name: "WHOOPEE CUSHION", blurb: "LANDINGS RELEASE A BLAST", evo: "aftershock",
        lv: [["BIG LANDINGS", "RELEASE A BLAST"], ["BIGGER BLASTS", "& GROUND POUNDS"], ["BIGGER BLASTS", "& GROUND POUNDS"]],
    },
};
const EVOS = {
    wrecking: { name: "WRECKING BALL", from: "bigbonk", needs: "heavy", blurb: "COMBO FINISHERS SEND A SHOCKWAVE", desc: ["COMBO FINISHER", "SENDS A SHOCKWAVE"] },
    ironclown: { name: "IRON CLOWN", from: "heavy", needs: "laugh", blurb: "NO KNOCKBACK. GETTING HIT GOES CLANG", desc: ["IMMUNE TO KNOCKBACK", "HITS TAKEN CLANG"] },
    encore: { name: "ENCORE", from: "laugh", needs: "society", blurb: "ONCE PER WAVE, CHEAT DEATH", desc: ["ONCE PER WAVE,", "CHEAT DEATH"] },
    anarchy: { name: "ANARCHY", from: "society", needs: "pie", blurb: "EVERY 2ND HIT CRITS, AND CRITS EXPLODE", desc: ["EVERY 2ND HIT CRITS", "CRITS EXPLODE"] },
    piegun: { name: "PIE MACHINE GUN", from: "pie", needs: "shoes", blurb: "HOLD PIE TO SPRAY. LET GO BEFORE IT OVERHEATS", desc: ["HOLD PIE TO SPRAY", "WATCH THE HEAT!"] },
    jet: { name: "JET HONKERS", from: "shoes", needs: "whoopee", blurb: "+1 JUMP. AIR JUMPS BLAST WHAT'S BELOW", desc: ["+1 JUMP. AIR JUMPS", "BLAST BELOW YOU"] },
    aftershock: { name: "AFTERSHOCK", from: "whoopee", needs: "bigbonk", blurb: "GROUND POUNDS SEND QUAKES ALONG THE FLOOR", desc: ["GROUND POUNDS SEND", "FLOOR QUAKES"] },
};
const TREE_SIZE = BASE_ORDER.length * 2;

// Perk tree layout: Jonkler in the middle, base perks on the inner ring, evolutions on the outer
// ring sitting between their base and its partner.
const TREE_C = { x: 160, y: 98 };
const TREE_NODES = [];
BASE_ORDER.forEach((id, i) => {
    const a0 = -Math.PI / 2 + (i * Math.PI * 2) / BASE_ORDER.length;
    const a1 = a0 + Math.PI / BASE_ORDER.length;
    TREE_NODES.push({ id, kind: "base", x: Math.round(TREE_C.x + Math.cos(a0) * 54), y: Math.round(TREE_C.y + Math.sin(a0) * 28) });
    TREE_NODES.push({ id: PERKS[id].evo, kind: "evo", x: Math.round(TREE_C.x + Math.cos(a1) * 124), y: Math.round(TREE_C.y + Math.sin(a1) * 54) });
});
const TREE_BTN = { x: 4, y: 4, w: 52, h: 12 };

const QUIPS = [
    "BONK!", "HONK HONK", "WE LIVE IN A SOCIETY", "WHY SO SERIOUS?", "IT'S JONKLIN' TIME",
    "YOU WOULDN'T GET IT", "SKILL ISSUE", "HA HA HA HA", "JONKLER ALWAYS WINS",
];
const DEATH_LINES = [
    "TUNG TUNG TUNG TUNG", "THE MIMES WILL NEVER SHUT UP", "SKILL ISSUE",
    "EVEN CLOWNS FALL SOMETIMES",
];

const ENEMY = {
    mime: { w: 7, h: 18, weight: 1, speed: 0.55, reach: 11, wind: 26, act: 6, rec: 16, cd: 50, kb: 2.6 },
    police: { w: 9, h: 22, weight: 1.6, speed: 0.4, reach: 16, wind: 32, act: 6, rec: 22, cd: 70, kb: 3.6 },
    pigeon: { w: 9, h: 7, weight: 0.6, speed: 0.9, reach: 0, wind: 0, act: 0, rec: 0, cd: 0, kb: 1.8 },
    boss: { w: 18, h: 44, weight: 3.2, speed: 0.35, reach: 26, wind: 34, act: 8, rec: 24, cd: 60, kb: 5 },
};

// ===== State =====
let state = "title";
let paused = false;
let stateT = 0, titleT = 0;
let P, enemies = [], pies = [], bossWaves = [], quakes = [], rings = [], parts = [], floats = [];
let quip = null, banner = null, deathLine = "";
let wave = 0, queue = [], spawnT = 0;
let score = 0, chain = 0, chainT = 0, hitstop = 0, shake = 0, hitCounter = 0;
let perks = {}, owned = [], evos = new Set();
let perkChoices = [], perkSel = 1, newBest = false, treeSel = 0;
let best = 0;
let unlocked = new Set(); // every perk/evolution ever taken, across runs (fills in the perk tree)
try {
    best = Number(localStorage.getItem("jonkler-best")) || 0;
    unlocked = new Set(JSON.parse(localStorage.getItem("jonkler-unlocks") || "[]"));
} catch {}

const lv = (id) => perks[id] || 0;
const evo = (id) => evos.has(id);
const maxHp = () => 5 + lv("laugh");
const pieMax = () => Math.round(90 * (1 - 0.2 * lv("pie")));
const diff = () => Math.min(1.8, 1 + (wave - 1) * 0.05);

function discover(id) {
    if (unlocked.has(id)) return false;
    unlocked.add(id);
    try {
        localStorage.setItem("jonkler-unlocks", JSON.stringify([...unlocked]));
    } catch {}
    return true;
}

function newGame() {
    PL = 96;
    PR = 224;
    P = {
        x: 160, y: PTOP, vx: 0, vy: 0, dir: 1, onGround: true, jumps: 0, hp: 5,
        atk: 0, atkId: 0, combo: 0, comboT: 0, hurt: 0, inv: 0, pieCd: 0,
        pound: false, airT: 0, t: 0, dead: false, big: false,
        heat: 0, overheat: false, gunCd: 0, encoreUsed: false,
    };
    enemies = []; pies = []; bossWaves = []; quakes = []; rings = []; parts = []; floats = [];
    quip = null;
    score = 0; chain = 0; chainT = 0; hitstop = 0; shake = 0; hitCounter = 0;
    perks = {}; owned = []; evos = new Set();
    newBest = false;
    paused = false;
    state = "play";
    startWave(1);
    Sound.track("battle");
}

function goTitle() {
    PL = 96;
    PR = 224;
    state = "title";
    enemies = []; parts = []; floats = []; bossWaves = []; quakes = []; rings = [];
    Sound.track("title");
}

function startWave(n) {
    wave = n;
    P.encoreUsed = false;
    queue = buildQueue(n);
    spawnT = 70;
    banner = { text: n % 5 === 0 ? `BOSS WAVE ${n}` : `WAVE ${n}`, t: 100 };
    if (n >= 6 && n % 3 === 0 && PR - PL - 16 >= PILLAR_MIN) crumble();
}

function buildQueue(n) {
    const q = [];
    let count = 3 + Math.floor(n * 1.6);
    if (n % 5 === 0) {
        q.push("boss");
        count = Math.ceil(count / 2);
    }
    const table = [["mime", 1]];
    if (n >= 2) table.push(["pigeon", 0.35]);
    if (n >= 3) table.push(["police", 0.25 + n * 0.03]);
    if (n >= 4) table.push(["chute", 0.4]);
    const total = table.reduce((s, [, w]) => s + w, 0);
    for (let i = 0; i < count; i++) {
        let r = Math.random() * total;
        q.push(table.find(([, w]) => (r -= w) <= 0)?.[0] ?? "mime");
    }
    return q;
}

function crumble() {
    PL += 8;
    PR -= 8;
    P.x = clamp(P.x, PL + 4, PR - 4);
    for (const x of [PL - 4, PR + 4]) {
        for (let i = 0; i < 14; i++) {
            addPart(x + (Math.random() - 0.5) * 8, PTOP + Math.random() * 6, (Math.random() - 0.5) * 2, Math.random() * -2, 60, pick(["#a49cc0", "#7a7296", "#5a5470"]), 2, 0.15);
        }
    }
    banner.sub = "THE PILLAR CRUMBLES!";
    shake = 8;
    Sound.play("bighit", 0.7);
}

function spawnEnemy(type) {
    const base = ENEMY[type === "chute" ? "mime" : type];
    const side = Math.random() < 0.5 ? -1 : 1;
    const e = {
        type, ...base, x: 0, y: 0, vx: 0, vy: 0, dir: -side, dmg: 0, stun: 0, flash: 0,
        atk: 0, atkHit: false, cdT: 40, spT: 120, onGround: false, t: 0, hitBy: -1,
        mode: "leap", act2: "walk", aT: 0, boss: type === "boss", dead: false,
    };
    if (type === "pigeon") {
        e.x = side < 0 ? -10 : W + 10;
        e.y = e.baseY = 50 + Math.random() * 30;
        e.mode = "fly";
    } else if (type === "chute") {
        e.x = PL + 10 + Math.random() * (PR - PL - 20);
        e.y = -10;
        e.mode = "chute";
    } else if (type === "boss") {
        e.x = 160;
        e.y = -60;
        e.mode = "drop";
        banner = { text: "CHIEF KILLJOY", sub: "HAS ENTERED THE CHAT", t: 120 };
    } else {
        // leap up from below the pillar's edge
        e.x = side < 0 ? PL - 22 : PR + 22;
        e.y = H + 10;
        e.vy = -7.6;
        e.vx = -side * 0.62;
        Sound.play("jump", 0.2);
    }
    enemies.push(e);
}

// ===== Physics =====
// Returns true on the frame the entity lands on the pillar.
function physics(e, grav, fric) {
    const prevY = e.y;
    e.vy = Math.min(e.vy + grav, 7);
    e.x += e.vx;
    e.y += e.vy;
    const over = e.x >= PL - 2 && e.x <= PR + 2;
    if (over && prevY <= PTOP && e.y >= PTOP && e.vy >= 0) {
        e.y = PTOP;
        e.vy = 0;
        const landed = !e.onGround;
        e.onGround = true;
        return landed;
    }
    if (e.onGround && !over) e.onGround = false;
    // the pillar's sides act as walls for anything below the top
    if (!e.onGround && e.y > PTOP + 1 && e.x > PL - 3 && e.x < PR + 3) {
        e.x = e.x < (PL + PR) / 2 ? PL - 3 : PR + 3;
        e.vx = 0;
    }
    if (e.onGround) e.vx *= fric;
    return false;
}

function overlapEnemy(x0, y0, x1, y1, e) {
    return e.x + e.w / 2 > x0 && e.x - e.w / 2 < x1 && e.y > y0 && e.y - e.h < y1;
}

function overlapPlayer(x0, y0, x1, y1) {
    return P.x + 4 > x0 && P.x - 4 < x1 && P.y > y0 && P.y - 22 < y1;
}

// ===== Player =====
function updatePlayer() {
    const p = P;
    p.t++;
    p.big = lv("bigbonk") >= 2 || evo("wrecking");
    if (p.inv > 0) p.inv--;
    if (p.pieCd > 0) p.pieCd--;
    if (p.gunCd > 0) p.gunCd--;
    if (p.comboT > 0) p.comboT--;
    const speed = 1.5 * (1 + 0.1 * lv("shoes"));
    const maxJumps = 2 + (lv("shoes") >= 2 ? 1 : 0) + (evo("jet") ? 1 : 0);

    if (p.hurt > 0) {
        p.hurt--;
    } else {
        const move = (held("right") ? 1 : 0) - (held("left") ? 1 : 0);
        let target = move * speed;
        if (p.atk > 0 && p.onGround) target *= 0.35;
        if (!p.pound) p.vx += (target - p.vx) * (p.onGround ? 0.3 : 0.12);
        if (move && !p.atk) p.dir = move;

        if (hit("jump") && p.jumps < maxJumps && !p.pound) {
            const airJump = p.jumps > 0;
            p.vy = p.jumps === 0 ? -5.2 : -4.6;
            p.jumps++;
            p.onGround = false;
            Sound.play("jump", 0.4);
            dust(p.x, p.y, 4);
            if (airJump && evo("jet")) shockwave(p.x, p.y + 10, 24, 1.8, "PFFT");
        }
        if (hit("bonk")) {
            if (!p.onGround && held("down") && !p.pound) {
                p.pound = true;
                p.vy = 6.5;
                p.vx = 0;
                p.atk = 0;
            } else if (!p.atk && !p.pound) {
                p.combo = p.comboT > 0 ? (p.combo % 3) + 1 : 1;
                p.atk = ATK_LEN;
                p.atkId++;
                Sound.play("swing", 0.4);
            }
        }
        if (!evo("piegun") && hit("pie") && p.pieCd === 0 && !p.pound) {
            pies.push({ x: p.x + p.dir * 6, y: p.y - 13, vx: p.dir * 3.6 + p.vx * 0.3, vy: -0.6, life: 120, pw: 2.4, lift: 1.4, stun: 20, src: "pie" });
            p.pieCd = pieMax();
            Sound.play("move", 0.5);
        }
    }
    if (evo("piegun")) updatePieGun(p);

    if (p.atk > 0) {
        attackCheck();
        p.atk--;
        if (p.atk === 0) p.comboT = 18;
    }

    const landed = physics(p, p.pound ? 0.4 : 0.28, p.hurt ? 0.9 : 1);
    if (!p.onGround) p.airT++;
    if (!p.onGround && p.jumps === 0) p.jumps = 1; // walked off the edge: the ground jump is gone
    if (landed) {
        p.jumps = 0;
        if (p.pound) {
            p.pound = false;
            shockwave(p.x, p.y, 34 + 4 * lv("whoopee"), 3.2, "BONK");
            if (evo("aftershock")) {
                quakes.push({ x: p.x - 6, vx: -2.6, life: 70, hit: new Set() }, { x: p.x + 6, vx: 2.6, life: 70, hit: new Set() });
            }
        } else if (lv("whoopee") && p.airT > 18) {
            shockwave(p.x, p.y, 22 + 4 * lv("whoopee"), 1.6 + 0.3 * lv("whoopee"), "PFFT");
        } else {
            dust(p.x, p.y, 3);
        }
        p.airT = 0;
    }
    if (p.y > H + 30 && !encore("fell")) gameOver("fell");
}

// Pie Machine Gun: hold to spray weaker pies. Every pie adds heat; at 100% it locks up, and it
// only cools while the button is released, so it can't be held down forever.
function updatePieGun(p) {
    const holding = held("pie");
    if (p.overheat && p.t % 5 === 0) addPart(p.x + p.dir * 6, p.y - 15, (Math.random() - 0.5) * 0.4, -0.5, 30, "#8a8a9a", 1, -0.01);
    if (holding && !p.overheat && p.hurt === 0 && !p.pound) {
        if (p.gunCd > 0) return;
        pies.push({
            x: p.x + p.dir * 6, y: p.y - 13, vx: p.dir * 4.2 + p.vx * 0.3, vy: -0.3 - Math.random() * 0.6,
            life: 90, pw: 1.3, lift: 0.8, stun: 6, src: "gun",
        });
        p.gunCd = 6;
        p.heat += 0.09;
        Sound.play("move", 0.25);
        if (p.heat < 1) return;
        p.heat = 1;
        p.overheat = true;
        floatText(p.x, p.y - 32, "OVERHEAT!", "#ff5a5a");
        Sound.play("hurt", 0.4);
        return;
    }
    if (holding) return; // must let go to cool down
    p.heat = Math.max(0, p.heat - (p.overheat ? 0.007 : 0.02));
    if (!p.overheat || p.heat > 0) return;
    p.overheat = false;
    floatText(p.x, p.y - 32, "PIE GUN READY", "#3fbf3f");
    Sound.play("coin", 0.4);
}

// Encore evolution: once per wave, a fall or a lethal hit is forgiven.
function encore(reason) {
    if (!evo("encore") || P.encoreUsed) return false;
    P.encoreUsed = true;
    if (reason === "fell") {
        P.x = (PL + PR) / 2;
        P.y = -20;
        P.vy = 0;
        P.jumps = 1;
        P.onGround = false;
    }
    P.vx = 0;
    P.pound = false;
    P.hp = Math.max(P.hp, 1);
    P.inv = 150;
    banner = { text: "ENCORE!", sub: "THE CROWD WANTS MORE", t: 80 };
    Sound.play("wave", 0.6);
    confetti(P.x, Math.max(20, P.y - 20), 30);
    return true;
}

function attackCheck() {
    const p = P;
    const phase = ATK_LEN - p.atk;
    if (phase < 4 || phase > 8) return;
    const range = 17 * (1 + 0.15 * lv("bigbonk"));
    const x0 = p.dir > 0 ? p.x : p.x - range;
    const x1 = p.dir > 0 ? p.x + range : p.x;
    if (phase === 6 && p.combo === 3 && evo("wrecking")) shockwave(p.x + p.dir * range * 0.7, p.y, 24, 1.8, "CRASH");
    for (const e of enemies) {
        if (e.dead || e.hitBy === p.atkId) continue;
        if (!overlapEnemy(x0, p.y - 26, x1, p.y + 2, e)) continue;
        e.hitBy = p.atkId;
        const finisher = p.combo === 3;
        hitEnemy(e, p.dir, finisher ? 3.2 : 2.2, finisher ? 2.6 : 1.2);
    }
}

function hurtPlayer(dir, kb) {
    const p = P;
    if (p.inv > 0 || p.dead) return;
    p.hp--;
    p.inv = 70;
    p.atk = 0;
    p.pound = false;
    hitstop = 6;
    shake = Math.max(shake, 6);
    Sound.play("hurt", 0.7);
    sparks(p.x, p.y - 12, 8, "#d8283a");
    if (evo("ironclown")) {
        p.hurt = 6;
        p.vx = 0;
        shockwave(p.x, p.y, 30, 2.6, "CLANG");
    } else {
        const k = kb * (1 - 0.15 * lv("heavy"));
        p.vx = dir * k * 1.1;
        p.vy = -2.2 - k * 0.3;
        p.onGround = false;
        p.jumps = 1;
        p.hurt = 16;
    }
    if (p.hp <= 0 && !encore("hp")) gameOver("hp");
}

function gameOver(reason) {
    if (P.dead) return;
    P.dead = true;
    if (reason === "hp") {
        P.vy = -5;
        P.vx = -P.dir * 1.5;
    }
    state = "over";
    stateT = 0;
    deathLine = pick(DEATH_LINES);
    if (score > best) {
        best = score;
        newBest = true;
        try {
            localStorage.setItem("jonkler-best", String(best));
        } catch {}
    }
    Sound.track(null);
    Sound.play(reason === "fell" ? "scream" : "gameover", 0.7);
}

// ===== Combat =====
// src: "melee" | "pie" | "gun" | "wave" | "bowl". Only direct hits count toward crits, so blasts
// triggered by crits can't chain into more crits.
function hitEnemy(e, dir, power, lift, src = "melee") {
    power *= 1 + 0.08 * lv("bigbonk");
    let crit = false;
    if (src === "melee" || src === "pie" || src === "gun") {
        hitCounter++;
        const every = evo("anarchy") ? 2 : lv("society") ? 6 - lv("society") : 0;
        if (every && hitCounter % every === 0) {
            crit = true;
            power *= evo("anarchy") ? 1.5 : 1.8;
            floatText(e.x, e.y - e.h - 8, "CRIT!", "#f0c040");
        }
    }
    e.dmg += power * 7;
    const kb = (power * (1 + e.dmg / 55)) / e.weight;
    e.vx = dir * kb;
    e.vy = -(lift + kb * 0.3) / (e.boss ? 2 : 1);
    e.stun = Math.round((12 + kb * 4) * (e.boss ? 0.4 : 1));
    e.flash = 6;
    e.atk = 0;
    e.act2 = "walk";
    if (e.mode === "chute") {
        e.mode = "walk";
        confetti(e.x, e.y - 30, 8);
    }
    if (e.type === "pigeon") e.mode = "dazed";
    score += 10;
    if (crit && evo("anarchy")) shockwave(e.x, e.y, 20, 1.4, "BOOM", e);
    if (src === "gun") {
        // rapid-fire pies would otherwise freeze the game every few frames
        hitstop = Math.max(hitstop, 1);
        sparks(e.x - dir * 2, e.y - e.h / 2, 3);
        Sound.play("hit", 0.3);
        return;
    }
    hitstop = Math.min(8, 3 + Math.floor(kb));
    shake = Math.max(shake, Math.min(7, 1 + kb * 0.7));
    sparks(e.x - dir * 2, e.y - e.h / 2, kb > 4 ? 10 : 6);
    Sound.play(kb > 4 ? "bighit" : "hit", 0.6);
}

function shockwave(x, y, r, power, label, skip = null) {
    rings.push({ x, y, r: 0, max: r, life: 14 });
    for (const e of enemies) {
        if (e.dead || e === skip) continue;
        const dx = e.x - x;
        if (Math.abs(dx) < r && Math.abs(e.y - y) < 20) {
            hitEnemy(e, Math.sign(dx) || 1, power * (1 - (Math.abs(dx) / r) * 0.5), 2.5, "wave");
        }
    }
    shake = Math.max(shake, 5);
    Sound.play("bighit", 0.6);
    floatText(x, y - 30, label, "#f0c040");
    dust(x, y, 10);
}

// Enemies sent flying knock over whoever they crash into.
function bowl(e) {
    if (Math.abs(e.vx) < 2.5) return;
    for (const o of enemies) {
        if (o === e || o.dead || o.stun > 0) continue;
        const closeX = Math.abs(o.x - e.x) < (o.w + e.w) / 2;
        const closeY = Math.abs(o.y - o.h / 2 - (e.y - e.h / 2)) < (o.h + e.h) / 2;
        if (!closeX || !closeY) continue;
        hitEnemy(o, Math.sign(e.vx), Math.abs(e.vx) * 0.55, 1, "bowl");
        e.vx *= 0.6;
        floatText(o.x, o.y - o.h - 6, "STRIKE!", "#5ad0f0");
        score += 50;
    }
}

function knockOff(e) {
    e.dead = true;
    chain = chainT > 0 ? chain + 1 : 1;
    chainT = 150;
    const mult = Math.min(10, chain);
    const pts = (e.boss ? 2000 : e.type === "police" ? 200 : 100) * mult;
    score += pts;
    const cx = clamp(e.x, 8, W - 8);
    const cy = clamp(e.y, 16, H - 6);
    confetti(cx, cy, e.boss ? 60 : 24);
    floatText(cx, cy - 10, `+${pts}`, "#f0c040");
    if (mult > 1) floatText(cx, cy - 18, `x${mult} COMBO`, "#5ad0f0");
    Sound.play(Math.random() < 0.5 ? "scream" : "fall", 0.35);
    Sound.play("coin", 0.5);
    if (e.boss) {
        Sound.play("wave");
        shake = 10;
    }
    if (Math.random() < (e.boss ? 1 : 0.3)) sayQuip();
}

function sayQuip() {
    let text = pick(QUIPS);
    if (quip && quip.text === text) text = pick(QUIPS);
    quip = { text, life: 100 };
}

// ===== Enemies =====
function updateEnemy(e) {
    e.t++;
    if (e.flash > 0) e.flash--;
    if (e.cdT > 0) e.cdT--;
    if (e.type === "pigeon") {
        updatePigeon(e);
    } else if (e.stun > 0) {
        e.stun--;
        physics(e, G, 0.94);
        bowl(e);
    } else if (e.mode === "leap") {
        physics(e, G, 0.8);
        if (e.onGround) e.mode = "walk";
    } else if (e.mode === "chute") {
        e.vy = 0.45;
        e.vx = Math.sin(e.t / 20) * 0.3;
        physics(e, 0, 1);
        if (e.onGround) e.mode = "walk";
    } else if (e.mode === "drop") {
        if (physics(e, G, 0.8)) {
            shake = 8;
            Sound.play("bighit");
            dust(e.x, e.y, 14);
            if (Math.abs(P.x - e.x) < 20 && P.onGround) hurtPlayer(P.x < e.x ? -1 : 1, 4);
        }
        if (e.onGround) e.mode = "walk";
    } else if (e.boss) {
        bossAI(e);
    } else {
        walkerAI(e);
    }
    if (e.y > H + 20 || e.x < -40 || e.x > W + 40) knockOff(e);
}

function walkerAI(e) {
    const dx = P.x - e.x;
    if (e.atk > 0) {
        e.atk--;
        const active = e.atk < e.act + e.rec && e.atk >= e.rec;
        if (active && !e.atkHit) {
            const x0 = e.dir > 0 ? e.x : e.x - e.reach;
            const x1 = e.dir > 0 ? e.x + e.reach : e.x;
            if (overlapPlayer(x0, e.y - e.h, x1, e.y)) {
                e.atkHit = true;
                hurtPlayer(e.dir, e.kb);
            }
        }
        e.vx *= 0.7;
    } else {
        if (Math.abs(dx) > 2) e.dir = Math.sign(dx);
        const inRange = Math.abs(dx) < e.reach + 2 && Math.abs(P.y - e.y) < 18;
        if (inRange && e.cdT <= 0 && e.onGround && !P.dead) {
            e.atk = Math.round(e.wind / diff()) + e.act + e.rec;
            e.atkHit = false;
            e.cdT = e.cd / diff() + e.atk;
        } else if (!inRange || Math.abs(dx) > e.reach * 0.6) {
            let vx = e.dir * e.speed * diff();
            if ((vx < 0 && e.x + vx < PL + 3) || (vx > 0 && e.x + vx > PR - 3)) vx = 0; // no walking off
            e.vx += (vx - e.vx) * 0.2;
        } else {
            e.vx *= 0.7;
        }
    }
    physics(e, G, 1);
}

function bossAI(e) {
    const dx = P.x - e.x;
    e.spT--;
    switch (e.act2) {
        case "chargeWind":
            e.vx *= 0.7;
            physics(e, G, 1);
            if (--e.aT <= 0) {
                e.act2 = "charge";
                e.aT = 80;
                Sound.play("swing");
            }
            break;
        case "charge": {
            e.vx = e.dir * 3.4 * Math.min(1.3, diff());
            physics(e, G, 1);
            if (overlapPlayer(e.x - e.w / 2, e.y - e.h, e.x + e.w / 2, e.y)) hurtPlayer(e.dir, 5);
            if (e.t % 4 === 0) dust(e.x, e.y, 1);
            const nearEdge = e.dir > 0 ? e.x > PR - 12 : e.x < PL + 12;
            if (--e.aT <= 0 || nearEdge) {
                e.act2 = "walk";
                e.spT = 120;
                e.vx = 0;
            }
            break;
        }
        case "slam":
            if (physics(e, G, 1)) {
                e.act2 = "walk";
                e.spT = 110;
                shake = 8;
                Sound.play("bighit");
                dust(e.x, e.y, 12);
                bossWaves.push({ x: e.x - 10, vx: -2.4, life: 90 }, { x: e.x + 10, vx: 2.4, life: 90 });
            }
            break;
        default:
            if (e.spT <= 0 && e.onGround && Math.abs(dx) > 30 && !e.atk) {
                e.dir = Math.sign(dx) || 1;
                if (Math.random() < 0.5) {
                    e.act2 = "chargeWind";
                    e.aT = Math.round(45 / diff());
                } else {
                    e.act2 = "slam";
                    e.vy = -5.5;
                    e.vx = e.dir * 0.6;
                    e.onGround = false;
                    Sound.play("jump");
                }
            } else {
                walkerAI(e);
            }
    }
}

function updatePigeon(e) {
    if (e.mode === "dazed") {
        physics(e, G, 0.95);
        bowl(e);
        if (e.stun > 0) e.stun--;
        else e.mode = "leave";
    } else if (e.mode === "fly") {
        e.dir = Math.sign(P.x - e.x) || 1;
        e.vx += (e.dir * e.speed * diff() - e.vx) * 0.05;
        e.baseY += (70 - e.baseY) * 0.01;
        e.y = e.baseY + Math.sin(e.t / 12) * 6;
        e.x = clamp(e.x + e.vx, -12, W + 12);
        if (Math.abs(P.x - e.x) < 40 && e.cdT <= 0 && !P.dead) {
            e.mode = "dive";
            const ddx = P.x - e.x;
            const ddy = P.y - 10 - e.y;
            const l = Math.hypot(ddx, ddy) || 1;
            e.vx = (ddx / l) * 3;
            e.vy = Math.max(1, (ddy / l) * 3); // always swoop downward
            e.aT = 70;
        }
    } else if (e.mode === "dive") {
        e.x = clamp(e.x + e.vx, -12, W + 12);
        e.y += e.vy;
        if (overlapPlayer(e.x - 4, e.y - 6, e.x + 4, e.y)) {
            hurtPlayer(Math.sign(e.vx) || 1, e.kb);
            e.mode = "leave";
        }
        if (e.y >= PTOP - 3 || --e.aT <= 0) e.mode = "leave";
    } else if (e.mode === "leave") {
        e.vy = -1.6;
        e.x = clamp(e.x + e.vx * 0.6, 4, W - 4);
        e.y += e.vy;
        if (e.y < 60 || e.y > H) {
            e.mode = "fly";
            e.baseY = e.y;
            e.cdT = 90 / diff();
        }
    }
}

function separate() {
    for (let i = 0; i < enemies.length; i++) {
        const a = enemies[i];
        if (a.type === "pigeon" || !a.onGround || a.stun) continue;
        for (let j = i + 1; j < enemies.length; j++) {
            const b = enemies[j];
            if (b.type === "pigeon" || !b.onGround || b.stun) continue;
            const dx = b.x - a.x;
            const min = ((a.w + b.w) / 2) * 0.8;
            if (Math.abs(dx) >= min) continue;
            const push = (min - Math.abs(dx)) * 0.1 * (Math.sign(dx) || 1);
            a.x = clamp(a.x - push, PL + 1, PR - 1);
            b.x = clamp(b.x + push, PL + 1, PR - 1);
        }
    }
}

// ===== Projectiles & effects =====
function updatePies() {
    for (const p of pies) {
        p.vy += 0.06;
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        for (const e of enemies) {
            if (e.dead || Math.abs(e.x - p.x) > e.w / 2 + 3 || p.y < e.y - e.h - 2 || p.y > e.y + 2) continue;
            hitEnemy(e, Math.sign(p.vx), p.pw, p.lift, p.src);
            e.stun += p.stun; // cream to the face
            splat(p.x, p.y);
            p.life = 0;
            break;
        }
        if (p.life > 0 && p.y > PTOP && p.x > PL && p.x < PR) {
            splat(p.x, PTOP);
            p.life = 0;
        }
    }
    pies = pies.filter((p) => p.life > 0 && p.y < H + 10);
}

function updateBossWaves() {
    for (const w of bossWaves) {
        w.x += w.vx;
        w.life--;
        if (w.x < PL || w.x > PR) w.life = 0;
        if (P.y > PTOP - 7 && Math.abs(P.x - w.x) < 5) hurtPlayer(Math.sign(w.vx), 3.5);
    }
    bossWaves = bossWaves.filter((w) => w.life > 0);
}

// Aftershock: player-made quakes that roll along the pillar top, hitting each grounded enemy once.
function updateQuakes() {
    for (const q of quakes) {
        q.x += q.vx;
        q.life--;
        if (q.x < PL || q.x > PR) q.life = 0;
        if (q.life % 3 === 0) dust(q.x, PTOP, 1);
        for (const e of enemies) {
            if (e.dead || q.hit.has(e) || e.y < PTOP - 6 || Math.abs(e.x - q.x) > e.w / 2 + 3) continue;
            q.hit.add(e);
            hitEnemy(e, Math.sign(q.vx), 2.6, 3, "wave");
        }
    }
    quakes = quakes.filter((q) => q.life > 0);
}

function addPart(x, y, vx, vy, life, color, size = 1, grav = 0.1) {
    parts.push({ x, y, vx, vy, life, color, size, grav });
}

function confetti(x, y, n) {
    const cols = ["#e03c3c", "#f0c040", "#3fbf3f", "#7b3fa0", "#5ad0f0", "#ffffff"];
    for (let i = 0; i < n; i++) {
        addPart(x, y, (Math.random() - 0.5) * 5, -Math.random() * 5 - 1, 50 + Math.random() * 30, pick(cols), Math.random() < 0.3 ? 2 : 1, 0.12);
    }
}

function sparks(x, y, n, color = "#fff4c0") {
    for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 1 + Math.random() * 2.5;
        addPart(x, y, Math.cos(a) * s, Math.sin(a) * s, 10 + Math.random() * 6, color, 1, 0);
    }
}

function dust(x, y, n) {
    for (let i = 0; i < n; i++) {
        addPart(x + (Math.random() - 0.5) * 6, y - 1, (Math.random() - 0.5) * 1.6, -Math.random() * 0.6, 18 + Math.random() * 10, "#b8a8c8", 1, -0.01);
    }
}

function splat(x, y) {
    for (let i = 0; i < 10; i++) {
        addPart(x, y, (Math.random() - 0.5) * 3, -Math.random() * 2, 25, Math.random() < 0.8 ? "#fff8e8" : "#d8283a", 1, 0.12);
    }
}

function floatText(x, y, text, color) {
    floats.push({ x, y, text, color, life: 50 });
}

function updateParts() {
    for (const p of parts) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.grav;
        if (p.grav > 0.11) {
            p.vx *= 0.94;
            p.vy = Math.min(p.vy, 1.2); // confetti flutters down
        } else {
            p.vx *= 0.96;
        }
        p.life--;
    }
    parts = parts.filter((p) => p.life > 0);
    for (const f of floats) {
        f.y -= 0.4;
        f.life--;
    }
    floats = floats.filter((f) => f.life > 0);
    for (const r of rings) {
        r.r += (r.max - r.r) * 0.35;
        r.life--;
    }
    rings = rings.filter((r) => r.life > 0);
}

// ===== Update =====
function updateWorld() {
    if (!P.dead) {
        updatePlayer();
    } else {
        P.vy += 0.28;
        P.x += P.vx;
        P.y = Math.min(P.y + P.vy, H + 60);
        P.t++;
    }
    for (const e of enemies) if (!e.dead) updateEnemy(e);
    enemies = enemies.filter((e) => !e.dead);
    separate();
    updatePies();
    updateBossWaves();
    updateQuakes();
    updateParts();
    if (chainT > 0 && --chainT === 0) chain = 0;
    if (quip && --quip.life <= 0) quip = null;
    if (banner && --banner.t <= 0) banner = null;
    shake *= 0.85;
    if (shake < 0.3) shake = 0;
}

const takeRandom = (arr) => arr.splice(Math.floor(Math.random() * arr.length), 1)[0];

// Offers 3 cards: base perks below LV3 and any evolution that's ready. A ready evolution is always
// offered (in the middle slot). Once almost everything is maxed, the gaps fill with heals.
function openPerks() {
    const ready = Object.keys(EVOS).filter((id) => !evo(id) && lv(EVOS[id].from) >= MAX_LV && lv(EVOS[id].needs) >= 1);
    const pool = BASE_ORDER.filter((id) => lv(id) < MAX_LV);
    perkChoices = [];
    if (ready.length) perkChoices.push(takeRandom(ready));
    pool.push(...ready);
    while (perkChoices.length < 3 && pool.length) perkChoices.push(takeRandom(pool));
    while (perkChoices.length < 3) perkChoices.push("snack");
    if (EVOS[perkChoices[0]]) [perkChoices[0], perkChoices[1]] = [perkChoices[1], perkChoices[0]];
    perkSel = 1;
    state = "perk";
}

function choosePerk(id) {
    let fresh = false;
    if (id === "snack") {
        P.hp += 2;
    } else if (EVOS[id]) {
        evos.add(id);
        fresh = discover(id);
    } else {
        if (!perks[id]) owned.push(id);
        perks[id] = lv(id) + 1;
        if (id === "laugh") P.hp++;
        fresh = discover(id);
    }
    P.hp = Math.min(P.hp, maxHp());
    Sound.play("select", 0.6);
    state = "play";
    startWave(wave + 1);
    if (fresh) floatText(P.x, P.y - 34, "NEW IN THE PERK TREE!", "#5ad0f0");
}

function skipPerk() {
    P.hp = Math.min(maxHp(), P.hp + 1);
    Sound.play("select", 0.6);
    state = "play";
    startWave(wave + 1);
}

function openTree() {
    state = "tree";
    treeSel = 0;
    Sound.play("select", 0.5);
}

function update() {
    if (hit("mute")) Sound.toggleMute();

    if (state === "title") {
        titleT++;
        if (hit("tree")) openTree();
        else if (hit("start") || hit("bonk") || hit("jump")) newGame();
        else if (hit("credits")) state = "credits";
        return;
    }
    if (state === "tree") {
        titleT++;
        const step = (hit("right") ? 1 : 0) - (hit("left") ? 1 : 0);
        if (step) treeSel = (treeSel + step + TREE_SIZE) % TREE_SIZE;
        if (hit("jump") || hit("down")) treeSel ^= 1; // hop between a base perk and its evolution
        if (step || hit("jump") || hit("down")) Sound.play("move", 0.4);
        if (hit("pause") || hit("tree") || hit("start")) state = "title";
        return;
    }
    if (state === "credits") {
        if (hit("start") || hit("bonk") || hit("jump") || hit("pause") || hit("credits")) goTitle();
        return;
    }
    if (state === "perk") {
        if (hit("left")) {
            perkSel = (perkSel + 2) % 3;
            Sound.play("move", 0.4);
        }
        if (hit("right")) {
            perkSel = (perkSel + 1) % 3;
            Sound.play("move", 0.4);
        }
        if (hit("bonk") || hit("start") || hit("jump")) choosePerk(perkChoices[perkSel]);
        else if (hit("pie")) skipPerk();
        updateParts();
        return;
    }
    if (state === "over") {
        stateT++;
        updateWorld();
        if (stateT < 50) return;
        if (hit("start") || hit("bonk")) newGame();
        else if (hit("pause")) goTitle();
        else if (hit("credits")) state = "credits";
        return;
    }

    // play / clear
    if (hit("pause")) paused = !paused;
    if (paused) return;
    if (hitstop > 0) {
        hitstop--;
        pressed.delete("pause");
        pressed.delete("mute");
        return "hold"; // keep buffered inputs through the freeze-frame
    }
    updateWorld();
    if (state === "clear") {
        if (++stateT > 90) openPerks();
        return;
    }
    if (state !== "play") return;

    spawnT--;
    const maxAlive = Math.min(9, 2 + Math.floor(wave * 0.6));
    if (queue.length && spawnT <= 0 && enemies.length < maxAlive) {
        spawnEnemy(queue.shift());
        spawnT = Math.max(28, 100 - wave * 6);
    }
    if (!queue.length && !enemies.length) {
        state = "clear";
        stateT = 0;
        const heal = lv("laugh") >= MAX_LV ? 2 : 1;
        P.hp = Math.min(maxHp(), P.hp + heal);
        Sound.play("wave", 0.6);
        banner = { text: "WAVE CLEAR!", sub: `+${heal} HA`, t: 90 };
    }
}

// ===== Rendering =====
const texts = [];
function txt(str, x, y, size = 6, color = "#ffffff", align = "left", shadow = "#1a1020") {
    texts.push({ str, x, y, size, color, align, shadow });
}

function flushText(ox, oy) {
    d.textBaseline = "top";
    for (const t of texts) {
        d.font = `${t.size * S}px "PS2P", monospace`;
        d.textAlign = t.align;
        const x = (t.x + ox) * S;
        const y = (t.y + oy) * S;
        if (t.shadow) {
            const o = Math.max(2, (t.size * S) / 8);
            d.fillStyle = t.shadow;
            d.fillText(t.str, x + o, y + o);
        }
        d.fillStyle = t.color;
        d.fillText(t.str, x, y);
    }
    texts.length = 0;
}

function makeBackground() {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const b = c.getContext("2d");
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

    const bands = ["#120a20", "#180d2a", "#1f1034", "#27133d", "#311747", "#3b1b4f"];
    bands.forEach((col, i) => {
        b.fillStyle = col;
        b.fillRect(0, i * 22, W, i === bands.length - 1 ? H : 22);
    });
    // dithered band edges
    for (let i = 1; i < bands.length; i++) {
        b.fillStyle = bands[i];
        for (let x = 0; x < W; x += 2) b.fillRect(x + (i % 2), i * 22 - 1, 1, 1);
        for (let x = 0; x < W; x += 4) b.fillRect(x, i * 22 - 2, 1, 1);
    }
    for (let i = 0; i < 70; i++) {
        b.fillStyle = rnd() < 0.2 ? "#f0e6b0" : "#8a7aa8";
        b.fillRect(Math.floor(rnd() * W), Math.floor(rnd() * 100), 1, 1);
    }
    // moon
    const disc = (cx, cy, r, col) => {
        b.fillStyle = col;
        for (let dy = -r; dy <= r; dy++) {
            const hw = Math.floor(Math.sqrt(r * r - dy * dy));
            b.fillRect(cx - hw, cy + dy, hw * 2 + 1, 1);
        }
    };
    disc(262, 34, 13, "#efe4b8");
    disc(257, 30, 3, "#d4c896");
    disc(267, 39, 2, "#d4c896");
    disc(265, 27, 1, "#d4c896");
    // far skyline
    let x = 0;
    while (x < W) {
        const w = 10 + Math.floor(rnd() * 18);
        const top = H - 100 + Math.floor(rnd() * 40);
        b.fillStyle = "#24163a";
        b.fillRect(x, top, w, H - top);
        b.fillStyle = "#c8a040";
        for (let wy = top + 3; wy < H; wy += 4) {
            for (let wx = x + 2; wx < x + w - 1; wx += 3) if (rnd() < 0.12) b.fillRect(wx, wy, 1, 1);
        }
        x += w + 1;
    }
    // near skyline
    x = 0;
    while (x < W) {
        const w = 14 + Math.floor(rnd() * 16);
        const top = H - 25 - Math.floor(rnd() * 30);
        b.fillStyle = "#170e26";
        b.fillRect(x, top, w, H - top);
        b.fillStyle = "#e0b040";
        for (let wy = top + 4; wy < H; wy += 5) {
            for (let wx = x + 2; wx < x + w - 2; wx += 4) if (rnd() < 0.08) b.fillRect(wx, wy, 2, 1);
        }
        x += w;
    }
    return c;
}
const bgCanvas = makeBackground();

function drawPillar() {
    const bx0 = PL + 4, bx1 = PR - 4;
    g.fillStyle = "#5a5470";
    g.fillRect(bx0, PTOP + 6, bx1 - bx0, H - PTOP);
    g.fillStyle = "#454058";
    for (let y = PTOP + 12, row = 0; y < H; y += 6, row++) {
        g.fillRect(bx0, y, bx1 - bx0, 1);
        for (let x = bx0 + (row % 2 ? 0 : 6); x < bx1; x += 12) g.fillRect(x, y + 1, 1, 5);
    }
    g.fillStyle = "#6e6888";
    g.fillRect(bx0, PTOP + 6, 3, H);
    g.fillStyle = "#3a3450";
    g.fillRect(bx1 - 6, PTOP + 6, 6, H);
    g.fillStyle = "#a49cc0";
    g.fillRect(PL, PTOP, PR - PL, 3);
    g.fillStyle = "#7a7296";
    g.fillRect(PL, PTOP + 3, PR - PL, 3);
    // circus bunting
    for (let x = PL + 2, i = 0; x < PR - 4; x += 6, i++) {
        g.fillStyle = i % 2 ? "#f4f0e8" : "#d8283a";
        g.fillRect(x, PTOP + 6, 5, 2);
        g.fillRect(x + 1, PTOP + 8, 3, 1);
        g.fillRect(x + 2, PTOP + 9, 1, 1);
    }
}

function drawFog() {
    for (let i = 0; i < 5; i++) {
        g.fillStyle = `rgba(18,10,32,${0.12 + i * 0.1})`;
        g.fillRect(0, H - 22 + i * 4, W, 4);
    }
}

function dim(a = 0.7) {
    g.fillStyle = `rgba(10,5,20,${a})`;
    g.fillRect(0, 0, W, H);
}

function drawNose(x, y, full) {
    g.fillStyle = full ? "#e03c3c" : "#3a2a4a";
    g.fillRect(x + 1, y, 3, 5);
    g.fillRect(x, y + 1, 5, 3);
    if (!full) return;
    g.fillStyle = "#ff9a9a";
    g.fillRect(x + 1, y + 1, 1, 1);
}

function drawWorld() {
    for (const w of bossWaves) {
        g.fillStyle = "#e0d0ff";
        g.fillRect(Math.round(w.x) - 3, PTOP - 4, 2, 4);
        g.fillRect(Math.round(w.x) - 1, PTOP - 7, 2, 7);
        g.fillRect(Math.round(w.x) + 1, PTOP - 4, 2, 4);
    }
    for (const q of quakes) {
        const h = 3 + (q.life % 4 < 2 ? 2 : 0);
        g.fillStyle = "#f0c040";
        g.fillRect(Math.round(q.x) - 2, PTOP - h + 2, 1, h - 2);
        g.fillRect(Math.round(q.x), PTOP - h, 1, h);
        g.fillRect(Math.round(q.x) + 2, PTOP - h + 2, 1, h - 2);
    }
    for (const e of enemies) {
        drawEnemy(g, e);
        const winding = (e.atk > 0 && e.atk >= e.act + e.rec) || e.act2 === "chargeWind";
        if (winding) txt("!", e.x, e.y - e.h - 12, 8, "#f0c040", "center");
        if (e.dmg > 0 && e.type !== "pigeon" && !e.boss) {
            const col = e.dmg < 40 ? "#ffffff" : e.dmg < 80 ? "#f0c040" : "#ff5a5a";
            txt(`${Math.round(e.dmg)}%`, e.x, e.y + 2, 4, col, "center");
        }
    }
    for (const p of pies) drawPie(g, p.x, p.y);
    drawJonkler(g, P);
    for (const p of parts) {
        g.fillStyle = p.color;
        g.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    for (const r of rings) {
        g.fillStyle = "#f0e6b0";
        for (let i = 0; i < 20; i++) {
            const a = (i / 20) * Math.PI * 2;
            g.fillRect(Math.round(r.x + Math.cos(a) * r.r), Math.round(r.y - 2 + Math.sin(a) * r.r * 0.3), 2, 1);
        }
    }
    drawFog();
    for (const f of floats) txt(f.text, f.x, f.y, 5, f.color, "center");

    if (quip && !P.dead) {
        const tw = quip.text.length * 4 + 6;
        const bx = Math.round(clamp(P.x - tw / 2, 2, W - tw - 2));
        const by = Math.round(P.y - 42);
        g.fillStyle = "#1a1020";
        g.fillRect(bx - 1, by - 1, tw + 2, 12);
        g.fillStyle = "#ffffff";
        g.fillRect(bx, by, tw, 10);
        g.fillRect(Math.round(clamp(P.x, bx + 2, bx + tw - 4)), by + 10, 2, 2);
        txt(quip.text, bx + 3, by + 3, 4, "#1a1020", "left", null);
    }
}

function drawHUD() {
    txt("HA", 4, 4, 5, "#f4f0e8");
    for (let i = 0; i < maxHp(); i++) drawNose(16 + i * 7, 4, i < P.hp);
    // pie cooldown bar, or the heat gauge once the pie machine gun is unlocked
    drawPie(g, 7, 15);
    g.fillStyle = "#3a2a4a";
    g.fillRect(12, 13, 24, 2);
    if (evo("piegun")) {
        const blink = Math.floor(P.t / 6) % 2;
        g.fillStyle = P.overheat ? (blink ? "#ff5a5a" : "#a02030") : P.heat > 0.7 ? "#e8862a" : "#f0c040";
        g.fillRect(12, 13, Math.round(24 * P.heat), 2);
        if (P.overheat) txt(held("pie") ? "LET GO!" : "COOLING", 39, 12, 4, "#ff8a8a");
        else if (P.heat > 0.7) txt("HOT", 39, 12, 4, "#e8862a");
    } else {
        g.fillStyle = P.pieCd ? "#b8a8c8" : "#fff8e8";
        g.fillRect(12, 13, Math.round(24 * (1 - P.pieCd / pieMax())), 2);
    }

    txt(String(score), 160, 4, 8, "#ffffff", "center");
    txt(`WAVE ${wave}`, 160, 14, 4, "#b8a8c8", "center");
    if (chain > 1) txt(`COMBO x${Math.min(10, chain)}`, 160, 20, 4, "#5ad0f0", "center");
    drawPerkBar();
    if (Sound.muted) txt("MUTED", W - 4, 23, 4, "#6a5a80", "right");

    const boss = enemies.find((e) => e.boss);
    if (boss) txt(`CHIEF KILLJOY  ${Math.round(boss.dmg)}%`, 160, H - 10, 5, "#ff8a8a", "center");

    if (banner) {
        txt(banner.text, 160, 50, 12, "#f0c040", "center");
        if (banner.sub) txt(banner.sub, 160, 68, 5, "#ffffff", "center");
    }
}

// Active perks, top-right: one slot per base perk (first taken = rightmost). A slot shows level
// pips, and swaps to the evolution's symbol with a gold frame once evolved.
function drawPerkBar() {
    owned.forEach((id, i) => {
        const x = W - 17 - i * 15;
        const y = 3;
        const ev = PERKS[id].evo;
        const isEvo = evo(ev);
        g.fillStyle = isEvo ? "#f0c040" : "#7b3fa0";
        g.fillRect(x - 1, y - 1, 15, 15);
        g.fillStyle = "#24143a";
        g.fillRect(x, y, 13, 13);
        g.save();
        g.beginPath();
        g.rect(x, y, 13, 13);
        g.clip();
        drawPerkIcon(g, isEvo ? ev : id, x + 6, y + 7, 1);
        g.restore();
        const spent = (ev === "encore" && isEvo && P.encoreUsed) || (ev === "piegun" && isEvo && P.overheat);
        if (spent) {
            g.fillStyle = "rgba(10,5,20,0.6)";
            g.fillRect(x, y, 13, 13);
        }
        if (isEvo) return;
        for (let k = 0; k < MAX_LV; k++) {
            g.fillStyle = k < perks[id] ? "#f0c040" : "#3a2a4a";
            g.fillRect(x + 1 + k * 4, y + 15, 3, 2);
        }
    });
}

function cardInfo(id) {
    if (id === "snack") return { name: "SNACK TIME", lines: ["HEAL 2 HA", "MMM, CAKE"], tag: "", gold: false };
    if (EVOS[id]) return { name: EVOS[id].name, lines: EVOS[id].desc, tag: "EVOLUTION!", gold: true };
    const next = lv(id) + 1;
    return { name: PERKS[id].name, lines: PERKS[id].lv[next - 1], tag: next === 1 ? "NEW" : `LV ${next}/${MAX_LV}`, gold: false };
}

const cardRect = (i) => ({ x: 22 + i * 96, y: 46, w: 84, h: 84 });

function drawPerks() {
    dim(0.75);
    txt("PICK A PERK", 160, 14, 7, "#f0c040", "center");
    txt("PERKS STACK TO LV3. LV3 + ITS PARTNER PERK = EVOLUTION", 160, 28, 4, "#d8c8f0", "center");
    const blink = Math.floor(titleT++ / 10) % 2;
    perkChoices.forEach((id, i) => {
        const c = cardRect(i);
        const info = cardInfo(id);
        const sel = i === perkSel;
        const y = c.y - (sel ? 3 : 0);
        g.fillStyle = sel ? "#f0c040" : info.gold ? (blink ? "#e8862a" : "#f0c040") : "#7b3fa0";
        g.fillRect(c.x - 1, y - 1, c.w + 2, c.h + 2);
        g.fillStyle = info.gold ? "#3a1f2a" : "#24143a";
        g.fillRect(c.x, y, c.w, c.h);
        drawPerkIcon(g, id, c.x + c.w / 2, y + 28);
        txt(info.name, c.x + c.w / 2, y + 6, 5, sel ? "#f0c040" : "#ffffff", "center");
        txt(info.tag, c.x + c.w / 2, y + 44, 4, info.gold ? "#f0c040" : "#5ad0f0", "center");
        txt(info.lines[0], c.x + c.w / 2, y + 58, 4, "#d8c8f0", "center");
        txt(info.lines[1], c.x + c.w / 2, y + 66, 4, "#d8c8f0", "center");
    });
    txt("K / PIE: SKIP AND HEAL 1 HA", 160, 142, 4, "#b8a8c8", "center");
    txt(isTouch ? "TAP A CARD TO TAKE IT" : "A/D CHOOSE   J TAKE", 160, 154, 5, "#ffffff", "center");
}

// Bresenham-ish pixel line on the low-res canvas.
function pixLine(x0, y0, x1, y1, color, dotted = false) {
    g.fillStyle = color;
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
    for (let i = 0; i <= n; i++) {
        if (dotted && i % 4 > 1) continue;
        g.fillRect(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), 1, 1);
    }
}

function drawTree() {
    dim(0.82);
    txt("PERK TREE", 160, 6, 7, "#f0c040", "center");
    txt(`DISCOVERED ${unlocked.size}/${TREE_SIZE}`, 160, 17, 4, "#b8a8c8", "center");
    txt(isTouch ? "< BACK" : "ESC BACK", W - 4, 6, 4, "#b8a8c8", "right");

    // edges: root -> base (solid), base -> evolution (solid), partner -> evolution (dotted)
    const dark = "#2e2040";
    BASE_ORDER.forEach((id, i) => {
        const b = TREE_NODES[i * 2];
        const e = TREE_NODES[i * 2 + 1];
        const c = TREE_NODES[((i + 1) % BASE_ORDER.length) * 2];
        const lit = unlocked.has(e.id);
        pixLine(TREE_C.x, TREE_C.y, b.x, b.y, unlocked.has(id) ? "#7b3fa0" : dark);
        pixLine(c.x, c.y, e.x, e.y, lit ? "#a07a30" : dark, true);
        pixLine(b.x, b.y, e.x, e.y, lit ? "#f0c040" : dark);
    });
    drawJonkler(g, { x: TREE_C.x, y: TREE_C.y + 11, dir: 1, onGround: true, vx: 0, atk: 0, t: titleT, inv: 0, hurt: 0, pound: false, combo: 1 });

    const blink = Math.floor(titleT / 15) % 2;
    TREE_NODES.forEach((n, i) => {
        const known = unlocked.has(n.id);
        const x = n.x - 7;
        const y = n.y - 7;
        let border = known ? (n.kind === "evo" ? "#f0c040" : "#7b3fa0") : "#3a2a4a";
        if (i === treeSel && blink) border = "#ffffff";
        g.fillStyle = border;
        g.fillRect(x - 1, y - 1, 17, 17);
        g.fillStyle = known ? "#24143a" : "#140c22";
        g.fillRect(x, y, 15, 15);
        if (!known) return txt("?", n.x + 1, n.y - 2, 5, "#4a3a60", "center", null);
        g.save();
        g.beginPath();
        g.rect(x, y, 15, 15);
        g.clip();
        drawPerkIcon(g, n.id, n.x, n.y, 1);
        g.restore();
    });

    // info for the selected node
    const n = TREE_NODES[treeSel];
    const known = unlocked.has(n.id);
    const nameOf = (id) => (unlocked.has(id) ? PERKS[id].name : "???");
    let name, line1, line2;
    if (n.kind === "base") {
        const p = PERKS[n.id];
        name = known ? p.name : "???";
        line1 = known ? p.blurb : "TAKE IT DURING A RUN TO DISCOVER IT";
        line2 = `STACKS TO LV3. EVOLVES INTO ${unlocked.has(p.evo) ? EVOS[p.evo].name : "???"}`;
    } else {
        const ev = EVOS[n.id];
        name = known ? ev.name : "??? EVOLUTION";
        line1 = known ? ev.blurb : "AN UNDISCOVERED EVOLUTION";
        line2 = `NEEDS LV3 ${nameOf(ev.from)} + ${nameOf(ev.needs)}`;
    }
    txt(name, 160, 161, 5, known ? (n.kind === "evo" ? "#f0c040" : "#ffffff") : "#6a5a80", "center");
    txt(line1, 160, 168, 4, "#d8c8f0", "center");
    txt(line2, 160, 174, 4, "#8a7aa8", "center");
}

function drawTitle() {
    const dummy = { x: 160, y: PTOP, dir: 1, onGround: true, vx: 0, atk: 0, t: titleT, inv: 0, hurt: 0, pound: false, combo: 1 };
    const cyc = titleT % 120;
    if (cyc < 16) dummy.atk = 16 - cyc;
    drawJonkler(g, dummy, 2);
    drawFog();
    txt("JONKLER", 160, 12, 22, "#3fbf3f", "center", "#4e2266");
    txt("THE ONE AND ONLY", 160, 40, 7, "#f0c040", "center");
    txt("KNOCK EVERYONE OFF THE PILLAR. DON'T FALL.", 160, 52, 4, "#d8c8f0", "center");
    if (Math.floor(titleT / 30) % 2 === 0) {
        txt(isTouch ? "TAP TO JONKLE" : "PRESS ENTER TO JONKLE", 160, 134, 6, "#ffffff", "center");
    }
    txt("A/D MOVE  W/SPACE JUMP  J/CLICK BONK  K PIE", 160, 150, 4, "#d8c8f0", "center");
    txt("S+J IN THE AIR: GROUND POUND", 160, 158, 4, "#d8c8f0", "center");
    txt("C CREDITS   T PERK TREE   M MUTE   P PAUSE", 160, 168, 4, "#8a7aa8", "center");
    if (best) txt(`BEST ${best}`, W - 4, 4, 4, "#f0c040", "right");

    const b = TREE_BTN;
    g.fillStyle = "#7b3fa0";
    g.fillRect(b.x - 1, b.y - 1, b.w + 2, b.h + 2);
    g.fillStyle = "#24143a";
    g.fillRect(b.x, b.y, b.w, b.h);
    txt(isTouch ? "PERK TREE" : "T PERK TREE", b.x + b.w / 2, b.y + 4, 4, "#f0c040", "center");
    txt(`${unlocked.size}/${TREE_SIZE} FOUND`, b.x + b.w / 2, b.y + b.h + 3, 4, "#8a7aa8", "center");
}

function drawCredits() {
    dim(0.85);
    const lines = [
        ["CREDITS", 8, "#f0c040"],
        ["", 4],
        ["GAME CODE & ALL PIXEL ART", 5, "#3fbf3f"],
        ["MADE FROM SCRATCH FOR THE JAM", 4, "#ffffff"],
        ["", 4],
        ["MUSIC: JUHANI JUNKALA", 5, "#3fbf3f"],
        ["RETRO GAME MUSIC PACK (CC0)", 4, "#ffffff"],
        ["", 4],
        ["SOUND FX: JUHANI JUNKALA", 5, "#3fbf3f"],
        ["THE ESSENTIAL RETRO VIDEO GAME", 4, "#ffffff"],
        ["SOUND EFFECTS COLLECTION (CC0)", 4, "#ffffff"],
        ["", 4],
        ["FONT: PRESS START 2P BY CODEMAN38", 5, "#3fbf3f"],
        ["SIL OPEN FONT LICENSE 1.1", 4, "#ffffff"],
        ["", 4],
        ["VIA OPENGAMEART.ORG & GOOGLE FONTS", 4, "#8a7aa8"],
    ];
    let y = 12;
    for (const [s, size, col] of lines) {
        if (s) txt(s, 160, y, size, col, "center");
        y += size + 4;
    }
    txt(isTouch ? "TAP TO RETURN" : "ENTER TO RETURN", 160, 166, 4, "#b8a8c8", "center");
}

function drawGameOver() {
    if (stateT < 40) return;
    dim(0.7);
    txt("THE JONKLER", 160, 26, 12, "#3fbf3f", "center", "#4e2266");
    txt("HAS FALLEN", 160, 44, 12, "#3fbf3f", "center", "#4e2266");
    txt(deathLine, 160, 64, 5, "#d8c8f0", "center");
    txt(`SCORE ${score}`, 160, 84, 8, "#ffffff", "center");
    txt(`REACHED WAVE ${wave}`, 160, 98, 5, "#b8a8c8", "center");
    txt(`BEST ${best}`, 160, 108, 5, "#f0c040", "center");
    if (newBest && Math.floor(stateT / 20) % 2) txt("NEW BEST!", 160, 120, 6, "#ff5a5a", "center");
    if (stateT > 50) {
        txt(isTouch ? "TAP TO RE-JONKLE" : "ENTER: RE-JONKLE   ESC: TITLE", 160, 146, 5, "#ffffff", "center");
    }
}

function render() {
    g.drawImage(bgCanvas, 0, 0);
    if (state !== "title" && state !== "credits" && state !== "tree" && wave > 1) {
        g.fillStyle = `rgba(160,20,40,${Math.min(0.22, (wave - 1) * 0.018)})`; // the sky gets angrier
        g.fillRect(0, 0, W, H);
    }
    drawPillar();

    if (state === "title") {
        drawTitle();
    } else if (state === "tree") {
        drawTree();
    } else if (state === "credits") {
        drawCredits();
    } else {
        drawWorld();
        drawHUD();
        if (state === "perk") drawPerks();
        if (state === "over") drawGameOver();
        if (paused) {
            dim(0.6);
            txt("PAUSED", 160, 80, 12, "#f0c040", "center");
        }
    }

    const sx = shake ? Math.round((Math.random() - 0.5) * shake * 2) : 0;
    const sy = shake ? Math.round((Math.random() - 0.5) * shake * 2) : 0;
    d.fillStyle = "#000000";
    d.fillRect(0, 0, screen.width, screen.height);
    d.drawImage(low, sx * S, sy * S, W * S, H * S);
    flushText(0, 0);
}

// ===== Pointer (menus) =====
screen.addEventListener("pointerdown", (ev) => {
    Sound.unlock();
    const rect = screen.getBoundingClientRect();
    const lx = ((ev.clientX - rect.left) / rect.width) * W;
    const ly = ((ev.clientY - rect.top) / rect.height) * H;
    if (state === "title") {
        const b = TREE_BTN;
        if (lx >= b.x && lx <= b.x + b.w && ly >= b.y && ly <= b.y + b.h + 8) return openTree();
        return newGame();
    }
    if (state === "tree") {
        const i = TREE_NODES.findIndex((n) => Math.abs(lx - n.x) <= 8 && Math.abs(ly - n.y) <= 8);
        if (i >= 0) treeSel = i;
        else if (lx > W - 50 && ly < 16) state = "title";
        return;
    }
    if (state === "credits") return goTitle();
    if (state === "over" && stateT > 50) return newGame();
    // mouse: left click bonks, right click throws a pie
    if (state === "play" || state === "clear") return press(ev.button === 2 ? "pie" : "bonk");
    if (state !== "perk") return;
    perkChoices.forEach((id, i) => {
        const c = cardRect(i);
        if (lx >= c.x && lx <= c.x + c.w && ly >= c.y && ly <= c.y + c.h) choosePerk(id);
    });
});

for (const ev of ["pointerup", "pointercancel", "pointerleave"]) {
    screen.addEventListener(ev, () => {
        keys.delete("bonk");
        keys.delete("pie");
    });
}
screen.addEventListener("contextmenu", (ev) => ev.preventDefault());

// ===== Main loop (fixed 60Hz step) =====
let acc = 0;
let last = performance.now();
function frame(now) {
    acc += Math.min(100, now - last);
    last = now;
    while (acc >= 1000 / 60) {
        if (update() !== "hold") pressed.clear();
        acc -= 1000 / 60;
    }
    render();
    requestAnimationFrame(frame);
}

Sound.track("title");
// Don't wait on the font: on slow connections it can queue behind the audio and leave a black screen.
// Text uses the fallback font until it arrives.
document.fonts.load('16px "PS2P"').catch(() => {});
requestAnimationFrame(frame);
