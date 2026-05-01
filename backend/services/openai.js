const OpenAI = require('openai');
const { buildTranslationMessages } = require('./prompt');

/**
 * 创建 OpenAI-compatible 客户端，可对接 Qwen / OpenAI / 其他兼容服务。
 *
 * @returns {OpenAI} OpenAI SDK 客户端。
 */
function createAiClient() {
  const apiKey = process.env.AI_API_KEY;
  const baseURL = process.env.AI_BASE_URL;

  if (!apiKey || apiKey === 'your_ai_api_key_here') {
    throw new Error('AI_API_KEY is not configured');
  }

  if (!baseURL) {
    throw new Error('AI_BASE_URL is not configured');
  }

  return new OpenAI({
    apiKey,
    baseURL,
  });
}

/**
 * 从模型返回内容中解析候选 JSON 数组。
 *
 * @param {string} content - 模型返回的文本内容。
 * @returns {Array<{label: string, text: string}>} 三条英文候选句。
 */
function parseCandidates(content) {
  const normalized = content
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();

  const jsonText = normalized.startsWith('[')
    ? normalized
    : normalized.slice(normalized.indexOf('['), normalized.lastIndexOf(']') + 1);
  const candidates = JSON.parse(jsonText);

  if (!Array.isArray(candidates) || candidates.length !== 3) {
    throw new Error('AI response must be an array with exactly 3 candidates');
  }

  return candidates.map((candidate) => {
    if (!candidate || typeof candidate.label !== 'string' || typeof candidate.text !== 'string') {
      throw new Error('AI response candidate must contain label and text');
    }

    return {
      label: candidate.label,
      text: candidate.text,
    };
  });
}

/**
 * 调用 AI 模型生成 3 条英文翻译候选。
 *
 * @param {object} params - 翻译参数。
 * @param {string} params.text - 用户输入的中文原文。
 * @param {string} params.scene - 翻译场景标识。
 * @param {string} params.tone - 用户偏好的语气标识。
 * @returns {Promise<Array<{label: string, text: string}>>} 三条英文候选句。
 */
async function generateTranslationCandidates({ text, scene = 'cross_border_cs', tone = 'polite' }) {
  const model = process.env.AI_MODEL;

  if (!model) {
    throw new Error('AI_MODEL is not configured');
  }

  const client = createAiClient();
  const response = await client.chat.completions.create({
    model,
    messages: buildTranslationMessages({ text, scene, tone }),
    temperature: 0.7,
    top_p: 0.8,
  });
  const content = response.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('AI response content is empty');
  }

  return parseCandidates(content);
}

module.exports = {
  generateTranslationCandidates,
  parseCandidates,
};
