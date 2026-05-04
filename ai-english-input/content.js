(function initializeContentScript() {
  const MESSAGE_TIMEOUT_MS = 20000;
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
  let activeInputElement = null;
  let activeOriginalText = '';

  /**
   * 创建带后端错误详情的异常，方便 UI 展示精确状态。
   *
   * @param {object} response - 扩展后台返回的响应。
   * @returns {Error & {code?: string, limit?: number, remaining?: number, maxLength?: number}} 请求异常。
   */
  function createTranslationError(response) {
    const error = new Error(response?.error || 'translate_failed');
    error.code = response?.error || 'translate_failed';
    error.limit = response?.limit;
    error.remaining = response?.remaining;
    error.maxLength = response?.maxLength;
    return error;
  }

  /**
   * 通过扩展后台请求后端翻译接口，避免页面环境影响跨域请求。
   *
   * @param {object} params - 请求参数。
   * @param {string} params.text - 用户输入的中文原文。
   * @param {string} params.scene - 当前场景。
   * @param {string} params.tone - 当前语气。
   * @param {string} params.userId - 匿名用户 ID。
   * @returns {Promise<{candidates: Array<{label: string, text: string}>, remaining: number}>} 翻译结果。
   */
  async function requestTranslation({ text, scene, tone, userId }) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(createTranslationError({ error: 'request_timeout' }));
      }, MESSAGE_TIMEOUT_MS);

      chrome.runtime.sendMessage(
        {
          type: 'AEI_TRANSLATE',
          payload: {
            text,
            scene,
            tone,
            userId,
          },
        },
        (response) => {
          clearTimeout(timeoutId);

          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          if (!response?.ok) {
            reject(createTranslationError(response));
            return;
          }

          resolve(response.payload);
        },
      );
    });
  }

  /**
   * 开始请求前先展示加载态，后续如果设置读取失败也能在浮层里显示错误。
   *
   * @param {Element} inputElement - 当前输入框。
   * @param {object} settings - 用户设置。
   * @returns {void}
   */
  function showLoadingWithSettings(inputElement, settings) {
    AEIOverlay.showLoadingOverlay(inputElement, {
      sceneLabel: SCENE_LABELS[settings.scene] || settings.scene,
      toneLabel: TONE_LABELS[settings.tone] || settings.tone,
    });
  }

  /**
   * 处理触发后的翻译流程。
   *
   * @param {object} payload - 触发信息。
   * @param {Element} payload.inputElement - 当前输入框。
   * @param {string} payload.originalText - 原始中文内容。
   * @param {string} payload.triggerType - 触发方式。
   * @returns {Promise<void>}
   */
  async function handleTranslationTrigger({ inputElement, originalText, triggerType }) {
    console.debug('AI English Input translation triggered', {
      triggerType,
      originalText,
    });

    try {
      activeInputElement = inputElement;
      activeOriginalText = originalText;
      AEIOverlay.showLoadingOverlay(inputElement);
      const [settings, userId] = await Promise.all([
        AEIStorage.getSettings(),
        AEIStorage.getUserId(),
      ]);

      showLoadingWithSettings(inputElement, settings);

      const result = await requestTranslation({
        text: originalText,
        scene: settings.scene,
        tone: settings.tone,
        userId,
      });

      AEIOverlay.showCandidates(result.candidates);
      AEIStorage.saveSettings({ remaining: result.remaining }).catch((error) => {
        console.warn('AI English Input failed to save remaining usage', error);
      });
    } catch (error) {
      console.error('AI English Input translation failed', error);

      if (error.code === 'daily_limit_exceeded') {
        AEIOverlay.showLimitExceeded({ limit: error.limit });
        AEIStorage.saveSettings({ remaining: 0 }).catch((storageError) => {
          console.warn('AI English Input failed to save remaining usage', storageError);
        });
        return;
      }

      if (error.code === 'text_too_long') {
        AEIOverlay.showError(`当前输入内容太长，请控制在 ${error.maxLength || 100} 字以内。你可以分多次生成。`);
        return;
      }

      AEIOverlay.showError('翻译失败，请稍后重试。原中文内容已保留在输入框内。');
    }
  }

  /**
   * 选择候选并写回输入框。
   *
   * @param {number} index - 候选索引。
   * @returns {void}
   */
  function selectCandidate(index) {
    const candidate = AEIOverlay.getCandidate(index);

    if (!candidate || !activeInputElement) {
      return;
    }

    AEIInputAdapter.writeText(activeInputElement, candidate.text);
    AEIOverlay.removeOverlay();
    activeInputElement = null;
    activeOriginalText = '';
  }

  /**
   * 取消候选框并恢复触发前的中文原文。
   *
   * @returns {void}
   */
  function cancelTranslation() {
    if (activeInputElement && activeOriginalText) {
      AEIInputAdapter.writeText(activeInputElement, activeOriginalText);
    }

    AEIOverlay.removeOverlay();
    activeInputElement = null;
    activeOriginalText = '';
  }

  const triggerController = AEITrigger.createTriggerController({
    onTrigger(payload) {
      handleTranslationTrigger(payload);
    },
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelTranslation();
      return;
    }

    if (['1', '2', '3'].includes(event.key)) {
      const candidate = AEIOverlay.getCandidate(Number(event.key) - 1);

      if (candidate) {
        event.preventDefault();
        selectCandidate(Number(event.key) - 1);
      }
    }
  }, true);

  document.addEventListener('click', (event) => {
    const item = event.target.closest?.('.aei-item[data-index]');

    if (!item) {
      return;
    }

    event.preventDefault();
    selectCandidate(Number(item.dataset.index));
  }, true);

  triggerController.start();
  globalThis.AEIContent = {
    cancelTranslation,
    selectCandidate,
    triggerController,
  };
})();
