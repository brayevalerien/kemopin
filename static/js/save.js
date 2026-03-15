import { state } from "./state.js";
import { AUTOSAVE_DELAY } from "./constants.js";
import { serializeElements } from "./serialize.js";
import { toast } from "./utils.js";

var dirty         = false;
var saving        = false;
var autosaveTimer = null;

export function markDirty() {
    dirty = true;
    document.getElementById("save-indicator").className = "unsaved";
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(performSave, AUTOSAVE_DELAY);
}

export async function performSave() {
    if (!dirty || saving) return;
    saving = true;
    clearTimeout(autosaveTimer);
    document.getElementById("save-indicator").className = "saving";

    try {
        const payload = {
            slug: state.slug,
            created: state.boardData.created,
            canvas: { x: state.stage.x(), y: state.stage.y(), scaleX: state.stage.scaleX(), scaleY: state.stage.scaleY() },
            elements: serializeElements(),
        };

        const response = await fetch(`/api/boards/${state.slug}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (response.ok) {
            dirty = false;
            document.getElementById("save-indicator").className = "";
        } else {
            document.getElementById("save-indicator").className = "unsaved";
            toast("error", "Save failed");
        }
    } finally {
        saving = false;
    }
}

export function initSave() {
    document.getElementById("save-button").addEventListener("click", performSave);
    setInterval(function () { if (dirty) performSave(); }, 30000);
}
