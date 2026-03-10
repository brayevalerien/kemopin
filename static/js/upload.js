import { state } from "./state.js";
import { generateId, toast } from "./utils.js";
import { addImageNode, reorderElements } from "./elements.js";
import { pushHistory } from "./history.js";
import { updateBoardSize } from "./boardsize.js";

export function openFilePicker() {
    var input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    input.addEventListener("change", function () {
        for (var i = 0; i < input.files.length; i++) uploadAndAddImage(input.files[i]);
    });
    input.click();
}

export async function fetchAndUploadFromUrl(url) {
    try {
        var r = await fetch(url);
        if (!r.ok) return;
        var blob = await r.blob();
        if (!blob.type.startsWith("image/")) return;
        uploadAndAddImage(new File([blob], "dropped.jpg", { type: blob.type }));
    } catch (_) { /* ignore CORS/network errors */ }
}

export async function uploadAndAddImage(file) {
    var formData = new FormData();
    formData.append("file", file);

    var response = await fetch(`/api/boards/${state.slug}/assets`, { method: "POST", body: formData });
    if (!response.ok) {
        var data = await response.json();
        toast("error", data.detail || "Upload failed");
        return;
    }

    var result = await response.json();
    var img = new Image();
    img.onload = function () {
        var viewW = state.stage.width()  / state.stage.scaleX();
        var viewH = state.stage.height() / state.stage.scaleY();
        var scale = Math.min(viewW * 0.8 / img.naturalWidth, viewH * 0.8 / img.naturalHeight);
        var w = img.naturalWidth  * scale;
        var h = img.naturalHeight * scale;
        var x = -state.stage.x() / state.stage.scaleX() + viewW / 2 - w / 2;
        var y = -state.stage.y() / state.stage.scaleY() + viewH / 2 - h / 2;

        state.imageCache[result.url] = img;
        var node = addImageNode({ id: generateId(), x, y, width: w, height: h, src: result.url }, img);
        state.transformer.nodes([node]);
        reorderElements();
        state.layer.batchDraw();
        pushHistory();
        updateBoardSize();
    };
    img.src = result.url;
}
