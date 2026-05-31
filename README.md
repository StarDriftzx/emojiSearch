# emojiSearch 🔍

检索网络表情包的 Chrome 插件——百度+搜狗免费免注册开箱即用，支持 Emoji 表情、自定义 API 接口、收藏功能、GIF 动图复制，一键复制到剪贴板。

## 功能特性

- 🔎 **多源搜索** — 百度表情包 + 搜狗表情包，免费免注册，开箱即用
- 😀 **Emoji 支持** — 内置 Emoji 表情搜索与复制
- ⚙️ **自定义 API** — 支持接入自定义表情包 API 接口
- ⭐ **收藏功能** — 收藏常用表情包，快速访问
- 📋 **一键复制** — 支持 GIF 动图复制到剪贴板
- 🎯 **任意网页使用** — 通过 popup 或内容脚本在任意网页上快速搜索

## 安装方式

1. 下载本项目代码
2. 打开 Chrome，进入 `chrome://extensions/`
3. 开启右上角「开发者模式」
4. 点击「加载已解压的扩展程序」，选择本项目根目录

## 项目结构

```
emojiSearch/
├── manifest.json        # 插件配置 (Manifest V3)
├── background.js        # Service Worker 后台脚本
├── content.js           # 内容脚本（页面注入）
├── content.css          # 内容样式
├── popup.html           # 弹窗页面
├── offscreen.html       # 离屏页面（GIF 复制）
├── offscreen.js         # 离屏脚本
└── icons/               # 插件图标
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## License

MIT
