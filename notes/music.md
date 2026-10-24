# Background music (sound.js `music()`, batch 34, trial v50, 2026-10-24)

Nick: 「可以有點背景音樂嗎?」. No audio files (nothing downloaded, no copyright): the Web Audio graph plays it.

- 92 BPM, C major, 8-bar chord loop C G Am F C G F G (`MUS_CH` voicings, `MUS_ROOT` bass notes).
- Pad: 3 triangle oscillators per bar through a 900 Hz lowpass, 0.35 s attack, released at the bar end. Bass: sine on beats 1 and 3. Pluck melody: sine + a quiet triangle an octave up through a 2.6 kHz lowpass, 8 eighth-note slots per bar, random walk on the C pentatonic (`MUS_PENT`), beats 1 and 3 snapped to a chord tone; the 16-bar melody is regenerated from an LCG seed every 16 bars so it varies. Hat: 45 ms highpassed noise on the off-beats.
- Scheduler: `setInterval` 150 ms, schedules bars up to 0.6 s ahead on `ctx.currentTime`; pauses (does not pile up) while `document.hidden`; resyncs if it fell more than 0.5 s behind.
- Volume `MUS.vol = 0.085` on the shared master (`S.inp`), so the sound toggle and volume cover it. `set({ level })` 0–1 (indoors 0.35). `dispose()` fades out in 0.25 s and disconnects after 1.5 s.
- town.src.js: `MUS` is created in `ambStep` right after the ambient sound (so it plays when driving or walking) and dropped in `ambOff` (garage page, races). `engineAudio.music` is feature-checked.
- night-test: `clk.mus && clk.musBar >= 2`.
- Not done: a separate music switch (would be UI → mock first), music during races, more than one tune.
