// Local SMTP inbox for browser QA. This module is never imported by the API server.
const net = require('node:net');

const decodePart = (raw) => {
  const split = raw.search(/\r?\n\r?\n/);
  if (split < 0) return {};
  const headers = raw.slice(0, split).replace(/\r?\n[ \t]+/g, ' ');
  const body = raw.slice(split).replace(/^\r?\n\r?\n/, '');
  const boundary = headers.match(/boundary="?([^";\r\n]+)/i)?.[1];
  if (/content-type:\s*multipart\//i.test(headers) && boundary) {
    return Object.assign({}, ...body.split(`--${boundary}`).slice(1, -1).map(part => decodePart(part.replace(/^\r?\n/, ''))));
  }
  let value = body;
  if (/content-transfer-encoding:\s*base64/i.test(headers)) value = Buffer.from(body, 'base64').toString('utf8');
  else if (/content-transfer-encoding:\s*quoted-printable/i.test(headers)) {
    value = Buffer.from(body.replace(/=\r?\n/g, '').replace(/=([a-f0-9]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16))), 'binary').toString('utf8');
  }
  return /content-type:\s*text\/html/i.test(headers) ? { html: value } : { text: value };
};

async function createSmtpInbox() {
  const messages = [];
  const sockets = new Set();
  const server = net.createServer(socket => {
    sockets.add(socket);
    socket.setEncoding('utf8');
    socket.setTimeout(15000, () => socket.destroy());
    socket.on('error', () => {});
    socket.on('close', () => sockets.delete(socket));
    socket.write('220 localhost QA inbox\r\n');
    let buffer = '', recipients = [], data = null;
    socket.on('data', chunk => {
      buffer += chunk;
      if (buffer.length > 1024 * 1024 || (data && data.join('\n').length > 1024 * 1024)) return socket.destroy();
      let end;
      while ((end = buffer.indexOf('\r\n')) !== -1) {
        const line = buffer.slice(0, end); buffer = buffer.slice(end + 2);
        if (data) {
          if (line !== '.') { data.push(line.replace(/^\.\./, '.')); continue; }
          const raw = data.join('\r\n');
          messages.push({ to: recipients.slice(), subject: raw.match(/^Subject:\s*(.*)$/mi)?.[1] || '', ...decodePart(raw) });
          if (messages.length > 500) messages.shift();
          recipients = []; data = null;
          socket.write('250 Message received by local QA inbox\r\n');
        } else if (/^(EHLO|HELO)\b/i.test(line)) socket.write('250-localhost\r\n250-AUTH PLAIN\r\n250 PIPELINING\r\n');
        else if (/^AUTH PLAIN\b/i.test(line)) socket.write('235 QA authentication accepted\r\n');
        else if (/^MAIL FROM:/i.test(line)) { recipients = []; socket.write('250 Sender accepted\r\n'); }
        else if (/^RCPT TO:/i.test(line)) { recipients.push(line.match(/<([^>]+)>/)?.[1].toLowerCase()); socket.write('250 Recipient accepted\r\n'); }
        else if (/^DATA$/i.test(line)) { data = []; socket.write('354 End with a dot\r\n'); }
        else if (/^QUIT$/i.test(line)) socket.end('221 Goodbye\r\n');
        else if (/^(RSET|NOOP)\b/i.test(line)) { recipients = []; socket.write('250 OK\r\n'); }
        else socket.write('502 Unsupported QA SMTP command\r\n');
      }
    });
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return { port: server.address().port, messages,
    close: () => new Promise(resolve => { for (const socket of sockets) socket.destroy(); server.close(resolve); }) };
}

module.exports = { createSmtpInbox };
