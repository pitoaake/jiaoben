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
            <td class="domain-cell">${domain}</td>
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
    
    // 特殊处理 MXToolbox/DNSBL 结果
    const mxtoolboxCell = cells[2];
    if (results.mxtoolbox.details && Array.isArray(results.mxtoolbox.details)) {
        if (results.mxtoolbox.listed && results.mxtoolbox.details.length > 0) {
            const blacklistNames = results.mxtoolbox.details.map(item => {
                const info = item.info.replace(/^IP: \d+\.\d+\.\d+\.\d+ /, '').replace('被列入黑名单', '');
                return `${item.name}${info !== '' ? ` (${info})` : ''}`;
            }).join('、');
            
            mxtoolboxCell.innerHTML = `<div class="blacklist-names" title="${blacklistNames}">
                ${blacklistNames}
            </div>`;
            mxtoolboxCell.className = 'status-cell danger';
        } else {
            mxtoolboxCell.textContent = '未在黑名单中';
            mxtoolboxCell.className = 'status-cell safe';
        }
    } else {
        updateStatusCell(cells[2], results.mxtoolbox);
    }
}

// 更新状态单元格
function updateStatusCell(cell, result) {
    if (result.details && Array.isArray(result.details)) {
        // 对于 MXToolbox/DNSBL 结果
        if (result.listed && result.details.length > 0) {
            const blacklistNames = result.details.map(item => item.name).join(', ');
            cell.innerHTML = `<div class="blacklist-names" title="${blacklistNames}">
                在以下黑名单中: ${blacklistNames}
            </div>`;
        } else {
            cell.textContent = '未在黑名单中';
        }
    } else {
        // 对于其他类型的结果
        if (result.listed) {
            cell.textContent = result.details ? `在黑名单中 (${result.details})` : '在黑名单中';
        } else {
            cell.textContent = result.error ? '检查失败' : '未在黑名单中';
        }
    }
    cell.className = `status-cell ${result.error ? 'error' : (result.listed ? 'danger' : 'safe')}`;
}

// 更新单个检查的状态显示
function updateStatus(elementId, result) {
    const element = document.querySelector(`#${elementId} .status`);
    
    // 如果是 MXToolbox/DNSBL 检查结果
    if (result.details && Array.isArray(result.details)) {
        // 创建结果表格
        let resultHtml = '<div class="blacklist-results">';
        resultHtml += '<table class="results-table">';
        resultHtml += '<tr><th>黑名单</th><th>状态</th><th>详细信息</th></tr>';

        if (result.listed && result.details.length > 0) {
            result.details.forEach(item => {
                resultHtml += `
                    <tr>
                        <td>${item.name}</td>
                        <td class="status-cell danger">已列入</td>
                        <td>${item.info}</td>
                    </tr>
                `;
            });
        } else {
            resultHtml += `
                <tr>
                    <td colspan="3" class="status-cell safe" style="text-align: center;">
                        未发现任何黑名单记录
                    </td>
                </tr>
            `;
        }

        resultHtml += '</table></div>';
        element.innerHTML = resultHtml;
    } else {
        // 对于其他类型的检查结果（SURBL, Spamhaus）
        let text = result.listed ? '域名在黑名单中' : '域名不在黑名单中';
        if (result.details && result.listed) {
            text += ` (${result.details})`;
        }
        if (result.error) {
            text = '检查失败';
        }
        element.textContent = text;
    }
    
    element.className = `status ${result.error ? 'error' : (result.listed ? 'danger' : 'safe')}`;
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
        const surblDomain = `${domain}.multi.surbl.org`;
        const response = await fetch(`https://dns.google/resolve?name=${surblDomain}&type=A`);
        
        if (!response.ok) {
            throw new Error('DNS查询失败');
        }
        
        const data = await response.json();
        const isListed = data.Answer && data.Answer.length > 0;
        let details = '';
        
        if (isListed) {
            const returnCode = data.Answer[0].data.split('.')[3];
            const types = getSURBLTypes(returnCode);
            details = `(${types.join(', ')})`;
        }
        
        if (returnResult) {
            return { 
                listed: isListed,
                details: details
            };
        }
        
        const resultElement = document.querySelector('#surblResult .status');
        resultElement.textContent = isListed ? 
            `域名在 SURBL 黑名单中 ${details}` : 
            '域名不在 SURBL 黑名单中';
        resultElement.className = `status ${isListed ? 'danger' : 'safe'}`;
    } catch (error) {
        console.error('SURBL检查错误:', error);
        if (returnResult) {
            return { listed: false, error: true };
        }
        const resultElement = document.querySelector('#surblResult .status');
        resultElement.textContent = '检查失败';
        resultElement.className = 'status error';
    }
}

// SURBL 返回码解析
function getSURBLTypes(code) {
    const types = [];
    const codeNum = parseInt(code);
    
    if (codeNum & 1) types.push('垃圾邮件源');
    if (codeNum & 2) types.push('钓鱼网站');
    if (codeNum & 4) types.push('恶意软件');
    if (codeNum & 8) types.push('广告/滥用');
    if (codeNum & 16) types.push('欺诈网站');
    
    return types.length > 0 ? types : ['未知威胁'];
}

