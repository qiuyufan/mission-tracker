document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const currentDateEl = document.getElementById('currentDate');
    const focusButton = document.getElementById('toggleFocus');
    const focusDuration = document.getElementById('focusDuration');
    const focusTimer = document.getElementById('focusTimer');
    const checkInButton = document.getElementById('checkIn');
    const todoInput = document.getElementById('todoInput');
    const addTodoButton = document.getElementById('addTodo');
    const streakCount = document.getElementById('streakCount');
    const weeklyTime = document.getElementById('weeklyTime');
    // Pause button removed
    const goalLists = {
        longTerm: document.getElementById('longTermGoals'),
        midTerm: document.getElementById('midTermGoals'),
        shortTerm: document.getElementById('shortTermGoals')
    };

    let focusInterval;
    let isBreakTime = false;
    let breakDuration = 5; // Default break duration in minutes
    let isStoppingTimer = false; // Flag to track when we're stopping the timer
    // Pause functionality removed

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
        loadTodoList();
        updateFocusSessionState();
        updateGoalSelector();
        setupPomodoroControls();
        loadAchievements();
    }
    
    // Load and display user forest of achievements
    function loadAchievements() {
        const badgesContainer = document.getElementById('achievementBadges');
        badgesContainer.innerHTML = '';
        
        // Create forest container without title (removed duplicate heading)
        const forestContainer = document.createElement('div');
        forestContainer.className = 'forest-container';
        
        badgesContainer.appendChild(forestContainer);
        
        chrome.storage.local.get(['completedSessions', 'streak', 'weeklyStats'], (data) => {
            const completedSessions = data.completedSessions || [];
            
            if (completedSessions.length === 0) {
                const emptyForest = document.createElement('div');
                emptyForest.className = 'empty-forest';
                emptyForest.textContent = 'Complete focus sessions to grow your forest! 🌱';
                forestContainer.appendChild(emptyForest);
                return;
            }
            
            // Define tree types based on session duration
            const getTreeType = (duration) => {
                if (duration >= 50) return { icon: '🌳', name: 'Oak Tree', description: 'A mighty oak from a 50+ min session' };
                if (duration >= 25) return { icon: '🌲', name: 'Pine Tree', description: 'A tall pine from a 25+ min session' };
                return { icon: '🌱', name: 'Sapling', description: 'A young sapling from a short session' };
            };
            
            // Render each tree for completed sessions
            completedSessions.forEach(session => {
                const treeType = getTreeType(session.duration);
                
                const tree = document.createElement('div');
                tree.className = 'tree';
                
                const treeIcon = document.createElement('div');
                treeIcon.className = 'tree-icon';
                treeIcon.textContent = treeType.icon;
                
                const treeDate = document.createElement('div');
                treeDate.className = 'tree-date';
                const sessionDate = new Date(session.completedAt);
                treeDate.textContent = sessionDate.toLocaleDateString();
                
                // Add tooltip for tree details
                tree.title = `${treeType.name}: ${treeType.description}\nCompleted on ${sessionDate.toLocaleDateString()}`;
                
                tree.appendChild(treeIcon);
                tree.appendChild(treeDate);
                forestContainer.appendChild(tree);
            });
            
            // Add forest stats
            const forestStats = document.createElement('div');
            forestStats.className = 'forest-stats';
            forestStats.innerHTML = `<span>🌱 Trees planted: ${completedSessions.length}</span>`;
            badgesContainer.appendChild(forestStats);
        });
    }
    
    // Setup Pomodoro timer controls
    function setupPomodoroControls() {
        const pomodoroPreset = document.getElementById('pomodoroPreset');
        const focusDurationInput = document.getElementById('focusDuration');
        
        pomodoroPreset.addEventListener('change', () => {
            const selectedValue = pomodoroPreset.value;
            if (selectedValue === 'custom') {
                focusDurationInput.style.display = 'inline-block';
                focusDurationInput.value = '25';
            } else {
                focusDurationInput.style.display = 'none';
                focusDurationInput.value = selectedValue;
            }
        });
    }

    // Extract important keywords from a goal title
    function extractKeywords(title) {
        if (!title) return '';
        
        // Common words to filter out (articles, prepositions, etc.)
        const commonWords = ['a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'about', 'as', 'of'];
        
        // Split the title into words and filter out common words
        const words = title.split(' ')
            .filter(word => {
                // Keep words that are not in the common words list and have at least 3 characters
                // This helps focus on more meaningful words
                return !commonWords.includes(word.toLowerCase()) && word.length >= 3;
            });
        
        // If no significant words found, return the first word of the original title
        if (words.length === 0) {
            return title.split(' ')[0];
        }
        
        // If the title has many significant words, limit to the first 2-3 most important ones
        if (words.length > 3) {
            return words.slice(0, 2).join(' ');
        }
        
        // Return the significant words joined together
        return words.join(' ');
    }
    
    function updateGoalSelector() {
        const selector = document.getElementById('selectedGoal');
        selector.innerHTML = '<option value="">Select a goal</option>';
    
        chrome.storage.local.get(['goals'], (data) => {
            const goals = data.goals || { longTerm: [], midTerm: [], shortTerm: [] };
            
            // Find goal with nearest deadline or least progress for suggestion
            let priorityGoal = null;
            let earliestDeadline = Infinity;
            let lowestProgress = 100;
            
            Object.entries(goals).forEach(([tier, tierGoals]) => {
                tierGoals.forEach((goal, index) => {
                    if (goal.title && goal.deadline) {
                        const deadlineDate = new Date(goal.deadline);
                        const today = new Date();
                        const daysLeft = Math.ceil((deadlineDate - today) / (1000 * 60 * 60 * 24));
                        
                        // Prioritize goals with approaching deadlines
                        if (daysLeft >= 0 && daysLeft < earliestDeadline) {
                            earliestDeadline = daysLeft;
                            priorityGoal = { tier, index, goal };
                        }
                        
                        // Also consider goals with low progress
                        if ((goal.progress || 0) < lowestProgress) {
                            lowestProgress = goal.progress || 0;
                            // Only override deadline priority if progress is significantly lower
                            if (!priorityGoal || lowestProgress < 30) {
                                priorityGoal = { tier, index, goal };
                            }
                        }
                    }
                });
            });
            
            // Add all goals to selector
            Object.entries(goals).forEach(([tier, tierGoals]) => {
                if (tierGoals.length > 0) {
                    const group = document.createElement('optgroup');
                    group.label = tier === 'longTerm' ? 'Long-term' : tier === 'midTerm' ? 'Mid-term' : 'Short-term';
                    
                    tierGoals.forEach((goal, index) => {
                        if (goal.title) {
                            const option = document.createElement('option');
                            option.value = `${tier}-${index}`;
                            
                            // Extract keywords from the goal title instead of just the first word
                            const keywords = extractKeywords(goal.title);
                            option.textContent = keywords;
                            
                            // Mark the priority goal
                            if (priorityGoal && tier === priorityGoal.tier && index === parseInt(priorityGoal.index)) {
                                option.selected = true;
                            }
                            
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
        addButton.className = 'add-goal-btn';
        addButton.onclick = () => addGoal(tier);
        container.appendChild(addButton);
    
        goals.forEach((goal, index) => {
            const goalItem = document.createElement('div');
            goalItem.className = 'goal-item';
            
            // Apply color coding to the goal item if a color is set
            if (goal.color) {
                goalItem.style.borderLeft = `4px solid ${goal.color}`;
                goalItem.style.backgroundColor = `${goal.color}10`; // Add a very light background color
            }
    
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
                
                // Add icon based on deadline urgency
                let deadlineIcon = '⏱';
                if (daysLeft < 0) {
                    deadlineIcon = '⚠️';
                    deadlineText.textContent = `${deadlineIcon} Overdue`;
                    deadlineText.style.color = '#dc3545';
                    deadlineText.style.backgroundColor = '#f8d7da';
                } else if (daysLeft <= 3) {
                    deadlineIcon = '🔥';
                    deadlineText.textContent = `${deadlineIcon} ${daysLeft} days left`;
                    deadlineText.style.color = '#dc3545';
                    deadlineText.style.backgroundColor = '#fff3cd';
                } else if (daysLeft <= 7) {
                    deadlineIcon = '⏰';
                    deadlineText.textContent = `${deadlineIcon} ${daysLeft} days left`;
                    deadlineText.style.color = '#fd7e14';
                    deadlineText.style.backgroundColor = '#fff3cd';
                } else {
                    deadlineText.textContent = `${deadlineIcon} ${daysLeft} days left`;
                }

                const editBtn = document.createElement('button');
                editBtn.textContent = '✎';
                editBtn.className = 'edit-btn';
                editBtn.title = 'Edit goal';
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
                
                // Remove color picker and use automatic color assignment

                const saveBtn = document.createElement('button');
                saveBtn.textContent = '💾';
                saveBtn.className = 'save-btn';
                saveBtn.onclick = () => {
                    if (!input.value || !deadline.value) {
                        alert('Please enter both goal and deadline');
                        return;
                    }
                    const updatedGoal = { 
                        ...goal, 
                        title: input.value, 
                        deadline: deadline.value,
                        // Assign color based on tier
                        color: goal.color || getColorForTier(tier, index)
                    };
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
                timeSpent: 0,
                color: getColorForTier(tier, goals[tier].length) // Assign color automatically
            });
            chrome.storage.local.set({ goals }, () => loadGoals());
        });
    }

    // Function to automatically assign colors based on tier and index
    function getColorForTier(tier, index) {
    // Color palettes for each tier
    const colorPalettes = {
        longTerm: ['#8e44ad', '#9b59b6', '#8e44ad', '#7d3c98', '#6c3483'],
        midTerm: ['#2980b9', '#3498db', '#2874a6', '#21618c', '#1b4f72'],
        shortTerm: ['#27ae60', '#2ecc71', '#229954', '#1e8449', '#196f3d']
    };
    
    // Get the appropriate palette
    const palette = colorPalettes[tier] || colorPalettes.shortTerm;
    
    // Return a color from the palette based on index
    return palette[index % palette.length];
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
        // If we're in break time, don't update from storage
        if (isBreakTime) {
            return;
        }
        
        chrome.storage.local.get(['focusSession'], (data) => {
            const session = data.focusSession || { isActive: false };
            const pomodoroPreset = document.getElementById('pomodoroPreset');
            const sessionStatus = document.getElementById('sessionStatus');
            
            if (session.isActive) {
                focusButton.textContent = 'Stop Focus';
                focusButton.classList.add('active');
                focusDuration.disabled = true;
                pomodoroPreset.disabled = true;
                sessionStatus.textContent = 'Focus session in progress...';
                
                // Pause functionality removed
                
                // Only start the timer if one isn't already running AND we're not in the process of stopping
                // This prevents auto-restart when stopping the timer
                // This prevents auto-restart when stopping the timer
                if (!focusInterval && !isStoppingTimer) {
                    startFocusTimer(session.duration, session.selectedGoal);
                }
            } else {
                focusButton.textContent = 'Start Focus';
                focusButton.classList.remove('active');
                pomodoroPreset.disabled = false;
                
                // Pause functionality removed
                
                if (pomodoroPreset.value === 'custom') {
                    focusDuration.style.display = 'inline-block';
                    focusDuration.disabled = false;
                } else {
                    focusDuration.style.display = 'none';
                }
                
                focusTimer.textContent = '00:00:00';
                sessionStatus.textContent = '';
                
                if (focusInterval) {
                    clearInterval(focusInterval);
                    focusInterval = null;
                }
                
                // Reset the stopping flag
                isStoppingTimer = false;
                
                // Reload the goals so that UI shows the accumulated time.
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

        const sessionStatus = document.getElementById('sessionStatus');
        
        // If we're in break time, handle differently
        if (isBreakTime) {
            sessionStatus.innerHTML = `<span class="break-time">Break Time: ${breakDuration} minutes</span>`;
            focusTimer.textContent = formatTime(breakDuration * 60);
            
            // Start a break timer
            const breakEndTime = Date.now() + (breakDuration * 60 * 1000);
            
            focusInterval = setInterval(() => {
                const now = Date.now();
                const remaining = Math.max(0, Math.floor((breakEndTime - now) / 1000));
                
                focusTimer.textContent = formatTime(remaining);
                
                if (remaining <= 0) {
                    clearInterval(focusInterval);
                    focusInterval = null;
                    isBreakTime = false;
                    sessionStatus.textContent = 'Break complete! Ready for next focus session.';
                    focusButton.textContent = 'Start Focus';
                    focusButton.classList.remove('active');
                    document.getElementById('pomodoroPreset').disabled = false;
                    if (document.getElementById('pomodoroPreset').value === 'custom') {
                        focusDuration.style.display = 'inline-block';
                        focusDuration.disabled = false;
                    }
                }
            }, 1000);
            
            return;
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
        sessionStatus.textContent = 'Focus session in progress...';
        document.getElementById('pomodoroPreset').disabled = true;
        focusDuration.disabled = true;
        
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
                
                // Pause functionality removed
    
                const now = Date.now();
                // Account for any paused time in the calculation
                // Ensure totalPausedTime exists or default to 0
                const totalPausedTime = session.totalPausedTime || 0;
                const elapsedSeconds = Math.floor((now - session.startTime - totalPausedTime) / 1000);
                const targetSeconds = parseInt(session.duration) * 60;
                const remaining = Math.max(0, targetSeconds - elapsedSeconds);
                
                focusTimer.textContent = formatTime(remaining);
    
                if (remaining <= 0) {
                    clearInterval(focusInterval);
                    focusInterval = null;
                    
                    // Start a break after focus session
                    isBreakTime = true;
                    // Set break duration based on focus duration
                    breakDuration = parseInt(duration) >= 50 ? 10 : 5;
                    sessionStatus.innerHTML = `<span class="break-time">Time for a ${breakDuration}-minute break!</span>`;
                    
                    // Start the break timer
                    startFocusTimer(breakDuration, null);
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

    // Todo list management
    function loadTodoList() {
        chrome.storage.local.get(['todoList'], (data) => {
            const todoList = document.getElementById('todoList');
            todoList.innerHTML = '';
            
            const todos = data.todoList || [];
            todos.forEach((todo, index) => {
                const todoItem = document.createElement('li');
                todoItem.className = `todo-item ${todo.completed ? 'completed' : ''}`;
                
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'todo-checkbox';
                checkbox.checked = todo.completed;
                checkbox.addEventListener('change', () => toggleTodo(index));
                
                const todoText = document.createElement('span');
                todoText.className = 'todo-text';
                todoText.textContent = todo.text;
                
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'todo-delete';
                deleteBtn.textContent = '×';
                deleteBtn.addEventListener('click', () => deleteTodo(index));
                
                todoItem.appendChild(checkbox);
                todoItem.appendChild(todoText);
                todoItem.appendChild(deleteBtn);
                todoList.appendChild(todoItem);
            });
        });
    }
    
    function addTodo(text) {
        if (!text.trim()) return;
        
        chrome.storage.local.get(['todoList'], (data) => {
            const todos = data.todoList || [];
            todos.push({
                text: text,
                completed: false,
                createdAt: new Date().toISOString()
            });
            chrome.storage.local.set({ todoList: todos }, () => loadTodoList());
        });
    }
    
    function toggleTodo(index) {
        chrome.storage.local.get(['todoList'], (data) => {
            const todos = data.todoList || [];
            if (todos[index]) {
                todos[index].completed = !todos[index].completed;
                chrome.storage.local.set({ todoList: todos }, () => loadTodoList());
            }
        });
    }
    
    function deleteTodo(index) {
        chrome.storage.local.get(['todoList'], (data) => {
            const todos = data.todoList || [];
            todos.splice(index, 1);
            chrome.storage.local.set({ todoList: todos }, () => loadTodoList());
        });
    }
    
    // Pause button event listener removed
    
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
        const pomodoroPreset = document.getElementById('pomodoroPreset');
        const duration = parseInt(focusDuration.value);
        const selectedGoal = document.getElementById('selectedGoal').value;
        const sessionStatus = document.getElementById('sessionStatus');
        
        // If we're in break time and stopping the timer
        if (isBreakTime && isActive) {
            clearInterval(focusInterval);
            focusInterval = null;
            isBreakTime = false;
            sessionStatus.textContent = 'Break canceled.';
            focusButton.textContent = 'Start Focus';
            focusButton.classList.remove('active');
            pomodoroPreset.disabled = false;
            if (pomodoroPreset.value === 'custom') {
                focusDuration.style.display = 'inline-block';
                focusDuration.disabled = false;
            }
            return;
        }
        
        // If we're starting a new focus session
        if (!isActive && !isBreakTime) {
            if (!selectedGoal) {
                alert('Please select a goal first');
                return;
            }
            
            focusButton.textContent = 'Stop Focus';
            focusButton.classList.add('active');
            
            // Start the focus session
            startFocusTimer(duration, selectedGoal);
            
            // Toggle the focus session in background
            chrome.runtime.sendMessage({
                action: 'toggleFocusSession',
                enable: true,
                duration,
                selectedGoal
            });
        } 
        // If we're stopping an active focus session
        else if (isActive && !isBreakTime) {
            // Set the stopping flag to prevent auto-restart
            isStoppingTimer = true;
            
            // Stop the focus session
            chrome.runtime.sendMessage({
                action: 'toggleFocusSession',
                enable: false
            });
            
            clearInterval(focusInterval);
            focusInterval = null;
            focusButton.textContent = 'Start Focus';
            focusButton.classList.remove('active');
            sessionStatus.textContent = 'Focus session stopped.';
            pomodoroPreset.disabled = false;
            if (pomodoroPreset.value === 'custom') {
                focusDuration.style.display = 'inline-block';
                focusDuration.disabled = false;
            }
            
            updateFocusSessionState();
        }
    });
    
    checkInButton.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'updateStreak', didFocus: true });
        checkInButton.disabled = true;
    });

    // Todo list event listeners
    addTodoButton.addEventListener('click', () => {
        addTodo(todoInput.value);
        todoInput.value = '';
    });
    
    todoInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addTodo(todoInput.value);
            todoInput.value = '';
        }
    });

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
