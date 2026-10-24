(function () {
  // Candidate Profile Configuration
  const PROFILE_CONFIG = {
    totalExperience: "12",
    currentCtc: "55", // LPA
    expectedCtc: "55", // LPA
    noticePeriodDays: "0",
    relocate: "Yes",
    teamSize: "10",
    // Leave blank to answer these with the default text below
    currentLocation: "",
    preferredLocation: "Any",
    currentCompany: "",
    currentDesignation: "",
    highestQualification: "",

    // Years of experience per skill, checked in order (first match wins)
    skillExperience: [
      [/python/, "6"],
      [/django/, "6"],
      [/flask/, "6"],
      [/fast\s*api/, "5"],
      [/javascript|typescript|react|angular|node/, "5"],
      [/\bjava\b|j2ee|\bjvm\b/, "9"],
      [/spring|hibernate/, "9"],
      [/c#|c sharp|\.net|dotnet|asp\.?net|entity framework/, "9"],
      [/golang|\bgo\s*(lang|language|programming|developer|development)\b|\bin go\b/, "6"],
      [/\brust\b/, "7"],
      [/gen\s*ai|generative|llm|large language|prompt|rag\b|agentic/, "2"],
      [/machine learning|\bml\b|\bai\b|artificial intelligence|data science/, "2"],
      [/micro\s*services|distributed|rest(ful)? api|\bapi\b/, "9"],
      [/aws|azure|gcp|cloud/, "6"],
      [/docker|kubernetes|\bk8s\b|devops|ci\s*\/?\s*cd|jenkins|terraform/, "5"],
      [/kafka|rabbitmq|messaging|event[- ]driven/, "5"],
      [/sql|database|postgres|mysql|oracle|mongo|nosql|redis/, "9"],
      [/linux|unix|shell|bash/, "6"],
      [/architect|system design|solution design|technical design/, "12"],
      [/manag|leadership|team lead|leading team|people lead|delivery|stakeholder|head of/, "12"],
      [/agile|scrum/, "9"],
      [/testing|unit test|automation|tdd/, "6"]
    ],

    // Used when a question isn't covered, picked by the kind of answer it expects (dates use today's date)
    defaults: { number: "1", text: "Python", yesNo: "Yes" }
  };

  // Questionnaire answers, checked in order (first match wins). Empty answers fall through to the defaults.
  const QUESTION_ANSWERS = [
    [/serving.*notice|on notice period|currently on notice/, "Yes"],
    [/immediate(ly)? join|join immediately|immediate joiner/, "Yes"],
    [/notice/, PROFILE_CONFIG.noticePeriodDays],
    [/when can you join|joining date|date of joining|earliest.*join|available to join|start date/, todayDate()],
    [/negotiable/, "Yes"],
    [/expect.*(ctc|salary|package|compensation)|(ctc|salary|package|compensation).*expect/, PROFILE_CONFIG.expectedCtc],
    [/(ctc|salary|package|compensation|fixed pay)/, PROFILE_CONFIG.currentCtc],
    [/relocat/, PROFILE_CONFIG.relocate],
    [/work from office|\bwfo\b|on-?site|office.*days|days.*office|hybrid/, "Yes"],
    [/remote|work from home|\bwfh\b/, "Yes"],
    [/shift/, "Yes"],
    [/travel/, "Yes"],
    [/current(ly)? (location|city)|where are you (based|located)|currently located|current place/, PROFILE_CONFIG.currentLocation],
    [/preferred (location|city)|location preference/, PROFILE_CONFIG.preferredLocation],
    [/current (company|employer|organi[sz]ation)|currently working (with|for|at)/, PROFILE_CONFIG.currentCompany],
    [/current (designation|role|title|position)/, PROFILE_CONFIG.currentDesignation],
    [/qualification|degree|graduat|education/, PROFILE_CONFIG.highestQualification],
    [/team size|size of (the|your) team|how many (people|members|engineers|reportees|direct reports)|people (have you|did you) (manage|lead)|direct reports|reportees/, PROFILE_CONFIG.teamSize],
    [/offer in hand|holding (an |any )?offers?|other offers?|any offers?/, "No"],
    [/full[- ]time|permanent (role|position|opportunity|job)/, "Yes"],
    [/passport/, "Yes"],
    [/visa|work permit|authori[sz]ed to work|eligible to work/, "Yes"],
    [/background (check|verification)|\bbgv\b/, "Yes"],
    [/bond|service agreement/, "Yes"],
    [/contract|c2h|third[- ]party|payroll/, "Yes"],
    [/interview|available for (a )?(call|discussion|f2f|face)/, "Yes"],
    [/english|communication/, "Yes"],
    [/(rate|rating|scale).*(out of 5|1\s*(-|to)\s*5)\b/, "4"],
    [/rate yourself|rating|on a scale|out of 10/, "8"],
    [/previously (employed|worked)|ex-?employee|former employee|worked (with|for|at) (us|this company) before/, "No"],
    [/willing|comfortable|okay with|ok with|open to|agree|confirm/, "Yes"]
  ];

  // Any date question (last working day, joining date, DOB...) is answered with today's date
  const DATE_QUESTION = /\bdate\b|\bdob\b|birth|when can you (join|start)|available from|last working|\blwd\b|relieving|dd\s*\/\s*mm|mm\s*\/\s*yy/;

  function todayDate() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
  }

  // Formats to try in a text box when the bot rejects the previous one
  function todayDateFormats() {
    const [d, m, y] = todayDate().split("/");
    return [`${d}/${m}/${y}`, `${d}-${m}-${y}`, `${y}-${m}-${d}`, `${m}/${y}`];
  }

  const ACTION_DELAY_MS = 2000; // 2 seconds
  const STATE_KEY = "naukriBotState";
  // A run applies to recruiter invites in the Inbox first, then to Recommended jobs
  const INBOX_URL = "https://www.naukri.com/mnjuser/inbox";
  const RECOMMENDED_URL = "https://www.naukri.com/mnjuser/recommendedjobs";
  const STAGE_INBOX = 0;
  const STAGE_RECOMMENDED = 1;
  let isRunning = false;
  let appliedCount = 0;
  // Jobs are applied on their own pages, so the run has to survive page navigations
  let run = { stage: STAGE_INBOX, queue: [], done: [] };

  function delay(ms = ACTION_DELAY_MS) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function persist() {
    try {
      sessionStorage.setItem(STATE_KEY, JSON.stringify({ isRunning, appliedCount, ...run }));
    } catch (e) {
      console.warn("Could not save run state", e);
    }
  }

  function restore() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STATE_KEY) || "null");
      if (!saved) return;
      isRunning = !!saved.isRunning;
      appliedCount = saved.appliedCount || 0;
      run = {
        stage: saved.stage || STAGE_INBOX,
        queue: saved.queue || [],
        done: saved.done || []
      };
    } catch (e) {
      console.warn("Could not restore run state", e);
    }
  }

  function isVisible(el) {
    return !!el && el.getClientRects().length > 0;
  }

  function isJobPage() {
    return location.pathname.startsWith("/job-listings-");
  }

  function isOnPage(url) {
    return location.pathname.startsWith(new URL(url).pathname);
  }

  // 1. Trigger robust human-like click event for React / Angular / Vue
  function simulateClick(element) {
    if (!element) return;
    try {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (e) {
      console.warn("Could not scroll into view", e);
    }
    ["mouseenter", "mouseover", "mousedown", "mouseup", "click"].forEach((eventType) => {
      const event = new MouseEvent(eventType, {
        bubbles: true,
        cancelable: true,
        view: window
      });
      element.dispatchEvent(event);
    });
  }

  // 2. Create Floating HUD Widget
  function createWidget() {
    if (document.getElementById("naukri-bot-panel")) return;

    const panel = document.createElement("div");
    panel.id = "naukri-bot-panel";
    panel.innerHTML = `
      <h4>🚀 Naukri Multi-Apply (5 in 1)</h4>
      <button id="naukri-bot-btn">Start Auto Apply</button>
      <div id="naukri-bot-status">Status: Ready (0 applied)</div>
    `;
    document.body.appendChild(panel);

    const btn = document.getElementById("naukri-bot-btn");
    btn.addEventListener("click", () => {
      isRunning = !isRunning;
      if (isRunning) {
        run = { stage: STAGE_INBOX, queue: [], done: [] };
        persist();
        syncButton();
        updateStatus("Starting with recruiter invites in your Inbox...");
        startApplierLoop();
      } else {
        persist();
        syncButton();
        updateStatus(`Paused. Total applied: ${appliedCount}`);
      }
    });
    syncButton();
  }

  function syncButton() {
    const btn = document.getElementById("naukri-bot-btn");
    if (!btn) return;
    btn.textContent = isRunning ? "Stop Automation" : "Start Auto Apply";
    btn.classList.toggle("running", isRunning);
  }

  function updateStatus(text) {
    const el = document.getElementById("naukri-bot-status");
    if (el) el.textContent = `Status: ${text}`;
  }

  function finishRun(text) {
    isRunning = false;
    persist();
    syncButton();
    updateStatus(text);
  }

  // 3. Answer Naukri's chatbot questionnaire (drawer of bot messages + text box, radio or chip options)
  const YES_NO_QUESTION = /^(are|do|does|did|have|has|had|is|was|can|could|will|would|should)\b/;

  // Fallback answer picked from the kind of value the question expects: date, yes/no, number or text
  function defaultAnswer(question) {
    const q = question.toLowerCase();
    if (DATE_QUESTION.test(q)) return todayDate();
    if (YES_NO_QUESTION.test(q) && !/how many|how much/.test(q)) return PROFILE_CONFIG.defaults.yesNo;
    if (/how many|how much|number of|\bno\.? of\b|years|\byoe\b|\bexp\b|months|days|\bctc\b|salary|lpa|lakh|percent|%|count|size|\bage\b/.test(q)) {
      return PROFILE_CONFIG.defaults.number;
    }
    return PROFILE_CONFIG.defaults.text;
  }

  function answerFor(question) {
    const q = question.toLowerCase();
    if (DATE_QUESTION.test(q)) return todayDate();
    const known = QUESTION_ANSWERS.find(([pattern, answer]) => answer && pattern.test(q));
    if (known) return known[1];
    if (YES_NO_QUESTION.test(q) && !/how many|how much/.test(q)) return PROFILE_CONFIG.defaults.yesNo;
    if (/experience|years|yrs|\byoe\b|\bexp\b|how long/.test(q)) {
      const skill = PROFILE_CONFIG.skillExperience.find(([pattern]) => pattern.test(q));
      return skill ? skill[1] : PROFILE_CONFIG.totalExperience;
    }
    return defaultAnswer(question);
  }

  // Answers to try in order when the bot rejects one and asks again
  function answerCandidates(question) {
    if (DATE_QUESTION.test(question.toLowerCase())) return todayDateFormats();
    const { number, yesNo, text } = PROFILE_CONFIG.defaults;
    return [...new Set([answerFor(question), defaultAnswer(question), number, yesNo, text, todayDate()])];
  }

  function chatbotTextBox(bot) {
    const box = bot.querySelector(".textArea[contenteditable='true']");
    return isVisible(box) ? box : null;
  }

  function chatbotOptions(bot) {
    const inputs = Array.from(bot.querySelectorAll("input[type='radio'], input[type='checkbox']"))
      .filter((input) => !input.disabled && !input.closest("li.userItem"))
      .map((input) => {
        const label =
          (input.id && bot.querySelector(`label[for="${CSS.escape(input.id)}"]`)) ||
          input.closest("label") ||
          input.parentElement;
        return {
          el: input,
          text: ((label && label.innerText) || input.value || "").trim().toLowerCase(),
          shown: isVisible(input) || isVisible(label)
        };
      })
      .filter((option) => option.shown);
    const chips = Array.from(bot.querySelectorAll(".chatbot_Chip, .chipItem"))
      .filter((chip) => isVisible(chip) && !chip.closest("li.userItem"))
      .map((chip) => ({ el: chip, text: (chip.innerText || "").trim().toLowerCase() }));
    return [...inputs, ...chips];
  }

  // Turn option text like "0-2 years", "5+ years", "15 days or less" or "Immediate" into a [min, max] range
  function optionRange(text) {
    if (/immediate|serving/.test(text)) return [0, 0];
    const scale = text.includes("month") ? 30 : 1;
    const nums = (text.match(/\d+(\.\d+)?/g) || []).map((n) => Number(n) * scale);
    if (nums.length === 0) return null;
    if (/\+|more|above|over|greater/.test(text)) return [nums[0], Infinity];
    if (/less|below|under|upto|up to|within/.test(text)) return [0, nums[nums.length - 1]];
    return [nums[0], nums[nums.length - 1]];
  }

  function pickOption(options, answer) {
    const want = String(answer).trim().toLowerCase();
    const exact = options.find((option) => option.text === want);
    if (exact) return exact;
    if (isNaN(Number(want))) {
      return (want.length > 2 && options.find((option) => option.text.includes(want))) || null;
    }
    return (
      options.find((option) => {
        const range = optionRange(option.text);
        return range && Number(want) >= range[0] && Number(want) <= range[1];
      }) || null
    );
  }

  // "Save" stays disabled until there is an answer to send
  function clickSave(bot) {
    const send = bot.querySelector(".sendMsg");
    if (!isVisible(send) || send.closest(".disabled")) return false;
    simulateClick(send);
    return true;
  }

  // Date questions use a calendar (date / month / year tabs, today's cell marked "-current")
  // or separate day / month / year boxes instead of the text box
  function chatbotDateWidget(bot) {
    return [bot.querySelector(".calendar-container"), bot.querySelector(".dob__container")].find(isVisible) || null;
  }

  async function fillDateWidget(widget) {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    if (widget.classList.contains("dob__container")) {
      const parts = { Day: pad(now.getDate()), Month: pad(now.getMonth() + 1), Year: String(now.getFullYear()) };
      for (const [part, value] of Object.entries(parts)) {
        const input = widget.querySelector(`[id^='dobInput${part}_']`);
        if (!input) continue;
        input.value = value;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
      await delay(500);
      return true;
    }

    simulateClick(widget.querySelector(".cc__calendar-icon") || widget.querySelector("input"));
    await delay(500);
    const today = {
      date: String(now.getDate()),
      month: now.toLocaleString("en", { month: "short" }).toLowerCase(),
      year: String(now.getFullYear())
    };
    // Picking a cell fills that part and moves the calendar on to the next tab
    const parts = Array.from(widget.querySelectorAll(".cc__calendar-navitem")).map((nav) => nav.id.replace(/^cc__|-navitem$/g, ""));
    for (const part of parts) {
      const cells = Array.from(widget.querySelectorAll(`.cc__calendar-${part}`));
      const cell =
        cells.find((c) => c.querySelector(`.cc__calendar-${part}-current`)) ||
        cells.find((c) => {
          const text = c.textContent.trim().toLowerCase();
          return part === "month" ? text.startsWith(today.month) : text === today[part];
        });
      if (!cell) return false;
      simulateClick(cell);
      await delay(500);
    }
    return true;
  }

  // Answers with the bot's own "Skip this question" option when there is one
  async function skipQuestion(bot) {
    const skip = chatbotOptions(bot).find((option) => option.text.includes("skip"));
    if (!skip) return null;
    simulateClick(skip.el);
    await delay(500);
    clickSave(bot);
    return skip.text;
  }

  // Returns the answer that was sent, or null when nothing could be sent
  async function submitAnswer(bot, candidates) {
    const dateWidget = chatbotDateWidget(bot);
    if (dateWidget) {
      if ((await fillDateWidget(dateWidget)) && clickSave(bot)) return todayDate();
      return skipQuestion(bot);
    }

    // Optional questions show a text box plus a lone "Skip this question" chip: answer in the text box
    const options = chatbotOptions(bot);
    if (options.some((option) => !option.text.includes("skip"))) {
      // Never leave a choice unanswered: best match, else "Yes", else the first real option (not "Skip this question")
      const choice =
        candidates.map((answer) => pickOption(options, answer)).find(Boolean) ||
        options.find((option) => option.text.startsWith("yes")) ||
        options.find((option) => !option.text.includes("skip")) ||
        options[0];
      simulateClick(choice.el);
      await delay(500);
      clickSave(bot); // chips send themselves, radios and checkboxes need "Save"
      return choice.text;
    }

    const box = chatbotTextBox(bot);
    if (!box) return skipQuestion(bot);
    for (const answer of candidates) {
      box.focus();
      box.textContent = answer;
      box.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: answer }));
      await delay(500);
      if (clickSave(bot)) return answer;
    }
    return skipQuestion(bot);
  }

  // The Inbox keeps a finished chatbot in the page with its drawer hidden, so only an open one counts
  function activeChatbot() {
    return (
      Array.from(document.querySelectorAll("._chatBotContainer")).find((bot) => {
        const drawer = bot.querySelector(".chatbot_Drawer");
        return drawer && !/Hide\b/.test(drawer.className);
      }) || null
    );
  }

  // Answers every question without stopping. Returns true once the questionnaire closes,
  // false if it gets stuck (the job is then skipped) or the run is stopped.
  async function handleQuestionnairePopup() {
    let handledCount = 0; // bot messages already dealt with
    let lastQuestion = "";
    let lastProgress = Date.now();
    const attempts = {}; // question -> how many answers were already tried
    while (isRunning) {
      const bot = activeChatbot();
      if (!bot) return true;
      if (Date.now() - lastProgress > 60000) return false;

      const hasControls = () => !!chatbotTextBox(bot) || !!chatbotDateWidget(bot) || chatbotOptions(bot).length > 0;
      const count = bot.querySelectorAll("li.botItem").length;
      if (count <= handledCount || !hasControls()) {
        await delay(1000);
        continue;
      }
      // Let the bot finish posting; greetings and prompts without "?" get longer to be followed by the real question.
      // New messages can still be animating in (empty innerText), so the text is read again after the wait.
      const messageText = () => {
        const li = bot.querySelectorAll("li.botItem")[count - 1];
        return (li.innerText || li.textContent || "").replace(/\s+/g, " ").trim();
      };
      await delay(/\?\s*$/.test(messageText()) ? 1000 : 4000);
      // More messages arrived, or the bot's closing message hid the input: nothing to answer yet
      if (bot.querySelectorAll("li.botItem").length !== count || !hasControls()) continue;
      const latest = messageText();
      if (!latest) continue; // still the bot's "typing..." placeholder
      handledCount = count;
      if (/thank you for (showing interest|your responses)|kindly answer all/i.test(latest)) continue;

      // A validation message re-asks the previous question, so move on to its next candidate answer
      const isRetry = /invalid|valid (number|value|input|answer|date)|incorrect|must be|should be|only (numbers|digits)|numeric/i.test(latest);
      const question = isRetry && lastQuestion ? lastQuestion : latest;
      const tried = attempts[question] || 0;
      const candidates = answerCandidates(question).slice(tried);
      // Every answer was rejected: skip just this question if the bot allows it, else give up on the job
      const sent = candidates.length > 0 ? await submitAnswer(bot, candidates) : await skipQuestion(bot);
      if (candidates.length === 0 && sent === null) return false;
      if (sent === null) continue; // nothing could be sent; the stall timeout above gives up on the job
      attempts[question] = tried + 1 + Math.max(0, candidates.indexOf(sent));
      lastQuestion = question;
      lastProgress = Date.now();
      const shortQuestion = question.length > 90 ? `${question.slice(0, 90)}...` : question;
      updateStatus(`Answered "${shortQuestion}" with ${sent}`);
    }
    return false;
  }

  // 4. Apply on a single job page (TopTier "Quick apply" or classic "Apply")
  const APPLY_LABELS = ["quick apply", "apply", "easy apply", "apply now", "apply on naukri"];

  function findApplyButton() {
    return Array.from(document.querySelectorAll("button, #apply-button")).find((el) => {
      const firstLine = ((el.innerText || "").trim().split("\n")[0] || "").toLowerCase();
      return el.offsetParent !== null && (APPLY_LABELS.includes(firstLine) || firstLine === "applied");
    });
  }

  function buttonLabel(btn) {
    // TopTier stacks "Quick apply" / loading / "Applied" labels in the button and slides the active one into view
    const shown = btn.querySelector("span.translate-y-0");
    return (((shown || btn).innerText || "").trim().split("\n")[0] || "").toLowerCase();
  }

  async function waitForApplyResult(btn) {
    let idle = 0;
    while (isRunning && idle < 30000) {
      if (activeChatbot()) {
        if (!(await handleQuestionnairePopup())) return false; // stuck on the questionnaire: skip this job
        idle = 0;
        continue;
      }
      const current = btn.isConnected ? btn : findApplyButton();
      // TopTier swaps the job page for "Similar opportunities" once the apply goes through
      if (!current || buttonLabel(current) === "applied") return true;
      btn = current;
      await delay(1000);
      idle += 1000;
    }
    return false;
  }

  async function applyOnJobPage() {
    let btn = null;
    for (let i = 0; i < 10 && isRunning && !btn; i++) {
      btn = findApplyButton();
      if (!btn) await delay(1000);
    }
    if (!isRunning) return;
    if (!btn) {
      updateStatus("No Quick apply button on this job (company-site apply?). Skipping...");
      return;
    }
    if (buttonLabel(btn) === "applied") {
      updateStatus("Already applied to this job. Skipping...");
      return;
    }

    updateStatus("Clicking Quick apply...");
    simulateClick(btn);
    await delay(ACTION_DELAY_MS);

    if (await waitForApplyResult(btn)) {
      appliedCount++;
      persist();
      updateStatus(`Applied! Total applied: ${appliedCount}`);
    } else if (isRunning) {
      updateStatus("Application didn't go through. Skipping...");
    }
  }

  // 5. Read the TopTier recommended / search job lists.
  // Job cards are plain divs that open the job in a new tab; the job URL and apply type only live
  // in React props, which is why this script runs in the page's MAIN world (see manifest.json).
  function reactJobData(el) {
    const fiberKey = Object.keys(el).find((k) => k.startsWith("__reactFiber"));
    let fiber = fiberKey ? el[fiberKey] : null;
    for (let i = 0; i < 4 && fiber; i++) {
      const props = fiber.memoizedProps;
      if (props && props.jobData && props.jobData.jdURL) return props.jobData;
      if (props && props.job && props.job.jdURL) return props.job;
      fiber = fiber.return;
    }
    return null;
  }

  function listedJobs() {
    const jobs = new Map();
    document.querySelectorAll("div").forEach((el) => {
      const job = reactJobData(el);
      if (job) jobs.set(job.jdURL.split("?")[0], job);
    });
    return jobs;
  }

  async function queueJobsFromList() {
    for (let attempt = 0; attempt < 8 && isRunning; attempt++) {
      const fresh = [];
      listedJobs().forEach((job, path) => {
        const quickApply = !job.jobApplyType || job.jobApplyType === "quickApply";
        if (quickApply && !job.isApplied && !job.applied && !run.done.includes(path)) fresh.push(path);
      });
      if (fresh.length > 0) {
        run.queue = fresh;
        run.done.push(...fresh);
        persist();
        updateStatus(`Queued ${fresh.length} Quick apply jobs...`);
        return true;
      }
      updateStatus("Scrolling to load more jobs...");
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
      await delay(ACTION_DELAY_MS);
    }
    return false;
  }

  async function goToNextJob() {
    if (!isRunning) return;
    const next = run.queue.shift();
    persist();
    await delay(ACTION_DELAY_MS);
    if (!isRunning) return;
    if (next) {
      updateStatus(`Opening next job (${run.queue.length} more queued)...`);
      location.assign(next);
    } else {
      updateStatus("Queue done. Back to the job list for more...");
      location.assign(RECOMMENDED_URL);
    }
  }

  // 6. Recruiter invites on the Inbox page: each card opens a drawer with its own "Apply" button,
  // so invites are applied in place without leaving the page
  function reactInviteData(card) {
    const fiberKey = Object.keys(card).find((k) => k.startsWith("__reactFiber"));
    let fiber = fiberKey ? card[fiberKey] : null;
    for (let i = 0; i < 4 && fiber; i++) {
      const props = fiber.memoizedProps;
      if (props && props.data && props.data.applyUrlData) return props.data;
      fiber = fiber.return;
    }
    return null;
  }

  function pendingInvites() {
    return Array.from(document.querySelectorAll("[data-inviteid]")).filter((card) => {
      const invite = reactInviteData(card);
      return !run.done.includes(`invite:${card.getAttribute("data-inviteid")}`) && !(invite && invite.isApplied);
    });
  }

  function closeInviteDrawer() {
    const close = document.querySelector("img[alt='X']");
    if (close) simulateClick(close);
  }

  async function applyToInvite(card) {
    run.done.push(`invite:${card.getAttribute("data-inviteid")}`);
    persist();
    // The click handler sits on the inner card, not on the [data-inviteid] wrapper
    simulateClick(card.querySelector("[class*='cursor-pointer']") || card);
    let btn = null;
    for (let i = 0; i < 10 && isRunning && !btn; i++) {
      await delay(500);
      btn = findApplyButton();
    }
    if (btn && buttonLabel(btn) !== "applied") {
      updateStatus("Applying to recruiter invite...");
      simulateClick(btn);
      await delay(ACTION_DELAY_MS);
      if (await waitForApplyResult(btn)) {
        appliedCount++;
        persist();
        updateStatus(`Applied! Total applied: ${appliedCount}`);
      } else if (isRunning) {
        updateStatus("Invite apply didn't go through. Skipping...");
      }
    }
    closeInviteDrawer();
    await delay(ACTION_DELAY_MS);
  }

  async function applyInboxInvites() {
    for (let i = 0; i < 5 && isRunning && !document.querySelector("[data-inviteid]"); i++) await delay(1000);
    // "Most relevant" invites first, then the "Others" tab
    for (const tab of ["most relevant", "others"]) {
      const tabChip = Array.from(document.querySelectorAll("button, div, span")).find(
        (el) => el.childElementCount === 0 && isVisible(el) && (el.innerText || "").trim().toLowerCase() === tab
      );
      if (tabChip) {
        simulateClick(tabChip);
        await delay(ACTION_DELAY_MS);
      }
      let idleScrolls = 0;
      while (isRunning && idleScrolls < 3) {
        const card = pendingInvites()[0];
        if (card) {
          idleScrolls = 0;
          await applyToInvite(card);
          continue;
        }
        updateStatus("Scrolling for more recruiter invites...");
        const cards = document.querySelectorAll("[data-inviteid]");
        if (cards.length) cards[cards.length - 1].scrollIntoView({ block: "end" });
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
        await delay(ACTION_DELAY_MS);
        idleScrolls++;
      }
    }
  }

  // 7. Main entry: Inbox invites first, then Recommended jobs (job page -> apply and move on;
  // job list -> queue jobs; otherwise classic layout)
  async function startApplierLoop() {
    try {
      if (run.stage === STAGE_INBOX) {
        if (!isOnPage(INBOX_URL)) {
          location.assign(INBOX_URL);
          return;
        }
        await applyInboxInvites();
        if (!isRunning) return;
        run.stage = STAGE_RECOMMENDED;
        persist();
        updateStatus("Inbox done. Moving on to Recommended jobs...");
        await delay(ACTION_DELAY_MS);
        if (isRunning) location.assign(RECOMMENDED_URL);
        return;
      }

      if (isJobPage()) {
        await applyOnJobPage();
        await goToNextJob();
        return;
      }
      if (!isOnPage(RECOMMENDED_URL)) {
        location.assign(RECOMMENDED_URL);
        return;
      }

      let jobs = listedJobs();
      for (let i = 0; i < 5 && isRunning && jobs.size === 0; i++) {
        await delay(1000);
        jobs = listedJobs();
      }
      if (!isRunning) return;
      if (jobs.size === 0) {
        await legacyApplierLoop();
        return;
      }

      if (await queueJobsFromList()) {
        await goToNextJob();
      } else if (isRunning) {
        finishRun(`Completed! No more Quick apply jobs here. Total applied: ${appliedCount}`);
      }
    } catch (e) {
      // Never stall on an unexpected page error: move on to the next job instead
      console.error("Auto-apply step failed", e);
      updateStatus("Hit an error on this page. Moving on...");
      await goToNextJob();
    }
  }

  // 8. Classic layout: handle Auto-Switching from 'Applies' tab to 'Profile' / 'You might like'
  async function ensureActiveJobTab() {
    // If currently on "Applies" tab (which only shows already applied jobs), switch to Profile or You might like
    const tabs = Array.from(document.querySelectorAll("a, button, li, span, [class*='tab']"));
    const activeTab = tabs.find((el) => {
      const t = (el.innerText || "").toLowerCase();
      const hasActive = el.classList && el.classList.contains ? el.classList.contains("active") : false;
      return (t.includes("applies") || t.includes("applied")) && hasActive;
    });

    if (activeTab) {
      updateStatus("Switching from 'Applies' to unapplied jobs tab...");
      const targetTab = tabs.find((el) => {
        const t = (el.innerText || "").toLowerCase();
        return (t.includes("profile (") || t.includes("you might like") || t.includes("preferences")) && !t.includes("(0)");
      });

      if (targetTab) {
        simulateClick(targetTab);
        await delay(2500);
      }
    }
  }

  // 9. Classic layout: Select 5 Custom Checkboxes and Click the Top "Apply" Button
  async function applyVia5In1Batch() {
    // A. Find all checkbox elements (custom icons, spans, SVG wraps or inputs)
    let customCheckboxes = Array.from(
      document.querySelectorAll(
        "i[class*='checkbox'], span[class*='checkbox'], div[class*='chk-wrap'], [class*='custom-checkbox'], [class*='tuple-checkbox'], [class*='checkbox-wrap'], input[type='checkbox']"
      )
    ).filter((el) => {
      // Must be visible and not already checked
      const style = window.getComputedStyle(el);
      if (el.offsetParent === null || style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;

      let isChecked =
        el.checked ||
        (el.classList && (el.classList.contains("checked") || el.classList.contains("active"))) ||
        el.getAttribute("aria-checked") === "true";

      // Also check child inputs if it's a wrapper
      const childInput = el.querySelector("input[type='checkbox']");
      if (childInput && childInput.checked) {
        isChecked = true;
      }
      return !isChecked;
    });

    // Remove elements that are descendants of other elements in the array to avoid double-clicking
    customCheckboxes = customCheckboxes.filter(el => !customCheckboxes.some(parent => parent !== el && parent.contains(el)));

    if (customCheckboxes.length > 0) {
      updateStatus(`Found ${customCheckboxes.length} job checkboxes. Selecting up to 5...`);
      let selected = 0;

      for (const cb of customCheckboxes) {
        if (selected >= 5 || !isRunning) break;

        simulateClick(cb);
        selected++;
        await delay(500);
      }

      await delay(1000);

      // B. Find the "Apply" button at the top header or bottom banner
      const applyButtons = Array.from(
        document.querySelectorAll("button, a, div[role='button'], [class*='apply']")
      ).filter((el) => {
        if (el.offsetParent === null) return false;
        const text = (el.innerText || "").trim().toLowerCase();
        // Match "Apply", "Apply (5)", "Apply to 5 jobs", "Apply to selected"
        return (
          text === "apply" ||
          text.startsWith("apply (") ||
          text.includes("apply to") ||
          text.includes("apply selected")
        );
      });

      if (applyButtons.length > 0 && selected > 0) {
        // Select the prominent header/banner Apply button
        const mainApplyBtn = applyButtons[0];
        updateStatus(`Clicking main Apply button for ${selected} jobs...`);
        simulateClick(mainApplyBtn);
        appliedCount += selected;
        persist();
        updateStatus(`Successfully applied to ${selected} jobs! (Total: ${appliedCount})`);

        await delay(ACTION_DELAY_MS);
        await handleQuestionnairePopup();
        return true;
      }
    }

    return false;
  }

  // 10. Classic layout: Main Automation Loop
  async function legacyApplierLoop() {
    while (isRunning) {
      // Step A: Ensure we are on an active unapplied jobs tab (e.g. Profile or You might like)
      await ensureActiveJobTab();

      // Step B: Attempt 5-in-1 batch selection
      const batchDone = await applyVia5In1Batch();
      if (batchDone) {
        await delay(ACTION_DELAY_MS);
        continue;
      }

      // Step C: Fallback to individual 1-click apply buttons if no multi-select checkboxes
      const buttons = Array.from(
        document.querySelectorAll("button, a, .apply-button, .tuple-apply, [id*='apply']")
      ).filter((el) => {
        const text = (el.innerText || "").trim().toLowerCase();
        return (
          (text === "apply" || text === "easy apply" || text === "apply on naukri" || text === "apply now") &&
          !el.getAttribute("data-applied") &&
          el.offsetParent !== null
        );
      });

      if (buttons.length > 0) {
        const btn = buttons[0];
        updateStatus("Applying via 1-click button...");
        simulateClick(btn);
        btn.setAttribute("data-applied", "true");
        appliedCount++;
        persist();
        updateStatus(`Applied to ${appliedCount} jobs. Waiting 2s...`);

        await delay(ACTION_DELAY_MS);
        await handleQuestionnairePopup();
        continue;
      }

      // Step D: If no more jobs on current view, scroll or paginate
      updateStatus("Scrolling to load next batch of recommended jobs...");
      window.scrollBy({ top: 700, behavior: "smooth" });
      await delay(ACTION_DELAY_MS);

      // Check for pagination next button
      let nextPage = document.querySelector(".pagination-next, a[href*='page=']");
      if (!nextPage) {
        // Fallback: look for button or link with "Next" text
        const pageEls = Array.from(document.querySelectorAll("button, a, span"));
        nextPage = pageEls.find(el => (el.innerText || "").trim().toLowerCase() === "next" && !el.disabled);
      }

      if (nextPage && isRunning) {
        updateStatus("Navigating to next page...");
        simulateClick(nextPage);
        await delay(ACTION_DELAY_MS);
      } else {
        // Try clicking the next tab e.g. "You might like" if "Profile" finished
        const nextTab = Array.from(document.querySelectorAll("a, button, li, span")).find((el) => {
          const t = (el.innerText || "").toLowerCase();
          const hasActive = el.classList && el.classList.contains ? el.classList.contains("active") : false;
          return (t.includes("you might like") || t.includes("preferences")) && !hasActive;
        });

        if (nextTab && isRunning) {
          updateStatus("Switching to next tab 'You might like'...");
          simulateClick(nextTab);
          await delay(ACTION_DELAY_MS);
        } else {
          finishRun(`Completed! Total applied: ${appliedCount}`);
          break;
        }
      }
    }
  }

  // Initialize UI widget and resume a run that navigated here
  function init() {
    restore();
    createWidget();
    if (isRunning) {
      updateStatus(`Resuming... (${appliedCount} applied so far)`);
      startApplierLoop();
    } else {
      updateStatus(`Ready (${appliedCount} applied)`);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(init, 1500));
  } else {
    setTimeout(init, 1500);
  }
})();
