"use strict";

/*
  마켓 계산 놀이 - 직관형 버전
  - 학생 화면: 글을 줄이고, 그림·숫자·버튼 중심으로 구성합니다.
  - 문제는 한 번에 하나씩 보여 줍니다.
  - 물건, 장바구니, 학생 답, 소리 설정은 Local Storage에 저장합니다.
*/

const STORAGE_KEYS = {
  products: "visualMarket.products.v1",
  cart: "visualMarket.cart.v1",
  answers: "visualMarket.answers.v1",
  sound: "visualMarket.sound.v1"
};

const DEFAULT_PRODUCTS = [
  { id: "apple", name: "사과", price: 1000, discount: 20, image: makeSvgImage("🍎", "#ffd9d9", "사과") },
  { id: "milk", name: "우유", price: 1500, discount: 10, image: makeSvgImage("🥛", "#def1ff", "우유") },
  { id: "bread", name: "빵", price: 1200, discount: 0, image: makeSvgImage("🍞", "#ffe4bd", "빵") },
  { id: "banana", name: "바나나", price: 800, discount: 25, image: makeSvgImage("🍌", "#fff2a7", "바나나") },
  { id: "juice", name: "주스", price: 2000, discount: 15, image: makeSvgImage("🧃", "#ffe0c2", "주스") },
  { id: "cookie", name: "쿠키", price: 600, discount: 50, image: makeSvgImage("🍪", "#ead7c2", "쿠키") }
];

const ui = {};
let products = [];
let cart = {};
let answers = {};
let soundOn = true;
let audioContext = null;
let toastTimer = null;
let activeTaskId = null;

window.addEventListener("DOMContentLoaded", init);

function init() {
  ui.studentPanel = document.getElementById("studentPanel");
  ui.adminPanel = document.getElementById("adminPanel");
  ui.studentModeButton = document.getElementById("studentModeButton");
  ui.adminModeButton = document.getElementById("adminModeButton");
  ui.soundButton = document.getElementById("soundButton");

  ui.summaryKindCount = document.getElementById("summaryKindCount");
  ui.summaryItemCount = document.getElementById("summaryItemCount");
  ui.summaryCorrectCount = document.getElementById("summaryCorrectCount");
  ui.summaryFinalTotal = document.getElementById("summaryFinalTotal");

  ui.productGrid = document.getElementById("productGrid");
  ui.cartList = document.getElementById("cartList");
  ui.quizBox = document.getElementById("quizBox");
  ui.resetCartButton = document.getElementById("resetCartButton");
  ui.resetPracticeButton = document.getElementById("resetPracticeButton");
  ui.celebrateButton = document.getElementById("celebrateButton");

  ui.addProductForm = document.getElementById("addProductForm");
  ui.addNameInput = document.getElementById("addNameInput");
  ui.addPriceInput = document.getElementById("addPriceInput");
  ui.addDiscountInput = document.getElementById("addDiscountInput");
  ui.addImageUrlInput = document.getElementById("addImageUrlInput");
  ui.addImageFileInput = document.getElementById("addImageFileInput");
  ui.adminList = document.getElementById("adminList");
  ui.resetProductsButton = document.getElementById("resetProductsButton");
  ui.clearAllButton = document.getElementById("clearAllButton");

  ui.feedbackToast = document.getElementById("feedbackToast");
  ui.confettiLayer = document.getElementById("confettiLayer");

  products = loadProducts();
  cart = loadCart(products);
  answers = loadAnswers();
  soundOn = loadSoundSetting();

  bindEvents();
  renderAll();
  updateSoundButton();
}

