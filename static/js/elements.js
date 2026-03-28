import { state } from "./state.js";
import { GRID_SIZE } from "./constants.js";
import { generateId } from "./utils.js";
// Note: history.js also imports from here — safe circular
// because all cross-cycle calls happen inside function bodies, never at module eval time.
import { pushHistory } from "./history.js";

export function reorderElements() {
    state.layer.children.forEach(function (node) {
        if (node instanceof Konva.Text) node.moveToTop();
    });
    state.transformer.moveToTop();
}

export function bringForward(node) {
    var children = state.layer.children;
    var idx = children.indexOf(node);
    if (idx < children.length - 1) {
        var above = children[idx + 1];
        if ((node instanceof Konva.Image && above instanceof Konva.Image) ||
            (node instanceof Konva.Text  && above instanceof Konva.Text)) {
            node.moveUp();
            state.layer.batchDraw();
            pushHistory();
        }
    }
}

export function sendBackward(node) {
    var children = state.layer.children;
    var idx = children.indexOf(node);
    if (idx > 0) {
        var below = children[idx - 1];
        if ((node instanceof Konva.Image && below instanceof Konva.Image) ||
            (node instanceof Konva.Text  && below instanceof Konva.Text)) {
            node.moveDown();
            state.layer.batchDraw();
            pushHistory();
        }
    }
}

export function makeSelectable(node) {
    node.on("click tap", function (e) {
        e.cancelBubble = true;
        state.transformer.nodes([node]);
        state.layer.batchDraw();
    });
    node.on("dragend", function () {
        if (!state.altPressed) {
            node.position({
                x: Math.round(node.x() / GRID_SIZE) * GRID_SIZE,
                y: Math.round(node.y() / GRID_SIZE) * GRID_SIZE,
            });
            state.layer.batchDraw();
        }
        pushHistory();
    });
}

export function addImageNode(el, imageObject) {
    var node = new Konva.Image({
        id: el.id || generateId(),
        x: el.x, y: el.y,
        image: imageObject,
        width: el.width, height: el.height,
        rotation: el.rotation || 0,
        draggable: true,
    });
    node.setAttr("src", el.src);
    makeSelectable(node);
    state.layer.add(node);
    return node;
}

export function loadImageElement(el) {
    function done(img) {
        addImageNode(el, img);
        if (!state.isRestoring) { reorderElements(); state.layer.batchDraw(); }
    }
    if (state.imageCache[el.src]) {
        done(state.imageCache[el.src]);
    } else {
        var img = new Image();
        img.onload = function () { state.imageCache[el.src] = img; done(img); };
        img.src = el.src;
    }
}

export function loadElements() {
    if (!state.boardData.elements) return;
    state.boardData.elements.forEach(function (el) {
        if (el.type === "image") {
            loadImageElement(el);
        } else if (el.type === "text") {
            createTextNode(el.x, el.y, el.content, el.fontSize || 16, el.id, el.width, el.rotation, el.fill || "#f8f8f2", el.align || "left");
        }
    });
}

export function createTextNode(x, y, content, fontSize, id, width, rotation, fill, align) {
    var textNode = new Konva.Text({
        id: id || generateId(),
        x, y,
        text: content || "Double click to edit",
        fontSize: fontSize || 16,
        fill: fill || "#f8f8f2",
        align: align || "left",
        width: width || 200,
        rotation: rotation || 0,
        draggable: true,
        fontFamily: "system-ui, sans-serif",
    });
    makeSelectable(textNode);
    textNode.on("dblclick dbltap", function () { editTextNode(textNode); });
    state.layer.add(textNode);
    if (!state.isRestoring) {
        reorderElements();
        state.layer.batchDraw();
        if (!content) editTextNode(textNode);
    }
    return textNode;
}

export function editTextNode(textNode) {
    textNode.hide();
    state.transformer.nodes([]);

    var pos   = textNode.absolutePosition();
    var box   = state.stage.container().getBoundingClientRect();
    var scale = state.stage.scaleX();

    var textarea = document.createElement("textarea");
    document.body.appendChild(textarea);
    textarea.value = textNode.text();

    Object.assign(textarea.style, {
        position:   "absolute",
        top:        box.top + pos.y + "px",
        left:       box.left + pos.x + "px",
        width:      textNode.width() * scale + "px",
        minHeight:  textNode.height() * scale + "px",
        fontSize:   textNode.fontSize() * scale + "px",
        fontFamily: textNode.fontFamily(),
        color:      "#f8f8f2",
        background: "rgba(45, 42, 46, 0.9)",
        border:     "1px solid #ae81ff",
        outline:    "none",
        resize:     "none",
        padding:    "0",
        margin:     "0",
        overflow:   "hidden",
        lineHeight: textNode.lineHeight().toString(),
        zIndex:     "100",
    });
    textarea.focus();

    var finished = false;
    function finishEdit() {
        if (finished) return;
        finished = true;
        textNode.text(textarea.value);
        textNode.show();
        textarea.remove();
        state.layer.batchDraw();
        pushHistory();
    }
    textarea.addEventListener("keydown", function (e) { if (e.key === "Escape") finishEdit(); });
    textarea.addEventListener("blur", finishEdit);
}

export function duplicateFrom(data, dx, dy) {
    if (!data) return;
    var newNode;
    if (data.type === "image") {
        var img = state.imageCache[data.src];
        if (!img) return;
        newNode = addImageNode({
            id: generateId(), x: data.x + dx, y: data.y + dy,
            width: data.width, height: data.height,
            rotation: data.rotation, src: data.src,
        }, img);
        reorderElements();
    } else if (data.type === "text") {
        newNode = createTextNode(data.x + dx, data.y + dy, data.content, data.fontSize, generateId(), data.width, data.rotation, data.fill, data.align);
    }
    if (newNode) { state.transformer.nodes([newNode]); state.layer.batchDraw(); pushHistory(); }
}

export function fitToView() {
    var nodes = [];
    state.layer.children.forEach(function (n) { if (n !== state.transformer) nodes.push(n); });

    if (nodes.length === 0) {
        state.stage.position({ x: 0, y: 0 });
        state.stage.scale({ x: 1, y: 1 });
        return;
    }

    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach(function (n) {
        var r = n.getClientRect({ relativeTo: state.layer });
        minX = Math.min(minX, r.x);   minY = Math.min(minY, r.y);
        maxX = Math.max(maxX, r.x + r.width); maxY = Math.max(maxY, r.y + r.height);
    });

    var padding = 48;
    var scale = Math.min(
        (state.stage.width()  - padding * 2) / (maxX - minX),
        (state.stage.height() - padding * 2) / (maxY - minY),
        3
    );
    state.stage.scale({ x: scale, y: scale });
    state.stage.position({
        x: state.stage.width()  / 2 - ((minX + maxX) / 2) * scale,
        y: state.stage.height() / 2 - ((minY + maxY) / 2) * scale,
    });
}

