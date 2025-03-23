document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const currentDateEl = document.getElementById('currentDate');
    const focusButton = document.getElementById('toggleFocus');
    const focusDuration = document.getElementById('focusDuration');
    const focusTimer = document.getElementById('focusTimer');
    const todoInput = document.getElementById('todoInput');
    const addTodoButton = document.getElementById('addTodo');
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
    let pomodoroCount = 0; // Counter for completed Pomodoros
    let pomodoroMode = 'pomodoro'; // Default mode: pomodoro, deepFocus, or custom
    let isLongBreak = false; // Flag for long break after 4 Pomodoros
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
        loadTodoList();
        updateFocusSessionState();
        updateGoalSelector();
        setupPomodoroControls();
        loadAchievements();
    }
    
    // Load and display user garden of achievements
    function loadAchievements() {
        const badgesContainer = document.getElementById('achievementBadges');
        badgesContainer.innerHTML = '';
        
        // Create garden container
        const forestContainer = document.createElement('div');
        forestContainer.className = 'forest-container';
        
        badgesContainer.appendChild(forestContainer);
        
        chrome.storage.local.get(['completedSessions'], (data) => {
            const completedSessions = data.completedSessions || [];
            
            if (completedSessions.length === 0) {
                const emptyForest = document.createElement('div');
                emptyForest.className = 'empty-forest';
                emptyForest.textContent = 'Complete focus sessions to grow your garden! 🌱';
                forestContainer.appendChild(emptyForest);
                return;
            }
            
            // Define garden elements based on session duration
            const getGardenElement = (duration) => {
                // For Pomodoro sessions (25 min)
                if (duration === 25) return { icon: '🌷', name: 'Tulip', description: 'A tulip from a completed Pomodoro' };
                // For completed sets of 4 Pomodoros or longer sessions
                if (duration >= 50) return { icon: '🌻', name: 'Sunflower', description: 'A beautiful sunflower from a long focus session' };
                // For medium length sessions
                if (duration >= 25) return { icon: '🦋', name: 'Butterfly', description: 'A butterfly from a medium focus session' };
                // For shorter sessions
                return { icon: '🌱', name: 'Sprout', description: 'A young sprout from a short session' };
            };
            
            // Render each garden element for completed sessions
            completedSessions.forEach(session => {
                const gardenElement = getGardenElement(session.duration);
                
                const tree = document.createElement('div');
                tree.className = 'tree';
                
                const treeIcon = document.createElement('div');
                treeIcon.className = 'tree-icon';
                treeIcon.textContent = gardenElement.icon;
                
                // Add tooltip for garden element details
                tree.title = `${gardenElement.name}: ${gardenElement.description}`;
                
                tree.appendChild(treeIcon);
                forestContainer.appendChild(tree);
            });
            
            // Add garden stats with more detailed information
            const forestStats = document.createElement('div');
            forestStats.className = 'forest-stats';
            
            // Count different garden elements
            const sproutCount = completedSessions.filter(s => s.duration < 25).length;
            const butterflyCount = completedSessions.filter(s => s.duration >= 25 && s.duration < 50).length;
            const sunflowerCount = completedSessions.filter(s => s.duration >= 50).length;
            
            forestStats.innerHTML = `
                <span>🌱 Garden: ${completedSessions.length} elements total</span>
                ${sunflowerCount > 0 ? `<span> • 🌻 ${sunflowerCount} sunflower${sunflowerCount !== 1 ? 's' : ''}</span>` : ''}
                ${butterflyCount > 0 ? `<span> • 🦋 ${butterflyCount} butterfly${butterflyCount !== 1 ? 'ies' : 'y'}</span>` : ''}
                ${sproutCount > 0 ? `<span> • 🌱 ${sproutCount} sprout${sproutCount !== 1 ? 's' : ''}</span>` : ''}
            `;
            badgesContainer.appendChild(forestStats);
        });
    }
    
    // Setup Pomodoro timer controls
    function setupPomodoroControls() {
        const pomodoroPreset = document.getElementById('pomodoroPreset');
        const focusDurationInput = document.getElementById('focusDuration');
        
        pomodoroPreset.addEventListener('change', () => {
            const selectedValue = pomodoroPreset.value;
            pomodoroMode = selectedValue;
            
            if (selectedValue === 'custom') {
                focusDurationInput.style.display = 'inline-block';
                focusDurationInput.value = '25';
            } else {
                focusDurationInput.style.display = 'none';
                
                // Set duration based on preset
                if (selectedValue === 'pomodoro') {
                    focusDurationInput.value = '25';
                } else if (selectedValue === 'deepFocus') {
                    focusDurationInput.value = '52';
                }
            }
        });
        
        // Initialize with default mode
        if (pomodoroPreset.value === 'pomodoro') {
            focusDurationInput.value = '25';
            focusDurationInput.style.display = 'none';
        }
    }
    
    // Show session transition in the timer area instead of modal
    function showSessionTransitionModal(type, duration) {
        const sessionStatus = document.getElementById('sessionStatus');
        const timerEl = document.getElementById('focusTimer');
        const breakCountdownContainer = document.createElement('div');
        breakCountdownContainer.id = 'breakCountdown';
        breakCountdownContainer.className = 'break-countdown';
        
        // Set message based on type
        let message = '';
        let icon = '';
        
        if (type === 'break') {
            icon = '⏰';
            if (isLongBreak) {
                message = `${icon} Time's up! Take a ${duration}-minute long break`;
            } else {
                message = `${icon} Time's up! Take a ${duration}-minute break`;
            }
            
            // Create break countdown UI
            const countdownTime = duration * 60; // in seconds
            timerEl.innerHTML = `<div class="break-timer">${formatTime(countdownTime)}</div>`;
            
            // Create break controls
            const breakControls = document.createElement('div');
            breakControls.className = 'break-controls';
            
            const startBreakBtn = document.createElement('button');
            startBreakBtn.textContent = 'Start Break';
            startBreakBtn.className = 'break-btn primary';
            startBreakBtn.onclick = () => {
                isBreakTime = true;
                startFocusTimer(duration, null);
                breakControls.remove();
            };
            
            const skipBreakBtn = document.createElement('button');
            skipBreakBtn.textContent = 'Skip Break';
            skipBreakBtn.className = 'break-btn secondary';
            skipBreakBtn.onclick = () => {
                // Skip break and start next focus session
                isBreakTime = false;
                const selectedGoal = document.getElementById('selectedGoal').value;
                const focusDuration = parseInt(document.getElementById('focusDuration').value);
                startFocusTimer(focusDuration, selectedGoal);
                breakControls.remove();
            };
            
            breakControls.appendChild(startBreakBtn);
            breakControls.appendChild(skipBreakBtn);
            
            sessionStatus.innerHTML = `<span class="break-time">${message}</span>`;
            sessionStatus.appendChild(breakControls);
            
        } else if (type === 'focus') {
            icon = '🌿';
            message = `${icon} Break over! Ready for next focus session`;
            
            // Create focus controls
            const focusControls = document.createElement('div');
            focusControls.className = 'break-controls';
            
            const startFocusBtn = document.createElement('button');
            startFocusBtn.textContent = 'Start Focus';
            startFocusBtn.className = 'break-btn primary';
            startFocusBtn.onclick = () => {
                isBreakTime = false;
                const selectedGoal = document.getElementById('selectedGoal').value;
                const focusDuration = parseInt(document.getElementById('focusDuration').value);
                startFocusTimer(focusDuration, selectedGoal);
                focusControls.remove();
            };
            
            const skipFocusBtn = document.createElement('button');
            skipFocusBtn.textContent = 'Not Now';
            skipFocusBtn.className = 'break-btn secondary';
            skipFocusBtn.onclick = () => {
                // Reset UI for next focus session
                isBreakTime = false;
                sessionStatus.textContent = 'Ready for next focus session.';
                focusButton.textContent = 'Start Focus';
                focusButton.classList.remove('active');
                document.getElementById('pomodoroPreset').disabled = false;
                if (document.getElementById('pomodoroPreset').value === 'custom') {
                    focusDuration.style.display = 'inline-block';
                    focusDuration.disabled = false;
                }
                focusControls.remove();
            };
            
            focusControls.appendChild(startFocusBtn);
            focusControls.appendChild(skipFocusBtn);
            
            sessionStatus.innerHTML = `<span class="break-time">${message}</span>`;
            sessionStatus.appendChild(focusControls);
            
        } else if (type === 'reward') {
            // Show garden growth notification in the timer area
            if (pomodoroCount % 4 === 0) {
                icon = '🌻';
                message = `${icon} Congratulations! You grew a beautiful sunflower in your garden!`;
            } else {
                icon = '🌷';
                message = `${icon} Nice! You added a new flower to your garden!`;
            }
            
            sessionStatus.innerHTML = `<span class="reward-message">${message}</span>`;
            
            // Automatically start break after showing reward message
            setTimeout(() => {
                if (isLongBreak) {
                    showSessionTransitionModal('break', 15);
                } else {
                    showSessionTransitionModal('break', breakDuration);
                }
                // Refresh the forest display
                loadAchievements();
            }, 2000);
        }
        
        // Play sound alert
        playAlertSound();
    }
    
    // Play sound alert when sessions end
    function playAlertSound() {
        // Using a short, valid audio data for the alert sound
        const audio = new Audio('data:audio/wav;base64,UklGRl9CAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YTtCAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj2a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZSA0PVqzn77BdGAg+ltryxnUoBSl+zPLaizsIGGS57OihUBELTKXh8bllHgU2jdXzzn0vBSF1xe/glEILElyx6OyrWBUIQ5zd8sFuJAUuhM/z1YU2Bhxqvu7mnEoODlOq5O+zYBoGPJPY88p4KwUme8rx3I4+CRZiturqpVITC0mi4PK8aB8GM4nU8tGAMQYfcsLu45ZFDBFYr+ftrVoXCECY3PLEcSYELIHO8diJOQcZaLvt559NEAxPqOPwtmMcBjiP1/PMeS0GI3fH8OCRQQoUXrTp66hVFApGnt/yvmwhBTCG0fPTgjQGHW/A7eSaRw0PVqzl77BeGQc+ltvyxnUoBSh+zPDaizsIGGS57OihUBELTKXh8bllHgU1jdT0z3wvBSJ0xe/glEILElyx6OyrWRUJQ5vd88FuJAUug8/y1oU2Bhxqvu7mnEoPDVOq5O+zYRsGPJLY88p4KgUme8rx3I4+CRVht+rqpVMSC0mh4fK8aiAFM4nU8tGAMQYfccPu45ZEDBJYr+ftrVoXCECZ3PLEcSYGK4DN8tiIOQcZZ7zs56BODwxPpuPxtmQcBjiP1/PMeS0FI3fH8OCRQQsUXrTp66hVFApGnt/zvmwhBTCG0fPTgzQHHG/A7eSaSA0PVqvm77BeGQc+lNrzyHUpBCh9y/HajDwIF2S46+mjTxEL');
        audio.play();
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
    
    // Fixed updateGoalSelector function declaration
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
                        
                        if (daysLeft >= 0 && daysLeft < earliestDeadline) {
                            earliestDeadline = daysLeft;
                            priorityGoal = { tier, index, goal };
                        }
                        
                        if ((goal.progress || 0) < lowestProgress) {
                            lowestProgress = goal.progress || 0;
                            if (!priorityGoal || lowestProgress < 30) {
                                priorityGoal = { tier, index, goal };
                            }
                        }
                    }
                });
            });
            
            Object.entries(goals).forEach(([tier, tierGoals]) => {
                if (tierGoals.length > 0) {
                    const group = document.createElement('optgroup');
                    group.label = tier === 'longTerm' ? 'Long-term' : tier === 'midTerm' ? 'Mid-term' : 'Short-term';
                    
                    tierGoals.forEach((goal, index) => {
                        if (goal.title) {
                            const option = document.createElement('option');
                            option.value = `${tier}-${index}`;
                            
                            const keywords = extractKeywords(goal.title);
                            option.textContent = keywords;
                            
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
                goalItem.style.backgroundColor = `${goal.color}10`;
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
                color: getColorForTier(tier, goals[tier].length)
            });
            chrome.storage.local.set({ goals }, () => loadGoals());
        });
    }

    // Function to automatically assign colors based on tier and index
    function getColorForTier(tier, index) {
        const colorPalettes = {
            longTerm: ['#8e44ad', '#9b59b6', '#8e44ad', '#7d3c98', '#6c3483'],
            midTerm: ['#2980b9', '#3498db', '#2874a6', '#21618c', '#1b4f72'],
            shortTerm: ['#27ae60', '#2ecc71', '#229954', '#1e8449', '#196f3d']
        };
        const palette = colorPalettes[tier] || colorPalettes.shortTerm;
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
                
                if (!focusInterval && !isStoppingTimer) {
                    startFocusTimer(session.duration, session.selectedGoal);
                }
            } else {
                focusButton.textContent = 'Start Focus';
                focusButton.classList.remove('active');
                pomodoroPreset.disabled = false;
                
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
                
                isStoppingTimer = false;
                loadGoals();
            }
        });
    }
    
    function startFocusTimer(duration, selectedGoal) {
        if (focusInterval) {
            clearInterval(focusInterval);
            focusInterval = null;
        }

        const sessionStatus = document.getElementById('sessionStatus');
        const timerEl = document.getElementById('focusTimer');
        
        if (isBreakTime) {
            // Break timer with visual countdown
            sessionStatus.innerHTML = `<span class="break-time">Break Time: ${duration} minutes</span>`;
            focusButton.textContent = 'Stop Break';
            focusButton.classList.add('active');
            
            const breakEndTime = Date.now() + (duration * 60 * 1000);
            
            focusInterval = setInterval(() => {
                const now = Date.now();
                const remaining = Math.max(0, Math.floor((breakEndTime - now) / 1000));
                
                timerEl.innerHTML = `<div class="break-timer">${formatTime(remaining)}</div>`;
                
                if (remaining <= 0) {
                    clearInterval(focusInterval);
                    focusInterval = null;
                    isBreakTime = false;
                    showSessionTransitionModal('focus');
                    focusButton.textContent = 'Start Focus';
                    focusButton.classList.remove('active');
                }
            }, 1000);
            
            return;
        }

        chrome.runtime.sendMessage({
            action: 'toggleFocusSession',
            enable: true,
            duration: parseInt(duration),
            selectedGoal: selectedGoal
        });
        
        timerEl.textContent = formatTime(parseInt(duration) * 60);
        sessionStatus.textContent = 'Focus session in progress...';
        document.getElementById('pomodoroPreset').disabled = true;
        focusDuration.disabled = true;
        
        focusInterval = setInterval(() => {
            chrome.storage.local.get(['focusSession'], (data) => {
                const session = data.focusSession;
                if (!session || !session.isActive) {
                    clearInterval(focusInterval);
                    focusInterval = null;
                    timerEl.textContent = '00:00:00';
                    updateFocusSessionState();
                    return;
                }
                
                const now = Date.now();
                const totalPausedTime = session.totalPausedTime || 0;
                const elapsedSeconds = Math.floor((now - session.startTime - totalPausedTime) / 1000);
                const targetSeconds = parseInt(session.duration) * 60;
                const remaining = Math.max(0, targetSeconds - elapsedSeconds);
                
                timerEl.textContent = formatTime(remaining);
    
                if (remaining <= 0) {
                    clearInterval(focusInterval);
                    focusInterval = null;
                    
                    if (!isBreakTime && selectedGoal) {
                        if (pomodoroMode === 'pomodoro' && parseInt(duration) === 25) {
                            pomodoroCount++;
                            
                            if (pomodoroCount % 4 === 0) {
                                isLongBreak = true;
                                breakDuration = 15;
                            } else {
                                isLongBreak = false;
                                breakDuration = 5;
                            }
                        } else if (pomodoroMode === 'deepFocus' && parseInt(duration) === 52) {
                            breakDuration = 17;
                        } else {
                            breakDuration = parseInt(duration) >= 50 ? 10 : 5;
                        }
                        
                        chrome.storage.local.get(['completedSessions'], (data) => {
                            const completedSessions = data.completedSessions || [];
                            completedSessions.push({
                                duration: parseInt(duration),
                                completedAt: new Date().toISOString(),
                                goal: selectedGoal
                            });
                            chrome.storage.local.set({ completedSessions }, () => {
                                showSessionTransitionModal('reward');
                                // Refresh the forest display immediately
                                loadAchievements();
                            });
                        });
                    } else {
                        showSessionTransitionModal('focus');
                    }
                    
                    isBreakTime = true;
                    
                    updateFocusSessionState();
                }
            });
        }, 1000);
    }

    // Progress tracking function removed

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
            
            startFocusTimer(duration, selectedGoal);
            
            chrome.runtime.sendMessage({
                action: 'toggleFocusSession',
                enable: true,
                duration,
                selectedGoal
            });
        } 
        // If we're stopping an active focus session
        else if (isActive && !isBreakTime) {
            isStoppingTimer = true;
            
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
    
    // Check-in button event listener removed

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
