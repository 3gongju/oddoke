export function setupMembersLoader(ajaxBaseUrl, selectedMemberIds) {
  const artistSelect = document.getElementById("artist");
  const memberWrapper = document.getElementById("member-wrapper");
  const memberContainer = document.getElementById("member-checkboxes");
  const categoryElement = document.getElementById("selected-category");

  function loadMembers(artistId) {
    // ✅ split 카테고리면 멤버 로딩 안 함
    const currentCategory = categoryElement?.value;
    if (currentCategory === "split") {
      return;
    }

    if (!artistId || !memberWrapper || !memberContainer) return;
    // ... 기존 로직
  }

  if (artistSelect) {
    const initialArtistId = artistSelect.value || window.selectedArtistId;

    artistSelect.addEventListener("change", () => loadMembers(artistSelect.value));

    if (initialArtistId) {
      loadMembers(initialArtistId);
    }
  }
}