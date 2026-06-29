"use strict";

/*
  차근차근 할인 마켓 계산 연습 앱
  - 외부 라이브러리 없이 순수 HTML/CSS/JavaScript만 사용합니다.
  - 물건 목록, 장바구니, 소리 설정은 Local Storage에 저장합니다.
  - 교사는 관리 화면에서 물건 이름, 정가, 할인율, 사진을 수정할 수 있습니다.
  - 이전 버전의 저장 데이터에 할인율이 없어도 0% 할인으로 안전하게 읽습니다.
*/

const STORAGE_KEYS = {
  products: "stepMarket.products.v1",
  cart: "stepMarket.cart.v1",
  sound: "stepMarket.sound.v1"
};

// 기본 물건입니다. 실제 사진이 없어도 바로 실행되도록 간단한 그림을 SVG로 만듭니다.
const DEFAULT_PRODUCTS = [
  {
    id: "apple",
    name: "사과",
    price: 500,
    discountRate: 10,
    image: makeSvgImage("🍎", "#ffd7d7", "사과")
  },
  {
    id: "milk",
    name: "우유",
    price: 1200,
    discountRate: 0,
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
    discountRate: 15,
    image: makeSvgImage("🍌", "#fff2a8", "바나나")
  },
  {
    id: "juice",
    name: "주스",
    price: 1500,
    discountRate: 30,
    image: makeSvgImage("🧃", "#ffe0ef", "주스")
  },
  {
    id: "cookie",
    name: "쿠키",
    price: 700,
    discountRate: 0,
    image: makeSvgImage("🍪", "#efe2d0", "쿠키")
  }
];

