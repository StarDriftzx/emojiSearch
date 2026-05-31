/* ============================================
   表情包搜索器 - Content Script v18
   更新：
   1. API 通过 Background 代理绕过 CORS
   2. 滚动穿透锁定
   3. v3: 替换废弃的 Giphy beta key 和 Tenor API
   4. v4: 新增百度表情包渠道（免费免注册，开箱即用）
   5. v5: 修复 CSS 布局修改导致百度搜索失效的问题
   6. v6: 新增搜狗表情包渠道，隐藏付费渠道
      - 新增搜狗（sginput.qq.com）免费免注册渠道
      - 只保留百度、搜狗、Emoji 三个渠道
      - 优化渠道切换区域滚动条样式
      - 添加滚动到底部自动加载下一页（无限滚动）
   7. v7: 新增自定义 API 接口功能
      - 支持用户自定义添加免费 API 接口
      - chrome.storage.sync 持久化存储
      - 通用 JSON 路径解析器（支持 data.list, res.0.url 等路径）
      - URL 模板支持 {query} 和 {page} 占位符
      - 管理面板：添加/编辑/删除/开关自定义 API
   8. v8: 新增收藏表情包功能
      - chrome.storage.local 持久化收藏数据（突破 sync 100KB 限制）
      - 每个卡片右上角 ☆/★ 收藏按钮
      - ⭐ 收藏渠道 Tab（按时间倒序展示）
      - 收藏渠道支持关键词搜索（本地过滤）
      - 收藏视图内取消收藏自动移除卡片（动画）
      - 收藏 Tab 显示实时计数 badge
      - GIF 三级剪贴板回退策略（原格式→PNG 静态帧→链接）
      - GIF 右键菜单（复制图片/链接/新标签页打开）
   9. v9: 修复 GIF 动图复制功能
      - 使用 Web Custom Formats (`web image/gif`) 写入 GIF 原始数据，保留动画帧
      - 同时写入 `image/png` 静态帧，确保原生应用也能粘贴
      - `ClipboardItem.supports()` 运行时检测格式支持
      - GIF 右键菜单增加"复制 GIF 动图"选项
      - 优化复制提示，区分动图/静态图
  10. v10: 修复图片复制变成链接文本的问题
      - 根因：content script 的 navigator.clipboard.write() 受 transient activation 限制，
        异步网络请求（proxyFetchBlob）完成后用户手势上下文已过期，导致写入被拒绝
      - 修复：优先通过 Background Service Worker 写入剪贴板（有 clipboardWrite 权限，无需用户手势）
      - 新增 MEME_COPY_IMAGE 消息类型，Background 直接 fetch + clipboard.write
      - Background 使用 OffscreenCanvas + createImageBitmap 进行 GIF→PNG 转换（无需 DOM）
      - 保留 content script 写入作为回退策略
  11. v11: 修复频道切换竞态条件 + Offscreen Document 剪贴板写入
      - 修复百度/搜狗频道切换偶发不加载：用 requestId 替代 searchAbortFlag，
        彻底消除异步竞态窗口（旧请求响应回来时 flag 已被重置导致结果错乱）
  12. v12: API 请求自动重试机制
      - 新增 proxyFetchWithRetry()，网络错误/超时自动重试最多 3 次
      - 指数退避：1s → 2s → 4s，避免频繁请求
      - 重试期间检查 requestId，用户切换频道后自动终止重试
      - 搜索和热门加载使用重试，loadMore 不加重试（滚动加载体验自然）
      - 重试时 UI 显示"正在重试 (1/3)…"提示，耗尽后友好提示
      - 图片复制改用 Offscreen Document 方案（v1.8.0 manifest）：
        Service Worker 中 ClipboardItem 不可用，改由 Offscreen Document 执行剪贴板写入
      - Background v1.4：fetch 图片→base64→发消息给 Offscreen Document→写入剪贴板→返回结果
      - 新增 offscreen.html / offscreen.js
  13. v13: 按钮注入自定义配置
      - 新增注入模式：全局注入（默认）/ 仅指定元素 / 关闭注入
      - 支持自定义 XPath 指定注入目标
      - 支持 4 种按钮位置：外部后面、内部末尾、外部前面、内部前面
      - 设置面板增加"按钮注入"Tab 页
      - 配置持久化到 chrome.storage.sync
      - 新增盒子表情渠道（apihzbqb.php）
      - 修复盒子表情无法滚动加载（API 不返回 maxpage 字段）
  14. v14: 悬浮窗按钮 + 鼠标选元素
      - 关闭注入模式下，页面侧边显示可拖动悬浮窗按钮作为入口
      - 全局注入和自定义模式下也显示悬浮窗按钮（可配置）
      - 自定义规则支持"鼠标选择页面元素"自动生成 XPath
      - 元素选择模式：hover 高亮、点击确认、自动推导 XPath
  15. v15: CSS 选择器 → XPath
      - 自定义注入规则从 CSS 选择器切换为 XPath 表达式
      - 新增 queryXPathAll / matchesXPath 辅助函数
      - 新增 generateXPath 生成器（id → class → attr → 位置路径）
      - 默认规则改为 XPath 格式
      - 修复元素选择器模式进入时弹窗未关闭的问题
  16. v16: 增强搜索诊断日志
      - proxyFetch 增加 sendMessage try-catch，捕获扩展上下文失效异常
      - 识别 "Extension context invalidated" / "message port closed" 错误并给出明确提示
      - directFetch 增加 CORS 错误日志
      - 所有请求失败路径增加 URL 和详细错误信息
  17. v17: 修复弹窗关闭后再打开无法加载的 bug
      - 根因：Chrome MV3 Service Worker 休眠后 sendMessage 回调收到 undefined response
        （lastError 也为 undefined），导致 proxyFetch 误判为"请求失败"直接 reject
      - 修复 proxyFetch：response 为 undefined 时自动重试一次 sendMessage（100ms 后），
        重试仍失败才 fallback 到 directFetch
      - openPopup 复用弹窗时完整重置搜索状态（isLoading/isLoadingMore/hasMorePages/columnHeights）
      - Background v1.5：Service Worker 保活心跳（每 25s 空闲 alarm，防止 30s 休眠）
  18. v18: 修复搜狗表情搜索失败（CORS 回退策略优化）
      - 根因：搜狗 API（h5api.sginput.qq.com）不支持 CORS，当 Background 代理因 SW 唤醒
        失败而回退到 directFetch 时，CORS 阻止了请求；百度/盒子 API 支持 CORS 所以不受影响
      - 新增 NO_CORS_DOMAINS 域名黑名单，标记不支持 CORS 的 API 域名
      - proxyFetch 改进：对 NO-CORS 域名，SW 唤醒重试从 1 次增加到 3 次（200/400/800ms），
        重试耗尽后直接报错而非回退到必败的 directFetch
      - searchFromChannel 增加渠道名诊断日志，方便排查特定渠道问题
  ============================================ */