// 检查 Spamhaus
async function checkSpamhaus(domain, returnResult = false) {
    try {
        const spamhausDomains = [
            `${domain}.zen.spamhaus.org`,
            `${domain}.dbl.spamhaus.org`
        ];
        
        let isListed = false;
        let listingDetails = [];

        for (const spamhausDomain of spamhausDomains) {
            const response = await fetch(`https://dns.google/resolve?name=${spamhausDomain}&type=A`);
            
            if (!response.ok) {
                throw new Error('DNS查询失败');
            }
            
            const data = await response.json();
            if (data.Answer && data.Answer.length > 0) {
                isListed = true;
                const code = data.Answer[0].data.split('.')[3];
                const reason = getSpamhausCode(code);
                listingDetails.push(reason);
            }
        }
        
        if (returnResult) {
            return { 
                listed: isListed,
                details: listingDetails.join(', ')
            };
        }
        
        const resultElement = document.querySelector('#spamhausResult .status');
        resultElement.textContent = isListed ? 
            `域名在 Spamhaus 黑名单中 (${listingDetails.join(', ')})` : 
            '域名不在 Spamhaus 黑名单中';
        resultElement.className = `status ${isListed ? 'danger' : 'safe'}`;
    } catch (error) {
        console.error('Spamhaus检查错误:', error);
        if (returnResult) {
            return { listed: false, error: true };
        }
        const resultElement = document.querySelector('#spamhausResult .status');
        resultElement.textContent = '检查失败';
        resultElement.className = 'status error';
    }
}

// Spamhaus 返回代码解释
function getSpamhausCode(code) {
    const codes = {
        '2': 'SBL',
        '3': 'CSS',
        '4': 'XBL',
        '5': 'XBL',
        '6': 'XBL',
        '7': 'XBL',
        '9': 'SBL',
        '10': 'PBL',
        '11': 'PBL'
    };
    return codes[code] || '未知';
}

