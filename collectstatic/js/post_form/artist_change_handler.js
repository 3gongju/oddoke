// static/js/post_form/artist_change_handler.js - 수정된 버전
import memberSelectAllManager from './member_select_all.js';

export function setupArtistChangeHandlers(ajaxBaseUrl) {
  const artistSelect = document.getElementById("artist");
  const memberWrapper = document.getElementById("member-wrapper");
  const splitFormsetContainer = document.getElementById("splitprice-formset-wrapper");
  const categoryElement = document.getElementById("selected-category");

  if (!artistSelect || !categoryElement) {
    return;
  }

  artistSelect.addEventListener("change", () => {
    const artistId = artistSelect.value;
    const currentCategory = categoryElement.value;

    if (currentCategory === "split" && artistId) {
      const url = new URL(`${ajaxBaseUrl}/load_split_members_and_prices/`, window.location.origin);
      url.searchParams.set("artist_id", artistId);

      fetch(url)
        .then(resp => {
          if (!resp.ok) {
            throw new Error(`HTTP ${resp.status}`);
          }
          return resp.json();
        })
        .then(data => {
          if (memberWrapper) {
            memberWrapper.innerHTML = "";
            memberWrapper.classList.add("hidden");
          }

          if (splitFormsetContainer) {
            splitFormsetContainer.innerHTML = data.formset_html;
            splitFormsetContainer.classList.remove("hidden");
          }
        })
        .catch(err => {
          alert("split 데이터를 불러오지 못했습니다. 다시 시도해주세요.");
        });
    } else if (currentCategory !== "split" && artistId) {
      fetch(`${ajaxBaseUrl}/artist/${artistId}/members/`)
        .then(resp => {
          if (!resp.ok) {
            throw new Error(`HTTP ${resp.status}`);
          }
          return resp.json();
        })
        .then(data => {
          if (memberWrapper) {
            const memberContainer = document.getElementById("member-checkboxes");
            if (memberContainer && data.members) {
              memberContainer.innerHTML = "";
              
              data.members.forEach(member => {
                const checkboxHtml = `
                  <label class="block mb-2">
                    <input type="checkbox" name="members" value="${member.id}" 
                           class="mr-2 member-checkbox">
                    ${member.name}
                  </label>
                `;
                memberContainer.insertAdjacentHTML('beforeend', checkboxHtml);
              });
              
              memberWrapper.classList.remove("hidden");
              
              // ✅ 멤버 로딩 완료 후 전체선택 기능 재초기화
              setTimeout(() => {
                memberSelectAllManager.reinitializeForArtistChange();
              }, 100);
            }
          }
        })
        .catch(err => {
          console.error("멤버 로딩 실패:", err);
        });
    } else if (!artistId) {
      // 아티스트가 선택되지 않은 경우 초기화
      if (memberWrapper) {
        memberWrapper.classList.add("hidden");
        const memberContainer = document.getElementById("member-checkboxes");
        if (memberContainer) {
          memberContainer.innerHTML = "";
        }
      }
      if (splitFormsetContainer) {
        splitFormsetContainer.classList.add("hidden");
        splitFormsetContainer.innerHTML = "";
      }
    }
  });
}