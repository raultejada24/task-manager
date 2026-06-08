const STORAGE_KEY = 'daymark.tasks.v1';

const taskList = document.querySelector('#task-list');
const taskForm = document.querySelector('#task-form');
const editorPanel = document.querySelector('#editor-panel');
const formHeading = document.querySelector('#form-heading');
const submitLabel = document.querySelector('#submit-label');
const editingTaskId = document.querySelector('#editing-task-id');
const titleInput = document.querySelector('#task-title');
const notesInput = document.querySelector('#task-notes');
const dateInput = document.querySelector('#task-date');
const searchInput = document.querySelector('#task-search');
const priorityFilter = document.querySelector('#priority-filter');
const filterButtons = document.querySelectorAll('.filter-button');
const cancelEditButton = document.querySelector('#cancel-edit');
const closeEditorButton = document.querySelector('#close-editor');
const mobileAddButton = document.querySelector('#mobile-add-button');
const clearCompletedButton = document.querySelector('#clear-completed');
const resultSummary = document.querySelector('#result-summary');
const progressRing = document.querySelector('#progress-ring');
const progressValue = document.querySelector('#progress-value');
const progressCopy = document.querySelector('#progress-copy');
const toast = document.querySelector('#toast');

let tasks = loadTasks();
let activeFilter = 'all';
let searchQuery = '';
let selectedPriority = 'all';
let toastTimer;

function dateToInputValue(date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function todayValue() {
  return dateToInputValue(new Date());
}

function dateWithOffset(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return dateToInputValue(date);
}

function createId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function seedTasks() {
  const now = new Date().toISOString();

  return [
    {
      id: createId(),
      title: 'Review weekly priorities',
      notes: 'Choose the three outcomes that matter most.',
      dueDate: todayValue(),
      priority: 'high',
      completed: false,
      createdAt: now,
    },
    {
      id: createId(),
      title: 'Reply to project feedback',
      notes: 'Collect the final notes before the next iteration.',
      dueDate: dateWithOffset(1),
      priority: 'medium',
      completed: false,
      createdAt: now,
    },
    {
      id: createId(),
      title: 'Plan the next learning sprint',
      notes: '',
      dueDate: dateWithOffset(3),
      priority: 'low',
      completed: false,
      createdAt: now,
    },
    {
      id: createId(),
      title: 'Organize reference links',
      notes: 'Keep the useful resources in one place.',
      dueDate: '',
      priority: 'low',
      completed: true,
      createdAt: now,
    },
  ];
}

function loadTasks() {
  try {
    const storedTasks = localStorage.getItem(STORAGE_KEY);

    if (storedTasks === null) {
      const initialTasks = seedTasks();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialTasks));
      return initialTasks;
    }

    const parsedTasks = JSON.parse(storedTasks);
    return Array.isArray(parsedTasks) ? parsedTasks : [];
  } catch {
    return seedTasks();
  }
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatDueDate(value) {
  if (!value) {
    return 'No due date';
  }

  if (value === todayValue()) {
    return 'Due today';
  }

  const tomorrow = dateWithOffset(1);
  if (value === tomorrow) {
    return 'Due tomorrow';
  }

  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  }).format(date);
}

function isOverdue(task) {
  return !task.completed && task.dueDate !== '' && task.dueDate < todayValue();
}

