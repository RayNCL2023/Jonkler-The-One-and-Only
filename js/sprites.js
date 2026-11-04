"use strict";
// All characters are drawn from rectangles (no image files), so they can be animated,
// mirrored and scaled freely. Coordinates are relative to the feet-center; +x = facing direction.

function pen(ctx, ox, oy, dir, sc = 1, tint = null) {
    ox = Math.round(ox);
    oy = Math.round(oy);
    const r = (x, y, w, h, c) => {
        ctx.fillStyle = tint || c;
        ctx.fillRect(dir > 0 ? ox + x * sc : ox - (x + w) * sc, oy + y * sc, w * sc, h * sc);
    };
    r.line = (x0, y0, x1, y1, c, t = 1) => {
        const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
        for (let i = 0; i <= n; i++) {
            r(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), t, t, c);
        }
    };
    return r;
}

const FLASH = "#ffe070";

const JC = {
    hair: "#3fbf3f", hairD: "#2a8a2a", face: "#f2eee4", faceD: "#cfc6b8", eye: "#3a2a5a", lip: "#d8283a",
    coat: "#7b3fa0", coatD: "#5a2c7a", pants: "#4e2266", vest: "#e8862a", shirt: "#3fbf3f",
    shoe: "#d23a3a", glove: "#ffffff", wood: "#8a5a2a", malletA: "#e03c3c", malletB: "#f4f0e8",
};

// [handX, handY, malletEndX, malletEndY]
function malletPose(p) {
    if (p.pound) return [2, -6, 3, 3];
    if (p.atk > 0) {
        const ph = 16 - p.atk;
        if (ph < 4) return [0, -15, -5, -24];
        if (ph < 10) return p.combo === 3 ? [5, -14, 12, -24] : [5, -11, p.big ? 18 : 14, -11];
        return [4, -8, 10, -2];
    }
    return [2, -10, -5, -22];
}

function drawJonkler(ctx, p, sc = 1) {
    if (p.inv > 0 && !p.dead && (p.inv >> 2) % 2) return;
    const r = pen(ctx, p.x, p.y, p.dir, sc, p.hurt > 10 ? "#ffffff" : null);
    const air = !p.onGround;
    const run = !air && Math.abs(p.vx) > 0.3;
    const s = run ? (Math.floor(p.t / 5) % 2 ? 2 : -1) : 0;

    // back hair
    r(-4, -22, 2, 6, JC.hairD);
    r(-5, -21, 1, 3, JC.hairD);

    // legs + clown shoes
    if (air) {
        r(-3, -7, 2, 4, JC.pants);
        r(1, -7, 2, 3, JC.pants);
        r(-4, -3, 4, 2, JC.shoe);
        r(1, -4, 5, 2, JC.shoe);
    } else {
        r(-3 - s, -7, 2, 5, JC.pants);
        r(1 + s, -7, 2, 5, JC.pants);
        r(-4 - s, -2, 4, 2, JC.shoe);
        r(s, -2, 5, 2, JC.shoe);
    }

    // coat, vest, shirt
    r(-4, -14, 8, 7, JC.coat);
    r(-4, -14, 2, 7, JC.coatD);
    r(-5, -9, 1, 3, JC.coatD);
    r(-1, -14, 3, 5, JC.vest);
    r(0, -14, 1, 3, JC.shirt);

    // face
    r(-2, -21, 6, 7, JC.face);
    r(-2, -15, 6, 1, JC.faceD);
    r(1, -19, 2, 2, JC.eye);
    r(2, -19, 1, 1, "#0d0815");
    if (p.hurt > 0 || p.dead) {
        r(1, -17, 2, 2, JC.lip);
    } else {
        r(-1, -16, 4, 1, JC.lip);
        r(3, -17, 1, 1, JC.lip);
        r(-2, -17, 1, 1, JC.lip);
    }
    r(3, -18, 1, 1, "#e0a090");

    // hair top
    r(-3, -23, 7, 2, JC.hair);
    r(-2, -24, 2, 1, JC.hair);
    r(1, -25, 2, 2, JC.hair);
    r(3, -24, 1, 1, JC.hair);
    r(3, -22, 1, 1, JC.hair);
    r(-4, -23, 1, 1, JC.hairD);

    // arm + rubber mallet
    const [hx, hy, ex, ey] = malletPose(p);
    const hs = p.big ? 7 : 5;
    const h0 = -Math.floor(hs / 2);
    r.line(1, -13, hx, hy, JC.coat, 2);
    r.line(hx, hy, ex, ey, JC.wood);
    r(ex + h0, ey + h0, hs, hs, JC.malletA);
    r(ex, ey + h0, 1, hs, JC.malletB);
    r(hx - 1, hy - 1, 2, 2, JC.glove);
}

