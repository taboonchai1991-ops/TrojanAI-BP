// ==================== TELEGRAM CONFIGURATION ====================
const TELEGRAM_BOT_TOKEN = '__BOT_TOKEN__';
const TELEGRAM_CHAT_ID = '__CHAT_ID__';

// ==================== CONFIGURATION ====================
const CUSTOM_ICON_URL = "assets/icons/relay-icon.svg";
const VERSION = "3.2.0";
const RELAY_COUNT = 6;

const relays = [];
for (let i = 1; i <= RELAY_COUNT; i++) {
    relays.push({ id: i, name: `รีเลย์ ${i}`, state: false, label: `RELAY_0${i}`, pin: `D${i}`, icon: CUSTOM_ICON_URL, delay: 0, pendingTimeout: null });
}

let customNames = { 1: "ไฟหลัก", 2: "มอเตอร์ปั๊ม", 3: "ระบายอากาศ", 4: "อุปกรณ์เสริม", 5: "ไฟสวน", 6: "เครื่องกรองน้ำ" };
let relayDelays = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
let currentEditingRelay = null;
let isAutoListening = false;
let recognition = null;
let errorCount = 0;

let httpRelayUrls = {
    1: { on: "http://192.168.1.40/toggle", off: "http://192.168.1.40/toggle" },
    2: { on: "http://192.168.1.189/RELAY=ON", off: "http://192.168.1.189/RELAY=OFF" },
    3: { on: "", off: "" }, 4: { on: "", off: "" }, 5: { on: "", off: "" }, 6: { on: "", off: "" }
};
let httpBaseURL = "http://192.168.1.188";
let lastTelegramMessage = "", lastTelegramTime = 0;

// ==================== TELEGRAM FUNCTIONS ====================
function isTelegramConfigured() {
    return TELEGRAM_BOT_TOKEN && TELEGRAM_BOT_TOKEN !== '__BOT_TOKEN__' && TELEGRAM_CHAT_ID && TELEGRAM_CHAT_ID !== '__CHAT_ID__';
}

async function sendTelegramAlert(message, relayName, action) {
    if (!isTelegramConfigured()) return false;
    const now = Date.now();
    const msgKey = `${relayName}_${action}`;
    if (lastTelegramMessage === msgKey && now - lastTelegramTime < 2000) return false;
    lastTelegramMessage = msgKey;
    lastTelegramTime = now;
    
    const fullMessage = `🔌 *TrojanAI (BP)*\n\n📡 *อุปกรณ์:* ${relayName}\n⚡ *สถานะ:* ${action === 'ON' ? '✅ เปิด' : '❌ ปิด'}\n⏰ *เวลา:* ${new Date().toLocaleString('th-TH')}`;
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    try {
        const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: fullMessage, parse_mode: 'Markdown' }) });
        const result = await response.json();
        updateTelegramStatus(result.ok);
        return result.ok;
    } catch (error) { updateTelegramStatus(false); return false; }
}

function updateTelegramStatus(isConnected) {
    const statusEl = document.getElementById('telegramStatusText');
    if (statusEl) {
        if (!isTelegramConfigured()) statusEl.innerHTML = '⚠️ Telegram: ไม่ได้กำหนดค่า';
        else if (isConnected) statusEl.innerHTML = '✅ Telegram: พร้อมแจ้งเตือน';
        else statusEl.innerHTML = '⚠️ Telegram: เกิดข้อผิดพลาด';
    }
}

// ==================== UTILITY ====================
function safeLocalStorageSet(key, value) { try { localStorage.setItem(key, value); return true; } catch(e) { showToastMessage("⚠️ พื้นที่เก็บข้อมูลเต็ม"); return false; } }
function escapeHtml(text) { const div = document.createElement('div'); div.textContent = text; return div.innerHTML; }
function showToastMessage(msg) { let toast = document.createElement('div'); toast.className = 'toast-message'; toast.innerText = msg; document.body.appendChild(toast); setTimeout(() => toast.remove(), 2000); }
function speakFeedback(text) { if ('speechSynthesis' in window) { window.speechSynthesis.cancel(); let u = new SpeechSynthesisUtterance(text); u.lang = 'th-TH'; u.rate = 0.9; window.speechSynthesis.speak(u); } }

