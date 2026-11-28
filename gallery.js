/* ============================================================
   檔案页：浮雕卡片 + 烛光跟随 + 放大查看
   ============================================================ */

(function () {
  'use strict';

  var SITE = window.SITE || {};
  var items = Array.isArray(SITE.items) ? SITE.items : [];

  var grid = document.getElementById('grid');
  var bar = document.getElementById('litAll');
  var countEl = document.getElementById('count');
  var viewer = document.getElementById('viewer');
  var viewerStage = document.getElementById('viewerStage');
  var viewerNo = document.getElementById('viewerNo');
  var viewerName = document.getElementById('viewerName');
  var viewerNote = document.getElementById('viewerNote');
  var viewerClose = document.getElementById('viewerClose');

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

  /* ---------------- 卡片 ---------------- */
  function makeViewer(src, name) {
    var mv = document.createElement('model-viewer');
    mv.setAttribute('alt', name || '浮雕');
    mv.setAttribute('camera-controls', '');
    mv.setAttribute('disable-zoom', '');
    mv.setAttribute('interaction-prompt', 'none');
    mv.setAttribute('touch-action', 'pan-y');
    mv.setAttribute('environment-image', 'neutral');
    mv.setAttribute('tone-mapping', 'neutral');
    mv.setAttribute('exposure', '1.05');
    mv.setAttribute('shadow-intensity', '0');
    mv.setAttribute('camera-orbit', '0deg 80deg auto');
    mv.setAttribute('min-field-of-view', '18deg');
    mv.setAttribute('loading', 'lazy');
    mv.setAttribute('reveal', 'auto');
    mv.setAttribute('src', src);
    return mv;
  }

  function renderCards() {
    if (!grid) return;
    grid.innerHTML = '';
    if (countEl) countEl.textContent = items.length ? String(items.length).padStart(2, '0') : '00';

    items.forEach(function (item, i) {
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'card';

      var media = document.createElement('div');
      media.className = 'card-media';

      var mv = makeViewer(item.src, item.name);
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
      card.addEventListener('click', function () { openViewer(i); });

      grid.appendChild(card);
    });
  }

  /* ---------------- 放大查看 ---------------- */
  var bigViewer = null;

  function openViewer(i) {
    var item = items[i];
    if (!item || !viewer) return;

    if (!bigViewer) {
      bigViewer = document.createElement('model-viewer');
      bigViewer.setAttribute('camera-controls', '');
      bigViewer.setAttribute('interaction-prompt', 'none');
      bigViewer.setAttribute('touch-action', 'pan-y');
      bigViewer.setAttribute('environment-image', 'neutral');
      bigViewer.setAttribute('tone-mapping', 'neutral');
      bigViewer.setAttribute('exposure', '1.1');
      bigViewer.setAttribute('shadow-intensity', '0.35');
      bigViewer.setAttribute('shadow-softness', '0.9');
      bigViewer.setAttribute('camera-orbit', '0deg 80deg auto');
      bigViewer.setAttribute('min-field-of-view', '14deg');
      viewerStage.appendChild(bigViewer);
    }

    bigViewer.setAttribute('src', item.src);
    if (viewerNo) viewerNo.textContent = item.no || '';
    if (viewerName) viewerName.textContent = item.name || '';
    if (viewerNote) viewerNote.textContent = item.note || '';

    viewer.classList.add('is-open');
    viewer.removeAttribute('hidden');
    document.body.classList.add('is-lit');
    document.body.style.overflow = 'hidden';
  }

  function closeViewer() {
    if (!viewer) return;
    viewer.classList.remove('is-open');
    document.body.classList.remove('is-lit');
    document.body.style.overflow = '';
    if (bar) {
      bar.setAttribute('aria-pressed', 'false');
      bar.textContent = '点亮全部';
    }
  }

  if (viewerClose) viewerClose.addEventListener('click', closeViewer);
  if (viewer) {
    viewer.addEventListener('click', function (e) {
      if (e.target === viewer) closeViewer();
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (viewer && viewer.classList.contains('is-open')) closeViewer();
      else setLit(false);
    }
    if (e.key === 'l' || e.key === 'L') setLit(!document.body.classList.contains('is-lit'));
  });

  /* ---------------- 全部点亮 ---------------- */
  function setLit(on) {
    document.body.classList.toggle('is-lit', on);
    if (bar) {
      bar.setAttribute('aria-pressed', on ? 'true' : 'false');
      bar.textContent = on ? '吹灭' : '点亮全部';
    }
  }

  if (bar) {
    bar.addEventListener('click', function () {
      setLit(!document.body.classList.contains('is-lit'));
    });
  }

  /* ---------------- 烛光 ---------------- */
  var tx = window.innerWidth * 0.5;
  var ty = window.innerHeight * 0.38;
  var cx = tx, cy = ty;
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
    var idle = Date.now() - lastMove > 6000;
    if (idle) {
      t += 0.0035;
      tx = window.innerWidth * (0.5 + 0.24 * Math.sin(t));
      ty = window.innerHeight * (0.46 + 0.18 * Math.sin(t * 1.6 + 1.1));
    }
    var k = idle ? 0.012 : 0.16;
    cx += (tx - cx) * k;
    cy += (ty - cy) * k;
    setLight(cx, cy);
    requestAnimationFrame(loop);
  }

  /* ---------------- 卡片光斑坐标 ---------------- */
  var mediaEls = [];
  function measure() {
    mediaEls = Array.prototype.slice.call(document.querySelectorAll('.card-media'));
    mediaEls.forEach(function (el) {
      el.style.setProperty('--card-x', el.getBoundingClientRect().left + 'px');
      el.style.setProperty('--card-y', el.getBoundingClientRect().top + 'px');
    });
  }
  window.addEventListener('resize', measure);
  window.addEventListener('scroll', measure, { passive: true });

  /* ---------------- 文案 ---------------- */
  function text(sel, v) { var n = document.querySelector(sel); if (n && v) n.textContent = v; }
  text('[data-bind="title"]', SITE.title);
  text('[data-bind="titleEn"]', SITE.titleEn);
  text('[data-bind="lead"]', SITE.lead);
  text('[data-bind="footL"]', SITE.footL);
  text('[data-bind="footR"]', SITE.footR);
  text('[data-bind="sectionTitle"]', SITE.sectionTitle);

  /* ---------------- 启动 ---------------- */
  ensureViewer().then(function (ok) {
    if (ok) {
      renderCards();
    } else if (grid) {
      grid.innerHTML = '<p style="padding:40px 0;color:#8a8073;font-size:13px;letter-spacing:.2em">三维组件未能载入，请检查 model-viewer.min.js 是否已上传</p>';
    }
    measure();
    setTimeout(measure, 800);
  });

  setLight(cx, cy);
  lastMove = Date.now() - 5500;   // 开场让光自己走一小段
  if (!reduce) requestAnimationFrame(loop);
})();
