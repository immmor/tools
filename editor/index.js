    let storage = JSON.parse(localStorage.getItem('ind_console_storage')) || {
        'PROTOCOL.txt': 'SYSTEM OVERRIDE: ACTIVE\nENCRYPTION: ENABLED',
        'script.js': 'console.log("Node WASM active");',
        'main.py': 'print("Python WASM initialized")'
    };
    let plugins = JSON.parse(localStorage.getItem('ind_console_plugins')) || [
        { 
            name: 'Matrix_Rain', 
            code: 'const canvas = document.createElement(\'canvas\');const ctx = canvas.getContext(\'2d\');canvas.id = \'matrix-canvas\';canvas.style.cssText = \'position:fixed;top:0;left:0;width:100%;height:100%;z-index:2222;opacity:0.4;pointer-events:none;\';document.body.appendChild(canvas);let w = canvas.width = window.innerWidth;let h = canvas.height = window.innerHeight;const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ$+-*/=<>!%";const fontSize = 14;const columns = Math.floor(w / fontSize);const drops = new Array(columns).fill(1);function draw() { ctx.fillStyle = \'rgba(18, 16, 11, 0.05)\'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = \'#00ff00\'; ctx.font = fontSize + \'px "Courier New"\'; for (let i = 0; i < drops.length; i++) { const text = chars[Math.floor(Math.random() * chars.length)]; ctx.fillText(text, i * fontSize, drops[i] * fontSize); if (drops[i] * fontSize > h && Math.random() > 0.975) drops[i] = 0; drops[i]++; } }const interval = setInterval(draw, 33);const resizeHandler = () => { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; };window.addEventListener(\'resize\', resizeHandler);return () => { clearInterval(interval); window.removeEventListener(\'resize\', resizeHandler); if (canvas.parentNode) canvas.parentNode.removeChild(canvas); };', 
            active: false 
        }
    ];
    let config = JSON.parse(localStorage.getItem('ind_console_config')) || {
        activeProviderIndex: 0,
        providers: [
            {
                name: 'Gemini Default',
                apiBaseUrl: 'https://mrok.dpdns.org/v1',
                apiKey: '',
                model: 'gemini-flash-latest'
            }
        ]
    };
    let selectedProviderIndices = [config.activeProviderIndex]; // 只支持单个供应商
    let aiChatHistory = JSON.parse(localStorage.getItem('ind_console_ai_history')) || {};
    let activeFile = localStorage.getItem('ind_console_active') || 'PROTOCOL.txt';
    let expandedDirs = JSON.parse(localStorage.getItem('ind_console_expanded')) || ['SYSTEM/'];
    
    // 提示词模板数据（支持本地存储）
    let aiTemplates = JSON.parse(localStorage.getItem('ind_console_templates')) || {
        '代码优化': '请帮我优化以下代码，提高性能和可读性：\n\n[代码]',
        '代码解释': '请详细解释以下代码的功能和工作原理：\n\n[代码]'
    };
    
    function saveTemplates() {
        localStorage.setItem('ind_console_templates', JSON.stringify(aiTemplates));
    }
    let termCount = 0;
    let activeTermId = null;
    let selectedAiCtx = 'none';
    let pyodideInstance = null;
    let ctxTarget = null;
    let pluginCtxTarget = null;
    let currentAiRequest = null;
    
    // 音效函数
    function playTone(type) {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        switch(type) {
            case 'send':
                // 发送消息音效 - 柔和电子音
                playBeep(audioContext, 330, 0.1, 'sine', 0, 0.08);
                playBeep(audioContext, 440, 0.08, 'sine', 0.1, 0.06);
                break;
            case 'success':
                // 成功音效 - 上升音调
                playBeep(audioContext, 440, 0.3, 'sine');
                playBeep(audioContext, 880, 0.2, 'sine', 0.3);
                break;
            case 'error':
                // 错误音效 - 下降音调
                playBeep(audioContext, 880, 0.2, 'square');
                playBeep(audioContext, 220, 0.3, 'square', 0.2);
                break;
            case 'typing':
                // 打字音效 - 轻快短促
                playBeep(audioContext, 660, 0.05, 'triangle', 0, 0.1);
                break;
        }
    }
    
    function playBeep(audioContext, frequency, duration, type = 'sine', delay = 0, volume = 0.1) {
        setTimeout(() => {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = frequency;
            oscillator.type = type;
            
            gainNode.gain.setValueAtTime(0, audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + duration);
        }, delay * 1000);
    }
    
    let editorTabs = {};
        let activeEditorTab = null;
        let fileModifiedState = {};
        let openedTabs = JSON.parse(localStorage.getItem('ind_console_opened_tabs')) || []; // 记住打开的标签

    let isSearching = false;
    function toggleSearch() {
        const searchCont = document.getElementById('search-container');
        const fileList = document.getElementById('file-list');
        const searchRes = document.getElementById('search-results');
        const searchInput = document.getElementById('global-search-in');

        isSearching = !isSearching;

        if (isSearching) {
            searchCont.style.display = 'block';
            searchRes.style.display = 'block';
            fileList.style.display = 'none';
            searchInput.focus();
        } else {
            searchCont.style.display = 'none';
            searchRes.style.display = 'none';
            fileList.style.display = 'block';
            searchInput.value = '';
        }
    }

    function executeGlobalSearch() {
        const query = document.getElementById('global-search-in').value.toLowerCase();
        const resultsCont = document.getElementById('search-results');
        resultsCont.innerHTML = '';

        if (!query) return;

        Object.keys(storage).forEach(path => {
            const isFolder = path.endsWith('/');
            const content = storage[path];
            
            const fileNameMatch = path.toLowerCase().includes(query);
            
            let contentMatch = null;
            if (!isFolder && typeof content === 'string') {
                const index = content.toLowerCase().indexOf(query);
                if (index !== -1) {
                    const start = Math.max(0, index - 20);
                    const end = Math.min(content.length, index + query.length + 20);
                    contentMatch = content.substring(start, end).replace(/\n/g, ' ');
                }
            }

            if (fileNameMatch || contentMatch) {
                const div = document.createElement('div');
                div.className = 'search-res-item';
                
                let innerHTML = `<span class="search-path">📁 ${path}</span>`;
                if (contentMatch) {
                    const highlighted = contentMatch.replace(new RegExp(query, 'gi'), (m) => `<span class="search-match">${m}</span>`);
                    innerHTML += `<span style="opacity:0.8">...${highlighted}...</span>`;
                } else {
                    innerHTML += `<span style="color:var(--amber)">[MATCH_IN_FILENAME]</span>`;
                }

                div.innerHTML = innerHTML;
                div.onclick = () => {
                    activeFile = path;
                    if (!isFolder) {
                        smartSwitch('editor');
                        openFile(path);
                    }
                    toggleSearch();
                    renderFiles();
                };
                resultsCont.appendChild(div);
            }
        });

        plugins.forEach((plugin, index) => {
            const pluginNameMatch = plugin.name.toLowerCase().includes(query);
            const pluginCodeMatch = plugin.code.toLowerCase().includes(query);
            
            if (pluginNameMatch || pluginCodeMatch) {
                const div = document.createElement('div');
                div.className = 'search-res-item';
                
                let innerHTML = `<span class="search-path">🔌 ${plugin.name}</span>`;
                if (pluginCodeMatch) {
                    const index = plugin.code.toLowerCase().indexOf(query);
                    const start = Math.max(0, index - 20);
                    const end = Math.min(plugin.code.length, index + query.length + 20);
                    const snippet = plugin.code.substring(start, end).replace(/\n/g, ' ');
                    const highlighted = snippet.replace(new RegExp(query, 'gi'), (m) => `<span class="search-match">${m}</span>`);
                    innerHTML += `<span style="opacity:0.8">...${highlighted}...</span>`;
                } else {
                    innerHTML += `<span style="color:var(--amber)">[MATCH_IN_PLUGIN_NAME]</span>`;
                }

                div.innerHTML = innerHTML;
                div.onclick = () => {
                    pluginCtxTarget = index;
                    smartSwitch('editor-p');
                    startEditPlugin();
                    toggleSearch();
                };
                resultsCont.appendChild(div);
            }
        });

        const terminalLogs = document.getElementById('terminal-logs');
        if (terminalLogs) {
            const logs = terminalLogs.innerText.toLowerCase();
            if (logs.includes(query)) {
                const div = document.createElement('div');
                div.className = 'search-res-item';
                div.innerHTML = `<span class="search-path">💻 TERMINAL</span><span style="color:var(--amber)">[MATCH_IN_TERMINAL]</span>`;
                div.onclick = () => {
                    // 切换到终端面板
                    smartSwitch('terminal');
                    toggleSearch();
                    // 滚动到终端底部显示最新内容
                    setTimeout(() => {
                        const termLogs = document.getElementById('terminal-logs');
                        if (termLogs) termLogs.scrollTop = termLogs.scrollHeight;
                    }, 100);
                };
                resultsCont.appendChild(div);
            }
        }

        Object.keys(aiChatHistory).forEach(chatId => {
            const chatContent = aiChatHistory[chatId].join('').toLowerCase();
            if (chatContent.includes(query)) {
                const div = document.createElement('div');
                div.className = 'search-res-item';
                
                const index = chatContent.indexOf(query);
                const start = Math.max(0, index - 20);
                const end = Math.min(chatContent.length, index + query.length + 20);
                const snippet = chatContent.substring(start, end).replace(/\n/g, ' ');
                const highlighted = snippet.replace(new RegExp(query, 'gi'), (m) => `<span class="search-match">${m}</span>`);
                
                const chatNum = chatId.replace('ai-chat-', '');
                div.innerHTML = `<span class="search-path">🤖 CHAT_${chatNum}</span><span style="opacity:0.8">...${highlighted}...</span>`;
                div.onclick = () => {
                    smartSwitch('ai-panel');
                    toggleSearch();
                    setTimeout(() => {
                        switchAiTab(chatId);
                        const chatBody = document.getElementById(chatId);
                        if (chatBody) {
                            const content = chatBody.innerText.toLowerCase();
                            const matchIndex = content.indexOf(query);
                            if (matchIndex !== -1) {
                                chatBody.scrollTop = matchIndex * 2;
                            }
                        }
                    }, 100);
                };
                resultsCont.appendChild(div);
            }
        });

        if (resultsCont.innerHTML === '') {
            resultsCont.innerHTML = '<div style="padding:10px; font-size:10px; opacity:0.5;">NO_MATCHES_FOUND</div>';
        }
    }

function insertAtTerm(text, offset = 0) {
    if (!activeTermId) return;
    const input = document.getElementById(activeTermId).querySelector('.cmd-in');
    if (!input) return;

    const start = input.selectionStart;
    const end = input.selectionEnd;
    input.value = input.value.substring(0, start) + text + input.value.substring(end);

    const newPos = start + text.length - offset;
    input.focus();
    input.setSelectionRange(newPos, newPos);
}

async function editorAction(action) {
    if (!activeEditorTab || !editorTabs[activeEditorTab]) return;
    const editor = editorTabs[activeEditorTab].editor;
    
    // Monaco Editor
        if (editor.getValue) {
            if (action === 'selectAll') {
                const fullRange = editor.getModel().getFullModelRange();
                editor.setSelection(fullRange);
            } else if (action === 'copy') {
            let selection = editor.getSelection();
            if (!selection || selection.isEmpty()) {
                const saved = editorTabs[activeEditorTab].lastSelection;
                if (saved) {
                    selection = new monaco.Selection(saved.startLineNumber, saved.startColumn, saved.endLineNumber, saved.endColumn);
                }
            }
            const selectedText = editor.getModel().getValueInRange(selection);
            await navigator.clipboard.writeText(selectedText);
        } else if (action === 'cut') {
            let selection = editor.getSelection();
            if (!selection || selection.isEmpty()) {
                const saved = editorTabs[activeEditorTab].lastSelection;
                if (saved) {
                    selection = new monaco.Selection(saved.startLineNumber, saved.startColumn, saved.endLineNumber, saved.endColumn);
                }
            }
            const selectedText = editor.getModel().getValueInRange(selection);
            await navigator.clipboard.writeText(selectedText);
            editor.executeEdits('', [{ range: selection, text: '' }]);
        } else if (action === 'paste') {
            try {
                const text = await navigator.clipboard.readText();
                editor.trigger('keyboard', 'paste', { text: text });
            } catch (err) {
                addLog("PASTE_ERROR: Permission denied", "var(--term-red)");
            }
        }
    } else {
        // Textarea
        editor.focus();
        if (action === 'selectAll') {
            editor.select();
        } else if (action === 'copy') {
            const selectedText = editor.value.substring(editor.selectionStart, editor.selectionEnd);
            await navigator.clipboard.writeText(selectedText);
        } else if (action === 'cut') {
            const selectedText = editor.value.substring(editor.selectionStart, editor.selectionEnd);
            await navigator.clipboard.writeText(selectedText);
            const before = editor.value.substring(0, editor.selectionStart);
            const after = editor.value.substring(editor.selectionEnd);
            editor.value = before + after;
            editor.selectionStart = editor.selectionEnd = before.length;
        } else if (action === 'paste') {
            try {
                const text = await navigator.clipboard.readText();
                const before = editor.value.substring(0, editor.selectionStart);
                const after = editor.value.substring(editor.selectionEnd);
                editor.value = before + text + after;
                const newPos = before.length + text.length;
                editor.selectionStart = editor.selectionEnd = newPos;
            } catch (err) {
                addLog("PASTE_ERROR: Permission denied", "var(--term-red)");
            }
        }
    }
}

async function termAction(action) {
    if (!activeTermId) return;
    const input = document.getElementById(activeTermId).querySelector('.cmd-in');
    if (!input) return;
    input.focus();

    if (action === 'selectAll') {
        input.select();
    } else if (action === 'copy') {
        const selectedText = input.value.substring(input.selectionStart, input.selectionEnd);
        await navigator.clipboard.writeText(selectedText);
    } else if (action === 'cut') {
        const selectedText = input.value.substring(input.selectionStart, input.selectionEnd);
        await navigator.clipboard.writeText(selectedText);
        input.value = input.value.substring(0, input.selectionStart) + input.value.substring(input.selectionEnd);
    } else if (action === 'paste') {
        try {
            const text = await navigator.clipboard.readText();
            insertAtTerm(text);
        } catch (err) {
            console.error("Paste failed");
        }
    }
}

function execTermUndo() {
    if (!activeTermId) return;
    const input = document.getElementById(activeTermId).querySelector('.cmd-in');
    if (input) {
        input.focus();
        document.execCommand('undo', false, null);
    }
}
function insertAtCursor(text, offset = 0, isReturn = false) {
    if (activeEditorTab && editorTabs[activeEditorTab]) {
        const editor = editorTabs[activeEditorTab].editor;
        
        // Monaco Editor
        if (editor.getValue) {
            const position = editor.getPosition();
            const currentLine = editor.getModel().getLineContent(position.lineNumber);
            
            let contentToInsert = text;
            if (isReturn) {
                const trimStart = currentLine.search(/\S/);
                const indent = trimStart > 0 ? currentLine.substring(0, trimStart) : "";
                contentToInsert = '\n' + indent;
            }
            
            editor.trigger('keyboard', 'type', { text: contentToInsert });
            
            // 处理偏移
            if (offset > 0) {
                const newPos = editor.getPosition();
                editor.setPosition({ lineNumber: newPos.lineNumber, column: newPos.column - offset });
            }
        } else {
            // Textarea
            const el = editor;
            const start = el.selectionStart;
            const end = el.selectionEnd;
            const val = el.value;
            
            let contentToInsert = text;
            if (isReturn) {
                const line = val.substring(0, start).split('\n').pop();
                const trimStart = line.search(/\S/);
                const indent = trimStart > 0 ? line.substring(0, trimStart) : "";
                contentToInsert = '\n' + indent;
            }
            
            el.value = val.substring(0, start) + contentToInsert + val.substring(end);
            const newPos = start + contentToInsert.length - offset;
            el.focus();
            el.setSelectionRange(newPos, newPos);
        }
        
        autoSave();
    }
}


// 模拟 Ctrl/Shift 的复合功能（由于网页端限制，通常用于快速选择或快捷键）
function handleModifier(type) {
    const el = document.getElementById('editor');
    addLog(`[SYSTEM]: MODIFIER_${type}_ACTIVE`, 'var(--amber-dim)');
    el.focus();
    // 这里可以根据需求扩展，例如点击 Shift 后下次点击方向键变为选中模式
}
// 执行基础编辑命令 (Undo/Redo)
function execEditorCmd(cmd) {
    if (activeEditorTab && editorTabs[activeEditorTab]) {
        const editor = editorTabs[activeEditorTab].editor;
        
        // Monaco Editor
        if (editor.trigger) {
            if (cmd === 'undo') {
                editor.trigger('keyboard', 'undo', null);
            } else if (cmd === 'redo') {
                editor.trigger('keyboard', 'redo', null);
            } else if (cmd === 'selectAll') {
                editor.trigger('keyboard', 'selectAll', null);
            }
        } else {
            // Textarea
            editor.focus();
            document.execCommand(cmd, false, null);
        }
        
        autoSave();
    }
}

// 拦截物理 Tab 键 (如果是外接键盘)
function initEditorTabEvents() {
    const tabs = document.querySelectorAll('#editor-tabs .term-tab');
    tabs.forEach(tab => {
        const fileName = tab.id.replace('editor-tab-', '');
        tab.onclick = (e) => {
            // 避免点击关闭按钮时切换标签
            if (!e.target.closest('.term-close')) {
                switchEditorTab(fileName);
            }
        };
    });
}

