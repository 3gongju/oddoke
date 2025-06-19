// ddoksang_create.js - 이미지 업로드 연동 수정 버전

document.addEventListener('DOMContentLoaded', function() {
    console.log('덕생 등록 페이지 초기화 시작');
    
    // 전역 변수
    let currentStep = 0;
    let duplicateChecked = false;
    let isDuplicate = false;
    
    const steps = document.querySelectorAll('.step');
    const totalSteps = steps.length;
    const progressBar = document.getElementById('progressBar');
    const nextBtn = document.getElementById('nextBtn');
    const prevBtn = document.getElementById('prevBtn');
    
    // 초기화
    init();
    
    function init() {
        console.log('초기화 시작');
        
        // 1. 날짜 입력 활성화
        enableAllDateInputs();
        
        // 2. 중복 확인 설정
        setupDuplicateCheck();
        
        // 3. 네비게이션 버튼 설정
        setupNavigation();
        
        // 4. 자동완성 설정
        setupAutocomplete();
        
        // 5. 지도 검색 설정
        setupMapSearch();
        
        // 6. 첫 번째 스텝 표시
        showStep(0);
        
        console.log('초기화 완료');
    }
    
    // 1. 모든 날짜 입력 활성화
    function enableAllDateInputs() {
        console.log('날짜 입력 활성화 시작');
        
        // DdoksangDateUtils 사용 가능한 경우
        if (window.DdoksangDateUtils) {
            window.DdoksangDateUtils.forceEnableAllDateFields();
            
            // flatpickr 초기화
            setTimeout(() => {
                window.DdoksangDateUtils.initDuplicateCheckPickers();
                window.DdoksangDateUtils.initCreateFormPickers();
            }, 100);
        } else {
            // 직접 활성화
            const dateFields = ['check_start_date', 'check_end_date', 'start_date', 'end_date'];
            
            dateFields.forEach(fieldId => {
                const field = document.getElementById(fieldId);
                if (field) {
                    // 강제 활성화
                    field.disabled = false;
                    field.readOnly = false;
                    field.removeAttribute('disabled');
                    field.removeAttribute('readonly');
                    field.style.pointerEvents = 'auto';
                    field.style.backgroundColor = 'white';
                    field.style.cursor = 'text';
                    field.style.opacity = '1';
                    
                    // 자동 하이픈 추가
                    field.addEventListener('input', function(e) {
                        let value = e.target.value.replace(/\D/g, '');
                        if (value.length >= 4) value = value.substring(0, 4) + '-' + value.substring(4);
                        if (value.length >= 7) value = value.substring(0, 7) + '-' + value.substring(7, 9);
                        if (value.length > 10) value = value.substring(0, 10);
                        e.target.value = value;
                        
                        // 중복 확인 버튼 상태 업데이트
                        if (fieldId.startsWith('check_')) {
                            updateDuplicateButton();
                        }
                    });
                    
                    console.log(`날짜 필드 직접 활성화: ${fieldId}`);
                }
            });
        }
        
        // 전역 함수로 등록
        window.updateDuplicateButton = updateDuplicateButton;
        
        console.log('날짜 입력 활성화 완료');
    }
    
    // 2. 중복 확인 설정
    function setupDuplicateCheck() {
        const button = document.getElementById('check-duplicate-btn');
        const cafeNameInput = document.getElementById('check_cafe_name');
        
        if (!button) return;
        
        // 카페명 입력 이벤트
        if (cafeNameInput) {
            cafeNameInput.addEventListener('input', updateDuplicateButton);
        }
        
        // 버튼 클릭 이벤트
        button.addEventListener('click', performDuplicateCheck);
        
        // 초기 버튼 상태 업데이트
        updateDuplicateButton();
        
        console.log('중복 확인 설정 완료');
    }
    
    function updateDuplicateButton() {
        const button = document.getElementById('check-duplicate-btn');
        if (!button) return;
        
        const artistId = document.getElementById('check_artist_id')?.value?.trim();
        const cafeName = document.getElementById('check_cafe_name')?.value?.trim();
        const startDate = document.getElementById('check_start_date')?.value?.trim();
        const endDate = document.getElementById('check_end_date')?.value?.trim();
        
        const isValid = artistId && cafeName && startDate && endDate;
        
        button.disabled = false; // 항상 클릭 가능
        button.style.pointerEvents = 'auto';
        
        if (isValid) {
            button.className = 'w-full px-6 py-3 bg-gray-900 text-white rounded-lg font-medium transition-colors hover:bg-gray-800 cursor-pointer';
        } else {
            button.className = 'w-full px-6 py-3 bg-gray-400 text-gray-200 rounded-lg font-medium transition-colors cursor-not-allowed';
        }
    }
    
    function performDuplicateCheck(e) {
        e.preventDefault();
        
        const artistId = document.getElementById('check_artist_id')?.value?.trim();
        const cafeName = document.getElementById('check_cafe_name')?.value?.trim();
        const startDate = document.getElementById('check_start_date')?.value?.trim();
        const endDate = document.getElementById('check_end_date')?.value?.trim();
        
        if (!artistId || !cafeName || !startDate || !endDate) {
            alert('모든 항목을 입력해주세요.');
            return;
        }
        
        const button = e.target;
        const originalText = button.textContent;
        button.textContent = '확인 중...';
        button.disabled = true;
        
        const url = `/ddoksang/cafe/check-duplicate/?artist_id=${artistId}&cafe_name=${encodeURIComponent(cafeName)}&start_date=${startDate}&end_date=${endDate}`;
        
        fetch(url)
            .then(response => response.json())
            .then(data => {
                console.log('중복 확인 결과:', data);
                
                if (data.exists) {
                    alert(`유사한 생일카페가 ${data.similar_count || 1}개 발견되었습니다.`);
                    isDuplicate = true;
                } else {
                    isDuplicate = false;
                    duplicateChecked = true;
                    showDuplicateSuccess();
                }
            })
            .catch(error => {
                console.error('중복 확인 오류:', error);
                alert('중복 확인 중 오류가 발생했습니다.');
            })
            .finally(() => {
                button.textContent = originalText;
                button.disabled = false;
            });
    }
    
    function showDuplicateSuccess() {
        // 현재 폼 숨기기
        const currentForm = document.getElementById('duplicate-check-form');
        if (currentForm) currentForm.style.display = 'none';
        
        // 제목, 설명, 진행바 숨기기
        const section = document.querySelector('section.max-w-4xl');
        if (section) {
            const title = section.querySelector('h1');
            const description = section.querySelector('p');
            const progressBarContainer = section.querySelector('.w-full.bg-gray-200.rounded-full');
            
            if (title) title.style.display = 'none';
            if (description) description.style.display = 'none';
            if (progressBarContainer) progressBarContainer.style.display = 'none';
        }
        
        // 성공 메시지 표시
        const step0 = document.getElementById('step-0');
        if (step0) {
            const successDiv = document.createElement('div');
            successDiv.className = 'text-center mb-8 p-6 bg-green-50 border border-green-200 rounded-lg';
            successDiv.innerHTML = `
                <div class="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <h2 class="text-xl font-bold text-green-800 mb-2">중복 확인 완료!</h2>
                <p class="text-green-700 mb-4">새로운 카페를 등록할 수 있습니다.</p>
                <button id="proceed-to-next" class="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors">
                    다음 단계로 진행 →
                </button>
            `;
            
            step0.appendChild(successDiv);
            
            // 진행 버튼 이벤트
            document.getElementById('proceed-to-next').addEventListener('click', function() {
                copyFormData();
                showStep(1);
            });
        }
        
        console.log('중복 확인 성공 화면 표시');
    }
    
    function copyFormData() {
        // 중복 확인에서 입력한 데이터를 다음 단계로 복사
        const artistId = document.getElementById('check_artist_id')?.value;
        const memberId = document.getElementById('check_member_id')?.value;
        const cafeName = document.getElementById('check_cafe_name')?.value;
        const startDate = document.getElementById('check_start_date')?.value;
        const endDate = document.getElementById('check_end_date')?.value;
        
        // Step 1의 hidden 필드에 복사
        setValue('final_artist_id', artistId);
        setValue('final_member_id', memberId);
        
        // Step 2의 카페 정보에 복사
        setValue('cafe_name', cafeName);
        
        // Step 3의 날짜 정보에 복사
        setValue('start_date', startDate);
        setValue('end_date', endDate);
        
        console.log('폼 데이터 복사 완료');
    }
    
    // 3. 네비게이션 설정
    function setupNavigation() {
        if (nextBtn) {
            nextBtn.addEventListener('click', function(e) {
                e.preventDefault();
                moveToNextStep();
            });
        }
        
        if (prevBtn) {
            prevBtn.addEventListener('click', function(e) {
                e.preventDefault();
                moveToPrevStep();
            });
        }
        
        console.log('네비게이션 설정 완료');
    }
    
    function moveToNextStep() {
        // Step 0에서는 중복 확인이 완료되어야 함
        if (currentStep === 0) {
            if (!duplicateChecked || isDuplicate) {
                alert('중복 확인을 먼저 완료해주세요.');
                return;
            }
        }
        
        // 현재 스텝 유효성 검사
        if (!validateCurrentStep()) {
            return;
        }
        
        // 마지막 스텝이면 제출
        if (currentStep === totalSteps - 1) {
            submitForm();
            return;
        }
        
        // 다음 스텝으로 이동
        showStep(currentStep + 1);
    }
    
    function moveToPrevStep() {
        if (currentStep > 0) {
            showStep(currentStep - 1);
        }
    }
    
    function validateCurrentStep() {
        const stepValidationRules = {
            1: ['final_artist_id'],
            2: ['cafe_name', 'address', 'latitude', 'longitude'],
            3: ['start_date', 'end_date'],
            4: ['event_description'],
            5: [], // 선택사항
            6: [] // ✅ 이미지는 별도 검증
        };
        
        const rules = stepValidationRules[currentStep];
        if (!rules) return true;
        
        // ✅ Step 6에서는 이미지 업로더를 통한 검증
        if (currentStep === 6) {
            return validateImages();
        }
        
        // 일반 필드 검증
        for (const fieldId of rules) {
            const field = document.getElementById(fieldId);
            if (field && !field.value.trim()) {
                alert(`${getFieldName(fieldId)}을(를) 입력해주세요.`);
                field.focus();
                return false;
            }
        }
        
        // 날짜 범위 검증
        if (currentStep === 3) {
            const startDate = document.getElementById('start_date')?.value;
            const endDate = document.getElementById('end_date')?.value;
            
            if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
                alert('종료일은 시작일보다 늦어야 합니다.');
                return false;
            }
        }
        
        return true;
    }
    
    // ✅ 이미지 검증 함수 추가
    function validateImages() {
        console.log('📸 이미지 검증 시작');
        
        if (!window.ddoksangImageUploader) {
            console.error('❌ 이미지 업로더가 초기화되지 않았습니다');
            alert('이미지 업로더를 초기화하는 중입니다. 잠시 후 다시 시도해주세요.');
            return false;
        }
        
        const fileCount = window.ddoksangImageUploader.getFileCount();
        const formFileCount = window.ddoksangImageUploader.getFormFileCount();
        
        console.log('📊 이미지 검증 상태:', {
            선택된파일: fileCount,
            폼파일: formFileCount
        });
        
        if (fileCount === 0) {
            alert('최소 1개의 이미지를 업로드해주세요.');
            return false;
        }
        
        // ✅ 폼 파일 동기화 확인
        if (fileCount > 0 && formFileCount === 0) {
            console.warn('⚠️ 파일 동기화 문제 감지 - 수동 동기화 실행');
            window.ddoksangImageUploader.syncFormFiles();
            
            // 동기화 후 재확인
            const newFormFileCount = window.ddoksangImageUploader.getFormFileCount();
            if (newFormFileCount === 0) {
                alert('이미지 업로드에 문제가 있습니다. 이미지를 다시 선택해주세요.');
                return false;
            }
        }
        
        console.log('✅ 이미지 검증 통과');
        return true;
    }
    
    function getFieldName(fieldId) {
        const fieldNames = {
            'final_artist_id': '아티스트',
            'cafe_name': '카페명',
            'address': '주소',
            'start_date': '시작일',
            'end_date': '종료일',
            'event_description': '이벤트 설명'
        };
        return fieldNames[fieldId] || fieldId;
    }
    
    function showStep(index) {
        console.log(`Step ${index} 표시`);
        
        currentStep = index;
        
        // 모든 스텝 숨기기
        steps.forEach((step, i) => {
            step.classList.toggle('hidden', i !== index);
        });
        
        // 진행바 업데이트
        if (progressBar) {
            progressBar.style.width = `${(index / (totalSteps - 1)) * 100}%`;
        }
        
        // 네비게이션 버튼 상태 업데이트
        updateNavigationButtons(index);
        
        // ✅ Step 2에서 지도 초기화
        if (index === 2 && window.DdoksangMapUtils && !window.DdoksangMapUtils.map) {
            setTimeout(() => {
                window.DdoksangMapUtils.initMap();
            }, 100);
        }
        
        // ✅ Step 6에서 이미지 업로더 초기화
        if (index === 6) {
            setTimeout(() => {
                initializeImageUploader();
            }, 100);
        }
    }
    
    // ✅ 이미지 업로더 초기화 함수 추가
    function initializeImageUploader() {
        console.log('🖼️ 이미지 업로더 초기화 시작');
        
        // 이미 초기화된 경우 재사용
        if (window.ddoksangImageUploader && window.ddoksangImageUploader.isInitialized) {
            console.log('✅ 이미지 업로더 이미 초기화됨');
            
            // 상태 검증 및 동기화
            const validation = window.ddoksangImageUploader.validateState();
            if (validation.needsSync) {
                console.log('🔄 기존 업로더 동기화 실행');
                window.ddoksangImageUploader.syncFormFiles();
            }
            
            return;
        }
        
        // 필수 DOM 요소 확인
        const requiredElements = [
            'image-upload',
            'file-count', 
            'image-preview-container',
            'image-preview-list'
        ];
        
        const missingElements = requiredElements.filter(id => !document.getElementById(id));
        if (missingElements.length > 0) {
            console.error('❌ 필수 DOM 요소 누락:', missingElements);
            return;
        }
        
        // 이미지 업로더 초기화
        try {
            const uploader = window.initDdoksangImageUpload();
            
            if (uploader && uploader.isInitialized) {
                console.log('✅ 이미지 업로더 초기화 성공');
                
                // 파일 변경 이벤트 리스너 추가
                document.addEventListener('filesUpdated', function(event) {
                    console.log('📁 파일 업데이트 이벤트:', event.detail);
                    updateNextButtonState();
                });
                
                // 초기 버튼 상태 설정
                updateNextButtonState();
                
            } else {
                console.error('❌ 이미지 업로더 초기화 실패');
            }
        } catch (error) {
            console.error('❌ 이미지 업로더 초기화 오류:', error);
        }
    }
    
    // ✅ 다음 버튼 상태 업데이트 함수 추가
    function updateNextButtonState() {
        if (currentStep !== 6 || !nextBtn) return;
        
        const hasImages = window.ddoksangImageUploader ? 
            window.ddoksangImageUploader.getFileCount() > 0 : false;
        
        if (hasImages) {
            nextBtn.disabled = false;
            nextBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            nextBtn.classList.add('hover:bg-gray-800');
            nextBtn.textContent = '제출';
        } else {
            nextBtn.disabled = true;
            nextBtn.classList.add('opacity-50', 'cursor-not-allowed');
            nextBtn.classList.remove('hover:bg-gray-800');
            nextBtn.textContent = '이미지를 업로드해주세요';
        }
        
        console.log('🔘 다음 버튼 상태 업데이트:', { hasImages, disabled: nextBtn.disabled });
    }
    
    function updateNavigationButtons(index) {
        const isFirstStep = index === 0;
        const isLastStep = index === totalSteps - 1;
        
        if (isFirstStep) {
            if (prevBtn) prevBtn.classList.add('hidden');
            if (nextBtn) nextBtn.classList.add('hidden');
        } else {
            if (prevBtn) {
                prevBtn.classList.remove('hidden');
                prevBtn.style.display = 'flex';
            }
            if (nextBtn) {
                nextBtn.classList.remove('hidden');
                nextBtn.style.display = 'flex';
                
                if (isLastStep) {
                    nextBtn.innerHTML = '제출';
                    nextBtn.style.fontSize = '14px';
                    nextBtn.style.fontWeight = '600';
                } else {
                    nextBtn.innerHTML = '›';
                    nextBtn.style.fontSize = '24px';
                    nextBtn.style.fontWeight = 'bold';
                }
            }
        }
    }
    
    // 4. 자동완성 설정
    function setupAutocomplete() {
        if (typeof initAutocomplete === 'function') {
            // 중복 확인용 자동완성
            initAutocomplete('artist-member-search', 'artist-member-results', {
                showBirthday: true,
                showArtistTag: false,
                submitOnSelect: false,
                onSelect: handleArtistSelection
            });
            
            // Step 1용 자동완성
            initAutocomplete('final-artist-member-search', 'final-artist-member-results', {
                showBirthday: true,
                showArtistTag: false,
                submitOnSelect: false,
                onSelect: handleFinalArtistSelection
            });
            
            console.log('자동완성 설정 완료');
        }
    }
    
    function handleArtistSelection(result) {
        setValue('check_artist_id', result.artist_id);
        setValue('check_member_id', result.member_id || '');
        
        // UI 업데이트
        const searchInput = document.getElementById('artist-member-search');
        const selectedDiv = document.getElementById('selected-artist');
        const selectedText = document.getElementById('selected-artist-text');
        const resultsList = document.getElementById('artist-member-results');
        
        if (searchInput) searchInput.classList.add('hidden');
        if (selectedDiv) selectedDiv.classList.remove('hidden');
        if (selectedText) selectedText.textContent = result.name;
        if (resultsList) resultsList.classList.add('hidden');
        
        updateDuplicateButton();
    }
    
    function handleFinalArtistSelection(result) {
        setValue('final_artist_id', result.artist_id);
        setValue('final_member_id', result.member_id || '');
        
        // UI 업데이트
        const searchInput = document.getElementById('final-artist-member-search');
        const selectedDiv = document.getElementById('final-selected-artist');
        const selectedText = document.getElementById('final-selected-artist-text');
        const resultsList = document.getElementById('final-artist-member-results');
        
        if (searchInput) searchInput.classList.add('hidden');
        if (selectedDiv) selectedDiv.classList.remove('hidden');
        if (selectedText) selectedText.textContent = result.name;
        if (resultsList) resultsList.classList.add('hidden');
    }
    
    // 5. 지도 검색 설정
    function setupMapSearch() {
        const searchBtn = document.getElementById('searchBtn');
        const placeInput = document.getElementById('place-search');
        
        if (searchBtn) {
            searchBtn.addEventListener('click', searchPlace);
        }
        
        if (placeInput) {
            placeInput.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    searchPlace();
                }
            });
        }
        
        console.log('지도 검색 설정 완료');
    }
    
    function searchPlace() {
        const keyword = getValue('place-search');
        if (!keyword) {
            alert('검색어를 입력해주세요.');
            return;
        }
        
        if (window.DdoksangMapUtils) {
            if (!window.DdoksangMapUtils.map) {
                window.DdoksangMapUtils.initMap();
            }
            
            window.DdoksangMapUtils.searchPlaces(keyword, (success, data) => {
                const results = document.getElementById('place-results');
                if (!results) return;
                
                if (success && data.length > 0) {
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
    }
    
    function selectPlace(place) {
        if (window.DdoksangMapUtils) {
            window.DdoksangMapUtils.selectPlace(place);
        }
        
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
        
        document.getElementById('place-results')?.classList.add('hidden');
    }
    
    // 6. 폼 제출
    function submitForm() {
        if (confirm('모든 내용을 확인하셨나요? 등록하시겠습니까?')) {
            document.getElementById('multiStepForm')?.submit();
        }
    }
    
    // 유틸리티 함수
    function getValue(id) {
        const el = document.getElementById(id);
        return el ? el.value.trim() : '';
    }
    
    function setValue(id, value) {
        const el = document.getElementById(id);
        if (el) el.value = value || '';
    }
    
    // 전역 함수들 (HTML onclick용)
    window.clearSelection = function() {
        setValue('artist-member-search', '');
        setValue('check_artist_id', '');
        setValue('check_member_id', '');
        
        const selectedDiv = document.getElementById('selected-artist');
        const searchInput = document.getElementById('artist-member-search');
        
        if (selectedDiv) selectedDiv.classList.add('hidden');
        if (searchInput) searchInput.classList.remove('hidden');
        
        updateDuplicateButton();
    };
    
    window.useSelectedArtist = function() {
        copyFormData();
        showStep(2);
    };
    
    window.showArtistSearch = function() {
        const confirmMode = document.getElementById('step1-confirm-mode');
        const searchMode = document.getElementById('step1-search-mode');
        
        if (confirmMode) confirmMode.classList.add('hidden');
        if (searchMode) searchMode.classList.remove('hidden');
    };
    
    window.cancelArtistSearch = function() {
        const confirmMode = document.getElementById('step1-confirm-mode');
        const searchMode = document.getElementById('step1-search-mode');
        
        if (searchMode) searchMode.classList.add('hidden');
        if (confirmMode) confirmMode.classList.remove('hidden');
    };
    
    window.confirmNewArtist = function() {
        const finalArtistId = getValue('final_artist_id');
        if (!finalArtistId) {
            alert('아티스트를 선택해주세요.');
            return;
        }
        showStep(2);
    };
    
    window.clearFinalSelection = function() {
        setValue('final-artist-member-search', '');
        setValue('final_artist_id', '');
        setValue('final_member_id', '');
        
        const selectedDiv = document.getElementById('final-selected-artist');
        const searchInput = document.getElementById('final-artist-member-search');
        
        if (selectedDiv) selectedDiv.classList.add('hidden');
        if (searchInput) searchInput.classList.remove('hidden');
    };
    
    // ✅ 전역 앱 객체 생성 (다른 모듈에서 접근 가능)
    window.ddoksangApp = {
        currentStep: () => currentStep,
        moveToStep: showStep,
        updateNextButtonState: updateNextButtonState,
        validateCurrentStep: validateCurrentStep,
        initializeImageUploader: initializeImageUploader
    };
    
    console.log('덕생 등록 페이지 초기화 완료');
});