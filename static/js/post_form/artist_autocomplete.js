// static/js/post_form/artist_autocomplete.js - 수정된 버전
import memberSelectAllManager from './member_select_all.js';

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

  // ✅ 페이지 로드 시 전체선택 기능 초기화
  memberSelectAllManager.initialize();
  
  // ✅ 아티스트 변경 시 전체선택 기능 재초기화
  const artistSelect = document.getElementById('artist');
  if (artistSelect) {
    artistSelect.addEventListener('change', function() {
      console.log('🎯 Artist changed, reinitializing member select all...');
      memberSelectAllManager.reinitializeForArtistChange();
    });
  }
}