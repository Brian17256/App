// HabitFlow AMOLED - Logic
const STORAGE_KEY = 'habitflow_data';
const MS_PER_DAY = 86400000;

let state = {
    habits: [],
    simOffset: 0 // in days
};

// Initialize App
function init() {
    loadData();
    setupEventListeners();
    renderHabits();
    
    // Refresh counters every minute
    setInterval(renderHabits, 60000);

    // Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js');
    }
}

function loadData() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        state = JSON.parse(saved);
        // Ensure legacy data or missing fields are handled
        if (!state.simOffset) state.simOffset = 0;
    }
}

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// UI Elements
const habitList = document.getElementById('habit-list');
const addBtn = document.getElementById('add-habit-btn');
const settingsBtn = document.getElementById('settings-btn');
const overlay = document.getElementById('modal-overlay');
const habitModal = document.getElementById('habit-modal');
const settingsModal = document.getElementById('settings-modal');
const cancelModal = document.getElementById('cancel-modal');
const saveHabitBtn = document.getElementById('save-habit');
const closeSettingsBtn = document.getElementById('close-settings');

// Modal State
let editingHabitId = null;

// Event Listeners
function setupEventListeners() {
    addBtn.onclick = () => openHabitModal();
    settingsBtn.onclick = () => openSettingsModal();
    cancelModal.onclick = closeModal;
    closeSettingsBtn.onclick = closeModal;
    overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };

    saveHabitBtn.onclick = handleSaveHabit;
    document.getElementById('reset-habit').onclick = () => {
        if (confirm('¿Resetear el contador de este hábito a 0?')) {
            const habit = state.habits.find(h => h.id === editingHabitId);
            habit.startTime = Date.now() + (state.simOffset * MS_PER_DAY);
            saveData();
            renderHabits();
            closeModal();
        }
    };

    // Simulation controls
    document.getElementById('sim-plus').onclick = () => {
        state.simOffset++;
        updateSimDisplay();
        saveData();
        renderHabits();
    };
    document.getElementById('sim-minus').onclick = () => {
        state.simOffset = Math.max(0, state.simOffset - 1);
        updateSimDisplay();
        saveData();
        renderHabits();
    };

    document.getElementById('reset-all').onclick = () => {
        if (confirm('¿Estás seguro de que quieres borrar TODOS los hábitos?')) {
            state.habits = [];
            saveData();
            renderHabits();
            closeModal();
        }
    };
}

// Modal Handlers
function openHabitModal(habitId = null) {
    editingHabitId = habitId;
    const title = document.getElementById('modal-title');
    const nameInput = document.getElementById('habit-name');
    const manualGroup = document.getElementById('manual-edit-group');
    const daysInput = document.getElementById('habit-days');
    const resetBtn = document.getElementById('reset-habit');

    if (habitId) {
        const habit = state.habits.find(h => h.id === habitId);
        title.innerText = 'Editar Hábito';
        nameInput.value = habit.name;
        manualGroup.classList.remove('hidden');
        resetBtn.classList.remove('hidden');
        daysInput.value = calculateDays(habit);
    } else {
        title.innerText = 'Nuevo Hábito';
        nameInput.value = '';
        manualGroup.classList.add('hidden');
        resetBtn.classList.add('hidden');
        daysInput.value = 0;
    }

    overlay.classList.remove('hidden');
    habitModal.classList.remove('hidden');
    settingsModal.classList.add('hidden');
    nameInput.focus();
}

function openSettingsModal() {
    overlay.classList.remove('hidden');
    settingsModal.classList.remove('hidden');
    habitModal.classList.add('hidden');
    updateSimDisplay();
}

function closeModal() {
    overlay.classList.add('hidden');
    habitModal.classList.add('hidden');
    settingsModal.classList.add('hidden');
    editingHabitId = null;
}

function updateSimDisplay() {
    document.getElementById('sim-days-display').innerText = state.simOffset;
}

// Logic Handlers
function handleSaveHabit() {
    const name = document.getElementById('habit-name').value.trim();
    const manualDays = parseInt(document.getElementById('habit-days').value) || 0;
    if (!name) return alert('Por favor ingresa un nombre');

    const now = Date.now();
    const offsetMs = state.simOffset * MS_PER_DAY;
    
    if (editingHabitId) {
        const index = state.habits.findIndex(h => h.id === editingHabitId);
        state.habits[index].name = name;
        
        // If manual days edited, adjust startTime
        // days = floor((now + simOffset - startTime) / MS_PER_DAY)
        // startTime = (now + simOffset) - (days * MS_PER_DAY)
        state.habits[index].startTime = (now + offsetMs) - (manualDays * MS_PER_DAY);
    } else {
        const newHabit = {
            id: Date.now().toString(),
            name: name,
            startTime: now + offsetMs,
            lastFalloAt: 0,
            streak: 0,
            order: state.habits.length
        };
        state.habits.push(newHabit);
    }

    saveData();
    renderHabits();
    closeModal();
}

