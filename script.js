document.addEventListener('DOMContentLoaded', function () {
    // 使用 Fetch API 加载 JSON 数据
    fetch('data.json')
        .then(response => response.json())
        .then(data => {
            const tableBody = document.getElementById('dictionary-table');

            data.forEach(item => {
                const row = document.createElement('tr');

                // 创建并填充汉字单元格
                const characterCell = document.createElement('td');
                characterCell.textContent = item['字'];
                row.appendChild(characterCell);

                // 创建并填充页码单元格
                const pageCell = document.createElement('td');
                pageCell.textContent = item['頁碼'] !== null ? item['頁碼'] : '无页码'; // 如果頁碼为null，显示"无页码"
                row.appendChild(pageCell);

                // 为行添加点击事件
                row.addEventListener('click', () => {
                    // 如果頁碼有效（不为null或0），跳转到对应的页面；否则提示用户
                    if (item['頁碼'] !== null && item['頁碼'] !== 0) {
                        window.open(`image.html?page=${item['頁碼']}`, '_blank');
                    } else {
                        alert('该字没有对应的页码。');
                    }
                });

                // 将行追加到表格主体中
                tableBody.appendChild(row);
            });
        })
        .catch(error => {
            console.error('Error loading JSON data:', error);
        });
});
