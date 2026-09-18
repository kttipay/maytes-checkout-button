---
"@maytes/checkout-button": patch
---

The popup loading overlay no longer outlives the frame that opened it. When the button runs inside a same-origin iframe, the "Completing checkout with Maytes…" dialog is mounted in the top-level document so it covers the whole merchant page, but only the frame's SDK instance could remove it. The hosted checkout's back, cancel and return exits navigate `window.opener`, which is that frame, so the frame's document was replaced, its popup poll died, and the merchant page stayed covered by a modal dialog with the button unreachable. The overlay now also listens for the frame's `pagehide` and removes itself from the top-level document when the frame navigates away.
