---
"@maytes/checkout-button": patch
---

Fix the checkout button's busy-state spinner not reappearing after a customer's first checkout attempt on a given rendered button. The button now tracks its current icon (logo or spinner) by direct reference instead of re-querying the DOM by class name, so the spinner swap works correctly on every checkout attempt, not just the first.
