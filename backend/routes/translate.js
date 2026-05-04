const express = require('express');
const { dailyUsageLimit } = require('../middleware/rateLimit');
const { validateTranslateRequest } = require('../middleware/validate');
const { generateTranslationCandidates } = require('../services/openai');

const router = express.Router();

/**
 * 处理翻译请求，并返回本次扣减后的剩余额度。
 *
 * @param {import('express').Request} req - Express 请求对象。
 * @param {import('express').Response} res - Express 响应对象。
 * @returns {Promise<void>}
 */
async function translateHandler(req, res) {
  const { text, scene, tone } = req.body;

  try {
    const candidates = await generateTranslationCandidates({ text, scene, tone });

    res.json({
      candidates,
      remaining: req.usage.remaining,
    });
  } catch (error) {
    console.error('translate_failed', error);
    res.status(502).json({
      error: 'ai_service_error',
      remaining: req.usage?.remaining ?? 0,
    });
  }
}

router.post('/translate', validateTranslateRequest, dailyUsageLimit, translateHandler);

module.exports = router;
