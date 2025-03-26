// Garden logic for Mission Tracker

// Plant types and their progression paths
const PLANT_TYPES = {
    SPROUT: 'sprout',
    FLOWER: 'flower',
    BUSH: 'bush',
    TREE: 'tree',
    GOLDEN: 'golden'
};

// Plant variants for each type
const PLANT_VARIANTS = {
    [PLANT_TYPES.SPROUT]: [
        { name: 'Bean Sprout', icon: '🌱' },
        { name: 'Seedling', icon: '🌱' },
        { name: 'Clover', icon: '🍀' },
        { name: 'Herb', icon: '🍀' }
    ],
    [PLANT_TYPES.BUSH]: [
        { name: 'Rose Bush', icon: '🌿' },
        { name: 'Berry Bush', icon: '🌿' },
        { name: 'Mixed Bush', icon: '🌿' },
        { name: 'Flowering Bush', icon: '🌿' }
    ],
    [PLANT_TYPES.FLOWER]: [
        { name: 'Cherry Blossom', icon: '🌸' },
        { name: 'Sunflower', icon: '🌻' },
        { name: 'Daisy', icon: '🌼' },
        { name: 'Rose', icon: '🌹' },
        { name: 'Marigold', icon: '🏵️' }
    ],

    [PLANT_TYPES.TREE]: [
        { name: 'Oak Tree', icon: '🌳' },
        { name: 'Pine Tree', icon: '🌲' },
        { name: 'Palm Tree', icon: '🌴' },
        { name: 'Mushroom Ring', icon: '🍄' },
        { name: 'Crystal Fern', icon: '🌴'}
    ],
    [PLANT_TYPES.GOLDEN]: [
        { name: 'Golden Flower', icon: '🌟' }
    ]
};

// Get a random plant variant of the specified type
function getRandomPlantVariant(type) {
    const variants = PLANT_VARIANTS[type];
    return variants[Math.floor(Math.random() * variants.length)];
}

// Create a new plant object
function createPlant(type, variantName = null) {
    let variant;
    
    if (variantName) {
        // Find the specific variant by name
        variant = PLANT_VARIANTS[type].find(v => v.name === variantName) || getRandomPlantVariant(type);
    } else {
        // Get a random variant of the specified type
        variant = getRandomPlantVariant(type);
    }
    
    return {
        type,
        variant: variant.name,
        icon: variant.icon,
        createdAt: new Date().toISOString()
    };
}

