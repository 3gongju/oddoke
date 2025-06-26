export function setupArtistAutocomplete(ajaxBaseUrl) {
  const searchInput = document.getElementById("artist-search");
  const resultBox = document.getElementById("artist-search-results");
  const selectBox = document.getElementById("artist");
  let currentFocus = -1;
  let isSelecting = false; // 선택 중인지 플래그

  function highlightItem(index) {
    const items = resultBox.querySelectorAll("div");
    items.forEach((el, i) => {
      el.classList.toggle("bg-gray-200", i === index);
    });
  }

  function selectArtist(id, name) {
    isSelecting = true; // 선택 시작
    
    if (![...selectBox.options].some(o => o.value == id)) {
      const newOption = new Option(name, id, true, true);
      selectBox.add(newOption);
    } else {
      selectBox.value = id;
    }
    
    resultBox.classList.add("hidden");
    searchInput.value = "";
    selectBox.dispatchEvent(new Event("change"));
    
    // 선택 완료 후 잠시 대기
    setTimeout(() => {
      isSelecting = false;
    }, 100);
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
            
            // mousedown 이벤트 사용 (click보다 먼저 발생)
            option.addEventListener("mousedown", (e) => {
              e.preventDefault(); // 기본 동작 방지
              selectArtist(artist.id, artist.name);
            });
            
            // click 이벤트도 유지 (백업용)
            option.addEventListener("click", (e) => {
              e.preventDefault();
              e.stopPropagation();
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
      } else if (e.key === "Escape") {
        resultBox.classList.add("hidden");
        currentFocus = -1;
      }
    });

    // 개선된 외부 클릭 처리
    document.addEventListener("click", function (e) {
      // 선택 중이면 무시
      if (isSelecting) return;
      
      // 결과 박스나 검색 입력창 클릭이 아닌 경우에만 숨김
      if (!resultBox.contains(e.target) && e.target !== searchInput) {
        // 약간의 지연을 주어 mousedown 이벤트가 먼저 처리되도록 함
        setTimeout(() => {
          if (!isSelecting) {
            resultBox.classList.add("hidden");
          }
        }, 10);
      }
    });

    // 검색 입력창 포커스 시 결과 다시 표시 (비어있지 않다면)
    searchInput.addEventListener("focus", function() {
      if (this.value.trim() && resultBox.children.length > 0) {
        resultBox.classList.remove("hidden");
      }
    });
  }
}