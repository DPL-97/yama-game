#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────
// Yama Game – Sync-Server
// Liefert index.html aus UND hält den Multiplayer-Raumzustand.
// Keine externen Pakete nötig – läuft mit reinem Node.js (>=16).
//
// Start:  node server.js
// Danach: http://localhost:3000 im Browser öffnen zum Testen.
// ─────────────────────────────────────────────────────────────────

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const INDEX_PATH = path.join(__dirname, 'index.html');
const ROOM_TTL_MS = 6 * 60 * 60 * 1000; // inaktive Räume nach 6h aufräumen
const MAX_BODY_BYTES = 200 * 1024;      // 200 KB reichen für einen Raum-Zustand locker

const rooms = new Map(); // code -> aktueller Raum-Zustand (autoritative Quelle)

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function cleanupOldRooms() {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (now - (room.updatedAt || 0) > ROOM_TTL_MS) rooms.delete(code);
  }
}
setInterval(cleanupOldRooms, 30 * 60 * 1000);

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const roomMatch = url.pathname.match(/^\/api\/room\/([A-Za-z]{4})$/);

    // ── Raum lesen ──
    if (roomMatch && req.method === 'GET') {
      const code = roomMatch[1].toUpperCase();
      const room = rooms.get(code);
      if (!room) { sendJson(res, 404, { error: 'not found' }); return; }
      sendJson(res, 200, room);
      return;
    }

    // ── Raum schreiben (mit Versions-Check gegen veraltete Schreibzugriffe) ──
    if (roomMatch && req.method === 'POST') {
      const code = roomMatch[1].toUpperCase();
      let body;
      try {
        body = JSON.parse(await readBody(req, MAX_BODY_BYTES));
      } catch (e) {
        sendJson(res, 400, { error: 'invalid body' });
        return;
      }
      if (!body || body.code !== code) {
        sendJson(res, 400, { error: 'code mismatch' });
        return;
      }

      const existing = rooms.get(code);
      const existingVersion = existing ? existing.version : -1;

      if (typeof body.version === 'number' && body.version > existingVersion) {
        // Neuer Stand ist tatsächlich neuer -> wird übernommen und ist ab
        // jetzt die Wahrheit für alle Clients.
        rooms.set(code, body);
        sendJson(res, 200, body);
      } else {
        // Veraltet (ein anderer Client war schneller) -> Schreibversuch wird
        // verworfen, wir schicken stattdessen den aktuell gültigen Stand
        // zurück. Der Client übernimmt diesen automatisch.
        sendJson(res, 200, existing);
      }
      return;
    }

    // ── Alles andere: die App selbst ausliefern ──
    if (req.method === 'GET') {
      fs.readFile(INDEX_PATH, (err, data) => {
        if (err) {
          res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('index.html nicht gefunden – liegt es im selben Ordner wie server.js?');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(data);
      });
      return;
    }

    sendJson(res, 404, { error: 'not found' });
  } catch (e) {
    console.error(e);
    sendJson(res, 500, { error: 'server error' });
  }
});

server.listen(PORT, () => {
  console.log(`Yama Game läuft auf http://localhost:${PORT}`);
  console.log(`Aktive Räume: in-memory (gehen beim Neustart verloren)`);
});
