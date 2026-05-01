(function initializeContentScript() {
  const triggerController = AEITrigger.createTriggerController({
    onTrigger({ inputElement, originalText, triggerType }) {
      console.debug('AI English Input translation triggered', {
        triggerType,
        originalText,
      });
      AEIOverlay.showLoadingOverlay(inputElement);
    },
  });

  triggerController.start();
  globalThis.AEIContent = {
    triggerController,
  };
})();
