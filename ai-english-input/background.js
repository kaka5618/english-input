importScripts('utils/storage.js');

const API_URL = 'https://backend-delta-three-81.vercel.app/api/translate';
const REQUEST_TIMEOUT_MS = 15000;

/**
 * 创建带后端错误详情的异常，方便 content script 区分超额和普通失败。
 *
 * @param {object} payload - 后端错误响应。
 * @param {string} fallbackCode - 兜底错误码。
 * @returns {Error & {code?: string, limit?: number, remaining?: number}} 请求异常。
 */
function createApiError(payload, fallbackCode) {
  const error = new Error(payload?.error || fallbackCode);
  error.code = payload?.error || fallbackCode;
  error.limit = payload?.limit;
  error.remaining = payload?.remaining;
  return error;
}

/**
 * 请求后端翻译接口，统一放在扩展后台执行，避免页面环境影响跨域请求。
 *
 * @param {object} params - 请求参数。
 * @param {string} params.text - 用户输入的中文原文。
 * @param {string} params.scene - 当前场景。
 * @param {string} params.tone - 当前语气。
 * @param {string} params.userId - 匿名用户 ID。
 * @returns {Promise<{candidates: Array<{label: string, text: string}>, remaining: number}>} 翻译结果。
 */
async function requestTranslation({ text, scene, tone, userId }) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        scene,
        tone,
        user_id: userId,
      }),
      signal: controller.signal,
    });
    const payload = await response.json();

    if (!response.ok) {
      throw createApiError(payload, 'translate_failed');
    }

    return payload;
  } finally {
    clearTimeout(timeoutId);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  AEIStorage.getUserId().catch((error) => {
    console.error('failed_to_initialize_user_id', error);
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'AEI_TRANSLATE') {
    return false;
  }

  requestTranslation(message.payload)
    .then((payload) => {
      sendResponse({ ok: true, payload });
    })
    .catch((error) => {
      console.error('translation_request_failed', error);
      sendResponse({
        ok: false,
        error: error.name === 'AbortError' ? 'request_timeout' : error.code || error.message,
        limit: error.limit,
        remaining: error.remaining,
      });
    });

  return true;
});
