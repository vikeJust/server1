let timer;
let isRunning = false;
let startTime = null;
let elapsedTime = 0;

const display = document.getElementById('display');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const resetBtn = document.getElementById('resetBtn');

// WebSocket connection
let ws;

function setupWebSocket() {
    ws = new WebSocket('wss://server1-ehl6.onrender.com/');

    ws.onopen = () => {
        console.log('WebSocket connection established.');
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'start' && data.startTime) {
            startTime = data.startTime - (elapsedTime || 0); // Sync elapsed time from server
            isRunning = true;
            runTimer();
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
    };

    ws.onclose = (event) => {
        console.warn('WebSocket closed. Reconnecting in 5 seconds...', event.reason);
        setTimeout(setupWebSocket, 5000); // Reconnect after 5 seconds
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
}

// Start WebSocket connection
setupWebSocket();

// Send messages through WebSocket
function sendMessage(message) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
    } else {
        console.error('WebSocket is not open. Message not sent:', message);
    }
}

// Start button functionality
startBtn.addEventListener('click', () => {
    if (!isRunning) {
        sendMessage({ type: 'start' });
    }
});

// Stop button functionality
stopBtn.addEventListener('click', () => {
    if (isRunning) {
        sendMessage({ type: 'stop' });
    }
});

// Reset button functionality
resetBtn.addEventListener('click', () => {
    sendMessage({ type: 'reset' });
});

// Function to run the timer
function runTimer() {
    if (!startTime) {
        console.error('Timer cannot start without a valid startTime');
        return;
    }

    clearInterval(timer);

    updateDisplay(Date.now() - startTime); // Immediate display update

    timer = setInterval(() => {
        if (!isRunning) {
            clearInterval(timer);
            return;
        }
        updateDisplay(Date.now() - startTime);
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
