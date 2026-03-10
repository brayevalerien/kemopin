import { state } from "./state.js";
import { serializeElements } from "./serialize.js";
import { markDirty } from "./save.js";
// Note: elements.js also imports pushHistory from here — safe circular
// because all cross-cycle calls happen inside function bodies, never at module eval time.
import { loadImageElement, createTextNode, reorderElements } from "./elements.js";

export function pushHistory() {
    if (state.isRestoring) return;
    state.history = state.history.slice(0, state.historyIndex + 1);
    state.history.push(serializeElements());
    if (state.history.length > state.maxHistory) state.history.shift();
    else state.historyIndex++;
    markDirty();
}

export function restoreSnapshot(snapshot) {
    state.isRestoring = true;
    state.layer.children.slice().forEach(function (node) {
        if (node !== state.transformer) node.destroy();
    });
    state.transformer.nodes([]);
    snapshot.forEach(function (el) {
        if (el.type === "image") loadImageElement(el);
        else if (el.type === "text") createTextNode(el.x, el.y, el.content, el.fontSize, el.id, el.width, el.rotation, el.fill, el.align);
    });
    reorderElements();
    state.layer.batchDraw();
    state.isRestoring = false;
}

export function undo() {
    if (state.historyIndex <= 0) return;
    restoreSnapshot(state.history[--state.historyIndex]);
}

export function redo() {
    if (state.historyIndex >= state.history.length - 1) return;
    restoreSnapshot(state.history[++state.historyIndex]);
}
