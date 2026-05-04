const MAX_TEXT_LENGTH = 100;

/**
 * 判断文本是否包含中文字符，避免空请求或纯英文请求消耗模型额度。
 *
 * @param {string} text - 待检测文本。
 * @returns {boolean} 是否包含中文字符。
 */
function containsChinese(text) {
  return /[\u3400-\u9fff]/.test(text);
}

/**
 * 校验翻译接口请求体。
 *
 * @param {import('express').Request} req - Express 请求对象。
 * @param {import('express').Response} res - Express 响应对象。
 * @param {import('express').NextFunction} next - Express next 回调。
 * @returns {void}
 */
function validateTranslateRequest(req, res, next) {
  const { text, scene, tone, user_id: userId } = req.body || {};

  if (typeof text !== 'string' || !text.trim()) {
    res.status(400).json({ error: 'text_required' });
    return;
  }

  if (text.length > MAX_TEXT_LENGTH) {
    res.status(400).json({ error: 'text_too_long', max_length: MAX_TEXT_LENGTH });
    return;
  }

  if (!containsChinese(text)) {
    res.status(400).json({ error: 'chinese_text_required' });
    return;
  }

  if (typeof scene !== 'string' || !scene.trim()) {
    res.status(400).json({ error: 'scene_required' });
    return;
  }

  if (typeof tone !== 'string' || !tone.trim()) {
    res.status(400).json({ error: 'tone_required' });
    return;
  }

  if (typeof userId !== 'string' || !userId.trim()) {
    res.status(400).json({ error: 'user_id_required' });
    return;
  }

  req.body.text = text.trim();
  req.body.scene = scene.trim();
  req.body.tone = tone.trim();
  req.body.user_id = userId.trim();
  next();
}

module.exports = {
  MAX_TEXT_LENGTH,
  validateTranslateRequest,
};
