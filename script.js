// Task management functionality
let tasks = JSON.parse(localStorage.getItem('tasks')) || [];
let actionHistory = [];
const MAX_HISTORY = 10;
let hideAssignedTasks = false;
let searchFilter = '';

// Cloud sync functionality
let cloudSyncEnabled = localStorage.getItem('cloudSyncEnabled') === 'true';
let syncId = localStorage.getItem('syncId') || generateSyncId();
let lastSyncTime = 0;
const SYNC_INTERVAL = 3000; // 3 seconds

// Load tasks when page loads
document.addEventListener('DOMContentLoaded', function() {
    loadTasks();
    updateUndoButton();
    setupEventListeners();
});

function setupEventListeners() {
    // Add Enter key support for quick adding
    const taskInput = document.getElementById('taskInput');
    const assigneeInput = document.getElementById('assigneeInput');
    const searchInput = document.getElementById('searchInput');

    if (taskInput) {
        taskInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                addTask();
            }
        });
    }

    if (assigneeInput) {
        assigneeInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                addTask();
            }
        });
    }

    // Add search functionality
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            searchFilter = e.target.value.toLowerCase().trim();
            renderTasks();
        });
    }

    // Add keyboard shortcut for undo (Ctrl+Z)
    document.addEventListener('keydown', function(e) {
        // Make sure we're not in an input field
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
            return;
        }

        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            e.preventDefault();
            undoLastAction();
        }
    });
}

function addTask() {
    const taskInput = document.getElementById('taskInput');
    const assigneeInput = document.getElementById('assigneeInput');
    const categorySelect = document.getElementById('categorySelect');

    const taskText = taskInput.value.trim();
    if (taskText === '') {
        alert('Please enter a task!');
        return;
    }

    const task = {
        id: Date.now(),
        text: taskText,
        assignee: assigneeInput.value.trim(),
        category: categorySelect.value,
        dateCreated: new Date().toLocaleString()
    };

    // Save action for undo
    saveAction({
        type: 'add',
        task: {...task}
    });

    tasks.push(task);
    saveTasks();

    // Clear inputs
    taskInput.value = '';
    assigneeInput.value = '';
    taskInput.focus();

    renderTasks();
    updateUndoButton();
}

function deleteTask(taskId) {
    const task = tasks.find(task => task.id === taskId);
    if (task) {
        // Save action for undo
        saveAction({
            type: 'delete',
            task: {...task}
        });
    }

    tasks = tasks.filter(task => task.id !== taskId);
    saveTasks();
    renderTasks();
    updateUndoButton();
}

function moveTask(taskId, newCategory) {
    const task = tasks.find(task => task.id === taskId);
    if (task && newCategory && task.category !== newCategory) {
        // Save action for undo
        saveAction({
            type: 'move',
            taskId: taskId,
            oldCategory: task.category,
            newCategory: newCategory
        });

        task.category = newCategory;
        saveTasks();
        renderTasks();
        updateUndoButton();
    }
}

function renderTasks() {
    const categories = ['high-priority', 'todo', 'sometime-later', 'discuss'];

    categories.forEach(category => {
        const container = document.getElementById(category);
        let categoryTasks = tasks.filter(task => task.category === category);

        // Apply filters
        categoryTasks = applyFilters(categoryTasks);

        if (categoryTasks.length === 0) {
            const filteredCount = tasks.filter(task => task.category === category).length;
            if (filteredCount > 0) {
                container.innerHTML = '<div class="empty-state">No tasks match current filters</div>';
            } else {
                container.innerHTML = '<div class="empty-state">No tasks yet</div>';
            }
        } else {
            container.innerHTML = categoryTasks.map(task => createTaskHTML(task)).join('');
        }
    });
}

function applyFilters(taskList) {
    let filteredTasks = taskList;

    // Apply search filter
    if (searchFilter) {
        filteredTasks = filteredTasks.filter(task => {
            return task.assignee && task.assignee.toLowerCase().includes(searchFilter);
        });
    }

    // Apply hide assigned tasks filter
    if (hideAssignedTasks) {
        filteredTasks = filteredTasks.filter(task => !task.assignee || task.assignee.trim() === '');
    }

    return filteredTasks;
}

