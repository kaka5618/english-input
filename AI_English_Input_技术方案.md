# AI English Input — 技术方案文档

> 版本：v0.1 草稿  
> 状态：讨论中  
> 更新日期：2026-05-01

---

## 一、整体架构

MVP 第一版聚焦 WhatsApp Web、Gmail 和通用输入框兜底能力。插件免费版只读取当前聚焦输入框内的用户输入文本，不自动读取聊天记录、邮件正文或页面上下文；上下文辅助回复作为后续 Pro 功能单独设计。

```
┌─────────────────────────────────────┐
│           Chrome 插件（前端）         │
│                                     │
│  content.js   popup.js   storage    │
│  （注入页面） （面板UI） （本地缓存）  │
└──────────────┬──────────────────────┘
               │ HTTPS POST
               ▼
┌─────────────────────────────────────┐
│            自建后端服务               │
│                                     │
│  路由层 → 额度校验 → Prompt 组装      │
│               │                     │
│           调用 GPT API               │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│         OpenAI GPT-4o mini          │
└─────────────────────────────────────┘
```

---

## 二、Chrome 插件技术栈

| 项目 | 选型 | 说明 |
|---|---|---|
| Manifest 版本 | **V3** | Chrome 现行标准，兼容性好 |
| 开发语言 | **Vanilla JS** | 无需打包工具，Cursor 友好，结构清晰 |
| 样式 | **原生 CSS** | 候选框 UI 足够简单，不引入框架 |
| 本地存储 | **chrome.storage.local** | 存 UUID、用量计数、用户设置 |
| 构建工具 | **无**（直接加载） | 开发阶段直接 Load unpacked，无需 webpack |

### 插件文件结构

```
ai-english-input/
├── manifest.json          # 插件配置，权限声明
├── content.js             # 注入所有页面，监听输入框
├── content.css            # 候选框样式
├── popup.html             # 点击图标弹出的面板
├── popup.js               # 面板逻辑
├── background.js          # Service Worker，处理跨页通信
├── utils/
│   ├── trigger.js         # 三次空格 / 快捷键检测
│   ├── input-adapter.js   # 不同输入框类型适配（textarea / contenteditable）
│   ├── overlay.js         # 候选框 DOM 创建与定位
│   └── storage.js         # chrome.storage 读写封装
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### manifest.json 关键权限

```json
{
  "manifest_version": 3,
  "name": "AI English Input",
  "permissions": [
    "storage",
    "activeTab"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "css": ["content.css"],
      "run_at": "document_idle"
    }
  ],
  "background": {
    "service_worker": "background.js"
  },
  "action": {
    "default_popup": "popup.html"
  }
}
```

---

## 三、输入框适配方案

不同平台输入框结构不同，需分类处理：

| 输入框类型 | 平台举例 | 读取内容方式 | 写入内容方式 |
|---|---|---|---|
| `<textarea>` | 通用网页表单 | `element.value` | `element.value = text` + 触发 `input` 事件 |
| `contenteditable div` | WhatsApp Web、通用可编辑输入框 | `element.innerText` | 优先使用 Selection / Range 替换当前输入内容，并触发 `input` 事件 |
| 富文本编辑器 | Gmail | 定位当前编辑区内的可编辑节点 | 使用 Gmail 专用适配器写入，保留草稿状态和光标 |

### MVP 适配优先级

| 优先级 | 平台 / 类型 | 策略 |
|---|---|---|
| P0 | WhatsApp Web | 单独适配 contenteditable 输入框，验证读取、替换、光标停留、不自动发送 |
| P0 | Gmail | 单独适配富文本编辑器，验证写入、换行、草稿保存 |
| P0 | 通用 textarea | 标准表单兜底 |
| P1 | 通用 contenteditable | 尽量兼容，不承诺逐站稳定 |
| P2 | Outlook、Twitter/X、Facebook Messenger、LinkedIn | 后续按平台单独适配 |

### input-adapter.js 核心逻辑

```javascript
function getInputType(el) {
  if (el.tagName === 'TEXTAREA') return 'textarea';
  if (el.isContentEditable) return 'contenteditable';
  return 'unknown';
}

function readText(el) {
  const type = getInputType(el);
  if (type === 'textarea') return el.value;
  if (type === 'contenteditable') return el.innerText;
}

function writeText(el, text) {
  const type = getInputType(el);
  if (type === 'textarea') {
    el.value = text;
  } else if (type === 'contenteditable') {
    el.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand('insertText', false, text);
  }
  // 触发网页原生事件，防止某些平台检测不到变化
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}
```

> 注意：`document.execCommand('insertText')` 虽然较旧，但在 contenteditable 适配中仍比直接设置 `innerText` 更接近真实用户输入。WhatsApp Web 和 Gmail 需要在此基础上做平台级回归测试，必要时增加专用 adapter。

---

## 四、触发检测逻辑

### 三次空格触发

```javascript
// trigger.js
let spaceCount = 0;
let spaceTimer = null;

