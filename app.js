"use strict";

/*
  물건끼리 더하기·빼기
  - 장바구니 합계가 아니라, 물건 가격과 물건 가격을 직접 계산합니다.
  - 예: 사과 500원 + 우유 1,000원 = ?
  - 예: 빵 1,500원 - 사과 500원 = ?
  - 교사는 물건 이름, 가격, 사진을 수정할 수 있습니다.
*/

const STORAGE_KEYS = {
  products: "pairMarket.products.v1",
  sound: "pairMarket.sound.v1"
};

const LEGACY_PRODUCT_KEYS = [
  "addSubMarket.products.v1",
  "visualMarket.products.v1",
  "stepMarket.products.v1"
];

const LEGACY_SOUND_KEYS = [
  "addSubMarket.sound.v1",
  "visualMarket.sound.v1",
  "stepMarket.sound.v1"
];

const DEFAULT_PRODUCTS = [
  { id: "apple", name: "사과", price: 500, image: makeSvgImage("🍎", "#ffdede", "사과") },
  { id: "milk", name: "우유", price: 1000, image: makeSvgImage("🥛", "#e0f2ff", "우유") },
  { id: "bread", name: "빵", price: 1500, image: makeSvgImage("🍞", "#ffe8c2", "빵") },
  { id: "banana", name: "바나나", price: 800, image: makeSvgImage("🍌", "#fff2a8", "바나나") },
  { id: "cookie", name: "과자", price: 1200, image: makeSvgImage("🍪", "#f6e2cb", "과자") },
  { id: "juice", name: "주스", price: 900, image: makeSvgImage("🧃", "#e7f8df", "주스") }
];

const ui = {};
let products = [];
let selectedLeftId = null;
let selectedRightId = null;
let operator = "add";
let currentProblem = null;
let answerInput = "";
let soundOn = true;
let feedbackTimer = null;
let audioContext = null;

document.addEventListener("DOMContentLoaded", init);

function init() {
  ui.studentPanel = document.getElementById("studentPanel");
  ui.adminPanel = document.getElementById("adminPanel");
  ui.studentModeButton = document.getElementById("studentModeButton");
  ui.adminModeButton = document.getElementById("adminModeButton");
  ui.soundButton = document.getElementById("soundButton");
  ui.productGrid = document.getElementById("productGrid");
  ui.randomButton = document.getElementById("randomButton");
  ui.clearSelectionButton = document.getElementById("clearSelectionButton");
  ui.problemCard = document.getElementById("problemCard");
  ui.checkButton = document.getElementById("checkButton");
  ui.addProductForm = document.getElementById("addProductForm");
  ui.addNameInput = document.getElementById("addNameInput");
  ui.addPriceInput = document.getElementById("addPriceInput");
  ui.addImageUrlInput = document.getElementById("addImageUrlInput");
  ui.addImageFileInput = document.getElementById("addImageFileInput");
  ui.adminList = document.getElementById("adminList");
  ui.resetProductsButton = document.getElementById("resetProductsButton");
  ui.clearAllButton = document.getElementById("clearAllButton");
  ui.feedbackToast = document.getElementById("feedbackToast");
  ui.confettiLayer = document.getElementById("confettiLayer");

  products = loadProducts();
  soundOn = loadSoundSetting();

  bindEvents();
  updateSoundButton();
  renderAll();
}

