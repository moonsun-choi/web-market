/* =========================================================
  반짝반짝 우리 반 마켓 - JavaScript
  ---------------------------------------------------------
  이 파일은 구글 로그인용 공식 스크립트 외에는 외부 라이브러리를 쓰지 않습니다.

  들어 있는 기능:
  1. 학생별 장바구니 저장
  2. 단가 × 수량 계산 단계 시각화
  3. 쿠폰 할인과 상품 할인 계산
  4. 칭찬 별, 축하 애니메이션, 간단한 효과음
  5. 교사용 상품 추가, 수정, 삭제
  6. Google 로그인 연결 구조

  중요한 안내:
  - 이 코드는 수업용 프론트엔드 예제입니다.
  - 실제 학교 서비스에서는 Google ID 토큰을 서버에서 검증해야 합니다.
  - 이 예제의 교사 권한 확인은 브라우저 안에서만 처리되므로 보안 기능으로 보면 안 됩니다.
========================================================= */


/* =========================
  1. 구글 로그인과 앱 설정
========================= */

/*
  Google Cloud에서 발급받은 Web Client ID를 넣으세요.

  예:
  const GOOGLE_CLIENT_ID = "1234567890-abcde.apps.googleusercontent.com";

  Client ID를 넣지 않아도 학생/교사 체험 버튼으로 앱을 볼 수 있습니다.
*/
const GOOGLE_CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com";

/*
  교사로 자동 인식할 Google 이메일 목록입니다.
  실제 운영용 권한 관리는 서버에서 해야 합니다.
*/
const TEACHER_EMAILS = [
  "teacher@example.com"
];

/*
  Google 로그인을 쓰지 않고 교사용 체험을 열 때 사용하는 PIN입니다.
  수업용 데모 장치일 뿐, 실제 보안 기능은 아닙니다.
*/
const DEMO_TEACHER_PIN = "1234";

/*
  localStorage 키 앞에 붙일 이름입니다.
  다른 앱의 저장 데이터와 섞이지 않게 해 줍니다.
*/
const APP_PREFIX = "shineClassMarket_v1";


/* =========================
  2. 앱 상태
========================= */

let currentUser = loadSessionUser();

let products = loadProducts();

let cart = loadCartForCurrentUser();

let selectedProductId = null;

let selectedImageData = "";

let soundEnabled = loadSoundPreference();

let stars = loadStarsForCurrentUser();


/* =========================
  3. 화면 요소 찾기
========================= */

const userNameText = document.getElementById("userNameText");
const userRoleText = document.getElementById("userRoleText");
const userBadge = document.getElementById("userBadge");

const googleButtonArea = document.getElementById("googleButtonArea");
const googleHelpText = document.getElementById("googleHelpText");

const demoStudentBtn = document.getElementById("demoStudentBtn");
const demoTeacherBtn = document.getElementById("demoTeacherBtn");
const signOutBtn = document.getElementById("signOutBtn");

const soundToggleBtn = document.getElementById("soundToggleBtn");

const productGrid = document.getElementById("productGrid");
const cartItems = document.getElementById("cartItems");
const couponRate = document.getElementById("couponRate");
const clearCartBtn = document.getElementById("clearCartBtn");
const cartTotal = document.getElementById("cartTotal");
const calcSteps = document.getElementById("calcSteps");

const teacherPanel = document.getElementById("teacherPanel");
const teacherForm = document.getElementById("teacherForm");
const teacherFormTitle = document.getElementById("teacherFormTitle");
const teacherProductList = document.getElementById("teacherProductList");

const editingProductId = document.getElementById("editingProductId");
const productName = document.getElementById("productName");
const productPrice = document.getElementById("productPrice");
const productDiscount = document.getElementById("productDiscount");
const productEmoji = document.getElementById("productEmoji");
const productImageUrl = document.getElementById("productImageUrl");
const productImageFile = document.getElementById("productImageFile");
const imagePreview = document.getElementById("imagePreview");

const clearTeacherFormBtn = document.getElementById("clearTeacherFormBtn");
const resetProductsBtn = document.getElementById("resetProductsBtn");

const confettiLayer = document.getElementById("confettiLayer");
const liveMessage = document.getElementById("liveMessage");

const starText = document.getElementById("starText");
const starFill = document.getElementById("starFill");


/* =========================
  4. 앱 시작
========================= */

document.addEventListener("DOMContentLoaded", () => {
  connectEvents();
  renderAll();
});

