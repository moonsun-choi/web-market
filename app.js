"use strict";

/*
  차근차근 마켓 계산 연습 앱 - 직접 풀이형

  핵심 변화
  1. 앱이 계산 결과를 먼저 보여 주지 않습니다.
  2. 학생이 직접 할인 금액, 할인 후 가격, 물건별 금액, 최종 총액을 입력합니다.
  3. 정답을 맞힌 칸만 결과를 보여 줍니다.
  4. 교사는 물건 이름, 정가, 할인율, 사진을 직접 수정할 수 있습니다.
  5. 물건 목록, 장바구니, 학생이 쓴 답, 소리 설정은 Local Storage에 저장됩니다.
*/

const STORAGE_KEYS = {
  products: "stepMarket.products.v1",
  cart: "stepMarket.cart.v1",
  practice: "stepMarket.practice.v1",
  sound: "stepMarket.sound.v1"
};

// 기본 물건입니다. 실제 사진 파일이 없어도 바로 보이도록 SVG 그림을 사용합니다.
const DEFAULT_PRODUCTS = [
  {
    id: "apple",
    name: "사과",
    price: 500,
    discountRate: 0,
    image: makeSvgImage("🍎", "#ffd7d7", "사과")
  },
  {
    id: "milk",
    name: "우유",
    price: 1200,
    discountRate: 10,
    image: makeSvgImage("🥛", "#dff1ff", "우유")
  },
  {
    id: "bread",
    name: "빵",
    price: 1000,
    discountRate: 20,
    image: makeSvgImage("🍞", "#ffe5bd", "빵")
  },
  {
    id: "banana",
    name: "바나나",
    price: 800,
    discountRate: 0,
    image: makeSvgImage("🍌", "#fff2a8", "바나나")
  },
  {
    id: "snack",
    name: "과자",
    price: 1500,
    discountRate: 15,
    image: makeSvgImage("🍪", "#ffe2c7", "과자")
  },
  {
    id: "juice",
    name: "주스",
    price: 2000,
    discountRate: 25,
    image: makeSvgImage("🧃", "#dfffe8", "주스")
  }
];

const ui = {};
let products = [];
let cart = {};
let practiceState = createEmptyPracticeState();
let soundOn = true;
let feedbackTimer = null;
let audioContext = null;

document.addEventListener("DOMContentLoaded", init);