function bindEvents() {
  ui.studentModeButton.addEventListener("click", () => showPanel("student"));
  ui.adminModeButton.addEventListener("click", () => showPanel("admin"));

  ui.soundButton.addEventListener("click", () => {
    soundOn = !soundOn;
    saveJson(STORAGE_KEYS.sound, soundOn);
    updateSoundButton();
    showFeedback(soundOn ? "소리 켜짐" : "소리 꺼짐");
    playTone(soundOn ? "save" : "tap");
  });

  ui.productGrid.addEventListener("click", event => {
    const button = event.target.closest("[data-action='add-to-cart']");
    if (!button) return;
    addToCart(button.dataset.id);
  });

  ui.cartList.addEventListener("click", event => {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    const id = button.dataset.id;
    if (button.dataset.action === "increase") changeQuantity(id, 1);
    if (button.dataset.action === "decrease") changeQuantity(id, -1);
    if (button.dataset.action === "remove") removeFromCart(id);
  });

  ui.resetCartButton.addEventListener("click", () => {
    cart = {};
    answers = {};
    activeTaskId = null;
    saveJson(STORAGE_KEYS.cart, cart);
    saveJson(STORAGE_KEYS.answers, answers);
    renderAll();
    showFeedback("비웠어요");
    playTone("remove");
  });

  ui.resetPracticeButton.addEventListener("click", () => {
    answers = {};
    activeTaskId = null;
    saveJson(STORAGE_KEYS.answers, answers);
    renderAll();
    showFeedback("다시 쓰기");
    playTone("remove");
  });

  ui.quizBox.addEventListener("click", event => {
    const keyButton = event.target.closest("[data-key]");
    if (keyButton) {
      pressKey(keyButton.dataset.key);
      return;
    }

    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) return;

    if (actionButton.dataset.action === "check-answer") checkCurrentAnswer();
    if (actionButton.dataset.action === "toggle-hint") toggleHint();
  });

  ui.quizBox.addEventListener("input", event => {
    if (event.target.id !== "answerInput") return;
    const value = onlyDigits(event.target.value);
    event.target.value = value;
    if (activeTaskId) {
      answers[activeTaskId] = value;
      saveJson(STORAGE_KEYS.answers, answers);
      renderSummary();
    }
  });

  ui.quizBox.addEventListener("keydown", event => {
    if (event.target.id === "answerInput" && event.key === "Enter") {
      event.preventDefault();
      checkCurrentAnswer();
    }
  });

  ui.celebrateButton.addEventListener("click", () => {
    const tasks = getTasks();
    if (tasks.length === 0) {
      showFeedback("먼저 담기");
      playTone("tap");
      return;
    }
    if (!areAllTasksCorrect(tasks)) {
      showFeedback("조금만 더!");
      playTone("tap");
      return;
    }
    celebrate("멋져요!");
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
    const ok = window.confirm("기본값으로 바꿀까요?");
    if (!ok) return;

    products = cloneDefaultProducts();
    cart = {};
    answers = {};
    activeTaskId = null;
    saveJson(STORAGE_KEYS.products, products);
    saveJson(STORAGE_KEYS.cart, cart);
    saveJson(STORAGE_KEYS.answers, answers);
    renderAll();
    showFeedback("기본값 완료");
    playTone("save");
  });

  ui.clearAllButton.addEventListener("click", () => {
    const ok = window.confirm("저장된 내용을 모두 지울까요?");
    if (!ok) return;

    removeStorageItem(STORAGE_KEYS.products);
    removeStorageItem(STORAGE_KEYS.cart);
    removeStorageItem(STORAGE_KEYS.answers);
    removeStorageItem(STORAGE_KEYS.sound);

    products = cloneDefaultProducts();
    cart = {};
    answers = {};
    soundOn = true;
    activeTaskId = null;

    renderAll();
    updateSoundButton();
    showFeedback("삭제 완료");
    playTone("save");
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
  pruneAnswers();
  saveJson(STORAGE_KEYS.cart, cart);
  saveJson(STORAGE_KEYS.answers, answers);

  renderSummary();
  renderProducts();
  renderCart();
  renderQuiz();
  renderAdminList();
}

function renderSummary() {
  const items = getCartItems();
  const tasks = getTasks();
  const correctCount = tasks.filter(isTaskCorrect).length;
  const quantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const total = getFinalTotal(items);

  ui.summaryKindCount.textContent = String(items.length);
  ui.summaryItemCount.textContent = String(quantity);
  ui.summaryCorrectCount.textContent = `${correctCount}/${tasks.length}`;
  ui.summaryFinalTotal.textContent = tasks.length > 0 && correctCount === tasks.length ? formatWon(total) : "?";
}

function renderProducts() {
  ui.productGrid.innerHTML = "";

  products.forEach(product => {
    const card = document.createElement("article");
    card.className = "product-card";
    card.dataset.id = product.id;

    const imgWrap = document.createElement("div");
    imgWrap.className = "product-img-wrap";

    const img = document.createElement("img");
    img.className = "product-img";
    img.src = product.image;
    img.alt = `${product.name} 사진`;
    img.onerror = () => { img.src = makeSvgImage("🛍️", "#e8f1ff", "물건"); };

    const badge = document.createElement("span");
    badge.className = product.discount > 0 ? "discount-badge" : "discount-badge no-sale";
    badge.textContent = product.discount > 0 ? `-${product.discount}%` : "0%";

    imgWrap.append(img, badge);

    const nameRow = document.createElement("div");
    nameRow.className = "product-name-row";

    const name = document.createElement("h3");
    name.textContent = product.name;

    const count = document.createElement("span");
    count.className = "product-count";
    count.textContent = cart[product.id] ? String(cart[product.id]) : "0";
    count.setAttribute("aria-label", `${product.name} 담은 수 ${count.textContent}`);

    nameRow.append(name, count);

    const priceRow = document.createElement("div");
    priceRow.className = "price-row";
    priceRow.append(makeChip("price-chip", formatWon(product.price)));

    const button = document.createElement("button");
    button.className = "add-button";
    button.type = "button";
    button.dataset.action = "add-to-cart";
    button.dataset.id = product.id;
    button.textContent = "+";
    button.setAttribute("aria-label", `${product.name} 담기`);

    card.append(imgWrap, nameRow, priceRow, button);
    ui.productGrid.appendChild(card);
  });
}

function renderCart() {
  const items = getCartItems();
  ui.cartList.innerHTML = "";

  if (items.length === 0) {
    ui.cartList.appendChild(makeEmptyCard("🛍️ +"));
    return;
  }

  items.forEach(item => {
    const { product, quantity } = item;

    const row = document.createElement("article");
    row.className = "cart-item";

    const img = document.createElement("img");
    img.className = "cart-thumb";
    img.src = product.image;
    img.alt = `${product.name} 사진`;
    img.onerror = () => { img.src = makeSvgImage("🛍️", "#e8f1ff", "물건"); };

    const main = document.createElement("div");
    main.className = "cart-main";

    const title = document.createElement("h3");
    title.textContent = product.name;

    const mini = document.createElement("div");
    mini.className = "cart-mini-row";
    mini.append(makeChip("price-chip", formatWon(product.price)));
    mini.append(makeChip(product.discount > 0 ? "sale-chip" : "price-chip", `${product.discount}%`));

    const qty = document.createElement("div");
    qty.className = "qty-row";
    qty.append(makeQtyButton("−", "decrease", product.id, `${product.name} 빼기`));
    qty.append(makeChip("qty-chip", `${quantity}개`));
    qty.append(makeQtyButton("+", "increase", product.id, `${product.name} 더하기`));

    const remove = document.createElement("button");
    remove.className = "remove-button";
    remove.type = "button";
    remove.dataset.action = "remove";
    remove.dataset.id = product.id;
    remove.textContent = "×";
    remove.setAttribute("aria-label", `${product.name} 삭제`);
    qty.append(remove);

    main.append(title, mini, qty);
    row.append(img, main);
    ui.cartList.appendChild(row);
  });
}

function renderQuiz() {
  const tasks = getTasks();
  ui.quizBox.innerHTML = "";

  if (tasks.length === 0) {
    activeTaskId = null;
    ui.quizBox.appendChild(makeEmptyCard("🛍️ → ✍️"));
    return;
  }

  const currentTask = tasks.find(task => !isTaskCorrect(task));
  if (!currentTask) {
    activeTaskId = null;
    ui.quizBox.appendChild(makeDoneCard());
    return;
  }

  activeTaskId = currentTask.id;
  const taskIndex = tasks.findIndex(task => task.id === currentTask.id) + 1;
  ui.quizBox.appendChild(makeTaskCard(currentTask, taskIndex, tasks.length));

  const input = document.getElementById("answerInput");
  if (input) {
    input.focus({ preventScroll: true });
    const length = input.value.length;
    input.setSelectionRange(length, length);
  }
}

function makeTaskCard(task, taskIndex, totalTasks) {
  const card = document.createElement("article");
  card.className = "task-card";

  const top = document.createElement("div");
  top.className = "task-top";
  top.append(makeBadge("task-count", `${taskIndex}/${totalTasks}`));
  top.append(makeBadge("task-kind", getTaskTitle(task)));

  const productBox = document.createElement("div");
  productBox.className = "task-product";

  if (task.type === "total") {
    const iconBox = document.createElement("div");
    iconBox.className = "task-total-icon";
    iconBox.style.fontSize = "4rem";
    iconBox.textContent = "🧾";

    const info = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = "합계";
    const chips = document.createElement("div");
    chips.className = "task-chips";
    chips.append(makeChip("qty-chip", `${getCartItems().length}종`));
    chips.append(makeChip("sale-chip", "모두 +"));
    info.append(title, chips);
    productBox.append(iconBox, info);
  } else {
    const img = document.createElement("img");
    img.src = task.product.image;
    img.alt = `${task.product.name} 사진`;
    img.onerror = () => { img.src = makeSvgImage("🛍️", "#e8f1ff", "물건"); };

    const info = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = task.product.name;

    const chips = document.createElement("div");
    chips.className = "task-chips";
    chips.append(makeChip("price-chip", formatWon(task.product.price)));
    chips.append(makeChip(task.product.discount > 0 ? "sale-chip" : "price-chip", `${task.product.discount}%`));
    if (task.quantity > 1) chips.append(makeChip("qty-chip", `${task.quantity}개`));

    info.append(title, chips);
    productBox.append(img, info);
  }

  const formula = document.createElement("div");
  formula.className = "big-formula";

  getFormulaTokens(task).forEach(token => {
    formula.appendChild(makeFormulaToken(token));
  });

  const answerWrap = document.createElement("label");
  answerWrap.className = "answer-wrap";
  answerWrap.setAttribute("aria-label", "답 입력");

  const input = document.createElement("input");
  input.id = "answerInput";
  input.type = "tel";
  input.inputMode = "numeric";
  input.pattern = "[0-9]*";
  input.autocomplete = "off";
  input.value = answers[task.id] || "";
  input.placeholder = "?";

  const won = document.createElement("span");
  won.textContent = "원";

  answerWrap.append(input, won);
  formula.appendChild(answerWrap);

  const actions = document.createElement("div");
  actions.className = "quiz-actions";

  const hint = document.createElement("button");
  hint.className = "hint-button";
  hint.type = "button";
  hint.dataset.action = "toggle-hint";
  hint.textContent = "💡";
  hint.setAttribute("aria-label", "힌트 보기");

  const check = document.createElement("button");
  check.className = "check-button";
  check.type = "button";
  check.dataset.action = "check-answer";
  check.textContent = "확인";

  actions.append(hint, check);

  const hintCard = document.createElement("div");
  hintCard.id = "hintCard";
  hintCard.className = "hint-card";
  hintCard.textContent = getHint(task);

  card.append(top, productBox, formula, actions, hintCard, makeKeypad());
  return card;
}

function makeEmptyCard(text) {
  const card = document.createElement("div");
  card.className = "empty-card";
  card.textContent = text;
  return card;
}

function makeDoneCard() {
  const total = getFinalTotal(getCartItems());
  const card = document.createElement("article");
  card.className = "done-card";

  const icon = document.createElement("div");
  icon.className = "done-icon";
  icon.textContent = "✅";

  const title = document.createElement("h3");
  title.textContent = "완료";

  const money = document.createElement("strong");
  money.textContent = formatWon(total);

  card.append(icon, title, money);
  return card;
}

function makeFormulaToken(token) {
  const span = document.createElement("span");
  span.className = token.isSymbol ? "symbol-token" : "formula-token";
  span.textContent = token.text;
  return span;
}

function makeKeypad() {
  const keypad = document.createElement("div");
  keypad.className = "keypad";

  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "00", "←", "지움"].forEach(key => {
    const button = document.createElement("button");
    button.className = key === "지움" ? "key-button wide-key" : "key-button";
    button.type = "button";
    button.dataset.key = key;
    button.textContent = key;
    keypad.appendChild(button);
  });

  return keypad;
}