function isValidDateValue(value) {
  if (value === '') {
    return true;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function taskMatchesFilters(task) {
  const today = todayValue();
  const matchesSearch =
    task.title.toLowerCase().includes(searchQuery) ||
    task.notes.toLowerCase().includes(searchQuery);
  const matchesPriority =
    selectedPriority === 'all' || task.priority === selectedPriority;

  let matchesStatus = true;
  if (activeFilter === 'today') {
    matchesStatus = task.dueDate === today && !task.completed;
  } else if (activeFilter === 'upcoming') {
    matchesStatus = task.dueDate > today && !task.completed;
  } else if (activeFilter === 'completed') {
    matchesStatus = task.completed;
  }

  return matchesSearch && matchesPriority && matchesStatus;
}

function sortTasks(taskItems) {
  const priorityOrder = { high: 0, medium: 1, low: 2 };

  return [...taskItems].sort((first, second) => {
    if (first.completed !== second.completed) {
      return Number(first.completed) - Number(second.completed);
    }

    if (first.priority !== second.priority) {
      return priorityOrder[first.priority] - priorityOrder[second.priority];
    }

    if (first.dueDate === second.dueDate) {
      return new Date(first.createdAt) - new Date(second.createdAt);
    }

    if (first.dueDate === '') return 1;
    if (second.dueDate === '') return -1;
    return first.dueDate.localeCompare(second.dueDate);
  });
}

function groupTasks(taskItems) {
  const today = todayValue();
  const groups = {
    Overdue: [],
    Today: [],
    Upcoming: [],
    'No date': [],
    Completed: [],
  };

  taskItems.forEach((task) => {
    if (task.completed) {
      groups.Completed.push(task);
    } else if (task.dueDate === '') {
      groups['No date'].push(task);
    } else if (task.dueDate < today) {
      groups.Overdue.push(task);
    } else if (task.dueDate === today) {
      groups.Today.push(task);
    } else {
      groups.Upcoming.push(task);
    }
  });

  return groups;
}

function createTaskMarkup(task) {
  const overdueClass = isOverdue(task) ? 'is-overdue' : '';
  const completedClass = task.completed ? 'is-completed' : '';
  const notes = task.notes
    ? `<p class="task-notes">${escapeHtml(task.notes)}</p>`
    : '';

  return `
    <article class="task-card ${completedClass}" data-task-id="${task.id}">
      <label class="task-checkbox" aria-label="Mark ${escapeHtml(task.title)} as completed">
        <input type="checkbox" data-action="toggle" ${task.completed ? 'checked' : ''}>
        <span aria-hidden="true"></span>
      </label>
      <div class="task-content">
        <div class="task-title-row">
          <h3 class="task-title">${escapeHtml(task.title)}</h3>
          <span class="priority-badge priority-${task.priority}">${task.priority}</span>
        </div>
        ${notes}
        <div class="task-meta">
          <span class="task-due ${overdueClass}">${formatDueDate(task.dueDate)}</span>
        </div>
      </div>
      <div class="task-actions">
        <button type="button" data-action="edit">Edit</button>
        <button type="button" data-action="delete">Delete</button>
      </div>
    </article>
  `;
}

function renderTasks() {
  const visibleTasks = sortTasks(tasks.filter(taskMatchesFilters));
  const groups = groupTasks(visibleTasks);
  const groupMarkup = Object.entries(groups)
    .filter(([, groupTasks]) => groupTasks.length > 0)
    .map(
      ([groupName, groupTasks]) => `
        <section class="task-group">
          <h2 class="group-heading">${groupName} <span></span> ${groupTasks.length}</h2>
          ${groupTasks.map(createTaskMarkup).join('')}
        </section>
      `,
    )
    .join('');

  taskList.innerHTML =
    groupMarkup ||
    `
      <div class="empty-state">
        <div>
          <span>+</span>
          <h3>No tasks found</h3>
          <p>Adjust the filters or create a new task to get moving.</p>
        </div>
      </div>
    `;

  resultSummary.textContent = `${visibleTasks.length} ${
    visibleTasks.length === 1 ? 'task' : 'tasks'
  }`;

  updateCounts();
  updateProgress();
}

function updateCounts() {
  const today = todayValue();
  const counts = {
    all: tasks.length,
    today: tasks.filter((task) => task.dueDate === today && !task.completed).length,
    upcoming: tasks.filter((task) => task.dueDate > today && !task.completed).length,
    completed: tasks.filter((task) => task.completed).length,
  };

  Object.entries(counts).forEach(([name, count]) => {
    document.querySelector(`#count-${name}`).textContent = String(count);
  });

  clearCompletedButton.disabled = counts.completed === 0;
}

function updateProgress() {
  const completed = tasks.filter((task) => task.completed).length;
  const percentage = tasks.length === 0 ? 0 : Math.round((completed / tasks.length) * 100);

  progressRing.style.setProperty('--progress', `${percentage}%`);
  progressValue.textContent = `${percentage}%`;

  if (percentage === 0) {
    progressCopy.textContent = 'Start with one small task.';
  } else if (percentage < 50) {
    progressCopy.textContent = 'A good start. Keep the rhythm.';
  } else if (percentage < 100) {
    progressCopy.textContent = 'Strong progress. Stay focused.';
  } else {
    progressCopy.textContent = 'Everything is complete.';
  }
}

function resetForm() {
  taskForm.reset();
  dateInput.setCustomValidity('');
  editingTaskId.value = '';
  formHeading.textContent = 'Create a task';
  submitLabel.textContent = 'Add task';
  cancelEditButton.hidden = true;
  taskForm.querySelector('[value="medium"]').checked = true;
}

function openEditor() {
  editorPanel.classList.add('is-open');
  window.setTimeout(() => titleInput.focus(), 100);
}

function closeEditor() {
  editorPanel.classList.remove('is-open');
}

function startEditing(taskId) {
  const task = tasks.find((item) => item.id === taskId);
  if (!task) {
    return;
  }

  editingTaskId.value = task.id;
  titleInput.value = task.title;
  notesInput.value = task.notes;
  dateInput.value = task.dueDate;
  taskForm.querySelector(`[value="${task.priority}"]`).checked = true;
  formHeading.textContent = 'Edit task';
  submitLabel.textContent = 'Save changes';
  cancelEditButton.hidden = false;
  openEditor();
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add('is-visible');
  toastTimer = window.setTimeout(() => {
    toast.classList.remove('is-visible');
  }, 1800);
}

function saveTaskFromForm() {
  const title = titleInput.value.trim();
  const notes = notesInput.value.trim();
  const dueDate = dateInput.value;
  const priority = taskForm.querySelector('[name="priority"]:checked').value;
  const existingId = editingTaskId.value;

  if (existingId) {
    tasks = tasks.map((task) =>
      task.id === existingId
        ? { ...task, title, notes, dueDate, priority }
        : task,
    );
    showToast('Task updated');
  } else {
    tasks.push({
      id: createId(),
      title,
      notes,
      dueDate,
      priority,
      completed: false,
      createdAt: new Date().toISOString(),
    });
    showToast('Task added');
  }

  saveTasks();
  resetForm();
  closeEditor();
  renderTasks();
}

function handleTaskAction(taskId, action, checked = false) {
  if (action === 'toggle') {
    tasks = tasks.map((task) =>
      task.id === taskId ? { ...task, completed: checked } : task,
    );
    saveTasks();
    renderTasks();
    showToast(checked ? 'Task completed' : 'Task reopened');
    return;
  }

  if (action === 'edit') {
    startEditing(taskId);
    return;
  }

  if (action === 'delete') {
    tasks = tasks.filter((task) => task.id !== taskId);
    saveTasks();
    renderTasks();
    showToast('Task deleted');
  }
}

function updateCurrentDate() {
  const now = new Date();
  document.querySelector('#current-weekday').textContent = new Intl.DateTimeFormat(
    'en-US',
    { weekday: 'long' },
  ).format(now);
  document.querySelector('#current-day').textContent = String(now.getDate()).padStart(2, '0');
  document.querySelector('#current-month-year').textContent = new Intl.DateTimeFormat(
    'en-US',
    { month: 'long', year: 'numeric' },
  ).format(now);
}

taskForm.addEventListener('submit', (event) => {
  event.preventDefault();
  dateInput.setCustomValidity(
    isValidDateValue(dateInput.value) ? '' : 'Enter a valid date in YYYY-MM-DD format.',
  );

  if (!taskForm.reportValidity()) {
    return;
  }

  saveTaskFromForm();
});

dateInput.addEventListener('input', () => {
  dateInput.setCustomValidity('');
});

taskList.addEventListener('click', (event) => {
  const actionButton = event.target.closest('[data-action]');
  const taskCard = event.target.closest('[data-task-id]');

  if (!actionButton || !taskCard) {
    return;
  }

  handleTaskAction(
    taskCard.dataset.taskId,
    actionButton.dataset.action,
    actionButton.checked,
  );
});

filterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    activeFilter = button.dataset.filter;
    filterButtons.forEach((filterButton) => {
      filterButton.classList.toggle('is-active', filterButton === button);
    });
    renderTasks();
  });
});

searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value.trim().toLowerCase();
  renderTasks();
});

priorityFilter.addEventListener('change', () => {
  selectedPriority = priorityFilter.value;
  renderTasks();
});

cancelEditButton.addEventListener('click', () => {
  resetForm();
  closeEditor();
});
closeEditorButton.addEventListener('click', closeEditor);
mobileAddButton.addEventListener('click', () => {
  resetForm();
  openEditor();
});

clearCompletedButton.addEventListener('click', () => {
  const completedCount = tasks.filter((task) => task.completed).length;
  if (completedCount === 0) {
    return;
  }

  if (!window.confirm(`Delete ${completedCount} completed task(s)?`)) {
    return;
  }

  tasks = tasks.filter((task) => !task.completed);
  saveTasks();
  renderTasks();
  showToast('Completed tasks cleared');
});

document.addEventListener('keydown', (event) => {
  const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);

  if (event.key === '/' && !isTyping) {
    event.preventDefault();
    searchInput.focus();
  }

  if (event.key.toLowerCase() === 'n' && !isTyping) {
    event.preventDefault();
    resetForm();
    openEditor();
  }

  if (event.key === 'Escape') {
    closeEditor();
  }
});

updateCurrentDate();
resetForm();
renderTasks();
