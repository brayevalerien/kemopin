import { SHORTCUTS } from "./constants.js";

export function initShortcuts() {
    var overlay = document.getElementById("shortcuts-overlay");
    overlay.addEventListener("click", function (e) {
        if (e.target === overlay) overlay.classList.remove("visible");
    });

    var panel = document.getElementById("shortcuts-panel");
    var html = "<h2>Keyboard shortcuts</h2><div class=\"shortcuts-groups\">";
    SHORTCUTS.forEach(function (group) {
        html += "<div class=\"shortcuts-group\">";
        group.forEach(function (s) {
            html += "<div class=\"shortcut-row\"><kbd>" + s.key + "</kbd><span>" + s.desc + "</span></div>";
        });
        html += "</div>";
    });
    html += "</div>";
    panel.innerHTML = html;
}
