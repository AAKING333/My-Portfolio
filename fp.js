// Hero typing
const rotatingText = document.getElementById("typing-text");
const cursor = document.getElementById("cursor");
const heroParagraph = document.querySelector("#hero p");
const typingPhrases = [
    "Software Developer",
    "Full-stack Python Builder",
    "Data & Automation Enthusiast",
    "Cybersecurity Learner"
];

if (rotatingText) {
    rotatingText.setAttribute("aria-hidden", "true");
}

if (cursor) {
    cursor.setAttribute("aria-hidden", "true");
}

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let typingTimer = null;

function leaveStaticHero() {
    if (rotatingText) {
        rotatingText.textContent = typingPhrases[0];
    }

    if (heroParagraph) {
        heroParagraph.classList.add("reveal");
    }
}

function startTyping() {
    if (!rotatingText || !cursor || !heroParagraph || prefersReducedMotion) {
        leaveStaticHero();
        return;
    }

    let phraseIndex = 0;
    let characterIndex = 0;
    let deleting = false;

    rotatingText.textContent = "";

    const typeNextCharacter = () => {
        const phrase = typingPhrases[phraseIndex];

        if (deleting) {
            characterIndex -= 1;
            rotatingText.textContent = phrase.slice(0, characterIndex);

            if (characterIndex === 0) {
                phraseIndex += 1;
                deleting = false;

                if (phraseIndex >= typingPhrases.length) {
                    rotatingText.textContent = typingPhrases[0];
                    heroParagraph.classList.add("reveal");
                    typingTimer = null;
                    return;
                }

                typingTimer = window.setTimeout(typeNextCharacter, 260);
                return;
            }

            typingTimer = window.setTimeout(typeNextCharacter, 45);
            return;
        }

        characterIndex += 1;
        rotatingText.textContent = phrase.slice(0, characterIndex);

        if (characterIndex === phrase.length) {
            heroParagraph.classList.add("reveal");

            if (phraseIndex === typingPhrases.length - 1) {
                typingTimer = null;
                return;
            }

            deleting = true;
            typingTimer = window.setTimeout(typeNextCharacter, 1100);
            return;
        }

        typingTimer = window.setTimeout(typeNextCharacter, 75);
    };

    typingTimer = window.setTimeout(typeNextCharacter, 220);
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startTyping, { once: true });
} else {
    startTyping();
}

// Accessible mobile navigation
const hamburger = document.getElementById("hamburger");
const navUl = document.getElementById("primary-navigation");
const navLinks = navUl ? navUl.querySelectorAll("a") : [];
const mobileNavigation = window.matchMedia("(max-width: 768px)");

if (hamburger && navUl) {
    const setDesktopState = () => {
        hamburger.classList.remove("active");
        hamburger.setAttribute("aria-expanded", "false");
        hamburger.setAttribute("aria-label", "Open navigation menu");
        navUl.inert = false;
        navUl.removeAttribute("aria-hidden");
    };

    const setMobileState = (isOpen) => {
        hamburger.classList.toggle("active", isOpen);
        hamburger.setAttribute("aria-expanded", String(isOpen));
        hamburger.setAttribute("aria-label", isOpen ? "Close navigation menu" : "Open navigation menu");
        navUl.inert = !isOpen;
        navUl.setAttribute("aria-hidden", String(!isOpen));
    };

    const applyNavigationState = () => {
        if (mobileNavigation.matches) {
            setMobileState(false);
        } else {
            setDesktopState();
        }
    };

    const focusDestination = (link) => {
        const destinationId = link.getAttribute("href");
        const destination = destinationId && destinationId.startsWith("#")
            ? document.getElementById(destinationId.slice(1))
            : null;

        if (destination) {
            destination.setAttribute("tabindex", "-1");
            window.requestAnimationFrame(() => destination.focus({ preventScroll: true }));
        } else {
            hamburger.focus();
        }
    };

    const closeNavigation = (restoreFocus, destinationLink) => {
        setMobileState(false);

        if (destinationLink) {
            focusDestination(destinationLink);
        } else if (restoreFocus) {
            hamburger.focus();
        }
    };

    hamburger.addEventListener("click", () => {
        if (!mobileNavigation.matches) {
            return;
        }

        const isOpen = hamburger.getAttribute("aria-expanded") === "true";
        if (isOpen) {
            closeNavigation(true);
        } else {
            setMobileState(true);
        }
    });

    navLinks.forEach((link) => {
        link.addEventListener("click", () => {
            if (mobileNavigation.matches) {
                closeNavigation(false, link);
            } else {
                focusDestination(link);
            }
        });
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && mobileNavigation.matches && hamburger.getAttribute("aria-expanded") === "true") {
            event.preventDefault();
            closeNavigation(true);
        }
    });

    const handleMediaChange = () => {
        applyNavigationState();
    };

    if (typeof mobileNavigation.addEventListener === "function") {
        mobileNavigation.addEventListener("change", handleMediaChange);
    } else {
        mobileNavigation.addListener(handleMediaChange);
    }

    applyNavigationState();
}
