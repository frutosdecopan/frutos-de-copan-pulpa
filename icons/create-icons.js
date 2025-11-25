// Script para crear iconos básicos de Frutos de Copán
const fs = require('fs');
const { createCanvas } = require('canvas');

// Crear canvas para icono 192x192
const canvas192 = createCanvas(192, 192);
const ctx192 = canvas192.getContext('2d');

// Gradiente púrpura
const gradient192 = ctx192.createLinearGradient(0, 0, 192, 192);
gradient192.addColorStop(0, '#667eea');
gradient192.addColorStop(1, '#764ba2');
ctx192.fillStyle = gradient192;
ctx192.fillRect(0, 0, 192, 192);

// Texto FDC
ctx192.fillStyle = 'white';
ctx192.font = 'bold 60px Arial';
ctx192.textAlign = 'center';
ctx192.textBaseline = 'middle';
ctx192.fillText('FDC', 96, 96);

// Guardar icono 192x192
const buffer192 = canvas192.toBuffer('image/png');
fs.writeFileSync('icon-192x192.png', buffer192);

// Crear canvas para icono 72x72
const canvas72 = createCanvas(72, 72);
const ctx72 = canvas72.getContext('2d');

// Gradiente púrpura
const gradient72 = ctx72.createLinearGradient(0, 0, 72, 72);
gradient72.addColorStop(0, '#667eea');
gradient72.addColorStop(1, '#764ba2');
ctx72.fillStyle = gradient72;
ctx72.fillRect(0, 0, 72, 72);

// Texto FDC más pequeño
ctx72.fillStyle = 'white';
ctx72.font = 'bold 25px Arial';
ctx72.textAlign = 'center';
ctx72.textBaseline = 'middle';
ctx72.fillText('FDC', 36, 36);

// Guardar icono 72x72
const buffer72 = canvas72.toBuffer('image/png');
fs.writeFileSync('icon-72x72.png', buffer72);

console.log('Iconos creados exitosamente!');