function bindEvents() {
  ui.studentModeButton.addEventListener("click", () => showPanel("student"));
  ui.adminModeButton.addEventListener("click", () => showPanel("admin"));

  ui.soundButton.addEventListener("click", () => {
    soundOn = !soundOn;
    saveJson(STORAGE_KEYS.sound, soundOn);
    updateSoundButton();
    showFeedback(soundOn ? "소리 켜짐" : "소리 꺼짐");
    playTone("tap");
  });

  ui.productGrid.addEventListener("click", event => {
    const button = event.target.closest("[data-action='select-product']");
    if (!button) return;
    selectProduct(button.dataset.id);
  });

  document.querySelectorAll("[data-operator]").forEach(button => {
    button.addEventListener("click", () => {
      operator = button.dataset.operator;
      answerInput = "";
      currentProblem = null;
      buildProblemIfReady();
      renderAll();
      playTone("tap");
    });
  });

  ui.randomButton.addEventListener("click", makeRandomProblem);

  ui.clearSelectionButton.addEventListener("click", () => {
    clearProblem();
    renderAll();
    showFeedback("다시 골라요");
    playTone("remove");
  });

  document.querySelector(".keypad").addEventListener("click", event => {
    const button = event.target.closest("[data-key]");
    if (!button) return;
    handleKey(button.dataset.key);
  });

  ui.checkButton.addEventListener("click", checkAnswer);

  ui.addProductForm.addEventListener("submit", handleAddProduct);

  ui.adminList.addEventListener("click", event => {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    const card = button.closest(".admin-card");
    const id = button.dataset.id;

    if (button.dataset.action === "save-product") handleSaveProduct(id, card);
    if (button.dataset.action === "delete-product") handleDeleteProduct(id);
  });

  ui.resetProductsButton.addEventListener("click", () => {
    const ok = window.confirm("기본 물건으로 바꿀까요?");
    if (!ok) return;

    products = cloneDefaultProducts();
    clearProblem();
    saveJson(STORAGE_KEYS.products, products);
    renderAll();
    showFeedback("기본값 완료");
    playTone("save");
  });

  ui.clearAllButton.addEventListener("click", () => {
    const ok = window.confirm("저장된 내용을 모두 지울까요?");
    if (!ok) return;

    removeStorageItem(STORAGE_KEYS.products);
    removeStorageItem(STORAGE_KEYS.sound);

    products = cloneDefaultProducts();
    soundOn = true;
    clearProblem();
    updateSoundButton();
    renderAll();
    showFeedback("모두 지움");
    playTone("save");
  });

  window.addEventListener("keydown", event => {
    if (document.activeElement && ["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) return;
    if (/^[0-9]$/.test(event.key)) handleKey(event.key);
    if (event.key === "Backspace") handleKey("back");
    if (event.key === "Enter") checkAnswer();
  });
}

function showPanel(panelName) {
  const isStudent = panelName === "student";
  ui.studentPanel.hidden = !isStudent;
  ui.adminPanel.hidden = isStudent;
  ui.studentModeButton.classList.toggle("active", isStudent);
  ui.adminModeButton.classList.toggle("active", !isStudent);
  ui.studentModeButton.setAttribute("aria-pressed", String(isStudent));
  ui.adminModeButton.setAttribute("aria-pressed", String(!isStudent));
}

function renderAll() {
  sanitizeSelection();
  renderOperatorButtons();
  renderProducts();
  renderProblem();
  renderAdminList();
}

function renderOperatorButtons() {
  document.querySelectorAll("[data-operator]").forEach(button => {
    const isActive = button.dataset.operator === operator;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function renderProducts() {
  ui.productGrid.innerHTML = "";

  products.forEach(product => {
    const button = document.createElement("button");
    button.className = "product-card";
    button.type = "button";
    button.dataset.action = "select-product";
    button.dataset.id = product.id;
    button.setAttribute("aria-label", `${product.name} ${formatWon(product.price)} 선택`);

    const selectionLabel = getSelectionLabel(product.id);
    if (selectionLabel === "1") button.classList.add("selected-left");
    if (selectionLabel === "2") button.classList.add("selected-right");
    if (selectionLabel === "1·2") button.classList.add("selected-both");

    const imageWrap = document.createElement("div");
    imageWrap.className = "product-image-wrap";

    const image = document.createElement("img");
    image.className = "product-image";
    image.src = product.image;
    image.alt = `${product.name} 사진`;
    image.onerror = () => {
      image.src = makeSvgImage("🛍️", "#e9f1ff", "물건");
    };

    imageWrap.appendChild(image);

    if (selectionLabel) {
      const badge = document.createElement("span");
      badge.className = "selection-badge";
      badge.textContent = selectionLabel;
      imageWrap.appendChild(badge);
    }

    const name = document.createElement("h3");
    name.textContent = product.name;

    const price = document.createElement("p");
    price.className = "price-text";
    price.textContent = formatWon(product.price);

    button.append(imageWrap, name, price);
    ui.productGrid.appendChild(button);
  });
}

function renderProblem() {
  ui.problemCard.innerHTML = "";

  document.querySelectorAll(".keypad button").forEach(button => {
    button.disabled = !currentProblem || currentProblem.solved;
  });

  ui.checkButton.disabled = !currentProblem || currentProblem.solved;

  if (!selectedLeftId) {
    ui.problemCard.appendChild(makeEmptyCard("👆", "물건 1"));
    return;
  }

  if (!selectedRightId) {
    ui.problemCard.appendChild(makeOneSelectedCard());
    return;
  }

  if (!currentProblem) {
    buildProblemIfReady();
  }

  if (!currentProblem) {
    ui.problemCard.appendChild(makeEmptyCard("👆", "물건 2"));
    return;
  }

  const left = findProduct(currentProblem.leftId);
  const right = findProduct(currentProblem.rightId);

  if (!left || !right) {
    clearProblem();
    ui.problemCard.appendChild(makeEmptyCard("👆", "물건 1"));
    return;
  }

  const wrap = document.createElement("div");

  const equation = document.createElement("div");
  equation.className = "equation";

  const leftItem = makeProblemItem(left);
  const op = document.createElement("div");
  op.className = `problem-operator ${currentProblem.operator === "subtract" ? "minus" : ""}`;
  op.textContent = currentProblem.operator === "add" ? "+" : "−";
  const rightItem = makeProblemItem(right);

  equation.append(leftItem, op, rightItem);

  const answerRow = document.createElement("div");
  answerRow.className = "answer-row";

  const equal = document.createElement("span");
  equal.className = "equal-sign";
  equal.textContent = "=";

  const answer = document.createElement("span");
  answer.className = `answer-box ${currentProblem.solved ? "correct" : ""}`;
  answer.textContent = currentProblem.solved
    ? formatWon(currentProblem.answer)
    : answerInput
      ? `${formatNumber(answerInput)}원`
      : "?";

  answerRow.append(equal, answer);
  wrap.append(equation, answerRow);
  ui.problemCard.appendChild(wrap);
}

function makeEmptyCard(icon, text) {
  const empty = document.createElement("div");
  empty.className = "problem-empty";

  const iconSpan = document.createElement("span");
  iconSpan.className = "big-icon";
  iconSpan.textContent = icon;

  const label = document.createElement("strong");
  label.textContent = text;

  empty.append(iconSpan, label);
  return empty;
}

function makeOneSelectedCard() {
  const product = findProduct(selectedLeftId);
  const card = document.createElement("div");
  card.className = "pick-one";

  if (!product) {
    card.appendChild(makeEmptyCard("👆", "물건 1"));
    return card;
  }

  const icon = document.createElement("span");
  icon.className = "big-icon";
  icon.textContent = operator === "add" ? "+" : "−";

  const text = document.createElement("strong");
  text.textContent = "물건 2";

  card.append(icon, text);
  return card;
}

function makeProblemItem(product) {
  const box = document.createElement("div");
  box.className = "problem-item";

  const image = document.createElement("img");
  image.src = product.image;
  image.alt = `${product.name} 사진`;
  image.onerror = () => {
    image.src = makeSvgImage("🛍️", "#e9f1ff", "물건");
  };

  const name = document.createElement("span");
  name.className = "problem-name";
  name.textContent = product.name;

  const price = document.createElement("span");
  price.className = "problem-price";
  price.textContent = formatWon(product.price);

  box.append(image, name, price);
  return box;
}

function renderAdminList() {
  ui.adminList.innerHTML = "";

  products.forEach(product => {
    const card = document.createElement("article");
    card.className = "admin-card";
    card.dataset.id = product.id;

    const preview = document.createElement("img");
    preview.className = "admin-preview";
    preview.src = product.image;
    preview.alt = `${product.name} 미리보기`;
    preview.onerror = () => {
      preview.src = makeSvgImage("🛍️", "#e9f1ff", "물건");
    };

    const content = document.createElement("div");
    const fields = document.createElement("div");
    fields.className = "admin-card-fields";

    const nameField = makeInputField("이름", "text", "edit-name", product.name);
    nameField.querySelector("input").maxLength = 30;

    const priceField = makeInputField("가격", "number", "edit-price", String(product.price));
    const priceInput = priceField.querySelector("input");
    priceInput.min = "0";
    priceInput.step = "10";

    const imageUrlValue = product.image.startsWith("data:") ? "" : product.image;
    const imageUrlField = makeInputField("사진 주소", "url", "edit-image-url", imageUrlValue);

    const fileField = document.createElement("label");
    const fileText = document.createElement("span");
    fileText.textContent = "사진 파일";
    const fileInput = document.createElement("input");
    fileInput.className = "edit-image-file";
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileField.append(fileText, fileInput);

    fields.append(nameField, priceField, imageUrlField, fileField);

    const buttons = document.createElement("div");
    buttons.className = "admin-card-buttons";

    const saveButton = document.createElement("button");
    saveButton.className = "save-button";
    saveButton.type = "button";
    saveButton.dataset.action = "save-product";
    saveButton.dataset.id = product.id;
    saveButton.textContent = "저장";

    const deleteButton = document.createElement("button");
    deleteButton.className = "danger-button";
    deleteButton.type = "button";
    deleteButton.dataset.action = "delete-product";
    deleteButton.dataset.id = product.id;
    deleteButton.textContent = "삭제";

    buttons.append(saveButton, deleteButton);
    content.append(fields, buttons);
    card.append(preview, content);
    ui.adminList.appendChild(card);
  });
}

function selectProduct(id) {
  if (!findProduct(id)) return;

  if (currentProblem && currentProblem.solved) {
    selectedLeftId = id;
    selectedRightId = null;
    currentProblem = null;
    answerInput = "";
    renderAll();
    playTone("tap");
    return;
  }

  if (!selectedLeftId) {
    selectedLeftId = id;
    selectedRightId = null;
    currentProblem = null;
    answerInput = "";
    showFeedback("1");
    renderAll();
    playTone("tap");
    return;
  }

  if (!selectedRightId) {
    selectedRightId = id;
    currentProblem = null;
    answerInput = "";
    buildProblemIfReady();
    renderAll();
    showFeedback("2");
    playTone("tap");
    return;
  }

  selectedLeftId = id;
  selectedRightId = null;
  currentProblem = null;
  answerInput = "";
  showFeedback("새 문제");
  renderAll();
  playTone("tap");
}

function buildProblemIfReady() {
  const left = findProduct(selectedLeftId);
  const right = findProduct(selectedRightId);

  if (!left || !right) {
    currentProblem = null;
    return;
  }

  let leftProduct = left;
  let rightProduct = right;

  // 지적장애 학생용 기본값: 음수는 만들지 않습니다.
  // 빼기에서 뒤 물건이 더 비싸면 자동으로 큰 가격 - 작은 가격으로 바꿉니다.
  if (operator === "subtract" && left.price < right.price) {
    leftProduct = right;
    rightProduct = left;
    selectedLeftId = leftProduct.id;
    selectedRightId = rightProduct.id;
  }

  currentProblem = {
    leftId: leftProduct.id,
    rightId: rightProduct.id,
    operator,
    answer: operator === "add"
      ? leftProduct.price + rightProduct.price
      : leftProduct.price - rightProduct.price,
    solved: false
  };
}

function makeRandomProblem() {
  if (products.length === 0) return;

  const first = products[Math.floor(Math.random() * products.length)];
  const second = products[Math.floor(Math.random() * products.length)];

  selectedLeftId = first.id;
  selectedRightId = second.id;
  answerInput = "";
  currentProblem = null;
  buildProblemIfReady();
  renderAll();
  showFeedback("문제!");
  playTone("tap");
}

function handleKey(key) {
  if (!currentProblem || currentProblem.solved) return;

  if (/^[0-9]$/.test(key)) {
    if (answerInput.length >= 7) return;
    answerInput = answerInput === "0" ? key : answerInput + key;
  }

  if (key === "back") {
    answerInput = answerInput.slice(0, -1);
  }

  if (key === "clear") {
    answerInput = "";
  }

  renderProblem();
  playTone("tap");
}

function checkAnswer() {
  if (!currentProblem) {
    showFeedback("물건 2개");
    return;
  }

  if (currentProblem.solved) {
    showFeedback("정답 완료");
    return;
  }

  if (answerInput === "") {
    showFeedback("숫자");
    shakeProblem();
    playTone("wrong");
    return;
  }

  const studentAnswer = Number(answerInput);

  if (studentAnswer !== currentProblem.answer) {
    answerInput = "";
    renderProblem();
    showFeedback("한 번 더");
    shakeProblem();
    playTone("wrong");
    return;
  }

  currentProblem.solved = true;
  answerInput = String(currentProblem.answer);
  renderProblem();
  showFeedback("정답 👏");
  celebrate();
}

async function handleAddProduct(event) {
  event.preventDefault();

  const name = ui.addNameInput.value.trim();
  const price = normalizePrice(ui.addPriceInput.value);
  const imageUrl = ui.addImageUrlInput.value.trim();
  const file = ui.addImageFileInput.files[0];

  if (!name) {
    showFeedback("이름");
    ui.addNameInput.focus();
    return;
  }

  if (price === null) {
    showFeedback("가격");
    ui.addPriceInput.focus();
    return;
  }

  let image = makeSvgImage("🛍️", "#e9f1ff", name);

  try {
    if (file) image = await imageFileToDataUrl(file);
    else if (imageUrl) image = imageUrl;
  } catch (error) {
    showFeedback("사진 오류");
    return;
  }

  products.push({
    id: createProductId(),
    name,
    price,
    image
  });

  if (!saveJson(STORAGE_KEYS.products, products)) {
    products.pop();
    return;
  }

  ui.addProductForm.reset();
  renderAll();
  showFeedback("추가 완료");
  playTone("save");
}

async function handleSaveProduct(id, card) {
  const product = findProduct(id);
  if (!product || !card) return;

  const nameInput = card.querySelector(".edit-name");
  const priceInput = card.querySelector(".edit-price");
  const imageUrlInput = card.querySelector(".edit-image-url");
  const fileInput = card.querySelector(".edit-image-file");

  const nextName = nameInput.value.trim();
  const nextPrice = normalizePrice(priceInput.value);
  const nextImageUrl = imageUrlInput.value.trim();
  const file = fileInput.files[0];
  const previousProduct = { ...product };

  if (!nextName) {
    showFeedback("이름");
    nameInput.focus();
    return;
  }

  if (nextPrice === null) {
    showFeedback("가격");
    priceInput.focus();
    return;
  }

  try {
    product.name = nextName;
    product.price = nextPrice;

    if (file) product.image = await imageFileToDataUrl(file);
    else if (nextImageUrl) product.image = nextImageUrl;

    clearProblem();

    if (!saveJson(STORAGE_KEYS.products, products)) {
      Object.assign(product, previousProduct);
      return;
    }

    renderAll();
    showFeedback("저장 완료");
    playTone("save");
  } catch (error) {
    Object.assign(product, previousProduct);
    showFeedback("사진 오류");
  }
}

function handleDeleteProduct(id) {
  const product = findProduct(id);
  if (!product) return;

  const ok = window.confirm(`${product.name} 삭제할까요?`);
  if (!ok) return;

  products = products.filter(item => item.id !== id);
  clearProblem();
  saveJson(STORAGE_KEYS.products, products);
  renderAll();
  showFeedback("삭제 완료");
  playTone("remove");
}

function clearProblem() {
  selectedLeftId = null;
  selectedRightId = null;
  currentProblem = null;
  answerInput = "";
}

function sanitizeSelection() {
  if (selectedLeftId && !findProduct(selectedLeftId)) selectedLeftId = null;
  if (selectedRightId && !findProduct(selectedRightId)) selectedRightId = null;
  if (!selectedLeftId || !selectedRightId) currentProblem = null;
}

function getSelectionLabel(id) {
  const isLeft = selectedLeftId === id;
  const isRight = selectedRightId === id;
  if (isLeft && isRight) return "1·2";
  if (isLeft) return "1";
  if (isRight) return "2";
  return "";
}

function findProduct(id) {
  return products.find(product => product.id === id);
}

function loadProducts() {
  const savedProducts = readFirstAvailableJson([STORAGE_KEYS.products, ...LEGACY_PRODUCT_KEYS], null);

  if (!Array.isArray(savedProducts) || savedProducts.length === 0) {
    return cloneDefaultProducts();
  }

  const normalized = savedProducts
    .map(item => {
      const id = String(item.id || "").trim();
      const name = String(item.name || "").trim();
      const price = normalizePrice(item.price);
      const image = String(item.image || "").trim();

      if (!id || !name || price === null) return null;

      return {
        id,
        name: name.slice(0, 30),
        price,
        image: image || makeSvgImage("🛍️", "#e9f1ff", name)
      };
    })
    .filter(Boolean);

  return normalized.length > 0 ? normalized : cloneDefaultProducts();
}

function loadSoundSetting() {
  return readFirstAvailableJson([STORAGE_KEYS.sound, ...LEGACY_SOUND_KEYS], true) !== false;
}

function cloneDefaultProducts() {
  return DEFAULT_PRODUCTS.map(product => ({ ...product }));
}

function normalizePrice(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return null;
  return Math.round(number);
}

function formatWon(value) {
  return `${new Intl.NumberFormat("ko-KR").format(Number(value || 0))}원`;
}

function formatNumber(value) {
  return new Intl.NumberFormat("ko-KR").format(Number(value || 0));
}

function createProductId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `product_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function updateSoundButton() {
  ui.soundButton.textContent = soundOn ? "🔊" : "🔇";
  ui.soundButton.setAttribute("aria-pressed", String(soundOn));
}

function showFeedback(message) {
  ui.feedbackToast.textContent = message;
  ui.feedbackToast.classList.add("show");

  window.clearTimeout(feedbackTimer);
  feedbackTimer = window.setTimeout(() => {
    ui.feedbackToast.classList.remove("show");
  }, 1500);
}

function celebrate() {
  playTone("success");
  launchConfetti();
}

function launchConfetti() {
  const symbols = ["⭐", "👏", "✨", "💛", "🎉"];
  ui.confettiLayer.innerHTML = "";

  for (let index = 0; index < 18; index += 1) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.textContent = symbols[index % symbols.length];
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.animationDelay = `${Math.random() * 0.18}s`;
    piece.style.setProperty("--fall-distance", `${70 + Math.random() * 24}vh`);
    ui.confettiLayer.appendChild(piece);
  }

  window.setTimeout(() => {
    ui.confettiLayer.innerHTML = "";
  }, 1600);
}

function shakeProblem() {
  ui.problemCard.classList.remove("shake");
  window.requestAnimationFrame(() => ui.problemCard.classList.add("shake"));
}

function playTone(kind) {
  if (!soundOn) return;

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  try {
    if (!audioContext) audioContext = new AudioContextClass();
    if (audioContext.state === "suspended") audioContext.resume();

    const now = audioContext.currentTime;
    const notes = getNotes(kind);

    notes.forEach((frequency, index) => {
      const start = now + index * 0.08;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, start);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.1, start + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.14);

      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.15);
    });
  } catch (error) {
    // 소리가 막혀도 앱은 계속 사용할 수 있습니다.
  }
}

function getNotes(kind) {
  if (kind === "success") return [523.25, 659.25, 783.99];
  if (kind === "save") return [440, 554.37];
  if (kind === "remove") return [392, 329.63];
  if (kind === "wrong") return [220, 196];
  return [523.25];
}

function readJson(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
}

function readFirstAvailableJson(keys, fallback) {
  for (const key of keys) {
    const value = readJson(key, null);
    if (value !== null) return value;
  }
  return fallback;
}

function saveJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    showFeedback("저장 공간 부족");
    return false;
  }
}

function removeStorageItem(key) {
  try {
    window.localStorage.removeItem(key);
  } catch (error) {
    // 저장소 접근이 막혀도 화면 사용은 가능하게 둡니다.
  }
}

async function imageFileToDataUrl(file) {
  if (!file.type.startsWith("image/")) {
    throw new Error("이미지 파일만 사용할 수 있습니다.");
  }

  const originalDataUrl = await readFileAsDataUrl(file);
  if (file.type === "image/svg+xml") return originalDataUrl;
  return resizeImageDataUrl(originalDataUrl, file.type);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("파일을 읽을 수 없습니다."));
    reader.readAsDataURL(file);
  });
}

function resizeImageDataUrl(dataUrl, mimeType) {
  return new Promise(resolve => {
    const image = new Image();

    image.onload = () => {
      const maxSide = 560;
      const ratio = Math.min(1, maxSide / Math.max(image.width, image.height));
      const width = Math.max(1, Math.round(image.width * ratio));
      const height = Math.max(1, Math.round(image.height * ratio));

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0, width, height);

      const outputType = mimeType === "image/png" ? "image/png" : "image/jpeg";
      resolve(canvas.toDataURL(outputType, 0.84));
    };

    image.onerror = () => resolve(dataUrl);
    image.src = dataUrl;
  });
}

function makeSvgImage(emoji, background, label) {
  const safeEmoji = escapeSvgText(emoji);
  const safeLabel = escapeSvgText(label);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420">
      <rect width="640" height="420" rx="42" fill="${background}"/>
      <circle cx="320" cy="184" r="126" fill="rgba(255,255,255,0.74)"/>
      <text x="320" y="218" text-anchor="middle" font-size="134" font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif">${safeEmoji}</text>
      <text x="320" y="350" text-anchor="middle" font-size="48" font-weight="900" fill="#162033" font-family="system-ui, sans-serif">${safeLabel}</text>
    </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function escapeSvgText(value) {
  return String(value).replace(/[&<>'"]/g, character => {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&apos;",
      '"': "&quot;"
    };
    return map[character];
  });
}

function makeInputField(labelText, type, className, value) {
  const label = document.createElement("label");
  const span = document.createElement("span");
  span.textContent = labelText;

  const input = document.createElement("input");
  input.type = type;
  input.className = className;
  input.value = value;

  label.append(span, input);
  return label;
}
