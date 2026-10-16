'use strict';
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) return;
  try {
    await chrome.sidePanel.open({ tabId: tab.id });
  } catch (error) {
    console.error('Caça Promos VIP: não foi possível abrir o painel lateral.', error);
  }
});
