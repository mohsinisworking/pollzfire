// Firebase SDKs (add at the top if not present)
if (typeof firebase === 'undefined') {
  var script1 = document.createElement('script');
  script1.src = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js';
  document.head.appendChild(script1);
  var script2 = document.createElement('script');
  script2.src = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js';
  document.head.appendChild(script2);
  var script3 = document.createElement('script');
  script3.src = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js';
  document.head.appendChild(script3);
}
// Firebase config (replace with your config if not present)
if (!firebase.apps.length) {
  firebase.initializeApp({
    apiKey: "AIzaSyAMlieM1Hfv0Fiuu30mAjzSlzDYevl3nZs",
    authDomain: "pollz-fire.firebaseapp.com",
    projectId: "pollz-fire"
  });
}
const auth = firebase.auth();
const db = firebase.firestore();

// Helper to get poll ID from poll element
function getPollId(poll) {
    return poll.getAttribute('data-poll-id');
}

// Helper to get current user ID
function getUserId() {
    return firebase.auth().currentUser ? firebase.auth().currentUser.uid : null;
}

// Auth/profile check on page load
window.onload = function() {
  auth.onAuthStateChanged(function(user) {
    if (!user) {
      window.location.href = 'profile.html';
    } else {
      db.collection('profiles').doc(user.uid).get().then(function(doc) {
        if (!doc.exists) {
          window.location.href = 'profile.html';
        } else {
          // User is authenticated and has a profile, continue to show the feed
          initializeFeed();
        }
      });
    }
  });
};

function initializeFeed() {
    var feed = document.querySelector('.feed');
    feed.innerHTML = '';
    // Fetch all polls from Firestore
    db.collection('polls').orderBy('createdAt', 'desc').get().then(function(snapshot) {
        snapshot.forEach(function(doc) {
            var pollData = doc.data();
            var pollId = doc.id;
            var pollDiv = document.createElement('div');
            pollDiv.className = 'poll';
            pollDiv.setAttribute('data-poll-id', pollId);
            pollDiv.innerHTML = '<div class="poll-question">' + pollData.question + '</div>';
            var pollOptionsDiv = document.createElement('div');
            pollOptionsDiv.className = 'poll-options';
            pollData.options.forEach(function(opt) {
                var btn = document.createElement('button');
                btn.className = 'option';
                btn.textContent = opt;
                pollOptionsDiv.appendChild(btn);
            });
            pollDiv.appendChild(pollOptionsDiv);
            feed.appendChild(pollDiv);
        });
        // After rendering all polls, attach voting logic
        attachVotingLogic();
    });
}

function attachVotingLogic() {
    var polls = document.querySelectorAll('.poll');
    polls.forEach(function(poll) {
        let pollId = getPollId(poll);
        var options = poll.querySelectorAll('.option');
        var userId = getUserId();
        // Fetch votes for this poll from Firestore
        db.collection('polls').doc(pollId).collection('votes').get().then(function(snapshot) {
            var votes = Array(options.length).fill(0);
            var userVotedOption = null;
            var totalVotes = 0;
            snapshot.forEach(function(doc) {
                var data = doc.data();
                if (typeof data.optionIndex === 'number') {
                    votes[data.optionIndex] = (votes[data.optionIndex] || 0) + 1;
                    totalVotes++;
                    if (data.userId === userId) {
                        userVotedOption = data.optionIndex;
                    }
                }
            });
            // Show percentages if user has voted
            if (userVotedOption !== null) {
                showPercentages(options, votes, totalVotes);
                options.forEach(function(opt, idx) {
                    opt.disabled = true;
                    if (idx === userVotedOption) opt.classList.add('selected');
                });
            }
        });
        // Voting logic
        options.forEach(function(option, optionIndex) {
            option.addEventListener('click', function(event) {
                // Check if user already voted for this poll
                db.collection('polls').doc(pollId).collection('votes')
                  .where('userId', '==', getUserId())
                  .get().then(function(snapshot) {
                    if (!snapshot.empty) return; // Already voted
                    // Add vote to Firestore
                    db.collection('polls').doc(pollId).collection('votes').add({
                        userId: getUserId(),
                        optionIndex: optionIndex,
                        timestamp: firebase.firestore.FieldValue.serverTimestamp()
                    }).then(function() {
                        // After voting, refresh the poll display
                        db.collection('polls').doc(pollId).collection('votes').get().then(function(snapshot) {
                            var votes = Array(options.length).fill(0);
                            var totalVotes = 0;
                            snapshot.forEach(function(doc) {
                                var data = doc.data();
                                if (typeof data.optionIndex === 'number') {
                                    votes[data.optionIndex] = (votes[data.optionIndex] || 0) + 1;
                                    totalVotes++;
                                }
                            });
                            showPercentages(options, votes, totalVotes);
                            options.forEach(function(opt, idx) {
                                opt.disabled = true;
                                if (idx === optionIndex) opt.classList.add('selected');
                            });
                        });
                    });
                });
                event.stopPropagation();
            });
        });
        // Navigate to details page if poll is clicked (not option)
        poll.addEventListener('click', function(event) {
            if (!event.target.classList.contains('option')) {
                window.location.href = 'details.html?pollId=' + pollId;
            }
        });
    });
}