/*
  Google 스크립트는 async/defer로 로드됩니다.
  그래서 window load 시점에 Google 객체가 있는지 확인합니다.
*/
window.addEventListener("load", () => {
  initGoogleSignIn();
});


/* =========================
  5. 기본 상품
========================= */

function getDefaultProducts() {
  return [
    {
      id: "apple",
      name: "사과",
      price: 1200,
      discount: 0,
      emoji: "🍎",
      image: makeSvgImage("사과", "🍎", "#ff6b6b", "#ffe1e1")
    },
    {
      id: "banana",
      name: "바나나",
      price: 900,
      discount: 10,
      emoji: "🍌",
      image: makeSvgImage("바나나", "🍌", "#f9c74f", "#fff3bf")
    },
    {
      id: "pencil",
      name: "연필",
      price: 500,
      discount: 0,
      emoji: "✏️",
      image: makeSvgImage("연필", "✏️", "#4f7cff", "#e5edff")
    },
    {
      id: "notebook",
      name: "공책",
      price: 1800,
      discount: 20,
      emoji: "📘",
      image: makeSvgImage("공책", "📘", "#4361ee", "#e9edff")
    },
    {
      id: "juice",
      name: "주스",
      price: 1500,
      discount: 5,
      emoji: "🧃",
      image: makeSvgImage("주스", "🧃", "#2a9d8f", "#dff8f3")
    },
    {
      id: "cookie",
      name: "쿠키",
      price: 700,
      discount: 0,
      emoji: "🍪",
      image: makeSvgImage("쿠키", "🍪", "#bc6c25", "#fff0dc")
    }
  ];
}

