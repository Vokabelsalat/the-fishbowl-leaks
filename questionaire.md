# Exhibition visitor questionnaire

## Response after each scanned piece

At the end of the artwork detail panel, visitors see a quick three-step response focused on flow and immersion. It is meant to capture spontaneous answers. Every step can be skipped, and no answer is preselected. Step 1 moves on by itself once a value is tapped. Steps 2 and 3 use Next, or Skip when nothing is answered, and Back returns to earlier steps.

### Step 1: Connection

“I felt connected to this experience.” 1 = strongly disagree to 5 = strongly agree.

### Step 2: What contributed

Each statement uses the same 1–5 agreement scale. Visitors see the public label; the analytical pole is the storage key.

| Public label | Statement | Analytical pole (key) |
| --- | --- | --- |
| Interaction | Being able to act, choose or explore contributed to my experience. | Ludic (`ludic`) |
| Sensory / Visual | The visual, spatial or sensory qualities drew me into the experience. | Spectacle (`spectacle`) |
| Story | The story or ideas were central to my engagement with the work. | Narrative (`narrative`) |

### Step 3: How did it make you feel?

Visitors tap up to three words. The words fade in, grouped by tone in this order. Each group is shown under its own heading (Positive, In between, Negative) and separated from the next by a line.

- Positive: Empowered, Engaged, Moved, Curious, Inspired, Absorbed, Delighted, Amused, Calm
- In between: Reflective, Ambivalent, Nostalgic, Strange, Provoked
- Negative: Unsettled, Confused, Bored, Distanced, Uneasy, Frustrated, Overwhelmed, Uncomfortable, Sad

### Storage and interpretation

These are brief exploratory measures, not a validated questionnaire. When interpreting the step 2 scores, consider what each artwork offers. A low Interaction score on an intentionally noninteractive work is not a quality judgment.

Responses are attached to the artwork's discovery in the visitor's journey. They persist on the device, can be revised by rescanning the piece, and are submitted only through the existing release/share action at the end. The contribution API validates them, and SQLite stores them in each artwork's entry in `glyphs_json`, under `feedback.connection`, `feedback.ludic`, `feedback.spectacle`, `feedback.narrative` (integers 1–5) and `feedback.feelings` (an array of up to three words). A missing key means skipped. Repeat scans update the same artwork's response rather than adding a second one.

Contributions stored before this version use the earlier keys `narrative`, `ludicEntertainment` and `interaction` (1–5, or `null` for not applicable). Those questions were worded differently, so do not pool them with the new scores, even where a key name is the same. Journeys saved on a device under the earlier questionnaire keep their discoveries but lose their unsent ratings.

The existing shared-tank feed exposes only the current day's contributions; evaluation across days should use the retained SQLite records. A dedicated evaluation dashboard or export is not yet included.

## Exhibition-wide reflection

For questions 1–4, please select a number from 1 (**not at all**) to 5 (**very much**).

1. How absorbed did you feel in the experience of the exhibition?

2. To what extent did the artworks create an emotional response for you?

3. How effectively did the artworks communicate their ideas or themes?

4. To what extent did the exhibition make you reflect on or question something after encountering the artworks?

5. Which artwork or moment stayed with you most, and what made it memorable?
