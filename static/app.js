(function () {
    "use strict";

    const slug = window.location.pathname.split("/b/")[1];
    if (!slug) return;

    const boardUi = document.getElementById("board-ui");
    const createForm = document.getElementById("create-form");
    const formSlug = document.getElementById("form-slug");
    const passwordInput = document.getElementById("password-input");
    const createButton = document.getElementById("create-button");
    const formError = document.getElementById("form-error");
    const saveButton = document.getElementById("save-button");
    const boardSizeLabel = document.getElementById("board-size");

    let stage, layer, transformer;
    let boardData = null;

    // Fetch board or show creation form
    async function init() {
        const response = await fetch(`/api/boards/${slug}`);
        if (response.ok) {
            boardData = await response.json();
            boardUi.style.display = "";
            createForm.style.display = "none";
            setupCanvas();
            loadElements();
            updateBoardSize();
        } else {
            boardUi.style.display = "none";
            createForm.style.display = "";
            formSlug.textContent = slug;
        }
    }

    // Board creation
    createButton.addEventListener("click", createBoard);
    passwordInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") createBoard();
    });

    async function createBoard() {
        formError.textContent = "";
        const password = passwordInput.value;
        if (!password) {
            formError.textContent = "Password is required";
            return;
        }

        const response = await fetch("/api/boards", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ slug: slug, password: password }),
        });

        if (response.ok) {
            window.location.reload();
        } else {
            const data = await response.json();
            formError.textContent = data.detail || "Failed to create board";
        }
    }

    // Canvas setup
    function setupCanvas() {
        const container = document.getElementById("canvas-container");

        stage = new Konva.Stage({
            container: container,
            width: window.innerWidth,
            height: window.innerHeight,
            draggable: true,
        });

        layer = new Konva.Layer();
        stage.add(layer);

        transformer = new Konva.Transformer({
            borderStroke: "#ae81ff",
            anchorStroke: "#ae81ff",
            anchorFill: "#2d2a2e",
            anchorSize: 8,
            rotateEnabled: true,
            keepRatio: true,
            rotationSnaps: [0, 90, 180, 270],
            rotationSnapTolerance: 15,
        });
        layer.add(transformer);

        // Normalize text scale into fontSize/width after transform
        transformer.on("transformend", function () {
            var node = transformer.nodes()[0];
            if (node instanceof Konva.Text) {
                var newFontSize = Math.round(node.fontSize() * node.scaleY());
                var newWidth = node.width() * node.scaleX();
                node.fontSize(newFontSize);
                node.width(newWidth);
                node.scaleX(1);
                node.scaleY(1);
                layer.batchDraw();
            }
        });

        if (boardData.canvas) {
            stage.position({
                x: boardData.canvas.x || 0,
                y: boardData.canvas.y || 0,
            });
            stage.scale({
                x: boardData.canvas.scaleX || 1,
                y: boardData.canvas.scaleY || 1,
            });
        }

        // Zoom toward cursor
        stage.on("wheel", function (event) {
            event.evt.preventDefault();
            const oldScale = stage.scaleX();
            const pointer = stage.getPointerPosition();
            const direction = event.evt.deltaY > 0 ? -1 : 1;
            const factor = 1.08;
            const newScale =
                direction > 0 ? oldScale * factor : oldScale / factor;
            const clampedScale = Math.max(0.05, Math.min(10, newScale));

            const mousePointTo = {
                x: (pointer.x - stage.x()) / oldScale,
                y: (pointer.y - stage.y()) / oldScale,
            };

            stage.scale({ x: clampedScale, y: clampedScale });
            stage.position({
                x: pointer.x - mousePointTo.x * clampedScale,
                y: pointer.y - mousePointTo.y * clampedScale,
            });
        });

        // Click on empty space to deselect
        stage.on("click tap", function (event) {
            if (event.target === stage) {
                transformer.nodes([]);
            }
        });

        // Double click on empty space to create text
        stage.on("dblclick dbltap", function (event) {
            if (event.target !== stage) return;
            const pointer = stage.getRelativePointerPosition();
            createTextNode(pointer.x, pointer.y, "", 16);
        });

        window.addEventListener("keydown", function (event) {
            if (document.activeElement.tagName === "TEXTAREA") return;
            if (document.activeElement.tagName === "INPUT") return;

            var nodes = transformer.nodes();
            var selectedNode = nodes.length > 0 ? nodes[0] : null;

            // Delete selected element
            if (event.key === "Delete" || event.key === "Backspace") {
                if (nodes.length > 0) {
                    nodes.forEach(function (node) {
                        node.destroy();
                    });
                    transformer.nodes([]);
                    layer.batchDraw();
                }
                return;
            }

            // O key opens file picker
            if (event.key === "o") {
                openFilePicker();
                return;
            }

            // Text color cycling with C key
            if (event.key === "c" && selectedNode instanceof Konva.Text) {
                var currentColor = selectedNode.fill();
                var colorIndex = TEXT_COLORS.indexOf(currentColor);
                var nextIndex = (colorIndex + 1) % TEXT_COLORS.length;
                selectedNode.fill(TEXT_COLORS[nextIndex]);
                layer.batchDraw();
                return;
            }

            // Text alignment cycling with A key
            if (event.key === "a" && selectedNode instanceof Konva.Text) {
                var currentAlign = selectedNode.align();
                var aligns = ["left", "center", "right"];
                var alignIndex = aligns.indexOf(currentAlign);
                var nextAlign = aligns[(alignIndex + 1) % aligns.length];
                selectedNode.align(nextAlign);
                layer.batchDraw();
                return;
            }
        });

        // Paste images from clipboard
        window.addEventListener("paste", function (event) {
            const items = event.clipboardData.items;
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf("image") !== -1) {
                    const file = items[i].getAsFile();
                    uploadAndAddImage(file);
                }
            }
        });

        // Drag and drop files (capture phase to beat Konva)
        var stageContent = stage.container();
        stageContent.addEventListener("dragover", function (event) {
            event.preventDefault();
        }, true);

        stageContent.addEventListener("dragenter", function (event) {
            event.preventDefault();
        }, true);

        stageContent.addEventListener("drop", function (event) {
            event.preventDefault();
            var files = event.dataTransfer.files;
            if (files.length > 0) {
                for (var i = 0; i < files.length; i++) {
                    if (files[i].type.indexOf("image") !== -1) {
                        uploadAndAddImage(files[i]);
                    }
                }
            } else {
                // Handle URIs from editors like VSCode
                var uriList = event.dataTransfer.getData("text/uri-list");
                if (uriList) {
                    uriList.split("\n").forEach(function (uri) {
                        uri = uri.trim();
                        if (uri && !uri.startsWith("#")) {
                            fetchAndUploadFromUrl(uri);
                        }
                    });
                }
            }
        }, true);

        // Middle click pans the canvas
        var midPanning = false;
        var midLastPos = null;

        container.addEventListener("mousedown", function (event) {
            if (event.button === 1) {
                event.preventDefault();
                midPanning = true;
                midLastPos = { x: event.clientX, y: event.clientY };
            }
        });

        window.addEventListener("mousemove", function (event) {
            if (!midPanning) return;
            var dx = event.clientX - midLastPos.x;
            var dy = event.clientY - midLastPos.y;
            stage.position({ x: stage.x() + dx, y: stage.y() + dy });
            midLastPos = { x: event.clientX, y: event.clientY };
        });

        window.addEventListener("mouseup", function (event) {
            if (event.button === 1) {
                midPanning = false;
                midLastPos = null;
            }
        });

        // Resize stage on window resize
        window.addEventListener("resize", function () {
            stage.width(window.innerWidth);
            stage.height(window.innerHeight);
        });
    }

    // Load board elements onto canvas
    function loadElements() {
        if (!boardData.elements) return;

        boardData.elements.forEach(function (element) {
            if (element.type === "image") {
                loadImageElement(element);
            } else if (element.type === "text") {
                createTextNode(
                    element.x,
                    element.y,
                    element.content,
                    element.fontSize || 16,
                    element.id,
                    element.width,
                    element.rotation,
                    element.fill || "#f8f8f2",
                    element.align || "left"
                );
            }
        });
    }

    function loadImageElement(element) {
        const imageObject = new Image();
        imageObject.onload = function () {
            const node = new Konva.Image({
                id: element.id,
                x: element.x,
                y: element.y,
                image: imageObject,
                width: element.width,
                height: element.height,
                rotation: element.rotation || 0,
                draggable: true,
            });

            node.setAttr("src", element.src);
            makeSelectable(node);
            layer.add(node);
            reorderElements();
            layer.batchDraw();
        };
        imageObject.src = element.src;
    }

    function openFilePicker() {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.multiple = true;
        input.addEventListener("change", function () {
            for (let i = 0; i < input.files.length; i++) {
                uploadAndAddImage(input.files[i]);
            }
        });
        input.click();
    }

    async function fetchAndUploadFromUrl(url) {
        try {
            var response = await fetch(url);
            if (!response.ok) return;
            var blob = await response.blob();
            if (!blob.type.startsWith("image/")) return;
            var file = new File([blob], "dropped.jpg", { type: blob.type });
            uploadAndAddImage(file);
        } catch (error) {
            // Silently ignore fetch failures (CORS, etc.)
        }
    }

    // Upload image to server and add to canvas
    async function uploadAndAddImage(file) {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch(`/api/boards/${slug}/assets`, {
            method: "POST",
            body: formData,
        });

        if (!response.ok) {
            const data = await response.json();
            toast("error", data.detail || "Upload failed");
            return;
        }

        const result = await response.json();
        const imageObject = new Image();
        imageObject.onload = function () {
            const viewWidth = stage.width() / stage.scaleX();
            const viewHeight = stage.height() / stage.scaleY();
            const maxWidth = viewWidth * 0.8;
            const maxHeight = viewHeight * 0.8;
            const naturalWidth = imageObject.naturalWidth;
            const naturalHeight = imageObject.naturalHeight;
            const scale = Math.min(maxWidth / naturalWidth, maxHeight / naturalHeight);
            const displayWidth = naturalWidth * scale;
            const displayHeight = naturalHeight * scale;

            const centerX = -stage.x() / stage.scaleX() + viewWidth / 2 - displayWidth / 2;
            const centerY = -stage.y() / stage.scaleY() + viewHeight / 2 - displayHeight / 2;

            const node = new Konva.Image({
                id: generateId(),
                x: centerX,
                y: centerY,
                image: imageObject,
                width: displayWidth,
                height: displayHeight,
                draggable: true,
            });

            node.setAttr("src", result.url);
            makeSelectable(node);
            layer.add(node);
            transformer.nodes([node]);
            reorderElements();
            layer.batchDraw();
            updateBoardSize();
        };
        imageObject.src = result.url;
    }

    // Text nodes
    // Monokai color palette for text
    const TEXT_COLORS = [
        "#f8f8f2",
        "#ae81ff",
        "#a6e22e",
        "#f92672",
        "#66d9ef",
        "#e6db74",
        "#fd971f",
        "#272822",
    ];

    function createTextNode(
        x,
        y,
        content,
        fontSize,
        id,
        width,
        rotation,
        fill,
        align
    ) {
        const textNode = new Konva.Text({
            id: id || generateId(),
            x: x,
            y: y,
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

        textNode.on("dblclick dbltap", function () {
            editTextNode(textNode);
        });

        layer.add(textNode);
        reorderElements();
        layer.batchDraw();

        // Start editing immediately if new empty node
        if (!content) {
            editTextNode(textNode);
        }

        return textNode;
    }

    function editTextNode(textNode) {
        textNode.hide();
        transformer.nodes([]);

        const textPosition = textNode.absolutePosition();
        const stageBox = stage.container().getBoundingClientRect();

        const textarea = document.createElement("textarea");
        document.body.appendChild(textarea);

        const scale = stage.scaleX();

        textarea.value = textNode.text();
        textarea.style.position = "absolute";
        textarea.style.top = stageBox.top + textPosition.y + "px";
        textarea.style.left = stageBox.left + textPosition.x + "px";
        textarea.style.width = textNode.width() * scale + "px";
        textarea.style.minHeight = textNode.height() * scale + "px";
        textarea.style.fontSize = textNode.fontSize() * scale + "px";
        textarea.style.fontFamily = textNode.fontFamily();
        textarea.style.color = "#f8f8f2";
        textarea.style.background = "rgba(45, 42, 46, 0.9)";
        textarea.style.border = "1px solid #ae81ff";
        textarea.style.outline = "none";
        textarea.style.resize = "none";
        textarea.style.padding = "0";
        textarea.style.margin = "0";
        textarea.style.overflow = "hidden";
        textarea.style.lineHeight = textNode.lineHeight().toString();
        textarea.style.zIndex = "100";

        textarea.focus();

        textarea.addEventListener("keydown", function (event) {
            if (event.key === "Escape") {
                finishEdit();
            }
        });

        textarea.addEventListener("blur", finishEdit);

        function finishEdit() {
            textNode.text(textarea.value);
            textNode.show();
            textarea.remove();
            layer.batchDraw();
        }
    }

    // Keep text above images, transformer always on top
    function reorderElements() {
        var texts = [];
        layer.children.forEach(function (node) {
            if (node instanceof Konva.Text) {
                texts.push(node);
            }
        });
        texts.forEach(function (node) {
            node.moveToTop();
        });
        transformer.moveToTop();
    }

    // Make a node selectable via transformer
    function makeSelectable(node) {
        node.on("click tap", function (event) {
            event.cancelBubble = true;
            transformer.nodes([node]);
            layer.batchDraw();
        });
    }

    // Save board state
    saveButton.addEventListener("click", async function () {
        const elements = [];

        layer.children.forEach(function (node) {
            if (node === transformer) return;

            if (node instanceof Konva.Image) {
                elements.push({
                    id: node.id(),
                    type: "image",
                    x: node.x(),
                    y: node.y(),
                    width: node.width() * node.scaleX(),
                    height: node.height() * node.scaleY(),
                    rotation: node.rotation(),
                    src: node.getAttr("src"),
                });
            } else if (node instanceof Konva.Text) {
                elements.push({
                    id: node.id(),
                    type: "text",
                    x: node.x(),
                    y: node.y(),
                    width: node.width() * node.scaleX(),
                    rotation: node.rotation(),
                    content: node.text(),
                    fontSize: Math.round(node.fontSize() * node.scaleY()),
                    fill: node.fill(),
                    align: node.align(),
                });
            }
        });

        const payload = {
            slug: slug,
            canvas: {
                x: stage.x(),
                y: stage.y(),
                scaleX: stage.scaleX(),
                scaleY: stage.scaleY(),
            },
            elements: elements,
        };

        const response = await fetch(`/api/boards/${slug}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (response.ok) {
            saveButton.textContent = "Saved";
            setTimeout(function () {
                saveButton.textContent = "Save";
            }, 1500);
        } else {
            saveButton.textContent = "Error";
            setTimeout(function () {
                saveButton.textContent = "Save";
            }, 1500);
        }
    });

    // Board size indicator
    async function updateBoardSize() {
        const response = await fetch(`/api/boards/${slug}/size`);
        if (!response.ok) return;
        const data = await response.json();
        const sizeMb = (data.size_bytes / 1024 / 1024).toFixed(1);
        const maxMb = (data.max_bytes / 1024 / 1024).toFixed(0);
        boardSizeLabel.textContent = sizeMb + " MB / " + maxMb + " MB";
    }

    // Toast notifications
    var toastContainer = document.getElementById("toast-container");

    function toast(level, message) {
        var el = document.createElement("div");
        el.className = "toast toast-" + level;
        el.textContent = message;
        toastContainer.appendChild(el);

        setTimeout(function () {
            el.classList.add("toast-show");
        }, 16);

        setTimeout(function () {
            el.classList.remove("toast-show");
            el.addEventListener("transitionend", function () { el.remove(); });
        }, 3000);
    }
    window.toast = toast;

    function generateId() {
        return (
            Math.random().toString(36).substring(2, 10) +
            Math.random().toString(36).substring(2, 10)
        );
    }

    init();
})();