function init() {
  // 자주 쓰는 화면 요소를 한 곳에 모아 둡니다.
  ui.studentPanel = document.getElementById("studentPanel");
  ui.adminPanel = document.getElementById("adminPanel");
  ui.studentModeButton = document.getElementById("studentModeButton");
  ui.adminModeButton = document.getElementById("adminModeButton");
  ui.soundButton = document.getElementById("soundButton");

  ui.summaryKindCount = document.getElementById("summaryKindCount");
  ui.summaryItemCount = document.getElementById("summaryItemCount");
  ui.summaryProblemCount = document.getElementById("summaryProblemCount");
  ui.summaryCorrectCount = document.getElementById("summaryCorrectCount");
  ui.summaryFinalTotal = document.getElementById("summaryFinalTotal");

  ui.productGrid = document.getElementById("productGrid");
  ui.cartList = document.getElementById("cartList");
  ui.calculationSteps = document.getElementById("calculationSteps");
  ui.totalBox = document.getElementById("totalBox");
  ui.resetCartButton = document.getElementById("resetCartButton");
  ui.checkAllButton = document.getElementById("checkAllButton");
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
  practiceState = loadPracticeState();
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
    showFeedback(soundOn ? "소리가 켜졌어요." : "소리가 꺼졌어요.");
    playTone(soundOn ? "save" : "tap");
  });

  // 물건 카드의 버튼을 눌렀을 때 장바구니에 담습니다.
  ui.productGrid.addEventListener("click", event => {
    const button = event.target.closest("[data-action='add-to-cart']");
    if (!button) return;
    addToCart(button.dataset.id);
  });

  // 장바구니 안의 +, -, 빼기 버튼을 처리합니다.
  ui.cartList.addEventListener("click", event => {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    const id = button.dataset.id;
    if (button.dataset.action === "increase") changeQuantity(id, 1);
    if (button.dataset.action === "decrease") changeQuantity(id, -1);
    if (button.dataset.action === "remove") removeFromCart(id);
  });

  // 학생이 답을 쓰면 일단 저장만 합니다. 정답 판정은 확인 버튼을 눌렀을 때 합니다.
  ui.calculationSteps.addEventListener("input", event => {
    const input = event.target.closest("[data-answer-key]");
    if (!input) return;

    const key = input.dataset.answerKey;
    practiceState.answers[key] = input.value;
    delete practiceState.checked[key];
    savePracticeState();

    const step = input.closest(".practice-step");
    if (step) {
      step.classList.remove("correct", "wrong");
      const status = step.querySelector(".answer-status");
      if (status) status.textContent = "확인 전";
    }
  });

  ui.calculationSteps.addEventListener("keydown", event => {
    const input = event.target.closest("[data-answer-key]");
    if (!input || event.key !== "Enter") return;
    event.preventDefault();
    checkSingleAnswer(input.dataset.answerKey, input.value);
  });

  ui.calculationSteps.addEventListener("click", event => {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    const key = button.dataset.key;

    if (button.dataset.action === "check-answer") {
      const step = button.closest(".practice-step");
      const input = step ? step.querySelector("[data-answer-key]") : null;
      checkSingleAnswer(key, input ? input.value : practiceState.answers[key]);
    }

    if (button.dataset.action === "toggle-hint") {
      practiceState.hints[key] = !practiceState.hints[key];
      savePracticeState();
      renderAll();
    }
  });

  ui.resetCartButton.addEventListener("click", () => {
    cart = {};
    practiceState = createEmptyPracticeState();
    saveJson(STORAGE_KEYS.cart, cart);
    savePracticeState();
    renderAll();
    showFeedback("장바구니와 쓴 답을 비웠어요. 다시 천천히 해 보아요!");
    playTone("remove");
  });

  ui.checkAllButton.addEventListener("click", () => {
    const items = getCartItems();
    if (items.length === 0) {
      showFeedback("먼저 물건을 장바구니에 담아 보아요.");
      playTone("tap");
      return;
    }

    const answers = getExpectedAnswers(items);
    answers.forEach(answer => {
      practiceState.checked[answer.key] = true;
    });
    savePracticeState();
    renderAll();

    const progress = getPracticeProgress(items);
    if (progress.correctCount === progress.totalCount) {
      celebrate("모든 답을 직접 맞혔어요! 정말 멋져요! 👏");
    } else {
      showFeedback(`아직 ${progress.totalCount - progress.correctCount}개를 더 풀 수 있어요. 다시 해 보아요!`);
      playTone("remove");
    }
  });

  ui.resetPracticeButton.addEventListener("click", () => {
    const items = getCartItems();
    if (items.length === 0) {
      showFeedback("지울 답이 아직 없어요.");
      playTone("tap");
      return;
    }

    practiceState = createEmptyPracticeState();
    savePracticeState();
    renderAll();
    showFeedback("쓴 답을 지웠어요. 처음부터 다시 풀어 보아요!");
    playTone("remove");
  });

  ui.celebrateButton.addEventListener("click", () => {
    const items = getCartItems();
    if (items.length === 0) {
      showFeedback("먼저 물건을 장바구니에 담아 보아요.");
      playTone("tap");
      return;
    }

    const progress = getPracticeProgress(items);
    if (progress.correctCount < progress.totalCount) {
      showFeedback(`아직 ${progress.totalCount - progress.correctCount}개 문제가 남았어요. 조금만 더 해 보아요!`);
      playTone("tap");
      return;
    }

    celebrate("스스로 계산을 끝냈어요! 최고예요! 🌟");
  });

  ui.addProductForm.addEventListener("submit", handleAddProduct);

  // 관리 화면의 저장, 삭제 버튼을 처리합니다.
  ui.adminList.addEventListener("click", event => {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    const card = button.closest(".admin-card");
    const id = button.dataset.id;

    if (button.dataset.action === "save-product") {
      handleSaveProduct(id, card);
    }

    if (button.dataset.action === "delete-product") {
      handleDeleteProduct(id);
    }
  });

  ui.resetProductsButton.addEventListener("click", () => {
    const ok = window.confirm("기본 물건으로 되돌릴까요? 현재 수정한 물건 정보와 학생 답은 사라져요.");
    if (!ok) return;

    products = cloneDefaultProducts();
    cart = {};
    practiceState = createEmptyPracticeState();
    saveJson(STORAGE_KEYS.products, products);
    saveJson(STORAGE_KEYS.cart, cart);
    savePracticeState();
    renderAll();
    showFeedback("기본 물건으로 되돌렸어요.");
    playTone("save");
  });

  ui.clearAllButton.addEventListener("click", () => {
    const ok = window.confirm("이 브라우저에 저장된 물건, 장바구니, 학생 답을 모두 지울까요?");
    if (!ok) return;

    removeStorageItem(STORAGE_KEYS.products);
    removeStorageItem(STORAGE_KEYS.cart);
    removeStorageItem(STORAGE_KEYS.practice);
    removeStorageItem(STORAGE_KEYS.sound);
    products = cloneDefaultProducts();
    cart = {};
    practiceState = createEmptyPracticeState();
    soundOn = true;
    renderAll();
    updateSoundButton();
    showFeedback("저장 데이터를 모두 지웠어요.");
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
  // 제품이 삭제되었을 때 장바구니에 남은 오래된 항목을 정리합니다.
  cart = cleanCart(cart, products);
  saveJson(STORAGE_KEYS.cart, cart);

  cleanPracticeState();
  savePracticeState();

  renderSummary();
  renderProducts();
  renderCart();
  renderCalculation();
  renderAdminList();
}

function renderSummary() {
  const items = getCartItems();
  const summary = getCartSummary(items);
  const progress = getPracticeProgress(items);
  const totalAnswerKey = makeTotalAnswerKey(items);
  const totalIsCorrect = items.length > 0 && isCheckedAndCorrect(totalAnswerKey, summary.finalTotal);

  ui.summaryKindCount.textContent = `${summary.kindCount}종류`;
  ui.summaryItemCount.textContent = `${summary.itemCount}개`;
  ui.summaryProblemCount.textContent = items.length > 0 ? `${progress.totalCount}문제` : "0문제";
  ui.summaryCorrectCount.textContent = items.length > 0 ? `${progress.correctCount}개` : "0개";
  ui.summaryFinalTotal.textContent = totalIsCorrect ? formatWon(summary.finalTotal) : "맞히면 공개";
}

function renderProducts() {
  ui.productGrid.innerHTML = "";

  products.forEach(product => {
    const card = document.createElement("article");
    card.className = "product-card";
    card.dataset.id = product.id;

    const imageWrap = document.createElement("div");
    imageWrap.className = "product-image-wrap";

    const image = document.createElement("img");
    image.className = "product-image";
    image.src = product.image;
    image.alt = `${product.name} 사진`;
    image.onerror = () => {
      image.src = makeSvgImage("🛍️", "#e7f0ff", "사진");
    };

    if (product.discountRate > 0) {
      const discountBadge = document.createElement("div");
      discountBadge.className = "discount-badge";
      discountBadge.textContent = `${product.discountRate}% 할인`;
      imageWrap.appendChild(discountBadge);
    }

    const badge = document.createElement("div");
    badge.className = "cart-badge";
    const currentQuantity = cart[product.id] || 0;
    badge.textContent = currentQuantity > 0 ? `담은 수 ${currentQuantity}` : "0개";

    imageWrap.append(image, badge);

    const name = document.createElement("h3");
    name.textContent = product.name;

    const priceTable = document.createElement("div");
    priceTable.className = "price-table";

    priceTable.appendChild(makePriceRow("정가", formatWon(product.price), "plain-price"));
    priceTable.appendChild(
      makePriceRow(
        "할인율",
        product.discountRate > 0 ? `${product.discountRate}%` : "0%",
        product.discountRate > 0 ? "discount-price" : "plain-price"
      )
    );
    priceTable.appendChild(makePriceRow("할인 후", "직접 계산", "practice-price"));

    const button = document.createElement("button");
    button.className = "add-button";
    button.type = "button";
    button.dataset.action = "add-to-cart";
    button.dataset.id = product.id;
    button.textContent = "담기 +";
    button.setAttribute(
      "aria-label",
      `${product.name} 장바구니에 담기. 정가 ${formatWon(product.price)}, 할인율 ${product.discountRate}퍼센트`
    );

    card.append(imageWrap, name, priceTable, button);
    ui.productGrid.appendChild(card);
  });
}

function makePriceRow(labelText, valueText, valueClassName) {
  const row = document.createElement("p");
  row.className = "price-row";

  const label = document.createElement("span");
  label.textContent = labelText;

  const value = document.createElement("strong");
  value.className = valueClassName || "";
  value.textContent = valueText;

  row.append(label, value);
  return row;
}

function renderCart() {
  const items = getCartItems();
  ui.cartList.innerHTML = "";

  if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "아직 담은 물건이 없어요. 왼쪽에서 물건을 골라 보세요.";
    ui.cartList.appendChild(empty);
    return;
  }

  items.forEach(item => {
    const { product, quantity } = item;
    const subtotalKey = makeItemAnswerKey(item, "subtotal");
    const subtotalSolved = isCheckedAndCorrect(subtotalKey, item.subtotal);

    const row = document.createElement("article");
    row.className = "cart-item";

    const image = document.createElement("img");
    image.className = "cart-thumb";
    image.src = product.image;
    image.alt = `${product.name} 작은 사진`;
    image.onerror = () => {
      image.src = makeSvgImage("🛍️", "#e7f0ff", "사진");
    };

    const info = document.createElement("div");
    info.className = "cart-info";

    const title = document.createElement("h3");
    title.textContent = product.name;

    const unitPrice = document.createElement("p");
    unitPrice.className = "unit-price";
    unitPrice.textContent = `정가 ${formatWon(product.price)} · 할인율 ${product.discountRate}%`;

    const discountLine = document.createElement("p");
    discountLine.className = "math-mini";
    discountLine.textContent = product.discountRate > 0
      ? "계산표에 할인 금액과 할인 후 가격을 직접 써요."
      : "할인율이 0%예요. 그래도 0원 할인부터 직접 써 보아요.";

    const countPictures = buildCountPictures(product, quantity);

    const quantityRow = document.createElement("div");
    quantityRow.className = "quantity-row";

    const decreaseButton = makeQuantityButton("−", "decrease", product.id, `${product.name} 한 개 빼기`);

    const quantityNumber = document.createElement("span");
    quantityNumber.className = "qty-number";
    quantityNumber.textContent = `${quantity}개`;

    const increaseButton = makeQuantityButton("+", "increase", product.id, `${product.name} 한 개 더 담기`);

    const removeButton = document.createElement("button");
    removeButton.className = "remove-button";
    removeButton.type = "button";
    removeButton.dataset.action = "remove";
    removeButton.dataset.id = product.id;
    removeButton.textContent = "빼기";

    quantityRow.append(decreaseButton, quantityNumber, increaseButton, removeButton);

    const lineTotal = document.createElement("p");
    lineTotal.className = subtotalSolved ? "line-total solved-total" : "line-total hidden-total";
    lineTotal.textContent = subtotalSolved
      ? `이 물건 금액 정답: ${formatWon(item.subtotal)}`
      : "이 물건 금액은 맞히면 보여요.";

    info.append(title, unitPrice, discountLine, countPictures, quantityRow, lineTotal);
    row.append(image, info);
    ui.cartList.appendChild(row);
  });
}

