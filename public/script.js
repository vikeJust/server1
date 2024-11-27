let timer;
let isRunning = false;
let startTime = null;
let elapsedTime = 0;

const display = document.getElementById('display');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const resetBtn = document.getElementById('resetBtn');

// WebSocket connection variables
let ws;
let reconnectAttempts = 0;
let pingInterval;
let pongTimeout;
let messageQueue = [];

const RECONNECT_DELAY = 5000; // 5 seconds for reconnecting
const MAX_RECONNECT_ATTEMPTS = 10; // Max number of reconnect attempts
const PING_INTERVAL = 30000; // 30 seconds for sending ping
const PONG_TIMEOUT = 10000; // 10 seconds to wait for pong

// Function to establish WebSocket connection
function setupWebSocket() {
    ws = new WebSocket('wss://server1-ehl6.onrender.com/');

    ws.onopen = () => {
        console.log('WebSocket connection established.');
        reconnectAttempts = 0; // Reset reconnect attempts
        processMessageQueue(); // Send any queued messages
        startPingPong(); // Start sending pings
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'start' && data.startTime) {
            // Prevent resetting to zero; smoothly synchronize with server's time
            if (!startTime || !isRunning) {
                startTime = data.startTime - elapsedTime; // Adjust based on elapsed time
                isRunning = true;
                runTimer();
            }
        }

        if (data.type === 'stop' && data.stopTime !== undefined) {
            clearInterval(timer);
            isRunning = false;
            elapsedTime = data.stopTime; // Use the server's precise stop time
            updateDisplay(elapsedTime);
        }

        if (data.type === 'reset') {
            clearInterval(timer);
            startTime = null;
            elapsedTime = 0;
            isRunning = false;
            updateDisplay(0);
        }

        if (data.type === 'pong') {
            clearTimeout(pongTimeout); // Clear the pong timeout on receiving pong
            console.log('Pong received');
        }
    };

    ws.onclose = (event) => {
        console.warn('WebSocket closed. Reconnecting in 5 seconds...', event.reason);
        handleReconnection();
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        handleReconnection();
    };
}

// Function to handle reconnection
function handleReconnection() {
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        console.log(`Attempting to reconnect... (Attempt ${reconnectAttempts} of ${MAX_RECONNECT_ATTEMPTS})`);
        setTimeout(setupWebSocket, RECONNECT_DELAY);
    } else {
        console.error('Max reconnection attempts reached. Could not reconnect.');
    }
}

// Function to process the queued messages when WebSocket is open
function processMessageQueue() {
    while (ws.readyState === WebSocket.OPEN && messageQueue.length > 0) {
        const message = messageQueue.shift();
        ws.send(JSON.stringify(message));
        console.log('Queued message sent:', message);
    }
}

// Send messages through WebSocket
function sendMessage(message) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
    } else {
        console.warn('WebSocket is not open. Queuing message:', message);
        messageQueue.push(message);
    }
}

// Function to start sending ping/pong messages
function startPingPong() {
    pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
            console.log('Sending ping...');
            ws.send(JSON.stringify({ type: 'ping' }));
            pongTimeout = setTimeout(() => {
                console.error('No pong response received, attempting reconnection...');
                ws.close(); // Force close the WebSocket to trigger reconnection
            }, PONG_TIMEOUT);
        }
    }, PING_INTERVAL);
}

// Start WebSocket connection
setupWebSocket();

// Start button functionality
startBtn.addEventListener('click', () => {
    if (!isRunning) {
        // Start locally before the server responds
        startTime = Date.now() - elapsedTime; // Approximate start time
        isRunning = true;
        runTimer();

        // Notify the server to start
        sendMessage({ type: 'start' });
    }
});

// Stop button functionality
stopBtn.addEventListener('click', () => {
    if (isRunning) {
        clearInterval(timer); // Stop the visual updates immediately
        isRunning = false;
        sendMessage({ type: 'stop' });
    }
});

// Reset button functionality
resetBtn.addEventListener('click', () => {
    sendMessage({ type: 'reset' });
});

// Function to run the timer
function runTimer() {
    clearInterval(timer);

    timer = setInterval(() => {
        if (!isRunning) {
            clearInterval(timer);
            return;
        }

        const now = Date.now();
        const timePassed = now - startTime;
        updateDisplay(timePassed);
    }, 10);
}

// Function to update the display
function updateDisplay(totalMilliseconds) {
    if (totalMilliseconds < 0) {
        totalMilliseconds = 0; // Prevent negative values
    }

    const seconds = Math.floor(totalMilliseconds / 1000);
    const milliseconds = totalMilliseconds % 1000;
    display.textContent = formatTime(seconds, milliseconds);
}

// Format time for display
function formatTime(seconds, milliseconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    const ms = Math.floor(milliseconds / 10);
    return `${pad(hours)}:${pad(minutes)}:${pad(secs)}.${pad(ms, 2)}`;
}

// Pad single digit numbers with leading zeroes
function pad(num, size = 2) {
    return num.toString().padStart(size, '0');
}