const ui = {};
let products = [];
let cart = {};
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
  ui.summaryStrip = document.getElementById("summaryStrip");
  ui.productGrid = document.getElementById("productGrid");
  ui.cartList = document.getElementById("cartList");
  ui.calculationSteps = document.getElementById("calculationSteps");
  ui.totalBox = document.getElementById("totalBox");
  ui.resetCartButton = document.getElementById("resetCartButton");
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

  ui.resetCartButton.addEventListener("click", () => {
    cart = {};
    saveJson(STORAGE_KEYS.cart, cart);
    renderAll();
    showFeedback("장바구니를 비웠어요. 다시 천천히 해 보아요!");
    playTone("remove");
  });

  ui.celebrateButton.addEventListener("click", () => {
    const items = getCartItems();
    if (items.length === 0) {
      showFeedback("먼저 물건을 장바구니에 담아 보아요.");
      playTone("tap");
      return;
    }

    const summary = getCartSummary(items);
    if (summary.discountTotal > 0) {
      celebrate(`${formatWon(summary.discountTotal)}이나 아꼈어요! 계산을 끝까지 해냈어요! 👏`);
    } else {
      celebrate("끝까지 계산했어요! 정말 멋져요! 👏");
    }
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
    const ok = window.confirm("기본 물건으로 되돌릴까요? 현재 수정한 물건 정보는 사라져요.");
    if (!ok) return;

    products = cloneDefaultProducts();
    cart = {};
    saveJson(STORAGE_KEYS.products, products);
    saveJson(STORAGE_KEYS.cart, cart);
    renderAll();
    showFeedback("기본 물건으로 되돌렸어요.");
    playTone("save");
  });

  ui.clearAllButton.addEventListener("click", () => {
    const ok = window.confirm("이 브라우저에 저장된 물건과 장바구니 데이터를 모두 지울까요?");
    if (!ok) return;

    removeStorageItem(STORAGE_KEYS.products);
    removeStorageItem(STORAGE_KEYS.cart);
    removeStorageItem(STORAGE_KEYS.sound);
    products = cloneDefaultProducts();
    cart = {};
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

  renderSummary();
  renderProducts();
  renderCart();
  renderCalculation();
  renderAdminList();
}

function renderSummary() {
  const summary = getCartSummary(getCartItems());
  ui.summaryStrip.innerHTML = "";

  const cards = [
    { label: "담은 종류", value: `${summary.kinds}종류` },
    { label: "총 수량", value: `${summary.totalQuantity}개` },
    { label: "정가 합계", value: formatWon(summary.originalTotal) },
    { label: "할인 금액", value: `-${formatWon(summary.discountTotal)}`, className: "discount" },
    { label: "낼 금액", value: formatWon(summary.finalTotal), className: "positive" }
  ];

  cards.forEach(cardInfo => {
    const card = document.createElement("article");
    card.className = `summary-card ${cardInfo.className || ""}`.trim();

    const label = document.createElement("span");
    label.className = "summary-label";
    label.textContent = cardInfo.label;

    const value = document.createElement("span");
    value.className = "summary-value";
    value.textContent = cardInfo.value;

    card.append(label, value);
    ui.summaryStrip.appendChild(card);
  });
}

function renderProducts() {
  ui.productGrid.innerHTML = "";

  products.forEach(product => {
    const priceInfo = getPriceInfo(product);

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

    const badge = document.createElement("div");
    badge.className = "cart-badge";
    const currentQuantity = cart[product.id] || 0;
    badge.textContent = currentQuantity > 0 ? `${currentQuantity}개 담음` : "0개";

    imageWrap.append(image, badge);

    if (priceInfo.discountRate > 0) {
      const discountCorner = document.createElement("div");
      discountCorner.className = "discount-corner";
      discountCorner.textContent = `${priceInfo.discountRate}% 할인`;
      imageWrap.appendChild(discountCorner);
    }

    const mainRow = document.createElement("div");
    mainRow.className = "product-main-row";

    const name = document.createElement("h3");
    name.textContent = product.name;
    mainRow.appendChild(name);

    const priceStack = document.createElement("div");
    priceStack.className = "price-stack";

    const original = document.createElement("span");
    original.className = priceInfo.discountRate > 0 ? "original-price discounted" : "original-price";
    original.textContent = `정가 ${formatWon(priceInfo.originalUnit)}`;

    const sale = document.createElement("span");
    sale.className = "sale-price";
    sale.textContent = `한 개 ${formatWon(priceInfo.saleUnit)}`;

    const discountExplain = document.createElement("span");
    discountExplain.className = "discount-explain";
    discountExplain.textContent = priceInfo.discountRate > 0
      ? `${formatWon(priceInfo.discountUnit)} 절약`
      : "할인 없음";

    priceStack.append(original, sale, discountExplain);

    const button = document.createElement("button");
    button.className = "add-button";
    button.type = "button";
    button.dataset.action = "add-to-cart";
    button.dataset.id = product.id;
    button.textContent = "담기 +";
    button.setAttribute("aria-label", `${product.name} 장바구니에 담기`);

    card.append(imageWrap, mainRow, priceStack, button);
    ui.productGrid.appendChild(card);
  });
}

function renderCart() {
  const items = getCartItems();
  ui.cartList.innerHTML = "";

  if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "아직 담은 물건이 없어요. 물건을 골라 보세요.";
    ui.cartList.appendChild(empty);
    return;
  }

  items.forEach(item => {
    const { product, quantity, subtotal, discountSubtotal } = item;
    const priceInfo = getPriceInfo(product);

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

    const priceRow = document.createElement("div");
    priceRow.className = "cart-price-row";

    const original = document.createElement("span");
    original.className = "cart-original";
    original.textContent = `정가 ${formatWon(priceInfo.originalUnit)}`;

    const discount = document.createElement("span");
    discount.className = "cart-discount";
    discount.textContent = priceInfo.discountRate > 0 ? `-${priceInfo.discountRate}%` : "할인 0%";

    const sale = document.createElement("span");
    sale.className = "cart-sale";
    sale.textContent = `개당 ${formatWon(priceInfo.saleUnit)}`;

    priceRow.append(original, discount, sale);

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
    lineTotal.className = "line-total";
    lineTotal.textContent = `${formatWon(priceInfo.saleUnit)} × ${quantity}개 = ${formatWon(subtotal)}`;

    const savingLine = document.createElement("p");
    savingLine.className = "saving-line";
    savingLine.textContent = discountSubtotal > 0
      ? `정가보다 ${formatWon(discountSubtotal)} 아껴요`
      : "할인 금액은 0원이에요";

    info.append(title, priceRow, countPictures, quantityRow, lineTotal, savingLine);
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
    guide.textContent = "물건을 담으면 할인 계산과 곱하기 계산이 여기에 보여요.";
    ui.calculationSteps.appendChild(guide);
    renderTotalBox(summary);
    return;
  }

  const list = document.createElement("ol");
  list.className = "calculation-list";

  items.forEach((item, index) => {
    const priceInfo = getPriceInfo(item.product);

    const line = document.createElement("li");
    line.className = "calc-line";

    const number = document.createElement("span");
    number.className = "step-number";
    number.textContent = String(index + 1);

    const textWrap = document.createElement("span");

    const name = document.createElement("span");
    name.className = "calc-name";
    name.textContent = `${item.product.name} 계산`;

    const math = document.createElement("span");
    math.className = "calc-math";

    const discountStep = document.createElement("span");
    discountStep.className = "calc-saving";
    discountStep.textContent = priceInfo.discountRate > 0
      ? `할인: ${formatWon(priceInfo.originalUnit)} × ${priceInfo.discountRate}% = ${formatWon(priceInfo.discountUnit)} 깎임`
      : `할인: ${formatWon(priceInfo.originalUnit)} × 0% = 0원 깎임`;

    const unitStep = document.createElement("span");
    unitStep.textContent = `한 개 가격: ${formatWon(priceInfo.originalUnit)} - ${formatWon(priceInfo.discountUnit)} = ${formatWon(priceInfo.saleUnit)}`;

    const quantityStep = document.createElement("span");
    quantityStep.className = "calc-final";
    quantityStep.textContent = `수량 계산: ${formatWon(priceInfo.saleUnit)} × ${item.quantity}개 = ${formatWon(item.subtotal)}`;

    math.append(discountStep, unitStep, quantityStep);
    textWrap.append(name, math);
    line.append(number, textWrap);
    list.appendChild(line);
  });

  ui.calculationSteps.appendChild(list);

  const formula = document.createElement("div");
  formula.className = "sum-formula";
  formula.textContent = `모두 더하기: ${items.map(item => formatWon(item.subtotal)).join(" + ")} = ${formatWon(summary.finalTotal)}`;
  ui.calculationSteps.appendChild(formula);

  renderTotalBox(summary);
}

function renderTotalBox(summary) {
  const originalRow = document.createElement("div");
  originalRow.className = "total-row";
  originalRow.innerHTML = `<span>정가 합계</span><strong>${formatWon(summary.originalTotal)}</strong>`;

  const discountRow = document.createElement("div");
  discountRow.className = "total-row";
  discountRow.innerHTML = `<span>할인 금액</span><strong>-${formatWon(summary.discountTotal)}</strong>`;

  const finalRow = document.createElement("div");
  finalRow.className = "total-row final";

  const finalLabel = document.createElement("span");
  finalLabel.className = "total-label";
  finalLabel.textContent = "최종 낼 금액";

  const totalMoney = document.createElement("span");
  totalMoney.className = "total-money";
  totalMoney.textContent = formatWon(summary.finalTotal);

  finalRow.append(finalLabel, totalMoney);
  ui.totalBox.append(originalRow, discountRow, finalRow);
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

    const discountInput = makeInputField("할인율", "number", "edit-discount", String(getDiscountRate(product.discountRate)));
    const discountElement = discountInput.querySelector("input");
    discountElement.min = "0";
    discountElement.max = "100";
    discountElement.step = "1";

    const imageUrlValue = product.image.startsWith("data:") ? "" : product.image;
    const imageUrlInput = makeInputField("사진 주소", "url", "edit-image-url", imageUrlValue);
    imageUrlInput.querySelector("input").placeholder = "사진 파일을 쓰는 중이면 비워 두세요.";

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

  const visibleCount = Math.min(quantity, 10);
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
  saveJson(STORAGE_KEYS.cart, cart);
  renderAll();

  const card = ui.productGrid.querySelector(`[data-id="${cssEscape(id)}"]`);
  if (card) {
    card.classList.remove("pop");
    // 같은 카드를 연속으로 눌러도 애니메이션이 다시 보이도록 한 프레임 뒤에 붙입니다.
    window.requestAnimationFrame(() => card.classList.add("pop"));
  }

  const priceInfo = getPriceInfo(product);
  const discountMessage = priceInfo.discountRate > 0
    ? ` ${priceInfo.discountRate}% 할인으로 ${formatWon(priceInfo.discountUnit)} 아껴요!`
    : "";

  showFeedback(`${product.name}을/를 담았어요.${discountMessage}`);
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

  saveJson(STORAGE_KEYS.cart, cart);
  renderAll();
  showFeedback(`${product.name} ${nextQuantity}개로 바뀌었어요.`);
  playTone(amount > 0 ? "tap" : "remove");
}

function removeFromCart(id) {
  const product = findProduct(id);
  delete cart[id];
  saveJson(STORAGE_KEYS.cart, cart);
  renderAll();

  if (product) {
    showFeedback(`${product.name}을/를 장바구니에서 뺐어요.`);
  }
  playTone("remove");
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
    showFeedback("할인율은 0부터 100 사이 숫자로 적어 주세요.");
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
  celebrate(`${name} 물건을 새로 만들었어요!`);
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
    showFeedback("할인율은 0부터 100 사이 숫자로 적어 주세요.");
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

    renderAll();
    showFeedback(`${product.name} 정보를 저장했어요.`);
    playTone("save");
  } catch (error) {
    Object.assign(product, previousProduct);
    showFeedback("사진을 저장하지 못했어요. 더 작은 사진을 사용해 주세요.");
  }
}

