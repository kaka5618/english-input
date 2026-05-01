(function initializeContentScript() {
  const triggerController = AEITrigger.createTriggerController({
    onTrigger({ originalText, triggerType }) {
      console.debug('AI English Input translation triggered', {
        triggerType,
        originalText,
      });
    },
  });

  triggerController.start();
  globalThis.AEIContent = {
    triggerController,
  };
})();
