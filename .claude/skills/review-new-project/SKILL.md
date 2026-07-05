---
name: review-new-project
description: This skill should be used when the user wants to review or improve the new-project skill, runs /review-new-project, or gives feedback on the project brief interview process.
---

You are conducting a structured retrospective on the `new-project` skill to find gaps, friction, and improvements. Ask the questions below in grouped stages, wait for answers, then apply changes directly to the skill file.

**Ground rules:**
- Ask one group at a time, then STOP and wait for the user's response.
- Take notes on every answer — you will use them all to edit the skill file at the end.
- Do not suggest changes mid-interview. Collect everything first.

---

## Group 1 — Coverage Gaps

Ask together, then wait:

1. **Was there anything you wanted to specify about your project that the interview never asked about?**
2. **Were there any questions where the options given didn't fit your situation?**
3. **Were any stages missing entirely — something you had to figure out yourself after the brief was written?**

---

## Group 2 — Question Quality

Ask together, then wait:

1. **Were any questions confusing or unclear?** Which ones, and what was the problem?
2. **Were any questions redundant — did two questions cover the same thing?**
3. **Were any questions too broad, making it hard to know what level of detail to give?**
4. **Were any questions too narrow, forcing you to split an answer across multiple fields?**

---

## Group 3 — Stage Flow

Ask together, then wait:

1. **Did the order of stages feel logical, or did you find yourself thinking about a later stage while answering an earlier one?**
2. **Were there stages you wanted to skip because they didn't apply to your project type?** (e.g. no dynamic data, no auth)
3. **Were there any stages where you felt you needed more guidance or examples to answer well?**

---

## Group 4 — The Brief Output

Ask together, then wait:

1. **Was the brief format useful as a handoff document for building the site?**
2. **Were there sections in the brief you never referred to again?**
3. **Were there sections missing from the brief that you had to add manually or hold in your head?**
4. **Was the brief at the right level of detail — too sparse, too verbose, or just right?**

---

## Group 5 — Project Types

Ask together, then wait:

1. **What type of project did you use `new-project` for?** (e.g. portfolio, e-commerce, blog, SaaS, booking site)
2. **Are there project types where you think the current questions would fall short?**
3. **Should the skill ask what type of project it is upfront, and then tailor the questions accordingly?**

---

## Apply Changes

Once all groups are answered:

1. **Read the current skill file** at `.claude/skills/new-project/SKILL.md`.

2. **Summarise the changes you plan to make** — list each one clearly:
   - What is changing (stage, question, template section)
   - Why (which feedback it addresses)
   - How (add / remove / reword / reorder)

3. **Ask:** "Here's what I'm planning to change — does this look right, or do you want to adjust anything before I apply it?"

4. **Wait for approval.** Apply any adjustments the user requests to your plan.

5. **Once approved:** edit `.claude/skills/new-project/SKILL.md` directly using the Edit tool. Make all changes in one pass.

6. **Confirm** by listing the changes made and offering to run `new-project` immediately to test the updated version.
