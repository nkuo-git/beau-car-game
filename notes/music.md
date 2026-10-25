# Background music (sound.js `music()`, batch 34, trial v50, 2026-10-24)

Nick: 「可以有點背景音樂嗎?」. No audio files (nothing downloaded, no copyright): the Web Audio graph plays it.

- 92 BPM, C major, 8-bar chord loop C G Am F C G F G (`MUS_CH` voicings, `MUS_ROOT` bass notes).
- Pad: 3 triangle oscillators per bar through a 900 Hz lowpass, 0.35 s attack, released at the bar end. Bass: sine on beats 1 and 3. Pluck melody: sine + a quiet triangle an octave up through a 2.6 kHz lowpass, 8 eighth-note slots per bar, random walk on the C pentatonic (`MUS_PENT`), beats 1 and 3 snapped to a chord tone; the 16-bar melody is regenerated from an LCG seed every 16 bars so it varies. Hat: 45 ms highpassed noise on the off-beats.
- Scheduler: `setInterval` 150 ms, schedules bars up to 0.6 s ahead on `ctx.currentTime`; pauses (does not pile up) while `document.hidden`; resyncs if it fell more than 0.5 s behind.
- Volume `MUS.vol = 0.085` on the shared master (`S.inp`), so the sound toggle and volume cover it. `set({ level })` 0–1 (indoors 0.35). `dispose()` fades out in 0.25 s and disconnects after 1.5 s.
- town.src.js: `MUS` is created in `ambStep` right after the ambient sound (so it plays when driving or walking) and dropped in `ambOff` (garage page, races). `engineAudio.music` is feature-checked.
- night-test: `clk.mus && clk.musBar >= 2`.
- Not done: a separate music switch (would be UI → mock first), music during races, more than one tune.

## Music switch (batch 35, content 22, 2026-10-24)

Nick: 「做背景音樂開關 不用畫圖 直接做」 (no mock needed). Full-screen driving: 「⋯」 opens the row and a 🎵 button sits under ✨ (in landscape, max-height 560px, to the left of ✨ at right 374px because under ✨ it covered the gas pedal at 800×360; 「下車」 moves to 426px) (garage.src.html `#musTog`, garage.css `.mustog`, 44 px, same fold rules as the other buttons; `aria-pressed="false"` greys it out). town.src.js: `musOn` / `musSet(on, keep)` / `musLevel()` — the level goes to `MUS.set({ level: off ? 0 : indoor ? 0.35 : 1 })`, so the music object keeps running (no gap when switched back on). Stored per phone in localStorage `carid.music` (`'on'` default / `'off'`; not in the save, not migrated). sound.js `music()` exposes a `level` getter for tests. night-test `msw` clicks it twice and checks pressed state, level and storage; look-test includes `#musTog` in the overlap check on the 5 phone sizes.

## Batch 36 — two tunes (trial v52, 2026-10-25)

Nick: 「音樂可以改成輕快一點 有賽車感的嗎 開車跟走路音樂換一下」. sound.js `music(style0)` now holds two tunes in one object and switches at the next bar (`set({ style: 'walk' | 'drive' })`, `style` getter = the one playing; `bar` keeps counting across the switch, the per-tune bar `sb` restarts so the chord progression starts from bar 1).
- `walk` = the original tune (92 BPM, C major, pads / bass / pentatonic pluck melody / off-beat hats; `MUS.walk` gains).
- `drive` = racing feel: 128 BPM, A minor (Am F C G / Am F G G, `DRV_CH` / `DRV_ROOT`), kick on every beat (sine 160→42 Hz), snare on 2 and 4 (band-passed noise + a 190 Hz tick; an extra one on the last bar of 8), hats every 8th with the off-beats louder, sawtooth bass through a resonant low-pass (8ths, octave jump on the 4th and 8th), syncopated sawtooth chord stabs on the "and" of 2 and 4 (two slightly detuned voices), a 16th-note square-wave arpeggio over the chord tones with pentatonic passing notes (`makeArp`, seeded, new pattern every 8 bars). `MUS.drive` gains are ~1.6× the walk ones because the notes are short: measured RMS at the master input walk 0.0058 / drive 0.0049, peak 0.023 / 0.031 (scratch probe, headless Chromium AnalyserNode).
- town.src.js `musLevel()` sends `style: walker on ? 'walk' : 'drive'` (indoors counts as walking), and `ambStep` creates the music with the right tune from the start.
- night-test: the driving check wants `style === 'drive'`; after `leaveCar` it waits (real time, ≤ 8 s) for `style === 'walk'`.
- Not done: music during races; a third tune; a tune per place.

## Batch 38 — fewer birds (2026-10-25, for trial v54)

Nick: 「鳥叫聲太多了」. sound.js `ambient()` birds: `AMB_V.birds` 0.035 → 0.022, one call every 5–14 s (`bird0`/`bird1`; was 1.6–4 s), 1–3 chirps per call (was 2–3), first one after 3 s. Same day he asked for a music volume control (mock https://claude.ai/artifact/SfnUXBwYL8PEH6Nm9PZiVP: 🎵 opens 「背景音樂 關／小／中／大」, waiting for his OK) and for 最真實 ideas with no phone limits (8 options offered, recommended 1 shadows + 2 real car reflections + 3 2× supersampling + 4 wall materials).

## Batch 39 — music volume (trial v54, 2026-10-25)

Nick: 「背景音樂可以調音量」, mock https://claude.ai/artifact/SfnUXBwYL8PEH6Nm9PZiVP approved. Tapping 🎵 (in the 「⋯」 row) swaps the row for 「背景音樂 關 小 中 大」 (`#musPop`, town.src.js `musOpen`, like 畫質). Levels `MUS_LV` = 0 / 0.45 / 1 / 1.6 (× 0.35 indoors); sound.js `set({ level })` now clamps to 0..2. `carid.music` stores `off`/`s`/`m`/`l`; the old `on` reads as 中. 關 greys 🎵.

## Batch 41 — cleaner and louder music (trial v56, 2026-10-25)

Nick: 「音樂很破」 and 「音樂把直接全部往上升一級 所以仍然只有小中大就好」.
- Music has its own bus `S.mus` → a light limiter (threshold −4 dB, ratio 12) → output, instead of sharing the engine's compressor (−14 dB, ratio 8) and soft clipper, which squashed and clipped it under the engine. Volume and mute drive both buses.
- Phones open the AudioContext with `latencyHint: 'balanced'` (was 'interactive') so a busy phone has a bigger buffer and fewer dropouts.
- Levels one step up: `MUS_LV` 小 1 / 中 1.6 / 大 2.4 (was 0.45 / 1 / 1.6); `set({ level })` clamps to 0..3. Still 關 小 中 大 (the 超大 mock was dropped).