function getLanguageFromFileName(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    const langMap = {
        'js': 'javascript',
        'py': 'python',
        'html': 'html',
        'css': 'css',
        'json': 'json',
        'txt': 'plaintext',
        'md': 'markdown',
        'xml': 'xml',
        'sql': 'sql',
        'java': 'java',
        'c': 'c',
        'cpp': 'cpp',
        'cs': 'csharp',
        'php': 'php',
        'rb': 'ruby',
        'go': 'go',
        'rs': 'rust',
        'sh': 'shell'
    };
    return langMap[ext] || 'plaintext';
}

    // --- Plugins Logic ---
    function renderPlugins() {
        const list = document.getElementById('plugin-list');
        list.innerHTML = '';
        plugins.forEach((p, index) => {
            const div = document.createElement('div');
            div.className = 'plugin-item';
            div.innerHTML = `
                <span>${p.name}</span>
                <div class="plugin-status ${p.active ? 'active' : ''}"></div>
            `;
            div.onclick = () => togglePlugin(index);
            div.oncontextmenu = (e) => {
                e.preventDefault();
                e.stopPropagation();
                pluginCtxTarget = index;
                showPluginCtx(e);
            };
            list.appendChild(div);
        });
        
        // 自动激活标记为激活的插件
        plugins.forEach((p, index) => {
            if (p.active && !p._cleanup) {
                try { 
                    const pluginReturn = new Function(p.code)(); 
                    plugins[index]._cleanup = typeof pluginReturn === 'function' ? pluginReturn : null;
                } catch(e) { console.error("PLUGIN_BOOT_ERR:", e); }
            }
        });
    }

    // 公共函数：防止菜单被窗口边界遮挡
    function positionMenu(menu, x, y) {
        const menuWidth = menu.offsetWidth;
        const menuHeight = menu.offsetHeight;
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        
        let left = x;
        let top = y;
        
        // 水平方向：如果菜单会超出右边界，向左偏移
        if (left + menuWidth > windowWidth) {
            left = Math.max(0, windowWidth - menuWidth - 10);
        }
        
        // 垂直方向：如果菜单会超出下边界，向上偏移
        if (top + menuHeight > windowHeight) {
            top = Math.max(0, windowHeight - menuHeight - 10);
        }
        
        menu.style.left = left + 'px';
        menu.style.top = top + 'px';
    }
    
    function showPluginCtx(e) {
        const pCtx = document.getElementById('plugin-ctx');
        pCtx.style.display = 'block';
        positionMenu(pCtx, e.pageX, e.pageY);
    }

    function startEditPlugin() {
        if (pluginCtxTarget === null) return;
        const p = plugins[pluginCtxTarget];
        document.getElementById('plugin-ctx').style.display = 'none';
        smartSwitch('editor-p');
        
        const pluginTabName = p.name;
        
        if (editorTabs[pluginTabName]) {
            switchEditorTab(pluginTabName);
        } else {
            createEditorTab(pluginTabName);
            let pluginCode = p.code;
            if (!pluginCode.includes("// 插件名称:")) {
                pluginCode = `// 插件名称: ${p.name}\n${pluginCode}`;
            }
            editorTabs[pluginTabName].editor.value = pluginCode;
        }
    }

    async function runCurrentFile() {
        if (!activeFile || activeFile.endsWith('/')) return;
        smartSwitch('terminal');
        autoSave();
        const fileName = activeFile.toLowerCase();
        if (!activeTermId) {
            addTerminal();
        }
        addLog(`[SYSTEM]: EXEC_START >> ${activeFile}`, 'var(--amber)');

        if (fileName.endsWith('.js')) {
            try {
                const code = storage[activeFile];
                new Function('console', code)({
                    log: (m) => addLog(m, 'var(--term-green)'),
                    error: (m) => addLog(`ERR: ${m}`, 'var(--term-red)')
                });
            } catch (e) {
                addLog(`RUNTIME_ERR: ${e.message}`, 'var(--term-red)');
            }
        } else if (fileName.endsWith('.py')) {
            try {
                addLog("INITIALIZING_PYTHON_WASM...", "var(--amber-dim)");
                const py = await initPython();
                py.setStdout({ batched: (str) => addLog(str, 'var(--term-green)') });
                await py.runPythonAsync(storage[activeFile]);
            } catch (e) {
                addLog(`PYTHON_ERR: ${e.message}`, 'var(--term-red)');
            }
        } else {
            addLog(`ERR: NO_EXECUTOR_FOR_EXTENSION (${activeFile.split('.').pop()})`, 'var(--term-red)');
        }
    }

    function renamePlugin() {
        if (pluginCtxTarget === null) return;
        const p = plugins[pluginCtxTarget];
        document.getElementById('plugin-ctx').style.display = 'none';
        
        const newName = prompt('输入新插件名：', p.name);
        if (newName && newName.trim() && newName !== p.name) {
            // 直接修改插件名，不是创建新插件
            p.name = newName.trim();
            savePlugins();
            
            // 如果插件正在编辑中，更新标签名
            if (editorTabs[p.name]) {
                const tab = editorTabs[p.name].tab;
                tab.innerHTML = `<span>${p.name}</span><span class="term-close" onclick="closeEditorTab('${p.name}')">×</span>`;
            }
        }
    }
    
    function confirmDeletePlugin() {
        if (pluginCtxTarget === null) return;
        if(confirm(`UNINSTALL ${plugins[pluginCtxTarget].name}?`)) {
            plugins.splice(pluginCtxTarget, 1);
            savePlugins();
        }
        document.getElementById('plugin-ctx').style.display = 'none';
    }

    function togglePlugin(index) {
        plugins[index].active = !plugins[index].active;
        if (plugins[index].active) {
            try { 
                const pluginReturn = new Function(plugins[index].code)(); 
                plugins[index]._cleanup = typeof pluginReturn === 'function' ? pluginReturn : null;
            } catch(e) { console.error("PLUGIN_BOOT_ERR:", e); }
        } else {
            if (plugins[index]._cleanup) {
                plugins[index]._cleanup();
            } else {
                console.log("REBOOT_REQUIRED: Plugin state persists.");
            }
        }
        savePlugins();
    }

    function savePlugins() {
        localStorage.setItem('ind_console_plugins', JSON.stringify(plugins));
        renderPlugins();
    }

    function openPluginModal() {
        // 创建新插件编辑标签
        const newPluginTabName = "New_Plugin";
        
        if (editorTabs[newPluginTabName]) {
            switchEditorTab(newPluginTabName);
        } else {
            createEditorTab(newPluginTabName);
            editorTabs[newPluginTabName].editor.value = "// 插件名称: 新插件\n";
        }
        
        // 全屏模式下切换到编辑面板
        if (document.querySelector('.panel.maximized')) {
            smartSwitch('editor-p');
        }
    }

    function confirmPlugin() {
        // 这个函数现在由编辑器自动保存替代，保留空实现
        console.log('插件创建已改为实时保存模式');
    }

    // --- Core Logic ---
    async function initPython() {
        if (!pyodideInstance) pyodideInstance = await loadPyodide();
        return pyodideInstance;
    }

    function saveCurrentFile() {
        if (activeEditorTab && editorTabs[activeEditorTab]) {
            const editor = editorTabs[activeEditorTab].editor;
            // 兼容Monaco Editor和textarea
            const content = editor.getValue ? editor.getValue() : editor.value;
            
            // 清除修改标记
            clearFileModified(activeEditorTab);
            
            // 判断是普通文件还是插件
            if (plugins.find(p => p.name === activeEditorTab) || activeEditorTab === "New_Plugin") {
                // 解析插件名（从代码中提取）
                let pluginName = activeEditorTab;
                
                // 尝试从代码中提取插件名
                const nameMatch = content.match(/\/\/\s*插件名[称]?[:：]\s*(.+)/i) || 
                                 content.match(/\/\/\s*Plugin[\s\w]*[:：]\s*(.+)/i);
                if (nameMatch && nameMatch[1]) {
                    pluginName = nameMatch[1].trim();
                }
                
                // 查找是否已存在同名插件
                const existingIndex = plugins.findIndex(p => p.name === pluginName);
                
                if (existingIndex !== -1) {
                    // 更新现有插件
                    plugins[existingIndex].code = content;
                    savePlugins();
                    renderPlugins();
                    
                    // 如果插件名改变，更新标签
                    if (pluginName !== activeEditorTab) {
                        updateEditorTabName(activeEditorTab, pluginName);
                    }
                } else {
                    // 创建新插件
                    if (content.trim()) {
                        plugins.push({ name: pluginName, code: content, active: false });
                        savePlugins();
                        renderPlugins();
                        
                        // 如果插件名改变，更新标签
                        if (pluginName !== activeEditorTab) {
                            updateEditorTabName(activeEditorTab, pluginName);
                        }
                    }
                }
            } else {
                // 保存普通文件
                storage[activeEditorTab] = content;
                localStorage.setItem('ind_console_storage', JSON.stringify(storage));
                // 同步到当前工作区的IndexedDB
                syncWorkspaceFileToDb();
            }
            
            // 保存当前活动标签
            localStorage.setItem('ind_console_active', activeEditorTab);
            localStorage.setItem('ind_console_expanded', JSON.stringify(expandedDirs));
            
            // 显示保存成功的提示
            console.log(`文件 ${activeEditorTab} 已保存`);
        }
    }
    
    function updateEditorTabName(oldName, newName) {
        if (editorTabs[oldName]) {
            // 更新标签对象
            editorTabs[newName] = editorTabs[oldName];
            delete editorTabs[oldName];
            
            // 更新标签DOM元素
            const tab = editorTabs[newName].tab;
            tab.id = 'editor-tab-' + newName;
            tab.innerHTML = `<span>${newName}</span><span class="term-close" onclick="closeEditorTab('${newName}')">×</span>`;
            tab.onclick = () => switchEditorTab(newName);
            
            // 更新活动标签
            if (activeEditorTab === oldName) {
                activeEditorTab = newName;
            }
        }
    }
    
    function autoSave() {
        // 保留函数但不再自动调用
        // 现在需要手动保存
    }
    
    function openFile(fileName) {
        // 检查文件是否已经在标签中打开
        if (editorTabs[fileName]) {
            // 如果已经打开，直接切换到该标签
            switchEditorTab(fileName);
        } else {
            // 创建新标签
            createEditorTab(fileName);
        }
        
        // 全屏模式下切换到编辑面板
        if (document.querySelector('.panel.maximized')) {
            smartSwitch('editor-p');
        }
    }
    
    function createEditorTab(fileName) {
        // 创建标签
        const tab = document.createElement('div');
        tab.className = 'term-tab';
        tab.id = 'editor-tab-' + fileName;
        tab.innerHTML = `<span><span class="modified-dot" style="display:none; margin-right: 3px;">•</span>${fileName}</span><span class="term-close" onclick="closeEditorTab('${fileName}')">×</span>`;
        tab.onclick = () => switchEditorTab(fileName);
        
        // 初始化文件状态
        fileModifiedState[fileName] = false;
        
        // 添加拖拽功能
        tab.setAttribute('draggable', 'true');
        tab.addEventListener('dragstart', handleTabDragStart);
        tab.addEventListener('dragover', handleTabDragOver);
        tab.addEventListener('drop', handleTabDrop);
        tab.addEventListener('dragend', handleTabDragEnd);
        
        document.getElementById('editor-tabs').appendChild(tab);
        
        // 记住打开的标签
        if (!openedTabs.includes(fileName)) {
            openedTabs.push(fileName);
            localStorage.setItem('ind_console_opened_tabs', JSON.stringify(openedTabs));
        }
        
        // 创建Monaco Editor容器
        const editorContainer = document.createElement('div');
        editorContainer.className = 'monaco-editor-container';
        editorContainer.id = 'editor-' + fileName;
        editorContainer.style.display = 'none';
        editorContainer.style.flex = '1';
        editorContainer.style.height = '100%';
        editorContainer.style.width = '100%';
        
        document.getElementById('editor-container').appendChild(editorContainer);
        
        // 获取文件内容
        const fileContent = plugins.find(p => p.name === fileName) ? 
            (plugins.find(p => p.name === fileName).code || '') : 
            (storage[fileName] || '');
        
        // 初始化Monaco Editor
        require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.47.0/min/vs' }});
        require(['vs/editor/editor.main'], function() {
            // 配置Monaco主题 - 使用CSS变量
        const style = getComputedStyle(document.documentElement);
        monaco.editor.defineTheme('console-theme', {
            base: 'vs-dark',
            inherit: true,
            rules: [
                { token: '', foreground: style.getPropertyValue('--amber').trim() || '#00ff9d' },
            ],
            colors: {
                'editor.background': style.getPropertyValue('--bg').trim() || '#050505',
                'editor.foreground': style.getPropertyValue('--amber').trim() || '#00ff9d',
                'editor.lineHighlightBackground': style.getPropertyValue('--panel-bg').trim() || '#0d0d0d',
                'editor.selectionBackground': style.getPropertyValue('--amber-dim').trim() || '#003320',
                'editor.inactiveSelectionBackground': style.getPropertyValue('--amber-dim').trim() || '#003320',
                'editorCursor.foreground': style.getPropertyValue('--amber').trim() || '#00ff9d',
                'editor.lineNumbers.foreground': style.getPropertyValue('--term-red').trim() || '#555',
                'editorGutter.background': style.getPropertyValue('--bg').trim() || '#050505',
                'editorIndentGuide.background': style.getPropertyValue('--panel-bg').trim() || '#0d0d0d',
                'editorIndentGuide.activeBackground': style.getPropertyValue('--amber').trim() || '#00ff9d',
            }
        });
            
            const editor = monaco.editor.create(editorContainer, {
                value: fileContent,
                language: getLanguageFromFileName(fileName),
                theme: 'console-theme',
                fontSize: 13,
                fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                automaticLayout: true,
                minimap: { enabled: true },
                scrollBeyondLastLine: false,
                wordWrap: 'off',
                lineNumbers: 'on',
                folding: true,
                renderWhitespace: 'selection',
                renderControlCharacters: true,
                scrollbar: {
                    verticalScrollbarSize: 6,
                    horizontalScrollbarSize: 6
                },
                contextmenu: false, // 必须禁用，否则长按弹出系统菜单会冲突
                quickSuggestions: false // 移动端建议框有时会遮挡选区
            });
            
            // 监听内容变化
            editor.onDidChangeModelContent(() => {
                markFileModified(fileName);
            });
            
            // 双竖杠移动端文本选中支持
            const startHandle = document.getElementById('handle-start');
            const endHandle = document.getElementById('handle-end');

            // 更新拉杆位置的函数
            function updateHandles() {
                const selection = editor.getSelection();
                if (!selection || selection.isEmpty()) {
                    startHandle.style.display = 'none';
                    endHandle.style.display = 'none';
                    return;
                }

                // 获取选区首尾的像素坐标
                const startPos = editor.getScrolledVisiblePosition(selection.getStartPosition());
                const endPos = editor.getScrolledVisiblePosition(selection.getEndPosition());

                if (startPos && endPos) {
                    const editorRect = editorContainer.getBoundingClientRect();
                    
                    startHandle.style.display = 'block';
                    startHandle.style.left = (editorRect.left + startPos.left) + 'px';
                    startHandle.style.top = (editorRect.top + startPos.top) + 'px';
                    startHandle.style.height = startPos.height + 'px';

                    endHandle.style.display = 'block';
                    endHandle.style.left = (editorRect.left + endPos.left) + 'px';
                    endHandle.style.top = (editorRect.top + endPos.top) + 'px';
                    endHandle.style.height = endPos.height + 'px';
                }
            }

            // 监听选区变化
            editor.onDidChangeCursorSelection(() => {
                updateHandles();
            });

            // 监听滚动，防止拉杆留在原位
            editor.onDidScrollChange(() => {
                updateHandles();
            });

            // 核心逻辑：实现拉杆的拖拽移动
            function makeHandleDraggable(handle, isStart) {
                handle.addEventListener('touchmove', (e) => {
                    e.preventDefault();
                    const touch = e.touches[0];
                    // 将触摸点转换回 Monaco 的行/列位置
                    const target = editor.getTargetAtClientPoint(touch.clientX, touch.clientY);
                    
                    if (target && target.position) {
                        const currentSel = editor.getSelection();
                        let newSel;
                        if (isStart) {
                            newSel = new monaco.Selection(
                                target.position.lineNumber, target.position.column,
                                currentSel.endLineNumber, currentSel.endColumn
                            );
                        } else {
                            newSel = new monaco.Selection(
                                currentSel.startLineNumber, currentSel.startColumn,
                                target.position.lineNumber, target.position.column
                            );
                        }
                        editor.setSelection(newSel);
                    }
                }, { passive: false });
            }

            makeHandleDraggable(startHandle, true);
            makeHandleDraggable(endHandle, false);

            // 辅助：双击或长按选中单词
            editor.onMouseDown((e) => {
                // Monaco 内部对长按有部分支持，这里确保 UI 能够及时响应
                setTimeout(updateHandles, 50);
            });

            // 解决 iOS 软键盘遮挡问题
            window.addEventListener('resize', () => {
                editor.layout();
                updateHandles();
            });

            // 编辑器失去焦点时清除选中和拉杆，避免切换到其他tab/点击外部后选区残留
            editor.onDidBlurEditorText(() => {
                // 保存当前选区，供 copy/cut 等操作使用
                const sel = editor.getSelection();
                if (sel && !sel.isEmpty()) {
                    editorTabs[fileName].lastSelection = {
                        startLineNumber: sel.startLineNumber,
                        startColumn: sel.startColumn,
                        endLineNumber: sel.endLineNumber,
                        endColumn: sel.endColumn
                    };
                }
                // 将选区折叠到光标位置（清空选中）
                const pos = editor.getPosition() || { lineNumber: 1, column: 1 };
                editor.setSelection(new monaco.Selection(pos.lineNumber, pos.column, pos.lineNumber, pos.column));
                startHandle.style.display = 'none';
                endHandle.style.display = 'none';
            });

            // 添加快捷键支持
            editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, function() {
                saveCurrentFile();
            });
            
            // 保存编辑器实例
            editorTabs[fileName] = {
                tab: tab,
                editor: editor,
                container: editorContainer
            };
            
            // 检查初始状态是否已修改
            const originalContent = plugins.find(p => p.name === fileName) ? 
                plugins.find(p => p.name === fileName).code : 
                storage[fileName] || '';
            if (editor.getValue() !== originalContent) {
                markFileModified(fileName);
            }
        });
        
        // 切换到新标签
        switchEditorTab(fileName);
        
        // 检查初始状态是否已修改（在Monaco Editor初始化回调中处理）
        
        initEditorTabEvents();
    }
    
    function switchEditorTab(fileName) {
        Object.keys(editorTabs).forEach(tabName => {
            const editorTab = editorTabs[tabName];
            if (editorTab.container) {
                editorTab.container.style.display = 'none';
            }
            editorTab.tab.classList.remove('active');
        });
        
        if (editorTabs[fileName]) {
            // 确保容器存在
            if (!editorTabs[fileName].container) {
                console.error('Editor container not found for', fileName);
                return;
            }
            
            editorTabs[fileName].container.style.display = 'block';
            editorTabs[fileName].tab.classList.add('active');
            if (editorTabs[fileName].editor) {
                editorTabs[fileName].editor.focus();
            }
            activeEditorTab = fileName;
            activeFile = fileName;
            localStorage.setItem('ind_console_active', fileName);
            
            // 显示/隐藏预览按钮
            const previewBtn = document.getElementById('preview-btn');
            if (previewBtn) {
                if (fileName.endsWith('.html') && !fileName.startsWith('[PREVIEW]')) {
                    previewBtn.style.display = 'flex';
                } else {
                    previewBtn.style.display = 'none';
                }
            }
        }
    }
    

    
    function markFileModified(fileName) {
        if (!fileModifiedState[fileName]) {
            fileModifiedState[fileName] = true;
            const tab = document.getElementById('editor-tab-' + fileName);
            if (tab) {
                const dot = tab.querySelector('.modified-dot');
                if (dot) dot.style.display = 'inline';
            }
        }
    }
    
    function clearFileModified(fileName) {
        if (fileModifiedState[fileName]) {
            fileModifiedState[fileName] = false;
            const tab = document.getElementById('editor-tab-' + fileName);
            if (tab) {
                const dot = tab.querySelector('.modified-dot');
                if (dot) dot.style.display = 'none';
            }
        }
    }
    
    function closeEditorTab(fileName) {
    const tabs = Object.keys(editorTabs);
    
    const tabInfo = editorTabs[fileName];
    const wasActive = tabInfo.tab.classList.contains('active');
    
    // 删除DOM元素
    tabInfo.tab.remove();
    
    // 正确销毁编辑器
    if (tabInfo.editor.dispose) {
        // Monaco编辑器
        tabInfo.editor.dispose();
    } else if (tabInfo.editor.parentNode) {
        // iframe或其他DOM元素
        tabInfo.editor.parentNode.removeChild(tabInfo.editor);
    }
    
    // 清理检查按钮
    if (tabInfo.inspectBtn && tabInfo.inspectBtn.parentNode) {
        tabInfo.inspectBtn.parentNode.removeChild(tabInfo.inspectBtn);
    }
    
    // 清理全屏按钮
    if (tabInfo.fullscreenBtn && tabInfo.fullscreenBtn.parentNode) {
        tabInfo.fullscreenBtn.parentNode.removeChild(tabInfo.fullscreenBtn);
    }
    
    // 恢复快捷键栏显示
    const editorTools = document.querySelector('.editor-tools');
    if (editorTools) {
        editorTools.style.display = 'flex';
    }
    
    document.body.classList.remove('preview-fullscreen');
    if (tabInfo.container.parentNode) {
        tabInfo.container.parentNode.removeChild(tabInfo.container);
    }
    delete editorTabs[fileName];
    if (!fileName.startsWith('[PREVIEW]')) {
        const index = openedTabs.indexOf(fileName);
        if (index !== -1) {
            openedTabs.splice(index, 1);
            localStorage.setItem('ind_console_opened_tabs', JSON.stringify(openedTabs));
        }
    }
    if (wasActive) {
        const remainingTabs = Object.keys(editorTabs);
        if (remainingTabs.length > 0) {
            switchEditorTab(remainingTabs[0]);
            initEditorTabEvents();
        }
    }
}

