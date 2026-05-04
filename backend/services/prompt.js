const SCENE_LABELS = {
  cross_border_cs: 'cross-border e-commerce customer service',
  foreign_trade_email: 'foreign trade business email',
  social_media: 'cross-border social media interaction',
  general: 'general cross-border business communication',
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
        'Turn the user Chinese business intent into 3 polished English reply candidates.',
        'Return ONLY a valid JSON array. Do not include markdown, code fences, or explanations.',
        'Each item must contain exactly these fields: "label" and "text".',
        'Use these exact labels in order: "礼貌自然", "简洁直接", "正式专业".',
        'The "label" field must use Chinese labels, but the "text" field must be written in English only.',
        'Do not output Chinese in the "text" field.',
        'Preserve the user intent and do not invent order details, prices, policies, tracking numbers, or promises.',
        'Make each version suitable for cross-border e-commerce, sales, support, email, or social communication.',
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
