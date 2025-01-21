// 全局变量存储活动的监控器
const activeMonitors = new Map();

// 切换标签页
function switchTab(tab) {
    // 移除所有标签页按钮的活动状态
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
    });
    // 激活选中的标签页按钮
    document.querySelector(`.tab-button[onclick*="${tab}"]`).classList.add('active');

    // 隐藏所有输入区域
    document.querySelectorAll('.input-content').forEach(content => {
        content.classList.remove('active');
    });
    // 显示选中的输入区域
    document.getElementById(`${tab}Input`).classList.add('active');

    // 切换结果显示区域
    document.getElementById('realtimeResults').style.display = tab === 'realtime' ? 'block' : 'none';
    document.getElementById('batchResults').style.display = tab === 'batch' ? 'block' : 'none';
}

// 开始单个域名监控
function startMonitoring() {
    const domain = document.getElementById('domainInput').value.trim();
    const interval = parseInt(document.getElementById('intervalSelect').value);
    
    if (!domain) {
        alert('请输入要监控的域名');
        return;
    }

    if (activeMonitors.has(domain)) {
        alert('该域名已在监控中');
        return;
    }

    // 创建监控任务
    const monitor = {
        domain: domain,
        interval: interval,
        timerId: setInterval(() => monitorDomain(domain), interval * 1000),
        lastCheck: null
    };

    activeMonitors.set(domain, monitor);
    
    // 立即执行第一次检查
    monitorDomain(domain);
    
    // 添加到历史记录
    addToHistory(domain, '开始监控');
}

// 开始批量监控
async function startBatchMonitoring() {
    const textarea = document.getElementById('batchDomainInput');
    const domains = textarea.value.split('\n')
        .map(d => d.trim())
        .filter(d => d && d.length > 0);

    if (domains.length === 0) {
        alert('请输入至少一个域名');
        return;
    }

    // 清理现有的监控
    cleanupMonitors();

    // 创建表格行
    const tbody = document.getElementById('monitorTable').getElementsByTagName('tbody')[0];
    tbody.innerHTML = ''; // 清空现有内容

    // 获取监控间隔
    const interval = parseInt(document.getElementById('batchIntervalSelect').value);

    // 为每个域名创建监控
    domains.forEach(domain => {
        // 创建表格行
        const row = tbody.insertRow();
        row.id = `monitor-${domain}`;
        
        // 添加域名列
        const domainCell = row.insertCell();
        domainCell.textContent = domain;
        
        // 添加状态列
        for (let i = 0; i < 5; i++) { // 5个状态列
            const cell = row.insertCell();
            cell.className = 'status-cell';
            cell.textContent = '等待检查';
        }
        
        // 添加最后检查时间列
        const timeCell = row.insertCell();
        timeCell.textContent = '未检查';

        // 创建监控器
        const timerId = setInterval(() => monitorDomainBatch(domain), interval * 1000);
        activeMonitors.set(domain, {
            timerId,
            lastCheck: null
        });

        // 立即执行第一次检查
        monitorDomainBatch(domain);
    });

    // 切换到批量监控结果显示
    document.getElementById('batchResults').style.display = 'block';
}

// 监控单个域名
async function monitorDomain(domain) {
    const monitor = activeMonitors.get(domain);
    if (!monitor) return;

    monitor.lastCheck = new Date();

    // 执行各项检查
    const results = await performChecks(domain);
    
    // 更新状态卡片
    updateStatusCards(results);
    
    // 添加到历史记录
    addToHistory(domain, `完成检查 - ${getStatusSummary(results)}`);
}

// 监控批量域名
async function monitorDomainBatch(domain) {
    const monitor = activeMonitors.get(domain);
    if (!monitor) return;

    monitor.lastCheck = new Date();

    // 执行各项检查
    const results = await performChecks(domain);
    
    // 更新表格行
    updateBatchRow(domain, results);
}

// 执行所有检查项目
async function performChecks(domain) {
    return {
        googleSafe: await checkGoogleSafe(domain),
        surbl: await checkSURBL(domain),
        spamhaus: await checkSpamhaus(domain),
        accessibility: await checkAccessibility(domain),
        dns: await checkDNS(domain)
    };
}

// Google Safe Browsing 检查
async function checkGoogleSafe(domain) {
    try {
        const apiKey = 'AIzaSyAwcApluz37f7q9F5yavmn3e1jcrF9eg2A';
        const response = await fetch(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                client: {
                    clientId: "域名工具箱",
                    clientVersion: "1.0.0"
                },
                threatInfo: {
                    threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
                    platformTypes: ["ANY_PLATFORM"],
                    threatEntryTypes: ["URL"],
                    threatEntries: [
                        { "url": `http://${domain}` },
                        { "url": `https://${domain}` }
                    ]
                }
            })
        });

        if (!response.ok) {
            throw new Error(`API 响应错误: ${response.status}`);
        }
        
        const data = await response.json();
        if (!data) {
            throw new Error('无效的 API 响应');
        }

        const hasThreats = data.matches && data.matches.length > 0;
        let message = '安全';
        let status = 'ok';

        if (hasThreats) {
            const threatTypes = [...new Set(data.matches.map(match => match.threatType))];
            message = `发现潜在风险: ${threatTypes.join(', ')}`;
            status = 'warning';
        }
        
        return { status, message };
    } catch (error) {
        console.error('Google Safe Browsing 检查错误:', error);
        return { 
            status: 'error', 
            message: '检查失败: ' + (error.message || '未知错误') 
        };
    }
}

