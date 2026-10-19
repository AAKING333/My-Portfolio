// Hero typing
const documentRoot = document.documentElement;
documentRoot.classList.add("js");

const rotatingText = document.getElementById("typing-text");
const cursor = document.getElementById("cursor");
const heroParagraph = document.querySelector("#hero p");
const typingPhrases = [
    "Software Developer",
    "Full-Stack Web Developer",
    "Python & Flask Developer",
    "Building Data-Driven Applications",
    "Developing Secure Web Applications"
];

if (rotatingText) {
    rotatingText.setAttribute("aria-hidden", "true");
}

if (cursor) {
    cursor.setAttribute("aria-hidden", "true");
}

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let typingTimer = null;
let typingInitialized = false;

function leaveStaticHero() {
    if (rotatingText) {
        rotatingText.textContent = typingPhrases[0];
    }

    if (heroParagraph) {
        heroParagraph.classList.add("reveal");
    }
}

function scheduleTyping(callback, delay) {
    if (typingTimer !== null) {
        window.clearTimeout(typingTimer);
    }

    typingTimer = window.setTimeout(callback, delay);
}

function startTyping() {
    if (typingInitialized) {
        return;
    }

    typingInitialized = true;

    if (!rotatingText || !cursor || !heroParagraph || prefersReducedMotion) {
        leaveStaticHero();
        return;
    }

    let phraseIndex = 0;
    let characterIndex = 0;
    let deleting = false;

    rotatingText.textContent = "";

    const typeNextCharacter = () => {
        typingTimer = null;
        const phrase = typingPhrases[phraseIndex];

        if (deleting) {
            characterIndex -= 1;
            rotatingText.textContent = phrase.slice(0, characterIndex);

            if (characterIndex === 0) {
                phraseIndex = (phraseIndex + 1) % typingPhrases.length;
                deleting = false;
                scheduleTyping(typeNextCharacter, 260);
                return;
            }

            scheduleTyping(typeNextCharacter, 45);
            return;
        }

        characterIndex += 1;
        rotatingText.textContent = phrase.slice(0, characterIndex);

        if (characterIndex === phrase.length) {
            heroParagraph.classList.add("reveal");
            deleting = true;
            scheduleTyping(typeNextCharacter, 1100);
            return;
        }

        scheduleTyping(typeNextCharacter, 75);
    };

    scheduleTyping(typeNextCharacter, 220);
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startTyping, { once: true });
} else {
    startTyping();
}

if (import.meta.hot) {
    import.meta.hot.dispose(() => {
        if (typingTimer !== null) {
            window.clearTimeout(typingTimer);
            typingTimer = null;
        }
    });
}

// Accessible mobile navigation
const hamburger = document.getElementById("hamburger");
const navUl = document.getElementById("primary-navigation");
const navLinks = navUl ? navUl.querySelectorAll("a") : [];
const mobileNavigation = window.matchMedia("(max-width: 768px)");

if (hamburger && navUl) {
    const setDesktopState = () => {
        hamburger.classList.remove("active");
        navUl.classList.remove("active");
        hamburger.setAttribute("aria-expanded", "false");
        hamburger.setAttribute("aria-label", "Open navigation menu");
        navUl.inert = false;
        navUl.removeAttribute("aria-hidden");
    };

    const setMobileState = (isOpen) => {
        hamburger.classList.toggle("active", isOpen);
        navUl.classList.toggle("active", isOpen);
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

// Motion and navigation foundation -----------------------------------------
const foundationCleanup = [];
const revealTargets = Array.from(document.querySelectorAll("[data-reveal]"));
let revealObserver = null;

if (revealTargets.length) {
    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
        revealTargets.forEach((target) => target.classList.add("revealed"));
    } else {
        revealTargets.forEach((target, index) => {
            target.classList.add("reveal-ready");
            target.style.setProperty("--reveal-delay", `${Math.min(index % 6, 5) * 45}ms`);
        });

        revealObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) {
                    return;
                }

                entry.target.classList.remove("reveal-ready");
                entry.target.classList.add("revealed");
                revealObserver.unobserve(entry.target);
            });
        }, { threshold: 0.12, rootMargin: "0px 0px -6%" });

        revealTargets.forEach((target) => revealObserver.observe(target));
        foundationCleanup.push(() => revealObserver.disconnect());
    }
}

const sectionNodes = Array.from(document.querySelectorAll("[data-nav-section]"));
const sectionLinks = Array.from(document.querySelectorAll("[data-nav-link]"));
let activeSectionObserver = null;

