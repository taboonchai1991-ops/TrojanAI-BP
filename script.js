
// ==================== CONFIGURATION ====================
const CUSTOM_ICON_URL = "https://od.lk/s/N18yODE1OTE2NTlf/cre.ico";
const VERSION = "2.0.0";
const NETLIFY_DEPLOY = true;

// Relay Data
const relays = [
    { id: 1, name: "ไฟหลัก", state: false, label: "RELAY_01", pin: "D1", icon: CUSTOM_ICON_URL, customName: "ไฟหลัก", delay: 0, pendingTimeout: null },
    { id: 2, name: "มอเตอร์ปั๊ม", state: false, label: "RELAY_02", pin: "D2", icon: CUSTOM_ICON_URL, customName: "มอเตอร์ปั๊ม", delay: 0, pendingTimeout: null },
    { id: 3, name: "ระบายอากาศ", state: false, label: "RELAY_03", pin: "D3", icon: CUSTOM_ICON_URL, customName: "ระบายอากาศ", delay: 0, pendingTimeout: null },
    { id: 4, name: "อุปกรณ์เสริม", state: false, label: "RELAY_04", pin: "D4", icon: CUSTOM_ICON_URL, customName: "อุปกรณ์เสริม", delay: 0, pendingTimeout: null }
];

let customNames = { 1: "ไฟหลัก", 2: "มอเตอร์ปั๊ม", 3: "ระบายอากาศ", 4: "อุปกรณ์เสริม" };
let relayDelays = { 1: 0, 2: 0, 3: 0, 4: 0 };
let currentEditingRelay = null;

// Auto-listening variables
let isAutoListening = true;
let recognition = null;
let restartTimeout = null;
let errorCount = 0;

// Telegram variables
let telegramToken = "";
let telegramChatId = "";
let telegramUpdateOffset = 0;
let telegramPollingInterval = null;
let isTelegramConnected = false;

// Store last number press for shortcuts
let lastNumberPress = { number: null, timestamp: 0, timeout: null };

// HTTP URL Storage
let httpRelayUrls = {
    1: { on: "http://192.168.1.40/toggle", off: "http://192.168.1.40/toggle" },
    2: { on: "http://192.168.1.189/RELAY=ON", off: "http://192.168.1.189/RELAY=OFF" },
    3: { on: "", off: "" },
    4: { on: "", off: "" }
};
let httpBaseURL = "http://192.168.1.188";
let currentProtocol = 'telegram';
let ws = null;
let mqttClient = null;

