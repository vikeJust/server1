const http = require('http');
const path = require('path');
const fs = require('fs');
const WebSocket = require('ws');

const port = process.env.PORT || 8080;

const server = http.createServer((req, res) => {
    const filePath = req.url === '/' ? '/index.html' : req.url;
    const ext = path.extname(filePath);
    const mimeType = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
    };

    fs.readFile(path.join(__dirname, 'public', filePath), (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404: File not found');
        } else {
            res.writeHead(200, { 'Content-Type': mimeType[ext] || 'text/plain' });
            res.end(data);
        }
    });
});

const wss = new WebSocket.Server({ server });

let globalStartTime = null;
let isRunning = false;
let accumulatedTime = 0; // Keep track of the accumulated time when paused

// Broadcast a message to all connected clients
function broadcast(data) {
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

wss.on('connection', (ws) => {
    console.log('A new client connected.');

    // Send the current state to the newly connected client
    if (globalStartTime !== null) {
        if (isRunning) {
            ws.send(JSON.stringify({ type: 'start', startTime: globalStartTime, accumulatedTime }));
        } else {
            const stopTime = Date.now() - globalStartTime + accumulatedTime;
            ws.send(JSON.stringify({ type: 'stop', stopTime }));
        }
    }

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            if (data.type === 'start') {
                if (!isRunning) {
                    // Start the timer
                    globalStartTime = Date.now() - accumulatedTime;  // Adjust for accumulated time
                    isRunning = true;
                    console.log(`Timer started at ${globalStartTime}`);
                    broadcast({ type: 'start', startTime: globalStartTime, accumulatedTime });
                }
            } else if (data.type === 'stop') {
                if (isRunning) {
                    // Stop the timer
                    const stopTime = Date.now() - globalStartTime + accumulatedTime;
                    isRunning = false;
                    accumulatedTime = stopTime; // Store the time accumulated so far
                    console.log('Timer stopped');
                    broadcast({ type: 'stop', stopTime });
                }
            } else if (data.type === 'reset') {
                // Reset the timer
                globalStartTime = null;
                accumulatedTime = 0;
                isRunning = false;
                console.log('Timer reset');
                broadcast({ type: 'reset' });
            }
        } catch (error) {
            console.error('Error parsing message:', error.message);
        }
    });

    ws.on('close', () => console.log('A client disconnected.'));
    ws.on('error', (error) => console.error('WebSocket error:', error.message));
});

server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
