const themeToggleButton = document.getElementById("theme-toggle-button");
const medalStandingsDiv = document.getElementById("medal-standings");
const eventScheduleDiv = document.getElementById("event-schedule");
const loadingSpinner = document.getElementById("loading-spinner");

// Country name to ISO 3166-1 alpha-2 code mapping
const countryCodeMap = {
  "대한민국": "kr",
  "독일": "de",
  "프랑스": "fr",
  "영국": "gb", // United Kingdom
  "스웨덴": "se",
  "이탈리아": "it",
  "미국": "us",
  "일본": "jp",
  "캐나다": "ca",
  "체코": "cz",
  "스위스": "ch"
};

function getFlagIcon(countryName) {
  const code = countryCodeMap[countryName.trim()];
  return code ? `<span class="fi fi-${code}"></span>` : countryName;
}

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

// Function to load data from local JSON file
async function loadOlympicsData() {
  loadingSpinner.style.display = "block";
  try {
    const response = await fetch("./olympics_data.json");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error loading olympics data:", error);
    return { medals: [], schedule: [] }; // Return empty data on error
  } finally {
    loadingSpinner.style.display = "none";
  }
}

// Render Medal Standings
function renderMedalStandings(medals) {
  if (!medals || medals.length === 0) {
    medalStandingsDiv.innerHTML = "<p>메달 현황 정보 없음.</p>";
    return;
  }

  let tableHtml = `
    <table>
      <thead>
        <tr>
          <th>순위</th>
          <th>국가</th>
          <th>금</th>
          <th>은</th>
          <th>동</th>
          <th>합계</th>
        </tr>
      </thead>
      <tbody>
  `;

  medals.forEach((country, index) => {
    tableHtml += `
      <tr>
        <td>${index + 1}</td>
        <td>${country.name} (${country.code})</td>
        <td>${country.gold}</td>
        <td>${country.silver}</td>
        <td>${country.bronze}</td>
        <td>${country.total}</td>
      </tr>
    `;
  });

  tableHtml += `
      </tbody>
    </table>
  `;
  medalStandingsDiv.innerHTML = tableHtml;
}

// Render Event Schedule
function renderEventSchedule(schedule) {
  if (!schedule || schedule.length === 0) {
    eventScheduleDiv.innerHTML = "<p>경기 일정을 가져올 수 없습니다.</p>";
    return;
  }

  let tableHtml = `
    <table>
      <thead>
        <tr>
          <th>시간</th>
          <th>종목</th>
          <th>이벤트/그룹</th>
          <th>참가국/선수</th>
          <th>메달전</th>
          <th>현황</th>
          <th>장소</th>
        </tr>
      </thead>
      <tbody>
  `;

  schedule.forEach(event => {
    let participantsHtml = '';
    if (event.korean_participants.length > 0) {
      participantsHtml = `${getFlagIcon("대한민국")} ${event.korean_participants.map(p => p.name).join(', ')}`;
    } else if (event.teams && event.teams.length > 0) {
      participantsHtml = event.teams.map(team => {
        return `${getFlagIcon(team.name)} ${team.name}` + (team.score !== null ? ` (스코어${team.score})` : '');
      }).join('<br>');
    } else {
      participantsHtml = 'N/A';
    }

    const isKoreanEvent = event.korean_participants.length > 0;
    
    tableHtml += `
      <tr class="${isKoreanEvent ? 'korean-event-row' : ''}">
        <td>${event.time}</td>
        <td>${event.sport}</td>
        <td>${event.event || event.group || 'N/A'}</td>
        <td>${participantsHtml}</td>
        <td>${event.is_medal_event ? '✅' : '➖'}</td>
        <td>${event.status}</td>
        <td>${event.venue || 'N/A'}</td>
      </tr>
    `;
  });

  tableHtml += `
      </tbody>
    </table>
  `;
  eventScheduleDiv.innerHTML = tableHtml;
}

// Initial data load and render
document.addEventListener("DOMContentLoaded", async () => {
  const data = await loadOlympicsData();
  renderMedalStandings(data.medals);
  renderEventSchedule(data.schedule);
});