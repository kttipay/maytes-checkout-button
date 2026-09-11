---
'@maytes/checkout-button': patch
---

Fix a race in `mode: 'popup'`: if the shopper closed the popup while `createCheckout` was still in flight, the SDK would try to navigate (or, on rejection, report a failure for) a window that was already gone once the promise settled — on top of the `maytes:checkout-closed` event the close-poll had already fired. Both the success and rejection paths now check whether the popup is still open before acting, so closing the popup early produces exactly one `checkout-closed` event and nothing else.
