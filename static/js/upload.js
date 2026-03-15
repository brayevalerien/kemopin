import { state } from "./state.js";
import { generateId, toast } from "./utils.js";
import { addImageNode, reorderElements } from "./elements.js";
import { pushHistory } from "./history.js";
import { updateBoardSize } from "./boardsize.js";

var MAX_DIMENSION = 2048;

async function resizeIfNeeded(file) {
    var bitmap = await createImageBitmap(file);
    var w = bitmap.width;
    var h = bitmap.height;

    if (w <= MAX_DIMENSION && h <= MAX_DIMENSION) {
        bitmap.close();
        return { blob: file, resized: false };
    }

    var scale = MAX_DIMENSION / Math.max(w, h);
    var canvas = document.createElement("canvas");
    canvas.width  = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    var mime = file.type === "image/png" ? "image/png" : "image/jpeg";
    return new Promise(function (resolve) {
        canvas.toBlob(function (blob) {
            resolve({ blob, resized: true });
        }, mime, mime === "image/jpeg" ? 0.92 : undefined);
    });
}

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
    } catch (_) { toast("error", "Failed to load dropped image"); }
}

export async function uploadAndAddImage(file) {
    var { blob, resized } = await resizeIfNeeded(file);
    if (resized) toast("info", "Image resized to " + MAX_DIMENSION + "px");

    var formData = new FormData();
    formData.append("file", blob);

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
