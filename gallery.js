/* ============================================================
   檔案页：循环陈列 · 滚轮切换 · 中心模型随鼠标 · 点击放大
   ============================================================ */

(function () {
  'use strict';

  var SITE = window.SITE || {};
  var items = Array.isArray(SITE.items) ? SITE.items : [];

  var railEl = document.getElementById('rail');
  var dust = document.getElementById('dust');
  var countEl = document.getElementById('count');
  var modal = document.getElementById('modal');
  var modalStage = document.getElementById('modalStage');
  var modalNo = document.getElementById('modalNo');
  var modalName = document.getElementById('modalName');

  var BASE_THETA = -90;   // 整体朝向（若转反了改成 90）
  var BASE_PHI = 82;
  var LIMIT = 20;         // 随鼠标偏移的最大角度

  var N = items.length;
  var slides = [];
  var viewers = [];
  var bases = [];
  var current = 0;

  var modalViewer = null;
  var modalBase = { theta: BASE_THETA, phi: BASE_PHI };

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

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function baseTheta(item) { return BASE_THETA + (item.flip || 0); }

  /* ---------------- 构建（首尾各挂一个克隆，形成无缝循环） ---------------- */
  function build() {
    railEl.innerHTML = '';
    slides = [];
    viewers = [];
    bases = [];
    if (countEl) countEl.textContent = N ? String(N).padStart(2, '0') : '00';

    // 顺序：最后一件（前置克隆）→ 全部 → 第一件（后置克隆）
    var order = [];
    if (N > 1) order.push(N - 1);
    for (var i = 0; i < N; i++) order.push(i);
    if (N > 1) order.push(0);

    order.forEach(function (itemIndex) {
      var item = items[itemIndex];

      var slide = document.createElement('div');
      slide.className = 'slide';
      slide.dataset.idx = String(itemIndex);

      var model = document.createElement('div');
      model.className = 'model';

      var mv = document.createElement('model-viewer');
      mv.setAttribute('alt', item.name || ('浮雕 ' + (itemIndex + 1)));
      mv.setAttribute('src', item.src);
      mv.setAttribute('environment-image', 'neutral');
      mv.setAttribute('tone-mapping', 'neutral');
      mv.setAttribute('exposure', '1.0');
      mv.setAttribute('shadow-intensity', '0.4');
      mv.setAttribute('shadow-softness', '1');
      mv.setAttribute('interaction-prompt', 'none');
      mv.setAttribute('camera-orbit', baseTheta(item) + 'deg ' + BASE_PHI + 'deg auto');
      mv.setAttribute('min-field-of-view', '18deg');
      mv.setAttribute('loading', 'lazy');
      mv.setAttribute('reveal', 'auto');

      // 载入瞬间把镜头钉死，避免从默认角度转过来
      mv.addEventListener('load', function () {
        if (typeof mv.jumpCameraToGoal === 'function') mv.jumpCameraToGoal();
      });

      model.appendChild(mv);

      var cap = document.createElement('div');
      cap.className = 'slide-cap';
      var no = document.createElement('span');
      no.className = 'cap-no';
      no.textContent = item.no || String(itemIndex + 1).padStart(2, '0');
      var name = document.createElement('span');
      name.className = 'cap-name';
      name.textContent = item.name || '';
      cap.appendChild(no);
      cap.appendChild(name);

      slide.appendChild(model);
      slide.appendChild(cap);
      railEl.appendChild(slide);

      slides.push(slide);
      viewers.push(mv);
      bases.push({ theta: baseTheta(item), phi: BASE_PHI });

      model.addEventListener('click', function () { openModal(itemIndex); });
    });
  }

  /* ---------------- 首尾留白 ---------------- */
  function padRail() {
    var first = slides[0];
    if (!first) return;
    var w = first.getBoundingClientRect().width;
    var pad = Math.max(16, (window.innerWidth - w) / 2);
    railEl.style.paddingLeft = pad + 'px';
    railEl.style.paddingRight = pad + 'px';
  }

  /* ---------------- 切换 ---------------- */
  function centerOf(el) {
    var r = el.getBoundingClientRect();
    return r.left + r.width / 2;
  }

  function scrollToSlide(i, instant) {
    var target = slides[i];
    if (!target) return;
    var railRect = railEl.getBoundingClientRect();
    var delta = centerOf(target) - (railRect.left + railRect.width / 2);
    railEl.scrollTo({
      left: railEl.scrollLeft + delta,
      behavior: instant ? 'auto' : 'smooth'
    });
  }

  function go(i, instant) {
    var idx = clamp(i, 0, slides.length - 1);
    current = idx;
    scrollToSlide(idx, instant);
    updateCenter(true);
  }

  function updateCenter(keepCurrent) {
    if (!slides.length) return;
    var railRect = railEl.getBoundingClientRect();
    var mid = railRect.left + railRect.width / 2;
    var best = 0;
    var bestD = Infinity;

    slides.forEach(function (s, i) {
      var d = Math.abs(centerOf(s) - mid);
      if (d < bestD) { bestD = d; best = i; }
      var w = s.getBoundingClientRect().width;
      s.classList.toggle('is-near', d > w * 0.45 && d < w * 1.6);
      s.classList.toggle('is-center', d <= w * 0.45);
    });

    current = keepCurrent ? current : best;
    queueTilt();

    if (!keepCurrent) wrapIfNeeded();
  }

  /* ---------------- 无限循环：滚到首尾克隆时悄悄跳到真身 ---------------- */
  function wrapIfNeeded() {
    if (N < 2) return;
    var target = -1;
    if (current === 0) target = N;          // 前置克隆 → 最后一件真身
    else if (current === N + 1) target = 1; // 后置克隆 → 第一件真身
    if (target < 0) return;

    var prev = railEl.style.scrollBehavior;
    railEl.style.scrollBehavior = 'auto';
    var railRect = railEl.getBoundingClientRect();
    var delta = centerOf(slides[target]) - (railRect.left + railRect.width / 2);
    railEl.scrollLeft = railEl.scrollLeft + delta;
    current = target;
    railEl.style.scrollBehavior = prev || '';
  }

  /* ---------------- 滚轮（恢复原来的手感：一次一格） ---------------- */
  var lastWheel = 0;
  var WHEEL_GAP = 365;
  railEl.addEventListener('wheel', function (e) {
    e.preventDefault();
    var now = Date.now();
    if (now - lastWheel < WHEEL_GAP) return;
    var d = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    if (Math.abs(d) < 4) return;
    lastWheel = now;
    go(current + (d > 0 ? 1 : -1));
  }, { passive: false });

  window.addEventListener('keydown', function (e) {
    if (modal && modal.classList.contains('is-open')) {
      if (e.key === 'Escape') closeModal();
      return;
    }
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); go(current + 1); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); go(current - 1); }
    if (e.key === 'l' || e.key === 'L') document.body.classList.toggle('is-lit');
  });

  var scrollTimer = null;
  railEl.addEventListener('scroll', function () {
    if (scrollTimer) clearTimeout(scrollTimer);
    scrollTimer = setTimeout(function () { updateCenter(); }, 110);
  }, { passive: true });

  /* ---------------- 只有中心模型随鼠标偏移 ---------------- */
  var tiltTheta = 0;
  var tiltPhi = 0;
  var tiltQueued = false;
  var lastTilted = -1;

  function resetViewer(i) {
    if (i < 0 || !viewers[i]) return;
    var b = bases[i];
    viewers[i].setAttribute('camera-orbit', b.theta + 'deg ' + b.phi + 'deg auto');
  }

  function applyTilt() {
    tiltQueued = false;

    if (lastTilted !== current) {
      if (lastTilted !== -1) resetViewer(lastTilted);
      lastTilted = current;
    }

    var mv = viewers[current];
    if (mv) {
      var b = bases[current];
      mv.setAttribute('camera-orbit',
        (b.theta + tiltTheta).toFixed(2) + 'deg ' + (b.phi + tiltPhi).toFixed(2) + 'deg auto');
    }

    if (modalViewer && modal && modal.classList.contains('is-open')) {
      modalViewer.setAttribute('camera-orbit',
        (modalBase.theta + tiltTheta).toFixed(2) + 'deg ' + (modalBase.phi + tiltPhi).toFixed(2) + 'deg auto');
    }
  }

  function queueTilt() {
    if (tiltQueued) return;
    tiltQueued = true;
    requestAnimationFrame(applyTilt);
  }

  window.addEventListener('pointermove', function (e) {
    var nx = (e.clientX / window.innerWidth - 0.5) * 2;
    var ny = (e.clientY / window.innerHeight - 0.5) * 2;
    tiltTheta = clamp(nx * LIMIT, -LIMIT, LIMIT);
    tiltPhi = clamp(ny * LIMIT, -LIMIT, LIMIT);
    queueTilt();
  }, { passive: true });

  /* ---------------- 放大查看 ---------------- */
  function openModal(i) {
    var item = items[i];
    if (!item || !modal) return;

    if (!modalViewer) {
      modalViewer = document.createElement('model-viewer');
      modalViewer.setAttribute('environment-image', 'neutral');
      modalViewer.setAttribute('tone-mapping', 'neutral');
      modalViewer.setAttribute('exposure', '1.05');
      modalViewer.setAttribute('shadow-intensity', '0.35');
      modalViewer.setAttribute('interaction-prompt', 'none');
      modalViewer.setAttribute('min-field-of-view', '14deg');
      modalViewer.addEventListener('load', function () {
        // 载入后先钉死镜头，再显形——彻底避免从背面转过来
        if (typeof modalViewer.jumpCameraToGoal === 'function') modalViewer.jumpCameraToGoal();
        modalViewer.style.opacity = '1';
      });
      modalStage.appendChild(modalViewer);
    }

    modalBase = { theta: baseTheta(item), phi: BASE_PHI };
    modalViewer.setAttribute('camera-orbit', modalBase.theta + 'deg ' + modalBase.phi + 'deg auto');

    var same = modalViewer.getAttribute('src') === item.src;
    if (!same) {
      modalViewer.style.opacity = '0';
      modalViewer.setAttribute('src', item.src);
      // 保险：万一 load 没触发，1.2 秒后强制显形
      setTimeout(function () { if (modalViewer) modalViewer.style.opacity = '1'; }, 1200);
    } else {
      modalViewer.style.opacity = '1';
    }

    if (typeof modalViewer.jumpCameraToGoal === 'function') {
      modalViewer.jumpCameraToGoal();
      setTimeout(function () {
        if (modalViewer && typeof modalViewer.jumpCameraToGoal === 'function') modalViewer.jumpCameraToGoal();
      }, 60);
    }

    if (modalNo) modalNo.textContent = item.no || '';
    if (modalName) modalName.textContent = item.name || '';

    modal.removeAttribute('hidden');
    requestAnimationFrame(function () { modal.classList.add('is-open'); });
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove('is-open');
    setTimeout(function () {
      if (!modal.classList.contains('is-open')) modal.setAttribute('hidden', '');
    }, 420);
  }

  if (modal) {
    // 放大页里点任何地方都关掉（模型框内也算）
    modal.addEventListener('click', function () { closeModal(); });
  }

  /* ---------------- 烛光 ---------------- */
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

  /* ---------------- 浮尘 ---------------- */
  var ctx = null, W = 0, H = 0, dpr = 1, parts = [];

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

  function seed() {
    var n = Math.round(Math.min(90, Math.max(36, W * H / 26000)));
    parts = [];
    for (var i = 0; i < n; i++) {
      parts.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: 0.6 + Math.random() * 1.7,
        vy: -(0.12 + Math.random() * 0.42),
        vx: (Math.random() - 0.5) * 0.18,
        ph: Math.random() * Math.PI * 2,
        sp: 0.4 + Math.random() * 0.8,
        a: 0.25 + Math.random() * 0.6
      });
    }
  }

  function dustLoop() {
    if (!ctx) return;
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

  /* ---------------- 光斑坐标 ---------------- */
  function measure() {
    var els = document.querySelectorAll('.model');
    for (var i = 0; i < els.length; i++) {
      var r = els[i].getBoundingClientRect();
      els[i].style.setProperty('--model-x', r.left + 'px');
      els[i].style.setProperty('--model-y', r.top + 'px');
    }
  }

  window.addEventListener('resize', function () {
    resizeCanvas();
    seed();
    padRail();
    measure();
    updateCenter();
  });

  /* ---------------- 文案 ---------------- */
  function text(sel, v) { var n = document.querySelector(sel); if (n && v) n.textContent = v; }
  text('[data-bind="title"]', SITE.title);
  text('[data-bind="sectionTitle"]', SITE.sectionTitle);
  text('[data-bind="archLine"]', SITE.archLine);
  text('[data-bind="footL"]', SITE.footL);
  text('[data-bind="footR"]', SITE.footR);

  /* ---------------- 启动 ---------------- */
  resizeCanvas();
  seed();
  setLight(px, py);
  lastMove = Date.now() - 5000;

  if (!reduce) {
    requestAnimationFrame(lightLoop);
    requestAnimationFrame(dustLoop);
  }

  ensureViewer().then(function (ok) {
    build();
    if (ok && N) {
      padRail();
      go(1, true);          // 从第一件真身开始（左边是最后一件的克隆）
    } else if (railEl) {
      railEl.innerHTML = '<p style="padding:40px;color:#8d8375;font-size:13px;letter-spacing:.2em">三维组件未能载入，请确认 model-viewer.min.js 已上传</p>';
    }
    measure();
    updateCenter();
    setTimeout(function () { padRail(); measure(); updateCenter(); }, 900);
  });
})();
