export function setupCategoryButtons(ajaxBaseUrl) {
  const buttons = document.querySelectorAll(".category-btn");
  const form = document.getElementById("create-form") || document.getElementById("edit-form");
  const categoryInput = document.getElementById("selected-category");
  const artistSelect = document.getElementById("artist");

  if (form && categoryInput) {
    buttons.forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();

        const selectedCategory = btn.dataset.category;
        categoryInput.value = selectedCategory;

        if (selectedCategory === "split" && artistSelect && artistSelect.value) {
          console.log("✅ split 카테고리 AJAX 먼저 요청!");

          const url = new URL(`${ajaxBaseUrl}/load_split_members_and_prices/`, window.location.origin);
          url.searchParams.set("artist_id", artistSelect.value);

          fetch(url)
            .then(resp => {
              if (!resp.ok) throw new Error("네트워크 오류");
              return resp.json();
            })
            .then(data => {
              console.log("✅ split 버튼 클릭 후 AJAX 응답:", data);

              // ✅ split 전환 시 member-wrapper를 비워두기 (hidden input 제거)
              const memberWrapper = document.getElementById("member-wrapper");
              if (memberWrapper) {
                memberWrapper.innerHTML = "";  // hidden input 안 넣음!
              } else {
                console.warn("⚠️ member-wrapper div가 페이지에 없습니다.");
              }

              // ✅ splitprice-formset-wrapper에 formset_html 삽입
              const splitFormsetContainer = document.getElementById("splitprice-formset-wrapper");
              if (splitFormsetContainer) {
                splitFormsetContainer.innerHTML = data.formset_html;
                splitFormsetContainer.classList.remove("hidden");
              } else {
                console.warn("⚠️ splitprice-formset-wrapper div가 페이지에 없습니다!");
              }

              // ✅ split 카테고리 전환 시 selectedMemberIds를 빈 리스트로 초기화
              window.selectedMemberIds = [];

              // ✅ split 전환 후 form 자동 제출
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
