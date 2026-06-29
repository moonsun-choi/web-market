/* =========================================================
  계산이 쉬워지는 우리 반 마켓
  ---------------------------------------------------------
  이 파일은 외부 라이브러리 없이 순수 JavaScript만 사용합니다.

  주요 기능
  1. 학생이 상품을 장바구니에 담기
  2. 단가 × 수량 계산 과정을 단계별로 보여 주기
  3. 상품별 할인율과 쿠폰 할인율 적용하기
  4. 교사가 상품 이름, 가격, 사진, 할인율을 수정하기
  5. 수정한 상품 정보를 브라우저 저장소(localStorage)에 저장하기

  주의
  - 이 앱은 수업용 예시입니다.
  - 교사용 PIN은 실제 보안 장치가 아니라 학생이 실수로 누르는 것을 줄이기 위한 간단한 장치입니다.
========================================================= */


/* =========================
  1. 기본 설정
========================= */

// 교사용 관리 화면을 열 때 사용할 PIN입니다.
// 필요하면 이 값을 다른 숫자로 바꾸세요.
const TEACHER_PIN = "1234";

// 브라우저 저장소에 상품 목록을 저장할 때 사용할 이름입니다.
const STORAGE_KEY = "classMarketProducts_v1";

// 현재 상품 목록입니다.
// 처음에는 아래의 기본 상품을 사용하고,
// 교사가 수정하면 localStorage에 저장된 상품을 불러옵니다.
let products = [];

// 장바구니 목록입니다.
// 예: [{ productId: "apple", quantity: 2 }]
let cart = [];

// 학생이 마지막으로 살펴본 상품입니다.
// 계산 설명 화면에서 어떤 상품을 보여 줄지 정할 때 사용합니다.
let selectedProductId = null;

// 교사용 입력 폼에서 파일로 선택한 이미지를 잠시 보관합니다.
let selectedImageData = "";


/* =========================
  2. 화면 요소 찾기
========================= */

const productGrid = document.getElementById("productGrid");
const cartItems = document.getElementById("cartItems");
const cartTotal = document.getElementById("cartTotal");
const calcSteps = document.getElementById("calcSteps");

const couponRate = document.getElementById("couponRate");
const clearCartBtn = document.getElementById("clearCartBtn");

const teacherLoginBtn = document.getElementById("teacherLoginBtn");
const teacherLogoutBtn = document.getElementById("teacherLogoutBtn");
const teacherPanel = document.getElementById("teacherPanel");

const teacherForm = document.getElementById("teacherForm");
const teacherFormTitle = document.getElementById("teacherFormTitle");
const teacherProductList = document.getElementById("teacherProductList");

const editingProductId = document.getElementById("editingProductId");
const productName = document.getElementById("productName");
const productPrice = document.getElementById("productPrice");
const productDiscount = document.getElementById("productDiscount");
const productImageUrl = document.getElementById("productImageUrl");
const productImageFile = document.getElementById("productImageFile");
const imagePreview = document.getElementById("imagePreview");

const clearTeacherFormBtn = document.getElementById("clearTeacherFormBtn");
const resetProductsBtn = document.getElementById("resetProductsBtn");


/* =========================
  3. 앱 시작
========================= */

document.addEventListener("DOMContentLoaded", () => {
  products = loadProducts();

  renderProducts();
  renderCart();
  renderCalculationSteps();
  renderTeacherProducts();

  connectEvents();
});


/* =========================
  4. 기본 상품 만들기
========================= */

function getDefaultProducts() {
  return [
    {
      id: "apple",
      name: "사과",
      price: 1200,
      discount: 0,
      image: makeSvgImage("사과", "#ff6b6b", "#ffe3e3")
    },
    {
      id: "pencil",
      name: "연필",
      price: 500,
      discount: 10,
      image: makeSvgImage("연필", "#f59e0b", "#fff7ed")
    },
    {
      id: "notebook",
      name: "공책",
      price: 1800,
      discount: 0,
      image: makeSvgImage("공책", "#4f7cff", "#e0ecff")
    },
    {
      id: "juice",
      name: "주스",
      price: 1500,
      discount: 20,
      image: makeSvgImage("주스", "#22c55e", "#dcfce7")
    }
  ];
}

