const dotenv = require('dotenv');
const { generateTranslationCandidates } = require('../services/openai');

dotenv.config();

/**
 * 独立验证 AI 翻译服务是否能返回格式正确的 3 条候选句。
 *
 * @returns {Promise<void>}
 */
async function main() {
  const candidates = await generateTranslationCandidates({
    text: '客户问物流为什么还没到，帮我礼貌解释因为天气原因可能会延迟两天，并安抚一下',
    scene: 'cross_border_cs',
    tone: 'polite',
  });

  console.log(JSON.stringify(candidates, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
