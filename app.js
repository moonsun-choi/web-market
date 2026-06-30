"use strict";

/*
  더하기 빼기 마켓
  - 학생은 물건을 담거나 뺄 때 직접 답을 입력합니다.
  - 할인율, 곱셈, 백분율은 사용하지 않습니다.
  - 물건 목록과 장바구니는 이 기기의 브라우저 저장소(Local Storage)에 저장됩니다.
*/

const STORAGE_KEYS = {
  products: "addSubMarket.products.v1",
  cart: "addSubMarket.cart.v1",
  sound: "addSubMarket.sound.v1"
};

// 이전 할인/직관형 버전에서 저장한 물건이 있으면 가격과 사진만 가져옵니다.
const LEGACY_STORAGE_KEYS = {
  products: ["visualMarket.products.v1", "stepMarket.products.v1"],
  cart: ["visualMarket.cart.v1", "stepMarket.cart.v1"],
  sound: ["visualMarket.sound.v1", "stepMarket.sound.v1"]
};

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
let cart = {};
let soundOn = true;
let pendingProblem = null;
let problemQueue = [];
let answerInput = "";
let feedbackTimer = null;
let audioContext = null;

document.addEventListener("DOMContentLoaded", init);

function init() {
  ui.studentPanel = document.getElementById("studentPanel");
  ui.adminPanel = document.getElementById("adminPanel");
  ui.studentModeButton = document.getElementById("studentModeButton");
  ui.adminModeButton = document.getElementById("adminModeButton");
  ui.soundButton = document.getElementById("soundButton");
  ui.currentTotalText = document.getElementById("currentTotalText");
  ui.itemCountText = document.getElementById("itemCountText");
  ui.productGrid = document.getElementById("productGrid");
  ui.cartList = document.getElementById("cartList");
  ui.problemCard = document.getElementById("problemCard");
  ui.answerText = document.getElementById("answerText");
  ui.checkButton = document.getElementById("checkButton");
  ui.cancelProblemButton = document.getElementById("cancelProblemButton");
  ui.resetCartButton = document.getElementById("resetCartButton");
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
  cart = loadCart(products);
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
    const button = event.target.closest("[data-action='start-add']");
    if (!button) return;
    startAddProblem(button.dataset.id);
  });

  ui.cartList.addEventListener("click", event => {
    const button = event.target.closest("[data-action='start-remove']");
    if (!button) return;
    startRemoveProblem(button.dataset.id);
  });

  document.querySelector(".keypad").addEventListener("click", event => {
    const button = event.target.closest("[data-key]");
    if (!button) return;
    handleKey(button.dataset.key);
  });

  ui.checkButton.addEventListener("click", checkAnswer);

  ui.cancelProblemButton.addEventListener("click", () => {
    pendingProblem = null;
    problemQueue = [];
    answerInput = "";
    renderAll();
    showFeedback("취소했어요");
    playTone("remove");
  });

  ui.resetCartButton.addEventListener("click", () => {
    cart = {};
    pendingProblem = null;
    problemQueue = [];
    answerInput = "";
    saveJson(STORAGE_KEYS.cart, cart);
    renderAll();
    showFeedback("장바구니 비움");
    playTone("remove");
  });

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
    cart = {};
    pendingProblem = null;
    problemQueue = [];
    answerInput = "";
    saveJson(STORAGE_KEYS.products, products);
    saveJson(STORAGE_KEYS.cart, cart);
    renderAll();
    showFeedback("기본값 완료");
    playTone("save");
  });

  ui.clearAllButton.addEventListener("click", () => {
    const ok = window.confirm("저장된 내용을 모두 지울까요?");
    if (!ok) return;

    removeStorageItem(STORAGE_KEYS.products);
    removeStorageItem(STORAGE_KEYS.cart);
    removeStorageItem(STORAGE_KEYS.sound);

    products = cloneDefaultProducts();
    cart = {};
    pendingProblem = null;
    problemQueue = [];
    answerInput = "";
    soundOn = true;
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
  cart = cleanCart(cart, products);
  saveJson(STORAGE_KEYS.cart, cart);
  renderStatus();
  renderProducts();
  renderProblem();
  renderCart();
  renderAdminList();
}

function renderStatus() {
  ui.currentTotalText.textContent = formatWon(getCartTotal());
  ui.itemCountText.textContent = `${getCartCount()}개`;
}

function renderProducts() {
  ui.productGrid.innerHTML = "";

  products.forEach(product => {
    const card = document.createElement("article");
    card.className = "product-card";

    const imageWrap = document.createElement("div");
    imageWrap.className = "product-image-wrap";

    const image = document.createElement("img");
    image.className = "product-image";
    image.src = product.image;
    image.alt = `${product.name} 사진`;
    image.onerror = () => {
      image.src = makeSvgImage("🛍️", "#e9f1ff", "물건");
    };

    const count = document.createElement("span");
    count.className = "product-count";
    count.textContent = `${cart[product.id] || 0}개`;

    imageWrap.append(image, count);

    const name = document.createElement("h3");
    name.textContent = product.name;

    const price = document.createElement("p");
    price.className = "price-text";
    price.textContent = formatWon(product.price);

    const button = document.createElement("button");
    button.className = "product-add-button";
    button.type = "button";
    button.dataset.action = "start-add";
    button.dataset.id = product.id;
    button.disabled = false;
    button.textContent = "➕ 담기";
    button.setAttribute("aria-label", `${product.name} 담기 문제 시작`);

    card.append(imageWrap, name, price, button);
    ui.productGrid.appendChild(card);
  });
}

function renderProblem() {
  ui.problemCard.innerHTML = "";
  ui.answerText.textContent = answerInput ? formatNumber(answerInput) : "?";
  ui.checkButton.disabled = !pendingProblem;
  ui.cancelProblemButton.disabled = !pendingProblem;
  document.querySelectorAll(".keypad button").forEach(button => {
    button.disabled = !pendingProblem;
  });

  if (!pendingProblem) {
    const empty = document.createElement("div");
    empty.className = "problem-empty";
    empty.innerHTML = `
      <span class="big-icon">👆</span>
      <strong>물건을 눌러요</strong>
    `;
    ui.problemCard.appendChild(empty);
    return;
  }

  const product = findProduct(pendingProblem.productId);
  if (!product) {
    pendingProblem = null;
    answerInput = "";
    renderAll();
    return;
  }

  const wrap = document.createElement("div");
  wrap.className = "problem-live";

  const image = document.createElement("img");
  image.className = "problem-image";
  image.src = product.image;
  image.alt = `${product.name} 사진`;
  image.onerror = () => {
    image.src = makeSvgImage("🛍️", "#e9f1ff", "물건");
  };

  const label = document.createElement("div");
  label.className = "problem-label";
  label.textContent = pendingProblem.type === "add" ? `➕ ${product.name}` : `➖ ${product.name}`;

  const equation = document.createElement("div");
  equation.className = "equation";

  const before = document.createElement("span");
  before.className = "money-block";
  before.textContent = formatWon(pendingProblem.before);

  const operator = document.createElement("span");
  operator.className = `operator-block ${pendingProblem.type === "remove" ? "minus" : ""}`;
  operator.textContent = pendingProblem.type === "add" ? "+" : "−";

  const price = document.createElement("span");
  price.className = "money-block";
  price.textContent = formatWon(pendingProblem.price);

  const equal = document.createElement("span");
  equal.className = "equal-block";
  equal.textContent = "=";

  const answer = document.createElement("span");
  answer.className = "answer-block";
  answer.textContent = answerInput ? `${formatNumber(answerInput)}원` : "?";

  equation.append(before, operator, price, equal, answer);
  wrap.append(image, label, equation);
  ui.problemCard.appendChild(wrap);
}

function renderCart() {
  ui.cartList.innerHTML = "";
  const items = getCartItems();

  if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-cart";
    empty.textContent = "비어 있어요";
    ui.cartList.appendChild(empty);
    return;
  }

  items.forEach(item => {
    const row = document.createElement("article");
    row.className = "cart-item";

    const image = document.createElement("img");
    image.className = "cart-thumb";
    image.src = item.product.image;
    image.alt = `${item.product.name} 사진`;
    image.onerror = () => {
      image.src = makeSvgImage("🛍️", "#e9f1ff", "물건");
    };

    const info = document.createElement("div");
    info.className = "cart-info";

    const lineOne = document.createElement("div");
    lineOne.className = "cart-line";

    const name = document.createElement("span");
    name.className = "cart-name";
    name.textContent = item.product.name;

    const qty = document.createElement("span");
    qty.className = "cart-qty";
    qty.textContent = `${item.quantity}개`;

    const lineTwo = document.createElement("div");
    lineTwo.className = "cart-line";

    const price = document.createElement("span");
    price.className = "cart-price";
    price.textContent = formatWon(item.product.price);

    const minusButton = document.createElement("button");
    minusButton.className = "cart-minus-button";
    minusButton.type = "button";
    minusButton.dataset.action = "start-remove";
    minusButton.dataset.id = item.product.id;
    minusButton.disabled = false;
    minusButton.textContent = "➖ 빼기";
    minusButton.setAttribute("aria-label", `${item.product.name} 빼기 문제 시작`);

    lineOne.append(name, qty);
    lineTwo.append(price, minusButton);
    info.append(lineOne, lineTwo);
    row.append(image, info);
    ui.cartList.appendChild(row);
  });
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

function startAddProblem(id) {
  enqueueProblem("add", id);
}

function startRemoveProblem(id) {
  enqueueProblem("remove", id);
}

function enqueueProblem(type, id) {
  const product = findProduct(id);
  if (!product) return;

  if (type === "remove" && !cart[id]) {
    showFeedback("뺄 물건이 없어요");
    playTone("wrong");
    return;
  }

  problemQueue.push({
    type,
    productId: id
  });

  if (!pendingProblem) {
    startNextProblem();
    return;
  }

  showFeedback("다음 문제에 넣었어요");
  playTone("tap");
}

function startNextProblem() {
  pendingProblem = null;
  answerInput = "";

  while (problemQueue.length > 0 && !pendingProblem) {
    const nextAction = problemQueue.shift();
    const product = findProduct(nextAction.productId);

    if (!product) continue;

    if (nextAction.type === "remove" && !cart[product.id]) {
      continue;
    }

    const beforeTotal = getCartTotal();

    pendingProblem = {
      type: nextAction.type,
      productId: product.id,
      before: beforeTotal,
      price: product.price,
      answer: nextAction.type === "add"
        ? beforeTotal + product.price
        : Math.max(0, beforeTotal - product.price)
    };
  }

  renderAll();
  playTone("tap");
}

function handleKey(key) {
  if (!pendingProblem) return;

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
  if (!pendingProblem) {
    showFeedback("물건을 눌러요");
    return;
  }

  if (answerInput === "") {
    showFeedback("숫자를 눌러요");
    shakeProblem();
    playTone("wrong");
    return;
  }

  const studentAnswer = Number(answerInput);

  if (studentAnswer !== pendingProblem.answer) {
    answerInput = "";
    renderProblem();
    showFeedback("한 번 더");
    shakeProblem();
    playTone("wrong");
    return;
  }

  const solvedProblem = { ...pendingProblem };
  const product = findProduct(solvedProblem.productId);

  if (!product) {
    pendingProblem = null;
    answerInput = "";
    startNextProblem();
    return;
  }

  if (solvedProblem.type === "add") {
    cart[product.id] = Math.min((cart[product.id] || 0) + 1, 99);
  }

  if (solvedProblem.type === "remove") {
    const nextQuantity = Math.max(0, (cart[product.id] || 0) - 1);

    if (nextQuantity === 0) {
      delete cart[product.id];
    } else {
      cart[product.id] = nextQuantity;
    }
  }

  saveJson(STORAGE_KEYS.cart, cart);

  pendingProblem = null;
  answerInput = "";

  if (problemQueue.length > 0) {
    startNextProblem();
    showFeedback("정답! 다음 물건이에요 👏");
  } else {
    renderAll();
    showFeedback("정답이에요! 👏");
  }

  celebrate();
}

async function handleAddProduct(event) {
  event.preventDefault();

  const name = ui.addNameInput.value.trim();
  const price = normalizePrice(ui.addPriceInput.value);
  const imageUrl = ui.addImageUrlInput.value.trim();
  const file = ui.addImageFileInput.files[0];

  if (!name) {
    showFeedback("이름 필요");
    ui.addNameInput.focus();
    return;
  }

  if (price === null) {
    showFeedback("가격 확인");
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

  const product = {
    id: createProductId(),
    name,
    price,
    image
  };

  products.push(product);

  if (!saveJson(STORAGE_KEYS.products, products)) {
    products = products.filter(item => item.id !== product.id);
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
    showFeedback("이름 필요");
    nameInput.focus();
    return;
  }

  if (nextPrice === null) {
    showFeedback("가격 확인");
    priceInput.focus();
    return;
  }

  try {
    product.name = nextName;
    product.price = nextPrice;

    if (file) product.image = await imageFileToDataUrl(file);
    else if (nextImageUrl) product.image = nextImageUrl;

    pendingProblem = null;
    problemQueue = [];
    answerInput = "";

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
  delete cart[id];
  pendingProblem = null;
  problemQueue = [];
  answerInput = "";

  saveJson(STORAGE_KEYS.products, products);
  saveJson(STORAGE_KEYS.cart, cart);
  renderAll();
  showFeedback("삭제 완료");
  playTone("remove");
}

function getCartItems() {
  return Object.entries(cart)
    .map(([id, quantity]) => {
      const product = findProduct(id);
      if (!product) return null;
      return { product, quantity };
    })
    .filter(Boolean);
}

function getCartTotal() {
  return getCartItems().reduce((sum, item) => sum + item.product.price * item.quantity, 0);
}

function getCartCount() {
  return Object.values(cart).reduce((sum, quantity) => sum + Number(quantity || 0), 0);
}

function findProduct(id) {
  return products.find(product => product.id === id);
}

function cleanCart(currentCart, currentProducts) {
  const validIds = new Set(currentProducts.map(product => product.id));
  const cleaned = {};

  Object.entries(currentCart || {}).forEach(([id, quantity]) => {
    const safeQuantity = Math.max(0, Math.min(99, Math.floor(Number(quantity))));
    if (validIds.has(id) && safeQuantity > 0) cleaned[id] = safeQuantity;
  });

  return cleaned;
}

function loadProducts() {
  const savedProducts = readFirstAvailableJson([STORAGE_KEYS.products, ...LEGACY_STORAGE_KEYS.products], null);

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

function loadCart(currentProducts) {
  const savedCart = readFirstAvailableJson([STORAGE_KEYS.cart, ...LEGACY_STORAGE_KEYS.cart], {});
  if (!savedCart || typeof savedCart !== "object" || Array.isArray(savedCart)) return {};
  return cleanCart(savedCart, currentProducts);
}

function loadSoundSetting() {
  return readFirstAvailableJson([STORAGE_KEYS.sound, ...LEGACY_STORAGE_KEYS.sound], true) !== false;
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
  }, 1700);
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
