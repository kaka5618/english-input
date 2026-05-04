const SCENE_LABELS = {
  cross_border_cs: '跨境客服',
  foreign_trade_email: '外贸邮件',
  social_media: '社媒互动',
  general: '通用翻译',
};

const TONE_LABELS = {
  polite: '礼貌自然',
  concise: '简洁直接',
  formal: '正式专业',
  apology: '安抚道歉',
};

/**
 * 根据 ID 更新单个文本节点。
 *
 * @param {string} id - DOM 元素 ID。
 * @param {string} text - 展示文本。
 * @returns {void}
 */
function setText(id, text) {
  const element = document.getElementById(id);

  if (element) {
    element.textContent = text;
  }
}

/**
 * 设置下拉框当前值。
 *
 * @param {string} id - select 元素 ID。
 * @param {string} value - 当前设置值。
 * @returns {void}
 */
function setSelectValue(id, value) {
  const element = document.getElementById(id);

  if (element) {
    element.value = value;
  }
}

/**
 * 更新今日剩余额度展示。
 *
 * @param {number} remaining - 本地缓存中的今日剩余次数。
 * @returns {void}
 */
function setRemaining(remaining) {
  const element = document.getElementById('remaining');
  const count = Number.isInteger(remaining) ? remaining : 15;

  if (!element) {
    return;
  }

  element.textContent = count > 0 ? `${count} 次` : '已用完';
  element.classList.toggle('usage-count--empty', count <= 0);
}

/**
 * 根据设置刷新 Popup 状态展示。
 *
 * @param {object} settings - 用户设置。
 * @param {string} settings.inputLanguage - 输入语言。
 * @param {string} settings.outputLanguage - 输出语言。
 * @param {string} settings.scene - 当前场景。
 * @param {string} settings.tone - 当前语气。
 * @param {number} settings.remaining - 今日剩余次数。
 * @returns {void}
 */
function renderSettings(settings) {
  setText('input-language', settings.inputLanguage);
  setText('output-language', settings.outputLanguage);
  setText('scene', SCENE_LABELS[settings.scene] || settings.scene);
  setText('tone', TONE_LABELS[settings.tone] || settings.tone);
  setRemaining(settings.remaining);
  setSelectValue('scene-select', settings.scene);
  setSelectValue('tone-select', settings.tone);
}

/**
 * 绑定场景和语气切换事件，保存后立即刷新状态展示。
 *
 * @returns {void}
 */
function bindSettingControls() {
  const sceneSelect = document.getElementById('scene-select');
  const toneSelect = document.getElementById('tone-select');

  sceneSelect?.addEventListener('change', async (event) => {
    const settings = await AEIStorage.saveSettings({ scene: event.target.value });
    renderSettings(settings);
  });

  toneSelect?.addEventListener('change', async (event) => {
    const settings = await AEIStorage.saveSettings({ tone: event.target.value });
    renderSettings(settings);
  });
}

/**
 * 绑定本期尚未实现的底部入口，避免点击后出现空白页。
 *
 * @returns {void}
 */
function bindFooterLinks() {
  const footerMessage = document.getElementById('footer-message');

  document.querySelectorAll('[data-placeholder-link]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();

      if (footerMessage) {
        footerMessage.textContent = '查看历史功能将在后续版本开放。';
      }
    });
  });
}

/**
 * 初始化 Popup 状态展示。
 *
 * @returns {Promise<void>}
 */
async function initializePopup() {
  const [userId, settings] = await Promise.all([
    AEIStorage.getUserId(),
    AEIStorage.getSettings(),
  ]);

  renderSettings(settings);
  setText('user-id', `用户 ID：${userId}`);
  bindSettingControls();
  bindFooterLinks();
}

initializePopup().catch((error) => {
  console.error('failed_to_initialize_popup', error);
  setText('user-id', '初始化失败，请重新打开插件面板');
});
