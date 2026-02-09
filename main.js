const lottoNumbersDiv = document.getElementById("lotto-numbers");
const generateButton = document.getElementById("generate-button");
const themeToggleButton = document.getElementById("theme-toggle-button"); // 새로 추가

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