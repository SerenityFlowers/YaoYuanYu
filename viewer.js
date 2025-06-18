/* viewer.js — 2025-06-18 final-plus ⸺
   ◉ 保留全部舊功能（範圍提示 / 索引缺頁提示 / popstate / 進度條覆蓋）
   ◉ 取消 15 s 超時限制（不再設置 xhr.timeout，也不再監聽 ontimeout）
   ◉ 新增「圓環進度條」(SVG ring) 實時顯示載入百分比
*/

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

  /* === 3-1 生成圓環進度條 (SVG) === */
  const ringWrap = document.createElement('div');
  ringWrap.style.cssText =
    'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);' +
    'width:100px;height:100px;display:none;pointer-events:none;';
  ringWrap.innerHTML = `
    <svg width="100" height="100">
      <circle cx="50" cy="50" r="45" stroke="#e6e6e6" stroke-width="8" fill="none"></circle>
      <circle id="ring-core" cx="50" cy="50" r="45"
              stroke="var(--primary)" stroke-width="8" fill="none"
              stroke-linecap="round"
              transform="rotate(-90 50 50)"></circle>
      <text  id="ring-text" x="50" y="55" text-anchor="middle"
             dominant-baseline="middle" font-size="18"
             fill="var(--text-main)">0%</text>
    </svg>`;
  cover.appendChild(ringWrap);
  const ringCore = ringWrap.querySelector('#ring-core');
  const ringTxt  = ringWrap.querySelector('#ring-text');
  const CIRCUM   = 2 * Math.PI * 45;
  ringCore.style.strokeDasharray = `${CIRCUM} ${CIRCUM}`;
  ringCore.style.strokeDashoffset = CIRCUM;
  const setRing = p => {
    ringCore.style.strokeDashoffset = CIRCUM - p / 100 * CIRCUM;
    ringTxt.textContent = `${p}%`;
  };

  /* --------------------------------------------------
     4. 全局集合與範圍
  -------------------------------------------------- */
  const pageSet = new Set();
  const imgSet  = new Set();
  let minPage   = Infinity, maxPage = -Infinity;
  let minImg    = Infinity, maxImg  = -Infinity;

  /* 4-1 data.json */
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
    });

  /* 4-2 _index.json (可選) */
  fetch(`${cfg.folder}/_index.json`)
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(arr => {
      arr.forEach(n => {
        imgSet.add(n);
        if (n < minImg) minImg = n;
        if (n > maxImg) maxImg = n;
      });
    })
    .catch(() => { /* 無清單時稍後使用探測 */ })
    .finally(() => {
      syncInputs();
      loadImage();
    });

  /* --------------------------------------------------
     5. 工具
  -------------------------------------------------- */
  const showMsg  = t => (topMsg.textContent = botMsg.textContent = t);
  const clearMsg = () => (topMsg.textContent = botMsg.textContent = '');
  const setCover = h => (cover.style.height = `${100 - h}%`);

  function syncInputs() {
    inputEls.forEach(i => (i.value = pageNumber));
    clearMsg();
    if (pageSet.size && !pageSet.has(pageNumber)) {
      topMsg.textContent = botMsg.textContent = '（提示：索引未收錄此頁）';
    }
  }

  /* 5-1 圖片存在探測 */
  const existsCache = new Map();
  function imageExists(p) {
    if (imgSet.size) return Promise.resolve(imgSet.has(p));
    if (existsCache.has(p)) return Promise.resolve(existsCache.get(p));
    return new Promise(res => {
      const img = new Image();
      img.onload  = () => { existsCache.set(p, true);  res(true);  };
      img.onerror = () => { existsCache.set(p, false); res(false); };
      img.src = `${cfg.folder}/${cfg.prefix}${p}${cfg.ext}?_=${Date.now()}`;
    });
  }

  /* --------------------------------------------------
     6. 圖片加載邏輯
  -------------------------------------------------- */
  function loadImage() {
    const url = `${cfg.folder}/${cfg.prefix}${pageNumber}${cfg.ext}`;
    imgEl.classList.add('hidden');
    cover.style.display = 'block';
    ringWrap.style.display = 'block';
    setRing(0);          // 0 %
    setCover(0);         // 條狀覆蓋也同步

    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'blob';  // 不設置 timeout → 無時限

    xhr.onprogress = e => {
      let pct = 0;
      if (e.lengthComputable) pct = Math.round((e.loaded / e.total) * 100);
      // 更新兩種進度視覺
      setRing(pct);
      setCover(pct);
    };

    xhr.onload = () => {
      if (xhr.status !== 200) return handleError();
      const blobURL = URL.createObjectURL(xhr.response);
      imgEl.onload  = () => {
        cover.style.display = 'none';
        ringWrap.style.display = 'none';
        imgEl.classList.remove('hidden');
      };
      imgEl.onerror = handleError;
      imgEl.src     = blobURL;
    };

    xhr.onerror = handleError;
    xhr.send();
  }
  function handleError() {
    cover.style.display = 'none';
    ringWrap.style.display = 'none';
    imgEl.classList.remove('hidden');
    imgEl.src = '';
    showMsg('圖片載入失敗：檔案不存在或網路異常');
  }

  /* --------------------------------------------------
     7. 翻頁 / 跳轉（完整提示）
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

    if (pageSet.size && !pageSet.has(target)) {
      topMsg.textContent = botMsg.textContent = '（提示：索引未收錄此頁，僅嘗試載圖）';
    }

    imageExists(target).then(ok => {
      if (!ok) { showMsg('未找到對應圖檔，請檢查頁碼'); return; }
      pageNumber = target;
      history.pushState(null, '', `image.html?ed=${editionKey}&page=${pageNumber}`);
      syncInputs();
      loadImage();
    });
  }

  /* --------------------------------------------------
     8. 事件綁定
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
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') jumpTo(inp.value); })
  );

  /* popstate */
  window.addEventListener('popstate', () => {
    const p = parseInt(new URLSearchParams(location.search).get('page'), 10);
    if (!isNaN(p)) { pageNumber = p; syncInputs(); loadImage(); }
  });
});
