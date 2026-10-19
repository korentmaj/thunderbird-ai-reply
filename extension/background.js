const HOST = 'ai_reply_host';
const MODES = { quick: 'Quick', deep: 'Deep' };
const PAINT_MS = 300;

const notify = (title, message) => messenger.notifications.create({ type: 'basic', title, message });
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function displayedMessage(tabId) {
  if (messenger.messageDisplay.getDisplayedMessages) {
    const r = await messenger.messageDisplay.getDisplayedMessages(tabId);
    const list = Array.isArray(r) ? r : r.messages;
    return list && list[0];
  }
  return messenger.messageDisplay.getDisplayedMessage(tabId);
}

async function bodyText(id) {
  const parts = await messenger.messages.listInlineTextParts(id);
  const plain = parts.find((p) => p.contentType === 'text/plain');
  if (plain) return plain.content;
  const html = parts.find((p) => p.contentType === 'text/html');
  return html ? messenger.messengerUtilities.convertToPlainText(html.content) : '';
}

async function identityEmail(msg) {
  try {
    const acc = await messenger.accounts.get(msg.folder.accountId);
    return (acc.identities[0] && acc.identities[0].email) || '';
  } catch { return ''; }
}

// Writes `text` above the quoted original in the compose window.
function makePainter(tabId, details) {
  const plain = details.isPlainText;
  const original = plain ? details.plainTextBody || '' : details.body;
  return (text, placeholder) => {
    if (plain) return messenger.compose.setComposeDetails(tabId, { plainTextBody: `${text || placeholder}\n\n${original}` });
    const html = text
      ? text.split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('')
      : `<p><i style="color:#888">${esc(placeholder)}</i></p>`;
    const body = /<body[^>]*>/i.test(original) ? original.replace(/<body[^>]*>/i, (m) => m + html) : html + original;
    return messenger.compose.setComposeDetails(tabId, { body });
  };
}

async function doReply({ mode, instruction, tabId }) {
  const msg = await displayedMessage(tabId);
  if (!msg) return notify('AI reply', 'No message is open.');

  // open the reply window first, the text streams into it
  const tab = await messenger.compose.beginReply(msg.id, 'replyToSender');
  const paint = makePainter(tab.id, await messenger.compose.getComposeDetails(tab.id));
  let status = `AI is writing a reply (${MODES[mode]})…`;
  await paint('', status);

  const mail = {
    author: msg.author, recipients: (msg.recipients || []).join(', '), date: String(msg.date),
    subject: msg.subject, body: (await bodyText(msg.id)).slice(0, 60000),
    identity: await identityEmail(msg), instruction,
  };

  const port = messenger.runtime.connectNative(HOST);
  let text = '', dirty = false, closed = false, finished = false;
  const timer = setInterval(() => {
    if (!dirty || closed) return;
    dirty = false;
    paint(text, status).catch(stop);
  }, PAINT_MS);
  function stop() {
    if (closed) return;
    closed = true; clearInterval(timer);
    try { port.disconnect(); } catch {}
  }
  const onRemoved = (id) => { if (id === tab.id) { stop(); messenger.tabs.onRemoved.removeListener(onRemoved); } };
  messenger.tabs.onRemoved.addListener(onRemoved);

  port.onMessage.addListener((m) => {
    if (closed) return;
    if (m.type === 'reset') { text = ''; dirty = true; }
    else if (m.type === 'status') { status = m.text; dirty = true; }
    else if (m.type === 'delta') { text += m.text; dirty = true; }
    else if (m.type === 'done') {
      finished = true; stop();
      paint(m.text || text, status).catch(() => {});
    } else if (m.type === 'error') {
      finished = true; stop();
      paint('', `AI reply failed: ${m.error}`).catch(() => {});
    }
  });
  port.onDisconnect.addListener((p) => {
    if (closed || finished) return;
    stop();
    const why = (p && p.error && p.error.message) || (messenger.runtime.lastError && messenger.runtime.lastError.message) || 'host disconnected';
    paint(text, `AI reply failed: ${why}`).catch(() => {});
  });
  port.postMessage({ mode, mail });
}

messenger.runtime.onMessage.addListener((m) => {
  if (m.type === 'reply') doReply(m).catch((e) => notify('AI reply: error', String(e)));
});
