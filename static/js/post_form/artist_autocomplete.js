export function setupArtistAutocomplete(ajaxBaseUrl) {
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
    selectBox.dispatchEvent(new Event("change"));
  }

  // 멤버 전체 선택/해제 기능
  function setupSelectAllMembers() {
    const selectAllCheckbox = document.getElementById('select-all-members');
    const memberCheckboxes = document.querySelectorAll('.member-checkbox');
    
    if (selectAllCheckbox && memberCheckboxes.length > 0) {
      // 전체 선택 체크박스 이벤트
      selectAllCheckbox.addEventListener('change', function() {
        memberCheckboxes.forEach(checkbox => {
          checkbox.checked = this.checked;
        });
      });
      
      // 개별 체크박스 이벤트 (전체 선택 상태 업데이트)
      memberCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
          const checkedCount = document.querySelectorAll('.member-checkbox:checked').length;
          const totalCount = memberCheckboxes.length;
          
          if (checkedCount === 0) {
            selectAllCheckbox.indeterminate = false;
            selectAllCheckbox.checked = false;
          } else if (checkedCount === totalCount) {
            selectAllCheckbox.indeterminate = false;
            selectAllCheckbox.checked = true;
          } else {
            selectAllCheckbox.indeterminate = true;
            selectAllCheckbox.checked = false;
          }
        });
      });
      
      // 초기 상태 설정
      const checkedCount = document.querySelectorAll('.member-checkbox:checked').length;
      const totalCount = memberCheckboxes.length;
      
      if (checkedCount === totalCount && totalCount > 0) {
        selectAllCheckbox.checked = true;
      } else if (checkedCount > 0) {
        selectAllCheckbox.indeterminate = true;
      }
    }
  }

  // ✅ DOM이 완전히 준비된 후 전체 선택 기능 초기화
  function initializeSelectAll() {
    // requestAnimationFrame으로 브라우저 렌더링 완료 후 실행
    requestAnimationFrame(() => {
      // 추가로 50ms 지연하여 CSS 적용 완료 보장
      setTimeout(setupSelectAllMembers, 50);
    });
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

  // ✅ 페이지 로드 시 전체 선택 기능 설정 (DOM 준비 완료 후)
  initializeSelectAll();
  
  // 아티스트 변경 시 새로운 멤버 목록에 대해 전체 선택 기능 재설정
  const artistSelect = document.getElementById('artist');
  if (artistSelect) {
    artistSelect.addEventListener('change', function() {
      // ✅ 동일한 지연 처리 방식 적용
      requestAnimationFrame(() => {
        setTimeout(setupSelectAllMembers, 100);
      });
    });
  }
}