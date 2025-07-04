// 이미지 업로드 연동 수정 버전 (UI 개선)

document.addEventListener('DOMContentLoaded', function() {
    
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
        
    }
    
    // 1. 모든 날짜 입력 활성화
    function enableAllDateInputs() {
        
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
                        
                        // 중복 확인 버튼 상태 업데이트 (디바운스 적용)
                        if (fieldId.startsWith('check_')) {
                            clearTimeout(window.updateButtonTimeout);
                            window.updateButtonTimeout = setTimeout(() => {
                                updateDuplicateButton();
                            }, 100);
                        }
                    });
                    
                }
            });
        }
        
        // 전역 함수로 등록 및 디버깅 정보 추가
        window.updateDuplicateButton = updateDuplicateButton;
        
        // 디버깅을 위한 상태 확인 함수
        window.checkDuplicateFormState = function() {
            const artistId = document.getElementById('check_artist_id')?.value?.trim();
            const cafeName = document.getElementById('check_cafe_name')?.value?.trim();
            const startDate = document.getElementById('check_start_date')?.value?.trim();
            const endDate = document.getElementById('check_end_date')?.value?.trim();
            
            
            return {artistId, cafeName, startDate, endDate};
        };
        
    }
    
    // 2. 중복 확인 설정
    function setupDuplicateCheck() {
        const button = document.getElementById('check-duplicate-btn');
        const cafeNameInput = document.getElementById('check_cafe_name');
        const startDateInput = document.getElementById('check_start_date');
        const endDateInput = document.getElementById('check_end_date');
        
        if (!button) return;
        
        // 모든 입력 필드에 이벤트 리스너 추가
        if (cafeNameInput) {
            cafeNameInput.addEventListener('input', updateDuplicateButton);
            cafeNameInput.addEventListener('keyup', updateDuplicateButton);
        }
        
        if (startDateInput) {
            startDateInput.addEventListener('input', updateDuplicateButton);
            startDateInput.addEventListener('change', updateDuplicateButton);
            startDateInput.addEventListener('keyup', updateDuplicateButton);
        }
        
        if (endDateInput) {
            endDateInput.addEventListener('input', updateDuplicateButton);
            endDateInput.addEventListener('change', updateDuplicateButton);
            endDateInput.addEventListener('keyup', updateDuplicateButton);
        }
        
        // 버튼 클릭 이벤트
        button.addEventListener('click', performDuplicateCheck);
        
        // 중복 카페 섹션 이벤트 설정
        setupDuplicateCafeSection();
        
        // 초기 버튼 상태 업데이트
        setTimeout(() => {
            updateDuplicateButton();
        }, 100);
        
    }
    
    // 중복 카페 섹션 이벤트 설정 
    function setupDuplicateCafeSection() {
        const confirmBtn = document.getElementById('confirm-duplicate-btn');
        const denyBtn = document.getElementById('deny-duplicate-btn');
        
        if (confirmBtn) {
            confirmBtn.addEventListener('click', function() {
                const selectedCafeId = document.getElementById('selected_duplicate_cafe_id')?.value;
                if (!selectedCafeId) {
                    alert('먼저 해당하는 카페를 선택해주세요.');
                    return;
                }
                
                // 선택된 카페 페이지로 이동
                if (confirm('선택하신 카페 페이지로 이동하시겠습니까?')) {
                    window.location.href = `/ddoksang/cafe/${selectedCafeId}/`;
                }
            });
        }
        
        if (denyBtn) {
            denyBtn.addEventListener('click', function() {
                // 다른 카페입니다 - 바로 다음 단계로 + 토스트 메시지
                duplicateChecked = true;
                isDuplicate = false;
                hideDuplicateSection();
                
                // 토스트 메시지 표시
                if (window.showSuccessToast) {
                    window.showSuccessToast('새로운 생카 등록을 진행합니다.', 2000);
                }
                
                // 바로 데이터 복사하고 다음 단계로 이동
                copyFormData();
                setTimeout(() => {
                    showStep(1);
                }, 100);
            });
        }
    }
    
    function updateDuplicateButton() {
        const button = document.getElementById('check-duplicate-btn');
        if (!button) return;
        
        const artistId = document.getElementById('check_artist_id')?.value?.trim();
        const cafeName = document.getElementById('check_cafe_name')?.value?.trim();
        const startDate = document.getElementById('check_start_date')?.value?.trim();
        const endDate = document.getElementById('check_end_date')?.value?.trim();
        
        const isValid = artistId && cafeName && startDate && endDate;
        
        
        // DuplicateChecker 상태 확인
        const isChecking = window.DuplicateChecker ? window.DuplicateChecker.state.isChecking : false;
        
        // 항상 클릭 가능하도록 설정 (확인 중이 아닐 때)
        button.disabled = isChecking;
        button.style.pointerEvents = isChecking ? 'none' : 'auto';
        
        if (isChecking) {
            // 확인 중 상태
            button.className = 'w-full px-6 py-3 bg-gray-400 text-gray-200 rounded-lg font-medium cursor-not-allowed';
        } else if (isValid) {
            // 활성화 상태 (검정색)
            button.className = 'w-full px-6 py-3 bg-gray-900 text-white rounded-lg font-medium transition-colors hover:bg-gray-800 cursor-pointer';
        } else {
            // 비활성화 상태 (회색)
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
                
                
                // 여러 가지 경우를 모두 확인 (하위 호환성)
                const hasSimilarCafes = (
                    (data.exists && data.similar_cafes && data.similar_cafes.length > 0) ||
                    (data.exists && data.duplicates && data.duplicates.length > 0) ||
                    (data.exists && data.similar_count > 0)
                );
                
                if (hasSimilarCafes) {
                    // 중복 카페가 있는 경우 - 카페 목록 표시
                    const cafes = data.similar_cafes || data.duplicates || [];
                    showDuplicateCafes(cafes);
                    isDuplicate = true;
                } else {
                    // 중복 없음 - 토스트 메시지 표시 후 바로 다음 단계로
                    isDuplicate = false;
                    duplicateChecked = true;
                    
                    // 토스트 메시지 표시
                    if (window.showSuccessToast) {
                        window.showSuccessToast('중복 확인 완료! 새로운 생카를 등록할 수 있습니다.', 2000);
                    }
                    
                    // 바로 데이터 복사하고 다음 단계로 이동
                    copyFormData();
                    setTimeout(() => {
                        showStep(1);
                    }, 100);
                }
            })
            .catch(error => {
                alert('중복 확인 중 오류가 발생했습니다.');
            })
            .finally(() => {
                button.textContent = originalText;
                button.disabled = false;
            });
    }
    
    // 중복 카페 목록 표시 함수 (2개씩 배치로 개선)
    function showDuplicateCafes(duplicates) {

        // 중복 확인 폼 숨김
        const duplicateForm = document.getElementById('duplicate-check-form');
        if (duplicateForm) duplicateForm.style.display = 'none';

        // 중복 카페 섹션 표시
        const duplicateSection = document.getElementById('duplicate-cafes-section');
        if (duplicateSection) duplicateSection.classList.remove('hidden');

        const gridContainer = document.getElementById('duplicate-cafes-grid');
        if (!gridContainer) {
            return;
        }

        //  카드 생성 (템플릿 사용)
        if (window.DuplicateCardTemplate) {
            //  카드에 .duplicate-cafe-card 및 data-cafe-id 추가 보장
            const cardsHtml = window.DuplicateCardTemplate.createCards(duplicates)
                .replaceAll('<div class="relative ', '<div class="duplicate-cafe-card relative ')
                .replaceAll('<div class="relative"', '<div class="duplicate-cafe-card relative"');

            gridContainer.innerHTML = cardsHtml;
        } else {
            gridContainer.innerHTML = '<p class="text-red-500">카드 템플릿을 로드할 수 없습니다.</p>';
            return;
        }

        //  카드 선택 이벤트 바인딩
        document.querySelectorAll('.duplicate-cafe-card').forEach(card => {
            card.addEventListener('click', () => {
                // 기존 선택 해제
                document.querySelectorAll('.duplicate-cafe-card').forEach(c => {
                    c.classList.remove('selected', 'ring-2', 'ring-blue-500');
                });

                // 현재 선택
                card.classList.add('selected', 'ring-2', 'ring-blue-500');

                // 선택 ID 저장
                const selectedId = card.dataset.cafeId;
                const hiddenInput = document.getElementById('selected_duplicate_cafe_id');
                if (hiddenInput) {
                    hiddenInput.value = selectedId;
                }

            });
        });

        // 선택된 상태 강조를 위한 CSS가 없으면 아래 스타일도 포함해주세요
    }

    
    // 중복 카페 카드 생성 함수 (유사도 퍼센트 제거)
    function createDuplicateCafeCard(cafe) {
        const card = document.createElement('div');
        card.className = 'duplicate-cafe-card bg-white border-2 border-transparent rounded-lg p-4 shadow-md hover:shadow-lg transition-all duration-200 relative cursor-pointer';
        card.dataset.cafeId = cafe.id;
        
        // 이미지 HTML
        const imageHtml = cafe.main_image ? 
            `<img src="${cafe.main_image}" alt="${cafe.cafe_name}" class="w-full h-32 object-cover rounded-lg mb-3">` :
            `<div class="w-full h-32 bg-gradient-to-br from-pink-100 to-purple-100 rounded-lg mb-3 flex items-center justify-center">
                <span class="text-pink-400 text-2xl">🏪</span>
            </div>`;
        
        card.innerHTML = `
            <div class="selected-indicator absolute top-2 right-2 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center opacity-0">
                <svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
                </svg>
            </div>
            
            ${imageHtml}
            
            <div class="mb-3">
                <div class="flex items-center gap-2 mb-2">
                    ${cafe.member_name ? 
                        `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">멤버</span>` :
                        `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">아티스트</span>`
                    }
                </div>
                <h4 class="font-semibold text-gray-900 text-sm mb-1">${cafe.cafe_name}</h4>
                <p class="text-xs text-gray-600">${cafe.artist_name}${cafe.member_name ? ' - ' + cafe.member_name : ''}</p>
            </div>
            
            <div class="space-y-2 text-xs text-gray-600">
                <div class="flex items-center">
                    <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"></path>
                    </svg>
                    <span>${cafe.start_date} ~ ${cafe.end_date}</span>
                </div>
                
                <div class="flex items-start">
                    <svg class="w-3 h-3 mr-1 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"></path>
                    </svg>
                    <span class="leading-tight">${cafe.address}</span>
                </div>
                
                ${cafe.status_display ? `
                <div class="flex items-center">
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cafe.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}">
                        ${cafe.status_display}
                    </span>
                </div>
                ` : ''}
            </div>
        `;
        
        // 카드 클릭 이벤트
        card.addEventListener('click', function() {
            // 다른 카드들 선택 해제
            document.querySelectorAll('.duplicate-cafe-card').forEach(c => {
                c.classList.remove('selected');
            });
            
            // 현재 카드 선택
            card.classList.add('selected');
            
            // hidden input에 선택된 카페 ID 저장
            const hiddenInput = document.getElementById('selected_duplicate_cafe_id');
            if (hiddenInput) {
                hiddenInput.value = cafe.id;
            }
            
        });
        
        return card;
    }
    
    // 중복 섹션 숨기기 함수 추가
    function hideDuplicateSection() {
        const duplicateSection = document.getElementById('duplicate-cafes-section');
        if (duplicateSection) {
            duplicateSection.classList.add('hidden');
        }
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
            6: [] // 이미지는 별도 검증
        };
        
        const rules = stepValidationRules[currentStep];
        if (!rules) return true;
        
        // Step 6에서는 이미지 업로더를 통한 검증
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
    
    // 이미지 검증 함수 - 안전한 체크 추가
    function validateImages() {
        
        // Step 6이 아닌 경우 검증 건너뛰기
        if (currentStep !== 6) {
            return true;
        }
        
        // 이미지 업로더가 없는 경우 초기화 시도
        if (!window.ddoksangImageUploader) {
            initializeImageUploader();
            
            // 초기화 후 재확인
            if (!window.ddoksangImageUploader) {
                alert('이미지 업로더를 초기화하는 중입니다. 잠시 후 다시 시도해주세요.');
                return false;
            }
        }
        
        const fileCount = window.ddoksangImageUploader.getFileCount();
        const formFileCount = window.ddoksangImageUploader.getFormFileCount();
    
        
        if (fileCount === 0) {
            alert('최소 1개의 이미지를 업로드해주세요.');
            return false;
        }
        
        // 폼 파일 동기화 확인
        if (fileCount > 0 && formFileCount === 0) {
            window.ddoksangImageUploader.syncFormFiles();
            
            // 동기화 후 재확인
            const newFormFileCount = window.ddoksangImageUploader.getFormFileCount();
            if (newFormFileCount === 0) {
                alert('이미지 업로드에 문제가 있습니다. 이미지를 다시 선택해주세요.');
                return false;
            }
        }
        
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
        
        // Step 2에서 지도 초기화
        if (index === 2 && window.DdoksangMapUtils && !window.DdoksangMapUtils.map) {
            setTimeout(() => {
                window.DdoksangMapUtils.initMap();
            }, 100);
        }
        
        // Step 6에서만 이미지 업로더 초기화
        if (index === 6) {
            setTimeout(() => {
                initializeImageUploader();
            }, 100);
        }
    }
    
    // 이미지 업로더 초기화 함수 - 안전한 체크 추가
    function initializeImageUploader() {
        
        // Step 6이 아닌 경우 초기화하지 않음
        if (currentStep !== 6) {
            return;
        }
        
        // 이미 초기화된 경우 재사용
        if (window.ddoksangImageUploader && window.ddoksangImageUploader.isInitialized) {
            
            // 상태 검증 및 동기화
            const validation = window.ddoksangImageUploader.validateState();
            if (validation.needsSync) {
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
            return;
        }
        
        // 초기화 함수 존재 확인
        if (typeof window.initDdoksangImageUpload !== 'function') {
            return;
        }
        
        // 이미지 업로더 초기화
        try {
            const uploader = window.initDdoksangImageUpload();
            
            if (uploader && uploader.isInitialized) {
                
                // 파일 변경 이벤트 리스너 추가
                document.addEventListener('filesUpdated', function(event) {
                    updateNextButtonState();
                });
                
                // 초기 버튼 상태 설정
                updateNextButtonState();
                
            }
        } catch (error) {

        }
    }
    
    // 다음 버튼 상태 업데이트 함수 - 안전한 체크 추가
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
            nextBtn.textContent = '덕';
        }
        
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
            // 중복 확인용 자동완성 (아티스트/멤버 태그 표시)
            initAutocomplete('artist-member-search', 'artist-member-results', {
                showBirthday: true,
                showArtistTag: true, // 아티스트/멤버 구분 태그 표시
                submitOnSelect: false,
                onSelect: handleArtistSelection
            });
            
            // Step 1용 자동완성
            initAutocomplete('final-artist-member-search', 'final-artist-member-results', {
                showBirthday: true,
                showArtistTag: true, // 아티스트/멤버 구분 태그 표시
                submitOnSelect: false,
                onSelect: handleFinalArtistSelection
            });
            
        }
    }
    
    function handleArtistSelection(result) {
        
        setValue('check_artist_id', result.artist_id);
        setValue('check_member_id', result.member_id || '');
        
        // UI 업데이트
        const searchInput = document.getElementById('artist-member-search');
        const selectedDiv = document.getElementById('selected-artist');
        const selectedText = document.getElementById('selected-artist-text');
        const selectedBadge = document.getElementById('selected-artist-type-badge');
        const resultsList = document.getElementById('artist-member-results');
        
        if (searchInput) searchInput.classList.add('hidden');
        if (selectedDiv) selectedDiv.classList.remove('hidden');
        if (selectedText) selectedText.textContent = result.name;
        
        // 공통 유틸리티 함수 사용 (일관성 보장)
        if (selectedBadge && window.ArtistBadgeUtils) {
            const resultType = window.ArtistBadgeUtils.getResultType(result);
            window.ArtistBadgeUtils.applyBadgeStyle(selectedBadge, resultType);
        }
        
        if (resultsList) resultsList.classList.add('hidden');
        
        // 아티스트 선택 후 버튼 상태 업데이트
        setTimeout(() => {
            updateDuplicateButton();
        }, 50);
    }
    
    function handleFinalArtistSelection(result) {
        setValue('final_artist_id', result.artist_id);
        setValue('final_member_id', result.member_id || '');
        
        // UI 업데이트
        const searchInput = document.getElementById('final-artist-member-search');
        const selectedDiv = document.getElementById('final-selected-artist');
        const selectedText = document.getElementById('final-selected-artist-text');
        const selectedBadge = document.getElementById('final-selected-artist-type-badge');
        const resultsList = document.getElementById('final-artist-member-results');
        
        if (searchInput) searchInput.classList.add('hidden');
        if (selectedDiv) selectedDiv.classList.remove('hidden');
        if (selectedText) selectedText.textContent = result.name;
        
        // 공통 유틸리티 함수 사용 (일관성 보장)
        if (selectedBadge && window.ArtistBadgeUtils) {
            const resultType = window.ArtistBadgeUtils.getResultType(result);
            window.ArtistBadgeUtils.applyBadgeStyle(selectedBadge, resultType);
        }
        
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
        const selectedBadge = document.getElementById('selected-artist-type-badge');
        
        if (selectedDiv) selectedDiv.classList.add('hidden');
        if (searchInput) searchInput.classList.remove('hidden');
        
        // 공통 유틸리티를 사용한 배지 초기화
        if (selectedBadge && window.ArtistBadgeUtils) {
            window.ArtistBadgeUtils.applyBadgeStyle(selectedBadge, 'artist'); // 기본값으로 아티스트 스타일
            selectedBadge.textContent = ''; // 텍스트는 빈 값으로
        }
        
        // 선택 초기화 후 버튼 상태 업데이트
        setTimeout(() => {
            updateDuplicateButton();
        }, 50);
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
        const selectedBadge = document.getElementById('final-selected-artist-type-badge');
        
        if (selectedDiv) selectedDiv.classList.add('hidden');
        if (searchInput) searchInput.classList.remove('hidden');
        
        // 공통 유틸리티를 사용한 배지 초기화
        if (selectedBadge && window.ArtistBadgeUtils) {
            window.ArtistBadgeUtils.applyBadgeStyle(selectedBadge, 'artist'); // 기본값으로 아티스트 스타일
            selectedBadge.textContent = ''; // 텍스트는 빈 값으로
        }
    };
    
    // 전역 앱 객체 생성 - 안전한 체크 추가
    window.ddoksangApp = {
        currentStep: () => currentStep,
        moveToStep: showStep,
        updateNextButtonState: updateNextButtonState,
        validateCurrentStep: validateCurrentStep,
        initializeImageUploader: initializeImageUploader,
        isImageUploaderReady: () => {
            return window.ddoksangImageUploader && window.ddoksangImageUploader.isInitialized;
        }
    };
    
});