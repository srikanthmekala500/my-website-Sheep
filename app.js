document.addEventListener('DOMContentLoaded', () => {
    // --- Firebase Initialization ---
    const firebaseConfig = { apiKey: "AIzaSyBdiEUorFPkiZAya84Xzx17id82nB77Zg4", authDomain: "sheep-1b6a7.firebaseapp.com", databaseURL: "https://sheep-1b6a7-default-rtdb.firebaseio.com", projectId: "sheep-1b6a7", storageBucket: "sheep-1b6a7.firebasestorage.app", messagingSenderId: "243565434909", appId: "1:243565434909:web:25312f89033e3fd0d54ef4" };
    firebase.initializeApp(firebaseConfig);
    const db = firebase.database();
    const auth = firebase.auth();

    // --- State Variables ---
    let allRecords = [];
    let soldRecords = [];
    let editSheepModal, saleSheepModal, treatmentLogModal, weightEntryModal, batchTreatmentModal;
    let healthStatusChart, weightChart, profileWeightChart;
    let currentWeeklyFilter = 'all';
    let currentScheduleFilter = 'all';

    // --- DOM Element Cache ---
    const mainApp = document.getElementById('mainApp');
    const authSection = document.getElementById('authSection');

    // --- Authentication ---
    auth.onAuthStateChanged(user => {
        if (user) {
            mainApp.style.display = 'block';
            authSection.style.display = 'none';
            initializeUI();
        } else {
            mainApp.style.display = 'none';
            authSection.style.display = 'block';
        }
    });

    const handleLogin = (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        auth.signInWithEmailAndPassword(email, password).catch(err => {
            document.getElementById('authError').textContent = err.message;
        });
    };

    // --- UI Initialization and Event Listeners ---
    const initializeUI = () => {
        // Initialize Modals
        editSheepModal = new bootstrap.Modal(document.getElementById('editSheepModal'));
        saleSheepModal = new bootstrap.Modal(document.getElementById('saleSheepModal'));
        treatmentLogModal = new bootstrap.Modal(document.getElementById('treatmentLogModal'));
        weightEntryModal = new bootstrap.Modal(document.getElementById('weightEntryModal'));
        batchTreatmentModal = new bootstrap.Modal(document.getElementById('batchTreatmentModal'));

        // Set default date
        document.getElementById('dateRecorded').valueAsDate = new Date();

        // Add all event listeners
        addEventListeners();

        // Initial data fetch
        fetchAllRecords();
        fetchSoldRecords();
        fetchArchivedRecords();
    };

    const addEventListeners = () => {
        // Forms
        document.getElementById('loginForm').addEventListener('submit', handleLogin);
        document.getElementById('sheepHealthForm').addEventListener('submit', handleAddRecord);
        document.getElementById('editSheepForm').addEventListener('submit', handleUpdateRecord);
        document.getElementById('saleSheepForm').addEventListener('submit', handleSaleSubmit);
        document.getElementById('addTreatmentForm').addEventListener('submit', handleSaveTreatment);
        document.getElementById('batchTreatmentForm').addEventListener('submit', handleBatchSaveTreatment);
        document.getElementById('weightEntryForm').addEventListener('submit', handleSaveWeight);

        // Buttons
        document.getElementById('signOutBtn').addEventListener('click', () => auth.signOut());
        document.getElementById('sidebarToggleBtn').addEventListener('click', () => document.querySelector('.dashboard-sidebar').classList.toggle('visible'));
        document.getElementById('clearTreatmentFormBtn').addEventListener('click', resetTreatmentForm);
        document.getElementById('batchLogBtn').addEventListener('click', openBatchLogModal);
        document.getElementById('addWeightBtn').addEventListener('click', () => {
            const recordId = document.getElementById('weightSheepSelector').value;
            if (recordId) openWeightModal(recordId);
        });
        document.getElementById('profileEditBtn').addEventListener('click', () => {
            const recordId = document.getElementById('profileSheepSelector').value;
            if (recordId) openEditModal(recordId);
        });
        document.getElementById('prevSheepBtn').addEventListener('click', () => navigateProfile(-1));
        document.getElementById('nextSheepBtn').addEventListener('click', () => navigateProfile(1));

        // CSV Export Buttons
        document.getElementById('exportHealthyCsvBtn').addEventListener('click', () => exportData('healthy'));
        document.getElementById('exportTreatmentCsvBtn').addEventListener('click', () => exportData('treatment'));
        document.getElementById('exportSoldCsvBtn').addEventListener('click', exportSoldData);
        document.getElementById('exportAnalyticsCsvBtn').addEventListener('click', () => exportData('healthy'));

        // Sidebar Navigation (Event Delegation)
        document.querySelector('.dashboard-sidebar .nav').addEventListener('click', (e) => {
            const link = e.target.closest('.nav-link');
            if (link && link.dataset.section) {
                e.preventDefault();
                showSection(link.dataset.section);
            }
        });

        // Filter buttons
        document.getElementById('scheduleFilterButtons').addEventListener('click', e => {
            if (e.target.matches('button')) updateScheduleView(e.target.dataset.filter);
        });
        document.getElementById('weeklyFilterButtons').addEventListener('click', e => {
            if (e.target.matches('button')) updateWeeklyTrackingView(e.target.dataset.filter);
        });

        // Search inputs
        document.querySelectorAll('input[data-table]').forEach(input => {
            input.addEventListener('keyup', () => filterTableBySheepId(input.id, input.dataset.table));
        });
        document.getElementById('profileSearchInput').addEventListener('keyup', filterProfileSelector);

        // Selectors and dynamic content
        document.getElementById('scheduleTableBody').addEventListener('change', e => {
            if (e.target.matches('.sheep-select-checkbox')) updateBatchLogUI();
        });
        document.getElementById('selectAllSchedule').addEventListener('change', e => {
            document.querySelectorAll('#scheduleTableBody .sheep-select-checkbox').forEach(cb => cb.checked = e.target.checked);
            updateBatchLogUI();
        });
        document.getElementById('profileSheepSelector').addEventListener('change', e => {
            if (e.target.value) renderProfileForSheep(e.target.value);
        });
        document.getElementById('weightSheepSelector').addEventListener('change', e => {
            if (e.target.value) renderWeightChartForSheep(e.target.value);
        });

        // Event delegation for dynamically created elements
        document.getElementById('notification-list').addEventListener('click', handleNotificationClick);
        document.getElementById('schedule-notification-list').addEventListener('click', handleNotificationClick);
        document.getElementById('healthyRecordsTableBody').addEventListener('click', handleTableAction);
        document.getElementById('treatmentRecordsTableBody').addEventListener('click', handleTableAction);
        document.getElementById('scheduleTableBody').addEventListener('click', handleTableAction);
        document.getElementById('weeklyTableBody').addEventListener('click', handleTableAction);
        document.getElementById('sheepSaledTableBody').addEventListener('click', handleTableAction);
        document.getElementById('archivedRecordsTableBody').addEventListener('click', handleTableAction);
        document.getElementById('treatmentLogTbody').addEventListener('click', handleTreatmentLogAction);
        document.getElementById('weightTableContainer').addEventListener('click', handleWeightTableAction);
        document.getElementById('profileWeightTableContainer').addEventListener('click', handleWeightTableAction);
    };

    // --- Utility Functions ---
    const formatDate = (dateString) => {
        if (!dateString) return '';
        try {
            const date = new Date(`${dateString.split('T')[0]}T00:00:00`);
            if (isNaN(date.getTime())) return dateString;
            return date.toLocaleDateString('en-GB', { year: '2-digit', month: '2-digit', day: '2-digit' });
        } catch (e) {
            return dateString;
        }
    };

    const getStatusClass = (status) => {
        const statusMap = {
            'Healthy': 'status-healthy',
            'Recovering': 'status-healthy',
            'Sick': 'status-sick',
            'Deceased': 'status-sick',
            'Under Treatment': 'status-treatment'
        };
        return statusMap[status] || '';
    };

    // --- Section Navigation ---
    const showSection = (sectionName) => {
        document.querySelectorAll('.dashboard-content > div').forEach(section => {
            section.classList.add('hidden');
        });
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });

        document.getElementById(`${sectionName}Section`).classList.remove('hidden');
        const activeLink = document.querySelector(`.nav-link[data-section="${sectionName}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }

        const sidebar = document.querySelector('.dashboard-sidebar');
        if (sidebar.classList.contains('visible')) {
            sidebar.classList.remove('visible');
        }
    };

    // --- Data Fetching ---
    const fetchAllRecords = () => {
        db.ref("sheepHealthRecords").on("value", snapshot => {
            const healthyTable = document.getElementById('healthyRecordsTableBody');
            const treatmentTable = document.getElementById('treatmentRecordsTableBody');
            const analyticsHealthyTable = document.getElementById('analyticsHealthyRecordsTableBody');
            healthyTable.innerHTML = '';
            treatmentTable.innerHTML = '';
            analyticsHealthyTable.innerHTML = '';
            allRecords = [];

            if (snapshot.exists()) {
                snapshot.forEach(child => {
                    const record = { id: child.key, ...child.val() };
                    allRecords.push(record);
                });

                const healthyRows = [];
                const treatmentRows = [];
                allRecords.forEach(record => {
                    const status = record.healthStatus;
                    if (status === 'Healthy' || status === 'Recovering') {
                        healthyRows.push(renderHealthyRow(record));
                    } else {
                        treatmentRows.push(renderTreatmentRow(record));
                    }
                });
                healthyTable.innerHTML = healthyRows.join('');
                analyticsHealthyTable.innerHTML = healthyRows.join('');
                treatmentTable.innerHTML = treatmentRows.join('');
            }

            // Trigger UI updates that depend on this data
            updateAnalytics();
            updateGrowthAnalytics();
            updateScheduleView();
            updateWeeklyTrackingView();
            updateWeightTrackingView();
            updateProfileView();
            checkTreatmentFollowUps();
            checkPreventativeCareReminders();
        });
    };

    const fetchSoldRecords = () => {
        db.ref("sheepSaledRecords").orderByChild("saleDate").on("value", snapshot => {
            const tableBody = document.getElementById('sheepSaledTableBody');
            soldRecords = [];
            let rowsHtml = '';
            if (snapshot.exists()) {
                snapshot.forEach(child => {
                    const record = { id: child.key, ...child.val() };
                    soldRecords.push(record);
                });
                soldRecords.reverse(); // Show newest first
                rowsHtml = soldRecords.map(renderSoldRow).join('');
            }
            tableBody.innerHTML = rowsHtml || `<tr><td colspan="7" class="text-center">No sold records.</td></tr>`;
            updateProfileView();
        });
    };

    const fetchArchivedRecords = () => {
        db.ref("sheepArchivedRecords").orderByChild("archiveDate").on("value", snapshot => {
            const tableBody = document.getElementById('archivedRecordsTableBody');
            let archivedRecords = [];
            let rowsHtml = '';
            if (snapshot.exists()) {
                snapshot.forEach(child => {
                    const record = { id: child.key, ...child.val() };
                    archivedRecords.push(record);
                });
                archivedRecords.reverse(); // Show newest first
                rowsHtml = archivedRecords.map(renderArchivedRow).join('');
            }
            tableBody.innerHTML = rowsHtml || `<tr><td colspan="6" class="text-center">No archived records.</td></tr>`;
        });
    };

    // --- Rendering Functions ---
    const renderHealthyRow = (record) => {
        return `
            <tr data-id="${record.id}" data-sheep-id="${record.sheepId}">
                <td><strong>${record.sheepId}</strong></td>
                <td><span class="${getStatusClass(record.healthStatus)}">${record.healthStatus}</span></td>
                <td>${formatDate(record.dateRecorded)}</td>
                <td>${record.weight || 'N/A'}</td>
                <td>${record.temperature || 'N/A'}</td>
                <td>${record.notes || ''}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary action-edit" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-outline-success action-sale" title="Mark as Sold"><i class="fas fa-dollar-sign"></i> Sale</button>
                    <button class="btn btn-sm btn-outline-danger action-delete" title="Permanently Delete"><i class="fas fa-trash"></i></button>
                    <button class="btn btn-sm btn-outline-secondary action-archive" title="Mark as Deceased/Archive"><i class="fas fa-archive"></i></button>
                </td>
            </tr>`;
    };

    const renderTreatmentRow = (record) => {
        let lastUpdate = 'N/A';
        let followUpIndicator = '';
        let rowClass = '';

        if (record.treatments) {
            const treatments = Object.values(record.treatments).sort((a, b) => new Date(b.treatmentDate) - new Date(a.treatmentDate));
            if (treatments.length > 0) {
                const latestTreatment = treatments[0];
                lastUpdate = formatDate(latestTreatment.treatmentDate);

                if (latestTreatment.followUpDate) {
                    const followUpDate = new Date(`${latestTreatment.followUpDate}T00:00:00`);
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
        return `
            <tr class="${rowClass}" data-id="${record.id}" data-sheep-id="${record.sheepId}">
                <td><strong>${record.sheepId}</strong></td>
                <td><span class="${getStatusClass(record.healthStatus)}">${record.healthStatus}</span></td>
                <td>${formatDate(record.dateRecorded)}</td>
                <td>${lastUpdate}${followUpIndicator}</td>
                <td>
                    <button class="btn btn-sm btn-info action-manage" title="Manage Treatments"><i class="fas fa-notes-medical"></i> Manage</button>
                    <button class="btn btn-sm btn-outline-primary action-edit" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-outline-success action-sale" title="Mark as Sold"><i class="fas fa-dollar-sign"></i> Sale</button>
                    <button class="btn btn-sm btn-outline-danger action-delete" title="Permanently Delete"><i class="fas fa-trash"></i></button>
                    <button class="btn btn-sm btn-outline-secondary action-archive" title="Mark as Deceased/Archive"><i class="fas fa-archive"></i></button>
                </td>
            </tr>`;
    };

    const renderSoldRow = (record) => {
        return `
            <tr data-id="${record.id}" data-sheep-id="${record.sheepId}">
                <td><strong>${record.sheepId}</strong></td>
                <td>${record.healthStatus}</td>
                <td>${formatDate(record.saleDate)}</td>
                <td>${record.salePrice || 'N/A'}</td>
                <td>${record.saleBuyer || 'N/A'}</td>
                <td>${record.saleNotes || ''}</td>
                <td>
                    <button class="btn btn-sm btn-outline-danger action-delete-sold" title="Permanently Delete"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
    };

    const renderArchivedRow = (record) => {
        return `
            <tr data-id="${record.id}" data-sheep-id="${record.sheepId}">
                <td><strong>${record.sheepId}</strong></td>
                <td><span class="status-sick">${record.healthStatus}</span></td>
                <td>${formatDate(record.archiveDate)}</td>
                <td>${formatDate(record.dateRecorded)}</td>
                <td>${record.notes || ''}</td>
                <td>
                    <button class="btn btn-sm btn-outline-danger action-delete-archived" title="Permanently Delete"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
    };

    const renderWeeklyRow = (record) => {
        const lastActivityDateStr = formatDate(record.lastActivityDate.toISOString().split('T')[0]);
        const weeklyStatusBadge = record.isChecked ? '<span class="badge bg-success">Checked</span>' : '<span class="badge bg-warning text-dark">Needs Check</span>';
        return `
            <tr data-id="${record.id}" data-sheep-id="${record.sheepId}">
                <td><strong>${record.sheepId}</strong></td>
                <td><span class="${getStatusClass(record.healthStatus)}">${record.healthStatus}</span></td>
                <td>${lastActivityDateStr}</td>
                <td>${weeklyStatusBadge}</td>
                <td>
                    <button class="btn btn-sm btn-info action-manage" title="Log New Treatment"><i class="fas fa-notes-medical"></i> Manage</button>
                    <button class="btn btn-sm btn-outline-primary action-edit" title="Edit Record"><i class="fas fa-edit"></i></button>
                </td>
            </tr>`;
    };

    const renderScheduleRow = (record) => {
        const dewormingStatus = getScheduleStatus(record.lastDewormingDate, 30, null);
        const vaccinationStatus = getScheduleStatus(record.lastVaccinationDate, 365, record.manualVaccinationDueDate);

        return `
            <tr data-id="${record.id}" data-sheep-id="${record.sheepId}">
                <td><input type="checkbox" class="form-check-input sheep-select-checkbox" data-id="${record.id}"></td>
                <td><strong>${record.sheepId}</strong></td>
                <td>${renderScheduleStatusBadge(dewormingStatus, record.lastDewormingDate)}</td>
                <td>${record.lastDewormingNotes || ''}</td>
                <td>${renderScheduleStatusBadge(vaccinationStatus, record.lastVaccinationDate)}</td>
                <td>${record.lastVaccinationNotes || ''}</td>
                <td>
                    <button class="btn btn-sm btn-info action-manage" title="Log New Treatment"><i class="fas fa-notes-medical"></i> Manage</button>
                    <button class="btn btn-sm btn-outline-primary action-edit" title="Edit Record"><i class="fas fa-edit"></i></button>
                </td>
            </tr>`;
    };

    const renderScheduleStatusBadge = (status, lastDate) => {
        const tooltipContent = `Last Given: ${lastDate ? formatDate(lastDate) : 'N/A'}`;
        return `<span class="badge bg-${status.className}" data-bs-toggle="tooltip" title="${tooltipContent}">${status.text}</span>`;
    };

    const renderNotificationList = (notifications, listEl, badgeEl, emptyText) => {
        listEl.innerHTML = '';

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

        notifications.forEach(n => {
            let iconClass = '';
            if (n.status === 'Overdue') iconClass = 'fas fa-exclamation-circle text-danger';
            else if (n.status === 'Due Today') iconClass = 'fas fa-calendar-day text-warning';
            else if (n.status === 'Upcoming') iconClass = 'fas fa-calendar-alt text-info';

            listEl.innerHTML += `
                <li>
                    <a href="#" class="dropdown-item notification-item" data-record-id="${n.recordId}">
                        <div class="icon"><i class="${iconClass}"></i></div>
                        <div class="content">
                            <strong>Sheep ID: ${n.sheepId}</strong>
                            <div class="small text-muted">${n.message}</div>
                        </div>
                    </a>
                </li>`;
        });
    };

    // --- Event Handlers ---
    const handleTableAction = (e) => {
        const button = e.target.closest('button[class*="action-"]');
        if (!button) return;

        const row = button.closest('tr');
        const recordId = row.dataset.id;
        const sheepId = row.dataset.sheepId;

        if (button.classList.contains('action-edit')) openEditModal(recordId);
        else if (button.classList.contains('action-sale')) openSaleModal(recordId);
        else if (button.classList.contains('action-delete')) deleteRecord(recordId, sheepId);
        else if (button.classList.contains('action-archive')) archiveRecord(recordId);
        else if (button.classList.contains('action-manage')) openTreatmentLog(recordId, sheepId);
        else if (button.classList.contains('action-delete-sold')) deleteSoldRecord(recordId, sheepId);
        else if (button.classList.contains('action-delete-archived')) deleteArchivedRecord(recordId, sheepId);
    };

    const handleTreatmentLogAction = (e) => {
        const button = e.target.closest('button');
        if (!button) return;

        const row = button.closest('tr');
        const recordId = document.getElementById('currentSheepRecordId').value;
        const entryId = row.dataset.id;

        if (button.classList.contains('action-edit-treatment')) editTreatmentEntry(recordId, entryId);
        else if (button.classList.contains('action-delete-treatment')) deleteTreatmentEntry(recordId, entryId);
    };

    const handleWeightTableAction = (e) => {
        const button = e.target.closest('button');
        if (!button) return;

        const row = button.closest('tr');
        const { recordId, entryId, source } = row.dataset;

        if (button.classList.contains('action-edit-weight')) openWeightModal(recordId, entryId, source);
        else if (button.classList.contains('action-delete-weight')) deleteWeightEntry(recordId, entryId, source);
    };

    const handleNotificationClick = (e) => {
        e.preventDefault();
        const item = e.target.closest('.notification-item');
        if (item && item.dataset.recordId) {
            viewRecordFromNotification(item.dataset.recordId);
        }
    };

    const handleAddRecord = (e) => {
        e.preventDefault();
        const newRecord = {
            sheepId: document.getElementById('sheepId').value.trim(),
            healthStatus: document.getElementById('healthStatus').value,
            dateRecorded: document.getElementById('dateRecorded').value,
            notes: document.getElementById('notes').value.trim(),
            weight: document.getElementById('weight').value || null,
            temperature: document.getElementById('temperature').value || null,
        };
        if (!newRecord.sheepId || !newRecord.dateRecorded) return alert("Sheep ID and Date are required.");

        const isDuplicate = allRecords.some(record => record.sheepId.toLowerCase() === newRecord.sheepId.toLowerCase());
        if (isDuplicate) {
            return alert(`Error: A sheep with ID "${newRecord.sheepId}" already exists in the active records. Please use a unique ID.`);
        }

        db.ref('sheepHealthRecords').push(newRecord).then(() => {
            e.target.reset();
            document.getElementById('dateRecorded').valueAsDate = new Date();
        });
    };

    const handleUpdateRecord = (e) => {
        e.preventDefault();
        const recordId = document.getElementById('editRecordId').value;
        const updatedData = {
            sheepId: document.getElementById('editSheepId').value.trim(),
            healthStatus: document.getElementById('editHealthStatus').value,
            dateRecorded: document.getElementById('editDateRecorded').value,
            notes: document.getElementById('editNotes').value.trim(),
            lastDewormingDate: document.getElementById('editLastDewormingDate').value || null,
            lastDewormingNotes: document.getElementById('editLastDewormingNotes').value.trim() || null,
            lastVaccinationDate: document.getElementById('editLastVaccinationDate').value || null,
            manualVaccinationDueDate: document.getElementById('editManualVaccinationDueDate').value || null,
            lastVaccinationNotes: document.getElementById('editLastVaccinationNotes').value.trim() || null,
        };

        if (updatedData.healthStatus === 'Deceased') {
            editSheepModal.hide();
            archiveRecord(recordId);
            return;
        }

        const isDuplicate = allRecords.some(
            record => record.id !== recordId && record.sheepId.toLowerCase() === updatedData.sheepId.toLowerCase()
        );
        if (isDuplicate) {
            return alert(`Error: Another sheep with ID "${updatedData.sheepId}" already exists. Please use a unique ID.`);
        }

        db.ref(`sheepHealthRecords/${recordId}`).update(updatedData).then(() => editSheepModal.hide());
    };

    const handleSaleSubmit = (e) => {
        e.preventDefault();
        const recordId = document.getElementById('saleRecordId').value;
        const recordToSell = allRecords.find(r => r.id === recordId);
        if (!recordToSell) return alert("Record not found.");

        const soldRecord = {
            ...recordToSell,
            saleDate: document.getElementById('saleDate').value,
            salePrice: document.getElementById('salePrice').value,
            saleBuyer: document.getElementById('saleBuyer').value.trim(),
            saleNotes: document.getElementById('saleNotes').value.trim(),
        };
        delete soldRecord.id;

        db.ref('sheepSaledRecords').push(soldRecord).then(() => {
            db.ref(`sheepHealthRecords/${recordId}`).remove().then(() => {
                saleSheepModal.hide();
                e.target.reset();
            });
        });
    };

    const handleSaveTreatment = (e) => {
        e.preventDefault();
        const recordId = document.getElementById('currentSheepRecordId').value;
        const entryId = document.getElementById('treatmentEntryId').value;
        const treatmentType = document.getElementById('treatmentType').value;
        const treatmentDate = document.getElementById('treatmentDate').value;
        const treatmentWeight = parseFloat(document.getElementById('treatmentWeight').value);

        const entryData = {
            treatmentDate,
            treatmentType,
            symptoms: document.getElementById('symptoms').value,
            medication: document.getElementById('medication').value,
            dosage: document.getElementById('dosage').value,
            followUpDate: document.getElementById('followUpDate').value,
            treatmentNotes: document.getElementById('treatmentNotes').value,
        };

        if (!isNaN(treatmentWeight) && treatmentWeight > 0) {
            db.ref(`sheepHealthRecords/${recordId}/weights`).push({ date: treatmentDate, weight: treatmentWeight });
        }

        const path = `sheepHealthRecords/${recordId}/treatments`;
        const promise = entryId ? db.ref(path).child(entryId).update(entryData) : db.ref(path).push(entryData);

        promise.then(() => {
            const updates = {};
            if (treatmentType === 'Deworming') {
                updates.lastDewormingDate = treatmentDate;
                updates.lastDewormingNotes = entryData.treatmentNotes;
            } else if (treatmentType === 'Vaccination') {
                updates.lastVaccinationDate = treatmentDate;
                updates.lastVaccinationNotes = entryData.treatmentNotes;
            }

            const record = allRecords.find(r => r.id === recordId);
            if (record && record.healthStatus === 'Sick') {
                updates.healthStatus = 'Under Treatment';
            }

            if (Object.keys(updates).length > 0) {
                db.ref(`sheepHealthRecords/${recordId}`).update(updates);
            }
            resetTreatmentForm();
        });
    };

    const handleBatchSaveTreatment = (e) => {
        e.preventDefault();
        const selectedCheckboxes = document.querySelectorAll('#scheduleTableBody .sheep-select-checkbox:checked');
        const recordIds = Array.from(selectedCheckboxes).map(cb => cb.dataset.id);

        const treatmentType = document.getElementById('batchTreatmentType').value;
        const treatmentDate = document.getElementById('batchTreatmentDate').value;

        if (!treatmentType || !treatmentDate) {
            return alert('Treatment Type and Date are required.');
        }

        const entryData = {
            treatmentDate,
            treatmentType,
            medication: document.getElementById('batchMedication').value,
            dosage: document.getElementById('batchDosage').value,
            treatmentNotes: document.getElementById('batchTreatmentNotes').value,
            symptoms: 'Batch logged treatment',
            followUpDate: ''
        };

        const updates = {};
        recordIds.forEach(recordId => {
            const treatmentId = db.ref().child(`sheepHealthRecords/${recordId}/treatments`).push().key;
            updates[`sheepHealthRecords/${recordId}/treatments/${treatmentId}`] = entryData;

            if (treatmentType === 'Deworming') {
                updates[`sheepHealthRecords/${recordId}/lastDewormingDate`] = treatmentDate;
                updates[`sheepHealthRecords/${recordId}/lastDewormingNotes`] = entryData.treatmentNotes;
            } else if (treatmentType === 'Vaccination') {
                updates[`sheepHealthRecords/${recordId}/lastVaccinationDate`] = treatmentDate;
                updates[`sheepHealthRecords/${recordId}/lastVaccinationNotes`] = entryData.treatmentNotes;
            }
        });

        db.ref().update(updates).then(() => batchTreatmentModal.hide());
    };

    const handleSaveWeight = (e) => {
        e.preventDefault();
        const recordId = document.getElementById('weightRecordId').value;
        const entryId = document.getElementById('weightEntryId').value;
        const source = document.getElementById('weightEntrySource').value;
        const date = document.getElementById('weightEntryDate').value;
        const weight = parseFloat(document.getElementById('weightEntryValue').value);

        if (!date || isNaN(weight)) {
            return alert('Please provide a valid date and weight.');
        }

        let promise;
        if (source === 'initial') {
            promise = db.ref(`sheepHealthRecords/${recordId}`).update({ weight: weight, dateRecorded: date });
        } else {
            const data = { date, weight };
            const path = `sheepHealthRecords/${recordId}/weights`;
            promise = entryId ? db.ref(path).child(entryId).update(data) : db.ref(path).push(data);
        }

        promise.then(() => {
            weightEntryModal.hide();
        }).catch(err => alert(`Error saving weight: ${err.message}`));
    };

    // --- Record Actions (Delete, Archive) ---
    const deleteRecord = (recordId, sheepId) => {
        if (confirm(`Are you sure you want to PERMANENTLY DELETE sheep "${sheepId}" and all its history? This action cannot be undone.`)) {
            db.ref(`sheepHealthRecords/${recordId}`).remove()
                .catch(error => alert(`An error occurred while deleting the record: ${error.message}`));
        }
    };

    const archiveRecord = (recordId) => {
        if (confirm('Are you sure you want to mark this sheep as deceased and move it to the archive? This action moves the record and cannot be easily undone.')) {
            const recordToArchive = allRecords.find(r => r.id === recordId);
            if (!recordToArchive) return alert("Record not found.");

            const archivedRecord = {
                ...recordToArchive,
                healthStatus: 'Deceased',
                archiveDate: new Date().toISOString().split('T')[0]
            };
            delete archivedRecord.id;

            db.ref('sheepArchivedRecords').push(archivedRecord).then(() => {
                db.ref(`sheepHealthRecords/${recordId}`).remove();
            });
        }
    };

    const deleteSoldRecord = (recordId, sheepId) => {
        if (confirm(`Are you sure you want to PERMANENTLY DELETE the sale record for sheep "${sheepId}"? This action cannot be undone.`)) {
            db.ref(`sheepSaledRecords/${recordId}`).remove();
        }
    };

    const deleteArchivedRecord = (recordId, sheepId) => {
        if (confirm(`Are you sure you want to PERMANENTLY DELETE the archived record for sheep "${sheepId}"? This action cannot be undone.`)) {
            db.ref(`sheepArchivedRecords/${recordId}`).remove();
        }
    };

    // --- Modal Openers ---
    const openEditModal = (recordId) => {
        const record = allRecords.find(r => r.id === recordId);
        if (!record) return;
        const form = document.getElementById('editSheepForm');
        form.reset();
        document.getElementById('editRecordId').value = recordId;
        document.getElementById('editSheepId').value = record.sheepId;
        document.getElementById('editHealthStatus').value = record.healthStatus;
        document.getElementById('editDateRecorded').value = record.dateRecorded;
        document.getElementById('editNotes').value = record.notes || '';
        document.getElementById('editLastDewormingDate').value = record.lastDewormingDate || '';
        document.getElementById('editLastDewormingNotes').value = record.lastDewormingNotes || '';
        document.getElementById('editLastVaccinationDate').value = record.lastVaccinationDate || '';
        document.getElementById('editManualVaccinationDueDate').value = record.manualVaccinationDueDate || '';
        document.getElementById('editLastVaccinationNotes').value = record.lastVaccinationNotes || '';
        editSheepModal.show();
    };

    const openSaleModal = (recordId) => {
        document.getElementById('saleSheepForm').reset();
        document.getElementById('saleRecordId').value = recordId;
        document.getElementById('saleDate').valueAsDate = new Date();
        saleSheepModal.show();
    };

    const openTreatmentLog = (recordId, sheepId) => {
        document.getElementById('modalSheepId').textContent = sheepId;
        document.getElementById('currentSheepRecordId').value = recordId;
        resetTreatmentForm();

        const tbody = document.getElementById('treatmentLogTbody');
        db.ref(`sheepHealthRecords/${recordId}/treatments`).on('value', snapshot => {
            tbody.innerHTML = '';
            if (snapshot.exists()) {
                const entries = [];
                snapshot.forEach(child => {
                    entries.push({ id: child.key, ...child.val() });
                });
                tbody.innerHTML = entries
                    .sort((a, b) => new Date(b.treatmentDate) - new Date(a.treatmentDate))
                    .map(entry => `
                        <tr data-id="${entry.id}">
                            <td>${formatDate(entry.treatmentDate)}</td>
                            <td>${entry.symptoms || ''}</td>
                            <td>${entry.medication || ''}</td>
                            <td>${entry.dosage || ''}</td>
                            <td>
                                <button class="btn btn-sm btn-outline-primary action-edit-treatment"><i class="fas fa-pencil-alt"></i></button>
                                <button class="btn btn-sm btn-outline-danger action-delete-treatment"><i class="fas fa-trash"></i></button>
                            </td>
                        </tr>
                    `).join('');
            } else {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center">No treatment entries yet.</td></tr>';
            }
        });
        treatmentLogModal.show();
    };

    const openWeightModal = (recordId, entryId = null, source = 'log') => {
        document.getElementById('weightEntryForm').reset();
        document.getElementById('weightRecordId').value = recordId;
        document.getElementById('weightEntryId').value = entryId || '';
        document.getElementById('weightEntrySource').value = source;

        if (entryId) {
            document.getElementById('weightModalTitle').textContent = 'Edit Weight Entry';
            const record = allRecords.find(r => r.id === recordId);
            if (!record) return;

            let dataPoint;
            if (source === 'initial') {
                dataPoint = { date: record.dateRecorded, weight: record.weight };
            } else if (source === 'log' && record.weights) {
                dataPoint = record.weights[entryId];
            }

            if (dataPoint) {
                document.getElementById('weightEntryDate').value = dataPoint.date;
                document.getElementById('weightEntryValue').value = dataPoint.weight;
            }
        } else {
            document.getElementById('weightModalTitle').textContent = 'Add Weight Entry';
            document.getElementById('weightEntryDate').valueAsDate = new Date();
        }
        weightEntryModal.show();
    };

    const openBatchLogModal = () => {
        const selectedCheckboxes = document.querySelectorAll('#scheduleTableBody .sheep-select-checkbox:checked');
        const count = selectedCheckboxes.length;
        if (count === 0) return alert('Please select at least one sheep.');

        document.getElementById('batchCount').textContent = count;
        document.getElementById('batchTreatmentForm').reset();
        document.getElementById('batchTreatmentDate').valueAsDate = new Date();
        batchTreatmentModal.show();
    };

    
    // --- Treatment Management ---
    const editTreatmentEntry = (recordId, entryId) => {
        db.ref(`sheepHealthRecords/${recordId}/treatments/${entryId}`).once('value', snapshot => {
            const entry = snapshot.val();
            if (!entry) return;
            document.getElementById('treatmentEntryId').value = entryId;
            document.getElementById('treatmentType').value = entry.treatmentType || 'General';
            document.getElementById('treatmentDate').value = entry.treatmentDate;
            document.getElementById('symptoms').value = entry.symptoms || '';
            document.getElementById('medication').value = entry.medication || '';
            document.getElementById('dosage').value = entry.dosage || '';
            document.getElementById('followUpDate').value = entry.followUpDate || '';
            document.getElementById('treatmentWeight').value = ''; // Clear this as it's handled separately
            document.getElementById('treatmentNotes').value = entry.treatmentNotes || '';
        });
    };

    const deleteTreatmentEntry = (recordId, entryId) => {
        if (confirm('Delete this treatment entry?')) {
            db.ref(`sheepHealthRecords/${recordId}/treatments/${entryId}`).remove();
        }
    };

    const resetTreatmentForm = () => {
        document.getElementById('addTreatmentForm').reset();
        document.getElementById('treatmentEntryId').value = '';
        document.getElementById('treatmentDate').valueAsDate = new Date();
    };

    const deleteWeightEntry = (recordId, entryId, source) => {
        if (!confirm('Are you sure you want to delete this weight entry?')) return;

        let promise;
        if (source === 'initial') {
            promise = db.ref(`sheepHealthRecords/${recordId}/weight`).remove();
        } else if (source === 'log') {
            promise = db.ref(`sheepHealthRecords/${recordId}/weights/${entryId}`).remove();
        } else if (source === 'treatment') {
            // This was for legacy data, removing the weight property from a treatment
            promise = db.ref(`sheepHealthRecords/${recordId}/treatments/${entryId}/weight`).remove();
        }

        if (promise) {
            promise.catch(err => alert(`Error deleting entry: ${err.message}`));
        }
    };

    // --- Notifications and Reminders ---
    const checkTreatmentFollowUps = () => {
        const notifications = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        allRecords.forEach(record => {
            if (record.treatments) {
                const treatmentsWithFollowUp = Object.values(record.treatments).filter(t => t.followUpDate);
                if (treatmentsWithFollowUp.length > 0) {
                    treatmentsWithFollowUp.sort((a, b) => new Date(b.followUpDate) - new Date(a.followUpDate));
                    const latestFollowUp = treatmentsWithFollowUp[0];
                    const followUpDate = new Date(`${latestFollowUp.followUpDate}T00:00:00`);

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

        const listEl = document.getElementById('notification-list');
        const badgeEl = document.getElementById('notification-badge');
        renderNotificationList(notifications, listEl, badgeEl, 'No pending treatment follow-ups.');
    };

    const checkPreventativeCareReminders = () => {
        const reminders = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const getDayDiffFromLastDate = (lastDateStr, daysUntilDue) => {
            if (!lastDateStr) return null;
            const lastDate = new Date(`${lastDateStr}T00:00:00`);
            const dueDate = new Date(lastDate.getTime());
            dueDate.setDate(dueDate.getDate() + daysUntilDue);
            if (isNaN(dueDate.getTime())) return null;
            const timeDiff = dueDate.getTime() - today.getTime();
            return Math.ceil(timeDiff / (1000 * 3600 * 24));
        };

        allRecords.forEach(record => {
            const dewormingDayDiff = getDayDiffFromLastDate(record.lastDewormingDate, 30);
            if (dewormingDayDiff !== null && dewormingDayDiff <= 30) {
                let status = (dewormingDayDiff <= 5) ? 'Overdue' : 'Upcoming';
                let message = dewormingDayDiff < 0 ? `Deworming is overdue by ${-dewormingDayDiff} day(s).` :
                              dewormingDayDiff === 0 ? 'Deworming is due today.' : `Deworming due in ${dewormingDayDiff} day(s).`;
                reminders.push({ sheepId: record.sheepId, recordId: record.id, message, status });
            }

            let vaxDayDiff;
            if (record.manualVaccinationDueDate) {
                const dueDate = new Date(`${record.manualVaccinationDueDate}T00:00:00`);
                vaxDayDiff = !isNaN(dueDate.getTime()) ? Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 3600 * 24)) : null;
            } else {
                vaxDayDiff = getDayDiffFromLastDate(record.lastVaccinationDate, 365);
            }
            if (vaxDayDiff !== null && vaxDayDiff <= 30) {
                let status = (vaxDayDiff <= 5) ? 'Overdue' : 'Upcoming';
                let message = vaxDayDiff < 0 ? `Vaccination is overdue by ${-vaxDayDiff} day(s).` :
                              vaxDayDiff === 0 ? 'Vaccination is due today.' : `Vaccination due in ${vaxDayDiff} day(s).`;
                reminders.push({ sheepId: record.sheepId, recordId: record.id, message, status });
            }
        });

        const listEl = document.getElementById('schedule-notification-list');
        const badgeEl = document.getElementById('schedule-notification-badge');
        renderNotificationList(reminders, listEl, badgeEl, 'No upcoming preventative care.');
    };

    const viewRecordFromNotification = (recordId) => {
        const record = allRecords.find(r => r.id === recordId);
        if (!record) {
            return alert('Could not find the record. It may have been moved or deleted.');
        }
        openTreatmentLog(record.id, record.sheepId);
    };

    // --- Weekly Tracking View ---
    const updateWeeklyTrackingView = (filter = currentWeeklyFilter) => {
        currentWeeklyFilter = filter;
        document.querySelectorAll('#weeklyFilterButtons button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });

        const tableBody = document.getElementById('weeklyTableBody');
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        const recordsWithStatus = allRecords.map(record => {
            let lastActivityDate = new Date(`${record.dateRecorded}T00:00:00`);
            if (record.treatments) {
                Object.values(record.treatments).forEach(treatment => {
                    const treatmentDate = new Date(`${treatment.treatmentDate}T00:00:00`);
                    if (!isNaN(treatmentDate.getTime()) && treatmentDate > lastActivityDate) {
                        lastActivityDate = treatmentDate;
                    }
                });
            }
            const isChecked = lastActivityDate >= sevenDaysAgo;
            return { ...record, lastActivityDate, isChecked };
        });

        const filteredRecords = recordsWithStatus.filter(r => {
            if (filter === 'all') return true;
            if (filter === 'checked') return r.isChecked;
            if (filter === 'needs_check') return !r.isChecked;
            return false;
        }).sort((a, b) => a.sheepId.localeCompare(b.sheepId, undefined, { numeric: true }));

        tableBody.innerHTML = filteredRecords.length > 0 ?
            filteredRecords.map(renderWeeklyRow).join('') :
            `<tr><td colspan="5" class="text-center">No sheep match the filter criteria.</td></tr>`;
    };

    // --- Schedule View ---
    const updateScheduleView = (filter = currentScheduleFilter) => {
        currentScheduleFilter = filter;
        document.querySelectorAll('#scheduleFilterButtons button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });

        const tableBody = document.getElementById('scheduleTableBody');
        const sortedRecords = [...allRecords].sort((a, b) => a.sheepId.localeCompare(b.sheepId, undefined, { numeric: true }));

        const recordsToDisplay = sortedRecords.filter(record => {
            if (filter === 'all') return true;
            const dewormStatus = getScheduleStatus(record.lastDewormingDate, 30, null);
            const vaxStatus = getScheduleStatus(record.lastVaccinationDate, 365, record.manualVaccinationDueDate);
            if (filter === 'overdue') return dewormStatus.isOverdue || vaxStatus.isOverdue;
            if (filter === 'upcoming') return (dewormingStatus.isUpcoming && !dewormingStatus.isOverdue) || (vaxStatus.isUpcoming && !vaxStatus.isOverdue);
            return false;
        });

        tableBody.innerHTML = recordsToDisplay.length > 0 ?
            recordsToDisplay.map(renderScheduleRow).join('') :
            `<tr><td colspan="7" class="text-center">No sheep match the filter criteria.</td></tr>`;

        updateBatchLogUI();
    };

    const getScheduleStatus = (lastDateStr, daysUntilDue, manualDueDateStr) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let dueDate;
        if (manualDueDateStr) {
            dueDate = new Date(`${manualDueDateStr}T00:00:00`);
        } else if (lastDateStr) {
            const lastDate = new Date(`${lastDateStr}T00:00:00`);
            dueDate = new Date(lastDate.getTime());
            dueDate.setDate(dueDate.getDate() + daysUntilDue);
        } else {
            return { text: 'No Record', className: 'secondary', dayDiff: Infinity, isOverdue: false, isUpcoming: false };
        }

        if (isNaN(dueDate.getTime())) {
            return { text: 'Invalid Date', className: 'secondary', dayDiff: Infinity, isOverdue: false, isUpcoming: false };
        }

        const dayDiff = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 3600 * 24));

        let text, className, isOverdue = false, isUpcoming = false;

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
        } else {
            text = `Due ${formatDate(dueDate.toISOString().split('T')[0])}`;
            className = 'success';
        }

        return { text, className, dayDiff, isOverdue, isUpcoming };
    };

    const updateBatchLogUI = () => {
        const selected = document.querySelectorAll('#scheduleTableBody .sheep-select-checkbox:checked');
        document.getElementById('batchLogBtn').style.display = selected.length > 0 ? 'inline-block' : 'none';
        // Re-initialize tooltips for newly rendered rows
        const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        tooltipTriggerList.map(el => new bootstrap.Tooltip(el));
    };

    // --- Weight Tracking View ---
    const updateWeightTrackingView = () => {
        const selector = document.getElementById('weightSheepSelector');
        const currentSelection = selector.value;
        selector.innerHTML = '<option selected disabled value="">Select a sheep</option>';

        const sortedRecords = [...allRecords].sort((a, b) => a.sheepId.localeCompare(b.sheepId, undefined, { numeric: true }));

        sortedRecords.forEach(record => {
            const allWeightPoints = gatherAllWeightData(record);
            const latestWeight = allWeightPoints.length > 0 ? allWeightPoints[allWeightPoints.length - 1].weight : null;
            const option = document.createElement('option');
            option.value = record.id;
            option.textContent = `${record.sheepId}${latestWeight !== null ? ` (${latestWeight.toFixed(1)} kg)` : ''}`;
            selector.appendChild(option);
        });

        selector.value = currentSelection;

        if (currentSelection) {
            renderWeightChartForSheep(currentSelection);
        } else {
            document.getElementById('weightDisplayArea').style.display = 'none';
            const noDataMessage = document.getElementById('noWeightData');
            noDataMessage.style.display = 'block';
            noDataMessage.textContent = 'Select a sheep to view its chart.';
            document.getElementById('addWeightBtn').style.display = 'none';
            document.getElementById('latestWeightDisplay').style.display = 'none';
            if (weightChart) weightChart.destroy();
        }
    };

    const renderWeightChartForSheep = (recordId) => {
        const record = allRecords.find(r => r.id === recordId);
        const displayArea = document.getElementById('weightDisplayArea');
        const noDataMessage = document.getElementById('noWeightData');
        const addBtn = document.getElementById('addWeightBtn');
        const latestWeightDisplay = document.getElementById('latestWeightDisplay');
        const latestWeightValue = document.getElementById('latestWeightValue');

        if (!record) {
            noDataMessage.textContent = `Could not find record.`;
            noDataMessage.style.display = 'block';
            displayArea.style.display = 'none';
            addBtn.style.display = 'none';
            latestWeightDisplay.style.display = 'none';
            if (weightChart) weightChart.destroy();
            return;
        }

        const startDate = new Date(`${record.dateRecorded}T00:00:00`);
        if (isNaN(startDate.getTime())) {
            noDataMessage.textContent = `Invalid start date for Sheep ID ${record.sheepId}.`;
            noDataMessage.style.display = 'block';
            displayArea.style.display = 'none';
            addBtn.style.display = 'none';
            latestWeightDisplay.style.display = 'none';
            if (weightChart) weightChart.destroy();
            return;
        }

        addBtn.style.display = 'inline-block';
        const allWeightPoints = gatherAllWeightData(record);
        renderWeightDataTable(allWeightPoints, recordId, 'weightTableContainer');

        if (allWeightPoints.length > 0) {
            const latestWeight = allWeightPoints[allWeightPoints.length - 1].weight;
            latestWeightValue.textContent = `${latestWeight.toFixed(1)} kg`;
            latestWeightDisplay.style.display = 'inline-block';
        } else {
            latestWeightDisplay.style.display = 'none';
        }

        const chartPoints = allWeightPoints.map(dp => ({ x: (dp.date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 7), y: dp.weight }));

        if (chartPoints.length < 1) {
            noDataMessage.textContent = `No weight data for Sheep ID ${record.sheepId}.`;
            noDataMessage.style.display = 'block';
            displayArea.style.display = 'none';
            if (weightChart) weightChart.destroy();
            return;
        }

        noDataMessage.style.display = 'none';
        displayArea.style.display = 'block';

        const ctx = document.getElementById('weightChart').getContext('2d');
        if (weightChart) weightChart.destroy();

        calculateAndDisplayWeightStats(allWeightPoints, 'weightStatsBody');

        weightChart = new Chart(ctx, {
            type: 'line',
            data: { datasets: [{ label: `Weight (kg) for ${record.sheepId}`, data: chartPoints, borderColor: '#0d6efd', backgroundColor: 'rgba(13, 110, 253, 0.1)', fill: true, tension: 0.1, pointRadius: 5, pointHoverRadius: 7 }] },
            options: {
                responsive: true, maintainAspectRatio: false,
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
    };

    const gatherAllWeightData = (record) => {
        let points = [];
        if (record.weight) points.push({ id: 'initial', date: new Date(`${record.dateRecorded}T00:00:00`), weight: parseFloat(record.weight), source: 'initial' });
        if (record.weights) {
            Object.entries(record.weights).forEach(([key, value]) => {
                if (value.date && value.weight) points.push({ id: key, date: new Date(`${value.date}T00:00:00`), weight: parseFloat(value.weight), source: 'log' });
            });
        }
        if (record.treatments) {
            Object.entries(record.treatments).forEach(([key, value]) => {
                if (value.weight && value.treatmentDate) points.push({ id: key, date: new Date(`${value.treatmentDate}T00:00:00`), weight: parseFloat(value.weight), source: 'treatment' });
            });
        }
        return points.filter(p => p.date && !isNaN(p.date.getTime()) && p.weight && !isNaN(p.weight)).sort((a, b) => a.date - b.date);
    };

    const renderWeightDataTable = (weightPoints, recordId, containerId = 'weightTableContainer') => {
        const container = document.getElementById(containerId);
        if (weightPoints.length === 0) {
            container.innerHTML = '<p>No weight history recorded.</p>';
            return;
        }
        const isProfile = containerId.startsWith('profile');
        let tableHtml = `<table class="table table-sm table-striped"><thead><tr><th>Date</th><th>Weight (kg)</th><th>Source</th><th>Actions</th></tr></thead><tbody>`;
        weightPoints.forEach(p => {
            let sourceText = '', actions = '';
            switch (p.source) {
                case 'initial':
                    sourceText = '<span class="badge bg-primary">Initial Record</span>';
                    actions = isProfile ? '' : `<button class="btn btn-sm btn-outline-primary action-edit-weight" title="Edit Initial Weight"><i class="fas fa-edit"></i></button>`;
                    break;
                case 'log':
                    sourceText = '<span class="badge bg-info">Logged Entry</span>';
                    actions = isProfile ? '' : `<button class="btn btn-sm btn-outline-primary action-edit-weight" title="Edit Entry"><i class="fas fa-edit"></i></button> <button class="btn btn-sm btn-outline-danger action-delete-weight" title="Delete Entry"><i class="fas fa-trash"></i></button>`;
                    break;
                case 'treatment':
                    sourceText = '<span class="badge bg-secondary">From Treatment Log</span>';
                    actions = isProfile ? '' : `<button class="btn btn-sm btn-outline-danger action-delete-weight" title="This is legacy data. Deleting it will remove the weight from the associated treatment log."><i class="fas fa-trash"></i></button>`;
                    break;
            }
            tableHtml += `<tr data-record-id="${recordId}" data-entry-id="${p.id}" data-source="${p.source}"><td>${formatDate(p.date.toISOString().split('T')[0])}</td><td>${p.weight.toFixed(1)}</td><td>${sourceText}</td><td>${actions}</td></tr>`;
        });
        tableHtml += `</tbody></table>`;
        container.innerHTML = tableHtml;
    };

    const calculateAndDisplayWeightStats = (allWeightPoints, containerId = 'weightStatsBody') => {
        const container = document.getElementById(containerId);
        if (allWeightPoints.length < 2) {
            container.innerHTML = '<h5 class="card-title">Weight Statistics</h5><p class="card-text text-muted">Need at least two weight points to calculate statistics.</p>';
            return;
        }

        const firstPoint = allWeightPoints[0];
        const lastPoint = allWeightPoints[allWeightPoints.length - 1];
        const weightGain = lastPoint.weight - firstPoint.weight;
        const timeDiffDays = (lastPoint.date.getTime() - firstPoint.date.getTime()) / (1000 * 60 * 60 * 24);
        const adg = timeDiffDays > 0 ? (weightGain / timeDiffDays) * 1000 : 0;

        container.innerHTML = `
            <h5 class="card-title mb-3">Weight Statistics</h5>
            <div class="mb-3"><p class="mb-0 text-muted">Average Daily Gain (ADG)</p><h3 class="text-success">${adg.toFixed(0)} g/day</h3></div>
            <div class="mb-3"><p class="mb-0 text-muted">Net Weight Gain</p><h4>${weightGain.toFixed(1)} kg</h4><small>(${timeDiffDays.toFixed(0)} days)</small></div>
            <div class="row">
                <div class="col-6 border-end"><p class="mb-0 text-muted">Start Weight</p><h5>${firstPoint.weight.toFixed(1)} kg</h5></div>
                <div class="col-6"><p class="mb-0 text-muted">Latest Weight</p><h5>${lastPoint.weight.toFixed(1)} kg</h5></div>
            </div>`;
    };

    const calculateADG = (record) => {
        const allWeightPoints = gatherAllWeightData(record);
        if (allWeightPoints.length < 2) return null;
        const firstPoint = allWeightPoints[0];
        const lastPoint = allWeightPoints[allWeightPoints.length - 1];
        const weightGain = lastPoint.weight - firstPoint.weight;
        const timeDiffDays = (lastPoint.date.getTime() - firstPoint.date.getTime()) / (1000 * 60 * 60 * 24);
        return timeDiffDays > 0 ? (weightGain / timeDiffDays) * 1000 : null;
    };

    const updateGrowthAnalytics = () => {
        const fastestList = document.getElementById('fastestGrowersList');
        const slowestList = document.getElementById('slowestGrowersList');
        fastestList.innerHTML = '<li class="list-group-item text-muted">Calculating...</li>';
        slowestList.innerHTML = '<li class="list-group-item text-muted">Calculating...</li>';

        const sheepWithAdg = allRecords
            .map(record => ({ sheepId: record.sheepId, adg: calculateADG(record) }))
            .filter(item => item.adg !== null && !isNaN(item.adg));

        if (sheepWithAdg.length === 0) {
            const noDataHtml = '<li class="list-group-item text-muted">Not enough data for ADG calculation.</li>';
            fastestList.innerHTML = noDataHtml;
            slowestList.innerHTML = noDataHtml;
            return;
        }

        const sortedFastest = [...sheepWithAdg].sort((a, b) => b.adg - a.adg);
        fastestList.innerHTML = sortedFastest.slice(0, 5).map(s => `<li class="list-group-item d-flex justify-content-between align-items-center">${s.sheepId} <span class="badge bg-success rounded-pill">${s.adg.toFixed(0)} g/day</span></li>`).join('') || '<li class="list-group-item text-muted">No sheep with calculated growth.</li>';

        const sortedSlowest = [...sheepWithAdg].sort((a, b) => a.adg - b.adg);
        slowestList.innerHTML = sortedSlowest.map(s => `<li class="list-group-item d-flex justify-content-between align-items-center">${s.sheepId} <span class="badge ${s.adg < 0 ? 'bg-danger' : 'bg-warning text-dark'} rounded-pill">${s.adg.toFixed(0)} g/day</span></li>`).join('') || '<li class="list-group-item text-muted">No sheep with calculated growth.</li>';
    };

    // --- Profile View ---
    const updateProfileView = () => {
        const selector = document.getElementById('profileSheepSelector');
        const currentSelection = selector.value;
        selector.innerHTML = '<option selected disabled value="">Select a sheep to view profile</option>';

        const createOptGroup = (label, records) => {
            if (records.length === 0) return '';
            const sorted = [...records].sort((a, b) => a.sheepId.localeCompare(b.sheepId, undefined, { numeric: true }));
            const options = sorted.map(r => `<option value="${r.id}">${r.sheepId}</option>`).join('');
            return `<optgroup label="${label}">${options}</optgroup>`;
        };

        selector.innerHTML += createOptGroup('Active Sheep', allRecords);
        selector.innerHTML += createOptGroup('Sold Sheep', soldRecords);

        selector.value = currentSelection || "";

        if (!currentSelection) {
            document.getElementById('profileDisplayArea').style.display = 'none';
            document.getElementById('noProfileData').style.display = 'block';
            document.getElementById('profileEditBtn').style.display = 'none';
        }
        updateProfileNavButtons();
    };

    const renderProfileForSheep = (recordId) => {
        const displayArea = document.getElementById('profileDisplayArea');
        const noDataMessage = document.getElementById('noProfileData');
        const editBtn = document.getElementById('profileEditBtn');

        const record = [...allRecords, ...soldRecords].find(r => r.id === recordId);

        if (!record) {
            displayArea.style.display = 'none';
            noDataMessage.style.display = 'block';
            editBtn.style.display = 'none';
            noDataMessage.textContent = 'Could not find the selected sheep record.';
            return;
        }

        displayArea.style.display = 'block';
        noDataMessage.style.display = 'none';
        editBtn.style.display = allRecords.some(r => r.id === recordId) ? 'block' : 'none';

        // Core Info
        document.getElementById('profileSheepId').textContent = record.sheepId;
        document.getElementById('profileHealthStatus').innerHTML = `<span class="${getStatusClass(record.healthStatus)}">${record.healthStatus}</span>`;
        document.getElementById('profileDateRecorded').textContent = formatDate(record.dateRecorded);
        document.getElementById('profileInitialNotes').textContent = record.notes || 'N/A';

        // Sale Info
        const saleInfoCard = document.getElementById('profileSaleInfoCard');
        if (record.saleDate) {
            saleInfoCard.style.display = 'block';
            document.getElementById('profileSaleDate').textContent = formatDate(record.saleDate);
            document.getElementById('profileSalePrice').textContent = record.salePrice ? `$${record.salePrice}` : 'N/A';
            document.getElementById('profileSaleBuyer').textContent = record.saleBuyer || 'N/A';
            document.getElementById('profileSaleNotes').textContent = record.saleNotes || 'N/A';
        } else {
            saleInfoCard.style.display = 'none';
        }

        // Preventative Care
        const dewormingStatus = getScheduleStatus(record.lastDewormingDate, 30, null);
        const vaccinationStatus = getScheduleStatus(record.lastVaccinationDate, 365, record.manualVaccinationDueDate);
        document.getElementById('profileDewormingStatus').innerHTML = renderScheduleStatusBadge(dewormingStatus, record.lastDewormingDate);
        document.getElementById('profileDewormingNotes').textContent = record.lastDewormingNotes || 'N/A';
        document.getElementById('profileVaccinationStatus').innerHTML = renderScheduleStatusBadge(vaccinationStatus, record.lastVaccinationDate);
        document.getElementById('profileVaccinationNotes').textContent = record.lastVaccinationNotes || 'N/A';

        renderWeightProfile(record);
        renderTreatmentProfile(record);
        updateProfileNavButtons();
    };

    const renderWeightProfile = (record) => {
        const startDate = new Date(`${record.dateRecorded}T00:00:00`);
        if (isNaN(startDate.getTime())) {
            document.getElementById('profileWeightDisplayArea').innerHTML = '<div class="alert alert-warning">Cannot display weight chart due to invalid start date.</div>';
            return;
        }

        const allWeightPoints = gatherAllWeightData(record);
        renderWeightDataTable(allWeightPoints, record.id, 'profileWeightTableContainer');
        calculateAndDisplayWeightStats(allWeightPoints, 'profileWeightStatsBody');

        const chartPoints = allWeightPoints.map(dp => ({ x: (dp.date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 7), y: dp.weight }));

        if (chartPoints.length < 1) {
            document.getElementById('profileWeightChartContainer').innerHTML = '<div class="alert alert-info text-center h-100 d-flex align-items-center justify-content-center">No weight data to display.</div>';
            if (profileWeightChart) profileWeightChart.destroy();
            return;
        }

        const ctx = document.getElementById('profileWeightChart').getContext('2d');
        if (profileWeightChart) profileWeightChart.destroy();

        profileWeightChart = new Chart(ctx, {
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
    };

    const renderTreatmentProfile = (record) => {
        const tbody = document.getElementById('profileTreatmentHistoryTbody');
        const treatments = record.treatments ? Object.values(record.treatments).sort((a, b) => new Date(b.treatmentDate) - new Date(a.treatmentDate)) : [];

        if (treatments.length > 0) {
            tbody.innerHTML = treatments.map(entry => `
                <tr>
                    <td>${formatDate(entry.treatmentDate)}</td>
                    <td>${entry.treatmentType || 'General'}</td>
                    <td>${entry.symptoms || ''}</td>
                    <td>${entry.medication || ''}</td>
                    <td>${entry.dosage || ''}</td>
                    <td>${entry.treatmentNotes || ''}</td>
                </tr>`).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No treatment history recorded.</td></tr>';
        }
    };

    const updateProfileNavButtons = () => {
        const selector = document.getElementById('profileSheepSelector');
        const options = Array.from(selector.options).filter(opt => !opt.disabled && opt.style.display !== 'none');
        const currentIndex = options.findIndex(opt => opt.value === selector.value);
        document.getElementById('prevSheepBtn').disabled = currentIndex <= 0;
        document.getElementById('nextSheepBtn').disabled = currentIndex >= options.length - 1 || currentIndex === -1;
    };

    const navigateProfile = (direction) => {
        const selector = document.getElementById('profileSheepSelector');
        const options = Array.from(selector.options).filter(opt => !opt.disabled && opt.style.display !== 'none');
        const currentIndex = options.findIndex(opt => opt.value === selector.value);
        if (currentIndex === -1) return;
        const newIndex = currentIndex + direction;
        if (newIndex >= 0 && newIndex < options.length) {
            selector.value = options[newIndex].value;
            selector.dispatchEvent(new Event('change'));
        }
    };

    // --- Analytics ---
    const updateAnalytics = () => {
        const total = allRecords.length;
        const healthy = allRecords.filter(r => r.healthStatus === 'Healthy' || r.healthStatus === 'Recovering').length;
        const sick = allRecords.filter(r => r.healthStatus === 'Sick').length;
        const treatment = allRecords.filter(r => r.healthStatus === 'Under Treatment').length;

        document.getElementById('totalCount').textContent = total;
        document.getElementById('healthyCount').textContent = healthy;
        document.getElementById('sickCount').textContent = sick;
        document.getElementById('treatmentCount').textContent = treatment;

        renderAnalyticsChart(healthy, sick, treatment);
    };

    const renderAnalyticsChart = (healthy, sick, treatment) => {
        const ctx = document.getElementById('healthStatusChart').getContext('2d');
        if (healthStatusChart) healthStatusChart.destroy();

        healthStatusChart = new Chart(ctx, {
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
    };

    // --- Filtering and Searching ---
    const filterTableBySheepId = (searchInputId, tableBodyId) => {
        const searchTerm = document.getElementById(searchInputId).value.toLowerCase();
        const rows = document.getElementById(tableBodyId).querySelectorAll('tr');
        rows.forEach(row => {
            const sheepId = row.cells[0]?.textContent.toLowerCase() || '';
            row.style.display = sheepId.includes(searchTerm) ? '' : 'none';
        });
    };

    const filterProfileSelector = () => {
        const searchTerm = document.getElementById('profileSearchInput').value.toLowerCase();
        const selector = document.getElementById('profileSheepSelector');

        for (const option of selector.options) {
            if (option.disabled) continue;
            option.style.display = option.textContent.toLowerCase().includes(searchTerm) ? '' : 'none';
        }

        for (const group of selector.getElementsByTagName('optgroup')) {
            const allOptionsHidden = Array.from(group.options).every(opt => opt.style.display === 'none');
            group.style.display = allOptionsHidden ? 'none' : '';
        }
        updateProfileNavButtons();
    };

    // --- CSV Export ---
    const exportData = (type) => {
        let recordsToExport, filename;
        if (type === 'healthy') {
            recordsToExport = allRecords.filter(r => r.healthStatus === 'Healthy' || r.healthStatus === 'Recovering');
            filename = 'healthy_sheep_records.csv';
        } else { // treatment
            recordsToExport = allRecords.filter(r => r.healthStatus === 'Sick' || r.healthStatus === 'Under Treatment');
            filename = 'treatment_sheep_records.csv';
        }

        if (recordsToExport.length === 0) return alert(`No ${type} records to export.`);
        const csv = convertToCSV(recordsToExport);
        downloadCSV(csv, filename);
    };

    const exportSoldData = () => {
        if (soldRecords.length === 0) return alert('No sold records to export.');
        const csv = convertSoldToCSV(soldRecords);
        downloadCSV(csv, 'sold_sheep_records.csv');
    };

    const convertToCSV = (data) => {
        const headers = ['Sheep ID', 'Health Status', 'Date Recorded', 'Weight (kg)', 'Temperature (°C)', 'Notes'];
        const rows = data.map(r => [
            `"${r.sheepId || ''}"`, `"${r.healthStatus || ''}"`, `"${r.dateRecorded || ''}"`,
            `"${r.weight || ''}"`, `"${r.temperature || ''}"`, `"${(r.notes || '').replace(/"/g, '""')}"`
        ].join(','));
        return [headers.join(','), ...rows].join('\n');
    };

    const convertSoldToCSV = (data) => {
        const headers = ['Sheep ID', 'Health Status', 'Date Sold', 'Price', 'Buyer', 'Notes'];
        const rows = data.map(r => [
            `"${r.sheepId || ''}"`, `"${r.healthStatus || ''}"`, `"${r.saleDate || ''}"`,
            `"${r.salePrice || ''}"`, `"${r.saleBuyer || ''}"`, `"${(r.saleNotes || '').replace(/"/g, '""')}"`
        ].join(','));
        return [headers.join(','), ...rows].join('\n');
    };

    const downloadCSV = (csv, filename) => {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
});






























































































































































































































































































































































































































