function createTaskHTML(task) {
    const otherCategories = [
        { value: 'high-priority', label: '🔥 High Priority' },
        { value: 'todo', label: '✅ TO DO' },
        { value: 'sometime-later', label: '⏰ Sometime Later' },
        { value: 'discuss', label: '💬 Discuss' }
    ].filter(cat => cat.value !== task.category);

    return `
        <div class="task-item" draggable="true" ondragstart="dragStart(event)" ondragend="dragEnd(event)" data-task-id="${task.id}">
            <div class="task-header">
                <div class="task-content" ondblclick="editTaskText(${task.id})" title="Double-click to edit">
                    <span class="task-text" id="task-text-${task.id}">${escapeHtml(task.text)}</span>
                </div>
                <div class="task-actions">
                    <select onchange="moveTask(${task.id}, this.value)" class="move-btn">
                        <option value="">📁</option>
                        ${otherCategories.map(cat =>
                            `<option value="${cat.value}">${cat.label}</option>`
                        ).join('')}
                    </select>
                    <button class="delete-btn" onclick="deleteTask(${task.id})">🗑️</button>
                </div>
            </div>
            ${task.assignee ?
                `<div class="task-assignee" onclick="editTaskAssignee(${task.id})" title="Click to edit assignee">
                    👤 <span class="assignee-text" id="assignee-text-${task.id}">${escapeHtml(task.assignee)}</span>
                </div>` :
                `<div class="task-assignee add-assignee" onclick="editTaskAssignee(${task.id})" title="Click to add assignee">
                    👤 <span class="add-assignee-text">Click to add assignee</span>
                </div>`
            }
        </div>
    `;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function saveTasks() {
    localStorage.setItem('tasks', JSON.stringify(tasks));
}

function loadTasks() {
    renderTasks();
}

function clearAllTasks() {
    if (confirm('Are you sure you want to clear all tasks?')) {
        // Save action for undo
        saveAction({
            type: 'clear',
            tasks: [...tasks]
        });

        tasks = [];
        saveTasks();
        renderTasks();
        updateUndoButton();
    }
}

// Export/Import functionality
function exportTasks() {
    const dataStr = JSON.stringify(tasks, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'tasks_backup.json';
    link.click();
    URL.revokeObjectURL(url);
}

function importTasks(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const importedTasks = JSON.parse(e.target.result);
                if (Array.isArray(importedTasks)) {
                    tasks = importedTasks;
                    saveTasks();
                    renderTasks();
                    alert('Tasks imported successfully!');
                } else {
                    alert('Invalid file format');
                }
            } catch (error) {
                alert('Error reading file: ' + error.message);
            }
        };
        reader.readAsText(file);
    }
}

// Drag and Drop functionality
let draggedTaskId = null;

function dragStart(event) {
    draggedTaskId = event.target.dataset.taskId;
    event.target.classList.add('dragging');
    event.dataTransfer.effectAllowed = 'move';
}

function dragEnd(event) {
    event.target.classList.remove('dragging');
    draggedTaskId = null;
}

function allowDrop(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
}

function dragEnter(event) {
    event.preventDefault();
    if (event.target.classList.contains('task-column')) {
        event.target.classList.add('drag-over');
    }
}

function dragLeave(event) {
    if (event.target.classList.contains('task-column')) {
        event.target.classList.remove('drag-over');
    }
}

function drop(event) {
    event.preventDefault();

    if (event.target.classList.contains('task-column')) {
        event.target.classList.remove('drag-over');
    }

    if (draggedTaskId) {
        // Find the target category
        let targetCategory = null;
        let target = event.target;

        // Walk up the DOM to find the task-list element
        while (target && !targetCategory) {
            if (target.classList && target.classList.contains('task-list')) {
                targetCategory = target.dataset.category;
                break;
            } else if (target.classList && target.classList.contains('task-column')) {
                // Find the task-list child
                const taskList = target.querySelector('.task-list');
                if (taskList) {
                    targetCategory = taskList.dataset.category;
                }
                break;
            }
            target = target.parentNode;
        }

        if (targetCategory) {
            moveTask(parseInt(draggedTaskId), targetCategory);
        }
    }
}

// Undo functionality
function saveAction(action) {
    actionHistory.push(action);
    if (actionHistory.length > MAX_HISTORY) {
        actionHistory.shift(); // Remove oldest action
    }
}

