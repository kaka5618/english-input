const SCENE_LABELS = {
  cross_border_cs: '跨境客服',
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
 * 初始化 Popup 状态展示。
 *
 * @returns {Promise<void>}
 */
async function initializePopup() {
  const [userId, settings] = await Promise.all([
    AEIStorage.getUserId(),
    AEIStorage.getSettings(),
  ]);

  setText('input-language', settings.inputLanguage);
  setText('output-language', settings.outputLanguage);
  setText('scene', SCENE_LABELS[settings.scene] || settings.scene);
  setText('tone', TONE_LABELS[settings.tone] || settings.tone);
  setText('user-id', `用户 ID：${userId}`);
}

initializePopup().catch((error) => {
  console.error('failed_to_initialize_popup', error);
  setText('user-id', '初始化失败，请重新打开插件面板');
});
