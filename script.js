// Calculator State
const state = {
    currentValue: '0',
    previousValue: null,
    operator: null,
    waitingForSecondOperand: false,
    history: '',
    mathHistory: [],
    isLoggedIn: false,
    errorState: false
};

// DOM Elements
const display = {
    current: document.getElementById('current'),
    history: document.getElementById('history')
};

// Error Handling
function handleError(error) {
    state.currentValue = 'Error';
    state.errorState = true;
    updateDisplay();
    console.error(error);
    setTimeout(() => {
        clearCalculator();
        state.errorState = false;
    }, 2000);
}

// Mode Switching
const normalMode = document.getElementById('normalMode');
const scientificMode = document.getElementById('scientificMode');
const normalKeypad = document.getElementById('normal-keypad');
const scientificKeypad = document.getElementById('scientific-keypad');

normalMode.addEventListener('click', () => switchMode('normal'));
scientificMode.addEventListener('click', () => switchMode('scientific'));

function switchMode(mode) {
    if (mode === 'normal') {
        normalMode.classList.add('active');
        scientificMode.classList.remove('active');
        normalKeypad.classList.replace('hidden-keypad', 'active-keypad');
        scientificKeypad.classList.replace('active-keypad', 'hidden-keypad');
    } else {
        scientificMode.classList.add('active');
        normalMode.classList.remove('active');
        scientificKeypad.classList.replace('hidden-keypad', 'active-keypad');
        normalKeypad.classList.replace('active-keypad', 'hidden-keypad');
    }
}

// Calculator Functions
function updateDisplay() {
    if (state.errorState) {
        display.current.textContent = state.currentValue;
        display.history.textContent = '';
        return;
    }
    
    try {
        // Format numbers to prevent overflow
        const formatNumber = (num) => {
            if (num === Infinity || num === -Infinity) {
                throw new Error('Number too large');
            }
            const str = String(num);
            if (str.length > 15) {
                return Number(num).toExponential(10);
            }
            return str;
        };

        display.current.textContent = formatNumber(state.currentValue);
        display.history.textContent = state.history;
    } catch (error) {
        handleError(error);
    }
}

function clearCalculator() {
    state.currentValue = '0';
    state.previousValue = null;
    state.operator = null;
    state.waitingForSecondOperand = false;
    state.history = '';
    state.errorState = false;
    updateDisplay();
}

function inputDigit(digit) {
    if (state.errorState) return;
    
    try {
        if (state.waitingForSecondOperand) {
            state.currentValue = digit;
            state.waitingForSecondOperand = false;
        } else {
            state.currentValue = state.currentValue === '0' ? digit : state.currentValue + digit;
        }
        updateDisplay();
    } catch (error) {
        handleError(error);
    }
}

function inputDecimal() {
    if (state.errorState) return;
    
    if (state.waitingForSecondOperand) {
        state.currentValue = '0.';
        state.waitingForSecondOperand = false;
        updateDisplay();
        return;
    }
    
    if (!state.currentValue.includes('.')) {
        state.currentValue += '.';
        updateDisplay();
    }
}

function handleOperator(nextOperator) {
    if (state.errorState) return;
    
    try {
        const inputValue = parseFloat(state.currentValue);

        if (isNaN(inputValue)) {
            throw new Error('Invalid number');
        }

        if (state.operator && state.waitingForSecondOperand) {
            state.operator = nextOperator;
            state.history = `${state.previousValue} ${nextOperator}`;
            updateDisplay();
            return;
        }

        if (state.previousValue === null) {
            state.previousValue = inputValue;
        } else if (state.operator) {
            const result = calculate(state.previousValue, inputValue, state.operator);
            state.currentValue = String(result);
            state.previousValue = result;
        }

        state.waitingForSecondOperand = true;
        state.operator = nextOperator;
        state.history = `${state.previousValue} ${nextOperator}`;
        updateDisplay();
    } catch (error) {
        handleError(error);
    }
}

