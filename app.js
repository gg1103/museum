/* ============================================================
   页面逻辑。你不需要改这个文件。
   ============================================================ */

(function () {
  'use strict';

  var SITE = window.SITE || {};
  var VIEWS = ['intro', 'object', 'statement'];

  /* ---------------- 1. 把 content.js 里的文字填进页面 ---------------- */

  function text(sel, value) {
    var node = document.querySelector(sel);
    if (node && value != null) node.textContent = value;
  }

  function pairs(sel, list) {
    var node = document.querySelector(sel);
    if (!node || !Array.isArray(list)) return;
    node.innerHTML = '';
    list.forEach(function (item) {
      var row = document.createElement('div');
      var dt = document.createElement('dt');
      var dd = document.createElement('dd');
      dt.textContent = item.k || '';
      dd.textContent = item.v || '';
      row.appendChild(dt);
      row.appendChild(dd);
      node.appendChild(row);
    });
  }

  function paragraphs(sel, list) {
    var node = document.querySelector(sel);
    if (!node || !Array.isArray(list)) return;
    node.innerHTML = '';
    list.forEach(function (p) {
      var el = document.createElement('p');
      el.textContent = p;
      node.appendChild(el);
    });
  }

  text('.mark-cn', SITE.title);
  text('.mark-en', SITE.titleEn);

  text('[data-bind="introEyebrow"]', SITE.introEyebrow);
  text('[data-bind="introTitle"]', SITE.introTitle);
  text('[data-bind="introTitleEn"]', SITE.introTitleEn);
  text('[data-bind="introLead"]', SITE.introLead);
  text('[data-bind="introAside"]', SITE.introAside);
  pairs('[data-bind="introMeta"]', SITE.introMeta);

  text('[data-bind="objectEyebrow"]', SITE.objectEyebrow);
  text('[data-bind="objectTitle"]', SITE.objectTitle);
  text('[data-bind="objectTitleEn"]', SITE.objectTitleEn);
  text('[data-bind="objectSummary"]', SITE.objectSummary);
  pairs('[data-bind="objectSpecs"]', SITE.objectSpecs);

  text('[data-bind="statementEyebrow"]', SITE.statementEyebrow);
  text('[data-bind="statementTitle"]', SITE.statementTitle);
  paragraphs('[data-bind="statementBody"]', SITE.statementBody);
  text('[data-bind="statementQuote"]', SITE.statementQuote);
  pairs('[data-bind="credits"]', SITE.credits);
  text('[data-bind="colophon"]', SITE.colophon);

  if (SITE.title) {
    document.title = SITE.title + ' — 数字展览';
    var og = document.querySelector('meta[property="og:title"]');
    if (og) og.setAttribute('content', SITE.title + ' — 数字展览');
  }

  /* ---------------- 2. 视图切换 ---------------- */

  var navItems = Array.prototype.slice.call(document.querySelectorAll('.nav-item'));
  var viewNodes = {};
  VIEWS.forEach(function (name) {
    viewNodes[name] = document.getElementById('view-' + name);
  });

  var currentView = null;

  function setView(name, opts) {
    opts = opts || {};
    if (VIEWS.indexOf(name) < 0) name = 'intro';
    if (name === currentView) return;
    currentView = name;

    VIEWS.forEach(function (key) {
      var node = viewNodes[key];
      if (!node) return;
      var active = key === name;
      node.classList.toggle('is-active', active);
      node.setAttribute('aria-hidden', active ? 'false' : 'true');
      if (active) node.scrollTop = 0;
    });

    navItems.forEach(function (item) {
      item.classList.toggle('is-active', item.getAttribute('data-view') === name);
    });

    if (opts.push !== false) {
      var hash = '#' + name;
      if (location.hash !== hash) {
        try { history.pushState({ view: name }, '', hash); }
        catch (e) { location.hash = name; }
      }
    }
  }

  navItems.forEach(function (item) {
    item.addEventListener('click', function (e) {
      e.preventDefault();
      setView(item.getAttribute('data-view'));
    });
  });

  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    if (a.classList.contains('nav-item')) return;
    var target = a.getAttribute('href').slice(1);
    if (VIEWS.indexOf(target) < 0) return;
    a.addEventListener('click', function (e) {
      e.preventDefault();
      setView(target);
    });
  });

  window.addEventListener('popstate', function (e) {
    var name = (e.state && e.state.view) || location.hash.replace('#', '');
    setView(name, { push: false });
  });

  window.addEventListener('hashchange', function () {
    setView(location.hash.replace('#', ''), { push: false });
  });

  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    var idx = VIEWS.indexOf(currentView);
    if (e.key === 'ArrowRight') { setView(VIEWS[(idx + 1) % VIEWS.length]); }
    else if (e.key === 'ArrowLeft') { setView(VIEWS[(idx - 1 + VIEWS.length) % VIEWS.length]); }
    else if (e.key === '1') { setView('intro'); }
    else if (e.key === '2') { setView('object'); }
    else if (e.key === '3') { setView('statement'); }
    else if (e.key === 'Escape') { setView('intro'); }
  });

  /* 初始视图：优先看 ?v=xxx（用于截图/分享），其次 #xxx */
  var params = new URLSearchParams(location.search);
  var initial = params.get('v') || location.hash.replace('#', '') || 'intro';
  setView(initial, { push: false });
  try { history.replaceState({ view: currentView }, '', '#' + currentView); } catch (e) {}

  /* ---------------- 3. 三维查看器 ---------------- */

  var mv = document.getElementById('mv');
  var overlay = document.getElementById('stageOverlay');
  var overlayMsg = document.getElementById('stageMsg');
  var bar = document.getElementById('stageBar');
  var barFill = document.getElementById('stageBarFill');
  var baseMsg = '正在载入三维模型';

  function showOverlay(msg) {
    if (!overlay) return;
    overlay.classList.remove('is-hidden');
    if (overlayMsg && msg) {
      overlayMsg.textContent = msg;
      baseMsg = msg;
    }
  }

  function hideOverlay() {
    if (overlay) overlay.classList.add('is-hidden');
  }

  function setProgress(p) {
    if (barFill) barFill.style.width = Math.max(0, Math.min(1, p)) * 100 + '%';
    if (overlayMsg) {
      var pct = Math.round(Math.max(0, Math.min(1, p)) * 100);
      overlayMsg.textContent = pct > 0 ? baseMsg + ' · ' + pct + '%' : baseMsg;
    }
  }

  function resetProgress() {
    if (bar) bar.hidden = false;
    setProgress(0);
  }

  function loadScript(url, asModule) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = url;
      s.async = true;
      // model-viewer 3.x 起是 ES 模块，必须声明 type="module"，否则会静默解析失败
      if (asModule) s.type = 'module';
      s.onload = function () { resolve(url); };
      s.onerror = function () { reject(new Error('script failed: ' + url)); };
      document.head.appendChild(s);
    });
  }

  // 同一个地址先用模块方式加载，不行再用普通脚本方式，两种都试过才算失败
  async function tryUrl(url, budget) {
    var modes = [true, false];
    for (var m = 0; m < modes.length; m++) {
      try { await withTimeout(loadScript(url, modes[m]), budget); } catch (e) { continue; }
      try { await withTimeout(customElements.whenDefined('model-viewer'), 5000); return true; } catch (e) {}
    }
    return false;
  }

  function withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise(function (_, reject) { setTimeout(function () { reject(new Error('timeout')); }, ms); })
    ]);
  }

  // 本地文件优先（离线也能用，放一个 model-viewer.min.js 到网站根目录即可）
  var LOCAL_SOURCES = [
    'model-viewer.min.js',
    'assets/model-viewer.min.js'
  ];

  // 远程镜像按顺序试，每个给足时间。慢网下同时下载多个大文件会互相抢带宽，反而更慢
  var REMOTE_SOURCES = [
    'https://cdn.bootcdn.net/ajax/libs/model-viewer/4.4.0/model-viewer.min.js',
    'https://lib.baomitu.com/model-viewer/4.4.0/model-viewer.min.js',
    'https://cdn.staticfile.net/model-viewer/4.4.0/model-viewer.min.js',
    'https://cdn.jsdmirror.com/npm/@google/model-viewer/dist/model-viewer.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/model-viewer/4.4.0/model-viewer.min.js',
    'https://cdn.jsdelivr.net/npm/@google/model-viewer/dist/model-viewer.min.js',
    'https://ajax.googleapis.com/ajax/libs/model-viewer/4.4.0/model-viewer.min.js'
  ];

  function isReady() {
    return !!(window.customElements && customElements.get('model-viewer'));
  }

  async function ensureViewer() {
    if (isReady()) return true;

    // 1) 本地文件，命中时几乎瞬间完成
    for (var i = 0; i < LOCAL_SOURCES.length; i++) {
      showOverlay('正在载入三维组件');
      if (await tryUrl(LOCAL_SOURCES[i], 3000)) return true;
    }

    // 2) 远程镜像依次尝试，界面显示进度，避免看起来像卡死
    for (var j = 0; j < REMOTE_SOURCES.length; j++) {
      showOverlay('正在载入三维组件 · 第 ' + (j + 1) + ' / ' + REMOTE_SOURCES.length + ' 个来源');
      if (await tryUrl(REMOTE_SOURCES[j], 15000)) return true;
    }

    return false;
  }

  var CAMS = ['28deg 76deg auto', '104deg 74deg auto', '16deg 18deg auto'];
  var hasFallenBack = false;
  var pendingCameraReset = false;

  /* ---------------- 多模型切换 ---------------- */

  var MODELS = (Array.isArray(SITE.models) && SITE.models.length) ? SITE.models.slice() : [];
  var currentModel = -1;
  var modelListEl = document.getElementById('modelList');
  var modelCaptionEl = document.getElementById('modelCaption');
  var stageNameEl = document.getElementById('stageModelName');
  var stageEnEl = document.getElementById('stageModelEn');
  var ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

  function buildModelList() {
    if (!modelListEl) return;
    modelListEl.innerHTML = '';
    MODELS.forEach(function (m, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'model-item' + (i === 0 ? ' is-on' : '');
      b.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');

      var n = document.createElement('i');
      n.textContent = ROMAN[i] || String(i + 1);
      var s = document.createElement('span');
      s.textContent = m.name || ('模型 ' + (i + 1));

      b.appendChild(n);
      b.appendChild(s);
      b.addEventListener('click', function () { selectModel(i); });
      modelListEl.appendChild(b);
    });

    // 即使 3D 组件没加载成功，也让文字信息先显示出来
    var first = MODELS[0];
    if (first) {
      if (stageNameEl) stageNameEl.textContent = first.name || '';
      if (stageEnEl) stageEnEl.textContent = first.en || '';
      if (modelCaptionEl) modelCaptionEl.textContent = first.caption || '';
    }
  }

  function selectModel(i, silent) {
    if (i < 0 || i >= MODELS.length || i === currentModel) return;
    currentModel = i;
    hasFallenBack = false;

    var m = MODELS[i];
    if (stageNameEl) stageNameEl.textContent = m.name || '';
    if (stageEnEl) stageEnEl.textContent = m.en || '';
    if (modelCaptionEl) modelCaptionEl.textContent = m.caption || '';

    if (modelListEl) {
      var items = modelListEl.querySelectorAll('.model-item');
      for (var k = 0; k < items.length; k++) {
        items[k].classList.toggle('is-on', k === i);
        items[k].setAttribute('aria-pressed', k === i ? 'true' : 'false');
      }
    }

    if (!silent) {
      mv.setAttribute('camera-orbit', CAMS[0]);
      pendingCameraReset = true;
      mv.setAttribute('auto-rotate', '');
      var rot = document.getElementById('toggleRotate');
      if (rot) { rot.classList.add('is-on'); rot.setAttribute('aria-pressed', 'true'); }
      var cams = document.querySelectorAll('.cam');
      for (var c = 0; c < cams.length; c++) cams[c].classList.toggle('is-on', c === 0);
    }

    showOverlay('正在载入 ' + (m.name || '模型'));
    resetProgress();
    mv.src = m.src;
  }

  function setupViewer() {
    if (!mv) return;

    // 直接双击 index.html 打开时（file://），浏览器会拦截模型文件
    if (location.protocol === 'file:') {
      showOverlay('双击打开时浏览器会拦截模型文件。请把整个文件夹上传到网站，或用本地服务打开。');
      return;
    }

    if (MODELS.length) {
      selectModel(0, true);
    } else {
      showOverlay('尚未配置模型');
    }

    // 主题色：让模型的背景与页面一致
    mv.style.setProperty('--poster-color', 'transparent');

    var arBtn = mv.querySelector('[slot="ar-button"]');
    function syncAr() {
      if (!arBtn) return;
      arBtn.classList.toggle('is-visible', !!mv.canActivateAR);
    }

    mv.addEventListener('progress', function (event) {
      var p = (event && event.detail && typeof event.detail.totalProgress === 'number')
        ? event.detail.totalProgress : 0;
      setProgress(p);
    });

    mv.addEventListener('load', function () {
      if (pendingCameraReset) {
        mv.setAttribute('camera-orbit', CAMS[0]);
        pendingCameraReset = false;
      }
      setProgress(1);
      hideOverlay();
      syncAr();
      setTimeout(syncAr, 1500);   // canActivateAR 有时要等检测完成
    });

    mv.addEventListener('ar-status', syncAr);

    mv.addEventListener('error', function (event) {
      var type = event && event.detail && event.detail.type;
      if (!hasFallenBack && type === 'loadfailure') {
        hasFallenBack = true;
        showOverlay('未找到该模型，先显示占位模型');
        mv.src = (SITE.model && SITE.model.fallback) || 'placeholder.gltf';
        return;
      }
      showOverlay('模型载入失败 · 请确认 assets 里的文件可访问');
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = '重新载入';
      btn.className = 'stage-retry';
      btn.addEventListener('click', function () { location.reload(); });
      overlay.appendChild(btn);
    });

    // 视角切换
    var cams = Array.prototype.slice.call(document.querySelectorAll('.cam'));
    cams.forEach(function (btn, index) {
      btn.addEventListener('click', function () {
        mv.setAttribute('camera-orbit', CAMS[index] || CAMS[0]);
        mv.removeAttribute('auto-rotate');   // 手动选择视角后停止自动旋转
        var rot = document.getElementById('toggleRotate');
        if (rot) { rot.classList.remove('is-on'); rot.setAttribute('aria-pressed', 'false'); }
        cams.forEach(function (b) { b.classList.remove('is-on'); });
        btn.classList.add('is-on');
      });
    });

    // 自动旋转
    var rotBtn = document.getElementById('toggleRotate');
    if (rotBtn) {
      rotBtn.addEventListener('click', function () {
        var on = !rotBtn.classList.contains('is-on');
        rotBtn.classList.toggle('is-on', on);
        rotBtn.setAttribute('aria-pressed', String(on));
        if (on) mv.setAttribute('auto-rotate', '');
        else mv.removeAttribute('auto-rotate');
      });
    }

    // 投影（地面阴影）
    var shBtn = document.getElementById('toggleShadow');
    if (shBtn) {
      shBtn.addEventListener('click', function () {
        var on = !shBtn.classList.contains('is-on');
        shBtn.classList.toggle('is-on', on);
        shBtn.setAttribute('aria-pressed', String(on));
        mv.setAttribute('shadow-intensity', on ? '0.75' : '0');
      });
    }

    // 隐藏的调试入口：?dev=1 时可以临时载入本机模型试看
    if (new URLSearchParams(location.search).get('dev') === '1') {
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = '.glb,.gltf';
      input.style.display = 'none';
      document.body.appendChild(input);

      var devBtn = document.createElement('button');
      devBtn.type = 'button';
      devBtn.className = 'tog is-on';
      devBtn.textContent = '载入本机模型';
      var toggles = document.querySelector('.toggles');
      if (toggles) toggles.appendChild(devBtn);
      devBtn.addEventListener('click', function () { input.click(); });
      input.addEventListener('change', function () {
        var file = input.files && input.files[0];
        if (!file) return;
        mv.src = URL.createObjectURL(file);
        showOverlay('正在载入 ' + file.name);
      });
    }

    // 关闭交互提示气泡，保持画面干净
    var prompt = mv.querySelector('[slot="interaction-prompt"]');
    if (prompt) prompt.remove();
    mv.setAttribute('interaction-prompt', 'none');
  }

  ensureViewer().then(function (ok) {
    buildModelList();
    if (ok) {
      setupViewer();
    } else {
      showOverlay('3D 组件下载失败 · 请把 model-viewer.min.js 放进网站根目录，或换网络后刷新');
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = '重新载入';
      btn.className = 'stage-retry';
      btn.addEventListener('click', function () { location.reload(); });
      if (overlay) overlay.appendChild(btn);
    }
  });
})();
