# Kana Listening Practice App — Project Proposal

## Overview

A mobile-first, fully client-side single-page application for practicing Japanese listening comprehension. Users listen to audio clips and transcribe what they hear using katakana, entering answers via romaji (kunreishiki) that is automatically converted. The app runs entirely in the browser with no backend, hosted on GitHub Pages, and stores all data locally using IndexedDB.

The app is designed to be open source and freely available. Because there is no server, users supply their own audio sources by importing a CSV/TSV mapping of kana readings to audio URLs.

---

## Goals

- Provide a focused, low-friction listening practice tool for Japanese learners.
- Support large audio libraries (10,000+ entries) without performance degradation.
- Record detailed answer logs to support future analytics and minimal pairs generation.
- Respect the nuances of Japanese phonology, including configurable strictness for chōonpu usage, nasalized G, and particle kana spelling.

---

## Technical Stack

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Framework | React | Component-based architecture, large ecosystem |
| UI library | MUI (Material UI) | Polished mobile-first components out of the box |
| Build tool | Vite | Fast builds, simple GitHub Pages deployment |
| Storage | IndexedDB (via Dexie.js) | Handles 10k+ entries, async, indexed queries |
| Routing | React Router | Lightweight SPA routing |
| Romaji conversion | Wanakana (MVP) behind abstraction layer; custom kunreishiki sub-project post-MVP | Wanakana for speed; abstraction enables swap to kunreishiki later |
| Virtualized lists | @tanstack/react-virtual | Efficient rendering for large library views |
| Hosting | GitHub Pages | Free, static, open source friendly |
| Target | Mobile-first, responsive | Language learners practice on phones |

---

## Data Schemas

### AudioEntry

Each entry represents a single audio clip linked to a Japanese word or phrase.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string (UUID) | auto | Unique identifier |
| reading | string | yes | Katakana transcription (e.g., カガク) |
| audioUrl | string | yes | URL to the audio file |
| written | string | no | Written form including kanji (e.g., 科学) |
| pitch | number | no | Pitch accent number (0 = heiban, 1+ = drop position) |
| batchId | string | yes | References the ImportBatch this entry belongs to |
| disabled | boolean | no | If true, this entry is excluded from quiz question pools. Defaults to false |
| disabledNote | string | no | User-provided reason for disabling (e.g., "audio is clipped", "wrong reading"). Cleared when the entry is re-enabled |

### ImportBatch

Metadata about a group of imported entries. Captures source-level phonological properties.

| Field | Type | Description |
|-------|------|-------------|
| id | string (UUID) | Unique identifier |
| importedAt | timestamp | When the import occurred |
| choonpuIsDistinct | boolean | Whether the source treats ー as distinct from spelled-out vowel kana (e.g., センセー and センセイ are different words, not interchangeable spellings) |
| distinguishesNasalG | boolean | Whether the source distinguishes nasalized ガ行 (か゚き゚く゚け゚こ゚) |
| particleSpelling | enum | `"phonetic"` (particles spelled as pronounced: は→ワ, へ→エ, を→オ) or `"orthographic"` (particles spelled as written: は→ハ, へ→ヘ, を→ヲ). This records the source's convention — it does not affect how entries are stored |

### Session

Configuration and metadata for a practice session. Only persisted to IndexedDB if the user chose to record their answers. Otherwise, the session object lives in React state during the test and is discarded when the session ends.

| Field | Type | Description |
|-------|------|-------------|
| id | string (UUID) | Unique identifier |
| startedAt | timestamp | Session start time |
| completedAt | timestamp | Session end time |
| questionCount | number | Number of questions actually completed (not the target — the user may bail out early or be in infinity mode) |
| strictChoonpu | boolean | Grade chōonpu vs vowel kana strictly |
| strictNasalG | boolean | Grade nasalized G strictly (see note below) |
| strictParticleKana | boolean | When off, treat ハ≡ワ, ヘ≡エ, ヲ≡オ as equivalent (since we cannot detect particle usage without grammatical parsing) |
| typoCheckEnabled | boolean | Allow resubmission on high-confidence wrong answers |
| kanaFilter | string[] or null | Selected kana subset, or null for all |

> **Note on nasalized G:** There is currently no standard romaji input method for typing nasalized ガ行 kana (か゚き゚く゚け゚こ゚). The `distinguishesNasalG` flag is included at the import level for data completeness, but the `strictNasalG` session toggle will be effectively always off until an input method is established. The infrastructure is in place for when a solution is found.

