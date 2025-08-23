// ES6 Module imports for Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import { 
    getDatabase, ref, onValue, push, update, remove, query, orderByChild 
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-database.js";
import { 
    getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut 
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";

// --- CONFIGURATION ---
const firebaseConfig = { 
    apiKey: "AIzaSyBdiEUorFPkiZAya84Xzx17id82nB77Zg4", 
    authDomain: "sheep-1b6a7.firebaseapp.com", 
    databaseURL: "https://sheep-1b6a7-default-rtdb.firebaseio.com", 
    projectId: "sheep-1b6a7", 
    storageBucket: "sheep-1b6a7.firebasestorage.app", 
    messagingSenderId: "243565434909", 
    appId: "1:243565434909:web:25312f89033e3fd0d54ef4" 
};

// --- FIREBASE INITIALIZATION ---
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// --- APPLICATION STATE ---
const state = {
    allRecords: [],
    soldRecords: [],
    archivedRecords: [],
    modals: {},
    charts: {},
    currentWeeklyFilter: 'all',
    currentScheduleFilter: 'all',
};

// --- DOM ELEMENT CACHE ---
const DOMElements = {};

/**
 * Caches all static DOM elements used in the application.
 */
function cacheDOMElements() {
    const ids = [
        'authSection', 'loginForm', 'loginEmail', 'loginPassword', 'authError', 'mainApp', 'signOutBtn',
        'sidebarToggleBtn', 'notification-badge', 'notification-list', 'schedule-notification-badge', 'schedule-notification-list',
        'homeSection', 'fastestGrowersList', 'slowestGrowersList', 'sheepHealthForm', 'sheepId', 'healthStatus',
        'dateRecorded', 'weight', 'temperature', 'notes', 'recordsSection', 'searchInput', 'healthyRecordsTableBody',
        'treatmentSection', 'treatmentSearchInput', 'treatmentRecordsTableBody', 'scheduleSection', 'batchLogBtn',
        'scheduleSearchInput', 'scheduleFilterButtons', 'scheduleTable', 'selectAllSchedule', 'scheduleTableBody',
        'weeklySection', 'weeklySearchInput', 'weeklyFilterButtons', 'weeklyTable', 'weeklyTableBody',
        'weightSection', 'weightSheepSelector', 'latestWeightDisplay', 'latestWeightValue', 'addWeightBtn',
        'noWeightData', 'weightDisplayArea', 'weightChartContainer', 'weightChart', 'weightStatsContainer',
        'weightStatsBody', 'weightTableContainer', 'profileSection', 'profileEditBtn', 'profileSearchInput',
        'prevSheepBtn', 'nextSheepBtn', 'profileSheepSelector', 'noProfileData', 'profileDisplayArea',
        'profileSheepId', 'profileHealthStatus', 'profileDateRecorded', 'profileInitialNotes', 'profileSaleInfoCard',
        'profileSaleDate', 'profileSalePrice', 'profileSaleBuyer', 'profileSaleNotes', 'profileDewormingStatus',
        'profileDewormingNotes', 'profileVaccinationStatus', 'profileVaccinationNotes', 'profileWeightDisplayArea',
        'profileWeightChartContainer', 'profileWeightChart', 'profileWeightStatsContainer', 'profileWeightStatsBody',
        'profileWeightTableContainer', 'profileTreatmentHistoryTbody', 'saledSection', 'soldSearchInput',
        'sheepSaledTableBody', 'exportSoldBtn', 'archivedSection', 'archivedSearchInput', 'archivedRecordsTableBody',
        'analyticsSection', 'totalCount', 'healthyCount', 'sickCount', 'treatmentCount', 'healthStatusChart',
        'analyticsSearchInput', 'analyticsHealthyRecordsTableBody', 'exportHealthyBtn', 'exportTreatmentBtn', 'exportAnalyticsBtn',
        'editSheepModal', 'editSheepForm', 'saleSheepModal', 'saleSheepForm', 'treatmentLogModal', 'addTreatmentForm',
        'resetTreatmentFormBtn', 'treatmentLogTbody', 'modalSheepId', 'currentSheepRecordId', 'treatmentEntryId',
        'weightEntryModal', 'weightEntryForm', 'batchTreatmentModal', 'batchTreatmentForm', 'batchCount', 'batchTreatmentDate', 'loadingOverlay',
        'appToast', 'toastTitle', 'toastBody'
    ];
    ids.forEach(id => {
        DOMElements[id] = document.getElementById(id);
    });
    DOMElements.dashboardSidebar = document.querySelector('.dashboard-sidebar');
}

/**
 * Sets up all event listeners for the application.
 */
function setupEventListeners() {
    DOMElements.loginForm.addEventListener('submit', handleLogin);
    DOMElements.signOutBtn.addEventListener('click', () => signOut(auth));
    DOMElements.sheepHealthForm.addEventListener('submit', handleAddRecord);
    DOMElements.editSheepForm.addEventListener('submit', handleUpdateRecord);
    DOMElements.saleSheepForm.addEventListener('submit', handleSaleSubmit);
    DOMElements.addTreatmentForm.addEventListener('submit', handleSaveTreatment);
    DOMElements.batchTreatmentForm.addEventListener('submit', handleBatchSaveTreatment);
    DOMElements.weightEntryForm.addEventListener('submit', handleSaveWeight);
    
    DOMElements.sidebarToggleBtn.addEventListener('click', () => DOMElements.dashboardSidebar.classList.toggle('visible'));
    DOMElements.resetTreatmentFormBtn.addEventListener('click', resetTreatmentForm);
    DOMElements.batchLogBtn.addEventListener('click', openBatchLogModal);
    DOMElements.addWeightBtn.addEventListener('click', () => openWeightModal(DOMElements.weightSheepSelector.value));
    DOMElements.profileEditBtn.addEventListener('click', () => openEditModal(DOMElements.profileSheepSelector.value));

    // Navigation
    DOMElements.dashboardSidebar.addEventListener('click', e => {
        const navLink = e.target.closest('.nav-link');
        if (navLink && navLink.dataset.section) {
            e.preventDefault();
            showSection(navLink.dataset.section);
        }
    });

    // Search inputs
    const searchInputs = [
        DOMElements.searchInput, DOMElements.treatmentSearchInput, DOMElements.scheduleSearchInput,
        DOMElements.weeklySearchInput, DOMElements.soldSearchInput, DOMElements.archivedSearchInput,
        DOMElements.analyticsSearchInput
    ];
    searchInputs.forEach(input => input.addEventListener('keyup', e => filterTable(e.target)));
    DOMElements.profileSearchInput.addEventListener('keyup', filterProfileSelector);

    // Filter buttons
    DOMElements.scheduleFilterButtons.addEventListener('click', e => {
        if (e.target.matches('button')) updateScheduleView(e.target.dataset.filter);
    });
    DOMElements.weeklyFilterButtons.addEventListener('click', e => {
        if (e.target.matches('button')) updateWeeklyTrackingView(e.target.dataset.filter);
    });

    // Export buttons
    DOMElements.exportHealthyBtn.addEventListener('click', () => exportData('healthy'));
    DOMElements.exportAnalyticsBtn.addEventListener('click', () => exportData('healthy'));
    DOMElements.exportTreatmentBtn.addEventListener('click', () => exportData('treatment'));
    DOMElements.exportSoldBtn.addEventListener('click', exportSoldData);

    // Selectors and Profile Navigation
    DOMElements.profileSheepSelector.addEventListener('change', e => {
        if (e.target.value) renderProfileForSheep(e.target.value);
    });
    DOMElements.weightSheepSelector.addEventListener('change', e => {
        if (e.target.value) renderWeightChartForSheep(e.target.value);
    });
    DOMElements.prevSheepBtn.addEventListener('click', () => navigateProfile(-1));
    DOMElements.nextSheepBtn.addEventListener('click', () => navigateProfile(1));

    // Event Delegation for dynamic content
    document.body.addEventListener('click', handleDynamicClicks);
    DOMElements.scheduleTableBody.addEventListener('change', e => {
        if (e.target.matches('.sheep-select-checkbox')) updateBatchLogUI();
    });
    DOMElements.selectAllSchedule.addEventListener('change', e => {
        document.querySelectorAll('#scheduleTableBody .sheep-select-checkbox').forEach(cb => cb.checked = e.target.checked);
        updateBatchLogUI();
    });
}

/**
 * Handles clicks on dynamically generated elements using event delegation.
 * @param {Event} e The click event.
 */
function handleDynamicClicks(e) {
    const target = e.target.closest('[data-action]');
    if (!target) return;

    const { action, id, sheepId, source } = target.dataset;

    const actions = {
        'edit-record': () => openEditModal(id),
        'sale-record': () => openSaleModal(id),
        'delete-record': () => deleteRecord(id, sheepId),
        'archive-record': () => archiveRecord(id),
        'manage-treatment': () => openTreatmentLog(id, sheepId),
        'delete-sold': () => deleteSoldRecord(id, sheepId),
        'delete-archived': () => deleteArchivedRecord(id, sheepId),
        'edit-treatment': () => editTreatmentEntry(target.dataset.recordId, id),
        'delete-treatment': () => deleteTreatmentEntry(target.dataset.recordId, id),
        'edit-weight': () => openWeightModal(target.dataset.recordId, id, source),
        'delete-weight': () => deleteWeightEntry(target.dataset.recordId, id, source),
        'view-notification': () => viewRecordFromNotification(id),
    };

    if (actions[action]) {
        e.preventDefault();
        actions[action]();
    }
}

/**
 * Initializes the application UI after successful login.
 */
function initializeAppUI() {
    cacheDOMElements();
    
    // Initialize Bootstrap Modals
    state.modals.edit = new bootstrap.Modal(DOMElements.editSheepModal);
    state.modals.sale = new bootstrap.Modal(DOMElements.saleSheepModal);
    state.modals.treatment = new bootstrap.Modal(DOMElements.treatmentLogModal);
    state.modals.weight = new bootstrap.Modal(DOMElements.weightEntryModal);
    state.modals.batch = new bootstrap.Modal(DOMElements.batchTreatmentModal);
    state.toast = new bootstrap.Toast(DOMElements.appToast);

    DOMElements.dateRecorded.valueAsDate = new Date();
    
    setupEventListeners();
    
    // Initial data fetch
    fetchAllRecords();
    fetchSoldRecords();
    fetchArchivedRecords();
}

// --- AUTHENTICATION ---

onAuthStateChanged(auth, user => {
    if (user) {
        DOMElements.mainApp.style.display = 'block';
        DOMElements.authSection.style.display = 'none';
        if (!state.isInitialized) {
            initializeAppUI();
            state.isInitialized = true;
        }
    } else {
        DOMElements.mainApp.style.display = 'none';
        DOMElements.authSection.style.display = 'block';
    }
    // Hide the loading overlay after auth check is complete
    DOMElements.loadingOverlay.style.display = 'none';
});

async function handleLogin(e) {
    e.preventDefault();
    const email = DOMElements.loginEmail.value;
    const password = DOMElements.loginPassword.value;
    try {
        await signInWithEmailAndPassword(auth, email, password);
        DOMElements.authError.textContent = '';
    } catch (err) {
        DOMElements.authError.textContent = err.message;
    }
}

// --- UTILITY FUNCTIONS ---

function formatDate(dateString) {
    if (!dateString) return '';
    try {
        const date = new Date(dateString.split('T')[0] + 'T00:00:00');
        if (isNaN(date.getTime())) return dateString;
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = String(date.getFullYear()).slice(-2);
        return `${day}/${month}/${year}`;
    } catch (e) {
        return dateString;
    }
}

/**
 * Shows a toast notification.
 * @param {string} title The title of the toast.
 * @param {string} body The message body of the toast.
 * @param {string} type 'success', 'danger', or 'warning' to control the color.
 */
function showToast(title, body, type = 'success') {
    const toastHeader = DOMElements.appToast.querySelector('.toast-header');
    
    // Remove old color classes
    toastHeader.classList.remove('bg-success', 'bg-danger', 'bg-warning', 'text-white');

    // Add new color class
    toastHeader.classList.add(`bg-${type}`, 'text-white');

    DOMElements.toastTitle.textContent = title;
    DOMElements.toastBody.textContent = body;
    state.toast.show();
}

function getStatusClass(status) {
    const statusMap = {
        'Healthy': 'status-healthy',
        'Recovering': 'status-healthy',
        'Sick': 'status-sick',
        'Deceased': 'status-sick',
        'Under Treatment': 'status-treatment',
    };
    return statusMap[status] || '';
}

function showSection(sectionName) {
    ['home', 'records', 'treatment', 'saled', 'analytics', 'archived', 'schedule', 'weekly', 'weight', 'profile'].forEach(id => {
        const section = document.getElementById(id + 'Section');
        if (section) section.classList.add('hidden');
    });
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    
    const activeSection = document.getElementById(sectionName + 'Section');
    const activeLink = document.querySelector(`.nav-link[data-section="${sectionName}"]`);

    if (activeSection) activeSection.classList.remove('hidden');
    if (activeLink) activeLink.classList.add('active');

    if (DOMElements.dashboardSidebar.classList.contains('visible')) {
        DOMElements.dashboardSidebar.classList.remove('visible');
    }
}

// --- DATA FETCHING ---

function fetchAllRecords() {
    const recordsRef = ref(db, "sheepHealthRecords");
    onValue(recordsRef, snapshot => {
        state.allRecords = [];
        if (snapshot.exists()) {
            snapshot.forEach(child => {
                state.allRecords.push({ id: child.key, ...child.val() });
            });
        }
        // Trigger all UI updates that depend on this data
        renderAllTables();
        updateAnalytics();
        updateGrowthAnalytics();
        updateScheduleView();
        updateWeeklyTrackingView();
        updateWeightTrackingView();
        updateProfileView();
        checkTreatmentFollowUps();
        checkPreventativeCareReminders();
    });
}

function fetchSoldRecords() {
    const soldRecordsRef = query(ref(db, "sheepSaledRecords"), orderByChild("saleDate"));
    onValue(soldRecordsRef, snapshot => {
        state.soldRecords = [];
        if(snapshot.exists()){
            snapshot.forEach(child => {
                state.soldRecords.push({ id: child.key, ...child.val() });
            });
            state.soldRecords.reverse(); // Show newest first
        }
        renderSoldTable();
        updateProfileView();
    });
}

function fetchArchivedRecords() {
    const archivedRecordsRef = query(ref(db, "sheepArchivedRecords"), orderByChild("archiveDate"));
    onValue(archivedRecordsRef, snapshot => {
        state.archivedRecords = [];
        if(snapshot.exists()){
            snapshot.forEach(child => {
                state.archivedRecords.push({ id: child.key, ...child.val() });
            });
            state.archivedRecords.reverse(); // Show newest first
        }
        renderArchivedTable();
    });
}

// --- RENDERING FUNCTIONS ---

function renderAllTables() {
    const healthyRows = [];
    const treatmentRows = [];

    state.allRecords.forEach(record => {
        const status = record.healthStatus;
        if (status === 'Healthy' || status === 'Recovering') {
            healthyRows.push(renderHealthyRow(record));
        } else {
            treatmentRows.push(renderTreatmentRow(record));
        }
    });

    DOMElements.healthyRecordsTableBody.innerHTML = healthyRows.join('') || `<tr><td colspan="7" class="text-center">No healthy records.</td></tr>`;
    DOMElements.analyticsHealthyRecordsTableBody.innerHTML = healthyRows.join('') || `<tr><td colspan="7" class="text-center">No healthy records.</td></tr>`;
    DOMElements.treatmentRecordsTableBody.innerHTML = treatmentRows.join('') || `<tr><td colspan="5" class="text-center">No treatment records.</td></tr>`;
}

function renderSoldTable() {
    const rowsHtml = state.soldRecords.map(renderSoldRow).join('');
    DOMElements.sheepSaledTableBody.innerHTML = rowsHtml || `<tr><td colspan="7" class="text-center">No sold records.</td></tr>`;
}

function renderArchivedTable() {
    const rowsHtml = state.archivedRecords.map(renderArchivedRow).join('');
    DOMElements.archivedRecordsTableBody.innerHTML = rowsHtml || `<tr><td colspan="6" class="text-center">No archived records.</td></tr>`;
}

function renderHealthyRow(record) {
    return `<tr>
        <td><strong>${record.sheepId}</strong></td>
        <td><span class="${getStatusClass(record.healthStatus)}">${record.healthStatus}</span></td>
        <td>${formatDate(record.dateRecorded)}</td>
        <td>${record.weight || 'N/A'}</td>
        <td>${record.temperature || 'N/A'}</td>
        <td>${record.notes || ''}</td>
        <td>
            <button class="btn btn-sm btn-info" data-action="manage-treatment" data-id="${record.id}" data-sheep-id="${record.sheepId}" title="Manage Treatments"><i class="fas fa-notes-medical"></i></button>
            <button class="btn btn-sm btn-outline-primary" data-action="edit-record" data-id="${record.id}" title="Edit"><i class="fas fa-edit"></i></button>
            <button class="btn btn-sm btn-outline-success" data-action="sale-record" data-id="${record.id}" title="Mark as Sold"><i class="fas fa-dollar-sign"></i></button>
            <button class="btn btn-sm btn-outline-danger" data-action="delete-record" data-id="${record.id}" data-sheep-id="${record.sheepId}" title="Permanently Delete"><i class="fas fa-trash"></i></button>
            <button class="btn btn-sm btn-outline-secondary" data-action="archive-record" data-id="${record.id}" title="Mark as Deceased/Archive"><i class="fas fa-archive"></i></button>
        </td>
    </tr>`;
}

function renderTreatmentRow(record) {
    let lastUpdate = 'N/A';
    let followUpIndicator = '';
    let rowClass = '';

    if (record.treatments) {
        const treatments = Object.values(record.treatments).sort((a, b) => new Date(b.treatmentDate) - new Date(a.treatmentDate));
        if (treatments.length > 0) {
            const latestTreatment = treatments[0];
            lastUpdate = formatDate(latestTreatment.treatmentDate);
            
            if (latestTreatment.followUpDate) {
                const followUpDate = new Date(latestTreatment.followUpDate + 'T00:00:00');
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                if (followUpDate < today) {
                    followUpIndicator = ` <span class="badge bg-danger" title="Follow-up was due on ${formatDate(latestTreatment.followUpDate)}">Overdue</span>`;
                    rowClass = 'table-danger-light';
                } else if (followUpDate.getTime() === today.getTime()) {
                    followUpIndicator = ` <span class="badge bg-warning text-dark" title="Follow-up due today">Due Today</span>`;
                    rowClass = 'table-warning-light';
                }
            }
        }
    }
    return `<tr class="${rowClass}">
        <td><strong>${record.sheepId}</strong></td>
        <td><span class="${getStatusClass(record.healthStatus)}">${record.healthStatus}</span></td>
        <td>${formatDate(record.dateRecorded)}</td>
        <td>${lastUpdate}${followUpIndicator}</td>
        <td>
            <button class="btn btn-sm btn-info" data-action="manage-treatment" data-id="${record.id}" data-sheep-id="${record.sheepId}" title="Manage Treatments"><i class="fas fa-notes-medical"></i> Manage</button>
            <button class="btn btn-sm btn-outline-primary" data-action="edit-record" data-id="${record.id}" title="Edit"><i class="fas fa-edit"></i></button>
            <button class="btn btn-sm btn-outline-success" data-action="sale-record" data-id="${record.id}" title="Mark as Sold"><i class="fas fa-dollar-sign"></i></button>
            <button class="btn btn-sm btn-outline-danger" data-action="delete-record" data-id="${record.id}" data-sheep-id="${record.sheepId}" title="Permanently Delete"><i class="fas fa-trash"></i></button>
            <button class="btn btn-sm btn-outline-secondary" data-action="archive-record" data-id="${record.id}" title="Mark as Deceased/Archive"><i class="fas fa-archive"></i></button>
        </td>
    </tr>`;
}

function renderSoldRow(record) {
    return `<tr>
        <td><strong>${record.sheepId}</strong></td>
        <td>${record.healthStatus}</td>
        <td>${formatDate(record.saleDate)}</td>
        <td>${record.salePrice || 'N/A'}</td>
        <td>${record.saleBuyer || 'N/A'}</td>
        <td>${record.saleNotes || ''}</td>
        <td><button class="btn btn-sm btn-outline-danger" data-action="delete-sold" data-id="${record.id}" data-sheep-id="${record.sheepId}" title="Permanently Delete"><i class="fas fa-trash"></i></button></td>
    </tr>`;
}

function renderArchivedRow(record) {
    return `<tr>
        <td><strong>${record.sheepId}</strong></td>
        <td><span class="status-sick">${record.healthStatus}</span></td>
        <td>${formatDate(record.archiveDate)}</td>
        <td>${formatDate(record.dateRecorded)}</td>
        <td>${record.notes || ''}</td>
        <td><button class="btn btn-sm btn-outline-danger" data-action="delete-archived" data-id="${record.id}" data-sheep-id="${record.sheepId}" title="Permanently Delete"><i class="fas fa-trash"></i></button></td>
    </tr>`;
}

// --- NOTIFICATIONS ---

function checkTreatmentFollowUps() {
    const notifications = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    state.allRecords.forEach(record => {
        if (record.treatments) {
            const treatmentsWithFollowUp = Object.values(record.treatments).filter(t => t.followUpDate);
            if (treatmentsWithFollowUp.length > 0) {
                treatmentsWithFollowUp.sort((a, b) => new Date(b.followUpDate) - new Date(a.followUpDate));
                const latestFollowUp = treatmentsWithFollowUp[0];
                const followUpDate = new Date(latestFollowUp.followUpDate + 'T00:00:00');

                if (!isNaN(followUpDate.getTime())) {
                    const dayDiff = Math.ceil((followUpDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
                    let status = '', message = '';
                    if (dayDiff < 0) {
                        status = 'Overdue';
                        message = `Treatment follow-up was due ${-dayDiff} day(s) ago.`;
                    } else if (dayDiff === 0) {
                        status = 'Due Today';
                        message = 'Treatment follow-up is due today.';
                    } else if (dayDiff <= 7) {
                        status = 'Upcoming';
                        message = `Treatment follow-up due in ${dayDiff} day(s).`;
                    }
                    if (status) {
                        notifications.push({ sheepId: record.sheepId, recordId: record.id, message, status });
                    }
                }
            }
        }
    });
    
    renderNotificationList(notifications, DOMElements['notification-list'], DOMElements['notification-badge'], 'No pending treatment follow-ups.');
}

function checkPreventativeCareReminders() {
    const reminders = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const getDayDiffFromLastDate = (lastDateStr, daysUntilDue) => {
        if (!lastDateStr) return null;
        const lastDate = new Date(lastDateStr + 'T00:00:00');
        const dueDate = new Date(lastDate.getTime());
        dueDate.setDate(dueDate.getDate() + daysUntilDue);
        if (isNaN(dueDate.getTime())) return null;
        const timeDiff = dueDate.getTime() - today.getTime();
        return Math.ceil(timeDiff / (1000 * 3600 * 24));
    };

    state.allRecords.forEach(record => {
        const dewormingDayDiff = getDayDiffFromLastDate(record.lastDewormingDate, 30);
        if (dewormingDayDiff !== null && dewormingDayDiff <= 30) {
            let status = '', message = '';
            if (dewormingDayDiff < 0) { message = `Deworming is overdue by ${-dewormingDayDiff} day(s).`; } 
            else if (dewormingDayDiff === 0) { message = 'Deworming is due today.'; } 
            else { message = `Deworming due in ${dewormingDayDiff} day(s).`; }
            
            if (dewormingDayDiff <= 5) { status = 'Overdue'; }
            else { status = 'Upcoming'; }
            reminders.push({ sheepId: record.sheepId, recordId: record.id, message, status });
        }

        let vaxDayDiff;
        if (record.manualVaccinationDueDate) {
            const dueDate = new Date(record.manualVaccinationDueDate + 'T00:00:00');
            if (!isNaN(dueDate.getTime())) {
                vaxDayDiff = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
            } else {
                vaxDayDiff = null;
            }
        } else {
            vaxDayDiff = getDayDiffFromLastDate(record.lastVaccinationDate, 365);
        }
        if (vaxDayDiff !== null && vaxDayDiff <= 30) {
            let status = '', message = '';
            if (vaxDayDiff < 0) { message = `Vaccination is overdue by ${-vaxDayDiff} day(s).`; } 
            else if (vaxDayDiff === 0) { message = 'Vaccination is due today.'; } 
            else { message = `Vaccination due in ${vaxDayDiff} day(s).`; }
            
            if (vaxDayDiff <= 5) { status = 'Overdue'; }
            else { status = 'Upcoming'; }
            reminders.push({ sheepId: record.sheepId, recordId: record.id, message, status });
        }
    });

    renderNotificationList(reminders, DOMElements['schedule-notification-list'], DOMElements['schedule-notification-badge'], 'No upcoming preventative care.');
}

function renderNotificationList(notifications, listEl, badgeEl, emptyText) {
    if (notifications.length === 0) {
        badgeEl.style.display = 'none';
        listEl.innerHTML = `<li><a class="dropdown-item text-muted" href="#">${emptyText}</a></li>`;
        return;
    }

    notifications.sort((a, b) => {
        const statusOrder = { 'Overdue': 1, 'Due Today': 2, 'Upcoming': 3 };
        return statusOrder[a.status] - statusOrder[b.status];
    });

    badgeEl.textContent = notifications.length;
    badgeEl.style.display = 'block';

    listEl.innerHTML = notifications.map(n => {
        let iconClass = '';
        if (n.status === 'Overdue') iconClass = 'fas fa-exclamation-circle text-danger';
        else if (n.status === 'Due Today') iconClass = 'fas fa-calendar-day text-warning';
        else if (n.status === 'Upcoming') iconClass = 'fas fa-calendar-alt text-info';

        return `<li><a href="#" class="dropdown-item notification-item" data-action="view-notification" data-id="${n.recordId}"><div class="icon"><i class="${iconClass}"></i></div><div class="content"><strong>Sheep ID: ${n.sheepId}</strong><div class="small text-muted">${n.message}</div></div></a></li>`;
    }).join('');
}

function viewRecordFromNotification(recordId) {
    const record = state.allRecords.find(r => r.id === recordId);
    if (!record) {
        showToast('Error', 'Could not find the record. It may have been moved or deleted.', 'danger');
        return;
    }
    openTreatmentLog(record.id, record.sheepId);
}

// --- WEEKLY TRACKING ---

function updateWeeklyTrackingView(filter = state.currentWeeklyFilter) {
    state.currentWeeklyFilter = filter;

    document.querySelectorAll('#weeklyFilterButtons button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
    });

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    let recordsWithStatus = state.allRecords.map(record => {
        let lastActivityDate = new Date(record.dateRecorded + 'T00:00:00');
        if (record.treatments) {
            Object.values(record.treatments).forEach(treatment => {
                const treatmentDate = new Date(treatment.treatmentDate + 'T00:00:00');
                if (!isNaN(treatmentDate.getTime()) && treatmentDate > lastActivityDate) {
                    lastActivityDate = treatmentDate;
                }
            });
        }
        const isChecked = lastActivityDate >= sevenDaysAgo;
        return { ...record, lastActivityDate, isChecked };
    });

    let filteredRecords = recordsWithStatus.filter(r => {
        if (filter === 'all') return true;
        if (filter === 'checked') return r.isChecked;
        if (filter === 'needs_check') return !r.isChecked;
        return false;
    });

    filteredRecords.sort((a, b) => a.sheepId.localeCompare(b.sheepId, undefined, { numeric: true }));

    DOMElements.weeklyTableBody.innerHTML = filteredRecords.length > 0 ? filteredRecords.map(renderWeeklyRow).join('') : `<tr><td colspan="5" class="text-center">No sheep match the filter criteria.</td></tr>`;
}

function renderWeeklyRow(record) {
    const lastActivityDateStr = formatDate(record.lastActivityDate.toISOString().split('T')[0]);
    const weeklyStatusBadge = record.isChecked ? '<span class="badge bg-success">Checked</span>' : '<span class="badge bg-warning text-dark">Needs Check</span>';
    return `<tr>
        <td><strong>${record.sheepId}</strong></td>
        <td><span class="${getStatusClass(record.healthStatus)}">${record.healthStatus}</span></td>
        <td>${lastActivityDateStr}</td>
        <td>${weeklyStatusBadge}</td>
        <td>
            <button class="btn btn-sm btn-info" data-action="manage-treatment" data-id="${record.id}" data-sheep-id="${record.sheepId}" title="Log New Treatment"><i class="fas fa-notes-medical"></i> Manage</button>
            <button class="btn btn-sm btn-outline-primary" data-action="edit-record" data-id="${record.id}" title="Edit Record"><i class="fas fa-edit"></i></button>
        </td>
    </tr>`;
}

// --- HEALTH SCHEDULE ---

function updateScheduleView(filter = state.currentScheduleFilter) {
    state.currentScheduleFilter = filter;
    
    document.querySelectorAll('#scheduleFilterButtons button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
    });

    const sortedRecords = [...state.allRecords].sort((a, b) => a.sheepId.localeCompare(b.sheepId, undefined, { numeric: true }));

    let recordsToDisplay = sortedRecords.filter(record => {
        if (filter === 'all') return true;
        
        const dewormStatus = getScheduleStatus(record.lastDewormingDate, 30, null);
        const vaxStatus = getScheduleStatus(record.lastVaccinationDate, 365, record.manualVaccinationDueDate);

        if (filter === 'overdue') {
            return dewormStatus.isOverdue || vaxStatus.isOverdue;
        }
        if (filter === 'upcoming') {
            return (dewormStatus.isUpcoming && !dewormStatus.isOverdue) || (vaxStatus.isUpcoming && !vaxStatus.isOverdue);
        }
        return false;
    });

    DOMElements.scheduleTableBody.innerHTML = recordsToDisplay.length > 0 
        ? recordsToDisplay.map(renderScheduleRow).join('') 
        : `<tr><td colspan="7" class="text-center">No sheep match the filter criteria.</td></tr>`;
    
    updateBatchLogUI();
}

function renderScheduleRow(record) {
    const dewormingStatus = getScheduleStatus(record.lastDewormingDate, 30, null);
    const vaccinationStatus = getScheduleStatus(record.lastVaccinationDate, 365, record.manualVaccinationDueDate);

    return `
        <tr>
            <td><input type="checkbox" class="form-check-input sheep-select-checkbox" data-id="${record.id}"></td>
            <td><strong>${record.sheepId}</strong></td>
            <td>${renderScheduleStatusBadge(dewormingStatus, record.lastDewormingDate)}</td>
            <td>${record.lastDewormingNotes || ''}</td>
            <td>${renderScheduleStatusBadge(vaccinationStatus, record.lastVaccinationDate)}</td>
            <td>${record.lastVaccinationNotes || ''}</td>
            <td>
                <button class="btn btn-sm btn-info" data-action="manage-treatment" data-id="${record.id}" data-sheep-id="${record.sheepId}" title="Log New Treatment"><i class="fas fa-notes-medical"></i> Manage</button>
                <button class="btn btn-sm btn-outline-primary" data-action="edit-record" data-id="${record.id}" title="Edit Record"><i class="fas fa-edit"></i></button>
            </td>
        </tr>
    `;
}

function getScheduleStatus(lastDateStr, daysUntilDue, manualDueDateStr) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let dueDate;
    if (manualDueDateStr) {
        dueDate = new Date(manualDueDateStr + 'T00:00:00');
    } else if (lastDateStr) {
        const lastDate = new Date(lastDateStr + 'T00:00:00');
        dueDate = new Date(lastDate.getTime());
        dueDate.setDate(dueDate.getDate() + daysUntilDue);
    } else {
        return { text: 'No Record', className: 'secondary', dayDiff: Infinity, isOverdue: false, isUpcoming: false };
    }

    if (isNaN(dueDate.getTime())) {
         return { text: 'Invalid Date', className: 'secondary', dayDiff: Infinity, isOverdue: false, isUpcoming: false };
    }

    const timeDiff = dueDate.getTime() - today.getTime();
    const dayDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

    let text = `Due ${formatDate(dueDate.toISOString().split('T')[0])}`;
    let className = 'success';
    let isOverdue = false;
    let isUpcoming = false;

    if (dayDiff < 0) {
        text = `Overdue by ${-dayDiff} day(s)`;
        className = 'danger';
        isOverdue = true;
        isUpcoming = true;
    } else if (dayDiff === 0) {
        text = 'Due Today';
        className = 'warning';
        isUpcoming = true;
    } else if (dayDiff <= 30) {
        text = `Due in ${dayDiff} day(s)`;
        className = (dayDiff <= 7) ? 'warning' : 'info';
        isUpcoming = true;
    }
    
    return { text, className, dayDiff, isOverdue, isUpcoming };
}

