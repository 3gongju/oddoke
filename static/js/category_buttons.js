export function setupCategoryButtons(ajaxBaseUrl) {
  const buttons = document.querySelectorAll(".category-btn");
  const form = document.getElementById("create-form") || document.getElementById("edit-form");
  const categoryInput = document.getElementById("selected-category");
  const artistSelect = document.getElementById("artist");

  if (form && categoryInput) {
    buttons.forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();  // ✅ form.submit() 기본 동작 막기!

        const selectedCategory = btn.dataset.category;
        categoryInput.value = selectedCategory;

        if (selectedCategory === "split" && artistSelect && artistSelect.value) {
          console.log("✅ split 카테고리 AJAX 먼저 요청!");

          const url = new URL(`${ajaxBaseUrl}/load_split_members_and_prices/`, window.location.origin);
          url.searchParams.set("artist_id", artistSelect.value);

          fetch(url)
            .then(resp => resp.json())
            .then(data => {
              console.log("✅ split 버튼 클릭 후 AJAX 응답:", data);

              let html = "";
              data.members.forEach(m => {
                html += `<input type="hidden" name="members" value="${m.id}">`;
              });
              document.getElementById("member-wrapper").innerHTML = html;

              const splitFormsetContainer = document.getElementById("splitprice-formset-wrapper");
              splitFormsetContainer.innerHTML = data.formset_html;
              splitFormsetContainer.classList.remove("hidden");

              // ✅ AJAX로 split 멤버/가격 로드 후, form을 다시 제출!
              form.submit();
            })
            .catch(err => {
              console.error("❌ split AJAX 실패:", err);
              alert("split 데이터를 불러오지 못했습니다. 다시 시도해주세요.");
            });
        } else {
          // ✅ split이 아니면 바로 form 제출
          form.submit();
        }
      });
    });
  }
}