// ==================== UTILITY FUNCTIONS ====================
function safeLocalStorageSet(key, value) {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch(e) {
        console.error("localStorage error:", e);
        showToastMessage("⚠️ พื้นที่เก็บข้อมูลเต็ม");
        return false;
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToastMessage(msg) {
    let toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.innerText = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}

function speakFeedback(text) { 
    if ('speechSynthesis' in window) { 
        window.speechSynthesis.cancel(); 
        let u = new SpeechSynthesisUtterance(text); 
        u.lang = 'th-TH'; 
        u.rate = 0.9; 
        window.speechSynthesis.speak(u); 
    } 
}

function updateConnectionStatus(connected, message) {
    const led = document.getElementById('connection-led');
    const text = document.getElementById('connection-text');
    if (connected) { led.classList.add('connected'); text.innerText = message; } 
    else { led.classList.remove('connected'); text.innerText = message; }
}

// ==================== LOAD/SAVE SETTINGS ====================
function loadStoredSettings() {
    const storedNames = localStorage.getItem('relayCustomNames');
    if (storedNames) {
        try {
            const parsed = JSON.parse(storedNames);
            customNames = parsed;
            for (let i = 1; i <= 4; i++) {
                if (customNames[i]) {
                    relays[i-1].name = customNames[i];
                    relays[i-1].customName = customNames[i];
                }
            }
        } catch(e) { console.warn("Failed to parse custom names"); }
    }
    
    const storedDelays = localStorage.getItem('relayDelays');
    if (storedDelays) {
        try {
            const parsed = JSON.parse(storedDelays);
            relayDelays = parsed;
            for (let i = 1; i <= 4; i++) {
                relays[i-1].delay = relayDelays[i] || 0;
            }
        } catch(e) { console.warn("Failed to parse delays"); }
    }
    
    const storedUrls = localStorage.getItem('httpRelayUrls');
    const storedBase = localStorage.getItem('httpBaseURL');
    
    if (storedUrls) {
        try {
            const parsed = JSON.parse(storedUrls);
            for (let i = 1; i <= 4; i++) {
                if (parsed[i]) {
                    httpRelayUrls[i] = { on: parsed[i].on || "", off: parsed[i].off || "" };
                }
            }
        } catch(e) { console.warn("Failed to parse stored URLs"); }
    }
    
    if (storedBase) httpBaseURL = storedBase;
    
    const storedTelegramToken = localStorage.getItem('telegramToken');
    const storedTelegramChatId = localStorage.getItem('telegramChatId');
    if (storedTelegramToken) telegramToken = storedTelegramToken;
    if (storedTelegramChatId) telegramChatId = storedTelegramChatId;
    
    for (let i = 1; i <= 4; i++) {
        const onInput = document.getElementById(`relay${i}-on`);
        const offInput = document.getElementById(`relay${i}-off`);
        const delayInput = document.getElementById(`relay${i}-delay`);
        if (onInput) onInput.value = httpRelayUrls[i].on;
        if (offInput) offInput.value = httpRelayUrls[i].off;
        if (delayInput) delayInput.value = relayDelays[i] || 0;
    }
    
    const baseInput = document.getElementById('http-base-url');
    if (baseInput) baseInput.value = httpBaseURL;
    
    const tokenInput = document.getElementById('telegram-token');
    const chatIdInput = document.getElementById('telegram-chatid');
    if (tokenInput) tokenInput.value = telegramToken;
    if (chatIdInput) chatIdInput.value = telegramChatId;
    
    console.log("Settings loaded - Version:", VERSION);
}

function saveCustomNames() {
    safeLocalStorageSet('relayCustomNames', JSON.stringify(customNames));
}

function saveDelays() {
    safeLocalStorageSet('relayDelays', JSON.stringify(relayDelays));
}

function saveRelayUrls() {
    for (let i = 1; i <= 4; i++) {
        httpRelayUrls[i] = { 
            on: document.getElementById(`relay${i}-on`).value.trim(), 
            off: document.getElementById(`relay${i}-off`).value.trim() 
        };
        const delayInput = document.getElementById(`relay${i}-delay`);
        if (delayInput) {
            let delayVal = parseFloat(delayInput.value);
            if (isNaN(delayVal)) delayVal = 0;
            if (delayVal < 0) delayVal = 0;
            if (delayVal > 60) delayVal = 60;
            relayDelays[i] = delayVal;
            relays[i-1].delay = relayDelays[i];
            delayInput.value = delayVal;
        }
    }
    
    const baseInput = document.getElementById('http-base-url');
    if (baseInput && baseInput.value.trim()) {
        httpBaseURL = baseInput.value.trim();
    }
    
    safeLocalStorageSet('httpRelayUrls', JSON.stringify(httpRelayUrls));
    safeLocalStorageSet('httpBaseURL', httpBaseURL);
    saveDelays();
    
    showToastMessage("✅ บันทึก URL และหน่วงเวลาเรียบร้อย");
    document.getElementById('http-status').innerHTML = '✅ บันทึกการตั้งค่าเรียบร้อย';
}

// ==================== HTTP API FUNCTIONS ====================
function getHttpUrl(relayId, state) {
    const urls = httpRelayUrls[relayId];
    if (state && urls.on && urls.on !== "") return urls.on;
    if (!state && urls.off && urls.off !== "") return urls.off;
    if (urls.on === urls.off && urls.on !== "") return urls.on;
    const suffix = state ? "ONVIDEO" : "OFFVIDEO";
    return `${httpBaseURL}/${suffix}`;
}

function sendHttpCommand(relayId, state) {
    const url = getHttpUrl(relayId, state);
    if (url && url !== "") {
        fetch(url, { method: 'GET', mode: 'no-cors' })
            .catch(e => console.log("HTTP request sent:", url));
        console.log(`HTTP ${state ? 'ON' : 'OFF'} -> ${url}`);
        return true;
    } else {
        showToastMessage(`⚠️ ไม่มี URL สำหรับรีเลย์ ${relayId}`);
        return false;
    }
}

// ==================== RELAY CONTROL FUNCTIONS ====================
function renderRelays() {
    const grid = document.getElementById('relayGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    relays.forEach((relay) => {
        const card = document.createElement('div');
        card.className = `relay-card ${relay.state ? 'active' : ''}`;
        card.dataset.id = relay.id;
        
        const displayName = customNames[relay.id] || relay.name;
        const delayValue = relayDelays[relay.id] || 0;
        
        card.innerHTML = `
            <button class="edit-name-btn" onclick="event.stopPropagation(); openNameModal(${relay.id}, '${displayName.replace(/'/g, "\\'")}')">
                <span>✏️</span> ตั้งชื่อ
            </button>
            <div class="relay-icon">
                <img src="${relay.icon}" alt="Relay ${relay.id}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Ccircle cx=\'50\' cy=\'50\' r=\'45\' fill=\'%2300ffff\' stroke=\'%2300aaff\' stroke-width=\'3\'/%3E%3Ctext x=\'50\' y=\'67\' text-anchor=\'middle\' fill=\'%23000\' font-size=\'40\' font-weight=\'bold\'%3E${relay.id}%3C/text%3E%3C/svg%3E'">
            </div>
            <div class="relay-number">RELAY ${relay.id}</div>
            <div class="relay-name">${escapeHtml(displayName)}</div>
            <div class="relay-label">${relay.label} (${relay.pin})</div>
            <div class="delay-control">
                <label>⏱</label>
                <input type="number" id="delay-${relay.id}" min="0" max="60" step="0.5" value="${delayValue}" 
                       onchange="updateRelayDelay(${relay.id}, this.value)" onclick="event.stopPropagation()">
                <span>วินาที</span>
            </div>
            <div class="relay-state ${relay.state ? 'state-on' : 'state-off'}">${relay.state ? 'ON' : 'OFF'}</div>
        `;
        card.onclick = (e) => {
            if (!e.target.classList.contains('edit-name-btn') && 
                !e.target.closest('.edit-name-btn') &&
                !e.target.closest('.delay-control')) {
                toggleRelay(relay.id);
            }
        };
        grid.appendChild(card);
    });
}

function updateRelayDelay(relayId, value) {
    let delay = parseFloat(value);
    if (isNaN(delay)) delay = 0;
    if (delay < 0) delay = 0;
    if (delay > 60) delay = 60;
    
    relayDelays[relayId] = delay;
    relays[relayId-1].delay = delay;
    saveDelays();
    
    const delayInput = document.getElementById(`delay-${relayId}`);
    if (delayInput) delayInput.value = delay;
    
    showToastMessage(`ตั้งค่าหน่วงเวลา RELAY ${relayId} = ${delay} วินาที`);
}

function toggleRelay(id) {
    const relay = relays.find(r => r.id === id);
    if (relay) {
        updateRelayState(id, !relay.state);
    }
}

function updateRelayState(relayId, newState) {
    const relay = relays.find(r => r.id === relayId);
    if (!relay) return;
    
    if (relay.pendingTimeout) {
        clearTimeout(relay.pendingTimeout);
        relay.pendingTimeout = null;
    }
    
    const delay = relayDelays[relayId] || 0;
    const displayName = customNames[relayId] || relay.name;
    
    if (delay > 0) {
        showToastMessage(`⏱ ${displayName} จะ${newState ? 'เปิด' : 'ปิด'} ใน ${delay} วินาที`);
        speakFeedback(`หน่วงเวลา ${delay} วินาที ${displayName} จะ${newState ? 'เปิด' : 'ปิด'}`);
        
        const stateDiv = document.querySelector(`.relay-card[data-id='${relayId}'] .relay-state`);
        if (stateDiv) {
            stateDiv.classList.add('pending');
            stateDiv.innerText = '⏱ PENDING';
            setTimeout(() => {
                if (stateDiv && stateDiv.classList.contains('pending') && !relay.pendingTimeout) {
                    stateDiv.classList.remove('pending');
                    stateDiv.innerText = relay.state ? 'ON' : 'OFF';
                }
            }, delay * 1000);
        }
        
        relay.pendingTimeout = setTimeout(() => {
            executeRelayCommand(relayId, newState);
            relay.pendingTimeout = null;
        }, delay * 1000);
    } else {
        executeRelayCommand(relayId, newState);
    }
}

function executeRelayCommand(relayId, newState) {
    const relay = relays.find(r => r.id === relayId);
    if (!relay || relay.state === newState) return;
    
    const success = sendHttpCommand(relayId, newState);
    
    if (success) {
        relay.state = newState;
        renderRelays();
        
        const displayName = customNames[relayId] || relay.name;
        const stateText = newState ? 'เปิด' : 'ปิด';
        showToastMessage(`🔌 ${displayName} → ${stateText}`);
        speakFeedback(`${displayName} ${stateText} แล้ว`);
        
        if (isTelegramConnected && telegramChatId) {
            sendTelegramMessage(`🔌 ${displayName} ${stateText} แล้ว`);
        }
    }
}

function allRelaysOn() { 
    relays.forEach(r => { 
        if (!r.state) {
            const success = sendHttpCommand(r.id, true);
            if (success) r.state = true;
        }
    }); 
    renderRelays();
    showToastMessage("⚡ เปิดรีเลย์ทั้งหมด"); 
    speakFeedback("เปิดรีเลย์ทั้งหมด");
    if (isTelegramConnected && telegramChatId) {
        sendTelegramMessage("⚡ เปิดรีเลย์ทั้งหมดเรียบร้อย");
    }
}

function allRelaysOff() { 
    relays.forEach(r => { 
        if (r.state) {
            const success = sendHttpCommand(r.id, false);
            if (success) r.state = false;
        }
    }); 
    renderRelays();
    showToastMessage("🔻 ปิดรีเลย์ทั้งหมด"); 
    speakFeedback("ปิดรีเลย์ทั้งหมด");
    if (isTelegramConnected && telegramChatId) {
        sendTelegramMessage("🔻 ปิดรีเลย์ทั้งหมดเรียบร้อย");
    }
}

function syncStatus() { 
    showToastMessage("🔄 SYNC - ดึงสถานะจาก HTTP API ไม่ได้ (ใช้เฉพาะ WebSocket/MQTT)"); 
}

// ==================== MODAL FUNCTIONS ====================
function openNameModal(relayId, currentName) {
    currentEditingRelay = relayId;
    const modal = document.getElementById('nameModal');
    const input = document.getElementById('relayNameInput');
    const modalTitle = document.getElementById('modalTitle');
    
    modalTitle.innerHTML = `ตั้งชื่อ RELAY ${relayId}`;
    input.value = currentName;
    modal.classList.add('active');
}

function saveRelayName() {
    const input = document.getElementById('relayNameInput');
    const newName = input.value.trim();
    
    if (newName === "") {
        showToastMessage("⚠️ กรุณาใส่ชื่อ");
        return;
    }
    
    customNames[currentEditingRelay] = newName;
    saveCustomNames();
    
    const relay = relays.find(r => r.id === currentEditingRelay);
    if (relay) {
        relay.name = newName;
        relay.customName = newName;
    }
    
    renderRelays();
    closeModal();
    
    speakFeedback(`ตั้งชื่อ RELAY ${currentEditingRelay} เป็น ${newName} เรียบร้อย`);
    showToastMessage(`✅ ตั้งชื่อ RELAY ${currentEditingRelay} เป็น "${newName}" เรียบร้อย`);
}

function deleteRelayName() {
    delete customNames[currentEditingRelay];
    saveCustomNames();
    
    const defaultNames = { 1: "ไฟหลัก", 2: "มอเตอร์ปั๊ม", 3: "ระบายอากาศ", 4: "อุปกรณ์เสริม" };
    
    const relay = relays.find(r => r.id === currentEditingRelay);
    if (relay) {
        relay.name = defaultNames[currentEditingRelay];
        relay.customName = defaultNames[currentEditingRelay];
    }
    
    renderRelays();
    closeModal();
    
    speakFeedback(`ลบชื่อ RELAY ${currentEditingRelay} กลับเป็นชื่อเดิม`);
    showToastMessage(`🗑️ ลบชื่อเรียบร้อย กลับเป็นชื่อเดิม`);
}

function closeModal() {
    const modal = document.getElementById('nameModal');
    modal.classList.remove('active');
    currentEditingRelay = null;
}

// ==================== TELEGRAM FUNCTIONS ====================
function handleNumberShortcut(number, chatId) {
    if (number === 0) {
        allRelaysOff();
        sendTelegramMessage("🔻 ปิดรีเลย์ทั้งหมดเรียบร้อย", chatId);
        return true;
    }
    
    if (number === 9) {
        allRelaysOn();
        sendTelegramMessage("⚡ เปิดรีเลย์ทั้งหมดเรียบร้อย", chatId);
        return true;
    }
    
    if (number >= 1 && number <= 4) {
        const relay = relays.find(r => r.id === number);
        const displayName = customNames[number] || relay.name;
        const currentState = relay.state;
        
        const now = Date.now();
        if (lastNumberPress.number === number && (now - lastNumberPress.timestamp) < 2000) {
            if (currentState === true) {
                const success = sendHttpCommand(number, false);
                if (success) {
                    relay.state = false;
                    renderRelays();
                    sendTelegramMessage(`🔻 ปิด ${displayName} เรียบร้อย`, chatId);
                    showToastMessage(`🤖 Telegram: ปิด ${displayName}`);
                }
            } else {
                const success = sendHttpCommand(number, true);
                if (success) {
                    relay.state = true;
                    renderRelays();
                    sendTelegramMessage(`✅ เปิด ${displayName} เรียบร้อย`, chatId);
                    showToastMessage(`🤖 Telegram: เปิด ${displayName}`);
                }
            }
            if (lastNumberPress.timeout) clearTimeout(lastNumberPress.timeout);
            lastNumberPress.number = null;
            lastNumberPress.timestamp = 0;
        } else {
            if (currentState === false) {
                const success = sendHttpCommand(number, true);
                if (success) {
                    relay.state = true;
                    renderRelays();
                    sendTelegramMessage(`✅ เปิด ${displayName} เรียบร้อย`, chatId);
                    showToastMessage(`🤖 Telegram: เปิด ${displayName}`);
                }
            } else {
                sendTelegramMessage(`⏱ ${displayName} เปิดอยู่แล้ว กด ${number} ซ้ำเพื่อปิด`, chatId);
            }
            lastNumberPress.number = number;
            lastNumberPress.timestamp = now;
            
            if (lastNumberPress.timeout) clearTimeout(lastNumberPress.timeout);
            lastNumberPress.timeout = setTimeout(() => {
                lastNumberPress.number = null;
                lastNumberPress.timestamp = 0;
            }, 2000);
        }
        return true;
    }
    
    return false;
}

function processTelegramCommand(text, chatId, fromName) {
    console.log("Telegram command:", text);
    const cmd = text.toLowerCase().trim();
    
    if (cmd === '/help' || cmd === '/start') {
        const helpMsg = `🤖 *TrojanAI (BP) v${VERSION}*\n\n` +
            `⌨️ *คีย์ลัด:*\n` +
            `• \`1\` - เปิดรีเลย์ 1 (กดซ้ำ = ปิด)\n` +
            `• \`2\` - เปิดรีเลย์ 2 (กดซ้ำ = ปิด)\n` +
            `• \`3\` - เปิดรีเลย์ 3 (กดซ้ำ = ปิด)\n` +
            `• \`4\` - เปิดรีเลย์ 4 (กดซ้ำ = ปิด)\n` +
            `• \`0\` - ปิดทั้งหมด\n` +
            `• \`9\` - เปิดทั้งหมด\n\n` +
            `*คำสั่ง:*\n` +
            `/relay1_on /relay1_off\n` +
            `/relay2_on /relay2_off\n` +
            `/relay3_on /relay3_off\n` +
            `/relay4_on /relay4_off\n` +
            `/all_on /all_off\n` +
            `/status\n\n` +
            `*ภาษาไทย:* พิมพ์ "เปิดไฟหลัก" หรือ "ปิดมอเตอร์" ได้เลย!\n\n` +
            `🚀 Hosted on Netlify`;
        
        sendTelegramMessage(helpMsg, chatId);
        return;
    }
    
    if (cmd === '/status') {
        let statusMsg = "📊 *สถานะรีเลย์:*\n\n";
        relays.forEach(relay => {
            const displayNameRelay = customNames[relay.id] || relay.name;
            const statusIcon = relay.state ? '✅ เปิด' : '❌ ปิด';
            statusMsg += `🔌 *${displayNameRelay}*: ${statusIcon}\n`;
        });
        sendTelegramMessage(statusMsg, chatId);
        return;
    }
    
    if (cmd === '/all_on') { allRelaysOn(); sendTelegramMessage("⚡ เปิดทั้งหมดเรียบร้อย", chatId); return; }
    if (cmd === '/all_off') { allRelaysOff(); sendTelegramMessage("🔻 ปิดทั้งหมดเรียบร้อย", chatId); return; }
    
    const relayMatch = cmd.match(/\/relay([1-4])_(on|off)/);
    if (relayMatch) {
        const relayId = parseInt(relayMatch[1]);
        const action = relayMatch[2];
        const targetState = action === 'on';
        const displayNameRelay = customNames[relayId] || relays[relayId-1].name;
        
        const success = sendHttpCommand(relayId, targetState);
        if (success) {
            const relay = relays.find(r => r.id === relayId);
            if (relay) relay.state = targetState;
            renderRelays();
            sendTelegramMessage(`${targetState ? '✅ เปิด' : '🔻 ปิด'} ${displayNameRelay} เรียบร้อย`, chatId);
        } else {
            sendTelegramMessage(`❌ ไม่สามารถ${targetState ? 'เปิด' : 'ปิด'} ${displayNameRelay} ได้`, chatId);
        }
        return;
    }
    
    if (cmd.includes("เปิด") || cmd.includes("ปิด")) {
        let relayId = null;
        for (let i = 1; i <= 4; i++) {
            const customName = customNames[i] ? customNames[i].toLowerCase() : "";
            if (customName && cmd.includes(customName)) { relayId = i; break; }
        }
        
        if (!relayId) {
            const defaultKeywords = { 1: ["ไฟหลัก", "ไฟบ้าน"], 2: ["มอเตอร์", "ปั๊ม"], 3: ["ระบายอากาศ", "พัดลม"], 4: ["อุปกรณ์เสริม", "เสริม"] };
            for (let i = 1; i <= 4; i++) {
                if (defaultKeywords[i].some(kw => cmd.includes(kw))) { relayId = i; break; }
            }
        }
        
        if (relayId) {
            const isOn = cmd.includes("เปิด");
            const displayNameRelay = customNames[relayId] || relays[relayId-1].name;
            const success = sendHttpCommand(relayId, isOn);
            if (success) {
                const relay = relays.find(r => r.id === relayId);
                if (relay) relay.state = isOn;
                renderRelays();
                sendTelegramMessage(`${isOn ? '✅ เปิด' : '🔻 ปิด'} ${displayNameRelay} เรียบร้อย`, chatId);
            } else {
                sendTelegramMessage(`❌ ไม่สามารถ${isOn ? 'เปิด' : 'ปิด'} ${displayNameRelay} ได้`, chatId);
            }
            return;
        }
    }
    
    sendTelegramMessage("❌ ไม่รู้จักคำสั่ง พิมพ์ /help", chatId);
}

function sendTelegramMessage(message, customChatId = null) {
    const targetChatId = customChatId || telegramChatId;
    if (!targetChatId) return;
    
    const url = `https://api.telegram.org/bot${telegramToken}/sendMessage`;
    const params = new URLSearchParams();
    params.append('chat_id', targetChatId);
    params.append('text', message);
    params.append('parse_mode', 'Markdown');
    
    fetch(url, { method: 'POST', body: params }).catch(err => console.log("Send error:", err));
}

function connectTelegram() {
    const tokenInput = document.getElementById('telegram-token');
    telegramToken = tokenInput.value.trim();
    
    if (!telegramToken) {
        showToastMessage("⚠️ กรุณาใส่ Bot Token");
        return;
    }
    
    safeLocalStorageSet('telegramToken', telegramToken);
    
    fetch(`https://api.telegram.org/bot${telegramToken}/getMe`)
        .then(res => res.json())
        .then(data => {
            if (data.ok) {
                isTelegramConnected = true;
                updateConnectionStatus(true, `Telegram: @${data.result.username}`);
                document.getElementById('telegram-status-text').innerHTML = `✅ เชื่อมต่อแล้ว: @${data.result.username}<br>⌨️ คีย์ลัด: 1-4 เปิด, กดซ้ำปิด, 0=ปิดหมด, 9=เปิดหมด`;
                showToastMessage(`✅ เชื่อมต่อ Telegram: @${data.result.username}`);
                startTelegramPolling();
                sendTelegramMessage(`🤖 *TrojanAI (BP) v${VERSION} เชื่อมต่อแล้ว!*\n\n⌨️ *คีย์ลัด:*\n• กด \`1\` เปิด, กด \`1\` ซ้ำ = ปิด\n• กด \`0\` = ปิดทั้งหมด\n• กด \`9\` = เปิดทั้งหมด\n\n📌 พิมพ์ /help เพื่อดูคำสั่งทั้งหมด\n🚀 Hosted on Netlify`);
            } else {
                isTelegramConnected = false;
                updateConnectionStatus(false, 'Telegram: Invalid Token');
                document.getElementById('telegram-status-text').innerHTML = `❌ Token ไม่ถูกต้อง`;
            }
        })
        .catch(err => {
            isTelegramConnected = false;
            updateConnectionStatus(false, 'Telegram: Connection Error');
            document.getElementById('telegram-status-text').innerHTML = `❌ ไม่สามารถเชื่อมต่อได้`;
        });
}

function startTelegramPolling() {
    if (telegramPollingInterval) clearInterval(telegramPollingInterval);
    
    telegramPollingInterval = setInterval(() => {
        if (!isTelegramConnected) return;
        
        fetch(`https://api.telegram.org/bot${telegramToken}/getUpdates?offset=${telegramUpdateOffset}&timeout=30`)
            .then(res => res.json())
            .then(data => {
                if (data.ok && data.result) {
                    data.result.forEach(update => {
                        telegramUpdateOffset = update.update_id + 1;
                        
                        if (update.message && update.message.text) {
                            const chatId = update.message.chat.id;
                            const messageText = update.message.text.trim();
                            
                            if (!telegramChatId) {
                                telegramChatId = chatId;
                                safeLocalStorageSet('telegramChatId', telegramChatId);
                                document.getElementById('telegram-chatid').value = telegramChatId;
                                sendTelegramMessage("✅ บันทึก Chat ID เรียบร้อยแล้ว!", chatId);
                            }
                            
                            document.getElementById('telegram-last-message').innerHTML = `📨 ล่าสุด: ${messageText}`;
                            
                            const numberMatch = messageText.match(/^(\d+)$/);
                            if (numberMatch && handleNumberShortcut(parseInt(numberMatch[1]), chatId)) {
                                return;
                            }
                            
                            processTelegramCommand(messageText, chatId, update.message.from.first_name || "");
                        }
                    });
                }
            })
            .catch(err => console.log("Telegram polling error:", err));
    }, 2000);
}

function stopTelegramPolling() {
    if (telegramPollingInterval) {
        clearInterval(telegramPollingInterval);
        telegramPollingInterval = null;
    }
}

// ==================== VOICE COMMAND FUNCTIONS ====================
function processVoiceCommand(cmd) {
    if (!cmd) return;
    let text = cmd.toLowerCase().trim();
    
    const displayDiv = document.getElementById('voiceCommandDisplay');
    if (displayDiv) {
        displayDiv.innerHTML = `🎤 คำสั่ง: "${cmd}"`;
        setTimeout(() => { if (displayDiv) displayDiv.innerHTML = ''; }, 3000);
    }
    
    if (text.includes("เปิดทั้งหมด")) { allRelaysOn(); return; }
    if (text.includes("ปิดทั้งหมด")) { allRelaysOff(); return; }
    
    if (text.includes("กลางคืน")) {
        updateRelayState(1, true);
        updateRelayState(3, true);
        updateRelayState(2, false);
        updateRelayState(4, false);
        speakFeedback("เปิดโหมดกลางคืน");
        return;
    }
    
    if (text.includes("ประหยัด")) {
        updateRelayState(1, true);
        updateRelayState(2, false);
        updateRelayState(3, false);
        updateRelayState(4, false);
        speakFeedback("เปิดโหมดประหยัดพลังงาน");
        return;
    }
    
    let relayId = null;
    for (let i = 1; i <= 4; i++) {
        const customName = customNames[i] ? customNames[i].toLowerCase() : "";
        if (customName && text.includes(customName)) { relayId = i; break; }
    }
    
    if (!relayId) {
        const defaultKeywords = { 1: ["ไฟหลัก", "ไฟบ้าน"], 2: ["มอเตอร์", "ปั๊ม"], 3: ["ระบายอากาศ", "พัดลม"], 4: ["อุปกรณ์เสริม", "เสริม"] };
        for (let i = 1; i <= 4; i++) {
            if (defaultKeywords[i].some(kw => text.includes(kw))) { relayId = i; break; }
        }
    }
    
    if (!relayId) {
        let match = text.match(/\b([1-4])\b/);
        if (match) relayId = parseInt(match[1]);
    }
    
    if (!relayId) { speakFeedback("ไม่พบอุปกรณ์"); return; }
    
    let isOn = text.includes("เปิด") || text.includes("turn on");
    updateRelayState(relayId, isOn);
}

function setupAutoListening() {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
        console.log("Speech not supported");
        return;
    }
    
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            stream.getTracks().forEach(track => track.stop());
            startRecognition();
        })
        .catch(err => {
            console.error("Microphone denied:", err);
            isAutoListening = false;
            document.getElementById('voice-status-text').innerHTML = '🔇 กรุณาอนุญาตไมโครโฟน';
        });
}

function startRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.lang = 'th-TH';
    recognition.interimResults = true;
    recognition.continuous = true;
    
    recognition.onstart = () => {
        document.getElementById('voiceBadge').classList.add('listening');
        document.getElementById('voice-led').classList.add('listening');
        document.getElementById('voice-status-text').innerHTML = '🎧 AI กำลังฟัง...';
        errorCount = 0;
    };
    
    recognition.onresult = (e) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
            if (e.results[i].isFinal) {
                processVoiceCommand(e.results[i][0].transcript);
            } else {
                document.getElementById('voiceCommandDisplay').innerHTML = `🎤 กำลังฟัง: "${e.results[i][0].transcript}"`;
            }
        }
    };
    
    recognition.onerror = (e) => {
        errorCount++;
        if (e.error === 'not-allowed') {
            document.getElementById('voice-status-text').innerHTML = '🔇 ไม่อนุญาตใช้ไมโครโฟน';
            isAutoListening = false;
        }
        if (errorCount > 10) {
            isAutoListening = false;
            document.getElementById('voice-status-text').innerHTML = '⚠️ หยุดฟังอัตโนมัติ';
        }
    };
    
    recognition.onend = () => {
        document.getElementById('voiceBadge').classList.remove('listening');
        document.getElementById('voice-led').classList.remove('listening');
        if (isAutoListening && errorCount < 10) {
            setTimeout(() => { try { recognition.start(); } catch(e) {} }, 1000);
        } else {
            document.getElementById('voice-status-text').innerHTML = '🤖 AI พร้อมทำงาน';
        }
    };
    
    try { recognition.start(); } catch(e) {}
}