// 기본 상품에 사용할 간단한 그림을 SVG로 만듭니다.
// 이렇게 하면 인터넷이 없어도 상품 사진이 화면에 나타납니다.
function makeSvgImage(text, mainColor, bgColor) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
      <rect width="600" height="400" fill="${bgColor}"/>
      <circle cx="300" cy="170" r="82" fill="${mainColor}" opacity="0.95"/>
      <circle cx="260" cy="145" r="18" fill="white" opacity="0.35"/>
      <text x="300" y="320" font-size="58" font-family="Arial, sans-serif" text-anchor="middle" fill="#243044" font-weight="800">${text}</text>
    </svg>
  `;

  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
}


/* =========================
  5. 저장소 다루기
========================= */

function loadProducts() {
  const saved = localStorage.getItem(STORAGE_KEY);

  // 저장된 상품이 없으면 기본 상품을 사용합니다.
  if (!saved) {
    return getDefaultProducts();
  }

  try {
    const parsed = JSON.parse(saved);

    // 저장된 값이 배열이면 사용합니다.
    if (Array.isArray(parsed)) {
      return parsed;
    }

    // 혹시 저장된 값이 이상하면 기본 상품을 사용합니다.
    return getDefaultProducts();
  } catch (error) {
    console.error("상품 정보를 불러오는 중 문제가 생겼습니다.", error);
    return getDefaultProducts();
  }
}

function saveProducts() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
}


/* =========================
  6. 이벤트 연결하기
========================= */

function connectEvents() {
  // 학생이 상품 카드에서 버튼을 누를 때
  productGrid.addEventListener("click", handleProductGridClick);

  // 장바구니에서 +, -, 삭제 버튼을 누를 때
  cartItems.addEventListener("click", handleCartClick);

  // 쿠폰 할인율이 바뀌면 금액을 다시 계산합니다.
  couponRate.addEventListener("change", () => {
    renderCart();
    renderCalculationSteps();
  });

  // 장바구니 비우기
  clearCartBtn.addEventListener("click", () => {
    cart = [];
    selectedProductId = null;
    renderCart();
    renderCalculationSteps();
  });

  // 교사용 관리 열기
  teacherLoginBtn.addEventListener("click", openTeacherPanel);

  // 교사용 관리 닫기
  teacherLogoutBtn.addEventListener("click", closeTeacherPanel);

  // 교사용 상품 저장
  teacherForm.addEventListener("submit", handleTeacherFormSubmit);

  // 사진 파일 선택
  productImageFile.addEventListener("change", handleImageFileChange);

  // 사진 URL 입력 시 미리보기
  productImageUrl.addEventListener("input", () => {
    selectedImageData = "";
    imagePreview.src = productImageUrl.value.trim();
  });

  // 교사용 입력 칸 비우기
  clearTeacherFormBtn.addEventListener("click", resetTeacherForm);

  // 기본 상품으로 되돌리기
  resetProductsBtn.addEventListener("click", resetProductsToDefault);

  // 교사용 상품 목록에서 수정, 삭제 버튼 누르기
  teacherProductList.addEventListener("click", handleTeacherProductListClick);
}


/* =========================
  7. 학생용 상품 화면 그리기
========================= */

function renderProducts() {
  productGrid.innerHTML = "";

  products.forEach((product) => {
    const card = document.createElement("article");
    card.className = "product-card";

    card.innerHTML = `
      <div class="product-image-wrap">
        <img src="${escapeAttribute(product.image)}" alt="${escapeAttribute(product.name)} 사진" />
        ${
          product.discount > 0
            ? `<span class="discount-badge">${product.discount}% 할인</span>`
            : ""
        }
      </div>

      <div class="product-body">
        <h3>${escapeHtml(product.name)}</h3>

        <div class="price-line">
          <strong>${formatWon(product.price)}</strong>
          <span>1개 가격</span>
        </div>

        <div class="quantity-row">
          <label for="qty-${product.id}">몇 개 살까요?</label>
          <input
            id="qty-${product.id}"
            type="number"
            min="1"
            max="99"
            value="1"
            data-quantity-input="${product.id}"
          />
        </div>

        <div class="product-actions">
          <button class="primary-button" data-add-product="${product.id}">
            장바구니에 담기
          </button>
          <button class="small-button" data-practice-product="${product.id}">
            계산 먼저 보기
          </button>
        </div>
      </div>
    `;

    productGrid.appendChild(card);
  });
}

function handleProductGridClick(event) {
  const addButton = event.target.closest("[data-add-product]");
  const practiceButton = event.target.closest("[data-practice-product]");

  if (addButton) {
    const productId = addButton.dataset.addProduct;
    const quantity = getQuantityFromProductCard(productId);

    addToCart(productId, quantity);
    selectedProductId = productId;

    renderCart();
    renderCalculationSteps();
  }

  if (practiceButton) {
    const productId = practiceButton.dataset.practiceProduct;
    selectedProductId = productId;

    renderCalculationSteps();
  }
}

function getQuantityFromProductCard(productId) {
  const quantityInput = document.querySelector(`[data-quantity-input="${productId}"]`);
  const quantity = Number(quantityInput.value);

  // 수량은 최소 1개입니다.
  if (!Number.isFinite(quantity) || quantity < 1) {
    quantityInput.value = 1;
    return 1;
  }

  return Math.floor(quantity);
}


/* =========================
  8. 장바구니 기능
========================= */

function addToCart(productId, quantity) {
  const existingItem = cart.find((item) => item.productId === productId);

  // 이미 장바구니에 있는 물건이면 수량만 더합니다.
  if (existingItem) {
    existingItem.quantity += quantity;
    return;
  }

  // 처음 담는 물건이면 새로 추가합니다.
  cart.push({
    productId,
    quantity
  });
}

function handleCartClick(event) {
  const increaseButton = event.target.closest("[data-increase]");
  const decreaseButton = event.target.closest("[data-decrease]");
  const removeButton = event.target.closest("[data-remove]");

  if (increaseButton) {
    const productId = increaseButton.dataset.increase;
    changeCartQuantity(productId, 1);
  }

  if (decreaseButton) {
    const productId = decreaseButton.dataset.decrease;
    changeCartQuantity(productId, -1);
  }

  if (removeButton) {
    const productId = removeButton.dataset.remove;
    removeFromCart(productId);
  }

  renderCart();
  renderCalculationSteps();
}

function changeCartQuantity(productId, amount) {
  const item = cart.find((cartItem) => cartItem.productId === productId);

  if (!item) {
    return;
  }

  item.quantity += amount;

  // 수량이 0개 이하가 되면 장바구니에서 빼줍니다.
  if (item.quantity <= 0) {
    removeFromCart(productId);
  } else {
    selectedProductId = productId;
  }
}

function removeFromCart(productId) {
  cart = cart.filter((item) => item.productId !== productId);

  if (selectedProductId === productId) {
    selectedProductId = cart.length > 0 ? cart[0].productId : null;
  }
}

function renderCart() {
  cartItems.innerHTML = "";

  if (cart.length === 0) {
    cartItems.innerHTML = `
      <p class="empty-message">
        아직 장바구니가 비어 있어요. 마음에 드는 물건을 담아 볼까요?
      </p>
    `;
    cartTotal.textContent = "0원";
    return;
  }

  cart.forEach((item) => {
    const product = getProductById(item.productId);

    if (!product) {
      return;
    }

    const calculation = calculateItem(product, item.quantity);

    const itemElement = document.createElement("article");
    itemElement.className = "cart-item";

    itemElement.innerHTML = `
      <img src="${escapeAttribute(product.image)}" alt="${escapeAttribute(product.name)} 사진" />

      <div>
        <h4>${escapeHtml(product.name)}</h4>
        <p>
          ${formatWon(product.price)} × ${item.quantity}개
          ${
            product.discount > 0
              ? ` → ${product.discount}% 할인`
              : ""
          }
        </p>
        <p><strong>${formatWon(calculation.finalPrice)}</strong></p>

        <div class="cart-controls">
          <button class="round-control" data-decrease="${product.id}" aria-label="${escapeAttribute(product.name)} 수량 줄이기">−</button>
          <button class="round-control" data-increase="${product.id}" aria-label="${escapeAttribute(product.name)} 수량 늘리기">+</button>
          <button class="remove-button" data-remove="${product.id}">빼기</button>
        </div>
      </div>
    `;

    cartItems.appendChild(itemElement);
  });

  const totalCalculation = calculateCartTotal();
  cartTotal.textContent = formatWon(totalCalculation.finalTotal);
}


/* =========================
  9. 계산하기
========================= */

function calculateItem(product, quantity) {
  const subtotal = product.price * quantity;
  const discountAmount = Math.round(subtotal * product.discount / 100);
  const finalPrice = subtotal - discountAmount;

  return {
    subtotal,
    discountAmount,
    finalPrice
  };
}

function calculateCartTotal() {
  let beforeCouponTotal = 0;

  cart.forEach((item) => {
    const product = getProductById(item.productId);

    if (!product) {
      return;
    }

    const itemCalculation = calculateItem(product, item.quantity);
    beforeCouponTotal += itemCalculation.finalPrice;
  });

  const couponPercent = Number(couponRate.value);
  const couponDiscount = Math.round(beforeCouponTotal * couponPercent / 100);
  const finalTotal = beforeCouponTotal - couponDiscount;

  return {
    beforeCouponTotal,
    couponPercent,
    couponDiscount,
    finalTotal
  };
}

function renderCalculationSteps() {
  calcSteps.innerHTML = "";

  if (!selectedProductId) {
    calcSteps.innerHTML = `
      <p class="empty-message">
        물건을 하나 고르면 계산 과정이 여기에 나타나요.
      </p>
    `;
    return;
  }

  const product = getProductById(selectedProductId);

  if (!product) {
    calcSteps.innerHTML = `
      <p class="empty-message">
        선택한 물건을 찾을 수 없어요. 다른 물건을 골라 볼까요?
      </p>
    `;
    return;
  }

  const cartItem = cart.find((item) => item.productId === selectedProductId);
  const quantity = cartItem
    ? cartItem.quantity
    : getQuantityFromProductCard(selectedProductId);

  const itemCalculation = calculateItem(product, quantity);
  const cartCalculation = calculateCartTotal();

  const itemDiscountStep = product.discount > 0
    ? `
      <div class="step-card">
        <strong>2단계: 물건 할인 계산하기</strong>
        <p>
          ${product.name}은 ${product.discount}% 할인이에요.
          먼저 할인되는 금액을 구해요.
        </p>
        <div class="math-line">
          ${formatWon(itemCalculation.subtotal)} × ${product.discount}% = ${formatWon(itemCalculation.discountAmount)}
        </div>
      </div>

      <div class="step-card">
        <strong>3단계: 할인 후 금액 구하기</strong>
        <p>
          원래 금액에서 할인 금액을 빼면 실제로 내야 할 금액이 됩니다.
        </p>
        <div class="math-line">
          ${formatWon(itemCalculation.subtotal)} − ${formatWon(itemCalculation.discountAmount)}
          = ${formatWon(itemCalculation.finalPrice)}
        </div>
      </div>
    `
    : `
      <div class="step-card">
        <strong>2단계: 할인 확인하기</strong>
        <p>
          이 물건은 상품 할인이 없어요. 그래서 그대로 ${formatWon(itemCalculation.finalPrice)}입니다.
        </p>
      </div>
    `;

  calcSteps.innerHTML = `
    <div class="step-card">
      <strong>1단계: 단가와 수량 곱하기</strong>
      <p>
        ${product.name}의 1개 가격은 ${formatWon(product.price)}이고,
        수량은 ${quantity}개예요.
      </p>
      <div class="math-line">
        ${formatWon(product.price)} × ${quantity}개 = ${formatWon(itemCalculation.subtotal)}
      </div>
    </div>

    ${itemDiscountStep}

    <div class="step-card">
      <strong>장바구니 전체도 함께 계산해요</strong>
      <p>
        장바구니에 담긴 물건들의 할인 후 금액을 모두 더했어요.
      </p>
      <div class="math-line">
        물건 합계 = ${formatWon(cartCalculation.beforeCouponTotal)}
      </div>
    </div>

    <div class="step-card">
      <strong>쿠폰 할인 적용하기</strong>
      <p>
        쿠폰 할인율은 ${cartCalculation.couponPercent}%입니다.
      </p>
      <div class="math-line">
        ${formatWon(cartCalculation.beforeCouponTotal)} × ${cartCalculation.couponPercent}%
        = ${formatWon(cartCalculation.couponDiscount)} 할인
      </div>
    </div>

    <div class="step-card good-message">
      <strong>마지막 단계: 최종 금액 확인하기</strong>
      <p>
        아주 잘했어요. 합계에서 쿠폰 할인을 빼면 최종 결제 금액이 됩니다.
      </p>
      <div class="math-line">
        ${formatWon(cartCalculation.beforeCouponTotal)} − ${formatWon(cartCalculation.couponDiscount)}
        = ${formatWon(cartCalculation.finalTotal)}
      </div>
    </div>
  `;
}


/* =========================
  10. 교사용 관리 화면
========================= */

function openTeacherPanel() {
  const pin = window.prompt("교사용 PIN을 입력해 주세요.");

  if (pin !== TEACHER_PIN) {
    window.alert("PIN이 맞지 않아요.");
    return;
  }

  teacherPanel.classList.remove("hidden");
  teacherLoginBtn.classList.add("hidden");
  teacherLogoutBtn.classList.remove("hidden");

  renderTeacherProducts();
}

function closeTeacherPanel() {
  teacherPanel.classList.add("hidden");
  teacherLoginBtn.classList.remove("hidden");
  teacherLogoutBtn.classList.add("hidden");
  resetTeacherForm();
}

function handleTeacherFormSubmit(event) {
  event.preventDefault();

  const idBeingEdited = editingProductId.value;

  const name = productName.value.trim();
  const price = Number(productPrice.value);
  const discount = Number(productDiscount.value || 0);
  const imageFromUrl = productImageUrl.value.trim();

  if (!name) {
    window.alert("물건 이름을 입력해 주세요.");
    return;
  }

  if (!Number.isFinite(price) || price < 0) {
    window.alert("가격은 0원 이상의 숫자로 입력해 주세요.");
    return;
  }

  if (!Number.isFinite(discount) || discount < 0 || discount > 100) {
    window.alert("할인율은 0부터 100 사이의 숫자로 입력해 주세요.");
    return;
  }

  // 사진은 다음 순서로 정합니다.
  // 1. 파일로 선택한 사진
  // 2. 입력한 사진 URL
  // 3. 기존 상품 사진
  // 4. 자동으로 만든 기본 그림
  let image = selectedImageData || imageFromUrl;

  if (idBeingEdited) {
    const existingProduct = getProductById(idBeingEdited);

    if (!image && existingProduct) {
      image = existingProduct.image;
    }

    products = products.map((product) => {
      if (product.id !== idBeingEdited) {
        return product;
      }

      return {
        ...product,
        name,
        price,
        discount,
        image: image || makeSvgImage(name, "#4f7cff", "#e0ecff")
      };
    });
  } else {
    const newProduct = {
      id: makeId(),
      name,
      price,
      discount,
      image: image || makeSvgImage(name, "#4f7cff", "#e0ecff")
    };

    products.push(newProduct);
  }

  saveProducts();

  renderProducts();
  renderCart();
  renderCalculationSteps();
  renderTeacherProducts();
  resetTeacherForm();

  window.alert("상품 정보가 저장되었어요.");
}

function handleImageFileChange(event) {
  const file = event.target.files[0];

  if (!file) {
    selectedImageData = "";
    return;
  }

  // 이미지 파일을 브라우저가 읽을 수 있는 데이터 주소로 바꿉니다.
  // 이렇게 하면 서버 없이도 선택한 사진을 화면에 보여 줄 수 있습니다.
  const reader = new FileReader();

  reader.onload = () => {
    selectedImageData = reader.result;
    imagePreview.src = selectedImageData;
    productImageUrl.value = "";
  };

  reader.readAsDataURL(file);
}

function renderTeacherProducts() {
  teacherProductList.innerHTML = "";

  if (products.length === 0) {
    teacherProductList.innerHTML = `
      <p class="empty-message">
        등록된 물건이 없어요. 새 물건을 추가해 주세요.
      </p>
    `;
    return;
  }

  products.forEach((product) => {
    const card = document.createElement("article");
    card.className = "teacher-product-card";

    card.innerHTML = `
      <img src="${escapeAttribute(product.image)}" alt="${escapeAttribute(product.name)} 사진" />

      <div>
        <h4>${escapeHtml(product.name)}</h4>
        <p>가격: ${formatWon(product.price)}</p>
        <p>할인율: ${product.discount}%</p>

        <div class="teacher-card-actions">
          <button class="small-button" data-edit-teacher-product="${product.id}">
            수정
          </button>
          <button class="remove-button" data-delete-teacher-product="${product.id}">
            삭제
          </button>
        </div>
      </div>
    `;

    teacherProductList.appendChild(card);
  });
}

function handleTeacherProductListClick(event) {
  const editButton = event.target.closest("[data-edit-teacher-product]");
  const deleteButton = event.target.closest("[data-delete-teacher-product]");

  if (editButton) {
    const productId = editButton.dataset.editTeacherProduct;
    startEditingProduct(productId);
  }

  if (deleteButton) {
    const productId = deleteButton.dataset.deleteTeacherProduct;
    deleteProduct(productId);
  }
}

function startEditingProduct(productId) {
  const product = getProductById(productId);

  if (!product) {
    return;
  }

  editingProductId.value = product.id;
  productName.value = product.name;
  productPrice.value = product.price;
  productDiscount.value = product.discount;
  productImageUrl.value = product.image.startsWith("data:image") ? "" : product.image;
  productImageFile.value = "";
  selectedImageData = "";
  imagePreview.src = product.image;

  teacherFormTitle.textContent = "물건 수정하기";
  teacherForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function deleteProduct(productId) {
  const product = getProductById(productId);

  if (!product) {
    return;
  }

  const ok = window.confirm(`${product.name}을/를 정말 삭제할까요?`);

  if (!ok) {
    return;
  }

  products = products.filter((item) => item.id !== productId);
  cart = cart.filter((item) => item.productId !== productId);

  if (selectedProductId === productId) {
    selectedProductId = cart.length > 0 ? cart[0].productId : null;
  }

  saveProducts();

  renderProducts();
  renderCart();
  renderCalculationSteps();
  renderTeacherProducts();
  resetTeacherForm();
}

function resetTeacherForm() {
  teacherForm.reset();
  editingProductId.value = "";
  productDiscount.value = 0;
  selectedImageData = "";
  imagePreview.removeAttribute("src");
  teacherFormTitle.textContent = "새 물건 추가하기";
}

function resetProductsToDefault() {
  const ok = window.confirm(
    "상품 목록을 처음 상태로 되돌릴까요? 교사가 바꾼 상품 정보는 사라집니다."
  );

  if (!ok) {
    return;
  }

  products = getDefaultProducts();
  cart = [];
  selectedProductId = null;

  saveProducts();

  renderProducts();
  renderCart();
  renderCalculationSteps();
  renderTeacherProducts();
  resetTeacherForm();
}


/* =========================
  11. 작은 도우미 함수들
========================= */

function getProductById(productId) {
  return products.find((product) => product.id === productId);
}

function makeId() {
  return "product_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2);
}

function formatWon(number) {
  return new Intl.NumberFormat("ko-KR").format(number) + "원";
}

// HTML 안에 글자를 넣을 때 안전하게 바꿔 줍니다.
// 예: < 기호가 들어와도 태그로 실행되지 않게 합니다.
function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// 이미지 주소나 alt 글자처럼 HTML 속성에 들어갈 값을 안전하게 바꿉니다.
function escapeAttribute(value) {
  return escapeHtml(value);
}
