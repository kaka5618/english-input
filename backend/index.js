const cors = require('cors');
const dotenv = require('dotenv');
const express = require('express');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const aiProvider = process.env.AI_PROVIDER || 'qwen';
const aiApiKey = process.env.AI_API_KEY || '';
const aiBaseUrl = process.env.AI_BASE_URL || '';
const aiModel = process.env.AI_MODEL || '';

app.use(cors());
app.use(express.json({ limit: '32kb' }));

/**
 * 返回服务健康状态，用于本地启动和部署平台健康检查。
 *
 * @param {import('express').Request} _req - Express 请求对象。
 * @param {import('express').Response} res - Express 响应对象。
 * @returns {void}
 */
function healthHandler(_req, res) {
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

app.listen(port, () => {
  console.log(`AI English Input backend listening on port ${port}`);
});