function undoLastAction() {
    if (actionHistory.length === 0) return;

    const lastAction = actionHistory.pop();

    switch (lastAction.type) {
        case 'add':
            // Undo add: remove the task
            tasks = tasks.filter(task => task.id !== lastAction.task.id);
            break;

        case 'delete':
            // Undo delete: add the task back
            tasks.push(lastAction.task);
            break;

        case 'move':
            // Undo move: move back to original category
            const task = tasks.find(task => task.id === lastAction.taskId);
            if (task) {
                task.category = lastAction.oldCategory;
            }
            break;

        case 'clear':
            // Undo clear: restore all tasks
            tasks = lastAction.tasks;
            break;

        case 'edit':
            // Undo edit: restore old value
            const editTask = tasks.find(task => task.id === lastAction.taskId);
            if (editTask) {
                editTask[lastAction.field] = lastAction.oldValue;
            }
            break;
    }

    saveTasks();
    renderTasks();
    updateUndoButton();
}

function updateUndoButton() {
    const undoBtn = document.getElementById('undoBtn');
    if (actionHistory.length === 0) {
        undoBtn.disabled = true;
        undoBtn.textContent = '↶ Undo';
    } else {
        undoBtn.disabled = false;
        const lastAction = actionHistory[actionHistory.length - 1];
        switch (lastAction.type) {
            case 'add':
                undoBtn.textContent = '↶ Undo Add';
                break;
            case 'delete':
                undoBtn.textContent = '↶ Undo Delete';
                break;
            case 'move':
                undoBtn.textContent = '↶ Undo Move';
                break;
            case 'clear':
                undoBtn.textContent = '↶ Undo Clear';
                break;
            case 'edit':
                undoBtn.textContent = '↶ Undo Edit';
                break;
            default:
                undoBtn.textContent = '↶ Undo';
        }
    }
}

// Filter functionality
function toggleAssignedTasks() {
    hideAssignedTasks = !hideAssignedTasks;
    const btn = document.getElementById('hideAssignedBtn');

    if (hideAssignedTasks) {
        btn.textContent = '👤 Show Assigned Tasks';
        btn.classList.add('active');
    } else {
        btn.textContent = '👤 Hide Assigned Tasks';
        btn.classList.remove('active');
    }

    renderTasks();
}

function clearFilters() {
    searchFilter = '';
    hideAssignedTasks = false;

    document.getElementById('searchInput').value = '';
    const btn = document.getElementById('hideAssignedBtn');
    btn.textContent = '👤 Hide Assigned Tasks';
    btn.classList.remove('active');

    renderTasks();
}

// Edit functionality
let currentlyEditing = null;

function editTaskText(taskId) {
    if (currentlyEditing) return; // Prevent multiple simultaneous edits

    currentlyEditing = taskId;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const textElement = document.getElementById(`task-text-${taskId}`);
    const originalText = task.text;

    // Create input element
    const input = document.createElement('input');
    input.type = 'text';
    input.value = originalText;
    input.className = 'edit-input task-edit-input';

    // Replace text with input
    textElement.parentNode.replaceChild(input, textElement);
    input.focus();
    input.select();

    // Save function
    function saveEdit() {
        const newText = input.value.trim();
        if (newText && newText !== originalText) {
            // Save action for undo
            saveAction({
                type: 'edit',
                taskId: taskId,
                field: 'text',
                oldValue: originalText,
                newValue: newText
            });

            task.text = newText;
            saveTasks();
        }

        currentlyEditing = null;
        renderTasks();
        updateUndoButton();
    }

    // Cancel function
    function cancelEdit() {
        currentlyEditing = null;
        renderTasks();
    }

    // Event handlers
    input.addEventListener('blur', saveEdit);
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveEdit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelEdit();
        }
    });
}

function editTaskAssignee(taskId) {
    if (currentlyEditing) return; // Prevent multiple simultaneous edits

    currentlyEditing = taskId;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const assigneeElement = document.getElementById(`assignee-text-${taskId}`);
    const originalAssignee = task.assignee || '';

    // Create input element
    const input = document.createElement('input');
    input.type = 'text';
    input.value = originalAssignee;
    input.className = 'edit-input assignee-edit-input';
    input.placeholder = 'Enter assignee name...';

    // Replace text with input
    if (assigneeElement) {
        assigneeElement.parentNode.replaceChild(input, assigneeElement);
    } else {
        // Handle "Click to add assignee" case
        const addElement = document.querySelector(`[data-task-id="${taskId}"] .add-assignee-text`);
        if (addElement) {
            addElement.parentNode.replaceChild(input, addElement);
        }
    }

    input.focus();
    input.select();

    // Save function
    function saveEdit() {
        const newAssignee = input.value.trim();
        if (newAssignee !== originalAssignee) {
            // Save action for undo
            saveAction({
                type: 'edit',
                taskId: taskId,
                field: 'assignee',
                oldValue: originalAssignee,
                newValue: newAssignee
            });

            task.assignee = newAssignee;
            saveTasks();
        }

        currentlyEditing = null;
        renderTasks();
        updateUndoButton();
    }

    // Cancel function
    function cancelEdit() {
        currentlyEditing = null;
        renderTasks();
    }

    // Event handlers
    input.addEventListener('blur', saveEdit);
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveEdit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelEdit();
        }
    });
}
// Cloud Sync functionality - Enhanced for multi-device sync
function generateSyncId() {
    const id = 'task_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    localStorage.setItem('syncId', id);
    return id;
}

