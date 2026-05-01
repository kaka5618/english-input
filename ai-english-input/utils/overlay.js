(function attachOverlayUtils(globalScope) {
  const OVERLAY_ID = 'aei-overlay';
  const OVERLAY_GAP = 6;
  const OVERLAY_MARGIN = 16;
  const MIN_OVERLAY_WIDTH = 480;
  const DEFAULT_STATE = {
    direction: '中文 → English',
    sceneLabel: '跨境客服',
    toneLabel: '礼貌自然',
  };
  let currentAnchorElement = null;
  let currentCandidates = [];

  /**
   * 创建带 class 的 DOM 元素。
   *
   * @param {string} tagName - 标签名。
   * @param {string} className - class 名称。
   * @param {string} [text] - 文本内容。
   * @returns {HTMLElement} DOM 元素。
   */
  function createElement(tagName, className, text) {
    const element = document.createElement(tagName);
    element.className = className;

    if (text) {
      element.textContent = text;
    }

    return element;
  }

  /**
   * 移除已有候选框，避免重复插入多个浮层。
   *
   * @returns {void}
   */
  function removeOverlay() {
    const existingOverlay = document.getElementById(OVERLAY_ID);

    if (existingOverlay) {
      existingOverlay.remove();
    }

    currentAnchorElement = null;
    currentCandidates = [];
    window.removeEventListener('resize', refreshOverlayPosition, true);
    window.removeEventListener('scroll', refreshOverlayPosition, true);
  }

  /**
   * 创建候选框顶部状态栏。
   *
   * @param {typeof DEFAULT_STATE} state - 当前状态显示。
   * @returns {HTMLElement} 顶部状态栏。
   */
  function createHeader(state) {
    const header = createElement('div', 'aei-header');
    header.append(
      createElement('span', 'aei-direction', state.direction),
      createElement('span', 'aei-scene', `场景：${state.sceneLabel}`),
      createElement('span', 'aei-tone', `语气：${state.toneLabel}`),
    );
    return header;
  }

  /**
   * 创建候选项占位区域，真实候选会在后续步骤接入接口后替换。
   *
   * @returns {HTMLElement} 候选列表。
   */
  function createCandidates() {
    const candidates = createElement('div', 'aei-candidates');
    const placeholders = [
      ['1', '礼貌自然', 'AI 生成中，稍后展示候选句...'],
      ['2', '简洁直接', 'AI 生成中，稍后展示候选句...'],
      ['3', '正式专业', 'AI 生成中，稍后展示候选句...'],
    ];

    placeholders.forEach(([number, label, text], index) => {
      const item = createElement('div', 'aei-item aei-item--placeholder');
      item.dataset.index = String(index);
      item.append(
        createElement('span', 'aei-num', number),
        createElement('span', 'aei-label', label),
        createElement('span', 'aei-text', text),
      );
      candidates.append(item);
    });

    return candidates;
  }

  /**
   * 获取当前候选框 DOM。
   *
   * @returns {HTMLElement | null} 候选框 DOM。
   */
  function getOverlay() {
    return document.getElementById(OVERLAY_ID);
  }

  /**
   * 隐藏加载态。
   *
   * @param {HTMLElement} overlay - 候选框 DOM。
   * @returns {void}
   */
  function hideLoading(overlay) {
    const loading = overlay.querySelector('.aei-loading');

    if (loading) {
      loading.classList.add('aei-hidden');
    }
  }

  /**
   * 用真实候选结果替换占位候选。
   *
   * @param {Array<{label: string, text: string}>} candidates - 后端返回的候选句。
   * @returns {void}
   */
  function showCandidates(candidates) {
    const overlay = getOverlay();

    if (!overlay) {
      return;
    }

    const candidatesElement = overlay.querySelector('.aei-candidates');

    if (!candidatesElement) {
      return;
    }

    hideLoading(overlay);
    currentCandidates = candidates;
    candidatesElement.textContent = '';
    candidates.forEach((candidate, index) => {
      const item = createElement('div', 'aei-item');
      item.dataset.index = String(index);
      item.setAttribute('role', 'button');
      item.setAttribute('tabindex', '0');
      item.append(
        createElement('span', 'aei-num', String(index + 1)),
        createElement('span', 'aei-label', candidate.label),
        createElement('span', 'aei-text', candidate.text),
      );
      candidatesElement.append(item);
    });
    refreshOverlayPosition();
  }

  /**
   * 展示翻译失败提示。
   *
   * @param {string} message - 失败提示文案。
   * @returns {void}
   */
  function showError(message) {
    const overlay = getOverlay();

    if (!overlay) {
      return;
    }

    const candidatesElement = overlay.querySelector('.aei-candidates');

    if (!candidatesElement) {
      return;
    }

    hideLoading(overlay);
    currentCandidates = [];
    candidatesElement.textContent = '';
    candidatesElement.append(createElement('div', 'aei-error', message));
    refreshOverlayPosition();
  }

  /**
   * 根据索引读取当前候选。
   *
   * @param {number} index - 候选索引。
   * @returns {{label: string, text: string} | null} 候选句。
   */
  function getCandidate(index) {
    return currentCandidates[index] || null;
  }

  /**
   * 限制数值在指定范围内，避免候选框超出视口。
   *
   * @param {number} value - 当前值。
   * @param {number} min - 最小值。
   * @param {number} max - 最大值。
   * @returns {number} 限制后的值。
   */
  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  /**
   * 根据输入框位置定位候选框。
   *
   * @param {Element} inputElement - 当前输入框。
   * @param {HTMLElement} overlay - 候选框元素。
   * @returns {void}
   */
  function positionOverlay(inputElement, overlay) {
    const rect = inputElement.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
    const overlayWidth = Math.min(Math.max(rect.width, MIN_OVERLAY_WIDTH), viewportWidth - OVERLAY_MARGIN * 2);
    const left = clamp(rect.left, OVERLAY_MARGIN, viewportWidth - overlayWidth - OVERLAY_MARGIN);
    let top = rect.bottom + OVERLAY_GAP;

    overlay.style.width = `${overlayWidth}px`;

    if (top + overlay.offsetHeight > viewportHeight - OVERLAY_MARGIN) {
      top = rect.top - overlay.offsetHeight - OVERLAY_GAP;
    }

    overlay.style.left = `${left}px`;
    overlay.style.top = `${Math.max(OVERLAY_MARGIN, top)}px`;
  }

  /**
   * 在页面滚动或窗口变化时刷新候选框位置。
   *
   * @returns {void}
   */
  function refreshOverlayPosition() {
    const overlay = document.getElementById(OVERLAY_ID);

    if (!overlay || !currentAnchorElement) {
      return;
    }

    positionOverlay(currentAnchorElement, overlay);
  }

  /**
   * 显示加载态候选框。
   *
   * @param {Element} inputElement - 当前输入框。
   * @param {Partial<typeof DEFAULT_STATE>} [nextState] - 覆盖显示状态。
   * @returns {HTMLElement} 候选框 DOM。
   */
  function showLoadingOverlay(inputElement, nextState = {}) {
    removeOverlay();

    const state = {
      ...DEFAULT_STATE,
      ...nextState,
    };
    const overlay = createElement('div', 'aei-overlay');
    const loading = createElement('div', 'aei-loading');
    const spinner = createElement('span', 'aei-spinner');
    const loadingText = createElement('span', 'aei-loading-text', 'AI 生成中...');

    overlay.id = OVERLAY_ID;
    loading.append(spinner, loadingText);
    overlay.append(createHeader(state), loading, createCandidates());
    document.body.append(overlay);
    currentAnchorElement = inputElement;
    positionOverlay(inputElement, overlay);
    window.addEventListener('resize', refreshOverlayPosition, true);
    window.addEventListener('scroll', refreshOverlayPosition, true);

    return overlay;
  }

  globalScope.AEIOverlay = {
    getCandidate,
    positionOverlay,
    removeOverlay,
    showCandidates,
    showError,
    showLoadingOverlay,
  };
})(globalThis);