document.addEventListener('keydown', (e) => {
  if (e.key === ' ') {
    spaceCount++;
    clearTimeout(spaceTimer);
    spaceTimer = setTimeout(() => { spaceCount = 0; }, 800); // 800ms内连按才算
    if (spaceCount >= 3) {
      spaceCount = 0;
      triggerTranslation(); // 触发翻译
    }
  } else {
    spaceCount = 0; // 按了其他键重置
  }
});
```

### Ctrl + Shift + E 触发

```javascript
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && e.key === 'E') {
    e.preventDefault();
    triggerTranslation();
  }
});
```

### 候选框键盘操作

```javascript
document.addEventListener('keydown', (e) => {
  if (!overlayVisible) return;
  if (['1', '2', '3'].includes(e.key)) {
    selectCandidate(parseInt(e.key) - 1);
  }
  if (e.key === 'Escape') {
    closeOverlay(); // 恢复原始中文
  }
});
```

---

## 五、候选框 UI 实现

候选框为动态创建的 DOM 浮层，插入到 `document.body`，通过绝对定位跟随输入框。

### 定位计算

```javascript
function positionOverlay(inputEl, overlayEl) {
  const rect = inputEl.getBoundingClientRect();
  let top = rect.bottom + window.scrollY + 6;
  let left = rect.left + window.scrollX;

  // 防止超出视口底部
  if (top + overlayEl.offsetHeight > window.innerHeight + window.scrollY) {
    top = rect.top + window.scrollY - overlayEl.offsetHeight - 6;
  }

  overlayEl.style.top = `${top}px`;
  overlayEl.style.left = `${left}px`;
  overlayEl.style.width = `${Math.max(rect.width, 480)}px`;
}
```

### 候选框 HTML 结构

```html
<div id="aei-overlay">
  <div class="aei-header">
    <span>中文 → English</span>
    <span class="aei-scene">场景：跨境客服</span>
    <span class="aei-tone">语气：礼貌自然</span>
  </div>
  <div class="aei-loading">AI 生成中...</div>  <!-- 加载状态 -->
  <div class="aei-candidates">
    <div class="aei-item" data-index="0">
      <span class="aei-num">1</span>
      <span class="aei-label">礼貌客服</span>
      <span class="aei-text">We're sorry for the delay...</span>
    </div>
    <div class="aei-item" data-index="1">...</div>
    <div class="aei-item" data-index="2">...</div>
  </div>
</div>
```

---

## 六、后端技术栈

| 项目 | 选型 | 说明 |
|---|---|---|
| 运行时 | **Node.js** | 生态成熟，适合快速开发 |
| 框架 | **Express.js** | 轻量，够用，Cursor 代码生成质量好 |
| 部署平台 | **Railway / Render** | 免配置，免费额度可跑 MVP，支持一键部署 |
| 数据库 | **Redis** | 存每日用量计数，自动过期，性能好 |
| 环境变量 | `.env` 文件 | 存 OpenAI API Key，不提交到代码仓库 |

MVP 接口只接收当前输入框文本，不接收自动抓取的页面上下文。后续 Pro 版本如果加入上下文能力，应单独增加授权说明、请求字段和隐私策略。

### 后端文件结构

```
backend/
├── index.js              # 入口，Express 启动
├── routes/
│   └── translate.js      # POST /api/translate 接口
├── middleware/
│   ├── rateLimit.js      # 每日额度校验
│   └── validate.js       # 请求参数校验
├── services/
│   ├── openai.js         # 调用 GPT-4o mini 封装
│   └── prompt.js         # 根据场景/语气组装 Prompt
├── utils/
│   └── redis.js          # Redis 读写封装
└── .env                  # OPENAI_API_KEY=sk-xxx
```

---

## 七、核心 API 接口

### POST `/api/translate`

**请求体**

```json
{
  "text": "很抱歉，物流因为天气原因可能会延迟两天",
  "scene": "cross_border_cs",
  "tone": "polite",
  "user_id": "uuid-xxxx-xxxx"
}
```

> 免费版请求参数不包含聊天记录、邮件正文、客户上一句话等上下文内容。

**响应体（成功）**

```json
{
  "candidates": [
    { "label": "礼貌客服", "text": "We're sorry for the delay. The shipment may be delayed by about two days due to weather conditions, and we'll continue to follow up on it for you." },
    { "label": "简洁直接", "text": "Sorry for the delay. Your order may arrive two days later due to the weather. We'll keep tracking it." },
    { "label": "更正式",   "text": "We sincerely apologize for the inconvenience. Due to weather conditions, your shipment may be delayed by approximately two days." }
  ],
  "remaining": 12
}
```

MVP 阶段接受匿名 UUID 被卸载重装绕过的风险，但后端应预留 IP 频控和异常流量限制。进入公开内测或商店发布前，建议增加按 IP / UA 的短周期限流，避免接口被集中刷量。

**响应体（超额）**

```json
{
  "error": "daily_limit_exceeded",
  "remaining": 0
}
```

---

## 八、Prompt 设计

每次请求发送给 GPT-4o mini 的 Prompt 结构如下：

**System Prompt（固定，约 200 tokens）**

```
You are a professional English writing assistant specialized in cross-border e-commerce communication.

