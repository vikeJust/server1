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

const RECONNECT_DELAY = 5000; 
const MAX_RECONNECT_ATTEMPTS = 10; 
const PING_INTERVAL = 30000;
const PONG_TIMEOUT = 10000; 

function setupWebSocket() {
    ws = new WebSocket('wss://server1-ehl6.onrender.com/');

    ws.onopen = () => {
        console.log('WebSocket connection established.');
        reconnectAttempts = 0;
        processMessageQueue();
        startPingPong();
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'start' && data.startTime) {
           
            if (!startTime || !isRunning) {
                startTime = data.startTime - elapsedTime; 
                isRunning = true;
                runTimer();
            }
        }

        if (data.type === 'stop' && data.stopTime !== undefined) {
            clearInterval(timer);
            isRunning = false;
            elapsedTime = data.stopTime; 
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
            clearTimeout(pongTimeout); 
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

function handleReconnection() {
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        console.log(`Attempting to reconnect... (Attempt ${reconnectAttempts} of ${MAX_RECONNECT_ATTEMPTS})`);
        setTimeout(setupWebSocket, RECONNECT_DELAY);
    } else {
        console.error('Max reconnection attempts reached. Could not reconnect.');
    }
}

function processMessageQueue() {
    while (ws.readyState === WebSocket.OPEN && messageQueue.length > 0) {
        const message = messageQueue.shift();
        ws.send(JSON.stringify(message));
        console.log('Queued message sent:', message);
    }
}

function sendMessage(message) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
    } else {
        console.warn('WebSocket is not open. Queuing message:', message);
        messageQueue.push(message);
    }
}

function startPingPong() {
    pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
            console.log('Sending ping...');
            ws.send(JSON.stringify({ type: 'ping' }));
            pongTimeout = setTimeout(() => {
                console.error('No pong response received, attempting reconnection...');
                ws.close();
            }, PONG_TIMEOUT);
        }
    }, PING_INTERVAL);
}

setupWebSocket();

startBtn.addEventListener('click', () => {
    if (!isRunning) {

        startTime = Date.now() - elapsedTime; 
        isRunning = true;
        runTimer();

        sendMessage({ type: 'start' });
    }
});

stopBtn.addEventListener('click', () => {
    if (isRunning) {
        clearInterval(timer);
        isRunning = false;
        sendMessage({ type: 'stop' });
    }
});

resetBtn.addEventListener('click', () => {
    sendMessage({ type: 'reset' });
});

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

function updateDisplay(totalMilliseconds) {
    if (totalMilliseconds < 0) {
        totalMilliseconds = 0;
    }

    const seconds = Math.floor(totalMilliseconds / 1000);
    const milliseconds = totalMilliseconds % 1000;
    display.textContent = formatTime(seconds, milliseconds);
}

function formatTime(seconds, milliseconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    const ms = Math.floor(milliseconds / 10);
    return `${pad(hours)}:${pad(minutes)}:${pad(secs)}.${pad(ms, 2)}`;
}

function pad(num, size = 2) {
    return num.toString().padStart(size, '0');
}