function drawUmbrella(r) {
    r(1, -28, 1, 17, "#2a2a2a");
    r(-6, -29, 14, 2, "#d83a5a");
    r(-4, -31, 10, 2, "#d83a5a");
    r(-1, -32, 4, 1, "#d83a5a");
    r(0, -31, 2, 4, "#f4f0e8");
}

function drawMime(ctx, e) {
    const r = pen(ctx, e.x, e.y, e.dir, 1, e.flash ? FLASH : null);
    const walk = e.onGround && Math.abs(e.vx) > 0.15;
    const s = walk ? (Math.floor(e.t / 7) % 2 ? 1 : -1) : 0;
    if (e.mode === "chute") drawUmbrella(r);

    r(-2 - s, -6, 2, 5, "#2a2a2a");
    r(1 + s, -6, 2, 5, "#2a2a2a");
    r(-3 - s, -1, 3, 1, "#0d0d0d");
    r(1 + s, -1, 3, 1, "#0d0d0d");
    for (let i = 0; i < 6; i++) r(-3, -12 + i, 6, 1, i % 2 ? "#1e1e1e" : "#eeeeee");

    r(-2, -18, 5, 6, "#f6f6f6");
    r(-3, -19, 6, 2, "#1a1a1a");
    r(0, -20, 1, 1, "#1a1a1a");
    r(1, -16, 1, 1, e.stun > 0 ? "#c03040" : "#111111");
    r(1, -15, 1, 1, "#5ab0f0");
    r(0, -14, 2, 1, "#c03040");

    let gx = 1;
    let gy = -9;
    if (e.atk > 0) {
        const wind = e.atk >= e.act + e.rec;
        gx = wind ? -4 : 6;
        gy = -11;
        // the "invisible" box, which is visible because Jonkler deserves a fair warning
        if (!wind && e.atk >= e.rec) {
            r(7, -15, 5, 1, "#9aaab8");
            r(7, -11, 5, 1, "#9aaab8");
            r(7, -15, 1, 5, "#9aaab8");
            r(11, -15, 1, 5, "#9aaab8");
        }
    }
    r.line(0, -11, gx, gy, "#eeeeee");
    r(gx - 1, gy - 1, 2, 2, "#ffffff");
}

function drawCop(ctx, e, sc = 1) {
    const r = pen(ctx, e.x, e.y, e.dir, sc, e.flash ? FLASH : null);
    const shirt = e.boss ? "#2a3a8a" : "#3a5ac8";
    const pants = "#1e2a5a";
    const walk = e.onGround && Math.abs(e.vx) > 0.15;
    const s = walk ? (Math.floor(e.t / 8) % 2 ? 1 : -1) : 0;

    r(-3 - s, -8, 3, 7, pants);
    r(1 + s, -8, 3, 7, pants);
    r(-4 - s, -1, 4, 1, "#111111");
    r(1 + s, -1, 5, 1, "#111111");

    r(-4, -16, 9, 8, shirt);
    r(-4, -9, 9, 1, "#111111");
    r(0, -9, 1, 1, "#f0c040");
    r(2, -15, 2, 2, "#f0c040");
    if (e.boss) {
        r(-5, -16, 2, 1, "#f0c040");
        r(4, -16, 2, 1, "#f0c040");
    }

    r(-2, -22, 6, 6, "#e6a878");
    r(-2, -17, 6, 1, "#c88a5a");
    r(-3, -24, 7, 2, pants);
    r(2, -22, 4, 1, "#111111");
    r(0, -24, 1, 1, "#f0c040");
    r(2, -20, 1, 1, "#111111");
    r(1, -21, 3, 1, "#3a2a1a");
    r(1, -18, 4, 1, "#5a3a1a");

    let hx = 2, hy = -10, bx = 4, by = -4;
    if (e.act2 === "charge") {
        hx = 5; hy = -12; bx = 9; by = -12;
    } else if (e.atk > 0) {
        const wind = e.atk >= e.act + e.rec;
        if (wind) {
            hx = -1; hy = -16; bx = -5; by = -22;
        } else {
            hx = 5; hy = -13; bx = 13; by = -13;
        }
    }
    r.line(1, -15, hx, hy, shirt, 2);
    r.line(hx, hy, bx, by, "#222222");
    r(hx - 1, hy - 1, 2, 2, "#e6a878");
}