### AnswerLogEntry

A single answer within a session.

| Field | Type | Description |
|-------|------|-------------|
| sessionId | string | References the parent Session |
| startTime | timestamp | When the question was presented to the user (enables response time analysis) |
| timestamp | timestamp | When the answer was submitted |
| entryId | string | References the AudioEntry |
| targetReading | string | Correct katakana reading (stored for durability — survives if the entry is later deleted from the library) |
| submittedReading | string | The user's final katakana answer |
| certainty | number (1–5) | User's self-reported confidence at time of submission |
| replayCount | number | How many times the audio was replayed before answering |
| correct | boolean | Whether the answer was graded correct under the session's active rules |
| resubmitted | boolean | Whether the user used the typo-check resubmission flow |

---

## Screens

### 1. Home / Dashboard

The landing screen. Provides entry points to the main flows.

- Start a new session (navigates to Session Setup)
- View / manage audio library (navigates to Library)
- All-time stats summary (inline): overall accuracy, total sessions, total questions answered, streak data if applicable

If no audio data has been imported yet, the screen should guide the user toward the Library screen (which provides access to the Import flow).

### 2. Import

Where users paste their CSV/TSV data and configure the batch metadata. Accessible from the Library screen.

- Large text area for pasting CSV/TSV data
- Expected columns: `reading`, `audio_url`, `written` (optional), `pitch` (optional)
- Auto-detect delimiter (tab first, fall back to comma)
- Batch metadata toggles: `choonpuIsDistinct`, `distinguishesNasalG`, `particleSpelling`
- On submission: parse the data, validate it, and present a combined confirmation screen showing a summary of the parsed entries (count, sample rows) along with any validation warnings (missing required fields, duplicate readings within the batch). The user confirms to commit
- Progress indicator during the write phase (chunked writes of ~500 entries to avoid UI freezing)

### 3. Library

Browse, audit, and manage the full audio library.

- Virtualized scrolling table/list for 10k+ entries
- Each row shows: reading, written form (if present), pitch number (if present), batch info
- Play button per row (lazy-loads audio on tap)
- If audio fails to load: display an error indicator on that entry and play a short error sound (cassette-player-style empty/static sound) to give clear feedback
- Select individual entries for deletion
- **Disable/enable entries:** users can disable an entry (with an optional note explaining why, e.g., "audio is clipped" or "wrong reading") to exclude it from quizzes without deleting it. Disabled entries appear visually distinct (greyed out) with the note visible. Re-enabling an entry clears the note
- Bulk import button (navigates to Import screen)
- Search/filter by reading or written form

### 4. Session Setup

Configure a practice session before starting.

- Number of questions: numeric input or preset buttons (10, 25, 50, custom), plus an **infinity mode** option (questions keep coming until the user stops)
- Kana filter: interactive kana table (popup/modal) for selecting which kana rows/columns are in scope. When a filter is active, only entries whose readings are composed entirely of the selected kana will be used
- **Check availability button**: triggers a count of entries matching the current kana filter and displays the result. This is a manual action rather than a live-updating count, because scanning 10k+ entries on every filter change could freeze the UI
- Strictness toggles (always visible regardless of which batches have been imported): strict chōonpu, strict nasalized G, strict particle kana
- Typo-check toggle: enable the high-confidence resubmission flow
- Record session toggle: whether to persist answers and session data to IndexedDB

### 5. Practice

The core interaction loop. Question selection is random from the filtered pool. Disabled entries are excluded from the question pool; if the current entry becomes disabled mid-session (e.g., from another tab), it is skipped and a new question is drawn.

**Layout:**
- Large, prominent play button (mobile-friendly tap target)
- Replay button (increments replay counter)
- Text input field: user types romaji (kunreishiki), which auto-converts to katakana in real time
- Five certainty buttons (labeled 1 through 5) arranged in a row — tapping a certainty button submits the answer. There is no separate submit button
- Progress indicator: "Question 7 of 25" for fixed sessions, or "Question 7" with a running counter for infinity mode

