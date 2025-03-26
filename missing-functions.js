// Missing functions for Mission Tracker

// Goal management functions
function loadGoals() {
    chrome.storage.local.get(['goals'], (data) => {
        const goals = data.goals || {
            longTerm: [],
            midTerm: [],
            shortTerm: []
        };
        
        Object.keys(goals).forEach(tier => {
            renderGoals(tier, goals[tier]);
        });
    });
}

// Render goals for a specific tier
function renderGoals(tier, goals) {
    const container = document.getElementById(`${tier}Goals`);
    container.innerHTML = '';
    
    if (goals.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'empty-message';
        emptyMessage.textContent = 'No goals yet. Add one!';
        container.appendChild(emptyMessage);
        return;
    }
    
    goals.forEach((goal, index) => {
        const goalElement = document.createElement('div');
        goalElement.className = 'goal-item';
        
        const goalText = document.createElement('div');
        goalText.className = 'goal-text';
        goalText.textContent = goal.text;
        
        const goalControls = document.createElement('div');
        goalControls.className = 'goal-controls';
        
        const editBtn = document.createElement('button');
        editBtn.className = 'edit-btn';
        editBtn.textContent = '✎';
        editBtn.title = 'Edit goal';
        
        editBtn.addEventListener('click', () => {
            const newText = prompt('Edit goal:', goal.text);
            
            if (newText && newText.trim() !== '') {
                updateGoal(tier, index, { ...goal, text: newText });
            }
        });
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = '×';
        deleteBtn.title = 'Delete goal';
        
        deleteBtn.addEventListener('click', () => {
            // Confirm before deleting
            if (confirm('Are you sure you want to delete this goal?')) {
                deleteGoal(tier, index);
            }
        });
        
        goalControls.appendChild(editBtn);
        goalControls.appendChild(deleteBtn);
        
        goalElement.appendChild(goalText);
        goalElement.appendChild(goalControls);
        
        container.appendChild(goalElement);
    });
}

// Add a new goal
function addGoal(tier, text) {
    chrome.storage.local.get(['goals'], (data) => {
        const goals = data.goals || {
            longTerm: [],
            midTerm: [],
            shortTerm: []
        };
        
        if (!goals[tier]) {
            goals[tier] = [];
        }
        
        goals[tier].push({
            text: text,
            created: new Date().toISOString(),
            progress: 0,
            timeSpent: 0
        });
        
        chrome.storage.local.set({ goals }, () => {
            renderGoals(tier, goals[tier]);
            updateGoalSelector();
        });
    });
}

// Update an existing goal
function updateGoal(tier, index, updatedGoal) {
    chrome.storage.local.get(['goals'], (data) => {
        const goals = data.goals;
        
        if (!goals[tier]) {
            goals[tier] = [];
        }
        
        goals[tier][index] = updatedGoal;
        
        chrome.storage.local.set({ goals }, () => {
            renderGoals(tier, goals[tier]);
            updateGoalSelector();
        });
    });
}

// Delete a goal
function deleteGoal(tier, index) {
    chrome.storage.local.get(['goals'], (data) => {
        const goals = data.goals;
        
        if (!goals[tier]) {
            return;
        }
        
        goals[tier].splice(index, 1);
        
        chrome.storage.local.set({ goals }, () => {
            renderGoals(tier, goals[tier]);
            updateGoalSelector();
        });
    });
}

// Update the goal selector dropdown
function updateGoalSelector() {
    const selector = document.getElementById('selectedGoal');
    
    if (!selector) {
        return;
    }
    
    // Save current selection if any
    const currentSelection = selector.value;
    
    // Clear existing options
    selector.innerHTML = '<option value="">Select a goal</option>';
    
    chrome.storage.local.get(['goals'], (data) => {
        const goals = data.goals || {};
        
        // Add options for each tier
        ['longTerm', 'midTerm', 'shortTerm'].forEach(tier => {
            if (!goals[tier] || goals[tier].length === 0) {
                return;
            }
            
            const group = document.createElement('optgroup');
            group.label = tier === 'longTerm' ? 'Long-term' : tier === 'midTerm' ? 'Mid-term' : 'Short-term';
            
            goals[tier].forEach((goal, index) => {
                const option = document.createElement('option');
                option.value = `${tier}-${index}`;
                option.textContent = goal.text;
                
                if (option.value === currentSelection) {
                    option.selected = true;
                }
                
                group.appendChild(option);
            });
            
            selector.appendChild(group);
        });
    });
}

// Todo list management
function loadTodoList() {
    const todoList = document.getElementById('todoList');
    
    if (!todoList) return;
    
    todoList.innerHTML = '';
    
    chrome.storage.local.get(['todos'], (data) => {
        const todos = data.todos || [];
        
        if (todos.length === 0) {
            const emptyMessage = document.createElement('li');
            emptyMessage.className = 'empty-message';
            emptyMessage.textContent = 'No tasks yet. Add one!';
            todoList.appendChild(emptyMessage);
            return;
        }
        
        todos.forEach((todo, index) => {
            const todoItem = document.createElement('li');
            todoItem.className = `todo-item ${todo.completed ? 'completed' : ''}`;
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'todo-checkbox';
            checkbox.checked = todo.completed;
            
            checkbox.addEventListener('change', () => {
                toggleTodo(index);
            });
            
            const todoText = document.createElement('span');
            todoText.className = 'todo-text';
            todoText.textContent = todo.text;
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'todo-delete';
            deleteBtn.textContent = '×';
            
            deleteBtn.addEventListener('click', () => {
                deleteTodo(index);
            });
            
            todoItem.appendChild(checkbox);
            todoItem.appendChild(todoText);
            todoItem.appendChild(deleteBtn);
            
            todoList.appendChild(todoItem);
        });
    });
}

