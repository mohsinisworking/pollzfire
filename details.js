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
    const genderCounts = { Male: 0, Female: 0 };
    const ageCounts = { '1-12': 0, '13-28': 0, '29-44': 0, '45-60': 0, '61-79': 0 };
    votes.forEach(vote => {
        const profile = profiles[vote.userId];
        if (profile) {
            // Normalize gender
            let gender = (profile.gender || '').toLowerCase();
            if (gender === 'male') genderCounts.Male++;
            else if (gender === 'female') genderCounts.Female++;
            // Age buckets
            const age = Number(profile.age);
            if (!isNaN(age)) {
                if (age >= 1 && age <= 12) ageCounts['1-12']++;
                else if (age >= 13 && age <= 28) ageCounts['13-28']++;
                else if (age >= 29 && age <= 44) ageCounts['29-44']++;
                else if (age >= 45 && age <= 60) ageCounts['45-60']++;
                else if (age >= 61 && age <= 79) ageCounts['61-79']++;
            }
        }
    });
    return { genderCounts, ageCounts };
}

// --- Utility: Build Pie Chart Data (labels, data, colors) for non-zero categories ---
function buildPieChartData(counts, labelColorMap) {
    const labels = [];
    const data = [];
    const colors = [];
    for (const [label, color] of Object.entries(labelColorMap)) {
        if (counts[label] > 0) {
            labels.push(label);
            data.push(counts[label]);
            colors.push(color);
        }
    }
    return { labels, data, colors };
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

function selectTab(optionIndex) {
    optionTabs.forEach((tab, idx) => {
        tab.classList.toggle('active', idx === optionIndex);
    });
    renderChartsForOption(optionIndex);
}

// --- Render Charts for Selected Option ---
function renderChartsForOption(optionIndex) {
    chartsContainer.innerHTML = '';
    // Move total votes display above tabs
    const optionVotes = votes.filter(v => v.optionIndex === optionIndex);
    const totalVotes = votes.length; // Show total votes for the entire poll
    let totalVotesDiv = document.getElementById('details-total-votes');
    if (!totalVotesDiv) {
        totalVotesDiv = document.createElement('div');
        totalVotesDiv.id = 'details-total-votes';
        totalVotesDiv.className = 'details-total-votes';
        // Insert above tabs-container
        const tabsContainer = document.getElementById('tabs-container');
        if (tabsContainer && tabsContainer.parentNode) {
            tabsContainer.parentNode.insertBefore(totalVotesDiv, tabsContainer);
        }
    }
    totalVotesDiv.textContent = `Total Votes: ${totalVotes}`;
    if (!votes.length) {
        chartsContainer.innerHTML = '<p>No votes yet for this poll.</p>';
        totalVotesDiv.textContent = 'Total Votes: 0';
        return;
    }
    if (!optionVotes.length) {
        chartsContainer.innerHTML = '<p>No votes for this option yet.</p>';
        totalVotesDiv.textContent = 'Total Votes: 0';
        return;
    }
    const { genderCounts, ageCounts } = aggregateStats(optionVotes, profiles);
    // Gender Pie Chart
    const genderCanvas = document.createElement('canvas');
    genderCanvas.width = 200; genderCanvas.height = 200;
    chartsContainer.appendChild(genderCanvas);
    const genderLabelColorMap = {
        'Male': '#1976d2',
        'Female': '#e91e63'
    };
    const genderPie = buildPieChartData(genderCounts, genderLabelColorMap);
    if (genderPie.data.length === 0) {
        chartsContainer.innerHTML += '<p>No gender data for this option.</p>';
    } else {
        genderChart = new Chart(genderCanvas, {
            type: 'pie',
            data: {
                labels: genderPie.labels,
                datasets: [{
                    data: genderPie.data,
                    backgroundColor: genderPie.colors,
                }]
            },
            options: {
                plugins: { legend: { display: true, position: 'bottom' } },
                responsive: false,
                maintainAspectRatio: false,
                title: { display: true, text: 'Gender' }
            }
        });
    }
    // Age Pie Chart
    const ageCanvas = document.createElement('canvas');
    ageCanvas.width = 200; ageCanvas.height = 200;
    chartsContainer.appendChild(ageCanvas);
    const ageLabelColorMap = {
        '1-12': '#90caf9',
        '13-28': '#fbc02d',
        '29-44': '#388e3c',
        '45-60': '#ab47bc',
        '61-79': '#ef5350'
    };
    const agePie = buildPieChartData(ageCounts, ageLabelColorMap);
    if (agePie.data.length === 0) {
        chartsContainer.innerHTML += '<p>No age data for this option.</p>';
    } else {
        ageChart = new Chart(ageCanvas, {
            type: 'pie',
            data: {
                labels: agePie.labels,
                datasets: [{
                    data: agePie.data,
                    backgroundColor: agePie.colors,
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
        .details-total-votes {
            font-size: 1.2rem;
            font-weight: bold;
            color: #1976d2;
            margin-bottom: 15px;
            padding: 10px 15px;
            background-color: #e3f2fd;
            border-radius: 8px;
            border: 1px solid #1976d2;
            text-align: center;
        }
    `;
    document.head.appendChild(style);
})(); 