**Answer flow:**
1. Audio plays automatically (or user taps play)
2. User can replay as many times as needed
3. User types romaji → sees katakana conversion live
4. User taps a certainty button (1–5) to submit
5. **If wrong + certainty ≥ 3 + typo-check enabled:** prompt the user to review their answer for typos, with the option to edit and resubmit or confirm their original answer
6. Show result: the correct reading, the user's answer, whether they got it right. Also show the written form and pitch number if available
7. "Next" button to advance

**Bailing out:** The user can end the session at any time. The session records however many questions were actually completed.

### 6. Session Results

Shown after completing or ending a session.

- Overall accuracy (correct / total completed)
- List of all questions with: target reading, user's answer, certainty, correct/incorrect, replay count
- Highlight incorrect answers for quick review
- Play button next to each entry to re-hear the audio
- **Disable entry:** users can disable any entry directly from the results screen (with an optional note) if they notice an issue during review
- Button to start another session or return home

---

## Key Technical Decisions

### Romaji-to-Katakana Conversion

**MVP approach:** The MVP uses wanakana for romaji-to-katakana conversion, wrapped behind a `KanaConverter` abstraction layer. This abstraction exposes a simple interface (e.g., `toKatakana(input)`, `bind(element)`, `unbind(element)`) so that no component code depends on wanakana directly. This allows the implementation to be swapped without touching the rest of the codebase.

**Post-MVP: Custom kunreishiki converter (separate sub-project).** Wanakana does not support kunreishiki romanization, which is the desired primary input method. The custom converter will be carved out as its own standalone module (potentially publishable as an npm package) with its own test suite. It must function as a live IME-style converter — transforming romaji input into katakana in real time as the user types, not just on submission.

**Kunreishiki mappings that differ from Hepburn:** `si`→シ, `ti`→チ, `tu`→ツ, `hu`→フ, `zi`→ジ, `sya`→シャ, `tya`→チャ, `zya`→ジャ, etc.

**Edge cases for the custom converter:**
- **ン:** Typed as `nn` (two Ns). The converter must distinguish `nn` (→ン) from `n` followed by a vowel (e.g., `na`→ナ). In live mode, a single `n` must remain uncommitted until the next keystroke disambiguates
- **っ/ッ (gemination):** Typed as a doubled consonant (e.g., `kk` in `kakko`→カッコ). In live mode, the first consonant of a double remains uncommitted until the second arrives
- **Long vowels:** Standard vowel input; chōonpu (ー) handling is a grading concern, not an input concern
- **Particles:** No special romaji treatment — particle spelling differences are handled at the grading level via the `particleSpelling` setting
- **Nasalized G:** No input method currently exists. The converter architecture should be extensible enough to add a convention (e.g., `nga`→カ゚) once one is established

### IndexedDB via Dexie.js

localStorage is too small for 10k+ entries (the URL strings alone could approach 1–2MB). Dexie provides a clean Promise-based API over IndexedDB with schema versioning. Tables: `audioEntries`, `importBatches`, `sessions`, `answerLog`.

### Chunked CSV Import

Parsing and writing 10k rows must be non-blocking. The import process will: (1) parse the CSV in memory, (2) present a confirmation screen with a summary and any warnings, then (3) on user confirmation, write to IndexedDB in batches of ~500 entries, updating a progress indicator between each chunk using `requestAnimationFrame` or `setTimeout(0)` to yield to the main thread.

### Kana Filtering

Given 10k entries, filtering by kana subset requires scanning all entries. At 10k rows this takes only a few milliseconds in JavaScript, so no precomputed index is needed. However, the filter count is triggered manually (via a "Check availability" button) rather than live-updating, to avoid any risk of UI jank during rapid filter changes. The filter logic decomposes each entry's reading into its constituent kana and checks that all are within the user's selected set.

### Audio Playback

Audio is loaded lazily via the HTML5 Audio API. No audio files are stored locally; only URLs are persisted. CORS policy is assumed to be permissive for the initial audio source. If audio fails to load (dead URL, CORS error, network issue), the app plays a short error sound (cassette-player-style static) and visually flags the entry. This check happens only when the user actually tries to play the audio — there is no proactive URL validation scan.

### Correctness Evaluation

Correctness is determined by comparing the user's katakana string to the entry's reading, with configurable leniency:

