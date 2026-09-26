/*
  ============================================================
  ⚙️ بخش ۱: تنظیمات سایت
  ------------------------------------------------------------
  تنها بخشی که برای مدیریت سایت لازم است تغییر دهید همین‌جاست.
  برای اضافه‌کردن ترم، دوره یا رشتهٔ جدید فقط خطوط همین بخش را ویرایش کنید.
  ============================================================
*/

const CONFIG = {

  // پوشه‌ای که فایل‌های JSON داخل آن قرار دارند.
  BASE_URL: "./static/files/",

  /*
    دوره‌های ترم.
    id    ← اولین قسمتِ نام فایل JSON
    label ← متنی که در منوی کشویی نمایش داده می‌شود
  */
  terms: [
    { id: "4051-select",   label: "ترم 4051 — انتخاب واحد" },
    { id: "4051-complete", label: "ترم 4051 — انتخاب واحد تکمیلی" },
    { id: "4051-adddrop",  label: "ترم 4051 — حذف و اضافه" },
  ],

  /*
    نوع درس.
  */
  courseTypes: [
    { id: "general",     label: "دروس عمومی" },
    { id: "specialized", label: "دروس تخصصی" },
  ],

  /*
    رشته‌ها — فقط برای دروس تخصصی استفاده می‌شوند.
    id ← دومین قسمتِ نام فایل JSON
  */
  majors: [
    { id: "software",    label: "کاردانی نرم‌افزار رایانه" },
    { id: "elementary",  label: "آموزش ابتدایی" },
    { id: "computerpro", label: "کامپیوتر حرفه‌ای" },
  ],

  // دومین قسمتِ نام فایل دروس عمومی (مستقل از رشته).
  generalFileName: "general",
};

/*
  الگوی نام‌گذاری فایل‌های JSON:
  ─ دروس عمومی:  {id-دوره}-{generalFileName}.json
  ─ دروس تخصصی:  {id-دوره}-{id-رشته}.json

  نمونه:
  ─ 4051-select-general.json
  ─ 4051-select-software.json
  ─ 4051-complete-elementary.json
  ─ 4051-adddrop-computerpro.json
*/

/**
 * ساخت آدرس فایل JSON بر اساس انتخاب کاربر.
 */
function getJsonUrl(termId, typeId, majorId) {
  const fileBase = (typeId === "general") ? CONFIG.generalFileName : majorId;
  return CONFIG.BASE_URL + termId + "-" + fileBase + ".json";
}

/*
  ============================================================
  بخش ۲: تنظیمات فنی (نیازی به تغییر نیست)
  ============================================================
*/

// حداکثر تعداد سطرهایی که هم‌زمان در جدول نمایش داده می‌شوند.
const MAX_VISIBLE_RESULTS = 100;

// برای جلوگیری از اجرای بی‌مورد جستجو هنگام تایپ سریع کاربر.
let searchTimer;

// دروس بارگیری‌شدهٔ ترکیب فعلی (آمادهٔ جستجو).
let searchableCourses = [];

// کش: هر ترکیب فقط یک‌بار از سرور دانلود می‌شود.
const cache = {};

// برای جلوگیری از تداخل دو بارگیری هم‌زمان.
let loadToken = 0;

/*
  ============================================================
  بخش ۳: دسترسی به عناصر HTML
  ============================================================
*/

const courseTypeSelect = document.getElementById("courseTypeSelect");
const majorSelect = document.getElementById("majorSelect");
const termSelect = document.getElementById("termSelect");

const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");
const resultsBody = document.getElementById("resultsBody");
const resultsCount = document.getElementById("resultsCount");

const emptyState = document.getElementById("emptyState");
const emptyStateTitle = document.getElementById("emptyStateTitle");
const emptyStateText = document.getElementById("emptyStateText");

/*
  ============================================================
  بخش ۴: توابع کمکی
  ============================================================
*/

/**
 * تبدیل مقدارهای null یا undefined به متن خالی.
 */
