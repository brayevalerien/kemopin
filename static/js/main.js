import { state } from "./state.js";
import { toast } from "./utils.js";
import { initShortcuts } from "./shortcuts.js";
import { initSave } from "./save.js";
import { initForm } from "./form.js";
import { setupCanvas } from "./canvas.js";
import { loadElements } from "./elements.js";
import { updateBoardSize } from "./boardsize.js";

if (state.slug) {
    // Expose toast globally so Konva error callbacks (and browser console) can use it
    window.toast = toast;

    // Wire up modules that only need DOM (can run before board fetch resolves)
    initShortcuts();
    initSave();

    (async function init() {
        const [boardRes, configRes] = await Promise.all([
            fetch(`/api/boards/${state.slug}`),
            fetch("/api/config"),
        ]);

        if (configRes.ok) {
            var cfg = await configRes.json();
            if (cfg.max_history) state.maxHistory = cfg.max_history;
            if (cfg.version) document.getElementById("version-indicator").textContent = "v" + cfg.version;
        }

        if (boardRes.ok) {
            state.boardData = await boardRes.json();
            document.getElementById("board-ui").style.display    = "";
            document.getElementById("create-form").style.display = "none";
            setupCanvas();
            loadElements();
            state.history      = [JSON.parse(JSON.stringify(state.boardData.elements || []))];
            state.historyIndex = 0;
            updateBoardSize();
        } else {
            document.getElementById("board-ui").style.display    = "none";
            document.getElementById("create-form").style.display = "";
            initForm();
        }
    })();
}