function renderCalculation() {
  const items = getCartItems();
  const summary = getCartSummary(items);
  ui.calculationSteps.innerHTML = "";
  ui.totalBox.innerHTML = "";

  if (items.length === 0) {
    const guide = document.createElement("div");
    guide.className = "empty-state";
    guide.textContent = "물건을 담으면 직접 풀 계산 문제가 여기에 나와요.";
    ui.calculationSteps.appendChild(guide);
    renderTotalBox(summary, items);
    return;
  }

  const list = document.createElement("div");
  list.className = "practice-list";

  items.forEach((item, index) => {
    const card = document.createElement("article");
    card.className = "practice-card";

    const header = document.createElement("div");
    header.className = "practice-card-header";

    const number = document.createElement("span");
    number.className = "step-number";
    number.textContent = String(index + 1);

    const headingWrap = document.createElement("div");

    const name = document.createElement("h3");
    name.textContent = `${item.product.name} 직접 계산`;

    const meta = document.createElement("p");
    meta.className = "practice-meta";
    meta.textContent = `정가 ${formatWon(item.product.price)} · 할인율 ${item.product.discountRate}% · 수량 ${item.quantity}개`;

    headingWrap.append(name, meta);
    header.append(number, headingWrap);

    const steps = document.createElement("div");
    steps.className = "practice-steps-grid";

    steps.appendChild(
      makePracticeStep({
        key: makeItemAnswerKey(item, "discount"),
        title: "① 깎이는 돈",
        formula: item.product.discountRate > 0
          ? `${formatWon(item.product.price)} × ${item.product.discountRate}% = ? 원`
          : `할인율 0% → 깎이는 돈은 ? 원`,
        hint: makeDiscountHint(item),
        expected: item.discountAmount,
        placeholder: "예: 120"
      })
    );

    steps.appendChild(
      makePracticeStep({
        key: makeItemAnswerKey(item, "sale"),
        title: "② 할인 후 한 개 가격",
        formula: "정가 - 깎이는 돈 = ? 원",
        hint: makeSalePriceHint(item),
        expected: item.salePrice,
        placeholder: "한 개 가격"
      })
    );

    steps.appendChild(
      makePracticeStep({
        key: makeItemAnswerKey(item, "subtotal"),
        title: "③ 이 물건 금액",
        formula: `할인 후 한 개 가격 × ${item.quantity}개 = ? 원`,
        hint: `②에서 맞힌 한 개 가격을 ${item.quantity}번 더하거나 곱해요.`,
        expected: item.subtotal,
        placeholder: "물건 금액"
      })
    );

    card.append(header, steps);
    list.appendChild(card);
  });

  ui.calculationSteps.appendChild(list);
  ui.calculationSteps.appendChild(makeFinalPracticeCard(items, summary));
  renderTotalBox(summary, items);
}

