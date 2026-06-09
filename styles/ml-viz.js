/* ML Simplified — interactive "CodePen-style" math visualisations.
   Vanilla JS, no deps. Each <div class="ml-viz" data-viz="TYPE" data-params="{...}">
   becomes a small interactive canvas demo. */
(function () {
  "use strict";
  const P = "#4C4A98", P2 = "#9b8bf0", TEAL = "#1f7a8c", GOLD = "#b8860b", ROSE = "#9b3b6a";
  const reg = {};
  function register(t, fn) { reg[t] = fn; }

  // ---------- small DOM helpers ----------
  function el(tag, cls, txt) { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function slider(label, min, max, step, val, on) {
    const wrap = el("label", "mlv-ctl");
    const span = el("span", "mlv-ctl-lab", label + ": ");
    const out = el("b", "mlv-ctl-val", (+val).toFixed(step < 1 ? 2 : 0));
    const inp = el("input"); inp.type = "range"; inp.min = min; inp.max = max; inp.step = step; inp.value = val;
    inp.addEventListener("input", () => { out.textContent = (+inp.value).toFixed(step < 1 ? 2 : 0); on(+inp.value); });
    span.appendChild(out); wrap.appendChild(span); wrap.appendChild(inp);
    return wrap;
  }
  function btn(label, on) { const b = el("button", "mlv-btn", label); b.addEventListener("click", on); return b; }

  function isDark() { return document.body.classList.contains("quarto-dark"); }
  function colBg() { return isDark() ? "rgba(26,25,42,0.35)" : "rgba(255,255,255,0.3)"; }
  function colGrid() { return isDark() ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.07)"; }
  function colAxis() { return isDark() ? "rgba(255,255,255,.25)" : "rgba(0,0,0,.25)"; }
  function colTxt() { return isDark() ? "#d8d8e0" : "#33333f"; }

  // ---------- canvas with math<->pixel mapping ----------
  function makeCanvas(host, w, h, xmin, xmax, ymin, ymax) {
    const dpr = window.devicePixelRatio || 1;
    const cv = el("canvas", "mlv-canvas");
    cv.width = w * dpr; cv.height = h * dpr; cv.style.width = w + "px"; cv.style.height = h + "px";
    host.appendChild(cv);
    const ctx = cv.getContext("2d"); ctx.scale(dpr, dpr);
    const sx = x => (x - xmin) / (xmax - xmin) * w;
    const sy = y => h - (y - ymin) / (ymax - ymin) * h;
    const ix = px => xmin + px / w * (xmax - xmin);
    const iy = py => ymin + (h - py) / h * (ymax - ymin);
    return { cv, ctx, w, h, sx, sy, ix, iy, xmin, xmax, ymin, ymax, dpr };
  }
  function clear(C) { C.ctx.clearRect(0, 0, C.w, C.h); C.ctx.fillStyle = colBg(); C.ctx.fillRect(0, 0, C.w, C.h); }
  function grid(C, step) {
    step = step || 1; const ctx = C.ctx; ctx.lineWidth = 1; ctx.strokeStyle = colGrid();
    for (let x = Math.ceil(C.xmin); x <= C.xmax; x += step) { ctx.beginPath(); ctx.moveTo(C.sx(x), 0); ctx.lineTo(C.sx(x), C.h); ctx.stroke(); }
    for (let y = Math.ceil(C.ymin); y <= C.ymax; y += step) { ctx.beginPath(); ctx.moveTo(0, C.sy(y)); ctx.lineTo(C.w, C.sy(y)); ctx.stroke(); }
    ctx.strokeStyle = colAxis(); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, C.sy(0)); ctx.lineTo(C.w, C.sy(0)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(C.sx(0), 0); ctx.lineTo(C.sx(0), C.h); ctx.stroke();
  }
  function arrow(C, x0, y0, x1, y1, color, lw) {
    const ctx = C.ctx; const X0 = C.sx(x0), Y0 = C.sy(y0), X1 = C.sx(x1), Y1 = C.sy(y1);
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = lw || 2.5;
    ctx.beginPath(); ctx.moveTo(X0, Y0); ctx.lineTo(X1, Y1); ctx.stroke();
    const a = Math.atan2(Y1 - Y0, X1 - X0), s = 9;
    ctx.beginPath(); ctx.moveTo(X1, Y1);
    ctx.lineTo(X1 - s * Math.cos(a - .4), Y1 - s * Math.sin(a - .4));
    ctx.lineTo(X1 - s * Math.cos(a + .4), Y1 - s * Math.sin(a + .4));
    ctx.closePath(); ctx.fill();
  }
  function dot(C, x, y, color, r) { const ctx = C.ctx; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(C.sx(x), C.sy(y), r || 5, 0, 7); ctx.fill(); }
  function label(C, x, y, txt, color) { const ctx = C.ctx; ctx.fillStyle = color || colTxt(); ctx.font = "600 13px JetBrains Mono, monospace"; ctx.fillText(txt, C.sx(x) + 6, C.sy(y) - 6); }
  function readout(host, html) { let r = host.querySelector(".mlv-out"); if (!r) { r = el("div", "mlv-out"); host.appendChild(r); } r.innerHTML = html; return r; }
  function controls(host) { const c = el("div", "mlv-controls"); host.appendChild(c); return c; }

  // drag a math-space point on a canvas
  function draggable(C, getPts, onMove) {
    let active = -1;
    function pos(e) { const r = C.cv.getBoundingClientRect(); const t = e.touches ? e.touches[0] : e; return { px: t.clientX - r.left, py: t.clientY - r.top }; }
    function down(e) { const { px, py } = pos(e); const pts = getPts(); for (let i = 0; i < pts.length; i++) { if (Math.hypot(px - C.sx(pts[i][0]), py - C.sy(pts[i][1])) < 16) { active = i; e.preventDefault(); break; } } }
    function move(e) { if (active < 0) return; const { px, py } = pos(e); onMove(active, C.ix(px), C.iy(py)); e.preventDefault(); }
    function up() { active = -1; }
    C.cv.addEventListener("mousedown", down); C.cv.addEventListener("touchstart", down, { passive: false });
    window.addEventListener("mousemove", move); C.cv.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("mouseup", up); window.addEventListener("touchend", up);
  }

  // =====================================================================
  // VECTORS
  // =====================================================================
  function vecDemo(host, p, mode) {
    let a = p.a || [3, 1], b = p.b || [1, 2];
    const C = makeCanvas(host, 320, 260, -5, 5, -4, 4);
    const out = readout(host, "");
    function draw() {
      clear(C); grid(C);
      arrow(C, 0, 0, a[0], a[1], P); label(C, a[0], a[1], "a", P);
      arrow(C, 0, 0, b[0], b[1], TEAL); label(C, b[0], b[1], "b", TEAL);
      if (mode === "add") {
        const s = [a[0] + b[0], a[1] + b[1]];
        C.ctx.setLineDash([4, 4]); arrow(C, a[0], a[1], s[0], s[1], "rgba(155,139,240,.7)", 1.5);
        arrow(C, b[0], b[1], s[0], s[1], "rgba(155,139,240,.7)", 1.5); C.ctx.setLineDash([]);
        arrow(C, 0, 0, s[0], s[1], ROSE, 3); label(C, s[0], s[1], "a+b", ROSE);
        out.innerHTML = `a+b = [${a[0].toFixed(1)}+${b[0].toFixed(1)}, ${a[1].toFixed(1)}+${b[1].toFixed(1)}] = <b>[${s[0].toFixed(1)}, ${s[1].toFixed(1)}]</b>`;
      } else if (mode === "sub") {
        const d = [a[0] - b[0], a[1] - b[1]];
        arrow(C, b[0], b[1], a[0], a[1], ROSE, 3); label(C, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, "a−b", ROSE);
        out.innerHTML = `a−b = <b>[${d[0].toFixed(1)}, ${d[1].toFixed(1)}]</b> — the arrow from b to a`;
      } else if (mode === "dot") {
        const d = a[0] * b[0] + a[1] * b[1];
        const la = Math.hypot(a[0], a[1]), lb = Math.hypot(b[0], b[1]);
        const ang = Math.acos(Math.max(-1, Math.min(1, d / (la * lb || 1)))) * 180 / Math.PI;
        out.innerHTML = `a·b = ${(a[0] * b[0]).toFixed(1)}+${(a[1] * b[1]).toFixed(1)} = <b>${d.toFixed(2)}</b> &nbsp; angle ≈ <b>${ang.toFixed(0)}°</b> ${Math.abs(d) < .1 ? "(perpendicular!)" : d > 0 ? "(aligned)" : "(opposed)"}`;
      } else if (mode === "proj") {
        const d = a[0] * b[0] + a[1] * b[1], bb = b[0] * b[0] + b[1] * b[1];
        const k = d / (bb || 1); const pr = [k * b[0], k * b[1]];
        C.ctx.setLineDash([3, 3]); arrow(C, a[0], a[1], pr[0], pr[1], "rgba(0,0,0,.35)", 1.2); C.ctx.setLineDash([]);
        arrow(C, 0, 0, pr[0], pr[1], ROSE, 3); label(C, pr[0], pr[1], "proj", ROSE);
        out.innerHTML = `projection of a onto b = <b>[${pr[0].toFixed(2)}, ${pr[1].toFixed(2)}]</b> — a's shadow on b`;
      } else if (mode === "ortho") {
        const d = a[0] * b[0] + a[1] * b[1];
        const perp = Math.abs(d) < .15;
        out.innerHTML = `a·b = <b>${d.toFixed(2)}</b> → ${perp ? "<b style='color:#1f7a8c'>⟂ orthogonal (90°)</b>" : "not perpendicular — drag to make a·b = 0"}`;
      }
    }
    draggable(C, () => [a, b], (i, x, y) => { const v = [Math.round(x * 2) / 2, Math.round(y * 2) / 2]; if (i === 0) a = v; else b = v; draw(); });
    draw();
    host.appendChild(hint("Drag the tips of a or b"));
  }
  register("vecadd", (h, p) => vecDemo(h, p, "add"));
  register("vecsub", (h, p) => vecDemo(h, p, "sub"));
  register("dot", (h, p) => vecDemo(h, p, "dot"));
  register("proj", (h, p) => vecDemo(h, p, "proj"));
  register("ortho", (h, p) => vecDemo(h, p, "ortho"));

  register("norm", function (host, p) {
    const kind = p.kind || "l2";
    let v = [3, 2];
    const C = makeCanvas(host, 300, 260, -5, 5, -4, 4);
    const out = readout(host, "");
    function draw() {
      clear(C); grid(C); arrow(C, 0, 0, v[0], v[1], P); label(C, v[0], v[1], "x", P);
      if (kind === "l1") {
        C.ctx.strokeStyle = ROSE; C.ctx.setLineDash([5, 4]); C.ctx.lineWidth = 2;
        C.ctx.beginPath(); C.ctx.moveTo(C.sx(0), C.sy(0)); C.ctx.lineTo(C.sx(v[0]), C.sy(0)); C.ctx.lineTo(C.sx(v[0]), C.sy(v[1])); C.ctx.stroke(); C.ctx.setLineDash([]);
        out.innerHTML = `‖x‖₁ = |${v[0].toFixed(1)}| + |${v[1].toFixed(1)}| = <b>${(Math.abs(v[0]) + Math.abs(v[1])).toFixed(1)}</b> (grid path, in rose)`;
      } else {
        C.ctx.strokeStyle = "rgba(155,139,240,.5)"; C.ctx.lineWidth = 1.5;
        C.ctx.beginPath(); C.ctx.arc(C.sx(0), C.sy(0), Math.hypot(C.sx(v[0]) - C.sx(0), C.sy(v[1]) - C.sy(0)), 0, 7); C.ctx.stroke();
        out.innerHTML = `‖x‖₂ = √(${v[0].toFixed(1)}² + ${v[1].toFixed(1)}²) = <b>${Math.hypot(v[0], v[1]).toFixed(2)}</b> (straight-line radius)`;
      }
    }
    draggable(C, () => [v], (i, x, y) => { v = [Math.round(x * 2) / 2, Math.round(y * 2) / 2]; draw(); });
    draw(); host.appendChild(hint("Drag the tip of x"));
  });

  register("cross", function (host, p) {
    let a = [3, 0], b = [1, 2];
    const C = makeCanvas(host, 300, 260, -5, 5, -4, 4);
    const out = readout(host, "");
    function draw() {
      clear(C); grid(C);
      // parallelogram area = |cross|
      C.ctx.fillStyle = "rgba(76,74,152,.15)";
      C.ctx.beginPath(); C.ctx.moveTo(C.sx(0), C.sy(0)); C.ctx.lineTo(C.sx(a[0]), C.sy(a[1]));
      C.ctx.lineTo(C.sx(a[0] + b[0]), C.sy(a[1] + b[1])); C.ctx.lineTo(C.sx(b[0]), C.sy(b[1])); C.ctx.closePath(); C.ctx.fill();
      arrow(C, 0, 0, a[0], a[1], P); label(C, a[0], a[1], "a", P);
      arrow(C, 0, 0, b[0], b[1], TEAL); label(C, b[0], b[1], "b", TEAL);
      const cr = a[0] * b[1] - a[1] * b[0];
      out.innerHTML = `‖a×b‖ = parallelogram area = <b>${Math.abs(cr).toFixed(2)}</b> (the 3rd vector points out of the screen)`;
    }
    draggable(C, () => [a, b], (i, x, y) => { const v = [Math.round(x * 2) / 2, Math.round(y * 2) / 2]; if (i === 0) a = v; else b = v; draw(); });
    draw(); host.appendChild(hint("Drag a or b — shaded area = cross magnitude"));
  });

  // =====================================================================
  // MATRICES — 2x2 linear transform of the unit grid
  // =====================================================================
  register("lintransform", function (host, p) {
    let m = (p.m || [1, .5, 0, 1]).slice(); // a,b,c,d  (column-ish: [[a,b],[c,d]])
    const mode = p.mode || "matmul";
    const C = makeCanvas(host, 320, 260, -4, 4, -3.2, 3.2);
    const ctrls = controls(host);
    const out = readout(host, "");
    function det() { return m[0] * m[3] - m[1] * m[2]; }
    function draw() {
      clear(C); grid(C);
      // transformed unit square
      const e1 = [m[0], m[2]], e2 = [m[1], m[3]];
      C.ctx.fillStyle = "rgba(76,74,152,.16)";
      C.ctx.beginPath(); C.ctx.moveTo(C.sx(0), C.sy(0)); C.ctx.lineTo(C.sx(e1[0]), C.sy(e1[1]));
      C.ctx.lineTo(C.sx(e1[0] + e2[0]), C.sy(e1[1] + e2[1])); C.ctx.lineTo(C.sx(e2[0]), C.sy(e2[1])); C.ctx.closePath(); C.ctx.fill();
      arrow(C, 0, 0, e1[0], e1[1], P, 3); label(C, e1[0], e1[1], "î", P);
      arrow(C, 0, 0, e2[0], e2[1], TEAL, 3); label(C, e2[0], e2[1], "ĵ", TEAL);
      const d = det();
      if (mode === "determinant") out.innerHTML = `det = ${m[0].toFixed(1)}·${m[3].toFixed(1)} − ${m[1].toFixed(1)}·${m[2].toFixed(1)} = <b>${d.toFixed(2)}</b> → area scaled ×${Math.abs(d).toFixed(2)}${Math.abs(d) < .05 ? " (collapsed!)" : ""}`;
      else if (mode === "rank") out.innerHTML = `det = <b>${d.toFixed(2)}</b> → rank ${Math.abs(d) < .05 ? "<b>1</b> (squashed to a line — redundant)" : "<b>2</b> (full)"}`;
      else if (mode === "eigen") {
        // real eigen for symmetric-ish; show eigenvectors when they exist
        const tr = m[0] + m[3], dd = d; const disc = tr * tr - 4 * dd;
        if (disc >= 0) {
          const l1 = (tr + Math.sqrt(disc)) / 2, l2 = (tr - Math.sqrt(disc)) / 2;
          [l1, l2].forEach((l, k) => {
            let ev; if (Math.abs(m[1]) > 1e-6) ev = [l - m[3], m[2]]; else ev = [1, 0];
            const n = Math.hypot(ev[0], ev[1]) || 1; ev = [ev[0] / n * 2.5, ev[1] / n * 2.5];
            C.ctx.setLineDash([6, 4]); arrow(C, -ev[0], -ev[1], ev[0], ev[1], k ? GOLD : ROSE, 2); C.ctx.setLineDash([]);
          });
          out.innerHTML = `eigenvalues λ = <b>${l1.toFixed(2)}</b>, <b>${l2.toFixed(2)}</b> — dashed lines are eigenvectors (stay on their line)`;
        } else out.innerHTML = `complex eigenvalues (pure rotation) — no real eigenvector directions`;
      }
      else out.innerHTML = `î → [${e1[0].toFixed(1)}, ${e1[1].toFixed(1)}], ĵ → [${e2[0].toFixed(1)}, ${e2[1].toFixed(1)}] &nbsp; det=<b>${d.toFixed(2)}</b>`;
    }
    const labels = ["a", "b", "c", "d"];
    [0, 1, 2, 3].forEach(i => ctrls.appendChild(slider(labels[i], -2, 2, .1, m[i], v => { m[i] = v; draw(); })));
    ctrls.appendChild(btn("Reset", () => { m = [1, .5, 0, 1]; host.querySelectorAll("input[type=range]").forEach((s, i) => { s.value = m[i]; s.dispatchEvent(new Event("input")); }); }));
    draw();
  });

  register("transpose", function (host, p) {
    let m = [[1, 2, 3], [4, 5, 6]];
    const host2 = el("div", "mlv-matpair"); host.appendChild(host2);
    function tbl(M, title) {
      const w = el("div", "mlv-mat"); w.appendChild(el("div", "mlv-mat-t", title));
      const g = el("div", "mlv-grid"); g.style.gridTemplateColumns = `repeat(${M[0].length}, 1fr)`;
      M.forEach(r => r.forEach(c => g.appendChild(el("span", "mlv-cell", c)))); w.appendChild(g); return w;
    }
    function T(M) { return M[0].map((_, j) => M.map(r => r[j])); }
    host2.appendChild(tbl(m, "A (2×3)")); const arrowEl = el("div", "mlv-arrow", "→ᵀ→"); host2.appendChild(arrowEl); host2.appendChild(tbl(T(m), "Aᵀ (3×2)"));
    readout(host, "Rows become columns: cell (i,j) ↔ (j,i).");
  });

  register("trace", function (host, p) {
    const m = [[2, 1, 0], [3, 5, 2], [1, 0, 4]];
    const w = el("div", "mlv-mat"); const g = el("div", "mlv-grid"); g.style.gridTemplateColumns = "repeat(3,1fr)";
    m.forEach((r, i) => r.forEach((c, j) => { const s = el("span", "mlv-cell" + (i === j ? " mlv-diag" : ""), c); g.appendChild(s); })); w.appendChild(g); host.appendChild(w);
    readout(host, `Trace = sum of the highlighted diagonal = 2 + 5 + 4 = <b>11</b>.`);
  });

  // generic small static matrix illustration
  register("matnote", function (host, p) {
    readout(host, p.text || "See the formula table above.");
  });

  // =====================================================================
  // CALCULUS — function plot with tangent / area / approximations
  // =====================================================================
  function plotFn(C, f, color, lw) {
    const ctx = C.ctx; ctx.strokeStyle = color; ctx.lineWidth = lw || 2.2; ctx.beginPath();
    let first = true;
    for (let px = 0; px <= C.w; px += 2) { const x = C.ix(px), y = f(x); if (!isFinite(y) || y < C.ymin - 2 || y > C.ymax + 2) { first = true; continue; } const py = C.sy(y); if (first) { ctx.moveTo(px, py); first = false; } else ctx.lineTo(px, py); }
    ctx.stroke();
  }
  register("derivative", function (host, p) {
    let x0 = 1; const f = x => x * x, df = x => 2 * x;
    const C = makeCanvas(host, 320, 260, -3, 3, -1, 6);
    const ctrls = controls(host); const out = readout(host, "");
    function draw() {
      clear(C); grid(C); plotFn(C, f, P);
      const y0 = f(x0), s = df(x0);
      const ctx = C.ctx; ctx.strokeStyle = ROSE; ctx.lineWidth = 2; ctx.beginPath();
      ctx.moveTo(C.sx(x0 - 2), C.sy(y0 - 2 * s)); ctx.lineTo(C.sx(x0 + 2), C.sy(y0 + 2 * s)); ctx.stroke();
      dot(C, x0, y0, ROSE, 6);
      out.innerHTML = `f(x)=x² &nbsp; at x=<b>${x0.toFixed(2)}</b> the slope f′ = 2x = <b>${s.toFixed(2)}</b> (rose tangent line)`;
    }
    ctrls.appendChild(slider("x", -2.5, 2.5, .1, x0, v => { x0 = v; draw(); })); draw();
  });
  register("integral", function (host, p) {
    let b = 1.5; const f = x => 0.5 * x * x + 0.5;
    const C = makeCanvas(host, 320, 260, -0.2, 3, -0.2, 5);
    const ctrls = controls(host); const out = readout(host, "");
    function draw() {
      clear(C); grid(C);
      const ctx = C.ctx; ctx.fillStyle = "rgba(31,122,140,.25)"; ctx.beginPath(); ctx.moveTo(C.sx(0), C.sy(0));
      for (let x = 0; x <= b; x += .02) ctx.lineTo(C.sx(x), C.sy(f(x))); ctx.lineTo(C.sx(b), C.sy(0)); ctx.closePath(); ctx.fill();
      plotFn(C, f, P);
      const area = (b * b * b) / 6 + 0.5 * b;
      out.innerHTML = `∫₀^${b.toFixed(2)} f dx = shaded area ≈ <b>${area.toFixed(2)}</b> (drag b)`;
    }
    ctrls.appendChild(slider("b", 0.2, 2.8, .1, b, v => { b = v; draw(); })); draw();
  });
  register("limit", function (host, p) {
    let x0 = 1.5; const f = x => Math.abs(x) < 1e-4 ? 1 : Math.sin(3 * x) / (3 * x);
    const C = makeCanvas(host, 320, 240, -3, 3, -0.6, 1.3);
    const ctrls = controls(host); const out = readout(host, "");
    function draw() { clear(C); grid(C); plotFn(C, f, P); dot(C, x0, f(x0), ROSE, 6); C.ctx.setLineDash([4, 4]); C.ctx.strokeStyle = "rgba(0,0,0,.3)"; C.ctx.beginPath(); C.ctx.moveTo(C.sx(x0), 0); C.ctx.lineTo(C.sx(x0), C.h); C.ctx.stroke(); C.ctx.setLineDash([]); out.innerHTML = `as x → <b>${x0.toFixed(2)}</b>, f(x) → <b>${f(x0).toFixed(3)}</b>; drag x toward 0 to see the limit = 1`; }
    ctrls.appendChild(slider("x", 0.02, 2.8, .02, x0, v => { x0 = v; draw(); })); draw();
  });
  register("taylor", function (host, p) {
    let n = 1; const f = x => Math.exp(x);
    const C = makeCanvas(host, 320, 250, -3, 2, -0.5, 5);
    const ctrls = controls(host); const out = readout(host, "");
    function taylor(x, n) { let s = 0, t = 1; for (let k = 0; k <= n; k++) { s += t; t *= x / (k + 1); } return s; }
    function draw() { clear(C); grid(C); plotFn(C, f, P, 2.5); plotFn(C, x => taylor(x, n), ROSE, 2); out.innerHTML = `eˣ (purple) vs Taylor with <b>${n + 1}</b> term(s) (rose). More terms → better fit.`; }
    ctrls.appendChild(slider("terms", 0, 6, 1, n, v => { n = v; draw(); })); draw();
  });
  register("gradientfield", function (host, p) {
    // contour of f=x^2+y^2 with gradient arrow at a draggable point
    let pt = [1.5, 1]; const C = makeCanvas(host, 300, 260, -3, 3, -2.6, 2.6);
    const out = readout(host, "");
    function draw() {
      clear(C);
      for (let r = 0.5; r <= 3; r += 0.5) { C.ctx.strokeStyle = "rgba(76,74,152,.25)"; C.ctx.beginPath(); C.ctx.arc(C.sx(0), C.sy(0), Math.abs(C.sx(r) - C.sx(0)), 0, 7); C.ctx.stroke(); }
      grid(C, 1);
      arrow(C, pt[0], pt[1], pt[0] + 2 * pt[0] * .3, pt[1] + 2 * pt[1] * .3, ROSE, 3);
      dot(C, pt[0], pt[1], P, 6);
      out.innerHTML = `∇f = [2x, 2y] = <b>[${(2 * pt[0]).toFixed(1)}, ${(2 * pt[1]).toFixed(1)}]</b> points uphill (rose). Step opposite to descend.`;
    }
    draggable(C, () => [pt], (i, x, y) => { pt = [Math.max(-2.5, Math.min(2.5, x)), Math.max(-2.2, Math.min(2.2, y))]; draw(); });
    draw(); host.appendChild(hint("Drag the point — arrow = gradient"));
  });

  // =====================================================================
  // OPTIMIZATION — gradient descent on a 1-D curve
  // =====================================================================
  register("graddesc", function (host, p) {
    const surf = p.surface || "convex";
    const f = surf === "nonconvex" ? (x => 0.15 * x * x + Math.sin(2 * x)) : (x => 0.4 * x * x);
    const df = surf === "nonconvex" ? (x => 0.3 * x + 2 * Math.cos(2 * x)) : (x => 0.8 * x);
    let lr = p.lr || 0.2, mom = p.momentum ? 0.8 : 0, noise = p.noise || 0;
    let x = p.start || -3.2, v = 0, run = null;
    const C = makeCanvas(host, 320, 250, -4, 4, -1, 5);
    const ctrls = controls(host); const out = readout(host, "");
    function draw() {
      clear(C); grid(C); plotFn(C, f, P);
      dot(C, x, f(x), ROSE, 7);
      out.innerHTML = `x = <b>${x.toFixed(2)}</b>, loss = <b>${f(x).toFixed(3)}</b>, slope = ${df(x).toFixed(2)}`;
    }
    function step() {
      let g = df(x) + (noise ? (Math.random() - .5) * noise : 0);
      v = mom * v - lr * g; x += v; x = Math.max(-3.9, Math.min(3.9, x)); draw();
    }
    ctrls.appendChild(slider("learn rate", 0.02, 0.6, .02, lr, val => lr = val));
    ctrls.appendChild(btn("Step", step));
    ctrls.appendChild(btn("Run", () => { if (run) { clearInterval(run); run = null; } else { run = setInterval(step, 60); } }));
    ctrls.appendChild(btn("Reset", () => { x = p.start || -3.2; v = 0; draw(); }));
    draw();
    host.appendChild(hint(surf === "nonconvex" ? "Bumpy surface: may land in a local minimum" : "Smooth bowl: always finds the bottom"));
  });
  register("losscurves", function (host, p) {
    const C = makeCanvas(host, 320, 240, -0.05, 1.05, -0.1, 4);
    clear(C); grid(C, 0.25);
    plotFn(C, x => x < 0.001 ? 4 : -Math.log(x), ROSE, 2.5);   // cross-entropy (true=1)
    plotFn(C, x => (1 - x) * (1 - x) * 4, P, 2.5);             // MSE-ish
    readout(host, "Purple = MSE, Rose = Cross-Entropy as the predicted prob for the true class goes 0→1. CE punishes confident mistakes far harder.");
  });
  register("convexsurface", function (host, p) {
    const nc = p.nonconvex;
    const C = makeCanvas(host, 320, 240, -4, 4, -1.2, 4);
    clear(C); grid(C);
    plotFn(C, nc ? (x => 0.15 * x * x + Math.sin(2 * x)) : (x => 0.4 * x * x), P, 2.6);
    readout(host, nc ? "Non-convex: several dips — where you start decides which one you reach." : "Convex: one smooth valley — any downhill path reaches the single global minimum.");
  });
  register("lrcurve", function (host, p) {
    const C = makeCanvas(host, 320, 220, 0, 1, 0, 1.1);
    clear(C); grid(C, 0.25);
    plotFn(C, t => 0.5 * (1 + Math.cos(Math.PI * t)), P, 2.6);
    readout(host, "Cosine schedule: learning rate eases smoothly from high → 0 across training.");
  });
  register("traincurve", function (host, p) {
    const C = makeCanvas(host, 320, 230, 0, 1, 0, 1.1);
    clear(C); grid(C, 0.25);
    plotFn(C, t => 0.9 * Math.exp(-3 * t) + 0.05, P, 2.4);             // train loss
    plotFn(C, t => 0.9 * Math.exp(-3 * t) + 0.05 + 0.6 * t * t, ROSE, 2.4); // val loss U-shape
    const tmin = 0.45; C.ctx.setLineDash([4, 4]); C.ctx.strokeStyle = GOLD; C.ctx.beginPath(); C.ctx.moveTo(C.sx(tmin), 0); C.ctx.lineTo(C.sx(tmin), C.h); C.ctx.stroke(); C.ctx.setLineDash([]);
    readout(host, "Purple = train loss (keeps falling), Rose = validation loss (turns up). Early-stopping halts at the gold line.");
  });
  register("search", function (host, p) {
    // random/bayes search dots over a hidden objective
    const C = makeCanvas(host, 320, 230, -3, 3, -0.2, 3);
    const f = x => 1.8 * Math.exp(-(x - 0.8) * (x - 0.8)) + 0.7 * Math.exp(-(x + 1.5) * (x + 1.5) * 2);
    let best = -9, trials = [];
    const ctrls = controls(host); const out = readout(host, "");
    function draw() { clear(C); grid(C, 1); plotFn(C, f, "rgba(76,74,152,.4)", 1.6); trials.forEach(t => dot(C, t, f(t), t === best ? ROSE : P, t === best ? 7 : 4)); out.innerHTML = `trials: <b>${trials.length}</b> &nbsp; best score: <b>${best > -9 ? f(best).toFixed(2) : "—"}</b>`; }
    ctrls.appendChild(btn("Try a config", () => { const x = (Math.random() * 6 - 3); trials.push(x); if (best < -8 || f(x) > f(best)) best = x; draw(); }));
    ctrls.appendChild(btn("Reset", () => { trials = []; best = -9; draw(); }));
    draw(); host.appendChild(hint("Each click samples a setting; rose = best so far"));
  });

  // =====================================================================
  // PROBABILITY
  // =====================================================================
  register("gaussian", function (host, p) {
    let mu = 0, sig = 1;
    const C = makeCanvas(host, 320, 240, -5, 5, -0.02, 0.9);
    const ctrls = controls(host); const out = readout(host, "");
    function draw() { clear(C); grid(C, 1); plotFn(C, x => Math.exp(-((x - mu) ** 2) / (2 * sig * sig)) / (Math.sqrt(2 * Math.PI) * sig), P, 2.6); out.innerHTML = `μ=<b>${mu.toFixed(1)}</b>, σ=<b>${sig.toFixed(1)}</b> — 68% of values fall within μ±σ`; }
    ctrls.appendChild(slider("mean μ", -3, 3, .1, mu, v => { mu = v; draw(); }));
    ctrls.appendChild(slider("std σ", 0.4, 2.5, .1, sig, v => { sig = v; draw(); }));
    draw();
  });
  register("dist", function (host, p) {
    const kind = p.kind || "binomial";
    let param = p.param || (kind === "poisson" ? 3 : 0.5);
    const C = makeCanvas(host, 320, 240, -0.5, kind === "uniform" ? 6.5 : 11, -0.02, 0.45);
    const ctrls = controls(host); const out = readout(host, "");
    function bars(vals) { clear(C); grid(C, 1); const bw = (C.sx(1) - C.sx(0)) * 0.7; vals.forEach((v, k) => { C.ctx.fillStyle = P; C.ctx.fillRect(C.sx(k) - bw / 2, C.sy(v), bw, C.sy(0) - C.sy(v)); }); }
    function fact(n) { let f = 1; for (let i = 2; i <= n; i++) f *= i; return f; }
    function draw() {
      let vals = [], txt = "";
      if (kind === "bernoulli") { vals = [1 - param, param]; txt = `Bernoulli(p=${param.toFixed(2)}) — one trial: P(0)=${(1 - param).toFixed(2)}, P(1)=${param.toFixed(2)}`; }
      else if (kind === "binomial") { const n = 10; for (let k = 0; k <= n; k++) vals[k] = fact(n) / (fact(k) * fact(n - k)) * param ** k * (1 - param) ** (n - k); txt = `Binomial(n=10, p=${param.toFixed(2)}) — mean = np = ${(10 * param).toFixed(1)}`; }
      else if (kind === "poisson") { for (let k = 0; k <= 10; k++) vals[k] = param ** k * Math.exp(-param) / fact(k); txt = `Poisson(λ=${param.toFixed(1)}) — mean = variance = ${param.toFixed(1)}`; }
      else if (kind === "uniform") { for (let k = 0; k <= 5; k++) vals[k] = 1 / 6; txt = `Uniform — every outcome equally likely (1/6 each)`; }
      bars(vals); out.innerHTML = txt;
    }
    if (kind !== "uniform") ctrls.appendChild(slider(kind === "poisson" ? "λ" : "p", kind === "poisson" ? 0.5 : 0.05, kind === "poisson" ? 8 : 0.95, kind === "poisson" ? 0.5 : 0.05, param, v => { param = v; draw(); }));
    draw();
  });
  register("clt", function (host, p) {
    let n = 1; const C = makeCanvas(host, 320, 240, -0.5, 6.5, 0, 1);
    const ctrls = controls(host); const out = readout(host, "");
    function draw() {
      clear(C); grid(C, 1);
      // simulate distribution of the mean of n dice
      const bins = new Array(61).fill(0), trials = 4000;
      for (let t = 0; t < trials; t++) { let s = 0; for (let i = 0; i < n; i++) s += 1 + Math.floor(Math.random() * 6); const m = s / n; bins[Math.round(m * 10)]++; }
      const mx = Math.max(...bins); const bw = C.w / 61;
      bins.forEach((b, i) => { const h = b / mx; C.ctx.fillStyle = P; C.ctx.fillRect(i * bw, C.sy(h), bw - 1, C.sy(0) - C.sy(h)); });
      out.innerHTML = `Average of <b>${n}</b> dice per sample. n=1 is flat; raise n and watch a bell curve emerge (CLT).`;
    }
    ctrls.appendChild(slider("dice averaged (n)", 1, 30, 1, n, v => { n = v; draw(); })); draw();
  });
  register("scatter", function (host, p) {
    let rho = p.rho != null ? p.rho : 0.7;
    const C = makeCanvas(host, 300, 250, -3, 3, -3, 3);
    const ctrls = controls(host); const out = readout(host, "");
    function draw() {
      clear(C); grid(C, 1);
      for (let i = 0; i < 140; i++) { const z1 = gauss(), z2 = gauss(); const x = z1, y = rho * z1 + Math.sqrt(1 - rho * rho) * z2; dot(C, x, y, "rgba(76,74,152,.55)", 3); }
      out.innerHTML = `correlation ρ = <b>${rho.toFixed(2)}</b> — ${Math.abs(rho) > .8 ? "tight line" : Math.abs(rho) < .2 ? "no linear link (cloud)" : "loose trend"}`;
    }
    function gauss() { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
    ctrls.appendChild(slider("ρ", -1, 1, .05, rho, v => { rho = v; draw(); })); draw();
  });
  register("ci", function (host, p) {
    const C = makeCanvas(host, 320, 230, -3, 3, 0, 11);
    const out = readout(host, "");
    function draw() {
      clear(C); C.ctx.strokeStyle = colAxis(); C.ctx.beginPath(); C.ctx.moveTo(C.sx(0), 0); C.ctx.lineTo(C.sx(0), C.h); C.ctx.stroke();
      let covered = 0;
      for (let i = 0; i < 10; i++) { const m = gaussv() * 0.6; const half = 1.96 * 1 / Math.sqrt(12); const ok = (m - half <= 0 && m + half >= 0); if (ok) covered++; const y = 0.7 + i; C.ctx.strokeStyle = ok ? TEAL : ROSE; C.ctx.lineWidth = 2.5; C.ctx.beginPath(); C.ctx.moveTo(C.sx(m - half), C.sy(y)); C.ctx.lineTo(C.sx(m + half), C.sy(y)); C.ctx.stroke(); dot(C, m, y, ok ? TEAL : ROSE, 3); }
      out.innerHTML = `10 samples' 95% intervals. The teal ones cover the true mean (0); rose miss. ~95% should cover. <b>${covered}/10</b> here.`;
    }
    function gaussv() { let u = Math.random(), v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
    host.appendChild(btnRow(draw)); draw();
  });
  register("abtest", function (host, p) {
    const C = makeCanvas(host, 320, 220, -0.5, 1.5, -0.02, 12);
    let pa = 0.10, pb = 0.13, nn = 500;
    const ctrls = controls(host); const out = readout(host, "");
    function beta(x, a, b) { return Math.pow(x, a - 1) * Math.pow(1 - x, b - 1); }
    function draw() {
      clear(C); grid(C, 0.25);
      const a1 = pa * nn, b1 = (1 - pa) * nn, a2 = pb * nn, b2 = (1 - pb) * nn;
      let m1 = 0, m2 = 0; const A = [], B = [];
      for (let i = 0; i <= 200; i++) { const x = i / 200 * 0.4; A.push(beta(x, a1, b1)); B.push(beta(x, a2, b2)); }
      m1 = Math.max(...A); m2 = Math.max(...B); const mm = Math.max(m1, m2);
      function plot(arr, col) { C.ctx.strokeStyle = col; C.ctx.lineWidth = 2.4; C.ctx.beginPath(); arr.forEach((v, i) => { const x = i / 200 * 0.4; const px = C.sx(x / 0.4); const py = C.sy(v / mm * 10); i ? C.ctx.lineTo(px, py) : C.ctx.moveTo(px, py); }); C.ctx.stroke(); }
      plot(A, P); plot(B, ROSE);
      out.innerHTML = `A=${(pa * 100).toFixed(0)}% (purple) vs B=${(pb * 100).toFixed(0)}% (rose), n=${nn} each. Less overlap → more confident B truly wins.`;
    }
    ctrls.appendChild(slider("sample n", 100, 3000, 100, nn, v => { nn = v; draw(); })); draw();
  });
  register("mle", function (host, p) {
    let mu = 0; const data = [-1.2, -0.3, 0.5, 0.8, 1.4, 0.1, -0.6, 1.0];
    const C = makeCanvas(host, 320, 230, -3, 3, -0.05, 1);
    const ctrls = controls(host); const out = readout(host, "");
    function ll(m) { return data.reduce((s, x) => s - (x - m) * (x - m) / 2, 0); }
    function draw() {
      clear(C); grid(C, 1);
      data.forEach(x => dot(C, x, 0.05, GOLD, 4));
      plotFn(C, x => Math.exp(-((x - mu) ** 2) / 2) / Math.sqrt(2 * Math.PI), P, 2.4);
      const best = data.reduce((a, b) => a + b, 0) / data.length;
      out.innerHTML = `Gaussian centred at μ=<b>${mu.toFixed(2)}</b>. Log-likelihood peaks at the sample mean = <b>${best.toFixed(2)}</b> (slide μ there).`;
    }
    ctrls.appendChild(slider("μ", -2, 2, .05, mu, v => { mu = v; draw(); })); draw();
    host.appendChild(hint("Gold dots = data; move μ to maximise the fit"));
  });
  register("map", function (host, p) {
    let lam = 0; const data = [2.4, 2.8, 3.1];
    const C = makeCanvas(host, 320, 230, -1, 5, -0.05, 1.1);
    const ctrls = controls(host); const out = readout(host, "");
    function draw() {
      clear(C); grid(C, 1);
      const mleM = data.reduce((a, b) => a + b, 0) / data.length;            // ~2.77
      const mapM = mleM / (1 + lam);                                          // prior pulls toward 0
      plotFn(C, x => Math.exp(-((x - 0) ** 2) / 2) / Math.sqrt(2 * Math.PI), "rgba(31,122,140,.6)", 2);      // prior at 0
      plotFn(C, x => Math.exp(-((x - mapM) ** 2) / 2) / Math.sqrt(2 * Math.PI), P, 2.4);                      // posterior
      data.forEach(x => dot(C, x, 0.05, GOLD, 4));
      out.innerHTML = `MLE estimate = ${mleM.toFixed(2)}. Prior strength λ=<b>${lam.toFixed(1)}</b> pulls the MAP estimate toward 0 → <b>${mapM.toFixed(2)}</b>.`;
    }
    ctrls.appendChild(slider("prior strength λ", 0, 4, .2, lam, v => { lam = v; draw(); })); draw();
    host.appendChild(hint("Teal = prior (belief), Purple = posterior (MAP)"));
  });
  register("bayes", function (host, p) {
    let obs = 0; let heads = 0, n = 0;
    const C = makeCanvas(host, 320, 230, 0, 1, -0.05, 6);
    const ctrls = controls(host); const out = readout(host, "");
    function beta(x, a, b) { return Math.pow(x, a - 1) * Math.pow(1 - x, b - 1); }
    function draw() {
      clear(C); grid(C, 0.25);
      const a = 1 + heads, b = 1 + (n - heads);
      let arr = [], mx = 0; for (let i = 0; i <= 200; i++) { const x = i / 200; const v = beta(x, a, b); arr.push(v); if (v > mx) mx = v; }
      C.ctx.strokeStyle = P; C.ctx.lineWidth = 2.6; C.ctx.beginPath(); arr.forEach((v, i) => { const px = C.sx(i / 200), py = C.sy(v / mx * 5); i ? C.ctx.lineTo(px, py) : C.ctx.moveTo(px, py); }); C.ctx.stroke();
      out.innerHTML = `Coin bias belief after <b>${heads}</b> heads / <b>${n}</b> flips. Starts flat (no idea); each flip sharpens the posterior.`;
    }
    ctrls.appendChild(btn("Flip Heads", () => { heads++; n++; draw(); }));
    ctrls.appendChild(btn("Flip Tails", () => { n++; draw(); }));
    ctrls.appendChild(btn("Reset", () => { heads = 0; n = 0; draw(); }));
    draw();
  });
  register("hyptest", function (host, p) {
    const C = makeCanvas(host, 320, 230, -4, 4, -0.02, 0.45);
    let shift = 2.2;
    const ctrls = controls(host); const out = readout(host, "");
    function draw() {
      clear(C); grid(C, 1);
      plotFn(C, x => Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI), "rgba(76,74,152,.7)", 2.2);       // H0
      plotFn(C, x => Math.exp(-((x - shift) ** 2) / 2) / Math.sqrt(2 * Math.PI), ROSE, 2.2);            // H1
      C.ctx.setLineDash([4, 4]); C.ctx.strokeStyle = GOLD; C.ctx.beginPath(); C.ctx.moveTo(C.sx(1.64), 0); C.ctx.lineTo(C.sx(1.64), C.h); C.ctx.stroke(); C.ctx.setLineDash([]);
      out.innerHTML = `Purple = H₀ (no effect), Rose = H₁ (effect of ${shift.toFixed(1)}σ). Gold line = significance threshold. More separation → easier to reject H₀.`;
    }
    ctrls.appendChild(slider("true effect (σ)", 0, 3.5, .1, shift, v => { shift = v; draw(); })); draw();
  });
  register("pvalue", function (host, p) {
    let z = 2.1; const C = makeCanvas(host, 320, 230, -4, 4, -0.02, 0.45);
    const ctrls = controls(host); const out = readout(host, "");
    function phi(x) { return Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI); }
    function tail(z) { /* approx two-tailed p */ let s = 0; for (let x = z; x < 6; x += 0.01) s += phi(x) * 0.01; return 2 * s; }
    function draw() {
      clear(C); grid(C, 1); plotFn(C, phi, P, 2.2);
      C.ctx.fillStyle = "rgba(155,59,106,.35)";
      [[z, 6], [-6, -z]].forEach(([a, b]) => { C.ctx.beginPath(); C.ctx.moveTo(C.sx(a), C.sy(0)); for (let x = a; x <= b; x += 0.02) C.ctx.lineTo(C.sx(x), C.sy(phi(x))); C.ctx.lineTo(C.sx(b), C.sy(0)); C.ctx.closePath(); C.ctx.fill(); });
      const pp = tail(z);
      out.innerHTML = `z = <b>${z.toFixed(2)}</b> → p ≈ <b>${pp.toFixed(3)}</b> (rose tail area). ${pp < 0.05 ? "<b style='color:#1f7a8c'>significant (p<0.05)</b>" : "not significant"}`;
    }
    ctrls.appendChild(slider("z-score", 0, 3.5, .05, z, v => { z = v; draw(); })); draw();
  });
  register("sampling", function (host, p) {
    const C = makeCanvas(host, 320, 230, -4, 4, -0.02, 0.45);
    let pts = [];
    const ctrls = controls(host); const out = readout(host, "");
    function gauss() { let u = Math.random(), v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
    function draw() {
      clear(C); grid(C, 1); plotFn(C, x => Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI), "rgba(76,74,152,.5)", 2);
      pts.forEach(x => dot(C, x, 0.02 + 0.01 * Math.random(), GOLD, 3));
      out.innerHTML = `<b>${pts.length}</b> samples drawn from N(0,1). They pile up where the curve is tall.`;
    }
    ctrls.appendChild(btn("Draw 20", () => { for (let i = 0; i < 20; i++) pts.push(gauss()); draw(); }));
    ctrls.appendChild(btn("Reset", () => { pts = []; draw(); })); draw();
  });

  // distribution-with-markers for expectation/variance/random-variable
  register("distmark", function (host, p) {
    const showVar = p.variance;
    let sig = 1; const mu = 0.4;
    const C = makeCanvas(host, 320, 230, -4, 4, -0.02, 0.9);
    const ctrls = controls(host); const out = readout(host, "");
    function draw() {
      clear(C); grid(C, 1);
      plotFn(C, x => Math.exp(-((x - mu) ** 2) / (2 * sig * sig)) / (Math.sqrt(2 * Math.PI) * sig), P, 2.4);
      C.ctx.setLineDash([4, 4]); C.ctx.strokeStyle = ROSE; C.ctx.beginPath(); C.ctx.moveTo(C.sx(mu), 0); C.ctx.lineTo(C.sx(mu), C.h); C.ctx.stroke(); C.ctx.setLineDash([]);
      if (showVar) { C.ctx.strokeStyle = GOLD; C.ctx.lineWidth = 2; [mu - sig, mu + sig].forEach(x => { C.ctx.beginPath(); C.ctx.moveTo(C.sx(x), C.sy(0)); C.ctx.lineTo(C.sx(x), C.sy(0.3)); C.ctx.stroke(); }); }
      out.innerHTML = showVar ? `Variance = spread². σ=<b>${sig.toFixed(1)}</b> (gold bars at μ±σ). Bigger σ → wider, flatter.` : `Expectation μ (rose line) = the balance point / long-run average = <b>${mu.toFixed(1)}</b>.`;
    }
    if (showVar) ctrls.appendChild(slider("std σ", 0.4, 2.2, .1, sig, v => { sig = v; draw(); }));
    draw();
  });

  // ---------- shared small bits ----------
  function hint(t) { return el("div", "mlv-hint", t); }
  function btnRow(fn) { const r = el("div", "mlv-controls"); r.appendChild(btn("Resample", fn)); return r; }

  // ---------- boot ----------
  function initAll() {
    document.querySelectorAll(".ml-viz:not([data-ready])").forEach(host => {
      host.setAttribute("data-ready", "1");
      let params = {}; try { params = JSON.parse(host.getAttribute("data-params") || "{}"); } catch (e) { }
      const t = host.getAttribute("data-viz"); const fn = reg[t];
      const head = el("div", "mlv-head"); head.innerHTML = `<span class="mlv-dot"></span><span class="mlv-dot"></span><span class="mlv-dot"></span><span class="mlv-title">interactive · ${t}</span>`;
      host.appendChild(head);
      const body = el("div", "mlv-body"); host.appendChild(body);
      if (fn) { try { fn(body, params); } catch (e) { body.appendChild(el("div", "mlv-out", "demo error: " + e.message)); } }
      else body.appendChild(el("div", "mlv-out", "(no demo for '" + t + "')"));
    });
  }
  document.addEventListener("DOMContentLoaded", initAll);
  document.addEventListener("quarto-after-body", initAll);
  // re-render on theme toggle so colours match
  const mo = new MutationObserver(() => { /* canvases redraw on next interaction; light refresh */ });
  window.addEventListener("load", initAll);
})();
