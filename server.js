const http = require('http');
const path = require('path');
const fs = require('fs');
const WebSocket = require('ws');

// Use Render's PORT environment variable or default to 8080
const port = process.env.PORT || 8080;

// Create an HTTP server to serve static files
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

// WebSocket Server to handle timer state
const wss = new WebSocket.Server({ server });

// Global state for the timer
let globalStartTime = null;
let isRunning = false;

wss.on('connection', (ws) => {
    console.log('A new client connected.');

    // Send the current timer state to the newly connected client
    if (globalStartTime && isRunning) {
        ws.send(JSON.stringify({ type: 'start', startTime: globalStartTime, timestamp: Date.now() }));
    }

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            if (data.type === 'start') {
                if (!isRunning) {
                    globalStartTime = Date.now();
                    isRunning = true;
                    console.log(`Timer started at ${globalStartTime}`);
                    broadcast({ type: 'start', startTime: globalStartTime, timestamp: Date.now() });
                }
            } else if (data.type === 'stop') {
                if (isRunning) {
                    const stopTime = Date.now() - globalStartTime;  // Calculate the stop time on the server
                    isRunning = false;
                    console.log('Timer stopped');
                    broadcast({ type: 'stop', stopTime });  // Broadcast stop time to all clients
                }
            } else if (data.type === 'reset') {
                globalStartTime = null;
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

// Function to broadcast messages to all clients
function broadcast(data) {
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

// Start the server
server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});