function makeQtyButton(text, action, id, label) {
  const button = document.createElement("button");
  button.className = "qty-button";
  button.type = "button";
  button.dataset.action = action;
  button.dataset.id = id;
  button.textContent = text;
  button.setAttribute("aria-label", label);
  return button;
}

function makeChip(className, text) {
  const span = document.createElement("span");
  span.className = className;
  span.textContent = text;
  return span;
}

function makeBadge(className, text) {
  const span = document.createElement("span");
  span.className = className;
  span.textContent = text;
  return span;
}

function getFormulaTokens(task) {
  if (task.type === "discount") {
    return [
      token(formatWon(task.product.price)),
      symbol("×"),
      token(`${task.product.discount}%`),
      symbol("=")
    ];
  }

  if (task.type === "sale") {
    return [
      token(formatWon(task.product.price)),
      symbol("−"),
      token(formatWon(getDiscountAmount(task.product))),
      symbol("=")
    ];
  }

  if (task.type === "line") {
    return [
      token(formatWon(getSalePrice(task.product))),
      symbol("×"),
      token(`${task.quantity}개`),
      symbol("=")
    ];
  }

  const lineTotals = getCartItems().map(item => getLineTotal(item.product, item.quantity));
  const tokens = [];
  lineTotals.forEach((value, index) => {
    if (index > 0) tokens.push(symbol("+"));
    tokens.push(token(formatWon(value)));
  });
  tokens.push(symbol("="));
  return tokens;
}

