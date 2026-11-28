/* ============================================================
   檔案页：横向轮播 + 烛光 + 限幅旋转
   ============================================================ */

(function () {
  'use strict';

  var SITE = window.SITE || {};
  var items = Array.isArray(SITE.items) ? SITE.items : [];

  var railEl = document.getElementById('rail');
  var pagerEl = document.getElementById('pager');
  var capNo = document.getElementById('capNo');
  var capName = document.getElementById('capName');
  var capNote = document.getElementById('capNote');

  var BASE_PHI = 82;      // 正视角（略微俯视，能看出浮雕厚度）
  var LIMIT = 20;         // 上下左右最大偏转 ±20°
  var index = 0;
  var viewers = [];
  var loaded = [];

  var curTheta = 0;
  var curPhi = BASE_PHI;

  /* ---------------- 载入 model-viewer ---------------- */
  var SOURCES = [
    'model-viewer.min.js',
    'https://cdn.bootcdn.net/ajax/libs/model-viewer/4.4.0/model-viewer.min.js',
    'https://cdn.jsdelivr.net/npm/@google/model-viewer/dist/model-viewer.min.js'
  ];

  function loadScript(url) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = url;
      s.type = 'module';
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

  /* ---------------- 构建轨道 ---------------- */
  function buildRail() {
    railEl.innerHTML = '';
    viewers = [];
    loaded = [];

    items.forEach(function (item, i) {
      var slide = document.createElement('section');
      slide.className = 'slide';
      slide.setAttribute('aria-label', item.name || ('浮雕 ' + (i + 1)));

      var wrap = document.createElement('div');
      wrap.className = 'model';

      var mv = document.createElement('model-viewer');
      mv.setAttribute('alt', item.name || '浮雕');
      mv.setAttribute('environment-image', 'neutral');
      mv.setAttribute('tone-mapping', 'neutral');
      mv.setAttribute('exposure', '1.06');
      mv.setAttribute('shadow-intensity', '0.45');
      mv.setAttribute('shadow-softness', '1');
      mv.setAttribute('interaction-prompt', 'none');
      mv.setAttribute('camera-orbit', '0deg ' + BASE_PHI + 'deg auto');
      mv.setAttribute('min-field-of-view', '16deg');
      mv.setAttribute('touch-action', 'none');
      mv.setAttribute('loading', 'lazy');

      wrap.appendChild(mv);
      slide.appendChild(wrap);
      railEl.appendChild(slide);
      viewers.push(mv);
    });

    if (pagerEl) {
      pagerEl.innerHTML = '';
      items.forEach(function (item, i) {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = item.no || String(i + 1).padStart(2, '0');
        b.addEventListener('click', function () { go(i); });
        pagerEl.appendChild(b);
      });
    }
  }

  function loadAround(i) {
    [i - 1, i, i + 1].forEach(function (k) {
      if (k < 0 || k >= items.length) return;
      if (loaded[k]) return;
      loaded[k] = true;
      viewers[k].setAttribute('src', items[k].src);
    });
  }

  /* ---------------- 切换 ---------------- */
  function layout() {
    var first = railEl.firstElementChild;
    if (!first) return;
    var w = first.getBoundingClientRect().width;
    var offset = (window.innerWidth - w) / 2;
    railEl.style.transform = 'translate3d(' + (offset - index * w) + 'px,0,0)';
  }

  function go(i, silent) {
    index = Math.max(0, Math.min(items.length - 1, i));
    layout();

    var item = items[index] || {};
    if (capNo) capNo.textContent = item.no || '';
    if (capName) capName.textContent = item.name || '';
    if (capNote) capNote.textContent = item.note || '';

    if (pagerEl) {
      Array.prototype.forEach.call(pagerEl.children, function (b, k) {
        b.classList.toggle('is-on', k === index);
      });
    }

    // 复位当前模型的观察角度
    curTheta = 0;
    curPhi = BASE_PHI;
    if (viewers[index]) {
      viewers[index].setAttribute('camera-orbit', '0deg ' + BASE_PHI + 'deg auto');
    }

    loadAround(index);
    measure();
  }

  /* ---------------- 滚轮 ---------------- */
  var lastWheel = 0;
  window.addEventListener('wheel', function (e) {
    e.preventDefault();
    var now = Date.now();
    if (now - lastWheel < 620) return;
    if (Math.abs(e.deltaY) < 6 && Math.abs(e.deltaX) < 6) return;
    lastWheel = now;
    var d = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    go(index + (d > 0 ? 1 : -1));
  }, { passive: false });

  // 触控板横向滑动
  var lastX = 0;
  window.addEventListener('touchstart', function (e) {
    lastX = e.touches[0].clientX;
  }, { passive: true });
  window.addEventListener('touchend', function (e) {
    var dx = e.changedTouches[0].clientX - lastX;
    if (Math.abs(dx) > 55) go(index + (dx < 0 ? 1 : -1));
  }, { passive: true });

  /* ---------------- 键盘 ---------------- */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); go(index + 1); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); go(index - 1); }
    if (e.key === 'l' || e.key === 'L') document.body.classList.toggle('is-lit');
  });

  /* ---------------- 拖动旋转（±20°） ---------------- */
  var drag = null;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  function applyOrbit() {
    var mv = viewers[index];
    if (!mv) return;
    mv.setAttribute('camera-orbit', curTheta.toFixed(2) + 'deg ' + curPhi.toFixed(2) + 'deg auto');
  }

  window.addEventListener('pointerdown', function (e) {
    if (e.target.closest && e.target.closest('.pager')) return;
    drag = {
      x: e.clientX,
      y: e.clientY,
      theta: curTheta,
      phi: curPhi,
      touch: e.pointerType === 'touch',
      mode: null
    };
  });

  window.addEventListener('pointermove', function (e) {
    if (!drag) return;
    var dx = e.clientX - drag.x;
    var dy = e.clientY - drag.y;

    if (!drag.mode) {
      if (Math.sqrt(dx * dx + dy * dy) < 7) return;
      // 触屏上横向大幅滑动 = 换页；其余 = 旋转
      drag.mode = (drag.touch && Math.abs(dx) > Math.abs(dy) * 1.5) ? 'swipe' : 'rotate';
    }

    if (drag.mode === 'rotate') {
      curTheta = clamp(drag.theta + dx * 0.12, -LIMIT, LIMIT);
      curPhi = clamp(drag.phi - dy * 0.12, BASE_PHI - LIMIT, BASE_PHI + LIMIT);
      applyOrbit();
    }
  });

  function endDrag(e) {
    if (!drag) return;
    if (drag.mode === 'swipe') {
      var dx = e.clientX - drag.x;
      if (Math.abs(dx) > 55) go(index + (dx < 0 ? 1 : -1));
    }
    drag = null;
  }
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', function () { drag = null; });

  /* ---------------- 烛光 ---------------- */
  var tx = window.innerWidth * 0.5;
  var ty = window.innerHeight * 0.46;
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

  function loop() {
    var idle = Date.now() - lastMove > 6500;
    if (idle) {
      t += 0.0032;
      tx = window.innerWidth * (0.5 + 0.26 * Math.sin(t));
      ty = window.innerHeight * (0.46 + 0.16 * Math.sin(t * 1.7 + 1.1));
    }
    var k = idle ? 0.012 : 0.17;
    px += (tx - px) * k;
    py += (ty - py) * k;
    setLight(px, py);
    requestAnimationFrame(loop);
  }
  if (!reduce) requestAnimationFrame(loop);

  /* ---------------- 光斑坐标 ---------------- */
  var modelEls = [];
  function measure() {
    modelEls = Array.prototype.slice.call(document.querySelectorAll('.model'));
    modelEls.forEach(function (el) {
      var r = el.getBoundingClientRect();
      el.style.setProperty('--model-x', r.left + 'px');
      el.style.setProperty('--model-y', r.top + 'px');
    });
  }
  window.addEventListener('resize', function () { measure(); layout(); });

  /* ---------------- 文案 ---------------- */
  function text(sel, v) { var n = document.querySelector(sel); if (n && v) n.textContent = v; }
  text('[data-bind="title"]', SITE.title);
  text('[data-bind="footL"]', SITE.footL);
  text('[data-bind="footR"]', SITE.footR);

  /* ---------------- 启动 ---------------- */
  setLight(px, py);
  lastMove = Date.now() - 6000;   // 开场让光先走一段

  ensureViewer().then(function (ok) {
    buildRail();
    if (ok) {
      go(0);
    } else {
      var wrap = document.querySelector('.slide .model');
      if (wrap) {
        wrap.innerHTML = '<p style="color:#8d8375;font-size:13px;letter-spacing:.2em;text-align:center;padding:40px">三维组件未能载入，请确认 model-viewer.min.js 已上传</p>';
      }
    }
    measure();
    setTimeout(measure, 900);
  });
})();