function renderScheduleStatusBadge(status, lastDate) {
    const tooltipContent = `Last Given: ${lastDate ? formatDate(lastDate) : 'N/A'}`;
    return `<span class="badge bg-${status.className}" data-bs-toggle="tooltip" title="${tooltipContent}">${status.text}</span>`;
}

function updateBatchLogUI() {
    const selected = document.querySelectorAll('#scheduleTableBody .sheep-select-checkbox:checked');
    DOMElements.batchLogBtn.style.display = selected.length > 0 ? 'inline-block' : 'none';
    
    // Re-initialize tooltips for newly rendered rows
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
}

function openBatchLogModal() {
    const selectedCheckboxes = document.querySelectorAll('#scheduleTableBody .sheep-select-checkbox:checked');
    const count = selectedCheckboxes.length;
    if (count === 0) return alert('Please select at least one sheep.');

    DOMElements.batchCount.textContent = count;
    DOMElements.batchTreatmentForm.reset();
    DOMElements.batchTreatmentDate.valueAsDate = new Date();
    state.modals.batch.show();
}

async function handleBatchSaveTreatment(e) {
    e.preventDefault();
    const selectedCheckboxes = document.querySelectorAll('#scheduleTableBody .sheep-select-checkbox:checked');
    const recordIds = Array.from(selectedCheckboxes).map(cb => cb.dataset.id);

    const treatmentType = document.getElementById('batchTreatmentType').value;
    const treatmentDate = document.getElementById('batchTreatmentDate').value;
    
    if (!treatmentType || !treatmentDate) {
        return alert('Treatment Type and Date are required.');
    }

    const entryData = {
        treatmentDate: treatmentDate,
        treatmentType: treatmentType,
        medication: document.getElementById('batchMedication').value,
        dosage: document.getElementById('batchDosage').value,
        treatmentNotes: document.getElementById('batchTreatmentNotes').value,
        symptoms: 'Batch logged treatment',
        followUpDate: ''
    };

    const updates = {};
    recordIds.forEach(recordId => {
        const treatmentRef = ref(db, `sheepHealthRecords/${recordId}/treatments`);
        const newTreatmentKey = push(treatmentRef).key;
        updates[`sheepHealthRecords/${recordId}/treatments/${newTreatmentKey}`] = entryData;

        if (treatmentType === 'Deworming') {
            updates[`sheepHealthRecords/${recordId}/lastDewormingDate`] = treatmentDate;
            updates[`sheepHealthRecords/${recordId}/lastDewormingNotes`] = entryData.treatmentNotes;
        } else if (treatmentType === 'Vaccination') {
            updates[`sheepHealthRecords/${recordId}/lastVaccinationDate`] = treatmentDate;
            updates[`sheepHealthRecords/${recordId}/lastVaccinationNotes`] = entryData.treatmentNotes;
        }
    });

    try {
        await update(ref(db), updates);
        state.modals.batch.hide();
    } catch (error) {
        console.error("Batch update failed:", error);
        alert("An error occurred during the batch update: " + error.message);
    }
}