// Process a completed focus session and update the garden
function processCompletedSession(duration, goalId) {
    return new Promise((resolve) => {
        chrome.storage.local.get(['garden', 'streaks'], (data) => {
            const garden = data.garden || { plants: [], lastWeekSummary: null };
            const streaks = data.streaks || { current: 0, lastSessionDate: null, longestStreak: 0 };
            
            // Create a new plant based on session duration
            let newPlant;
            if (duration >= 50) {
                // Long sessions (50+ minutes) create a more valuable plant
                newPlant = createPlant(PLANT_TYPES.FLOWER);
            } else if (duration >= 25) {
                // Medium sessions (25-49 minutes) create a standard plant
                newPlant = createPlant(PLANT_TYPES.SPROUT);
            } else {
                // Short sessions create a basic sprout
                newPlant = createPlant(PLANT_TYPES.SPROUT);
            }
            
            // Add the new plant to the garden
            garden.plants.push({
                ...newPlant,
                sessionDuration: duration,
                goalId: goalId
            });
            
            // Update streak information
            const today = new Date().toDateString();
            const lastSessionDate = streaks.lastSessionDate ? new Date(streaks.lastSessionDate).toDateString() : null;
            
            // Check if this is a new day compared to the last session
            if (lastSessionDate !== today) {
                // If the last session was yesterday, increment streak
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayString = yesterday.toDateString();
                
                if (lastSessionDate === yesterdayString) {
                    streaks.current += 1;
                    // Update longest streak if current is longer
                    if (streaks.current > streaks.longestStreak) {
                        streaks.longestStreak = streaks.current;
                    }
                    
                    // Check for 7-day streak reward
                    if (streaks.current % 7 === 0) {
                        // Add a golden flower for 7-day streak
                        const goldenFlower = createPlant(PLANT_TYPES.GOLDEN);
                        garden.plants.push({
                            ...goldenFlower,
                            isStreakReward: true,
                            streakDays: streaks.current
                        });
                    }
                } else if (lastSessionDate !== null) {
                    // Streak broken, reset to 1
                    streaks.current = 1;
                } else {
                    // First session ever
                    streaks.current = 1;
                }
                
                // Update last session date
                streaks.lastSessionDate = new Date().toISOString();
            }
            
            // Check for plant evolution opportunities
            const plantCounts = countPlantsByType(garden.plants);
            
            // Check for sprout to flower evolution (4 sprouts -> 1 flower)
            if (plantCounts[PLANT_TYPES.SPROUT] >= 4) {
                // Get 4 sprouts to evolve
                const sproutsToEvolve = garden.plants
                    .filter(plant => plant.type === PLANT_TYPES.SPROUT)
                    .slice(0, 4);
                
                // Remove these sprouts from the garden
                garden.plants = garden.plants.filter(plant => !sproutsToEvolve.includes(plant));
                
                // Create a new flower
                const newFlower = createPlant(PLANT_TYPES.FLOWER);
                garden.plants.push({
                    ...newFlower,
                    evolvedFrom: sproutsToEvolve.map(p => p.variant),
                    evolvedAt: new Date().toISOString()
                });
            }
            
            // Check for flower to bush evolution (4 flowers -> 1 bush)
            if (plantCounts[PLANT_TYPES.FLOWER] >= 4) {
                // Get 4 flowers to evolve
                const flowersToEvolve = garden.plants
                    .filter(plant => plant.type === PLANT_TYPES.FLOWER)
                    .slice(0, 4);
                
                // Remove these flowers from the garden
                garden.plants = garden.plants.filter(plant => !flowersToEvolve.includes(plant));
                
                // Create a new bush
                const newBush = createPlant(PLANT_TYPES.BUSH);
                garden.plants.push({
                    ...newBush,
                    evolvedFrom: flowersToEvolve.map(p => p.variant),
                    evolvedAt: new Date().toISOString()
                });
            }
            
            // Check for tree evolution (12+ total sessions or 3-day streak)
            if (garden.plants.length >= 12 || streaks.current >= 3) {
                // Check if we don't already have a tree
                const hasTree = garden.plants.some(plant => plant.type === PLANT_TYPES.TREE);
                
                if (!hasTree) {
                    // Create a new tree
                    const newTree = createPlant(PLANT_TYPES.TREE);
                    garden.plants.push({
                        ...newTree,
                        isProgressReward: true,
                        totalSessions: garden.plants.length
                    });
                }
            }
            
            // Check if we need to generate a weekly summary
            checkAndGenerateWeeklySummary(garden);
            
            // Limit garden size to prevent clutter (keep most recent 20 plants)
            if (garden.plants.length > 20) {
                // Sort plants by creation date (newest first)
                garden.plants.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                
                // Keep only the 20 most recent plants
                garden.plants = garden.plants.slice(0, 20);
            }
            
            // Save updated garden and streaks
            chrome.storage.local.set({ garden, streaks }, () => {
                resolve({
                    newPlant,
                    garden,
                    streaks,
                    evolutions: checkForEvolutions(garden.plants)
                });
            });
        });
    });
}

// Count plants by type
function countPlantsByType(plants) {
    const counts = {};
    
    // Initialize counts for all plant types
    Object.values(PLANT_TYPES).forEach(type => {
        counts[type] = 0;
    });
    
    // Count plants by type
    plants.forEach(plant => {
        counts[plant.type] = (counts[plant.type] || 0) + 1;
    });
    
    return counts;
}