function token(text) {
  return { text, isSymbol: false };
}

function symbol(text) {
  return { text, isSymbol: true };
}

function getTaskTitle(task) {
  if (task.type === "discount") return "🏷️ 할인";
  if (task.type === "sale") return "💰 1개";
  if (task.type === "line") return "✖️ 개수";
  return "🧾 합계";
}

function getHint(task) {
  if (task.type === "discount") return "정가 × %";
  if (task.type === "sale") return "정가 − 할인";
  if (task.type === "line") return "1개 × 개수";
  return "모두 +";
}

function pressKey(key) {
  const input = document.getElementById("answerInput");
  if (!input || !activeTaskId) return;

  let value = input.value;
  if (key === "←") value = value.slice(0, -1);
  else if (key === "지움") value = "";
  else value = `${value}${key}`;

  value = onlyDigits(value).replace(/^0+(?=\d)/, "");
  input.value = value;
  answers[activeTaskId] = value;
  saveJson(STORAGE_KEYS.answers, answers);
  input.focus({ preventScroll: true });
  renderSummary();
  playTone("tap");
}

function checkCurrentAnswer() {
  const tasks = getTasks();
  const currentTask = tasks.find(task => !isTaskCorrect(task));
  if (!currentTask) {
    celebrate("완료!");
    return;
  }

  const input = document.getElementById("answerInput");
  const value = input ? onlyDigits(input.value) : "";
  answers[currentTask.id] = value;
  saveJson(STORAGE_KEYS.answers, answers);

  if (value !== "" && Number(value) === currentTask.answer) {
    showFeedback("맞아요!");
    playTone("success");
    launchConfetti(12);
    setTimeout(() => renderAll(), 520);
  } else {
    showFeedback("한 번 더");
    playTone("remove");
    if (input) {
      input.focus({ preventScroll: true });
      input.select();
    }
    renderSummary();
  }
}

