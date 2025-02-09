// Using ES modules and modern JavaScript
// Initialize the WebsimSocket instance to handle realtime database operations
const room = new WebsimSocket();

const todoInput = document.getElementById('todo-input');
const addTodoBtn = document.getElementById('add-todo-btn');
const todoList = document.getElementById('todo-list');
const listLabelInput = document.getElementById('list-label');
const uploadListBtn = document.getElementById('upload-list-btn');
const encodeDataCheckbox = document.getElementById('encode-data');
const messageArea = document.getElementById('message');
const shareUrlContainer = document.getElementById('share-url');

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

// Function to show messages in the UI (info or error)
function showMessage(msg, type = "info") {
  messageArea.textContent = msg;
  messageArea.className = "message-area " + type;
  messageArea.style.display = "block";
  // Automatically hide message after 4 seconds
  setTimeout(() => {
    messageArea.style.display = "none";
  }, 4000);
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
  if (text === "") {
    showMessage("Please enter a task.", "error");
    return;
  }
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
}

// Delete todo item and update the local list
function deleteTodo(index) {
  todos.splice(index, 1);
  renderTodos();
}

// Utility function to encode data (using Base64 encoding optionally concatenated with password)
function encodeData(data, password = "") {
  const jsonString = JSON.stringify(data);
  const base64Data = btoa(jsonString);
  return password ? btoa(password + ":" + base64Data) : base64Data;
}

// Utility function to decode data that was encoded using encodeData
function decodeData(encodedStr, password = "") {
  try {
    let decodedStr = atob(encodedStr);
    if (password) {
      const prefix = password + ":";
      if (decodedStr.startsWith(prefix)) {
        decodedStr = decodedStr.substring(prefix.length);
      } else {
        showMessage("Incorrect password!", "error");
        throw new Error("Incorrect password");
      }
    }
    return JSON.parse(atob(decodedStr));
  } catch (error) {
    console.error("Error decoding data:", error);
    showMessage("Error decoding data.", "error");
    throw error;
  }
}

// Copy the provided text to clipboard and show confirmation
function copyToClipboard(text) {
  navigator.clipboard.writeText(text)
    .then(() => {
      showMessage("URL copied to clipboard!", "info");
    })
    .catch((error) => {
      console.error("Failed to copy URL:", error);
      showMessage("Failed to copy URL.", "error");
    });
}

// Upload the entire todo list with a custom label as one record
async function uploadTodoList() {
  const label = listLabelInput.value.trim();
  if (label === "") {
    showMessage("Please enter a label for your todo list.", "error");
    return;
  }
  if (todos.length === 0) {
    showMessage("Your todo list is empty. Add some tasks first!", "error");
    return;
  }

  const payload = {
    label,
    todos,
    created_at: new Date().toISOString()
  };

  let finalPayload = payload;

  if (encodeDataCheckbox.checked) {
    const password = prompt("Enter a password or PIN to encode your data:");
    if (password === null || password.trim() === "") {
      showMessage("Password/PIN is required for encoding.", "error");
      return;
    }
    finalPayload = { encodedData: encodeData(payload, password.trim()) };
  }

  try {
    const createdRecord = await room.collection('todoList').create(finalPayload);
    showMessage("Todo list uploaded successfully!", "info");
    
    // Construct the sharing URL using the provided base URL and query string
    const shareUrl = `https://websim.ai/@api/todo-list-app/?list=${createdRecord.id}`;
    shareUrlContainer.textContent = shareUrl;
    shareUrlContainer.style.display = "block";
    
    // Add click event to copy the URL to clipboard
    shareUrlContainer.onclick = () => copyToClipboard(shareUrl);

    // Optionally clear the list or label after upload
    todos = [];
    renderTodos();
    listLabelInput.value = "";
  } catch (error) {
    console.error('Error uploading todo list:', error);
    showMessage("Failed to upload the todo list. Please try again.", "error");
  }
}

// Utility function to wait for the room to be connected
function waitForRoomConnection() {
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      // Check if the underlying WebSocket exists and is open
      if (room.socket && room.socket.readyState === WebSocket.OPEN) {
        clearInterval(interval);
        resolve();
      }
    }, 100);
  });
}

// Check for query parameter ?list=ID and load that todo list from the database
async function loadTodoListFromQuery() {
  await waitForRoomConnection();

  const params = new URLSearchParams(window.location.search);
  const listId = params.get('list');
  if (!listId) return;

  try {
    let record;
    if (room.collection('todoList').get) {
      record = await room.collection('todoList').get(listId);
    } else {
      const records = room.collection('todoList').getList();
      record = records.find(r => r.id === listId);
    }

    if (!record) {
      showMessage("Todo list not found.", "error");
      return;
    }
    
    // If the record indicates it is encoded, prompt for a password.
    if (record.encodedData) {
      const password = prompt("This todo list is password protected. Please enter the password or PIN:");
      if (password === null || password.trim() === "") {
        showMessage("Password/PIN is required to decode the data.", "error");
        return;
      }
      try {
        const decoded = decodeData(record.encodedData, password.trim());
        listLabelInput.value = decoded.label || "";
        todos = decoded.todos || [];
        showMessage("Todo list decoded and loaded.", "info");
      } catch (error) {
        // Error message already shown in decodeData helper
        return;
      }
    } else {
      listLabelInput.value = record.label || "";
      todos = record.todos || [];
      showMessage("Todo list loaded.", "info");
    }
    renderTodos();
  } catch (error) {
    console.error("Error loading todo list from database:", error);
    showMessage("Failed to load the specified todo list.", "error");
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

// Wait for DOM content and database connection, then check for query string ?list=ID
document.addEventListener('DOMContentLoaded', loadTodoListFromQuery);