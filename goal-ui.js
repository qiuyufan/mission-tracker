// Goal UI functions for Mission Tracker

// Create goal input fields for each tier
function createGoalInputs() {
    const tiers = ['longTerm', 'midTerm', 'shortTerm'];
    
    tiers.forEach(tier => {
        const container = document.getElementById(`${tier}Goals`);
        if (!container) return;
        
        // Clear existing content
        container.innerHTML = '';
        
        // Create input field
        const inputContainer = document.createElement('div');
        inputContainer.className = 'goal-input-container';
        
        const input = document.createElement('input');
        input.type = 'text';
        input.id = `${tier}Input`;
        input.placeholder = `Add a new ${tier === 'longTerm' ? 'long-term' : tier === 'midTerm' ? 'mid-term' : 'short-term'} goal...`;
        input.className = 'goal-input';
        
        const addButton = document.createElement('button');
        addButton.textContent = 'Add';
        addButton.className = 'save-btn';
        
        inputContainer.appendChild(input);
        inputContainer.appendChild(addButton);
        
        // Add goal list container
        const goalList = document.createElement('div');
        goalList.className = 'goal-list';
        goalList.id = `${tier}GoalList`;
        
        container.appendChild(inputContainer);
        container.appendChild(goalList);
        
        // Add event listeners
        addButton.addEventListener('click', () => {
            const text = input.value.trim();
            
            if (text) {
                addGoal(tier, text);
                input.value = '';
            }
        });
        
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const text = input.value.trim();
                
                if (text) {
                    addGoal(tier, text);
                    input.value = '';
                }
            }
        });
    });
}

// Render goal items in the UI
function renderGoalItems(tier, goals) {
    const container = document.getElementById(`${tier}GoalList`);
    
    if (container.firstChild) {
        container.innerHTML = '';
    } else {
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'empty-message';
        emptyMessage.textContent = 'No goals yet. Add one!';
        container.appendChild(emptyMessage);
    }
}

// Initialize goal UI when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    createGoalInputs();
});