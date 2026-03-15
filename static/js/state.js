// Shared mutable state — single object imported by all modules.
// ES module instances are singletons, so every importer sees the same reference.
export const state = {
    slug: window.location.pathname.split("/b/")[1] || null,

    // Konva canvas (set by canvas.js)
    stage:       null,
    layer:       null,
    transformer: null,

    // Board data (set by main.js on init)
    boardData:  null,
    imageCache: {},
    altPressed: false,

    // Undo/redo (managed by history.js)
    history:      [],
    historyIndex: -1,
    isRestoring:  false,
    maxHistory:   50,   // may be overwritten from /api/config

    // Paste offset counter (reset on Ctrl+C, incremented on each paste)
    pasteCount: 0,
};
