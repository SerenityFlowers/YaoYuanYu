/* search.js —— 索引 / 搜索 + 文字詳解双数据源 */
document.addEventListener('DOMContentLoaded', () => {
  /* ===== 节点 ===== */
  const $ = id => document.getElementById(id);
  const input      = $('search-input');
  const searchBtn  = $('search-btn');
  const showAllChk = $('show-all');
  const introText  = $('intro-text');  // ← 新增：说明文字节点

  // 第一张表
  const table1  = $('dictionary-table');
  const thead1  = $('dictionary-head');
  const tbody1  = $('dictionary-body');
  const count1  = $('result-count');

  // 第二张表
  const table2  = $('text-table');
  const thead2  = $('text-head');
  const tbody2  = $('text-body');
  const count2  = $('text-count');

  /* ===== 数据 ===== */
  let pageData  = [];   // data.json
  let textData  = [];   // data_text.json
  let cols1     = [];
  let cols2     = [];

  // 頁碼字段 → 版别代号
  const pageKeys = {
    '頁碼'       : 'YYP',
    '姚校頁碼'   : 'YYP',
    '續四庫頁碼' : 'YC'
  };

  /* ===== 一次性加载两个 JSON ===== */
  Promise.all([
    fetch('data.json').then(r => r.json()),
    fetch('data_text.json').then(r => r.json()).catch(() => [])   // 若暂未放置也不报错
  ])
    .then(([d1, d2]) => {
      pageData = d1 || [];
      textData = d2 || [];

      /* ===== 动态列 ===== */
      cols1 = collectColumns(pageData, ['字頭', '字', '姚校頁碼', '續四庫頁碼', '頁碼']);
      cols2 = collectColumns(textData, ['字頭', '部首', '認同爲', '注文']);

      buildHead(thead1, cols1);
      buildHead(thead2, cols2);

      if (showAllChk.checked) renderTable1(pageData);   // 初次可显示全部
    })
    .catch(err => {
      console.error('数据加载失败：', err);
      count1.textContent = '數據加载失敗。';
    });

  /* ===== 工具 ===== */
  function collectColumns(arr, priority = []) {
    const set = new Set();
    arr.forEach(o => Object.keys(o).forEach(k => k.trim() && set.add(k.trim())));
    return [...set].sort((a, b) => {
      const ia = priority.indexOf(a), ib = priority.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b, 'zh');
      if (ia === -1) return  1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }

  function buildHead(thead, cols) {
    thead.innerHTML = '';
    const tr = document.createElement('tr');
    cols.forEach(c => {
      const th = document.createElement('th');
      th.textContent = c;
      tr.appendChild(th);
    });
    thead.appendChild(tr);
  }

  /* ------ 渲染行（通用） ------ */
  function renderRows(tbody, cols, rows, isPageTable = false) {
    tbody.innerHTML = '';
    rows.forEach(obj => {
      const tr = document.createElement('tr');

      cols.forEach(col => {
        const td = document.createElement('td');
        const raw = obj[col] ?? '';
        const clean = String(raw).replace(/[［］\[\]\s]/g, '');

        // 若是頁碼字段（仅限第一页表）→ 链接
        if (isPageTable && pageKeys[col] && /^\d+$/.test(clean)) {
          const ed   = pageKeys[col];
          const page = parseInt(clean, 10);
          const a = document.createElement('a');
          a.textContent = clean;
          a.href = `image.html?ed=${ed}&page=${page}`;
          a.target = '_blank';
          td.appendChild(a);
        } else {
          td.textContent = raw;
        }
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });
  }

  function renderTable1(rows) {
    renderRows(tbody1, cols1, rows, true);
    count1.textContent = rows.length
      ? `索引 ${rows.length} 條(姚校如果没有直接命中，請點擊上一頁)`
      : '沒有找到匹配結果';
    table1.classList.toggle('hidden', rows.length === 0);
  }

  function renderTable2(rows) {
    renderRows(tbody2, cols2, dedup(rows), false);
    count2.textContent = rows.length
      ? `錄文 ${rows.length} 條（非原貌，已換行；錄文未校對，正式引用請核對原文）`
      : '';
    table2.classList.toggle('hidden', rows.length === 0);
    count2.classList.toggle('hidden', rows.length === 0);
  }

  const dedup = arr => {
    const seen = new Set();
    return arr.filter(o => {
      const s = JSON.stringify(o);
      if (seen.has(s)) return false;
      seen.add(s);
      return true;
    });
  };

  function clearTables() {
    [tbody1, tbody2].forEach(t => (t.innerHTML = ''));
    [table1, table2].forEach(t => t.classList.add('hidden'));
    [count1, count2].forEach(c => (c.textContent = ''));
  }

  /* ===== 行为 ===== */
  function doSearch() {
    // —— 在任何搜索或“查看全部”前，先隐藏初始说明
    introText.classList.add('hidden');
    const kw = input.value.trim();

    // ----- 第一张表 -----
    if (showAllChk.checked) {
      renderTable1(pageData);
    } else if (kw) {
      const rows1 = pageData.filter(o => {
        const head = o['字頭'] ?? o['字'] ?? '';
        return head.includes(kw);
      });
      renderTable1(rows1);
    } else {
      tbody1.innerHTML = '';
      table1.classList.add('hidden');
      count1.textContent = '';
    }

    // ----- 第二张表（仅在有关键词时触发） -----
    if (kw) {
      const rows2 = textData.filter(o => {
        const head = o['字頭'] ?? '';
        return head.includes(kw);
      });
      renderTable2(rows2);
    } else {
      tbody2.innerHTML = '';
      table2.classList.add('hidden');
      count2.textContent = '';
    }
  }

  /* ===== 事件 ===== */
  searchBtn.addEventListener('click', doSearch);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
  showAllChk.addEventListener('change', doSearch);
});
