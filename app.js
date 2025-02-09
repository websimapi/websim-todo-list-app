// Using ES modules and modern JavaScript
// Initialize the WebsimSocket instance to handle realtime database operations
const room = new WebsimSocket();

const todoInput = document.getElementById('todo-input');
const addTodoBtn = document.getElementById('add-todo-btn');
const todoList = document.getElementById('todo-list');
const listLabelInput = document.getElementById('list-label');
const uploadListBtn = document.getElementById('upload-list-btn');
const encodeDataCheckbox = document.getElementById('encode-data');

let todos = [];

// Helper function to create an HTML element with classes and attributes
function createElement(type, options = {}) {
  const el = document.createElement(type);
  if (options.classes) {
    options.classes.forEach(cls => el.classList.add(cls));
  }
  if (options.attributes) {
    Object.keys(options.attributes).forEach(attr => {
      el.setAttribute(attr, options.attributes[attr]);
    });
  }
  if (options.text) {
    el.textContent = options.text;
  }
  return el;
}

// Render the todo list
function renderTodos() {
  todoList.innerHTML = "";
  todos.forEach((todo, index) => {
    const li = createElement('li', { classes: ['todo-item'] });
    if (todo.completed) li.classList.add('todo-completed');

    const span = createElement('span', { classes: ['todo-text'], text: todo.text });
    li.appendChild(span);

    const actionsDiv = createElement('div', { classes: ['todo-actions'] });
    
    // Complete button
    const completeBtn = createElement('button', { classes: ['btn', 'complete'] });
    completeBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="18" height="18">
        <polyline points="20 6 9 17 4 12" fill="none" stroke="currentColor" stroke-width="2"/>
      </svg>
    `;
    completeBtn.addEventListener('click', () => toggleComplete(index));
    actionsDiv.appendChild(completeBtn);

    // Delete button
    const deleteBtn = createElement('button', { classes: ['btn', 'delete'] });
    deleteBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="18" height="18">
        <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2"/>
        <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2"/>
      </svg>
    `;
    deleteBtn.addEventListener('click', () => deleteTodo(index));
    actionsDiv.appendChild(deleteBtn);

    li.appendChild(actionsDiv);
    todoList.appendChild(li);
  });
}

// Add todo item and locally update list
async function addTodo() {
  const text = todoInput.value.trim();
  if (text === "") return;
  const newTodo = { text, completed: false };

  // Add to local list and render immediately
  todos.push(newTodo);
  renderTodos();
  todoInput.value = "";
}

// Toggle todo completion and update the local list
function toggleComplete(index) {
  todos[index].completed = !todos[index].completed;
  renderTodos();
  // Optionally, you could persist the update here with:
  // room.collection('todo').update(todoId, { completed: todos[index].completed });
}

// Delete todo item and update the local list
function deleteTodo(index) {
  todos.splice(index, 1);
  renderTodos();
  // Optionally, you could persist the deletion here with:
  // room.collection('todo').delete(todoId);
}

// Utility function to encode data (using Base64 encoding optionally concatenated with password)
function encodeData(data, password = "") {
  // Convert object to JSON string then encode with Base64
  const jsonString = JSON.stringify(data);
  // If password is provided, mix it in with the encoded data
  const base64Data = btoa(jsonString);
  return password ? btoa(password + ":" + base64Data) : base64Data;
}

// Upload the entire todo list with a custom label as one record
async function uploadTodoList() {
  const label = listLabelInput.value.trim();
  if (label === "") {
    alert("Please enter a label for your todo list.");
    return;
  }
  if (todos.length === 0) {
    alert("Your todo list is empty. Add some tasks first!");
    return;
  }

  // Create payload
  const payload = {
    label,
    todos,
    created_at: new Date().toISOString()
  };

  let finalPayload = payload;

  // If encode mode is enabled, prompt for a password/pin and encode the entire payload
  if (encodeDataCheckbox.checked) {
    const password = prompt("Enter a password or PIN to encode your data:");
    if (password === null || password.trim() === "") {
      alert("Password/PIN is required for encoding.");
      return;
    }
    finalPayload = { encodedData: encodeData(payload, password.trim()) };
  }

  try {
    await room.collection('todoList').create(finalPayload);
    alert("Todo list uploaded successfully!");
    // Optionally, clear the list or label here
    todos = [];
    renderTodos();
    listLabelInput.value = "";
  } catch (error) {
    console.error('Error uploading todo list:', error);
    alert("Failed to upload the todo list. Please try again.");
  }
}

// Event listeners
addTodoBtn.addEventListener('click', addTodo);
todoInput.addEventListener('keyup', (e) => {
  if (e.key === 'Enter') addTodo();
});
uploadListBtn.addEventListener('click', uploadTodoList);

// Initial render
renderTodos();