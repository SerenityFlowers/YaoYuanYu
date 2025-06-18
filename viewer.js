/* viewer.js — 2025-06-18 final merge */

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
  const qs         = new URLSearchParams(location.search);
  let editionKey   = (qs.get('ed') || 'YYP').toUpperCase();
  if (!(editionKey in editions)) editionKey = 'YYP';
  let pageNumber   = parseInt(qs.get('page'), 10) || 1;
  const cfg        = editions[editionKey];

  /* --------------------------------------------------
     3. DOM
  -------------------------------------------------- */
  const imgEl      = document.getElementById('dictionary-image');
  const cover      = document.querySelector('.reveal-cover');
  const topMsg     = document.getElementById('top-message');
  const botMsg     = document.getElementById('bottom-message');
  const inputEls   = document.querySelectorAll('.page-input');

  /* --------------------------------------------------
     4. 全局集合與範圍
        pageSet   : 來自 data.json（索引行）
        imgSet    : 來自 _index.json（圖片真實存在）
        minPage/maxPage     : pageSet 的範圍
        minImg/maxImg       : imgSet  的範圍
  -------------------------------------------------- */
  const pageSet = new Set();
  const imgSet  = new Set();
  let minPage   = Infinity, maxPage = -Infinity;
  let minImg    = Infinity, maxImg  = -Infinity;

  /* -------- 4-1 讀 data.json（索引用） -------- */
  fetch('data.json')
    .then(r => r.json())
    .then(rows => {
      rows.forEach(row => {
        cfg.key.forEach(k => {
          const n = parseInt((row[k] || '').toString().replace(/[^\d]/g, ''), 10);
          if (!isNaN(n)) {
            pageSet.add(n);
            if (n < minPage) minPage = n;
            if (n > maxPage) maxPage = n;
          }
        });
      });
    })
    .catch(() => { /* 索引缺失可容忍 */ });

  /* -------- 4-2 讀 _index.json（可選） -------- */
  fetch(`${cfg.folder}/_index.json`)
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(arr => {
      arr.forEach(n => {
        imgSet.add(n);
        if (n < minImg) minImg = n;
        if (n > maxImg) maxImg = n;
      });
    })
    .catch(() => { /* 沒有 _index.json 就動態探測 */ })
    .finally(() => {
      syncInputs();
      loadImage();
    });

  /* --------------------------------------------------
     5. 公用工具
  -------------------------------------------------- */
  const showMsg  = t => (topMsg.textContent = botMsg.textContent = t);
  const clearMsg = () => (topMsg.textContent = botMsg.textContent = '');
  const setCover = pct => (cover.style.height = `${100 - pct}%`);

  function syncInputs() {
    inputEls.forEach(i => (i.value = pageNumber));
    clearMsg();
    if (pageSet.size && !pageSet.has(pageNumber)) {
      topMsg.textContent = botMsg.textContent = '（提示：索引中未收錄此頁）';
    }
  }

  /* --------------------------------------------------
     6. 圖片存在探測（帶快取）
  -------------------------------------------------- */
  const existsCache = new Map(); /* page → true/false */
  function imageExists(p) {
    /* 若有 _index.json，直接判定 */
    if (imgSet.size) {
      return Promise.resolve(imgSet.has(p));
    }

    /* 動態探測（一次快取） */
    if (existsCache.has(p)) return Promise.resolve(existsCache.get(p));
    return new Promise(resolve => {
      const probe = new Image();
      probe.onload  = () => { existsCache.set(p, true);  resolve(true);  };
      probe.onerror = () => { existsCache.set(p, false); resolve(false); };
      probe.src = `${cfg.folder}/${cfg.prefix}${p}${cfg.ext}?_=${Date.now()}`;
    });
  }

  /* --------------------------------------------------
     7. 圖片加載
  -------------------------------------------------- */
  function loadImage() {
    const url = `${cfg.folder}/${cfg.prefix}${pageNumber}${cfg.ext}`;

    imgEl.classList.add('hidden');
    cover.style.display = 'block'; setCover(0);

    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'blob';
    xhr.timeout = 15000;

    xhr.onprogress = e => { if (e.lengthComputable) setCover((e.loaded / e.total) * 100); };

    xhr.onload = () => {
      if (xhr.status !== 200) return handleError();
      const blobURL = URL.createObjectURL(xhr.response);
      imgEl.onload  = () => { cover.style.display = 'none'; imgEl.classList.remove('hidden'); };
      imgEl.onerror = handleError;
      imgEl.src     = blobURL;
    };
    xhr.onerror = xhr.ontimeout = handleError;
    xhr.send();
  }
  function handleError() {
    cover.style.display = 'none';
    imgEl.classList.remove('hidden');
    imgEl.src = '';
    showMsg('圖片載入失敗：檔案不存在或網路異常');
  }

  /* --------------------------------------------------
     8. 翻頁 / 跳轉（完整提示 + 圖片存在）
  -------------------------------------------------- */
  function jumpTo(target) {
    clearMsg();
    target = parseInt(target, 10);

    /* ① 合法數字? */
    if (isNaN(target) || target < 1) {
      showMsg('請輸入正整數頁碼');
      return;
    }

    /* ② 範圍提示（優先圖片清單，否則索引） */
    const haveImgRange = imgSet.size && isFinite(minImg) && isFinite(maxImg);
    const haveIdxRange = pageSet.size && isFinite(minPage) && isFinite(maxPage);

    if (haveImgRange && (target < minImg || target > maxImg)) {
      showMsg(`請輸入 ${minImg} – ${maxImg} 之間的頁碼`);
      return;
    }
    if (!haveImgRange && haveIdxRange && (target < minPage || target > maxPage)) {
      showMsg(`請輸入 ${minPage} – ${maxPage} 之間的頁碼`);
      return;
    }

    /* ③ 是否在索引中？若否，只做輕提示，不阻止 */
    if (pageSet.size && !pageSet.has(target)) {
      topMsg.textContent = botMsg.textContent = '（提示：索引未收錄此頁，僅嘗試載圖）';
    }

    /* ④ 圖片是否真的存在？ */
    imageExists(target).then(ok => {
      if (!ok) {
        showMsg('未找到對應圖檔，請檢查頁碼或稍後再試');
        return;
      }
      pageNumber = target;
      history.pushState(null, '', `image.html?ed=${editionKey}&page=${pageNumber}`);
      syncInputs();
      loadImage();
    });
  }

  /* --------------------------------------------------
     9. 事件綁定
  -------------------------------------------------- */
  /* 上一頁 / 下一頁 */
  document.querySelectorAll('.prev-page')
          .forEach(btn => btn.addEventListener('click', () => jumpTo(pageNumber - 1)));
  document.querySelectorAll('.next-page')
          .forEach(btn => btn.addEventListener('click', () => jumpTo(pageNumber + 1)));

  /* 跳轉按鈕 */
  document.querySelectorAll('.jump-btn')
          .forEach(btn => btn.addEventListener('click', () => {
            const inp = btn.parentElement.querySelector('.page-input');
            jumpTo(inp.value);
          }));
  inputEls.forEach(inp =>
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') jumpTo(inp.value); })
  );

  /* 瀏覽器前進 / 後退 */
  window.addEventListener('popstate', () => {
    const p = parseInt(new URLSearchParams(location.search).get('page'), 10);
    if (!isNaN(p)) {
      pageNumber = p;
      syncInputs();
      loadImage();
    }
  });
});
