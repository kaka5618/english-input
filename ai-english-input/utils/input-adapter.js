(function attachInputAdapter(globalScope) {
  /**
   * 判断当前页面是否是 WhatsApp Web。
   *
   * @returns {boolean} 是否是 WhatsApp Web。
   */
  function isWhatsAppWeb() {
    return location.hostname === 'web.whatsapp.com';
  }

  /**
   * 判断当前页面是否是 Reddit。
   *
   * @returns {boolean} 是否是 Reddit。
   */
  function isReddit() {
    return /(^|\.)reddit\.com$/.test(location.hostname);
  }

  /**
   * 判断当前页面是否是 Gmail。
   *
   * @returns {boolean} 是否是 Gmail。
   */
  function isGmail() {
    return location.hostname === 'mail.google.com';
  }

  /**
   * 判断元素是否像 WhatsApp Web 的消息输入框。
   *
   * @param {Element} element - 待检测元素。
   * @returns {boolean} 是否为 WhatsApp 输入框。
   */
  function isWhatsAppInput(element) {
    if (!element || !element.isContentEditable || !isWhatsAppWeb()) {
      return false;
    }

    return Boolean(
      element.closest('[role="textbox"]')
        || element.getAttribute('role') === 'textbox'
        || element.getAttribute('aria-label')
        || element.dataset.lexicalEditor === 'true',
    );
  }

  /**
   * 判断元素是否像 Reddit 的评论、发帖或聊天输入框。
   *
   * @param {Element} element - 待检测元素。
   * @returns {boolean} 是否为 Reddit 输入框。
   */
  function isRedditInput(element) {
    if (!element || !isReddit()) {
      return false;
    }

    const role = element.getAttribute('role');
    const ariaLabel = (element.getAttribute('aria-label') || '').toLowerCase();
    const placeholder = (element.getAttribute('placeholder') || '').toLowerCase();

    return Boolean(
      element.tagName === 'TEXTAREA'
        || element.isContentEditable
        || role === 'textbox'
        || ariaLabel.includes('comment')
        || ariaLabel.includes('reply')
        || ariaLabel.includes('post')
        || placeholder.includes('comment')
        || placeholder.includes('reply')
        || placeholder.includes('post')
        || element.closest('[data-testid*="comment"]')
        || element.closest('[data-testid*="post"]')
        || element.closest('shreddit-composer')
        || element.closest('reddit-composer'),
    );
  }

  /**
   * 判断元素是否像 Gmail 撰写窗口的正文编辑区。
   *
   * @param {Element} element - 待检测元素。
   * @returns {boolean} 是否为 Gmail 正文编辑区。
   */
  function isGmailEditor(element) {
    if (!element || !element.isContentEditable || !isGmail()) {
      return false;
    }

    const role = element.getAttribute('role');
    const ariaLabel = (element.getAttribute('aria-label') || '').toLowerCase();
    const isSignature = Boolean(element.closest('.gmail_signature'));

    return Boolean(
      !isSignature
        && role === 'textbox'
        && (
          element.getAttribute('g_editable') === 'true'
          || element.classList.contains('editable')
          || ariaLabel.includes('message body')
          || ariaLabel.includes('邮件正文')
        ),
    );
  }

  /**
   * 判断元素是否是插件支持的输入框。
   *
   * @param {Element | null} element - 待检测元素。
   * @returns {boolean} 是否支持读取和写入。
   */
  function isSupportedInput(element) {
    if (!element) {
      return false;
    }

    if (isGmail()) {
      return isGmailEditor(element);
    }

    const tagName = element.tagName;
    return tagName === 'TEXTAREA' || tagName === 'INPUT' || element.isContentEditable;
  }

  /**
   * 读取当前输入框文本。
   *
   * @param {HTMLInputElement | HTMLTextAreaElement | HTMLElement} element - 输入框。
   * @returns {string} 当前文本。
   */
  function readText(element) {
    if ('value' in element) {
      return element.value;
    }

    return element.innerText || element.textContent || '';
  }

  /**
   * 触发输入事件，让网页框架感知内容变化。
   *
   * @param {Element} element - 输入元素。
   * @returns {void}
   */
  function dispatchInputEvents(element) {
    element.dispatchEvent(new InputEvent('beforeinput', {
      bubbles: true,
      cancelable: true,
      data: null,
      inputType: 'insertText',
    }));
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /**
   * 写入普通 input / textarea。
   *
   * @param {HTMLInputElement | HTMLTextAreaElement} element - 输入元素。
   * @param {string} text - 待写入文本。
   * @returns {void}
   */
  function writeValueInput(element, text) {
    element.focus();
    element.value = text;

    if (typeof element.setSelectionRange === 'function') {
      element.setSelectionRange(text.length, text.length);
    }

    dispatchInputEvents(element);
  }

  /**
   * 写入 contenteditable 输入框，尽量模拟用户输入。
   *
   * @param {HTMLElement} element - 可编辑元素。
   * @param {string} text - 待写入文本。
   * @returns {void}
   */
  function writeContentEditable(element, text) {
    element.focus();

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(element);
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand('insertText', false, text);
    dispatchInputEvents(element);
  }

  /**
   * 写入 Gmail 富文本正文编辑区，保留撰写窗口和草稿状态。
   *
   * @param {HTMLElement} element - Gmail 正文编辑区。
   * @param {string} text - 待写入文本。
   * @returns {void}
   */
  function writeGmailEditor(element, text) {
    writeContentEditable(element, text);
  }

  /**
   * 写入 WhatsApp Web 输入框，仅替换当前编辑区内容，不触发发送。
   *
   * @param {HTMLElement} element - WhatsApp 可编辑输入框。
   * @param {string} text - 待写入文本。
   * @returns {void}
   */
  function writeWhatsAppInput(element, text) {
    writeContentEditable(element, text);
  }

  /**
   * 写入 Reddit 输入框，兼容 textarea 和富文本编辑器。
   *
   * @param {HTMLElement | HTMLTextAreaElement} element - Reddit 输入框。
   * @param {string} text - 待写入文本。
   * @returns {void}
   */
  function writeRedditInput(element, text) {
    if ('value' in element) {
      writeValueInput(element, text);
      return;
    }

    writeContentEditable(element, text);
  }

  /**
   * 将英文候选写回当前输入框。
   *
   * @param {Element} element - 当前输入框。
   * @param {string} text - 英文候选内容。
   * @returns {void}
   */
  function writeText(element, text) {
    if ('value' in element) {
      writeValueInput(element, text);
      return;
    }

    if (isRedditInput(element)) {
      writeRedditInput(element, text);
      return;
    }

    if (isGmailEditor(element)) {
      writeGmailEditor(element, text);
      return;
    }

    if (isWhatsAppInput(element)) {
      writeWhatsAppInput(element, text);
      return;
    }

    if (element.isContentEditable) {
      writeContentEditable(element, text);
    }
  }

  globalScope.AEIInputAdapter = {
    isSupportedInput,
    isGmailEditor,
    isRedditInput,
    isWhatsAppInput,
    readText,
    writeText,
  };
})(globalThis);
