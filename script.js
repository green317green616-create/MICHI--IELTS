let speakingCards =
  JSON.parse(localStorage.getItem("speakingCards")) || [];

let vocabCards =
  JSON.parse(localStorage.getItem("vocabCards")) || [];

let log =
  JSON.parse(localStorage.getItem("ieltsLog")) || {
    speakingCount: 0,
    vocabCount: 0
  };

let currentCard = null;
let currentFilteredCards = [];
let currentTitleIndex = 0;
let currentText = "";
let currentWordIndex = 0;
let editingSpeakingIndex = null;
let historyStack = [];

const AUTO_BACKUP_KEY = "ieltsAutoBackup";
const AUTO_BACKUP_TIME_KEY = "ieltsAutoBackupTime";

function getBackupData() {
  return {
    speakingCards,
    vocabCards,
    log,
    savedAt: new Date().toISOString()
  };
}

function saveData() {
  localStorage.setItem("speakingCards", JSON.stringify(speakingCards));
  localStorage.setItem("vocabCards", JSON.stringify(vocabCards));
  localStorage.setItem("ieltsLog", JSON.stringify(log));
  autoBackup();
}

function autoBackup() {
  const backup = getBackupData();
  localStorage.setItem(AUTO_BACKUP_KEY, JSON.stringify(backup));
  localStorage.setItem(AUTO_BACKUP_TIME_KEY, backup.savedAt);
  renderAutoBackupStatus();
}

function manualAutoBackup() {
  autoBackup();
  alert("自動バックアップを保存した！");
}

function restoreAutoBackup() {
  const text = localStorage.getItem(AUTO_BACKUP_KEY);

  if (!text) {
    alert("自動バックアップがないよ");
    return;
  }

  if (!confirm("自動バックアップから復元する？今の内容は上書きされます")) {
    return;
  }

  try {
    const backup = JSON.parse(text);
    saveHistory();

    speakingCards = backup.speakingCards || [];
    vocabCards = backup.vocabCards || [];
    log = backup.log || {
      speakingCount: 0,
      vocabCount: 0
    };

    resetCurrentState();
    saveData();
    renderAll();

    alert("自動バックアップから復元した！");
  } catch (error) {
    alert("自動バックアップの形式が壊れてるかも");
  }
}

function renderAutoBackupStatus() {
  const area = document.getElementById("autoBackupStatus");
  if (!area) return;

  const time = localStorage.getItem(AUTO_BACKUP_TIME_KEY);

  if (!time) {
    area.textContent = "自動バックアップ：まだ実行されていません";
    return;
  }

  const date = new Date(time);

  area.textContent =
    "自動バックアップ：保存済み / " +
    date.toLocaleString("ja-JP");
}

function saveHistory() {
  historyStack.push({
    speakingCards: JSON.parse(JSON.stringify(speakingCards)),
    vocabCards: JSON.parse(JSON.stringify(vocabCards)),
    log: JSON.parse(JSON.stringify(log))
  });

  if (historyStack.length > 20) {
    historyStack.shift();
  }
}

function resetCurrentState() {
  currentCard = null;
  currentFilteredCards = [];
  currentTitleIndex = 0;
  currentText = "";
  currentWordIndex = 0;
  editingSpeakingIndex = null;
}

function renderAll() {
  renderCategorySelect();
  renderVocabList();
  renderLog();
  renderAutoBackupStatus();

  const titleSelect = document.getElementById("titleSelect");
  const selectedSpeaking = document.getElementById("selectedSpeaking");

  if (titleSelect) {
    titleSelect.innerHTML = `<option value="">タイトルを選ぶ</option>`;
  }

  if (selectedSpeaking) {
    selectedSpeaking.innerHTML = "";
  }
}

function speakText(text, type = "speaking", startWordIndex = 0) {
  speechSynthesis.cancel();

  const words = text.split(/\s+/);
  const textToRead = words.slice(startWordIndex).join(" ");

  currentText = text;
  currentWordIndex = startWordIndex;

  const utter = new SpeechSynthesisUtterance(textToRead);
  utter.lang = "en-GB";
  utter.rate = Number(document.getElementById("speed")?.value || 1);

  const voices = speechSynthesis.getVoices();
  const britishVoice =
    voices.find(v => v.lang === "en-GB") ||
    voices.find(v => v.lang && v.lang.includes("en-GB"));

  if (britishVoice) {
    utter.voice = britishVoice;
  }

  utter.onstart = function () {
    if (type === "speaking") log.speakingCount++;
    if (type === "vocab") log.vocabCount++;

    saveData();
    renderLog();
  };

  utter.onend = function () {
    if (type !== "speaking") return;

    const oneRepeat = document.getElementById("oneRepeat")?.checked;
    const autoNext = document.getElementById("autoNext")?.checked;

    if (oneRepeat && autoNext) {
      setTimeout(() => playNextSpeaking(), 500);
      return;
    }

    if (oneRepeat) {
      setTimeout(() => playSelected(), 500);
      return;
    }

    if (autoNext) {
      setTimeout(() => playNextSpeaking(), 500);
    }
  };

  speechSynthesis.speak(utter);
}

