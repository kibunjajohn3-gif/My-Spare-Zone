// CommonJS entrypoint for Phusion Passenger (cPanel "Setup Node.js App" on AfrivoHost)
// Dynamically imports the compiled ESM server bundle (`npm run build` -> `server.js`).
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

import('./server.js').catch((err) => {
  console.error('Failed to start My Spare Zone server via app.cjs:', err);
  process.exit(1);
});
