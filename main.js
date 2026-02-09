const lottoNumbersDiv = document.getElementById("lotto-numbers");
const generateButton = document.getElementById("generate-button");
const themeToggleButton = document.getElementById("theme-toggle-button");

const commentInput = document.getElementById("comment-input");
const submitCommentButton = document.getElementById("submit-comment-button");
const commentsList = document.getElementById("comments-list");

// Function to set the theme
const setTheme = (isDarkMode) => {
  if (isDarkMode) {
    document.body.classList.add("dark-mode");
  } else {
    document.body.classList.remove("dark-mode");
  }
  localStorage.setItem("theme", isDarkMode ? "dark" : "light");
};

// Check for saved theme on page load
const savedTheme = localStorage.getItem("theme");
if (savedTheme === "dark") {
  setTheme(true);
} else {
  setTheme(false); // Default to light mode if no theme saved or saved as light
}

// Event listener for theme toggle button
themeToggleButton.addEventListener("click", () => {
  const isDarkMode = document.body.classList.contains("dark-mode");
  setTheme(!isDarkMode);
});

const generateLottoNumbers = () => {
  lottoNumbersDiv.innerHTML = "";
  const numbers = new Set();
  while (numbers.size < 6) {
    numbers.add(Math.floor(Math.random() * 45) + 1);
  }

  for (const number of [...numbers].sort((a, b) => a - b)) {
    const numberDiv = document.createElement("div");
    numberDiv.classList.add("lotto-number");
    numberDiv.textContent = number;
    lottoNumbersDiv.appendChild(numberDiv);
  }
};

generateButton.addEventListener("click", generateLottoNumbers);

generateLottoNumbers();

// Comments functionality
let comments = JSON.parse(localStorage.getItem("comments")) || [];

const saveComments = () => {
  localStorage.setItem("comments", JSON.stringify(comments));
};

const renderComments = () => {
  commentsList.innerHTML = "";
  comments.forEach((comment, index) => {
    const commentItem = document.createElement("div");
    commentItem.classList.add("comment-item");
    commentItem.innerHTML = `
      <span class="comment-text">${comment}</span>
      <button class="comment-delete-button" data-index="${index}">Delete</button>
    `;
    commentsList.appendChild(commentItem);
  });

  document.querySelectorAll(".comment-delete-button").forEach(button => {
    button.addEventListener("click", (event) => {
      const indexToDelete = parseInt(event.target.dataset.index);
      comments.splice(indexToDelete, 1);
      saveComments();
      renderComments();
    });
  });
};

submitCommentButton.addEventListener("click", () => {
  const newComment = commentInput.value.trim();
  if (newComment) {
    comments.push(newComment);
    commentInput.value = "";
    saveComments();
    renderComments();
  }
});

// Initial render of comments when the page loads
renderComments();