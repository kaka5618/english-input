const cors = require('cors');
const express = require('express');
const translateRouter = require('./routes/translate');

const app = express();

app.use(cors());
app.use(express.json({ limit: '32kb' }));
app.use('/api', translateRouter);

/**
 * 返回服务健康状态，用于本地启动、部署平台健康检查和 Vercel 函数验证。
 *
 * @param {import('express').Request} _req - Express 请求对象。
 * @param {import('express').Response} res - Express 响应对象。
 * @returns {void}
 */
function healthHandler(_req, res) {
  const aiProvider = process.env.AI_PROVIDER || 'qwen';
  const aiApiKey = process.env.AI_API_KEY || '';
  const aiBaseUrl = process.env.AI_BASE_URL || '';
  const aiModel = process.env.AI_MODEL || '';
  const isApiKeyConfigured = Boolean(aiApiKey && aiApiKey !== 'your_ai_api_key_here');

  res.json({
    ok: true,
    service: 'ai-english-input-backend',
    ai: {
      provider: aiProvider,
      model: aiModel,
      baseUrlConfigured: Boolean(aiBaseUrl),
      apiKeyConfigured: isApiKeyConfigured,
    },
  });
}

app.get('/health', healthHandler);

module.exports = app;
