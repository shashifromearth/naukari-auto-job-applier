# 🚀 Naukri Smart Auto-Applier (Manifest V3)

<p align="center">
  <img src="https://img.shields.io/badge/Chrome-Extension-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Chrome Extension" />
  <img src="https://img.shields.io/badge/Manifest-V3-34A853?style=for-the-badge&logo=google&logoColor=white" alt="Manifest V3" />
  <img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="License: MIT" />
  <img src="https://img.shields.io/badge/PRs-Welcome-brightgreen.svg?style=for-the-badge" alt="PRs Welcome" />
</p>

<p align="center">
  <b>An intelligent, lightweight Chrome Extension to automate 5-in-1 batch applies and 1-click applications on Naukri.com with automatic questionnaire answering and rate-limit safe pacing.</b>
</p>

---

## 🌟 Why Use This?

Applying to hundreds of job postings manually on Naukri is tedious. **Naukri Smart Auto-Applier** automates the repetitive application loop directly in your browser:
- ⚡ **Leverages Naukri's Native 5-in-1 Batch Apply**: Detects multi-select tuples and triggers batch applications for maximum speed.
- 🎯 **1-Click Apply Fallback**: Handles single-click applies when batch mode is unavailable.
- 📬 **Inbox First**: Applies to every unapplied recruiter invite in your [Inbox](https://www.naukri.com/mnjuser/inbox) (*Most relevant* and *Others* tabs), right in the invite drawer.
- 🧭 **Then Recommended Jobs**: Reads your [Recommended jobs](https://www.naukri.com/mnjuser/recommendedjobs), queues every unapplied *Quick apply* job and applies to them one by one on their own pages (company-site jobs are skipped).
- 📝 **Hands-Free Questionnaires**: Answers Naukri's chatbot questions from ~50 patterns in your profile (*skill experience, CTC, notice period, relocation, work mode...*). Anything not covered gets a default by answer type (number → `1`, text → `Python`, yes/no → `Yes`, date → today), so the run never stops for input.
- 📅 **Date Questions**: Any date question (*last working day, joining date, DOB...*) is answered with today's date, whether the bot shows a text box, a calendar or day/month/year boxes. If that fails, the bot picks *Skip this question*.
- ⏱️ **Bot-Safe Pacing (2s Delay)**: Emulates natural human interaction timing to avoid rate limits and anti-bot blocks.
- 🎛️ **Floating HUD Widget**: Injects an unobtrusive dark-mode controller right onto Naukri pages.

---

## 🏗️ Architecture & Workflow

```
[ Start ] ──► [ Inbox: open each unapplied invite, click Apply ]
                   │  (Most relevant, then Others; scrolls for more)
                   ▼
[ Recommended Jobs Page ]
                   │
                   ▼
   [ Read job cards, queue unapplied Quick apply jobs ]
                   │
                   ▼
   [ Open next job page ] ◄──────────────────────┐
                   │                             │
          Clicks "Quick apply"                   │
                   │                             │
                   ▼                             │
     [ Chatbot questionnaire appears? ]          │
         ├── Yes: answers every question         │
         │        (profile → type default)       │
         └── No: continues                       │
                   │                             │
                   ▼                             │
     [ 2.0s Human Pacing Delay ] ────────────────┘
                   │  queue empty
                   ▼
   [ Back to the list, scroll for more jobs ]
```

The run state lives in the tab's `sessionStorage`, so it carries on across page loads until you press **Stop Automation** or no Quick apply jobs are left. The classic Naukri layout (job checkboxes + 5-in-1 "Apply") is still handled as a fallback.

---

## 📦 Quick Installation Guide

### Method 1: Load Unpacked in Chrome (30 Seconds)

1. Clone or download this repository:
   ```bash
   git clone https://github.com/shashifromearth/naukari-auto-job-applier.git
   ```
2. Open Google Chrome and go to:
   ```text
   chrome://extensions/
   ```
3. Enable **Developer mode** via the toggle in the **top-right corner**.
4. Click **Load unpacked** in the **top-left corner**.
5. Select the cloned `naukari-auto-job-applier` directory.
6. The extension is now installed and active! After editing any file, click the reload icon on the extension card and refresh the Naukri tab.

---

## 🎮 How to Use

1. Log into your account on [Naukri.com](https://www.naukri.com/).
2. Open any Naukri page.
3. You will see the floating **🚀 Naukri Multi-Apply** HUD in the bottom-right corner.
4. Click **"Start Auto Apply"**. It opens your Inbox and applies to recruiter invites first, then moves on to Recommended jobs.
5. Watch the real-time status counter update as jobs are submitted automatically.
6. Click **"Stop Automation"** anytime to pause.

---

## ⚙️ Customizing Your Profile Config

To customize the values automatically entered into questionnaires, open [`content.js`](content.js) and modify the `PROFILE_CONFIG` object and the `QUESTION_ANSWERS` list below it:

```javascript
const PROFILE_CONFIG = {
  totalExperience: "1",      // Your total years of experience
  currentCtc: "5",           // Current CTC (in LPA)
  expectedCtc: "5",          // Expected CTC (in LPA)
  noticePeriodDays: "0",
  relocate: "Yes",
  teamSize: "10",
  currentLocation: "",        // Blank = answered with the default text
  // ...

  // Years of experience per skill (first matching pattern wins)
  skillExperience: [
    [/python/, "6"],
    [/java|j2ee|jvm/, "9"],
    [/c#|c sharp|.net|dotnet|asp.?net|entity framework/, "9"],
    [/golang|.../, "6"],
    [/rust/, "7"],
    [/manag|leadership|team lead|.../, "12"],
    // ...
  ],

  // Fallbacks for questions nothing matches, by the kind of answer expected (dates use today's date)
  defaults: { number: "1", text: "Python", yesNo: "Yes" }
};
```

If the chatbot rejects an answer it re-asks, and the bot tries the next fallback. A questionnaire that stays stuck for a minute is abandoned and the run moves on to the next job.

---

## 🛡️ Best Practices & Anti-Bot Safety

1. **Session Limits**: It is recommended to apply to **30 – 50 jobs per session** once or twice daily.
2. **Peak Algorithm Timing**: Update your profile on Naukri between **9:00 AM – 10:30 AM IST** to rank at the top of recruiter searches.
3. **Keep Tab Visible**: Chrome optimizes background tabs; keep the Naukri tab active or in a separate window while applying.

---

## 🤝 Contributing

Contributions make the open-source community an amazing place to learn and build. Any contributions you make are **greatly appreciated**!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/NewFeature`)
3. Commit your Changes (`git commit -m 'Add NewFeature'`)
4. Push to the Branch (`git push origin feature/NewFeature`)
5. Open a Pull Request

---

## 📜 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for more information.

---

<p align="center">
  Crafted with ❤️ by <a href="https://github.com/shashifromearth">Shashi Bhushan Kumar</a>
</p>
