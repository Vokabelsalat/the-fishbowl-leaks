# Exhibition visitor questionnaire

## Ratings after each scanned piece

The artwork detail panel presents three questions for the piece just encountered:

1. Narrative: How much did this piece draw you into its story or ideas?
2. Ludic entertainment (shown as “Play and exploration”): How much did this piece make you want to play or explore?
3. Interaction: How much did your actions feel like they shaped your experience of this piece?

Each uses the same five response options: 1 = not at all, 2 = a little, 3 = moderately, 4 = quite a bit, 5 = very much. No response is preselected. Visitors can skip questions or choose “Not applicable”, especially where an artwork offers no interactive or playful experience. All three questions appear in the detail panel without expanding the full description; the panel scrolls on small screens.

These are brief exploratory measures of narrative engagement, motivation to play or explore, and perceived influence through interaction. They are not a validated questionnaire, and each item measures one aspect of its broader dimension. Interaction here concerns perceived agency rather than interface usability. When interpreting scores, consider what each artwork offers; do not treat a low score on an intentionally noninteractive work as a quality judgment.

Ratings are attached to the artwork's discovery in the visitor's journey. They persist on the device, can be revised by rescanning the piece, and are submitted only through the existing release/share action at the end. The contribution API validates the ratings and SQLite stores them in each artwork's entry in `glyphs_json`, under `feedback.narrative`, `feedback.ludicEntertainment`, and `feedback.interaction`. Existing contributions without feedback remain valid. Missing keys mean unanswered; `null` means explicitly not applicable. Neither should be averaged as a number. Repeat scans update the same artwork's ratings rather than adding a second response.

The existing shared-tank feed exposes only the current day's contributions; evaluation across days should use the retained SQLite records. A dedicated evaluation dashboard or export is not yet included.

## Exhibition-wide reflection

For questions 1–4, please select a number from 1 (**not at all**) to 5 (**very much**).

1. How absorbed did you feel in the experience of the exhibition?

2. To what extent did the artworks create an emotional response for you?

3. How effectively did the artworks communicate their ideas or themes?

4. To what extent did the exhibition make you reflect on or question something after encountering the artworks?

5. Which artwork or moment stayed with you most, and what made it memorable?
