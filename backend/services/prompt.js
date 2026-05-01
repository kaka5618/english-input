const SCENE_LABELS = {
  cross_border_cs: 'cross-border e-commerce customer service',
  general: 'general translation',
};

const TONE_LABELS = {
  polite: 'polite and natural',
  concise: 'concise and direct',
  formal: 'formal and professional',
  apology: 'reassuring and apologetic',
};

/**
 * 根据场景和语气生成翻译消息，要求模型只返回 JSON 数组。
 *
 * @param {object} params - Prompt 参数。
 * @param {string} params.text - 用户输入的中文原文。
 * @param {string} params.scene - 翻译场景标识。
 * @param {string} params.tone - 用户偏好的语气标识。
 * @returns {Array<{role: 'system' | 'user', content: string}>} OpenAI-compatible chat messages。
 */
function buildTranslationMessages({ text, scene = 'cross_border_cs', tone = 'polite' }) {
  const sceneLabel = SCENE_LABELS[scene] || SCENE_LABELS.general;
  const toneLabel = TONE_LABELS[tone] || TONE_LABELS.polite;

  return [
    {
      role: 'system',
      content: [
        'You are a professional English writing assistant specialized in cross-border e-commerce communication.',
        'Translate the user Chinese input into 3 natural English versions.',
        'Return ONLY a valid JSON array. Do not include markdown, code fences, or explanations.',
        'Each item must contain exactly these fields: "label" and "text".',
        'Use these exact labels in order: "礼貌自然", "简洁直接", "正式专业".',
        'The three versions should be meaning-preserving and clearly different in expression style.',
        `Scene: ${sceneLabel}`,
        `Tone preference: ${toneLabel}`,
      ].join('\n'),
    },
    {
      role: 'user',
      content: text,
    },
  ];
}

module.exports = {
  buildTranslationMessages,
};
