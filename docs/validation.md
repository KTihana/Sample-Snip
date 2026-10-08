# Validation

Checked October 8, 2026, for version 0.3.1.

## Automated

`npm run check` passes formatting, ESLint with zero errors/warnings in maintained code, 19 regression tests, and package checks. Tests cover WAV headers and metadata validation, stereo order, mono duplication, partial-block flushing, the exact 60-second cap, capture constraints, playback routing, repeated recordings, cleanup, authenticated Firefox messages, blocked-page retries, timer rollover and MP3 transfer failure. The real bundled encoder produces complete stereo 320 kbps MP3 frames at 44.1 and 48 kHz.

Chrome, Firefox and source ZIPs build reproducibly. Checks verify local script/manifest resources, license inclusion and exclusion of private release files. Development dependencies reported zero vulnerabilities when installed.

Mozilla web-ext 10.7.0 lint reports zero errors, zero notices and two warnings in the unmodified `vendor/lame.min.js`. Its no-unsanitized parser reports “Unexpected Callee” at line 76, columns 60 and 104. These are retained and disclosed; vendor code is not rewritten or hidden from that check.

## Live browser checks on macOS

Chrome 155: the reorganized build records the selected tab, opens its persistent side panel during capture, responds to webpage playback controls, stops, previews, downloads WAV and MP3, and discards. Its 7.211-second WAV is stereo 48 kHz and contains the synthetic 440/660 Hz player tones. An earlier 22.341-second capture excluded a simultaneous native 880 Hz tone (measured amplitude below 0.00004).

Firefox 157.0.1: the reorganized build captures the same-origin HTML player, completes a first 3.9-second recording, discards, then records again from the native sidebar. The second downloaded WAV is 20.992 seconds, stereo 48 kHz, with RMS approximately 0.04746 throughout every measured segment. Both download formats work. The sidebar remains visible when clicking the webpage’s player, and source playback continues after Stop. MP3 downloads decode successfully as stereo 48 kHz / 320 kbps.

## Remaining verification

Windows, Linux and Edge have not been tested live. CI checks development/build behavior on all three operating systems; it does not verify browser audio capture. Safari has no implemented package. Firefox remains an unsigned, temporary beta with the limitations described in [compatibility](compatibility.md).
