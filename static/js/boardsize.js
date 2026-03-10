import { state } from "./state.js";

export async function updateBoardSize() {
    var r = await fetch(`/api/boards/${state.slug}/size`);
    if (!r.ok) return;
    var data = await r.json();

    var pct  = Math.min(100, data.size_bytes / data.max_bytes * 100);
    var fill = document.getElementById("board-size-fill");
    var bar  = document.getElementById("board-size");

    fill.style.width = pct + "%";
    fill.style.background = pct >= 90 ? "#f92672" : pct >= 70 ? "#fd971f" : "#75715e";

    var sizeMb = (data.size_bytes / 1048576).toFixed(1);
    var maxMb  = (data.max_bytes  / 1048576).toFixed(0);
    bar.title  = sizeMb + " MB / " + maxMb + " MB";
}