function makePracticeStep({ key, title, formula, hint, expected, placeholder }) {
  const checked = practiceState.checked[key] === true;
  const correct = checked && isPracticeCorrect(key, expected);
  const wrong = checked && !correct;
  const hintOpen = practiceState.hints[key] === true;

  const step = document.createElement("section");
  step.className = "practice-step";
  if (correct) step.classList.add("correct");
  if (wrong) step.classList.add("wrong");

  const titleElement = document.createElement("h4");
  titleElement.textContent = title;

  const formulaElement = document.createElement("p");
  formulaElement.className = "practice-formula";
  formulaElement.textContent = formula;

  const answerRow = document.createElement("div");
  answerRow.className = "answer-row";

  const input = document.createElement("input");
  input.className = "answer-input";
  input.type = "text";
  input.inputMode = "numeric";
  input.autocomplete = "off";
  input.placeholder = placeholder || "숫자만";
  input.value = practiceState.answers[key] || "";
  input.dataset.answerKey = key;
  input.setAttribute("aria-label", `${title} 답 입력`);

  const unit = document.createElement("span");
  unit.className = "answer-unit";
  unit.textContent = "원";

  const checkButton = document.createElement("button");
  checkButton.className = "secondary-button small-button check-answer-button";
  checkButton.type = "button";
  checkButton.dataset.action = "check-answer";
  checkButton.dataset.key = key;
  checkButton.textContent = "확인";

  const hintButton = document.createElement("button");
  hintButton.className = "secondary-button small-button hint-button";
  hintButton.type = "button";
  hintButton.dataset.action = "toggle-hint";
  hintButton.dataset.key = key;
  hintButton.textContent = hintOpen ? "힌트 닫기" : "힌트";

  answerRow.append(input, unit, checkButton, hintButton);

  const status = document.createElement("p");
  status.className = "answer-status";
  status.textContent = getAnswerStatusText(key, expected);

  step.append(titleElement, formulaElement, answerRow, status);

  if (hintOpen) {
    const hintBox = document.createElement("p");
    hintBox.className = "hint-box";
    hintBox.textContent = hint;
    step.appendChild(hintBox);
  }

  if (correct) {
    const reveal = document.createElement("p");
    reveal.className = "answer-reveal";
    reveal.textContent = `정답: ${formatWon(expected)}`;
    step.appendChild(reveal);
  }

  return step;
}

function makeFinalPracticeCard(items, summary) {
  const key = makeTotalAnswerKey(items);
  const visibleParts = items.map(item => {
    const subtotalKey = makeItemAnswerKey(item, "subtotal");
    return isCheckedAndCorrect(subtotalKey, item.subtotal) ? formatWon(item.subtotal) : "____원";
  });

  const card = document.createElement("article");
  card.className = "practice-card final-practice-card";

  const title = document.createElement("h3");
  title.textContent = "마지막: 모두 더하기";

  const guide = document.createElement("p");
  guide.className = "practice-meta";
  guide.textContent = "각 물건의 ③번 정답을 모두 더해서 최종으로 낼 돈을 써요.";

  const formula = visibleParts.length > 0
    ? `${visibleParts.join(" + ")} = ? 원`
    : "물건 금액을 모두 더해요.";

  const step = makePracticeStep({
    key,
    title: "④ 최종으로 낼 돈",
    formula,
    hint: "아직 ____원이 보이면 먼저 그 물건의 ③번을 맞혀 보아요. 그다음 보이는 금액을 모두 더해요.",
    expected: summary.finalTotal,
    placeholder: "최종 금액"
  });

  card.append(title, guide, step);
  return card;
}