function safeText(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

/**
 * نرمال‌سازی فارسی برای جستجوی بهتر.
 * ي → ی ، ك → ک ، اعداد فارسی/عربی → انگلیسی ، حذف فاصله‌های اضافی
 */
function normalizeText(value) {
  return safeText(value)
    .toLowerCase()
    .trim()
    .replace(/ي/g, "ی")
    .replace(/ى/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[۰-۹]/g, function (digit) {
      return "۰۱۲۳۴۵۶۷۸۹".indexOf(digit);
    })
    .replace(/[٠-٩]/g, function (digit) {
      return "٠١٢٣٤٥٦٧٨٩".indexOf(digit);
    })
    .replace(/\s+/g, " ");
}

/**
 * جلوگیری از تزریق کد HTML در جدول.
 */
function escapeHtml(value) {
  return safeText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * نمایش پیام در قسمت زیر جدول.
 */
function showEmptyState(title, text) {
  emptyState.style.display = "block";
  emptyStateTitle.textContent = title;
  emptyStateText.textContent = text;
}

/**
 * مخفی‌کردن پیام زیر جدول.
 */
function hideEmptyState() {
  emptyState.style.display = "none";
}

/**
 * نمایش تعداد نتایج در کنار عنوان «نتایج جستجو».
 */
function updateResultsCount(total) {
  if (total > 0) {
    resultsCount.textContent = total.toLocaleString("fa-IR") + " درس";
    resultsCount.style.display = "inline-block";
  } else {
    resultsCount.textContent = "";
    resultsCount.style.display = "none";
  }
}

/**
 * پرکردن یک منوی کشویی از روی داده‌های CONFIG.
 */
function fillSelect(selectElement, items, placeholderLabel) {
  selectElement.innerHTML = "";

  if (placeholderLabel) {
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = placeholderLabel;
    selectElement.appendChild(placeholder);
  }

  items.forEach(function (item) {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.label;
    selectElement.appendChild(option);
  });
}

/**
 * آماده‌سازی دیتا برای جستجوی سریع (فقط یک‌بار برای هر فایل انجام می‌شود).
 */
function prepareCourses(courses) {
  return courses.map(function (course) {
    const searchIndex = normalizeText(
      safeText(course["کد درس"]) + " " +
      safeText(course["کد ارائه کلاس درس"]) + " " +
      safeText(course["نام درس"]) + " " +
      safeText(course["استاد"]) + " " +
      safeText(course["زمانبندی تشکیل کلاس"])
    );

    return { original: course, searchIndex: searchIndex };
  });
}

/**
 * نام فارسی ترکیب انتخاب‌شده (برای نمایش در پیام‌ها).
 */
function getSelectionLabel() {
  const term = CONFIG.terms.find(function (t) { return t.id === termSelect.value; });
  const type = CONFIG.courseTypes.find(function (c) { return c.id === courseTypeSelect.value; });

  let label = (term ? term.label : "") + " — " + (type ? type.label : "");

  if (courseTypeSelect.value === "specialized") {
    const major = CONFIG.majors.find(function (m) { return m.id === majorSelect.value; });
    if (major) {
      label += " — " + major.label;
    }
  }

  return label;
}

/*
  ============================================================
  بخش ۵: بارگیری فایل JSON مطابق انتخاب کاربر
  ============================================================
*/

async function loadCurrentSelection() {
  const token = ++loadToken;

  const termId = termSelect.value;
  const typeId = courseTypeSelect.value;
  const majorId = majorSelect.value;
  const url = getJsonUrl(termId, typeId, majorId);

  showEmptyState(
    "در حال بارگیری اطلاعات دروس...",
    "لطفاً چند لحظه صبر کنید."
  );

  try {
    // اگر این ترکیب قبلاً بارگیری شده، دوباره دانلود نمی‌کنیم (کش).
    if (!cache[url]) {
      const response = await fetch(url);

      // اگر کاربر وسط کار فیلتر را عوض کرد، این نتیجه را نادیده می‌گیریم.
      if (token !== loadToken) return;

      if (response.status === 404) {
        throw new Error("NOT_FOUND");
      }
      if (!response.ok) {
        throw new Error("HTTP_" + response.status);
      }

      const data = await response.json();

      if (token !== loadToken) return;

      if (!Array.isArray(data)) {
        throw new Error("BAD_STRUCTURE");
      }

      cache[url] = prepareCourses(data);
    }

    if (token !== loadToken) return;

    searchableCourses = cache[url];

    // اگر در کادر جستجو عبارتی مانده، همان اعمال می‌شود؛
    // وگرنه همهٔ دروسِ این ترکیب نمایش داده می‌شوند.
    searchCourses();

  } catch (error) {
    if (token !== loadToken) return;

    searchableCourses = [];
    resultsBody.innerHTML = "";
    updateResultsCount(0);

    if (error.message === "NOT_FOUND") {
      showEmptyState(
        "اطلاعات این بخش هنوز آماده نشده است",
        `فایل اطلاعات «${getSelectionLabel()}» هنوز در سایت قرار داده نشده است. به‌محض آماده شدن، از همین صفحه قابل مشاهده خواهد بود.`
      );
    } else if (error.message === "BAD_STRUCTURE") {
      showEmptyState(
        "خطا در ساختار فایل اطلاعات",
        "ساختار فایل JSON صحیح نیست؛ داده‌ها باید داخل آرایهٔ [ ] قرار داشته باشند."
      );
    } else {
      console.error(error);
      showEmptyState(
        "خطا در بارگیری اطلاعات",
        "در خواندن فایل اطلاعات مشکلی پیش آمد. لطفاً صفحه را دوباره بارگیری کنید."
      );
    }
  }
}

/*
  ============================================================
  بخش ۶: فیلترها
  ============================================================
*/

/**
 * با هر تغییر در منوهای کشویی اجرا می‌شود.
 */
function onFilterChange() {
  const typeId = courseTypeSelect.value;

  // دروس عمومی به رشته وابسته نیستند؛ منوی رشته غیرفعال می‌شود.
  if (typeId === "general") {
    majorSelect.value = "";
    majorSelect.disabled = true;
  } else {
    majorSelect.disabled = false;
  }

  // اگر تخصصی انتخاب شده ولی هنوز رشته‌ای انتخاب نشده است.
  if (typeId === "specialized" && !majorSelect.value) {
    searchableCourses = [];
    resultsBody.innerHTML = "";
    updateResultsCount(0);
    showEmptyState(
      "رشتهٔ خود را انتخاب کنید",
      "برای مشاهدهٔ دروس تخصصی، ابتدا رشتهٔ خود را از فیلتر «رشته» انتخاب کنید."
    );
    return;
  }

  loadCurrentSelection();
}

/*
  ============================================================
  بخش ۷: جستجو و نمایش نتایج
  ============================================================
*/

function searchCourses() {
  const query = normalizeText(searchInput.value);

  // اگر عبارتی وارد نشده باشد، همهٔ دروسِ ترکیب فعلی نمایش داده می‌شود.
  if (!query) {
    renderResults(searchableCourses);
    return;
  }

  const found = searchableCourses.filter(function (item) {
    return item.searchIndex.includes(query);
  });

  renderResults(found);
}

function renderResults(list) {
  resultsBody.innerHTML = "";

  const total = list.length;
  updateResultsCount(total);

  if (total === 0) {
    const query = searchInput.value.trim();

    if (query) {
      showEmptyState(
        "نتیجه‌ای پیدا نشد",
        "برای عبارت «" + query + "» نتیجه‌ای یافت نشد. عبارت دیگری را امتحان کنید."
      );
    } else {
      showEmptyState(
        "دروسی برای نمایش وجود ندارد",
        "فایل اطلاعات این بخش خالی است."
      );
    }
    return;
  }

  if (total <= MAX_VISIBLE_RESULTS) {
    hideEmptyState();
  }

  const rowsHtml = list.slice(0, MAX_VISIBLE_RESULTS).map(function (item) {
    const course = item.original;

    return `
      <tr>
        <td>${escapeHtml(course["کد درس"])}</td>
        <td>${escapeHtml(course["نام درس"])}</td>
        <td>${escapeHtml(course["کد ارائه کلاس درس"])}</td>
        <td>${escapeHtml(course["تعداد واحد نظری"])}</td>
        <td>${escapeHtml(course["تعداد واحد عملی"])}</td>
        <td>${escapeHtml(course["استاد"])}</td>
        <td>${escapeHtml(course["حداکثر ظرفیت"])}</td>
        <td>${escapeHtml(course["جنسیت"])}</td>
        <td>${escapeHtml(course["زمانبندی تشکیل کلاس"])}</td>
        <td>${escapeHtml(course["زمان امتحان"])}</td>
      </tr>
    `;
  }).join("");

  resultsBody.innerHTML = rowsHtml;

  if (total > MAX_VISIBLE_RESULTS) {
    showEmptyState(
      "تعداد نتایج زیاد است",
      `فقط ${MAX_VISIBLE_RESULTS} سطر اول از مجموع ${total.toLocaleString("fa-IR")} سطر نمایش داده شده است. برای نتیجهٔ دقیق‌تر از کادر جستجو استفاده کنید.`
    );
  }
}

/*
  ============================================================
  بخش ۸: رویدادها
  ============================================================
*/

// تغییر هر یک از سه منوی کشویی.
courseTypeSelect.addEventListener("change", onFilterChange);
majorSelect.addEventListener("change", onFilterChange);
termSelect.addEventListener("change", onFilterChange);

// جستجو با کلیک روی دکمه.
searchButton.addEventListener("click", searchCourses);

// جستجوی زنده با تأخیر 180 میلی‌ثانیه (debounce).
searchInput.addEventListener("input", function () {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(searchCourses, 180);
});

// جستجو با کلید Enter.
searchInput.addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    clearTimeout(searchTimer);
    searchCourses();
  }
});

// چیپ‌های پیشنهادی (در صورت استفاده در HTML).
document.querySelectorAll(".chip").forEach(function (chip) {
  chip.addEventListener("click", function () {
    searchInput.value = chip.getAttribute("data-value") || "";
    searchInput.focus();
    searchCourses();
  });
});

/*
  ============================================================
  بخش ۹: اجرای اولیه
  ============================================================
*/

function initFilters() {
  fillSelect(courseTypeSelect, CONFIG.courseTypes, "");
  fillSelect(majorSelect, CONFIG.majors, "— انتخاب رشته —");
  fillSelect(termSelect, CONFIG.terms, "");

  // حالت پیش‌فرض: عمومی + اولین دورهٔ تعریف‌شده در CONFIG
  courseTypeSelect.value = "general";
  termSelect.value = CONFIG.terms[0].id;
  majorSelect.value = "";
  majorSelect.disabled = true;
}

initFilters();
onFilterChange();