/* ============================================
   表情包搜索器 - Background Service Worker v1.5
   代理所有 API 请求，绕过 CORS 限制
   支持 JSON API 代理、图片 Blob 代理、通过 Offscreen Document 写入剪贴板
   v1.5: Service Worker 保活心跳（防止 30s 休眠导致 sendMessage 空响应）
   ============================================ */

// ============ Service Worker 保活机制 ============
// Chrome MV3 中 Service Worker 空闲 30s 后会被休眠，导致 sendMessage 回调收到 undefined。
// 通过 chrome.alarms 每 25s 触发一次轻量心跳，保持 Worker 活跃。
const KEEPALIVE_ALARM = 'meme-keepalive';

// 安装时注册心跳 alarm
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(KEEPALIVE_ALARM, { periodInMinutes: 25 / 60 }); // 每 25 秒
  console.log('[Background] 保活心跳已注册');
});

// 启动时也注册（Service Worker 重启后 alarm 丢失）
chrome.alarms.get(KEEPALIVE_ALARM, (alarm) => {
  if (!alarm) {
    chrome.alarms.create(KEEPALIVE_ALARM, { periodInMinutes: 25 / 60 });
    console.log('[Background] 保活心跳重新注册');
  }
});

// 心跳触发时无需做任何事，alarm 回调本身就足以保持 Worker 活跃
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === KEEPALIVE_ALARM) {
    // 空操作，仅保持 Worker 存活
  }
});

// ============ Offscreen Document 管理 ============
// Offscreen Document 提供完整 DOM 环境，支持 ClipboardItem 写入图片
// Chrome 官方推荐方案，解决 Service Worker 中 ClipboardItem 不可用的问题

let creatingOffscreen = null;

async function ensureOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL('offscreen.html');

  // Chrome 116+：使用 getContexts 检查是否已存在
  if (chrome.runtime.getContexts) {
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
      documentUrls: [offscreenUrl]
    });
    if (existingContexts.length > 0) {
      return; // 已存在，直接复用
    }
  }

  // 避免并发创建
  if (creatingOffscreen) {
    await creatingOffscreen;
    return;
  }

  creatingOffscreen = chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['CLIPBOARD'],
    justification: 'Writing image data to clipboard via ClipboardItem API',
  });
  await creatingOffscreen;
  creatingOffscreen = null;
  console.log('[Background] Offscreen Document 已创建');
}

// ============ 消息监听 ============

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'MEME_FETCH') {
    handleFetch(request.url, request.options)
      .then(data => sendResponse({ success: true, data }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.type === 'MEME_FETCH_BLOB') {
    handleFetchBlob(request.url)
      .then(data => sendResponse({ success: true, data }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  // 通过 Offscreen Document 写入剪贴板
  if (request.type === 'MEME_COPY_IMAGE') {
    handleCopyImage(request.url, request.forceGif)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  // Offscreen Document 返回的剪贴板写入结果
  // （不需要 sendResponse，结果已由 handleCopyImage 的 Promise 链处理）
});

// ============ API 代理 ============

async function handleFetch(url, options = {}) {
  try {
    const resp = await fetch(url, {
      method: options.method || 'GET',
      headers: options.headers || {},
    });
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
    }
    const data = await resp.json();
    return data;
  } catch (err) {
    console.error('[Background Fetch Error]', err);
    throw err;
  }
}

async function handleFetchBlob(url) {
  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
    }
    const blob = await resp.blob();
    const mimeType = blob.type || 'image/jpeg';
    const arrayBuffer = await blob.arrayBuffer();
    const base64 = arrayBufferToBase64(arrayBuffer);
    return { base64, mimeType };
  } catch (err) {
    console.error('[Background Fetch Blob Error]', err);
    throw err;
  }
}

// ============ 剪贴板图片写入（通过 Offscreen Document） ============

async function handleCopyImage(url, forceGif) {
  try {
    // 1. 获取图片数据
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
    }
    const blob = await resp.blob();
    const mimeType = blob.type || 'image/jpeg';
    console.log('[Background Copy] 获取图片成功:', mimeType, blob.size, 'bytes, forceGif=', forceGif);

    // 2. 转为 base64 传给 Offscreen Document
    const arrayBuffer = await blob.arrayBuffer();
    const base64 = arrayBufferToBase64(arrayBuffer);

    // 3. 确保 Offscreen Document 存在
    await ensureOffscreenDocument();

    // 4. 发消息给 Offscreen Document 执行剪贴板写入
    const result = await sendToOffscreen({
      type: 'COPY_IMAGE',
      target: 'offscreen',
      data: { base64, mimeType, forceGif }
    });

    console.log('[Background Copy] Offscreen 写入结果:', result.success, result.message || result.error);
    return result;

  } catch (err) {
    console.error('[Background Copy] 复制图片失败:', err);
    return { success: false, error: err.message };
  }
}

// 向 Offscreen Document 发送消息并等待结果
function sendToOffscreen(message) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Offscreen Document 响应超时'));
    }, 15000); // 15s 超时

    // 监听 Offscreen Document 返回的结果
    const listener = (response) => {
      if (response && response.type === 'COPY_RESULT') {
        clearTimeout(timeout);
        chrome.runtime.onMessage.removeListener(listener);
        resolve(response);
      }
    };
    chrome.runtime.onMessage.addListener(listener);

    // 发送消息
    chrome.runtime.sendMessage(message).catch(err => {
      clearTimeout(timeout);
      chrome.runtime.onMessage.removeListener(listener);
      reject(err);
    });
  });
}

// ArrayBuffer 转 Base64
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