// --- WEIGHT TRACKING ---

function updateWeightTrackingView() {
    const selector = DOMElements.weightSheepSelector;
    const currentSelection = selector.value;
    selector.innerHTML = '<option selected disabled value="">Select a sheep</option>';
    
    const sortedRecords = [...state.allRecords].sort((a, b) => a.sheepId.localeCompare(b.sheepId, undefined, { numeric: true }));

    sortedRecords.forEach(record => {
        const allWeightPoints = gatherAllWeightData(record);
        const latestWeight = allWeightPoints.length > 0 ? allWeightPoints[allWeightPoints.length - 1].weight : null;

        const option = document.createElement('option');
        option.value = record.id;
        let displayText = record.sheepId;
        if (latestWeight !== null) {
            displayText += ` (${latestWeight.toFixed(1)} kg)`;
        }
        option.textContent = displayText;
        selector.appendChild(option);
    });

    selector.value = currentSelection;

    if (currentSelection) {
        renderWeightChartForSheep(currentSelection);
    } else {
        DOMElements.weightDisplayArea.style.display = 'none';
        DOMElements.noWeightData.style.display = 'block';
        DOMElements.addWeightBtn.style.display = 'none';
        DOMElements.latestWeightDisplay.style.display = 'none !important';
        DOMElements.noWeightData.textContent = 'Select a sheep to view its chart.';
        if (state.charts.weight) {
            state.charts.weight.destroy();
        }
    }
}

