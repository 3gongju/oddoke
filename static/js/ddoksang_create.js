// static/js/ddoksang_create.js
// 생카 등록 페이지 전용 JavaScript (최종 완전 버전)

document.addEventListener('DOMContentLoaded', function () {
    console.log('생카 등록 페이지 로드됨');
    
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

    console.log(`총 ${totalSteps}개 단계 발견`);

    // 초기화 함수들 호출
    initializeDatePickers();
    initializeAutocomplete();
    initializeImageUpload();
    initializeMapSearch();
    initializeFormSubmit();
    initDuplicateChecker();
    showStep(currentStep);

    // 버튼 이벤트 리스너
    if (nextBtn) nextBtn.addEventListener("click", () => moveStep(1));
    if (prevBtn) prevBtn.addEventListener("click", () => moveStep(-1));

    // 🔥 전역 함수: clearSelection (HTML onclick에서 호출)
    window.clearSelection = function() {
        console.log('선택 취소');
        
        const searchEl = document.getElementById("artist-member-search");
        const artistIdEl = document.getElementById("check_artist_id");
        const memberIdEl = document.getElementById("check_member_id");
        const selectedEl = document.getElementById("selected-artist");
        const warningEl = document.getElementById("duplicate-warning");
        const successEl = document.getElementById("duplicate-success");
        
        if (searchEl) searchEl.value = "";
        if (artistIdEl) artistIdEl.value = "";
        if (memberIdEl) memberIdEl.value = "";
        if (selectedEl) selectedEl.classList.add("hidden");
        if (warningEl) warningEl.classList.add("hidden");
        if (successEl) successEl.classList.add("hidden");
        
        duplicateChecked = false;
        isDuplicate = false;
        
        if (typeof window.checkDuplicateBtnState === 'function') {
            window.checkDuplicateBtnState();
        }
    };

    // 🔥 전역 함수: removeImage (HTML onclick에서 호출)
    window.removeImage = function (index) {
        const input = document.getElementById("images");
        if (!input) return;
        
        const dt = new DataTransfer();
        Array.from(input.files).forEach((file, i) => {
            if (i !== index) dt.items.add(file);
        });
        input.files = dt.files;
        handleImagePreview();
    };

    function showStep(index) {
        console.log(`Step ${index} 표시`);
        
        steps.forEach((step, i) => {
            step.classList.toggle("hidden", i !== index);
        });

        if (progressBar) {
            progressBar.style.width = `${(index / (totalSteps - 1)) * 100}%`;
        }

        // Step 0 (중복 확인)에서는 이전/다음 버튼 숨김
        if (index === 0) {
            if (prevBtn) prevBtn.classList.add("hidden");
            if (nextBtn) nextBtn.classList.add("hidden");
        } else {
            if (prevBtn) {
                prevBtn.classList.remove("hidden");
                prevBtn.disabled = index === 1; // Step 1에서는 이전 버튼 비활성화
            }
            if (nextBtn) {
                nextBtn.classList.remove("hidden");
                nextBtn.textContent = index === totalSteps - 1 ? "제출하기" : "다음";
            }
        }

        // 지도가 있는 step에서 지도 초기화 (Step 2는 카페 정보에서 지도)
        if (index === 2 && !map) {
            setTimeout(() => initializeMap(), 100);
        }
    }

    function moveStep(direction) {
        console.log(`Step 이동: ${direction}, 현재: ${currentStep}`);
        
        // Step 0에서 Step 1로: 중복 확인 완료 체크 (실제로는 자동 이동)
        if (direction === 1 && currentStep === 0) {
            if (!duplicateChecked) {
                alert("중복 확인을 먼저 해주세요.");
                return;
            }
            if (isDuplicate) {
                alert("중복된 생카가 존재합니다. 다른 정보로 입력해주세요.");
                return;
            }
        }

        // Step 1에서 Step 2로: 데이터 복사
        if (direction === 1 && currentStep === 1) {
            copyDataToNextSteps();
        }

        // 마지막 단계에서 제출
        if (direction === 1 && currentStep === totalSteps - 1) {
            const form = document.getElementById("multiStepForm");
            if (form) {
                console.log('폼 제출');
                form.submit();
            }
            return;
        }

        currentStep += direction;
        showStep(currentStep);
    }

    function copyDataToNextSteps() {
        console.log('데이터 복사 중...');
        
        // 중복 확인 단계에서 입력한 데이터
        const artistText = getValue('artist-member-search');
        const artistId = getValue('check_artist_id');
        const memberId = getValue('check_member_id');
        const cafeName = getValue('check_cafe_name');

        // Step 1: 요약 정보 표시
        setElementText('summary-artist-name', extractArtistName(artistText));
        setElementText('summary-member-name', extractMemberName(artistText));
        setElementValue('register_artist_id', artistId);
        setElementValue('register_member_id', memberId);

        // Step 2: 카페명 자동 복사
        setElementValue('cafe_name', cafeName);
        
        console.log('데이터 복사 완료:', { artistId, memberId, cafeName });
    }

    function getValue(id) {
        const el = document.getElementById(id);
        return el ? el.value.trim() : '';
    }

    function setElementText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text || '';
    }

    function setElementValue(id, value) {
        const el = document.getElementById(id);
        if (el) el.value = value || '';
    }

    function extractArtistName(text) {
        if (!text) return '';
        const match = text.match(/\(([^)]+)\)/);
        return match ? match[1] : '';
    }

    function extractMemberName(text) {
        if (!text) return '';
        return text.replace(/✓\s*/, '').split('(')[0].trim();
    }

    // 🔥 중복 확인 로직
    function initDuplicateChecker() {
        console.log('중복 확인 초기화');
        const checkBtn = document.getElementById('check-duplicate-btn');
        if (!checkBtn) {
            console.warn('중복 확인 버튼을 찾을 수 없습니다');
            return;
        }

        function checkDuplicateBtnState() {
            const artistIdEl = document.getElementById('check_artist_id');
            const cafeNameEl = document.getElementById('check_cafe_name');
            const startDateEl = document.getElementById('check_start_date');
            const endDateEl = document.getElementById('check_end_date');
            
            const artistId = artistIdEl?.value?.trim() || '';
            const cafeName = cafeNameEl?.value?.trim() || '';
            const startDate = startDateEl?.value?.trim() || '';
            const endDate = endDateEl?.value?.trim() || '';

            const allFilled = artistId && cafeName && startDate && endDate;
            
            if (checkBtn) {
                checkBtn.disabled = !allFilled;
                checkBtn.classList.toggle('bg-blue-600', allFilled);
                checkBtn.classList.toggle('bg-gray-500', !allFilled);
                checkBtn.classList.toggle('hover:bg-blue-700', allFilled);
                checkBtn.classList.toggle('opacity-50', !allFilled);
            }
            
            console.log('필드 확인:', { artistId, cafeName, startDate, endDate, allFilled });
        }

        // 전역으로 할당하여 다른 함수에서도 접근 가능
        window.checkDuplicateBtnState = checkDuplicateBtnState;

        // 입력 필드 변경 시 버튼 상태 업데이트
        ['check_cafe_name', 'check_start_date', 'check_end_date'].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('input', checkDuplicateBtnState);
                element.addEventListener('change', checkDuplicateBtnState);
            }
        });

        // 중복 확인 버튼 클릭 이벤트
        checkBtn.addEventListener('click', function() {
            console.log('중복 확인 버튼 클릭');
            
            const artistIdEl = document.getElementById('check_artist_id');
            const memberIdEl = document.getElementById('check_member_id');
            const cafeNameEl = document.getElementById('check_cafe_name');
            const startDateEl = document.getElementById('check_start_date');
            const endDateEl = document.getElementById('check_end_date');
            
            if (!artistIdEl || !cafeNameEl || !startDateEl || !endDateEl) {
                alert('필수 입력 필드를 찾을 수 없습니다.');
                return;
            }

            const artistId = artistIdEl.value;
            const memberId = memberIdEl?.value || '';
            const cafeName = cafeNameEl.value.trim();
            const startDate = startDateEl.value;
            const endDate = endDateEl.value;

            if (!artistId || !cafeName || !startDate || !endDate) {
                alert('모든 정보를 입력해주세요.');
                return;
            }

            // 로딩 상태
            checkBtn.disabled = true;
            checkBtn.textContent = '확인 중...';

            const url = `/ddoksang/cafe/check-duplicate/?artist_id=${artistId}&member_id=${memberId}` +
                        `&cafe_name=${encodeURIComponent(cafeName)}&start_date=${startDate}&end_date=${endDate}`;

            console.log('중복 확인 API 호출:', url);

            fetch(url)
                .then(res => {
                    if (!res.ok) {
                        throw new Error(`HTTP error! status: ${res.status}`);
                    }
                    return res.json();
                })
                .then(data => {
                    console.log('중복 확인 결과:', data);
                    
                    const warningBox = document.getElementById('duplicate-warning');
                    const successBox = document.getElementById('duplicate-success');
                    
                    duplicateChecked = true;
                    isDuplicate = data.exists;

                    if (data.exists) {
                        if (warningBox) warningBox.classList.remove('hidden');
                        if (successBox) successBox.classList.add('hidden');
                    } else {
                        if (warningBox) warningBox.classList.add('hidden');
                        if (successBox) successBox.classList.remove('hidden');
                        
                        // 중복이 없으면 1.5초 후 다음 단계로 자동 이동
                        setTimeout(() => {
                            console.log('다음 단계로 자동 이동');
                            currentStep = 1;
                            showStep(currentStep);
                        }, 1500);
                    }
                })
                .catch(error => {
                    console.error('중복 확인 오류:', error);
                    alert('중복 확인 중 오류가 발생했습니다. 다시 시도해주세요.');
                })
                .finally(() => {
                    checkBtn.disabled = false;
                    checkBtn.textContent = '중복 확인하기';
                });
        });

        // 초기 상태 체크
        checkDuplicateBtnState();
    }

    // 날짜 선택기 초기화
    function initializeDatePickers() {
        console.log('날짜 선택기 초기화');
        
        if (typeof flatpickr !== 'undefined') {
            // 중복 확인용 날짜 선택기
            flatpickr("#check_start_date", { 
                dateFormat: "Y-m-d",
                onChange: function() {
                    if (typeof window.checkDuplicateBtnState === 'function') {
                        window.checkDuplicateBtnState();
                    }
                }
            });
            flatpickr("#check_end_date", { 
                dateFormat: "Y-m-d",
                onChange: function() {
                    if (typeof window.checkDuplicateBtnState === 'function') {
                        window.checkDuplicateBtnState();
                    }
                }
            });

            // 실제 폼용 날짜 선택기
            flatpickr("#start_date", {
                dateFormat: "Y-m-d",
                defaultDate: new Date(),
                onChange: function (selectedDates, dateStr) {
                    const endPickerEl = document.querySelector('#end_date');
                    if (endPickerEl && endPickerEl._flatpickr) {
                        const endPicker = endPickerEl._flatpickr;
                        endPicker.set('minDate', dateStr);
                        if (endPicker.selectedDates[0] && endPicker.selectedDates[0] < selectedDates[0]) {
                            endPicker.setDate(dateStr);
                        }
                    }
                }
            });

            flatpickr("#end_date", {
                dateFormat: "Y-m-d",
                defaultDate: new Date(),
                onChange: function (selectedDates, dateStr) {
                    const startPickerEl = document.querySelector('#start_date');
                    if (startPickerEl && startPickerEl._flatpickr) {
                        startPickerEl._flatpickr.set('maxDate', dateStr);
                    }
                }
            });
        } else {
            console.warn('flatpickr 라이브러리를 찾을 수 없습니다');
        }
    }

    // Autocomplete 초기화
    function initializeAutocomplete() {
        console.log('Autocomplete 초기화');
        
        if (typeof initAutocomplete === 'function') {
            try {
                initAutocomplete('artist-member-search', 'artist-member-results', {
                    showBirthday: true,
                    showArtistTag: false,
                    submitOnSelect: false,
                    artistOnly: false,
                    apiUrl: '/artist/autocomplete/',
                    onSelect: function (result) {
                        console.log('아티스트 선택됨:', result);
                        selectArtist({
                            member_name: result.name,
                            artist_display: result.artist || result.artist_name,
                            artist_id: result.artist_id,
                            member_id: result.id || result.member_id,
                            bday: result.birthday ? formatBirthday(result.birthday) : ''
                        });
                    }
                });
            } catch (error) {
                console.warn('Autocomplete 초기화 실패:', error);
            }
        } else {
            console.warn('initAutocomplete 함수를 찾을 수 없습니다');
        }
    }

    function selectArtist(item) {
        console.log('selectArtist 호출:', item);
        
        const resultsEl = document.getElementById("artist-member-results");
        const searchEl = document.getElementById("artist-member-search");
        const artistIdEl = document.getElementById("check_artist_id");
        const memberIdEl = document.getElementById("check_member_id");
        const selectedTextEl = document.getElementById("selected-artist-text");
        const selectedEl = document.getElementById("selected-artist");
        
        if (resultsEl) resultsEl.classList.add("hidden");
        if (searchEl) searchEl.value = `${item.member_name} (${item.artist_display})`;
        if (artistIdEl) artistIdEl.value = item.artist_id || '';
        if (memberIdEl) memberIdEl.value = item.member_id || '';
        if (selectedTextEl) selectedTextEl.textContent = `✓ ${item.member_name} (${item.artist_display}) 선택됨`;
        if (selectedEl) selectedEl.classList.remove("hidden");
        
        // 아티스트 선택 후 중복 확인 버튼 상태 업데이트
        if (typeof window.checkDuplicateBtnState === 'function') {
            window.checkDuplicateBtnState();
        }
    }

    function formatBirthday(birthday) {
        const date = new Date(birthday);
        return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    // 이미지 업로드 초기화
    function initializeImageUpload() {
        console.log('이미지 업로드 초기화');
        
        const imageInput = document.getElementById("images");
        if (!imageInput) return;
        
        const uploadLabel = document.querySelector('label[for="images"]');
        if (!uploadLabel) return;
        
        const uploadArea = uploadLabel.parentElement;

        imageInput.addEventListener("change", handleImagePreview);

        // 드래그 앤 드롭 지원
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
        if (!input || !preview) return;
        
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

    // 지도 검색 초기화
    function initializeMapSearch() {
        console.log('지도 검색 초기화');
        
        const searchBtn = document.getElementById("searchBtn");
        const placeInput = document.getElementById("place-search");

        if (searchBtn) {
            searchBtn.addEventListener('click', searchPlace);
        }
        if (placeInput) {
            placeInput.addEventListener("keydown", e => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    searchPlace();
                }
            });
        }
    }

    function initializeMap() {
        console.log('지도 초기화');
        
        const mapContainer = document.getElementById('map');
        if (!mapContainer) return;
        
        if (typeof kakao === 'undefined' || !kakao.maps) {
            console.warn('Kakao Maps API를 찾을 수 없습니다');
            return;
        }
        
        try {
            const mapOption = {
                center: new kakao.maps.LatLng(37.5665, 126.9780), // 서울 중심
                level: 3
            };

            map = new kakao.maps.Map(mapContainer, mapOption);
            
            // 지도 로딩 완료 후 placeholder 숨기기
            const placeholder = document.getElementById('mapPlaceholder');
            if (placeholder) {
                placeholder.style.display = 'none';
            }
            
            console.log('지도 초기화 완료');
        } catch (error) {
            console.error('지도 초기화 실패:', error);
        }
    }

    function searchPlace() {
        console.log('장소 검색');
        
        if (!map) initializeMap();
        
        if (!ps && typeof kakao !== 'undefined' && kakao.maps) {
            ps = new kakao.maps.services.Places();
            marker = new kakao.maps.Marker({ map });
        }

        const placeInput = document.getElementById("place-search");
        const keyword = placeInput?.value?.trim();
        if (!keyword) {
            alert('검색어를 입력해주세요.');
            return;
        }

        if (!ps) {
            alert('지도 서비스를 사용할 수 없습니다.');
            return;
        }

        ps.keywordSearch(keyword, (data, status) => {
            const results = document.getElementById('place-results');
            if (!results) return;
            
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
        console.log('장소 선택:', place);
        
        if (!map || !marker) return;
        
        const latlng = new kakao.maps.LatLng(place.y, place.x);
        map.setCenter(latlng);
        marker.setPosition(latlng);

        // 선택된 장소 표시
        const selectedPlace = document.getElementById('selected-place');
        if (selectedPlace) {
            selectedPlace.innerHTML = `
                <div class="flex items-center justify-between">
                    <div>
                        <p class="font-medium text-green-800">${place.place_name}</p>
                        <p class="text-sm text-green-600">${place.road_address_name || place.address_name}</p>
                    </div>
                    <svg class="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                    </svg>
                </div>`;
            selectedPlace.classList.remove('hidden');
        }

        // 폼 필드 업데이트
        const fields = {
            "place_name": place.place_name,
            "address": place.address_name,
            "road_address": place.road_address_name || '',
            "latitude": place.y,
            "longitude": place.x,
            "kakao_place_id": place.id
        };

        Object.entries(fields).forEach(([id, value]) => {
            setElementValue(id, value);
        });

        // 검색 결과 숨기기
        const placeResults = document.getElementById('place-results');
        if (placeResults) {
            placeResults.classList.add('hidden');
        }
    }

    // 폼 제출 초기화
    function initializeFormSubmit() {
        console.log('폼 제출 초기화');
        
        const form = document.getElementById('multiStepForm');
        if (!form) return;
        
        form.addEventListener('submit', function () {
            console.log('폼 제출 처리');
            
            // 모든 입력 필드 활성화 (disabled 해제)
            const allInputs = this.querySelectorAll('input, textarea, select');
            allInputs.forEach(input => input.disabled = false);

            // X(트위터) 사용자명을 URL로 변환
            const xUsernameInput = document.querySelector('[name="x_username"]');
            const xUsername = xUsernameInput?.value?.trim();
            if (xUsername) {
                const xInput = document.createElement('input');
                xInput.type = 'hidden';
                xInput.name = 'x_source';
                xInput.value = `https://x.com/${xUsername.replace('@', '')}`;
                this.appendChild(xInput);
            }
        });
    }
});