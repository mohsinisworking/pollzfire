// details.js
// POLLz - Poll Details Dashboard
// Handles fetching poll, votes, and user profiles, and renders interactive tabs and pie charts for gender and age breakdowns.

// --- Firebase Initialization (assumes Firebase SDK is already loaded globally) ---
// If not, add Firebase SDK scripts to index.html and details.html as needed.

// --- Config ---
const db = firebase.firestore();
const auth = firebase.auth();

// --- DOM Elements ---
const tabsContainer = document.getElementById('tabs-container');
const chartsContainer = document.getElementById('charts-container');
const loadingMessage = document.getElementById('loading-message');

let pollId = null;
let pollData = null;
let votes = [];
let profiles = {};
let optionTabs = [];
let genderChart = null;
let ageChart = null;

// --- Utility: Get pollId from URL ---
function getPollIdFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('pollId');
}

// --- Utility: Group votes by optionIndex ---
function groupVotesByOption(votes) {
    const grouped = {};
    votes.forEach(vote => {
        if (!grouped[vote.optionIndex]) grouped[vote.optionIndex] = [];
        grouped[vote.optionIndex].push(vote);
    });
    return grouped;
}

// --- Utility: Aggregate gender and age for a set of votes ---
function aggregateStats(votes, profiles) {
    const genderCounts = { Male: 0, Female: 0, Unknown: 0 };
    const ageCounts = { '18+': 0, '<18': 0, Unknown: 0 };
    votes.forEach(vote => {
        const profile = profiles[vote.userId];
        if (profile) {
            // Gender
            if (profile.gender === 'Male') genderCounts.Male++;
            else if (profile.gender === 'Female') genderCounts.Female++;
            else genderCounts.Unknown++;
            // Age
            if (typeof profile.age === 'number') {
                if (profile.age >= 18) ageCounts['18+']++;
                else ageCounts['<18']++;
            } else {
                ageCounts.Unknown++;
            }
        } else {
            genderCounts.Unknown++;
            ageCounts.Unknown++;
        }
    });
    return { genderCounts, ageCounts };
}

// --- Render Tabs ---
function renderTabs(options) {
    tabsContainer.innerHTML = '';
    optionTabs = [];
    options.forEach((option, idx) => {
        const tab = document.createElement('button');
        tab.textContent = option;
        tab.className = 'option-tab';
        tab.onclick = () => selectTab(idx);
        tabsContainer.appendChild(tab);
        optionTabs.push(tab);
    });
}

// --- Select Tab and Render Charts ---
function selectTab(optionIndex) {
    optionTabs.forEach((tab, idx) => {
        tab.classList.toggle('active', idx === optionIndex);
    });
    renderChartsForOption(optionIndex);
}

// --- Render Charts for Selected Option ---
function renderChartsForOption(optionIndex) {
    chartsContainer.innerHTML = '';
    if (!votes.length) {
        chartsContainer.innerHTML = '<p>No votes yet for this poll.</p>';
        return;
    }
    const optionVotes = votes.filter(v => v.optionIndex === optionIndex);
    if (!optionVotes.length) {
        chartsContainer.innerHTML = '<p>No votes for this option yet.</p>';
        return;
    }
    const { genderCounts, ageCounts } = aggregateStats(optionVotes, profiles);
    // Gender Pie Chart
    const genderCanvas = document.createElement('canvas');
    genderCanvas.width = 200; genderCanvas.height = 200;
    chartsContainer.appendChild(genderCanvas);
    genderChart = new Chart(genderCanvas, {
        type: 'pie',
        data: {
            labels: ['Male', 'Female', 'Unknown'],
            datasets: [{
                data: [genderCounts.Male, genderCounts.Female, genderCounts.Unknown],
                backgroundColor: ['#1976d2', '#e91e63', '#bdbdbd'],
            }]
        },
        options: {
            plugins: { legend: { display: true, position: 'bottom' } },
            responsive: false,
            maintainAspectRatio: false,
            title: { display: true, text: 'Gender' }
        }
    });
    // Age Pie Chart
    const ageCanvas = document.createElement('canvas');
    ageCanvas.width = 200; ageCanvas.height = 200;
    chartsContainer.appendChild(ageCanvas);
    ageChart = new Chart(ageCanvas, {
        type: 'pie',
        data: {
            labels: ['18+', '<18', 'Unknown'],
            datasets: [{
                data: [ageCounts['18+'], ageCounts['<18'], ageCounts.Unknown],
                backgroundColor: ['#388e3c', '#fbc02d', '#bdbdbd'],
            }]
        },
        options: {
            plugins: { legend: { display: true, position: 'bottom' } },
            responsive: false,
            maintainAspectRatio: false,
            title: { display: true, text: 'Age' }
        }
    });
}

// --- Fetch All User Profiles for Votes ---
async function fetchProfilesForVotes(votes) {
    const userIds = Array.from(new Set(votes.map(v => v.userId)));
    const profilePromises = userIds.map(async userId => {
        try {
            const doc = await db.collection('profiles').doc(userId).get();
            if (doc.exists) return { userId, ...doc.data() };
        } catch (e) {}
        return { userId, gender: 'Unknown', age: null };
    });
    const results = await Promise.all(profilePromises);
    const profilesMap = {};
    results.forEach(profile => {
        profilesMap[profile.userId] = profile;
    });
    return profilesMap;
}

// --- Main: Load Poll, Votes, Profiles, and Render ---
async function loadDashboard() {
    loadingMessage.textContent = 'Loading poll details...';
    pollId = getPollIdFromURL();
    if (!pollId) {
        loadingMessage.textContent = 'No poll specified.';
        return;
    }
    try {
        // 1. Fetch poll
        const pollDoc = await db.collection('polls').doc(pollId).get();
        if (!pollDoc.exists) {
            loadingMessage.textContent = 'Poll not found.';
            return;
        }
        pollData = pollDoc.data();
        // 2. Fetch votes
        const votesSnap = await db.collection('polls').doc(pollId).collection('votes').get();
        votes = votesSnap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        // 3. Fetch profiles
        profiles = await fetchProfilesForVotes(votes);
        // 4. Render tabs and default charts
        renderTabs(pollData.options);
        selectTab(0);
        loadingMessage.textContent = '';
    } catch (err) {
        loadingMessage.textContent = 'Error loading poll details.';
        console.error(err);
    }
}

// --- Auth Check ---
auth.onAuthStateChanged(user => {
    if (!user) {
        window.location.href = 'profile.html';
    } else {
        loadDashboard();
    }
});

// --- Styles for Tabs (inject if not in CSS) ---
(function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .option-tab {
            background: #e3f2fd;
            border: none;
            border-radius: 6px 6px 0 0;
            padding: 10px 24px;
            margin: 0 4px;
            font-size: 1rem;
            cursor: pointer;
            color: #1976d2;
            font-weight: 600;
            outline: none;
            transition: background 0.2s;
        }
        .option-tab.active {
            background: #1976d2;
            color: #fff;
        }
        .charts-container canvas {
            box-shadow: 0 2px 8px #0001;
            border-radius: 12px;
            background: #fff;
        }
    `;
    document.head.appendChild(style);
})(); 