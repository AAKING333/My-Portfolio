const filterTokens = ["all", "full-stack", "data", "desktop", "cpp", "security"];
const filterTokenSet = new Set(filterTokens);

function normalizeToken(value) {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function readCategories(root) {
    const rawCategories = root.getAttribute("data-categories");

    if (typeof rawCategories !== "string" || rawCategories.trim() === "") {
        return null;
    }

    const categories = rawCategories.trim().split(/\s+/).map(normalizeToken);
    const hasInvalidToken = categories.some((category) => !filterTokenSet.has(category));
    const hasMixedAllCategory = categories.includes("all") && categories.length !== 1;

    if (hasInvalidToken || hasMixedAllCategory || categories.length === 0) {
        return null;
    }

    return categories;
}

function initializeProjects() {
    const toolbar = document.getElementById("project-filters");
    const status = document.getElementById("project-filter-status");
    const fallback = document.getElementById("project-filter-fallback");
    const projectList = document.getElementById("project-list");

    if (!toolbar || !status || !fallback || !projectList) {
        return;
    }

    const controls = Array.from(toolbar.querySelectorAll("button[data-filter]"));
    const roots = Array.from(projectList.querySelectorAll("[data-project-id]"));
    const controlTokens = controls.map((control) => normalizeToken(control.getAttribute("data-filter")));
    const validControls = controls.length === filterTokens.length
        && new Set(controlTokens).size === filterTokens.length
        && filterTokens.every((token) => controlTokens.includes(token));
    const validRoots = roots.length === 7
        && new Set(roots.map((root) => root.getAttribute("data-project-id"))).size === roots.length;

    if (!validControls || !validRoots) {
        return;
    }

    const applyFilter = (selectedToken) => {
        const normalizedSelection = filterTokenSet.has(selectedToken) ? selectedToken : "all";

        controls.forEach((control) => {
            const isSelected = normalizeToken(control.getAttribute("data-filter")) === normalizedSelection;
            control.setAttribute("aria-pressed", String(isSelected));
        });

        let visibleCount = 0;

        roots.forEach((root) => {
            const categories = readCategories(root);
            const isVisible = normalizedSelection === "all"
                || !categories
                || categories.includes(normalizedSelection);

            root.hidden = !isVisible;
            if (isVisible) {
                visibleCount += 1;
            }
        });

        const selectedControl = controls.find((control) => normalizeToken(control.getAttribute("data-filter")) === normalizedSelection);
        const selectedLabel = selectedControl ? selectedControl.textContent.trim() : normalizedSelection;

        status.textContent = visibleCount === 0
            ? `No verified projects match ${selectedLabel}.`
            : `${visibleCount} project${visibleCount === 1 ? "" : "s"} shown.`;
    };

    toolbar.hidden = false;
    fallback.hidden = true;
    toolbar.addEventListener("click", (event) => {
        const control = event.target.closest("button[data-filter]");
        if (control && controls.includes(control)) {
            applyFilter(normalizeToken(control.getAttribute("data-filter")));
        }
    });

    applyFilter("all");

    const devBoardDetails = projectList
        .querySelector('[data-project-id="devboard"] .project-details');

    if (devBoardDetails) {
        devBoardDetails.addEventListener("keydown", (event) => {
            if (event.key !== "Escape" || !devBoardDetails.open) {
                return;
            }

            event.preventDefault();
            devBoardDetails.open = false;
            const summary = devBoardDetails.querySelector("summary");
            if (summary) {
                summary.focus();
            }
        });
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeProjects, { once: true });
} else {
    initializeProjects();
}
