(function attachInputAdapter(globalScope) {
  /**
   * 触发输入事件，让网页框架感知内容变化。
   *
   * @param {Element} element - 输入元素。
   * @returns {void}
   */
  function dispatchInputEvents(element) {
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
    element.setSelectionRange(text.length, text.length);
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

    if (element.isContentEditable) {
      writeContentEditable(element, text);
    }
  }

  globalScope.AEIInputAdapter = {
    writeText,
  };
})(globalThis);
