import { state } from "./state.js";

export function serializeElement(node) {
    if (node === state.transformer) return null;
    if (node instanceof Konva.Image) {
        return {
            id: node.id(), type: "image",
            x: node.x(), y: node.y(),
            width:  node.width()  * node.scaleX(),
            height: node.height() * node.scaleY(),
            rotation: node.rotation(),
            src: node.getAttr("src"),
        };
    }
    if (node instanceof Konva.Text) {
        return {
            id: node.id(), type: "text",
            x: node.x(), y: node.y(),
            width:    node.width() * node.scaleX(),
            rotation: node.rotation(),
            content:  node.text(),
            fontSize: Math.round(node.fontSize() * node.scaleY()),
            fill:  node.fill(),
            align: node.align(),
        };
    }
    return null;
}

export function serializeElements() {
    var elements = [];
    state.layer.children.forEach(function (node) {
        var el = serializeElement(node);
        if (el) elements.push(el);
    });
    return elements;
}