// SURBL 黑名单检查
async function checkSURBL(domain) {
    try {
        const surblDomain = `${domain}.multi.surbl.org`;  // 只保留 SURBL 主要检查
        
        let isListed = false;
        let listTypes = [];

        try {
            const response = await fetch(`https://dns.google/resolve?name=${surblDomain}&type=A`);
            if (!response.ok) {
                throw new Error(`DNS查询失败: ${response.status}`);
            }
            const data = await response.json();
            
            if (data.Answer && data.Answer.length > 0) {
                isListed = true;
                // 解析 SURBL 返回码
                const returnCode = data.Answer[0].data.split('.')[3];
                listTypes = getSURBLTypes(returnCode);
            }
        } catch (error) {
            console.error(`SURBL检查错误:`, error);
        }

        if (isListed) {
            return {
                status: 'error',
                message: `在黑名单中 (${listTypes.join(', ')})`
            };
        }

        return {
            status: 'ok',
            message: '未在黑名单中'
        };
    } catch (error) {
        console.error('SURBL检查错误:', error);
        return { 
            status: 'error', 
            message: '检查失败: ' + (error.message || '未知错误') 
        };
    }
}

// SURBL 返回码解析
function getSURBLTypes(code) {
    const types = [];
    const codeNum = parseInt(code);
    
    // SURBL 返回码对应的威胁类型
    if (codeNum & 1) types.push('垃圾邮件源');
    if (codeNum & 2) types.push('钓鱼网站');
    if (codeNum & 4) types.push('恶意软件');
    if (codeNum & 8) types.push('广告/滥用');
    if (codeNum & 16) types.push('欺诈网站');
    
    return types.length > 0 ? types : ['未知威胁'];
}

// SSL 证书状态检查
async function checkSSL(domain) {
    try {
        const response = await fetch(`https://${domain}`, {
            method: 'HEAD',
            mode: 'no-cors',
            timeout: 5000
        });

        if (!response.ok) {
            return { 
                status: 'error', 
                message: 'SSL证书异常' 
            };
        }

        return {
            status: 'ok',
            message: 'SSL证书正常'
        };
    } catch (error) {
        console.error('SSL检查错误:', error);
        return { 
            status: 'error', 
            message: '不支持 HTTPS' 
        };
    }
}