function calculate(firstOperand, secondOperand, operator) {
    if (isNaN(firstOperand) || isNaN(secondOperand)) {
        throw new Error('Invalid operands');
    }

    switch (operator) {
        case '+': return firstOperand + secondOperand;
        case '-': return firstOperand - secondOperand;
        case '*': return firstOperand * secondOperand;
        case '/': 
            if (secondOperand === 0) throw new Error('Division by zero');
            return firstOperand / secondOperand;
        case '%': 
            if (secondOperand === 0) throw new Error('Modulo by zero');
            return firstOperand % secondOperand;
        default: return secondOperand;
    }
}

// Scientific Calculator Functions
function handleScientific(action) {
    if (state.errorState) return;
    
    try {
        let result;
        const currentNum = parseFloat(state.currentValue);

        if (isNaN(currentNum)) {
            throw new Error('Invalid number');
        }

        switch(action) {
            case 'sin':
                result = Math.sin(currentNum * Math.PI / 180);
                break;
            case 'cos':
                result = Math.cos(currentNum * Math.PI / 180);
                break;
            case 'tan':
                if (currentNum % 90 === 0 && currentNum % 180 !== 0) {
                    throw new Error('Undefined');
                }
                result = Math.tan(currentNum * Math.PI / 180);
                break;
            case 'log':
                if (currentNum <= 0) throw new Error('Invalid input');
                result = Math.log10(currentNum);
                break;
            case 'ln':
                if (currentNum <= 0) throw new Error('Invalid input');
                result = Math.log(currentNum);
                break;
            case 'sqrt':
                if (currentNum < 0) throw new Error('Invalid input');
                result = Math.sqrt(currentNum);
                break;
            case 'pow':
                state.previousValue = currentNum;
                state.operator = '^';
                state.waitingForSecondOperand = true;
                state.history = `${currentNum} ^`;
                updateDisplay();
                return;
            case 'factorial':
                if (currentNum < 0 || !Number.isInteger(currentNum)) {
                    throw new Error('Invalid input');
                }
                result = factorial(currentNum);
                break;
            case 'pi':
                result = Math.PI;
                break;
            case 'e':
                result = Math.E;
                break;
        }

        if (result !== undefined) {
            // Store calculation in history
            const expression = `${action}(${currentNum})`;
            DataStore.addCalculation(expression, result);
            
            state.currentValue = String(result);
            updateDisplay();
            updateMathHistory();
        }
    } catch (error) {
        handleError(error);
    }
}

function factorial(n) {
    if (n > 170) throw new Error('Number too large');
    if (n === 0) return 1;
    let result = 1;
    for (let i = 2; i <= n; i++) result *= i;
    return result;
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Update auth status
    updateAuthStatus();

    document.querySelectorAll('#keypad button').forEach(button => {
        button.addEventListener('click', () => {
            if (button.classList.contains('number')) {
                inputDigit(button.textContent);
            } else if (button.classList.contains('decimal')) {
                inputDecimal();
            } else if (button.classList.contains('operator')) {
                const action = button.dataset.action;
                if (action === 'backspace') {
                    state.currentValue = state.currentValue.slice(0, -1) || '0';
                    updateDisplay();
                } else {
                    handleOperator(action);
                }
            } else if (button.classList.contains('equals')) {
                if (state.operator && !state.waitingForSecondOperand) {
                    const secondOperand = parseFloat(state.currentValue);
                    let result;
                    if (state.operator === '^') {
                        result = Math.pow(state.previousValue, secondOperand);
                    } else {
                        result = calculate(state.previousValue, secondOperand, state.operator);
                    }

                    // Add to calculation history
                    const expression = `${state.previousValue} ${state.operator} ${secondOperand}`;
                    DataStore.addCalculation(expression, result);
                    
                    state.currentValue = String(result);
                    state.history = '';
                    state.operator = null;
                    state.previousValue = null;
                    state.waitingForSecondOperand = false;
                    updateDisplay();
                    updateMathHistory();
                }
            } else if (button.classList.contains('clear')) {
                clearCalculator();
            } else if (button.classList.contains('scientific')) {
                handleScientific(button.dataset.action);
            }
        });
    });

    // Initialize chat
    addMessage("Hi! I'm your calculator assistant. Need help with calculations?", false);
});

