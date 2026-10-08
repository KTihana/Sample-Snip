# Architecture

The extension keeps one sample in memory. The popup and pinned panel share the same recorder state, so closing either interface does not end capture or lose a finished sample.

## Chrome

The service worker validates messages from the extension interface, creates one offscreen document, and obtains a stream ID for the selected tab after the user presses Record. The offscreen document owns the audio context, capture tracks and sample URLs.

The stream source connects directly to the audio output to restore playback, and separately to an AudioWorklet that copies stereo PCM into transferable blocks. The worklet outputs silence to avoid doubling playback. It flushes a partial block on Stop and caps capture at exactly 60 seconds of frames.

Stop closes the recording context and stops the capture tracks. WAV encoding copies PCM into an interleaved 16-bit buffer. Raw capture chunks are released before MP3 conversion. The WAV buffer is transferred to a dedicated worker using the bundled local encoder; encoder input arrays are reused between blocks. A conversion failure leaves the WAV available.

The background worker can sleep while the offscreen recorder remains alive. The recorder sends state changes for the toolbar badge. The interface polls serially while visible and ignores stale responses after a user command.

## Firefox beta

Firefox uses a persistent extension background page and temporary access to the selected page. A content script bridges extension messages to a packaged script running in the page’s own realm. The bridge verifies the window source, session ID, random token, bounded chunk size and finite samples. The background additionally verifies the extension, tab and frame IDs, limits the accepted sample rate, clamps PCM, and caps frames.

Playing HTML audio/video elements connect to a page AudioContext. MediaElementSource nodes can only be created once per element, so a WeakMap retains the reusable graph without keeping removed players alive. The playback context stays connected after Stop; only recording processor connections are removed. Newly connected seekable players are re-seeked to their current position so Firefox routes already-buffered audio immediately.

The experimental backend uses ScriptProcessorNode. It runs on the page thread and is deprecated; it is retained here because this path was verified with Firefox player audio. It is not equivalent to complete tab capture. Restrictive page policies or other player audio graphs can block it.

A recording session owns its bridge port and PCM chunks. Failure, cancellation and disconnect remove bridge listeners and inserted scripts. Late cancelled script loads do not start capture. No-audio and silent captures report an error instead of an empty successful sample.

## Sample lifetime

Both backends use the same WAV/MP3 helpers. Finished samples use Blob URLs. Discard and replacement revoke both URLs; downloaded files remain on the user’s device. MP3 errors do not invalidate WAV. Nothing is persisted as a sample library or sent to a server.

## Builds

Chrome and Firefox have separate manifests and packaged backends. Shared audio, UI and licensed vendor files are copied into each build. Packaging uses an explicit public source list, fixed ZIP timestamps and sorted entries. Checks verify manifest references, local script resources, license inclusion and repeatable archive hashes.
