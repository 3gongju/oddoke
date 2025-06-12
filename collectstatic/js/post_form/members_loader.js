export function setupMembersLoader(ajaxBaseUrl, selectedMemberIds) {
  const artistSelect = document.getElementById("artist");
  const memberWrapper = document.getElementById("member-wrapper");
  const memberContainer = document.getElementById("member-checkboxes");
  const categoryElement = document.getElementById("selected-category");

  function loadMembers(artistId) {
    const currentCategory = categoryElement?.value;
    if (currentCategory === "split") {
      return;
    }

    if (!artistId || !memberWrapper || !memberContainer) {
      return;
    }

    fetch(`${ajaxBaseUrl}/artist/${artistId}/members/`)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        memberContainer.innerHTML = "";
        
        if (data.members && data.members.length > 0) {
          data.members.forEach(member => {
            const isChecked = selectedMemberIds.includes(member.id) ? 'checked' : '';
            const checkboxHtml = `
              <label class="block mb-2">
                <input type="checkbox" name="members" value="${member.id}" 
                       class="mr-2 member-checkbox" ${isChecked}>
                ${member.name}
              </label>
            `;
            memberContainer.insertAdjacentHTML('beforeend', checkboxHtml);
          });
          
          memberWrapper.classList.remove("hidden");
        } else {
          memberWrapper.classList.add("hidden");
        }
      })
      .catch(error => {
        memberContainer.innerHTML = '<p class="text-red-500 text-sm">멤버를 불러오는데 실패했습니다.</p>';
        memberWrapper.classList.remove("hidden");
      });
  }

  if (artistSelect) {
    const initialArtistId = artistSelect.value || window.selectedArtistId;

    artistSelect.addEventListener("change", () => {
      const selectedArtistId = artistSelect.value;
      
      if (selectedArtistId) {
        loadMembers(selectedArtistId);
      } else {
        memberWrapper.classList.add("hidden");
        memberContainer.innerHTML = "";
      }
    });

    if (initialArtistId) {
      loadMembers(initialArtistId);
    }
  }
}