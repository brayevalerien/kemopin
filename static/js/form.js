import { state } from "./state.js";

export function initForm() {
    var createButton  = document.getElementById("create-button");
    var passwordInput = document.getElementById("password-input");
    var formSlug      = document.getElementById("form-slug");
    var formError     = document.getElementById("form-error");

    formSlug.textContent = state.slug;

    createButton.addEventListener("click", createBoard);
    passwordInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") createBoard();
    });

    async function createBoard() {
        formError.textContent = "";
        var password = passwordInput.value;
        if (!password) { formError.textContent = "Password is required"; return; }

        var response = await fetch("/api/boards", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ slug: state.slug, password }),
        });

        if (response.ok) {
            window.location.reload();
        } else {
            var data = await response.json();
            formError.textContent = data.detail || "Failed to create board";
        }
    }
}