function renderTotalBox(summary, items) {
  const totalLabel = document.createElement("span");
  totalLabel.className = "total-label";
  totalLabel.textContent = "최종으로 낼 돈";

  const totalMoney = document.createElement("span");
  totalMoney.className = "total-money";

  const totalNote = document.createElement("span");
  totalNote.className = "total-note";

  if (items.length === 0) {
    totalMoney.textContent = "준비 중";
    totalNote.textContent = "물건을 담고 직접 계산해 보아요.";
    ui.totalBox.classList.add("locked-total");
  } else {
    const totalKey = makeTotalAnswerKey(items);
    const totalIsCorrect = isCheckedAndCorrect(totalKey, summary.finalTotal);

    if (totalIsCorrect) {
      totalMoney.textContent = formatWon(summary.finalTotal);
      totalNote.textContent = "직접 맞혔어요. 아주 잘했어요!";
      ui.totalBox.classList.remove("locked-total");
    } else {
      totalMoney.textContent = "? 원";
      totalNote.textContent = "마지막 답을 맞히면 금액이 열려요.";
      ui.totalBox.classList.add("locked-total");
    }
  }

  ui.totalBox.append(totalLabel, totalMoney, totalNote);
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
      preview.src = makeSvgImage("🛍️", "#e7f0ff", "사진");
    };

    const content = document.createElement("div");

    const fields = document.createElement("div");
    fields.className = "admin-card-fields";

    const nameInput = makeInputField("이름", "text", "edit-name", product.name);
    nameInput.querySelector("input").maxLength = 30;

    const priceInput = makeInputField("정가", "number", "edit-price", String(product.price));
    const priceElement = priceInput.querySelector("input");
    priceElement.min = "0";
    priceElement.step = "10";

    const discountInput = makeInputField("할인율(%)", "number", "edit-discount", String(product.discountRate));
    const discountElement = discountInput.querySelector("input");
    discountElement.min = "0";
    discountElement.max = "100";
    discountElement.step = "1";

    const imageUrlValue = product.image.startsWith("data:") ? "" : product.image;
    const imageUrlInput = makeInputField("사진 주소", "url", "edit-image-url", imageUrlValue);
    imageUrlInput.querySelector("input").placeholder = "파일 사진을 쓰면 비워 둬요.";

    const fileLabel = document.createElement("label");
    fileLabel.className = "form-field";
    const fileText = document.createElement("span");
    fileText.textContent = "새 사진 파일";
    const fileInput = document.createElement("input");
    fileInput.className = "edit-image-file";
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileLabel.append(fileText, fileInput);

    fields.append(nameInput, priceInput, discountInput, imageUrlInput, fileLabel);

    const buttons = document.createElement("div");
    buttons.className = "admin-card-buttons";

    const saveButton = document.createElement("button");
    saveButton.className = "primary-button";
    saveButton.type = "button";
    saveButton.dataset.action = "save-product";
    saveButton.dataset.id = product.id;
    saveButton.textContent = "저장하기";

    const deleteButton = document.createElement("button");
    deleteButton.className = "danger-button";
    deleteButton.type = "button";
    deleteButton.dataset.action = "delete-product";
    deleteButton.dataset.id = product.id;
    deleteButton.textContent = "삭제하기";

    buttons.append(saveButton, deleteButton);
    content.append(fields, buttons);
    card.append(preview, content);
    ui.adminList.appendChild(card);
  });
}

function makeQuantityButton(text, action, id, label) {
  const button = document.createElement("button");
  button.className = "round-button";
  button.type = "button";
  button.dataset.action = action;
  button.dataset.id = id;
  button.textContent = text;
  button.setAttribute("aria-label", label);
  return button;
}

function makeInputField(labelText, type, className, value) {
  const label = document.createElement("label");
  label.className = "form-field";

  const span = document.createElement("span");
  span.textContent = labelText;

  const input = document.createElement("input");
  input.type = type;
  input.className = className;
  input.value = value;

  label.append(span, input);
  return label;
}

function buildCountPictures(product, quantity) {
  const wrap = document.createElement("div");
  wrap.className = "count-pictures";
  wrap.setAttribute("aria-label", `${product.name} ${quantity}개 그림으로 보기`);

  const visibleCount = Math.min(quantity, 8);
  for (let index = 0; index < visibleCount; index += 1) {
    const mini = document.createElement("img");
    mini.src = product.image;
    mini.alt = "";
    mini.onerror = () => {
      mini.src = makeSvgImage("🛍️", "#e7f0ff", "사진");
    };
    wrap.appendChild(mini);
  }

  if (quantity > visibleCount) {
    const more = document.createElement("span");
    more.className = "more-count";
    more.textContent = `+${quantity - visibleCount}`;
    wrap.appendChild(more);
  }

  return wrap;
}

function addToCart(id) {
  const product = findProduct(id);
  if (!product) return;

  cart[id] = Math.min((cart[id] || 0) + 1, 99);
  invalidateTotalAnswer();
  saveJson(STORAGE_KEYS.cart, cart);
  savePracticeState();
  renderAll();

  const card = ui.productGrid.querySelector(`[data-id="${cssEscape(id)}"]`);
  if (card) {
    card.classList.remove("pop");
    // 같은 카드를 연속으로 눌러도 애니메이션이 다시 보이도록 한 프레임 뒤에 붙입니다.
    window.requestAnimationFrame(() => card.classList.add("pop"));
  }

  const message = product.discountRate > 0
    ? `${product.name}을/를 담았어요. 이제 ${product.discountRate}% 할인 금액을 직접 구해 보아요!`
    : `${product.name}을/를 담았어요. 할인율 0%도 직접 써 보아요!`;
  showFeedback(message);
  playTone("tap");
}

function changeQuantity(id, amount) {
  const product = findProduct(id);
  if (!product) return;

  const nextQuantity = Math.max(0, Math.min((cart[id] || 0) + amount, 99));
  if (nextQuantity === 0) {
    delete cart[id];
  } else {
    cart[id] = nextQuantity;
  }

  invalidateTotalAnswer();
  saveJson(STORAGE_KEYS.cart, cart);
  savePracticeState();
  renderAll();
  showFeedback(`${product.name} ${nextQuantity}개로 바뀌었어요. 수량 계산을 다시 확인해요.`);
  playTone(amount > 0 ? "tap" : "remove");
}

function removeFromCart(id) {
  const product = findProduct(id);
  delete cart[id];
  invalidateTotalAnswer();
  saveJson(STORAGE_KEYS.cart, cart);
  savePracticeState();
  renderAll();

  if (product) {
    showFeedback(`${product.name}을/를 장바구니에서 뺐어요.`);
  }
  playTone("remove");
}

