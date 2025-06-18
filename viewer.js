/* viewer.js —— 加强版图片浏览器（ES Module，全量覆盖）*/
document.addEventListener('DOMContentLoaded', () => {
  /* -------------------------------------------------------
     1. 版别配置
  ------------------------------------------------------- */
  const editions = {
    YYP: { folder: 'images',     prefix: 'YYP', ext: '.png', key: ['頁碼', '姚校頁碼'] },
    YC : { folder: 'images_YC',  prefix: 'YC',  ext: '.jpg', key: ['續四庫頁碼']       }
  };

  /* -------------------------------------------------------
     2. 解析 URL 参数
  ------------------------------------------------------- */
  const params        = new URLSearchParams(location.search);
  let editionKey      = (params.get('ed') || 'YYP').toUpperCase();
  if (!(editionKey in editions)) editionKey = 'YYP';
  let pageNumber      = parseInt(params.get('page'), 10) || 1;
  const cfg           = editions[editionKey];

  /* -------------------------------------------------------
     3. DOM 引用
  ------------------------------------------------------- */
  const imgEl         = document.getElementById('dictionary-image');
  const cover         = document.querySelector('.reveal-cover');
  const inputEls      = document.querySelectorAll('.page-input');
  const topMsg        = document.getElementById('top-message');
  const bottomMsg     = document.getElementById('bottom-message');

  /* -------------------------------------------------------
     4. 全局页码数据
  ------------------------------------------------------- */
  let minPage   = Infinity;
  let maxPage   = -Infinity;
  const pageSet = new Set();   // 用于判定“该页是否真的存在索引记录”

  /* -------------------------------------------------------
     5. 工具函数
  ------------------------------------------------------- */
  const numberify = v => {
    const n = parseInt(String(v ?? '').replace(/[^\d]/g, ''), 10);
    return isNaN(n) ? null : n;
  };
  const showMsg  = msg => (topMsg.textContent = bottomMsg.textContent = msg);
  const clearMsg = ()  => (topMsg.textContent = bottomMsg.textContent = '');
  const setCover = pct => (cover.style.height = `${100 - pct}%`);

  /* -------------------------------------------------------
     6. 先加载 data.json，取可用页码集合
  ------------------------------------------------------- */
  fetch('data.json')
    .then(r => r.json())
    .then(data => {
      data.forEach(row => {
        cfg.key.forEach(k => {
          const n = numberify(row[k]);
          if (n !== null) {
            pageSet.add(n);
            minPage = Math.min(minPage, n);
            maxPage = Math.max(maxPage, n);
          }
        });
      });

      if (pageSet.size === 0) {
        showMsg('未检索到该版别任何页码数据');
        return;
      }

      /* 处理 URL 初始页：超范围 ⇒ 归并到首页 */
      if (!pageSet.has(pageNumber)) {
        pageNumber = [...pageSet][0];  // 最小有效页
        history.replaceState(null, '', `image.html?ed=${editionKey}&page=${pageNumber}`);
      }

      syncInputs();
      loadImage();
    })
    .catch(err => {
      console.error('data.json 加载失败：', err);
      showMsg('页码数据加载失败；仍尝试载图……');
      syncInputs();
      loadImage();  // 没有页码数据也允许手动尝试
    });

  /* -------------------------------------------------------
     7. 同步输入框值
  ------------------------------------------------------- */
  function syncInputs() {
    inputEls.forEach(el => (el.value = pageNumber));
    clearMsg();
  }

  /* -------------------------------------------------------
     8. 加载图片（含进度 & 错误提示）
  ------------------------------------------------------- */
  function loadImage() {
    const url = `${cfg.folder}/${cfg.prefix}${pageNumber}${cfg.ext}`;

    imgEl.classList.add('hidden');
    cover.style.display = 'block';
    setCover(0);        // 进度归零

    /* ---- 主动预加载（XHR）---- */
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'blob';
    xhr.timeout = 15000;               // 15 s 网络超时

    xhr.onprogress = e => {
      if (e.lengthComputable) setCover(Math.round((e.loaded / e.total) * 100));
    };

    xhr.onload = () => {
      if (xhr.status !== 200) return handleLoadError();
      const blobUrl = URL.createObjectURL(xhr.response);
      imgEl.onload  = () => {
        cover.style.display = 'none';
        imgEl.classList.remove('hidden');
      };
      imgEl.onerror = handleLoadError;   // 万一服务器 200 但实际内容坏损
      imgEl.src = blobUrl;
    };

    xhr.onerror  = handleLoadError;
    xhr.ontimeout = handleLoadError;
    xhr.send();
  }

  function handleLoadError() {
    cover.style.display = 'none';
    imgEl.classList.remove('hidden');   // 避免留白
    imgEl.src = '';                     // 清掉错误占位
    showMsg('图片加载失败，请稍后重试或检查资源是否存在。');
  }

  /* -------------------------------------------------------
     9. 跳转控制（上一页 / 下一页 / 指定页）
  ------------------------------------------------------- */
  function jumpTo(target) {
    clearMsg();

    /* ① 非数字 or NaN */
    if (isNaN(target)) { showMsg('请输入有效数字页码'); return; }

    /* ② 是否在全局最小—最大范围内？ */
    if (target < minPage || target > maxPage) {
      showMsg(`请输入 ${minPage} – ${maxPage} 之间的页码`);
      return;
    }

    /* ③ 是否真的有该页索引记录？ */
    if (!pageSet.has(target)) {
      showMsg('暂无该页图版或数据未收录');
      return;
    }

    /* ④ 正常跳转 */
    pageNumber = target;
    history.pushState(null, '', `image.html?ed=${editionKey}&page=${pageNumber}`);
    syncInputs();
    loadImage();
  }

  /* -------------------------------------------------------
     10. 绑定事件
  ------------------------------------------------------- */
  document.querySelectorAll('.prev-page')
          .forEach(btn => btn.addEventListener('click', () => jumpTo(pageNumber - 1)));

  document.querySelectorAll('.next-page')
          .forEach(btn => btn.addEventListener('click', () => jumpTo(pageNumber + 1)));

  document.querySelectorAll('.jump-btn')
          .forEach(btn => btn.addEventListener('click', () => {
            const input = btn.parentElement.querySelector('.page-input');
            jumpTo(parseInt(input.value, 10));
          }));

  inputEls.forEach(el =>
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter') jumpTo(parseInt(el.value, 10));
    })
  );

  /* -------------------------------------------------------
     11. 浏览器前进 / 后退
  ------------------------------------------------------- */
  window.addEventListener('popstate', () => {
    const ps   = new URLSearchParams(location.search);
    const pg   = parseInt(ps.get('page'), 10);
    if (!isNaN(pg)) {
      pageNumber = pg;
      syncInputs();
      loadImage();
    }
  });
});
