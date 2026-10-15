
// Typing Animations
const textToType = "Welcome To My Portfolio";
const containerElement = document.getElementById("txtContainer");
const textElement = document.getElementById("cursor");
const para = document.querySelector("#hero p"); 

let index = 0;

function typeEffect() {
    if (index < textToType.length) {
        textElement.insertAdjacentText('beforebegin', textToType.charAt(index));
        index++;
        setTimeout(typeEffect, Math.random() * 100 + 50);
    }else {
        para.classList.add("reveal");
    }
}
window.onload = typeEffect;



// HamBurger Functionality
const hamburger = document.getElementById('hamburger');
const navUl = document.querySelector('nav ul');
const navLinks = document.querySelectorAll('nav a');

hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    navUl.classList.toggle('active');
});

navLinks.forEach(link => {
    link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        navUl.classList.remove('active');
    });
});


// Typing Animations
// const typingText = document.getElementById('typing-text');
// const cursor = document.getElementById('cursor');
// const fullText = "Welcome To My Portfolio";
// let index = 0;

// function type() {
//     if (index < fullText.length) {
//         const span = document.createElement('span');
//         span.textContent = fullText[index];
//         typingText.insertBefore(span, cursor);
//         index++;
//         setTimeout(type, 100);
//     }
// }

// window.addEventListener('load', () => {
//     setTimeout(type, 500);
    
//     // Reveals the paragraph...
//     const heroParagraph = document.querySelector('#hero p');
//     if (heroParagraph) {
//         heroParagraph.classList.add('reveal');
//     }
// });






