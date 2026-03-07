import app from './app.js';

const PORT = process.env.PORT || 3005;

const server = app.listen(PORT, () => {
  console.log(`SOS (Taschentherapeut) running on port ${PORT}`);
});

const shutdown = () => {
  console.log('Shutting down gracefully...');
  server.close(() => process.exit(0));
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
