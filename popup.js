document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const currentDateEl = document.getElementById('currentDate');
    const focusButton = document.getElementById('toggleFocus');
    const focusDuration = document.getElementById('focusDuration');
    const focusTimer = document.getElementById('focusTimer');
    const checkInButton = document.getElementById('checkIn');
    const journalEntry = document.getElementById('journalEntry');
    const streakCount = document.getElementById('streakCount');
    const weeklyTime = document.getElementById('weeklyTime');
    const goalLists = {
        longTerm: document.getElementById('longTermGoals'),
        midTerm: document.getElementById('midTermGoals'),
        shortTerm: document.getElementById('shortTermGoals')
    };

    let focusInterval;

    // Utility: Format seconds as HH:MM:SS
    function formatTime(seconds) {
        const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    }

    // Initialize popup state
    function initializePopup() {
        updateDate();
        loadGoals();
        loadProgress();
        loadJournal();
        updateFocusSessionState();
        updateGoalSelector();
    }

    function updateGoalSelector() {
        const selector = document.getElementById('selectedGoal');
        selector.innerHTML = '<option value="">Select a goal</option>';

        chrome.storage.local.get(['goals'], (data) => {
            const goals = data.goals || { longTerm: [], midTerm: [], shortTerm: [] };
            Object.entries(goals).forEach(([tier, tierGoals]) => {
                if (tierGoals.length > 0) {
                    const group = document.createElement('optgroup');
                    group.label = tier === 'longTerm' ? 'Long-term' : tier === 'midTerm' ? 'Mid-term' : 'Short-term';
                    
                    tierGoals.forEach((goal, index) => {
                        if (goal.title) {
                            const option = document.createElement('option');
                            option.value = `${tier}-${index}`;
                            option.textContent = goal.title;
                            group.appendChild(option);
                        }
                    });
                    
                    if (group.children.length > 0) {
                        selector.appendChild(group);
                    }
                }
            });
        });
    }

    // Update date display
    function updateDate() {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        currentDateEl.textContent = new Date().toLocaleDateString(undefined, options);
    }

    // Goal management
    function loadGoals() {
        chrome.storage.local.get(['goals'], (data) => {
            const goals = data.goals || { longTerm: [], midTerm: [], shortTerm: [] };
            Object.keys(goals).forEach(tier => {
                renderGoals(tier, goals[tier]);
            });
        });
    }

    function renderGoals(tier, goals) {
        const container = goalLists[tier];
        container.innerHTML = '';
    
        // Add new goal button
        const addButton = document.createElement('button');
        addButton.textContent = '+ Add Goal';
        addButton.onclick = () => addGoal(tier);
        container.appendChild(addButton);
    
        goals.forEach((goal, index) => {
            const goalItem = document.createElement('div');
            goalItem.className = 'goal-item';
    
            const goalContent = document.createElement('div');
            goalContent.className = 'goal-content';
            
            if (goal.title && goal.deadline) {
                const titleText = document.createElement('div');
                titleText.className = 'goal-title';
                titleText.textContent = goal.title;

                const deadlineDate = new Date(goal.deadline);
                const today = new Date();
                const daysLeft = Math.ceil((deadlineDate - today) / (1000 * 60 * 60 * 24));
                
                const deadlineText = document.createElement('div');
                deadlineText.className = 'goal-deadline';
                deadlineText.textContent = `${daysLeft} days left`;
                if (daysLeft < 0) {
                    deadlineText.textContent = 'Overdue';
                    deadlineText.style.color = '#dc3545';
                } else if (daysLeft <= 7) {
                    deadlineText.style.color = '#ffc107';
                }

                const editBtn = document.createElement('button');
                editBtn.textContent = '✎';
                editBtn.className = 'edit-btn';
                editBtn.onclick = () => {
                    goalContent.innerHTML = '';
                    renderEditMode();
                };

                goalContent.appendChild(titleText);
                goalContent.appendChild(deadlineText);
                goalContent.appendChild(editBtn);
            } else {
                renderEditMode();
            }

            function renderEditMode() {
                goalContent.innerHTML = '';
                const input = document.createElement('input');
                input.type = 'text';
                input.value = goal.title || '';
                input.placeholder = 'Enter goal';

                const deadline = document.createElement('input');
                deadline.type = 'date';
                deadline.value = goal.deadline || '';

                const saveBtn = document.createElement('button');
                saveBtn.textContent = '💾';
                saveBtn.className = 'save-btn';
                saveBtn.onclick = () => {
                    if (!input.value || !deadline.value) {
                        alert('Please enter both goal and deadline');
                        return;
                    }
                    const updatedGoal = { ...goal, title: input.value, deadline: deadline.value };
                    updateGoal(tier, index, updatedGoal);
                };

                goalContent.appendChild(input);
                goalContent.appendChild(deadline);
                goalContent.appendChild(saveBtn);
            }
    
            const progressContainer = document.createElement('div');
            progressContainer.className = 'progress-container';
            
            const progress = document.createElement('div');
            progress.className = 'progress';
            const progressBar = document.createElement('div');
            progressBar.className = 'progress-bar';
            progressBar.style.width = `${goal.progress || 0}%`;
            progress.appendChild(progressBar);
    
            const progressText = document.createElement('span');
            progressText.className = 'progress-text';
            const hoursSpent = ((goal.timeSpent || 0) / 3600).toFixed(2);
            progressText.textContent = `${hoursSpent}h`;
    
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = '×';
            deleteBtn.onclick = () => deleteGoal(tier, index);
    
            progressContainer.appendChild(progress);
            progressContainer.appendChild(progressText);
            goalItem.appendChild(goalContent);
            goalItem.appendChild(progressContainer);
            goalItem.appendChild(deleteBtn);
            container.appendChild(goalItem);
        });
    }

    function addGoal(tier) {
        chrome.storage.local.get(['goals'], (data) => {
            const goals = data.goals || { longTerm: [], midTerm: [], shortTerm: [] };
            goals[tier].push({
                title: '',
                deadline: '',
                progress: 0,
                timeSpent: 0
            });
            chrome.storage.local.set({ goals }, () => loadGoals());
        });
    }

    function updateGoal(tier, index, value) {
        chrome.storage.local.get(['goals'], (data) => {
            const goals = data.goals || { longTerm: [], midTerm: [], shortTerm: [] };
            if (!goals[tier]) goals[tier] = [];
            goals[tier][index] = value;
            chrome.storage.local.set({ goals }, () => {
                loadGoals();
                updateGoalSelector();
                chrome.runtime.sendMessage({ action: 'updateGoals', goals });
            });
        });
    }

    function deleteGoal(tier, index) {
        chrome.storage.local.get(['goals'], (data) => {
            const goals = data.goals;
            goals[tier].splice(index, 1);
            chrome.storage.local.set({ goals }, () => loadGoals());
            chrome.runtime.sendMessage({ action: 'updateGoals', goals });
        });
    }

    // Focus session management
    function updateFocusSessionState() {
        chrome.storage.local.get(['focusSession'], (data) => {
            const session = data.focusSession || { isActive: false };
            if (session.isActive) {
                focusButton.textContent = 'Stop Focus';
                focusButton.classList.add('active');
                focusDuration.disabled = true;
                // Only start the timer if one isn't already running.
                if (!focusInterval) {
                    startFocusTimer(session.duration, session.selectedGoal);
                }
            } else {
                focusButton.textContent = 'Start Focus';
                focusButton.classList.remove('active');
                focusDuration.disabled = false;
                focusTimer.textContent = '00:00:00';
                if (focusInterval) {
                    clearInterval(focusInterval);
                    focusInterval = null;
                }
                // Instead of updating goal progress here again,
                // simply reload the goals so that UI shows the accumulated time.
                loadGoals();
            }
        });
    }
    

    function startFocusTimer(duration, selectedGoal) {
        // Clear any previous timer interval.
        if (focusInterval) {
            clearInterval(focusInterval);
            focusInterval = null;
        }

        // Signal background to start the focus session.
        chrome.runtime.sendMessage({
            action: 'toggleFocusSession',
            enable: true,
            duration: parseInt(duration),
            selectedGoal: selectedGoal
        });
        
        // Set the timer display immediately.
        focusTimer.textContent = formatTime(parseInt(duration) * 60);
        
        // Start an interval to update the timer display every second.
        focusInterval = setInterval(() => {
            chrome.storage.local.get(['focusSession'], (data) => {
                const session = data.focusSession;
                if (!session || !session.isActive) {
                    clearInterval(focusInterval);
                    focusInterval = null;
                    focusTimer.textContent = '00:00:00';
                    updateFocusSessionState();
                    return;
                }
    
                const now = Date.now();
                const elapsedSeconds = Math.floor((now - session.startTime) / 1000);
                const targetSeconds = parseInt(session.duration) * 60;
                const remaining = Math.max(0, targetSeconds - elapsedSeconds);
                
                focusTimer.textContent = formatTime(remaining);
    
                if (remaining <= 0) {
                    clearInterval(focusInterval);
                    focusInterval = null;
                    updateFocusSessionState();
                }
            });
        }, 1000);
    }

    // Progress tracking
    function loadProgress() {
        chrome.storage.local.get(['streak', 'weeklyStats'], (data) => {
            streakCount.textContent = data.streak?.current || 0;
            const hours = Math.round((data.weeklyStats?.totalTime || 0) / 3600);
            weeklyTime.textContent = hours;
        });
    }

    // Journal management
    function loadJournal() {
        chrome.storage.local.get(['dailyLog'], (data) => {
            if (data.dailyLog) {
                journalEntry.value = data.dailyLog.journal || '';
                checkInButton.disabled = data.dailyLog.didFocus;
            }
        });
    }

    // Event listeners
    document.getElementById('selectedGoal').addEventListener('change', (e) => {
        const [tier, index] = e.target.value.split('-');
        if (tier && index) {
            chrome.storage.local.get(['goals'], (data) => {
                const goals = data.goals;
                const goal = goals[tier][index];
                const progress = goal.progress || 0;
                document.querySelector('.focus-session .progress').textContent = `Current Progress: ${progress}%`;
            });
        }
    });

    focusButton.addEventListener('click', () => {
        const isActive = focusButton.classList.contains('active');
        const duration = parseInt(focusDuration.value);
        const selectedGoal = document.getElementById('selectedGoal').value;
    
        if (!selectedGoal) {
            alert('Please select a goal first');
            return;
        }
    
        // Toggle the focus session.
        chrome.runtime.sendMessage({
            action: 'toggleFocusSession',
            enable: !isActive,
            duration,
            selectedGoal
        });
    
        // If starting a new session, launch the timer.
        if (!isActive) {
            startFocusTimer(duration, selectedGoal);
        }
    
        updateFocusSessionState();
    });
    
    checkInButton.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'updateStreak', didFocus: true });
        checkInButton.disabled = true;
    });

    journalEntry.addEventListener('input', debounce(() => {
        chrome.storage.local.get(['dailyLog'], (data) => {
            const dailyLog = data.dailyLog || {};
            dailyLog.journal = journalEntry.value;
            chrome.storage.local.set({ dailyLog });
        });
    }, 500));

    // Utility debounce function
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Initialize popup on DOM load.
    initializePopup();
});