function renderWeightChartForSheep(recordId) {
    const record = state.allRecords.find(r => r.id === recordId);

    if (!record) {
        DOMElements.noWeightData.textContent = `Could not find record. It may have been moved or deleted.`;
        DOMElements.noWeightData.style.display = 'block';
        DOMElements.weightDisplayArea.style.display = 'none';
        DOMElements.addWeightBtn.style.display = 'none';
        DOMElements.latestWeightDisplay.style.display = 'none !important';
        if (state.charts.weight) state.charts.weight.destroy();
        return;
    }

    const startDate = new Date(record.dateRecorded + 'T00:00:00');
    if (isNaN(startDate.getTime())) {
        DOMElements.noWeightData.textContent = `The start date for Sheep ID ${record.sheepId} is invalid.`;
        // ... (hide elements as above)
        return;
    }

    DOMElements.addWeightBtn.style.display = 'inline-block';

    const allWeightPoints = gatherAllWeightData(record);
    renderWeightDataTable(allWeightPoints, recordId);

    if (allWeightPoints.length > 0) {
        const latestWeight = allWeightPoints[allWeightPoints.length - 1].weight;
        DOMElements.latestWeightValue.textContent = `${latestWeight.toFixed(1)} kg`;
        DOMElements.latestWeightDisplay.style.display = 'inline-block !important';
    } else {
        DOMElements.latestWeightDisplay.style.display = 'none !important';
    }

    const chartPoints = allWeightPoints
        .map(dp => ({ x: (dp.date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 7), y: dp.weight }));

    if (chartPoints.length < 1) {
        DOMElements.noWeightData.textContent = `No weight data found for Sheep ID ${record.sheepId}. Use the 'Add Weight Entry' button to start tracking.`;
        DOMElements.noWeightData.style.display = 'block';
        DOMElements.weightDisplayArea.style.display = 'none';
        if (state.charts.weight) state.charts.weight.destroy();
        return;
    }

    DOMElements.noWeightData.style.display = 'none';
    DOMElements.weightDisplayArea.style.display = 'block';

    const ctx = DOMElements.weightChart.getContext('2d');
    if (state.charts.weight) { state.charts.weight.destroy(); }

    calculateAndDisplayWeightStats(allWeightPoints);

    state.charts.weight = new Chart(ctx, {
        type: 'line',
        data: { datasets: [{ label: `Weight (kg) for ${record.sheepId}`, data: chartPoints, borderColor: '#0d6efd', backgroundColor: 'rgba(13, 110, 253, 0.1)', fill: true, tension: 0.1, pointRadius: 5, pointHoverRadius: 7 }] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { type: 'linear', position: 'bottom', title: { display: true, text: 'Weeks Since Record Start Date' }, min: 0 },
                y: { title: { display: true, text: 'Weight (kg)' }, beginAtZero: true }
            },
            plugins: { tooltip: { callbacks: {
                title: context => `Week ${context[0].raw.x.toFixed(1)}`,
                label: context => `Weight: ${context.raw.y} kg`
            }}}
        }
    });
}

