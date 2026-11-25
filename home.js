function initHome() {
  if (!document.body.classList.contains("home-page")) return;

  const list = window["quarto-listings"]?.["listing-articles"];
  const items = [...(list?.items || [])];

  // 读取文章分类，支持中文。
  function getCategories(item) {
    try {
      const value = item.elm.dataset.categories;
      return value
        ? decodeURIComponent(atob(value)).split(",").filter(Boolean)
        : [];
    } catch {
      return [];
    }
  }

  const categoryCounts = new Map();

  for (const item of items) {
    for (const category of new Set(getCategories(item))) {
      categoryCounts.set(
        category,
        (categoryCounts.get(category) || 0) + 1
      );
    }
  }

  // 分类按钮与文章筛选。
  const categoryBar = document.getElementById("category-bar");
  const categoryButtons = new Map();

  function filterArticles(category) {
    const selected = categoryCounts.has(category) ? category : "";

    if (list) {
      list.filter(
        selected
          ? item => getCategories(item).includes(selected)
          : undefined
      );
    }

    for (const [name, button] of categoryButtons) {
      button.setAttribute(
        "aria-pressed",
        String(name === selected)
      );
    }

    const count = list ? list.matchingItems.length : 0;

    document.getElementById("article-summary").textContent =
      `共 ${count} 篇`;

    document.getElementById("listing-empty").hidden = count > 0;
  }

  function selectCategory(category) {
    const hash = category
      ? `#category=${encodeURIComponent(category)}`
      : "#journal";

    history.replaceState(null, "", hash);
    filterArticles(category);
  }

  categoryBar.replaceChildren();

  const entries = [
    ["", items.length],
    ...categoryCounts.entries()
  ];

  for (const [name, count] of entries) {
    const button = document.createElement("button");
    button.type = "button";
    button.append(document.createTextNode(name || "全部"));

    const badge = document.createElement("span");
    badge.textContent = count;
    button.append(badge);

    button.addEventListener("click", () => {
      selectCategory(name);
    });

    categoryButtons.set(name, button);
    categoryBar.append(button);
  }

  // 点击文章卡片上的标签，也可以筛选。
  document.querySelectorAll(
    "#listing-articles .listing-category"
  ).forEach(tag => {
    tag.removeAttribute("onclick");
    tag.setAttribute("role", "button");
    tag.tabIndex = 0;

    function activate() {
      selectCategory(tag.textContent.trim());
      document.getElementById("journal").scrollIntoView();
    }

    tag.addEventListener("click", activate);

    tag.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activate();
      }
    });
  });

  function readCategoryHash() {
    try {
      return location.hash.startsWith("#category=")
        ? decodeURIComponent(location.hash.slice(10))
        : "";
    } catch {
      return "";
    }
  }

  filterArticles(readCategoryHash());

  window.addEventListener("hashchange", () => {
    filterArticles(readCategoryHash());
  });

  // 日期统一使用北京时间。
  const timezone = "Asia/Shanghai";

  function dateKey(date) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(date);

    const get = type =>
      parts.find(part => part.type === type).value;

    return `${get("year")}-${get("month")}-${get("day")}`;
  }

  const posts = items.map(item => {
    const rawDate = item.elm.dataset.listingDateSort;
    const titleLink = item.elm.querySelector(".listing-title a");

    return {
      stamp: rawDate ? Number(rawDate) : NaN,
      title: titleLink?.textContent.trim() || "",
      url: titleLink?.getAttribute("href")
    };
  }).filter(post => Number.isFinite(post.stamp))
    .map(post => ({
      ...post,
      key: dateKey(new Date(post.stamp))
    }))
    .sort((a, b) => a.key.localeCompare(b.key));

  // 从实际文章生成站点统计。
  function setStat(name, value) {
    document.querySelectorAll(
      `[data-stat="${name}"]`
    ).forEach(element => {
      element.textContent = value;
    });
  }

  const today = dateKey(new Date());
  const firstDate = posts[0]?.key;

  const writingDays = firstDate
    ? Math.floor(
        (
          Date.parse(today + "T00:00:00Z") -
          Date.parse(firstDate + "T00:00:00Z")
        ) / 86400000
      ) + 1
    : 0;

  setStat("posts", items.length);
  setStat("categories", categoryCounts.size);
  setStat("days", Math.max(0, writingDays));
  setStat("latest", posts.at(-1)?.key || "暂无");

  // 实时时钟。
  function updateClock() {
    const now = new Date();
    const clock = document.getElementById("live-clock");

    clock.textContent = new Intl.DateTimeFormat("zh-CN", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    }).format(now);

    clock.dateTime = now.toISOString();

    document.getElementById("live-date").textContent =
      new Intl.DateTimeFormat("zh-CN", {
        timeZone: timezone,
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "long"
      }).format(now);
  }

  updateClock();
  setInterval(updateClock, 1000);

  // 日历：标出文章日期，点击可打开文章。
  let [year, month] = today.split("-").map(Number);

  function renderCalendar() {
    document.getElementById("calendar-label").textContent =
      `${year}年${month}月`;

    const calendar = document.getElementById("calendar-days");
    calendar.replaceChildren();

    const offset =
      (new Date(year, month - 1, 1).getDay() + 6) % 7;

    for (let i = 0; i < offset; i++) {
      calendar.append(document.createElement("span"));
    }

    const totalDays = new Date(year, month, 0).getDate();

    for (let day = 1; day <= totalDays; day++) {
      const key =
        `${year}-` +
        `${String(month).padStart(2, "0")}-` +
        String(day).padStart(2, "0");

      const matches = posts.filter(post =>
        post.key === key && post.url
      );

      const cell = document.createElement(
        matches.length ? "a" : "span"
      );

      cell.textContent = day;

      if (matches.length) {
        cell.href = matches[0].url;
        cell.classList.add("has-post");
        cell.title = matches.map(post => post.title).join("\n");
        cell.setAttribute(
          "aria-label",
          `${key}，${matches.length}篇文章`
        );
      }

      if (key === dateKey(new Date())) {
        cell.classList.add("is-today");
        cell.setAttribute("aria-current", "date");
      }

      calendar.append(cell);
    }
  }

  function changeMonth(delta) {
    const date = new Date(year, month - 1 + delta, 1);
    year = date.getFullYear();
    month = date.getMonth() + 1;
    renderCalendar();
  }

  document.getElementById("calendar-prev")
    .addEventListener("click", () => changeMonth(-1));

  document.getElementById("calendar-next")
    .addEventListener("click", () => changeMonth(1));

  document.getElementById("calendar-today")
    .addEventListener("click", () => {
      [year, month] = dateKey(new Date()).split("-").map(Number);
      renderCalendar();
    });

  renderCalendar();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initHome);
} else {
  initHome();
}