if (sectionNodes.length && sectionLinks.length) {
    const setActiveSection = (id) => {
        sectionLinks.forEach((link) => {
            const isActive = link.getAttribute("href") === `#${id}`;
            link.classList.toggle("is-active", isActive);
            if (isActive) {
                link.setAttribute("aria-current", "page");
            } else {
                link.removeAttribute("aria-current");
            }
        });
    };

    setActiveSection("hero");

    if ("IntersectionObserver" in window) {
        const ratios = new Map(sectionNodes.map((section) => [section, 0]));
        activeSectionObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                ratios.set(entry.target, entry.isIntersecting ? entry.intersectionRatio : 0);
            });

            let mostVisible = null;
            let highestRatio = 0;
            ratios.forEach((ratio, section) => {
                if (ratio > highestRatio) {
                    highestRatio = ratio;
                    mostVisible = section;
                }
            });

            if (mostVisible) {
                setActiveSection(mostVisible.id);
            }
        }, {
            threshold: [0, 0.25, 0.5, 0.75, 1],
            rootMargin: "-20% 0px -55%"
        });

        sectionNodes.forEach((section) => activeSectionObserver.observe(section));
        foundationCleanup.push(() => activeSectionObserver.disconnect());
    }
}

const siteHeader = document.querySelector("[data-site-header]");
const topControl = document.getElementById("up");
const updateScrollState = () => {
    const isScrolled = window.scrollY > 24;
    documentRoot.classList.toggle("has-scrolled", isScrolled);
    if (siteHeader) {
        siteHeader.classList.toggle("is-scrolled", isScrolled);
    }
    if (topControl) {
        topControl.tabIndex = isScrolled ? 0 : -1;
    }
};

updateScrollState();
window.addEventListener("scroll", updateScrollState, { passive: true });
foundationCleanup.push(() => window.removeEventListener("scroll", updateScrollState));

const finePointerQuery = window.matchMedia("(pointer: fine)");
const updatePointerMode = () => {
    documentRoot.classList.toggle("fine-pointer", finePointerQuery.matches);
};
let teardownProjectTilt = () => {};
const projectSurfaces = Array.from(document.querySelectorAll("[data-project-id]"));
const projectTiltLimit = 1.35;

function setupProjectTilt() {
    teardownProjectTilt();
    teardownProjectTilt = () => {};

    if (prefersReducedMotion || !finePointerQuery.matches || !projectSurfaces.length) {
        return;
    }

    const cleanups = [];
    const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

    projectSurfaces.forEach((surface) => {
        const resetSurface = () => {
            surface.classList.remove("project-tilt-active");
            surface.style.removeProperty("--project-pointer-x");
            surface.style.removeProperty("--project-pointer-y");
            surface.style.removeProperty("--project-tilt-x");
            surface.style.removeProperty("--project-tilt-y");
        };

        const updateSurface = (event) => {
            const bounds = surface.getBoundingClientRect();
            const x = clamp((event.clientX - bounds.left) / bounds.width, 0, 1);
            const y = clamp((event.clientY - bounds.top) / bounds.height, 0, 1);
            const tiltX = (0.5 - y) * projectTiltLimit;
            const tiltY = (x - 0.5) * projectTiltLimit;

            surface.classList.add("project-tilt-active");
            surface.style.setProperty("--project-pointer-x", `${x * 100}%`);
            surface.style.setProperty("--project-pointer-y", `${y * 100}%`);
            surface.style.setProperty("--project-tilt-x", `${tiltX.toFixed(2)}deg`);
            surface.style.setProperty("--project-tilt-y", `${tiltY.toFixed(2)}deg`);
        };

        surface.addEventListener("pointermove", updateSurface, { passive: true });
        surface.addEventListener("pointerleave", resetSurface, { passive: true });
        surface.addEventListener("pointercancel", resetSurface, { passive: true });
        cleanups.push(() => {
            surface.removeEventListener("pointermove", updateSurface);
            surface.removeEventListener("pointerleave", resetSurface);
            surface.removeEventListener("pointercancel", resetSurface);
            resetSurface();
        });
    });

    teardownProjectTilt = () => cleanups.forEach((cleanup) => cleanup());
}

const onPointerModeChange = () => {
    updatePointerMode();
    setupProjectTilt();
};

updatePointerMode();
setupProjectTilt();
if (typeof finePointerQuery.addEventListener === "function") {
    finePointerQuery.addEventListener("change", onPointerModeChange);
    foundationCleanup.push(() => finePointerQuery.removeEventListener("change", onPointerModeChange));
} else {
    finePointerQuery.addListener(onPointerModeChange);
    foundationCleanup.push(() => finePointerQuery.removeListener(onPointerModeChange));
}

foundationCleanup.push(() => teardownProjectTilt());

if (import.meta.hot) {
    import.meta.hot.dispose(() => {
        foundationCleanup.forEach((cleanup) => cleanup());
    });
}
