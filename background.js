let focusSession = {
    isActive: false,
    startTime: null,
    duration: 0,
    elapsed: 0,
    selectedGoal: null,
    isBreakTime: false,
    pomodoroCount: 0,
    isLongBreak: false,
    pomodoroMode: 'pomodoro' // Default mode: pomodoro, deepFocus, or custom
};

let trackerWindow = null;

chrome.storage.local.get(['focusSession'], (data) => {
    if (data.focusSession && data.focusSession.isActive) {
        focusSession = data.focusSession;
    }
});

chrome.browserAction.onClicked.addListener(() => {
    if (trackerWindow) {
        // Check if the window still exists before focusing it
        chrome.windows.get(trackerWindow.id, {}, (window) => {
            if (chrome.runtime.lastError) {
                // Window doesn't exist; create a new one
                createTrackerWindow();
            } else {
                chrome.windows.update(trackerWindow.id, { focused: true });
            }
        });
    } else {
        createTrackerWindow();
    }
});

function createTrackerWindow() {
    chrome.windows.create({
        url: 'popup.html',
        type: 'popup',  // Using "popup" to mimic the standalone behavior of your old code
        width: 440,
        height: 600
    }, (window) => {
        trackerWindow = window;
    });
}

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
        const finalElapsed = focusSession.elapsed;
        const selectedGoal = focusSession.selectedGoal;
        const isBreakTime = focusSession.isBreakTime;
        const pomodoroMode = focusSession.pomodoroMode;

        console.log('[BG] Timer complete, finalElapsed:', finalElapsed, 'for goal:', selectedGoal, 'isBreak:', isBreakTime);
        
        // If this was a focus session (not a break), update goal progress and add to garden
        if (!isBreakTime && selectedGoal) {
            const [tier, index] = selectedGoal.split('-');
            chrome.storage.local.get(['goals', 'completedSessions'], (data) => {
                const goals = data.goals || {};
                const completedSessions = data.completedSessions || [];
                
                // Update goal progress
                if (goals[tier] && goals[tier][index]) {
                    const goal = goals[tier][index];
                    const previousTimeSpent = goal.timeSpent || 0;
                    const timeSpent = previousTimeSpent + finalElapsed;
                    const progress = Math.min(100, Math.round((timeSpent / (8 * 3600)) * 100));
                    goals[tier][index] = { ...goal, timeSpent, progress };
                    
                    // Add to completed sessions for garden
                    completedSessions.push({
                        duration: focusSession.duration,
                        completedAt: new Date().toISOString(),
                        goal: selectedGoal
                    });
                    
                    chrome.storage.local.set({ goals, completedSessions }, () => {
                        console.log('[BG] Updated goals and garden:', goals);
                        // Send message to popup to refresh garden display
                        chrome.runtime.sendMessage({
                            action: 'refreshGarden'
                        });
                    });
                } else {
                    console.warn('[BG] Goal not found for', selectedGoal);
                }
            });
        }
        
        // Stop the current session
        stopFocusSession();
        
        // Create notification
        chrome.notifications.create('focusComplete', {
            type: 'basic',
            iconUrl: 'icon128.svg',
            title: isBreakTime ? 'Break Complete' : 'Focus Session Complete',
            message: isBreakTime ? 'Your break has ended!' : 'Your focus session has ended!'
        });
        
        return;
    }

    chrome.storage.local.set({
        focusSession: {
            isActive: focusSession.isActive,
            startTime: focusSession.startTime,
            duration: focusSession.duration,
            elapsed: focusSession.elapsed,
            selectedGoal: focusSession.selectedGoal,
            isBreakTime: focusSession.isBreakTime,
            pomodoroCount: focusSession.pomodoroCount,
            isLongBreak: focusSession.isLongBreak,
            pomodoroMode: focusSession.pomodoroMode
        }
    });
}

function startFocusSession(duration, selectedGoal, isBreak = false, pomodoroMode = 'pomodoro') {
    const now = Date.now();
    
    // If this is a focus session (not a break), increment pomodoro count for 25-min sessions
    if (!isBreak && duration === 25) {
        focusSession.pomodoroCount++;
        
        // Set long break flag after 4 pomodoros
        if (focusSession.pomodoroCount % 4 === 0) {
            focusSession.isLongBreak = true;
        } else {
            focusSession.isLongBreak = false;
        }
    }
    
    focusSession = {
        isActive: true,
        startTime: now,
        duration: duration,
        elapsed: 0,
        selectedGoal: selectedGoal,
        isBreakTime: isBreak,
        pomodoroCount: focusSession.pomodoroCount || 0,
        isLongBreak: focusSession.isLongBreak || false,
        pomodoroMode: pomodoroMode || 'pomodoro'
    };
    
    chrome.storage.local.set({
        focusSession: {
            isActive: true,
            startTime: now,
            duration: duration,
            elapsed: 0,
            selectedGoal: selectedGoal,
            isBreakTime: isBreak,
            pomodoroCount: focusSession.pomodoroCount,
            isLongBreak: focusSession.isLongBreak,
            pomodoroMode: focusSession.pomodoroMode
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
            selectedGoal: null,
            isBreakTime: focusSession.isBreakTime,
            pomodoroCount: focusSession.pomodoroCount,
            isLongBreak: focusSession.isLongBreak,
            pomodoroMode: focusSession.pomodoroMode
        } 
    });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'toggleFocusSession') {
        if (request.enable) {
            startFocusSession(request.duration, request.selectedGoal, request.isBreak || false, request.pomodoroMode || 'pomodoro');
        } else {
            stopFocusSession();
        }
    } else if (request.action === 'updateBreakState') {
        // Update break state without changing session status
        focusSession.isBreakTime = request.isBreakTime;
        focusSession.isLongBreak = request.isLongBreak || false;
        focusSession.pomodoroCount = request.pomodoroCount || focusSession.pomodoroCount;
        focusSession.pomodoroMode = request.pomodoroMode || focusSession.pomodoroMode;
        
        chrome.storage.local.set({
            focusSession: {
                isActive: focusSession.isActive,
                startTime: focusSession.startTime,
                duration: focusSession.duration,
                elapsed: focusSession.elapsed,
                selectedGoal: focusSession.selectedGoal,
                isBreakTime: focusSession.isBreakTime,
                pomodoroCount: focusSession.pomodoroCount,
                isLongBreak: focusSession.isLongBreak,
                pomodoroMode: focusSession.pomodoroMode
            }
        });
    } else if (request.action === 'startBreak') {
        // Start a break session
        const breakDuration = request.isLongBreak ? 15 : 5;
        startFocusSession(breakDuration, null, true, request.pomodoroMode || 'pomodoro');
    } else if (request.action === 'startNextFocus') {
        // Start the next focus session in the Mondoro cycle
        let nextDuration = 25; // Default
        
        if (request.pomodoroMode === 'pomodoro') {
            // After first 25-min session, next is 50 min in Mondoro style
            nextDuration = request.isFirstSession ? 25 : 50;
        } else if (request.pomodoroMode === 'deepFocus') {
            nextDuration = 52; // Keep the deep focus duration
        } else if (request.customDuration) {
            // For custom, use the provided duration
            nextDuration = request.customDuration;
        }
        
        startFocusSession(nextDuration, request.selectedGoal, false, request.pomodoroMode || 'pomodoro');
    }
});

// Update the timer every second.
setInterval(updateTimer, 1000);