/*
  인터넷이 없어도 기본 상품 이미지가 보이도록 SVG 이미지를 직접 만듭니다.
*/
function makeSvgImage(label, emoji, mainColor, bgColor) {
  const safeLabel = escapeHtml(label);
  const safeEmoji = escapeHtml(emoji);

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="700" height="460" viewBox="0 0 700 460">
      <rect width="700" height="460" rx="40" fill="${bgColor}"/>
      <circle cx="350" cy="190" r="118" fill="${mainColor}" opacity="0.92"/>
      <circle cx="305" cy="145" r="28" fill="white" opacity="0.35"/>
      <text x="350" y="218" font-size="96" text-anchor="middle" dominant-baseline="middle">${safeEmoji}</text>
      <text x="350" y="372" font-size="66" font-family="Arial, sans-serif" text-anchor="middle" fill="#172033" font-weight="900">${safeLabel}</text>
    </svg>
  `;

  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
}


/* =========================
  6. 이벤트 연결
========================= */

function connectEvents() {
  demoStudentBtn.addEventListener("click", () => {
    setCurrentUser({
      id: "demo-student",
      name: "학생 친구",
      email: "",
      picture: "",
      role: "student",
      loginType: "demo"
    });

    showPraise("학생 화면으로 들어왔어요. 같이 계산해 봐요!", "small");
  });

  demoTeacherBtn.addEventListener("click", () => {
    const pin = window.prompt("교사용 체험 PIN을 입력해 주세요.");

    if (pin !== DEMO_TEACHER_PIN) {
      window.alert("PIN이 맞지 않아요.");
      return;
    }

    setCurrentUser({
      id: "demo-teacher",
      name: "교사 체험",
      email: "",
      picture: "",
      role: "teacher",
      loginType: "demo"
    });

    showPraise("교사용 관리 화면이 열렸어요.", "small");
  });

  signOutBtn.addEventListener("click", () => {
    signOut();
  });

  soundToggleBtn.addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    saveSoundPreference();
    renderSoundButton();

    if (soundEnabled) {
      playTone("success");
      showLiveMessage("효과음이 켜졌어요.");
    } else {
      showLiveMessage("효과음이 꺼졌어요.");
    }
  });

  productGrid.addEventListener("click", handleProductGridClick);

  cartItems.addEventListener("click", handleCartClick);

  couponRate.addEventListener("change", () => {
    saveCartForCurrentUser();
    renderCart();
    renderCalculationSteps();
  });

  clearCartBtn.addEventListener("click", () => {
    cart = [];
    selectedProductId = null;
    saveCartForCurrentUser();
    renderCart();
    renderCalculationSteps();
    showLiveMessage("장바구니를 비웠어요.");
  });

  calcSteps.addEventListener("click", handleQuizClick);

  teacherForm.addEventListener("submit", handleTeacherFormSubmit);

  productImageFile.addEventListener("change", handleImageFileChange);

  productImageUrl.addEventListener("input", () => {
    selectedImageData = "";
    imagePreview.src = productImageUrl.value.trim();
  });

  clearTeacherFormBtn.addEventListener("click", resetTeacherForm);

  resetProductsBtn.addEventListener("click", resetProductsToDefault);

  teacherProductList.addEventListener("click", handleTeacherProductListClick);
}


/* =========================
  7. Google 로그인
========================= */

function initGoogleSignIn() {
  const hasClientId =
    GOOGLE_CLIENT_ID &&
    !GOOGLE_CLIENT_ID.startsWith("YOUR_GOOGLE_CLIENT_ID");

  if (!hasClientId) {
    googleHelpText.textContent =
      "Google Client ID가 아직 없습니다. 지금은 체험 버튼으로 사용할 수 있어요.";
    return;
  }

  if (!window.google || !window.google.accounts || !window.google.accounts.id) {
    googleHelpText.textContent =
      "Google 로그인 스크립트를 불러오지 못했어요. 인터넷 연결 또는 도메인 설정을 확인해 주세요.";
    return;
  }

  window.google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: handleGoogleCredential,
    auto_select: false
  });

  window.google.accounts.id.renderButton(googleButtonArea, {
    theme: "outline",
    size: "large",
    type: "standard",
    shape: "pill",
    text: "signin_with",
    logo_alignment: "left",
    width: 300,
    locale: "ko"
  });

  googleHelpText.textContent =
    "구글로 들어오면 학생별 장바구니가 이 브라우저에 따로 저장돼요.";
}

function handleGoogleCredential(response) {
  if (!response || !response.credential) {
    window.alert("Google 로그인 정보를 받지 못했어요.");
    return;
  }

  const payload = decodeJwtPayload(response.credential);

  if (!payload || !payload.sub) {
    window.alert("Google 로그인 정보를 읽지 못했어요.");
    return;
  }

  const email = String(payload.email || "").toLowerCase();
  const isTeacher = TEACHER_EMAILS.map((item) => item.toLowerCase()).includes(email);

  setCurrentUser({
    id: "google-" + payload.sub,
    name: payload.name || "친구",
    email,
    picture: payload.picture || "",
    role: isTeacher ? "teacher" : "student",
    loginType: "google"
  });

  showPraise(`${payload.name || "친구"}님, 반가워요!`, "big");
}

/*
  JWT의 payload 부분을 읽기 위한 간단한 함수입니다.
  다시 강조하지만, 이것은 화면 표시와 데모용입니다.
  실제 권한 확인은 서버에서 ID 토큰을 검증해야 합니다.
*/
function decodeJwtPayload(token) {
  try {
    const parts = token.split(".");

    if (parts.length < 2) {
      return null;
    }

    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((char) => {
          return "%" + ("00" + char.charCodeAt(0).toString(16)).slice(-2);
        })
        .join("")
    );

    return JSON.parse(json);
  } catch (error) {
    console.error("JWT를 읽는 중 문제가 생겼습니다.", error);
    return null;
  }
}

function signOut() {
  if (window.google && window.google.accounts && window.google.accounts.id) {
    window.google.accounts.id.disableAutoSelect();
  }

  removeStorage(getSessionKey());

  setCurrentUser({
    id: "demo-student",
    name: "학생 친구",
    email: "",
    picture: "",
    role: "student",
    loginType: "demo"
  });

  showLiveMessage("로그아웃했어요. 학생 체험 화면으로 돌아왔어요.");
}


/* =========================
  8. 사용자 전환
========================= */

function setCurrentUser(user) {
  saveCartForCurrentUser();
  saveStarsForCurrentUser();

  currentUser = user;
  saveSessionUser();

  cart = loadCartForCurrentUser();
  stars = loadStarsForCurrentUser();
  selectedProductId = cart.length > 0 ? cart[0].productId : null;

  renderAll();
}

function loadSessionUser() {
  const saved = readJson(getSessionKey(), null);

  if (saved && saved.id && saved.role) {
    return saved;
  }

  return {
    id: "demo-student",
    name: "학생 친구",
    email: "",
    picture: "",
    role: "student",
    loginType: "demo"
  };
}

function saveSessionUser() {
  writeJson(getSessionKey(), currentUser);
}


/* =========================
  9. 전체 화면 다시 그리기
========================= */

function renderAll() {
  renderUser();
  renderSoundButton();
  renderProducts();
  renderCart();
  renderCalculationSteps();
  renderStars();
  renderTeacherPanel();
  renderTeacherProducts();
}

function renderUser() {
  userNameText.textContent = currentUser.name || "학생 친구";
  userRoleText.textContent =
    currentUser.role === "teacher" ? "교사 화면" : "학생 화면";

  const avatar = userBadge.querySelector(".avatar");

  if (currentUser.picture) {
    avatar.innerHTML = `<img src="${escapeAttribute(currentUser.picture)}" alt="" />`;
    avatar.classList.add("photo-avatar");
  } else {
    avatar.textContent = currentUser.role === "teacher" ? "👩‍🏫" : "🙂";
    avatar.classList.remove("photo-avatar");
  }

  signOutBtn.classList.toggle("hidden", currentUser.loginType !== "google");
}

function renderSoundButton() {
  soundToggleBtn.textContent = soundEnabled ? "🔊 효과음 켜짐" : "🔇 효과음 꺼짐";
  soundToggleBtn.setAttribute("aria-pressed", String(soundEnabled));
}

function renderTeacherPanel() {
  teacherPanel.classList.toggle("hidden", currentUser.role !== "teacher");
}


/* =========================
  10. 상품 화면
========================= */

function renderProducts() {
  productGrid.innerHTML = "";

  products.forEach((product) => {
    const discountedPrice = getDiscountedUnitPrice(product);
    const isSelected = product.id === selectedProductId;

    const card = document.createElement("article");
    card.className = "product-card" + (isSelected ? " selected" : "");

    card.innerHTML = `
      <div class="product-image-wrap">
        <img src="${escapeAttribute(product.image)}" alt="${escapeAttribute(product.name)} 사진" />
        <span class="product-emoji" aria-hidden="true">${escapeHtml(product.emoji || "🛒")}</span>
        ${
          product.discount > 0
            ? `<span class="discount-badge">${product.discount}% 할인</span>`
            : ""
        }
      </div>

      <div class="product-body">
        <h3>${escapeHtml(product.name)}</h3>

        <div class="price-box">
          ${
            product.discount > 0
              ? `
                <span class="old-price">원래 ${formatWon(product.price)}</span>
                <strong>지금 ${formatWon(discountedPrice)}</strong>
              `
              : `<strong>${formatWon(product.price)}</strong>`
          }
          <span>1개 가격</span>
        </div>

        <div class="quantity-control" aria-label="${escapeAttribute(product.name)} 수량 고르기">
          <button class="round-button" type="button" data-qty-minus="${product.id}" aria-label="수량 줄이기">
            −
          </button>

          <div class="quantity-display" id="qty-${product.id}" data-quantity="${product.id}">
            1개
          </div>

          <button class="round-button" type="button" data-qty-plus="${product.id}" aria-label="수량 늘리기">
            +
          </button>
        </div>

        <div class="product-actions">
          <button class="primary-button" type="button" data-add-product="${product.id}">
            🛒 담기
          </button>
          <button class="soft-button" type="button" data-practice-product="${product.id}">
            👀 계산 보기
          </button>
        </div>
      </div>
    `;

    productGrid.appendChild(card);
  });
}

function handleProductGridClick(event) {
  const minusButton = event.target.closest("[data-qty-minus]");
  const plusButton = event.target.closest("[data-qty-plus]");
  const addButton = event.target.closest("[data-add-product]");
  const practiceButton = event.target.closest("[data-practice-product]");

  if (minusButton) {
    changeProductCardQuantity(minusButton.dataset.qtyMinus, -1);
    playTone("tap");
    return;
  }

  if (plusButton) {
    changeProductCardQuantity(plusButton.dataset.qtyPlus, 1);
    playTone("tap");
    return;
  }

  if (addButton) {
    const productId = addButton.dataset.addProduct;
    const quantity = getProductCardQuantity(productId);

    addToCart(productId, quantity);
    selectedProductId = productId;

    saveCartForCurrentUser();
    renderProducts();
    renderCart();
    renderCalculationSteps();

    addStars(1);
    showPraise("좋아요! 장바구니에 담았어요.", "small");
    playTone("add");
    return;
  }

  if (practiceButton) {
    selectedProductId = practiceButton.dataset.practiceProduct;

    renderProducts();
    renderCalculationSteps();

    showLiveMessage("계산 과정을 보여 줄게요.");
    playTone("tap");
  }
}

function getProductCardQuantity(productId) {
  const display = document.querySelector(`[data-quantity="${productId}"]`);

  if (!display) {
    return 1;
  }

  const quantity = Number(display.dataset.value || "1");

  if (!Number.isFinite(quantity) || quantity < 1) {
    return 1;
  }

  return Math.min(99, Math.floor(quantity));
}

function changeProductCardQuantity(productId, amount) {
  const display = document.querySelector(`[data-quantity="${productId}"]`);

  if (!display) {
    return;
  }

  const current = Number(display.dataset.value || "1");
  const next = Math.max(1, Math.min(99, current + amount));

  display.dataset.value = String(next);
  display.textContent = `${next}개`;
}


/* =========================
  11. 장바구니
========================= */

function addToCart(productId, quantity) {
  const existing = cart.find((item) => item.productId === productId);

  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({
      productId,
      quantity
    });
  }
}

function handleCartClick(event) {
  const minusButton = event.target.closest("[data-cart-minus]");
  const plusButton = event.target.closest("[data-cart-plus]");
  const removeButton = event.target.closest("[data-cart-remove]");

  if (minusButton) {
    changeCartQuantity(minusButton.dataset.cartMinus, -1);
  }

  if (plusButton) {
    changeCartQuantity(plusButton.dataset.cartPlus, 1);
  }

  if (removeButton) {
    removeFromCart(removeButton.dataset.cartRemove);
  }

  saveCartForCurrentUser();
  renderCart();
  renderCalculationSteps();
}

function changeCartQuantity(productId, amount) {
  const item = cart.find((cartItem) => cartItem.productId === productId);

  if (!item) {
    return;
  }

  item.quantity += amount;

  if (item.quantity <= 0) {
    removeFromCart(productId);
  } else {
    selectedProductId = productId;
  }

  playTone("tap");
}

function removeFromCart(productId) {
  cart = cart.filter((item) => item.productId !== productId);

  if (selectedProductId === productId) {
    selectedProductId = cart.length > 0 ? cart[0].productId : null;
  }

  showLiveMessage("장바구니에서 뺐어요.");
}

function renderCart() {
  cartItems.innerHTML = "";

  if (cart.length === 0) {
    cartItems.innerHTML = `
      <p class="empty-message">
        아직 비어 있어요.<br />
        왼쪽에서 물건을 골라 담아 볼까요?
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

    const calc = calculateItem(product, item.quantity);

    const article = document.createElement("article");
    article.className = "cart-item";

    article.innerHTML = `
      <img src="${escapeAttribute(product.image)}" alt="${escapeAttribute(product.name)} 사진" />

      <div>
        <h3>${escapeHtml(product.emoji || "🛒")} ${escapeHtml(product.name)}</h3>
        <p>
          ${formatWon(product.price)} × ${item.quantity}개
          ${
            product.discount > 0
              ? `, ${product.discount}% 할인`
              : ""
          }
        </p>
        <p>
          <strong>${formatWon(calc.finalPrice)}</strong>
        </p>

        <div class="cart-controls">
          <button class="round-button" type="button" data-cart-minus="${product.id}" aria-label="${escapeAttribute(product.name)} 수량 줄이기">−</button>
          <button class="round-button" type="button" data-cart-plus="${product.id}" aria-label="${escapeAttribute(product.name)} 수량 늘리기">+</button>
          <button class="remove-button" type="button" data-cart-remove="${product.id}">빼기</button>
        </div>
      </div>
    `;

    cartItems.appendChild(article);
  });

  const total = calculateCartTotal();
  cartTotal.textContent = formatWon(total.finalTotal);
}


