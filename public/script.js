let timer;
let isRunning = false;
let startTime = null;  // The moment when the timer started
let elapsedTime = 0;   // The time accumulated during pauses or stops

const display = document.getElementById('display');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const resetBtn = document.getElementById('resetBtn');

let ws;
let reconnectAttempts = 0;
let messageQueue = [];

const RECONNECT_DELAY = 5000;
const MAX_RECONNECT_ATTEMPTS = 10;

function setupWebSocket() {
    ws = new WebSocket('wss://server1-ehl6.onrender.com/');

    ws.onopen = () => {
        console.log('WebSocket connection established.');
        reconnectAttempts = 0;
        processMessageQueue();
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'start' && data.startTime) {
            // Sync start time from the server
            startTime = data.startTime - elapsedTime;  // Adjust for accumulated time
            isRunning = true;
            runTimer();
        }

        if (data.type === 'stop' && data.stopTime !== undefined) {
            clearInterval(timer);
            isRunning = false;
            elapsedTime = data.stopTime;  // Update with accurate stop time
            updateDisplay(elapsedTime);
        }

        if (data.type === 'reset') {
            clearInterval(timer);
            startTime = null;
            elapsedTime = 0;
            isRunning = false;
            updateDisplay(0);
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

startBtn.addEventListener('click', () => {
    if (!isRunning) {
        const now = Date.now();

        // If the timer is stopped or reset, we start fresh
        startTime = now;
        isRunning = true;

        // Send the start signal to the server with current startTime
        sendMessage({ type: 'start', startTime: now });

        // Immediately update the display to reflect the current elapsedTime
        updateDisplay(elapsedTime);

        // Start the timer update function
        runTimer();
    }
});

stopBtn.addEventListener('click', () => {
    if (isRunning) {
        clearInterval(timer);
        isRunning = false;

        // Calculate the stop time and update display
        const stopTime = Date.now() - startTime + elapsedTime;
        updateDisplay(stopTime);

        // Send the stop signal to the server
        sendMessage({ type: 'stop', stopTime });
    }
});

resetBtn.addEventListener('click', () => {
    clearInterval(timer);
    startTime = null;
    elapsedTime = 0;
    isRunning = false;

    // Send reset message to the server
    sendMessage({ type: 'reset' });

    // Reset the display
    updateDisplay(0);
});

function runTimer() {
    timer = setInterval(() => {
        if (!isRunning) {
            clearInterval(timer);
            return;
        }

        // Calculate the total time passed
        const now = Date.now();
        const timePassed = now - startTime + elapsedTime;
        updateDisplay(timePassed);
    }, 10); // Update every 10 milliseconds
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

setupWebSocket();
