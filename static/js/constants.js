export const GRID_SIZE      = 20;
export function snapToGrid(val) { return Math.round(val / GRID_SIZE) * GRID_SIZE; }
export const AUTOSAVE_DELAY = 30000;

export const TEXT_COLORS = [
    "#f8f8f2", "#ae81ff", "#a6e22e", "#f92672",
    "#66d9ef", "#e6db74", "#fd971f", "#272822",
];

// Shortcuts data — edit here to keep overlay in sync
export const SHORTCUTS = [
    [
        { key: "double-click",  desc: "add text" },
        { key: "O",             desc: "upload image" },
        { key: "paste",         desc: "add image" },
        { key: "drag & drop",   desc: "add image" },
        { key: "scroll",        desc: "zoom" },
        { key: "middle drag",   desc: "pan" },
        { key: "Alt + drag",    desc: "free placement" },
        { key: "Alt + rotate",  desc: "free rotation" },
        { key: "Del",           desc: "delete selected" },
        { key: "C",             desc: "cycle text color" },
        { key: "A",             desc: "cycle text align" },
    ],
    [
        { key: "Ctrl C", desc: "copy selected" },
        { key: "Ctrl V", desc: "paste" },
        { key: "Ctrl D", desc: "duplicate" },
        { key: "Ctrl S", desc: "save" },
        { key: "Ctrl Z", desc: "undo" },
        { key: "Ctrl Y", desc: "redo" },
        { key: "Ctrl ↑", desc: "bring forward" },
        { key: "Ctrl ↓", desc: "send backward" },
        { key: "F",      desc: "fit all in view" },
        { key: "H",      desc: "shortcuts" },
    ],
];
