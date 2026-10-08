# Simple Snip

Record a short sound from your selected browser tab, preview it, and download WAV or MP3. Free, open source, and processed entirely on your device.

- Press **Record sample**, then **Stop**. Each sample is limited to 60 seconds.
- Download stereo 16-bit WAV or 320 kbps MP3.
- Use the header pin icon to keep the recorder visible in the browser side panel.
- Keep one sample in memory; **Discard** removes it.

Chrome captures selected-tab audio. The Firefox beta captures supported HTML audio/video players and has narrower compatibility. macOS has been tested; Windows, Linux and Edge still need live verification. There is no Safari package. See [compatibility](docs/compatibility.md) and [validation](docs/validation.md).

## Install in Chrome or Edge

1. Download the repository using **Code → Download ZIP**, then extract it.
2. Open `chrome://extensions` or `edge://extensions`.
3. Enable **Developer mode**, click **Load unpacked**, and select the extracted **extension** folder.
4. Play audio in a webpage, open Simple Snip from the toolbar, and record.

No account, server, native companion or build tools are needed for this installation. Recording continues if the popup closes; reopen it to Stop. The pin icon opens a persistent side panel.

## Try the Firefox beta

Generate the Firefox package with the development commands below. Open `about:debugging`, choose **This Firefox → Load Temporary Add-on**, and select `dist/simple-snip-firefox/manifest.json` or its ZIP.

Play an HTML audio/video player in the main page, then open the extension toolbar action before recording. Open it again on each newly selected page to grant temporary access. The pin icon opens Firefox’s sidebar. This unsigned installation lasts until Firefox restarts.

Web Audio games, embedded frames, cross-origin or protected players, existing player audio graphs, and restrictive page policies may prevent recording. Firefox does not offer the same complete tab capture as Chrome.

## Develop

Use Node.js 22.13+ and Python 3.10+. No runtime npm dependencies are bundled into the extension.

```sh
npm ci
npm run check
npm run package
```

`npm run check` runs formatting, lint, audio/capture regression tests, and build resource checks. `npm run package` creates versioned Chrome, Firefox and source ZIPs in `dist/`. Builds are reproducible and do not modify source files. `npm run format` formats maintained JavaScript, HTML, CSS and documentation; third-party code is left intact.

Reload the extension after changes. For a local audio fixture:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Open `http://127.0.0.1:8765/tests/player.html` for a looping stereo player, or `tests/tone.html` for a Web Audio source. Both use synthetic tones.

## Source layout

| Folder               | Purpose                                                           |
| -------------------- | ----------------------------------------------------------------- |
| `extension/chrome/`  | Tab permissions, offscreen capture and recording lifecycle        |
| `extension/firefox/` | Experimental page-player capture and authenticated message bridge |
| `extension/audio/`   | PCM capture, WAV encoding, MP3 worker and sample cleanup          |
| `extension/shared/`  | Shared limits and message validation                              |
| `extension/ui/`      | Popup, persistent panel, preview and downloads                    |
| `extension/vendor/`  | Unmodified MP3 encoder, licenses and source archive               |
| `tests/`             | Regression tests and synthetic audio fixtures                     |
| `scripts/`           | Packaging, resource verification and icon generation              |
| `docs/`              | Architecture, compatibility, privacy and validation               |

See [architecture](docs/architecture.md) for audio routing and resource ownership. Contributions should pass `npm run check` and include meaningful regression coverage for recording changes.

## Privacy and use

Capture starts only after you press Record. Audio is kept in browser memory and downloaded locally. The extension has no analytics, remote scripts, browsing-history collection or audio uploads. See [privacy](docs/privacy.md).

Use audio you created or have permission to sample. Recording does not grant rights to the source material. See [responsible use](docs/responsible-use.md).

## License

Original code is licensed under [MIT](LICENSE). The bundled lamejs encoder retains its LGPL-3.0 license, notices and corresponding source archive in [extension/vendor](extension/vendor/NOTICE.md). Keep those files with redistributed builds. This project is distributed free through GitHub; no browser-store listing is published.