function checkSingleAnswer(key, rawValue) {
  const expectedMap = getExpectedAnswerMap(getCartItems());
  const expected = expectedMap.get(key);

  if (typeof expected !== "number") {
    showFeedback("지금 문제에서는 확인할 답이 없어요.");
    playTone("tap");
    return;
  }

  practiceState.answers[key] = rawValue || "";
  practiceState.checked[key] = true;
  savePracticeState();

  const studentValue = normalizeStudentNumber(practiceState.answers[key]);
  const correct = studentValue === expected;

  renderAll();

  if (correct) {
    const progress = getPracticeProgress(getCartItems());
    if (progress.correctCount === progress.totalCount && progress.totalCount > 0) {
      celebrate("모든 답을 직접 맞혔어요! 정말 멋져요! 👏");
    } else {
      showFeedback("정답이에요! 아주 잘했어요.");
      playTone("save");
    }
  } else if (studentValue === null) {
    showFeedback("숫자만 써 보아요. 예: 1200");
    playTone("tap");
  } else {
    showFeedback("조금 달라요. 힌트를 보고 다시 해 보아요.");
    playTone("remove");
  }
}

async function handleAddProduct(event) {
  event.preventDefault();

  const name = ui.addNameInput.value.trim();
  const price = normalizePrice(ui.addPriceInput.value);
  const discountRate = normalizeDiscountRate(ui.addDiscountInput.value);
  const imageUrl = ui.addImageUrlInput.value.trim();
  const file = ui.addImageFileInput.files[0];

  if (!name) {
    showFeedback("물건 이름을 적어 주세요.");
    ui.addNameInput.focus();
    return;
  }

  if (price === null) {
    showFeedback("정가는 0원 이상의 숫자로 적어 주세요.");
    ui.addPriceInput.focus();
    return;
  }

  if (discountRate === null) {
    showFeedback("할인율은 0부터 100까지 숫자로 적어 주세요.");
    ui.addDiscountInput.focus();
    return;
  }

  let image = makeSvgImage("🛍️", "#e7f0ff", name);

  try {
    if (file) {
      image = await imageFileToDataUrl(file);
    } else if (imageUrl) {
      image = imageUrl;
    }
  } catch (error) {
    showFeedback("사진을 읽지 못했어요. 다른 사진을 사용해 주세요.");
    return;
  }

  const product = {
    id: createProductId(),
    name,
    price,
    discountRate,
    image
  };

  products.push(product);

  if (!saveJson(STORAGE_KEYS.products, products)) {
    products = products.filter(item => item.id !== product.id);
    return;
  }

  ui.addProductForm.reset();
  ui.addDiscountInput.value = "0";
  renderAll();
  celebrate(`${name} 물건을 새로 만들었어요! 학생이 직접 계산할 수 있어요.`);
}

async function handleSaveProduct(id, card) {
  const product = findProduct(id);
  if (!product || !card) return;

  const nameInput = card.querySelector(".edit-name");
  const priceInput = card.querySelector(".edit-price");
  const discountInput = card.querySelector(".edit-discount");
  const imageUrlInput = card.querySelector(".edit-image-url");
  const fileInput = card.querySelector(".edit-image-file");

  const nextName = nameInput.value.trim();
  const nextPrice = normalizePrice(priceInput.value);
  const nextDiscountRate = normalizeDiscountRate(discountInput.value);
  const nextImageUrl = imageUrlInput.value.trim();
  const file = fileInput.files[0];

  if (!nextName) {
    showFeedback("물건 이름을 적어 주세요.");
    nameInput.focus();
    return;
  }

  if (nextPrice === null) {
    showFeedback("정가는 0원 이상의 숫자로 적어 주세요.");
    priceInput.focus();
    return;
  }

  if (nextDiscountRate === null) {
    showFeedback("할인율은 0부터 100까지 숫자로 적어 주세요.");
    discountInput.focus();
    return;
  }

  const previousProduct = { ...product };

  try {
    product.name = nextName;
    product.price = nextPrice;
    product.discountRate = nextDiscountRate;

    if (file) {
      product.image = await imageFileToDataUrl(file);
    } else if (nextImageUrl) {
      product.image = nextImageUrl;
    }

    if (!saveJson(STORAGE_KEYS.products, products)) {
      Object.assign(product, previousProduct);
      return;
    }

    cleanPracticeState();
    savePracticeState();
    renderAll();
    showFeedback(`${product.name} 정보를 저장했어요. 학생 답은 새 가격에 맞게 다시 확인해요.`);
    playTone("save");
  } catch (error) {
    Object.assign(product, previousProduct);
    showFeedback("사진을 저장하지 못했어요. 더 작은 사진을 사용해 주세요.");
  }
}

function handleDeleteProduct(id) {
  const product = findProduct(id);
  if (!product) return;

  const ok = window.confirm(`${product.name}을/를 삭제할까요? 장바구니와 학생 답에서도 함께 빠져요.`);
  if (!ok) return;

  const previousProducts = products.slice();
  const previousCart = { ...cart };
  const previousPracticeState = clonePracticeState(practiceState);

  products = products.filter(item => item.id !== id);
  delete cart[id];
  cleanPracticeState();

  const productsSaved = saveJson(STORAGE_KEYS.products, products);
  const cartSaved = saveJson(STORAGE_KEYS.cart, cart);
  const practiceSaved = savePracticeState();

  if (!productsSaved || !cartSaved || !practiceSaved) {
    products = previousProducts;
    cart = previousCart;
    practiceState = previousPracticeState;
    return;
  }

  renderAll();
  showFeedback(`${product.name}을/를 삭제했어요.`);
  playTone("remove");
}

function getCartItems() {
  return Object.entries(cart)
    .map(([id, quantity]) => {
      const product = findProduct(id);
      if (!product) return null;

      const discountRate = normalizeDiscountRate(product.discountRate) ?? 0;
      const discountAmount = getDiscountAmount(product.price, discountRate);
      const salePrice = Math.max(0, product.price - discountAmount);

      return {
        product,
        quantity,
        grossSubtotal: product.price * quantity,
        discountAmount,
        discountSubtotal: discountAmount * quantity,
        salePrice,
        subtotal: salePrice * quantity
      };
    })
    .filter(Boolean);
}