// Helper to show percentages next to options
function showPercentages(options, votes, totalVotes) {
    options.forEach(function(option, i) {
        var percent = totalVotes > 0 ? Math.round((votes[i] / totalVotes) * 100) : 0;
        var existing = option.querySelector('.option-percentage');
        if (existing) existing.remove();
        var span = document.createElement('span');
        span.className = 'option-percentage';
        span.textContent = percent + '%';
        option.appendChild(span);
    });
}

// Modal functionality for creating a poll
var fab = document.querySelector('.fab');
var modal = document.getElementById('modal');
var closeModal = document.getElementById('closeModal');
var pollForm = document.getElementById('pollForm');
var optionsContainer = document.getElementById('optionsContainer');
var addOptionBtn = document.getElementById('addOption');

// Open modal on FAB click
fab.onclick = function() {
    modal.style.display = 'flex';
};
// Close modal on X click
closeModal.onclick = function() {
    modal.style.display = 'none';
    pollForm.reset();
    // Reset to 2 options
    optionsContainer.innerHTML = '<input type="text" name="option" class="option-input" required placeholder="Option 1"><br><input type="text" name="option" class="option-input" required placeholder="Option 2"><br>';
};
// Close modal when clicking outside modal content
window.onclick = function(event) {
    if (event.target == modal) {
        modal.style.display = 'none';
        pollForm.reset();
        optionsContainer.innerHTML = '<input type="text" name="option" class="option-input" required placeholder="Option 1"><br><input type="text" name="option" class="option-input" required placeholder="Option 2"><br>';
    }
};
// Add more option fields
addOptionBtn.onclick = function() {
    var count = optionsContainer.querySelectorAll('.option-input').length + 1;
    var input = document.createElement('input');
    input.type = 'text';
    input.name = 'option';
    input.className = 'option-input';
    input.required = true;
    input.placeholder = 'Option ' + count;
    optionsContainer.appendChild(input);
    optionsContainer.appendChild(document.createElement('br'));
};
// Handle form submission
pollForm.onsubmit = function(e) {
    e.preventDefault();
    var question = document.getElementById('question').value;
    var optionInputs = optionsContainer.querySelectorAll('.option-input');
    var options = [];
    optionInputs.forEach(function(input) {
        if (input.value.trim() !== '') {
            options.push(input.value.trim());
        }
    });
    if (question.trim() === '' || options.length < 2) {
        alert('Please enter a question and at least two options.');
        return;
    }
    // Save poll to Firestore
    db.collection('polls').add({
        question: question,
        options: options,
        createdBy: getUserId(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function() {
        modal.style.display = 'none';
        pollForm.reset();
        optionsContainer.innerHTML = '<input type="text" name="option" class="option-input" required placeholder="Option 1"><br><input type="text" name="option" class="option-input" required placeholder="Option 2"><br>';
        // Refresh feed to show new poll
        initializeFeed();
    });
}; 