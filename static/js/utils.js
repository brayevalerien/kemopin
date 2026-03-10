export function generateId() {
    return Math.random().toString(36).substring(2, 10) +
           Math.random().toString(36).substring(2, 10);
}

export function toast(level, message) {
    var container = document.getElementById("toast-container");
    var el = document.createElement("div");
    el.className = "toast toast-" + level;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(function () { el.classList.add("toast-show"); }, 16);
    setTimeout(function () {
        el.classList.remove("toast-show");
        el.addEventListener("transitionend", function () { el.remove(); });
    }, 3000);
}
