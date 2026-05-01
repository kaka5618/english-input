const express = require('express');
const { validateTranslateRequest } = require('../middleware/validate');
const { generateTranslationCandidates } = require('../services/openai');

const router = express.Router();
const TEMPORARY_REMAINING_COUNT = 15;

/**
 * 处理翻译请求，当前阶段暂未接入 Redis 额度，remaining 固定返回 15。
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
      remaining: TEMPORARY_REMAINING_COUNT,
    });
  } catch (error) {
    console.error('translate_failed', error);
    res.status(502).json({
      error: 'ai_service_error',
      remaining: TEMPORARY_REMAINING_COUNT,
    });
  }
}

router.post('/translate', validateTranslateRequest, translateHandler);

module.exports = router;
