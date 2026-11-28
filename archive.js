/* ============================================================
   檔案页逻辑：渲染卡片 + 烛光跟随
   ============================================================ */

(function () {
  'use strict';

  var SITE = window.SITE || {};
  var items = Array.isArray(SITE.archive) ? SITE.archive : [];

  var grid = document.getElementById('grid');
  var veil = document.getElementById('veil');
  var warm = document.getElementById('warm');
  var candle = document.getElementById('candle');
  var litBtn = document.getElementById('litAll');

  /* ---------------- 渲染卡片 ---------------- */
  function renderCards() {
    if (!grid) return;
    grid.innerHTML = '';
    items.forEach(function (item, i) {
      var card = document.createElement('article');
      card.className = 'card';
      card.setAttribute('role', 'listitem');

      var media = document.createElement('div');
      media.className = 'card-media';
      var img = document.createElement('img');
      img.src = item.src || ('photo-' + String(i + 1).padStart(2, '0') + '.jpg');
      img.alt = item.name || ('细部 ' + (i + 1));
      img.loading = 'lazy';
      media.appendChild(img);

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
      grid.appendChild(card);
    });
  }

  /* ---------------- 烛光跟随 ---------------- */
  var targetX = window.innerWidth * 0.5;
  var targetY = window.innerHeight * 0.42;
  var curX = targetX;
  var curY = targetY;
  var lastMove = Date.now();
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function setLight(x, y) {
    var root = document.documentElement.style;
    root.setProperty('--lx', x.toFixed(1) + 'px');
    root.setProperty('--ly', y.toFixed(1) + 'px');
  }

  window.addEventListener('pointermove', function (e) {
    targetX = e.clientX;
    targetY = e.clientY;
    lastMove = Date.now();
  }, { passive: true });

  window.addEventListener('pointerdown', function (e) {
    targetX = e.clientX;
    targetY = e.clientY;
    lastMove = Date.now();
  }, { passive: true });

  var t = 0;
  function loop() {
    // 长时间没动光标，让光自己慢慢游走，避免画面全黑
    var idle = Date.now() - lastMove > 6000;
    if (idle) {
      t += 0.004;
      targetX = window.innerWidth * (0.5 + 0.22 * Math.sin(t));
      targetY = window.innerHeight * (0.45 + 0.16 * Math.sin(t * 1.7 + 1.2));
    }
    curX += (targetX - curX) * (idle ? 0.01 : 0.14);
    curY += (targetY - curY) * (idle ? 0.01 : 0.14);
    setLight(curX, curY);
    requestAnimationFrame(loop);
  }

  /* ---------------- 卡片内的局部光斑 ---------------- */
  var cards = [];
  function measure() {
    cards = Array.prototype.slice.call(document.querySelectorAll('.card-media'));
    cards.forEach(function (el) {
      var r = el.getBoundingClientRect();
      el.style.setProperty('--card-x', r.left + 'px');
      el.style.setProperty('--card-y', r.top + 'px');
    });
  }

  window.addEventListener('resize', measure);
  window.addEventListener('scroll', measure, { passive: true });

  /* ---------------- 全部点亮 ---------------- */
  function setLit(on) {
    document.body.classList.toggle('is-lit', on);
    if (litBtn) {
      litBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      litBtn.textContent = on ? '吹灭' : '点亮全部';
    }
  }

  if (litBtn) {
    litBtn.addEventListener('click', function () {
      setLit(!document.body.classList.contains('is-lit'));
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'l' || e.key === 'L') setLit(!document.body.classList.contains('is-lit'));
    if (e.key === 'Escape') setLit(false);
  });

  /* ---------------- 文案 ---------------- */
  function text(sel, value) {
    var node = document.querySelector(sel);
    if (node && value) node.textContent = value;
  }
  text('[data-bind="archiveTitle"]', SITE.archiveTitle);
  text('[data-bind="archiveLead"]', SITE.archiveLead);
  text('[data-bind="archiveFoot"]', SITE.archiveFoot);

  /* ---------------- 启动 ---------------- */
  renderCards();
  measure();
  setLight(curX, curY);

  // 开场：光从左上角慢慢移到中间
  lastMove = Date.now() - 5500;
  if (!reduce) requestAnimationFrame(loop);

  // 图片加载完成后再量一次位置
  window.addEventListener('load', measure);
})();
