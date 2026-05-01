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
    text: '很抱歉，物流因为天气原因可能会延迟两天',
    scene: 'cross_border_cs',
    tone: 'polite',
  });

  console.log(JSON.stringify(candidates, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
