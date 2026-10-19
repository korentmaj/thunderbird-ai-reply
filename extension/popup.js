const ins = document.getElementById('ins');
ins.focus();
for (const b of document.querySelectorAll('button')) {
  b.onclick = async () => {
    const [tab] = await messenger.tabs.query({ active: true, currentWindow: true });
    // the background page does the work, the popup closes as soon as focus moves
    messenger.runtime.sendMessage({ type: 'reply', mode: b.dataset.mode, instruction: ins.value.trim(), tabId: tab.id });
    window.close();
  };
}
