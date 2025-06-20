/* viewer.js — 2025-06-20 dynamic-nav-width 版 */

document.addEventListener('DOMContentLoaded', () => {
  /* --------------------------------------------------
     1. 版別設定
  -------------------------------------------------- */
  const editions = {
    YYP: { folder: 'images',     prefix: 'YYP', ext: '.png', key: ['頁碼', '姚校頁碼'] },
    YC : { folder: 'images_YC',  prefix: 'YC',  ext: '.jpg', key: ['續四庫頁碼']       }
  };

  /* --------------------------------------------------
     2. URL 參數
  -------------------------------------------------- */
  const qs       = new URLSearchParams(location.search);
  let editionKey = (qs.get('ed') || 'YYP').toUpperCase();
  if (!(editionKey in editions)) editionKey = 'YYP';
  let pageNumber = parseInt(qs.get('page'), 10) || 1;
  const cfg      = editions[editionKey];

  /* --------------------------------------------------
     3. DOM
  -------------------------------------------------- */
  const imgEl    = document.getElementById('dictionary-image');
  const cover    = document.querySelector('.reveal-cover');
  const topMsg   = document.getElementById('top-message');
  const botMsg   = document.getElementById('bottom-message');
  const inputEls = document.querySelectorAll('.page-input');

  /* === 新增：兩條導航條節點 === */
  const navEls   = document.querySelectorAll('.navigation-container');

  /* --- 動態建立進度文字元素（覆蓋中央顯示） --- */
  const progText = document.createElement('div');
  progText.id    = 'progress-text';
  Object.assign(progText.style, {
    position: 'absolute',
    top: '50%', left: '50%',
    transform: 'translate(-50%, -50%)',
    fontSize: '1.1rem',
    color: 'var(--text-main, #333)',
    pointerEvents: 'none',
    opacity: 0.9
  });
  if (cover) {                     // 防御：确保结点存在
    cover.style.position = 'relative';
    cover.appendChild(progText);
  }

  /* === 讓導航寬度隨圖片同步的工具 === */
  function syncNavWidth() {
    /* clientWidth 在圖片可見時返回渲染寬度；fallback 到 naturalWidth */
    const w = imgEl.clientWidth || imgEl.naturalWidth || 0;
    if (w) navEls.forEach(n => n.style.width = w + 'px');
  }
  window.addEventListener('resize', syncNavWidth);

  /* --------------------------------------------------
     4. 全局集合與範圍
  -------------------------------------------------- */
  const pageSet = new Set(), imgSet = new Set();
  let minPage = Infinity, maxPage = -Infinity;
  let minImg  = Infinity, maxImg  = -Infinity;

  /* --- 4-1 data.json --- */
  fetch('data.json')
    .then(r => r.json())
    .then(rows => {
      rows.forEach(row => {
        editions[editionKey].key.forEach(k => {
          const n = parseInt((row[k] || '').toString().replace(/[^\d]/g, ''), 10);
          if (!isNaN(n)) {
            pageSet.add(n);
            if (n < minPage) minPage = n;
            if (n > maxPage) maxPage = n;
          }
        });
      });
    }).catch(()=>{});

  /* --- 4-2 _index.json (optional) --- */
  fetch(`${cfg.folder}/_index.json`)
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(arr => {
      arr.forEach(n => {
        imgSet.add(n);
        if (n < minImg) minImg = n;
        if (n > maxImg) maxImg = n;
      });
    }).catch(()=>{})
    .finally(() => { syncInputs(); loadImage(); });

  /* --------------------------------------------------
     5. 工具
  -------------------------------------------------- */
  const showMsg  = t => (topMsg.textContent = botMsg.textContent = t);
  const clearMsg = () => (topMsg.textContent = botMsg.textContent = '');
  function setCover(pct) {
    if (!cover) return;
    cover.style.height = `${100 - pct}%`;
    progText.textContent = `加載中… ${pct}%`;
  }
  function syncInputs() {
    inputEls.forEach(i => (i.value = pageNumber));
    clearMsg();
    if (pageSet.size && !pageSet.has(pageNumber))
      topMsg.textContent = botMsg.textContent = '（提示：索引未收錄此頁）';
  }

  /* --------------------------------------------------
     6. 圖片存在檢測（快取）
  -------------------------------------------------- */
  const existsCache = new Map();
  function imageExists(p) {
    if (imgSet.size) return Promise.resolve(imgSet.has(p));
    if (existsCache.has(p)) return Promise.resolve(existsCache.get(p));
    return new Promise(res => {
      const probe = new Image();
      probe.onload  = () => { existsCache.set(p, true);  res(true);  };
      probe.onerror = () => { existsCache.set(p, false); res(false); };
      probe.src = `${cfg.folder}/${cfg.prefix}${p}${cfg.ext}?_=${Date.now()}`;
    });
  }

  /* --------------------------------------------------
     7. 加載圖片（不設網路超時）
  -------------------------------------------------- */
  function loadImage() {
    const url = `${cfg.folder}/${cfg.prefix}${pageNumber}${cfg.ext}`;
    imgEl.classList.add('hidden');
    if (cover) cover.style.display = 'block';
    progText.style.display = 'block';
    setCover(0);

    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'blob';

    xhr.onprogress = e => {
      if (e.lengthComputable) setCover(Math.min(100, Math.round(e.loaded / e.total * 100)));
    };

    xhr.onload = () => {
      if (xhr.status !== 200) return handleError();
      const blobURL = URL.createObjectURL(xhr.response);
      imgEl.onload  = () => {
        if (cover) cover.style.display = 'none';
        progText.style.display = 'none';
        imgEl.classList.remove('hidden');
        syncNavWidth();                  // ★ 圖片載入完成立即同步導航寬度
      };
      imgEl.onerror = handleError;
      imgEl.src     = blobURL;
    };
    xhr.onerror = handleError;
    xhr.send();
  }
  function handleError() {
    if (cover) cover.style.display = 'none';
    progText.style.display = 'none';
    imgEl.classList.remove('hidden'); imgEl.src = '';
    showMsg('圖片載入失敗：檔案不存在或網路異常');
  }

  /* --------------------------------------------------
     8. 翻頁 / 跳轉
  -------------------------------------------------- */
  function jumpTo(target) {
    clearMsg();
    target = parseInt(target, 10);
    if (isNaN(target) || target < 1) { showMsg('請輸入正整數頁碼'); return; }

    const haveImgRange = imgSet.size && isFinite(minImg) && isFinite(maxImg);
    const haveIdxRange = pageSet.size && isFinite(minPage) && isFinite(maxPage);

    if (haveImgRange && (target < minImg || target > maxImg)) {
      showMsg(`請輸入 ${minImg} – ${maxImg} 之間的頁碼`); return;
    }
    if (!haveImgRange && haveIdxRange && (target < minPage || target > maxPage)) {
      showMsg(`請輸入 ${minPage} – ${maxPage} 之間的頁碼`); return;
    }

    if (pageSet.size && !pageSet.has(target))
      topMsg.textContent = botMsg.textContent = '（提示：索引未收錄此頁，僅嘗試載圖）';

    imageExists(target).then(ok => {
      if (!ok) { showMsg('未找到對應圖檔，請檢查頁碼或稍後再試'); return; }
      pageNumber = target;
      history.pushState(null, '', `image.html?ed=${editionKey}&page=${pageNumber}`);
      syncInputs();
      loadImage();
    });
  }

  /* --------------------------------------------------
     9. 事件綁定
  -------------------------------------------------- */
  document.querySelectorAll('.prev-page')
          .forEach(btn => btn.addEventListener('click', () => jumpTo(pageNumber - 1)));
  document.querySelectorAll('.next-page')
          .forEach(btn => btn.addEventListener('click', () => jumpTo(pageNumber + 1)));
  document.querySelectorAll('.jump-btn')
          .forEach(btn => btn.addEventListener('click', () => {
            const inp = btn.parentElement.querySelector('.page-input');
            jumpTo(inp.value);
          }));
  inputEls.forEach(inp =>
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') jumpTo(inp.value); }));

  window.addEventListener('popstate', () => {
    const p = parseInt(new URLSearchParams(location.search).get('page'), 10);
    if (!isNaN(p)) { pageNumber = p; syncInputs(); loadImage(); }
  });

  /* --- 首次進入先估算一次導航寬度 --- */
  syncNavWidth();
});