function toggleAutoListen() {
    isAutoListening = !isAutoListening;
    if (isAutoListening) {
        startRecognition();
        document.getElementById('voiceHint').innerHTML = '🎤 AI ฟังอัตโนมัติ (ฟังตลอด)';
        speakFeedback("เปิดโหมดฟังอัตโนมัติ");
    } else {
        if (recognition) recognition.stop();
        document.getElementById('voiceHint').innerHTML = '🎤 AI ปิดฟัง (แตะเพื่อเปิด)';
        speakFeedback("ปิดโหมดฟังอัตโนมัติ");
    }
}

// ==================== OTHER PROTOCOLS ====================
function testHTTPConnection() {
    const baseInput = document.getElementById('http-base-url');
    if (baseInput && baseInput.value.trim()) httpBaseURL = baseInput.value.trim();
    fetch(httpBaseURL, { method: 'HEAD', mode: 'no-cors' })
        .then(() => { updateConnectionStatus(true, 'HTTP พร้อม'); document.getElementById('http-status').innerHTML = '✅ ฐานพร้อมใช้งาน'; })
        .catch(() => { updateConnectionStatus(true, 'HTTP Active'); document.getElementById('http-status').innerHTML = '⚠️ ใช้งานตาม URL'; });
}

function connectMQTT() {
    const broker = document.getElementById('mqtt-broker').value;
    const port = parseInt(document.getElementById('mqtt-port').value);
    const clientId = document.getElementById('mqtt-clientid').value || 'webclient_' + Date.now();
    
    if (mqttClient) try { mqttClient.disconnect(); } catch(e) {}
    
    mqttClient = new Paho.MQTT.Client(broker, port, clientId);
    mqttClient.onConnectionLost = () => { updateConnectionStatus(false, 'MQTT Disconnected'); document.getElementById('mqtt-status').innerHTML = '❌ หลุด'; };
    mqttClient.onMessageArrived = (msg) => {
        const topic = msg.destinationName;
        const payload = msg.payloadString;
        const match = topic.match(/relay\/(\d+)/);
        if (match) {
            let rid = parseInt(match[1]);
            let newState = payload === 'ON' || payload === '1';
            let relay = relays.find(r => r.id === rid);
            if (relay && relay.state !== newState) {
                relay.state = newState;
                renderRelays();
            }
        }
    };
    mqttClient.connect({ 
        timeout: 5, 
        onSuccess: () => { 
            updateConnectionStatus(true, 'MQTT Online'); 
            document.getElementById('mqtt-status').innerHTML = '✅ Connected';
            for(let i = 1; i <= 4; i++) mqttClient.subscribe(`home/relay/${i}/state`);
        }, 
        onFailure: () => { updateConnectionStatus(false, 'MQTT ล้มเหลว'); document.getElementById('mqtt-status').innerHTML = '❌ เชื่อมต่อไม่สำเร็จ'; } 
    });
}