function stopSpeech() {
  speechSynthesis.cancel();
}

function rewindTen() {
  if (!currentText) return;

  const speed = Number(document.getElementById("speed")?.value || 1);
  const rewindWords = Math.round(10 * 2.5 * speed);

  currentWordIndex = Math.max(0, currentWordIndex - rewindWords);
  speakText(currentText, "speaking", currentWordIndex);
}

function addSpeaking() {
  const category = document.getElementById("newCategory").value.trim();
  const title = document.getElementById("newTitle").value.trim();
  const japanese = document.getElementById("newJapanese").value.trim();
  const english = document.getElementById("newEnglish").value.trim();

  if (!category || !title || !english) {
    alert("カテゴリー、タイトル、英文は必要");
    return;
  }

  saveHistory();

  if (editingSpeakingIndex !== null) {
    speakingCards[editingSpeakingIndex] = {
      category,
      title,
      japanese,
      english
    };
    editingSpeakingIndex = null;
    alert("更新した！");
  } else {
    speakingCards.push({
      category,
      title,
      japanese,
      english
    });
    alert("追加した！");
  }

  clearSpeakingForm();
  saveData();
  renderCategorySelect();
}

function clearSpeakingForm() {
  document.getElementById("newCategory").value = "";
  document.getElementById("newTitle").value = "";
  document.getElementById("newJapanese").value = "";
  document.getElementById("newEnglish").value = "";
}

function editSpeaking() {
  if (!currentCard) {
    alert("カード選んでね");
    return;
  }

  const realIndex = speakingCards.findIndex(card =>
    card.category === currentCard.category &&
    card.title === currentCard.title &&
    card.english === currentCard.english
  );

  if (realIndex === -1) {
    alert("編集対象が見つからないよ");
    return;
  }

  editingSpeakingIndex = realIndex;

  document.getElementById("newCategory").value = currentCard.category;
  document.getElementById("newTitle").value = currentCard.title;
  document.getElementById("newJapanese").value = currentCard.japanese || "";
  document.getElementById("newEnglish").value = currentCard.english;

  document.getElementById("newCategory").scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
}

function deleteSpeaking() {
  if (!currentCard) {
    alert("カード選んで");
    return;
  }

  if (!confirm("削除する？")) return;

  saveHistory();

  const realIndex = speakingCards.findIndex(card =>
    card.category === currentCard.category &&
    card.title === currentCard.title &&
    card.english === currentCard.english
  );

  if (realIndex === -1) return;

  speakingCards.splice(realIndex, 1);

  resetCurrentState();
  saveData();
  renderAll();

  alert("削除した");
}

function renderCategorySelect() {
  const select = document.getElementById("categorySelect");
  if (!select) return;

  const categories = [...new Set(speakingCards.map(card => card.category))];

  select.innerHTML = `<option value="">カテゴリーを選ぶ</option>`;

  categories.forEach(category => {
    select.innerHTML += `
      <option value="${escapeHtml(category)}">
        ${escapeHtml(category)}
      </option>
    `;
  });
}

function renderTitleSelect() {
  const selectedCategory = document.getElementById("categorySelect").value;
  const titleSelect = document.getElementById("titleSelect");

  currentFilteredCards = speakingCards.filter(
    card => card.category === selectedCategory
  );

  titleSelect.innerHTML = `<option value="">タイトルを選ぶ</option>`;

  currentFilteredCards.forEach((card, index) => {
    titleSelect.innerHTML += `
      <option value="${index}">
        ${escapeHtml(card.title)}
      </option>
    `;
  });

  currentCard = null;
  document.getElementById("selectedSpeaking").innerHTML = "";
}