// ==================== LOAD/SAVE ====================
function loadStoredSettings() {
    const storedNames = localStorage.getItem('relayCustomNames');
    if (storedNames) { try { const parsed = JSON.parse(storedNames); customNames = parsed; for (let i = 1; i <= RELAY_COUNT; i++) { if (customNames[i]) relays[i-1].name = customNames[i]; } } catch(e) {} }
    const storedDelays = localStorage.getItem('relayDelays');
    if (storedDelays) { try { const parsed = JSON.parse(storedDelays); relayDelays = parsed; for (let i = 1; i <= RELAY_COUNT; i++) { relays[i-1].delay = relayDelays[i] || 0; } } catch(e) {} }
    const storedUrls = localStorage.getItem('httpRelayUrls');
    const storedBase = localStorage.getItem('httpBaseURL');
    if (storedUrls) { try { const parsed = JSON.parse(storedUrls); for (let i = 1; i <= RELAY_COUNT; i++) { if (parsed[i]) httpRelayUrls[i] = { on: parsed[i].on || "", off: parsed[i].off || "" }; } } catch(e) {} }
    if (storedBase) httpBaseURL = storedBase;
    for (let i = 1; i <= RELAY_COUNT; i++) {
        const onInput = document.getElementById(`relay${i}-on`);
        const offInput = document.getElementById(`relay${i}-off`);
        const delayInput = document.getElementById(`relay${i}-delay`);
        if (onInput) onInput.value = httpRelayUrls[i].on;
        if (offInput) offInput.value = httpRelayUrls[i].off;
        if (delayInput) delayInput.value = relayDelays[i] || 0;
    }
    const baseInput = document.getElementById('http-base-url');
    if (baseInput) baseInput.value = httpBaseURL;
    updateTelegramStatus(isTelegramConfigured());
}

function saveCustomNames() { safeLocalStorageSet('relayCustomNames', JSON.stringify(customNames)); }
function saveDelays() { safeLocalStorageSet('relayDelays', JSON.stringify(relayDelays)); }

