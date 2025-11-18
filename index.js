const venom = require('venom-bot');
const express = require('express');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Almacenamiento simple en memoria (para pruebas):
// codesStore["549381XXXXXXX"] = { code: "123456", expiresAt: 1731700000000 }
const codesStore = {};

// Generar un código numérico de 6 dígitos
function generateCode(length = 6) {
  const min = 10 ** (length - 1);
  const max = 10 ** length - 1;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

let clientGlobal = null;

// 🔐 Inicializar Venom
venom
  .create({
    session: 'session-otp',   // mismo nombre que te sale en logs
    multidevice: true,
    headless: false,          // ⬅ PARA PRIMERA VEZ: que se vea Chrome
    logQR: true,              // muestra el QR en la terminal
  })
  .then((client) => {
    clientGlobal = client;
    console.log('✅ Venom bot OTP iniciado');
  })
  .catch((err) => {
    console.error('Error al iniciar Venom:', err);
  });

// Endpoint simple para probar que el server está vivo
app.get('/', (req, res) => {
  res.send('API OTP con Venom está corriendo ✅');
});

/**
 * 1) ENVIAR CÓDIGO
 * POST /send-code
 * body: { phone: "549381XXXXXXX" }
 */
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
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutos

    codesStore[phone] = { code, expiresAt };

    const waNumber = `${phone}@c.us`;
    const message = `Tu código de verificación es: ${code}. Es válido por 5 minutos.`;

    await clientGlobal.sendText(waNumber, message);

    console.log(`Código ${code} enviado a ${phone}`);

    res.json({ ok: true, message: 'Código enviado por WhatsApp' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al enviar el código' });
  }
});

/**
 * 2) VERIFICAR CÓDIGO
 * POST /verify-code
 * body: { phone: "549381XXXXXXX", code: "123456" }
 */
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

    delete codesStore[phone]; // un solo uso

    // Acá podrías generar un JWT, marcar usuario como logueado, etc.
    res.json({ ok: true, message: 'Código válido, usuario autenticado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al verificar el código' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
