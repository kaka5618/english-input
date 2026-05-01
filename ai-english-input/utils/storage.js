(function attachStorageUtils(globalScope) {
  const USER_ID_KEY = 'user_id';
  const SETTINGS_KEY = 'settings';
  const DEFAULT_SETTINGS = {
    inputLanguage: '中文',
    outputLanguage: 'English',
    scene: 'cross_border_cs',
    tone: 'polite',
    remaining: 15,
  };

  /**
   * 读取 chrome.storage.local 中的单个 key。
   *
   * @param {string} key - 存储 key。
   * @returns {Promise<unknown>} 对应的存储值。
   */
  async function getLocalValue(key) {
    const result = await chrome.storage.local.get(key);
    return result[key];
  }

  /**
   * 获取或创建匿名用户 UUID，用于后端免费额度识别。
   *
   * @returns {Promise<string>} 匿名用户 ID。
   */
  async function getUserId() {
    const existingUserId = await getLocalValue(USER_ID_KEY);

    if (existingUserId) {
      return existingUserId;
    }

    const userId = crypto.randomUUID();
    await chrome.storage.local.set({ [USER_ID_KEY]: userId });
    return userId;
  }

  /**
   * 读取用户设置，并补齐默认值。
   *
   * @returns {Promise<typeof DEFAULT_SETTINGS>} 用户设置。
   */
  async function getSettings() {
    const settings = await getLocalValue(SETTINGS_KEY);
    return {
      ...DEFAULT_SETTINGS,
      ...(settings || {}),
    };
  }

  /**
   * 合并保存用户设置。
   *
   * @param {Partial<typeof DEFAULT_SETTINGS>} nextSettings - 待更新设置。
   * @returns {Promise<typeof DEFAULT_SETTINGS>} 保存后的完整设置。
   */
  async function saveSettings(nextSettings) {
    const currentSettings = await getSettings();
    const settings = {
      ...currentSettings,
      ...nextSettings,
    };

    await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
    return settings;
  }

  globalScope.AEIStorage = {
    getUserId,
    getSettings,
    saveSettings,
  };
})(globalThis);