// Auth Status
function updateAuthStatus() {
    const user = DataStore.currentUser;
    const authButtons = document.querySelector('.auth-buttons');
    
    if (user) {
        authButtons.innerHTML = `
            <span style="color: white; margin-right: 1rem;">Welcome, ${user.name}</span>
            ${user.role === 'admin' ? '<a href="admin.html" style="color: white; margin-right: 1rem;"><i class="fas fa-user-shield"></i></a>' : ''}
            <a href="#" onclick="handleLogout()" style="color: white; text-decoration: none;">Logout</a>
        `;
    } else {
        authButtons.innerHTML = `
            <a href="login.html" style="color: white; margin-right: 1rem; text-decoration: none;">Login</a>
            <a href="signup.html" style="color: white; text-decoration: none;">Sign Up</a>
        `;
    }
}

function handleLogout() {
    DataStore.logout();
    updateAuthStatus();
    clearCalculator();
}

// Math History Functions
function updateMathHistory() {
    const historyList = document.getElementById('history-list');
    if (historyList) {
        const calculations = DataStore.getRecentCalculations();
        historyList.innerHTML = calculations
            .map(calc => `
                <div class="history-item" style="padding: 0.5rem; border-bottom: 1px solid #ddd;">
                    ${calc.expression} = ${calc.result}
                </div>
            `)
            .join('');
    }
}

// Enhanced Chat Functions
function addMessage(message, isUser = false) {
    const chatWindow = document.getElementById('chat-window');
    const messageDiv = document.createElement('div');
    messageDiv.className = isUser ? 'user-message' : 'bot-message';
    messageDiv.textContent = message;
    chatWindow.appendChild(messageDiv);
    chatWindow.scrollTop = chatWindow.scrollHeight;

    // Save to chat history
    DataStore.addChatMessage(message, isUser);
}

function generateResponse(message) {
    const lowerMessage = message.toLowerCase();
    
    // Math-related questions
    if (lowerMessage.includes('factorial')) {
        return "To calculate factorial, use the x! button in scientific mode. For example, 5! = 5 × 4 × 3 × 2 × 1 = 120";
    }
    if (lowerMessage.includes('square root')) {
        return "To calculate square root, use the √ button in scientific mode or type sqrt()";
    }
    if (lowerMessage.includes('sin') || lowerMessage.includes('cos') || lowerMessage.includes('tan')) {
        return "Trigonometric functions are available in scientific mode. Note that values are calculated in degrees.";
    }
    if (lowerMessage.includes('pi')) {
        return "π (pi) is approximately 3.14159. You can use the π button in scientific mode.";
    }
    
    // History-related questions
    if (lowerMessage.includes('history')) {
        const calculations = DataStore.getRecentCalculations();
        if (calculations.length === 0) {
            return "No calculations in history yet. Try solving some problems!";
        }
        return "Here are your recent calculations:\n" + 
            calculations.map(calc => `${calc.expression} = ${calc.result}`).join('\n');
    }
    
    // Help
    if (lowerMessage.includes('help')) {
        return "I can help you with:\n- Basic calculations\n- Scientific functions\n- Math concepts\n- Viewing calculation history";
    }
    
    return "I'm here to help with calculations! Try asking about specific math operations or check your calculation history.";
}

function handleChat() {
    const chatInput = document.getElementById('chat-input');
    const message = chatInput.value.trim();
    
    if (message) {
        addMessage(message, true);
        const response = generateResponse(message);
        addMessage(response, false);
        chatInput.value = '';
    }
}

// Event Listeners
const sendButton = document.getElementById('send-btn');
const chatInput = document.getElementById('chat-input');

sendButton.addEventListener('click', handleChat);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleChat();
    }
});

// Update math history periodically
setInterval(updateMathHistory, 5000);

// Keyboard Support
document.addEventListener('keydown', (event) => {
    if (event.key >= '0' && event.key <= '9') {
        inputDigit(event.key);
    } else if (event.key === '.') {
        inputDecimal();
    } else if (['+', '-', '*', '/', '%'].includes(event.key)) {
        handleOperator(event.key);
    } else if (event.key === 'Enter' || event.key === '=') {
        document.querySelector('[data-action="="]').click();
    } else if (event.key === 'Backspace') {
        state.currentValue = state.currentValue.slice(0, -1) || '0';
        updateDisplay();
    } else if (event.key === 'Escape') {
        clearCalculator();
    }
});
