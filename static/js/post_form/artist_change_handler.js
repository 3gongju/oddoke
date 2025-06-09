export function setupArtistChangeHandlers(ajaxBaseUrl) {
  const artistSelect = document.getElementById("artist");
  const memberWrapper = document.getElementById("member-wrapper");
  const splitFormsetContainer = document.getElementById("splitprice-formset-wrapper");
  const categoryElement = document.getElementById("selected-category");

  if (!artistSelect || !categoryElement) return;

  artistSelect.addEventListener("change", () => {
    const artistId = artistSelect.value;
    const currentCategory = categoryElement.value;

    if (currentCategory === "split" && artistId) {
      console.log("✅ split AJAX 요청 시작!", artistId);

      const url = new URL(`${ajaxBaseUrl}/load_split_members_and_prices/`, window.location.origin);
      url.searchParams.set("artist_id", artistId);

      fetch(url)
        .then(resp => resp.json())
        .then(data => {
          console.log("✅ AJAX 응답:", data);

          let html = "";
          data.members.forEach(m => {
            html += `<input type="hidden" name="members" value="${m.id}">`;
          });
          memberWrapper.innerHTML = html;

          splitFormsetContainer.innerHTML = data.formset_html;
          splitFormsetContainer.classList.remove("hidden");
        })
        .catch(err => {
          console.error("❌ split 멤버/가격 AJAX 실패:", err);
          alert("split 데이터를 불러오지 못했습니다. 다시 시도해주세요.");
        });
    }
  });
}