// 防止重复注入
if (!window.__memeSearchLoaded) {
  window.__memeSearchLoaded = true;

  // ============ 内置搜索渠道配置 ============
  const BUILTIN_CHANNELS = [
    {
      id: 'baidu',
      name: '百度表情',
      icon: '🔥',
      type: 'image',
      provider: 'baidu',
      builtin: true,
      searchUrl: (q, page) => {
        return `https://cn.apihz.cn/api/img/apihzbqbbaidu.php?id=10017359&key=8e38c1b761f08d6bf4d27bb05005ee98&limit=24&page=${page}&words=${encodeURIComponent(q)}`;
      },
      trendingUrl: (page) => {
        const hotWords = ['开心', '搞笑', '可爱', '沙雕', '哭', '无语', '加油', '生气'];
        const word = hotWords[Math.floor(Math.random() * hotWords.length)];
        return `https://cn.apihz.cn/api/img/apihzbqbbaidu.php?id=10017359&key=8e38c1b761f08d6bf4d27bb05005ee98&limit=24&page=${page}&words=${encodeURIComponent(word)}`;
      },
      parseResponse: (data) => {
        if (!data || data.code !== 200 || !Array.isArray(data.res)) return { items: [], hasMore: false };
        const maxpage = parseInt(data.maxpage) || 1;
        const page = parseInt(data.page) || 1;
        return {
          items: data.res.map((url, i) => ({
            id: `baidu_${page}_${i}`,
            url: url,
            preview: url,
            type: 'image',
          })),
          hasMore: page < maxpage,
        };
      },
    },
    {
      id: 'hezi',
      name: '盒子表情',
      icon: '📦',
      type: 'image',
      provider: 'hezi',
      builtin: true,
      searchUrl: (q, page) => {
        return `https://cn.apihz.cn/api/img/apihzbqb.php?id=10017359&key=8e38c1b761f08d6bf4d27bb05005ee98&type=1&limit=10&page=${page}&words=${encodeURIComponent(q)}`;
      },
      trendingUrl: (page) => {
        const hotWords = ['开心', '搞笑', '可爱', '沙雕', '哭', '无语', '加油', '生气'];
        const word = hotWords[Math.floor(Math.random() * hotWords.length)];
        return `https://cn.apihz.cn/api/img/apihzbqb.php?id=10017359&key=8e38c1b761f08d6bf4d27bb05005ee98&type=1&limit=10&page=${page}&words=${encodeURIComponent(word)}`;
      },
      parseResponse: (data) => {
        if (!data || data.code !== 200 || !Array.isArray(data.res)) return { items: [], hasMore: false };
        const maxpage = parseInt(data.maxpage) || 0;
        const page = parseInt(data.page) || 0;
        // 盒子表情 API 不返回 maxpage/page，按返回数量判断：有结果则可能还有更多
        const hasMore = maxpage > 0 ? (page < maxpage) : (data.res.length > 0);
        return {
          items: data.res.map((url, i) => ({
            id: `hezi_${page || 1}_${i}`,
            url: url,
            preview: url,
            type: 'image',
          })),
          hasMore,
        };
      },
    },
    {
      id: 'sogou',
      name: '搜狗表情',
      icon: '🐶',
      type: 'image',
      provider: 'sogou',
      builtin: true,
      searchUrl: (q, page) => {
        return `https://h5api.sginput.qq.com/wxbq/search?key=${encodeURIComponent(q)}&page=${page}&num=20`;
      },
      trendingUrl: (page) => {
        const hotWords = ['开心', '搞笑', '可爱', '沙雕', '哭', '无语', '加油', '生气', '哈哈', '狗子'];
        const word = hotWords[Math.floor(Math.random() * hotWords.length)];
        return `https://h5api.sginput.qq.com/wxbq/search?key=${encodeURIComponent(word)}&page=${page}&num=20`;
      },
      parseResponse: (data) => {
        if (!data || data.code !== 0 || !Array.isArray(data.data)) return { items: [], hasMore: false };
        return {
          items: data.data.map((item, i) => ({
            id: `sogou_${item.imageId || i}`,
            url: item.indexUrl,
            preview: item.indexUrl,
            type: item.format === 'gif' ? 'image' : 'image',
            width: item.realWidth,
            height: item.realHeight,
            format: item.format,
          })),
          hasMore: data.hasMore === 1 && !data.endFlag,
        };
      },
    },
    {
      id: 'emoji',
      name: 'Emoji表情',
      icon: '😀',
      type: 'emoji',
      builtin: true,
    },
  ];

  // ============ 动态渠道列表（内置 + 自定义） ============
  let CHANNELS = [...BUILTIN_CHANNELS];
  let customApis = []; // 用户自定义 API 配置列表

  let currentChannel = 0;
  let currentQuery = '';
  let currentPage = 1;
  let hasMorePages = false;
  let isLoading = false;
  let isLoadingMore = false;
  let searchRequestId = 0; // 请求 ID，用于取消过期的搜索/加载请求
  const MAX_RETRY = 3;     // API 请求最大重试次数
  const RETRY_DELAYS = [1000, 2000, 4000]; // 重试间隔（指数退避：1s, 2s, 4s）
  let columnHeights = [0, 0, 0];
  let popupEl = null;
  let overlayEl = null;
  let activeInput = null;
  let bodyOverflowBackup = '';
  let settingsPanelOpen = false; // 设置面板是否打开

  // ============ 自定义 API 存储 ============
  const STORAGE_KEY = 'meme_custom_apis';

  // ============ 按钮注入配置 ============
  const INJECT_CONFIG_KEY = 'meme_inject_config';
  // mode: 'all' = 注入到所有输入框, 'custom' = 仅注入到匹配规则的元素, 'off' = 不自动注入
  // rules: [{ selector: 'XPath表达式', position: 'after-outside'|'after-inside'|'before-outside'|'before-inside' }]
  // position 说明: after-outside = 元素外部后面(当前默认), after-inside = 元素内部末尾,
  //               before-outside = 元素外部前面, before-inside = 元素内部前面
  // showFloatBtn: 是否显示悬浮窗按钮（默认 true，off 模式强制显示）
  const DEFAULT_INJECT_CONFIG = {
    mode: 'custom',
    rules: [
      { selector: '//div[contains(@class, "expression")]', position: 'after-inside' },
    ],
    showFloatBtn: true,
  };
  let injectConfig = { ...DEFAULT_INJECT_CONFIG };

  // ============ 收藏存储 ============
  const FAVORITES_KEY = 'meme_favorites';
  let favorites = []; // 收藏列表缓存

  async function loadCustomApis() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        const result = await chrome.storage.sync.get(STORAGE_KEY);
        customApis = result[STORAGE_KEY] || [];
      }
    } catch (e) {
      console.warn('[表情包搜索] 读取自定义 API 配置失败:', e);
      customApis = [];
    }
    rebuildChannels();
  }

  async function saveCustomApis() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        await chrome.storage.sync.set({ [STORAGE_KEY]: customApis });
      }
    } catch (e) {
      console.error('[表情包搜索] 保存自定义 API 配置失败:', e);
    }
  }

  async function loadInjectConfig() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        const result = await chrome.storage.sync.get(INJECT_CONFIG_KEY);
        if (result[INJECT_CONFIG_KEY]) {
          injectConfig = { ...DEFAULT_INJECT_CONFIG, ...result[INJECT_CONFIG_KEY] };
          // 确保 rules 数组存在
          if (!Array.isArray(injectConfig.rules)) {
            injectConfig.rules = [...DEFAULT_INJECT_CONFIG.rules];
          }
        }
      }
    } catch (e) {
      console.warn('[表情包搜索] 读取按钮注入配置失败:', e);
      injectConfig = { ...DEFAULT_INJECT_CONFIG };
    }
  }

  async function saveInjectConfig() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        await chrome.storage.sync.set({ [INJECT_CONFIG_KEY]: injectConfig });
      }
    } catch (e) {
      console.error('[表情包搜索] 保存按钮注入配置失败:', e);
    }
  }

  // 将自定义 API 配置转换为渠道对象
  function customApiToChannel(apiConfig) {
    return {
      id: apiConfig.id,
      name: apiConfig.name || '自定义API',
      icon: apiConfig.icon || '🌐',
      type: 'image',
      provider: 'custom',
      builtin: false,
      enabled: apiConfig.enabled !== false,
      customConfig: apiConfig, // 保存原始配置供编辑用
      searchUrl: (q, page) => {
        let url = apiConfig.urlTemplate
          .replace(/\{query\}/g, encodeURIComponent(q))
          .replace(/\{page\}/g, page);
        return url;
      },
      trendingUrl: (page) => {
        // 自定义 API 如果有 trendingUrlTemplate 则用，否则用默认词搜索
        if (apiConfig.trendingUrlTemplate) {
          let url = apiConfig.trendingUrlTemplate
            .replace(/\{page\}/g, page);
          return url;
        }
        // 用默认热词 + searchUrl 模板
        const hotWords = ['开心', '搞笑', '可爱', '沙雕', '哭', '无语', '加油', '生气'];
        const word = hotWords[Math.floor(Math.random() * hotWords.length)];
        let url = apiConfig.urlTemplate
          .replace(/\{query\}/g, encodeURIComponent(word))
          .replace(/\{page\}/g, page);
        return url;
      },
      parseResponse: (data) => {
        return parseCustomApiResponse(data, apiConfig);
      },
    };
  }

  // 通用 JSON 路径解析器
  // path 格式示例: "data.list", "res", "data.0.items"
  // 支持: 点号分隔属性名, 数字索引表示数组
  function resolveJsonPath(obj, path) {
    if (!path || !obj) return undefined;
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
      if (current == null) return undefined;
      // 数字索引
      if (/^\d+$/.test(part)) {
        current = current[parseInt(part)];
      } else {
        current = current[part];
      }
    }
    return current;
  }

  // 解析自定义 API 的响应
  function parseCustomApiResponse(data, apiConfig) {
    try {
      // 1. 检查成功标识
      if (apiConfig.successCheck) {
        const successVal = resolveJsonPath(data, apiConfig.successCheck);
        // 如果配置了成功检查路径但值不匹配，认为失败
        if (successCheckFails(successVal, apiConfig.successValue)) {
          return { items: [], hasMore: false };
        }
      }

      // 2. 获取列表数据
      const listPath = apiConfig.listPath || 'data';
      const list = resolveJsonPath(data, listPath);
      if (!Array.isArray(list)) return { items: [], hasMore: false };

      // 3. 解析每条数据
      const imageUrlPath = apiConfig.imageUrlPath || 'url';
      const previewUrlPath = apiConfig.previewUrlPath || '';
      const widthPath = apiConfig.widthPath || '';
      const heightPath = apiConfig.heightPath || '';

      const items = list.map((item, i) => {
        const url = resolveJsonPath(item, imageUrlPath);
        if (!url) return null;
        const result = {
          id: `custom_${apiConfig.id}_${i}`,
          url: url,
          preview: previewUrlPath ? (resolveJsonPath(item, previewUrlPath) || url) : url,
          type: 'image',
        };
        if (widthPath) result.width = resolveJsonPath(item, widthPath);
        if (heightPath) result.height = resolveJsonPath(item, heightPath);
        return result;
      }).filter(Boolean);

      // 4. 判断是否有更多页
      let hasMore = false;
      if (apiConfig.hasMorePath) {
        const hasMoreVal = resolveJsonPath(data, apiConfig.hasMorePath);
        if (typeof hasMoreVal === 'boolean') hasMore = hasMoreVal;
        else if (typeof hasMoreVal === 'number') hasMore = hasMoreVal === 1;
        else if (typeof hasMoreVal === 'string') hasMore = hasMoreVal === '1' || hasMoreVal.toLowerCase() === 'true';
      } else {
        // 默认：有结果就假设可能还有更多
        hasMore = items.length >= 10;
      }

      // 5. 通过最大页码判断
      if (apiConfig.maxPagePath && apiConfig.pagePath) {
        const maxPage = parseInt(resolveJsonPath(data, apiConfig.maxPagePath)) || 0;
        const currentPage = parseInt(resolveJsonPath(data, apiConfig.pagePath)) || 1;
        hasMore = currentPage < maxPage;
      }

      return { items, hasMore };
    } catch (e) {
      console.error('[表情包搜索] 解析自定义 API 响应失败:', e, data);
      return { items: [], hasMore: false };
    }
  }

  // 成功检查判断
  function successCheckFails(actual, expected) {
    if (expected === undefined || expected === '') return false;
    const expectedStr = String(expected);
    if (actual === undefined || actual === null) return true;
    return String(actual) !== expectedStr;
  }

  // 重建渠道列表（内置 + 启用的自定义）
  function rebuildChannels() {
    CHANNELS = [...BUILTIN_CHANNELS];
    customApis.forEach(api => {
      if (api.enabled !== false) {
        CHANNELS.push(customApiToChannel(api));
      }
    });
    // 如果当前选中的渠道索引超出范围，重置到 0
    if (currentChannel >= CHANNELS.length) {
      currentChannel = 0;
    }
  }

  // ============ 收藏功能核心逻辑 ============
  async function loadFavorites() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const result = await chrome.storage.local.get(FAVORITES_KEY);
        favorites = result[FAVORITES_KEY] || [];
      }
    } catch (e) {
      console.warn('[表情包搜索] 读取收藏数据失败:', e);
      favorites = [];
    }
  }

  async function saveFavorites() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({ [FAVORITES_KEY]: favorites });
      }
    } catch (e) {
      console.error('[表情包搜索] 保存收藏数据失败:', e);
    }
  }

  function isFavorite(id) {
    return favorites.some(f => f.id === id);
  }

  async function toggleFavorite(item) {
    const idx = favorites.findIndex(f => f.id === item.id);
    if (idx >= 0) {
      favorites.splice(idx, 1);
      await saveFavorites();
      showToast('💔 已取消收藏');
      return false;
    } else {
      favorites.push({
        id: item.id,
        url: item.url,
        preview: item.preview || item.url,
        type: item.type || 'image',
        emoji: item.emoji || undefined,
        name: item.name || undefined,
        timestamp: Date.now(),
      });
      await saveFavorites();
      showToast('⭐ 已收藏');
      return true;
    }
  }

  // ============ 通过 Background 代理 fetch（绕过 CORS）============
  const FETCH_TIMEOUT = 15000;

  // 不支持 CORS 的域名列表（directFetch 会被浏览器阻止，必须走 Background 代理）
  const NO_CORS_DOMAINS = ['h5api.sginput.qq.com'];

  // 检查 URL 是否属于不支持 CORS 的域名
  function isNoCorsUrl(url) {
    try {
      const hostname = new URL(url).hostname;
      return NO_CORS_DOMAINS.some(domain => hostname === domain || hostname.endsWith('.' + domain));
    } catch { return false; }
  }

  // 单次 sendMessage 调用（含 undefined response 检测）
  function sendMessageToBackground(url) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('请求超时，请稍后重试'));
      }, FETCH_TIMEOUT);

      try {
        chrome.runtime.sendMessage({ type: 'MEME_FETCH', url }, (response) => {
          clearTimeout(timer);

          if (chrome.runtime.lastError) {
            const errMsg = chrome.runtime.lastError.message;
            console.warn('[表情包搜索] sendMessage lastError:', errMsg);
            if (errMsg.includes('Extension context invalidated') || errMsg.includes('message port closed')) {
              console.error('[表情包搜索] ⚠️ 扩展上下文已失效！请在 chrome://extensions/ 重新加载扩展，然后刷新页面。');
              reject(new Error('EXT_CONTEXT_INVALIDATED'));
            } else {
              // 其他 lastError（如 Service Worker 休眠唤醒），尝试重试
              reject(new Error('SENDMSG_UNDEFINED_RETRY'));
            }
            return;
          }

          if (response && response.success) {
            resolve(response.data);
          } else if (response === undefined || response === null) {
            // Chrome MV3 已知问题：Service Worker 休眠后唤醒时，sendMessage 回调
            // 可能收到 undefined response（且 lastError 也为空），导致误判为"请求失败"。
            console.warn('[表情包搜索] sendMessage 收到空响应（Service Worker 可能正在唤醒），将重试…');
            reject(new Error('SENDMSG_UNDEFINED_RETRY'));
          } else {
            const errMsg = response?.error || '请求失败（无响应）';
            console.error('[表情包搜索] proxyFetch 请求失败:', errMsg, 'URL:', url);
            reject(new Error(errMsg));
          }
        });
      } catch (err) {
        clearTimeout(timer);
        console.error('[表情包搜索] proxyFetch sendMessage 异常:', err);
        if (err.message && (err.message.includes('Extension context invalidated') || err.message.includes('message port closed'))) {
          console.error('[表情包搜索] ⚠️ 扩展上下文已失效！请在 chrome://extensions/ 重新加载扩展，然后刷新页面。');
          reject(new Error('EXT_CONTEXT_INVALIDATED'));
        } else {
          reject(new Error('SENDMSG_UNDEFINED_RETRY'));
        }
      }
    });
  }

  async function proxyFetch(url) {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      const noCors = isNoCorsUrl(url);
      try {
        return await sendMessageToBackground(url);
      } catch (err) {
        // 扩展上下文已彻底失效，只能 fallback
        if (err.message === 'EXT_CONTEXT_INVALIDATED') {
          if (noCors) {
            console.error('[表情包搜索] 扩展上下文失效，且该 API 不支持 CORS，无法回退:', url);
            throw new Error('EXT_CONTEXT_INVALIDATED_NO_CORS');
          }
          console.warn('[表情包搜索] 扩展上下文失效，fallback 到 directFetch（可能受 CORS 限制）');
          return await directFetch(url);
        }
        // sendMessage 收到空响应或 lastError —— 对不支持 CORS 的域名多重重试
        if (err.message === 'SENDMSG_UNDEFINED_RETRY') {
          const maxRetries = noCors ? 3 : 1; // 不支持 CORS 的域名重试 3 次，其他 1 次
          const retryDelays = noCors ? [200, 400, 800] : [100];
          for (let i = 0; i < maxRetries; i++) {
            console.log(`[表情包搜索] 等待 ${retryDelays[i]}ms 后重试 sendMessage（第 ${i + 1}/${maxRetries} 次）${noCors ? '[No-CORS 域名]' : ''}…`);
            await new Promise(r => setTimeout(r, retryDelays[i]));
            try {
              return await sendMessageToBackground(url);
            } catch (retryErr) {
              if (retryErr.message === 'EXT_CONTEXT_INVALIDATED') {
                if (noCors) {
                  console.error('[表情包搜索] 扩展上下文在重试中失效，且 API 不支持 CORS:', url);
                  throw new Error('EXT_CONTEXT_INVALIDATED_NO_CORS');
                }
                return await directFetch(url);
              }
              if (retryErr.message !== 'SENDMSG_UNDEFINED_RETRY') {
                // 非 SW 唤醒类错误（如超时、API 错误），不再重试 sendMessage
                break;
              }
              console.warn(`[表情包搜索] sendMessage 重试 ${i + 1} 仍失败:`, retryErr.message);
            }
          }
          // 不支持 CORS 的域名直接抛错，不回退到 directFetch
          if (noCors) {
            console.error('[表情包搜索] Background 代理重试耗尽，该 API 不支持 CORS 无法回退 directFetch:', url);
            throw new Error('PROXY_EXHAUSTED_NO_CORS');
          }
          // 支持 CORS 的域名回退到 directFetch
          console.warn('[表情包搜索] sendMessage 重试仍失败，fallback 到 directFetch:', url);
          return await directFetch(url);
        }
        // 其他错误（超时、API 错误等）
        if (noCors) {
          console.error('[表情包搜索] Background 代理失败，且 API 不支持 CORS:', url, err.message);
          throw err; // 不回退 directFetch
        }
        return await directFetch(url);
      }
    }
    console.log('[表情包搜索] chrome.runtime 不可用，使用 directFetch');
    return directFetch(url);
  }

  async function directFetch(url) {
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return resp.json();
    } catch (err) {
      console.error('[表情包搜索] directFetch 失败 (可能是 CORS 限制):', err.message, 'URL:', url);
      throw err;
    }
  }

  // 带自动重试的代理请求（用于搜索和加载热门表情包）
  // 网络错误、超时、HTTP 5xx 时自动重试，指数退避
  // 请求被用户切换频道取消时（requestId 不匹配）不再重试
  async function proxyFetchWithRetry(url, requestId) {
    let lastError = null;
    for (let attempt = 0; attempt <= MAX_RETRY; attempt++) {
      try {
        // 每次重试前检查请求是否已过期
        if (requestId !== undefined && requestId !== searchRequestId) {
          console.log('[表情包搜索] 请求已过期，终止重试');
          throw new Error('REQUEST_CANCELLED');
        }

        if (attempt > 0) {
          const delay = RETRY_DELAYS[attempt - 1] || 4000;
          console.log(`[表情包搜索] 第 ${attempt} 次重试，${delay}ms 后请求:`, url);
          // 更新 UI 显示重试状态
          updateRetryStatus(attempt, MAX_RETRY);
          await new Promise(resolve => setTimeout(resolve, delay));

          // 延迟后再次检查请求是否过期
          if (requestId !== undefined && requestId !== searchRequestId) {
            console.log('[表情包搜索] 延迟后请求已过期，终止重试');
            throw new Error('REQUEST_CANCELLED');
          }
        }

        const data = await proxyFetch(url);
        return data;
      } catch (err) {
        lastError = err;
        // 请求被取消，不重试
        if (err.message === 'REQUEST_CANCELLED') throw err;
        // 非网络类错误（如数据解析失败）不重试
        if (err.message && err.message.includes('JSON')) throw err;
        // CORS/代理不可恢复的错误，不重试（重试也不会成功）
        if (err.message === 'PROXY_EXHAUSTED_NO_CORS' || err.message === 'EXT_CONTEXT_INVALIDATED_NO_CORS') throw err;

        console.warn(`[表情包搜索] 请求失败 (第 ${attempt + 1}/${MAX_RETRY + 1} 次):`, err.message);

        // 已达最大重试次数
        if (attempt >= MAX_RETRY) {
          console.error('[表情包搜索] 已达最大重试次数，放弃');
          throw lastError;
        }
      }
    }
    throw lastError;
  }

  // 更新加载区域的重试状态提示
  function updateRetryStatus(attempt, maxRetry) {
    const loadingEl = document.querySelector('.meme-loading');
    if (loadingEl) {
      const statusEl = loadingEl.querySelector('.meme-retry-status');
      const text = `请求失败，正在重试 (${attempt}/${maxRetry})…`;
      if (statusEl) {
        statusEl.textContent = text;
      } else {
        const span = document.createElement('div');
        span.className = 'meme-retry-status';
        span.style.cssText = 'font-size:12px;color:#999;margin-top:6px;';
        span.textContent = text;
        loadingEl.appendChild(span);
      }
    }
  }

  // ============ 样式注入 ============
  function injectStyles() {
    if (document.getElementById('meme-search-styles')) return;
    const style = document.createElement('style');
    style.id = 'meme-search-styles';
    style.textContent = `
      /* 触发按钮 */
      .meme-trigger-btn {
        position: fixed;
        width: 28px;
        height: 28px;
        border-radius: 6px;
        border: 1px solid #e0e0e0;
        background: #fff;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        z-index: 10000;
        transition: all 0.15s ease;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        padding: 0;
        line-height: 1;
      }
      .meme-trigger-btn:hover {
        background: #f0f7ff;
        border-color: #4a90d9;
        transform: scale(1.1);
        box-shadow: 0 2px 8px rgba(74,144,217,0.3);
      }

      /* body 滚动锁定 */
      body.meme-no-scroll {
        overflow: hidden !important;
      }

      /* 遮罩层 */
      .meme-overlay {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.35);
        z-index: 99998;
        animation: meme-fade-in 0.2s ease;
        overscroll-behavior: contain;
      }

      /* 弹窗 */
      .meme-popup {
        position: fixed;
        top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        width: 520px;
        max-height: 560px;
        background: #ffffff;
        border-radius: 16px;
        box-shadow: 0 12px 40px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.05);
        z-index: 99999;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        animation: meme-slide-up 0.25s ease;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        overscroll-behavior: contain;
      }

      /* 弹窗头部 */
      .meme-popup-header {
        padding: 16px 20px 12px;
        border-bottom: 1px solid #f0f0f0;
        display: flex;
        align-items: center;
        gap: 10px;
        flex-shrink: 0;
      }
      .meme-popup-header .meme-title {
        font-size: 16px;
        font-weight: 600;
        color: #1a1a1a;
        flex: 1;
      }
      .meme-popup-close {
        width: 30px; height: 30px;
        border-radius: 8px;
        border: none;
        background: #f5f5f5;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        color: #666;
        transition: all 0.15s;
        flex-shrink: 0;
      }
      .meme-popup-close:hover {
        background: #fee;
        color: #e44;
      }
      /* 设置按钮 */
      .meme-popup-settings-btn {
        width: 30px; height: 30px;
        border-radius: 8px;
        border: none;
        background: #f5f5f5;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        color: #666;
        transition: all 0.15s;
        flex-shrink: 0;
      }
      .meme-popup-settings-btn:hover {
        background: #f0f7ff;
        color: #4a90d9;
      }
      /* 搜索框 */
      .meme-search-box {
        padding: 12px 20px;
        border-bottom: 1px solid #f0f0f0;
        flex-shrink: 0;
      }
      .meme-search-input-wrap {
        display: flex;
        align-items: center;
        gap: 8px;
        background: #f7f8fa;
        border-radius: 10px;
        padding: 0 12px;
        border: 2px solid transparent;
        transition: border-color 0.2s;
      }
      .meme-search-input-wrap:focus-within {
        border-color: #4a90d9;
        background: #fff;
      }
      .meme-search-icon {
        font-size: 18px;
        flex-shrink: 0;
        opacity: 0.4;
      }
      .meme-search-input {
        flex: 1;
        border: none;
        outline: none;
        background: transparent;
        font-size: 14px;
        padding: 10px 0;
        color: #1a1a1a;
      }
      .meme-search-input::placeholder {
        color: #aaa;
      }
      .meme-search-btn {
        padding: 6px 14px;
        border-radius: 8px;
        border: none;
        background: #4a90d9;
        color: #fff;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.15s;
        flex-shrink: 0;
      }
      .meme-search-btn:hover { background: #3a7bc8; }
      .meme-search-btn:disabled { background: #ccc; cursor: not-allowed; }

      /* 渠道标签栏 */
      .meme-channels {
        display: flex;
        padding: 8px 20px;
        gap: 6px;
        border-bottom: 1px solid #f0f0f0;
        overflow-x: auto;
        flex-shrink: 0;
        overscroll-behavior: contain;
        scrollbar-width: none;
        -ms-overflow-style: none;
      }
      .meme-channels::-webkit-scrollbar {
        display: none;
      }
      .meme-channel-tab {
        padding: 6px 14px;
        border-radius: 20px;
        border: 1px solid #e8e8e8;
        background: #fafafa;
        cursor: pointer;
        font-size: 13px;
        color: #666;
        white-space: nowrap;
        transition: all 0.15s;
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .meme-channel-tab:hover {
        background: #f0f7ff;
        border-color: #4a90d9;
        color: #4a90d9;
      }
      .meme-channel-tab.active {
        background: #4a90d9;
        border-color: #4a90d9;
        color: #fff;
      }
      .meme-channel-tab .meme-custom-badge {
        font-size: 10px;
        background: #ff9800;
        color: #fff;
        border-radius: 4px;
        padding: 0 3px;
        margin-left: 2px;
        line-height: 1.4;
      }
      /* 结果区域 - 外层容器 */
      .meme-results {
        flex: 1;
        overflow-y: auto;
        padding: 12px 16px;
        overscroll-behavior: contain;
        -webkit-overflow-scrolling: touch;
      }
      /* 瀑布流模式（有结果时）— 使用多列 Flex 布局，追加新元素不会重排 */
      .meme-results.results-waterfall {
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
        gap: 0 10px;
        align-items: flex-start;
      }
      /* 瀑布流列容器 */
      .meme-results.results-waterfall .meme-waterfall-column {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      /* 居中提示模式（加载/空/Key提示） */
      .meme-results.results-centered {
        display: flex;
        justify-content: center;
        align-items: center;
      }
      .meme-results::-webkit-scrollbar { width: 6px; }
      .meme-results::-webkit-scrollbar-thumb {
        background: #ddd;
        border-radius: 3px;
      }

      /* 表情包卡片 */
      .meme-item {
        position: relative;
        border-radius: 10px;
        overflow: hidden;
        cursor: pointer;
        background: #f7f8fa;
        border: 2px solid transparent;
        transition: border-color 0.2s ease, box-shadow 0.2s ease;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      }
      .meme-item:hover {
        border-color: #4a90d9;
        box-shadow: 0 4px 12px rgba(74,144,217,0.2);
      }
      .meme-item img {
        width: 100%;
        height: auto;
        display: block;
        background: #f7f8fa;
      }
      .meme-item .meme-item-emoji {
        width: 100%;
        aspect-ratio: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 42px;
        user-select: all;
      }
      .meme-item .meme-copy-hint {
        position: absolute;
        bottom: 0; left: 0; right: 0;
        padding: 4px;
        background: rgba(0,0,0,0.6);
        color: #fff;
        font-size: 11px;
        text-align: center;
        opacity: 0;
        transition: opacity 0.15s;
      }
      .meme-item:hover .meme-copy-hint { opacity: 1; }

      /* 加载 & 空状态 & API Key 提示 */
      .meme-loading, .meme-empty {
        break-inside: avoid;
        text-align: center;
        padding: 40px 20px;
        color: #999;
        width: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
      }
      /* 加载更多（滚动底部） */
      .meme-load-more {
        text-align: center;
        padding: 16px 0;
        color: #999;
        font-size: 13px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 100%;
        flex-shrink: 0;
      }
      .meme-load-more .spinner {
        width: 18px; height: 18px;
        border: 2px solid #e8e8e8;
        border-top-color: #4a90d9;
        border-radius: 50%;
        animation: meme-spin 0.8s linear infinite;
      }
      .meme-load-more.no-more {
        color: #ccc;
        font-size: 12px;
      }
      .meme-loading .spinner {
        width: 32px; height: 32px;
        border: 3px solid #e8e8e8;
        border-top-color: #4a90d9;
        border-radius: 50%;
        animation: meme-spin 0.8s linear infinite;
        margin: 0 auto 12px;
      }
      .meme-empty .emoji { font-size: 40px; margin-bottom: 8px; }
      /* Toast 提示 */
      .meme-toast {
        position: fixed;
        bottom: 40px;
        left: 50%;
        transform: translateX(-50%) translateY(20px);
        background: #333;
        color: #fff;
        padding: 10px 20px;
        border-radius: 10px;
        font-size: 14px;
        z-index: 100000;
        opacity: 0;
        transition: all 0.3s ease;
        pointer-events: none;
      }
      .meme-toast.show {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }

      /* 右键菜单（GIF 卡片） */
      .meme-ctx-menu {
        position: fixed;
        z-index: 100002;
        background: #fff;
        border-radius: 10px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.18);
        padding: 6px 0;
        min-width: 160px;
        animation: meme-ctx-in 0.15s ease;
        overflow: hidden;
      }
      @keyframes meme-ctx-in {
        from { opacity: 0; transform: scale(0.92); }
        to { opacity: 1; transform: scale(1); }
      }
      .meme-ctx-menu .meme-ctx-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 16px;
        font-size: 13px;
        color: #333;
        cursor: pointer;
        transition: background 0.15s;
      }
      .meme-ctx-menu .meme-ctx-item:hover {
        background: #f0f4ff;
      }
      .meme-ctx-menu .meme-ctx-item .meme-ctx-icon {
        font-size: 16px;
        flex-shrink: 0;
      }
      .meme-ctx-menu .meme-ctx-divider {
        height: 1px;
        background: #eee;
        margin: 4px 0;
      }

      /* 收藏按钮 */
      .meme-fav-btn {
        position: absolute;
        top: 6px;
        right: 6px;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: none;
        background: rgba(255,255,255,0.85);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        opacity: 0;
        transition: all 0.2s ease;
        z-index: 2;
        padding: 0;
        line-height: 1;
        box-shadow: 0 1px 4px rgba(0,0,0,0.15);
      }
      .meme-item:hover .meme-fav-btn { opacity: 1; }
      .meme-fav-btn.favorited { opacity: 1; background: rgba(255,245,220,0.95); }
      .meme-fav-btn:hover { transform: scale(1.15); background: #fff; }

      /* 收藏空状态 */
      .meme-fav-empty {
        text-align: center;
        padding: 40px 20px;
        color: #999;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
      }
      .meme-fav-empty .emoji { font-size: 40px; }

      /* ============ 自定义 API 管理面板 ============ */
      .meme-settings-overlay {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.35);
        z-index: 100001;
        animation: meme-fade-in 0.2s ease;
        overscroll-behavior: contain;
      }
      .meme-settings-panel {
        position: fixed;
        top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        width: 480px;
        max-height: 600px;
        background: #fff;
        border-radius: 16px;
        box-shadow: 0 12px 40px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.05);
        z-index: 100002;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        animation: meme-slide-up 0.25s ease;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      .meme-settings-header {
        padding: 16px 20px 12px;
        border-bottom: 1px solid #f0f0f0;
        display: flex;
        align-items: center;
        gap: 10px;
        flex-shrink: 0;
      }
      .meme-settings-header .meme-settings-title {
        font-size: 16px;
        font-weight: 600;
        color: #1a1a1a;
        flex: 1;
      }
      .meme-settings-body {
        flex: 1;
        overflow-y: auto;
        padding: 16px 20px;
        overscroll-behavior: contain;
      }
      .meme-settings-body::-webkit-scrollbar { width: 6px; }
      .meme-settings-body::-webkit-scrollbar-thumb {
        background: #ddd;
        border-radius: 3px;
      }
      .meme-settings-footer {
        padding: 12px 20px;
        border-top: 1px solid #f0f0f0;
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        flex-shrink: 0;
      }
      /* Tab 栏 */
      .meme-settings-tabs {
        display: flex;
        border-bottom: 1px solid #f0f0f0;
        padding: 0 20px;
        flex-shrink: 0;
      }
      .meme-settings-tab {
        padding: 10px 16px;
        font-size: 13px;
        font-weight: 500;
        color: #888;
        cursor: pointer;
        border-bottom: 2px solid transparent;
        transition: all 0.15s;
        user-select: none;
      }
      .meme-settings-tab:hover { color: #555; }
      .meme-settings-tab.active { color: #4a90d9; border-bottom-color: #4a90d9; }
      /* 注入设置 */
      .meme-inject-section { margin-bottom: 16px; }
      .meme-inject-section-title {
        font-size: 13px;
        font-weight: 600;
        color: #1a1a1a;
        margin-bottom: 10px;
      }
      .meme-inject-mode-group {
        display: flex;
        gap: 8px;
        margin-bottom: 14px;
        flex-wrap: wrap;
      }
      .meme-inject-mode-btn {
        padding: 8px 14px;
        border-radius: 8px;
        border: 1px solid #ddd;
        background: #fafbfc;
        font-size: 13px;
        cursor: pointer;
        transition: all 0.15s;
        color: #555;
      }
      .meme-inject-mode-btn:hover { border-color: #4a90d9; color: #4a90d9; }
      .meme-inject-mode-btn.active {
        background: #4a90d9;
        color: #fff;
        border-color: #4a90d9;
      }
      .meme-inject-mode-desc {
        font-size: 12px;
        color: #999;
        margin-top: -6px;
        margin-bottom: 14px;
        line-height: 1.5;
      }
      .meme-inject-rule-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 12px;
        border-radius: 10px;
        border: 1px solid #eee;
        margin-bottom: 8px;
        background: #fafbfc;
      }
      .meme-inject-rule-selector {
        flex: 1;
        font-family: 'SFMono-Regular', Consolas, monospace;
        font-size: 12px;
        padding: 6px 8px;
        border: 1px solid #ddd;
        border-radius: 6px;
        background: #fff;
        color: #333;
        min-width: 0;
      }
      .meme-inject-rule-selector:focus { border-color: #4a90d9; outline: none; }
      .meme-inject-rule-position {
        font-size: 12px;
        padding: 6px 8px;
        border: 1px solid #ddd;
        border-radius: 6px;
        background: #fff;
        color: #555;
        cursor: pointer;
        flex-shrink: 0;
      }
      .meme-inject-rule-delete {
        width: 28px;
        height: 28px;
        border: none;
        background: none;
        cursor: pointer;
        font-size: 14px;
        color: #ccc;
        border-radius: 6px;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .meme-inject-rule-delete:hover { background: #fee; color: #e44; }
      .meme-inject-add-rule {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        width: 100%;
        padding: 10px;
        border-radius: 8px;
        border: 1px dashed #ccc;
        background: #fafbfc;
        font-size: 13px;
        color: #888;
        cursor: pointer;
        transition: all 0.15s;
      }
      .meme-inject-add-rule:hover { border-color: #4a90d9; color: #4a90d9; }
      .meme-inject-preview {
        margin-top: 12px;
        padding: 10px 12px;
        background: #f5f7fa;
        border-radius: 8px;
        font-size: 12px;
        color: #666;
        line-height: 1.6;
      }
      .meme-inject-preview code {
        background: #e8edf2;
        padding: 1px 5px;
        border-radius: 3px;
        font-family: 'SFMono-Regular', Consolas, monospace;
        font-size: 11px;
      }
      /* 自定义 API 列表项 */
      .meme-api-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px;
        border-radius: 10px;
        border: 1px solid #eee;
        margin-bottom: 10px;
        background: #fafbfc;
        transition: all 0.15s;
      }
      .meme-api-item:hover {
        border-color: #4a90d9;
        box-shadow: 0 2px 8px rgba(74,144,217,0.1);
      }
      .meme-api-item.disabled {
        opacity: 0.5;
        background: #f5f5f5;
      }
      .meme-api-item-icon {
        font-size: 22px;
        flex-shrink: 0;
      }
      .meme-api-item-info {
        flex: 1;
        min-width: 0;
      }
      .meme-api-item-name {
        font-size: 14px;
        font-weight: 500;
        color: #1a1a1a;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .meme-api-item-url {
        font-size: 11px;
        color: #999;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        margin-top: 2px;
      }
      .meme-api-item-actions {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
      }
      .meme-api-toggle {
        width: 36px;
        height: 20px;
        border-radius: 10px;
        background: #ddd;
        border: none;
        cursor: pointer;
        position: relative;
        transition: background 0.2s;
        padding: 0;
      }
      .meme-api-toggle.on {
        background: #4a90d9;
      }
      .meme-api-toggle::after {
        content: '';
        position: absolute;
        top: 2px;
        left: 2px;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #fff;
        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        transition: left 0.2s;
      }
      .meme-api-toggle.on::after {
        left: 18px;
      }
      .meme-api-edit, .meme-api-delete {
        width: 26px;
        height: 26px;
        border-radius: 6px;
        border: none;
        background: transparent;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        color: #999;
        transition: all 0.15s;
      }
      .meme-api-edit:hover { background: #f0f7ff; color: #4a90d9; }
      .meme-api-delete:hover { background: #fee; color: #e44; }
      /* 添加 API 按钮 */
      .meme-api-add-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        width: 100%;
        padding: 10px;
        border-radius: 10px;
        border: 2px dashed #ddd;
        background: transparent;
        cursor: pointer;
        font-size: 13px;
        color: #999;
        transition: all 0.15s;
      }
      .meme-api-add-btn:hover {
        border-color: #4a90d9;
        color: #4a90d9;
        background: #f0f7ff;
      }
      /* API 编辑表单 */
      .meme-api-form {
        padding: 16px;
        border-radius: 10px;
        border: 1px solid #e0e0e0;
        background: #fff;
        margin-top: 12px;
      }
      .meme-api-form-title {
        font-size: 14px;
        font-weight: 600;
        color: #1a1a1a;
        margin-bottom: 12px;
      }
      .meme-form-group {
        margin-bottom: 10px;
      }
      .meme-form-label {
        display: block;
        font-size: 12px;
        font-weight: 500;
        color: #666;
        margin-bottom: 4px;
      }
      .meme-form-label .meme-form-hint {
        color: #aaa;
        font-weight: 400;
      }
      .meme-form-input {
        width: 100%;
        padding: 8px 10px;
        border-radius: 8px;
        border: 1px solid #ddd;
        font-size: 13px;
        color: #1a1a1a;
        background: #fafbfc;
        outline: none;
        transition: border-color 0.2s;
        box-sizing: border-box;
      }
      .meme-form-input:focus {
        border-color: #4a90d9;
        background: #fff;
      }
      .meme-form-input::placeholder {
        color: #bbb;
      }
      .meme-form-row {
        display: flex;
        gap: 10px;
      }
      .meme-form-row .meme-form-group {
        flex: 1;
      }
      .meme-form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 14px;
      }
      .meme-form-btn {
        padding: 6px 16px;
        border-radius: 8px;
        border: none;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s;
      }
      .meme-form-btn-cancel {
        background: #f5f5f5;
        color: #666;
      }
      .meme-form-btn-cancel:hover { background: #eee; }
      .meme-form-btn-save {
        background: #4a90d9;
        color: #fff;
      }
      .meme-form-btn-save:hover { background: #3a7bc8; }
      .meme-form-btn-test {
        background: #f0f7ff;
        color: #4a90d9;
        border: 1px solid #4a90d9;
      }
      .meme-form-btn-test:hover { background: #e0efff; }
      .meme-form-error {
        color: #e44;
        font-size: 12px;
        margin-top: 4px;
        display: none;
      }
      .meme-form-error.show {
        display: block;
      }
      .meme-api-empty {
        text-align: center;
        padding: 20px;
        color: #bbb;
        font-size: 13px;
      }
      .meme-api-section-title {
        font-size: 13px;
        font-weight: 600;
        color: #666;
        margin-bottom: 10px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      /* 动画 */
      @keyframes meme-fade-in {
        from { opacity: 0; } to { opacity: 1; }
      }
      @keyframes meme-slide-up {
        from { opacity: 0; transform: translate(-50%, -46%); }
        to { opacity: 1; transform: translate(-50%, -50%); }
      }
      @keyframes meme-spin {
        to { transform: rotate(360deg); }
      }

      /* ============ 悬浮窗按钮 ============ */
      .meme-float-btn {
        position: fixed;
        right: 16px;
        top: 50%;
        transform: translateY(-50%);
        width: 44px;
        height: 44px;
        border-radius: 50%;
        border: none;
        background: linear-gradient(135deg, #4a90d9, #357abd);
        color: #fff;
        font-size: 22px;
        cursor: pointer;
        z-index: 99990;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 16px rgba(74,144,217,0.4), 0 0 0 2px rgba(74,144,217,0.1);
        transition: box-shadow 0.2s, transform 0.15s;
        user-select: none;
        touch-action: none;
      }
      .meme-float-btn:hover {
        box-shadow: 0 6px 24px rgba(74,144,217,0.5), 0 0 0 3px rgba(74,144,217,0.15);
        transform: translateY(-50%) scale(1.08);
      }
      .meme-float-btn:active {
        transform: translateY(-50%) scale(0.95);
      }
      .meme-float-btn.dragging {
        cursor: grabbing;
        transform: none;
        box-shadow: 0 8px 30px rgba(74,144,217,0.6);
        transition: box-shadow 0.15s;
      }
      .meme-float-btn .meme-float-btn-tooltip {
        position: absolute;
        right: 54px;
        top: 50%;
        transform: translateY(-50%);
        background: #333;
        color: #fff;
        padding: 5px 10px;
        border-radius: 6px;
        font-size: 12px;
        white-space: nowrap;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.15s;
      }
      .meme-float-btn:hover .meme-float-btn-tooltip {
        opacity: 1;
      }

      /* ============ 元素选择器模式 ============ */
      .meme-element-picker-highlight {
        outline: 2px dashed #4a90d9 !important;
        outline-offset: 2px !important;
        background-color: rgba(74, 144, 217, 0.08) !important;
        cursor: crosshair !important;
        transition: outline-color 0.15s, background-color 0.15s !important;
      }
      .meme-element-picker-selected {
        outline: 3px solid #4caf50 !important;
        outline-offset: 2px !important;
        background-color: rgba(76, 175, 80, 0.1) !important;
      }
      .meme-element-picker-overlay {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        z-index: 99997;
        cursor: crosshair;
      }
      .meme-element-picker-hint {
        position: fixed;
        top: 16px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0,0,0,0.85);
        color: #fff;
        padding: 10px 20px;
        border-radius: 10px;
        font-size: 13px;
        z-index: 99998;
        display: flex;
        align-items: center;
        gap: 10px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        white-space: nowrap;
      }
      .meme-element-picker-hint .meme-picker-cancel-btn {
        padding: 4px 12px;
        border-radius: 6px;
        border: 1px solid rgba(255,255,255,0.3);
        background: transparent;
        color: #fff;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.15s;
      }
      .meme-element-picker-hint .meme-picker-cancel-btn:hover {
        background: rgba(255,255,255,0.15);
        border-color: rgba(255,255,255,0.5);
      }
      /* 选择元素按钮（注入规则中的） */
      .meme-inject-rule-pick {
        width: 28px;
        height: 28px;
        border: 1px solid #ddd;
        border-radius: 6px;
        background: #fafbfc;
        cursor: pointer;
        font-size: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: all 0.15s;
        padding: 0;
      }
      .meme-inject-rule-pick:hover {
        border-color: #4a90d9;
        background: #f0f7ff;
      }
      .meme-inject-rule-pick.picking {
        background: #4a90d9;
        border-color: #4a90d9;
        color: #fff;
      }
      /* 悬浮窗按钮开关（注入设置面板中） */
      .meme-float-toggle-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 0;
      }
      .meme-float-toggle-label {
        font-size: 13px;
        color: #333;
      }
      .meme-float-toggle-label .meme-float-toggle-desc {
        display: block;
        font-size: 11px;
        color: #999;
        margin-top: 2px;
      }
    `;
    document.head.appendChild(style);
  }

  // ============ 滚动穿透修复 ============
  function lockBodyScroll() {
    bodyOverflowBackup = document.body.style.overflow;
    document.body.classList.add('meme-no-scroll');
  }

  function unlockBodyScroll() {
    document.body.classList.remove('meme-no-scroll');
  }

  function preventScrollThrough(e) {
    const resultsEl = document.getElementById('meme-results');
    if (!resultsEl) return;

    if (resultsEl.contains(e.target)) {
      const { scrollTop, scrollHeight, clientHeight } = resultsEl;
      const delta = e.deltaY;
      if ((delta < 0 && scrollTop <= 0) || (delta > 0 && scrollTop + clientHeight >= scrollHeight)) {
        e.preventDefault();
      }
      return;
    }

    if (popupEl && popupEl.contains(e.target)) {
      return;
    }

    if (overlayEl && overlayEl.contains(e.target)) {
      e.preventDefault();
      return;
    }

    if (popupEl && popupEl.style.display !== 'none') {
      e.preventDefault();
    }
  }

  function preventTouchThrough(e) {
    const resultsEl = document.getElementById('meme-results');
    if (!resultsEl) return;
    if (resultsEl.contains(e.target)) return;
    if (popupEl && popupEl.contains(e.target)) return;
    if (popupEl && popupEl.style.display !== 'none') {
      e.preventDefault();
    }
  }

  // ============ 在输入框旁添加按钮 ============

  // 用 XPath 查找匹配的元素列表
  function queryXPathAll(xpath) {
    try {
      const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
      const nodes = [];
      for (let i = 0; i < result.snapshotLength; i++) {
        nodes.push(result.snapshotItem(i));
      }
      return nodes;
    } catch (e) {
      return [];
    }
  }

  // 判断元素是否匹配注入规则（XPath）
  function matchesXPath(el, xpath) {
    const nodes = queryXPathAll(xpath);
    return nodes.includes(el);
  }

  // 判断元素是否匹配注入规则
  function shouldInjectButton(el) {
    if (injectConfig.mode === 'off') return false;
    if (injectConfig.mode === 'all') return true;
    // custom 模式：检查元素是否匹配任一规则的 XPath
    if (injectConfig.mode === 'custom' && Array.isArray(injectConfig.rules)) {
      return injectConfig.rules.some(rule => {
        if (!rule.selector) return false;
        return matchesXPath(el, rule.selector);
      });
    }
    return true;
  }

  // 获取元素对应的注入位置
  function getInjectPosition(el) {
    if (injectConfig.mode === 'custom' && Array.isArray(injectConfig.rules)) {
      for (const rule of injectConfig.rules) {
        if (!rule.selector) continue;
        if (matchesXPath(el, rule.selector)) {
          return rule.position || 'after-outside';
        }
      }
    }
    return 'after-outside'; // 默认：元素外部后面
  }

  // 根据位置信息插入按钮到 DOM
  function insertButtonByPosition(btn, el, position) {
    switch (position) {
      case 'before-outside':
        // 元素外部前面
        el.parentNode.insertBefore(btn, el);
        break;
      case 'before-inside':
        // 元素内部前面
        el.insertBefore(btn, el.firstChild);
        break;
      case 'after-inside':
        // 元素内部末尾
        el.appendChild(btn);
        break;
      case 'after-outside':
      default:
        // 元素外部后面
        if (el.nextSibling) {
          el.parentNode.insertBefore(btn, el.nextSibling);
        } else {
          el.parentNode.appendChild(btn);
        }
        break;
    }
  }

  function addTriggerButtons() {
    // mode=off 时不注入任何按钮
    if (injectConfig.mode === 'off') return;

    if (injectConfig.mode === 'custom') {
      if (!Array.isArray(injectConfig.rules) || injectConfig.rules.length === 0) return;
      // custom 模式：用 XPath 规则直接查找目标元素
      injectConfig.rules.forEach(rule => {
        if (!rule.selector) return;
        const elements = queryXPathAll(rule.selector);
        elements.forEach(el => {
          if (el.dataset.memeButtonAdded) return;
          if (el.offsetParent === null) return;
          // 跳过非元素节点
          if (el.nodeType !== Node.ELEMENT_NODE) return;

          el.dataset.memeButtonAdded = 'true';
          const position = rule.position || 'after-outside';

          const btn = document.createElement('button');
          btn.className = 'meme-trigger-btn';
          btn.innerHTML = '😊';
          btn.title = '搜索表情包';
          btn.type = 'button';
          btn.dataset.injectPosition = position;

          if (position === 'after-outside') {
            const rect = el.getBoundingClientRect();
            btn.style.left = (rect.right + 6) + 'px';
            btn.style.top = (rect.top + (rect.height - 28) / 2) + 'px';
            document.body.appendChild(btn);
          } else {
            btn.style.position = 'relative';
            btn.style.verticalAlign = 'middle';
            btn.style.marginLeft = position.includes('after') ? '4px' : '0';
            btn.style.marginRight = position.includes('before') ? '4px' : '0';
            btn.style.flexShrink = '0';
            insertButtonByPosition(btn, el, position);
          }

          btn._inputRef = el;
          btn._injectPosition = position;

          btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            activeInput = el;
            openPopup();
          });
        });
      });
    } else {
      // all 模式：用 CSS 选择器扫描常见输入元素
      const selector = 'input[type="text"], input[type="search"], input:not([type]), textarea, [contenteditable="true"], [role="textbox"]';
      document.querySelectorAll(selector).forEach(el => {
        if (el.dataset.memeButtonAdded) return;
        if (el.offsetParent === null) return;
        if (el.type === 'hidden') return;

        el.dataset.memeButtonAdded = 'true';
        const position = getInjectPosition(el);

        const btn = document.createElement('button');
        btn.className = 'meme-trigger-btn';
        btn.innerHTML = '😊';
        btn.title = '搜索表情包';
        btn.type = 'button';
        btn.dataset.injectPosition = position;

        if (position === 'after-outside') {
          const rect = el.getBoundingClientRect();
          btn.style.left = (rect.right + 6) + 'px';
          btn.style.top = (rect.top + (rect.height - 28) / 2) + 'px';
          document.body.appendChild(btn);
        } else {
          btn.style.position = 'relative';
          btn.style.verticalAlign = 'middle';
          btn.style.marginLeft = position.includes('after') ? '4px' : '0';
          btn.style.marginRight = position.includes('before') ? '4px' : '0';
          btn.style.flexShrink = '0';
          insertButtonByPosition(btn, el, position);
        }

        btn._inputRef = el;
        btn._injectPosition = position;

        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          activeInput = el;
          openPopup();
        });
      });
    }
  }

  function updateButtonPositions() {
    document.querySelectorAll('.meme-trigger-btn').forEach(btn => {
      if (!btn._inputRef || !btn._inputRef.isConnected) {
        btn.remove();
        return;
      }
      // 只有 after-outside（fixed 定位）需要手动更新位置
      if (btn._injectPosition === 'after-outside' || !btn._injectPosition) {
        const rect = btn._inputRef.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) {
          btn.style.display = 'none';
          return;
        }
        btn.style.display = '';
        btn.style.left = (rect.right + 6) + 'px';
        btn.style.top = (rect.top + (rect.height - 28) / 2) + 'px';
      }
    });
  }

  // ============ 弹窗 ============
  function openPopup() {
    if (popupEl) {
      console.log('[表情包搜索] openPopup: 复用已有弹窗，重新显示');
      popupEl.style.display = 'flex';
      overlayEl.style.display = 'block';
      lockBodyScroll();
      // 完整重置搜索状态，确保干净环境
      isLoading = false;
      isLoadingMore = false;
      hasMorePages = false;
      columnHeights = [0, 0, 0];
      const searchInput = popupEl.querySelector('.meme-search-input');
      const resultsEl = document.getElementById('meme-results');
      console.log('[表情包搜索] openPopup: resultsEl=', resultsEl ? '找到' : '未找到', 'currentChannel=', currentChannel, 'CHANNELS.length=', CHANNELS.length);
      const query = searchInput ? searchInput.value.trim() : '';
      if (query) {
        doSearch(query);
      } else {
        loadTrending();
      }
      if (searchInput) searchInput.focus();
      return;
    }
    console.log('[表情包搜索] openPopup: 首次创建弹窗');
    createPopup();
  }

  function closePopup() {
    if (popupEl) {
      popupEl.style.display = 'none';
      overlayEl.style.display = 'none';
      unlockBodyScroll();
    }
    // 同时关闭设置面板和右键菜单
    closeSettingsPanel();
    closeCtxMenu();
  }

  function createPopup() {
    lockBodyScroll();

    overlayEl = document.createElement('div');
    overlayEl.className = 'meme-overlay';
    overlayEl.addEventListener('click', closePopup);
    document.body.appendChild(overlayEl);

    popupEl = document.createElement('div');
    popupEl.className = 'meme-popup';

    // 头部
    const header = document.createElement('div');
    header.className = 'meme-popup-header';
    header.innerHTML = `
      <span class="meme-title">🔍 表情包搜索</span>
    `;
    // 设置按钮
    const settingsBtn = document.createElement('button');
    settingsBtn.className = 'meme-popup-settings-btn';
    settingsBtn.innerHTML = '⚙️';
    settingsBtn.title = '管理自定义 API';
    settingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openSettingsPanel();
    });
    header.appendChild(settingsBtn);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'meme-popup-close';
    closeBtn.innerHTML = '✕';
    closeBtn.addEventListener('click', closePopup);
    header.appendChild(closeBtn);
    popupEl.appendChild(header);

    // 搜索框
    const searchBox = document.createElement('div');
    searchBox.className = 'meme-search-box';
    searchBox.innerHTML = `
      <div class="meme-search-input-wrap">
        <span class="meme-search-icon">🔍</span>
        <input class="meme-search-input" type="text" placeholder="搜索表情包… 输入关键词回车搜索" />
        <button class="meme-search-btn">搜索</button>
      </div>
    `;
    popupEl.appendChild(searchBox);

    const searchInput = searchBox.querySelector('.meme-search-input');
    const searchBtn = searchBox.querySelector('.meme-search-btn');

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        doSearch(searchInput.value.trim());
      }
      e.stopPropagation();
    });
    searchInput.addEventListener('input', (e) => e.stopPropagation());

    searchBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      doSearch(searchInput.value.trim());
    });

    // 渠道标签（动态渲染）
    const channelsBar = document.createElement('div');
    channelsBar.className = 'meme-channels';
    channelsBar.id = 'meme-channels';
    renderChannelTabs(channelsBar, searchInput);
    popupEl.appendChild(channelsBar);

    // 结果区域
    const resultsEl = document.createElement('div');
    resultsEl.className = 'meme-results';
    resultsEl.id = 'meme-results';

    resultsEl.addEventListener('scroll', () => {
      const { scrollTop, scrollHeight, clientHeight } = resultsEl;
      if (scrollHeight - scrollTop - clientHeight < 200) {
        loadMore();
      }
    });

    popupEl.appendChild(resultsEl);

    popupEl.addEventListener('click', (e) => e.stopPropagation());

    document.body.appendChild(popupEl);

    loadTrending();
    searchInput.focus();
  }

  // 渲染渠道标签栏（动态）
  function renderChannelTabs(channelsBar, searchInput) {
    if (!channelsBar) channelsBar = document.getElementById('meme-channels');
    if (!channelsBar) return;
    if (!searchInput) {
      const popup = document.querySelector('.meme-popup');
      if (popup) searchInput = popup.querySelector('.meme-search-input');
    }

    channelsBar.innerHTML = '';
    CHANNELS.forEach((ch, i) => {
      const tab = document.createElement('div');
      tab.className = 'meme-channel-tab' + (i === currentChannel ? ' active' : '');
      let tabHTML = `${ch.icon} ${ch.name}`;
      if (!ch.builtin) {
        tabHTML += '<span class="meme-custom-badge">自</span>';
      }
      tab.innerHTML = tabHTML;
      tab.addEventListener('click', (e) => {
        e.stopPropagation();
        currentChannel = i;
        channelsBar.querySelectorAll('.meme-channel-tab').forEach((t, j) => {
          t.classList.toggle('active', j === i);
        });
        const query = searchInput ? searchInput.value.trim() : '';
        if (query) {
          doSearch(query);
        } else {
          loadTrending();
        }
      });
      channelsBar.appendChild(tab);
    });

    // 收藏渠道 Tab（始终在最后）
    const favTabIndex = CHANNELS.length; // 收藏渠道的索引 = CHANNELS.length
    const favTab = document.createElement('div');
    favTab.className = 'meme-channel-tab' + (currentChannel === favTabIndex ? ' active' : '');
    favTab.id = 'meme-fav-tab';
    const favCount = favorites.length;
    favTab.innerHTML = `⭐ 收藏${favCount > 0 ? '<span class="meme-custom-badge" style="background:#ff9800;margin-left:2px;">' + favCount + '</span>' : ''}`;
    favTab.addEventListener('click', (e) => {
      e.stopPropagation();
      currentChannel = favTabIndex;
      channelsBar.querySelectorAll('.meme-channel-tab').forEach((t, j) => {
        t.classList.toggle('active', j === favTabIndex);
      });
      showFavorites();
    });
    channelsBar.appendChild(favTab);
  }

  // 刷新收藏 Tab 上的计数
  function refreshFavoriteCount() {
    const favTab = document.getElementById('meme-fav-tab');
    if (favTab) {
      const favCount = favorites.length;
      favTab.innerHTML = `⭐ 收藏${favCount > 0 ? '<span class="meme-custom-badge" style="background:#ff9800;margin-left:2px;">' + favCount + '</span>' : ''}`;
    }
  }

  // 展示收藏列表
  function showFavorites() {
    const resultsEl = document.getElementById('meme-results');
    if (!resultsEl) return;

    columnHeights = [0, 0, 0];
    hasMorePages = false;
    currentQuery = '';

    if (favorites.length === 0) {
      resultsEl.className = 'meme-results results-centered';
      resultsEl.innerHTML = '';
      resultsEl.innerHTML = '<div class="meme-fav-empty"><div class="emoji">⭐</div><div>还没有收藏的表情包</div><div style="font-size:12px;color:#bbb;margin-top:4px;">搜索表情包时点击 ☆ 即可收藏</div></div>';
      return;
    }

    // 收藏列表按时间倒序
    const sortedFavs = [...favorites].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    // 统一类型：emoji 类型用 'emoji'，其他用 'image'
    const items = sortedFavs.map(f => ({
      id: f.id,
      url: f.url || '',
      preview: f.preview || f.url || '',
      type: f.type || 'image',
      emoji: f.emoji,
      name: f.name,
    }));

    renderFavResults(resultsEl, items);
  }

  // 收藏列表渲染（类似 renderResults 但标记 isFavView=true）
  function renderFavResults(container, items) {
    container.className = 'meme-results results-waterfall';
    container.innerHTML = '';
    columnHeights = [0, 0, 0];
    const col1 = document.createElement('div');
    col1.className = 'meme-waterfall-column';
    col1.dataset.colIndex = '0';
    const col2 = document.createElement('div');
    col2.className = 'meme-waterfall-column';
    col2.dataset.colIndex = '1';
    const col3 = document.createElement('div');
    col3.className = 'meme-waterfall-column';
    col3.dataset.colIndex = '2';
    container.appendChild(col1);
    container.appendChild(col2);
    container.appendChild(col3);

    items.forEach(item => {
      const card = createCard(item, item.type, true); // isFavView=true
      const columns = container.querySelectorAll('.meme-waterfall-column');
      const shortest = getShortestColumn(columns);
      const colIndex = parseInt(shortest.dataset.colIndex) || 0;
      const estimated = estimateCardHeight(item, item.type);
      columnHeights[colIndex] += estimated;
      if (item.type !== 'emoji') {
        const img = card.querySelector('img');
        if (img) {
          trackImageLoad(img, colIndex, estimated);
        }
      }
      shortest.appendChild(card);
    });
  }

  // 收藏渠道内搜索（本地过滤）
  function searchFavorites(query) {
    const resultsEl = document.getElementById('meme-results');
    if (!resultsEl) return;

    if (!query) {
      showFavorites();
      return;
    }

    const q = query.toLowerCase();
    const filtered = favorites.filter(f => {
      // 搜索 name / emoji 文本 / id 关键词
      const nameMatch = f.name && f.name.toLowerCase().includes(q);
      const emojiMatch = f.emoji && f.emoji.includes(q);
      const idMatch = f.id && f.id.toLowerCase().includes(q);
      return nameMatch || emojiMatch || idMatch;
    });

    if (filtered.length === 0) {
      resultsEl.className = 'meme-results results-centered';
      resultsEl.innerHTML = '<div class="meme-empty"><div class="emoji">😕</div><div>收藏中没有找到匹配的表情包</div></div>';
      return;
    }

    const sortedFavs = [...filtered].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    const items = sortedFavs.map(f => ({
      id: f.id,
      url: f.url || '',
      preview: f.preview || f.url || '',
      type: f.type || 'image',
      emoji: f.emoji,
      name: f.name,
    }));
    renderFavResults(resultsEl, items);
  }

  // ============ 自定义 API 管理面板 ============
  function openSettingsPanel() {
    if (settingsPanelOpen) return;
    settingsPanelOpen = true;

    const overlay = document.createElement('div');
    overlay.className = 'meme-settings-overlay';
    overlay.id = 'meme-settings-overlay';
    overlay.addEventListener('click', closeSettingsPanel);
    document.body.appendChild(overlay);

    const panel = document.createElement('div');
    panel.className = 'meme-settings-panel';
    panel.id = 'meme-settings-panel';
    panel.addEventListener('click', (e) => e.stopPropagation());

    // 头部
    const header = document.createElement('div');
    header.className = 'meme-settings-header';
    header.innerHTML = '<span class="meme-settings-title">⚙️ 设置</span>';
    const closeSettingsBtn = document.createElement('button');
    closeSettingsBtn.className = 'meme-popup-close';
    closeSettingsBtn.innerHTML = '✕';
    closeSettingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeSettingsPanel();
    });
    header.appendChild(closeSettingsBtn);
    panel.appendChild(header);

    // Tab 栏
    const tabBar = document.createElement('div');
    tabBar.className = 'meme-settings-tabs';
    const tabApi = document.createElement('div');
    tabApi.className = 'meme-settings-tab active';
    tabApi.textContent = '🔌 自定义 API';
    const tabInject = document.createElement('div');
    tabInject.className = 'meme-settings-tab';
    tabInject.textContent = '📌 按钮注入';
    tabBar.appendChild(tabApi);
    tabBar.appendChild(tabInject);
    panel.appendChild(tabBar);

    // 内容区
    const body = document.createElement('div');
    body.className = 'meme-settings-body';
    body.id = 'meme-settings-body';

    panel.appendChild(body);

    // Tab 切换逻辑
    tabApi.addEventListener('click', () => {
      tabApi.classList.add('active');
      tabInject.classList.remove('active');
      renderApiList(body);
    });
    tabInject.addEventListener('click', () => {
      tabInject.classList.add('active');
      tabApi.classList.remove('active');
      renderInjectSettings(body);
    });

    // 默认显示 API 列表
    renderApiList(body);

    document.body.appendChild(panel);
  }

  function closeSettingsPanel() {
    settingsPanelOpen = false;
    const overlay = document.getElementById('meme-settings-overlay');
    const panel = document.getElementById('meme-settings-panel');
    if (overlay) overlay.remove();
    if (panel) panel.remove();
  }

  // ============ 按钮注入设置面板 ============
  function renderInjectSettings(container) {
    if (!container) container = document.getElementById('meme-settings-body');
    if (!container) return;

    container.innerHTML = '';

    // ---- 注入模式 ----
    const modeSection = document.createElement('div');
    modeSection.className = 'meme-inject-section';

    const modeTitle = document.createElement('div');
    modeTitle.className = 'meme-inject-section-title';
    modeTitle.textContent = '按钮注入模式';
    modeSection.appendChild(modeTitle);

    const modeGroup = document.createElement('div');
    modeGroup.className = 'meme-inject-mode-group';

    const modes = [
      { value: 'all', label: '全局注入', desc: '自动在所有文本输入框旁添加表情包按钮' },
      { value: 'custom', label: '仅指定元素', desc: '只在匹配 XPath 的元素旁添加按钮' },
      { value: 'off', label: '关闭注入', desc: '不自动添加按钮，通过悬浮窗按钮使用' },
    ];

    modes.forEach(m => {
      const btn = document.createElement('button');
      btn.className = 'meme-inject-mode-btn' + (injectConfig.mode === m.value ? ' active' : '');
      btn.textContent = m.label;
      btn.addEventListener('click', () => {
        injectConfig.mode = m.value;
        saveInjectConfig();
        refreshButtons();
        renderInjectSettings(container);
      });
      modeGroup.appendChild(btn);
    });
    modeSection.appendChild(modeGroup);

    const currentMode = modes.find(m => m.value === injectConfig.mode);
    const modeDesc = document.createElement('div');
    modeDesc.className = 'meme-inject-mode-desc';
    modeDesc.textContent = currentMode ? currentMode.desc : '';
    modeSection.appendChild(modeDesc);

    container.appendChild(modeSection);

    // ---- 悬浮窗按钮开关 ----
    const floatSection = document.createElement('div');
    floatSection.className = 'meme-inject-section';

    const floatRow = document.createElement('div');
    floatRow.className = 'meme-float-toggle-row';

    const floatLabel = document.createElement('div');
    floatLabel.className = 'meme-float-toggle-label';
    floatLabel.innerHTML = '🔴 侧边悬浮窗按钮<span class="meme-float-toggle-desc">页面右侧可拖动的表情包入口按钮</span>';

    const floatToggle = document.createElement('button');
    floatToggle.className = 'meme-api-toggle' + (injectConfig.showFloatBtn !== false ? ' on' : '');
    floatToggle.title = injectConfig.showFloatBtn !== false ? '已开启' : '已关闭';
    floatToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      injectConfig.showFloatBtn = injectConfig.showFloatBtn === false ? true : false;
      saveInjectConfig();
      updateFloatBtn();
      renderInjectSettings(container);
    });
    floatRow.appendChild(floatLabel);
    floatRow.appendChild(floatToggle);
    floatSection.appendChild(floatRow);

    // off 模式下提示
    if (injectConfig.mode === 'off') {
      const offHint = document.createElement('div');
      offHint.className = 'meme-inject-mode-desc';
      offHint.style.color = '#4a90d9';
      offHint.textContent = '💡 关闭注入模式下，悬浮窗按钮是唯一的表情包入口，建议保持开启';
      floatSection.appendChild(offHint);
    }

    container.appendChild(floatSection);

    // ---- 自定义规则（仅 custom 模式显示）----
    if (injectConfig.mode === 'custom') {
      const rulesSection = document.createElement('div');
      rulesSection.className = 'meme-inject-section';

      const rulesTitle = document.createElement('div');
      rulesTitle.className = 'meme-inject-section-title';
      rulesTitle.textContent = '注入规则';
      rulesSection.appendChild(rulesTitle);

      const positionOptions = [
        { value: 'after-outside', label: '外部后面 →' },
        { value: 'after-inside', label: '内部末尾 ↗' },
        { value: 'before-outside', label: '← 外部前面' },
        { value: 'before-inside', label: '↙ 内部前面' },
      ];

      if (injectConfig.rules && injectConfig.rules.length > 0) {
        injectConfig.rules.forEach((rule, index) => {
          const ruleItem = document.createElement('div');
          ruleItem.className = 'meme-inject-rule-item';

          // 选择元素按钮（🎯）
          const pickBtn = document.createElement('button');
          pickBtn.className = 'meme-inject-rule-pick';
          pickBtn.innerHTML = '🎯';
          pickBtn.title = '鼠标选择页面元素';
          pickBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // 先关闭弹窗和设置面板，让用户可以选元素
            closePopup();
            pickBtn.classList.add('picking');
            startElementPicker((selector) => {
              // 选择完成后更新规则
              injectConfig.rules[index].selector = selector;
              saveInjectConfig();
              refreshButtons();
              // 重新打开设置面板并刷新
              setTimeout(() => {
                openSettingsPanel();
                // 等面板渲染后切换到按钮注入 Tab
                setTimeout(() => {
                  const tabInject = document.querySelector('.meme-settings-tab:nth-child(2)');
                  if (tabInject) tabInject.click();
                }, 100);
              }, 200);
            });
          });
          ruleItem.appendChild(pickBtn);

          // 选择器输入
          const selectorInput = document.createElement('input');
          selectorInput.className = 'meme-inject-rule-selector';
          selectorInput.type = 'text';
          selectorInput.value = rule.selector || '';
          selectorInput.placeholder = 'XPath 表达式，如 //textarea 或 //div[@class="chat-input"]';
          selectorInput.addEventListener('change', () => {
            injectConfig.rules[index].selector = selectorInput.value.trim();
            saveInjectConfig();
            refreshButtons();
          });
          ruleItem.appendChild(selectorInput);

          // 位置选择
          const posSelect = document.createElement('select');
          posSelect.className = 'meme-inject-rule-position';
          positionOptions.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label;
            if (rule.position === opt.value) option.selected = true;
            posSelect.appendChild(option);
          });
          posSelect.addEventListener('change', () => {
            injectConfig.rules[index].position = posSelect.value;
            saveInjectConfig();
            refreshButtons();
          });
          ruleItem.appendChild(posSelect);

          // 删除按钮
          const deleteBtn = document.createElement('button');
          deleteBtn.className = 'meme-inject-rule-delete';
          deleteBtn.innerHTML = '✕';
          deleteBtn.title = '删除规则';
          deleteBtn.addEventListener('click', () => {
            injectConfig.rules.splice(index, 1);
            saveInjectConfig();
            refreshButtons();
            renderInjectSettings(container);
          });
          ruleItem.appendChild(deleteBtn);

          rulesSection.appendChild(ruleItem);
        });
      }

      // 添加规则按钮
      const addRuleBtn = document.createElement('button');
      addRuleBtn.className = 'meme-inject-add-rule';
      addRuleBtn.innerHTML = '➕ 添加规则';
      addRuleBtn.addEventListener('click', () => {
        if (!injectConfig.rules) injectConfig.rules = [];
        injectConfig.rules.push({ selector: '', position: 'after-outside' });
        saveInjectConfig();
        renderInjectSettings(container);
        // 聚焦到新添加的输入框
        const inputs = container.querySelectorAll('.meme-inject-rule-selector');
        if (inputs.length > 0) inputs[inputs.length - 1].focus();
      });
      rulesSection.appendChild(addRuleBtn);

      // 选择元素按钮（快捷方式）
      const pickElementBtn = document.createElement('button');
      pickElementBtn.className = 'meme-inject-add-rule';
      pickElementBtn.innerHTML = '🎯 选择页面元素添加规则';
      pickElementBtn.style.marginTop = '8px';
      pickElementBtn.style.borderColor = '#4a90d9';
      pickElementBtn.style.color = '#4a90d9';
      pickElementBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        // 先添加空规则
        if (!injectConfig.rules) injectConfig.rules = [];
        const newIndex = injectConfig.rules.length;
        injectConfig.rules.push({ selector: '', position: 'after-outside' });
        saveInjectConfig();

        // 关闭弹窗和设置面板，进入选择模式
        closePopup();
        startElementPicker((selector) => {
          // 更新刚才添加的规则
          injectConfig.rules[newIndex].selector = selector;
          saveInjectConfig();
          refreshButtons();
          // 重新打开设置面板
          setTimeout(() => {
            openSettingsPanel();
            setTimeout(() => {
              const tabInject = document.querySelector('.meme-settings-tab:nth-child(2)');
              if (tabInject) tabInject.click();
            }, 100);
          }, 200);
        });
      });
      rulesSection.appendChild(pickElementBtn);

      // 常用选择器提示
      const preview = document.createElement('div');
      preview.className = 'meme-inject-preview';
      preview.innerHTML = '<b>💡 常用 XPath 示例：</b><br>'
        + '<code>//textarea</code> — 所有文本域<br>'
        + '<code>//div[@class="chat-input"]</code> — class 为 chat-input 的 div<br>'
        + '<code>//*[@id="msg-input"]</code> — id 为 msg-input 的元素<br>'
        + '<code>//*[@contenteditable="true"]</code> — 可编辑区域<br>'
        + '<code>//form//textarea</code> — 表单内的文本域<br>'
        + '<br><b>💡 也可以点击 🎯 按钮直接在页面上选择元素</b><br>'
        + '<br><b>位置说明：</b><br>'
        + '<code>外部后面 →</code> 按钮在元素右外侧（默认）<br>'
        + '<code>内部末尾 ↗</code> 按钮在元素内部最后面<br>'
        + '<code>← 外部前面</code> 按钮在元素左外侧<br>'
        + '<code>↙ 内部前面</code> 按钮在元素内部最前面';
      rulesSection.appendChild(preview);

      container.appendChild(rulesSection);
    }
  }

  // 刷新所有按钮（配置变更后调用）
  function refreshButtons() {
    // 移除所有现有按钮，并清除对应元素的标记
    document.querySelectorAll('.meme-trigger-btn').forEach(btn => {
      if (btn._inputRef && btn._inputRef.isConnected) {
        delete btn._inputRef.dataset.memeButtonAdded;
      }
      btn.remove();
    });
    // 兜底清除残留的 dataset 标记
    document.querySelectorAll('[data-meme-button-added]').forEach(el => {
      delete el.dataset.memeButtonAdded;
    });
    // 重新注入
    setTimeout(() => addTriggerButtons(), 100);
    // 同步更新悬浮窗按钮
    updateFloatBtn();
  }

  // ============ 悬浮窗按钮 ============
  let floatBtnEl = null;
  let floatBtnDragState = null; // 拖拽状态

  function createFloatBtn() {
    if (floatBtnEl && floatBtnEl.isConnected) return floatBtnEl;

    const btn = document.createElement('button');
    btn.className = 'meme-float-btn';
    btn.innerHTML = '😊<span class="meme-float-btn-tooltip">搜索表情包</span>';
    btn.title = '搜索表情包（拖拽可移动）';

    // 从 storage 恢复位置
    const savedPos = injectConfig._floatBtnPos;
    if (savedPos) {
      btn.style.right = savedPos.right + 'px';
      btn.style.top = savedPos.top + 'px';
      btn.style.transform = 'none';
    }

    // 点击打开弹窗
    btn.addEventListener('click', (e) => {
      if (floatBtnDragState && floatBtnDragState.moved) return; // 拖拽结束不触发点击
      e.preventDefault();
      e.stopPropagation();
      openPopup();
    });

    // 拖拽逻辑
    btn.addEventListener('mousedown', onFloatBtnDragStart);
    btn.addEventListener('touchstart', onFloatBtnDragStart, { passive: false });

    document.body.appendChild(btn);
    floatBtnEl = btn;
    return btn;
  }

  function removeFloatBtn() {
    if (floatBtnEl) {
      floatBtnEl.remove();
      floatBtnEl = null;
    }
  }

  function updateFloatBtn() {
    // off 模式强制显示，其他模式根据 showFloatBtn 配置
    const shouldShow = injectConfig.mode === 'off' || injectConfig.showFloatBtn !== false;
    if (shouldShow) {
      createFloatBtn();
    } else {
      removeFloatBtn();
    }
  }

  function onFloatBtnDragStart(e) {
    // 只响应主按键
    if (e.type === 'mousedown' && e.button !== 0) return;
    e.preventDefault();

    const btn = floatBtnEl;
    if (!btn) return;

    const rect = btn.getBoundingClientRect();
    const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
    const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;

    floatBtnDragState = {
      startX: clientX,
      startY: clientY,
      offsetX: clientX - rect.left,
      offsetY: clientY - rect.top,
      moved: false,
      origRight: parseInt(btn.style.right) || 16,
      origTop: parseInt(btn.style.top) || (window.innerHeight / 2 - 22),
    };

    btn.classList.add('dragging');
    btn.style.transform = 'none';

    document.addEventListener('mousemove', onFloatBtnDragMove);
    document.addEventListener('mouseup', onFloatBtnDragEnd);
    document.addEventListener('touchmove', onFloatBtnDragMove, { passive: false });
    document.addEventListener('touchend', onFloatBtnDragEnd);
  }

  function onFloatBtnDragMove(e) {
    if (!floatBtnDragState) return;
    e.preventDefault();

    const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
    const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;

    const dx = clientX - floatBtnDragState.startX;
    const dy = clientY - floatBtnDragState.startY;

    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      floatBtnDragState.moved = true;
    }

    const btn = floatBtnEl;
    if (!btn) return;

    const newLeft = clientX - floatBtnDragState.offsetX;
    const newTop = clientY - floatBtnDragState.offsetY;

    // 限制在视口内
    const maxLeft = window.innerWidth - 44;
    const maxTop = window.innerHeight - 44;
    const clampedLeft = Math.max(0, Math.min(newLeft, maxLeft));
    const clampedTop = Math.max(0, Math.min(newTop, maxTop));

    // 转换为 right/top
    const right = window.innerWidth - clampedLeft - 44;
    btn.style.left = 'auto';
    btn.style.right = right + 'px';
    btn.style.top = clampedTop + 'px';
    btn.style.transform = 'none';
  }

  function onFloatBtnDragEnd(e) {
    if (!floatBtnDragState) return;

    const btn = floatBtnEl;
    if (btn) {
      btn.classList.remove('dragging');

      // 保存位置到配置
      if (floatBtnDragState.moved && btn) {
        injectConfig._floatBtnPos = {
          right: parseInt(btn.style.right) || 16,
          top: parseInt(btn.style.top) || Math.round(window.innerHeight / 2 - 22),
        };
        saveInjectConfig();
      }
    }

    // 延迟清除 moved 标记，避免 click 误触
    const wasMoved = floatBtnDragState.moved;
    setTimeout(() => {
      if (floatBtnDragState) {
        floatBtnDragState.moved = false;
      }
    }, 50);

    document.removeEventListener('mousemove', onFloatBtnDragMove);
    document.removeEventListener('mouseup', onFloatBtnDragEnd);
    document.removeEventListener('touchmove', onFloatBtnDragMove);
    document.removeEventListener('touchend', onFloatBtnDragEnd);

    // 如果有拖拽，标记一下防止 click
    if (wasMoved && floatBtnDragState) {
      floatBtnDragState.moved = true;
      setTimeout(() => {
        floatBtnDragState = null;
      }, 100);
    } else {
      floatBtnDragState = null;
    }
  }

  // ============ 元素选择器模式 ============
  let elementPickerState = null; // { onPick: (xpath) => void }

  function startElementPicker(onPick) {
    if (elementPickerState) {
      cancelElementPicker();
    }

    elementPickerState = { onPick };

    // 创建顶部提示栏
    const hint = document.createElement('div');
    hint.className = 'meme-element-picker-hint';
    hint.innerHTML = '🎯 鼠标移到页面元素上高亮，<b>点击选择</b>，按 <b>Esc</b> 取消';
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'meme-picker-cancel-btn';
    cancelBtn.textContent = '取消';
    cancelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      cancelElementPicker();
    });
    hint.appendChild(cancelBtn);
    document.body.appendChild(hint);

    // 创建透明覆盖层（不拦截鼠标，仅用于视觉提示）
    // 实际高亮通过 mouseover/mouseout 事件实现

    let lastHoveredEl = null;

    const onMouseOver = (e) => {
      // 排除我们自己的 UI 元素
      if (e.target.closest('.meme-element-picker-hint') ||
          e.target.closest('.meme-popup') ||
          e.target.closest('.meme-overlay') ||
          e.target.closest('.meme-settings-panel') ||
          e.target.closest('.meme-settings-overlay') ||
          e.target.closest('.meme-float-btn')) {
        return;
      }
      // 移除上一个高亮
      if (lastHoveredEl && lastHoveredEl !== e.target) {
        lastHoveredEl.classList.remove('meme-element-picker-highlight');
      }
      e.target.classList.add('meme-element-picker-highlight');
      lastHoveredEl = e.target;
    };

    const onMouseOut = (e) => {
      if (lastHoveredEl) {
        lastHoveredEl.classList.remove('meme-element-picker-highlight');
      }
    };

    const onClick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      // 排除我们自己的 UI
      if (e.target.closest('.meme-element-picker-hint') ||
          e.target.closest('.meme-popup') ||
          e.target.closest('.meme-overlay') ||
          e.target.closest('.meme-settings-panel') ||
          e.target.closest('.meme-settings-overlay') ||
          e.target.closest('.meme-float-btn')) {
        return;
      }

      const el = e.target;
      // 清除高亮
      el.classList.remove('meme-element-picker-highlight');
      // 添加选中标记
      el.classList.add('meme-element-picker-selected');
      setTimeout(() => el.classList.remove('meme-element-picker-selected'), 800);

      // 生成 XPath
      const selector = generateXPath(el);

      // 清理
      cleanup();

      // 回调
      if (elementPickerState && elementPickerState.onPick) {
        elementPickerState.onPick(selector);
      }
      elementPickerState = null;
    };

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (lastHoveredEl) {
          lastHoveredEl.classList.remove('meme-element-picker-highlight');
        }
        cancelElementPicker();
      }
    };

    const cleanup = () => {
      document.removeEventListener('mouseover', onMouseOver, true);
      document.removeEventListener('mouseout', onMouseOut, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKeyDown, true);
      if (hint && hint.isConnected) hint.remove();
      if (lastHoveredEl) {
        lastHoveredEl.classList.remove('meme-element-picker-highlight');
      }
    };

    // 注册事件（capture 阶段拦截）
    document.addEventListener('mouseover', onMouseOver, true);
    document.addEventListener('mouseout', onMouseOut, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);

    elementPickerState.cleanup = cleanup;
  }

  function cancelElementPicker() {
    if (elementPickerState && elementPickerState.cleanup) {
      elementPickerState.cleanup();
    }
    elementPickerState = null;
  }

  // 为元素生成唯一性好的 XPath
  function generateXPath(el) {
    // 如果元素有 id，直接用 id
    if (el.id) {
      return '//*[@id="' + el.id + '"]';
    }

    // 尝试用 class 组合 + tag
    if (el.classList.length > 0) {
      const classes = Array.from(el.classList).filter(c =>
        !c.startsWith('meme-') && // 排除插件自身加的类
        !c.startsWith('css-')     // 排除 CSS module 类
      );
      if (classes.length > 0) {
        // 取最有辨识度的 1-2 个 class
        const xpath = '//' + el.tagName.toLowerCase() + '[' + classes.slice(0, 2).map(c => 'contains(@class, "' + c + '")').join(' and ') + ']';
        try {
          const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
          if (result.snapshotLength === 1) {
            return xpath;
          }
        } catch (e) { /* fallback */ }
      }
    }

    // tag + 属性（如 name, type, role, placeholder）
    const attrs = ['name', 'type', 'role', 'placeholder', 'aria-label', 'data-testid'];
    for (const attr of attrs) {
      const val = el.getAttribute(attr);
      if (val) {
        const xpath = '//' + el.tagName.toLowerCase() + '[@' + attr + '="' + val + '"]';
        try {
          const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
          if (result.snapshotLength <= 3) {
            return xpath;
          }
        } catch (e) { /* fallback */ }
      }
    }

    // 逐步向上构建路径（带位置谓词）
    const segments = [];
    let current = el;
    while (current && current !== document.body && current !== document.documentElement) {
      let seg = current.tagName.toLowerCase();
      // 计算同级同名元素中的位置
      if (current.parentElement) {
        const siblings = Array.from(current.parentElement.children).filter(s => s.tagName === current.tagName);
        if (siblings.length > 1) {
          seg += '[' + (siblings.indexOf(current) + 1) + ']';
        }
      }
      segments.unshift(seg);
      current = current.parentElement;
    }
    if (segments.length > 0) {
      return '/' + segments.join('/');
    }

    // 最兜底
    return '/' + el.tagName.toLowerCase();
  }

  // 渲染 API 列表
  function renderApiList(container) {
    if (!container) container = document.getElementById('meme-settings-body');
    if (!container) return;

    container.innerHTML = '';

    const titleDiv = document.createElement('div');
    titleDiv.className = 'meme-api-section-title';
    titleDiv.textContent = '已添加的接口';
    container.appendChild(titleDiv);

    if (customApis.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'meme-api-empty';
      emptyDiv.textContent = '暂无自定义接口，点击下方按钮添加';
      container.appendChild(emptyDiv);
    } else {
      customApis.forEach((api, index) => {
        const item = document.createElement('div');
        item.className = 'meme-api-item' + (api.enabled === false ? ' disabled' : '');

        // 图标
        const icon = document.createElement('div');
        icon.className = 'meme-api-item-icon';
        icon.textContent = api.icon || '🌐';
        item.appendChild(icon);

        // 信息
        const info = document.createElement('div');
        info.className = 'meme-api-item-info';
        const nameEl = document.createElement('div');
        nameEl.className = 'meme-api-item-name';
        nameEl.textContent = api.name || '未命名接口';
        info.appendChild(nameEl);
        const urlEl = document.createElement('div');
        urlEl.className = 'meme-api-item-url';
        urlEl.textContent = api.urlTemplate || '';
        info.appendChild(urlEl);
        item.appendChild(info);

        // 操作按钮
        const actions = document.createElement('div');
        actions.className = 'meme-api-item-actions';

        // 开关
        const toggle = document.createElement('button');
        toggle.className = 'meme-api-toggle' + (api.enabled !== false ? ' on' : '');
        toggle.title = api.enabled !== false ? '已启用' : '已禁用';
        toggle.addEventListener('click', (e) => {
          e.stopPropagation();
          api.enabled = api.enabled === false ? true : false;
          saveCustomApis();
          rebuildChannels();
          renderChannelTabs();
          renderApiList();
        });
        actions.appendChild(toggle);

        // 编辑
        const editBtn = document.createElement('button');
        editBtn.className = 'meme-api-edit';
        editBtn.innerHTML = '✏️';
        editBtn.title = '编辑';
        editBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          showApiForm(container, index, api);
        });
        actions.appendChild(editBtn);

        // 删除
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'meme-api-delete';
        deleteBtn.innerHTML = '🗑️';
        deleteBtn.title = '删除';
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (confirm(`确定要删除「${api.name || '未命名接口'}」吗？`)) {
            customApis.splice(index, 1);
            saveCustomApis();
            rebuildChannels();
            renderChannelTabs();
            renderApiList();
          }
        });
        actions.appendChild(deleteBtn);

        item.appendChild(actions);
        container.appendChild(item);
      });
    }

    // 添加按钮
    const addBtn = document.createElement('button');
    addBtn.className = 'meme-api-add-btn';
    addBtn.innerHTML = '➕ 添加自定义 API 接口';
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showApiForm(container, -1, null);
    });
    container.appendChild(addBtn);
  }

  // 显示 API 编辑表单
  function showApiForm(container, editIndex, existingApi) {
    // 移除已有的表单
    const existingForm = container.querySelector('.meme-api-form');
    if (existingForm) existingForm.remove();

    const form = document.createElement('div');
    form.className = 'meme-api-form';

    const isEdit = editIndex >= 0;
    form.innerHTML = `
      <div class="meme-api-form-title">${isEdit ? '✏️ 编辑接口' : '➕ 添加新接口'}</div>
      <div class="meme-form-row">
        <div class="meme-form-group">
          <label class="meme-form-label">接口名称</label>
          <input class="meme-form-input" id="meme-api-name" type="text" placeholder="如：斗图啦" value="${isEdit ? (existingApi.name || '') : ''}">
        </div>
        <div class="meme-form-group">
          <label class="meme-form-label">图标 <span class="meme-form-hint">(Emoji)</span></label>
          <input class="meme-form-input" id="meme-api-icon" type="text" placeholder="🌐" value="${isEdit ? (existingApi.icon || '🌐') : '🌐'}" style="width:60px;">
        </div>
      </div>
      <div class="meme-form-group">
        <label class="meme-form-label">搜索 URL 模板 <span class="meme-form-hint">({query}=关键词, {page}=页码)</span></label>
        <input class="meme-form-input" id="meme-api-url" type="text" placeholder="https://api.example.com/search?q={query}&page={page}" value="${isEdit ? (existingApi.urlTemplate || '') : ''}">
      </div>
      <div class="meme-form-group">
        <label class="meme-form-label">推荐 URL 模板 <span class="meme-form-hint">(可选，不填则用搜索模板+默认热词)</span></label>
        <input class="meme-form-input" id="meme-api-trending-url" type="text" placeholder="https://api.example.com/hot?page={page}" value="${isEdit ? (existingApi.trendingUrlTemplate || '') : ''}">
      </div>
      <div class="meme-form-group">
        <label class="meme-form-label">数据列表路径 <span class="meme-form-hint">(如 data.list 或 res)</span></label>
        <input class="meme-form-input" id="meme-api-list-path" type="text" placeholder="data" value="${isEdit ? (existingApi.listPath || 'data') : 'data'}">
      </div>
      <div class="meme-form-group">
        <label class="meme-form-label">图片 URL 路径 <span class="meme-form-hint">(列表项中图片链接的字段名)</span></label>
        <input class="meme-form-input" id="meme-api-img-path" type="text" placeholder="url" value="${isEdit ? (existingApi.imageUrlPath || 'url') : 'url'}">
      </div>
      <div class="meme-form-row">
        <div class="meme-form-group">
          <label class="meme-form-label">预览图路径 <span class="meme-form-hint">(可选)</span></label>
          <input class="meme-form-input" id="meme-api-preview-path" type="text" placeholder="留空则同图片URL" value="${isEdit ? (existingApi.previewUrlPath || '') : ''}">
        </div>
        <div class="meme-form-group">
          <label class="meme-form-label">图片宽度字段 <span class="meme-form-hint">(可选)</span></label>
          <input class="meme-form-input" id="meme-api-width-path" type="text" placeholder="width" value="${isEdit ? (existingApi.widthPath || '') : ''}">
        </div>
      </div>
      <div class="meme-form-row">
        <div class="meme-form-group">
          <label class="meme-form-label">图片高度字段 <span class="meme-form-hint">(可选)</span></label>
          <input class="meme-form-input" id="meme-api-height-path" type="text" placeholder="height" value="${isEdit ? (existingApi.heightPath || '') : ''}">
        </div>
        <div class="meme-form-group">
          <label class="meme-form-label">还有更多? <span class="meme-form-hint">(布尔/数字字段)</span></label>
          <input class="meme-form-input" id="meme-api-hasmore-path" type="text" placeholder="hasMore" value="${isEdit ? (existingApi.hasMorePath || '') : ''}">
        </div>
      </div>
      <div class="meme-form-row">
        <div class="meme-form-group">
          <label class="meme-form-label">成功检查路径 <span class="meme-form-hint">(可选)</span></label>
          <input class="meme-form-input" id="meme-api-success-path" type="text" placeholder="code" value="${isEdit ? (existingApi.successCheck || '') : ''}">
        </div>
        <div class="meme-form-group">
          <label class="meme-form-label">成功值 <span class="meme-form-hint">(可选，如 200 或 0)</span></label>
          <input class="meme-form-input" id="meme-api-success-value" type="text" placeholder="200" value="${isEdit ? (existingApi.successValue || '') : ''}">
        </div>
      </div>
      <div class="meme-form-row">
        <div class="meme-form-group">
          <label class="meme-form-label">最大页码字段 <span class="meme-form-hint">(可选)</span></label>
          <input class="meme-form-input" id="meme-api-maxpage-path" type="text" placeholder="maxpage" value="${isEdit ? (existingApi.maxPagePath || '') : ''}">
        </div>
        <div class="meme-form-group">
          <label class="meme-form-label">当前页码字段 <span class="meme-form-hint">(可选)</span></label>
          <input class="meme-form-input" id="meme-api-page-path" type="text" placeholder="page" value="${isEdit ? (existingApi.pagePath || '') : ''}">
        </div>
      </div>
      <div class="meme-form-error" id="meme-api-form-error"></div>
      <div class="meme-form-actions">
        <button class="meme-form-btn meme-form-btn-cancel" id="meme-api-form-cancel">取消</button>
        <button class="meme-form-btn meme-form-btn-test" id="meme-api-form-test">🧪 测试</button>
        <button class="meme-form-btn meme-form-btn-save" id="meme-api-form-save">💾 保存</button>
      </div>
    `;

    container.appendChild(form);

    // 滚动到表单
    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // 取消
    form.querySelector('#meme-api-form-cancel').addEventListener('click', (e) => {
      e.stopPropagation();
      form.remove();
    });

    // 保存
    form.querySelector('#meme-api-form-save').addEventListener('click', (e) => {
      e.stopPropagation();
      saveApiForm(form, editIndex);
    });

    // 测试
    form.querySelector('#meme-api-form-test').addEventListener('click', (e) => {
      e.stopPropagation();
      testApiForm(form);
    });
  }

  // 收集表单数据
  function collectApiFormData(form) {
    const name = form.querySelector('#meme-api-name').value.trim();
    const icon = form.querySelector('#meme-api-icon').value.trim() || '🌐';
    const urlTemplate = form.querySelector('#meme-api-url').value.trim();
    const trendingUrlTemplate = form.querySelector('#meme-api-trending-url').value.trim();
    const listPath = form.querySelector('#meme-api-list-path').value.trim() || 'data';
    const imageUrlPath = form.querySelector('#meme-api-img-path').value.trim() || 'url';
    const previewUrlPath = form.querySelector('#meme-api-preview-path').value.trim();
    const widthPath = form.querySelector('#meme-api-width-path').value.trim();
    const heightPath = form.querySelector('#meme-api-height-path').value.trim();
    const hasMorePath = form.querySelector('#meme-api-hasmore-path').value.trim();
    const successCheck = form.querySelector('#meme-api-success-path').value.trim();
    const successValue = form.querySelector('#meme-api-success-value').value.trim();
    const maxPagePath = form.querySelector('#meme-api-maxpage-path').value.trim();
    const pagePath = form.querySelector('#meme-api-page-path').value.trim();

    return {
      name,
      icon,
      urlTemplate,
      trendingUrlTemplate,
      listPath,
      imageUrlPath,
      previewUrlPath,
      widthPath,
      heightPath,
      hasMorePath,
      successCheck,
      successValue,
      maxPagePath,
      pagePath,
    };
  }

  // 保存 API 配置
  function saveApiForm(form, editIndex) {
    const data = collectApiFormData(form);
    const errorEl = form.querySelector('#meme-api-form-error');

    // 验证必填字段
    if (!data.name) {
      errorEl.textContent = '请输入接口名称';
      errorEl.classList.add('show');
      return;
    }
    if (!data.urlTemplate) {
      errorEl.textContent = '请输入搜索 URL 模板';
      errorEl.classList.add('show');
      return;
    }
    if (!data.urlTemplate.includes('{query}')) {
      errorEl.textContent = 'URL 模板必须包含 {query} 占位符';
      errorEl.classList.add('show');
      return;
    }

    errorEl.classList.remove('show');

    const apiConfig = {
      id: editIndex >= 0 ? customApis[editIndex].id : 'custom_' + Date.now(),
      name: data.name,
      icon: data.icon,
      urlTemplate: data.urlTemplate,
      trendingUrlTemplate: data.trendingUrlTemplate,
      listPath: data.listPath,
      imageUrlPath: data.imageUrlPath,
      previewUrlPath: data.previewUrlPath,
      widthPath: data.widthPath,
      heightPath: data.heightPath,
      hasMorePath: data.hasMorePath,
      successCheck: data.successCheck,
      successValue: data.successValue,
      maxPagePath: data.maxPagePath,
      pagePath: data.pagePath,
      enabled: true,
    };

    if (editIndex >= 0) {
      customApis[editIndex] = apiConfig;
    } else {
      customApis.push(apiConfig);
    }

    saveCustomApis();
    rebuildChannels();
    renderChannelTabs();
    renderApiList();
    showToast('✅ 自定义接口已保存');
  }

  // 测试 API
  async function testApiForm(form) {
    const data = collectApiFormData(form);
    const errorEl = form.querySelector('#meme-api-form-error');

    if (!data.urlTemplate) {
      errorEl.textContent = '请先输入 URL 模板';
      errorEl.classList.add('show');
      return;
    }

    // 替换占位符生成测试 URL
    const testQuery = '开心';
    const testPage = 1;
    let testUrl = data.urlTemplate
      .replace(/\{query\}/g, encodeURIComponent(testQuery))
      .replace(/\{page\}/g, testPage);

    errorEl.textContent = '⏳ 正在测试…';
    errorEl.style.color = '#4a90d9';
    errorEl.classList.add('show');

    try {
      const responseData = await proxyFetch(testUrl);
      // 尝试用配置解析
      const apiConfig = {
        ...data,
        id: 'test',
        enabled: true,
      };
      const result = parseCustomApiResponse(responseData, apiConfig);

      if (result.items && result.items.length > 0) {
        errorEl.style.color = '#4caf50';
        errorEl.textContent = `✅ 测试成功！获取到 ${result.items.length} 条结果，hasMore=${result.hasMore}`;
      } else {
        errorEl.style.color = '#ff9800';
        errorEl.textContent = `⚠️ 请求成功但未解析到结果，请检查路径配置。原始响应: ${JSON.stringify(responseData).substring(0, 200)}…`;
      }
    } catch (err) {
      errorEl.style.color = '#e44';
      errorEl.textContent = `❌ 请求失败: ${err.message}`;
    }
  }

  // ============ 搜索逻辑 ============
  async function doSearch(query) {
    if (!query) return;
    // 生成新请求 ID，使所有过期请求的响应自动失效
    const requestId = ++searchRequestId;
    isLoading = false;
    currentQuery = query;
    currentPage = 1;
    hasMorePages = false;

    // 收藏渠道：本地搜索收藏列表
    const favTabIndex = CHANNELS.length;
    console.log('[表情包搜索] doSearch:', query, 'requestId:', requestId, 'currentChannel:', currentChannel, 'favTabIndex:', favTabIndex);
    if (currentChannel === favTabIndex) {
      searchFavorites(query);
      return;
    }

    const channel = CHANNELS[currentChannel];
    const resultsEl = document.getElementById('meme-results');
    if (!resultsEl) return;

    console.log('[表情包搜索] 开始搜索:', query, '渠道:', channel.name, '页码:', currentPage, 'requestId:', requestId);
    showLoading(resultsEl);

    try {
      let items = [];
      let hasMore = false;
      if (channel.type === 'emoji') {
        items = await searchEmoji(query);
      } else {
        const result = await searchFromChannel(channel, query, currentPage, requestId);
        // 检查请求是否已过期（用户切换了频道或发起了新搜索）
        if (requestId !== searchRequestId) {
          console.log('[表情包搜索] 搜索请求已过期，丢弃结果 (requestId:', requestId, '!= current:', searchRequestId, ')');
          return;
        }
        items = result.items;
        hasMore = result.hasMore;
      }
      hasMorePages = hasMore;
      console.log('[表情包搜索] 搜索结果:', items.length, '条, 有更多:', hasMore);
      renderResults(resultsEl, items, channel.type, hasMore);
    } catch (err) {
      if (requestId !== searchRequestId || err.message === 'REQUEST_CANCELLED') return; // 过期请求，静默丢弃
      console.error('[表情包搜索] 搜索失败（已重试' + MAX_RETRY + '次）:', err);
      let errorMsg = `网络不给力，已重试${MAX_RETRY}次仍失败，稍后再试试？`;
      if (err.message === 'PROXY_EXHAUSTED_NO_CORS' || err.message === 'EXT_CONTEXT_INVALIDATED_NO_CORS') {
        errorMsg = `${channel.name}请求失败，请刷新页面后重试`;
      }
      showError(resultsEl, errorMsg);
    }
  }

  async function loadTrending() {
    currentQuery = '';
    currentPage = 1;
    hasMorePages = false;
    // 生成新请求 ID，使所有过期请求的响应自动失效
    const requestId = ++searchRequestId;
    isLoading = false;

    // 收藏渠道：展示收藏列表
    const favTabIndex = CHANNELS.length;
    console.log('[表情包搜索] loadTrending: requestId:', requestId, 'currentChannel:', currentChannel, 'channel:', CHANNELS[currentChannel]?.name);
    if (currentChannel === favTabIndex) {
      showFavorites();
      return;
    }

    const channel = CHANNELS[currentChannel];
    const resultsEl = document.getElementById('meme-results');
    if (!resultsEl) return;

    console.log('[表情包搜索] 加载流行表情包，渠道:', channel.name, 'requestId:', requestId);
    showLoading(resultsEl);

    try {
      let items = [];
      let hasMore = false;
      if (channel.type === 'emoji') {
        items = await fetchEmojiList();
      } else if (channel.trendingUrl) {
        const url = channel.trendingUrl(currentPage);
        if (!url) {
          showError(resultsEl, '该渠道暂不可用');
          return;
        }
        console.log('[表情包搜索] 请求 URL:', url);
        const data = await proxyFetchWithRetry(url, requestId);
        // 检查请求是否已过期
        if (requestId !== searchRequestId) {
          console.log('[表情包搜索] loadTrending 请求已过期，丢弃结果 (requestId:', requestId, '!= current:', searchRequestId, ')');
          return;
        }
        console.log('[表情包搜索] API 返回数据:', data);
        const result = channel.parseResponse(data);
        items = result.items;
        hasMore = result.hasMore;
      }
      hasMorePages = hasMore;
      console.log('[表情包搜索] 解析结果:', items.length, '条, 有更多:', hasMore);
      renderResults(resultsEl, items, channel.type, hasMore);
    } catch (err) {
      if (requestId !== searchRequestId || err.message === 'REQUEST_CANCELLED') return; // 过期请求，静默丢弃
      console.error('[表情包搜索] 加载流行表情包失败（已重试' + MAX_RETRY + '次）:', err);
      // 回退到本地 Emoji
      const localEmojis = getDefaultEmojis();
      renderResults(resultsEl, localEmojis, 'emoji', false);
      if (err.message === 'PROXY_EXHAUSTED_NO_CORS' || err.message === 'EXT_CONTEXT_INVALIDATED_NO_CORS') {
        showToast('⚠️ ' + channel.name + '请求失败，请刷新页面后重试');
      } else {
        showToast('⚠️ 网络不给力，已重试' + MAX_RETRY + '次，先看看 Emoji 吧');
      }
    }
  }

  async function loadMore() {
    if (isLoadingMore || !hasMorePages) return;
    // 收藏渠道不需要分页
    const favTabIndex = CHANNELS.length;
    if (currentChannel === favTabIndex) return;
    const channel = CHANNELS[currentChannel];
    if (channel.type === 'emoji') return;

    isLoadingMore = true;
    const requestId = searchRequestId; // 记住当前搜索请求 ID
    currentPage++;

    const resultsEl = document.getElementById('meme-results');
    if (!resultsEl) { isLoadingMore = false; return; }

    showLoadMoreIndicator(resultsEl, true);

    try {
      let items = [];
      let hasMore = false;

      if (currentQuery) {
        const result = await searchFromChannel(channel, currentQuery, currentPage);
        // 如果主搜索已切换，丢弃 loadMore 结果
        if (requestId !== searchRequestId) {
          console.log('[表情包搜索] loadMore 请求已过期，丢弃结果');
          return;
        }
        items = result.items;
        hasMore = result.hasMore;
      } else if (channel.trendingUrl) {
        const url = channel.trendingUrl(currentPage);
        if (url) {
          const data = await proxyFetch(url);
          if (requestId !== searchRequestId) {
            console.log('[表情包搜索] loadMore 请求已过期，丢弃结果');
            return;
          }
          const result = channel.parseResponse(data);
          items = result.items;
          hasMore = result.hasMore;
        }
      }

      hasMorePages = hasMore;
      console.log('[表情包搜索] 加载更多页:', currentPage, '结果:', items.length, '条, 有更多:', hasMore);

      removeLoadMoreIndicator(resultsEl);
      appendResults(resultsEl, items, channel.type, hasMore);
    } catch (err) {
      if (requestId !== searchRequestId) return; // 过期请求，静默丢弃
      console.error('[表情包搜索] 加载更多失败:', err);
      removeLoadMoreIndicator(resultsEl);
      currentPage--;
      if (err.message === 'PROXY_EXHAUSTED_NO_CORS' || err.message === 'EXT_CONTEXT_INVALIDATED_NO_CORS') {
        showToast('⚠️ ' + channel.name + '加载失败，请刷新页面后重试');
      }
    } finally {
      isLoadingMore = false;
    }
  }

  async function searchFromChannel(channel, query, page, requestId) {
    if (!channel.searchUrl) return { items: [], hasMore: false };
    const url = channel.searchUrl(query, page);
    if (!url) return { items: [], hasMore: false };
    console.log('[表情包搜索] searchFromChannel 渠道:', channel.name, 'URL:', url);
    const data = requestId !== undefined
      ? await proxyFetchWithRetry(url, requestId)
      : await proxyFetch(url);
    console.log('[表情包搜索] searchFromChannel 渠道:', channel.name, '返回数据类型:', typeof data, '是否有code:', data && data.code !== undefined, 'code值:', data?.code, 'data长度:', Array.isArray(data?.data) ? data.data.length : 'N/A');
    const result = channel.parseResponse(data);
    console.log('[表情包搜索] searchFromChannel 渠道:', channel.name, '解析结果:', result.items.length, '条, hasMore:', result.hasMore);
    return result;
  }

  // ============ Emoji 搜索（纯本地，不依赖外部 API）============
  function searchEmoji(query) {
    return Promise.resolve(localEmojiSearch(query));
  }

  function fetchEmojiList() {
    return Promise.resolve(getDefaultEmojis());
  }

  function localEmojiSearch(query) {
    const q = query.toLowerCase();
    const emojiDB = getDefaultEmojis();
    return emojiDB.filter(e =>
      e.name.toLowerCase().includes(q) ||
      e.keywords.some(k => k.includes(q))
    );
  }

  function getDefaultEmojis() {
    return [
      { id: '1', emoji: '😀', name: 'grinning', keywords: ['happy', 'smile', '开心', '笑', '哈'] },
      { id: '2', emoji: '😂', name: 'joy', keywords: ['laugh', 'cry', '笑哭', '哈哈', '笑死'] },
      { id: '3', emoji: '🤣', name: 'rofl', keywords: ['laugh', 'roll', '笑死', '搞笑', '哈哈哈'] },
      { id: '4', emoji: '😍', name: 'heart eyes', keywords: ['love', 'love it', '喜爱', '爱', '花痴'] },
      { id: '5', emoji: '🥺', name: 'pleading', keywords: ['please', 'sad', '可怜', '求求', '委屈'] },
      { id: '6', emoji: '😎', name: 'cool', keywords: ['cool', 'sunglasses', '酷', '帅', '帅呆'] },
      { id: '7', emoji: '🤔', name: 'thinking', keywords: ['think', 'wonder', '思考', '想', '嗯'] },
      { id: '8', emoji: '😱', name: 'scream', keywords: ['shock', 'scared', '震惊', '害怕', '天哪'] },
      { id: '9', emoji: '🤗', name: 'hug', keywords: ['hug', 'care', '抱抱', '关心', '温暖'] },
      { id: '10', emoji: '😏', name: 'smirk', keywords: ['smug', 'sneaky', '得意', '嘿嘿', '坏笑'] },
      { id: '11', emoji: '😴', name: 'sleeping', keywords: ['sleep', 'tired', '困', '睡觉', '累'] },
      { id: '12', emoji: '🤮', name: 'vomiting', keywords: ['sick', 'gross', '恶心', '吐', '呕'] },
      { id: '13', emoji: '🥰', name: 'smiling hearts', keywords: ['love', 'affection', '喜欢', '可爱', '爱'] },
      { id: '14', emoji: '😘', name: 'kiss', keywords: ['kiss', 'love', '亲', '飞吻', '么么'] },
      { id: '15', emoji: '😤', name: 'huff', keywords: ['angry', 'proud', '生气', '哼', '不服'] },
      { id: '16', emoji: '🙄', name: 'eye roll', keywords: ['annoyed', 'whatever', '无语', '翻白眼', '随便'] },
      { id: '17', emoji: '🤷', name: 'shrug', keywords: ['dunno', 'whatever', '摊手', '不知道', '无奈'] },
      { id: '18', emoji: '🤦', name: 'facepalm', keywords: ['omg', 'fail', '捂脸', '无语', '尴尬'] },
      { id: '19', emoji: '😭', name: 'sob', keywords: ['cry', 'sad', '哭', '大哭', '伤心'] },
      { id: '20', emoji: '🥳', name: 'party', keywords: ['celebrate', 'yay', '庆祝', '派对', '开心'] },
      { id: '21', emoji: '🔥', name: 'fire', keywords: ['hot', 'lit', '火', '牛逼', '厉害'] },
      { id: '22', emoji: '💪', name: 'muscle', keywords: ['strong', 'power', '强', '加油', '力量'] },
      { id: '23', emoji: '👏', name: 'clap', keywords: ['applause', 'good', '鼓掌', '棒', '赞'] },
      { id: '24', emoji: '🎉', name: 'party popper', keywords: ['celebrate', 'confetti', '庆祝', '派对', '撒花'] },
      { id: '25', emoji: '💯', name: 'hundred', keywords: ['perfect', 'score', '满分', '完美', '一百分'] },
      { id: '26', emoji: '👀', name: 'eyes', keywords: ['look', 'watch', '看', '关注', '围观'] },
      { id: '27', emoji: '❤️', name: 'red heart', keywords: ['love', 'heart', '爱', '心', '喜欢'] },
      { id: '28', emoji: '💔', name: 'broken heart', keywords: ['sad', 'break', '心碎', '伤心', '失恋'] },
      { id: '29', emoji: '👍', name: 'thumbs up', keywords: ['like', 'good', '赞', '好', '可以'] },
      { id: '30', emoji: '👎', name: 'thumbs down', keywords: ['dislike', 'bad', '踩', '差', '不行'] },
      { id: '31', emoji: '✌️', name: 'peace', keywords: ['peace', 'victory', '胜利', '耶', '和平'] },
      { id: '32', emoji: '🤝', name: 'handshake', keywords: ['deal', 'partner', '合作', '握手', '达成'] },
      { id: '33', emoji: '🙏', name: 'pray', keywords: ['pray', 'thanks', '祈祷', '感谢', '拜托'] },
      { id: '34', emoji: '👊', name: 'fist bump', keywords: ['fist', 'punch', '拳头', '加油', '碰拳'] },
      { id: '35', emoji: '✨', name: 'sparkles', keywords: ['magic', 'shine', '闪', '魔法', '特效'] },
      { id: '36', emoji: '🐱', name: 'cat', keywords: ['cat', 'kitty', '猫', '喵', '猫咪'] },
      { id: '37', emoji: '🐶', name: 'dog', keywords: ['dog', 'puppy', '狗', '汪', '狗狗'] },
      { id: '38', emoji: '🐼', name: 'panda', keywords: ['panda', 'cute', '熊猫', '国宝', '可爱'] },
      { id: '39', emoji: '🦊', name: 'fox', keywords: ['fox', 'clever', '狐狸', '聪明', '萌'] },
      { id: '40', emoji: '🐰', name: 'rabbit', keywords: ['rabbit', 'bunny', '兔子', '萌', '可爱'] },
      { id: '41', emoji: '🦁', name: 'lion', keywords: ['lion', 'brave', '狮子', '勇敢', '霸气'] },
      { id: '42', emoji: '🐸', name: 'frog', keywords: ['frog', 'funny', '青蛙', '呱', '搞笑'] },
      { id: '43', emoji: '☕', name: 'coffee', keywords: ['coffee', 'drink', '咖啡', '喝', '提神'] },
      { id: '44', emoji: '🍕', name: 'pizza', keywords: ['pizza', 'food', '披萨', '吃', '美食'] },
      { id: '45', emoji: '🍔', name: 'burger', keywords: ['burger', 'food', '汉堡', '吃', '快餐'] },
      { id: '46', emoji: '🍜', name: 'noodles', keywords: ['noodles', 'ramen', '面', '拉面', '吃'] },
      { id: '47', emoji: '🎂', name: 'cake', keywords: ['cake', 'birthday', '蛋糕', '生日', '甜'] },
      { id: '48', emoji: '🍺', name: 'beer', keywords: ['beer', 'drink', '啤酒', '干杯', '喝'] },
      { id: '49', emoji: '🌈', name: 'rainbow', keywords: ['rainbow', 'color', '彩虹', '多彩'] },
      { id: '50', emoji: '🌸', name: 'cherry blossom', keywords: ['flower', 'spring', '花', '春天', '樱花'] },
      { id: '51', emoji: '🍀', name: 'clover', keywords: ['luck', 'lucky', '幸运', '草', '四叶草'] },
      { id: '52', emoji: '⭐', name: 'star', keywords: ['star', 'favorite', '星', '收藏', '好评'] },
      { id: '53', emoji: '🌙', name: 'moon', keywords: ['moon', 'night', '月亮', '夜晚', '晚安'] },
      { id: '54', emoji: '☀️', name: 'sun', keywords: ['sun', 'sunny', '太阳', '晴天', '阳光'] },
      { id: '55', emoji: '🌧️', name: 'rain', keywords: ['rain', 'weather', '下雨', '天气', '雨'] },
      { id: '56', emoji: '🎮', name: 'game', keywords: ['game', 'play', '游戏', '玩', '打游戏'] },
      { id: '57', emoji: '🎵', name: 'music', keywords: ['music', 'song', '音乐', '歌', '听歌'] },
      { id: '58', emoji: '🚀', name: 'rocket', keywords: ['rocket', 'fast', '火箭', '起飞', '冲'] },
      { id: '59', emoji: '✈️', name: 'airplane', keywords: ['fly', 'travel', '飞机', '旅行', '出发'] },
      { id: '60', emoji: '🏠', name: 'house', keywords: ['home', 'house', '家', '房子', '回家'] },
      { id: '61', emoji: '🤡', name: 'clown', keywords: ['clown', 'joke', '小丑', '搞笑', '滑稽'] },
      { id: '62', emoji: '💀', name: 'skull', keywords: ['dead', 'dying', '死', '笑死', '骨头'] },
      { id: '63', emoji: '🤪', name: 'zany', keywords: ['crazy', 'wild', '疯', '疯狂', '神经'] },
      { id: '64', emoji: '😈', name: 'devil', keywords: ['devil', 'evil', '恶魔', '坏', '搞鬼'] },
      { id: '65', emoji: '👻', name: 'ghost', keywords: ['ghost', 'scary', '鬼', '幽灵', '吓人'] },
      { id: '66', emoji: '🤖', name: 'robot', keywords: ['robot', 'ai', '机器人', 'AI', '智能'] },
      { id: '67', emoji: '👽', name: 'alien', keywords: ['alien', 'ufo', '外星人', 'UFO', '神秘'] },
      { id: '68', emoji: '💻', name: 'computer', keywords: ['computer', 'code', '电脑', '编程', '代码'] },
      { id: '69', emoji: '📱', name: 'phone', keywords: ['phone', 'mobile', '手机', '电话', '联系'] },
      { id: '70', emoji: '📝', name: 'memo', keywords: ['write', 'note', '写', '笔记', '记录'] },
      { id: '71', emoji: '💡', name: 'bulb', keywords: ['idea', 'light', '想法', '灯泡', '灵感'] },
      { id: '72', emoji: '🔑', name: 'key', keywords: ['key', 'lock', '钥匙', '关键', '密码'] },
      { id: '73', emoji: '💰', name: 'money bag', keywords: ['money', 'rich', '钱', '发财', '财富'] },
      { id: '74', emoji: '🎯', name: 'target', keywords: ['target', 'goal', '目标', '命中', '正中'] },
      { id: '75', emoji: '🏆', name: 'trophy', keywords: ['win', 'champion', '奖杯', '冠军', '赢'] },
      { id: '76', emoji: '🫡', name: 'salute', keywords: ['salute', 'respect', '敬礼', '致敬', '尊敬'] },
      { id: '77', emoji: '🤡', name: 'clown face', keywords: ['clown', 'funny', '小丑', '搞笑', '滑稽'] },
      { id: '78', emoji: '🫠', name: 'melting', keywords: ['melt', 'hot', '融化', '热', '受不了'] },
      { id: '79', emoji: '🥲', name: 'smiling tear', keywords: ['sad smile', 'touched', '含泪笑', '感动', '心酸'] },
      { id: '80', emoji: '🫣', name: 'peeking', keywords: ['peek', 'shy', '偷看', '害羞', '不好意思'] },
      { id: '81', emoji: '🤩', name: 'star struck', keywords: ['amazing', 'wow', '惊艳', '哇', '崇拜'] },
      { id: '82', emoji: '🥱', name: 'yawning', keywords: ['yawn', 'bored', '打哈欠', '无聊', '困'] },
      { id: '83', emoji: '🤮', name: 'nauseated', keywords: ['sick', 'gross', '恶心', '想吐', '呕'] },
      { id: '84', emoji: '🥶', name: 'cold', keywords: ['cold', 'freeze', '冷', '冻', '寒'] },
      { id: '85', emoji: '🥵', name: 'hot', keywords: ['hot', 'heat', '热', '热死了', '烫'] },
    ];
  }

  // ============ 渲染 ============
  function showLoading(container) {
    isLoading = true;
    container.className = 'meme-results results-centered';
    container.innerHTML = `
      <div class="meme-loading">
        <div class="spinner"></div>
        <div>搜索中…</div>
      </div>
    `;
  }

  function showError(container, msg) {
    isLoading = false;
    container.className = 'meme-results results-centered';
    container.innerHTML = `
      <div class="meme-empty">
        <div class="emoji">😵</div>
        <div>${msg || '加载失败，请稍后重试'}</div>
      </div>
    `;
  }

  function renderResults(container, items, type, hasMore) {
    isLoading = false;
    if (!items || items.length === 0) {
      hasMorePages = false;
      container.className = 'meme-results results-centered';
      container.innerHTML = '';
      container.innerHTML = `
        <div class="meme-empty">
          <div class="emoji">😕</div>
          <div>没有找到相关表情包，换个关键词试试？</div>
        </div>
      `;
      return;
    }

    container.className = 'meme-results results-waterfall';
    container.innerHTML = '';
    columnHeights = [0, 0, 0];
    const col1 = document.createElement('div');
    col1.className = 'meme-waterfall-column';
    col1.dataset.colIndex = '0';
    const col2 = document.createElement('div');
    col2.className = 'meme-waterfall-column';
    col2.dataset.colIndex = '1';
    const col3 = document.createElement('div');
    col3.className = 'meme-waterfall-column';
    col3.dataset.colIndex = '2';
    container.appendChild(col1);
    container.appendChild(col2);
    container.appendChild(col3);

    distributeToColumns(container, items, type);

    removeLoadMoreIndicator(container);
    if (hasMore) {
      const indicator = document.createElement('div');
      indicator.className = 'meme-load-more';
      indicator.id = 'meme-load-more';
      indicator.innerHTML = '<div class="spinner"></div><span>加载中…</span>';
      container.appendChild(indicator);
    }
  }

  function distributeToColumns(container, items, type) {
    const columns = container.querySelectorAll('.meme-waterfall-column');
    if (columns.length === 0) return;

    items.forEach(item => {
      const card = createCard(item, type);
      const shortest = getShortestColumn(columns);
      const colIndex = parseInt(shortest.dataset.colIndex) || 0;

      const estimated = estimateCardHeight(item, type);
      columnHeights[colIndex] += estimated;

      if (type !== 'emoji') {
        const img = card.querySelector('img');
        if (img) {
          trackImageLoad(img, colIndex, estimated);
        }
      }

      shortest.appendChild(card);
    });
  }

  function getShortestColumn(columns) {
    let shortest = columns[0];
    let minHeight = columnHeights[0];
    for (let i = 1; i < columns.length; i++) {
      if (columnHeights[i] < minHeight) {
        minHeight = columnHeights[i];
        shortest = columns[i];
      }
    }
    return shortest;
  }

  function estimateCardHeight(item, type) {
    if (type === 'emoji') return 100;
    if (item.width && item.height) {
      const colWidth = 150;
      return Math.max(80, (item.height / item.width) * colWidth) + 22;
    }
    return 120;
  }

  function trackImageLoad(img, columnIndex, estimatedHeight) {
    img.addEventListener('load', () => {
      const actualHeight = img.offsetHeight + 22;
      const diff = actualHeight - estimatedHeight;
      if (Math.abs(diff) > 5) {
        columnHeights[columnIndex] += diff;
      }
    });
  }

  function createCard(item, type, isFavView) {
    const card = document.createElement('div');
    card.className = 'meme-item';
    const fav = isFavorite(item.id);

    if (type === 'emoji') {
      const emojiSpan = document.createElement('div');
      emojiSpan.className = 'meme-item-emoji';
      emojiSpan.textContent = item.emoji;
      card.appendChild(emojiSpan);
      card.title = item.name || item.emoji;
      card.addEventListener('click', (e) => {
        e.stopPropagation();
        closeCtxMenu();
        copyEmoji(item.emoji);
      });
    } else {
      const img = document.createElement('img');
      img.src = item.preview || item.url;
      img.alt = '表情包';
      img.loading = 'lazy';
      img.addEventListener('error', function() {
        this.style.display = 'none';
        this.parentElement.innerHTML = '<div class="meme-item-emoji">😵</div>';
      });
      card.appendChild(img);
      const hint = document.createElement('div');
      hint.className = 'meme-copy-hint';
      const isGif = (item.url && item.url.toLowerCase().endsWith('.gif')) ||
                    (item.preview && item.preview.toLowerCase().endsWith('.gif'));
      hint.textContent = isGif ? '点击复制 · 右键更多' : '点击复制';
      card.appendChild(hint);
      card.addEventListener('click', (e) => {
        // 忽略收藏按钮的点击
        if (e.target.closest('.meme-fav-btn')) return;
        e.stopPropagation();
        closeCtxMenu();
        copyImageUrl(item.url);
      });
      if (isGif) {
        card.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          showGifCtxMenu(e.clientX, e.clientY, item.url);
        });
      }
    }

    // 收藏按钮（Emoji 和图片都加）
    const favBtn = document.createElement('button');
    favBtn.className = 'meme-fav-btn' + (fav ? ' favorited' : '');
    favBtn.innerHTML = fav ? '★' : '☆';
    favBtn.title = fav ? '取消收藏' : '收藏';
    favBtn.type = 'button';
    favBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();
      const wasFav = isFavorite(item.id);
      const nowFav = await toggleFavorite(item);
      // 更新按钮状态
      favBtn.innerHTML = nowFav ? '★' : '☆';
      favBtn.className = 'meme-fav-btn' + (nowFav ? ' favorited' : '');
      favBtn.title = nowFav ? '取消收藏' : '收藏';
      // 如果在收藏视图中取消收藏，移除卡片
      if (isFavView && wasFav && !nowFav) {
        const col = card.parentElement;
        const colIdx = col ? parseInt(col.dataset.colIndex) : -1;
        if (colIdx >= 0 && colIdx < 3) {
          const cardH = card.offsetHeight + 10; // 10 = gap
          columnHeights[colIdx] = Math.max(0, columnHeights[colIdx] - cardH);
        }
        card.style.transition = 'opacity 0.2s, transform 0.2s';
        card.style.opacity = '0';
        card.style.transform = 'scale(0.8)';
        setTimeout(() => {
          card.remove();
          // 检查是否全部移除完
          const resultsEl = document.getElementById('meme-results');
          if (resultsEl) {
            const columns = resultsEl.querySelectorAll('.meme-waterfall-column');
            const hasCards = Array.from(columns).some(col => col.children.length > 0);
            if (!hasCards) {
              resultsEl.className = 'meme-results results-centered';
              resultsEl.innerHTML = '<div class="meme-fav-empty"><div class="emoji">⭐</div><div>还没有收藏的表情包</div><div style="font-size:12px;color:#bbb;margin-top:4px;">搜索表情包时点击 ☆ 即可收藏</div></div>';
            }
          }
        }, 200);
      }
      // 如果当前在收藏渠道，刷新收藏渠道的 tab 计数
      refreshFavoriteCount();
    });
    card.appendChild(favBtn);

    return card;
  }

  function appendResults(container, items, type, hasMore) {
    let columns = container.querySelectorAll('.meme-waterfall-column');
    if (columns.length === 0) {
      columnHeights = [0, 0, 0];
      const col1 = document.createElement('div');
      col1.className = 'meme-waterfall-column';
      col1.dataset.colIndex = '0';
      const col2 = document.createElement('div');
      col2.className = 'meme-waterfall-column';
      col2.dataset.colIndex = '1';
      const col3 = document.createElement('div');
      col3.className = 'meme-waterfall-column';
      col3.dataset.colIndex = '2';
      const indicator = container.querySelector('#meme-load-more');
      if (indicator) {
        container.insertBefore(col1, indicator);
        container.insertBefore(col2, indicator);
        container.insertBefore(col3, indicator);
      } else {
        container.appendChild(col1);
        container.appendChild(col2);
        container.appendChild(col3);
      }
      columns = [col1, col2, col3];
    }

    items.forEach(item => {
      const card = createCard(item, type);
      const shortest = getShortestColumn(columns);
      const colIndex = parseInt(shortest.dataset.colIndex) || 0;

      const estimated = estimateCardHeight(item, type);
      columnHeights[colIndex] += estimated;

      if (type !== 'emoji') {
        const img = card.querySelector('img');
        if (img) {
          trackImageLoad(img, colIndex, estimated);
        }
      }

      shortest.appendChild(card);
    });

    removeLoadMoreIndicator(container);
    if (hasMore) {
      const indicator = document.createElement('div');
      indicator.className = 'meme-load-more';
      indicator.id = 'meme-load-more';
      indicator.innerHTML = '<div class="spinner"></div><span>加载中…</span>';
      container.appendChild(indicator);
    } else if (items.length > 0 && currentPage > 1) {
      const indicator = document.createElement('div');
      indicator.className = 'meme-load-more no-more';
      indicator.id = 'meme-load-more';
      indicator.textContent = '— 没有更多了 —';
      container.appendChild(indicator);
    }
  }

  function showLoadMoreIndicator(container, show) {
    let indicator = container.querySelector('#meme-load-more');
    if (show && !indicator) {
      indicator = document.createElement('div');
      indicator.className = 'meme-load-more';
      indicator.id = 'meme-load-more';
      indicator.innerHTML = '<div class="spinner"></div><span>加载中…</span>';
      container.appendChild(indicator);
    }
  }

  function removeLoadMoreIndicator(container) {
    const indicator = container.querySelector('#meme-load-more');
    if (indicator) indicator.remove();
  }

  // ============ 复制功能 ============
  async function copyEmoji(emoji) {
    try {
      await navigator.clipboard.writeText(emoji);
      showToast('✅ 已复制表情: ' + emoji);
      insertToActiveInput(emoji);
    } catch (_) {
      fallbackCopy(emoji);
    }
  }

  /**
   * 复制图片 URL 到剪贴板
   * @param {string} url - 图片 URL
   * @param {boolean|undefined} forceGif - true: 强制动图模式(仅对GIF有效); false: 强制静态模式; undefined: 自动
   */
  async function copyImageUrl(url, forceGif) {
    if (!url) {
      showToast('❌ 图片链接无效');
      return;
    }

    console.log('[表情包搜索] copyImageUrl:', url, 'forceGif=', forceGif);

    // 优先策略：通过 Background Service Worker 写入剪贴板
    // Background 有 clipboardWrite 权限，不受 transient activation 限制
    try {
      const bgResult = await backgroundCopyImage(url, forceGif);
      if (bgResult && bgResult.success) {
        console.log('[表情包搜索] Background 剪贴板写入成功:', bgResult.message);
        showToast(bgResult.message || '✅ 表情包已复制到剪贴板！');
        return;
      }
      console.warn('[表情包搜索] Background 剪贴板写入失败:', bgResult?.error || '未知错误');
    } catch (bgErr) {
      console.warn('[表情包搜索] Background 剪贴板写入异常:', bgErr.message || bgErr);
    }

    // 回退策略1：尝试通过 Background 代理获取图片，在 content script 中写入
    try {
      const blob = await proxyFetchBlob(url);
      console.log('[表情包搜索] proxyFetchBlob 成功:', blob.type, blob.size, 'bytes');
      if (blob && blob.type && blob.type.startsWith('image/')) {
        const success = await writeImageToClipboard(blob, url, forceGif);
        if (success) return;
      } else {
        console.warn('[表情包搜索] proxyFetchBlob 返回非图片 blob:', blob.type);
      }
    } catch (proxyErr) {
      console.warn('[表情包搜索] Background 代理获取图片失败，尝试直接 fetch:', proxyErr.message || proxyErr);
    }

    // 回退策略2：直接 fetch + content script 写入
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      console.log('[表情包搜索] 直接 fetch 成功:', blob.type, blob.size, 'bytes');
      if (blob.type && blob.type.startsWith('image/')) {
        const success = await writeImageToClipboard(blob, url, forceGif);
        if (success) return;
      }
      console.warn('[表情包搜索] 所有图片写入方式失败，回退为复制链接');
      await copyTextSafely(url);
      showToast('📋 已复制图片链接');
    } catch (err) {
      console.error('[表情包搜索] fetch 也失败:', err.message || err);
      await copyTextSafely(url);
      showToast('📋 已复制图片链接');
    }
  }

  // 通过 Background Service Worker 获取图片并写入剪贴板
  // 绕过 content script 的 transient activation 限制
  async function backgroundCopyImage(url, forceGif) {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error('Background 剪贴板写入超时'));
        }, FETCH_TIMEOUT);

        chrome.runtime.sendMessage({ type: 'MEME_COPY_IMAGE', url, forceGif }, (response) => {
          clearTimeout(timer);
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(response);
        });
      });
    }
    return { success: false, error: 'Background 不可用' };
  }

  /**
   * 将图片 blob 写入剪贴板
   * @param {Blob} blob - 图片 blob
   * @param {string} originalUrl - 原始 URL（用于 fallback 复制链接）
   * @param {boolean|undefined} forceGif - true: 强制动图模式(仅对GIF); false: 强制静态模式; undefined: 自动
   * - 非GIF：转为 PNG 写入
   * - GIF + forceGif=true: 仅尝试 Web Custom Format 动图写入，失败回退 PNG
   * - GIF + forceGif=false: 直接转 PNG 静态帧
   * - GIF + forceGif=undefined: 同时写入 web image/gif + image/png（最优兼容）
   * 返回 true 表示成功写入图片，false 表示写入失败
   */
  async function writeImageToClipboard(blob, originalUrl, forceGif) {
    console.log('[表情包搜索] writeImageToClipboard:', blob.type, blob.size, 'bytes, forceGif=', forceGif);

    // 非 GIF：统一转 PNG
    if (blob.type !== 'image/gif') {
      let pngBlob = null;
      try {
        pngBlob = await convertToPng(blob);
      } catch (convertErr) {
        console.warn('[表情包搜索] convertToPng 失败:', convertErr);
      }

      // 必须使用 image/png，ClipboardItem 不支持 image/jpeg 等格式
      const clipboardBlob = pngBlob || blob;
      // 如果 convertToPng 失败且原始 blob 不是 PNG，尝试直接当 PNG 写（某些情况下浏览器会自动处理）
      const mimeType = 'image/png';

      try {
        // 如果是 PNG blob 直接用，否则需要转成 PNG blob
        const writeBlob = (clipboardBlob.type === 'image/png') ? clipboardBlob
          : (pngBlob ? pngBlob : new Blob([clipboardBlob], { type: 'image/png' }));
        await navigator.clipboard.write([
          new ClipboardItem({ [mimeType]: writeBlob })
        ]);
        console.log('[表情包搜索] 非GIF图片写入剪贴板成功');
        showToast('✅ 表情包已复制到剪贴板！');
        return true;
      } catch (clipboardErr) {
        console.warn('[表情包搜索] ClipboardItem PNG 写入失败:', clipboardErr.message || clipboardErr);
        return false;
      }
    }

    // ============ GIF 动图复制策略 ============
    // Chrome 标准 ClipboardItem 仅支持 image/png，不支持 image/gif。
    // Chrome 104+ 提供 Web Custom Formats：加 "web " 前缀可写入任意 MIME 类型。
    // forceGif 参数控制模式：
    //   true  → 仅尝试动图写入（右键"复制 GIF 动图"）
    //   false → 强制静态 PNG（右键"复制图片（静态）"）
    //   undefined → 同时写入 web image/gif + image/png（最优兼容，默认行为）

    // 强制静态模式：直接转 PNG
    if (forceGif === false) {
      let pngBlob = null;
      try {
        pngBlob = await convertToPng(blob);
      } catch (convertErr) {
        console.warn('[表情包搜索] GIF转PNG失败:', convertErr);
      }
      try {
        if (pngBlob) {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': pngBlob })
          ]);
          console.log('[表情包搜索] GIF静态图写入剪贴板成功');
          showToast('✅ 已复制为静态图');
          return true;
        }
      } catch (pngErr) {
        console.warn('[表情包搜索] PNG 静态图写入失败:', pngErr.message || pngErr);
      }
      return false;
    }

    // 准备 PNG 静态帧（作为 fallback 和标准格式并存）
    let pngBlob = null;
    try {
      pngBlob = await convertToPng(blob);
    } catch (convertErr) {
      console.warn('[表情包搜索] GIF转PNG失败:', convertErr);
    }

    // 检测 Web Custom Format 支持
    const webGifSupported = typeof ClipboardItem !== 'undefined' &&
      typeof ClipboardItem.supports === 'function' &&
      ClipboardItem.supports('web image/gif');
    console.log('[表情包搜索] Web Custom Format web image/gif 支持:', webGifSupported);

    // 动图模式（forceGif=true）或自动模式（forceGif=undefined）：尝试 Web Custom Format
    if (webGifSupported) {
      try {
        const items = {};
        items['web image/gif'] = blob;  // GIF 原始数据（含动画帧）

        // 自动模式：同时写入 PNG 静态帧，确保原生应用可粘贴
        if (forceGif !== true && pngBlob) {
          items['image/png'] = pngBlob;
        }

        await navigator.clipboard.write([
          new ClipboardItem(items)
        ]);
        console.log('[表情包搜索] Web Custom Format GIF 写入成功');
        if (forceGif === true) {
          showToast('✅ GIF 动图已复制！粘贴到支持 GIF 的应用可保留动画');
        } else {
          showToast('✅ GIF 动图已复制！Web 端粘贴保留动画，桌面端粘贴为静态图');
        }
        return true;
      } catch (webFmtErr) {
        console.warn('[表情包搜索] Web Custom Format GIF 写入失败:', webFmtErr.message || webFmtErr);
      }
    }

    // 回退 — 尝试标准 image/gif（Chrome 未来可能支持）
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/gif': blob })
      ]);
      console.log('[表情包搜索] 标准 image/gif 写入成功');
      showToast('✅ GIF 动图已复制到剪贴板！');
      return true;
    } catch (gifErr) {
      console.warn('[表情包搜索] 标准 image/gif 写入失败:', gifErr.message || gifErr);
    }

    // 最终回退 — PNG 静态帧
    try {
      if (pngBlob) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': pngBlob })
        ]);
        console.log('[表情包搜索] PNG 回退写入成功');
        showToast('✅ 已复制为静态图（当前浏览器不支持 GIF 动图复制）');
        return true;
      }
    } catch (pngErr) {
      console.warn('[表情包搜索] PNG 回退写入也失败:', pngErr.message || pngErr);
    }

    console.error('[表情包搜索] 所有剪贴板写入方式均失败');
    return false;
  }

  async function copyTextSafely(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      fallbackCopy(text);
    }
  }

  async function proxyFetchBlob(url) {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error('图片下载超时'));
        }, FETCH_TIMEOUT);

        chrome.runtime.sendMessage({ type: 'MEME_FETCH_BLOB', url }, (response) => {
          clearTimeout(timer);
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (response && response.success && response.data) {
            try {
              const { base64, mimeType } = response.data;
              const binaryString = atob(base64);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              const blob = new Blob([bytes], { type: mimeType });
              resolve(blob);
            } catch (e) {
              reject(e);
            }
          } else {
            reject(new Error(response?.error || '代理获取图片失败'));
          }
        });
      });
    }
    throw new Error('Background 不可用');
  }

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
            if (pngBlob) {
              console.log('[表情包搜索] convertToPng 成功:', pngBlob.size, 'bytes');
            } else {
              console.warn('[表情包搜索] canvas.toBlob 返回 null（可能 canvas 被污染）');
            }
            resolve(pngBlob);
          }, 'image/png');
        } catch (canvasErr) {
          URL.revokeObjectURL(blobUrl);
          console.error('[表情包搜索] convertToPng canvas 操作失败:', canvasErr);
          resolve(null);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        console.error('[表情包搜索] convertToPng 图片加载失败, blobUrl:', blob.type, blob.size);
        resolve(null);
      };
      img.src = blobUrl;
    });
  }

  function fallbackCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0;';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      showToast('✅ 已复制: ' + (text.length > 20 ? text.substring(0, 20) + '…' : text));
    } catch (_) {
      showToast('❌ 复制失败，请手动复制');
    }
    document.body.removeChild(textarea);
  }

  // ============ GIF 右键菜单 ============
  let _ctxMenu = null;

  function closeCtxMenu() {
    if (_ctxMenu) {
      _ctxMenu.remove();
      _ctxMenu = null;
    }
  }

  function showGifCtxMenu(x, y, url) {
    closeCtxMenu();
    const menu = document.createElement('div');
    menu.className = 'meme-ctx-menu';

    // 复制 GIF 动图（使用 Web Custom Format 保留动画）
    const itemCopyGif = document.createElement('div');
    itemCopyGif.className = 'meme-ctx-item';
    itemCopyGif.innerHTML = '<span class="meme-ctx-icon">🎬</span><span>复制 GIF 动图</span>';
    itemCopyGif.addEventListener('click', (e) => {
      e.stopPropagation();
      closeCtxMenu();
      copyImageUrl(url, true);  // true = 强制 GIF 动图模式
    });

    // 复制图片（静态 PNG）
    const itemCopyImg = document.createElement('div');
    itemCopyImg.className = 'meme-ctx-item';
    itemCopyImg.innerHTML = '<span class="meme-ctx-icon">🖼️</span><span>复制图片（静态）</span>';
    itemCopyImg.addEventListener('click', (e) => {
      e.stopPropagation();
      closeCtxMenu();
      copyImageUrl(url, false);  // false = 静态图模式
    });

    const divider = document.createElement('div');
    divider.className = 'meme-ctx-divider';

    const itemCopyLink = document.createElement('div');
    itemCopyLink.className = 'meme-ctx-item';
    itemCopyLink.innerHTML = '<span class="meme-ctx-icon">🔗</span><span>复制 GIF 链接</span>';
    itemCopyLink.addEventListener('click', (e) => {
      e.stopPropagation();
      closeCtxMenu();
      copyTextSafely(url).then(() => {
        showToast('🔗 已复制 GIF 链接');
      });
    });

    const itemOpenTab = document.createElement('div');
    itemOpenTab.className = 'meme-ctx-item';
    itemOpenTab.innerHTML = '<span class="meme-ctx-icon">🌐</span><span>新标签页打开</span>';
    itemOpenTab.addEventListener('click', (e) => {
      e.stopPropagation();
      closeCtxMenu();
      window.open(url, '_blank');
    });

    menu.appendChild(itemCopyGif);
    menu.appendChild(itemCopyImg);
    menu.appendChild(divider);
    menu.appendChild(itemCopyLink);
    menu.appendChild(itemOpenTab);

    // 定位：确保不超出视窗
    const menuW = 190, menuH = 195;
    const safeX = Math.min(x, window.innerWidth - menuW - 8);
    const safeY = Math.min(y, window.innerHeight - menuH - 8);
    menu.style.left = safeX + 'px';
    menu.style.top = safeY + 'px';

    document.body.appendChild(menu);
    _ctxMenu = menu;

    // 点击其他位置关闭
    const closeHandler = (e) => {
      if (!menu.contains(e.target)) {
        closeCtxMenu();
        document.removeEventListener('click', closeHandler, true);
        document.removeEventListener('contextmenu', closeCtxMenuHandler, true);
      }
    };
    const closeCtxMenuHandler = (e) => {
      closeCtxMenu();
      document.removeEventListener('click', closeHandler, true);
      document.removeEventListener('contextmenu', closeCtxMenuHandler, true);
    };
    setTimeout(() => {
      document.addEventListener('click', closeHandler, true);
      document.addEventListener('contextmenu', closeCtxMenuHandler, true);
    }, 10);
  }

  function insertToActiveInput(text) {
    if (!activeInput) return;
    activeInput.focus();
    if (activeInput.isContentEditable) {
      document.execCommand('insertText', false, text);
    } else {
      const start = activeInput.selectionStart;
      const end = activeInput.selectionEnd;
      const value = activeInput.value;
      activeInput.value = value.substring(0, start) + text + value.substring(end);
      activeInput.selectionStart = activeInput.selectionEnd = start + text.length;
      activeInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  function showToast(msg) {
    let toast = document.querySelector('.meme-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'meme-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2000);
  }

  // ============ 初始化 ============
  async function init() {
    injectStyles();

    // 加载自定义 API 配置
    await loadCustomApis();

    // 加载按钮注入配置
    await loadInjectConfig();

    // 加载收藏数据
    await loadFavorites();

    setTimeout(() => {
      addTriggerButtons();
      updateFloatBtn();
    }, 1000);

    let scrollTimer;
    window.addEventListener('scroll', () => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(updateButtonPositions, 100);
    }, true);
    window.addEventListener('resize', () => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(updateButtonPositions, 100);
    });

    const observer = new MutationObserver(() => {
      clearTimeout(observer._timer);
      observer._timer = setTimeout(addTriggerButtons, 500);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closePopup();
      }
    });

    document.addEventListener('wheel', preventScrollThrough, { passive: false });
    document.addEventListener('touchmove', preventTouchThrough, { passive: false });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}
