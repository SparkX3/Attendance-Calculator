// State Object
const state = {
    user: null,
    profile: null,
    timetable: [],
    subjects: {}, // { "SubjectName": { present: 0, absent: 0 } }
    targetAttendance: 75
};

// DOM Elements
const views = ['login-view', 'profile-view', 'upload-view', 'analyzing-view', 'confirmation-view', 'dashboard-view'];
const userMenu = document.getElementById('user-menu');
const headerUserName = document.getElementById('header-user-name');
const logoutBtn = document.getElementById('logout-btn');
const themeToggle = document.getElementById('theme-toggle');

// Initialize App
function initApp() {
    loadState();
    setupTheme();
    setupEventListeners();
    
    if (state.user && state.profile && Object.keys(state.subjects).length > 0) {
        showView('dashboard-view');
        renderDashboard();
    } else if (state.user && state.profile) {
        showView('upload-view');
    } else if (state.user) {
        showView('profile-view');
    } else {
        showView('login-view');
    }
}

// State Management
function saveState() {
    localStorage.setItem('attendanceState', JSON.stringify(state));
}

function loadState() {
    const saved = localStorage.getItem('attendanceState');
    if (saved) {
        Object.assign(state, JSON.parse(saved));
    }
}

// View Management
function showView(viewId) {
    views.forEach(v => document.getElementById(v).classList.remove('active'));
    views.forEach(v => document.getElementById(v).classList.add('hidden'));
    
    document.getElementById(viewId).classList.remove('hidden');
    
    // Tiny delay for animation
    setTimeout(() => {
        document.getElementById(viewId).classList.add('active');
    }, 10);

    updateHeader();
}

function updateHeader() {
    if (state.user) {
        userMenu.classList.remove('hidden');
        headerUserName.textContent = state.profile ? state.profile.fullName : state.user.email;
    } else {
        userMenu.classList.add('hidden');
    }
}

// Theme Management
function setupTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    themeToggle.addEventListener('click', () => {
        const currentTheme = document.body.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.body.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeIcon(newTheme);
    });
}

function updateThemeIcon(theme) {
    themeToggle.innerHTML = theme === 'dark' ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
}

// Flow Handlers
function setupEventListeners() {
    // 1. Login
    document.getElementById('google-login-btn').addEventListener('click', () => {
        // Mock Google Login
        state.user = { id: '123', email: 'student@college.edu' };
        saveState();
        showView('profile-view');
    });

    // 2. Profile
    document.getElementById('profile-form').addEventListener('submit', (e) => {
        e.preventDefault();
        state.profile = {
            fullName: document.getElementById('fullName').value,
            rollNumber: document.getElementById('rollNumber').value,
            collegeName: document.getElementById('collegeName').value,
            semester: document.getElementById('semester').value
        };
        saveState();
        showView('upload-view');
    });

    // 3. Upload Timetable
    document.getElementById('timetable-file').addEventListener('change', handleFileUpload);
    document.getElementById('skip-upload-btn').addEventListener('click', () => {
        state.timetable = [];
        showView('confirmation-view');
        renderTimetableEditor();
    });

    // 5. Confirmation
    document.getElementById('add-lecture-btn').addEventListener('click', addEmptyLectureRow);
    document.getElementById('confirm-timetable-btn').addEventListener('click', processTimetableAndStart);
    document.getElementById('save-edits-btn').addEventListener('click', () => alert('Changes saved locally.'));

    // Dashboard Actions
    document.getElementById('add-subject-btn').addEventListener('click', () => {
        document.getElementById('add-subject-modal').classList.remove('hidden');
    });
    
    document.getElementById('close-subject-modal').addEventListener('click', () => {
        document.getElementById('add-subject-modal').classList.add('hidden');
    });

    document.getElementById('save-new-subject-btn').addEventListener('click', () => {
        const name = document.getElementById('new-subject-name').value.trim();
        if (name && !state.subjects[name]) {
            state.subjects[name] = { present: 0, absent: 0 };
            saveState();
            renderDashboard();
            document.getElementById('new-subject-name').value = '';
            document.getElementById('add-subject-modal').classList.add('hidden');
        }
    });

    document.getElementById('target-slider').addEventListener('input', (e) => {
        state.targetAttendance = parseInt(e.target.value);
        document.getElementById('target-display').textContent = `${state.targetAttendance}%`;
        saveState();
        renderDashboard();
    });

    // Logout
    logoutBtn.addEventListener('click', () => {
        if(confirm('Are you sure you want to logout?')) {
            localStorage.removeItem('attendanceState');
            Object.assign(state, { user: null, profile: null, timetable: [], subjects: {}, targetAttendance: 75 });
            showView('login-view');
        }
    });
}