function handleDeleteProduct(id) {
  const product = findProduct(id);
  if (!product) return;

  const ok = window.confirm(`${product.name}을/를 삭제할까요? 장바구니에서도 함께 빠져요.`);
  if (!ok) return;

  const previousProducts = products.slice();
  const previousCart = { ...cart };

  products = products.filter(item => item.id !== id);
  delete cart[id];

  const productsSaved = saveJson(STORAGE_KEYS.products, products);
  const cartSaved = saveJson(STORAGE_KEYS.cart, cart);

  if (!productsSaved || !cartSaved) {
    products = previousProducts;
    cart = previousCart;
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

      const priceInfo = getPriceInfo(product);
      const originalSubtotal = priceInfo.originalUnit * quantity;
      const subtotal = priceInfo.saleUnit * quantity;
      const discountSubtotal = originalSubtotal - subtotal;

      return {
        product,
        quantity,
        originalSubtotal,
        discountSubtotal,
        subtotal
      };
    })
    .filter(Boolean);
}

function getCartSummary(items) {
  return items.reduce(
    (summary, item) => {
      summary.kinds += 1;
      summary.totalQuantity += item.quantity;
      summary.originalTotal += item.originalSubtotal;
      summary.discountTotal += item.discountSubtotal;
      summary.finalTotal += item.subtotal;
      return summary;
    },
    {
      kinds: 0,
      totalQuantity: 0,
      originalTotal: 0,
      discountTotal: 0,
      finalTotal: 0
    }
  );
}

function getPriceInfo(product) {
  const originalUnit = normalizePrice(product.price) ?? 0;
  const discountRate = getDiscountRate(product.discountRate);
  const saleUnit = Math.max(0, Math.round(originalUnit * (100 - discountRate) / 100));
  const discountUnit = originalUnit - saleUnit;

  return {
    originalUnit,
    discountRate,
    discountUnit,
    saleUnit
  };
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
      const discountRate = normalizeDiscountRate(item.discountRate ?? 0);
      const name = String(item.name || "").trim();
      const id = String(item.id || "").trim();
      const image = String(item.image || "").trim();

      if (!id || !name || price === null || discountRate === null) return null;

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

function getDiscountRate(value) {
  return normalizeDiscountRate(value) ?? 0;
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
