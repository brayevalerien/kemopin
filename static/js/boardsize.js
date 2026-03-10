import { state } from "./state.js";

export async function updateBoardSize() {
    var r = await fetch(`/api/boards/${state.slug}/size`);
    if (!r.ok) return;
    var data = await r.json();
    var el = document.getElementById("board-size");
    el.textContent =
        (data.size_bytes / 1048576).toFixed(1) + " MB / " +
        (data.max_bytes  / 1048576).toFixed(0) + " MB";
}
