// static/js/create.js
// 생카 등록 페이지 전용 JavaScript (정리된 전체 버전)

document.addEventListener('DOMContentLoaded', function () {
    const steps = document.querySelectorAll(".step");
    const progressBar = document.getElementById("progressBar");
    const nextBtn = document.getElementById("nextBtn");
    const prevBtn = document.getElementById("prevBtn");
    const totalSteps = steps.length;
    let currentStep = 0;
    let duplicateChecked = false;
    let isDuplicate = false;
    let map = null;
    let ps = null;
    let marker = null;

    initializeDatePickers();
    initializeAutocomplete();
    initializeImageUpload();
    initializeMapSearch();
    initializeFormSubmit();
    initDuplicateChecker();
    showStep(currentStep);

    nextBtn.addEventListener("click", () => moveStep(1));
    prevBtn.addEventListener("click", () => moveStep(-1));

    function showStep(index) {
        steps.forEach((step, i) => {
            step.classList.toggle("hidden", i !== index);
        });

        progressBar.style.width = `${(index / (totalSteps - 1)) * 100}%`;

        if (index === 0) {
            prevBtn.classList.add("hidden");
            nextBtn.classList.add("hidden");
        } else {
            prevBtn.classList.remove("hidden");
            nextBtn.classList.remove("hidden");
            prevBtn.disabled = index === 0;
            nextBtn.textContent = index === totalSteps - 1 ? "제출하기" : "다음";
        }

        if (index === 2 && !map) {
            initializeMap();
        }
    }

    function moveStep(direction) {
        if (direction === 1 && currentStep === 0) {
            if (!duplicateChecked) return alert("중복 확인을 먼저 해주세요.");
            if (isDuplicate) return alert("중복된 생카가 존재합니다. 다른 정보로 입력해주세요.");

            const artistText = document.getElementById("selected-artist-text").textContent;
            const artistId = document.getElementById("artist_id").value;
            const memberId = document.getElementById("member_id").value;

            document.getElementById("summary-artist-name").textContent = artistText.split("(")[1]?.replace(")", "").trim();
            document.getElementById("summary-member-name").textContent = artistText.split("(")[0]?.replace("✓", "").trim();
            document.getElementById("register_artist_id").value = artistId;
            document.getElementById("register_member_id").value = memberId;
        }

        if (direction === 1 && currentStep === totalSteps - 1) {
            document.getElementById("multiStepForm").submit();
            return;
        }

        currentStep += direction;
        showStep(currentStep);
    }

    function initDuplicateChecker() {
        const checkBtn = document.getElementById('check-duplicate-btn');

        function checkDuplicateBtnState() {
            const filled = ['artist_id', 'member_id', 'check_cafe_name', 'check_start_date', 'check_end_date']
                .every(id => document.getElementById(id)?.value.trim());

            checkBtn.disabled = !filled;
            checkBtn.classList.toggle('opacity-50', !filled);
        }

        ['check_cafe_name', 'check_start_date', 'check_end_date'].forEach(id => {
            document.getElementById(id)?.addEventListener('input', checkDuplicateBtnState);
        });

        checkBtn?.addEventListener('click', () => {
            const artistId = document.getElementById('artist_id').value;
            const memberId = document.getElementById('member_id').value;
            const cafeName = document.getElementById('check_cafe_name').value.trim();
            const startDate = document.getElementById('check_start_date').value;
            const endDate = document.getElementById('check_end_date').value;

            const url = `/ddoksang/api/check-duplicate-cafe/?artist_id=${artistId}&member_id=${memberId}` +
                        `&cafe_name=${encodeURIComponent(cafeName)}&start_date=${startDate}&end_date=${endDate}`;

            fetch(url)
                .then(res => res.json())
                .then(data => {
                    const warningBox = document.getElementById('duplicate-warning');
                    duplicateChecked = true;
                    isDuplicate = data.exists;

                    if (data.exists) {
                        warningBox.classList.remove('hidden');
                    } else {
                        warningBox.classList.add('hidden');
                        nextBtn.classList.remove("hidden");
                    }
                });
        });

        checkDuplicateBtnState();
    }

    // ✳️ 아래는 기타 기능 초기화들

    function initializeDatePickers() {
        flatpickr("#start_date", {
            dateFormat: "Y-m-d",
            defaultDate: new Date(),
            onChange: function (selectedDates, dateStr) {
                const endPicker = document.querySelector('#end_date')._flatpickr;
                endPicker.set('minDate', dateStr);
                if (endPicker.selectedDates[0] && endPicker.selectedDates[0] < selectedDates[0]) {
                    endPicker.setDate(dateStr);
                }
            }
        });

        flatpickr("#end_date", {
            dateFormat: "Y-m-d",
            defaultDate: new Date(),
            onChange: function (selectedDates, dateStr) {
                document.querySelector('#start_date')._flatpickr.set('maxDate', dateStr);
            }
        });
    }

    function initializeAutocomplete() {
        if (typeof initAutocomplete === 'function') {
            initAutocomplete('artist-member-search', 'artist-member-results', {
                showBirthday: true,
                showArtistTag: false,
                submitOnSelect: false,
                artistOnly: false,
                apiUrl: '/artist/autocomplete/',
                onSelect: function (result) {
                    selectArtist({
                        member_name: result.name,
                        artist_display: result.artist || result.artist_name,
                        artist_id: result.artist_id,
                        member_id: result.id || result.member_id,
                        bday: result.birthday ? formatBirthday(result.birthday) : ''
                    });
                }
            });
        }
    }

    function selectArtist(item) {
        document.getElementById("artist-member-results").classList.add("hidden");
        document.getElementById("artist-member-search").value = `${item.member_name} (${item.artist_display})`;
        document.getElementById("artist_id").value = item.artist_id;
        document.getElementById("member_id").value = item.member_id;
        document.getElementById("selected-artist-text").textContent = `✓ ${item.member_name} (${item.artist_display}) 선택됨`;
        document.getElementById("selected-artist").classList.remove("hidden");
    }

    function formatBirthday(birthday) {
        const date = new Date(birthday);
        return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    function initializeImageUpload() {
        const imageInput = document.getElementById("images");
        const uploadArea = document.querySelector('label[for="images"]').parentElement;

        imageInput.addEventListener("change", handleImagePreview);

        uploadArea.addEventListener('dragover', e => {
            e.preventDefault();
            uploadArea.classList.add('border-blue-400', 'bg-blue-50');
        });

        uploadArea.addEventListener('dragleave', e => {
            e.preventDefault();
            uploadArea.classList.remove('border-blue-400', 'bg-blue-50');
        });

        uploadArea.addEventListener('drop', e => {
            e.preventDefault();
            uploadArea.classList.remove('border-blue-400', 'bg-blue-50');

            const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
            if (files.length) {
                const dt = new DataTransfer();
                files.forEach(f => dt.items.add(f));
                imageInput.files = dt.files;
                handleImagePreview();
            }
        });
    }

    function handleImagePreview() {
        const input = document.getElementById("images");
        const preview = document.getElementById("image-preview");
        preview.innerHTML = "";

        if (input.files.length > 5) {
            alert("최대 5개의 이미지만 업로드할 수 있습니다.");
            input.value = "";
            return;
        }

        Array.from(input.files).forEach((file, i) => {
            if (file.size > 5 * 1024 * 1024) {
                alert(`${file.name}: 파일 크기가 5MB를 초과합니다.`);
                return;
            }

            const reader = new FileReader();
            reader.onload = e => {
                const div = document.createElement("div");
                div.className = "relative";
                div.innerHTML = `
                    <img src="${e.target.result}" alt="Preview ${i + 1}" class="w-full h-32 object-cover rounded border">
                    <div class="absolute top-2 left-2 bg-blue-500 text-white text-xs px-2 py-1 rounded">${i === 0 ? '대표' : i + 1}</div>
                    <button type="button" onclick="removeImage(${i})" class="absolute top-2 right-2 bg-red-500 text-white text-xs w-6 h-6 rounded-full">×</button>
                `;
                preview.appendChild(div);
            };
            reader.readAsDataURL(file);
        });
    }

    window.removeImage = function (index) {
        const input = document.getElementById("images");
        const dt = new DataTransfer();
        Array.from(input.files).forEach((file, i) => {
            if (i !== index) dt.items.add(file);
        });
        input.files = dt.files;
        handleImagePreview();
    };

    function initializeFormSubmit() {
        document.getElementById('multiStepForm').addEventListener('submit', function () {
            const allInputs = this.querySelectorAll('input, textarea, select');
            allInputs.forEach(input => input.disabled = false);

            const xUsername = document.querySelector('[name="x_username"]').value.trim();
            if (xUsername) {
                const xInput = document.createElement('input');
                xInput.type = 'hidden';
                xInput.name = 'x_source';
                xInput.value = `https://x.com/${xUsername.replace('@', '')}`;
                this.appendChild(xInput);
            }
        });
    }

    function initializeMap() {
        const mapContainer = document.getElementById('map');
        const mapOption = {
            center: new kakao.maps.LatLng(37.5665, 126.9780),
            level: 3
        };

        map = new kakao.maps.Map(mapContainer, mapOption);
        document.getElementById('mapPlaceholder').style.display = 'none';
    }

    function initializeMapSearch() {
        const searchBtn = document.getElementById("searchBtn");
        const placeInput = document.getElementById("place-search");

        searchBtn?.addEventListener('click', searchPlace);
        placeInput.addEventListener("keydown", e => {
            if (e.key === "Enter") {
                e.preventDefault();
                searchPlace();
            }
        });
    }

    function searchPlace() {
        if (!map) initializeMap();
        if (!ps) {
            ps = new kakao.maps.services.Places();
            marker = new kakao.maps.Marker({ map });
        }

        const keyword = document.getElementById("place-search").value.trim();
        if (!keyword) return;

        ps.keywordSearch(keyword, (data, status) => {
            const results = document.getElementById('place-results');
            if (status === kakao.maps.services.Status.OK) {
                results.innerHTML = '';
                results.classList.remove('hidden');
                data.forEach(place => {
                    const li = document.createElement('li');
                    li.textContent = `${place.place_name} (${place.road_address_name || place.address_name})`;
                    li.className = 'px-4 py-2 cursor-pointer hover:bg-gray-200 border-b last:border-none text-sm';
                    li.addEventListener('click', () => selectPlace(place));
                    results.appendChild(li);
                });
            } else {
                results.innerHTML = '<li class="px-4 py-2 text-red-500 text-sm">검색 결과가 없습니다.</li>';
                results.classList.remove('hidden');
            }
        });
    }

    function selectPlace(place) {
        const latlng = new kakao.maps.LatLng(place.y, place.x);
        map.setCenter(latlng);
        marker.setPosition(latlng);

        document.getElementById('selected-place').innerHTML = `
            <div class="flex items-center justify-between">
                <div>
                    <p class="font-medium text-green-800">${place.place_name}</p>
                    <p class="text-sm text-green-600">${place.road_address_name || place.address_name}</p>
                </div>
                <svg class="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                </svg>
            </div>`;
        document.getElementById('selected-place').classList.remove('hidden');

        document.getElementById("place_name").value = place.place_name;
        document.getElementById("address").value = place.address_name;
        document.getElementById("road_address").value = place.road_address_name || '';
        document.getElementById("latitude").value = place.y;
        document.getElementById("longitude").value = place.x;
        document.getElementById("kakao_place_id").value = place.id;

        document.getElementById('place-results').classList.add('hidden');
    }
});