// Check for any evolutions that occurred
function checkForEvolutions(plants) {
    return plants.filter(plant => plant.evolvedAt).sort((a, b) => {
        return new Date(b.evolvedAt) - new Date(a.evolvedAt);
    });
}

// Check if we need to generate a weekly summary and create one if needed
function checkAndGenerateWeeklySummary(garden) {
    const lastSummaryDate = garden.lastWeekSummary ? new Date(garden.lastWeekSummary.date) : null;
    const today = new Date();
    
    // If we've never had a summary or it's been at least 7 days since the last one
    if (!lastSummaryDate || (today - lastSummaryDate) / (1000 * 60 * 60 * 24) >= 7) {
        // Get sessions from the past 7 days
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        
        const weeklyPlants = garden.plants.filter(plant => {
            const plantDate = new Date(plant.createdAt);
            return plantDate >= oneWeekAgo && plantDate <= today;
        });
        
        // Count plants by type for the week
        const weeklyCounts = countPlantsByType(weeklyPlants);
        
        // Generate summary message
        let summaryMessage = generateWeeklySummaryMessage(weeklyPlants.length, weeklyCounts);
        
        // Store the summary
        garden.lastWeekSummary = {
            date: today.toISOString(),
            plantCount: weeklyPlants.length,
            plantCounts: weeklyCounts,
            message: summaryMessage
        };
    }
    
    return garden;
}

// Generate a weekly summary message
function generateWeeklySummaryMessage(sessionCount, plantCounts) {
    if (sessionCount === 0) {
        return "You didn't complete any focus sessions this week. Let's grow your garden next week! 🌱";
    }
    
    let message = `Great work this week! You completed ${sessionCount} focus session${sessionCount !== 1 ? 's' : ''}`;
    
    // Add details about plants
    const plantDetails = [];
    
    if (plantCounts[PLANT_TYPES.SPROUT] > 0) {
        plantDetails.push(`grew ${plantCounts[PLANT_TYPES.SPROUT]} sprout${plantCounts[PLANT_TYPES.SPROUT] !== 1 ? 's' : ''}`);
    }
    
    if (plantCounts[PLANT_TYPES.FLOWER] > 0) {
        plantDetails.push(`bloomed ${plantCounts[PLANT_TYPES.FLOWER]} flower${plantCounts[PLANT_TYPES.FLOWER] !== 1 ? 's' : ''}`);
    }
    
    if (plantCounts[PLANT_TYPES.BUSH] > 0) {
        plantDetails.push(`cultivated ${plantCounts[PLANT_TYPES.BUSH]} bush${plantCounts[PLANT_TYPES.BUSH] !== 1 ? 'es' : ''}`);
    }
    
    if (plantCounts[PLANT_TYPES.TREE] > 0) {
        plantDetails.push(`grew ${plantCounts[PLANT_TYPES.TREE]} tree${plantCounts[PLANT_TYPES.TREE] !== 1 ? 's' : ''}`);
    }
    
    if (plantCounts[PLANT_TYPES.GOLDEN] > 0) {
        plantDetails.push(`earned ${plantCounts[PLANT_TYPES.GOLDEN]} golden flower${plantCounts[PLANT_TYPES.GOLDEN] !== 1 ? 's' : ''}`);
    }
    
    if (plantDetails.length > 0) {
        message += `, ${plantDetails.join(', ')}! 🌱✨ Keep growing your mind and garden!`;
    } else {
        message += `! Keep growing your mind and garden! 🌱✨`;
    }
    
    return message;
}

// Get the current garden state
function getGardenState() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['garden', 'streaks'], (data) => {
            const garden = data.garden || { plants: [], lastWeekSummary: null };
            const streaks = data.streaks || { current: 0, lastSessionDate: null, longestStreak: 0 };
            resolve({ garden, streaks });
        });
    });
}

// Export functions for use in other files
window.gardenManager = {
    processCompletedSession,
    getGardenState,
    createPlant,
    PLANT_TYPES
};