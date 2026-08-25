(function () {
  "use strict";

  const STORAGE_KEY = "full-ai-course-state-v1";
  const TOTAL_LESSONS = 50;
  const HOME = "/full-ai-course.html";
  const LESSONS = [
    ...Array.from({ length: 47 }, (_, i) => {
      const number = String(i + 1).padStart(2, "0");
      return { id: `ch${number}`, href: `/ai-ml-encyclopedia/ch${number}.html`, label: `Chapter ${number}` };
    }),
    { id: "agents", href: "/full-ai-course/agents.html", label: "AI agents & orchestration" },
    { id: "graphs", href: "/full-ai-course/graphs-ontologies.html", label: "Graphs, ontologies & GraphRAG" },
    { id: "frontier", href: "/full-ai-course/frontier.html", label: "Frontier watch" }
  ];

  const MODULE_LESSONS = {
    foundations: ["ch01", "ch02", "ch03", "ch04", "ch05"],
    classical: ["ch06", "ch07", "ch08", "ch09", "ch10", "ch11", "ch12", "ch13"],
    deep: ["ch14", "ch15", "ch16", "ch17", "ch18"],
    applied: ["ch19", "ch20", "ch21", "ch22", "ch23", "ch24", "ch25", "ch26", "ch27", "ch28"],
    production: ["ch29", "ch30", "ch31"],
    reasoning: ["ch32", "ch33", "ch34", "ch35", "ch36", "ch37", "ch38"],
    "frontier-core": ["ch39", "ch40", "ch41", "ch42", "ch43", "ch44"],
    capstone: ["ch45", "ch46", "ch47", "agents", "graphs", "frontier"]
  };

  const PLANS = {
    understand: {
      title: "Foundation-first explorer",
      copy: "Build the complete mental model in sequence. You will meet the mathematics before the models, and the models before the systems that use them.",
      order: ["foundations", "classical", "deep", "applied", "reasoning", "production", "frontier-core", "capstone"]
    },
    models: {
      title: "Model builder",
      copy: "Prioritize the math-to-PyTorch bridge, training behavior, evaluation, and the architectures you are most likely to implement.",
      order: ["foundations", "deep", "classical", "applied", "frontier-core", "production", "reasoning", "capstone"]
    },
    agents: {
      title: "Agent & knowledge systems builder",
      copy: "Reach LLMs, retrieval, tools, planning, graphs, ontologies, and orchestration quickly—then circle back to deepen the foundations.",
      order: ["deep", "applied", "reasoning", "frontier-core", "capstone", "production", "foundations", "classical"]
    },
    production: {
      title: "Production AI engineer",
      copy: "Move early into deployment, infrastructure, evaluation, safety, and efficient serving while keeping the model foundations close by.",
      order: ["production", "deep", "applied", "capstone", "reasoning", "frontier-core", "foundations", "classical"]
    }
  };

  function emptyState() {
    return { active: false, profile: null, completed: [], lastVisited: null, updatedAt: null };
  }

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!parsed || !Array.isArray(parsed.completed)) return emptyState();
      return { ...emptyState(), ...parsed };
    } catch (_) {
      return emptyState();
    }
  }

  function saveState(state) {
    state.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function getPlan(state) {
    const goal = state.profile?.goal || "understand";
    const plan = PLANS[goal] || PLANS.understand;
    let order = [...plan.order];
    if (state.profile?.level === "new") {
      order = ["foundations", ...order.filter((id) => id !== "foundations")];
    } else if (state.profile?.level === "builder" && goal === "understand") {
      order = ["deep", "applied", "frontier-core", "capstone", "production", "reasoning", "foundations", "classical"];
    }
    return { ...plan, order };
  }

  function routeLessons(state) {
    const plan = getPlan(state);
    return plan.order.flatMap((moduleId) => MODULE_LESSONS[moduleId]);
  }

  function lessonById(id) {
    return LESSONS.find((lesson) => lesson.id === id);
  }

  function nextIncomplete(state) {
    const route = routeLessons(state);
    const id = route.find((lessonId) => !state.completed.includes(lessonId)) || route[0];
    return lessonById(id);
  }

  function lessonIdFromPath(pathname) {
    const match = pathname.match(/\/ai-ml-encyclopedia\/(ch\d{2})\.html$/);
    if (match) return match[1];
    if (/\/full-ai-course\/agents\.html$/.test(pathname)) return "agents";
    if (/\/full-ai-course\/graphs-ontologies\.html$/.test(pathname)) return "graphs";
    if (/\/full-ai-course\/frontier\.html$/.test(pathname)) return "frontier";
    return null;
  }

  function updateLanding(state) {
    const root = document.querySelector(".fac-page");
    if (!root) return;

    const count = state.completed.length;
    const percent = Math.round((count / TOTAL_LESSONS) * 100);
    root.querySelectorAll("[data-fac-complete-count]").forEach((el) => { el.textContent = String(count); });
    const bar = root.querySelector("[data-fac-progressbar]");
    const fill = root.querySelector("[data-fac-progress-fill]");
    if (bar) bar.setAttribute("aria-valuenow", String(count));
    if (fill) fill.style.width = `${percent}%`;

    const message = root.querySelector("[data-fac-progress-message]");
    if (message) {
      message.textContent = count === 0
        ? (state.active ? "Your path is ready. Start with the next recommended lesson." : "Personalize your route to begin.")
        : count === TOTAL_LESSONS ? "Course complete. Revisit any lesson whenever you need it." : `${percent}% complete · keep the chain going.`;
    }

    root.querySelectorAll("[data-lesson-id]").forEach((link) => {
      link.classList.toggle("is-complete", state.completed.includes(link.dataset.lessonId));
    });

    Object.entries(MODULE_LESSONS).forEach(([moduleId, ids]) => {
      const card = root.querySelector(`[data-module-id="${moduleId}"]`);
      if (card) card.classList.toggle("is-complete", ids.every((id) => state.completed.includes(id)));
    });

    if (state.profile) {
      const form = root.querySelector("[data-fac-profile]");
      ["level", "goal", "pace"].forEach((key) => {
        const input = form?.querySelector(`[name="fac-${key}"][value="${state.profile[key]}"]`);
        if (input) input.checked = true;
      });
      showRecommendation(root, state);
    }

    const next = nextIncomplete(state);
    root.querySelectorAll("[data-fac-continue], [data-fac-continue-secondary], [data-fac-final-cta]").forEach((link) => {
      if (state.active && next) {
        link.href = next.href;
        link.textContent = count ? "Continue learning" : "Start my first lesson";
      }
    });
  }

  function showRecommendation(root, state) {
    const plan = getPlan(state);
    const box = root.querySelector("[data-fac-recommendation]");
    if (!box) return;
    box.hidden = false;
    const title = box.querySelector("[data-fac-plan-title]");
    const copy = box.querySelector("[data-fac-plan-copy]");
    const session = box.querySelector("[data-fac-session]");
    const estimate = box.querySelector("[data-fac-estimate]");
    if (title) title.textContent = plan.title;
    if (copy) copy.textContent = plan.copy;
    if (session) session.textContent = `${state.profile.pace}-minute sessions`;
    if (estimate) {
      const hours = Math.ceil((TOTAL_LESSONS * Number(state.profile.pace)) / 60);
      estimate.textContent = `≈ ${hours} guided hours`;
    }

    plan.order.forEach((moduleId, index) => {
      const card = root.querySelector(`[data-module-id="${moduleId}"]`);
      if (!card) return;
      card.style.setProperty("--fac-order", String(index + 1));
      card.dataset.routeRank = index < 3 ? `0${index + 1}` : "";
      card.classList.toggle("is-recommended", index < 3);
    });

    const next = nextIncomplete(state);
    const link = box.querySelector("[data-fac-continue]");
    if (link && next) {
      link.href = next.href;
      link.textContent = state.completed.length ? "Continue my path" : "Start my path";
    }
  }

  function setupLanding() {
    const root = document.querySelector(".fac-page");
    if (!root) return;
    let state = loadState();
    updateLanding(state);

    root.querySelector("[data-fac-profile]")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      state = {
        ...state,
        active: true,
        profile: {
          level: data.get("fac-level"),
          goal: data.get("fac-goal"),
          pace: data.get("fac-pace")
        }
      };
      saveState(state);
      updateLanding(state);
      root.querySelector("[data-fac-recommendation]")?.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    root.querySelectorAll(".fac-lesson-link").forEach((link) => {
      link.addEventListener("click", () => {
        state.active = true;
        state.lastVisited = link.dataset.lessonId;
        saveState(state);
      });
    });

    root.querySelector("[data-fac-reset]")?.addEventListener("click", () => {
      if (!window.confirm("Reset your Full AI Course profile and all lesson progress on this device?")) return;
      localStorage.removeItem(STORAGE_KEY);
      state = emptyState();
      window.location.reload();
    });
  }

  function setupChapterBar() {
    const lessonId = lessonIdFromPath(window.location.pathname);
    if (!lessonId) return;
    let state = loadState();
    const params = new URLSearchParams(window.location.search);
    if (!state.active && params.get("course") !== "full-ai") return;

    state.active = true;
    state.lastVisited = lessonId;
    saveState(state);

    const main = document.querySelector("main.content, main#quarto-document-content");
    if (!main || main.querySelector(".fac-chapter-bar")) return;
    const lesson = lessonById(lessonId);
    const route = routeLessons(state);
    const index = route.indexOf(lessonId);
    const next = lessonById(route[index + 1] || route.find((id) => !state.completed.includes(id)) || route[0]);
    const complete = state.completed.includes(lessonId);

    const bar = document.createElement("aside");
    bar.className = "fac-chapter-bar";
    bar.setAttribute("aria-label", "Full AI Course progress");
    bar.innerHTML = `
      <div class="fac-chapter-bar-copy">
        <span>${String(index + 1).padStart(2, "0")}</span>
        <div><strong>Full AI Course</strong><small>${lesson?.label || "Course lesson"} · ${state.completed.length}/${TOTAL_LESSONS} complete</small></div>
      </div>
      <div class="fac-chapter-bar-actions">
        <a class="fac-button fac-button-secondary" href="${HOME}">Course map</a>
        <button class="fac-button ${complete ? "fac-button-secondary" : "fac-button-primary"}" type="button" data-fac-mark>${complete ? "Completed ✓" : "Mark complete"}</button>
        ${next && next.id !== lessonId ? `<a class="fac-button fac-button-secondary" href="${next.href}">Next lesson →</a>` : ""}
      </div>`;

    const titleBlock = main.querySelector("header.quarto-title-block") || main.firstElementChild;
    if (titleBlock?.nextSibling) main.insertBefore(bar, titleBlock.nextSibling);
    else main.prepend(bar);

    bar.querySelector("[data-fac-mark]")?.addEventListener("click", (event) => {
      state = loadState();
      const alreadyComplete = state.completed.includes(lessonId);
      state.completed = alreadyComplete
        ? state.completed.filter((id) => id !== lessonId)
        : [...new Set([...state.completed, lessonId])];
      state.active = true;
      saveState(state);
      event.currentTarget.textContent = alreadyComplete ? "Mark complete" : "Completed ✓";
      event.currentTarget.classList.toggle("fac-button-primary", alreadyComplete);
      event.currentTarget.classList.toggle("fac-button-secondary", !alreadyComplete);
      const small = bar.querySelector("small");
      if (small) small.textContent = `${lesson?.label || "Course lesson"} · ${state.completed.length}/${TOTAL_LESSONS} complete`;
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    setupLanding();
    setupChapterBar();
  });
})();
