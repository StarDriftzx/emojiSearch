/* ============================================
   表情包搜索器 - Offscreen Document v1.0
   在有完整 DOM 环境的离屏文档中执行剪贴板写入操作
   解决 Service Worker 中 ClipboardItem 不可用的问题
   Chrome 官方推荐方案：https://developer.chrome.com/docs/extensions/reference/api/offscreen
   ============================================ */

chrome.runtime.onMessage.addListener(handleMessages);

async function handleMessages(message) {
  // 只处理发给 offscreen 的消息
  if (message.target !== 'offscreen') return;

  if (message.type === 'COPY_IMAGE') {
    try {
      const { base64, mimeType, forceGif } = message.data;

      // 将 base64 还原为 Blob
      const blob = base64ToBlob(base64, mimeType);
      console.log('[Offscreen] 收到图片数据:', mimeType, blob.size, 'bytes, forceGif=', forceGif);

      // 根据类型决定写入策略
      if (mimeType !== 'image/gif') {
        // 非 GIF：统一转 PNG 写入
        const result = await writeNonGifToClipboard(blob);
        chrome.runtime.sendMessage({ type: 'COPY_RESULT', success: result.success, message: result.message, error: result.error });
      } else {
        // GIF 动图策略
        const result = await writeGifToClipboard(blob, forceGif);
        chrome.runtime.sendMessage({ type: 'COPY_RESULT', success: result.success, message: result.message, error: result.error });
      }
    } catch (err) {
      console.error('[Offscreen] 复制图片失败:', err);
      chrome.runtime.sendMessage({ type: 'COPY_RESULT', success: false, error: err.message });
    }
  }
}

// base64 转 Blob
function base64ToBlob(base64, mimeType) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

// Blob 转 PNG（使用 canvas）
function convertToPng(blob) {
  return new Promise((resolve) => {
    const img = new Image();
    const blobUrl = URL.createObjectURL(blob);
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((pngBlob) => {
          URL.revokeObjectURL(blobUrl);
          resolve(pngBlob);
        }, 'image/png');
      } catch (canvasErr) {
        URL.revokeObjectURL(blobUrl);
        console.error('[Offscreen] convertToPng canvas 操作失败:', canvasErr);
        resolve(null);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(blobUrl);
      console.error('[Offscreen] convertToPng 图片加载失败');
      resolve(null);
    };
    img.src = blobUrl;
  });
}

// 非 GIF 图片写入剪贴板
async function writeNonGifToClipboard(blob) {
  const mimeType = blob.type || 'image/jpeg';

  // 如果已经是 PNG，直接写入
  if (mimeType === 'image/png') {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      console.log('[Offscreen] PNG 直接写入成功');
      return { success: true, message: '✅ 表情包已复制到剪贴板！' };
    } catch (err) {
      console.warn('[Offscreen] PNG 直接写入失败:', err.message);
      return { success: false, error: err.message };
    }
  }

  // 非 PNG：转 PNG 后写入
  const pngBlob = await convertToPng(blob);
  if (pngBlob) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': pngBlob })
      ]);
      console.log('[Offscreen] 转 PNG 写入成功');
      return { success: true, message: '✅ 表情包已复制到剪贴板！' };
    } catch (err) {
      console.warn('[Offscreen] 转 PNG 写入失败:', err.message);
    }
  }

  // PNG 转换也失败：尝试直接当 PNG 写
  try {
    const wrappedBlob = new Blob([blob], { type: 'image/png' });
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': wrappedBlob })
    ]);
    console.log('[Offscreen] 强制 PNG 写入成功');
    return { success: true, message: '✅ 表情包已复制到剪贴板！' };
  } catch (err) {
    console.warn('[Offscreen] 强制 PNG 写入失败:', err.message);
    return { success: false, error: err.message };
  }
}

// GIF 动图写入剪贴板
async function writeGifToClipboard(blob, forceGif) {
  // forceGif=false：强制静态 PNG
  if (forceGif === false) {
    const pngBlob = await convertToPng(blob);
    if (pngBlob) {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': pngBlob })
        ]);
        console.log('[Offscreen] GIF→PNG 静态图写入成功');
        return { success: true, message: '✅ 已复制为静态图' };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }
    return { success: false, error: 'GIF 转 PNG 失败' };
  }

  // forceGif=true 或 undefined：尝试保留动图
  // 检测 Web Custom Format 支持
  const webGifSupported = typeof ClipboardItem !== 'undefined' &&
    typeof ClipboardItem.supports === 'function' &&
    ClipboardItem.supports('web image/gif');

  if (webGifSupported) {
    try {
      const items = {};
      items['web image/gif'] = blob;

      // 自动模式（undefined）：同时写入 PNG 静态帧
      if (forceGif !== true) {
        const pngBlob = await convertToPng(blob);
        if (pngBlob) {
          items['image/png'] = pngBlob;
        }
      }

      await navigator.clipboard.write([
        new ClipboardItem(items)
      ]);
      console.log('[Offscreen] Web Custom Format GIF 写入成功');
      if (forceGif === true) {
        return { success: true, message: '✅ GIF 动图已复制！粘贴到支持 GIF 的应用可保留动画' };
      }
      return { success: true, message: '✅ GIF 动图已复制！Web 端粘贴保留动画，桌面端粘贴为静态图' };
    } catch (webFmtErr) {
      console.warn('[Offscreen] Web Custom Format GIF 写入失败:', webFmtErr.message || webFmtErr);
    }
  }

  // 回退：尝试标准 image/gif
  try {
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/gif': blob })
    ]);
    console.log('[Offscreen] 标准 image/gif 写入成功');
    return { success: true, message: '✅ GIF 动图已复制到剪贴板！' };
  } catch (gifErr) {
    console.warn('[Offscreen] 标准 image/gif 写入失败:', gifErr.message || gifErr);
  }

  // 最终回退：PNG 静态帧
  const pngBlob = await convertToPng(blob);
  if (pngBlob) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': pngBlob })
      ]);
      console.log('[Offscreen] PNG 回退写入成功');
      return { success: true, message: '✅ 已复制为静态图（当前浏览器不支持 GIF 动图复制）' };
    } catch (pngErr) {
      console.warn('[Offscreen] PNG 回退写入也失败:', pngErr.message || pngErr);
    }
  }

  return { success: false, error: '所有剪贴板写入方式均失败' };
}
