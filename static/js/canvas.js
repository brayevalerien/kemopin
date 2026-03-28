import { state } from "./state.js";
import { TEXT_COLORS, snapToGrid } from "./constants.js";
import { serializeElement } from "./serialize.js";
import { pushHistory, undo, redo } from "./history.js";
import { createTextNode, duplicateFrom, fitToView, bringForward, sendBackward } from "./elements.js";
import { openFilePicker, uploadAndAddImage, fetchAndUploadFromUrl } from "./upload.js";
import { performSave } from "./save.js";
import { toast } from "./utils.js";

export function setupCanvas() {
    const container = document.getElementById("canvas-container");

    state.stage = new Konva.Stage({
        container,
        width: window.innerWidth,
        height: window.innerHeight,
        draggable: true,
    });

    state.layer = new Konva.Layer();
    state.stage.add(state.layer);

    state.transformer = new Konva.Transformer({
        borderStroke: "#ae81ff",
        anchorStroke: "#ae81ff",
        anchorFill: "#2d2a2e",
        anchorSize: 8,
        rotateEnabled: true,
        keepRatio: true,
        rotationSnaps: [0, 90, 180, 270],
        rotationSnapTolerance: 15,
    });
    state.layer.add(state.transformer);

    // Normalize text scale into fontSize/width after transform
    state.transformer.on("transformend", function () {
        var node = state.transformer.nodes()[0];
        if (node instanceof Konva.Text) {
            node.fontSize(Math.round(node.fontSize() * node.scaleY()));
            node.width(node.width() * node.scaleX());
            node.scaleX(1);
            node.scaleY(1);
            state.layer.batchDraw();
        }
        pushHistory();
    });

    if (state.boardData.canvas) {
        state.stage.position({ x: state.boardData.canvas.x || 0, y: state.boardData.canvas.y || 0 });
        state.stage.scale({ x: state.boardData.canvas.scaleX || 1, y: state.boardData.canvas.scaleY || 1 });
    }

    setupZoom();
    setupPan(container);
    setupDragDrop();
    setupPaste();
    setupKeyboard();
    setupAlt();
    updateGrid(container);

    state.stage.on("dragmove", function () { updateGrid(container); });

    state.stage.on("click tap", function (e) {
        if (e.target === state.stage) state.transformer.nodes([]);
    });

    state.stage.on("dblclick dbltap", function (e) {
        if (e.target !== state.stage) return;
        var p = state.stage.getRelativePointerPosition();
        createTextNode(snapToGrid(p.x), snapToGrid(p.y), "", 16);
    });

    window.addEventListener("resize", function () {
        state.stage.width(window.innerWidth);
        state.stage.height(window.innerHeight);
    });
}

function updateGrid(container) {
    var scale = state.stage.scaleX();
    var size = 20 * scale;
    var dot = 1.5 * scale;
    container.style.backgroundImage = "radial-gradient(circle, #3e3b40 " + dot + "px, transparent " + dot + "px)";
    container.style.backgroundSize = size + "px " + size + "px";
    container.style.backgroundPosition = state.stage.x() + "px " + state.stage.y() + "px";
}

function setupZoom() {
    var container = document.getElementById("canvas-container");
    state.stage.on("wheel", function (e) {
        e.evt.preventDefault();
        var oldScale = state.stage.scaleX();
        var pointer  = state.stage.getPointerPosition();
        var factor   = e.evt.deltaY > 0 ? 1 / 1.08 : 1.08;
        var scale    = Math.max(0.05, Math.min(10, oldScale * factor));
        var origin   = { x: (pointer.x - state.stage.x()) / oldScale, y: (pointer.y - state.stage.y()) / oldScale };
        state.stage.scale({ x: scale, y: scale });
        state.stage.position({ x: pointer.x - origin.x * scale, y: pointer.y - origin.y * scale });
        updateGrid(container);
    });
}

function setupPan(container) {
    var panning = false;
    var last    = null;

    // Prevent X11/Wayland middle-click paste at the source (same fix as Excalidraw)
    document.addEventListener("mousedown", function (e) {
        if (e.button === 1) e.preventDefault();
    });

    container.addEventListener("mousedown", function (e) {
        if (e.button !== 1) return;
        panning = true;
        last = { x: e.clientX, y: e.clientY };
    });
    window.addEventListener("mousemove", function (e) {
        if (!panning) return;
        state.stage.position({ x: state.stage.x() + e.clientX - last.x, y: state.stage.y() + e.clientY - last.y });
        last = { x: e.clientX, y: e.clientY };
        updateGrid(container);
    });
    window.addEventListener("mouseup", function (e) {
        if (e.button === 1) { panning = false; last = null; }
    });
}

function setupDragDrop() {
    var stageContent = state.stage.container();
    stageContent.addEventListener("dragover",  function (e) { e.preventDefault(); }, true);
    stageContent.addEventListener("dragenter", function (e) { e.preventDefault(); }, true);
    stageContent.addEventListener("drop", function (e) {
        e.preventDefault();
        if (e.dataTransfer.files.length > 0) {
            for (var i = 0; i < e.dataTransfer.files.length; i++) {
                if (e.dataTransfer.files[i].type.startsWith("image/")) {
                    uploadAndAddImage(e.dataTransfer.files[i]);
                }
            }
        } else {
            var uriList = e.dataTransfer.getData("text/uri-list");
            if (uriList) {
                uriList.split("\n").forEach(function (uri) {
                    uri = uri.trim();
                    if (uri && !uri.startsWith("#")) fetchAndUploadFromUrl(uri);
                });
            }
        }
    }, true);
}

