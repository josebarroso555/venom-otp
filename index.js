const venom = require('venom-bot');
const express = require('express');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

const codesStore = {};

function generateCode(length = 6) {
  const min = 10 ** (length - 1);
  const max = 10 ** length - 1;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

let clientGlobal = null;

// 🔐 Configuración optimizada para Railway
venom
  .create({
    session: 'session-otp',
    multidevice: true,
    headless: true,
    logQR: true,
    disableSpins: true,
    // 🚀 USAR CHROME DEL SISTEMA (no descargar)
    executablePath: '/usr/bin/google-chrome-stable',
    browserArgs: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-extensions',
      '--disable-gpu',
      '--disable-infobars',
      '--window-size=800,600',
      '--disable-background-networking',
      '--disable-features=VizDisplayCompositor',
      '--disable-software-rasterizer',
      '--single-process' // ⬅ Importante en entornos con memoria limitada
    ]
  })
  .then((client) => {
    clientGlobal = client;
    console.log('✅ Venom bot OTP iniciado en Railway');
  })
  .catch((err) => {
    console.error('❌ Error al iniciar Venom:', err);
  });

app.get('/', (req, res) => {
  res.send('API OTP con Venom está corriendo en Railway 🚀');
});

app.post('/send-code', async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'Falta phone en el body' });
    }

    if (!clientGlobal) {
      return res.status(500).json({ error: 'Venom aún no está listo' });
    }

    const code = generateCode(6).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000;

    codesStore[phone] = { code, expiresAt };

    const waNumber = `${phone}@c.us`;
    const message = `Tu código de verificación es: ${code}. Es válido por 5 minutos.`;

    await clientGlobal.sendText(waNumber, message);

    console.log(`Código ${code} enviado a ${phone}`);

    res.json({ ok: true, message: 'Código enviado por WhatsApp' });
  } catch (err) {
    console.error('❌ Error al enviar código:', err);
    res.status(500).json({ error: 'Error al enviar el código' });
  }
});

app.post('/verify-code', (req, res) => {
  try {
    const { phone, code } = req.body;

    if (!phone || !code) {
      return res.status(400).json({ error: 'Faltan datos (phone o code)' });
    }

    const saved = codesStore[phone];

    if (!saved) {
      return res.status(400).json({ error: 'No hay código generado para este número' });
    }

    if (Date.now() > saved.expiresAt) {
      delete codesStore[phone];
      return res.status(400).json({ error: 'Código expirado' });
    }

    if (saved.code !== code) {
      return res.status(400).json({ error: 'Código incorrecto' });
    }

    delete codesStore[phone];

    res.json({ ok: true, message: 'Código válido, usuario autenticado' });
  } catch (err) {
    console.error('❌ Error al verificar código:', err);
    res.status(500).json({ error: 'Error al verificar el código' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