function toggleHint() {
  const hint = document.getElementById("hintCard");
  if (!hint) return;
  hint.classList.toggle("show");
  playTone("tap");
}

function addToCart(id) {
  const product = findProduct(id);
  if (!product) return;

  cart[id] = Math.min(99, (cart[id] || 0) + 1);
  saveJson(STORAGE_KEYS.cart, cart);
  renderAll();

  const card = ui.productGrid.querySelector(`[data-id="${cssEscape(id)}"]`);
  if (card) {
    card.classList.remove("pop");
    requestAnimationFrame(() => card.classList.add("pop"));
  }

  showFeedback("담았어요");
  playTone("tap");
}

function changeQuantity(id, amount) {
  const product = findProduct(id);
  if (!product) return;

  const next = Math.max(0, Math.min(99, (cart[id] || 0) + amount));
  if (next === 0) delete cart[id];
  else cart[id] = next;

  saveJson(STORAGE_KEYS.cart, cart);
  renderAll();
  showFeedback(next > 0 ? `${next}개` : "뺐어요");
  playTone(amount > 0 ? "tap" : "remove");
}

function removeFromCart(id) {
  delete cart[id];
  saveJson(STORAGE_KEYS.cart, cart);
  renderAll();
  showFeedback("뺐어요");
  playTone("remove");
}

