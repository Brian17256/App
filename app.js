// HabitFlow AMOLED - Logic Optimized
const STORAGE_KEY = 'habitflow_data';
const MS_PER_DAY = 86400000;

let state = { habits: [] };
let simOffsetDays = 0;
let isProcessingFallo = false;
let editingHabitId = null;

function init() {
    loadData();
    setupEventListeners();
    renderHabits();
    
    // Solo actualiza los relojes, no redibuja las tarjetas (evita parpadeo)
    setInterval(updateLiveClocks, 1000);

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js');
    }
}

function loadData() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        state = JSON.parse(saved);
        if (state.simOffset !== undefined) delete state.simOffset;
    }
}

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
    editingHabitId = habitId;
    const nameInput = document.getElementById('habit-name');
    const manualGroup = document.getElementById('manual-edit-group');
    const daysInput = document.getElementById('habit-days');
    const title = document.getElementById('modal-title');

    // Ocultar otros modales para que no se encimen
    document.getElementById('sim-modal').classList.add('hidden');

    if (habitId) {
        const habit = state.habits.find(h => h.id === habitId);
        title.innerText = 'Editar Hábito';
        nameInput.value = habit.name;
        manualGroup.classList.remove('hidden');
        daysInput.value = calculateDays(habit);
    } else {
        title.innerText = 'Nuevo Hábito';
        nameInput.value = '';
        manualGroup.classList.add('hidden');
        daysInput.value = 0;
    }

    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById('habit-modal').classList.remove('hidden');
    nameInput.focus();
}

function closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.getElementById('habit-modal').classList.add('hidden');
    document.getElementById('sim-modal').classList.add('hidden');
    editingHabitId = null;
}

function handleSaveHabit() {
    const name = document.getElementById('habit-name').value.trim();
    const manualDays = parseInt(document.getElementById('habit-days').value) || 0;
    if (!name) return alert('Por favor ingresa un nombre');

    const now = Date.now();
    
    if (editingHabitId) {
        const index = state.habits.findIndex(h => h.id === editingHabitId);
        state.habits[index].name = name;
        state.habits[index].startTime = now - (manualDays * MS_PER_DAY);
        state.habits[index].maxStreak = Math.max(state.habits[index].maxStreak || 0, manualDays);
    } else {
        const newHabit = {
            id: Date.now().toString(),
            name: name,
            startTime: now - (manualDays * MS_PER_DAY),
            lastFalloAt: 0,
            streak: 0,
            maxStreak: manualDays,
            order: state.habits.length
        };
        state.habits.push(newHabit);
    }

    saveData();
    renderHabits();
    closeModal();
}

function handleFallo(id) {
    if (isProcessingFallo) return;
    isProcessingFallo = true;

    const habit = state.habits.find(h => h.id === id);
    const now = Date.now();
    const daysCompleted = calculateDays(habit);

    let penalty = 0;
    if (habit.lastFalloAt > 0) {
        const diffHours = (now - habit.lastFalloAt) / (1000 * 60 * 60);
        if (diffHours < 24) penalty = 4;
        else if (diffHours < 48) penalty = 3;
        else if (diffHours < 72) penalty = 2;
        else if (diffHours < 96) penalty = 1;
    }

    const baseForStreak = Math.max(habit.streak || 0, daysCompleted);
    habit.maxStreak = Math.max(habit.maxStreak || 0, baseForStreak);
    habit.streak = Math.max(0, baseForStreak - penalty);
    habit.lastFalloAt = now;
    habit.startTime = now;

    saveData();
    
    const card = document.querySelector(`[data-id="${id}"]`);
    if (card) {
        card.classList.add('reset-animation');
        setTimeout(() => {
            renderHabits();
            isProcessingFallo = false;
        }, 500);
    } else {
        renderHabits();
        isProcessingFallo = false;
    }
}

function calculateDays(habit) {
    const now = Date.now() + (simOffsetDays * MS_PER_DAY);
    const diff = now - habit.startTime;
    return Math.max(0, Math.floor(diff / MS_PER_DAY));
}

function formatClock(startTime) {
    const diff = Date.now() - startTime;
    if (diff < 0) return "00:00:00";
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function updateLiveClocks() {
    state.habits.forEach(habit => {
        const clockEl = document.querySelector(`[data-id="${habit.id}"] .live-clock`);
        if (clockEl) clockEl.innerText = formatClock(habit.startTime);
    });
}

function openSimModal() {
    // Ocultar modal de hábitos si está abierto
    document.getElementById('habit-modal').classList.add('hidden');
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById('sim-modal').classList.remove('hidden');
}

function closeSimModal() {
    simOffsetDays = 0;
    document.getElementById('sim-days-val').innerText = '0';
    closeModal();
    renderHabits();
}

function adjustSim(amount) {
    simOffsetDays = Math.max(0, simOffsetDays + amount);
    document.getElementById('sim-days-val').innerText = simOffsetDays;
    renderHabits();
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
    const habitList = document.getElementById('habit-list');
    habitList.innerHTML = '';
    
    if (state.habits.length === 0) {
        habitList.innerHTML = `<div style="text-align: center; color: var(--text-dim); margin-top: 50px;"><p>No hay hábitos aún.</p><p>Presiona + para comenzar.</p></div>`;
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
                    <span class="streak-label">Racha: ${habit.streak || 0}</span>
                    <span class="habit-name">${habit.name}</span>
                    <span class="record-label">Record: ${habit.maxStreak || 0}</span>
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
                <div class="live-clock">${formatClock(habit.startTime)}</div>
            </div>
            <div class="habit-footer">
                <button class="btn-fallo" onclick="handleFallo('${habit.id}')">FALLO</button>
                <button class="btn-edit" onclick="openHabitModal('${habit.id}')">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button class="btn-edit" onclick="deleteHabit('${habit.id}')" style="color: var(--danger)">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                </button>
            </div>`;
        habitList.appendChild(card);
    });
}

window.handleFallo = handleFallo;
window.openHabitModal = openHabitModal;
window.deleteHabit = deleteHabit;
window.moveHabit = moveHabit;
window.adjustSim = adjustSim;
init();
