
const toggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.mobile-nav');
const closeBtn = document.querySelector('.close-menu');

toggle.addEventListener('click', () => {
  nav.classList.add('active');
});

closeBtn.addEventListener('click', () => {
  nav.classList.remove('active');
});
