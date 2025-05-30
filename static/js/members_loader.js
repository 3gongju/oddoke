export function setupMembersLoader(ajaxBaseUrl, selectedMemberIds) {
  const artistSelect = document.getElementById("artist");
  const memberWrapper = document.getElementById("member-wrapper");
  const memberContainer = document.getElementById("member-checkboxes");

  function loadMembers(artistId) {
    if (!artistId || !memberWrapper || !memberContainer) return;

    memberContainer.innerHTML = "";
    memberWrapper.classList.add("hidden");

    fetch(`${ajaxBaseUrl}/members/${artistId}/`)
      .then(resp => resp.json())
      .then(data => {
        const members = data.members;
        if (!members.length) return;

        memberWrapper.classList.remove("hidden");

        const selectAllCheckbox = document.createElement("input");
        selectAllCheckbox.type = "checkbox";
        selectAllCheckbox.classList.add("mr-2");

        const selectAllLabel = document.createElement("label");
        selectAllLabel.classList.add("block", "mb-2", "font-semibold");
        selectAllLabel.appendChild(selectAllCheckbox);
        selectAllLabel.appendChild(document.createTextNode("전체 선택"));
        memberContainer.appendChild(selectAllLabel);

        members.forEach(member => {
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.name = "members";
          checkbox.id = `member_${member.id}`;
          checkbox.value = member.id;
          checkbox.classList.add("mr-2", "member-checkbox");
          if (selectedMemberIds.map(Number).includes(member.id)) {
            checkbox.checked = true;
          }

          const label = document.createElement("label");
          label.htmlFor = checkbox.id;
          label.classList.add("block", "mb-2");
          label.appendChild(checkbox);
          label.appendChild(document.createTextNode(member.name));
          memberContainer.appendChild(label);
        });

        const memberCheckboxes = memberContainer.querySelectorAll(".member-checkbox");
        selectAllCheckbox.addEventListener("change", function () {
          memberCheckboxes.forEach(cb => (cb.checked = this.checked));
        });
        memberCheckboxes.forEach(cb => {
          cb.addEventListener("change", () => {
            selectAllCheckbox.checked = Array.from(memberCheckboxes).every(cb => cb.checked);
          });
        });

        selectAllCheckbox.checked = Array.from(memberCheckboxes).every(cb => cb.checked);
      })
      .catch(err => {
        console.error("멤버 불러오기 실패:", err);
        alert("멤버 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
      });
  }

  if (artistSelect) {
    artistSelect.addEventListener("change", () => loadMembers(artistSelect.value));
    if (artistSelect.value) loadMembers(artistSelect.value);
  }
}
