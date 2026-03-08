// Shared WhatsApp client setup — required by all scripts
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

function createClient() {
  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  });

  client.on('qr', (qr) => {
    console.log('\nScan QR code in WhatsApp → Linked Devices → Link a Device:\n');
    qrcode.generate(qr, { small: true });
  });

  client.on('loading_screen', (pct, msg) => {
    process.stdout.write(`\rLoading: ${pct}% — ${msg}   `);
  });

  client.on('authenticated', () => console.log('\nAuthenticated.'));
  client.on('auth_failure',  (e) => { console.error('Auth failed:', e); process.exit(1); });

  return client;
}

module.exports = { createClient };