function drawPigeon(ctx, e) {
    const r = pen(ctx, e.x, e.y, e.dir, 1, e.flash ? FLASH : null);
    const flap = e.mode === "dazed" ? 0 : Math.floor(e.t / 4) % 2;
    r(-6, -5, 2, 2, "#5a5a6a");
    r(-4, -6, 7, 4, "#8a8a9a");
    r(-3, -3, 5, 1, "#7a7a8a");
    r(2, -8, 3, 3, "#6a6a7a");
    r(2, -6, 2, 1, "#4aa08a");
    r(3, -7, 1, 1, e.mode === "dazed" ? "#f0c040" : "#111111");
    r(5, -7, 2, 1, "#f09030");
    if (flap) r(-2, -10, 4, 4, "#6a6a7a");
    else r(-2, -3, 4, 3, "#6a6a7a");
    r(0, -2, 1, 2, "#e07a8a");
}

function drawEnemy(ctx, e) {
    if (e.type === "pigeon") return drawPigeon(ctx, e);
    if (e.type === "police") return drawCop(ctx, e, 1);
    if (e.type === "boss") return drawCop(ctx, e, 2);
    drawMime(ctx, e);
}

function drawPie(ctx, x, y) {
    ctx.fillStyle = "#b0b0c0";
    ctx.fillRect(Math.round(x) - 2, Math.round(y), 5, 1);
    ctx.fillStyle = "#fff8e8";
    ctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 5, 2);
    ctx.fillStyle = "#d8283a";
    ctx.fillRect(Math.round(x), Math.round(y) - 3, 1, 1);
}

function drawPerkIcon(ctx, id, cx, cy) {
    const r = pen(ctx, cx, cy, 1, 2);
    switch (id) {
        case "bigbonk":
            r.line(-5, 5, 2, -2, "#8a5a2a");
            r(0, -6, 6, 6, "#e03c3c");
            r(2, -6, 1, 6, "#f4f0e8");
            break;
        case "shoes":
            r(-2, -6, 3, 6, "#4e2266");
            r(-4, 0, 10, 4, "#d23a3a");
            r(3, 0, 3, 1, "#ff7a7a");
            break;
        case "laugh":
            for (let i = -1; i <= 1; i++) {
                r(i * 5 - 2, -2, 4, 4, "#e03c3c");
                r(i * 5 - 1, -2, 1, 1, "#ff9a9a");
            }
            break;
        case "pie":
            r(-5, 1, 10, 2, "#b0b0c0");
            r(-5, -2, 10, 3, "#fff8e8");
            r(-4, -3, 8, 1, "#fff8e8");
            r(0, -5, 2, 2, "#d8283a");
            break;
        case "whoopee":
            r(-6, -2, 12, 5, "#f07ab0");
            r(-5, -3, 10, 1, "#f07ab0");
            r(6, 0, 3, 2, "#d0508a");
            r(10, -2, 1, 1, "#b8a8c8");
            r(11, 1, 1, 1, "#b8a8c8");
            break;
        case "heavy":
            r(-5, -1, 10, 2, "#f4f0e8");
            r(-7, -3, 3, 3, "#f4f0e8");
            r(-7, 0, 3, 3, "#f4f0e8");
            r(4, -3, 3, 3, "#f4f0e8");
            r(4, 0, 3, 3, "#f4f0e8");
            break;
        case "society":
            r(-5, 2, 10, 2, "#1a1a1a");
            r(-3, -6, 6, 8, "#1a1a1a");
            r(-3, 0, 6, 1, "#d8283a");
            break;
    }
}