// ==================== INITIALIZATION ====================
document.querySelectorAll('.proto-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.proto-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentProtocol = btn.dataset.proto;
        document.querySelectorAll('.connection-config').forEach(c => c.classList.remove('active'));
        document.getElementById(`${currentProtocol}-config`).classList.add('active');
        
        if (currentProtocol !== 'telegram' && telegramPollingInterval) {
            stopTelegramPolling();
        }
    });
});

document.getElementById('allOnBtn').addEventListener('click', allRelaysOn);
document.getElementById('allOffBtn').addEventListener('click', allRelaysOff);
document.getElementById('syncBtn').addEventListener('click', syncStatus);

function updateTimestamp() { 
    document.getElementById('timestamp').innerHTML = `⏱️ ${new Date().toLocaleTimeString('th-TH')}`;
}

loadStoredSettings();
renderRelays();
updateTimestamp();
setInterval(updateTimestamp, 1000);

setTimeout(() => { setupAutoListening(); }, 1000);

console.log(`✅ TrojanAI (BP) v${VERSION} - ระบบพร้อมทำงาน (Hosted on Netlify)`);
console.log("✅ Telegram + HTTP API with Keyboard Shortcuts");
console.log("✅ คีย์ลัด: 1-4 = เปิด, กดซ้ำ = ปิด, 0 = ปิดหมด, 9 = เปิดหมด");
