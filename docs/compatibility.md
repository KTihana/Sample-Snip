# Compatibility

Simple Snip is extension-only. It captures the selected browser tab or, in the experimental Firefox version, supported players in that page.

| Browser            | macOS                                                    | Windows                         | Linux                           |
| ------------------ | -------------------------------------------------------- | ------------------------------- | ------------------------------- |
| Chrome 116+        | Full-tab backend; tested with Chrome 155                 | Same backend; live test pending | Same backend; live test pending |
| Chromium Edge 116+ | Same backend; live test pending                          | Same backend; live test pending | Same backend; live test pending |
| Firefox 142+       | Experimental player backend; tested with Firefox 157.0.1 | Same backend; live test pending | Same backend; live test pending |
| Safari             | No package                                               | No package                      | No package                      |

Chrome uses tabCapture and an offscreen document without OS-specific executables or native dependencies. Other platforms are implementation targets, not claims of completed live testing.

Firefox records playing HTML audio/video elements in the main page. It cannot capture every sound in a tab. Web Audio games, embedded players, cross-origin/protected media, existing audio graphs and restrictive page policies may prevent capture. Open the toolbar action on each newly selected page to grant access. The unsigned package loads temporarily through `about:debugging` and is removed on browser restart.

Safari has no implemented or tested backend. Do not load the Chrome manifest into Firefox or claim a working Safari build.

## Platform verification

Before claiming wider support, run capture, popup reopen, pinned panel, Stop, preview, both downloads, Discard, repeat recording, source closure and the duration limit in each browser/OS combination. Include mono and stereo sources and protected-page failures. Automated audio checks do not replace real browser tests.

## References

- [Chrome tabCapture](https://developer.chrome.com/docs/extensions/reference/api/tabCapture)
- [Chrome background audio capture](https://developer.chrome.com/docs/extensions/how-to/web-platform/screen-capture)
- [Firefox shared-audio implementation issue](https://bugzilla.mozilla.org/show_bug.cgi?id=1541425)
- [Apple Safari web extensions](https://developer.apple.com/documentation/safariservices/safari-web-extensions)
