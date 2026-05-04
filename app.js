const STORAGE_KEY = 'habitflow_data';
const MS_PER_DAY = 86400000;

let state = { habits: [] };
let tempState = null; 
let simOffsetDays = 0;
let isProcessingFallo = false;
let editingHabitId = null;
let isSimulating = false;

function init() {
    loadData();
    setupEventListeners();
    
    // Cambiamos el título para confirmar que la versión es la nueva
    const titleHeader = document.querySelector('h1');
    if (titleHeader) titleHeader.innerHTML = 'Habit<span>Flow</span> <small style="font-size:12px; color:var(--primary)">V2</small>';
    
    renderHabits();
    setInterval(updateLiveClocks, 1000);

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').then(reg => {
            reg.update();
            reg.onupdatefound = () => {
                const newWorker = reg.installing;
                newWorker.onstatechange = () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        if (confirm('Nueva versión detectada. ¿Actualizar ahora?')) {
                            window.location.reload();
                        }
                    }
                };
            };
        });
    }
}

function loadData() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        state = JSON.parse(saved);
    }
}

function saveData() {
    if (!isSimulating) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
}

function setupEventListeners() {
    document.getElementById('add-habit-btn').onclick = () => openHabitModal();
    document.getElementById('cancel-modal').onclick = closeModal;
    document.getElementById('modal-overlay').onclick = (e) => { 
        if (e.target === document.getElementById('modal-overlay')) closeModal(); 
    };
    document.getElementById('save-habit').onclick = handleSaveHabit;
    document.getElementById('open-sim-btn').onclick = openSimModal;
    document.getElementById('close-sim').onclick = closeSimModal;
}

function openHabitModal(habitId = null) {
    if (isSimulating) return alert("Sal del simulador para editar.");
    editingHabitId = habitId;
    const nameInput = document.getElementById('habit-name');
    const manualGroup = document.getElementById('manual-edit-group');
    const daysInput = document.getElementById('habit-days');
    
    document.getElementById('sim-modal').classList.add('hidden');

    if (habitId) {
        const habit = state.habits.find(h => h.id === habitId);
        document.getElementById('modal-title').innerText = 'Editar Hábito';
        nameInput.value = habit.name;
        manualGroup.classList.remove('hidden');
        daysInput.value = calculateDays(habit);
    } else {
        document.getElementById('modal-title').innerText = 'Nuevo Hábito';
        nameInput.value = '';
        manualGroup.classList.add('hidden');
        daysInput.value = 0;
    }
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById('habit-modal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.getElementById('habit-modal').classList.add('hidden');
    document.getElementById('sim-modal').classList.add('hidden');
}

function handleSaveHabit() {
    const name = document.getElementById('habit-name').value.trim();
    const manualDays = parseInt(document.getElementById('habit-days').value) || 0;
    if (!name) return;
    const now = Date.now();
    
    if (editingHabitId) {
        const index = state.habits.findIndex(h => h.id === editingHabitId);
        state.habits[index].name = name;
        state.habits[index].startTime = now - (manualDays * MS_PER_DAY);
        state.habits[index].streak = manualDays;
    } else {
        state.habits.push({
            id: Date.now().toString(),
            name: name,
            startTime: now - (manualDays * MS_PER_DAY),
            lastFalloAt: 0,
            streak: manualDays,
            maxStreak: manualDays
        });
    }
    saveData();
    renderHabits();
    closeModal();
}

function handleFallo(id) {
    if (isProcessingFallo) return;
    isProcessingFallo = true;

    const currentState = isSimulating ? tempState : state;
    const habit = currentState.habits.find(h => h.id === id);
    const now = Date.now() + (simOffsetDays * MS_PER_DAY);
    
    const diasDelReloj = calculateDays(habit);
    const totalAcumulado = (habit.streak || 0) + diasDelReloj;
    
    habit.maxStreak = Math.max(habit.maxStreak || 0, totalAcumulado);

    let penalty = 0;
    if (habit.lastFalloAt > 0) {
        const diffHours = (now - habit.lastFalloAt) / (1000 * 60 * 60);
        if (diffHours < 24) penalty = 4;
        else if (diffHours < 48) penalty = 3;
        else if (diffHours < 72) penalty = 2;
        else if (diffHours < 96) penalty = 1;
    }

    habit.streak = Math.max(0, totalAcumulado - penalty);
    habit.startTime = now; 
    habit.lastFalloAt = now;

    saveData();
    renderHabits();
    
    setTimeout(() => { isProcessingFallo = false; }, 500);
}

function calculateDays(habit) {
    const now = Date.now() + (simOffsetDays * MS_PER_DAY);
    const diff = now - habit.startTime;
    return Math.max(0, Math.floor(diff / MS_PER_DAY));
}

function formatClock(startTime) {
    const now = Date.now() + (simOffsetDays * MS_PER_DAY);
    const diff = now - startTime;
    if (diff < 0) return "00:00:00";
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function updateLiveClocks() {
    const currentState = isSimulating ? tempState : state;
    currentState.habits.forEach(habit => {
        const clockEl = document.querySelector(`[data-id="${habit.id}"] .live-clock`);
        if (clockEl) clockEl.innerText = formatClock(habit.startTime);
    });
}

function openSimModal() {
    isSimulating = true;
    tempState = JSON.parse(JSON.stringify(state));
    simOffsetDays = 0;
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById('sim-modal').classList.remove('hidden');
    document.getElementById('sim-days-val').innerText = '0';
    renderHabits();
}

function closeSimModal() {
    isSimulating = false;
    tempState = null;
    simOffsetDays = 0;
    loadData(); 
    closeModal();
    renderHabits();
}

function adjustSim(amount) {
    simOffsetDays = Math.max(0, simOffsetDays + amount);
    document.getElementById('sim-days-val').innerText = simOffsetDays;
    renderHabits();
}

function renderHabits() {
    const habitList = document.getElementById('habit-list');
    habitList.innerHTML = '';
    const currentState = isSimulating ? tempState : state;
    
    currentState.habits.forEach((habit) => {
        const days = calculateDays(habit);
        const card = document.createElement('div');
        card.className = 'habit-card';
        if (isSimulating) card.style.boxShadow = "0 0 10px var(--primary)";
        
        card.dataset.id = habit.id;
        card.innerHTML = `
            <div class="habit-header">
                <div class="habit-name-container">
                    <span class="streak-label">Racha: ${habit.streak || 0}</span>
                    <span class="habit-name">${habit.name} ${isSimulating ? '🧪' : ''}</span>
                    <span class="record-label">Record: ${habit.maxStreak || 0}</span>
                </div>
            </div>
            <div class="habit-body">
                <div class="day-counter">${days}</div>
                <div class="day-label">${days === 1 ? 'Día' : 'Días'}</div>
                <div class="live-clock">${formatClock(habit.startTime)}</div>
            </div>
            <div class="habit-footer">
                <button class="btn-fallo" onclick="handleFallo('${habit.id}')">FALLO</button>
                <button class="btn-edit" onclick="openHabitModal('${habit.id}')" ${isSimulating ? 'disabled' : ''}>⚙️</button>
            </div>`;
        habitList.appendChild(card);
    });
}

// Globalizar funciones para botones HTML
window.handleFallo = handleFallo;
window.openHabitModal = openHabitModal;
window.adjustSim = adjustSim;
init();