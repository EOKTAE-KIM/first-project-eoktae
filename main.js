const themeToggleButton = document.getElementById("theme-toggle-button");

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