Your task: Translate the user's Chinese input into 3 English versions with different tones.
Return ONLY a JSON array, no explanation, no markdown.

Format:
[
  {"label": "礼貌客服", "text": "..."},
  {"label": "简洁直接", "text": "..."},
  {"label": "更正式",   "text": "..."}
]

Scene: {scene}
Tone preference: {tone}
Rules:
- Each version must be clearly different in style
- Keep it natural, avoid robotic phrasing
- Do not add extra explanation outside the JSON
```

**User Prompt（动态）**

```
{用户输入的中文原文}
```

---

## 九、额度控制方案

使用 Redis 对每个 `user_id` 按自然日计数：

```javascript
// rateLimit.js
const FREE_LIMIT = 15;

async function checkAndIncrement(userId) {
  const today = new Date().toISOString().slice(0, 10); // "2026-05-01"
  const key = `usage:${userId}:${today}`;

  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, 86400); // 24小时后自动清除
  }

  if (count > FREE_LIMIT) {
    return { allowed: false, remaining: 0 };
  }
  return { allowed: true, remaining: FREE_LIMIT - count };
}
```

---

## 十、用户身份（UUID）

插件安装后首次运行时在本地生成匿名 UUID，持久化存入 `chrome.storage.local`，每次请求携带此 ID 用于服务端额度识别。

```javascript
// storage.js
async function getUserId() {
  const result = await chrome.storage.local.get('user_id');
  if (result.user_id) return result.user_id;

  const uuid = crypto.randomUUID();
  await chrome.storage.local.set({ user_id: uuid });
  return uuid;
}
```

> ⚠️ 注意：UUID 存在本地，用户卸载插件重装后会生成新 UUID，免费额度随之重置。这是 MVP 阶段的已知取舍，后期接入账号系统后解决。

---

## 十一、数据流完整时序

```
用户输入中文，连按3次空格
        │
        ▼
content.js 检测触发
        │ 读取输入框内容 + 暂存原文
        ▼
显示候选框（loading 状态）
        │
        ▼
background.js 发起 HTTPS POST → 后端 /api/translate
        │   携带: text / scene / tone / user_id
        ▼
后端 middleware: 校验参数 → 检查 Redis 额度
        │
        ├─ 超额 → 返回 error: daily_limit_exceeded
        │
        └─ 通过 → 组装 Prompt → 调用 GPT-4o mini
                        │
                        ▼
                  GPT 返回 JSON 数组（3条候选）
                        │
                        ▼
              后端解析 → 返回 candidates + remaining
                        │
        ◄───────────────┘
content.js 接收结果
        │
        ▼
候选框展示 3 条候选句
        │
用户按 1 / 2 / 3 或鼠标点击
        │
        ▼
英文填入输入框，候选框关闭
        │
用户自行按 Enter 发送
```

---

## 十二、安全注意事项

| 风险 | 处理方式 |
|---|---|
| API Key 泄露 | Key 仅存后端 `.env`，插件侧不持有 |
| 恶意刷接口 | Redis 额度限制 + 公开发布前增加 IP / UA 频率限制 |
| XSS 注入 | 候选框写入 DOM 时用 `textContent` 而非 `innerHTML` |
| 用户输入过长 | 后端校验 `text` 长度上限（建议 500 字符） |
| HTTPS | 后端部署强制 HTTPS，Railway/Render 默认支持 |
| 输入框适配失效 | WhatsApp Web、Gmail 建立固定回归测试清单，DOM 变化后优先修复 |
| 权限和隐私质疑 | Chrome 商店说明中明确插件仅在用户触发时读取当前输入框内容 |
| AI 响应超时 | 插件端设置超时、失败提示和保留原文，避免用户输入丢失 |