/* =========================
  12. 계산
========================= */

function getDiscountedUnitPrice(product) {
  const discountAmount = Math.round(product.price * product.discount / 100);
  return product.price - discountAmount;
}

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

    const calc = calculateItem(product, item.quantity);
    beforeCouponTotal += calc.finalPrice;
  });

  const couponPercent = Number(couponRate.value || "0");
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
        물건을 하나 고르면<br />
        계산 과정이 크게 보여요.
      </p>
    `;
    return;
  }

  const product = getProductById(selectedProductId);

  if (!product) {
    calcSteps.innerHTML = `
      <p class="empty-message">
        선택한 물건을 찾을 수 없어요.
      </p>
    `;
    return;
  }

  const cartItem = cart.find((item) => item.productId === selectedProductId);
  const quantity = cartItem ? cartItem.quantity : getProductCardQuantity(selectedProductId);
  const itemCalc = calculateItem(product, quantity);
  const cartCalc = calculateCartTotal();

  calcSteps.innerHTML = `
    <article class="step-card">
      <h3>① 1개 가격 보기</h3>
      <p>${escapeHtml(product.name)} 1개의 가격은 <strong>${formatWon(product.price)}</strong>이에요.</p>
      <div class="math-line">1개 = ${formatWon(product.price)}</div>
    </article>

    <article class="step-card">
      <h3>② 몇 개인지 세기</h3>
      <p>${quantity}개를 골랐어요. 그림을 보며 하나씩 세어 봐요.</p>
      <div class="visual-count" aria-label="${quantity}개">
        ${renderCountIcons(product.emoji || "🛒", quantity)}
      </div>
    </article>

    <article class="step-card">
      <h3>③ 단가와 수량 곱하기</h3>
      <p>1개 가격에 개수를 곱하면 할인 전 금액이 나와요.</p>
      <div class="math-line">
        ${formatWon(product.price)} × ${quantity}개 = ${formatWon(itemCalc.subtotal)}
      </div>
    </article>

    ${
      product.discount > 0
        ? `
          <article class="step-card">
            <h3>④ 물건 할인 빼기</h3>
            <p>${product.discount}% 할인이 있어요. 할인 금액을 빼요.</p>
            <div class="math-line">
              ${formatWon(itemCalc.subtotal)} − ${formatWon(itemCalc.discountAmount)}
              = ${formatWon(itemCalc.finalPrice)}
            </div>
          </article>
        `
        : `
          <article class="step-card">
            <h3>④ 물건 할인 확인</h3>
            <p>이 물건은 상품 할인이 없어요. 그대로 계산해요.</p>
            <div class="math-line">
              ${formatWon(itemCalc.finalPrice)}
            </div>
          </article>
        `
    }

    <article class="step-card">
      <h3>⑤ 장바구니 전체 더하기</h3>
      <p>장바구니에 담은 물건 값을 모두 더했어요.</p>
      <div class="math-line">
        합계 = ${formatWon(cartCalc.beforeCouponTotal)}
      </div>
    </article>

    <article class="step-card">
      <h3>⑥ 쿠폰 할인</h3>
      <p>쿠폰 할인은 ${cartCalc.couponPercent}%예요.</p>
      <div class="math-line">
        ${formatWon(cartCalc.beforeCouponTotal)} − ${formatWon(cartCalc.couponDiscount)}
        = ${formatWon(cartCalc.finalTotal)}
      </div>
    </article>

    <article class="step-card good-step">
      <h3>🌟 계산 퀴즈</h3>
      <p>
        먼저 이것만 맞혀 봐요.
        <strong>${formatWon(product.price)} × ${quantity}개</strong>는 얼마일까요?
      </p>

      <div class="quiz-box">
        <input
          id="quizAnswer"
          type="number"
          inputmode="numeric"
          placeholder="정답을 숫자로 써요"
          aria-label="계산 퀴즈 정답 입력"
        />
        <button
          class="primary-button"
          type="button"
          data-check-answer="${itemCalc.subtotal}"
        >
          정답 확인
        </button>
      </div>
    </article>
  `;
}

function renderCountIcons(emoji, quantity) {
  const maxIcons = 12;
  const visibleCount = Math.min(quantity, maxIcons);
  const icons = [];

  for (let i = 0; i < visibleCount; i += 1) {
    icons.push(`<span aria-hidden="true">${escapeHtml(emoji)}</span>`);
  }

  if (quantity > maxIcons) {
    icons.push(`<span>+${quantity - maxIcons}개</span>`);
  }

  return icons.join("");
}

function handleQuizClick(event) {
  const checkButton = event.target.closest("[data-check-answer]");

  if (!checkButton) {
    return;
  }

  const answerInput = document.getElementById("quizAnswer");
  const correctAnswer = Number(checkButton.dataset.checkAnswer);
  const userAnswer = Number(answerInput.value);

  if (userAnswer === correctAnswer) {
    addStars(3);
    showPraise("정답이에요! 정말 잘했어요!", "big");
    playTone("success");
    answerInput.value = "";
  } else {
    showLiveMessage("조금 아쉬워요. 가격과 개수를 다시 살펴볼까요?");
    playTone("try");
    answerInput.classList.add("pulse");

    setTimeout(() => {
      answerInput.classList.remove("pulse");
    }, 500);
  }
}


/* =========================
  13. 칭찬 별과 피드백
========================= */

function addStars(amount) {
  stars += amount;
  saveStarsForCurrentUser();
  renderStars();
}

function renderStars() {
  starText.textContent = `⭐ ${stars}개`;

  const fillPercent = Math.min(100, (stars % 20) * 5);
  starFill.style.width = `${fillPercent}%`;
}

function showPraise(message, size) {
  showLiveMessage(message);
  createConfetti(size);
}

function showLiveMessage(message) {
  liveMessage.textContent = message;
}

function createConfetti(size) {
  const count = size === "big" ? 36 : 16;
  const symbols = ["⭐", "✨", "🎉", "💛", "👏"];

  for (let i = 0; i < count; i += 1) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.textContent = symbols[Math.floor(Math.random() * symbols.length)];
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.animationDelay = `${Math.random() * 0.35}s`;

    confettiLayer.appendChild(piece);

    setTimeout(() => {
      piece.remove();
    }, 2200);
  }
}


/* =========================
  14. 효과음
========================= */

/*
  브라우저에서 직접 짧은 소리를 만듭니다.
  Web Audio API의 OscillatorNode는 일정한 파형의 소리를 만들 수 있습니다.
*/
let audioContext = null;

function playTone(type) {
  if (!soundEnabled) {
    return;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass) {
    return;
  }

  if (!audioContext) {
    audioContext = new AudioContextClass();
  }

  const now = audioContext.currentTime;

  const tones = {
    tap: [440],
    add: [523.25, 659.25],
    success: [523.25, 659.25, 783.99],
    try: [220, 196]
  };

  const frequencies = tones[type] || tones.tap;

  frequencies.forEach((frequency, index) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, now + index * 0.12);

    gain.gain.setValueAtTime(0.0001, now + index * 0.12);
    gain.gain.exponentialRampToValueAtTime(0.09, now + index * 0.12 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.12 + 0.14);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start(now + index * 0.12);
    oscillator.stop(now + index * 0.12 + 0.16);
  });
}


/* =========================
  15. 교사용 관리자
========================= */

function handleTeacherFormSubmit(event) {
  event.preventDefault();

  if (currentUser.role !== "teacher") {
    window.alert("교사용 화면에서만 수정할 수 있어요.");
    return;
  }

  const idBeingEdited = editingProductId.value;
  const name = productName.value.trim();
  const price = Number(productPrice.value);
  const discount = Number(productDiscount.value || "0");
  const emoji = productEmoji.value.trim() || "🛒";
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
    window.alert("할인율은 0부터 100 사이로 입력해 주세요.");
    return;
  }

  let image = selectedImageData || imageFromUrl;

  if (idBeingEdited) {
    const oldProduct = getProductById(idBeingEdited);

    if (!image && oldProduct) {
      image = oldProduct.image;
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
        emoji,
        image: image || makeSvgImage(name, emoji, "#245cff", "#eaf0ff")
      };
    });
  } else {
    products.push({
      id: makeId(),
      name,
      price,
      discount,
      emoji,
      image: image || makeSvgImage(name, emoji, "#245cff", "#eaf0ff")
    });
  }

  saveProducts();

  renderProducts();
  renderCart();
  renderCalculationSteps();
  renderTeacherProducts();
  resetTeacherForm();

  showPraise("상품 정보가 저장되었어요!", "small");
  playTone("success");
}

function handleImageFileChange(event) {
  const file = event.target.files[0];

  if (!file) {
    selectedImageData = "";
    return;
  }

  const reader = new FileReader();

  reader.onload = () => {
    selectedImageData = reader.result;
    imagePreview.src = selectedImageData;
    productImageUrl.value = "";
  };

  reader.readAsDataURL(file);
}

function renderTeacherProducts() {
  if (currentUser.role !== "teacher") {
    return;
  }

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
        <h4>${escapeHtml(product.emoji || "🛒")} ${escapeHtml(product.name)}</h4>
        <p>가격: ${formatWon(product.price)}</p>
        <p>할인율: ${product.discount}%</p>

        <div class="teacher-card-actions">
          <button class="soft-button" type="button" data-edit-product="${product.id}">
            수정
          </button>
          <button class="remove-button" type="button" data-delete-product="${product.id}">
            삭제
          </button>
        </div>
      </div>
    `;

    teacherProductList.appendChild(card);
  });
}

