// post_form.js

document.addEventListener("DOMContentLoaded", function () {
  const selectedMemberIds = window.selectedMemberIds || [];
  const ajaxBaseUrl = window.ajaxBaseUrl || "";

  const searchInput = document.getElementById("artist-search");
  const resultBox = document.getElementById("artist-search-results");
  const selectBox = document.getElementById("artist");
  let currentFocus = -1;

  function highlightItem(index) {
    const items = resultBox.querySelectorAll("div");
    items.forEach((el, i) => {
      el.classList.toggle("bg-gray-200", i === index);
    });
  }

  function selectArtist(id, name) {
    if (![...selectBox.options].some(o => o.value == id)) {
      const newOption = new Option(name, id, true, true);
      selectBox.add(newOption);
    } else {
      selectBox.value = id;
    }
    resultBox.classList.add("hidden");
    searchInput.value = "";
    selectBox.dispatchEvent(new Event('change'));
  }

  if (searchInput) {
    searchInput.addEventListener("input", function () {
      const query = this.value.trim();
      if (!query) {
        resultBox.classList.add("hidden");
        resultBox.innerHTML = "";
        return;
      }

      fetch(`${ajaxBaseUrl}/search_artists/?q=${encodeURIComponent(query)}`)
        .then(response => response.json())
        .then(data => {
          resultBox.innerHTML = "";
          data.results.forEach(artist => {
            const option = document.createElement("div");
            option.className = "px-3 py-2 hover:bg-gray-100 cursor-pointer";
            option.textContent = artist.name;
            option.dataset.artistId = artist.id;
            option.addEventListener("click", () => {
              selectArtist(artist.id, artist.name);
            });
            resultBox.appendChild(option);
          });
          currentFocus = -1;
          resultBox.classList.remove("hidden");
        });
    });

    searchInput.addEventListener("keydown", function (e) {
      const items = resultBox.querySelectorAll("div");
      if (!items.length) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        currentFocus = (currentFocus + 1) % items.length;
        highlightItem(currentFocus);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        currentFocus = (currentFocus - 1 + items.length) % items.length;
        highlightItem(currentFocus);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (currentFocus > -1 && items[currentFocus]) {
          const selected = items[currentFocus];
          selectArtist(selected.dataset.artistId, selected.textContent);
        }
      }
    });

    document.addEventListener("click", function (e) {
      if (!resultBox.contains(e.target) && e.target !== searchInput) {
        resultBox.classList.add("hidden");
      }
    });
  }

  // ✅ 카테고리 버튼 자동 제출
  const buttons = document.querySelectorAll('.category-btn');
  const form = document.getElementById('create-form') || document.getElementById('edit-form');
  const categoryInput = document.getElementById('selected-category');

  if (form && categoryInput) {
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        categoryInput.value = btn.dataset.category;
        form.submit();
      });
    });
  }

  // ✅ 이미지 미리보기
  const fileInput = document.querySelector('input[type="file"][name="image"]');
  const preview = document.getElementById('image-preview');
  const originalImage = document.getElementById('original-image');

  if (fileInput && preview) {
    fileInput.addEventListener('change', function () {
      const file = this.files[0];
      if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = e => {
          preview.src = e.target.result;
          preview.classList.remove('hidden');

          if (originalImage) {
            originalImage.classList.add('hidden');
          }
        };
        reader.readAsDataURL(file);
      } else {
        preview.src = '#';
        preview.classList.add('hidden');

        if (originalImage) {
          originalImage.classList.remove('hidden');
        }
      }
    });
  }

  // ✅ 아티스트 변경 시 멤버 불러오기
  const artistSelect = document.getElementById('artist');
  const memberWrapper = document.getElementById('member-wrapper');
  const memberContainer = document.getElementById('member-checkboxes');

  function loadMembers(artistId) {
    if (!artistId || !memberWrapper || !memberContainer) return;

    memberContainer.innerHTML = '';
    memberWrapper.classList.add('hidden');

    fetch(`${ajaxBaseUrl}/members/${artistId}/`)
      .then(resp => resp.json())
      .then(data => {
        const members = data.members;
        if (!members.length) return;

        memberWrapper.classList.remove('hidden');

        const selectAllCheckbox = document.createElement('input');
        selectAllCheckbox.type = 'checkbox';
        selectAllCheckbox.classList.add('mr-2');

        const selectAllLabel = document.createElement('label');
        selectAllLabel.classList.add('block', 'mb-2', 'font-semibold');
        selectAllLabel.appendChild(selectAllCheckbox);
        selectAllLabel.appendChild(document.createTextNode('전체 선택'));
        memberContainer.appendChild(selectAllLabel);

        members.forEach(member => {
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.name = 'members';
          checkbox.id = `member_${member.id}`;
          checkbox.value = member.id;
          checkbox.classList.add('mr-2', 'member-checkbox');
          if (selectedMemberIds.map(Number).includes(member.id)) {
            checkbox.checked = true;
          }

          const label = document.createElement('label');
          label.htmlFor = checkbox.id;
          label.classList.add('block', 'mb-2');
          label.appendChild(checkbox);
          label.appendChild(document.createTextNode(member.name));
          memberContainer.appendChild(label);
        });

        const memberCheckboxes = memberContainer.querySelectorAll('.member-checkbox');
        selectAllCheckbox.addEventListener('change', function () {
          memberCheckboxes.forEach(cb => (cb.checked = this.checked));
        });
        memberCheckboxes.forEach(cb => {
          cb.addEventListener('change', () => {
            selectAllCheckbox.checked = Array.from(memberCheckboxes).every(cb => cb.checked);
          });
        });

        selectAllCheckbox.checked = Array.from(memberCheckboxes).every(cb => cb.checked);
      })
      .catch(err => {
        console.error('멤버 불러오기 실패:', err);
        alert('멤버 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
      });
  }

  if (artistSelect) {
    artistSelect.addEventListener('change', () => loadMembers(artistSelect.value));
    if (artistSelect.value) loadMembers(artistSelect.value);
  }
});