let draggedTab = null;

function handleTabDragStart(e) {
    draggedTab = this;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
    this.style.opacity = '0.4';
}

function handleTabDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleTabDrop(e) {
    e.stopPropagation();
    e.preventDefault();
    
    if (draggedTab !== this) {
        const tabsContainer = this.parentNode;
        const tabs = Array.from(tabsContainer.children);
        const fromIndex = tabs.indexOf(draggedTab);
        const toIndex = tabs.indexOf(this);
        if (fromIndex < toIndex) {
            tabsContainer.insertBefore(draggedTab, this.nextSibling);
        } else {
            tabsContainer.insertBefore(draggedTab, this);
        }
        const tabType = tabsContainer.id;
        if (tabType === 'editor-tabs') {
            reorderEditorTabs();
        } else if (tabType === 'ai-tabs') {
            reorderAiTabs();
        } else if (tabType === 'term-tabs') {
            reorderTermTabs();
        }
    }
    
    return false;
}

function handleTabDragEnd(e) {
    this.style.opacity = '1';
    draggedTab = null;
}

function reorderEditorTabs() {
    const tabs = Array.from(document.getElementById('editor-tabs').children);
    const container = document.getElementById('editor-container');
    
    // 重新排序编辑器
    tabs.forEach(tab => {
        const fileName = tab.id.replace('editor-tab-', '');
        const editor = editorTabs[fileName].editor;
        container.appendChild(editor);
    });
}

function reorderAiTabs() {
    const tabs = Array.from(document.getElementById('ai-tabs').children);
    const container = document.getElementById('ai-container');
    
    // 重新排序AI聊天窗口
    tabs.forEach(tab => {
        const chatId = tab.id.replace('tab-', '');
        const chatBody = document.getElementById(chatId);
        if (chatBody) {
            container.appendChild(chatBody);
        }
    });
}

function reorderTermTabs() {
    const tabs = Array.from(document.getElementById('term-tabs').children);
    const container = document.getElementById('term-container');
    
    // 重新排序终端窗口
    tabs.forEach(tab => {
        const termId = tab.id.replace('tab-', '');
        const termBody = document.getElementById(termId);
        if (termBody) {
            container.appendChild(termBody);
        }
    });
}

    function addLog(txt, color = 'var(--amber)') {
        if (activeTermId) {
            const output = document.getElementById(activeTermId).querySelector('.term-out');
            const d = document.createElement('div'); 
            d.style.color = color; 
            d.innerText = txt;
            output.appendChild(d); 
            output.scrollTop = output.scrollHeight;
        } else {
            console.log(txt);
        }
    }

    function initResizer(bar, target, isH, isInverse = false) {
        let dragging = false;
        bar.style.touchAction = 'none';

        const start = (e) => { 
            dragging = true; 
            bar.classList.add('active'); 
            if (e.cancelable) e.preventDefault(); 
        };

        const stop = () => { 
            dragging = false; 
            bar.classList.remove('active'); 
        };

        const move = (e) => {
            if (!dragging) return;
            let clientX, clientY;
            const touch = e.touches && e.touches[0];
            clientX = touch ? touch.clientX : e.clientX;
            clientY = touch ? touch.clientY : e.clientY;

            if (isH) {
                let p = (clientX / window.innerWidth) * 100;
                if (isInverse) p = 100 - p;
                p = Math.max(0, Math.min(100, p));
                target.style.width = p.toFixed(2) + '%'; 
                target.style.flex = "none"; 
            } else {
                let parentRect = target.parentNode.getBoundingClientRect();
                let p;
                if (isInverse) {
                    p = ((parentRect.bottom - clientY) / parentRect.height) * 100;
                } else {
                    p = ((clientY - parentRect.top) / parentRect.height) * 100;
                }
                p = Math.max(0, Math.min(99, p)); 
                
                target.style.height = p.toFixed(2) + '%';
                target.style.flex = "none"; 
                const nextEl = target.nextElementSibling?.classList.contains('divider-v') 
                               ? target.nextElementSibling.nextElementSibling 
                               : null;
                if (nextEl) {
                    nextEl.style.flex = "1";
                    nextEl.style.minHeight = "0px";
                }
            }
        };

        bar.addEventListener('mousedown', start);
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', stop);
        bar.addEventListener('touchstart', start, { passive: false });
        document.addEventListener('touchmove', move, { passive: false });
        document.addEventListener('touchend', stop);
    }

    function toggleMax(id) {
    const el = document.getElementById(id);
    if (!el) return;
    
    // 切换最大化类名
    const isMax = el.classList.toggle('maximized');
    
    if (isMax) {
        // 进入最大化：强制移除侧边栏对其高度和伸缩的限制
        // 使用 dataset 备份原始的行内样式，以便还原
        el.dataset.origHeight = el.style.height;
        el.dataset.origFlex = el.style.flex;
        
        // 强制全屏显示，!important 确保覆盖 HTML 标签上的 style="height: 50%"
        el.style.setProperty('height', '100vh', 'important');
        el.style.setProperty('flex', 'none', 'important');
        
        // 创建面板选择tab栏
        createPanelTabs(id);
        
        console.log(`Node ${id} 已进入真正的全屏模式`);
    } else {
        // 退出最大化：还原原始行内样式
        el.style.height = el.dataset.origHeight || '';
        el.style.flex = el.dataset.origFlex || '';
        
        // 移除面板选择tab栏
        removePanelTabs();
        
        console.log(`Node ${id} 已恢复至侧边栏`);
    }
}

// 创建面板选择tab栏
function createPanelTabs(currentPanelId) {
    // 移除已存在的tab栏
    removePanelTabs();
    
    const currentPanel = document.getElementById(currentPanelId);
    if (!currentPanel) return;
    
    const tabs = document.createElement('div');
    tabs.className = 'panel-tabs';
    tabs.id = 'panel-tabs';
    
    // 定义所有面板
    const panels = [
        { id: 'explorer', name: 'EXPLORER' },
        { id: 'editor-p', name: 'EDITOR' },
        { id: 'terminal', name: 'TERMINAL' },
        { id: 'ai-panel', name: 'AI' },
    ];
    
    panels.forEach(panel => {
        const tab = document.createElement('div');
        tab.className = 'panel-tab';
        if (panel.id === currentPanelId) {
            tab.classList.add('active');
        }
        tab.textContent = panel.name;
        tab.onclick = () => {
            if (panel.id !== currentPanelId) {
                switchToPanel(currentPanelId, panel.id);
            }
        };
        tabs.appendChild(tab);
    });
    
    currentPanel.appendChild(tabs);
}

// 移除面板选择tab栏
function removePanelTabs() {
    const existingTabs = document.getElementById('panel-tabs');
    if (existingTabs) {
        existingTabs.remove();
    }
}

// 切换到指定面板
function switchToPanel(fromPanelId, toPanelId) {
    // 退出当前面板全屏
    const currentPanel = document.getElementById(fromPanelId);
    if (currentPanel) {
        currentPanel.classList.remove('maximized');
        currentPanel.style.height = currentPanel.dataset.origHeight || '';
        currentPanel.style.flex = currentPanel.dataset.origFlex || '';
    }
    
    // 最大化目标面板
    toggleMax(toPanelId);
}

// 智能面板切换
function smartSwitch(targetPanelId) {
    const currentPanel = document.querySelector('.panel.maximized');
    if (currentPanel && currentPanel.id !== targetPanelId) {
        switchToPanel(currentPanel.id, targetPanelId);
    }
}

    // workspace管理
