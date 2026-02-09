const lottoNumbersDiv = document.getElementById("lotto-numbers");
const generateButton = document.getElementById("generate-button");

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