- **Chōonpu strictness off:** ー is treated as equivalent to the corresponding vowel kana (e.g., センセー = センセイ when the long vowel is エ-based). When on, they are distinct.
- **Nasalized G strictness off:** Nasalized ガ行 variants are treated as equivalent to their non-nasalized forms. (Currently always off due to lack of input method — see note in Session schema.)
- **Particle kana strictness off:** ハ and ワ are treated as equivalent, as are ヘ and エ, and ヲ and オ. This is because without grammatical parsing there is no way to determine whether は, へ, or を are being used as particles within a phrase — so rather than attempting to detect particle usage, we simply treat these pairs as interchangeable when lenient. When strict, they must match exactly.

**Syllable-aligned comparison:** Grading must not be a naive character-by-character string comparison. A single error early in the string (e.g., missing a long vowel) would shift all subsequent characters and cascade into a wall of false negatives. Instead, both the target reading and the user's submission are first syllabified into mora/syllable units following the Japanese CV(V)(C) structure, where the only valid final consonants are ン and the first half of a geminate (ッ). The two syllable arrays are then aligned (using edit distance or a similar sequence alignment algorithm) and compared at the syllable level. This way, a missed ー costs one syllable error rather than corrupting the entire comparison.

The grading rules are determined by the session's settings. Strictness toggles are always visible in session setup — if the user enables strict chōonpu but their imported data doesn't actually use ー, it simply has no effect (all comparisons will be exact matches anyway).

---

## Development Roadmap

### Phase 0: Scaffolding

Set up the Vite + React + MUI project, configure GitHub Pages deployment via GitHub Actions, establish the Dexie.js database schema, and implement React Router with the six screen routes. Implement the `KanaConverter` abstraction layer with wanakana as the MVP backend.

**Deliverable:** Empty app shell that builds and deploys to GitHub Pages, with a working romaji-to-katakana input abstraction.

### Phase 1: Data Pipeline (Import + Library)

Build the Import screen (CSV/TSV parsing, batch metadata, combined validation/confirmation step, chunked writes with progress) and the Library screen (virtualized list, lazy audio playback with error handling, deletion, search). This validates that the full data flow works end-to-end with real audio URLs before building the practice loop.

**Deliverable:** Users can import 10k+ entries, browse them, play audio, and manage their library.

### Phase 2: Core Practice Loop

Build the Session Setup screen (simplified — question count including infinity mode, record toggle, typo-check toggle, no kana filter yet), the Practice screen (audio playback, romaji input with live katakana conversion, certainty buttons as submit, typo-check flow, result display, early bail-out), and the Session Results screen. Implement the answer logging pipeline.

**Deliverable:** Users can run a full practice session and review their results.

### Phase 3: Kana Filtering and Strictness

Add the interactive kana table to Session Setup. Implement the kana-based entry filtering with manual availability check. Wire up the strictness toggles (chōonpu, particle kana) and make them functional in the grading logic. Add Hepburn romanization as a fallback input option.

**Deliverable:** Users can scope sessions to specific kana and control grading strictness.

### Phase 4: Analytics and Review

Build the all-time stats view: per-kana accuracy breakdowns, most-missed entries, certainty distribution, replay frequency analysis, response time stats (using startTime/timestamp pairs). Surface summary stats on the Home screen. This phase lays the data foundation for minimal pairs generation.

**Deliverable:** Users can see their long-term progress and identify weak areas.

### Phase 5: Future Enhancements

- Custom kunreishiki romaji converter (standalone sub-project, replaces wanakana via the abstraction layer)
- Inline entry editing from the Library screen (edit URL, reading, written form, pitch)
- CSV export of the library for sharing with others
- Minimal pairs test generation (using answer log data to identify confusable kana pairs)
- Spaced repetition weighting for question selection
- Export/import of progress data (for backup or sharing across devices)
- PWA offline support with service worker audio caching
- Pitch accent visualization and drilling
- Multiple romanization system support
- Nasalized G input method (when a convention is established)

---

## MVP Definition

The minimum viable product encompasses **Phases 0 through 2**: scaffolding, data import/library, and the core practice loop. This gives users the complete flow of importing audio, practicing transcription, and reviewing results — without kana filtering, strictness toggles, or long-term analytics.

**MVP screens:** Home, Import, Library, Session Setup (simplified), Practice, Session Results.

**MVP excludes:** Kana table filter, strictness toggles, all-time stats, Hepburn fallback, dead URL error sound.

The MVP is designed to be usable for real practice from day one while establishing the data structures and logging needed for all future features.
