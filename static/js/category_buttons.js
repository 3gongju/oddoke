export function setupCategoryButtons() {
  const buttons = document.querySelectorAll(".category-btn");
  const form = document.getElementById("create-form") || document.getElementById("edit-form");
  const categoryInput = document.getElementById("selected-category");

  if (form && categoryInput) {
    buttons.forEach(btn => {
      btn.addEventListener("click", () => {
        categoryInput.value = btn.dataset.category;
        form.submit();
      });
    });
  }
}
