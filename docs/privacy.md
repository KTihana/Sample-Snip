# Privacy

Effective October 8, 2026. Maintained by [KTihana](https://github.com/KTihana).

Sample Snip records the selected browser tab only after you press Record. It does not access other applications, the screen or other tabs. Audio already played by the selected webpage is part of that tab’s output.

Recording ends when you press Stop or the 60-second limit is reached. Closing the source page may finalize the audio captured so far. The experimental Firefox version processes supported HTML audio/video players in the main page and cannot capture every sound in a tab.

Audio capture, preview and MP3 conversion run locally. The extension holds samples temporarily in browser memory. It does not upload recordings, use analytics, collect browsing history or send data to a developer server. The bundled encoder uses a local worker and no conversion service.

Discard, replacement, extension reload or the end of the browser session removes the current sample. Downloaded files stay on your device until you delete them; the extension does not manage those files. Firefox retains a page playback audio graph until the page closes so stopping a recording does not silence its player.

Chrome permissions provide selected-tab capture, temporary tab access, offscreen audio processing and the side panel. Firefox requests only temporary access to the selected tab. The browser’s capture indicators and extension REC badge show when recording is active.

Questions and issues can be reported in the [repository](https://github.com/KTihana/Sample-Snip/issues). GitHub’s own privacy policy applies to interactions with GitHub, separately from the extension’s local processing.