function getCartSummary(items = getCartItems()) {
  return items.reduce(
    (summary, item) => {
      summary.kindCount += 1;
      summary.itemCount += item.quantity;
      summary.grossTotal += item.grossSubtotal;
      summary.discountTotal += item.discountSubtotal;
      summary.finalTotal += item.subtotal;
      return summary;
    },
    {
      kindCount: 0,
      itemCount: 0,
      grossTotal: 0,
      discountTotal: 0,
      finalTotal: 0
    }
  );
}

function getExpectedAnswers(items = getCartItems()) {
  if (items.length === 0) return [];

  const answers = [];
  items.forEach(item => {
    answers.push({
      key: makeItemAnswerKey(item, "discount"),
      expected: item.discountAmount
    });
    answers.push({
      key: makeItemAnswerKey(item, "sale"),
      expected: item.salePrice
    });
    answers.push({
      key: makeItemAnswerKey(item, "subtotal"),
      expected: item.subtotal
    });
  });

  answers.push({
    key: makeTotalAnswerKey(items),
    expected: getCartSummary(items).finalTotal
  });

  return answers;
}

function getExpectedAnswerMap(items = getCartItems()) {
  const map = new Map();
  getExpectedAnswers(items).forEach(answer => {
    map.set(answer.key, answer.expected);
  });
  return map;
}

function getPracticeProgress(items = getCartItems()) {
  const answers = getExpectedAnswers(items);
  const correctCount = answers.filter(answer => isCheckedAndCorrect(answer.key, answer.expected)).length;

  return {
    totalCount: answers.length,
    correctCount
  };
}

function makeItemAnswerKey(item, stepName) {
  const quantityPart = stepName === "subtotal" ? `|qty:${item.quantity}` : "";
  return `item|${item.product.id}|${stepName}|price:${item.product.price}|rate:${item.product.discountRate}${quantityPart}`;
}

function makeTotalAnswerKey(items = getCartItems()) {
  return `cart|total|${getCartSignature(items)}`;
}

function getCartSignature(items = getCartItems()) {
  return items
    .map(item => `${item.product.id}:${item.quantity}:${item.product.price}:${item.product.discountRate}`)
    .sort()
    .join("~");
}

function isPracticeCorrect(key, expected) {
  return normalizeStudentNumber(practiceState.answers[key]) === expected;
}

function isCheckedAndCorrect(key, expected) {
  return practiceState.checked[key] === true && isPracticeCorrect(key, expected);
}

function getAnswerStatusText(key, expected) {
  if (practiceState.checked[key] !== true) {
    return "확인 전";
  }

  if (isPracticeCorrect(key, expected)) {
    return "정답이에요!";
  }

  return "다시 해 보아요.";
}

function makeDiscountHint(item) {
  if (item.product.discountRate === 0) {
    return "할인율이 0%면 깎이는 돈이 없어요. 숫자 0을 써 보아요.";
  }

  return `${item.product.discountRate}%는 100개 중 ${item.product.discountRate}개예요. 정가를 100으로 나누고 ${item.product.discountRate}를 곱해요.`;
}

function makeSalePriceHint(item) {
  const discountKey = makeItemAnswerKey(item, "discount");
  if (isCheckedAndCorrect(discountKey, item.discountAmount)) {
    return `정가 ${formatWon(item.product.price)}에서 방금 맞힌 ${formatWon(item.discountAmount)}을/를 빼요.`;
  }
  return "먼저 ① 깎이는 돈을 맞혀요. 그다음 정가에서 깎이는 돈을 빼요.";
}

function createEmptyPracticeState() {
  return {
    answers: {},
    checked: {},
    hints: {}
  };
}

function clonePracticeState(state) {
  return {
    answers: { ...state.answers },
    checked: { ...state.checked },
    hints: { ...state.hints }
  };
}

function loadPracticeState() {
  const saved = readJson(STORAGE_KEYS.practice, null);
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) {
    return createEmptyPracticeState();
  }

  return {
    answers: saved.answers && typeof saved.answers === "object" && !Array.isArray(saved.answers) ? saved.answers : {},
    checked: saved.checked && typeof saved.checked === "object" && !Array.isArray(saved.checked) ? saved.checked : {},
    hints: saved.hints && typeof saved.hints === "object" && !Array.isArray(saved.hints) ? saved.hints : {}
  };
}

function savePracticeState() {
  return saveJson(STORAGE_KEYS.practice, practiceState);
}

function cleanPracticeState() {
  const expectedKeys = new Set(getExpectedAnswers(getCartItems()).map(answer => answer.key));

  ["answers", "checked", "hints"].forEach(sectionName => {
    Object.keys(practiceState[sectionName]).forEach(key => {
      if (!expectedKeys.has(key)) {
        delete practiceState[sectionName][key];
      }
    });
  });
}

function invalidateTotalAnswer() {
  Object.keys(practiceState.answers).forEach(key => {
    if (key.startsWith("cart|total|")) delete practiceState.answers[key];
  });
  Object.keys(practiceState.checked).forEach(key => {
    if (key.startsWith("cart|total|")) delete practiceState.checked[key];
  });
  Object.keys(practiceState.hints).forEach(key => {
    if (key.startsWith("cart|total|")) delete practiceState.hints[key];
  });
}

function normalizeStudentNumber(value) {
  const cleaned = String(value ?? "")
    .replace(/원/g, "")
    .replace(/,/g, "")
    .replace(/\s/g, "")
    .trim();

  if (cleaned === "") return null;

  const number = Number(cleaned);
  if (!Number.isFinite(number)) return null;
  return Math.round(number);
}

function findProduct(id) {
  return products.find(product => product.id === id);
}