function handleTeacherProductListClick(event) {
  const editButton = event.target.closest("[data-edit-product]");
  const deleteButton = event.target.closest("[data-delete-product]");

  if (editButton) {
    startEditingProduct(editButton.dataset.editProduct);
  }

  if (deleteButton) {
    deleteProduct(deleteButton.dataset.deleteProduct);
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
  productEmoji.value = product.emoji || "";
  productImageUrl.value = product.image.startsWith("data:image") ? "" : product.image;
  productImageFile.value = "";
  selectedImageData = "";
  imagePreview.src = product.image;

  teacherFormTitle.textContent = "물건 수정하기";
  teacherForm.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function deleteProduct(productId) {
  const product = getProductById(productId);

  if (!product) {
    return;
  }

  const ok = window.confirm(`${product.name}을/를 삭제할까요?`);

  if (!ok) {
    return;
  }

  products = products.filter((item) => item.id !== productId);
  cart = cart.filter((item) => item.productId !== productId);

  if (selectedProductId === productId) {
    selectedProductId = cart.length > 0 ? cart[0].productId : null;
  }

  saveProducts();
  saveCartForCurrentUser();

  renderProducts();
  renderCart();
  renderCalculationSteps();
  renderTeacherProducts();
  resetTeacherForm();

  showLiveMessage("상품을 삭제했어요.");
}

function resetTeacherForm() {
  teacherForm.reset();
  editingProductId.value = "";
  productDiscount.value = "0";
  selectedImageData = "";
  imagePreview.removeAttribute("src");
  teacherFormTitle.textContent = "새 물건 추가하기";
}

function resetProductsToDefault() {
  const ok = window.confirm("상품 목록을 처음 상태로 되돌릴까요?");

  if (!ok) {
    return;
  }

  products = getDefaultProducts();
  cart = [];
  selectedProductId = null;

  saveProducts();
  saveCartForCurrentUser();

  renderProducts();
  renderCart();
  renderCalculationSteps();
  renderTeacherProducts();
  resetTeacherForm();

  showPraise("기본 상품으로 되돌렸어요.", "small");
}


/* =========================
  16. localStorage 저장
========================= */

function getSessionKey() {
  return `${APP_PREFIX}:sessionUser`;
}

function getProductsKey() {
  return `${APP_PREFIX}:products`;
}

function getCartKey() {
  return `${APP_PREFIX}:cart:${currentUser.id}`;
}

function getStarsKey() {
  return `${APP_PREFIX}:stars:${currentUser.id}`;
}

function getSoundKey() {
  return `${APP_PREFIX}:soundEnabled`;
}

function loadProducts() {
  const saved = readJson(getProductsKey(), null);

  if (Array.isArray(saved)) {
    return saved;
  }

  return getDefaultProducts();
}

function saveProducts() {
  writeJson(getProductsKey(), products);
}

function loadCartForCurrentUser() {
  const saved = readJson(getCartKey(), []);

  if (Array.isArray(saved)) {
    return saved;
  }

  return [];
}

function saveCartForCurrentUser() {
  writeJson(getCartKey(), cart);
}

function loadStarsForCurrentUser() {
  const saved = readJson(getStarsKey(), 0);
  return Number.isFinite(Number(saved)) ? Number(saved) : 0;
}

function saveStarsForCurrentUser() {
  writeJson(getStarsKey(), stars);
}

function loadSoundPreference() {
  const saved = readJson(getSoundKey(), true);
  return saved !== false;
}

function saveSoundPreference() {
  writeJson(getSoundKey(), soundEnabled);
}

function readJson(key, fallbackValue) {
  try {
    const raw = localStorage.getItem(key);

    if (raw === null) {
      return fallbackValue;
    }

    return JSON.parse(raw);
  } catch (error) {
    console.error("저장된 데이터를 읽는 중 문제가 생겼습니다.", error);
    return fallbackValue;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error("데이터 저장 중 문제가 생겼습니다.", error);

    window.alert(
      "브라우저 저장 공간이 부족할 수 있어요. 큰 사진을 많이 넣었다면 작은 사진을 사용해 주세요."
    );
  }
}

function removeStorage(key) {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error("저장 데이터를 지우는 중 문제가 생겼습니다.", error);
  }
}


/* =========================
  17. 작은 도우미 함수
========================= */

function getProductById(productId) {
  return products.find((product) => product.id === productId);
}

function makeId() {
  return "product_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2);
}

function formatWon(value) {
  return new Intl.NumberFormat("ko-KR").format(value) + "원";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
