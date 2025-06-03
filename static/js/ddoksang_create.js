// static/js/create.js
// 생카 등록 페이지 전용 JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // 기본 변수들
    const steps = 6;
    let currentStep = 1;
    let map = null;
    let ps = null;
    let marker = null;

    const nextBtn = document.getElementById("nextBtn");
    const prevBtn = document.getElementById("prevBtn");
    const progressBar = document.getElementById("progressBar");

    // 날짜 초기화
    initializeDatePickers();
    
    // 자동완성 초기화
    initializeAutocomplete();
    
    // 스텝 네비게이션 초기화
    initializeStepNavigation();
    
    // 이미지 업로드 초기화
    initializeImageUpload();
    
    // 지도 검색 초기화
    initializeMapSearch();
    
    // 폼 제출 처리
    initializeFormSubmit();

    // 날짜 선택기 초기화
    function initializeDatePickers() {
        flatpickr("#start_date", { 
            dateFormat: "Y-m-d", 
            defaultDate: new Date(),
            onChange: function(selectedDates, dateStr) {
                const endDatePicker = document.querySelector('#end_date')._flatpickr;
                endDatePicker.set('minDate', dateStr);
                if (endDatePicker.selectedDates[0] && endDatePicker.selectedDates[0] < selectedDates[0]) {
                    endDatePicker.setDate(dateStr);
                }
            }
        });
        
        flatpickr("#end_date", { 
            dateFormat: "Y-m-d", 
            defaultDate: new Date(),
            onChange: function(selectedDates, dateStr) {
                const startDatePicker = document.querySelector('#start_date')._flatpickr;
                startDatePicker.set('maxDate', dateStr);
            }
        });
    }

    // 자동완성 초기화 (기존 라이브러리 사용)
    function initializeAutocomplete() {
        if (typeof initAutocomplete === 'function') {
            initAutocomplete('artist-member-search', 'artist-member-results', {
                showBirthday: true,
                showArtistTag: false,
                submitOnSelect: false,
                artistOnly: false,
                apiUrl: '/artist/autocomplete/', // 실제 API 경로로 수정 필요
                onSelect: function(result, input) {
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

    // 생일 포맷팅
    function formatBirthday(birthday) {
        if (!birthday) return '';
        const date = new Date(birthday);
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${month}-${day}`;
    }

    // 아티스트 선택 처리
    window.selectArtist = function(item) {
        document.getElementById("artist-member-results").classList.add("hidden");
        document.getElementById("artist-member-search").value = `${item.member_name} (${item.artist_display})`;
        document.getElementById("artist_id").value = item.artist_id;
        document.getElementById("member_id").value = item.member_id;
        document.getElementById("selected-artist-text").textContent = `✓ ${item.member_name} (${item.artist_display}) 선택됨`;
        document.getElementById("selected-artist").classList.remove("hidden");
    };

    // 선택 초기화
    window.clearSelection = function() {
        document.getElementById("artist_id").value = "";
        document.getElementById("member_id").value = "";
        document.getElementById("artist-member-search").value = "";
        document.getElementById("selected-artist").classList.add("hidden");
        document.getElementById("artist-member-results").classList.add("hidden");
    };

    // 스텝 네비게이션 초기화
    function initializeStepNavigation() {
        updateStepVisibility();

        nextBtn.addEventListener("click", (e) => {
            if (currentStep < steps) {
                e.preventDefault();
                if (!validateStep()) return;
                currentStep++;
                updateStepVisibility();
            }
        });

        prevBtn.addEventListener("click", () => {
            if (currentStep > 1) {
                currentStep--;
                updateStepVisibility();
            }
        });
    }

    // 스텝 표시 업데이트
    function updateStepVisibility() {
        for (let i = 1; i <= steps; i++) {
            const stepDiv = document.getElementById(`step-${i}`);
            const inputs = stepDiv.querySelectorAll("input:not([type='hidden']), textarea, select");
            
            if (i === currentStep) {
                stepDiv.classList.remove("hidden");
                inputs.forEach(el => el.disabled = false);
            } else {
                stepDiv.classList.add("hidden");
                inputs.forEach(el => el.disabled = true);
            }
        }
        
        progressBar.style.width = `${(currentStep / steps) * 100}%`;
        prevBtn.disabled = currentStep === 1;
        
        if (currentStep === steps) {
            nextBtn.textContent = "최종 제출";
            nextBtn.type = "submit";
            nextBtn.className = "px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600";
        } else {
            nextBtn.textContent = "다음";
            nextBtn.type = "button";
            nextBtn.className = "px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600";
        }
        
        if (currentStep === 2 && !map) {
            initializeMap();
        }
    }

    // 스텝 검증
    function validateStep() {
        const currentStepDiv = document.getElementById(`step-${currentStep}`);
        
        if (currentStep === 1) {
            const artistId = document.getElementById("artist_id").value;
            const searchInput = document.getElementById("artist-member-search").value.trim();
            
            if (!artistId || !searchInput) {
                alert("아티스트/멤버를 검색하고 선택해주세요.");
                document.getElementById("artist-member-search").focus();
                return false;
            }
            return true;
        }
        
        const requiredFields = currentStepDiv.querySelectorAll("[required]");
        for (const field of requiredFields) {
            if (!field.value.trim()) {
                field.focus();
                alert("필수 입력란을 모두 채워주세요.");
                return false;
            }
        }
        
        if (currentStep === 2) {
            const address = document.getElementById("address").value;
            if (!address) {
                alert("주소를 검색하고 선택해주세요.");
                document.getElementById("place-search").focus();
                return false;
            }
        }
        
        return true;
    }

    // 지도 초기화
    function initializeMap() {
        const mapContainer = document.getElementById('map');
        const mapOption = {
            center: new kakao.maps.LatLng(37.5665, 126.9780),
            level: 3
        };
        
        map = new kakao.maps.Map(mapContainer, mapOption);
        document.getElementById('mapPlaceholder').style.display = 'none';
    }

    // 지도 검색 초기화
    function initializeMapSearch() {
        const searchBtn = document.getElementById("searchBtn");
        const placeInput = document.getElementById("place-search");
        
        searchBtn?.addEventListener('click', searchPlace);
        placeInput.addEventListener("keydown", function (e) {
            if (e.key === "Enter") {
                e.preventDefault();
                searchPlace();
            }
        });
    }

    // 장소 검색
    function searchPlace() {
        if (!map) initializeMap();
        if (!ps) {
            ps = new kakao.maps.services.Places();
            marker = new kakao.maps.Marker({ map: map });
        }
        
        let keyword = document.getElementById("place-search").value.trim();
        if (!keyword) return;
        
        ps.keywordSearch(keyword, function (data, status) {
            const placeResults = document.getElementById('place-results');
            
            if (status === kakao.maps.services.Status.OK) {
                placeResults.innerHTML = '';
                placeResults.classList.remove('hidden');
                
                data.forEach(place => {
                    const li = document.createElement('li');
                    li.textContent = `${place.place_name} (${place.road_address_name || place.address_name})`;
                    li.className = 'px-4 py-2 cursor-pointer hover:bg-gray-200 border-b last:border-none text-sm';
                    li.addEventListener('click', () => selectPlace(place));
                    placeResults.appendChild(li);
                });
            } else {
                placeResults.innerHTML = '<li class="px-4 py-2 text-red-500 text-sm">검색 결과가 없습니다.</li>';
                placeResults.classList.remove('hidden');
            }
        });
    }

    // 장소 선택
    function selectPlace(place) {
        const latlng = new kakao.maps.LatLng(place.y, place.x);
        map.setCenter(latlng);
        marker.setPosition(latlng);

        const selectedPlaceDiv = document.getElementById('selected-place');
        selectedPlaceDiv.innerHTML = `
            <div class="flex items-center justify-between">
                <div>
                    <p class="font-medium text-green-800">${place.place_name}</p>
                    <p class="text-sm text-green-600">${place.road_address_name || place.address_name}</p>
                </div>
                <svg class="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                </svg>
            </div>
        `;
        selectedPlaceDiv.classList.remove('hidden');

        // 폼 데이터 설정
        document.getElementById("place_name").value = place.place_name;
        document.getElementById("address").value = place.address_name;
        document.getElementById("road_address").value = place.road_address_name || '';
        document.getElementById("latitude").value = place.y;
        document.getElementById("longitude").value = place.x;
        document.getElementById("kakao_place_id").value = place.id;

        document.getElementById('place-results').classList.add('hidden');
    }

    // 이미지 업로드 초기화
    function initializeImageUpload() {
        const imageInput = document.getElementById("images");
        const imageUploadArea = document.querySelector('label[for="images"]').parentElement;

        imageInput.addEventListener("change", handleImagePreview);
        
        // 드래그 앤 드롭
        imageUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            imageUploadArea.classList.add('border-blue-400', 'bg-blue-50');
        });

        imageUploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            imageUploadArea.classList.remove('border-blue-400', 'bg-blue-50');
        });

        imageUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            imageUploadArea.classList.remove('border-blue-400', 'bg-blue-50');
            
            const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
            if (files.length > 0) {
                const dt = new DataTransfer();
                files.forEach(file => dt.items.add(file));
                imageInput.files = dt.files;
                handleImagePreview();
            }
        });
    }

    // 이미지 미리보기 처리
    function handleImagePreview() {
        const imageInput = document.getElementById("images");
        const previewContainer = document.getElementById("image-preview");
        previewContainer.innerHTML = "";
        
        if (imageInput.files.length > 5) {
            alert("최대 5개의 이미지만 업로드할 수 있습니다.");
            imageInput.value = "";
            return;
        }
        
        Array.from(imageInput.files).forEach((file, index) => {
            if (file.size > 5 * 1024 * 1024) {
                alert(`${file.name}: 파일 크기가 5MB를 초과합니다.`);
                return;
            }
            
            const reader = new FileReader();
            reader.onload = function (e) {
                const div = document.createElement("div");
                div.className = "relative";
                div.innerHTML = `
                    <img src="${e.target.result}" alt="Preview ${index + 1}" class="w-full h-32 object-cover rounded border">
                    <div class="absolute top-2 left-2 bg-blue-500 text-white text-xs px-2 py-1 rounded">
                        ${index === 0 ? '대표' : index + 1}
                    </div>
                    <button type="button" onclick="removeImage(${index})" class="absolute top-2 right-2 bg-red-500 text-white text-xs w-6 h-6 rounded-full hover:bg-red-600">
                        ×
                    </button>
                `;
                previewContainer.appendChild(div);
            };
            reader.readAsDataURL(file);
        });
    }

    // 이미지 제거
    window.removeImage = function(index) {
        const input = document.getElementById("images");
        const dt = new DataTransfer();
        
        Array.from(input.files).forEach((file, i) => {
            if (i !== index) dt.items.add(file);
        });
        
        input.files = dt.files;
        handleImagePreview();
    };

    // 폼 제출 초기화
    function initializeFormSubmit() {
        document.getElementById('multiStepForm').addEventListener('submit', function(e) {
            // 모든 input 활성화
            const allInputs = this.querySelectorAll('input, textarea, select');
            allInputs.forEach(input => input.disabled = false);
            
            // Twitter username을 URL로 변환
            const twitterUsername = document.querySelector('[name="twitter_username"]').value.trim();
            if (twitterUsername) {
                const twitterInput = document.createElement('input');
                twitterInput.type = 'hidden';
                twitterInput.name = 'twitter_source';
                twitterInput.value = `https://twitter.com/${twitterUsername.replace('@', '')}`;
                this.appendChild(twitterInput);
            }
        });
    }
});