// 检查 DNSBL.info
async function checkMXToolbox(input, returnResult = false) {
    try {
        const resultElement = document.querySelector('#mxtoolboxResult .status');
        
        // 创建进度显示
        let progressHtml = '<div class="check-progress">';
        progressHtml += '<div class="progress-text">正在检查黑名单...</div>';
        progressHtml += '<div class="progress-bar"><div class="progress-fill"></div></div>';
        progressHtml += '<div class="progress-detail">准备开始检查...</div>';
        progressHtml += '</div>';
        resultElement.innerHTML = progressHtml;

        // 定义 DNSBL.info 使用的黑名单服务器
        const dnsblServers = [
            { server: 'zen.spamhaus.org', name: 'Spamhaus ZEN' },
            { server: 'bl.spamcop.net', name: 'SpamCop' },
            { server: 'dnsbl.sorbs.net', name: 'SORBS' },
            { server: 'b.barracudacentral.org', name: 'Barracuda' },
            { server: 'dnsbl-1.uceprotect.net', name: 'UCEPROTECT Level 1' },
            { server: 'dnsbl-2.uceprotect.net', name: 'UCEPROTECT Level 2' },
            { server: 'dnsbl-3.uceprotect.net', name: 'UCEPROTECT Level 3' },
            { server: 'dnsbl.dronebl.org', name: 'DroneBL' },
            { server: 'all.s5h.net', name: 'S5H' },
            { server: 'bl.spamcannibal.org', name: 'SpamCannibal' },
            { server: 'dnsbl.inps.de', name: 'INPS' },
            { server: 'ix.dnsbl.manitu.net', name: 'Manitu' },
            { server: 'psbl.surriel.com', name: 'PSBL' },
            { server: 'ubl.unsubscore.com', name: 'UnsubScore' }
        ];

        // 更新进度显示函数
        const updateProgress = (text, progress) => {
            const progressDetail = resultElement.querySelector('.progress-detail');
            const progressFill = resultElement.querySelector('.progress-fill');
            const progressText = resultElement.querySelector('.progress-text');
            
            if (progressDetail) progressDetail.textContent = text;
            if (progressFill) progressFill.style.width = `${progress}%`;
            if (progressText) progressText.textContent = `已完成 ${Math.round(progress)}%`;
        };

        // 判断输入是 IP 还是域名
        updateProgress('正在解析IP地址...', 5);
        const isIP = /^(\d{1,3}\.){3}\d{1,3}$/.test(input);
        let ipAddresses = [];

        if (isIP) {
            ipAddresses = [input];
        } else {
            // 如果是域名，获取其 A 记录
            const aRecords = await getDNSRecord(input, 'A');
            if (aRecords.exists && aRecords.data.length > 0) {
                ipAddresses = aRecords.data;
            }
        }

        if (ipAddresses.length === 0) {
            throw new Error('无法解析IP地址');
        }

        const blacklistResults = [];
        let isListed = false;
        let hasListings = false;
        let completedChecks = 0;
        const totalChecks = ipAddresses.length * dnsblServers.length;

        // 检查每个IP
        for (const ip of ipAddresses) {
            const reversedIp = ip.split('.').reverse().join('.');
            updateProgress(`正在检查 IP: ${ip}`, (completedChecks / totalChecks) * 100);
            
            // 逐个检查黑名单
            for (const { server, name } of dnsblServers) {
                updateProgress(`正在检查 ${name}...`, (completedChecks / totalChecks) * 100);
                
                try {
                    const response = await fetch(`https://dns.google/resolve?name=${reversedIp}.${server}&type=A`, {
                        method: 'GET',
                        headers: {
                            'Accept': 'application/dns-json'
                        }
                    });

                    if (!response.ok) {
                        throw new Error(`DNS查询失败: ${response.status}`);
                    }

                    const data = await response.json();
                    if (data.Answer && data.Answer.length > 0) {
                        isListed = true;
                        hasListings = true;
                        let returnCode = '';
                        try {
                            returnCode = data.Answer[0].data.split('.')[3];
                        } catch (e) {
                            console.error('无法解析返回码:', e);
                        }

                        let reason = '';
                        if (server.includes('spamhaus')) {
                            reason = ` (${getSpamhausCode(returnCode)})`;
                        }

                        blacklistResults.push({
                            name: name,
                            status: 'listed',
                            info: `IP: ${ip}${reason ? reason : ' 被列入黑名单'}`,
                            ip: ip
                        });
                    }
                } catch (error) {
                    console.error(`检查 ${name} 失败:`, error);
                }

                completedChecks++;
                // 添加小延迟，避免请求过快
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }

        // 检查完成，显示结果
        updateProgress('检查完成，正在生成报告...', 100);
        await new Promise(resolve => setTimeout(resolve, 500)); // 等待进度条动画完成

        // 创建结果表格
        let resultHtml = '<div class="blacklist-results">';
        resultHtml += `<h3>DNSBL.info 黑名单检查结果 - ${input}</h3>`;
        resultHtml += '<table class="results-table">';
        resultHtml += '<tr><th>黑名单</th><th>状态</th><th>详细信息</th></tr>';

        if (hasListings) {
            blacklistResults.forEach(result => {
                resultHtml += `
                    <tr>
                        <td>${result.name}</td>
                        <td class="status-cell danger">已列入</td>
                        <td>${result.info}</td>
                    </tr>
                `;
            });
        } else {
            resultHtml += `
                <tr>
                    <td colspan="3" class="status-cell safe" style="text-align: center;">
                        未发现任何黑名单记录
                    </td>
                </tr>
            `;
        }

        resultHtml += '</table></div>';
        resultElement.innerHTML = resultHtml;

        // 更新整体状态
        resultElement.className = isListed ? 'status danger' : 'status safe';

        // 添加 DNSBL.info 链接
        const link = document.createElement('a');
        link.href = `https://www.dnsbl.info/dnsbl-database-check.php`;
        link.target = '_blank';
        link.textContent = '在 DNSBL.info 查看更多信息';
        link.style.marginLeft = '10px';
        link.className = 'mxtoolbox-link';
        resultElement.appendChild(link);

        if (returnResult) {
            return {
                listed: isListed,
                details: blacklistResults
            };
        }

    } catch (error) {
        console.error('DNSBL.info 检查错误:', error);
        
        if (returnResult) {
            return {
                listed: false,
                error: true,
                details: error.message
            };
        }
        
        const resultElement = document.querySelector('#mxtoolboxResult .status');
        resultElement.textContent = '检查失败，请稍后重试';
        resultElement.className = 'status error';
        
        // 添加 DNSBL.info 链接
        const link = document.createElement('a');
        link.href = 'https://www.dnsbl.info/dnsbl-database-check.php';
        link.target = '_blank';
        link.textContent = '访问 DNSBL.info 查看';
        link.style.marginLeft = '10px';
        link.className = 'mxtoolbox-link';
        resultElement.appendChild(link);
    }
}

// 获取特定类型的 DNS 记录
async function getDNSRecord(domain, type) {
    try {
        const response = await fetch(`https://dns.google/resolve?name=${domain}&type=${type}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/dns-json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`DNS查询失败: ${response.status}`);
        }
        
        const data = await response.json();
        const exists = data.Answer && data.Answer.length > 0;
        
        let recordData = [];
        if (exists) {
            switch (type) {
                case 'MX':
                    recordData = data.Answer.map(record => record.data);
                    break;
                case 'A':
                    recordData = data.Answer
                        .filter(record => record.type === 1)
                        .map(record => record.data);
                    break;
                default:
                    recordData = data.Answer.map(record => record.data);
            }
        }

        return {
            exists,
            data: recordData
        };
    } catch (error) {
        console.error(`DNS记录查询错误 (${type}):`, error);
        return {
            exists: false,
            data: [],
            error: error.message
        };
    }
}

// 添加输入框回车事件监听
document.getElementById('domainInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        checkDomain();
    }
}); 