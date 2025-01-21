// 切换单个检查和批量检查
function switchTab(tab) {
    // 更新按钮状态
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
    });
    document.querySelector(`.tab-button[onclick*="${tab}"]`).classList.add('active');

    // 更新输入区域显示
    document.querySelectorAll('.input-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tab}Input`).classList.add('active');

    // 更新结果区域显示
    document.getElementById('singleResults').style.display = tab === 'single' ? 'grid' : 'none';
    document.getElementById('batchResults').style.display = tab === 'batch' ? 'block' : 'none';
}

// 单个域名检查
async function checkDomain() {
    const domain = document.getElementById('domainInput').value.trim();
    if (!domain) {
        alert('请输入要检查的域名');
        return;
    }

    setAllStatusLoading();
    
    const results = await checkSingleDomain(domain);
    updateSingleResults(results);
}

// 批量检查域名
async function checkBatchDomains() {
    const domainsText = document.getElementById('batchDomainInput').value.trim();
    if (!domainsText) {
        alert('请输入要检查的域名列表');
        return;
    }

    const domains = domainsText.split('\n')
        .map(d => d.trim())
        .filter(d => d.length > 0);

    if (domains.length === 0) {
        alert('没有找到有效的域名');
        return;
    }

    // 清空并初始化结果表格
    const tbody = document.getElementById('batchResultsBody');
    tbody.innerHTML = '';
    
    // 为每个域名创建一行
    for (const domain of domains) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${domain}</td>
            <td class="status-cell loading">检查中...</td>
            <td class="status-cell loading">检查中...</td>
            <td class="status-cell loading">检查中...</td>
        `;
        tbody.appendChild(row);
    }

    // 并行检查所有域名
    const results = await Promise.all(domains.map(async (domain, index) => {
        const result = await checkSingleDomain(domain);
        updateBatchResults(result, index);
        return result;
    }));
}

// 检查单个域名的所有黑名单
async function checkSingleDomain(domain) {
    const results = {
        domain: domain,
        surbl: await checkSURBL(domain, true),
        spamhaus: await checkSpamhaus(domain, true),
        mxtoolbox: await checkMXToolbox(domain, true)
    };
    return results;
}

// 更新单个检查结果
function updateSingleResults(results) {
    updateStatus('surblResult', results.surbl);
    updateStatus('spamhausResult', results.spamhaus);
    updateStatus('mxtoolboxResult', results.mxtoolbox);
}

// 更新批量检查结果
function updateBatchResults(results, index) {
    const row = document.getElementById('batchResultsBody').children[index];
    const cells = row.getElementsByClassName('status-cell');
    
    updateStatusCell(cells[0], results.surbl);
    updateStatusCell(cells[1], results.spamhaus);
    updateStatusCell(cells[2], results.mxtoolbox);
}

// 更新状态单元格
function updateStatusCell(cell, result) {
    cell.textContent = result.listed ? '在黑名单中' : '未在黑名单中';
    cell.className = `status-cell ${result.listed ? 'danger' : 'safe'}`;
}

// 更新单个检查的状态显示
function updateStatus(elementId, result) {
    const element = document.querySelector(`#${elementId} .status`);
    element.textContent = result.listed ? '域名在黑名单中' : '域名不在黑名单中';
    element.className = `status ${result.listed ? 'danger' : 'safe'}`;
}

// 设置所有状态为加载中
function setAllStatusLoading() {
    const statuses = document.querySelectorAll('.status');
    statuses.forEach(status => {
        status.textContent = '检查中...';
        status.className = 'status loading';
    });
}

// 检查 SURBL
async function checkSURBL(domain, returnResult = false) {
    try {
        // 模拟 API 调用
        await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
        const isListed = Math.random() > 0.8;
        
        if (returnResult) {
            return { listed: isListed };
        }
        
        const resultElement = document.querySelector('#surblResult .status');
        resultElement.textContent = isListed ? '域名在 SURBL 黑名单中' : '域名不在 SURBL 黑名单中';
        resultElement.className = `status ${isListed ? 'danger' : 'safe'}`;
    } catch (error) {
        if (returnResult) {
            return { listed: false, error: true };
        }
    }
}

// 检查 Spamhaus
async function checkSpamhaus(domain, returnResult = false) {
    try {
        // 模拟 API 调用
        await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
        const isListed = Math.random() > 0.8;
        
        if (returnResult) {
            return { listed: isListed };
        }
        
        const resultElement = document.querySelector('#spamhausResult .status');
        resultElement.textContent = isListed ? '域名在 Spamhaus 黑名单中' : '域名不在 Spamhaus 黑名单中';
        resultElement.className = `status ${isListed ? 'danger' : 'safe'}`;
    } catch (error) {
        if (returnResult) {
            return { listed: false, error: true };
        }
    }
}

// 检查 MXToolbox
async function checkMXToolbox(domain, returnResult = false) {
    try {
        // 模拟 API 调用
        await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
        const isListed = Math.random() > 0.8;
        
        if (returnResult) {
            return { listed: isListed };
        }
        
        const resultElement = document.querySelector('#mxtoolboxResult .status');
        resultElement.textContent = isListed ? '域名在 MXToolbox 黑名单中' : '域名不在 MXToolbox 黑名单中';
        resultElement.className = `status ${isListed ? 'danger' : 'safe'}`;
    } catch (error) {
        if (returnResult) {
            return { listed: false, error: true };
        }
    }
}

// 添加输入框回车事件监听
document.getElementById('domainInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        checkDomain();
    }
}); 