async function handleAddProduct(event) {
  event.preventDefault();

  const name = ui.addNameInput.value.trim();
  const price = normalizePrice(ui.addPriceInput.value);
  const discount = normalizeDiscount(ui.addDiscountInput.value);
  const imageUrl = ui.addImageUrlInput.value.trim();
  const file = ui.addImageFileInput.files[0];

  if (!name) {
    showFeedback("이름 필요");
    ui.addNameInput.focus();
    return;
  }

  if (price === null) {
    showFeedback("정가 확인");
    ui.addPriceInput.focus();
    return;
  }

  if (discount === null) {
    showFeedback("0~100%" );
    ui.addDiscountInput.focus();
    return;
  }

  let image = makeSvgImage("🛍️", "#e8f1ff", name);

  try {
    if (file) image = await imageFileToDataUrl(file);
    else if (imageUrl) image = imageUrl;
  } catch (error) {
    showFeedback("사진 확인");
    return;
  }

  const product = { id: createProductId(), name, price, discount, image };
  products.push(product);

  if (!saveJson(STORAGE_KEYS.products, products)) {
    products = products.filter(item => item.id !== product.id);
    return;
  }

  ui.addProductForm.reset();
  ui.addDiscountInput.value = "0";
  answers = {};
  saveJson(STORAGE_KEYS.answers, answers);
  renderAll();
  celebrate("추가 완료");
}

async function handleSaveProduct(id, card) {
  const product = findProduct(id);
  if (!product || !card) return;

  const nameInput = card.querySelector(".edit-name");
  const priceInput = card.querySelector(".edit-price");
  const discountInput = card.querySelector(".edit-discount");
  const imageUrlInput = card.querySelector(".edit-image-url");
  const fileInput = card.querySelector(".edit-image-file");

  const name = nameInput.value.trim();
  const price = normalizePrice(priceInput.value);
  const discount = normalizeDiscount(discountInput.value);
  const imageUrl = imageUrlInput.value.trim();
  const file = fileInput.files[0];

  if (!name) {
    showFeedback("이름 필요");
    nameInput.focus();
    return;
  }

  if (price === null) {
    showFeedback("정가 확인");
    priceInput.focus();
    return;
  }

  if (discount === null) {
    showFeedback("0~100%" );
    discountInput.focus();
    return;
  }

  const backup = { ...product };

  try {
    product.name = name;
    product.price = price;
    product.discount = discount;

    if (file) product.image = await imageFileToDataUrl(file);
    else if (imageUrl) product.image = imageUrl;

    answers = {};
    activeTaskId = null;

    if (!saveJson(STORAGE_KEYS.products, products) || !saveJson(STORAGE_KEYS.answers, answers)) {
      Object.assign(product, backup);
      return;
    }

    renderAll();
    showFeedback("저장 완료");
    playTone("save");
  } catch (error) {
    Object.assign(product, backup);
    showFeedback("사진 확인");
  }
}