function gatherAllWeightData(record) {
    let points = [];
    if (record.weight) {
        points.push({ id: 'initial', date: new Date(record.dateRecorded + 'T00:00:00'), weight: parseFloat(record.weight), source: 'initial' });
    }
    if (record.weights) {
        Object.entries(record.weights).forEach(([key, value]) => {
            if (value.date && value.weight) {
                points.push({ id: key, date: new Date(value.date + 'T00:00:00'), weight: parseFloat(value.weight), source: 'log' });
            }
        });
    }
    if (record.treatments) {
        Object.entries(record.treatments).forEach(([key, value]) => {
            if (value.weight && value.treatmentDate) {
                points.push({ id: key, date: new Date(value.treatmentDate + 'T00:00:00'), weight: parseFloat(value.weight), source: 'treatment' });
            }
        });
    }
    return points.filter(p => p.date && !isNaN(p.date.getTime()) && p.weight && !isNaN(p.weight)).sort((a, b) => a.date - b.date);
}

function renderWeightDataTable(weightPoints, recordId, containerId = 'weightTableContainer') {
    const container = document.getElementById(containerId);
    if (weightPoints.length === 0) {
        container.innerHTML = '<p>No weight history recorded.</p>';
        return;
    }
    const isProfile = containerId.startsWith('profile');
    let tableHtml = `<table class="table table-sm table-striped"><thead><tr><th>Date</th><th>Weight (kg)</th><th>Source</th><th>Actions</th></tr></thead><tbody>`;
    weightPoints.forEach(p => {
        let sourceText = '';
        let actions = '';
        if (!isProfile) {
            switch(p.source) {
                case 'initial':
                    sourceText = '<span class="badge bg-primary">Initial Record</span>';
                    actions = `<button class="btn btn-sm btn-outline-primary" data-action="edit-weight" data-record-id="${recordId}" data-id="${p.id}" data-source="initial" title="Edit Initial Weight"><i class="fas fa-edit"></i></button>`;
                    break;
                case 'log':
                    sourceText = '<span class="badge bg-info">Logged Entry</span>';
                    actions = `<button class="btn btn-sm btn-outline-primary" data-action="edit-weight" data-record-id="${recordId}" data-id="${p.id}" data-source="log" title="Edit Entry"><i class="fas fa-edit"></i></button> <button class="btn btn-sm btn-outline-danger" data-action="delete-weight" data-record-id="${recordId}" data-id="${p.id}" data-source="log" title="Delete Entry"><i class="fas fa-trash"></i></button>`;
                    break;
                case 'treatment':
                    sourceText = '<span class="badge bg-secondary">From Treatment Log</span>';
                    actions = `<button class="btn btn-sm btn-outline-danger" data-action="delete-weight" data-record-id="${recordId}" data-id="${p.id}" data-source="treatment" title="This is legacy data. Deleting it will remove the weight from the associated treatment log."><i class="fas fa-trash"></i></button>`;
                    break;
            }
        }
        tableHtml += `<tr><td>${formatDate(p.date.toISOString().split('T')[0])}</td><td>${p.weight.toFixed(1)}</td><td>${sourceText}</td><td>${actions}</td></tr>`;
    });
    tableHtml += `</tbody></table>`;
    container.innerHTML = tableHtml;
}

function calculateAndDisplayWeightStats(allWeightPoints, containerId = 'weightStatsBody') {
    const container = document.getElementById(containerId);
    if (allWeightPoints.length < 2) {
        container.innerHTML = '<h5 class="card-title">Weight Statistics</h5><p class="card-text text-muted">Need at least two weight points to calculate statistics.</p>';
        return;
    }

    const firstPoint = allWeightPoints[0];
    const lastPoint = allWeightPoints[allWeightPoints.length - 1];

    const weightGain = lastPoint.weight - firstPoint.weight;
    const timeDiffDays = (lastPoint.date.getTime() - firstPoint.date.getTime()) / (1000 * 60 * 60 * 24);
    
    let adg = 0;
    if (timeDiffDays > 0) {
        adg = (weightGain / timeDiffDays) * 1000; // in grams
    }

    container.innerHTML = `
        <h5 class="card-title mb-3">Weight Statistics</h5>
        <div class="mb-3">
            <p class="mb-0 text-muted">Average Daily Gain (ADG)</p>
            <h3 class="text-success">${adg.toFixed(0)} g/day</h3>
        </div>
        <div class="mb-3">
            <p class="mb-0 text-muted">Net Weight Gain</p>
            <h4>${weightGain.toFixed(1)} kg</h4>
            <small>(${timeDiffDays.toFixed(0)} days)</small>
        </div>
         <div class="row">
            <div class="col-6 border-end"><p class="mb-0 text-muted">Start Weight</p><h5>${firstPoint.weight.toFixed(1)} kg</h5></div>
            <div class="col-6"><p class="mb-0 text-muted">Latest Weight</p><h5>${lastPoint.weight.toFixed(1)} kg</h5></div>
        </div>
    `;
}

function calculateADG(record) {
    const allWeightPoints = gatherAllWeightData(record);
    if (allWeightPoints.length < 2) return null;

    const firstPoint = allWeightPoints[0];
    const lastPoint = allWeightPoints[allWeightPoints.length - 1];

    const weightGain = lastPoint.weight - firstPoint.weight;
    const timeDiffDays = (lastPoint.date.getTime() - firstPoint.date.getTime()) / (1000 * 60 * 60 * 24);
    
    return timeDiffDays > 0 ? (weightGain / timeDiffDays) * 1000 : null;
}

function updateGrowthAnalytics() {
    const sheepWithAdg = state.allRecords
        .map(record => ({ sheepId: record.sheepId, adg: calculateADG(record) }))
        .filter(item => item.adg !== null && !isNaN(item.adg));

    if (sheepWithAdg.length === 0) {
        const noDataHtml = '<li class="list-group-item text-muted">Not enough data for ADG calculation.</li>';
        DOMElements.fastestGrowersList.innerHTML = noDataHtml;
        DOMElements.slowestGrowersList.innerHTML = noDataHtml;
        return;
    }

    const sortedFastest = [...sheepWithAdg].sort((a, b) => b.adg - a.adg);
    DOMElements.fastestGrowersList.innerHTML = sortedFastest.slice(0, 5).map(s => `<li class="list-group-item d-flex justify-content-between align-items-center">${s.sheepId} <span class="badge bg-success rounded-pill">${s.adg.toFixed(0)} g/day</span></li>`).join('') || '<li class="list-group-item text-muted">No sheep with calculated growth.</li>';

    const sortedSlowest = [...sheepWithAdg].sort((a, b) => a.adg - a.adg);
    DOMElements.slowestGrowersList.innerHTML = sortedSlowest.map(s => {
        const badgeClass = s.adg < 0 ? 'bg-danger' : 'bg-warning text-dark';
        return `<li class="list-group-item d-flex justify-content-between align-items-center">${s.sheepId} <span class="badge ${badgeClass} rounded-pill">${s.adg.toFixed(0)} g/day</span></li>`;
    }).join('') || '<li class="list-group-item text-muted">No sheep with calculated growth.</li>';
}

