(function attachTriggerUtils(globalScope) {
  const TRIGGER_SPACE_COUNT = 3;
  const TRIGGER_WINDOW_MS = 800;

  /**
   * 判断元素是否是插件当前支持读取的输入区域。
   *
   * @param {Element | null} element - 当前聚焦元素。
   * @returns {boolean} 是否可作为输入区域。
   */
  function isSupportedInput(element) {
    if (!element) {
      return false;
    }

    const tagName = element.tagName;
    return tagName === 'TEXTAREA' || tagName === 'INPUT' || element.isContentEditable;
  }

  /**
   * 读取输入区域中的文本内容。
   *
   * @param {HTMLInputElement | HTMLTextAreaElement | HTMLElement} element - 输入区域。
   * @returns {string} 当前输入文本。
   */
  function readInputText(element) {
    if ('value' in element) {
      return element.value;
    }

    return element.innerText || element.textContent || '';
  }

  /**
   * 判断文本是否包含中文字符。
   *
   * @param {string} text - 待检测文本。
   * @returns {boolean} 是否包含中文。
   */
  function containsChinese(text) {
    return /[\u3400-\u9fff]/.test(text);
  }

  /**
   * 创建触发控制器，负责三次空格和快捷键检测。
   *
   * @param {object} options - 触发配置。
   * @param {(payload: {inputElement: Element, originalText: string, triggerType: string}) => void} options.onTrigger - 触发回调。
   * @returns {{start: () => void, stop: () => void, getOriginalText: () => string}} 控制器。
   */
  function createTriggerController({ onTrigger }) {
    let spaceCount = 0;
    let spaceTimer = null;
    let originalText = '';
    let isStarted = false;

    /**
     * 重置连续空格计数。
     *
     * @returns {void}
     */
    function resetSpaceCount() {
      spaceCount = 0;
      clearTimeout(spaceTimer);
      spaceTimer = null;
    }

    /**
     * 读取当前输入框并在包含中文时触发后续流程。
     *
     * @param {KeyboardEvent} event - 键盘事件。
     * @param {string} triggerType - 触发方式。
     * @returns {void}
     */
    function triggerTranslation(event, triggerType) {
      const inputElement = document.activeElement;

      if (!isSupportedInput(inputElement)) {
        return;
      }

      const text = readInputText(inputElement).trim();

      if (!text || !containsChinese(text)) {
        return;
      }

      event.preventDefault();
      originalText = text;
      onTrigger({
        inputElement,
        originalText,
        triggerType,
      });
    }

    /**
     * 处理键盘事件。
     *
     * @param {KeyboardEvent} event - 键盘事件。
     * @returns {void}
     */
    function handleKeydown(event) {
      if (event.isComposing) {
        return;
      }

      const key = event.key.toLowerCase();

      if (event.ctrlKey && event.shiftKey && key === 'e') {
        resetSpaceCount();
        triggerTranslation(event, 'shortcut');
        return;
      }

      if (event.key !== ' ') {
        resetSpaceCount();
        return;
      }

      if (!isSupportedInput(document.activeElement)) {
        resetSpaceCount();
        return;
      }

      spaceCount += 1;
      clearTimeout(spaceTimer);
      spaceTimer = setTimeout(resetSpaceCount, TRIGGER_WINDOW_MS);

      if (spaceCount >= TRIGGER_SPACE_COUNT) {
        resetSpaceCount();
        triggerTranslation(event, 'triple_space');
      }
    }

    return {
      start() {
        if (isStarted) {
          return;
        }

        document.addEventListener('keydown', handleKeydown, true);
        isStarted = true;
      },
      stop() {
        document.removeEventListener('keydown', handleKeydown, true);
        resetSpaceCount();
        isStarted = false;
      },
      getOriginalText() {
        return originalText;
      },
    };
  }

  globalScope.AEITrigger = {
    createTriggerController,
    containsChinese,
    isSupportedInput,
    readInputText,
  };
})(globalThis);
