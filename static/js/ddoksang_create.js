// static/js/ddoksang_create.js (모듈화된 최적화 버전)

document.addEventListener('DOMContentLoaded', function() {
    // 의존성 확인
    if (!window.DdoksangFormUtils || !window.DdoksangMapUtils || !window.DdoksangImageUtils) {
        console.error('필수 유틸리티 모듈이 로드되지 않았습니다.');
        return;
    }

    // 전역 참조
    const FormUtils = window.DdoksangFormUtils;
    const MapUtils = window.DdoksangMapUtils;
    const ImageUtils = window.DdoksangImageUtils;

    // 상태 변수
    const steps = document.querySelectorAll(".step");
    const progressBar = document.getElementById("progressBar");
    const nextBtn = document.getElementById("nextBtn");
    const prevBtn = document.getElementById("prevBtn");
    const totalSteps = steps.length;
    let currentStep = 0;
    let duplicateChecked = false;
    let isDuplicate = false;

    console.log(`총 ${totalSteps}개 단계 발견`);

    // 초기화
    init();

    function init() {
        initializeDatePickers();
        initializeAutocomplete();
        initializeImageUpload();
        initializeMapSearch();
        initializeFormSubmit();
        initDuplicateChecker();
        setupEventListeners();
        showStep(currentStep);
    }

    function setupEventListeners() {
        if (nextBtn) nextBtn.addEventListener("click", () => moveStep(1));
        if (prevBtn) prevBtn.addEventListener("click", () => moveStep(-1));
    }

    // 단계별 검증 규칙
    const stepValidationRules = {
        1: ['final_artist_id'],
        2: ['cafe_name', 'address', 'latitude', 'longitude'],
        3: ['start_date', 'end_date'],
        4: ['event_description'],
        5: [], // 선택사항
        6: []  // 선택사항
    };

    function showStep(index) {
        console.log(`Step ${index} 표시`);
        
        steps.forEach((step, i) => {
            step.classList.toggle("hidden", i !== index);
        });

        if (progressBar) {
            progressBar.style.width = `${(index / (totalSteps - 1)) * 100}%`;
        }

        updateNavigationButtons(index);
        addStepValidationListeners(index);
        updateNextButtonState();

        // 지도 초기화 (Step 2)
        if (index === 2 && !MapUtils.map) {
            setTimeout(() => MapUtils.initMap(), 100);
        }
    }

    function updateNavigationButtons(index) {
        const isFirstStep = index === 0;
        const isLastStep = index === totalSteps - 1;

        // Step 0에서는 버튼 숨김
        if (isFirstStep) {
            if (prevBtn) prevBtn.classList.add("hidden");
            if (nextBtn) nextBtn.classList.add("hidden");
        } else {
            if (prevBtn) {
                prevBtn.classList.remove("hidden");
                FormUtils.updateButtonState('prevBtn', true);
            }
            if (nextBtn) {
                nextBtn.classList.remove("hidden");
                nextBtn.textContent = isLastStep ? "제출하기" : "다음";
            }
        }
    }

    function moveStep(direction) {
        console.log(`Step 이동: ${direction}, 현재: ${currentStep}`);
        
        if (direction === -1 && currentStep > 1) {
            currentStep -= 1;
            showStep(currentStep);
            return;
        }

        if (direction === 1) {
            // Step 0에서 Step 1로: 중복 확인
            if (currentStep === 0) {
                if (!duplicateChecked || isDuplicate) {
                    FormUtils.showToast(isDuplicate ? 
                        "중복된 생카가 존재합니다. 다른 정보로 입력해주세요." : 
                        "중복 확인을 먼저 해주세요.", 'warning');
                    return;
                }
                setupStep1Preview();
            }

            // 현재 단계 검증
            if (!validateCurrentStep()) return;

            // Step 2로 들어갈 때 데이터 복사
            if (currentStep + direction === 2) {
                copyDataToForm();
            }

            // 마지막 단계에서 제출
            if (currentStep === totalSteps - 1) {
                document.getElementById("multiStepForm")?.submit();
                return;
            }

            currentStep += direction;
            showStep(currentStep);
        }
    }

    function validateCurrentStep() {
        const rules = stepValidationRules[currentStep];
        if (!rules) return true;

        // 필수 필드 검증
        const validation = FormUtils.validateRequired(rules);
        if (!validation.valid) {
            FormUtils.showToast(`${getFieldLabel(validation.field)}을(를) 입력해주세요.`, 'warning');
            return false;
        }

        // Step 3 날짜 검증
        if (currentStep === 3) {
            const dateValidation = FormUtils.validateDateRange('start_date', 'end_date');
            if (!dateValidation.valid) {
                FormUtils.showToast(dateValidation.message, 'warning');
                return false;
            }
        }

        return true;
    }

    function getFieldLabel(fieldId) {
        const labels = {
            'final_artist_id': '아티스트',
            'cafe_name': '생카명',
            'address': '주소',
            'start_date': '시작일',
            'end_date': '종료일',
            'event_description': '이벤트 설명'
        };
        return labels[fieldId] || fieldId;
    }

    function addStepValidationListeners(stepIndex) {
        const stepElement = document.getElementById(`step-${stepIndex}`);
        if (!stepElement || stepElement.hasAttribute('data-listeners-added')) return;
        
        stepElement.setAttribute('data-listeners-added', 'true');
        
        const rules = stepValidationRules[stepIndex];
        if (rules) {
            rules.forEach(fieldId => {
                const element = document.getElementById(fieldId);
                if (element) {
                    element.addEventListener('input', updateNextButtonState);
                    element.addEventListener('change', updateNextButtonState);
                }
            });
        }

        // 지도 검색 필드 특별 처리
        if (stepIndex === 2) {
            const placeInput = document.getElementById('place-search');
            if (placeInput) {
                placeInput.addEventListener('input', updateNextButtonState);
            }
        }
    }

    function updateNextButtonState() {
        if (!nextBtn || currentStep === 0) return;
        
        const rules = stepValidationRules[currentStep];
        const isValid = rules ? FormUtils.validateRequired(rules, false).valid : true;
        
        FormUtils.updateButtonState('nextBtn', isValid);
        console.log(`Step ${currentStep} 버튼 상태:`, isValid);
    }

    function setupStep1Preview() {
        FormUtils.toggleClass('step1-confirm-mode', 'hidden', false);
        FormUtils.toggleClass('step1-search-mode', 'hidden', true);
    }

    function copyDataToForm() {
        const cafeName = FormUtils.getValue('check_cafe_name');
        FormUtils.setValue('cafe_name', cafeName);
    }

    // 중복 확인 로직
    function initDuplicateChecker() {
        const checkBtn = document.getElementById('check-duplicate-btn');
        if (!checkBtn) return;

        function updateDuplicateBtn() {
            const required = ['check_artist_id', 'check_cafe_name', 'check_start_date', 'check_end_date'];
            const validation = FormUtils.validateRequired(required, false);
            FormUtils.updateButtonState('check-duplicate-btn', validation.valid);
        }

        // 전역 함수로 설정
        window.checkDuplicateBtnState = updateDuplicateBtn;

        // 입력 필드 이벤트 리스너
        ['check_cafe_name', 'check_start_date', 'check_end_date'].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('input', updateDuplicateBtn);
                element.addEventListener('change', updateDuplicateBtn);
            }
        });

        // 중복 확인 버튼 클릭
        checkBtn.addEventListener('click', async function() {
            const data = {
                artist_id: FormUtils.getValue('check_artist_id'),
                member_id: FormUtils.getValue('check_member_id'),
                cafe_name: FormUtils.getValue('check_cafe_name'),
                start_date: FormUtils.getValue('check_start_date'),
                end_date: FormUtils.getValue('check_end_date')
            };

            if (!data.artist_id || !data.cafe_name || !data.start_date || !data.end_date) {
                FormUtils.showToast('모든 정보를 입력해주세요.', 'warning');
                return;
            }

            // 로딩 상태
            checkBtn.disabled = true;
            checkBtn.textContent = '확인 중...';
            checkBtn.className = checkBtn.className.replace(/bg-\w+-\d+/, 'bg-gray-600');

            try {
                const url = `/ddoksang/cafe/check-duplicate/?` + 
                    Object.entries(data).map(([k,v]) => `${k}=${encodeURIComponent(v)}`).join('&');
                
                const response = await fetch(url);
                const result = await response.json();
                
                duplicateChecked = true;
                isDuplicate = result.exists;

                FormUtils.toggleClass('duplicate-warning', 'hidden', !result.exists);
                FormUtils.toggleClass('duplicate-success', 'hidden', result.exists);

                if (!result.exists) {
                    FormUtils.showToast('중복되지 않습니다!', 'success');
                    setTimeout(() => {
                        currentStep = 1;
                        showStep(currentStep);
                    }, 1500);
                } else {
                    FormUtils.showToast('유사한 생카가 발견되었습니다.', 'warning');
                }
            } catch (error) {
                console.error('중복 확인 오류:', error);
                FormUtils.showToast('중복 확인 중 오류가 발생했습니다.', 'warning');
            } finally {
                checkBtn.disabled = false;
                checkBtn.textContent = '중복 확인하기';
                updateDuplicateBtn();
            }
        });

        updateDuplicateBtn();
    }

    // 날짜 선택기 초기화
    function initializeDatePickers() {
        if (typeof flatpickr === 'undefined') return;

        // 중복 확인용
        flatpickr("#check_start_date", { 
            dateFormat: "Y-m-d",
            onChange: () => window.checkDuplicateBtnState?.()
        });
        flatpickr("#check_end_date", { 
            dateFormat: "Y-m-d",
            onChange: () => window.checkDuplicateBtnState?.()
        });

        // 실제 폼용
        flatpickr("#start_date", {
            dateFormat: "Y-m-d",
            defaultDate: new Date(),
            onChange: () => updateNextButtonState()
        });
        flatpickr("#end_date", {
            dateFormat: "Y-m-d", 
            defaultDate: new Date(),
            onChange: () => updateNextButtonState()
        });
    }

    // Autocomplete 초기화
    function initializeAutocomplete() {
        if (typeof initAutocomplete !== 'function') return;

        const autocompleteConfig = {
            showBirthday: true,
            showArtistTag: false,
            submitOnSelect: false,
            artistOnly: false,
            apiUrl: '/artist/autocomplete/'
        };

        // Step 0용
        initAutocomplete('artist-member-search', 'artist-member-results', {
            ...autocompleteConfig,
            onSelect: (result) => selectArtist(result, 'check')
        });
    }

    function selectArtist(result, prefix) {
        const data = FormUtils.normalizeArtistData({
            member_name: result.name,
            artist_display: result.artist || result.artist_name,
            artist_id: result.artist_id,
            member_id: result.id || result.member_id
        });

        // 폼 필드 업데이트
        FormUtils.setValue(`${prefix}_artist_id`, data.artistId);
        FormUtils.setValue(`${prefix}_member_id`, data.memberId);
        FormUtils.setValue(`artist-member-search`, data.displayText);
        FormUtils.setText('selected-artist-text', `✓ ${data.displayText} 선택됨`);
        
        // UI 업데이트
        FormUtils.toggleClass('artist-member-results', 'hidden', true);
        FormUtils.toggleClass('selected-artist', 'hidden', false);
        
        if (prefix === 'check') {
            window.checkDuplicateBtnState?.();
        } else {
            updateNextButtonState();
        }
    }

    // 이미지 업로드 초기화
    function initializeImageUpload() {
        const imageInput = document.getElementById("images");
        const uploadArea = document.querySelector('label[for="images"]')?.parentElement;
        
        if (!imageInput || !uploadArea) return;

        ImageUtils.setupDragAndDrop(uploadArea.id || 'image-upload-area', 'images');
        imageInput.addEventListener("change", handleImagePreview);
    }

    async function handleImagePreview() {
        const input = document.getElementById("images");
        const preview = document.getElementById("image-preview");
        if (!input || !preview) return;
        
        preview.innerHTML = "";

        const validation = FormUtils.validateImageFiles(Array.from(input.files));
        if (!validation.valid) {
            FormUtils.showToast(validation.message, 'warning');
            input.value = "";
            return;
        }

        for (let i = 0; i < input.files.length; i++) {
            const previewElement = await ImageUtils.createPreview(input.files[i], i, i === 0);
            preview.appendChild(previewElement);
        }
    }

    // 지도 검색 초기화
    function initializeMapSearch() {
        const searchBtn = document.getElementById("searchBtn");
        const placeInput = document.getElementById("place-search");

        if (searchBtn) {
            searchBtn.className = "bg-gray-900 text-white px-4 rounded hover:bg-gray-800 transition-colors";
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

    function searchPlace() {
        const keyword = FormUtils.getValue('place-search');
        if (!keyword) {
            FormUtils.showToast('검색어를 입력해주세요.', 'warning');
            return;
        }

        if (!MapUtils.map) MapUtils.initMap();

        MapUtils.searchPlaces(keyword, (success, data) => {
            const results = document.getElementById('place-results');
            if (!results) return;
            
            if (success) {
                results.innerHTML = '';
                results.classList.remove('hidden');
                
                data.forEach(place => {
                    const li = document.createElement('li');
                    li.textContent = `${place.place_name} (${place.road_address_name || place.address_name})`;
                    li.className = 'px-4 py-2 cursor-pointer hover:bg-gray-100 border-b last:border-none text-sm';
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
        MapUtils.selectPlace(place);
        
        // 선택된 장소 UI 업데이트
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

        // 검색 결과 숨기기
        FormUtils.toggleClass('place-results', 'hidden', true);
        updateNextButtonState();
    }

    // 폼 제출 초기화
    function initializeFormSubmit() {
        const form = document.getElementById('multiStepForm');
        if (!form) return;
        
        form.addEventListener('submit', function() {
            // 모든 입력 필드 활성화
            this.querySelectorAll('input, textarea, select').forEach(input => {
                input.disabled = false;
            });

            // X 사용자명을 URL로 변환
            const xUsername = FormUtils.getValue('x_username');
            if (xUsername) {
                const xInput = document.createElement('input');
                xInput.type = 'hidden';
                xInput.name = 'x_source';
                xInput.value = `https://x.com/${xUsername.replace('@', '')}`;
                this.appendChild(xInput);
            }
        });
    }

    // 전역 함수들 (HTML onclick에서 사용)
    window.clearSelection = () => {
        ['artist-member-search', 'check_artist_id', 'check_member_id'].forEach(id => {
            FormUtils.setValue(id, '');
        });
        ['selected-artist', 'duplicate-warning', 'duplicate-success'].forEach(id => {
            FormUtils.toggleClass(id, 'hidden', true);
        });
        duplicateChecked = false;
        isDuplicate = false;
        window.checkDuplicateBtnState?.();
    };

    window.removeImage = (index) => {
        ImageUtils.removeImageAt('images', index);
        handleImagePreview();
    };

    window.useSelectedArtist = () => {
        const artistId = FormUtils.getValue('check_artist_id');
        const memberId = FormUtils.getValue('check_member_id');
        
        FormUtils.setValue('final_artist_id', artistId);
        FormUtils.setValue('final_member_id', memberId);
        
        setTimeout(() => {
            currentStep = 2;
            showStep(currentStep);
        }, 300);
    };

    window.showArtistSearch = () => {
        FormUtils.toggleClass('step1-confirm-mode', 'hidden', true);
        FormUtils.toggleClass('step1-search-mode', 'hidden', false);
        document.getElementById('final-artist-member-search')?.focus();
        updateNextButtonState();
    };

    window.cancelArtistSearch = () => {
        FormUtils.toggleClass('step1-search-mode', 'hidden', true);
        FormUtils.toggleClass('step1-confirm-mode', 'hidden', false);
        updateNextButtonState();
    };
});