// --- CRUD & FORM HANDLING ---

async function handleAddRecord(e) {
    e.preventDefault();
    const newRecord = {
        sheepId: DOMElements.sheepId.value.trim(),
        healthStatus: DOMElements.healthStatus.value,
        dateRecorded: DOMElements.dateRecorded.value,
        notes: DOMElements.notes.value.trim(),
        weight: DOMElements.weight.value || null,
        temperature: DOMElements.temperature.value || null,
    };
    if(!newRecord.sheepId || !newRecord.dateRecorded) {
        return showToast('Validation Error', 'Sheep ID and Date are required.', 'warning');
    }
    
    const isDuplicate = state.allRecords.some(record => record.sheepId.toLowerCase() === newRecord.sheepId.toLowerCase());
    if (isDuplicate) {
        showToast('Duplicate Error', `A sheep with ID "${newRecord.sheepId}" already exists. Please use a unique ID.`, 'danger');
        return;
    }

    try {
        await push(ref(db, 'sheepHealthRecords'), newRecord);
        showToast('Success', `Record for sheep "${newRecord.sheepId}" was added successfully.`, 'success');
        e.target.reset();
        DOMElements.dateRecorded.valueAsDate = new Date();
    } catch (error) {
        showToast('Database Error', "Error adding record: " + error.message, 'danger');
    }
}

function openEditModal(recordId) {
    const record = state.allRecords.find(r => r.id === recordId);
    if(!record) return;
    
    const form = DOMElements.editSheepForm;
    form.querySelector('#editRecordId').value = recordId;
    form.querySelector('#editSheepId').value = record.sheepId;
    form.querySelector('#editHealthStatus').value = record.healthStatus;
    form.querySelector('#editDateRecorded').value = record.dateRecorded;
    form.querySelector('#editNotes').value = record.notes || '';
    form.querySelector('#editLastDewormingDate').value = record.lastDewormingDate || '';
    form.querySelector('#editLastDewormingNotes').value = record.lastDewormingNotes || '';
    form.querySelector('#editLastVaccinationDate').value = record.lastVaccinationDate || '';
    form.querySelector('#editManualVaccinationDueDate').value = record.manualVaccinationDueDate || '';
    form.querySelector('#editLastVaccinationNotes').value = record.lastVaccinationNotes || '';
    
    state.modals.edit.show();
}

async function handleUpdateRecord(e) {
    e.preventDefault();
    const form = e.target;
    const recordId = form.querySelector('#editRecordId').value;
    const updatedData = {
        sheepId: form.querySelector('#editSheepId').value.trim(),
        healthStatus: form.querySelector('#editHealthStatus').value,
        dateRecorded: form.querySelector('#editDateRecorded').value,
        notes: form.querySelector('#editNotes').value.trim(),
        lastDewormingDate: form.querySelector('#editLastDewormingDate').value || null,
        lastDewormingNotes: form.querySelector('#editLastDewormingNotes').value.trim() || null,
        lastVaccinationDate: form.querySelector('#editLastVaccinationDate').value || null,
        manualVaccinationDueDate: form.querySelector('#editManualVaccinationDueDate').value || null,
        lastVaccinationNotes: form.querySelector('#editLastVaccinationNotes').value.trim() || null,
    };

    if (updatedData.healthStatus === 'Deceased') {
        state.modals.edit.hide();
        archiveRecord(recordId);
        return;
    }

    const isDuplicate = state.allRecords.some(
        record => record.id !== recordId && record.sheepId.toLowerCase() === updatedData.sheepId.toLowerCase()
    );
    if (isDuplicate) {
        showToast('Duplicate Error', `Another sheep with ID "${updatedData.sheepId}" already exists. Please use a unique ID.`, 'danger');
        return;
    }

    try {
        await update(ref(db, `sheepHealthRecords/${recordId}`), updatedData);
        showToast('Success', `Record for sheep "${updatedData.sheepId}" was updated.`, 'success');
        state.modals.edit.hide();
    } catch (error) {
        showToast('Database Error', "Error updating record: " + error.message, 'danger');
    }
}

async function deleteRecord(recordId, sheepId) {
    if (confirm(`Are you sure you want to PERMANENTLY DELETE sheep "${sheepId}" and all its history? This action cannot be undone.`)) {
        try {
            await remove(ref(db, `sheepHealthRecords/${recordId}`));
            showToast('Deleted', `Record for sheep "${sheepId}" has been permanently deleted.`, 'success');
        } catch (error) {
            showToast('Database Error', "An error occurred while deleting the record: " + error.message, 'danger');
        }
    }
}

async function archiveRecord(recordId) {
    if (confirm('Are you sure you want to mark this sheep as deceased and move it to the archive?')) {
        const recordToArchive = state.allRecords.find(r => r.id === recordId);
        if (!recordToArchive) return showToast('Error', 'Record not found.', 'danger');

        const archivedRecord = {
            ...recordToArchive,
            healthStatus: 'Deceased',
            archiveDate: new Date().toISOString().split('T')[0]
        };
        delete archivedRecord.id;

        const updates = {};
        const newArchiveKey = push(ref(db, 'sheepArchivedRecords')).key;
        updates[`/sheepArchivedRecords/${newArchiveKey}`] = archivedRecord;
        updates[`/sheepHealthRecords/${recordId}`] = null;

        try {
            await update(ref(db), updates);
            showToast('Archived', `Record for sheep "${recordToArchive.sheepId}" has been moved to the archive.`, 'success');
        } catch (error) {
            showToast('Database Error', "Archiving failed: " + error.message, 'danger');
        }
    }
}

async function deleteSoldRecord(recordId, sheepId) {
    if (confirm(`Are you sure you want to PERMANENTLY DELETE the sale record for sheep "${sheepId}"?`)) {
        try {
            await remove(ref(db, `sheepSaledRecords/${recordId}`));
            showToast('Deleted', `Sale record for sheep "${sheepId}" has been deleted.`, 'success');
        } catch (error) {
            showToast('Database Error', "Error deleting sold record: " + error.message, 'danger');
        }
    }
}

async function deleteArchivedRecord(recordId, sheepId) {
    if (confirm(`Are you sure you want to PERMANENTLY DELETE the archived record for sheep "${sheepId}"?`)) {
        try {
            await remove(ref(db, `sheepArchivedRecords/${recordId}`));
            showToast('Deleted', `Archived record for sheep "${sheepId}" has been deleted.`, 'success');
        } catch (error) {
            showToast('Database Error', "Error deleting archived record: " + error.message, 'danger');
        }
    }
}

function openSaleModal(recordId) {
    const form = DOMElements.saleSheepForm;
    form.reset();
    form.querySelector('#saleRecordId').value = recordId;
    form.querySelector('#saleDate').valueAsDate = new Date();
    state.modals.sale.show();
}

async function handleSaleSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const recordId = form.querySelector('#saleRecordId').value;
    const recordToSell = state.allRecords.find(r => r.id === recordId);
    if (!recordToSell) return showToast('Error', 'Record not found.', 'danger');
    
    const soldRecord = {
        ...recordToSell,
        saleDate: form.querySelector('#saleDate').value,
        salePrice: form.querySelector('#salePrice').value,
        saleBuyer: form.querySelector('#saleBuyer').value.trim(),
        saleNotes: form.querySelector('#saleNotes').value.trim(),
    };
    delete soldRecord.id;

    const updates = {};
    const newSoldKey = push(ref(db, 'sheepSaledRecords')).key;
    updates[`/sheepSaledRecords/${newSoldKey}`] = soldRecord;
    updates[`/sheepHealthRecords/${recordId}`] = null;

    try {
        await update(ref(db), updates);
        showToast('Success', `Sheep "${soldRecord.sheepId}" has been marked as sold.`, 'success');
        state.modals.sale.hide();
    } catch (error) {
        showToast('Database Error', "Sale operation failed: " + error.message, 'danger');
    }
}

function openTreatmentLog(recordId, sheepId) {
    DOMElements.modalSheepId.textContent = sheepId;
    DOMElements.currentSheepRecordId.value = recordId;
    resetTreatmentForm();
    
    const treatmentsRef = ref(db, `sheepHealthRecords/${recordId}/treatments`);
    onValue(treatmentsRef, snapshot => {
        let rowsHtml = '';
        if(snapshot.exists()) {
            const entries = [];
            snapshot.forEach(child => {
                entries.push({ id: child.key, ...child.val() });
            });
            // Sort by date descending
            entries.sort((a,b) => new Date(b.treatmentDate) - new Date(a.treatmentDate));

            rowsHtml = entries.map(entry => `<tr>
                <td>${formatDate(entry.treatmentDate)}</td>
                <td>${entry.symptoms || ''}</td>
                <td>${entry.medication || ''}</td>
                <td>${entry.dosage || ''}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" data-action="edit-treatment" data-record-id="${recordId}" data-id="${entry.id}"><i class="fas fa-pencil-alt"></i></button>
                    <button class="btn btn-sm btn-outline-danger" data-action="delete-treatment" data-record-id="${recordId}" data-id="${entry.id}"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`).join('');
        }
        DOMElements.treatmentLogTbody.innerHTML = rowsHtml || '<tr><td colspan="5" class="text-center">No treatment entries yet.</td></tr>';
    }, { onlyOnce: false }); // Keep listening for changes while modal is open

    state.modals.treatment.show();
}