// 4. Mock AI Extraction
function handleFileUpload(e) {
    if (!e.target.files.length) return;
    
    showView('analyzing-view');
    
    // Simulate AI processing delay (3 seconds)
    setTimeout(() => {
        // Mock extracted data
        state.timetable = [
            { id: Date.now()+1, day: 'Monday', time: '09:00 AM', subject: 'Data Structures', type: 'Lecture', faculty: 'Dr. Smith', room: '101' },
            { id: Date.now()+2, day: 'Monday', time: '11:00 AM', subject: 'Operating Systems', type: 'Lecture', faculty: 'Prof. Johnson', room: '102' },
            { id: Date.now()+3, day: 'Tuesday', time: '10:00 AM', subject: 'Database Systems', type: 'Practical', faculty: 'Mr. Lee', room: 'Lab 1' },
            { id: Date.now()+4, day: 'Wednesday', time: '09:00 AM', subject: 'Data Structures', type: 'Tutorial', faculty: 'Dr. Smith', room: '205' },
        ];
        showView('confirmation-view');
        renderTimetableEditor();
    }, 3000);
}

// 5. Timetable Editor
function renderTimetableEditor() {
    const tbody = document.getElementById('timetable-body');
    tbody.innerHTML = '';
    
    state.timetable.forEach(lecture => {
        tbody.appendChild(createLectureRow(lecture));
    });

    // Show save edits button if there are lectures
    document.getElementById('save-edits-btn').style.display = 'inline-flex';
}