// Add a new todo item
function addTodo(text) {
    if (!text.trim()) return;
    
    chrome.storage.local.get(['todos'], (data) => {
        const todos = data.todos || [];
        todos.push({
            text: text,
            completed: false,
            created: new Date().toISOString()
        });
        
        chrome.storage.local.set({ todos }, () => {
            loadTodoList();
        });
    });
}

// Toggle todo completion status
function toggleTodo(index) {
    chrome.storage.local.get(['todos'], (data) => {
        const todos = data.todos || [];
        
        if (index >= 0 && index < todos.length) {
            todos[index].completed = !todos[index].completed;
            
            chrome.storage.local.set({ todos }, () => {
                loadTodoList();
            });
        }
    });
}

// Delete a todo item
function deleteTodo(index) {
    chrome.storage.local.get(['todos'], (data) => {
        const todos = data.todos || [];
        
        if (index >= 0 && index < todos.length) {
            todos.splice(index, 1);
            
            chrome.storage.local.set({ todos }, () => {
                loadTodoList();
            });
        }
    });
}

// Achievement garden functions
function getRandomPlant() {
    const plants = [
        { icon: '🌱', name: 'Sprout' },
        { icon: '🌿', name: 'Herb' },
        { icon: '🌵', name: 'Cactus' },
        { icon: '🌴', name: 'Palm' },
        { icon: '🌳', name: 'Tree' },
        { icon: '🌲', name: 'Evergreen' },
        { icon: '🍀', name: 'Clover' },
        { icon: '🌷', name: 'Tulip' },
        { icon: '🌹', name: 'Rose' },
        { icon: '🌻', name: 'Sunflower' },
        { icon: '🌺', name: 'Hibiscus' },
        { icon: '🍄', name: 'Mushroom' },
        { icon: '🍓', name: 'Strawberry' },
        { icon: '🍎', name: 'Apple' }
    ];
    
    return plants[Math.floor(Math.random() * plants.length)];
}

// Load and display achievements
function loadAchievements() {
    const achievementsSection = document.getElementById('achievementsSection');
    if (!achievementsSection) {
        return;
    }
    
    achievementsSection.innerHTML = '';
    
    chrome.storage.local.get(['completedSessions'], (data) => {
        const completedSessions = data.completedSessions || [];
        
        // Show message if no achievements yet
        if (completedSessions.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'empty-message';
            emptyMessage.textContent = 'Complete focus sessions to grow your garden!';
            achievementsSection.appendChild(emptyMessage);
            return;
        }
        
        // Show the most recent achievements (up to 10)
        const recentSessions = completedSessions.slice(-10);
        
        recentSessions.forEach(session => {
            const plant = getRandomPlant();
            
            const achievement = document.createElement('div');
            achievement.className = 'achievement';
            achievement.title = `${plant.name} - ${new Date(session.completedAt).toLocaleDateString()}`;
            
            const icon = document.createElement('div');
            icon.className = 'achievement-icon';
            icon.textContent = plant.icon;
            
            achievement.appendChild(icon);
            achievementsSection.appendChild(achievement);
        });
        
        // Add stats
        const statsDiv = document.createElement('div');
        statsDiv.className = 'achievement-stats';
        statsDiv.innerHTML = `
            <div>Total sessions: ${completedSessions.length}</div>
            <div>Total focus time: ${formatTotalTime(completedSessions)}</div>
        `;
        
        achievementsSection.appendChild(statsDiv);
    });
}

// Format total time from sessions
function formatTotalTime(sessions) {
    const totalMinutes = sessions.reduce((total, session) => {
        return total + (session.duration || 0);
    }, 0);
    
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else {
        return `${minutes}m`;
    }
}

// Play alert sound when sessions end
function playAlertSound() {
    const audio = new Audio('data:audio/wav;base64,UklGRl9vAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YTtvAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj2a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZSA0PVqzn77BdGAg+ltryxnUoBSl+zPLaizsIGGS57OihUBELTKXh8bllHgU2jdXzzn0vBSF1xe/glEILElyx6OyrWBUIQ5zd8sFuJAUuhM/z1YU2Bhxqvu7mnEoODlOq5O+zYBoGPJPY88p4KwUme8rx3I4+CRZiturqpVITC0mi4PK8aB8GM4nU8tGAMQYfcsLu45ZFDBFYr+ftrVoXCECY3PLEcSYELIHO8diJOQcZaLvt559NEAxPqOPwtmMcBjiP1/PMeS0GI3fH8OCRQQoUXrTp66hVFApGnt/yvmwhBTCG0fPTgjQGHW/A7eSaRw0PVqzl77BeGQc+ltvyxnUoBSh+zPDaizsIGGS57OihUBELTKXh8bllHgU1jdT0z3wvBSJ0xe/glEILElyx6OyrWRUJQ5vd88FuJAUug8/y1oU2Bhxqvu7mnEoPDVOq5O+zYRsGPJLY88p4KgUme8rx3I4+CRVht+rqpVMSC0mh4fK8aiAFM4nU8tGAMQYfccPu45ZEDBJYr+ftrVoXCECZ3PLEcSYGK4DN8tiIOQcZZ7zs56BODwxPpuPxtmQcBjiP1/PMeS0FI3fH8OCRQQsUXrTp66hVFApGnt/zvmwhBTCG0fPTgzQHHG/A7eSaSA0PVqvm77BeGQc+lNrzyHUpBCh9y/HajDwIF2S46+mjTxEL');
    audio.play();
}