async function handleSaveTreatment(e) {
    e.preventDefault();
    const form = e.target;
    const recordId = DOMElements.currentSheepRecordId.value;
    const entryId = DOMElements.treatmentEntryId.value;
    const treatmentType = form.querySelector('#treatmentType').value;
    const treatmentDate = form.querySelector('#treatmentDate').value;
    const treatmentWeight = parseFloat(form.querySelector('#treatmentWeight').value);
    
    const entryData = {
        treatmentDate: treatmentDate,
        treatmentType: treatmentType,
        symptoms: form.querySelector('#symptoms').value,
        medication: form.querySelector('#medication').value,
        dosage: form.querySelector('#dosage').value,
        followUpDate: form.querySelector('#followUpDate').value,
        treatmentNotes: form.querySelector('#treatmentNotes').value,
    };

    const updates = {};
    if (!isNaN(treatmentWeight) && treatmentWeight > 0) {
        const weightData = { date: treatmentDate, weight: treatmentWeight };
        const newWeightKey = push(ref(db, `sheepHealthRecords/${recordId}/weights`)).key;
        updates[`sheepHealthRecords/${recordId}/weights/${newWeightKey}`] = weightData;
    }

    const path = `sheepHealthRecords/${recordId}/treatments`;
    if (entryId) {
        updates[`${path}/${entryId}`] = entryData;
    } else {
        const newTreatmentKey = push(ref(db, path)).key;
        updates[`${path}/${newTreatmentKey}`] = entryData;
    }

    if (treatmentType === 'Deworming') {
        updates[`sheepHealthRecords/${recordId}/lastDewormingDate`] = treatmentDate;
        updates[`sheepHealthRecords/${recordId}/lastDewormingNotes`] = entryData.treatmentNotes;
    } else if (treatmentType === 'Vaccination') {
        updates[`sheepHealthRecords/${recordId}/lastVaccinationDate`] = treatmentDate;
        updates[`sheepHealthRecords/${recordId}/lastVaccinationNotes`] = entryData.treatmentNotes;
    }

    const record = state.allRecords.find(r => r.id === recordId);
    if (record && record.healthStatus === 'Sick') {
        updates[`sheepHealthRecords/${recordId}/healthStatus`] = 'Under Treatment';
    }
    
    try {
        await update(ref(db), updates);
        resetTreatmentForm();
    } catch (error) {
        alert("Error saving treatment: " + error.message);
    }
}

function editTreatmentEntry(recordId, entryId) {
    const record = state.allRecords.find(r => r.id === recordId);
    if (!record || !record.treatments || !record.treatments[entryId]) return;

    const entry = record.treatments[entryId];
    const form = DOMElements.addTreatmentForm;
    DOMElements.treatmentEntryId.value = entryId;
    form.querySelector('#treatmentType').value = entry.treatmentType || 'General';
    form.querySelector('#treatmentDate').value = entry.treatmentDate;
    form.querySelector('#symptoms').value = entry.symptoms || '';
    form.querySelector('#medication').value = entry.medication || '';
    form.querySelector('#dosage').value = entry.dosage || '';
    form.querySelector('#followUpDate').value = entry.followUpDate || '';
    form.querySelector('#treatmentWeight').value = '';
    form.querySelector('#treatmentNotes').value = entry.treatmentNotes || '';
}

async function deleteTreatmentEntry(recordId, entryId) {
    if (confirm('Delete this treatment entry?')) {
        try {
            await remove(ref(db, `sheepHealthRecords/${recordId}/treatments/${entryId}`));
        } catch (error) {
            alert("Error deleting treatment: " + error.message);
        }
    }
}

function resetTreatmentForm() {
    DOMElements.addTreatmentForm.reset();
    DOMElements.treatmentEntryId.value = '';
    DOMElements.addTreatmentForm.querySelector('#treatmentDate').valueAsDate = new Date();
}

function openWeightModal(recordId, entryId = null, source = 'log') {
    const form = DOMElements.weightEntryForm;
    form.reset();
    form.querySelector('#weightRecordId').value = recordId;
    form.querySelector('#weightEntryId').value = entryId || '';
    form.querySelector('#weightEntrySource').value = source;

    if (entryId) {
        form.querySelector('#weightModalTitle').textContent = 'Edit Weight Entry';
        const record = state.allRecords.find(r => r.id === recordId);
        if (!record) return;

        let dataPoint;
        if (source === 'initial') {
            dataPoint = { date: record.dateRecorded, weight: record.weight };
        } else if (source === 'log' && record.weights) {
            dataPoint = record.weights[entryId];
        }
        
        if (dataPoint) {
            form.querySelector('#weightEntryDate').value = dataPoint.date;
            form.querySelector('#weightEntryValue').value = dataPoint.weight;
        }
    } else {
        form.querySelector('#weightModalTitle').textContent = 'Add Weight Entry';
        form.querySelector('#weightEntryDate').valueAsDate = new Date();
    }
    state.modals.weight.show();
}

async function handleSaveWeight(e) {
    e.preventDefault();
    const form = e.target;
    const recordId = form.querySelector('#weightRecordId').value;
    const entryId = form.querySelector('#weightEntryId').value;
    const source = form.querySelector('#weightEntrySource').value;
    const date = form.querySelector('#weightEntryDate').value;
    const weight = parseFloat(form.querySelector('#weightEntryValue').value);

    if (!date || isNaN(weight)) {
        return alert('Please provide a valid date and weight.');
    }

    let promise;
    if (source === 'initial') {
        promise = update(ref(db, `sheepHealthRecords/${recordId}`), { weight: weight, dateRecorded: date });
    } else {
        const data = { date, weight };
        const path = `sheepHealthRecords/${recordId}/weights`;
        const weightRef = entryId ? ref(db, `${path}/${entryId}`) : push(ref(db, path));
        promise = update(weightRef, data);
    }

    try {
        await promise;
        state.modals.weight.hide();
    } catch (err) {
        alert('Error saving weight: ' + err.message);
    }
}

async function deleteWeightEntry(recordId, entryId, source) {
    if (!confirm('Are you sure you want to delete this weight entry?')) return;

    let path;
    if (source === 'initial') {
        path = `sheepHealthRecords/${recordId}/weight`;
    } else if (source === 'log') {
        path = `sheepHealthRecords/${recordId}/weights/${entryId}`;
    } else if (source === 'treatment') {
        path = `sheepHealthRecords/${recordId}/treatments/${entryId}/weight`;
    }

    if (path) {
        try {
            await remove(ref(db, path));
        } catch (err) {
            alert('Error deleting entry: ' + err.message);
        }
    }
}

// --- ANALYTICS ---

function updateAnalytics() {
    const total = state.allRecords.length;
    const healthy = state.allRecords.filter(r => r.healthStatus === 'Healthy' || r.healthStatus === 'Recovering').length;
    const sick = state.allRecords.filter(r => r.healthStatus === 'Sick').length;
    const treatment = state.allRecords.filter(r => r.healthStatus === 'Under Treatment').length;

    DOMElements.totalCount.textContent = total;
    DOMElements.healthyCount.textContent = healthy;
    DOMElements.sickCount.textContent = sick;
    DOMElements.treatmentCount.textContent = treatment;

    renderAnalyticsChart(healthy, sick, treatment);
}

function renderAnalyticsChart(healthy, sick, treatment) {
    const ctx = DOMElements.healthStatusChart.getContext('2d');
    
    if (state.charts.healthStatus) {
        state.charts.healthStatus.destroy();
    }

    state.charts.healthStatus = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Healthy/Recovering', 'Sick', 'Under Treatment'],
            datasets: [{
                label: 'Sheep Status',
                data: [healthy, sick, treatment],
                backgroundColor: ['rgba(40, 167, 69, 0.8)', 'rgba(220, 53, 69, 0.8)', 'rgba(255, 193, 7, 0.8)'],
                borderColor: ['#fff'],
                borderWidth: 2
            }]
        },
        options: { responsive: true, plugins: { legend: { position: 'top' } } }
    });
}

// --- FILTERING & EXPORTING ---

function filterTable(inputElement) {
    const searchTerm = inputElement.value.toLowerCase();
    const tableBodyId = inputElement.id.replace('SearchInput', 'RecordsTableBody');
    const tableBody = document.getElementById(tableBodyId);
    if (!tableBody) return;

    tableBody.querySelectorAll('tr').forEach(row => {
        const sheepIdCell = row.cells[0];
        if (sheepIdCell) {
            const sheepId = sheepIdCell.textContent.toLowerCase();
            row.style.display = sheepId.includes(searchTerm) ? '' : 'none';
        }
    });
}

function filterProfileSelector() {
    const searchTerm = DOMElements.profileSearchInput.value.toLowerCase();
    const selector = DOMElements.profileSheepSelector;
    
    for (const option of selector.options) {
        if (option.disabled) continue;
        option.style.display = option.textContent.toLowerCase().includes(searchTerm) ? '' : 'none';
    }

    for (const group of selector.getElementsByTagName('optgroup')) {
        const allOptionsHidden = Array.from(group.options).every(opt => opt.style.display === 'none');
        group.style.display = allOptionsHidden ? 'none' : '';
    }
    updateProfileNavButtons();
}