function toggleWorkspace() {
    const modal = document.getElementById('modal-overlay');
    const content = document.getElementById('modal-content');
    
    content.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <h3 style="margin: 0; color: var(--amber);">Workspace管理</h3>
            <span onclick="document.getElementById('modal-overlay').style.display = 'none'" 
                  style="cursor: pointer; color: var(--amber); font-size: 18px; padding: 5px;" 
                  title="关闭">×</span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 8px; max-height: 200px; overflow-y: auto;">
            ${workspaces.map(ws => `
                <div class="workspace-item ${ws.id === currentWorkspaceId ? 'active' : ''}" 
                     style="padding: 10px; border: 1px solid ${ws.id === currentWorkspaceId ? 'var(--amber)' : 'var(--amber-dim)'}; border-radius: 3px; display: flex; align-items: center; background: ${ws.id === currentWorkspaceId ? 'rgba(255, 176, 0, 0.1)' : 'transparent'};">
                    <div onclick="switchWorkspace('${ws.id}')" style="flex: 1; cursor: pointer;">
                        <div style="font-weight: bold; color: var(--amber);">${ws.name}</div>
                        <div style="font-size: 11px; color: var(--amber); opacity: 0.6;">${ws.path}</div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 5px; margin-left: 10px;">
                        ${ws.id !== 'default' ? `<span onclick="deleteWorkspace('${ws.id}'); event.stopPropagation();" style="color: #ff3e3e; cursor: pointer;" title="删除">×</span>` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
        
        <div style="margin-top: 15px;">
            <div style="display: flex; border-bottom: 1px solid var(--amber-dim); margin-bottom: 15px;">
                <button id="tab-local" class="tab-btn active" onclick="switchTab('local')" style="flex: 1; padding: 8px; background: var(--amber); color: #000; border: none; cursor: pointer;">添加Workspace</button>
                <button id="tab-github" class="tab-btn" onclick="switchTab('github')" style="flex: 1; padding: 8px; background: var(--amber-dim); color: var(--amber); border: none; cursor: pointer;">GitHub仓库</button>
            </div>
            
            <div id="tab-content-local" class="tab-content" style="display: block;">
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    <input type="text" id="workspace-name" class="modal-input" placeholder="Workspace名称" style="margin: 0;">
                    <input type="text" id="workspace-path" class="modal-input" placeholder="路径 (如: /path/to/project)" style="margin: 0;">
                    <button class="ai-btn" onclick="addWorkspace()" style="margin-top: 5px;">添加</button>
                </div>
            </div>
            
            <div id="tab-content-github" class="tab-content" style="display: none;">
            <div style="display: flex; flex-direction: column; gap: 8px;">
                <input type="text" id="github-repo" class="modal-input" placeholder="GitHub仓库 (如: username/repo)" style="margin: 0;">
                <input type="text" id="github-branch" class="modal-input" placeholder="分支 (默认: main)" style="margin: 0;">
                <input type="password" id="github-token" class="modal-input" placeholder="GitHub Token (推送时使用)" value="${githubToken}" style="margin: 0;">
                <div style="display: flex; gap: 8px;">
                    <button class="ai-btn" onclick="addGitHubWorkspace()" style="flex: 1;">导入</button>
                    <button class="ai-btn" onclick="pushToGitHub()" style="flex: 1; background: var(--amber); color: #000;">推送</button>
                </div>
            </div>
        </div>
        </div>
    `;
    
    modal.style.display = 'flex';
}

// 切换选项卡
function switchTab(tabName) {
    // 更新按钮状态
    document.getElementById('tab-local').classList.toggle('active', tabName === 'local');
    document.getElementById('tab-github').classList.toggle('active', tabName === 'github');
    
    // 更新按钮样式
    document.getElementById('tab-local').style.background = tabName === 'local' ? 'var(--amber)' : 'var(--amber-dim)';
    document.getElementById('tab-local').style.color = tabName === 'local' ? '#000' : 'var(--amber)';
    document.getElementById('tab-github').style.background = tabName === 'github' ? 'var(--amber)' : 'var(--amber-dim)';
    document.getElementById('tab-github').style.color = tabName === 'github' ? '#000' : 'var(--amber)';
    
    // 显示/隐藏内容区域
    document.getElementById('tab-content-local').style.display = tabName === 'local' ? 'block' : 'none';
    document.getElementById('tab-content-github').style.display = tabName === 'github' ? 'block' : 'none';
}

// 删除workspace
function deleteWorkspace(workspaceId) {
    if (workspaceId === 'default') {
        alert('不能删除默认工作区');
        return;
    }
    
    if (confirm('确定要删除这个workspace吗？')) {
        workspaces = workspaces.filter(ws => ws.id !== workspaceId);
        
        if (currentWorkspaceId === workspaceId) {
            currentWorkspaceId = 'default';
            switchWorkspace('default');
        }
        
        saveWorkspaces();
        if (db && db.objectStoreNames.contains('workspaces')) {
            const transaction = db.transaction('workspaces', 'readwrite');
            const store = transaction.objectStore('workspaces');
            store.delete(workspaceId);
        }
        toggleWorkspace();
        alert('Workspace已删除');
    }
}

// 推送到GitHub
async function pushToGitHub() {
    const repoInput = document.getElementById('github-repo');
    const branchInput = document.getElementById('github-branch');
    const tokenInput = document.getElementById('github-token');
    const repo = repoInput.value.trim();
    const branch = branchInput.value.trim() || 'main';
    const token = tokenInput.value.trim();
    
    if (!repo) {
        alert('请输入仓库地址');
        return;
    }
    
    if (token) {
        // 自动保存token
                githubToken = token;
                localStorage.setItem('ind_console_github_token', token);
    } else if (!githubToken) {
        alert('请输入GitHub Token');
        return;
    }
    
    const effectiveToken = token || githubToken;
    
    if (!repo.includes('/')) {
        alert('请输入完整的仓库地址 (如: username/repo)');
        return;
    }
    
    try {
        alert('开始推送文件到GitHub...');
        
        // 获取当前workspace的文件
        const currentWorkspace = workspaces.find(ws => ws.id === currentWorkspaceId);
        if (!currentWorkspace) {
            alert('没有找到当前workspace');
            return;
        }
        
        // 获取仓库的当前提交信息
        const commitsResponse = await fetch(`https://api.github.com/repos/${repo}/commits?sha=${branch}`, {
            headers: { 'Authorization': `token ${effectiveToken}` }
        });
        
        if (!commitsResponse.ok) {
            throw new Error('无法访问仓库，请检查Token权限');
        }
        
        const commits = await commitsResponse.json();
        const latestCommit = commits[0];
        
        // 使用Contents API逐个推送文件（更可靠）
        let pushedCount = 0;
        let failedFiles = [];
        
        for (const [path, content] of Object.entries(storage)) {
            if (!path.endsWith('/')) { // 只处理文件
                try {
                    // 检查文件是否存在
                    const checkResponse = await fetch(`https://api.github.com/repos/${repo}/contents/${path}?ref=${branch}`, {
                        headers: { 'Authorization': `token ${effectiveToken}` }
                    });
                    
                    let sha = null;
                    if (checkResponse.status === 200) {
                        const fileData = await checkResponse.json();
                        sha = fileData.sha; // 更新现有文件
                    }
                    
                    // 创建或更新文件
                    const pushResponse = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
                        method: 'PUT',
                        headers: {
                            'Authorization': `token ${effectiveToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            message: `Update ${path}`,
                            content: btoa(unescape(encodeURIComponent(content))),
                            branch: branch,
                            sha: sha
                        })
                    });
                    
                    if (pushResponse.ok) {
                        pushedCount++;
                    }
                } catch (error) {
                    failedFiles.push({ path, error: error.message });
                }
            }
        }
        
        alert(`成功推送到 ${repo}:${branch} (${pushedCount}个文件)`);
        
    } catch (error) {
        console.error('GitHub推送失败:', error);
        alert(`推送失败: ${error.message}`);
    }
}

// 切换workspace
function switchWorkspace(workspaceId) {
    const targetWorkspace = workspaces.find(ws => ws.id === workspaceId);
    if (!targetWorkspace) return;
    
    // 保存当前workspace的文件状态
    const currentWorkspace = workspaces.find(ws => ws.id === currentWorkspaceId);
    if (currentWorkspace) {
        currentWorkspace.files = {...storage};
    }
    
    // 确保默认工作区的文件存在
    const defaultWorkspace = workspaces.find(ws => ws.id === 'default');
    if (defaultWorkspace && !defaultWorkspace.files) {
        defaultWorkspace.files = {};
    }
    
    // 切换到目标workspace
    currentWorkspaceId = workspaceId;
    
    // 更新文件系统
    Object.keys(storage).forEach(key => {
        delete storage[key];
    });
    Object.assign(storage, targetWorkspace.files || {});
    
    // 同步到localStorage和IndexedDB
    localStorage.setItem('ind_console_storage', JSON.stringify(storage));
    saveWorkspaces();
    saveSetting('currentWorkspaceId', currentWorkspaceId);
    
    // 清除所有编辑器tab
    Object.keys(editorTabs).forEach(fileName => {
        const tabInfo = editorTabs[fileName];
        if (tabInfo.editor && tabInfo.editor.dispose) {
            tabInfo.editor.dispose();
        }
        if (tabInfo.container && tabInfo.container.parentNode) {
            tabInfo.container.parentNode.removeChild(tabInfo.container);
        }
        delete editorTabs[fileName];
    });
    const tabContainer = document.getElementById('editor-tabs');
    while (tabContainer.firstChild) {
        tabContainer.removeChild(tabContainer.firstChild);
    }
    openedTabs = [];
    localStorage.setItem('ind_console_opened_tabs', JSON.stringify(openedTabs));
    activeEditorTab = null;
    renderFiles();
    document.getElementById('modal-overlay').style.display = 'none';
    addLog(`[SYSTEM]: SWITCHED_TO_WORKSPACE >> ${targetWorkspace.name}`, 'var(--term-green)');
}

// 添加workspace
function addWorkspace() {
    const nameInput = document.getElementById('workspace-name');
    const pathInput = document.getElementById('workspace-path');
    const name = nameInput.value.trim();
    const path = pathInput.value.trim();
    
    if (!name || !path) {
        alert('请输入名称和路径');
        return;
    }
    
    // 创建新workspace
    const newWorkspace = {
        id: 'workspace_' + Date.now(),
        name: name,
        path: path,
        files: {
            'README.md': `# ${name}\n\nWorkspace路径: ${path}\n\n创建时间: ${new Date().toLocaleString()}`,
            'main.js': 'console.log("Hello from new workspace");',
            'style.css': '/* 新的样式文件 */',
            'utils/helper.js': '// 工具函数文件'
        }
    };
    
    // 添加到workspaces列表
    workspaces.push(newWorkspace);
    
    saveWorkspaces();
    
    // 清空输入框
    nameInput.value = '';
    pathInput.value = '';
    
    // 关闭工作区管理面板，切换到新工作区
    toggleWorkspace();
    switchWorkspace(newWorkspace.id);
    
    addLog(`[SYSTEM]: ADDED_WORKSPACE >> ${name}`, 'var(--term-green)');
}

// 从GitHub导入workspace
async function addGitHubWorkspace() {
    const repoInput = document.getElementById('github-repo');
    const branchInput = document.getElementById('github-branch');
    const repo = repoInput.value.trim();
    const branch = branchInput.value.trim() || 'main';
    
    if (!repo) {
        alert('请输入GitHub仓库地址');
        return;
    }
    
    if (!repo.includes('/')) {
        alert('请输入完整的仓库地址 (如: username/repo)');
        return;
    }
    
    try {
        addLog('[SYSTEM]: 正在从GitHub下载仓库内容...', 'var(--amber)');
        
        // 获取仓库信息
        const repoInfoResponse = await fetch(`https://api.github.com/repos/${repo}`);
        if (!repoInfoResponse.ok) {
            throw new Error('仓库不存在或无法访问');
        }
        const repoInfo = await repoInfoResponse.json();
        
        // 获取仓库文件树
        const treeResponse = await fetch(`https://api.github.com/repos/${repo}/git/trees/${branch}?recursive=1`);
        if (!treeResponse.ok) {
            throw new Error('无法获取仓库文件树');
        }
        const treeData = await treeResponse.json();
        
        // 分离文件和文件夹
        const allItems = treeData.tree || [];
        const files = allItems.filter(item => item.type === 'blob');
        const folders = allItems.filter(item => item.type === 'tree');
        
        // 只排除.git目录，其他文件由.gitignore管理
        const codeFiles = files.filter(file => !file.path.includes('.git/'));
        
        // 检查是否已存在同名仓库
        const existingWorkspace = workspaces.find(ws => ws.path === `github:${repo}/${branch}`);
        let targetWorkspace;
        if (existingWorkspace) {
            // 更新已有仓库
            existingWorkspace.name = repoInfo.name || repo.split('/')[1];
            existingWorkspace.files = {};
            targetWorkspace = existingWorkspace;
        } else {
            // 创建新workspace
            const newWorkspace = {
                id: 'github_' + Date.now(),
                name: repoInfo.name || repo.split('/')[1],
                path: `github:${repo}/${branch}`,
                files: {}
            };
            workspaces.push(newWorkspace);
            targetWorkspace = newWorkspace;
        }
        
        // 首先创建所有文件夹
        folders.forEach(folder => {
            targetWorkspace.files[folder.path + '/'] = ''; // 空字符串表示文件夹
        });
        
        // 下载文件内容
        let downloadedCount = 0;
        for (const file of codeFiles) {
            try {
                const fileResponse = await fetch(`https://raw.githubusercontent.com/${repo}/${branch}/${file.path}`);
                if (fileResponse.ok) {
                    const content = await fileResponse.text();
                    targetWorkspace.files[file.path] = content;
                    downloadedCount++;
                }
            } catch (error) {
                console.warn(`无法下载文件: ${file.path}`, error);
            }
        }
        
        // 添加README文件说明
        targetWorkspace.files['README.md'] = `# ${repoInfo.name}\n\n从GitHub导入的仓库: ${repo}\n\n分支: ${branch}\n导入时间: ${new Date().toLocaleString()}\n\n文件数: ${downloadedCount}`;
        
        // 保存到localStorage
        saveWorkspaces();
        
        // 清空输入框
        repoInput.value = '';
        branchInput.value = '';
        
        // 关闭工作区管理面板，切换到新工作区
        toggleWorkspace();
        switchWorkspace(targetWorkspace.id);
        
        addLog(`[SYSTEM]: 成功${existingWorkspace ? '更新' : '导入'}GitHub仓库: ${repoInfo.name} (${downloadedCount}个文件)`, 'var(--term-green)');
        
    } catch (error) {
        console.error('GitHub导入失败:', error);
        addLog(`[SYSTEM]: 导入失败: ${error.message}`, 'var(--term-red)');
    }
}

function toggleExplorerMax(sectionId) {
        const explorer = document.getElementById('explorer');
        const fileSection = document.getElementById('file-section');
        const pluginSection = document.getElementById('plugin-section');
        const divider = document.getElementById('v-drag-explorer');
        
        // 检查是否已经最大化
        const isMax = explorer.classList.contains('maximized');
        
        if (isMax) {
            // 退出最大化：还原所有样式
            explorer.classList.remove('maximized');
            explorer.style.width = explorer.dataset.origWidth || '';
            explorer.style.flex = explorer.dataset.origFlex || '';
            
            // 移除面板选择tab栏
            removePanelTabs();
            
            // 还原文件系统和插件系统的显示
            fileSection.style.display = 'flex';
            pluginSection.style.display = 'flex';
            divider.style.display = 'block';
            
            // 显示其他面板和分割线
            document.getElementById('main-stack').style.display = 'flex';
            document.getElementById('h-drag-left').style.display = 'block';
            document.getElementById('h-drag-right').style.display = 'block';
            document.getElementById('ai-panel').style.display = 'flex';
            
            console.log(`Explorer 已恢复`);
        } else {
            // 进入最大化：备份原始样式
            explorer.dataset.origWidth = explorer.style.width;
            explorer.dataset.origFlex = explorer.style.flex;
            
            // 强制全屏显示
            explorer.classList.add('maximized');
            explorer.style.setProperty('width', '100vw', 'important');
            explorer.style.setProperty('flex', 'none', 'important');
            
            // 根据点击的section隐藏另一个section
            if (sectionId === 'file-section') {
                fileSection.style.display = 'flex';
                pluginSection.style.display = 'none';
                divider.style.display = 'none';
            } else if (sectionId === 'plugin-section') {
                fileSection.style.display = 'none';
                pluginSection.style.display = 'flex';
                divider.style.display = 'none';
            }
            
            // 隐藏其他面板和分割线
            document.getElementById('main-stack').style.display = 'none';
            document.getElementById('h-drag-left').style.display = 'none';
            document.getElementById('h-drag-right').style.display = 'none';
            document.getElementById('ai-panel').style.display = 'none';
            
            console.log(`${sectionId} 已进入全屏模式`);
        }
    }
    
    function renderFiles() {
        const list = document.getElementById('file-list');
        list.innerHTML = '';
        
        const sortedKeys = Object.keys(storage).sort((a,b) => {
            const aDir = a.includes('/') ? 0 : 1;
            const bDir = b.includes('/') ? 0 : 1;
            return aDir - bDir || a.localeCompare(b);
        });

        sortedKeys.forEach(k => {
            const isFolder = k.endsWith('/');
            const pathParts = k.split('/').filter(p => p);
            const depth = pathParts.length - 1;
            
            if (depth > 0) {
                let parentPath = "";
                for(let i=0; i<depth; i++) {
                    parentPath += pathParts[i] + "/";
                    if (!expandedDirs.includes(parentPath)) return;
                }
            }

            const div = document.createElement('div');
            div.className = `file-item ${k === activeFile ? 'active' : ''} ${isFolder ? 'folder' : ''}`;
            div.style.paddingLeft = (15 + depth * 15) + 'px';
            
            const nameSpan = document.createElement('span');
            nameSpan.innerText = pathParts[pathParts.length-1] + (isFolder ? '/' : '');
            div.appendChild(nameSpan);
            
            div.onclick = () => {
                autoSave();
                activeFile = k;
                if (isFolder) {
                    if (expandedDirs.includes(k)) {
                        expandedDirs = expandedDirs.filter(d => d !== k);
                    } else {
                        expandedDirs.push(k);
                    }
                } else {
                    openFile(k);
                    smartSwitch('editor-p'); // 智能切换到编辑器
                }
                renderFiles();
            };
            
            div.oncontextmenu = (e) => {
                e.preventDefault();
                e.stopPropagation();
                ctxTarget = { path: k, el: nameSpan, isFolder: isFolder };
                handleCtx(e);
            };
            list.appendChild(div);
        });
        updateAiCtxOptions();
    }

    function startRenameFromCtx() {
        if (!ctxTarget) return;
        document.getElementById('ctx').style.display = 'none';
        const { el, path, isFolder } = ctxTarget;
        const currentName = el.innerText.replace(/\/$/, '');
        const input = document.createElement('input');
        input.className = 'file-rename-input';
        input.value = currentName;
        el.parentNode.replaceChild(input, el);
        input.focus();
        input.onblur = () => {
            const newName = input.value.trim();
            if (newName && newName !== currentName) applyRename(path, newName, isFolder);
            else renderFiles();
        };
        input.onkeydown = (e) => { if (e.key === 'Enter') input.blur(); };
    }

    function applyRename(oldPath, newName, isFolder) {
        let newPath;
        const parts = oldPath.split('/');
        if (isFolder) {
            parts[parts.length - 2] = newName.replace(/\//g, '');
            newPath = parts.join('/');
            Object.keys(storage).forEach(key => {
                if (key.startsWith(oldPath)) {
                    storage[newPath + key.substring(oldPath.length)] = storage[key];
                    delete storage[key];
                }
            });
        } else {
            parts[parts.length - 1] = newName;
            newPath = parts.join('/');
            storage[newPath] = storage[oldPath];
            delete storage[oldPath];
        }
        if (activeFile === oldPath) activeFile = newPath;
        
        if (editorTabs[oldPath]) {
            editorTabs[newPath] = editorTabs[oldPath];
            delete editorTabs[oldPath];
            const tab = editorTabs[newPath].tab;
            tab.innerHTML = `<span>${newName}</span><span class="term-close" onclick="closeEditorTab('${newPath}')">×</span>`;
            if (activeEditorTab === oldPath) {
                activeEditorTab = newPath;
            }
        }
        
        localStorage.setItem('ind_console_storage', JSON.stringify(storage));
        localStorage.setItem('ind_console_active', activeFile);
        localStorage.setItem('ind_console_expanded', JSON.stringify(expandedDirs));
        
        renderFiles();
    }

    function deleteNodeFromCtx() {
        if (!ctxTarget) return;
        const { path, isFolder } = ctxTarget;
        
        // 检查文件是否存在
        if (!isFolder && !storage[path]) {
            alert(`ERROR: File ${path} not found`);
            return;
        }
        
        if (confirm(`PURGE NODE: ${path}?`)) {
            if (isFolder) {
                Object.keys(storage).forEach(k => {
                    if (k.startsWith(path)) delete storage[k];
                });
                expandedDirs = expandedDirs.filter(dir => !dir.startsWith(path));
            } else {
                delete storage[path];
            }
            
            if (editorTabs[path]) {
                closeEditorTab(path);
            }
            
            if (activeFile === path) {
                activeFile = null;
                localStorage.removeItem('ind_console_active');
            }
            
            localStorage.setItem('ind_console_storage', JSON.stringify(storage));
            localStorage.setItem('ind_console_expanded', JSON.stringify(expandedDirs));
            
            ctxTarget = null;
            
            renderFiles();
            document.getElementById('ctx').style.display = 'none';
        }
    }

    function copyPathFromCtx() {
        if (ctxTarget) {
            navigator.clipboard.writeText(ctxTarget.path);
            document.getElementById('ctx').style.display = 'none';
        }
    }

    let selectedAiCtxs = []; // 支持多选
    
    // 对话历史记忆
    let chatHistory = JSON.parse(localStorage.getItem('ind_console_chat_history')) || {}; // 存储每个聊天窗口的对话历史
    
    // 每个聊天的请求状态
    let chatRequestStates = {}; // 存储每个聊天窗口的请求状态
    
    // workspace管理 - 使用IndexedDB存储
    let workspaces = [{ id: 'default', name: '默认工作区', path: '/code', files: {...storage} }];
    let currentWorkspaceId = 'default';
    let githubToken = localStorage.getItem('ind_console_github_token') || '';
    
    // 初始化IndexedDB
    const dbName = 'WorkspaceDB';
    const dbVersion = 1;
    let db;
    
    const request = indexedDB.open(dbName, dbVersion);
    
    request.onupgradeneeded = (event) => {
        db = event.target.result;
        if (!db.objectStoreNames.contains('workspaces')) {
            db.createObjectStore('workspaces', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('settings')) {
            db.createObjectStore('settings', { keyPath: 'key' });
        }
    };
    
    request.onsuccess = (event) => {
        db = event.target.result;
        loadWorkspaces();
        loadSettings();
    };
    
    // 加载workspaces
    function loadWorkspaces() {
        if (!db.objectStoreNames.contains('workspaces')) {
            return;
        }
        
        const transaction = db.transaction('workspaces', 'readonly');
        const store = transaction.objectStore('workspaces');
        const request = store.getAll();
        
        request.onsuccess = (event) => {
            workspaces = event.target.result.length > 0 ? event.target.result : [{ id: 'default', name: '默认工作区', path: '/code', files: {...storage} }];
        };
    }
    
    // 保存workspaces
    function saveWorkspaces() {
        if (!db.objectStoreNames.contains('workspaces')) {
            return;
        }
        
        const transaction = db.transaction('workspaces', 'readwrite');
        const store = transaction.objectStore('workspaces');
        
        workspaces.forEach(workspace => {
            store.put(workspace);
        });
    }
    
    // 加载设置
    function loadSettings() {
        if (!db.objectStoreNames.contains('settings')) {
            return;
        }
        
        const transaction = db.transaction('settings', 'readonly');
        const store = transaction.objectStore('settings');
        
        const currentWorkspaceRequest = store.get('currentWorkspaceId');
        
        currentWorkspaceRequest.onsuccess = (event) => {
            if (event.target.result) {
                currentWorkspaceId = event.target.result.value;
            }
        };
    }
    
    // 保存设置
    function saveSetting(key, value) {
        if (!db.objectStoreNames.contains('settings')) {
            return;
        }
        
        const transaction = db.transaction('settings', 'readwrite');
        const store = transaction.objectStore('settings');
        store.put({ key, value });
    }
    
    function syncWorkspaceFileToDb() {
        const targetWorkspace = workspaces.find(ws => ws.id === currentWorkspaceId);
        if (!targetWorkspace || !db.objectStoreNames.contains('workspaces')) return;
        
        targetWorkspace.files = {...storage};
        
        const transaction = db.transaction('workspaces', 'readwrite');
        const store = transaction.objectStore('workspaces');
        store.put(targetWorkspace);
    }

    function updateAiCtxOptions() {
        const container = document.getElementById('ai-ctx-options');
        container.innerHTML = `<div onclick="selectAiCtx('none')">-- NO_CONTEXT --</div>`;
        Object.keys(storage).forEach(k => {
            if (!k.endsWith('/')) {
                const div = document.createElement('div');
                div.innerText = k;
                div.style.cursor = 'pointer';
                if (selectedAiCtxs.includes(k)) {
                    div.style.background = 'var(--amber)';
                    div.style.color = 'var(--bg)';
                }
                div.onclick = (e) => {
                    e.stopPropagation();
                    toggleAiCtx(k);
                };
                container.appendChild(div);
            }
        });
    }

    function toggleAiCtx(val) {
        if (val === 'none') {
            selectedAiCtxs = [];
        } else {
            const index = selectedAiCtxs.indexOf(val);
            if (index > -1) {
                selectedAiCtxs.splice(index, 1);
            } else {
                selectedAiCtxs.push(val);
            }
        }
        updateAiCtxDisplay();
        updateAiCtxOptions(); // 重新渲染选项以更新高亮显示
    }

    function updateAiCtxDisplay() {
        const displayText = selectedAiCtxs.length === 0 ? '-- NO_CONTEXT --' : 
                           selectedAiCtxs.length === 1 ? selectedAiCtxs[0] : 
                           `[${selectedAiCtxs.length} SELECTED]`;
        document.getElementById('ai-ctx-val').innerText = displayText;
    }

    function selectAiCtx(val) {
        selectedAiCtxs = val === 'none' ? [] : [val];
        updateAiCtxDisplay();
        document.getElementById('ai-ctx-options').style.display = 'none';
    }

    function addTerminal() {
    const id = 'term-' + (++termCount);
    
    // 创建标签
    const tab = document.createElement('div');
    tab.className = 'term-tab';
    tab.id = 'tab-' + id;
    tab.innerHTML = `<span>TERM_${termCount}</span><span class="term-close" onclick="removeTerminal(event, '${id}')">×</span>`;
    tab.onclick = () => switchTerminal(id);
    
    // 添加拖拽功能
    tab.setAttribute('draggable', 'true');
    tab.addEventListener('dragstart', handleTabDragStart);
    tab.addEventListener('dragover', handleTabDragOver);
    tab.addEventListener('drop', handleTabDrop);
    tab.addEventListener('dragend', handleTabDragEnd);
    
    document.getElementById('term-tabs').appendChild(tab);
        const body = document.createElement('div');
        body.className = 'term-body'; body.id = id;
        body.innerHTML = `<div class="term-out">Terminal ${termCount} Ready.</div><div class="term-input-wrap"><span>>></span><input type="text" class="cmd-in" autocomplete="off" spellcheck="false"><button class="ai-btn" onclick="handleCommand('${id}')">SEND</button></div>`;
        body.querySelector('.cmd-in').onkeydown = (e) => { if(e.key === 'Enter') handleCommand(id); };
        document.getElementById('term-container').appendChild(body);
        switchTerminal(id);
    }

    function removeTerminal(e, id) {
        e.stopPropagation();
        const tabs = document.querySelectorAll('#term-tabs .term-tab'); 
        const tab = document.getElementById('tab-' + id);
        const body = document.getElementById(id);
        const wasActive = tab.classList.contains('active');
        
        tab.remove();
        body.remove();
        
        if (wasActive) {
            const nextTab = document.querySelector('#term-tabs .term-tab');
            if (nextTab) switchTerminal(nextTab.id.replace('tab-', ''));
        }
    }

    function switchTerminal(id) {
        document.querySelectorAll('.term-tab, .term-body').forEach(el => el.classList.remove('active'));
        document.getElementById('tab-' + id).classList.add('active');
        document.getElementById(id).classList.add('active');
        activeTermId = id;
        const input = document.getElementById(id).querySelector('.cmd-in');
        if(input) input.focus();
    }

    // 终端模式切换
    let terminalMode = 'custom'; // 'custom' (默认) 或 'local'
    
    function toggleTerminalMode() {
        terminalMode = terminalMode === 'local' ? 'custom' : 'local';
        const btn = document.getElementById('terminal-mode-btn');
        btn.textContent = terminalMode === 'local' ? 'C' : 'L';
        addLog(`SWITCHED_TO_${terminalMode.toUpperCase()}_MODE`, 'var(--amber)');
    }
    
    async function handleCommand(id) {
        const body = document.getElementById(id);
        const input = body.querySelector('.cmd-in');
        const output = body.querySelector('.term-out');
        const val = input.value.trim();
        if(!val) return;
        const log = (txt, color = 'rgba(255,176,0,0.8)') => {
            const d = document.createElement('div'); d.style.color = color; d.innerText = txt;
            output.appendChild(d); output.scrollTop = output.scrollHeight;
        };
        log(`>> ${val}`, '#fff');
        
        // 本地终端模式
        if (terminalMode === 'local') {
            try {
                // 调用本地终端服务
                const response = await fetch('http://localhost:5001/api/terminal/execute', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ command: val, mode: 'local' })
                });
                const data = await response.json();
                if (data.output) log(data.output, 'var(--term-green)');
                if (data.error) log(data.error, 'var(--term-red)');
            } catch (e) {
                log(`ERR: ${e.message}`, 'var(--term-red)');
            }
            input.value = '';
            return;
        }
        
        // 默认前端执行模式
        const args = val.split(' '), cmd = args[0].toLowerCase(), fileName = args[1];
        switch(cmd) {
            case 'help':
                log('AVAILABLE_COMMANDS: ls, cat, rm, touch, mkdir, pwd, echo, date, whoami, info, clear, node, python, ssh', 'var(--amber)');
                log('SSH Usage: ssh user@host[:port] [password]', 'var(--amber)');
                break;

            case 'cat': // 查看文件内容
                if (storage[fileName]) log(storage[fileName]);
                else log(`ERR: NODE_NOT_FOUND: ${fileName}`, 'var(--term-red)');
                break;

            case 'touch': // 创建空文件
                if (fileName) {
                    if (!storage[fileName]) {
                        storage[fileName] = "";
                        renderFiles();
                        log(`SUCCESS: NODE_CREATED: ${fileName}`, 'var(--term-green)');
                    } else {
                        log(`ERR: NODE_EXISTS`, 'var(--term-red)');
                    }
                }
                break;

            case 'mkdir': // 创建目录
                if (fileName) {
                    let dirName = fileName.endsWith('/') ? fileName : fileName + '/';
                    storage[dirName] = "DIR";
                    renderFiles();
                    log(`SUCCESS: DIR_CREATED: ${dirName}`, 'var(--term-green)');
                }
                break;

            case 'rm': // 删除文件/目录
                if (storage[fileName]) {
                    delete storage[fileName];
                    localStorage.setItem('ind_console_storage', JSON.stringify(storage));
                    renderFiles();
                    log(`SUCCESS: NODE_PURGED: ${fileName}`, 'var(--term-red)');
                } else {
                    log(`ERR: NODE_NOT_FOUND`, 'var(--term-red)');
                }
                break;

            case 'pwd': // 显示当前路径 (模拟)
                log(activeFile.includes('/') ? activeFile.substring(0, activeFile.lastIndexOf('/') + 1) : 'ROOT/');
                break;

            case 'echo': // 输出文本
                log(args.slice(1).join(' '));
                break;

            case 'date': // 显示系统时间
                log(new Date().toString());
                break;

            case 'whoami': // 用户信息
                log('IMMMOR_OPERATOR::ROOT', 'var(--amber)');
                break;

            case 'info': // 存储统计
                const count = Object.keys(storage).length;
                const size = JSON.stringify(storage).length;
                log(`NODES: ${count} | TOTAL_SIZE: ${size} bytes | STATUS: OPTIMAL`);
                break;
            case 'ls': log(Object.keys(storage).join('    ')); break;
            case 'clear': output.innerHTML = ''; break;
            case 'node':
                try {
                    new Function('console', storage[fileName])({ log: (m) => log(m) });
                } catch (e) { log(`ERR: ${e.message}`, 'var(--term-red)'); }
                break;
            case 'python':
                const py = await initPython();
                py.setStdout({ batched: (str) => log(str, 'var(--term-green)') });
                await py.runPythonAsync(storage[fileName]);
                break;
            case 'ssh':
                // SSH连接命令格式: ssh user@host[:port] [password]
                if (args.length < 2) {
                    log('Usage: ssh user@host[:port] [password]', 'var(--term-red)');
                    break;
                }
                
                const sshTarget = args[1];
                const sshPassword = args[2] || null;
                
                // 解析SSH连接信息
                const match = sshTarget.match(/^(\w+)@([\w.-]+)(?::(\d+))?$/);
                if (!match) {
                    log('ERR: Invalid SSH format. Use: user@host[:port]', 'var(--term-red)');
                    break;
                }
                
                const [, user, host, port = '22'] = match;
                
                log(`Connecting to ${user}@${host}:${port}...`, 'var(--amber)');
                
                // 尝试使用WebSocket进行真正的SSH连接
                try {
                    await connectSSH(user, host, parseInt(port), sshPassword, id);
                } catch (err) {
                    log(`SSH Connection failed: ${err.message}`, 'var(--term-red)');
                    log('Falling back to simulated SSH...', 'var(--amber)');
                    
                    // 如果WebSocket连接失败，使用模拟SSH
                    simulateSSHConnection(user, host, port, id);
                }
                break;
                
            default: log(`ERR: UNKNOWN_CMD`, 'var(--term-red)');
        }
        input.value = '';
    }
    
    // WebSocket SSH连接函数
    async function connectSSH(user, host, port, password, termId) {
        const body = document.getElementById(termId);
        const output = body.querySelector('.term-out');
        const input = body.querySelector('.cmd-in');
        const log = (txt, color = 'rgba(255,176,0,0.8)') => {
            const d = document.createElement('div'); d.style.color = color; d.innerText = txt;
            output.appendChild(d); output.scrollTop = output.scrollHeight;
        };
        
        // 创建WebSocket连接
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.host}/ssh-proxy`;
        
        const ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
            log('WebSocket connected. Establishing SSH tunnel...', 'var(--term-green)');
            // 发送SSH连接参数
            ws.send(JSON.stringify({
                type: 'ssh_connect',
                user, host, port, password
            }));
        };
        
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'ssh_output') {
                log(data.output, 'var(--term-green)');
            } else if (data.type === 'ssh_error') {
                log(`SSH Error: ${data.error}`, 'var(--term-red)');
            }
        };
        
        ws.onerror = (error) => {
            log(`WebSocket error: ${error.message}`, 'var(--term-red)');
            throw new Error('WebSocket connection failed');
        };
        
        // 设置SSH命令输入
        const originalOnKeyDown = input.onkeydown;
        input.onkeydown = (e) => {
            if (e.key === 'Enter') {
                const command = input.value.trim();
                if (command === 'exit') {
                    ws.send(JSON.stringify({ type: 'ssh_disconnect' }));
                    ws.close();
                    input.onkeydown = originalOnKeyDown;
                    log('SSH connection closed.', 'var(--amber)');
                } else {
                    ws.send(JSON.stringify({ type: 'ssh_command', command }));
                }
                input.value = '';
            }
        };
    }
    
    // 模拟SSH连接（当WebSocket不可用时）
    function simulateSSHConnection(user, host, port, termId) {
        const body = document.getElementById(termId);
        const output = body.querySelector('.term-out');
        const input = body.querySelector('.cmd-in');
        const log = (txt, color = 'rgba(255,176,0,0.8)') => {
            const d = document.createElement('div'); d.style.color = color; d.innerText = txt;
            output.appendChild(d); output.scrollTop = output.scrollHeight;
        };
        
        log(`Connected to ${host} as ${user}`, 'var(--term-green)');
        log('Welcome to Simulated SSH Terminal', 'var(--amber)');
        log('Type \'exit\' to disconnect', 'var(--amber)');
        log(`${user}@${host}:~$ `, '#fff');
        
        // 保存原始事件处理
        const originalOnKeyDown = input.onkeydown;
        
        // 模拟SSH命令处理
        input.onkeydown = (e) => {
            if (e.key === 'Enter') {
                const command = input.value.trim();
                
                if (command === 'exit') {
                    input.onkeydown = originalOnKeyDown;
                    log('Connection to host closed.', 'var(--amber)');
                    log('>> ', '#fff');
                } else if (command === 'ls') {
                    log('bin  etc  home  lib  tmp  usr  var');
                } else if (command === 'pwd') {
                    log('/home/' + user);
                } else if (command === 'whoami') {
                    log(user);
                } else if (command.startsWith('echo ')) {
                    log(command.substring(5));
                } else if (command === 'date') {
                    log(new Date().toString());
                } else if (command === 'uname -a') {
                    log('Linux simulated-server 5.15.0-generic #1 SMP Mon Oct 3 14:28:35 UTC 2022 x86_64 GNU/Linux');
                } else {
                    log(`bash: ${command}: command not found`, 'var(--term-red)');
                }
                
                if (command !== 'exit') {
                    log(`${user}@${host}:~$ `, '#fff');
                }
                input.value = '';
            }
        };
    }

    function openModal() {
        const isFolder = activeFile && activeFile.endsWith('/');
        const parentDir = activeFile ? (isFolder ? activeFile : (activeFile.includes('/') ? activeFile.substring(0, activeFile.lastIndexOf('/') + 1) : '')) : '';
        
        document.getElementById('modal-title').innerText = "CREATE_NEW";
        document.getElementById('modal-content').innerHTML = `
            <div style="font-size:9px; color:var(--amber-dim); margin-bottom:10px;">TARGET_PATH: ${parentDir || 'ROOT/'}</div>
            <div class="type-selector" style="margin-bottom:15px;">
                <label class="type-opt"><input type="radio" name="ntype" value="file" checked> FILE</label>
                <label class="type-opt"><input type="radio" name="ntype" value="folder"> DIR</label>
                <label class="type-opt"><input type="radio" name="ntype" value="github"> GITHUB</label>
            </div>
            <div id="modal-content-area">
                <input type="text" id="modal-input" class="modal-input" placeholder="NAME" autocomplete="off">
            </div>
            <div class="modal-btns">
                <button class="ai-btn" onclick="closeModal()">CANCEL</button>
                <button class="ai-btn" style="background:var(--amber); color:#000" onclick="handleModalConfirm('${parentDir}')">CONFIRM</button>
            </div>`;
        
        // 监听类型切换
        document.querySelectorAll('input[name="ntype"]').forEach(radio => {
            radio.addEventListener('change', updateModalContent);
        });
        
        document.getElementById('modal-overlay').style.display = 'flex';
        document.getElementById('modal-input').focus();
        updateModalContent();
    }
    
    function updateModalContent() {
        const type = document.querySelector('input[name="ntype"]:checked').value;
        const contentArea = document.getElementById('modal-content-area');
        
        if (type === 'github') {
            contentArea.innerHTML = `
                <input type="text" id="github-url" class="modal-input" placeholder="GitHub URL" style="margin-bottom:5px;">
                <input type="text" id="save-filename" class="modal-input" placeholder="Save as filename">
            `;
            
            // 自动填充文件名
            document.getElementById('github-url').addEventListener('input', function() {
                const url = this.value.trim();
                if (url) {
                    const filename = url.split('/').pop();
                    document.getElementById('save-filename').value = filename;
                }
            });
        } else {
            contentArea.innerHTML = '<input type="text" id="modal-input" class="modal-input" placeholder="NAME" autocomplete="off">';
        }
    }
    
    function handleModalConfirm(parentDir) {
        const type = document.querySelector('input[name="ntype"]:checked').value;
        
        if (type === 'github') {
            importFromGithub();
        } else {
            confirmModal(parentDir);
        }
    }

    function confirmModal(parentDir) {
        let name = document.getElementById('modal-input').value.trim();
        const type = document.querySelector('input[name="ntype"]:checked').value;
        if (name) {
            let finalPath = parentDir + name;
            if (type === 'folder') { 
                if (!finalPath.endsWith('/')) finalPath += '/'; 
                storage[finalPath] = "DIR"; 
                activeFile = finalPath;
            } else { 
                storage[finalPath] = ""; 
                activeFile = finalPath;
                createEditorTab(finalPath);
                
                if (document.querySelector('.panel.maximized')) {
                    smartSwitch('editor-p');
                }
            }
            
            localStorage.setItem('ind_console_storage', JSON.stringify(storage));
            localStorage.setItem('ind_console_active', activeFile);
            
            renderFiles(); 
            closeModal();
        }
    }

    function closeModal() { document.getElementById('modal-overlay').style.display = 'none'; }
    function toggleAiSelect() { 
    const opt = document.getElementById('ai-ctx-options');
    const trigger = document.getElementById('ai-ctx-trigger');
    
    document.getElementById('ai-provider-options').style.display = 'none';
    document.getElementById('ai-provider-trigger').classList.remove('active');
    
    const isOpening = opt.style.display !== 'block';
    opt.style.display = isOpening ? 'block' : 'none';
    trigger.classList.toggle('active', isOpening);
}
    
    function openSettings() {
    document.getElementById('modal-title').innerText = "AI_PROVIDERS_CONFIG";
    
    let providersHtml = config.providers.map((p, i) => `
        <div style="border: 1px solid var(--amber-dim); padding: 10px; margin-bottom: 10px; position: relative;">
            <div style="font-size: 10px; margin-bottom: 5px; color: ${config.activeProviderIndex === i ? 'var(--term-green)' : 'var(--amber)'}">
                ${config.activeProviderIndex === i ? '[ACTIVE_NODE]' : 'NODE_' + i}
            </div>
            <input type="text" placeholder="NAME" class="modal-input" style="margin:2px 0" value="${p.name}" onchange="updateProvider(${i}, 'name', this.value)">
            <input type="text" placeholder="BASE_URL" class="modal-input" style="margin:2px 0" value="${p.apiBaseUrl}" onchange="updateProvider(${i}, 'apiBaseUrl', this.value)">
            <input type="text" placeholder="MODEL" class="modal-input" style="margin:2px 0" value="${p.model}" onchange="updateProvider(${i}, 'model', this.value)">
            <input type="password" placeholder="API_KEY" class="modal-input" style="margin:2px 0" value="${p.apiKey}" onchange="updateProvider(${i}, 'apiKey', this.value)">
            
            <div style="display:flex; gap: 10px; margin-top: 5px;">
                <button class="ai-btn" onclick="config.activeProviderIndex = ${i}; openSettings();">ACTIVATE</button>
                <button class="ai-btn" style="color:var(--term-red)" onclick="deleteProvider(${i})">DELETE</button>
            </div>
        </div>
    `).join('');

    document.getElementById('modal-content').innerHTML = `
        <div style="max-height: 400px; overflow-y: auto;">
            ${providersHtml}
            <button class="ai-btn" style="width:100%; border: 1px dashed var(--amber); margin-top:10px;" onclick="addProvider()">+ ADD_NEW_PROVIDER</button>
            <button class="ai-btn" style="width:100%; border: 1px dashed var(--term-green); margin-top:10px;" onclick="importProviders()">IMPORT_FROM_JSON</button>
        </div>
        <div class="modal-btns">
            <button class="ai-btn" onclick="closeModal()">CLOSE</button>
            <button class="ai-btn" style="background:var(--amber); color:#000" onclick="saveSettings()">SAVE_TO_DISK</button>
        </div>`;
    document.getElementById('modal-overlay').style.display = 'flex';
}

function updateProvider(index, field, value) {
    config.providers[index][field] = value;
}

function addProvider() {
    config.providers.push({ name: 'New Provider', apiBaseUrl: '', apiKey: '', model: '' });
    openSettings();
}

function deleteProvider(index) {
    if (config.providers.length <= 1) return alert("MINIMUM_ONE_PROVIDER_REQUIRED");
    config.providers.splice(index, 1);
    if (config.activeProviderIndex >= config.providers.length) config.activeProviderIndex = 0;
    openSettings();
}

function importProviders() {
    const jsonStr = prompt("PASTE_PROVIDERS_JSON:");
    if (!jsonStr) return;
    try {
        const imported = JSON.parse(jsonStr);
        if (Array.isArray(imported)) {
            config.providers = [...config.providers, ...imported];
        } else if (typeof imported === 'object' && imported.providers) {
            config.providers = [...config.providers, ...imported.providers];
        } else {
            throw new Error("INVALID_FORMAT");
        }
        openSettings();
    } catch (e) {
        alert(`IMPORT_ERROR: ${e.message}`);
    }
}

function saveSettings() {
    localStorage.setItem('ind_console_config', JSON.stringify(config)); 
    closeModal();
}

function renderProviderOptions() {
    const container = document.getElementById('ai-provider-options');
    container.innerHTML = '';
    
    config.providers.forEach((p, i) => {
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.justifyContent = 'space-between';
        
        const isChecked = selectedProviderIndices.includes(i);
        
        div.innerHTML = `
            <span>${isChecked ? '[X]' : '[ ]'} ${p.name}</span>
            <span style="font-size:8px; opacity:0.5">${p.model}</span>
        `;
        
        if (i === config.activeProviderIndex) div.style.color = 'var(--term-green)';

        div.onclick = (e) => {
            e.stopPropagation(); // 防止触发全局点击关闭
            toggleProviderSelection(i);
        };
        container.appendChild(div);
    });
}

function toggleProviderSelection(index) {
    // 只支持单个供应商，直接切换
    config.activeProviderIndex = index;
    selectedProviderIndices = [index];
    renderProviderOptions();
    updateProviderDisplay();
}

// 修改显示文字，提示选中了几个
function updateProviderDisplay() {
    const el = document.getElementById('active-provider-name');
    if (!el) return;
    
    const p = config.providers[config.activeProviderIndex];
    el.innerText = p ? p.name : 'NONE';
    el.style.color = 'var(--term-green)';
}

function toggleProviderSelect() {
    const opt = document.getElementById('ai-provider-options');
    const trigger = document.getElementById('ai-provider-trigger');
    
    document.getElementById('ai-ctx-options').style.display = 'none';
    document.getElementById('ai-ctx-trigger').classList.remove('active');
    
    const isOpening = opt.style.display !== 'block';
    opt.style.display = isOpening ? 'block' : 'none';
    trigger.classList.toggle('active', isOpening);
    
    if (isOpening) renderProviderOptions();
}

function selectProvider(index) {
    config.activeProviderIndex = index;
    localStorage.setItem('ind_console_config', JSON.stringify(config));
    updateProviderDisplay();
    document.getElementById('ai-provider-options').style.display = 'none';
    document.getElementById('ai-provider-trigger').classList.remove('active');
    addLog(`[SYSTEM]: SWITCHED_TO_PROVIDER >> ${config.providers[index].name}`, 'var(--term-green)');
}

    function newAiChat() {
        if (confirm("START NEW CONVERSATION? (Current view will be cleared)")) {
            addAiTab();
            document.getElementById('ai-in').focus();
        }
    }
    let aiCount = 0;
    let activeAiId = null;

function copyPrompt(element, query) {
    navigator.clipboard.writeText(query).then(() => {
        const originalText = element.textContent;
        element.textContent = '✓ Copied';
        setTimeout(() => element.textContent = originalText, 1000);
    }).catch(err => console.error('Failed to copy:', err));
}

function bindAiMessageButtons(container) {
    container.addEventListener('click', (e) => {
        const btn = e.target.closest('.inject-btn, .copy-btn, .run-btn');
        if (!btn) return;
        
        const blockId = btn.getAttribute('data-code');
        if (!blockId?.startsWith('code-block-')) return;
        
        const msgElement = btn.closest('.msg.ai');
        if (!msgElement) return;
        
        const blockIndex = parseInt(blockId.replace('code-block-', ''));
        const code = JSON.parse(msgElement.dataset.codeBlocks || '[]')[blockIndex];
        if (!code) return;
        
        if (btn.classList.contains('inject-btn')) {
            // 只在全屏模式下切换到编辑面板
            const currentPanel = document.querySelector('.panel.maximized');
            if (currentPanel) {
                // 在全屏模式下，使用智能切换到编辑面板
                smartSwitch('editor-p');
                // 等待面板切换完成后再注入代码
                setTimeout(() => {
                    injectCodeToEditor(code);
                }, 100);
            } else {
                // 非全屏模式下直接注入代码
                injectCodeToEditor(code);
            }
        } else if (btn.classList.contains('run-btn')) {
            // 执行bash命令
            executeBashCommands(code);
        } else if (btn.classList.contains('copy-btn')) {
            navigator.clipboard.writeText(code).then(() => {
                const originalText = btn.textContent;
                btn.textContent = 'Done';
                setTimeout(() => btn.textContent = originalText, 2000);
            }).catch(err => console.error('Failed to copy:', err));
        }
    });
}

// 执行bash命令
function executeBashCommands(code) {
    // 只在全屏模式下切换到终端面板
    const currentPanel = document.querySelector('.panel.maximized');
    if (currentPanel) {
        // 在全屏模式下，使用智能切换到终端面板
        smartSwitch('terminal');
        // 等待面板切换完成后再执行命令
        setTimeout(() => {
            executeCommands(code);
        }, 100);
    } else {
        // 非全屏模式下直接执行命令
        executeCommands(code);
    }
}

// 将代码插入到编辑器的函数
function injectCodeToEditor(code) {
    if (!activeEditorTab || !editorTabs[activeEditorTab]) {
        console.warn('No active editor tab found');
        return;
    }
    
    const editor = editorTabs[activeEditorTab].editor;
    
    // 检查编辑器类型并正确插入代码
    if (editor.getValue) {
        // Monaco编辑器
        const selection = editor.getSelection();
        const range = new monaco.Range(
            selection.positionLineNumber,
            selection.positionColumn,
            selection.positionLineNumber,
            selection.positionColumn
        );
        
        // 在光标位置插入代码
        editor.executeEdits("ai-inject", [{
            range: range,
            text: "\n" + code,
            forceMoveMarkers: true
        }]);
    } else if (editor.setValue) {
        // 其他编辑器类型，使用setValue
        const currentValue = editor.getValue();
        editor.setValue(currentValue + "\n" + code);
    } else if (typeof editor === 'string') {
        // 简单的textarea
        editor.value += "\n" + code;
    }
    
    markFileModified(activeEditorTab);
    addLog(`[AI]: Code injected into ${activeEditorTab}`, 'var(--term-green)');
}

// HTML预览功能
function previewHtmlFile() {
    if (!activeEditorTab || !editorTabs[activeEditorTab]) return;
    
    const htmlContent = editorTabs[activeEditorTab].editor.getValue();
    const previewFileName = `[P] ${activeEditorTab}`;
    
    if (editorTabs[previewFileName]) {
        switchEditorTab(previewFileName);
        return;
    }
    
    const previewTab = document.createElement('div');
    previewTab.className = 'term-tab';
    previewTab.id = `editor-tab-${previewFileName}`;
    previewTab.innerHTML = `<span>${previewFileName}</span><span class="term-close" onclick="closeEditorTab('${previewFileName}')">×</span>`;
    
    const previewContainer = document.createElement('div');
    previewContainer.className = 'term-body';
    previewContainer.style.position = 'relative';
    
    const iframe = document.createElement('iframe');
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.style.background = '#fff'; // 确保背景为白色
    
    // 为移动端添加视口meta标签
    const mobileViewport = '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">';
    const enhancedHtml = htmlContent.replace('<head>', '<head>' + mobileViewport);
    
    iframe.srcdoc = enhancedHtml;
    
    // 创建检查按钮
    const inspectBtn = document.createElement('div');
    inspectBtn.className = 'ctrl';
    inspectBtn.style.position = 'absolute';
    inspectBtn.style.top = '10px';
    inspectBtn.style.right = '50px';
    inspectBtn.style.zIndex = '1000';
    inspectBtn.innerText = '⌕';
    inspectBtn.title = 'INSPECT ELEMENTS';
    
    inspectBtn.onclick = () => {
        if (iframe.contentWindow) {
            // 尝试打开开发者工具
            iframe.contentWindow.document.body.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // 获取点击的元素
                const element = e.target;
                const tagName = element.tagName.toLowerCase();
                const className = element.className;
                const id = element.id;
                
                // 显示元素信息
                const info = document.createElement('div');
                info.style.position = 'absolute';
                info.style.top = '50px';
                info.style.right = '10px';
                info.style.zIndex = '1001';
                info.style.background = 'var(--amber)';
                info.style.color = '#000';
                info.style.padding = '10px';
                info.style.borderRadius = '3px';
                info.style.fontSize = '12px';
                info.style.maxWidth = '300px';
                info.innerHTML = `
                    <strong>Element:</strong> &lt;${tagName}&gt;<br>
                    <strong>Class:</strong> ${className || 'none'}<br>
                    <strong>ID:</strong> ${id || 'none'}
                `;
                
                // 移除之前的信息
                const oldInfo = previewContainer.querySelector('.element-info');
                if (oldInfo) oldInfo.remove();
                
                // 添加新信息
                info.className = 'element-info';
                previewContainer.appendChild(info);
            }, { once: true });
        }
    };
    
    // 创建全屏按钮
    const fullscreenBtn = document.createElement('div');
    fullscreenBtn.className = 'ctrl';
    fullscreenBtn.style.position = 'absolute';
    fullscreenBtn.style.top = '10px';
    fullscreenBtn.style.right = '10px';
    fullscreenBtn.style.zIndex = '1000';
    fullscreenBtn.innerText = '◰';
    fullscreenBtn.title = 'FULLSCREEN';
    
    // 全屏切换函数
    function togglePreviewFullscreen() {
        const isFullscreen = document.body.classList.contains('preview-fullscreen');
        const displayValue = isFullscreen ? '' : 'none';
        
        document.body.classList.toggle('preview-fullscreen', !isFullscreen);
        fullscreenBtn.innerText = isFullscreen ? '◰' : '◱';
        fullscreenBtn.title = isFullscreen ? 'FULLSCREEN' : 'EXIT FULLSCREEN';
        
        // 切换除预览界面外的所有内容显示
        document.querySelectorAll('.panel').forEach(panel => {
            if (panel.id !== 'editor-p') {
                panel.style.display = displayValue;
            }
        });
        document.querySelectorAll('.divider-v, .divider-h').forEach(divider => {
            divider.style.display = displayValue;
        });
        document.querySelector('.header').style.display = displayValue;
        
        // 切换编辑器的标题栏、tab栏和快捷键显示
    const pHead = document.querySelector('#editor-p .p-head');
    const editorTabsEl = document.querySelector('#editor-tabs');
    const panelTabs = document.querySelector('#panel-tabs');
    const editorTools = document.querySelector('.editor-tools');
    
    if (pHead) pHead.style.display = displayValue;
    if (editorTabsEl) editorTabsEl.style.display = displayValue;
    if (panelTabs) panelTabs.style.display = displayValue;
    if (editorTools) editorTools.style.display = displayValue;
    }
    
    fullscreenBtn.onclick = togglePreviewFullscreen;
    
    previewContainer.appendChild(iframe);
    previewContainer.appendChild(inspectBtn);
    previewContainer.appendChild(fullscreenBtn);
    
    // 添加到编辑器
    document.getElementById('editor-tabs').appendChild(previewTab);
    document.getElementById('editor-container').appendChild(previewContainer);
    
    // 保存到编辑器标签
    editorTabs[previewFileName] = {
        tab: previewTab,
        container: previewContainer,
        editor: iframe,
        inspectBtn: inspectBtn,
        fullscreenBtn: fullscreenBtn
    };
    
    // 隐藏快捷键栏
    const editorTools = document.querySelector('.editor-tools');
    if (editorTools) {
        editorTools.style.display = 'none';
    }
    
    // 手动绑定点击事件
    previewTab.onclick = (e) => {
        if (!e.target.closest('.term-close')) {
            switchEditorTab(previewFileName);
        }
    };
    
    // 切换到预览标签页
    switchEditorTab(previewFileName);
    initEditorTabEvents();
}

// 执行命令的实际逻辑
function executeCommands(code) {
    // 将命令按行分割，过滤掉空行和注释
    const commands = code.split('\n')
        .filter(line => line.trim() && !line.trim().startsWith('#'))
        .map(line => line.trim());
    
    if (commands.length === 0) return;
    
    // 依次执行每个命令
    let currentIndex = 0;
    
    function executeNext() {
        if (currentIndex >= commands.length) return;
        
        const command = commands[currentIndex];
        
        // 像用户手动输入一样执行命令
        if (activeTermId) {
            const input = document.getElementById(activeTermId).querySelector('.cmd-in');
            if (input) {
                // 设置输入框的值并触发命令执行
                input.value = command;
                handleCommand(activeTermId);
                
                // 等待命令执行完成后再执行下一个
                setTimeout(() => {
                    currentIndex++;
                    executeNext();
                }, 500);
            }
        }
    }
    
    executeNext();
}

// 取消AI请求
function cancelAiRequest() {
    if (currentAiRequest) {
        currentAiRequest.abort();
        currentAiRequest = null;
    }
    resetSendButton(activeAiId);
}

// 重置发送按钮状态
function resetSendButton(chatId = null) {
    const sendBtn = document.getElementById('ai-send-btn');
    if (sendBtn) {
        const targetChatId = chatId || activeAiId;
        if (targetChatId && chatRequestStates[targetChatId]) {
            chatRequestStates[targetChatId] = null;
            
            // 移除对应tab的加载效果
            const tab = document.getElementById('tab-' + targetChatId);
            if (tab && tab.classList.contains('loading')) {
                tab.classList.remove('loading');
                const idNum = targetChatId.replace('ai-chat-', '');
                tab.innerHTML = `<span>CHAT_${idNum}</span><span class="term-close" onclick="removeAiTab(event, '${targetChatId}')">×</span>`;
            }
        }
        sendBtn.textContent = 'SEND';
        sendBtn.style.background = ''; // 恢复默认样式
    }
}

// 更新发送按钮状态
function updateSendButton() {
    const sendBtn = document.getElementById('ai-send-btn');
    if (sendBtn && activeAiId) {
        if (chatRequestStates[activeAiId]) {
            sendBtn.textContent = 'CANC';
            sendBtn.style.background = '#ff3e3e';
        } else {
            sendBtn.textContent = 'SEND';
            sendBtn.style.background = '';
        }
    }
}

// 页面加载时恢复聊天窗口
function restoreAiTabs() {
    // 获取所有保存的聊天历史记录
    const savedChats = Object.keys(aiChatHistory);
    
    if (savedChats.length > 0) {
        // 找到最大的聊天ID来确定aiCount
        const maxId = Math.max(...savedChats.map(id => parseInt(id.replace('ai-chat-', ''))));
        aiCount = maxId;
        
        // 为每个保存的聊天记录创建标签
        savedChats.forEach(chatId => {
            const idNum = parseInt(chatId.replace('ai-chat-', ''));
            
            // 1. 创建标签
            const tab = document.createElement('div');
            tab.className = 'term-tab'; 
            tab.id = 'tab-' + chatId;
            tab.innerHTML = `<span>CHAT_${idNum}</span><span class="term-close" onclick="removeAiTab(event, '${chatId}')">×</span>`;
            tab.onclick = () => switchAiTab(chatId);
            
            // 添加拖拽功能
            tab.setAttribute('draggable', 'true');
            tab.addEventListener('dragstart', handleTabDragStart);
            tab.addEventListener('dragover', handleTabDragOver);
            tab.addEventListener('drop', handleTabDrop);
            tab.addEventListener('dragend', handleTabDragEnd);
            
            document.getElementById('ai-tabs').appendChild(tab);

            // 2. 创建聊天内容区
            const body = document.createElement('div');
            body.className = 'term-body'; 
            body.id = chatId;
            body.style.padding = '15px';
            body.style.overflowY = 'auto';
            body.style.flex = '1';
            
            if (aiChatHistory[chatId] && aiChatHistory[chatId].length > 0) {
                body.innerHTML = aiChatHistory[chatId].join('');
                bindAiMessageButtons(body);
                
                // 重新绑定Copy按钮事件
                body.querySelectorAll('.copy-ai-btn').forEach(btn => {
                    btn.addEventListener('click', function() {
                        const content = this.getAttribute('data-content') || '';
                        copyAiResponse(this, content);
                    });
                });
            }
            
            document.getElementById('ai-container').appendChild(body);
        });
        
        activeAiId = savedChats[0];
        switchAiTab(activeAiId);
    } else {
        addAiTab(false);
    }
}

function addAiTab(forceNew = true) {
    const id = 'ai-chat-' + (++aiCount);
    const tab = document.createElement('div');
    tab.className = 'term-tab'; 
    tab.id = 'tab-' + id;
    const currentP = config.providers[config.activeProviderIndex];
    const label = currentP ? currentP.name.substring(0, 8) : aiCount;
    tab.innerHTML = `<span>CHAT_${aiCount}</span><span class="term-close" onclick="removeAiTab(event, '${id}')">×</span>`;
    tab.onclick = () => switchAiTab(id);
    
    // 添加拖拽功能
    tab.setAttribute('draggable', 'true');
    tab.addEventListener('dragstart', handleTabDragStart);
    tab.addEventListener('dragover', handleTabDragOver);
    tab.addEventListener('drop', handleTabDrop);
    tab.addEventListener('dragend', handleTabDragEnd);
    
    document.getElementById('ai-tabs').appendChild(tab);

    // 2. 创建聊天内容区 (复用原本的 ai-chat 结构)
    const body = document.createElement('div');
    body.className = 'term-body'; // 使用 term-body 的 display:none 逻辑
    body.id = id;
    body.style.padding = '15px';
    body.style.overflowY = 'auto';
    body.style.flex = '1';
    
    if (!forceNew && aiChatHistory[id] && aiChatHistory[id].length > 0) {
        body.innerHTML = aiChatHistory[id].join('');
        body.querySelectorAll('.inject-btn').forEach(btn => {
            btn.onclick = () => {
                const code = btn.getAttribute('data-code');
                if (activeEditorTab && editorTabs[activeEditorTab] && code) {
                    editorTabs[activeEditorTab].editor.value += "\n" + code;
                    markFileModified(activeEditorTab);
                }
            };
        });
    } else {
        if (forceNew) {
            aiChatHistory[id] = [];
            localStorage.setItem('ind_console_ai_history', JSON.stringify(aiChatHistory));
        }
    }
    
    document.getElementById('ai-container').appendChild(body);
    
    activeAiId = id; 
    switchAiTab(id);
    return id;
}

function switchAiTab(id) {
    document.querySelectorAll('#ai-tabs .term-tab').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('#ai-container .term-body').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-' + id).classList.add('active');
    const body = document.getElementById(id);
    body.classList.add('active');
    
    activeAiId = id;
    updateSendButton(); // 更新发送按钮状态
    document.getElementById('ai-in').focus();
}

function removeAiTab(e, id) {
    e.stopPropagation();
    const tabs = document.querySelectorAll('#ai-tabs .term-tab');
    if (tabs.length <= 1) return; // 至少保留一个
    
    const tab = document.getElementById('tab-' + id);
    const body = document.getElementById(id);
    const wasActive = tab.classList.contains('active');
    delete aiChatHistory[id];
    localStorage.setItem('ind_console_ai_history', JSON.stringify(aiChatHistory));
    
    tab.remove();
    body.remove();
    
    if (wasActive) {
        const nextTab = document.querySelector('#ai-tabs .term-tab');
        if (nextTab) switchAiTab(nextTab.id.replace('tab-', ''));
    }
}

function openHistoryManager() {
    const modal = document.getElementById('modal-overlay');
    const modalContent = document.getElementById('modal-content');
    
    modal.style.display = 'flex';
    document.getElementById('modal-title').innerText = 'AI CONVERSATION HISTORY';
    
    // 清空内容
    modalContent.innerHTML = '';
    
    // 创建多选操作栏
    const actionBar = document.createElement('div');
    actionBar.innerHTML = `
        <div style="display:flex; gap:10px; margin-bottom:15px; align-items:center;">
            <button class="ai-btn" style="font-size:10px" onclick="toggleSelectAllChats()">SELECT_ALL</button>
            <button class="ai-btn" style="font-size:10px; background:var(--term-red)" onclick="deleteSelectedChats()">DELETE</button>
            <span id="selected-count" style="font-size:10px; opacity:0.7">0 selected</span>
        </div>
    `;
    modalContent.appendChild(actionBar);
    
    // 创建滚动容器
    const scrollContainer = document.createElement('div');
    scrollContainer.style.maxHeight = '400px';
    scrollContainer.style.overflowY = 'auto';
    
    if (Object.keys(aiChatHistory).length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.style.textAlign = 'center';
        emptyMsg.style.padding = '20px';
        emptyMsg.style.opacity = '0.5';
        emptyMsg.textContent = 'No conversation history found.';
        scrollContainer.appendChild(emptyMsg);
    } else {
        Object.keys(aiChatHistory).forEach(chatId => {
            const idNum = parseInt(chatId.replace('ai-chat-', ''));
            const messages = aiChatHistory[chatId];
            const lastMessage = messages.length > 0 ? messages[messages.length - 1] : '';
            const preview = lastMessage.includes('>') ? 
                lastMessage.split('>')[1].substring(0, 50) + '...' : 
                lastMessage.substring(0, 50) + '...';
            
            // 创建对话条目容器
            const chatItem = document.createElement('div');
            chatItem.className = 'chat-history-item';
            chatItem.style.border = '1px solid var(--amber-dim)';
            chatItem.style.marginBottom = '10px';
            chatItem.style.padding = '10px';
            chatItem.style.display = 'flex';
            chatItem.style.alignItems = 'center';
            chatItem.style.gap = '10px';
            
            // 创建复选框
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'chat-checkbox';
            checkbox.dataset.chatId = chatId;
            checkbox.onchange = updateSelectedCount;
            chatItem.appendChild(checkbox);
            
            // 创建内容容器
            const contentContainer = document.createElement('div');
            contentContainer.style.flex = '1';
            
            // 创建标题行
            const header = document.createElement('div');
            header.style.display = 'flex';
            header.style.justifyContent = 'space-between';
            header.style.alignItems = 'center';
            header.style.marginBottom = '5px';
            
            const title = document.createElement('strong');
            title.textContent = `CHAT_${idNum}`;
            
            const buttons = document.createElement('div');
            
            const restoreBtn = document.createElement('button');
            restoreBtn.className = 'ai-btn';
            restoreBtn.style.fontSize = '9px';
            restoreBtn.style.padding = '2px 6px';
            restoreBtn.textContent = 'RESTORE';
            restoreBtn.onclick = () => restoreChat(chatId);
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'ai-btn';
            deleteBtn.style.fontSize = '9px';
            deleteBtn.style.padding = '2px 6px';
            deleteBtn.style.background = 'var(--term-red)';
            deleteBtn.textContent = 'DELETE';
            deleteBtn.onclick = () => deleteChat(chatId);
            
            buttons.appendChild(restoreBtn);
            buttons.appendChild(deleteBtn);
            
            header.appendChild(title);
            header.appendChild(buttons);
            
            // 创建预览行
            const previewDiv = document.createElement('div');
            previewDiv.style.fontSize = '10px';
            previewDiv.style.opacity = '0.7';
            previewDiv.textContent = `Last message: ${preview}`;
            
            // 创建消息计数行
            const countDiv = document.createElement('div');
            countDiv.style.fontSize = '9px';
            countDiv.style.opacity = '0.5';
            countDiv.textContent = `Messages: ${messages.length}`;
            
            contentContainer.appendChild(header);
            contentContainer.appendChild(previewDiv);
            contentContainer.appendChild(countDiv);
            
            chatItem.appendChild(contentContainer);
            
            scrollContainer.appendChild(chatItem);
        });
    }
    
    modalContent.appendChild(scrollContainer);
    
    // 创建关闭按钮容器
    const closeContainer = document.createElement('div');
    closeContainer.className = 'modal-btns';
    closeContainer.style.marginTop = '15px';
    closeContainer.style.textAlign = 'center';
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'ai-btn';
    closeBtn.textContent = 'CLOSE';
    closeBtn.onclick = closeModal;
    
    closeContainer.appendChild(closeBtn);
    modalContent.appendChild(closeContainer);
}

// 多选删除相关函数
function toggleSelectAllChats() {
    const checkboxes = document.querySelectorAll('.chat-checkbox');
    const allChecked = checkboxes.length > 0 && Array.from(checkboxes).every(cb => cb.checked);
    
    checkboxes.forEach(cb => cb.checked = !allChecked);
    updateSelectedCount();
}

function deleteSelectedChats() {
    const selected = document.querySelectorAll('.chat-checkbox:checked');
    if (selected.length === 0 || !confirm(`Delete ${selected.length} conversations?`)) return;
    
    selected.forEach(cb => delete aiChatHistory[cb.dataset.chatId]);
    localStorage.setItem('ind_console_ai_history', JSON.stringify(aiChatHistory));
    openHistoryManager();
}

function updateSelectedCount() {
    const count = document.querySelectorAll('.chat-checkbox:checked').length;
    const element = document.getElementById('selected-count');
    if (element) element.textContent = `${count} selected`;
}



function toggleTemplateDropdown() {
    const dropdown = document.getElementById('template-dropdown');
    if (dropdown.style.display === 'block') {
        dropdown.style.display = 'none';
    } else {
        renderTemplateOptions();
        dropdown.style.display = 'block';
    }
}

// 渲染模板选项
function renderTemplateOptions() {
    const optionsContainer = document.getElementById('template-options');
    optionsContainer.innerHTML = '';
    
    Object.entries(aiTemplates).forEach(([name, template]) => {
        const option = document.createElement('div');
        option.className = 'template-option';
        option.innerHTML = `
            <div>
                <strong>${name}</strong><br>
                <span style="opacity:0.7; font-size:9px">${template.substring(0, 40)}...</span>
            </div>
            <div class="template-actions">
                <button class="template-action" onclick="editTemplate('${name}')">编辑</button>
                <button class="template-action" onclick="deleteTemplate('${name}')">删除</button>
            </div>
        `;
        option.onclick = (e) => {
            if (!e.target.classList.contains('template-action')) {
                document.getElementById('ai-in').value = template;
                document.getElementById('template-dropdown').style.display = 'none';
                document.getElementById('ai-in').focus();
            }
        };
        optionsContainer.appendChild(option);
    });
}

// 添加新模板
function addTemplate() {
    const name = prompt('请输入模板名称：');
    if (!name) return;
    
    const template = prompt('请输入模板内容：');
    if (!template) return;
    
    aiTemplates[name] = template;
    saveTemplates();
    renderTemplateOptions();
}

// 编辑模板
function editTemplate(name) {
    const newName = prompt('请输入新的模板名称：', name);
    if (!newName) return;
    
    const template = prompt('请输入新的模板内容：', aiTemplates[name]);
    if (!template) return;
    
    delete aiTemplates[name];
    aiTemplates[newName] = template;
    saveTemplates();
    renderTemplateOptions();
}

// 删除模板
function deleteTemplate(name) {
    if (confirm(`确定要删除模板"${name}"吗？`)) {
        delete aiTemplates[name];
        saveTemplates();
        renderTemplateOptions();
    }
}

function restoreChat(chatId) {
    // 检查是否已经存在该聊天窗口
    const existingTab = document.getElementById('tab-' + chatId);
    if (!existingTab) {
        // 确保aiCount与恢复的聊天ID同步
        const idNum = parseInt(chatId.replace('ai-chat-', ''));
        if (idNum > aiCount) {
            aiCount = idNum;
        }
        
        // 创建新的标签
        const tab = document.createElement('div');
        tab.className = 'term-tab'; 
        tab.id = 'tab-' + chatId;
        tab.innerHTML = `<span>CHAT_${idNum}</span><span class="term-close" onclick="removeAiTab(event, '${chatId}')">×</span>`;
        tab.onclick = () => switchAiTab(chatId);
        document.getElementById('ai-tabs').appendChild(tab);

        // 创建聊天内容区
        const body = document.createElement('div');
        body.className = 'term-body'; 
        body.id = chatId;
        body.style.padding = '15px';
        body.style.overflowY = 'auto';
        body.style.flex = '1';
        
        // 加载历史记录
        if (aiChatHistory[chatId] && aiChatHistory[chatId].length > 0) {
            body.innerHTML = aiChatHistory[chatId].join('');
            // 重新绑定所有按钮的点击事件
            bindAiMessageButtons(body);
        }
        
        document.getElementById('ai-container').appendChild(body);
        
        activeAiId = chatId;
        switchAiTab(chatId);
    }
    
    document.getElementById('modal-overlay').style.display = 'none';
}

function deleteChat(chatId) {
    if (confirm(`Permanently delete CHAT_${parseInt(chatId.replace('ai-chat-', ''))}? This action cannot be undone.`)) {
        delete aiChatHistory[chatId];
        localStorage.setItem('ind_console_ai_history', JSON.stringify(aiChatHistory));
        
        const existingTab = document.getElementById('tab-' + chatId);
        if (existingTab) {
            const tabs = document.querySelectorAll('#ai-tabs .term-tab');
            if (tabs.length > 1) {
                existingTab.remove();
                const chatBody = document.getElementById(chatId);
                if (chatBody) chatBody.remove();
                
                const nextTab = document.querySelector('#ai-tabs .term-tab');
                if (nextTab) switchAiTab(nextTab.id.replace('tab-', ''));
            }
        }
        
        openHistoryManager();
        addLog(`[SYSTEM]: Chat ${chatId} permanently deleted`, "var(--term-green)");
    }
}

function removeAiTab(e, id) {
    e.stopPropagation();
    const tabs = document.querySelectorAll('#ai-tabs .term-tab');
    if (tabs.length <= 1) return; // 至少保留一个
    
    const tab = document.getElementById('tab-' + id);
    const body = document.getElementById(id);
    const wasActive = tab.classList.contains('active');
    
    // 注意：这里不再删除历史记录，只是关闭窗口
    tab.remove();
    body.remove();
    
    if (wasActive) {
        const nextTab = document.querySelector('#ai-tabs .term-tab');
        if (nextTab) switchAiTab(nextTab.id.replace('tab-', ''));
    }
}

async function handleAiSend() {
    const input = document.getElementById('ai-in');
    const query = input.value.trim();
    
    // 检查当前是否正在生成，如果是则取消
    if (isGenerating()) {
        cancelAiRequest();
        return;
    }
    
    if (!query) return;

    // 播放发送音效
    playTone('send');

    // 开始生成
    startGenerating();
    
    // 只支持单个供应商，直接发送
    sendAi(null, activeAiId);
}

async function sendAi(overrideQuery = null, targetTabId = null) {
    const input = document.getElementById('ai-in');
    const query = (overrideQuery !== null) ? overrideQuery : input.value.trim();
    
    // 确定使用哪个 ID：传了用传的，没传用全局活跃的
    const currentChatId = targetTabId || activeAiId;
    
    const provider = config.providers[config.activeProviderIndex];
    if (!query || !provider || !provider.apiKey || !currentChatId) return;

    // 只在单模型模式下清空输入框并重置高度
    if (overrideQuery === null) {
        input.value = '';
        input.style.height = '30px';
    }

    const chat = document.getElementById(currentChatId);
    const uMsg = document.createElement('div');
    uMsg.className = 'msg user'; 
    uMsg.style.cursor = 'pointer';
    
    const ctxText = selectedAiCtxs.length === 0 ? 'none' : 
                   selectedAiCtxs.length === 1 ? selectedAiCtxs[0] : 
                   `[${selectedAiCtxs.length} files]`;
    const promptText = `[CTX:${ctxText}] > ${query}`;
    //  height: 18px;
    uMsg.innerHTML = `<div style="position: relative;"><span class="undo-btn" title="回退到此对话" onclick="undoToPrompt(event, '${currentChatId}', ${aiChatHistory[currentChatId] ? aiChatHistory[currentChatId].length : 0}, '${query.replace(/'/g, "\\'")}')">Revert</span></div><span class="prompt-content">${promptText}</span>`;
    
    uMsg.querySelector('.prompt-content').setAttribute('onclick', `copyPrompt(this, '${query.replace(/'/g, "\\'")}')`);
    
    chat.appendChild(uMsg);
    
    if (!aiChatHistory[currentChatId]) {
        aiChatHistory[currentChatId] = [];
    }
    aiChatHistory[currentChatId].push(`<div class="msg user" style="cursor: pointer; position: relative; margin-top: 20px;" title="点击复制prompt"><div style="position: relative;"><span class="undo-btn" style="position: absolute; top: -18px; left: 0; color: #ff6b6b; font-size: 9px; cursor: pointer; background: rgba(0,0,0,0.8); padding: 2px 6px; border-radius: 3px;" title="回退到此对话" onclick="undoToPrompt(event, '${currentChatId}', ${aiChatHistory[currentChatId] ? aiChatHistory[currentChatId].length : 0}, '${query.replace(/'/g, "\\'")}')">Revert</span></div><span class="prompt-content" onclick="copyPrompt(this, '${query.replace(/'/g, "\\'")}')">${promptText}</span></div>`);

    const aiMsg = document.createElement('div');
    aiMsg.className = 'msg ai'; 
    aiMsg.innerHTML = 'AI: <span class="ai-typing">Thinking</span>';
    chat.appendChild(aiMsg); 
    
    const scrollChat = () => chat.scrollTo({ top: chat.scrollHeight, behavior: 'smooth' });
    scrollChat();

    try {
        if (!chatHistory[currentChatId]) {
            chatHistory[currentChatId] = [];
        }
        
        const userMessage = {
            role: 'user', 
            content: selectedAiCtxs.length > 0 ? 
                `Context:\n${selectedAiCtxs.map(f => `${f}:\n${storage[f]}`).join('\n\n')}\n\nQuery: ${query}` : 
                query 
        };
        
        chatHistory[currentChatId].push(userMessage);
        localStorage.setItem('ind_console_chat_history', JSON.stringify(chatHistory));
        
        const controller = new AbortController();
    currentAiRequest = controller;
    
    // 设置当前聊天的请求状态
    if (currentChatId) {
        chatRequestStates[currentChatId] = controller;
        updateSendButton();
        
        // 为当前tab添加炫酷加载效果
        const currentTab = document.getElementById('tab-' + currentChatId);
        if (currentTab) {
            currentTab.classList.add('loading');
            currentTab.innerHTML = `<span class="pulse-dot"></span><span class="thinking-text">Thinking</span><span class="term-close" onclick="removeAiTab(event, '${currentChatId}')">×</span>`;
        }
    }
        
        const response = await fetch(`${provider.apiBaseUrl}/chat/completions`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${provider.apiKey}` 
            },
            body: JSON.stringify({ 
                model: provider.model, 
                messages: chatHistory[currentChatId], // 发送完整对话历史
                stream: false
            }),
            signal: controller.signal
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const fullContent = data.choices[0].message.content;
        
        // 请求完成，清除控制器
        currentAiRequest = null;
        
        // 移除tab的加载效果
        if (currentChatId) {
            const currentTab = document.getElementById('tab-' + currentChatId);
            if (currentTab) {
                currentTab.classList.remove('loading');
                const idNum = currentChatId.replace('ai-chat-', '');
                currentTab.innerHTML = `<span>CHAT_${idNum}</span><span class="term-close" onclick="removeAiTab(event, '${currentChatId}')">×</span>`;
            }
        }
        
        // 播放成功音效
        playTone('success');
        
        // 将AI回复添加到对话历史并保存
        chatHistory[currentChatId].push({
            role: 'assistant',
            content: fullContent
        });
        localStorage.setItem('ind_console_chat_history', JSON.stringify(chatHistory));
        
        // 恢复按钮状态
    resetSendButton(currentChatId);
        
        // Markdown渲染函数
        const renderMarkdown = (text) => {
            const codeBlocks = [];
            
            // 先提取代码块并保存原始内容
            let processedText = text.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
                const cleanCode = code.trim();
                const blockId = `code-block-${codeBlocks.length}`;
                codeBlocks.push(cleanCode);
                
                // 安全处理代码内容：转义HTML特殊字符
                const escapedCode = cleanCode
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#x27;');
                
                const displayCode = escapedCode.replace(/\n/g, '<br>');
                
                // 根据语言类型决定按钮文本
                const isBash = lang && (lang.toLowerCase() === 'bash' || lang.toLowerCase() === 'sh' || lang.toLowerCase() === 'shell');
                const actionBtnText = isBash ? 'Run' : 'Apply';
                const actionBtnClass = isBash ? 'run-btn' : 'inject-btn';
                
                const actionBtn = cleanCode ? 
                    `<div class="copy-btn" data-code="${blockId}">Copy</div><div class="${actionBtnClass}" data-code="${blockId}" data-lang="${lang || 'code'}">${actionBtnText}</div>` : '';
                
                return `<div class="code-block"><span class="code-lang">${lang || 'code'}</span><pre><code>${displayCode}</code></pre>${actionBtn}</div>`;
            });
            
            // 处理其他Markdown格式（保持简洁）
            processedText = processedText
                .replace(/^### (.+)$/gm, '<div style="font-size:1.2em; font-weight:bold; margin:4px 0;">$1</div>')  // ### 标题
                .replace(/^## (.+)$/gm, '<div style="font-size:1.3em; font-weight:bold; margin:4px 0;">$1</div>')   // ## 标题
                .replace(/^# (.+)$/gm, '<div style="font-size:1.4em; font-weight:bold; margin:4px 0;">$1</div>')    // # 标题
                .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')  // 行内代码
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')          // 粗体
                .replace(/\*(.*?)\*/g, '<em>$1</em>')                      // 斜体
                .replace(/^---$/gm, '<hr style="border:none; border-top:1px solid var(--amber-dim); margin:8px 0;">')  // 横线
                .replace(/\n\n/g, '<br><br>')  // 段落间距
                .replace(/\n/g, '<br>');       // 换行
            
            aiMsg.dataset.codeBlocks = JSON.stringify(codeBlocks);
            
            return processedText;
        };
        
        const renderedContent = renderMarkdown(fullContent);
        // 安全处理：转义HTML特殊字符
        const safeContent = fullContent
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');
        // 使用更安全的方式绑定Copy按钮事件
        aiMsg.innerHTML = `<div style="position: relative;">AI: ${renderedContent}<span class="scroll-top-btn" onclick="scrollToAiTop(this)">▲</span><span class="copy-ai-btn" data-content="${safeContent}">Copy</span></div>`;
        
        // 手动绑定Copy按钮事件
        const copyBtn = aiMsg.querySelector('.copy-ai-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', function() {
                const content = this.getAttribute('data-content') || '';
                copyAiResponse(this, content);
            });
        }
        
        bindAiMessageButtons(aiMsg);
        scrollChat();
        
        aiChatHistory[currentChatId].push(aiMsg.outerHTML);
        localStorage.setItem('ind_console_ai_history', JSON.stringify(aiChatHistory));
    } catch (err) { 
        const errorMessage = `[ERR]: ${err.message}`;
        aiMsg.innerText = `AI: ${errorMessage}`; 
        
        // 播放错误音效
        playTone('error');
        
        // 恢复按钮状态
        resetSendButton();
        
        // 将错误信息添加到对话历史并保存
        chatHistory[currentChatId].push({
            role: 'assistant',
            content: errorMessage
        });
        localStorage.setItem('ind_console_chat_history', JSON.stringify(chatHistory));
        
        scrollChat();
    }
}

function handleExtractButton(container) {
    const text = container.innerText;
    if (text.includes('```')) {
        const code = text.split('```')[1].split('\n').slice(1).join('\n');
        const btn = document.createElement('div');
        btn.className = 'inject-btn'; 
        btn.innerText = '>> EXTRACT_CODE';
        btn.setAttribute('data-code', code);
        btn.onclick = () => { 
            if (activeEditorTab && editorTabs[activeEditorTab]) {
                editorTabs[activeEditorTab].editor.value += "\n" + code;
                markFileModified(activeEditorTab);
            }
        };
        container.appendChild(document.createElement('br')); 
        container.appendChild(btn);
    }
}
    function handleCtx(e, x, y) {
        e.preventDefault();
        e.stopPropagation();
        const ctxMenu = document.getElementById('ctx');
        const isItem = e.target.closest('.file-item');
        
        // 如果在空白处右键，禁用文件相关操作
        const isFileList = e.target.id === 'file-list';
        const shouldDisable = !isItem && !isFileList;
        
        document.getElementById('ctx-rename').classList.toggle('disabled', shouldDisable);
        document.getElementById('ctx-delete').classList.toggle('disabled', shouldDisable);
        document.getElementById('ctx-copy-path').classList.toggle('disabled', shouldDisable);
        
        ctxMenu.style.display = 'block';
        positionMenu(ctxMenu, x || e.pageX, y || e.pageY);
    }

    async function saveZip() {
        const zip = new JSZip(); 
        Object.keys(storage).forEach(k => { if(!k.endsWith('/')) zip.file(k, storage[k]); });
        const b = await zip.generateAsync({type:"blob"}), a = document.createElement('a');
        a.href = URL.createObjectURL(b); a.download = "archive.zip"; a.click();
    }
    
    function saveFile() { 
        if (!activeFile || activeFile.endsWith('/')) {
            alert('请先选择一个文件');
            return;
        }
        
        const content = storage[activeFile] || '';
        const b = new Blob([content], {type:'text/plain'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(b);
        a.download = activeFile.split('/').pop();
        a.click();
    }
    
    function clearTerm() { if(activeTermId) document.getElementById(activeTermId).querySelector('.term-out').innerHTML = 'READY.'; }
        function isGenerating() {
        const sendBtn = document.getElementById('ai-send-btn');
        return sendBtn && sendBtn.textContent === 'CANC';
    }
    
    function startGenerating() {
        const sendBtn = document.getElementById('ai-send-btn');
        if (sendBtn) {
            sendBtn.textContent = 'CANC';
            sendBtn.style.background = 'var(--term-red)';
        }
    }
    
    function cancelAiRequest() {
        if (currentAiRequest) {
            currentAiRequest.abort();
            currentAiRequest = null;
        }
        stopGenerating();
    }
    
function stopGenerating() {
    const sendBtn = document.getElementById('ai-send-btn');
    if (sendBtn) {
        sendBtn.textContent = 'SEND';
        sendBtn.style.background = 'var(--amber-dim)';
    }
}

function scrollToAiTop(button) {
    const aiMsg = button.closest('.msg.ai');
    if (aiMsg) {
        aiMsg.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start',
            inline: 'nearest'
        });
    }
}

    function copyAiResponse(button, content) {
        // 确保content参数正确传递
        const decodedContent = content ? content.replace(/\\`/g, '`') : '';
        
        if (!decodedContent) {
            console.error('复制内容为空');
            return;
        }
        
        navigator.clipboard.writeText(decodedContent).then(() => {
            const originalText = button.textContent;
            button.textContent = 'Done';
            button.style.color = '#00ff00';
            setTimeout(() => {
                button.textContent = originalText;
                button.style.color = 'var(--amber)';
            }, 1000);
        }).catch(err => {
            console.error('复制失败:', err);
            // 备用复制方法
            const textArea = document.createElement('textarea');
            textArea.value = decodedContent;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            
            const originalText = button.textContent;
            button.textContent = 'Done';
            button.style.color = '#00ff00';
            setTimeout(() => {
                button.textContent = originalText;
                button.style.color = 'var(--amber)';
            }, 1000);
        });
    }

    function undoToPrompt(event, chatId, messageIndex, originalQuery) {
        event.stopPropagation();
        
        if (confirm('确定要回退到此对话吗？此操作将删除此prompt及其之后的所有对话记录。')) {
            if (chatHistory[chatId] && chatHistory[chatId].length > messageIndex) {
                chatHistory[chatId] = chatHistory[chatId].slice(0, messageIndex);
                localStorage.setItem('ind_console_chat_history', JSON.stringify(chatHistory));
            }
            
            if (aiChatHistory[chatId] && aiChatHistory[chatId].length > messageIndex) {
                aiChatHistory[chatId] = aiChatHistory[chatId].slice(0, messageIndex);
                localStorage.setItem('ind_console_ai_history', JSON.stringify(aiChatHistory));
            }
            
            const chat = document.getElementById(chatId);
            if (chat) {
                chat.innerHTML = aiChatHistory[chatId].join('');
                chat.scrollTo({ top: chat.scrollHeight, behavior: 'smooth' });
            }
            
            const input = document.getElementById('ai-in');
            if (input) {
                input.value = originalQuery;
                input.focus();
            }
        }
    }
    
    initResizer(document.getElementById('h-drag-left'), document.getElementById('explorer'), true, false);
    initResizer(document.getElementById('v-drag-explorer'), document.getElementById('file-section'), false, false);
    
    if (window.innerWidth < 768) {
        setTimeout(() => toggleMax('editor-p'), 100);
    }
    initResizer(document.getElementById('h-drag-right'), document.getElementById('ai-panel'), true, true);
    initResizer(document.getElementById('v-drag'), document.getElementById('terminal'), false, true);
    
    document.addEventListener('click', (e) => {
        // 关闭右键菜单
        const ctxMenu = document.getElementById('ctx');
        if (!ctxMenu.contains(e.target)) {
            ctxMenu.style.display = 'none';
            ctxTarget = null; // 重置上下文目标
        }
        
        if (!document.getElementById('plugin-ctx').contains(e.target)) document.getElementById('plugin-ctx').style.display = 'none';
        if (!document.getElementById('ai-ctx-trigger').contains(e.target)) {
            document.getElementById('ai-ctx-options').style.display = 'none';
        }
        if (!document.getElementById('ai-provider-trigger').contains(e.target)) {
            document.getElementById('ai-provider-options').style.display = 'none';
        }
    });
    // 输入框自适应高度
    const aiInput = document.getElementById('ai-in');
    aiInput.addEventListener('input', function() {
        const singleLineHeight = 30; // 单行高度
        if (this.value.trim() === '' || this.scrollHeight <= singleLineHeight) {
            this.style.height = singleLineHeight + 'px';
        } else {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 120) + 'px';
        }
    });
    
    aiInput.onkeydown = (e) => { 
        if(e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (isGenerating()) {
                cancelAiRequest();
                return;
            }
            const query = e.target.value.trim();
            if (!query) return;
            // 播放发送音效
            playTone('send');
            startGenerating();
            sendAi();
        }
    };

    // 拖拽上传功能
    const fileList = document.getElementById('file-list');
    fileList.addEventListener('dragover', (e) => {
        e.preventDefault();
        fileList.style.background = 'rgba(255, 176, 0, 0.1)';
    });
    fileList.addEventListener('dragleave', () => {
        fileList.style.background = 'transparent';
    });
    fileList.addEventListener('drop', (e) => {
        e.preventDefault();
        fileList.style.background = 'transparent';
        
        const files = e.dataTransfer.files;
        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onload = (event) => {
                storage[file.name] = event.target.result;
                localStorage.setItem('ind_console_storage', JSON.stringify(storage));
                renderFiles();
            };
            reader.readAsText(file);
        });
    });
    
    renderFiles(); renderPlugins(); addTerminal(); restoreAiTabs(); updateProviderDisplay();
    
    if (openedTabs.length > 0) {
        const activeTabName = localStorage.getItem('ind_console_active') || openedTabs[0];
        openedTabs.forEach(fileName => {
            createEditorTab(fileName);
        });
        let retryCount = 0;
        function tryRestoreActiveTab() {
            if (activeTabName && editorTabs[activeTabName]) {
                switchEditorTab(activeTabName);
            } else if (retryCount < 50) {
                retryCount++;
                setTimeout(tryRestoreActiveTab, 100);
            }
        }
        setTimeout(tryRestoreActiveTab, 60);
    } else {
        activeFile = localStorage.getItem('ind_console_active');
        if (activeFile) {
            createEditorTab(activeFile);
        }
    }

    function toggleFileSearch() {
        if (!activeEditorTab || !editorTabs[activeEditorTab]) {
            return;
        }
        const editor = editorTabs[activeEditorTab].editor;
        editor.getAction('actions.find').run();
    }

    // 语音识别功能
    let recognition = null;
    let isListening = false;
    
    // 检测是否为手机屏幕
    function isMobileScreen() {
        return window.innerWidth <= 768;
    }
    
    // 更新语音按钮显示状态
    function updateVoiceButtonVisibility() {
        const voiceBtn = document.getElementById('voice-btn');
        if (voiceBtn) {
            voiceBtn.style.display = isMobileScreen() ? 'none' : 'block';
        }
    }
    
    // 监听窗口大小变化
    window.addEventListener('resize', updateVoiceButtonVisibility);
    
    // 页面加载时初始化
    document.addEventListener('DOMContentLoaded', updateVoiceButtonVisibility);

    function toggleVoiceRecognition() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            alert('您的浏览器不支持语音识别功能');
            return;
        }

        if (!recognition) {
            recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
            recognition.continuous = true; // 连续识别模式
            recognition.interimResults = true;
            recognition.lang = 'zh-CN';
            recognition.maxAlternatives = 1;
            
            if (recognition.continuous !== undefined) {
                recognition.continuous = true;
            }
            
            if (recognition.onend) {
                recognition.onend = null;
            }

            recognition.onstart = function() {
                isListening = true;
                updateVoiceButton();
            };

            recognition.onresult = function(event) {
                const transcript = Array.from(event.results)
                    .map(result => result[0].transcript)
                    .join('');
                
                const aiInput = document.getElementById('ai-in');
                aiInput.value = transcript;
                
                // 触发输入事件以调整高度
                aiInput.dispatchEvent(new Event('input'));
            };

            recognition.onend = function() {
                isListening = false;
                updateVoiceButton();
            };

            recognition.onerror = function(event) {
                isListening = false;
                updateVoiceButton();
                console.error('语音识别错误:', event.error);
            };
        }

        if (isListening) {
            recognition.stop();
        } else {
            recognition.start();
        }
    }

    function updateVoiceButton() {
        const voiceBtn = document.getElementById('voice-btn');
        if (isListening) {
            voiceBtn.innerHTML = '🔴';
            voiceBtn.style.background = 'var(--term-red)';
        } else {
            voiceBtn.innerHTML = '🎤';
            voiceBtn.style.background = 'var(--amber)';
        }
    }

    async function importFromGithub() {
        const url = document.getElementById('github-url').value.trim();
        const filename = document.getElementById('save-filename').value.trim();
        
        if (!url || !filename) {
            alert('Please enter both GitHub URL and filename');
            return;
        }
        
        let rawUrl = url;
        if (url.startsWith('https://github.com/')) {
            rawUrl = url.replace('https://github.com/', 'https://raw.githubusercontent.com/').replace('/blob/', '/');
        }
        
        if (!rawUrl.startsWith('https://raw.githubusercontent.com/')) {
            alert('Please enter a valid GitHub URL');
            return;
        }
        
        try {
            const confirmBtn = document.querySelector('.modal-btns .ai-btn[style*="background: var(--amber)"]');
            if (confirmBtn) {
                confirmBtn.textContent = 'LOADING...';
                confirmBtn.disabled = true;
            }
            
            const response = await fetch(rawUrl);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const content = await response.text();
            
            storage[filename] = content;
            localStorage.setItem('ind_console_storage', JSON.stringify(storage));
            
            closeModal();
            renderFiles();
            
            createEditorTab(filename);
            
        } catch (error) {
            alert(`Import failed: ${error.message}`);
            console.error('GitHub import error:', error);
            
            const confirmBtn = document.querySelector('.modal-btns .ai-btn[style*="background: var(--amber)"]');
            if (confirmBtn) {
                confirmBtn.textContent = 'CONFIRM';
                confirmBtn.disabled = false;
            }
        }
    }