function cleanCart(currentCart, currentProducts) {
  const validIds = new Set(currentProducts.map(product => product.id));
  const cleaned = {};

  Object.entries(currentCart).forEach(([id, quantity]) => {
    const nextQuantity = Math.max(0, Math.min(99, Math.floor(Number(quantity))));
    if (validIds.has(id) && nextQuantity > 0) {
      cleaned[id] = nextQuantity;
    }
  });

  return cleaned;
}

function loadProducts() {
  const savedProducts = readJson(STORAGE_KEYS.products, null);

  if (!Array.isArray(savedProducts) || savedProducts.length === 0) {
    return cloneDefaultProducts();
  }

  const normalized = savedProducts
    .map(item => {
      const price = normalizePrice(item.price);
      const discountRate = normalizeDiscountRate(item.discountRate ?? 0) ?? 0;
      const name = String(item.name || "").trim();
      const id = String(item.id || "").trim();
      const image = String(item.image || "").trim();

      if (!id || !name || price === null) return null;

      return {
        id,
        name: name.slice(0, 30),
        price,
        discountRate,
        image: image || makeSvgImage("🛍️", "#e7f0ff", name)
      };
    })
    .filter(Boolean);

  return normalized.length > 0 ? normalized : cloneDefaultProducts();
}

function loadCart(currentProducts) {
  const savedCart = readJson(STORAGE_KEYS.cart, {});
  if (!savedCart || typeof savedCart !== "object" || Array.isArray(savedCart)) {
    return {};
  }
  return cleanCart(savedCart, currentProducts);
}

function loadSoundSetting() {
  const savedSound = readJson(STORAGE_KEYS.sound, true);
  return savedSound !== false;
}

function cloneDefaultProducts() {
  return DEFAULT_PRODUCTS.map(product => ({ ...product }));
}

function normalizePrice(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return null;
  return Math.round(number);
}

function normalizeDiscountRate(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 100) return null;
  return Math.round(number);
}

function getDiscountAmount(price, discountRate) {
  return Math.round(price * discountRate / 100);
}

function formatWon(value) {
  return `${new Intl.NumberFormat("ko-KR").format(value)}원`;
}

function createProductId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `product_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function updateSoundButton() {
  ui.soundButton.textContent = soundOn ? "🔊 소리 켜짐" : "🔇 소리 꺼짐";
  ui.soundButton.setAttribute("aria-pressed", String(soundOn));
}

function showFeedback(message) {
  ui.feedbackToast.textContent = message;
  ui.feedbackToast.classList.add("show");

  window.clearTimeout(feedbackTimer);
  feedbackTimer = window.setTimeout(() => {
    ui.feedbackToast.classList.remove("show");
  }, 2200);
}

function celebrate(message) {
  showFeedback(message);
  playTone("success");
  launchConfetti();
}

function launchConfetti() {
  const symbols = ["⭐", "🎉", "👏", "✨", "💛", "🌟"];
  ui.confettiLayer.innerHTML = "";

  for (let index = 0; index < 28; index += 1) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.textContent = symbols[index % symbols.length];
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.animationDelay = `${Math.random() * 0.22}s`;
    piece.style.setProperty("--fall-distance", `${72 + Math.random() * 24}vh`);
    ui.confettiLayer.appendChild(piece);
  }

  window.setTimeout(() => {
    ui.confettiLayer.innerHTML = "";
  }, 1800);
}

function playTone(kind) {
  if (!soundOn) return;

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  try {
    if (!audioContext) {
      audioContext = new AudioContextClass();
    }

    if (audioContext.state === "suspended") {
      audioContext.resume();
    }

    const now = audioContext.currentTime;
    const notes = getNotes(kind);

    notes.forEach((frequency, index) => {
      const start = now + index * 0.09;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, start);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.12, start + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);

      oscillator.connect(gain);
      gain.connect(audioContext.destination);

      oscillator.start(start);
      oscillator.stop(start + 0.17);
    });
  } catch (error) {
    // 일부 브라우저나 기기에서 소리 재생이 막힐 수 있습니다. 앱 사용에는 문제가 없습니다.
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
    showFeedback("저장 공간이 부족해요. 사진을 더 작은 파일로 바꿔 주세요.");
    return false;
  }
}

function removeStorageItem(key) {
  try {
    window.localStorage.removeItem(key);
  } catch (error) {
    // 저장소 접근이 막혀도 화면은 계속 사용할 수 있게 둡니다.
  }
}

async function imageFileToDataUrl(file) {
  if (!file.type.startsWith("image/")) {
    throw new Error("이미지 파일만 사용할 수 있습니다.");
  }

  const originalDataUrl = await readFileAsDataUrl(file);

  // SVG 파일은 캔버스로 줄이지 않고 그대로 저장합니다.
  if (file.type === "image/svg+xml") {
    return originalDataUrl;
  }

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

      // 사진 저장 공간을 아끼기 위해 JPEG는 품질을 조금 낮춥니다.
      const outputType = mimeType === "image/png" ? "image/png" : "image/jpeg";
      const result = canvas.toDataURL(outputType, 0.84);
      resolve(result);
    };

    image.onerror = () => {
      // 줄이기에 실패해도 원본은 사용할 수 있으므로 원본을 저장합니다.
      resolve(dataUrl);
    };

    image.src = dataUrl;
  });
}

function makeSvgImage(emoji, background, label) {
  const safeEmoji = escapeSvgText(emoji);
  const safeLabel = escapeSvgText(label);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420">
      <rect width="640" height="420" rx="42" fill="${background}"/>
      <circle cx="320" cy="190" r="132" fill="rgba(255,255,255,0.72)"/>
      <text x="320" y="224" text-anchor="middle" font-size="138" font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif">${safeEmoji}</text>
      <text x="320" y="352" text-anchor="middle" font-size="48" font-weight="800" fill="#172033" font-family="system-ui, sans-serif">${safeLabel}</text>
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

function cssEscape(value) {
  if (window.CSS && typeof window.CSS.escape === "function") {
    return window.CSS.escape(value);
  }
  return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}
