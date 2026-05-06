document.addEventListener("DOMContentLoaded", function () {
  const yearSpan = document.getElementById("footer-year");
  if (yearSpan) yearSpan.textContent = new Date().getFullYear();
});
