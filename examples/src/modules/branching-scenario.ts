import type { BranchingScenarioInput } from "@nibblearn/core";

export const branchingScenarioDemo = {
  id: "unhappy-client",
  type: "branching-scenario",
  title: "The unhappy client",
  instructions:
    "Harbor Supply Co. is three weeks into a paid-social campaign and the numbers are not where they hoped. Every choice shapes how this ends.",
  content: {
    start: "call",
    intro:
      'It is Tuesday, 9:40. Your account lead forwards a two-line email from **Dana Whitfield**, Head of Growth at Harbor Supply Co.: *"Can we talk today? Campaign results are not what we signed up for."*\n\nThe campaign has spent **$18,400** of a $30,000 budget. CPA is **$62** against a $45 target. You have 20 minutes before the call.',
    nodes: [
      {
        id: "call",
        kind: "decision",
        speaker: "Dana, Head of Growth",
        title: "The call opens cold",
        text: "\"I'll be direct. We're over 60% through the budget and CPA is almost 40% above target. My CFO is asking why we're still spending. What's going on?\"\n\nYou have the dashboard open. Conversion rate from the landing page dropped from 3.1% to 1.9% after their site team redesigned the checkout two weeks ago. Ad CTR is actually up.",
        choices: [
          {
            text: "Acknowledge the gap, then ask what the CFO needs to see by Friday.",
            next: "diagnose",
            points: 3,
            quality: "good",
            feedback:
              "You validated the concern without defending yet, and you found out what a good outcome looks like for *her*. That gives you a target.",
          },
          {
            text: "Explain that the checkout redesign on their side is what tanked conversion.",
            next: "defensive",
            points: -2,
            quality: "poor",
            feedback:
              "You may be right, but leading with blame on a tense call makes the client defend her own team instead of listening to you.",
          },
          {
            text: "Offer to pause spend immediately while you investigate.",
            next: "pause",
            points: 1,
            quality: "neutral",
            feedback:
              "Safe, and it shows you take the budget seriously. But pausing without a diagnosis loses momentum and learning data.",
          },
        ],
      },
      {
        id: "diagnose",
        kind: "decision",
        speaker: "Dana, Head of Growth",
        title: "A door opens",
        text: '"Honestly? He needs to see CPA trending toward $45 and a plan with dates. I don\'t need a miracle, I need to not look blindsided."\n\nYou now share your screen: CTR is up 22%, but landing-page conversion halved the day the new checkout went live. The cause is almost certainly on their site, not in the ads.',
        choices: [
          {
            text: "Walk through the data together and propose a joint fix: a two-step checkout test on their side, retargeting shifted to cart abandoners on yours.",
            next: "partner",
            points: 4,
            quality: "good",
            feedback:
              "You framed the finding as a shared problem with a shared fix. Dana now has something concrete to bring to her CFO, and it includes her team.",
          },
          {
            text: "Show the conversion drop and suggest their site team should look into it before you change anything.",
            next: "handoff",
            points: 0,
            quality: "neutral",
            feedback:
              'Accurate, but it hands the problem back over the fence. Dana hears "not our fault" even if you did not say it.',
          },
          {
            text: "Promise to cut CPA to $45 by Friday by reallocating all spend to the best-performing audience.",
            next: "overpromise",
            points: -3,
            quality: "poor",
            feedback:
              "You cannot fix a landing-page problem with media allocation. Overpromising to end an uncomfortable call sets up a worse one next week.",
          },
        ],
      },
      {
        id: "defensive",
        kind: "decision",
        speaker: "Dana, Head of Growth",
        title: "Walls go up",
        text: "\"So this is our fault? The checkout was redesigned because *your* team said the old one was slow on mobile. I'm not going to the CFO with 'the agency says it's us.'\"\n\nThe call has turned into a negotiation about blame. You can still turn it around, but it will cost something.",
        choices: [
          {
            text: "Back up: \"You're right, that came out wrong. Let's look at the numbers together and figure out what we can each fix this week.\"",
            next: "partner",
            points: 2,
            quality: "good",
            feedback:
              "A clean reset. Owning the misstep quickly costs you less than digging in. Dana is willing to look at the data now.",
          },
          {
            text: "Hold your ground and send the analytics export after the call as proof.",
            next: "churn",
            points: -3,
            quality: "poor",
            feedback:
              "Being right and being retained are different things. Proof delivered after a hostile call reads as a paper trail, not a partnership.",
          },
        ],
      },
      {
        id: "pause",
        kind: "decision",
        speaker: "Dana, Head of Growth",
        title: "Spend paused",
        text: '"Okay. Pause it. But I need to know by Thursday whether this campaign is salvageable or whether we\'re writing off the quarter."\n\nWith spend paused you have 48 hours and no new data. The conversion drop on their checkout is still the real story.',
        choices: [
          {
            text: "Use the pause to run a quick checkout audit with their dev lead and come back Thursday with a joint plan.",
            next: "partner",
            points: 3,
            quality: "good",
            feedback:
              "You turned a pause into a diagnostic window and brought their team in. Thursday's meeting now has a story and a plan.",
          },
          {
            text: "Rebuild the ad creative and audiences from scratch so you have something new to show on Thursday.",
            next: "handoff",
            points: -1,
            quality: "poor",
            feedback:
              "New creative does not fix a checkout that lost half its conversions. You will show effort on Thursday, not a solution.",
          },
        ],
      },
      {
        id: "partner",
        kind: "ending",
        outcome: "success",
        title: "Renewed, with a plan",
        text: "Thursday's follow-up has Dana, her dev lead, and you on the same slide: CTR up 22%, checkout fix shipping Monday, retargeting live on cart abandoners. CPA drops to **$48** within ten days.\n\nDana's CFO signs off on the remaining budget. Three weeks later she asks about Q3.",
        summary:
          "The winning pattern: acknowledge first, diagnose together, propose a fix that includes the client's team. Being right about the cause mattered less than how you shared it.",
      },
      {
        id: "handoff",
        kind: "ending",
        outcome: "neutral",
        title: "Still on the account, barely",
        text: "Their site team eventually fixes the checkout, but it takes three weeks and nobody at Harbor connects the recovery to you. The campaign finishes at a **$55 CPA**.\n\nDana keeps the contract through the quarter and opens an RFP for next year.",
        summary:
          "You were accurate but passive. Handing a problem back over the fence protects you in the moment and costs you the relationship over time. Clients remember who helped, not who was right.",
      },
      {
        id: "overpromise",
        kind: "ending",
        outcome: "failure",
        title: "The Friday call",
        text: 'Friday arrives. CPA is **$59**. Reallocating spend did nothing because the leak was on the landing page, and now Dana has told her CFO a number you cannot deliver.\n\n"I defended you on Tuesday. I\'m not doing that twice." The account moves to a 30-day notice.',
        summary:
          "Promises made to end an uncomfortable conversation turn into a worse conversation later. Diagnose before you commit, and never commit to a fix outside your control.",
      },
      {
        id: "churn",
        kind: "ending",
        outcome: "failure",
        title: "Churned",
        text: 'Your analytics export is correct and nobody reads it. Dana forwards the thread to procurement with one line: *"Not a fit."*\n\nThe campaign ends at **$64 CPA** with $9,000 unspent. Harbor Supply Co. signs with another agency in June.',
        summary:
          "A tense client call is not a court case. Winning the argument about whose fault it was cost you the account. Lead with the relationship, then bring the data.",
      },
    ],
  },
  behavior: {
    showScore: true,
    allowRetry: true,
    showHistory: true,
  },
  feedback: {
    complete:
      "Try another path to see how the same facts land differently depending on how you lead the conversation.",
  },
} satisfies BranchingScenarioInput;