function exportData(type) {
    let recordsToExport, filename;
    if (type === 'healthy') {
        recordsToExport = state.allRecords.filter(r => r.healthStatus === 'Healthy' || r.healthStatus === 'Recovering');
        filename = 'healthy_sheep_records.csv';
    } else {
        recordsToExport = state.allRecords.filter(r => r.healthStatus === 'Sick' || r.healthStatus === 'Under Treatment');
        filename = 'treatment_sheep_records.csv';
    }

    if (recordsToExport.length === 0) return alert(`No ${type} records to export.`);
    
    const csv = convertToCSV(recordsToExport);
    downloadCSV(csv, filename);
}

function exportSoldData() {
    if (state.soldRecords.length === 0) return alert('No sold records to export.');
    
    const csv = convertSoldToCSV(state.soldRecords);
    downloadCSV(csv, 'sold_sheep_records.csv');
}

function convertToCSV(data) {
    const headers = ['Sheep ID', 'Health Status', 'Date Recorded', 'Weight (kg)', 'Temperature (°C)', 'Notes'];
    const rows = data.map(record =>
        [
            `"${record.sheepId || ''}"`, `"${record.healthStatus || ''}"`, `"${record.dateRecorded || ''}"`,
            `"${record.weight || ''}"`, `"${record.temperature || ''}"`, `"${(record.notes || '').replace(/"/g, '""')}"`
        ].join(',')
    );
    return [headers.join(','), ...rows].join('\n');
}

function convertSoldToCSV(data) {
    const headers = ['Sheep ID', 'Health Status', 'Date Sold', 'Price', 'Buyer', 'Notes'];
    const rows = data.map(record => 
        [`"${record.sheepId || ''}"`, `"${record.healthStatus || ''}"`, `"${record.saleDate || ''}"`, 
        `"${record.salePrice || ''}"`, `"${record.saleBuyer || ''}"`, `"${(record.saleNotes || '').replace(/"/g, '""')}"`].join(',')
    );
    return [headers.join(','), ...rows].join('\n');
}

function downloadCSV(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// --- SHEEP PROFILE VIEW ---

function updateProfileView() {
    const selector = DOMElements.profileSheepSelector;
    const currentSelection = selector.value;
    selector.innerHTML = '<option value="" selected disabled>Select a sheep to view profile</option>';

    const createOptGroup = (label, records) => {
        const group = document.createElement('optgroup');
        group.label = label;
        const sorted = [...records].sort((a, b) => a.sheepId.localeCompare(b.sheepId, undefined, { numeric: true }));
        sorted.forEach(record => {
            const option = document.createElement('option');
            option.value = record.id;
            option.textContent = record.sheepId;
            group.appendChild(option);
        });
        return group;
    };

    if (state.allRecords.length > 0) selector.appendChild(createOptGroup('Active Sheep', state.allRecords));
    if (state.soldRecords.length > 0) selector.appendChild(createOptGroup('Sold Sheep', state.soldRecords));
    
    selector.value = currentSelection || "";

    if (!currentSelection) {
        DOMElements.profileDisplayArea.style.display = 'none';
        DOMElements.noProfileData.style.display = 'block';
        DOMElements.profileEditBtn.style.display = 'none';
    }
    updateProfileNavButtons();
}

function renderProfileForSheep(recordId) {
    const combinedRecords = [...state.allRecords, ...state.soldRecords];
    const record = combinedRecords.find(r => r.id === recordId);

    if (!record) {
        DOMElements.profileDisplayArea.style.display = 'none';
        DOMElements.noProfileData.style.display = 'block';
        DOMElements.profileEditBtn.style.display = 'none';
        DOMElements.noProfileData.textContent = 'Could not find the selected sheep record.';
        return;
    }

    DOMElements.profileDisplayArea.style.display = 'block';
    DOMElements.noProfileData.style.display = 'none';
    DOMElements.profileEditBtn.style.display = state.allRecords.some(r => r.id === recordId) ? 'block' : 'none';

    // Core Info
    DOMElements.profileSheepId.textContent = record.sheepId;
    DOMElements.profileHealthStatus.innerHTML = `<span class="${getStatusClass(record.healthStatus)}">${record.healthStatus}</span>`;
    DOMElements.profileDateRecorded.textContent = formatDate(record.dateRecorded);
    DOMElements.profileInitialNotes.textContent = record.notes || 'N/A';

    // Sale Info
    if (record.saleDate) {
        DOMElements.profileSaleInfoCard.style.display = 'block';
        DOMElements.profileSaleDate.textContent = formatDate(record.saleDate);
        DOMElements.profileSalePrice.textContent = record.salePrice ? `$${record.salePrice}` : 'N/A';
        DOMElements.profileSaleBuyer.textContent = record.saleBuyer || 'N/A';
        DOMElements.profileSaleNotes.textContent = record.saleNotes || 'N/A';
    } else {
        DOMElements.profileSaleInfoCard.style.display = 'none';
    }

    // Preventative Care
    const dewormingStatus = getScheduleStatus(record.lastDewormingDate, 30, null);
    const vaccinationStatus = getScheduleStatus(record.lastVaccinationDate, 365, record.manualVaccinationDueDate);
    DOMElements.profileDewormingStatus.innerHTML = renderScheduleStatusBadge(dewormingStatus, record.lastDewormingDate);
    DOMElements.profileDewormingNotes.textContent = record.lastDewormingNotes || 'N/A';
    DOMElements.profileVaccinationStatus.innerHTML = renderScheduleStatusBadge(vaccinationStatus, record.lastVaccinationDate);
    DOMElements.profileVaccinationNotes.textContent = record.lastVaccinationNotes || 'N/A';

    renderWeightProfile(record);
    renderTreatmentProfile(record);
    updateProfileNavButtons();
}

function renderWeightProfile(record) {
    const startDate = new Date(record.dateRecorded + 'T00:00:00');
    if (isNaN(startDate.getTime())) {
        DOMElements.profileWeightDisplayArea.innerHTML = '<div class="alert alert-warning">Cannot display weight chart due to invalid start date.</div>';
        return;
    }

    const allWeightPoints = gatherAllWeightData(record);
    renderWeightDataTable(allWeightPoints, record.id, 'profileWeightTableContainer');
    calculateAndDisplayWeightStats(allWeightPoints, 'profileWeightStatsBody');

    const chartPoints = allWeightPoints.map(dp => ({ x: (dp.date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 7), y: dp.weight }));

    if (chartPoints.length < 1) {
        DOMElements.profileWeightChartContainer.innerHTML = '<div class="alert alert-info text-center h-100 d-flex align-items-center justify-content-center">No weight data to display.</div>';
        if (state.charts.profileWeight) state.charts.profileWeight.destroy();
        return;
    }

    const ctx = DOMElements.profileWeightChart.getContext('2d');
    if (state.charts.profileWeight) { state.charts.profileWeight.destroy(); }

    state.charts.profileWeight = new Chart(ctx, {
        type: 'line',
        data: { datasets: [{ label: `Weight (kg) for ${record.sheepId}`, data: chartPoints, borderColor: '#0d6efd', backgroundColor: 'rgba(13, 110, 253, 0.1)', fill: true, tension: 0.1, pointRadius: 5, pointHoverRadius: 7 }] },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                x: { type: 'linear', position: 'bottom', title: { display: true, text: 'Weeks Since Record Start Date' } },
                y: { title: { display: true, text: 'Weight (kg)' }, beginAtZero: true }
            },
            plugins: { tooltip: { callbacks: {
                title: context => `Week ${context[0].raw.x.toFixed(1)}`,
                label: context => `Weight: ${context.raw.y} kg`
            }}}
        }
    });
}

function renderTreatmentProfile(record) {
    const treatments = record.treatments ? Object.values(record.treatments).sort((a, b) => new Date(b.treatmentDate) - new Date(a.treatmentDate)) : [];
    let rowsHtml = '';
    if (treatments.length > 0) {
        rowsHtml = treatments.map(entry => `<tr>
            <td>${formatDate(entry.treatmentDate)}</td>
            <td>${entry.treatmentType || 'General'}</td>
            <td>${entry.symptoms || ''}</td>
            <td>${entry.medication || ''}</td>
            <td>${entry.dosage || ''}</td>
            <td>${entry.treatmentNotes || ''}</td>
        </tr>`).join('');
    } else {
        rowsHtml = '<tr><td colspan="6" class="text-center">No treatment history recorded.</td></tr>';
    }
    DOMElements.profileTreatmentHistoryTbody.innerHTML = rowsHtml;
}

function updateProfileNavButtons() {
    const selector = DOMElements.profileSheepSelector;
    const options = Array.from(selector.options).filter(opt => !opt.disabled && opt.style.display !== 'none');
    const currentIndex = options.findIndex(opt => opt.value === selector.value);

    DOMElements.prevSheepBtn.disabled = currentIndex <= 0;
    DOMElements.nextSheepBtn.disabled = currentIndex >= options.length - 1 || currentIndex === -1;
}

function navigateProfile(direction) {
    const selector = DOMElements.profileSheepSelector;
    const options = Array.from(selector.options).filter(opt => !opt.disabled && opt.style.display !== 'none');
    const currentIndex = options.findIndex(opt => opt.value === selector.value);

    if (currentIndex === -1 && options.length > 0) {
        selector.value = options[0].value;
        selector.dispatchEvent(new Event('change'));
        return;
    }

    const newIndex = currentIndex + direction;
    if (newIndex >= 0 && newIndex < options.length) {
        selector.value = options[newIndex].value;
        selector.dispatchEvent(new Event('change'));
    }
}

// --- APP INITIALIZATION ---

document.addEventListener('DOMContentLoaded', () => {
    cacheDOMElements();
});
