let focusSession = {
    isActive: false,
    startTime: null,
    duration: 0,
    elapsed: 0,
    selectedGoal: null
};

let trackerWindow = null;

chrome.storage.local.get(['focusSession'], (data) => {
    if (data.focusSession && data.focusSession.isActive) {
        focusSession = data.focusSession;
    }
});

chrome.browserAction.onClicked.addListener(() => {
    if (trackerWindow) {
        chrome.windows.update(trackerWindow.id, { focused: true });
    } else {
        chrome.windows.create({
            url: 'popup.html',
            type: 'popup',
            width: 440,
            height: 600
        }, (window) => {
            trackerWindow = window;
        });
    }
});

chrome.windows.onRemoved.addListener((windowId) => {
    if (trackerWindow && trackerWindow.id === windowId) {
        trackerWindow = null;
    }
});

function updateTimer() {
    if (!focusSession.isActive) return;

    const now = Date.now();
    const elapsedSeconds = Math.floor((now - focusSession.startTime) / 1000);
    const targetSeconds = focusSession.duration * 60;
    focusSession.elapsed = Math.min(elapsedSeconds, targetSeconds);
    
    if (elapsedSeconds >= targetSeconds) {
        // Save the current elapsed time and selected goal before clearing the session.
        const finalElapsed = focusSession.elapsed;
        const selectedGoal = focusSession.selectedGoal;  

        console.log('[BG] Timer complete, finalElapsed:', finalElapsed, 'for goal:', selectedGoal);
        
        // Update goal progress immediately when session completes.
        if (selectedGoal) {
            const [tier, index] = selectedGoal.split('-');
            chrome.storage.local.get(['goals'], (data) => {
                const goals = data.goals || {};
                // Ensure that the tier exists and has an entry at the given index.
                if (goals[tier] && goals[tier][index]) {
                    const goal = goals[tier][index];
                    const previousTimeSpent = goal.timeSpent || 0;
                    const timeSpent = previousTimeSpent + finalElapsed;
                    const progress = Math.min(100, Math.round((timeSpent / (8 * 3600)) * 100));
                    goals[tier][index] = { ...goal, timeSpent, progress };
                    chrome.storage.local.set({ goals }, () => {
                        console.log('[BG] Updated goals:', goals);
                    });
                } else {
                    console.warn('[BG] Goal not found for', selectedGoal);
                }
            });
        }
        
        // Now stop the session and clear selectedGoal to prevent auto‑restart.
        stopFocusSession();
        chrome.notifications.create('focusComplete', {
            type: 'basic',
            iconUrl: 'icon128.svg',
            title: 'Focus Session Complete',
            message: 'Your focus session has ended!'
        });
        return;
    }

    chrome.storage.local.set({
        focusSession: {
            isActive: focusSession.isActive,
            startTime: focusSession.startTime,
            duration: focusSession.duration,
            elapsed: focusSession.elapsed,
            selectedGoal: focusSession.selectedGoal
        }
    });
}


function startFocusSession(duration, selectedGoal) {
    const now = Date.now();
    focusSession = {
        isActive: true,
        startTime: now,
        duration: duration,
        elapsed: 0,
        selectedGoal: selectedGoal
    };
    
    chrome.storage.local.set({
        focusSession: {
            isActive: true,
            startTime: now,
            duration: duration,
            elapsed: 0,
            selectedGoal: selectedGoal
        }
    }, () => {
        updateTimer();
    });
}

function stopFocusSession() {
    if (focusSession.isActive && focusSession.startTime) {
        const now = Date.now();
        const elapsedSeconds = Math.floor((now - focusSession.startTime) / 1000);
        focusSession.elapsed = Math.min(elapsedSeconds, focusSession.duration * 60);
    }
    focusSession.isActive = false;
    chrome.storage.local.set({ 
        focusSession: { 
            isActive: false,
            startTime: null,
            duration: 0,
            elapsed: focusSession.elapsed,
            selectedGoal: null  // Clear this to prevent auto‑restart in the popup
        } 
    });
}


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'toggleFocusSession') {
        if (request.enable) {
            startFocusSession(request.duration, request.selectedGoal);
        } else {
            stopFocusSession();
        }
    }
});

// Update the timer every second.
setInterval(updateTimer, 1000);