function saveRelayUrls() {
    for (let i = 1; i <= RELAY_COUNT; i++) {
        httpRelayUrls[i] = { on: document.getElementById(`relay${i}-on`).value.trim(), off: document.getElementById(`relay${i}-off`).value.trim() };
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
    if (baseInput && baseInput.value.trim()) httpBaseURL = baseInput.value.trim();
    safeLocalStorageSet('httpRelayUrls', JSON.stringify(httpRelayUrls));
    safeLocalStorageSet('httpBaseURL', httpBaseURL);
    saveDelays();
    showToastMessage("✅ บันทึกเรียบร้อย");
}

// ==================== HTTP API ====================
function getHttpUrl(relayId, state) {
    const urls = httpRelayUrls[relayId];
    if (state && urls.on && urls.on !== "") return urls.on;
    if (!state && urls.off && urls.off !== "") return urls.off;
    return `${httpBaseURL}/${state ? "ON" : "OFF"}`;
}

function sendHttpCommand(relayId, state) {
    const url = getHttpUrl(relayId, state);
    if (url && url !== "") { fetch(url, { method: 'GET', mode: 'no-cors' }).catch(e => console.log("HTTP sent:", url)); return true; }
    else { showToastMessage(`⚠️ ไม่มี URL สำหรับรีเลย์ ${relayId}`); return false; }
}

function testHTTPConnection() {
    const baseInput = document.getElementById('http-base-url');
    if(baseInput && baseInput.value.trim()) httpBaseURL = baseInput.value.trim();
    fetch(httpBaseURL, { method:'HEAD', mode:'no-cors' }).then(()=>{ document.getElementById('http-status').innerHTML='✅ ฐานพร้อมใช้งาน'; }).catch(()=>{ document.getElementById('http-status').innerHTML='⚠️ ใช้งานตาม URL'; });
}

// ==================== RELAY CONTROL ====================
function renderRelays() {
    const grid = document.getElementById('relayGrid'); if (!grid) return;
    grid.innerHTML = '';
    relays.forEach((relay) => {
        const card = document.createElement('div'); card.className = `relay-card ${relay.state ? 'active' : ''}`; card.dataset.id = relay.id;
        const displayName = customNames[relay.id] || relay.name;
        const delayValue = relayDelays[relay.id] || 0;
        card.innerHTML = `<button class="edit-name-btn" onclick="event.stopPropagation(); openNameModal(${relay.id}, '${displayName.replace(/'/g, "\\'")}')"><span>✏️</span> ตั้งชื่อ</button>
            <div class="relay-icon"><img src="${relay.icon}" alt="Relay ${relay.id}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Ccircle cx=\'50\' cy=\'50\' r=\'45\' fill=\'%2300ffff\'/%3E%3Ctext x=\'50\' y=\'67\' text-anchor=\'middle\' fill=\'%23000\' font-size=\'40\'%3E${relay.id}%3C/text%3E%3C/svg%3E'"></div>
            <div class="relay-number">RELAY ${relay.id}</div><div class="relay-name">${escapeHtml(displayName)}</div>
            <div class="relay-label">${relay.label} (${relay.pin})</div>
            <div class="delay-control"><label>⏱</label><input type="number" id="delay-${relay.id}" min="0" max="60" step="0.5" value="${delayValue}" onchange="updateRelayDelay(${relay.id}, this.value)" onclick="event.stopPropagation()"><span>วินาที</span></div>
            <div class="relay-state ${relay.state ? 'state-on' : 'state-off'}">${relay.state ? 'ON' : 'OFF'}</div>`;
        card.onclick = (e) => { if (!e.target.classList.contains('edit-name-btn') && !e.target.closest('.edit-name-btn') && !e.target.closest('.delay-control')) toggleRelay(relay.id); };
        grid.appendChild(card);
    });
}

function updateRelayDelay(relayId, value) {
    let delay = parseFloat(value); if (isNaN(delay)) delay = 0; if (delay < 0) delay = 0; if (delay > 60) delay = 60;
    relayDelays[relayId] = delay; relays[relayId-1].delay = delay; saveDelays();
    document.getElementById(`delay-${relayId}`).value = delay;
    showToastMessage(`ตั้งค่าหน่วงเวลา ${delay} วินาที`);
}

function toggleRelay(id) { const relay = relays.find(r => r.id === id); if (relay) updateRelayState(id, !relay.state); }

function updateRelayState(relayId, newState) {
    const relay = relays.find(r => r.id === relayId); if (!relay) return;
    if (relay.pendingTimeout) { clearTimeout(relay.pendingTimeout); relay.pendingTimeout = null; }
    const delay = relayDelays[relayId] || 0;
    const displayName = customNames[relayId] || relay.name;
    if (delay > 0) {
        showToastMessage(`⏱ ${displayName} จะ${newState ? 'เปิด' : 'ปิด'} ใน ${delay} วินาที`);
        speakFeedback(`หน่วงเวลา ${delay} วินาที ${displayName} จะ${newState ? 'เปิด' : 'ปิด'}`);
        relay.pendingTimeout = setTimeout(() => { executeRelayCommand(relayId, newState); relay.pendingTimeout = null; }, delay * 1000);
    } else executeRelayCommand(relayId, newState);
}

async function executeRelayCommand(relayId, newState) {
    const relay = relays.find(r => r.id === relayId); if (!relay || relay.state === newState) return;
    const success = sendHttpCommand(relayId, newState);
    if (success) {
        relay.state = newState; renderRelays();
        const displayName = customNames[relayId] || relay.name;
        const stateText = newState ? 'เปิด' : 'ปิด';
        const actionText = newState ? 'ON' : 'OFF';
        showToastMessage(`🔌 ${displayName} → ${stateText}`);
        speakFeedback(`${displayName} ${stateText} แล้ว`);
        await sendTelegramAlert(`${displayName} ถูก${stateText}`, displayName, actionText);
    }
}

async function allRelaysOn() {
    for (const r of relays) { if (!r.state) { sendHttpCommand(r.id, true); r.state = true; await sendTelegramAlert(`${customNames[r.id] || r.name} ถูกเปิด`, customNames[r.id] || r.name, 'ON'); } }
    renderRelays(); showToastMessage("⚡ เปิดทั้งหมด"); speakFeedback("เปิดรีเลย์ทั้งหมด");
}

async function allRelaysOff() {
    for (const r of relays) { if (r.state) { sendHttpCommand(r.id, false); r.state = false; await sendTelegramAlert(`${customNames[r.id] || r.name} ถูกปิด`, customNames[r.id] || r.name, 'OFF'); } }
    renderRelays(); showToastMessage("🔻 ปิดทั้งหมด"); speakFeedback("ปิดรีเลย์ทั้งหมด");
}

function syncStatus() { showToastMessage("🔄 SYNC"); }

// ==================== MODAL ====================
function openNameModal(relayId, currentName) { currentEditingRelay = relayId; document.getElementById('nameModal').classList.add('active'); document.getElementById('relayNameInput').value = currentName; document.getElementById('modalTitle').innerHTML = `ตั้งชื่อ RELAY ${relayId}`; }
function saveRelayName() { const newName = document.getElementById('relayNameInput').value.trim(); if (!newName) { showToastMessage("⚠️ กรุณาใส่ชื่อ"); return; } customNames[currentEditingRelay] = newName; saveCustomNames(); const relay = relays.find(r => r.id === currentEditingRelay); if (relay) relay.name = newName; renderRelays(); closeModal(); speakFeedback(`ตั้งชื่อ ${newName} เรียบร้อย`); }
function deleteRelayName() { delete customNames[currentEditingRelay]; saveCustomNames(); const defaultNames = { 1: "ไฟหลัก", 2: "มอเตอร์ปั๊ม", 3: "ระบายอากาศ", 4: "อุปกรณ์เสริม", 5: "ไฟสวน", 6: "เครื่องกรองน้ำ" }; const relay = relays.find(r => r.id === currentEditingRelay); if (relay) relay.name = defaultNames[currentEditingRelay] || `รีเลย์ ${currentEditingRelay}`; renderRelays(); closeModal(); }
function closeModal() { document.getElementById('nameModal').classList.remove('active'); currentEditingRelay = null; }

// ==================== VOICE ====================
async function processVoiceCommand(cmd) {
    if(!cmd) return; let text = cmd.toLowerCase().trim();
    const displayDiv = document.getElementById('voiceCommandDisplay');
    if(displayDiv){ displayDiv.innerHTML = `🎤 คำสั่ง: "${cmd}"`; setTimeout(()=>{ if(displayDiv) displayDiv.innerHTML=''; },3000); }
    if(text.includes("เปิดทั้งหมด")){ allRelaysOn(); return; }
    if(text.includes("ปิดทั้งหมด")){ allRelaysOff(); return; }
    if(text.includes("กลางคืน")){ updateRelayState(1,true); updateRelayState(5,true); for(let i=2;i<=4;i++) updateRelayState(i,false); updateRelayState(6,false); speakFeedback("เปิดโหมดกลางคืน"); return; }
    if(text.includes("ประหยัด")){ updateRelayState(1,true); for(let i=2;i<=6;i++) updateRelayState(i,false); speakFeedback("เปิดโหมดประหยัด"); return; }
    let relayId = null;
    for (let i = 1; i <= RELAY_COUNT; i++) { if(customNames[i] && text.includes(customNames[i].toLowerCase())){ relayId=i; break; } }
    if(!relayId){ const kw={1:["ไฟหลัก"],2:["มอเตอร์","ปั๊ม"],3:["ระบายอากาศ"],4:["อุปกรณ์เสริม"],5:["ไฟสวน","สวน"],6:["เครื่องกรอง","กรองน้ำ"]}; for(let i=1;i<=RELAY_COUNT;i++){ if(kw[i] && kw[i].some(k=>text.includes(k))){ relayId=i; break; } } }
    if(!relayId){ let match = text.match(/\b([1-6])\b/); if(match) relayId=parseInt(match[1]); }
    if(!relayId){ speakFeedback("ไม่พบอุปกรณ์"); return; }
    let isOn = text.includes("เปิด") || text.includes("turn on");
    updateRelayState(relayId, isOn);
}

function setupAutoListening() {
    if(!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) { document.getElementById('voice-status-text').innerHTML='❌ ไม่รองรับการฟัง'; return; }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream=>{ stream.getTracks().forEach(t=>t.stop()); startRecognition(); }).catch(err=>{ isAutoListening=false; document.getElementById('voice-status-text').innerHTML='🔇 กรุณาอนุญาตไมโครโฟน'; });
}

function startRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition(); recognition.lang='th-TH'; recognition.interimResults=true; recognition.continuous=true;
    recognition.onstart=()=>{ document.getElementById('voiceBadge').classList.add('listening'); document.getElementById('voice-led').classList.add('listening'); document.getElementById('voice-status-text').innerHTML='🎧 กำลังฟัง...'; errorCount=0; };
    recognition.onresult=(e)=>{ for(let i=e.resultIndex;i<e.results.length;i++){ if(e.results[i].isFinal) processVoiceCommand(e.results[i][0].transcript); else document.getElementById('voiceCommandDisplay').innerHTML=`🎤 กำลังฟัง: "${e.results[i][0].transcript}"`; } };
    recognition.onerror=(e)=>{ errorCount++; if(e.error==='not-allowed'){ document.getElementById('voice-status-text').innerHTML='🔇 ไม่อนุญาตไมโครโฟน'; isAutoListening=false; } if(errorCount>10){ isAutoListening=false; document.getElementById('voice-status-text').innerHTML='⚠️ หยุดฟังอัตโนมัติ'; } };
    recognition.onend=()=>{ document.getElementById('voiceBadge').classList.remove('listening'); document.getElementById('voice-led').classList.remove('listening'); if(isAutoListening && errorCount<10){ setTimeout(()=>{ try{ recognition.start(); }catch(e){} },1000); } else { document.getElementById('voice-status-text').innerHTML='🤖 AI พร้อมทำงาน'; } };
    try{ recognition.start(); }catch(e){}
}

function toggleAutoListen() {
    isAutoListening=!isAutoListening;
    if(isAutoListening){ if(recognition) try{ recognition.stop(); }catch(e){} startRecognition(); document.getElementById('voiceHint').innerHTML='🎤 กำลังฟังอัตโนมัติ...'; speakFeedback("เปิดโหมดฟังอัตโนมัติ"); }
    else { if(recognition) recognition.stop(); document.getElementById('voiceHint').innerHTML='🎤 แตะเพื่อเปิดฟัง'; speakFeedback("ปิดโหมดฟังอัตโนมัติ"); }
}

// ==================== INIT ====================
document.getElementById('allOnBtn').addEventListener('click', allRelaysOn);
document.getElementById('allOffBtn').addEventListener('click', allRelaysOff);
document.getElementById('syncBtn').addEventListener('click', syncStatus);

function updateTimestamp() { document.getElementById('timestamp').innerHTML = `⏱️ ${new Date().toLocaleTimeString('th-TH')}`; }

loadStoredSettings(); renderRelays(); updateTimestamp(); setInterval(updateTimestamp,1000);
console.log(`✅ TrojanAI (BP) v${VERSION} พร้อมทำงาน`);
