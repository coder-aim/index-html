/**
 * Sticky "Get Free Sample Data" CTA - shows after the visitor scrolls past
 * the hero, hides again near the top. Vanilla JS, no jQuery dependency.
 */
(function () {
    "use strict";

    document.addEventListener("DOMContentLoaded", function () {
        var cta = document.getElementById("rbtStickyCta");
        if (!cta) {
            return;
        }

        function toggleCta() {
            if (window.scrollY > 250) {
                cta.classList.add("rbt-sticky-cta-active");
            } else {
                cta.classList.remove("rbt-sticky-cta-active");
            }
        }

        window.addEventListener("scroll", toggleCta);
        toggleCta();
    });
})();