function handleFallo(id) {
    const habit = state.habits.find(h => h.id === id);
    const now = Date.now() + (state.simOffset * MS_PER_DAY);
    const daysCompleted = calculateDays(habit);

    // Update Streak Label logic
    // Penalty logic:
    let penalty = 0;
    if (habit.lastFalloAt > 0) {
        const diffMs = now - habit.lastFalloAt;
        const diffHours = diffMs / (1000 * 60 * 60);

        if (diffHours < 24) penalty = 4;
        else if (diffHours < 48) penalty = 3;
        else if (diffHours < 72) penalty = 2;
        else if (diffHours < 96) penalty = 1;
    }

    // New streak is the one they reached before falling
    // But wait, the user said "al presionar ese boton habra un texto que diga racha: el cual registrara la racha que lleve hasta el momento"
    // And "si presiono el boton de fallo cuando llevo 5 dias pues entonces el texto dira racha: 5"
    // "si presiono el boton al siguiente dia... disminuye la racha en tres"
    
    // Logic: 
    // 1. Current streak becomes the days we just reached.
    // 2. Apply penalty based on time since LAST failure.
    
    let baseStreak = daysCompleted;
    habit.streak = Math.max(0, habit.streak + baseStreak - penalty); 
    // Actually, usually streak means the highest reached or cumulative with penalties.
    // User says: "si presiono fallo cuando llevo 5 pues racha: 5. Si luego 7... racha: 7 (or total?)"
    // Looking at "disminuira en 4... si tenia 5... me quedaria un solo dia de racha".
    // This implies the streak is a stored value that accumulates or updates.
    
    // Let's stick to the user's specific penalty math:
    // currentStreak = habit.streak (the one saved)
    // if I fail at 5 days, I had 5 days. 
    // The user's example: "si presiono... cuando llevo 5... racha: 5".
    // This means the "Racha" displayed is what I just lost? 
    // No, "si despues duro 7... racha: 7". It seems it's the "Record" or the "Last streak".
    // BUT the penalty logic "disminuira en 4... si tenia 5... me quedaria 1" means the Streak is a persistent score.
    
    // Correct interpretation of "Racha" persistent score:
    habit.streak = Math.max(0, habit.streak + daysCompleted - penalty);

    habit.lastFalloAt = now;
    habit.startTime = now; // Reset counter

    saveData();
    
    // Animation
    const card = document.querySelector(`[data-id="${id}"]`);
    card.classList.add('reset-animation');
    setTimeout(() => {
        renderHabits();
    }, 500);
}

function calculateDays(habit) {
    const now = Date.now() + (state.simOffset * MS_PER_DAY);
    const diff = now - habit.startTime;
    return Math.max(0, Math.floor(diff / MS_PER_DAY));
}

function deleteHabit(id) {
    if (confirm('¿Borrar este hábito?')) {
        state.habits = state.habits.filter(h => h.id !== id);
        saveData();
        renderHabits();
    }
}

function moveHabit(id, direction) {
    const index = state.habits.findIndex(h => h.id === id);
    if (direction === 'up' && index > 0) {
        [state.habits[index], state.habits[index - 1]] = [state.habits[index - 1], state.habits[index]];
    } else if (direction === 'down' && index < state.habits.length - 1) {
        [state.habits[index], state.habits[index + 1]] = [state.habits[index + 1], state.habits[index]];
    }
    saveData();
    renderHabits();
}

function renderHabits() {
    habitList.innerHTML = '';
    
    if (state.habits.length === 0) {
        habitList.innerHTML = `
            <div style="text-align: center; color: var(--text-dim); margin-top: 50px;">
                <p>No hay hábitos aún.</p>
                <p>Presiona + para comenzar.</p>
            </div>
        `;
        return;
    }

    state.habits.forEach((habit, index) => {
        const days = calculateDays(habit);
        const card = document.createElement('div');
        card.className = 'habit-card';
        card.dataset.id = habit.id;
        
        card.innerHTML = `
            <div class="habit-header">
                <div class="habit-name-container">
                    <span class="streak-label">Racha: ${habit.streak}</span>
                    <span class="habit-name">${habit.name}</span>
                </div>
                <div class="habit-options">
                    <button class="icon-btn" onclick="moveHabit('${habit.id}', 'up')" ${index === 0 ? 'disabled style="opacity:0.2"' : ''}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 15l-6-6-6 6"/></svg>
                    </button>
                    <button class="icon-btn" onclick="moveHabit('${habit.id}', 'down')" ${index === state.habits.length - 1 ? 'disabled style="opacity:0.2"' : ''}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
                    </button>
                </div>
            </div>
            <div class="habit-body">
                <div class="day-counter">${days}</div>
                <div class="day-label">${days === 1 ? 'Día' : 'Días'}</div>
            </div>
            <div class="habit-footer">
                <button class="btn-fallo" onclick="handleFallo('${habit.id}')">FALLO</button>
                <button class="btn-edit" onclick="openHabitModal('${habit.id}')">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button class="btn-edit" onclick="deleteHabit('${habit.id}')" style="color: var(--danger)">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                </button>
            </div>
        `;
        habitList.appendChild(card);
    });
}

// Global functions for inline onclick
window.handleFallo = handleFallo;
window.openHabitModal = openHabitModal;
window.deleteHabit = deleteHabit;
window.moveHabit = moveHabit;

init();
