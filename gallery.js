/* ============================================================
   檔案页：浮雕网格 + 烛光增亮 + 浮尘粒子 + 限幅旋转
   ============================================================ */

(function () {
  'use strict';

  var SITE = window.SITE || {};
  var items = Array.isArray(SITE.items) ? SITE.items : [];

  var grid = document.getElementById('grid');
  var countEl = document.getElementById('count');
  var dust = document.getElementById('dust');

  var BASE_THETA = -90;   // 模型整体右转 90° 后的正面朝向（若转反了，改成 90）
  var BASE_PHI = 82;      // 略微俯视，能看出浮雕厚度
  var LIMIT = 20;         // 上下左右最大偏转 ±20°

  /* ---------------- 载入 model-viewer ---------------- */
  var SOURCES = [
    'model-viewer.min.js',
    'https://cdn.bootcdn.net/ajax/libs/model-viewer/4.4.0/model-viewer.min.js',
    'https://cdn.jsdelivr.net/npm/@google/model-viewer/dist/model-viewer.min.js'
  ];
  function loadScript(url) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = url; s.type = 'module';
      s.onload = resolve;
      s.onerror = function () { reject(new Error(url)); };
      document.head.appendChild(s);
    });
  }
  function withTimeout(p, ms) {
    return Promise.race([p, new Promise(function (_, rej) { setTimeout(function () { rej(new Error('timeout')); }, ms); })]);
  }
  async function ensureViewer() {
    if (window.customElements && customElements.get('model-viewer')) return true;
    for (var i = 0; i < SOURCES.length; i++) {
      try { await withTimeout(loadScript(SOURCES[i]), 20000); } catch (e) { continue; }
      try { await withTimeout(customElements.whenDefined('model-viewer'), 6000); return true; } catch (e) {}
    }
    return false;
  }

  /* ---------------- 卡片 ---------------- */
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  function makeCard(item, i) {
    var card = document.createElement('article');
    card.className = 'card';

    var media = document.createElement('div');
    media.className = 'card-media';

    var mv = document.createElement('model-viewer');
    mv.setAttribute('alt', item.name || ('浮雕 ' + (i + 1)));
    mv.setAttribute('src', item.src);
    mv.setAttribute('environment-image', 'neutral');
    mv.setAttribute('tone-mapping', 'neutral');
    mv.setAttribute('exposure', '1.0');
    mv.setAttribute('shadow-intensity', '0.4');
    mv.setAttribute('shadow-softness', '1');
    mv.setAttribute('interaction-prompt', 'none');
    mv.setAttribute('camera-orbit', BASE_THETA + 'deg ' + BASE_PHI + 'deg auto');
    mv.setAttribute('min-field-of-view', '18deg');
    mv.setAttribute('touch-action', 'none');
    mv.setAttribute('loading', 'lazy');
    mv.setAttribute('reveal', 'auto');

    media.appendChild(mv);

    var cap = document.createElement('div');
    cap.className = 'card-cap';
    var no = document.createElement('span');
    no.className = 'cap-no';
    no.textContent = item.no || String(i + 1).padStart(2, '0');
    var name = document.createElement('span');
    name.className = 'cap-name';
    name.textContent = item.name || '';
    cap.appendChild(no);
    cap.appendChild(name);

    card.appendChild(media);
    card.appendChild(cap);

    /* 拖动旋转，限制在 ±20° */
    var state = { theta: 0, phi: 0, dragging: false, x: 0, y: 0 };

    media.addEventListener('pointerdown', function (e) {
      state.dragging = true;
      state.x = e.clientX;
      state.y = e.clientY;
      state.theta = 0;
      state.phi = 0;
    });

    window.addEventListener('pointermove', function (e) {
      if (!state.dragging) return;
      var dx = e.clientX - state.x;
      var dy = e.clientY - state.y;
      state.theta = clamp(dx * 0.14, -LIMIT, LIMIT);
      state.phi = clamp(-dy * 0.14, -LIMIT, LIMIT);
      mv.setAttribute(
        'camera-orbit',
        (BASE_THETA + state.theta).toFixed(2) + 'deg ' + (BASE_PHI + state.phi).toFixed(2) + 'deg auto'
      );
    });

    function end() {
      if (!state.dragging) return;
      state.dragging = false;
    }
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    media.addEventListener('pointerleave', end);

    return card;
  }

  function build() {
    if (!grid) return;
    grid.innerHTML = '';
    if (countEl) countEl.textContent = items.length ? String(items.length).padStart(2, '0') : '00';
    items.forEach(function (item, i) { grid.appendChild(makeCard(item, i)); });
  }

  /* ---------------- 烛光位置 ---------------- */
  var tx = window.innerWidth * 0.5;
  var ty = window.innerHeight * 0.42;
  var px = tx, py = ty;
  var lastMove = Date.now();
  var t = 0;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function setLight(x, y) {
    var s = document.documentElement.style;
    s.setProperty('--lx', x.toFixed(1) + 'px');
    s.setProperty('--ly', y.toFixed(1) + 'px');
  }

  window.addEventListener('pointermove', function (e) {
    tx = e.clientX; ty = e.clientY; lastMove = Date.now();
  }, { passive: true });

  function lightLoop() {
    var idle = Date.now() - lastMove > 6000;
    if (idle) {
      t += 0.003;
      tx = window.innerWidth * (0.5 + 0.26 * Math.sin(t));
      ty = window.innerHeight * (0.46 + 0.18 * Math.sin(t * 1.6 + 1.1));
    }
    var k = idle ? 0.014 : 0.17;
    px += (tx - px) * k;
    py += (ty - py) * k;
    setLight(px, py);
    requestAnimationFrame(lightLoop);
  }

  /* ---------------- 浮尘粒子 ---------------- */
  var ctx = null, W = 0, H = 0, dpr = 1;
  var parts = [];

  function resizeCanvas() {
    if (!dust) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    dust.width = Math.floor(W * dpr);
    dust.height = Math.floor(H * dpr);
    dust.style.width = W + 'px';
    dust.style.height = H + 'px';
    ctx = dust.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function seedParticles() {
    var n = Math.round(Math.min(90, Math.max(36, W * H / 26000)));
    parts = [];
    for (var i = 0; i < n; i++) {
      parts.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: 0.6 + Math.random() * 1.7,
        vy: -(0.12 + Math.random() * 0.42),          // 向上飘
        vx: (Math.random() - 0.5) * 0.18,
        ph: Math.random() * Math.PI * 2,
        sp: 0.4 + Math.random() * 0.8,
        a: 0.25 + Math.random() * 0.6
      });
    }
  }

  var frame = 0;
  function dustLoop() {
    if (!ctx) return;
    frame++;
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';

    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      p.ph += 0.01 * p.sp;
      p.x += p.vx + Math.sin(p.ph) * 0.22;
      p.y += p.vy;
      if (p.y < -12) { p.y = H + 12; p.x = Math.random() * W; }
      if (p.x < -12) p.x = W + 12;
      if (p.x > W + 12) p.x = -12;

      // 靠近烛光时更亮
      var dx = p.x - px, dy = p.y - py;
      var d = Math.sqrt(dx * dx + dy * dy);
      var near = Math.max(0, 1 - d / 340);
      var glow = 0.35 + near * 1.6;

      var alpha = p.a * glow * (0.55 + 0.45 * Math.sin(p.ph * 1.7));
      if (alpha <= 0.01) continue;

      var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 6);
      g.addColorStop(0, 'rgba(255, 214, 160, ' + Math.min(0.9, alpha).toFixed(3) + ')');
      g.addColorStop(0.45, 'rgba(255, 170, 96, ' + Math.min(0.5, alpha * 0.6).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(255, 140, 60, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 6, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalCompositeOperation = 'source-over';
    requestAnimationFrame(dustLoop);
  }

  /* ---------------- 卡片光斑坐标 ---------------- */
  function measure() {
    var els = document.querySelectorAll('.card-media');
    for (var i = 0; i < els.length; i++) {
      var r = els[i].getBoundingClientRect();
      els[i].style.setProperty('--card-x', r.left + 'px');
      els[i].style.setProperty('--card-y', r.top + 'px');
    }
  }

  window.addEventListener('resize', function () {
    resizeCanvas();
    seedParticles();
    measure();
  });
  window.addEventListener('scroll', measure, { passive: true });

  /* ---------------- 文案 ---------------- */
  function text(sel, v) { var n = document.querySelector(sel); if (n && v) n.textContent = v; }
  text('[data-bind="title"]', SITE.title);
  text('[data-bind="sectionTitle"]', SITE.sectionTitle);
  text('[data-bind="archLine"]', SITE.archLine);
  text('[data-bind="footL"]', SITE.footL);
  text('[data-bind="footR"]', SITE.footR);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'l' || e.key === 'L') document.body.classList.toggle('is-lit');
  });

  /* ---------------- 启动 ---------------- */
  resizeCanvas();
  seedParticles();
  setLight(px, py);
  lastMove = Date.now() - 5000;

  if (!reduce) {
    requestAnimationFrame(lightLoop);
    requestAnimationFrame(dustLoop);
  }

  ensureViewer().then(function (ok) {
    build();
    if (!ok && grid) {
      grid.innerHTML = '<p style="grid-column:1/-1;padding:40px 0;color:#8d8375;font-size:13px;letter-spacing:.2em">三维组件未能载入，请确认 model-viewer.min.js 已上传</p>';
    }
    measure();
    setTimeout(measure, 900);
  });
})();