function handleDeleteProduct(id) {
  const product = findProduct(id);
  if (!product) return;

  const ok = window.confirm(`${product.name} 삭제?`);
  if (!ok) return;

  products = products.filter(item => item.id !== id);
  delete cart[id];
  answers = {};
  activeTaskId = null;

  saveJson(STORAGE_KEYS.products, products);
  saveJson(STORAGE_KEYS.cart, cart);
  saveJson(STORAGE_KEYS.answers, answers);
  renderAll();
  showFeedback("삭제 완료");
  playTone("remove");
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
    preview.alt = `${product.name} 사진`;
    preview.onerror = () => { preview.src = makeSvgImage("🛍️", "#e8f1ff", "물건"); };

    const fields = document.createElement("div");
    fields.className = "admin-card-fields";
    fields.append(makeAdminInput("이름", "text", "edit-name", product.name));
    fields.append(makeAdminInput("정가", "number", "edit-price", String(product.price), { min: "0", step: "10" }));
    fields.append(makeAdminInput("할인 %", "number", "edit-discount", String(product.discount), { min: "0", max: "100", step: "1" }));

    const imageUrl = product.image.startsWith("data:") ? "" : product.image;
    fields.append(makeAdminInput("사진 주소", "url", "edit-image-url", imageUrl));

    const fileLabel = document.createElement("label");
    const fileSpan = document.createElement("span");
    fileSpan.textContent = "사진 파일";
    const fileInput = document.createElement("input");
    fileInput.className = "edit-image-file";
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileLabel.append(fileSpan, fileInput);
    fields.append(fileLabel);

    const buttons = document.createElement("div");
    buttons.className = "admin-card-buttons";

    const save = document.createElement("button");
    save.className = "primary-button";
    save.type = "button";
    save.dataset.action = "save-product";
    save.dataset.id = product.id;
    save.textContent = "저장";

    const remove = document.createElement("button");
    remove.className = "danger-button";
    remove.type = "button";
    remove.dataset.action = "delete-product";
    remove.dataset.id = product.id;
    remove.textContent = "삭제";

    buttons.append(save, remove);
    card.append(preview, fields, buttons);
    ui.adminList.appendChild(card);
  });
}

function makeAdminInput(labelText, type, className, value, attrs = {}) {
  const label = document.createElement("label");
  const span = document.createElement("span");
  span.textContent = labelText;
  const input = document.createElement("input");
  input.type = type;
  input.className = className;
  input.value = value;
  Object.entries(attrs).forEach(([key, attrValue]) => input.setAttribute(key, attrValue));
  if (className === "edit-name") input.maxLength = 30;
  label.append(span, input);
  return label;
}

function getTasks() {
  const tasks = [];
  const items = getCartItems();

  items.forEach(item => {
    const { product, quantity } = item;
    const base = `${product.id}:${product.price}:${product.discount}`;

    tasks.push({
      id: `${base}:discount`,
      type: "discount",
      product,
      quantity,
      answer: getDiscountAmount(product)
    });

    tasks.push({
      id: `${base}:sale`,
      type: "sale",
      product,
      quantity,
      answer: getSalePrice(product)
    });

    tasks.push({
      id: `${base}:line:${quantity}`,
      type: "line",
      product,
      quantity,
      answer: getLineTotal(product, quantity)
    });
  });

  if (items.length > 0) {
    const hash = items.map(item => `${item.product.id}-${item.quantity}-${getLineTotal(item.product, item.quantity)}`).join("|");
    tasks.push({
      id: `total:${hash}`,
      type: "total",
      answer: getFinalTotal(items)
    });
  }

  return tasks;
}

function isTaskCorrect(task) {
  const value = answers[task.id];
  if (value === undefined || value === "") return false;
  return Number(value) === task.answer;
}

function areAllTasksCorrect(tasks) {
  return tasks.length > 0 && tasks.every(isTaskCorrect);
}

function pruneAnswers() {
  const validIds = new Set(getTasks().map(task => task.id));
  const nextAnswers = {};
  Object.entries(answers).forEach(([id, value]) => {
    if (validIds.has(id)) nextAnswers[id] = onlyDigits(value);
  });
  answers = nextAnswers;
}

function getCartItems() {
  return Object.entries(cart)
    .map(([id, quantity]) => {
      const product = findProduct(id);
      if (!product) return null;
      return { product, quantity: Math.max(0, Math.floor(Number(quantity))) };
    })
    .filter(item => item && item.quantity > 0);
}

function getDiscountAmount(product) {
  return Math.round(product.price * product.discount / 100);
}

function getSalePrice(product) {
  return Math.max(0, product.price - getDiscountAmount(product));
}

function getLineTotal(product, quantity) {
  return getSalePrice(product) * quantity;
}

function getFinalTotal(items) {
  return items.reduce((sum, item) => sum + getLineTotal(item.product, item.quantity), 0);
}

function findProduct(id) {
  return products.find(product => product.id === id);
}