// Spamhaus 黑名单检查
async function checkSpamhaus(domain) {
    try {
        const spamhausDomains = [
            `${domain}.zen.spamhaus.org`,
            `${domain}.dbl.spamhaus.org`
        ];
        
        let isListed = false;
        let listingDetails = [];

        for (const spamhausDomain of spamhausDomains) {
            try {
                const response = await fetch(`https://dns.google/resolve?name=${spamhausDomain}&type=A`);
                if (!response.ok) {
                    throw new Error(`DNS查询失败: ${response.status}`);
                }
                const data = await response.json();
                
                if (data.Answer && data.Answer.length > 0) {
                    isListed = true;
                    const code = data.Answer[0].data.split('.')[3];
                    const reason = getSpamhausCode(code);
                    listingDetails.push(reason);
                }
            } catch (error) {
                console.error(`Spamhaus检查错误 (${spamhausDomain}):`, error);
            }
        }

        return {
            status: isListed ? 'error' : 'ok',
            message: isListed ? `在黑名单中 (${listingDetails.join(', ')})` : '未在黑名单中'
        };
    } catch (error) {
        console.error('Spamhaus检查错误:', error);
        return { 
            status: 'error', 
            message: '检查失败: ' + (error.message || '未知错误') 
        };
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
    return codes[code] || 'Unknown';
}

// 网站可访问性检查
async function checkAccessibility(domain) {
    try {
        const protocols = ['https://', 'http://'];
        let bestResult = { status: 'error', message: '所有协议均无法访问' };
        
        for (const protocol of protocols) {
            try {
                const startTime = performance.now();
                const response = await fetch(`${protocol}${domain}`, {
                    method: 'HEAD',
                    mode: 'no-cors',
                    timeout: 10000
                });
                const endTime = performance.now();
                const responseTime = Math.round(endTime - startTime);

                let status = 'ok';
                let details = [];

                // 检查响应时间
                details.push(`响应时间: ${responseTime}ms`);
                if (responseTime > 2000) {
                    status = 'error';
                } else if (responseTime > 1000) {
                    status = 'warning';
                }

                // 检查 HTTP 状态码
                if (response.status >= 400) {
                    status = 'error';
                    details.push(`状态码: ${response.status}`);
                }

                // 记录使用的协议
                details.push(`协议: ${protocol.slice(0, -3)}`);

                bestResult = {
                    status,
                    message: details.join(', ')
                };

                // 如果 HTTPS 访问成功，不需要尝试 HTTP
                if (protocol === 'https://' && status !== 'error') {
                    break;
                }
            } catch (error) {
                console.error(`可访问性检查错误 (${protocol}):`, error);
                continue;
            }
        }

        return bestResult;
    } catch (error) {
        console.error('可访问性检查错误:', error);
        return { 
            status: 'error', 
            message: '检查失败: ' + (error.message || '未知错误') 
        };
    }
}

// DNS 记录检查
async function checkDNS(domain) {
    try {
        const records = {
            A: await getDNSRecord(domain, 'A'),
            AAAA: await getDNSRecord(domain, 'AAAA')
        };

        let status = 'ok';
        const details = [];

        // 只检查 A/AAAA 记录
        if (!records.A.exists && !records.AAAA.exists) {
            status = 'error';
            details.push('无法解析域名');
        } else {
            details.push(`IP: ${records.A.exists ? records.A.data[0] : records.AAAA.data[0]}`);
        }

        return {
            status,
            message: details.join(', ')
        };
    } catch (error) {
        console.error('DNS检查错误:', error);
        return { 
            status: 'error', 
            message: 'DNS检查失败: ' + (error.message || '未知错误') 
        };
    }
}

// 获取特定类型的 DNS 记录
async function getDNSRecord(domain, type) {
    try {
        const response = await fetch(`https://dns.google/resolve?name=${domain}&type=${type}`);
        if (!response.ok) {
            throw new Error(`DNS查询失败: ${response.status}`);
        }
        
        const data = await response.json();
        const exists = data.Answer && data.Answer.length > 0;
        
        let recordData = [];
        if (exists) {
            switch (type) {
                case 'MX':
                    // MX 记录包含优先级和服务器地址
                    recordData = data.Answer.map(record => {
                        const [priority, server] = record.data.split(' ');
                        return `${server}(${priority})`;
                    });
                    break;
                case 'TXT':
                    // TXT 记录需要去除引号
                    recordData = data.Answer.map(record => record.data.replace(/"/g, ''));
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

// 计算域名的哈希值，用于生成稳定的检查结果
async function calculateDomainHash(domain) {
    let hash = 0;
    for (let i = 0; i < domain.length; i++) {
        const char = domain.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
}

// 模拟 API 调用延迟
async function simulateApiCall() {
    const delay = 500 + Math.random() * 500; // 500-1000ms的延迟
    return new Promise(resolve => setTimeout(resolve, delay));
}

// 更新状态卡片
function updateStatusCards(results) {
    Object.entries(results).forEach(([key, result]) => {
        const card = document.querySelector(`#${key} .status`);
        if (card) {
            card.textContent = result.message;
            card.className = `status ${result.status}`;
        }
    });
}

// 更新批量监控表格行
function updateBatchRow(domain, results) {
    const row = document.getElementById(`monitor-${domain}`);
    if (!row) return;

    const cells = row.getElementsByClassName('status-cell');
    const checks = ['googleSafe', 'surbl', 'spamhaus', 'accessibility', 'dns'];
    
    checks.forEach((check, index) => {
        const result = results[check];
        cells[index].textContent = result.message;
        cells[index].className = `status-cell ${result.status}`;
    });

    // 更新最后检查时间
    const monitor = activeMonitors.get(domain);
    if (monitor && monitor.lastCheck) {
        row.lastElementChild.textContent = monitor.lastCheck.toLocaleString();
    }
}

// 添加到历史记录
function addToHistory(domain, message) {
    const historyList = document.getElementById('monitorHistory');
    const historyItem = document.createElement('div');
    historyItem.className = 'history-item';
    historyItem.textContent = `[${new Date().toLocaleString()}] ${domain}: ${message}`;
    historyList.insertBefore(historyItem, historyList.firstChild);
}

// 获取状态摘要
function getStatusSummary(results) {
    const statuses = Object.values(results).map(r => r.status);
    if (statuses.includes('error')) return '发现严重问题';
    if (statuses.includes('warning')) return '发现潜在问题';
    return '一切正常';
}

// 停止监控
function stopMonitoring(domain) {
    const monitor = activeMonitors.get(domain);
    if (monitor) {
        clearInterval(monitor.timerId);
        activeMonitors.delete(domain);
        addToHistory(domain, '停止监控');
    }
}

// 清理所有监控
function cleanupMonitors() {
    activeMonitors.forEach(monitor => {
        clearInterval(monitor.timerId);
    });
    activeMonitors.clear();
}

// 页面卸载时清理
window.addEventListener('unload', cleanupMonitors); 