function createLectureRow(lecture) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input type="text" value="${lecture.day || ''}" onchange="updateLecture(${lecture.id}, 'day', this.value)"></td>
        <td><input type="text" value="${lecture.time || ''}" onchange="updateLecture(${lecture.id}, 'time', this.value)" placeholder="e.g. 09:00 AM"></td>
        <td><input type="text" value="${lecture.subject || ''}" onchange="updateLecture(${lecture.id}, 'subject', this.value)"></td>
        <td>
            <select onchange="updateLecture(${lecture.id}, 'type', this.value)">
                <option value="Lecture" ${lecture.type === 'Lecture' ? 'selected' : ''}>Lecture</option>
                <option value="Practical" ${lecture.type === 'Practical' ? 'selected' : ''}>Practical</option>
                <option value="Tutorial" ${lecture.type === 'Tutorial' ? 'selected' : ''}>Tutorial</option>
            </select>
        </td>
        <td><input type="text" value="${lecture.faculty || ''}" onchange="updateLecture(${lecture.id}, 'faculty', this.value)"></td>
        <td><input type="text" value="${lecture.room || ''}" onchange="updateLecture(${lecture.id}, 'room', this.value)"></td>
        <td><button class="action-btn" onclick="deleteLecture(${lecture.id}, this)"><i class="fa-solid fa-trash"></i></button></td>
    `;
    return tr;
}

window.updateLecture = function(id, field, value) {
    const lecture = state.timetable.find(l => l.id === id);
    if (lecture) {
        lecture[field] = value;
    }
}

window.deleteLecture = function(id, btn) {
    state.timetable = state.timetable.filter(l => l.id !== id);
    btn.closest('tr').remove();
}

function addEmptyLectureRow() {
    const newId = Date.now();
    const newLecture = { id: newId, day: '', time: '', subject: '', type: 'Lecture', faculty: '', room: '' };
    state.timetable.push(newLecture);
    document.getElementById('timetable-body').appendChild(createLectureRow(newLecture));
}

function processTimetableAndStart() {
    // Extract unique subjects
    const uniqueSubjects = new Set();
    state.timetable.forEach(l => {
        if(l.subject.trim()) uniqueSubjects.add(l.subject.trim());
    });

    uniqueSubjects.forEach(sub => {
        if (!state.subjects[sub]) {
            state.subjects[sub] = { present: 0, absent: 0 };
        }
    });

    saveState();
    showView('dashboard-view');
    renderDashboard();
}

// 6. Dashboard Math & Rendering
function calculateStats(present, absent) {
    const total = present + absent;
    const percentage = total === 0 ? 0 : Math.round((present / total) * 100);
    const target = state.targetAttendance;
    
    let safeBunks = 0;
    let needed = 0;

    if (total > 0) {
        // Safe bunks: How many can I miss and still stay >= target%
        // (present) / (total + safeBunks) >= target/100
        // safeBunks <= (present * 100 / target) - total
        let possibleBunks = Math.floor((present * 100 / target) - total);
        safeBunks = possibleBunks > 0 ? possibleBunks : 0;

        // Needed: How many more do I need to attend to reach target%
        // (present + needed) / (total + needed) >= target/100
        // (present + needed) * 100 >= target * (total + needed)
        // 100*present + 100*needed >= target*total + target*needed
        // needed * (100 - target) >= target*total - 100*present
        if (percentage < target && target < 100) {
            needed = Math.ceil((target * total - 100 * present) / (100 - target));
        }
    }

    return { total, present, absent, percentage, safeBunks, needed };
}

function renderDashboard() {
    const container = document.getElementById('subjects-container');
    container.innerHTML = '';

    let totalPresent = 0;
    let totalAbsent = 0;

    // Set Slider Value
    document.getElementById('target-slider').value = state.targetAttendance;
    document.getElementById('target-display').textContent = `${state.targetAttendance}%`;

    Object.keys(state.subjects).forEach(subject => {
        const subData = state.subjects[subject];
        totalPresent += subData.present;
        totalAbsent += subData.absent;

        const stats = calculateStats(subData.present, subData.absent);
        
        let statusMsg = '';
        if (stats.total === 0) statusMsg = 'No classes recorded yet.';
        else if (stats.safeBunks > 0) statusMsg = `You can bunk ${stats.safeBunks} classes.`;
        else if (stats.needed > 0) statusMsg = `Need to attend next ${stats.needed} classes.`;
        else statusMsg = 'On track.';

        const card = document.createElement('div');
        card.className = 'subject-card';
        card.innerHTML = `
            <div class="subject-header">
                <span class="subject-title">${subject}</span>
                <button class="subject-delete" onclick="deleteSubject('${subject}')"><i class="fa-solid fa-trash-alt"></i></button>
            </div>
            
            <div class="attendance-display">
                <span class="percentage" style="color: ${stats.percentage >= state.targetAttendance ? 'var(--success-color)' : 'var(--danger-color)'}">${stats.percentage}%</span>
                <span class="fraction">${stats.present} / ${stats.total} Classes</span>
            </div>

            <div class="progress-bar-bg">
                <div class="progress-bar-fill" style="width: ${stats.percentage}%; background-color: ${stats.percentage >= state.targetAttendance ? 'var(--success-color)' : 'var(--danger-color)'}"></div>
            </div>

            <div class="subject-stats">
                <span>${statusMsg}</span>
            </div>

            <div class="subject-actions">
                <button class="btn btn-present" onclick="markAttendance('${subject}', 'present')">
                    <i class="fa-solid fa-check"></i> Present
                </button>
                <button class="btn btn-absent" onclick="markAttendance('${subject}', 'absent')">
                    <i class="fa-solid fa-xmark"></i> Absent
                </button>
            </div>
        `;
        container.appendChild(card);
    });

    // Update Overall
    const overallStats = calculateStats(totalPresent, totalAbsent);
    document.getElementById('overall-percentage').textContent = `${overallStats.percentage}%`;
    document.getElementById('overall-attended').textContent = overallStats.present;
    document.getElementById('overall-missed').textContent = overallStats.absent;
    document.getElementById('overall-safe-bunks').textContent = overallStats.safeBunks;

    const msgEl = document.getElementById('target-message');
    if (overallStats.total === 0) {
        msgEl.textContent = 'Start tracking to see insights!';
        msgEl.className = 'target-message';
    } else if (overallStats.percentage >= state.targetAttendance) {
        msgEl.textContent = `You are on track! You can afford to bunk ${overallStats.safeBunks} more classes.`;
        msgEl.className = 'target-message msg-success';
    } else {
        msgEl.textContent = `Warning: You need to attend the next ${overallStats.needed} classes to reach your goal.`;
        msgEl.className = 'target-message msg-danger';
    }
}

window.markAttendance = function(subject, type) {
    if (type === 'present') state.subjects[subject].present++;
    if (type === 'absent') state.subjects[subject].absent++;
    saveState();
    renderDashboard();
}

window.deleteSubject = function(subject) {
    if(confirm(`Are you sure you want to delete ${subject}?`)) {
        delete state.subjects[subject];
        saveState();
        renderDashboard();
    }
}

// Boot
window.onload = initApp;