function loadProducts() {
  const saved = readJson(STORAGE_KEYS.products, null);
  if (!Array.isArray(saved) || saved.length === 0) return cloneDefaultProducts();

  const normalized = saved
    .map(item => {
      const id = String(item.id || "").trim();
      const name = String(item.name || "").trim();
      const price = normalizePrice(item.price);
      const discount = normalizeDiscount(item.discount ?? 0);
      const image = String(item.image || "").trim();
      if (!id || !name || price === null || discount === null) return null;
      return { id, name: name.slice(0, 30), price, discount, image: image || makeSvgImage("🛍️", "#e8f1ff", name) };
    })
    .filter(Boolean);

  return normalized.length > 0 ? normalized : cloneDefaultProducts();
}

function loadCart(currentProducts) {
  const saved = readJson(STORAGE_KEYS.cart, {});
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {};
  return cleanCart(saved, currentProducts);
}

function loadAnswers() {
  const saved = readJson(STORAGE_KEYS.answers, {});
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {};

  const normalized = {};
  Object.entries(saved).forEach(([key, value]) => {
    normalized[key] = onlyDigits(value);
  });
  return normalized;
}

function loadSoundSetting() {
  return readJson(STORAGE_KEYS.sound, true) !== false;
}

function cleanCart(currentCart, currentProducts) {
  const ids = new Set(currentProducts.map(product => product.id));
  const cleaned = {};

  Object.entries(currentCart).forEach(([id, quantity]) => {
    const nextQuantity = Math.max(0, Math.min(99, Math.floor(Number(quantity))));
    if (ids.has(id) && nextQuantity > 0) cleaned[id] = nextQuantity;
  });

  return cleaned;
}

function normalizePrice(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return null;
  return Math.round(number);
}

function normalizeDiscount(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 100) return null;
  return Math.round(number);
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function cloneDefaultProducts() {
  return DEFAULT_PRODUCTS.map(product => ({ ...product }));
}

function formatWon(value) {
  return `₩${new Intl.NumberFormat("ko-KR").format(value)}`;
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
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.feedbackToast.classList.remove("show"), 1600);
}

function celebrate(message) {
  showFeedback(message);
  playTone("success");
  launchConfetti(28);
}

function launchConfetti(count = 20) {
  const symbols = ["⭐", "🎉", "👏", "✨", "💛", "🌟"];
  ui.confettiLayer.innerHTML = "";

  for (let index = 0; index < count; index += 1) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.textContent = symbols[index % symbols.length];
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.animationDelay = `${Math.random() * 0.22}s`;
    piece.style.setProperty("--fall-distance", `${70 + Math.random() * 24}vh`);
    ui.confettiLayer.appendChild(piece);
  }

  setTimeout(() => { ui.confettiLayer.innerHTML = ""; }, 1700);
}

function playTone(kind) {
  if (!soundOn) return;

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  try {
    if (!audioContext) audioContext = new AudioContextClass();
    if (audioContext.state === "suspended") audioContext.resume();

    const now = audioContext.currentTime;
    getNotes(kind).forEach((frequency, index) => {
      const start = now + index * 0.08;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.12, start + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.15);

      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.16);
    });
  } catch (error) {
    // 소리가 막혀도 학습 기능은 계속 작동합니다.
  }
}

function getNotes(kind) {
  if (kind === "success") return [523.25, 659.25, 783.99];
  if (kind === "save") return [440, 554.37];
  if (kind === "remove") return [392, 329.63];
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
    // 저장소 접근이 막혀도 화면은 유지합니다.
  }
}

async function imageFileToDataUrl(file) {
  if (!file.type.startsWith("image/")) throw new Error("이미지 파일만 사용할 수 있습니다.");

  const original = await readFileAsDataUrl(file);
  if (file.type === "image/svg+xml") return original;
  return resizeImageDataUrl(original, file.type);
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
      const type = mimeType === "image/png" ? "image/png" : "image/jpeg";
      resolve(canvas.toDataURL(type, 0.84));
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
      <circle cx="320" cy="185" r="128" fill="rgba(255,255,255,0.72)"/>
      <text x="320" y="222" text-anchor="middle" font-size="136" font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif">${safeEmoji}</text>
      <text x="320" y="350" text-anchor="middle" font-size="48" font-weight="800" fill="#172033" font-family="system-ui, sans-serif">${safeLabel}</text>
    </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function escapeSvgText(value) {
  return String(value).replace(/[&<>'"]/g, character => {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&apos;", '"': "&quot;" };
    return map[character];
  });
}

function cssEscape(value) {
  if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(value);
  return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}