function showSelectedCard() {
  const index = document.getElementById("titleSelect").value;
  if (index === "") return;

  currentTitleIndex = Number(index);
  currentCard = currentFilteredCards[currentTitleIndex];

  document.getElementById("selectedSpeaking").innerHTML = `
    <div class="speaking-title">${escapeHtml(currentCard.title)}</div>
    <div class="japanese-note">${escapeHtml(currentCard.japanese || "")}</div>
    <div class="english-text">${escapeHtml(currentCard.english)}</div>
  `;
}

function playSelected() {
  if (!currentCard) {
    alert("カード選んで");
    return;
  }

  currentWordIndex = 0;
  speakText(currentCard.english, "speaking", 0);
}

function playNextSpeaking() {
  if (!currentFilteredCards.length) return;

  currentTitleIndex++;

  if (currentTitleIndex >= currentFilteredCards.length) {
    currentTitleIndex = 0;
  }

  document.getElementById("titleSelect").value = currentTitleIndex;
  currentCard = currentFilteredCards[currentTitleIndex];

  showSelectedCard();
  playSelected();
}

function addVocab() {
  const word = document.getElementById("newWord").value.trim();
  const meaning = document.getElementById("newMeaning").value.trim();
  const paraphrase = document.getElementById("newParaphrase").value.trim();
  const example = document.getElementById("newExample").value.trim();

  if (!word || !meaning) {
    alert("単語と意味必要");
    return;
  }

  saveHistory();

  vocabCards.push({
    word,
    meaning,
    paraphrase,
    example
  });

  clearVocabForm();
  saveData();
  renderVocabList();

  alert("単語追加！");
}

function clearVocabForm() {
  document.getElementById("newWord").value = "";
  document.getElementById("newMeaning").value = "";
  document.getElementById("newParaphrase").value = "";
  document.getElementById("newExample").value = "";
}

function renderVocabList() {
  const area = document.getElementById("vocabList");
  if (!area) return;

  area.innerHTML = "";

  vocabCards.forEach(vocab => {
    const textToRead =
      `${vocab.word}. ${vocab.paraphrase}. ${vocab.example}`;

    area.innerHTML += `
      <div class="vocab-card">
        <h3>${escapeHtml(vocab.word)}</h3>
        <p><b>意味：</b>${escapeHtml(vocab.meaning)}</p>
        <p><b>パラフレーズ：</b>${escapeHtml(vocab.paraphrase)}</p>
        <p><b>例文：</b>${escapeHtml(vocab.example)}</p>

        <button
          class="small-button"
          onclick='speakText(${JSON.stringify(textToRead)},"vocab",0)'
        >
          ▶ 読む
        </button>
      </div>
    `;
  });
}

function renderLog() {
  const speakingCount = document.getElementById("speakingCount");
  const vocabCount = document.getElementById("vocabCount");

  if (speakingCount) speakingCount.textContent = log.speakingCount;
  if (vocabCount) vocabCount.textContent = log.vocabCount;
}

function resetLog() {
  if (!confirm("ログ消す？")) return;

  saveHistory();

  log = {
    speakingCount: 0,
    vocabCount: 0
  };

  saveData();
  renderLog();
}

function undoLastAction() {
  if (historyStack.length === 0) {
    alert("戻せない");
    return;
  }

  const previous = historyStack.pop();

  speakingCards = previous.speakingCards;
  vocabCards = previous.vocabCards;
  log = previous.log;

  resetCurrentState();
  saveData();
  renderAll();

  alert("戻した！");
}

function resetAllData() {
  if (!confirm("全部消す？")) return;

  saveHistory();

  speakingCards = [];
  vocabCards = [];
  log = {
    speakingCount: 0,
    vocabCount: 0
  };

  resetCurrentState();
  saveData();
  renderAll();

  alert("全部消した！");
}

function exportData() {
  const backup = getBackupData();

  document.getElementById("backupBox").value =
    JSON.stringify(backup, null, 2);

  alert("バックアップ欄に出した！");
}

function importData() {
  const text = document.getElementById("backupBox").value.trim();

  if (!text) {
    alert("バックアップ貼って");
    return;
  }

  try {
    const backup = JSON.parse(text);

    saveHistory();

    speakingCards = backup.speakingCards || [];
    vocabCards = backup.vocabCards || [];
    log = backup.log || {
      speakingCount: 0,
      vocabCount: 0
    };

    resetCurrentState();
    saveData();
    renderAll();

    alert("復元成功！");
  } catch (error) {
    alert("バックアップ形式違う！");
  }
}

function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

speechSynthesis.onvoiceschanged = function () {
  speechSynthesis.getVoices();
};

renderAll();