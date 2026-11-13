import type { InboxTriageInput } from "@nibblearn/core";

export const inboxTriageDemo = {
  id: "monday-inbox",
  type: "inbox-triage",
  title: "Monday, 9:00 — your inbox at Brightline Media",
  instructions:
    "You're Jordan, an account manager at Brightline Media. The all-hands starts at 10:00 and seven messages are waiting. Open each one and decide what to do with it. Names and figures are fictional.",
  content: {
    owner: { name: "Jordan Reyes", role: "Account Manager, Brightline Media" },
    actions: [
      {
        id: "reply",
        label: "Reply now",
        description: "Needs you personally, before anything else.",
        icon: "reply",
        tone: "accent",
      },
      {
        id: "delegate",
        label: "Delegate",
        description: "Someone else owns it. Hand it over with context.",
        icon: "forward",
        tone: "sky",
      },
      {
        id: "schedule",
        label: "Schedule",
        description: "Important, not urgent. Book time for it.",
        icon: "calendar",
        tone: "violet",
      },
      {
        id: "archive",
        label: "Archive",
        description: "Nothing to do. Clear it out.",
        icon: "archive",
      },
      {
        id: "report",
        label: "Report",
        description: "Looks like a scam. Send it to IT security.",
        icon: "alert",
        tone: "pink",
      },
    ],
    messages: [
      {
        id: "conversions-zero",
        from: {
          name: "Priya Nair",
          role: "Marketing Lead, Harbor Supply Co.",
          email: "priya.nair@harborsupply.co",
        },
        subject: "Conversions at zero since midnight?",
        preview:
          "The shared Pulse dashboard shows zero purchases from paid social since 00:00, but orders are still coming in…",
        body: "Hi Jordan,\n\nThe Pulse dashboard you share with us shows **zero** conversions from paid social since midnight, but our store is still taking orders, so people are clearly buying. Either tracking broke or the ads stopped working.\n\nOur CEO reviews this dashboard at 10:00 every Monday. Can you tell me what's going on before then?\n\nPriya",
        time: "08:57",
        flags: ["vip", "external"],
        correctAction: "reply",
        explanation:
          "**Reply now.** A VIP client, a live problem and a deadline about an hour away: this is the one message that cannot wait. Acknowledge it within minutes, say what you are checking (orders on the site but zero tracked conversions points to a broken tag, not dead ads) and promise an update before her 10:00. Pull in Analytics *after* you have replied; delegating without a word leaves her alone with the problem.",
      },
      {
        id: "verify-password",
        from: {
          name: "Adwave Business Support",
          email: "security@adwave-busines.com",
        },
        subject: "Action required: your ad account will be suspended in 24 hours",
        preview:
          "We detected unusual activity. Verify your password within 24 hours to keep your campaigns running…",
        body: "Dear Advertiser,\n\nWe detected unusual sign-in activity on your **Adwave Ads** account. To avoid suspension of all active campaigns, verify your password within 24 hours:\n\n`adwave-busines.com/verify-account`\n\nIf you do not verify, your campaigns will stop serving and any outstanding balance will be charged immediately.\n\nAdwave Business Support",
        time: "08:49",
        flags: ["external", "suspicious-link"],
        correctAction: "report",
        explanation:
          "**Report.** Look past the panic: a generic greeting, a 24-hour threat, a request for your password and a sender domain one letter off (`adwave-busines.com`). Real ad platforms never ask for a password by email. Don't click, don't reply and don't forward it around as a warning: report it so IT security can block the domain for everyone. If you're worried, sign in through the bookmark you always use.",
      },
      {
        id: "banner-approval",
        from: {
          name: "Tomás Ferreira",
          role: "Creative Lead, Brightline Media",
          email: "tomas.ferreira@brightline.media",
        },
        subject: "Approval needed: Northwind spring banners (live at 14:00)",
        preview:
          "Final banner set attached. Media needs your sign-off by 12:00 to hit the 2pm launch slot…",
        body: "Morning Jordan,\n\nThe final **Northwind Outdoor** spring banners are attached: six sizes, with copy updated from the client's last round of comments.\n\nMedia needs your sign-off by **12:00** to traffic them for the 14:00 launch. If anything needs changing we have to know this morning; after lunch there's no time to re-export.\n\nThanks,\nTomás",
        time: "08:41",
        flags: ["attachment"],
        correctAction: "reply",
        explanation:
          "**Reply now.** A hard deadline *today*, with a team blocked on you. Approving final creative is the account manager's call, so it can't be delegated, and scheduling it for later risks missing the 12:00 cut-off. Check the six sizes against the client's comments and answer this morning; even \"approved, go\" is a two-minute job that unblocks three people.",
      },
      {
        id: "invoice-po",
        from: {
          name: "Helen Brooks",
          role: "Finance, Brightline Media",
          email: "helen.brooks@brightline.media",
        },
        subject: "PO number missing on invoice HSC-0412",
        preview:
          "We can't send the April invoice to Harbor Supply without their purchase order number…",
        body: "Hi Jordan,\n\nWe can't issue invoice **HSC-0412** to Harbor Supply Co. until it carries their purchase order number. The draft is attached.\n\nCould someone send us the PO by Wednesday so it goes out in this billing run?\n\nThanks,\nHelen, Finance",
        time: "08:15",
        flags: ["attachment"],
        correctAction: "delegate",
        acceptable: ["reply"],
        explanation:
          '**Delegate.** Real, but not urgent and not yours to chase: your account coordinator keeps the PO log and can answer Finance in five minutes. Forward it with one line of context (*"Harbor Supply\'s April PO for Helen, please, by Wednesday"*). Replying yourself also gets it done, so it earns partial credit, but it spends your morning on admin someone else owns.',
      },
      {
        id: "review-move",
        from: {
          name: "Ben Carver",
          role: "Marketing Director, Northwind Outdoor",
          email: "ben.carver@northwindoutdoor.com",
        },
        subject: "Can we move next Tuesday's review?",
        preview:
          "Our board meeting moved, so Tuesday at 11 no longer works. Could we do Wednesday or Thursday instead…",
        body: "Hi Jordan,\n\nOur board meeting has moved to next Tuesday morning, so our 11:00 performance review no longer works on my side. Could we do Wednesday or Thursday instead? Any time after 10 is fine.\n\nNo need for a new deck; the March numbers are what I want to go through.\n\nBest,\nBen",
        time: "07:58",
        flags: ["external"],
        correctAction: "schedule",
        explanation:
          "**Schedule.** A client request, but the meeting is a week away and Ben has offered flexible options. It needs a calendar decision, not an instant reply: check the team's availability after the all-hands and send a new invite today. Answering within the day keeps the relationship warm without pulling you away from this morning's urgent messages.",
      },
      {
        id: "pulse-newsletter",
        from: {
          name: "Pulse Analytics",
          role: "Product updates",
          email: "news@pulse-analytics.io",
        },
        subject: "What's new in Pulse: custom dashboards and five more updates",
        preview:
          "This month: drag-and-drop widgets, scheduled exports and a refreshed date picker…",
        body: "Hi there,\n\nHere's what shipped in Pulse Analytics this month.\n\n**Custom dashboards:** drag and drop widgets to build a view for each client.\n**Scheduled exports:** send a PDF snapshot to your inbox every Monday.\n**New date picker:** compare any two periods in two clicks.\n\nRead the full release notes in your account.",
        time: "07:30",
        flags: ["external"],
        correctAction: "archive",
        explanation:
          "**Archive.** Useful someday, needed never at 9:00 on a Monday. A newsletter has no deadline and nobody waiting on you. Archive it (or filter these into a folder) so your inbox only holds things that need a decision. If a feature looks genuinely useful, the release notes will still be there on Friday.",
      },
      {
        id: "pitch-deck",
        from: {
          name: "Aisha Rahman",
          role: "New Business Lead, Brightline Media",
          email: "aisha.rahman@brightline.media",
        },
        subject: "Northwind March deck for Thursday's pitch?",
        preview:
          "We're pitching an outdoor gear brand on Thursday. Could I borrow the structure of your March Northwind deck…",
        body: "Hey Jordan,\n\nWe're pitching an outdoor gear brand on **Thursday**, and your March Northwind performance deck is the best example we have of how we report. Could you send it over so we can reuse the structure?\n\nNo rush today; Wednesday is fine.\n\nAisha",
        time: "Fri",
        correctAction: "schedule",
        acceptable: ["delegate"],
        explanation:
          "**Schedule.** Worth a yes, but nothing breaks before Wednesday, and the deck needs your judgement first: it is full of Northwind's confidential figures, which must come out before it is reused for another brand. Book 20 minutes this afternoon to strip the numbers and send it. Delegating to your coordinator works too *if* you spell out what to remove, so it earns partial credit.",
      },
    ],
    summary:
      "Triage is a judgement call, not a speed test. Fires first: the VIP client with a deadline and the creative team blocked on your approval. Report threats before anyone clicks. Then hand over what others own, book what can wait, and clear what needs nothing. Ten minutes of sorting at 9:00 protects the rest of your Monday.",
  },
  behavior: {
    feedback: "instant",
    allowRetry: true,
    showScore: true,
  },
} satisfies InboxTriageInput;