function setupPaste() {
    // Track whether Ctrl/Cmd is held — paste events don't carry modifier state
    var ctrlHeld = false;
    window.addEventListener("keydown", function (e) { if (e.key === "Control" || e.key === "Meta") ctrlHeld = true; });
    window.addEventListener("keyup",   function (e) { if (e.key === "Control" || e.key === "Meta") ctrlHeld = false; });
    window.addEventListener("blur",    function ()  { ctrlHeld = false; });

    window.addEventListener("paste", function (e) {
        // Reject middle-click paste (Linux X11/Wayland): only accept Ctrl+V / Cmd+V
        if (!ctrlHeld) return;

        var items = e.clipboardData.items;
        // OS clipboard images always take priority
        for (var i = 0; i < items.length; i++) {
            if (items[i].type.startsWith("image/")) {
                uploadAndAddImage(items[i].getAsFile());
                return;
            }
        }
        // No image — check for kemopin element JSON in text
        var text = e.clipboardData.getData("text/plain");
        if (text) {
            try {
                var data = JSON.parse(text);
                if (data && data._kemopin && data.element) {
                    var el = data.element;
                    var viewW = state.stage.width()  / state.stage.scaleX();
                    var viewH = state.stage.height() / state.stage.scaleY();
                    var cx = snapToGrid(-state.stage.x() / state.stage.scaleX() + viewW / 2);
                    var cy = snapToGrid(-state.stage.y() / state.stage.scaleY() + viewH / 2);
                    var elH = el.height || 50;
                    state.pasteCount++;
                    var offset = state.pasteCount * 20;
                    var dx = cx - el.width / 2 - el.x + offset;
                    var dy = cy - elH / 2 - el.y + offset;
                    duplicateFrom(el, dx, dy);
                }
            } catch (_) {}
        }
    });
}

function setupKeyboard() {
    var overlay = document.getElementById("shortcuts-overlay");

    window.addEventListener("keydown", function (e) {
        if (document.activeElement.tagName === "TEXTAREA") return;
        if (document.activeElement.tagName === "INPUT") return;

        var nodes    = state.transformer.nodes();
        var selected = nodes.length > 0 ? nodes[0] : null;
        var ctrl     = e.ctrlKey || e.metaKey;

        if (ctrl && e.key.toLowerCase() === "s") { e.preventDefault(); performSave(true); return; }
        if (ctrl && e.key.toLowerCase() === "z") { e.shiftKey ? redo() : undo(); return; }
        if (ctrl && e.key === "y")               { redo(); return; }

        if (ctrl && e.key === "c" && selected) {
            e.preventDefault();
            var data = serializeElement(selected);
            state.pasteCount = 0;
            navigator.clipboard.writeText(JSON.stringify({ _kemopin: true, element: data })).catch(function () {
                toast("warning", "Copy failed — clipboard access denied");
            });
            return;
        }
        if (ctrl && e.key === "d" && selected) {
            e.preventDefault();
            if (!e.repeat) duplicateFrom(serializeElement(selected), 20, 20);
            return;
        }

        if (e.key === "Delete" || e.key === "Backspace") {
            if (nodes.length > 0) {
                nodes.forEach(function (n) { n.destroy(); });
                state.transformer.nodes([]);
                state.layer.batchDraw();
                pushHistory();
            }
            return;
        }

        if (e.key === "f") { fitToView(); return; }
        if (e.key === "h") { overlay.classList.toggle("visible"); return; }
        if (e.key === "Escape") { overlay.classList.remove("visible"); return; }
        if (e.key === "o") { openFilePicker(); return; }
        if (ctrl && e.key === "ArrowUp")   { e.preventDefault(); if (selected) bringForward(selected); return; }
        if (ctrl && e.key === "ArrowDown") { e.preventDefault(); if (selected) sendBackward(selected); return; }

        if (e.key === "c" && !ctrl && selected instanceof Konva.Text) {
            var ci = TEXT_COLORS.indexOf(selected.fill());
            selected.fill(TEXT_COLORS[(ci + 1) % TEXT_COLORS.length]);
            state.layer.batchDraw();
            pushHistory();
            return;
        }
        if (e.key === "a" && !ctrl && selected instanceof Konva.Text) {
            var aligns = ["left", "center", "right"];
            var ai = aligns.indexOf(selected.align());
            selected.align(aligns[(ai + 1) % aligns.length]);
            state.layer.batchDraw();
            pushHistory();
            return;
        }
    });
}

function setupAlt() {
    window.addEventListener("keydown", function (e) {
        if (e.key === "Alt") { e.preventDefault(); state.altPressed = true; state.transformer.rotationSnaps([]); }
    });
    window.addEventListener("keyup", function (e) {
        if (e.key === "Alt") { state.altPressed = false; state.transformer.rotationSnaps([0, 90, 180, 270]); }
    });
}
