import express from 'express';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'barnacle-core' });
});

// License validation endpoint
app.post('/api/licenses/validate', async (req, res) => {
  const { license_id, user_id } = req.body;
  
  // TODO: Implementar validación contra DB
  res.json({
    valid: true,
    trial_days_remaining: 10,
    active: true,
  });
});

// Stripe webhook
app.post('/api/webhooks/stripe', async (req, res) => {
  const event = req.body;
  
  // TODO: Procesar webhooks de Stripe
  res.json({ received: true });
});

app.listen(PORT, () => {
  console.log(`🦞 Barnacle Core running on port ${PORT}`);
});
