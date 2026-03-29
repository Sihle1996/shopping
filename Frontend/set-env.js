// Runs before Angular build to inject environment variables into environment.prod.ts
// Usage: node set-env.js
// Set on Vercel: API_URL, MAPBOX_TOKEN

const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, 'src', 'environments', 'environment.prod.ts');

const apiUrl = process.env.APIURL || process.env.API_URL || 'http://localhost:8080';
const mapboxToken = process.env.MAPBOXTOKEN || process.env.MAPBOX_TOKEN || '';

const content = `export const environment = {
  production: true,
  apiUrl: '${apiUrl}',
  mapboxToken: '${mapboxToken}'
};
`;

fs.writeFileSync(targetPath, content, { encoding: 'utf8' });
console.log(`environment.prod.ts written with apiUrl=${apiUrl}`);
