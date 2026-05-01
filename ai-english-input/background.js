importScripts('utils/storage.js');

chrome.runtime.onInstalled.addListener(() => {
  AEIStorage.getUserId().catch((error) => {
    console.error('failed_to_initialize_user_id', error);
  });
});