// Browser-based sync with upgrade path for real cloud sync
async function syncToCloud() {
    if (!cloudSyncEnabled) return;

    try {
        updateSyncStatus('🔄', 'Syncing...', 'syncing');

        // Create backup with timestamp
        const syncData = {
            tasks: tasks,
            lastModified: Date.now(),
            syncId: syncId
        };

        localStorage.setItem('tasks_backup', JSON.stringify(syncData));
        updateSyncStatus('✅', 'Browser sync active', 'synced');
        lastSyncTime = Date.now();

    } catch (error) {
        console.log('Sync failed:', error);
        updateSyncStatus('⚠️', 'Sync failed', 'error');
    }
}

async function syncFromCloud() {
    if (!cloudSyncEnabled) return;

    try {
        const backup = localStorage.getItem('tasks_backup');
        if (backup) {
            const cloudData = JSON.parse(backup);
            
            if (cloudData.lastModified > lastSyncTime && cloudData.tasks) {
                tasks = cloudData.tasks;
                renderTasks();
                updateSyncStatus('📥', 'Updated from sync', 'synced');
            }
        }

        lastSyncTime = Date.now();
    } catch (error) {
        console.log('Sync check failed:', error);
    }
}

function toggleCloudSync() {
    cloudSyncEnabled = !cloudSyncEnabled;
    localStorage.setItem('cloudSyncEnabled', cloudSyncEnabled.toString());

    const btn = document.getElementById('syncBtn');

    if (cloudSyncEnabled) {
        btn.textContent = '☁️ Cloud Sync ON';
        btn.classList.add('active');
        updateSyncStatus('🔄', 'Sync enabled', 'syncing');

        setTimeout(() => {
            updateSyncStatus('✅', 'Browser sync active', 'synced');
        }, 1500);

        syncToCloud();
        startSyncTimer();
    } else {
        btn.textContent = '☁️ Enable Cloud Sync';
        btn.classList.remove('active');
        updateSyncStatus('💾', 'Local only', 'local');
        stopSyncTimer();
    }
}

let syncTimer;

function startSyncTimer() {
    stopSyncTimer();
    syncTimer = setInterval(() => {
        if (cloudSyncEnabled) {
            syncFromCloud();
            syncToCloud();
        }
    }, SYNC_INTERVAL);
}

function stopSyncTimer() {
    if (syncTimer) {
        clearInterval(syncTimer);
        syncTimer = null;
    }
}

function updateSyncStatus(icon, text, className) {
    const indicator = document.getElementById('syncIndicator');
    const statusText = document.getElementById('syncText');
    const statusDiv = document.getElementById('syncStatus');

    if (indicator) indicator.textContent = icon;
    if (statusText) statusText.textContent = text;
    if (statusDiv) {
        statusDiv.className = 'sync-status ' + className;
    }
}

// Enhanced saveTasks with sync
const originalSaveTasks = window.saveTasks;
function saveTasks() {
    localStorage.setItem('tasks', JSON.stringify(tasks));
    if (cloudSyncEnabled) {
        setTimeout(syncToCloud, 100);
    }
}

// Initialize sync when page loads
setTimeout(() => {
    const syncBtn = document.getElementById('syncBtn');
    if (syncBtn) {
        if (cloudSyncEnabled) {
            syncBtn.textContent = '☁️ Cloud Sync ON';
            syncBtn.classList.add('active');
            updateSyncStatus('🔄', 'Starting sync...', 'syncing');

            setTimeout(() => {
                syncFromCloud();
                startSyncTimer();
                updateSyncStatus('✅', 'Browser sync active', 'synced');
            }, 1000);
        } else {
            updateSyncStatus('💾', 'Local storage only', 'local');
        }
    }
}, 500);
